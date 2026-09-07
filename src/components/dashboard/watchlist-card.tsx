"use client";

import { useState } from "react";
import { StockRow } from "./stock-row";
import { Plus } from "lucide-react";
import type { WatchlistSummaryResponse } from "@/types";
import { AddStockModal } from "./add-stock-modal";

interface Props {
  watchlistId: string;
  watchlistName: string;
  summary: WatchlistSummaryResponse | null;
  loading: boolean;
  stockCount: number;
  isExpanded: boolean;
  onRemoveStock: (symbol: string) => void;
  onStockAdded: () => void;
}

export function WatchlistCard({
  watchlistId,
  watchlistName,
  summary,
  loading,
  stockCount,
  isExpanded,
  onRemoveStock,
}: Props) {
  const [showAddModal, setShowAddModal] = useState(false);

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/50">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-zinc-800 px-4 py-3">
        <div className="flex items-center gap-3">
          <h3 className="font-semibold text-white">{watchlistName}</h3>
          <span className="rounded-full bg-zinc-800 px-2.5 py-0.5 text-xs text-zinc-400">
            {stockCount} stock{stockCount !== 1 ? "s" : ""}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-1 rounded-lg bg-emerald-500/10 px-3 py-1.5 text-xs font-medium text-emerald-500 transition-colors hover:bg-emerald-500/20"
          >
            <Plus className="h-3 w-3" />
            Add Stock
          </button>
        </div>
      </div>

      {/* Stock list - only show if this is the expanded/active watchlist */}
      {isExpanded ? (
        loading ? (
          <div className="p-8 text-center">
            <div className="mx-auto h-6 w-6 animate-spin rounded-full border-2 border-zinc-700 border-t-emerald-500" />
            <p className="mt-3 text-sm text-zinc-500">Fetching market data...</p>
          </div>
        ) : summary && summary.stocks.length > 0 ? (
          <div>
            {summary.stocks.map((stock) => (
              <StockRow
                key={stock.symbol}
                stock={stock}
              />
            ))}
          </div>
        ) : (
          <div className="p-8 text-center">
            <p className="text-sm text-zinc-500">
              No stocks in this watchlist. Add some to get started.
            </p>
          </div>
        )
      ) : stockCount > 0 ? (
        <div className="p-6 text-center">
          <p className="text-sm text-zinc-500">
            {stockCount} stock{stockCount !== 1 ? "s" : ""} · Click to expand
          </p>
        </div>
      ) : (
        <div className="p-6 text-center">
          <p className="text-sm text-zinc-500">
            No stocks yet. Click "Add Stock" to begin.
          </p>
        </div>
      )}

      {/* Add Stock Modal */}
      {showAddModal && (
        <AddStockModal
          watchlistId={watchlistId}
          onStockAdded={() => setShowAddModal(false)}
          onClose={() => setShowAddModal(false)}
        />
      )}
    </div>
  );
}
