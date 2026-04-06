#!/bin/bash

echo "Starting dev servers..."
echo "  Static files: http://localhost:3000"
echo "  Scores API:   http://localhost:3460"
echo ""
echo "Press Ctrl+C to stop"
echo "---"

# Start both servers
npx --yes serve -l 3000 &
node server.js &

STATIC_PID=$!
API_PID=$!

# Trap Ctrl+C and kill both processes
trap "kill $STATIC_PID $API_PID 2>/dev/null; exit" INT TERM

# Wait for either process to exit
wait
