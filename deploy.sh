#!/bin/bash
# Bump cache version in index.html
set -e
cd "$(dirname "$0")"
VER=$(date +%s)
sed -i "s/\?v=[0-9]*/\?v=$VER/g" index.html
echo "$VER" > version.txt
echo "✅ Deployed v$VER"
