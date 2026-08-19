@echo off
cd /d "%~dp0"
echo === Build + deploy to GitHub Pages (Wix subdomains) ===
echo.
call node scripts/build-pauloventura-site.mjs --wix
if errorlevel 1 exit /b 1
call node scripts/deploy-github-pages.mjs --no-cname
if errorlevel 1 exit /b 1
echo.
type deploy\wix\WIX-DNS-RECORDS.txt
pause
