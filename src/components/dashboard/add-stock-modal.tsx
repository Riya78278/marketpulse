"use client";

import { useState, useEffect, useCallback } from "react";
import { X, Search, TrendingUp } from "lucide-react";
import { searchStocks } from "@/lib/market-data";

interface StockResult {
  symbol: string;
  name: string;
}

interface Props {
  watchlistId: string;
  onStockAdded: () => void;
  onClose: () => void;
}

export function AddStockModal({ watchlistId, onStockAdded, onClose }: Props) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<StockResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [adding, setAdding] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Search stocks
  useEffect(() => {
    if (query.length < 1) {
      setResults([]);
      return;
    }

    const search = async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/stocks/search?q=${encodeURIComponent(query)}`);
        if (res.ok) {
          const data = await res.json();
          setResults(data);
        }
      } catch (err) {
        console.error("Search failed:", err);
      } finally {
        setLoading(false);
      }
    };

    const timeout = setTimeout(search, 300);
    return () => clearTimeout(timeout);
  }, [query]);

  // Add stock to watchlist
  const addToWatchlist = useCallback(async (symbol: string) => {
    setAdding(symbol);
    setError(null);

    try {
      const res = await fetch(`/api/watchlists/${watchlistId}/stocks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ symbol }),
      });

      if (!res.ok) {
        const data = await res.json();
        if (res.status === 409) {
          setError(`${symbol} is already in this watchlist`);
        } else {
          setError(data.error || "Failed to add stock");
        }
        return;
      }

      // Trigger parent to refresh
      onStockAdded();
      // Close modal after success
      setTimeout(onClose, 500);
    } catch (err) {
      setError("Failed to add stock. Please try again.");
    } finally {
      setAdding(null);
    }
  }, [watchlistId, onStockAdded, onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/80 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl border border-zinc-800 bg-zinc-900/95 p-6 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-white">Add Stock</h2>
          <button
            onClick={onClose}
            className="rounded-lg p-1 text-zinc-500 hover:text-white hover:bg-zinc-800"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by symbol or company..."
            className="w-full rounded-lg border border-zinc-700 bg-zinc-800 py-3 pl-10 pr-4 text-sm text-white placeholder-zinc-500 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
            onKeyDown={(e) => {
              if (e.key === "Escape") onClose();
              if (e.key === "Enter" && results.length > 0) {
                addToWatchlist(results[0].symbol);
              }
            }}
            autoFocus
          />
        </div>

        {/* Error */}
        {error && (
          <div className="mt-3 rounded-lg bg-red-500/10 px-4 py-2 text-sm text-red-500">
            {error}
          </div>
        )}

        {/* Results */}
        <div className="mt-4 max-h-64 overflow-y-auto rounded-lg border border-zinc-800 bg-zinc-800/50">
          {loading ? (
            <div className="p-4 text-center text-sm text-zinc-500">
              Searching...
            </div>
          ) : results.length > 0 ? (
            results.map((stock) => (
              <div
                key={stock.symbol}
                className="flex items-center justify-between border-b border-zinc-800 px-4 py-3 last:border-b-0 hover:bg-zinc-800/50 cursor-pointer"
                onClick={() => addToWatchlist(stock.symbol)}
              >
                <div className="flex items-center gap-3">
                  <TrendingUp className="h-4 w-4 text-zinc-500" />
                  <div>
                    <span className="font-semibold text-white">{stock.symbol}</span>
                    <span className="ml-2 text-sm text-zinc-500">{stock.name}</span>
                  </div>
                </div>

                <button
                  disabled={adding === stock.symbol}
                  className="rounded-lg bg-emerald-500/10 px-3 py-1.5 text-xs font-medium text-emerald-500 transition-colors hover:bg-emerald-500/20 disabled:opacity-50"
                >
                  {adding === stock.symbol ? "Adding..." : "+ Add"}
                </button>
              </div>
            ))
          ) : query.length > 0 ? (
            <div className="p-4 text-center text-sm text-zinc-500">
              No results for &ldquo;{query}&rdquo;
            </div>
          ) : (
            <div className="p-4 text-center text-sm text-zinc-500">
              Type to search for stocks...
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="mt-4 flex justify-end">
          <button
            onClick={onClose}
            className="rounded-lg px-4 py-2 text-sm font-medium text-zinc-400 hover:text-white"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
