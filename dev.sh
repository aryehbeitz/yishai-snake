#!/bin/bash

echo "Starting dev servers with hot reload..."
echo "  App + API:    http://localhost:3460 (auto-restarts on file change)"
echo ""
echo "Press Ctrl+C to stop"
echo "---"

# Start server (handles API + static files with .html rewrite)
npx --yes nodemon --watch server.js --watch '*.html' --watch '*.css' --watch '*.js' --ext js,html,css,json server.js &
API_PID=$!

# Trap Ctrl+C and kill
trap "kill $API_PID 2>/dev/null; exit" INT TERM

wait
