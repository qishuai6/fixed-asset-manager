@echo off
setlocal
cd /d %~dp0

if "%PORT%"=="" set PORT=8899
set URL=http://127.0.0.1:%PORT%

where node >nul 2>nul
if errorlevel 1 (
  echo Node.js was not detected. Please install Node.js 20 or newer, then run this launcher again.
  pause
  exit /b 1
)

if not exist node_modules (
  echo First run: installing dependencies...
  call npm install
  if errorlevel 1 (
    pause
    exit /b 1
  )
)

if not exist dist (
  echo First run: building frontend...
  call npm run build
  if errorlevel 1 (
    pause
    exit /b 1
  )
)

start "" %URL%
call npm start
