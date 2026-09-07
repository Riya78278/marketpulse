import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { fetchMultipleQuotes } from "@/lib/market-data";
import { calculateAttention, calculateChangeSinceLastView, buildWatchlistSummary } from "@/lib/change-engine";
import { cacheGet, cacheSet } from "@/lib/redis";

// GET /api/watchlists/[id]/summary - Get attention-scored summary
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    // Get watchlist with stocks and their price snapshots
    const watchlist = await prisma.watchlist.findFirst({
      where: { id, userId: session.user.id },
      include: {
        stocks: {
          orderBy: { sortOrder: "asc" },
          include: {
            priceSnapshots: {
              orderBy: { snapshotAt: "desc" },
              take: 1,
            },
          },
        },
      },
    });

    if (!watchlist) {
      return NextResponse.json({ error: "Watchlist not found" }, { status: 404 });
    }

    // Check cache first
    const cacheKey = `watchlist:summary:${session.user.id}:${id}`;
    const cached = await cacheGet(cacheKey);
    if (cached) {
      return NextResponse.json(cached);
    }

    // Fetch current quotes for all stocks
    const symbols = watchlist.stocks.map((s) => s.symbol);
    const quotes = await fetchMultipleQuotes(symbols);
    const quoteMap = new Map(quotes.map((q) => [q.symbol, q]));

    // Calculate attention for each stock with change-since-last-view awareness
    const results = quotes.map((quote) => {
      const stock = watchlist.stocks.find((s) => s.symbol === quote.symbol);
      let changeSinceLastView = null;

      // Get the price snapshot from when user last viewed
      // Use the snapshot if available, otherwise fall back to lastViewedAt timestamp
      if (watchlist.lastViewedAt && stock) {
        const snapshot = stock.priceSnapshots[0]; // Most recent snapshot

        if (snapshot) {
          // We have a stored price snapshot - use it for accurate change calculation
          const priceThen = Number(snapshot.price);
          const changeSince = ((quote.price - priceThen) / priceThen) * 100;
          changeSinceLastView = {
            symbol: quote.symbol,
            priceThen,
            priceNow: quote.price,
            changeSinceLastView: Math.round(changeSince * 100) / 100,
            changeAbsSinceLastView: Math.round((quote.price - priceThen) * 100) / 100,
            direction: changeSince > 0.5 ? "up" : changeSince < -0.5 ? "down" : "flat",
            significant: Math.abs(changeSince) >= 1,
          } as const;
        } else {
          // No snapshot stored, use daily change as approximation
          changeSinceLastView = calculateChangeSinceLastView(
            quote.price,
            watchlist.lastViewedAt,
            quote.change,
            quote.prevClose
          );
          if (changeSinceLastView) {
            changeSinceLastView.symbol = quote.symbol;
          }
        }
      }

      return calculateAttention(quote, changeSinceLastView);
    });

    // Build summary
    const summary = buildWatchlistSummary(results, watchlist.lastViewedAt);

    // Cache for 30 seconds
    await cacheSet(cacheKey, summary, 30);

    return NextResponse.json(summary);
  } catch (error) {
    console.error("Error fetching summary:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
