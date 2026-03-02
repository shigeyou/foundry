#!/bin/bash
set -e

echo "=== Foundry startup ==="
echo "PWD: $(pwd)"
echo "Date: $(date)"

# Clear NODE_PATH to prevent Oryx/system paths from interfering
export NODE_PATH=""

# ===== Verify node_modules =====
echo "=== node_modules check ==="
if [ -f node_modules/next/package.json ]; then
    echo "next: OK"
else
    echo "ERROR: node_modules/next not found!"
    ls node_modules/ 2>/dev/null | head -20 || echo "node_modules is missing entirely"
    exit 1
fi

# ===== Database setup =====
mkdir -p /home/data

if [ ! -f /home/data/kachisuji.db ]; then
    if [ -f data/dev.db ]; then
        cp data/dev.db /home/data/kachisuji.db
        echo "Copied initial database"
    else
        echo "WARNING: No seed database found"
    fi
fi

export DATABASE_URL="file:/home/data/kachisuji.db"

# Clear stale SQLite locks from previous crash
rm -f /home/data/kachisuji.db-journal /home/data/kachisuji.db-wal /home/data/kachisuji.db-shm 2>/dev/null
echo "SQLite locks cleared"

# NOTE: prisma db push removed - it hangs when creating new tables on Azure.
# Schema migration is handled by instrumentation.ts using raw SQL instead.

# ===== Start application =====
echo "Starting server.js..."
exec node server.js
