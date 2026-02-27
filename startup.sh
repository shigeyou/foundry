#!/bin/bash
set -e

echo "=== Foundry startup ==="
echo "PWD: $(pwd)"
echo "Date: $(date)"

# Clear NODE_PATH to prevent Oryx/system paths from interfering
export NODE_PATH=""

# ===== Verify node_modules (no node -e, just file check) =====
echo "=== node_modules check ==="
if [ -f node_modules/next/package.json ]; then
    echo "next: OK"
else
    echo "ERROR: node_modules/next not found!"
    ls node_modules/ 2>/dev/null | head -20 || echo "node_modules is missing entirely"
    ls -la 2>/dev/null | head -20
    exit 1
fi

# ===== Database setup =====
mkdir -p /home/data

if [ ! -f /home/data/foundry.db ]; then
    if [ -f data/dev.db ]; then
        cp data/dev.db /home/data/foundry.db
        echo "Copied initial database"
    else
        echo "WARNING: No seed database found"
    fi
fi

export DATABASE_URL="file:/home/data/foundry.db"

# Clear stale SQLite locks from previous crash
rm -f /home/data/foundry.db-journal /home/data/foundry.db-wal /home/data/foundry.db-shm 2>/dev/null
echo "SQLite locks cleared"

# Sync database schema (non-fatal on failure, 30s timeout)
if [ -f node_modules/prisma/build/index.js ]; then
    echo "Syncing database schema..."
    timeout 30 node node_modules/prisma/build/index.js db push --schema=prisma/schema.prisma --skip-generate --accept-data-loss 2>&1 || echo "Schema sync failed (non-fatal)"
else
    echo "Prisma CLI not found, schema sync skipped"
fi

# ===== Start application =====
echo "Starting server.js..."
exec node server.js
