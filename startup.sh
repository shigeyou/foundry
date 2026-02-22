#!/bin/bash
set -e

echo "=== Foundry startup ==="
echo "PWD: $(pwd)"
echo "node_modules type: $(stat -c %F node_modules 2>/dev/null || echo 'missing')"

# Undo Oryx node_modules extraction
# Oryx: extracts node_modules.tar.gz to /node_modules, moves original to _del_node_modules,
# symlinks ./node_modules -> /node_modules, sets NODE_PATH="/node_modules"
if [ -d _del_node_modules ]; then
    echo "Restoring original node_modules..."
    # Remove symlink (not -rf, which would follow it)
    if [ -L node_modules ]; then
        unlink node_modules
    elif [ -e node_modules ]; then
        rm -rf node_modules
    fi
    mv _del_node_modules node_modules
    echo "Restored. Contents:"
    ls node_modules/ | head -15
fi

# Prevent Oryx from doing this again on next restart
rm -f node_modules.tar.gz oryx-manifest.toml 2>/dev/null || true

# Override NODE_PATH - Oryx sets it to /node_modules which has incomplete packages
export NODE_PATH=""
echo "NODE_PATH cleared. node_modules/next exists: $(ls node_modules/next/package.json 2>/dev/null && echo YES || echo NO)"

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
