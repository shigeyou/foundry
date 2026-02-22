#!/bin/bash
set -e

echo "=== Foundry startup ==="
echo "PWD: $(pwd)"
echo "node_modules type: $(stat -c %F node_modules 2>/dev/null || echo 'missing')"

# Handle Oryx node_modules extraction
# Oryx may: extract node_modules.tar.gz to /node_modules, move original to _del_node_modules,
# symlink ./node_modules -> /node_modules, set NODE_PATH="/node_modules"
if [ -d _del_node_modules ]; then
    echo "Restoring original node_modules from _del_node_modules..."
    if [ -L node_modules ]; then
        unlink node_modules
    elif [ -e node_modules ]; then
        rm -rf node_modules
    fi
    mv _del_node_modules node_modules
    echo "Restored. Contents:"
    ls node_modules/ | head -15
elif [ -L node_modules ]; then
    echo "WARNING: node_modules is a stale symlink -> $(readlink node_modules)"
    unlink node_modules
    echo "Removed stale symlink"
fi

# Prevent Oryx from doing this again
rm -f node_modules.tar.gz oryx-manifest.toml 2>/dev/null || true

# Override NODE_PATH
export NODE_PATH=""

# Verify
if [ -f node_modules/next/package.json ]; then
    echo "node_modules/next: OK"
else
    echo "ERROR: node_modules/next not found!"
    ls node_modules/ 2>/dev/null | head -15 || echo "node_modules dir is missing"
fi

# Create data directory (persistent across deploys)
mkdir -p /home/data

# Copy initial database if not exists
if [ ! -f /home/data/foundry.db ]; then
    cp data/dev.db /home/data/foundry.db
    echo "Copied initial database"
fi

# Set database URL
export DATABASE_URL="file:/home/data/foundry.db"

# Sync database schema
if [ -f node_modules/prisma/build/index.js ]; then
    node node_modules/prisma/build/index.js db push --schema=prisma/schema.prisma --skip-generate --accept-data-loss 2>&1 || echo "Schema sync skipped"
else
    echo "Prisma CLI not found, schema sync skipped"
fi

# Start the application
echo "Starting server.js..."
exec node server.js
