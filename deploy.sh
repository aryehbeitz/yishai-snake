#!/bin/bash
# Deploy: bump cache, restart API
set -e
cd "$(dirname "$0")"
VER=$(date +%s)
sed -i "s/\?v=[0-9]*/\?v=$VER/g" index.html
echo "$VER" > version.txt
pm2 restart snake-api 2>/dev/null || pm2 start server.js --name snake-api
echo "✅ Deployed v$VER"
