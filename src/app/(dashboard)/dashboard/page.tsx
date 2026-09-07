"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useState, useCallback } from "react";
import { AttentionSummary } from "@/components/dashboard/attention-summary";
import { WatchlistCard } from "@/components/dashboard/watchlist-card";
import type { Watchlist, WatchlistSummaryResponse } from "@/types";

export default function DashboardPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [watchlists, setWatchlists] = useState<Watchlist[]>([]);
  const [activeWatchlist, setActiveWatchlist] = useState<string | null>(null);
  const [summary, setSummary] = useState<WatchlistSummaryResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [summaryLoading, setSummaryLoading] = useState(true);

  // Fetch watchlists function
  const fetchWatchlists = useCallback(async () => {
    if (status !== "authenticated") return;

    try {
      const res = await fetch("/api/watchlists");
      if (res.ok) {
        const data = (await res.json()) as Watchlist[];
        setWatchlists(data);

        // Check if user came from watchlists page with a specific watchlist to view
        const storedId = sessionStorage.getItem("activeWatchlistId");
        if (storedId) {
          // Use the stored ID if it belongs to this user's watchlists
          const watchlist = data.find((w) => w.id === storedId);
          if (watchlist) {
            setActiveWatchlist(storedId);
            sessionStorage.removeItem("activeWatchlistId");
          }
        }
      }
    } catch (err) {
      console.error("Failed to fetch watchlists:", err);
    } finally {
      setLoading(false);
    }
  }, [status]);

  // Initial fetch
  useEffect(() => {
    if (status === "authenticated") {
      fetchWatchlists();
    } else {
      setLoading(true);
    }
  }, [status, fetchWatchlists]);

  // Set first watchlist as active if none selected
  useEffect(() => {
    if (status === "authenticated" && watchlists.length > 0 && !activeWatchlist) {
      setActiveWatchlist(watchlists[0].id);
    }
  }, [watchlists, status, activeWatchlist]);

  // Fetch summary when active watchlist changes
  const fetchSummary = useCallback(async (watchlistId: string) => {
    setSummaryLoading(true);
    try {
      const res = await fetch(`/api/watchlists/${watchlistId}/summary`);
      if (res.ok) {
        const data = await res.json();
        setSummary(data);
      }
    } catch (err) {
      console.error("Failed to fetch summary:", err);
    } finally {
      setSummaryLoading(false);
    }
  }, []);

  useEffect(() => {
    if (activeWatchlist) {
      fetchSummary(activeWatchlist);
    }
  }, [activeWatchlist, fetchSummary]);

  // Mark as seen when dashboard loads
  useEffect(() => {
    if (activeWatchlist && summary && !summaryLoading) {
      fetch(`/api/watchlists/${activeWatchlist}/mark-seen`, {
        method: "POST",
      }).catch(console.error);
    }
  }, [activeWatchlist, summary, summaryLoading]);

  // Stock added handler - used by watchlist card when stock is added
  const handleStockAdded = useCallback(() => {
    if (activeWatchlist) {
      // Re-fetch both watchlists (to update stock count) and summary (to show new stock data)
      fetchWatchlists();
      fetchSummary(activeWatchlist);
    }
  }, [activeWatchlist, fetchSummary, fetchWatchlists]);

  // Remove stock handler
  const handleRemoveStock = useCallback(
    async (symbol: string) => {
      if (!activeWatchlist) return;

      try {
        await fetch(
          `/api/watchlists/${activeWatchlist}/stocks?symbol=${symbol}`,
          { method: "DELETE" }
        );
        // Refetch
        fetchSummary(activeWatchlist);
      } catch (err) {
        console.error("Failed to remove stock:", err);
      }
    },
    [activeWatchlist, fetchSummary]
  );

  if (status === "loading" || loading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-zinc-700 border-t-emerald-500" />
      </div>
    );
  }

  if (!session) return null;

  return (
    <div className="space-y-6">
      {/* Watchlist cards */}
      {watchlists.map((wl) => (
        <WatchlistCard
          key={wl.id}
          watchlistId={wl.id}
          watchlistName={wl.name}
          summary={wl.id === activeWatchlist ? summary : null}
          loading={wl.id === activeWatchlist ? summaryLoading : false}
          stockCount={wl.stocks.length}
          isExpanded={wl.id === activeWatchlist}
          onRemoveStock={handleRemoveStock}
          onStockAdded={handleStockAdded}
        />
      ))}

      {/* Since Last Visit Summary - only show when there's an active watchlist with summary */}
      {activeWatchlist && summary && (
        <div className="mt-6">
          <AttentionSummary summary={summary} />
        </div>
      )}

      {watchlists.length === 0 && !loading && (
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-12 text-center">
          <p className="text-zinc-500">
            No watchlists yet. Create one to start tracking stocks.
          </p>
        </div>
      )}
    </div>
  );
}
