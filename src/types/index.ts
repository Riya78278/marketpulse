export interface User {
  id: string;
  email: string;
  name: string | null;
  image: string | null;
}

export interface Watchlist {
  id: string;
  name: string;
  lastViewedAt: string | null;
  createdAt: string;
  updatedAt: string;
  stocks: WatchlistStock[];
}

export interface WatchlistStock {
  id: string;
  symbol: string;
  addedAt: string;
  sortOrder: number;
}

export interface StockSnapshot {
  id: string;
  symbol: string;
  name: string | null;
  price: number;
  change: number | null;
  changeAbs: number | null;
  volume: number | null;
  avgVolume: number | null;
  high52w: number | null;
  low52w: number | null;
  marketCap: number | null;
  pe: number | null;
  dayHigh: number | null;
  dayLow: number | null;
  prevClose: number | null;
  source: string;
  status: string;
  fetchedAt: string;
}

export interface MarketEvent {
  id: string;
  symbol: string;
  eventType: string;
  severity: "low" | "medium" | "high";
  value: string | null;
  previousValue: string | null;
  description: string;
  metadata: Record<string, unknown> | null;
  timestamp: string;
  source: string;
}

export interface StockSummary {
  symbol: string;
  name: string;
  price: number;
  change: number;              // Daily change (for context)
  changeSinceLastView: number; // Change since user last viewed
  attentionScore: number;
  severity: "low" | "medium" | "high";
  signals: Array<{
    type: string;
    severity: string;
    label: string;
    value?: string;
  }>;
  description: string;
  volumeRatio: number;
  near52wHigh: boolean;
  near52wLow: boolean;
  status: string;
  fetchedAt: string;
}

export interface WatchlistSummaryResponse {
  stocks: StockSummary[];
  attentionCount: number;
  mediumCount: number;
  unchangedCount: number;
  lastViewedAt: string | null;
  totalStocks: number;
  updatedAt: string; // When this summary was computed
}
