-- CreateTable
CREATE TABLE "watchlist_stock_price_snapshots" (
    "id" TEXT NOT NULL,
    "watchlist_stock_id" TEXT NOT NULL,
    "price" DECIMAL(12,4) NOT NULL,
    "change" DECIMAL(8,4),
    "volume" BIGINT,
    "snapshot_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "watchlist_stock_price_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "watchlist_stock_price_snapshots_watchlist_stock_id_snapshot_idx" ON "watchlist_stock_price_snapshots"("watchlist_stock_id", "snapshot_at" DESC);

-- AddForeignKey
ALTER TABLE "watchlist_stock_price_snapshots" ADD CONSTRAINT "watchlist_stock_price_snapshots_watchlist_stock_id_fkey" FOREIGN KEY ("watchlist_stock_id") REFERENCES "watchlist_stocks"("id") ON DELETE CASCADE ON UPDATE CASCADE;
