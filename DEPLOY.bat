@echo off
cd /d "%~dp0"
echo === myMVP : sync + deploy ===
echo.
echo [1/3] Building web app...
call npm run build:web
if errorlevel 1 exit /b 1
echo.
echo [2/3] Committing...
git add -A
git commit -F "%~dp0.deploy-msg.txt"
if errorlevel 1 echo (nothing new to commit - continuing)
echo.
echo [3/3] Pushing to main...
git push origin main
echo.
echo ============================================================
echo Done. Netlify deploys from main when the site is connected.
echo Live app: https://mymvp.netlify.app  (hard-refresh Ctrl+F5)
echo GitHub:   https://github.com/paulooventura/myMVP
echo ============================================================
pause
