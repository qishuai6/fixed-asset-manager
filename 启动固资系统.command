#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

PORT="${PORT:-8899}"
URL="http://127.0.0.1:${PORT}"

if ! command -v node >/dev/null 2>&1; then
  osascript -e 'display dialog "未检测到 Node.js。请先安装 Node.js 20 或更高版本，再双击启动。" buttons {"知道了"} default button 1 with icon caution'
  exit 1
fi

if [ ! -d "node_modules" ]; then
  echo "首次运行，开始安装依赖..."
  npm install
fi

if [ ! -d "dist" ]; then
  echo "首次运行，开始构建前端..."
  npm run build
fi

echo "正在启动固资系统..."
( sleep 2; open "$URL" ) &
npm start
