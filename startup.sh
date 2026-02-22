#!/bin/bash
set -e

echo "=== Foundry startup ==="
echo "PWD: $(pwd)"

# WEBSITE_RUN_FROM_PACKAGE=1 mounts ZIP as read-only wwwroot
# No Oryx interference, no symlink issues

# Verify node_modules
if [ -f node_modules/next/package.json ]; then
    echo "node_modules/next: OK"
else
    echo "ERROR: node_modules/next not found"
    ls -la node_modules/ 2>/dev/null | head -15 || echo "No node_modules directory"
fi

# Override NODE_PATH (Oryx may have set it to /node_modules)
export NODE_PATH=""

# Create data directory (persistent across deploys, outside wwwroot)
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
