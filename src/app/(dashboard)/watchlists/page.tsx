"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useState, useCallback } from "react";
import { Plus, Trash2, List } from "lucide-react";
import type { Watchlist } from "@/types";

export default function WatchlistsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [watchlists, setWatchlists] = useState<Watchlist[]>([]);
  const [loading, setLoading] = useState(true);
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login");
    }
  }, [status, router]);

  const fetchWatchlists = useCallback(async () => {
    try {
      const res = await fetch("/api/watchlists");
      if (res.ok) {
        const data = await res.json();
        setWatchlists(data);
      }
    } catch (err) {
      console.error("Failed to fetch watchlists:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  // Poll for updates every 10 seconds to show new stocks
  useEffect(() => {
    if (status !== "authenticated") return;

    const interval = setInterval(() => {
      fetchWatchlists();
    }, 10000);

    return () => clearInterval(interval);
  }, [status, fetchWatchlists]);

  useEffect(() => {
    if (status === "authenticated") {
      fetchWatchlists();
    }
  }, [status, fetchWatchlists]);

  const createWatchlist = async () => {
    if (!newName.trim()) return;
    setCreating(true);

    try {
      const res = await fetch("/api/watchlists", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newName }),
      });

      if (res.ok) {
        setNewName("");
        fetchWatchlists();
      }
    } catch (err) {
      console.error("Failed to create watchlist:", err);
    } finally {
      setCreating(false);
    }
  };

  const deleteWatchlist = async (id: string) => {
    try {
      await fetch(`/api/watchlists/${id}`, { method: "DELETE" });
      fetchWatchlists();
    } catch (err) {
      console.error("Failed to delete watchlist:", err);
    }
  };

  if (status === "loading" || loading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-zinc-700 border-t-emerald-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-white">My Watchlists</h1>
        <p className="mt-1 text-sm text-zinc-500">
          Manage your stock watchlists
        </p>
      </div>

      {/* Create new */}
      <div className="flex gap-2">
        <input
          type="text"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="New watchlist name..."
          className="flex-1 rounded-lg border border-zinc-700 bg-zinc-800 px-4 py-2.5 text-sm text-white placeholder-zinc-500 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
          onKeyDown={(e) => e.key === "Enter" && createWatchlist()}
        />
        <button
          onClick={createWatchlist}
          disabled={creating || !newName.trim()}
          className="flex items-center gap-2 rounded-lg bg-emerald-500 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-emerald-600 disabled:opacity-50"
        >
          <Plus className="h-4 w-4" />
          Create
        </button>
      </div>

      {/* Watchlist cards */}
      <div className="space-y-3">
        {watchlists.map((wl) => (
          <div
            key={wl.id}
            className="flex items-center justify-between rounded-xl border border-zinc-800 bg-zinc-900/50 p-4"
          >
            <div className="flex items-center gap-3">
              <List className="h-5 w-5 text-zinc-500" />
              <div>
                <span className="font-medium text-white">{wl.name}</span>
                <span className="ml-2 text-sm text-zinc-500">
                  {wl.stocks.length} stocks
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  // Store the watchlist ID in sessionStorage so dashboard knows which to show
                  sessionStorage.setItem("activeWatchlistId", wl.id);
                  router.push("/dashboard");
                }}
                className="rounded-lg bg-zinc-800 px-3 py-1.5 text-xs font-medium text-zinc-400 hover:text-white"
              >
                View
              </button>
              <button
                onClick={() => deleteWatchlist(wl.id)}
                className="rounded-lg p-1.5 text-zinc-500 hover:bg-red-500/10 hover:text-red-500"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          </div>
        ))}
      </div>

      {watchlists.length === 0 && (
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-12 text-center">
          <p className="text-zinc-500">No watchlists yet. Create one above.</p>
        </div>
      )}
    </div>
  );
}
