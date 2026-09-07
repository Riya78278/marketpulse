import type { StockQuote } from "./market-data";// ─── Types ──────────────────────────────────────────────
export type Severity = "low" | "medium" | "high";
export interface Signal {
  type: string;
  severity: Severity;
  label: string;
  value?: string;
}

// What changed SINCE the user last viewed (not daily change)
export interface ChangeSinceLastView {
  symbol: string;
  priceThen: number;        // Price when user last viewed
  priceNow: number;         // Current price
  changeSinceLastView: number; // % change since last view
  changeAbsSinceLastView: number; // Absolute change since last view
  direction: "up" | "down" | "flat";
  significant: boolean;     // Does this warrant attention?
}

export interface AttentionResult {
  symbol: string;
  name: string;
  price: number;
  change: number;           // Daily change (for context)
  changeSinceLastView: number; // Change since user last viewed
  attentionScore: number;
  severity: Severity;
  signals: Signal[];
  description: string;
  volumeRatio: number;
  near52wHigh: boolean;
  near52wLow: boolean;
  status: "fresh" | "stale" | "error";
  fetchedAt: Date;
}
export interface WatchlistSummary {
  stocks: AttentionResult[];
  attentionCount: number; // high
  mediumCount: number;
  unchangedCount: number;
  lastViewedAt: Date | null;
  totalStocks: number;
  updatedAt: string;      // When this summary was computed
}

// ─── Score Calculators ──────────────────────────────────

function scorePriceChange(change: number): { score: number; signals: Signal[] } {
  const abs = Math.abs(change);
  const signals: Signal[] = [];

  if (abs >= 5) {
    signals.push({
      type: "PRICE_MOVE_HIGH",
      severity: "high",
      label: `Price moved ${change >= 0 ? "+" : ""}${change.toFixed(1)}%`,
      value: `${change >= 0 ? "+" : ""}${change.toFixed(1)}%`,
    });
    return { score: 3, signals };
  }

  if (abs >= 2) {
    signals.push({
      type: "PRICE_MOVE_MEDIUM",
      severity: "medium",
      label: `Price moved ${change >= 0 ? "+" : ""}${change.toFixed(1)}%`,
      value: `${change >= 0 ? "+" : ""}${change.toFixed(1)}%`,
    });
    return { score: 2, signals };
  }

  if (abs >= 1) {
    signals.push({
      type: "PRICE_MOVE_LOW",
      severity: "low",
      label: `Minor price movement ${change >= 0 ? "+" : ""}${change.toFixed(1)}%`,
      value: `${change >= 0 ? "+" : ""}${change.toFixed(1)}%`,
    });
    return { score: 1, signals };
  }

  return { score: 0, signals };
}

function scoreVolume(volume: number, avgVolume: number): { score: number; signals: Signal[]; ratio: number } {
  if (!avgVolume || avgVolume === 0) {
    return { score: 0, signals: [], ratio: 0 };
  }

  const ratio = volume / avgVolume;
  const signals: Signal[] = [];

  if (ratio >= 3) {
    signals.push({
      type: "VOLUME_SPIKE_HIGH",
      severity: "high",
      label: `Unusual trading volume (${ratio.toFixed(1)}× normal)`,
      value: `${ratio.toFixed(1)}×`,
    });
    return { score: 3, signals, ratio };
  }

  if (ratio >= 2) {
    signals.push({
      type: "VOLUME_SPIKE_MEDIUM",
      severity: "medium",
      label: `Elevated volume (${ratio.toFixed(1)}× normal)`,
      value: `${ratio.toFixed(1)}×`,
    });
    return { score: 2, signals, ratio };
  }

  return { score: 0, signals, ratio };
}

function score52WeekHigh(price: number, high52w: number, low52w: number): Signal[] {
  const signals: Signal[] = [];

  if (high52w > 0) {
    const distFromHigh = ((high52w - price) / high52w) * 100;
    if (distFromHigh < 1) {
      // Within 1% of 52-week high
      signals.push({
        type: "NEW_52W_HIGH",
        severity: "high",
        label: "Near 52-week high",
        value: `$${high52w.toFixed(2)}`,
      });
    } else if (distFromHigh < 5) {
      signals.push({
        type: "NEAR_52W_HIGH",
        severity: "medium",
        label: "Approaching 52-week high",
        value: `$${high52w.toFixed(2)}`,
      });
    }
  }

  if (low52w > 0) {
    const distFromLow = ((price - low52w) / low52w) * 100;
    if (distFromLow < 1) {
      signals.push({
        type: "NEW_52W_LOW",
        severity: "high",
        label: "Near 52-week low",
        value: `$${low52w.toFixed(2)}`,
      });
    }
  }

  return signals;
}// ─── Calculate Change Since Last View ──────────────────────
// Compares current price to price at a previous timestamp
// Returns null if we can't determine the previous price
export function calculateChangeSinceLastView(
  currentPrice: number,
  lastViewedAt: Date,
  // In production, this would come from historical price storage
  // For now, we estimate using the daily change if within trading hours
  dailyChangePercent: number,
  previousClose: number
): ChangeSinceLastView | null {
  const now = new Date();
  const hoursSinceView = (now.getTime() - lastViewedAt.getTime()) / (1000 * 60 * 60);

  // If viewed within last hour, use current vs previous close as proxy
  // (we don't have historical price snapshots yet)
  if (hoursSinceView < 1) {
    const estimatedPriceThen = previousClose;
    if (estimatedPriceThen <= 0) return null;

    const changeSince = ((currentPrice - estimatedPriceThen) / estimatedPriceThen) * 100;
    return {
      symbol: "", // filled in by caller
      priceThen: estimatedPriceThen,
      priceNow: currentPrice,
      changeSinceLastView: Math.round(changeSince * 100) / 100,
      changeAbsSinceLastView: Math.round((currentPrice - estimatedPriceThen) * 100) / 100,
      direction: changeSince > 0.5 ? "up" : changeSince < -0.5 ? "down" : "flat",
      significant: Math.abs(changeSince) >= 1,
    };
  }

  // For longer periods, we'd need historical data
  // Fall back to daily change as approximation
  const changeSince = dailyChangePercent;
  return {
    symbol: "",
    priceThen: previousClose,
    priceNow: currentPrice,
    changeSinceLastView: Math.round(changeSince * 100) / 100,
    changeAbsSinceLastView: Math.round((currentPrice - previousClose) * 100) / 100,
    direction: changeSince > 0.5 ? "up" : changeSince < -0.5 ? "down" : "flat",
    significant: Math.abs(changeSince) >= 1,
  };
}

// ─── Main Attention Scorer ──────────────────────────────
export function calculateAttention(
  quote: StockQuote,
  changeSinceLastView: ChangeSinceLastView | null = null
): AttentionResult {
  const signals: Signal[] = [];
  let score = 0;

  // Use change since last view if available, otherwise daily change
  const effectiveChange = changeSinceLastView?.changeSinceLastView ?? quote.change;

  // 1. Price change scoring (based on effective change)
  const priceResult = scorePriceChange(effectiveChange);
  score += priceResult.score;
  signals.push(...priceResult.signals);

  // 2. Volume scoring
  const volumeResult = scoreVolume(quote.volume, quote.avgVolume);
  score += volumeResult.score;
  signals.push(...volumeResult.signals);

  // 3. 52-week range signals
  const weekSignals = score52WeekHigh(quote.price, quote.high52w, quote.low52w);
  for (const sig of weekSignals) {
    if (sig.severity === "high") score += 2;
    else if (sig.severity === "medium") score += 1;
  }
  signals.push(...weekSignals);

  // 4. Multi-signal bonus: if 3+ signals fire, add bonus
  if (signals.length >= 3) {
    score += 2;
    signals.push({
      type: "MULTI_SIGNAL",
      severity: "high",
      label: "Multiple signals changed together",
    });
  } else if (signals.length === 2) {
    score += 1;
  }

  // Determine severity
  let severity: Severity;
  if (score >= 6) severity = "high";
  else if (score >= 3) severity = "medium";
  else severity = "low";

  // Build description
  const description = buildDescription(signals, effectiveChange);

  const nearHigh = quote.high52w > 0 && ((quote.high52w - quote.price) / quote.high52w) * 100 < 5;
  const nearLow = quote.low52w > 0 && ((quote.price - quote.low52w) / quote.low52w) * 100 < 5;

  return {
    symbol: quote.symbol,
    name: quote.name,
    price: quote.price,
    change: quote.change, // Daily change for context
    changeSinceLastView: changeSinceLastView?.changeSinceLastView ?? 0,
    attentionScore: score,
    severity,
    signals,
    description,
    volumeRatio: volumeResult.ratio,
    near52wHigh: nearHigh,
    near52wLow: nearLow,
    status: quote.status,
    fetchedAt: quote.fetchedAt,
  };
}

function buildDescription(signals: Signal[], change: number): string {
  if (signals.length === 0) {
    return "No significant changes";
  }

  const parts: string[] = [];

  // Lead with price if significant
  const priceSignal = signals.find(
    (s) => s.type === "PRICE_MOVE_HIGH" || s.type === "PRICE_MOVE_MEDIUM"
  );
  if (priceSignal) {
    parts.push(priceSignal.label);
  }

  // Volume
  const volSignal = signals.find(
    (s) => s.type === "VOLUME_SPIKE_HIGH" || s.type === "VOLUME_SPIKE_MEDIUM"
  );
  if (volSignal) {
    parts.push(volSignal.label.toLowerCase());
  }

  // 52-week
  const weekSignal = signals.find(
    (s) => s.type === "NEW_52W_HIGH" || s.type === "NEW_52W_LOW" || s.type === "NEAR_52W_HIGH"
  );
  if (weekSignal) {
    parts.push(weekSignal.label.toLowerCase());
  }

  // Multi-signal
  if (signals.length >= 3) {
    parts.push("multiple signals changed together");
  }

  return parts.join(", ");
}// ─── Build Watchlist Summary ─────────────────────────────
export function buildWatchlistSummary(
  results: AttentionResult[],
  lastViewedAt: Date | null
): WatchlistSummary {
  // Sort by attention score (highest first)
  const sorted = [...results].sort((a, b) => b.attentionScore - a.attentionScore);

  const attentionCount = sorted.filter((r) => r.severity === "high").length;
  const mediumCount = sorted.filter((r) => r.severity === "medium").length;
  const unchangedCount = sorted.filter(
    (r) => r.severity === "low" && r.attentionScore === 0
  ).length;

  return {
    stocks: sorted,
    attentionCount,
    mediumCount,
    unchangedCount,
    lastViewedAt,
    totalStocks: results.length,
    updatedAt: new Date().toISOString(),
  };
}
