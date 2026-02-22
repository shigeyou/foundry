#!/bin/bash

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
