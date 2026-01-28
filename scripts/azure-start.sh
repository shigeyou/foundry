#!/bin/bash
# Azure Web App startup script
# Ensures database exists before starting the server

DB_PATH="/home/data/kachisuji.db"
DATA_DIR="/home/data"
SEED_DB="data/dev.db"

echo "[Startup] Checking database at $DB_PATH..."

# Create data directory if it doesn't exist
if [ ! -d "$DATA_DIR" ]; then
    echo "[Startup] Creating data directory: $DATA_DIR"
    mkdir -p "$DATA_DIR"
fi

# If database doesn't exist, initialize it
if [ ! -f "$DB_PATH" ]; then
    echo "[Startup] Database not found. Initializing..."

    if [ -f "$SEED_DB" ]; then
        echo "[Startup] Copying seed database from $SEED_DB"
        cp "$SEED_DB" "$DB_PATH"
        echo "[Startup] Database initialized from seed"
    else
        echo "[Startup] No seed database found. Creating empty database..."
        # Create an empty database file - Prisma/libsql will create tables on connect
        touch "$DB_PATH"
    fi
else
    echo "[Startup] Database already exists at $DB_PATH"
fi

# Set correct permissions
chmod 644 "$DB_PATH"

echo "[Startup] Starting Node.js server..."
exec node server.js
