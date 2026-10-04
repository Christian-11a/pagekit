@echo off
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js is required. Install a supported Node.js LTS release and try again.
  pause
  exit /b 1
)
if not exist node_modules (
  call npm.cmd ci
  if errorlevel 1 (
    echo Dependency installation failed. Check your internet connection and try again.
    pause
    exit /b 1
  )
)
echo Opening PageKit. Keep this window open while using the app.
call npm.cmd run dev -- --port 5180 --strictPort --open
pause
