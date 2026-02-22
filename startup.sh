#!/bin/bash
set -e

echo "=== Foundry startup ==="
echo "PWD: $(pwd)"

# ===== CRITICAL: Undo Oryx interference FIRST =====
# Oryx (Azure's build system) may run BEFORE this script and:
# 1. Extract node_modules.tar.gz to /node_modules
# 2. Move our node_modules to _del_node_modules
# 3. Create symlink: ./node_modules -> /node_modules
# 4. Set NODE_PATH="/node_modules"
# We must undo ALL of this.

# Clear NODE_PATH to prevent loading modules from /node_modules
export NODE_PATH=""

# Remove Oryx artifacts to prevent re-triggering
rm -f oryx-manifest.toml node_modules.tar.gz 2>/dev/null || true

# Restore our original node_modules
if [ -d _del_node_modules ]; then
    echo "Oryx moved our node_modules -> restoring from _del_node_modules..."
    rm -rf node_modules 2>/dev/null || unlink node_modules 2>/dev/null || true
    mv _del_node_modules node_modules
    echo "Restored node_modules"
elif [ -L node_modules ]; then
    echo "Removing Oryx symlink: $(readlink node_modules)"
    unlink node_modules
    echo "ERROR: Original node_modules was lost. Deployment is broken."
    exit 1
fi

# Clean up Oryx's /node_modules extraction
rm -rf /node_modules 2>/dev/null || true

# ===== Verification =====
echo "=== node_modules check ==="
if [ -f node_modules/next/package.json ]; then
    echo "next: OK"
else
    echo "ERROR: node_modules/next not found!"
    ls node_modules/ 2>/dev/null | head -10 || echo "node_modules is missing entirely"
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

# Sync database schema
if [ -f node_modules/prisma/build/index.js ]; then
    echo "Syncing database schema..."
    node node_modules/prisma/build/index.js db push --schema=prisma/schema.prisma --skip-generate --accept-data-loss 2>&1 || echo "Schema sync failed (non-fatal)"
else
    echo "Prisma CLI not found, schema sync skipped"
fi

# ===== Start application =====
echo "Starting server.js..."
exec node server.js
