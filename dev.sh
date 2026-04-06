#!/bin/bash

echo "Starting dev servers with hot reload..."
echo "  Static files: http://localhost:3000 (auto-reloads on file change)"
echo "  Scores API:   http://localhost:3460 (auto-restarts on server.js change)"
echo ""
echo "Press Ctrl+C to stop"
echo "---"

# Start static file server with live reload
npx --yes live-server --port=3000 --no-browser --ignore='*.js,.git' . &
STATIC_PID=$!

# Start API server with nodemon (auto-restarts on server.js changes)
npx --yes nodemon --watch server.js server.js &
API_PID=$!

# Trap Ctrl+C and kill both processes
trap "kill $STATIC_PID $API_PID 2>/dev/null; exit" INT TERM

# Wait for either process to exit
wait
