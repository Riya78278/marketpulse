import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  // Create demo user
  const passwordHash = await bcrypt.hash("demo123", 12);

  const user = await prisma.user.upsert({
    where: { email: "demo@marketpulse.com" },
    update: {},
    create: {
      email: "demo@marketpulse.com",
      name: "Riya Mondal",
      passwordHash,
    },
  });

  console.log("✅ Created user:", user.email);

  // Create default watchlist with popular stocks
  const watchlist = await prisma.watchlist.upsert({
    where: { id: "default-watchlist" },
    update: {},
    create: {
      id: "default-watchlist",
      userId: user.id,
      name: "My Watchlist",
      stocks: {
        create: [
          { symbol: "AAPL", sortOrder: 0 },
          { symbol: "NVDA", sortOrder: 1 },
          { symbol: "MSFT", sortOrder: 2 },
          { symbol: "GOOGL", sortOrder: 3 },
          { symbol: "TSLA", sortOrder: 4 },
          { symbol: "AMZN", sortOrder: 5 },
          { symbol: "META", sortOrder: 6 },
          { symbol: "NFLX", sortOrder: 7 },
        ],
      },
    },
    include: { stocks: true },
  });

  console.log("✅ Created watchlist:", watchlist.name);
  console.log("   Stocks:", watchlist.stocks.map((s: { symbol: string }) => s.symbol).join(", "));
}

main()
  .catch((e) => {
    console.error("❌ Seed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
