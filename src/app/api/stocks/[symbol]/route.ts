import { NextRequest, NextResponse } from "next/server";
import { fetchQuote } from "@/lib/market-data";
import { calculateAttention } from "@/lib/change-engine";

// GET /api/stocks/[symbol] - Get stock detail with attention scoring
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ symbol: string }> }
) {
  try {
    const { symbol } = await params;
    const quote = await fetchQuote(symbol.toUpperCase());
    // For stock detail page, we don't have lastViewedAt context
    // so we just use daily change
    const attention = calculateAttention(quote, null);

    return NextResponse.json(attention);
  } catch (error) {
    console.error("Error fetching stock:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
