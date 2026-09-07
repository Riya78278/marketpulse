import { NextRequest, NextResponse } from "next/server";
import { fetchChartData } from "@/lib/market-data";

// GET /api/stocks/[symbol]/chart?range=1m - Get chart data
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ symbol: string }> }
) {
  try {
    const { symbol } = await params;
    const { searchParams } = new URL(req.url);
    const range = (searchParams.get("range") || "1m") as "1d" | "1w" | "1m" | "3m" | "1y";

    const data = await fetchChartData(symbol.toUpperCase(), range);

    return NextResponse.json(data);
  } catch (error) {
    console.error("Error fetching chart:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
