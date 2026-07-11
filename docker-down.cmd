@echo off
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0wmess-run.ps1" down
exit /b %ERRORLEVEL%
