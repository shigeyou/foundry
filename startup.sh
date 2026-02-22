#!/bin/bash

# Undo Oryx node_modules extraction
# Oryx: extracts node_modules.tar.gz to /node_modules, moves original to _del_node_modules,
# symlinks ./node_modules -> /node_modules, sets NODE_PATH="/node_modules"
# We must undo ALL of this for standalone build to work correctly
if [ -d _del_node_modules ]; then
    echo "Restoring original node_modules (undoing Oryx node_modules extraction)..."
    rm -rf node_modules 2>/dev/null || unlink node_modules 2>/dev/null
    mv _del_node_modules node_modules
    echo "Restored node_modules from _del_node_modules"
    ls node_modules/ | head -10
fi

# Clear Oryx's /node_modules to prevent NODE_PATH conflicts
# Oryx sets NODE_PATH="/node_modules" which causes Node to find incomplete packages there
if [ -d /node_modules ] && [ -d node_modules ]; then
    echo "Clearing Oryx /node_modules to prevent NODE_PATH conflicts..."
    rm -rf /node_modules
    mkdir -p /node_modules
fi

# Reset NODE_PATH to use only local node_modules
export NODE_PATH="$(pwd)/node_modules"
export PATH="$(pwd)/node_modules/.bin:$PATH"

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
# Use node_modules directly to avoid permission issues with npx
if [ -f node_modules/prisma/build/index.js ]; then
    node node_modules/prisma/build/index.js db push --schema=prisma/schema.prisma --skip-generate --accept-data-loss 2>&1 || echo "Schema sync skipped"
elif [ -f node_modules/.bin/prisma ]; then
    node_modules/.bin/prisma db push --schema=prisma/schema.prisma --skip-generate --accept-data-loss 2>&1 || echo "Schema sync skipped"
else
    echo "Prisma not found, schema sync skipped"
fi

# Start the application
node server.js
