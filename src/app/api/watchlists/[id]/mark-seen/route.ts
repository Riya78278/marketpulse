import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { fetchMultipleQuotes } from "@/lib/market-data";
import { cacheDelPattern } from "@/lib/redis";

// POST /api/watchlists/[id]/mark-seen - Update lastViewedAt and store price snapshots
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    const watchlist = await prisma.watchlist.findFirst({
      where: { id, userId: session.user.id },
      include: {
        stocks: true,
      },
    });

    if (!watchlist) {
      return NextResponse.json({ error: "Watchlist not found" }, { status: 404 });
    }

    // Fetch current prices for all stocks in the watchlist
    // This allows us to store a price snapshot for "change since last view" calculations
    const symbols = watchlist.stocks.map((s) => s.symbol);
    const quotes = await fetchMultipleQuotes(symbols);
    const quoteMap = new Map(quotes.map((q) => [q.symbol, q]));

    // Store price snapshots for each stock
    const now = new Date();
    for (const stock of watchlist.stocks) {
      const quote = quoteMap.get(stock.symbol);
      if (quote) {
        await prisma.watchlistStockPriceSnapshot.create({
          data: {
            watchlistStockId: stock.id,
            price: quote.price,
            change: quote.change,
            volume: quote.volume,
            snapshotAt: now,
          },
        });
      }
    }

    const updated = await prisma.watchlist.update({
      where: { id },
      data: { lastViewedAt: now },
    });

    // Invalidate summary cache
    await cacheDelPattern(`watchlist:summary:${session.user.id}:${id}*`);

    return NextResponse.json({ lastViewedAt: updated.lastViewedAt });
  } catch (error) {
    console.error("Error marking seen:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
