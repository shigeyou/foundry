#!/bin/bash
set -e

echo "=== Foundry startup ==="
echo "PWD: $(pwd)"

# With WEBSITE_RUN_FROM_PACKAGE=1, wwwroot is mounted read-only from ZIP.
# Oryx cannot interfere because it cannot modify the filesystem.
# NODE_PATH may still be set by the container, so clear it.
export NODE_PATH=""

# ===== Wait for node_modules (Oryx tar.gz extraction can be slow) =====
echo "=== node_modules check ==="
MAX_WAIT=120
WAITED=0
while [ ! -f node_modules/next/package.json ] && [ "$WAITED" -lt "$MAX_WAIT" ]; do
    echo "Waiting for node_modules to be ready... (${WAITED}s / ${MAX_WAIT}s)"
    # If node_modules.tar.gz exists and node_modules is empty/missing, extract manually
    if [ -f node_modules.tar.gz ] && [ ! -f node_modules/next/package.json ]; then
        echo "Extracting node_modules.tar.gz manually..."
        mkdir -p node_modules
        tar -xzf node_modules.tar.gz -C node_modules 2>/dev/null && echo "Extraction complete" && break
    fi
    sleep 5
    WAITED=$((WAITED + 5))
done

if [ -f node_modules/next/package.json ]; then
    echo "next: OK ($(node -e "console.log(require('./node_modules/next/package.json').version)"))"
else
    echo "ERROR: node_modules/next not found after ${MAX_WAIT}s!"
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
