@echo off
setlocal
cd /d %~dp0

if "%PORT%"=="" set PORT=8899
set URL=http://127.0.0.1:%PORT%

where node >nul 2>nul
if errorlevel 1 (
  echo 未检测到 Node.js。请先安装 Node.js 20 或更高版本，再双击启动。
  pause
  exit /b 1
)

if not exist node_modules (
  echo 首次运行，开始安装依赖...
  call npm install
  if errorlevel 1 (
    pause
    exit /b 1
  )
)

if not exist dist (
  echo 首次运行，开始构建前端...
  call npm run build
  if errorlevel 1 (
    pause
    exit /b 1
  )
)

start "" %URL%
call npm start
