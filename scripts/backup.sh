#!/bin/bash
# Nightly Supabase backup for the tickets app.
# Runs pg_dump via a disposable postgres:16 container (no host deps).
# Restore with:  gunzip -c <file.sql.gz> | psql "<DATABASE_URL>"
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKUP_DIR="$SCRIPT_DIR/backups"
RETENTION_DAYS=30
TS="$(date +%Y-%m-%d-%H%M%S)"

# Read DATABASE_URL out of .env (strips surrounding quotes)
DATABASE_URL="$(grep -E '^DATABASE_URL=' "$SCRIPT_DIR/.env" \
  | head -n1 | sed -E 's/^DATABASE_URL=//; s/^"//; s/"$//')"

if [ -z "${DATABASE_URL:-}" ]; then
  echo "[$(date -Iseconds)] ERROR: DATABASE_URL missing in $SCRIPT_DIR/.env" >&2
  exit 1
fi

mkdir -p "$BACKUP_DIR"
OUT="$BACKUP_DIR/tickets-$TS.sql.gz"

echo "[$(date -Iseconds)] Backup starting → $OUT"

# Prisma-style ?schema=tickets isn't libpq syntax; strip it and use -n instead
PG_URL="$(echo "$DATABASE_URL" | sed -E 's/[?&]schema=[^&]+//; s/[?&]$//')"

docker run --rm \
  postgres:16 \
  pg_dump --no-owner --no-privileges -n tickets "$PG_URL" \
  | gzip > "$OUT"

SIZE="$(du -h "$OUT" | cut -f1)"
echo "[$(date -Iseconds)] Backup complete: $OUT ($SIZE)"

# Keep last $RETENTION_DAYS days; drop older
find "$BACKUP_DIR" -maxdepth 1 -name 'tickets-*.sql.gz' -type f -mtime +"$RETENTION_DAYS" -print -delete \
  | sed "s|^|[$(date -Iseconds)] Deleted old: |" || true
