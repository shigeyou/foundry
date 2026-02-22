#!/bin/bash
set -e

echo "=== Foundry startup ==="
echo "PWD: $(pwd)"
echo "node_modules type: $(stat -c %F node_modules 2>/dev/null || echo 'missing')"

# Fix node_modules - handle all Oryx scenarios:
# 1. _del_node_modules exists: Oryx moved our real node_modules there, restore it
# 2. node_modules is a symlink to /node_modules: leftover from previous Oryx run
# 3. node_modules is a real directory: already correct

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
    # node_modules is a stale symlink (e.g. -> /node_modules from previous Oryx deploy)
    target=$(readlink node_modules)
    echo "node_modules is a symlink -> $target"
    if [ -d "$target" ] && [ -f "$target/next/package.json" ]; then
        # Symlink target has our packages (ZIP deployed into symlink target)
        echo "Symlink target has packages, converting to real directory..."
        unlink node_modules
        cp -r "$target" node_modules
        echo "Converted. Contents:"
        ls node_modules/ | head -15
    else
        # Stale symlink with no useful content - remove it
        echo "Stale symlink, removing..."
        unlink node_modules
        echo "ERROR: No valid node_modules found. ZIP deploy may have failed."
        ls -la | head -20
    fi
fi

# Prevent Oryx from extracting node_modules on next restart
rm -f node_modules.tar.gz oryx-manifest.toml 2>/dev/null || true

# Override NODE_PATH - Oryx sets it to /node_modules which has incomplete packages
export NODE_PATH=""
echo "node_modules/next exists: $(ls node_modules/next/package.json 2>/dev/null && echo YES || echo NO)"

# Create data directory
mkdir -p /home/data

# Copy initial database if not exists
if [ ! -f /home/data/foundry.db ]; then
    cp data/dev.db /home/data/foundry.db
    echo "Copied initial database"
fi

# Set database URL for the app
export DATABASE_URL="file:/home/data/foundry.db"

# Sync database schema (ignore errors)
if [ -f node_modules/prisma/build/index.js ]; then
    node node_modules/prisma/build/index.js db push --schema=prisma/schema.prisma --skip-generate --accept-data-loss 2>&1 || echo "Schema sync skipped"
else
    echo "Prisma CLI not found, schema sync skipped"
fi

# Start the application
echo "Starting server.js..."
exec node server.js
