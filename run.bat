@echo off
echo ==============================================
echo           Starting Drawwww locally
echo ==============================================

echo Cleaning up previous background processes...
taskkill /F /IM node.exe >nul 2>&1
timeout /t 2 >nul


echo Starting Backend...
start "Drawwww Backend" cmd /k "cd Backend && npm run dev"

echo Starting Frontend...
start "Drawwww Frontend" cmd /k "cd Frontend && npm run dev"

echo.
echo Application is starting! 
echo Frontend will be available at http://localhost:3001 (or 5173)
echo Backend API is running on http://localhost:3000
echo.
echo [!] NOTE: To play the "Draw This Shytt" game mode, ensure you have
echo added your GEMINI_API_KEY to the .env file in the root directory!
echo ==============================================
