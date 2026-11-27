@echo off
title Penguin Focus Buddy
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js is not installed. Install the LTS version from https://nodejs.org and run this file again.
  pause
  exit /b 1
)
if not exist "node_modules\ws" goto install
if not exist "node_modules\electron" goto install
goto run
:install
echo First run: installing. This needs internet and takes a few minutes...
call npm install
if errorlevel 1 goto failed
:run
echo Starting your penguin. Keep this window open; quit from the penguin icon near the clock.
call npm start
if errorlevel 1 goto failed
exit /b 0
:failed
echo Something went wrong. Copy the message above and share it.
pause
exit /b 1
