#!/bin/sh
# Make sure the data folder (Coolify persistent storage) is writable, then run as the unprivileged "node" user.
set -e
DIR="${DATA_DIR:-/data}"
mkdir -p "$DIR"
chown -R node:node "$DIR" 2>/dev/null || true
exec su-exec node node /app/server/server.mjs
