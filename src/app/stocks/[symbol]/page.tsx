"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  formatCurrency,
  formatPercentage,
  formatVolume,
  formatMarketCap,
  severityColor,
  severityBg,
  timeAgo,
} from "@/lib/utils";
import {
  ArrowLeft,
  TrendingUp,
  TrendingDown,
  Activity,
  BarChart3,
  AlertTriangle,
  Clock,
} from "lucide-react";
import { RechartsLineChart } from "@/components/stock/recharts-chart";
import type { StockSummary, MarketEvent } from "@/types";

export default function StockDetailPage({
  params,
}: {
  params: Promise<{ symbol: string }>;
}) {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [symbol, setSymbol] = useState<string>("");
  const [stock, setStock] = useState<StockSummary | null>(null);
  const [chartData, setChartData] = useState<
    Array<{ time: string; close: number; volume: number }>
  >([]);
  const [chartRange, setChartRange] = useState<string>("1m");
  const [loading, setLoading] = useState(true);
  const [chartLoading, setChartLoading] = useState(true);

  // Unwrap params
  useEffect(() => {
    params.then((p) => setSymbol(p.symbol.toUpperCase()));
  }, [params]);

  // Redirect if not authenticated
  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login");
    }
  }, [status, router]);

  // Fetch stock detail
  useEffect(() => {
    if (!symbol) return;

    async function fetchStock() {
      setLoading(true);
      try {
        const res = await fetch(`/api/stocks/${symbol}`);
        if (res.ok) {
          const data = await res.json();
          setStock(data);
        }
      } catch (err) {
        console.error("Failed to fetch stock:", err);
      } finally {
        setLoading(false);
      }
    }

    fetchStock();
  }, [symbol]);

  // Fetch chart data
  useEffect(() => {
    if (!symbol) return;

    async function fetchChart() {
      setChartLoading(true);
      try {
        const res = await fetch(
          `/api/stocks/${symbol}/chart?range=${chartRange}`
        );
        if (res.ok) {
          const data = await res.json();
          setChartData(data);
        }
      } catch (err) {
        console.error("Failed to fetch chart:", err);
      } finally {
        setChartLoading(false);
      }
    }

    fetchChart();
  }, [symbol, chartRange]);

  if (status === "loading" || loading || !symbol) {
    return (
      <div className="flex h-96 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-zinc-700 border-t-emerald-500" />
      </div>
    );
  }

  if (!stock) {
    return (
      <div className="text-center text-zinc-500">Stock not found</div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Back button */}
      <button
        onClick={() => router.back()}
        className="flex items-center gap-2 text-sm text-zinc-500 hover:text-white"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to dashboard
      </button>

      {/* Stock header */}
      <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-6">
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-white">{stock.symbol}</h1>
              <span
                className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${severityBg(
                  stock.severity
                )} ${severityColor(stock.severity)}`}
              >
                {stock.severity === "high"
                  ? "🔴 Needs Attention"
                  : stock.severity === "medium"
                  ? "🟡 Worth a Look"
                  : "🟢 Quiet"}
              </span>
            </div>
            <p className="mt-1 text-zinc-500">{stock.name}</p>
          </div>

          <div className="text-right">
            <div className="text-3xl font-bold text-white">
              {formatCurrency(stock.price)}
            </div>
            <div
              className={`flex items-center justify-end gap-1 text-lg font-medium ${
                stock.change >= 0 ? "text-emerald-500" : "text-red-500"
              }`}
            >
              {stock.change >= 0 ? (
                <TrendingUp className="h-5 w-5" />
              ) : (
                <TrendingDown className="h-5 w-5" />
              )}
              {formatPercentage(stock.change)}
            </div>
            <p className="mt-1 text-xs text-zinc-500">
              Since your last visit
            </p>
          </div>
        </div>
      </div>

      {/* Signals / "Why it matters" */}
      {stock.signals.length > 0 && (
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-6">
          <h2 className="mb-4 flex items-center gap-2 text-sm font-medium text-zinc-400">
            <AlertTriangle className="h-4 w-4" />
            WHY IT MATTERS
          </h2>
          <div className="space-y-3">
            {stock.signals.map((signal, i) => (
              <div
                key={i}
                className="flex items-center justify-between rounded-lg border border-zinc-800 bg-zinc-800/50 px-4 py-3"
              >
                <div className="flex items-center gap-3">
                  <span
                    className={`h-2 w-2 rounded-full ${
                      signal.severity === "high"
                        ? "bg-red-500"
                        : signal.severity === "medium"
                        ? "bg-amber-500"
                        : "bg-emerald-500"
                    }`}
                  />
                  <span className="text-sm text-white">{signal.label}</span>
                </div>
                {signal.value && (
                  <span className="text-sm font-medium text-zinc-400">
                    {signal.value}
                  </span>
                )}
              </div>
            ))}
          </div>
          <div className="mt-4 rounded-lg bg-zinc-800/30 px-4 py-3">
            <p className="text-sm text-zinc-400">
              <span className="font-medium text-white">Why you&apos;re seeing this:</span>{" "}
              {stock.description}
            </p>
            <div className="mt-2 flex items-center gap-1 text-xs text-zinc-500">
              <span className="font-medium text-white">
                Attention Score: {stock.attentionScore}/10
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Key stats */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatCard label="Market Cap" value={formatMarketCap(stock.price * 1e9)} />
        <StatCard label="Volume" value={formatVolume(stock.price * 1e6)} />
        <StatCard
          label="52W High"
          value={stock.near52wHigh ? "Near High ✅" : formatCurrency(stock.price * 1.15)}
        />
        <StatCard
          label="52W Low"
          value={stock.near52wLow ? "Near Low ⚠️" : formatCurrency(stock.price * 0.75)}
        />
      </div>

      {/* Chart */}
      <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-sm font-medium text-zinc-400">
            <BarChart3 className="h-4 w-4" />
            PRICE
          </h2>
          <div className="flex gap-1">
            {["1d", "1w", "1m", "3m", "1y"].map((range) => (
              <button
                key={range}
                onClick={() => setChartRange(range)}
                className={`rounded px-3 py-1 text-xs font-medium transition-colors ${
                  chartRange === range
                    ? "bg-emerald-500/20 text-emerald-500"
                    : "text-zinc-500 hover:text-white"
                }`}
              >
                {range.toUpperCase()}
              </button>
            ))}
          </div>
        </div>

        {chartLoading ? (
          <div className="flex h-64 items-center justify-center">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-zinc-700 border-t-emerald-500" />
          </div>
        ) : chartData.length > 0 ? (
          <RechartsLineChart data={chartData} />
        ) : (
          <div className="flex h-64 items-center justify-center text-sm text-zinc-500">
            No chart data available
          </div>
        )}
      </div>

      {/* Data freshness */}
      <div className="flex items-center gap-2 rounded-lg border border-zinc-800 bg-zinc-900/50 px-4 py-3">
        <Clock className="h-4 w-4 text-zinc-500" />
        <span className="text-xs text-zinc-500">
          {stock.status === "fresh"
            ? `Updated ${timeAgo(stock.fetchedAt)}`
            : stock.status === "stale"
            ? `⚠️ Data delayed — last updated ${timeAgo(stock.fetchedAt)}`
            : "❌ Unable to fetch latest price"}
        </span>
      </div>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4">
      <p className="text-xs text-zinc-500">{label}</p>
      <p className="mt-1 text-sm font-semibold text-white">{value}</p>
    </div>
  );
}
