import { NextRequest, NextResponse } from "next/server";
import { searchStocks } from "@/lib/market-data";

// GET /api/stocks/search?q=apple - Search stocks
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const query = searchParams.get("q") || "";

    if (query.length < 1) {
      return NextResponse.json([]);
    }

    const results = searchStocks(query);
    return NextResponse.json(results);
  } catch (error) {
    console.error("Error searching stocks:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
