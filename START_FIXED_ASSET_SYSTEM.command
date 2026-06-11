#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

PORT="${PORT:-8899}"
URL="http://127.0.0.1:${PORT}"

if ! command -v node >/dev/null 2>&1; then
  osascript -e 'display dialog "Node.js was not detected. Please install Node.js 20 or newer, then run this launcher again." buttons {"OK"} default button 1 with icon caution'
  exit 1
fi

if [ ! -d "node_modules" ]; then
  echo "First run: installing dependencies..."
  npm install
fi

if [ ! -d "dist" ]; then
  echo "First run: building frontend..."
  npm run build
fi

echo "Starting Fixed Asset Manager..."
( sleep 2; open "$URL" ) &
npm start
