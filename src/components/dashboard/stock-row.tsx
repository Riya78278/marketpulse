"use client";

import { formatCurrency, formatPercentage, severityDot } from "@/lib/utils";
import { TrendingDown, TrendingUp } from "lucide-react";
import type { StockSummary } from "@/types";

interface Props {
  stock: StockSummary;
}

export function StockRow({ stock }: Props) {
  // Determine which change to show: change since last view takes priority
  const displayChange = stock.changeSinceLastView !== 0 ? stock.changeSinceLastView : stock.change;
  const isUp = displayChange >= 0;

  return (
    <a
      href={`/stocks/${stock.symbol}`}
      className="flex items-center justify-between border-b border-zinc-800 px-4 py-3 transition-colors hover:bg-zinc-800/50"
    >
      {/* Left: Symbol + Name */}
      <div className="flex items-center gap-3">
        <span className={`h-2 w-2 rounded-full ${severityDot(stock.severity)}`} />
        <div>
          <span className="font-semibold text-white">{stock.symbol}</span>
          <span className="ml-2 text-sm text-zinc-500">{stock.name}</span>
        </div>
      </div>

      {/* Center: Description */}
      <div className="hidden max-w-[300px] truncate text-sm text-zinc-500 md:block">
        {stock.description}
      </div>

      {/* Right: Price + Change */}
      <div className="flex items-center gap-6">
        {/* Volume indicator */}
        {stock.volumeRatio > 2 && (
          <span className="hidden rounded bg-amber-500/10 px-2 py-0.5 text-xs text-amber-500 sm:inline">
            Vol {stock.volumeRatio.toFixed(1)}×
          </span>
        )}

        {/* Price */}
        <span className="w-20 text-right text-sm font-medium text-white">
          {stock.status === "error" ? "—" : formatCurrency(stock.price)}
        </span>

        {/* Change - show since-last-view if available */}
        <span
          className={`flex w-20 items-center justify-end gap-1 text-sm font-medium ${
            isUp ? "text-emerald-500" : "text-red-500"
          }`}
        >
          {isUp ? (
            <TrendingUp className="h-3 w-3" />
          ) : (
            <TrendingDown className="h-3 w-3" />
          )}
          {stock.status === "error" ? "—" : (
            <>
              {formatPercentage(displayChange)}
              {stock.changeSinceLastView !== 0 && stock.change !== stock.changeSinceLastView && (
                <span className="ml-1 text-zinc-600">
                  (daily: {formatPercentage(stock.change)})
                </span>
              )}
            </>
          )}
        </span>
      </div>
    </a>
  );
}
