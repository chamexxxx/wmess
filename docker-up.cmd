@echo off
setlocal
cd /d "%~dp0"

set "ARGS="
:parse
if "%~1"=="" goto :run
if /i "%~1"=="--rebuild-client" (
  set "ARGS=%ARGS% -RebuildClient"
  shift
  goto :parse
)
if /i "%~1"=="--windows" (
  set "ARGS=%ARGS% -Windows"
  shift
  goto :parse
)
shift
goto :parse

:run
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0wmess-run.ps1" up %ARGS%
exit /b %ERRORLEVEL%
