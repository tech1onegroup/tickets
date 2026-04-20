#!/bin/sh
set -e

# Create/update schema from prisma file against Postgres (Supabase)
echo "Pushing database schema to Supabase..."
npx prisma db push --accept-data-loss 2>&1

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
