#!/bin/bash
set -e

echo "=== Foundry startup ==="
echo "PWD: $(pwd)"

# Clear NODE_PATH to prevent Oryx/system paths from interfering
export NODE_PATH=""

# ===== Verify node_modules =====
echo "=== node_modules check ==="
if [ -f node_modules/next/package.json ]; then
    echo "next: OK ($(node -e "console.log(require('./node_modules/next/package.json').version)"))"
else
    echo "ERROR: node_modules/next not found!"
    echo "Contents of node_modules/:"
    ls node_modules/ 2>/dev/null | head -20 || echo "node_modules is missing entirely"
    echo "Files in wwwroot:"
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

# Sync database schema (non-fatal on failure)
if [ -f node_modules/prisma/build/index.js ]; then
    echo "Syncing database schema..."
    node node_modules/prisma/build/index.js db push --schema=prisma/schema.prisma --skip-generate --accept-data-loss 2>&1 || echo "Schema sync failed (non-fatal)"
else
    echo "Prisma CLI not found, schema sync skipped"
fi

# ===== Start application =====
echo "Starting server.js..."
exec node server.js
