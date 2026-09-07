import { cacheGet, cacheSet } from "./redis";

// ─── Types ──────────────────────────────────────────────

export interface StockQuote {
  symbol: string;
  name: string;
  price: number;
  change: number; // daily % change
  changeAbs: number;
  volume: number;
  avgVolume: number;
  high52w: number;
  low52w: number;
  marketCap: number;
  pe: number | null;
  dayHigh: number;
  dayLow: number;
  prevClose: number;
  fetchedAt: Date;
  status: "fresh" | "stale" | "error";
}

export interface ChartData {
  time: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

// ─── Yahoo Finance Fetcher ──────────────────────────────

const YAHOO_BASE = "https://query1.finance.yahoo.com/v8/finance/chart";

// Popular stock symbols for search
const POPULAR_STOCKS = [
  { symbol: "AAPL", name: "Apple Inc." },
  { symbol: "NVDA", name: "NVIDIA Corporation" },
  { symbol: "MSFT", name: "Microsoft Corporation" },
  { symbol: "GOOGL", name: "Alphabet Inc." },
  { symbol: "AMZN", name: "Amazon.com Inc." },
  { symbol: "META", name: "Meta Platforms Inc." },
  { symbol: "TSLA", name: "Tesla Inc." },
  { symbol: "JPM", name: "JPMorgan Chase & Co." },
  { symbol: "V", name: "Visa Inc." },
  { symbol: "JNJ", name: "Johnson & Johnson" },
  { symbol: "WMT", name: "Walmart Inc." },
  { symbol: "MA", name: "Mastercard Inc." },
  { symbol: "PG", name: "Procter & Gamble Co." },
  { symbol: "UNH", name: "UnitedHealth Group" },
  { symbol: "HD", name: "Home Depot Inc." },
  { symbol: "DIS", name: "Walt Disney Co." },
  { symbol: "BAC", name: "Bank of America Corp." },
  { symbol: "XOM", name: "Exxon Mobil Corp." },
  { symbol: "PFE", name: "Pfizer Inc." },
  { symbol: "NFLX", name: "Netflix Inc." },
  { symbol: "CRM", name: "Salesforce Inc." },
  { symbol: "AMD", name: "Advanced Micro Devices" },
  { symbol: "INTC", name: "Intel Corporation" },
  { symbol: "PYPL", name: "PayPal Holdings" },
  { symbol: "UBER", name: "Uber Technologies" },
  { symbol: "SQ", name: "Block Inc." },
  { symbol: "COIN", name: "Coinbase Global" },
  { symbol: "PLTR", name: "Palantir Technologies" },
  { symbol: "SNOW", name: "Snowflake Inc." },
  { symbol: "ABNB", name: "Airbnb Inc." },
  { symbol: "SPOT", name: "Spotify Technology" },
  { symbol: "SHOP", name: "Shopify Inc." },
  { symbol: "LLY", name: "Eli Lilly & Co." },
  { symbol: "COST", name: "Costco Wholesale" },
  { symbol: "ORCL", name: "Oracle Corporation" },
  { symbol: "MRK", name: "Merck & Co." },
  { symbol: "ABBV", name: "AbbVie Inc." },
  { symbol: "KO", name: "Coca-Cola Co." },
  { symbol: "PEP", name: "PepsiCo Inc." },
  { symbol: "NKE", name: "Nike Inc." },
  { symbol: "T", name: "AT&T Inc." },
  { symbol: "VZ", name: "Verizon Communications" },
  { symbol: "CSCO", name: "Cisco Systems" },
  { symbol: "QCOM", name: "Qualcomm Inc." },
  { symbol: "ADBE", name: "Adobe Inc." },
  { symbol: "AVGO", name: "Broadcom Inc." },
  { symbol: "TXN", name: "Texas Instruments" },
  { symbol: "IBM", name: "IBM Corporation" },
  { symbol: "NOW", name: "ServiceNow Inc." },
  { symbol: "GS", name: "Goldman Sachs Group" },
];

export function searchStocks(query: string): Array<{ symbol: string; name: string }> {
  const q = query.toUpperCase();
  return POPULAR_STOCKS.filter(
    (s) => s.symbol.includes(q) || s.name.toUpperCase().includes(q)
  ).slice(0, 10);
}

// ─── Fetch Quote from Yahoo Finance ─────────────────────

export async function fetchQuote(symbol: string): Promise<StockQuote> {
  const cacheKey = `stock:quote:${symbol}`;
  const cached = await cacheGet<StockQuote>(cacheKey);
  if (cached) {
    // Check if still fresh (< 2 minutes old)
    const age = Date.now() - new Date(cached.fetchedAt).getTime();
    if (age < 2 * 60 * 1000) {
      return cached;
    }
  }

  try {
    const url = `${YAHOO_BASE}/${symbol}?interval=1d&range=1d`;
    const res = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      },
    });

    if (!res.ok) {
      throw new Error(`Yahoo Finance returned ${res.status}`);
    }

    const data = await res.json();
    const result = data.chart?.result?.[0];

    if (!result) {
      throw new Error("No data returned");
    }

    const meta = result.meta;
    const quote = result.indicators?.quote?.[0];

    const currentPrice = meta.regularMarketPrice;
    const previousClose = meta.chartPreviousClose || meta.previousClose;
    const changeAbs = currentPrice - previousClose;
    const change = (changeAbs / previousClose) * 100;

    const stock: StockQuote = {
      symbol: symbol.toUpperCase(),
      name: meta.shortName || meta.symbol || symbol.toUpperCase(),
      price: currentPrice,
      change: Math.round(change * 100) / 100,
      changeAbs: Math.round(changeAbs * 100) / 100,
      volume: quote?.volume?.[quote.volume.length - 1] || 0,
      avgVolume: meta.averageDailyVolume3Month || 0,
      high52w: meta.fiftyTwoWeekHigh || currentPrice * 1.3,
      low52w: meta.fiftyTwoWeekLow || currentPrice * 0.7,
      marketCap: meta.marketCap || 0,
      pe: meta.trailingPE || null,
      dayHigh: meta.regularMarketDayHigh || currentPrice,
      dayLow: meta.regularMarketDayLow || currentPrice,
      prevClose: previousClose,
      fetchedAt: new Date(),
      status: "fresh",
    };

    // Cache for 60 seconds
    await cacheSet(cacheKey, stock, 60);

    return stock;
  } catch (error) {
    console.error(`Failed to fetch quote for ${symbol}:`, error);

    // Return stale data if available
    if (cached) {
      return { ...cached, status: "stale" };
    }

    // Return error state
    return {
      symbol: symbol.toUpperCase(),
      name: symbol.toUpperCase(),
      price: 0,
      change: 0,
      changeAbs: 0,
      volume: 0,
      avgVolume: 0,
      high52w: 0,
      low52w: 0,
      marketCap: 0,
      pe: null,
      dayHigh: 0,
      dayLow: 0,
      prevClose: 0,
      fetchedAt: new Date(),
      status: "error",
    };
  }
}

// ─── Fetch Chart Data ───────────────────────────────────

export async function fetchChartData(
  symbol: string,
  range: "1d" | "1w" | "1m" | "3m" | "1y" = "1m"
): Promise<ChartData[]> {
  const cacheKey = `stock:chart:${symbol}:${range}`;
  const cached = await cacheGet<ChartData[]>(cacheKey);
  if (cached) return cached;

  try {
    const rangeMap: Record<string, string> = {
      "1d": "1d",
      "1w": "5d",
      "1m": "1mo",
      "3m": "3mo",
      "1y": "1y",
    };

    const url = `${YAHOO_BASE}/${symbol}?interval=${
      range === "1d" ? "5m" : range === "1w" ? "15m" : "1d"
    }&range=${rangeMap[range]}`;

    const res = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      },
    });

    if (!res.ok) throw new Error(`Yahoo Finance returned ${res.status}`);

    const data = await res.json();
    const result = data.chart?.result?.[0];

    if (!result) return [];

    const timestamps = result.timestamp || [];
    const quote = result.indicators?.quote?.[0];

    const chartData: ChartData[] = timestamps.map(
      (time: number, i: number) => ({
        time: new Date(time * 1000).toISOString().split("T")[0],
        open: quote.open[i] || 0,
        high: quote.high[i] || 0,
        low: quote.low[i] || 0,
        close: quote.close[i] || 0,
        volume: quote.volume[i] || 0,
      })
    );

    // Cache chart data for 5 minutes
    await cacheSet(cacheKey, chartData, 300);

    return chartData;
  } catch (error) {
    console.error(`Failed to fetch chart for ${symbol}:`, error);
    return cached || [];
  }
}

// ─── Batch Fetch Multiple Quotes ────────────────────────

export async function fetchMultipleQuotes(
  symbols: string[]
): Promise<StockQuote[]> {
  const quotes = await Promise.allSettled(
    symbols.map((s) => fetchQuote(s))
  );

  return quotes
    .filter((r): r is PromiseFulfilledResult<StockQuote> => r.status === "fulfilled")
    .map((r) => r.value);
}
