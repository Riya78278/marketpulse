#!/bin/bash
cd "$(dirname "$0")"

echo "🔧 Starting services..."

# Start PostgreSQL if not running
pg_isready -q 2>/dev/null || brew services start postgresql@14 2>/dev/null

# Start Redis if not running
redis-cli ping -q 2>/dev/null || brew services start redis 2>/dev/null

sleep 2

echo "🚀 Starting Next.js dev server..."
echo "   Open http://localhost:3000 in your browser"
exec npx next dev -p 3000
