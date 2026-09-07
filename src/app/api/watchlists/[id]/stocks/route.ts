import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { cacheDelPattern } from "@/lib/redis";

// POST /api/watchlists/[id]/stocks - Add a stock
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const { symbol } = await req.json();

    if (!symbol) {
      return NextResponse.json({ error: "Symbol is required" }, { status: 400 });
    }

    // Verify watchlist ownership
    const watchlist = await prisma.watchlist.findFirst({
      where: { id, userId: session.user.id },
    });

    if (!watchlist) {
      return NextResponse.json({ error: "Watchlist not found" }, { status: 404 });
    }

    // Check if already exists
    const existing = await prisma.watchlistStock.findUnique({
      where: { watchlistId_symbol: { watchlistId: id, symbol: symbol.toUpperCase() } },
    });

    if (existing) {
      return NextResponse.json({ error: "Stock already in watchlist" }, { status: 409 });
    }

    // Get max sort order
    const maxStock = await prisma.watchlistStock.findFirst({
      where: { watchlistId: id },
      orderBy: { sortOrder: "desc" },
    });

    const stock = await prisma.watchlistStock.create({
      data: {
        watchlistId: id,
        symbol: symbol.toUpperCase(),
        sortOrder: (maxStock?.sortOrder ?? -1) + 1,
      },
    });

    // Invalidate summary cache so new stock appears immediately
    await cacheDelPattern(`watchlist:summary:${session.user.id}:${id}*`);

    return NextResponse.json(stock, { status: 201 });
  } catch (error) {
    console.error("Error adding stock:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// DELETE /api/watchlists/[id]/stocks?symbol=AAPL - Remove a stock
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const { searchParams } = new URL(req.url);
    const symbol = searchParams.get("symbol");

    if (!symbol) {
      return NextResponse.json({ error: "Symbol is required" }, { status: 400 });
    }

    // Verify ownership
    const watchlist = await prisma.watchlist.findFirst({
      where: { id, userId: session.user.id },
    });

    if (!watchlist) {
      return NextResponse.json({ error: "Watchlist not found" }, { status: 404 });
    }

    await prisma.watchlistStock.deleteMany({
      where: { watchlistId: id, symbol: symbol.toUpperCase() },
    });

    // Invalidate summary cache
    await cacheDelPattern(`watchlist:summary:${session.user.id}:${id}*`);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error removing stock:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
