#!/bin/sh
set -e

# Create/update schema from prisma file against Postgres (Supabase).
# NEVER use --accept-data-loss — if a schema push would require dropping
# columns/tables/data, we want it to fail loudly so a human can decide.
echo "Syncing database schema (non-destructive only)..."
npx prisma db push 2>&1

# Seed only if no admin user exists yet (first deploy)
SEED_FLAG=/app/data/.seeded
mkdir -p /app/data
if [ ! -f "$SEED_FLAG" ]; then
  echo "Seeding database..."
  npx tsx prisma/seed.ts || echo "Seed failed or already seeded, continuing..."
  touch "$SEED_FLAG"
  echo "Seeding complete."
fi

echo "Starting Next.js..."
exec npx next start -p 3000
