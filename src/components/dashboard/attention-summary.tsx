"use client";

import { formatPercentage, severityDot, timeAgo } from "@/lib/utils";
import { AlertTriangle, Clock, TrendingDown, TrendingUp } from "lucide-react";
import type { WatchlistSummaryResponse } from "@/types";

interface Props {
  summary: WatchlistSummaryResponse;
}

export function AttentionSummary({ summary }: Props) {
  const { stocks, attentionCount, mediumCount, unchangedCount, lastViewedAt, totalStocks } = summary;
  const highStocks = stocks.filter((s) => s.severity === "high");
  const mediumStocks = stocks.filter((s) => s.severity === "medium");

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-6">
      {/* Header */}
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-white">Since Your Last Visit</h2>
        {lastViewedAt && (
          <div className="flex items-center gap-1.5 text-xs text-zinc-500">
            <Clock className="h-3 w-3" />
            Last checked {timeAgo(lastViewedAt)}
          </div>
        )}
      </div>

      {/* Stats bar */}
      <div className="mb-6 flex gap-6 text-sm">
        <div className="flex items-center gap-2">
          <span className="text-red-500">●</span>
          <span className="text-zinc-400">
            <span className="font-semibold text-white">{attentionCount}</span> need attention
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-amber-500">●</span>
          <span className="text-zinc-400">
            <span className="font-semibold text-white">{mediumCount}</span> worth a look
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-emerald-500">●</span>
          <span className="text-zinc-400">
            <span className="font-semibold text-white">{unchangedCount}</span> unchanged
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-zinc-500">↻</span>
          <span className="text-zinc-500">
            Updated {new Date(summary.updatedAt).toLocaleTimeString()}
          </span>
        </div>
      </div>

      {/* High attention stocks */}
      {highStocks.length > 0 && (
        <div className="mb-4">
          <h3 className="mb-3 flex items-center gap-2 text-sm font-medium text-red-500">
            <AlertTriangle className="h-4 w-4" />
            Needs Attention
          </h3>
          <div className="space-y-2">
            {highStocks.map((stock) => (
              <StockAlert key={stock.symbol} stock={stock} />
            ))}
          </div>
        </div>
      )}

      {/* Medium attention stocks */}
      {mediumStocks.length > 0 && (
        <div>
          <h3 className="mb-3 flex items-center gap-2 text-sm font-medium text-amber-500">
            Worth a Look
          </h3>
          <div className="space-y-2">
            {mediumStocks.map((stock) => (
              <StockAlert key={stock.symbol} stock={stock} />
            ))}
          </div>
        </div>
      )}

      {/* No attention needed */}
      {attentionCount === 0 && mediumCount === 0 && (
        <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-4 text-center">
          <p className="text-sm text-emerald-500">
            ✅ All quiet — no stocks need your attention right now.
          </p>
        </div>
      )}
    </div>
  );
}

function StockAlert({ stock }: { stock: Props["summary"]["stocks"][0] }) {
  return (
    <a
      href={`/stocks/${stock.symbol}`}
      className="flex items-center justify-between rounded-lg border border-zinc-800 bg-zinc-800/50 p-3 transition-colors hover:border-zinc-700 hover:bg-zinc-800"
    >
      <div className="flex items-center gap-3">
        <span className={`h-2 w-2 rounded-full ${severityDot(stock.severity)}`} />
        <div>
          <span className="font-semibold text-white">{stock.symbol}</span>
          <span className="ml-2 text-sm text-zinc-500">{stock.name}</span>
        </div>
      </div>

      <div className="flex items-center gap-4">
        <span
          className={`flex items-center gap-1 text-sm font-medium ${
            stock.change >= 0 ? "text-emerald-500" : "text-red-500"
          }`}
        >
          {stock.change >= 0 ? (
            <TrendingUp className="h-3 w-3" />
          ) : (
            <TrendingDown className="h-3 w-3" />
          )}
          {formatPercentage(stock.change)}
        </span>
        <span className="max-w-[200px] truncate text-xs text-zinc-500">
          {stock.description}
        </span>
      </div>
    </a>
  );
}
