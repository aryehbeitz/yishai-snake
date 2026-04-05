#!/bin/bash
# Deploy: bump cache, restart API
set -e
cd "$(dirname "$0")"
VER=$(date +%s)
for f in index.html snake.html cars.html changelog.html; do
  [ -f "$f" ] && sed -i "s/\?v=[0-9]*/\?v=$VER/g" "$f"
done
echo "$VER" > version.txt
# API runs in Docker — restart container's node process
docker exec yishai-snake node -e "process.exit(0)" 2>/dev/null || true
echo "✅ Deployed v$VER"
