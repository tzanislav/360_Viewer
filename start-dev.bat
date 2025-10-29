@echo off
echo Starting Pano Viewer Development Environment
echo.

echo Starting Backend Server...
start "Backend" cmd /k "cd /d %~dp0backend && npm run dev"

timeout /t 3 /nobreak > nul

echo Starting Frontend Development Server...
start "Frontend" cmd /k "cd /d %~dp0pano-viewer && npm start"

echo.
echo Both servers are starting up...
echo Backend: http://localhost:5000
echo Frontend: http://localhost:3000
echo.
echo Close this window or press any key to continue...
pause > nul