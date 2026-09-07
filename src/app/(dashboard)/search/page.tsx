"use client";

import { useState, useCallback } from "react";
import { Search, TrendingUp } from "lucide-react";

interface SearchResult {
  symbol: string;
  name: string;
}

export default function SearchPage() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [adding, setAdding] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSearch = useCallback(async (q: string) => {
    if (q.length < 1) {
      setResults([]);
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`/api/stocks/search?q=${encodeURIComponent(q)}`);
      if (res.ok) {
        const data = await res.json();
        setResults(data);
      }
    } catch (err) {
      console.error("Search failed:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  const addToWatchlist = useCallback(async (symbol: string) => {
    setAdding(symbol);
    try {
      // Get first watchlist
      const wlRes = await fetch("/api/watchlists");
      if (!wlRes.ok) return;
      const watchlists = await wlRes.json();
      if (watchlists.length === 0) {
        setError("No watchlist found. Create one first.");
        return;
      }

      const wlId = watchlists[0].id;
      const res = await fetch(`/api/watchlists/${wlId}/stocks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ symbol }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Failed to add stock");
        return;
      }

      // Show success and clear results
      setSuccess(true);
      setResults([]);
      setQuery("");

      // Clear success message after 2 seconds
      setTimeout(() => setSuccess(false), 2000);

      // Navigate to dashboard to show the updated watchlist
      window.location.href = "/dashboard";
    } catch (err) {
      console.error("Failed to add stock:", err);
      setError("Failed to add stock. Please try again.");
    } finally {
      setAdding(null);
    }
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-white">Search Stocks</h1>
        <p className="mt-1 text-sm text-zinc-500">
          Find stocks to add to your watchlist
        </p>
      </div>

      {/* Search input */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
        <input
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            handleSearch(e.target.value);
          }}
          placeholder="Search by symbol or company name..."
          className="w-full rounded-xl border border-zinc-700 bg-zinc-800 py-3 pl-10 pr-4 text-sm text-white placeholder-zinc-500 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
        />
      </div>

      {/* Success/Error messages */}
      {success && (
        <div className="mb-4 rounded-lg bg-emerald-500/10 px-4 py-3 text-center text-sm text-emerald-500">
          ✅ Stock added to watchlist!
        </div>
      )}
      {error && (
        <div className="mb-4 rounded-lg bg-red-500/10 px-4 py-3 text-center text-sm text-red-500">
          {error}
        </div>
      )}

      {/* Results */}
      <div className="rounded-xl border border-zinc-800 bg-zinc-900/50">
        {loading ? (
          <div className="p-8 text-center text-sm text-zinc-500">
            Searching...
          </div>
        ) : results.length > 0 ? (
          results.map((stock) => (
            <div
              key={stock.symbol}
              className="flex items-center justify-between border-b border-zinc-800 px-4 py-3 last:border-b-0"
            >
              <div className="flex items-center gap-3">
                <TrendingUp className="h-4 w-4 text-zinc-500" />
                <div>
                  <span className="font-semibold text-white">{stock.symbol}</span>
                  <span className="ml-2 text-sm text-zinc-500">{stock.name}</span>
                </div>
              </div>

              <button
                onClick={() => addToWatchlist(stock.symbol)}
                disabled={adding === stock.symbol}
                className="rounded-lg bg-emerald-500/10 px-3 py-1.5 text-xs font-medium text-emerald-500 transition-colors hover:bg-emerald-500/20 disabled:opacity-50"
              >
                {adding === stock.symbol ? "Adding..." : "+ Add"}
              </button>
            </div>
          ))
        ) : query.length > 0 ? (
          <div className="p-8 text-center text-sm text-zinc-500">
            No results for &ldquo;{query}&rdquo;
          </div>
        ) : (
          <div className="p-8 text-center text-sm text-zinc-500">
            Type to search for stocks...
          </div>
        )}
      </div>
    </div>
  );
}
