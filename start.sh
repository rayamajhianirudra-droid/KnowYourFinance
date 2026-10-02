#!/usr/bin/env bash
# Starts both the backend and the frontend with one command, instead of
# needing two separate terminals. Press Ctrl+C once to stop both.
#
# This does not change anything about how the app works - it is purely a
# convenience wrapper around the same two commands from the README
# ("cd backend && mvn spring-boot:run" and "cd frontend && npm run dev").
# The backend still has to be started again every time your computer
# restarts; nothing in this project runs as a background service, so that
# part is normal and expected, not a bug.

set -e

cleanup() {
  echo ""
  echo "Stopping KnowYourFinance..."
  kill "$BACKEND_PID" "$FRONTEND_PID" 2>/dev/null
  wait "$BACKEND_PID" "$FRONTEND_PID" 2>/dev/null
  exit 0
}
trap cleanup INT TERM

echo "Starting backend (http://localhost:8080)..."
(cd backend && mvn spring-boot:run) &
BACKEND_PID=$!

echo "Starting frontend (http://localhost:5173)..."
(cd frontend && npm run dev) &
FRONTEND_PID=$!

echo ""
echo "Both are starting up. Press Ctrl+C to stop both."
wait
