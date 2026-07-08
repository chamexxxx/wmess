@echo off
cd /d "%~dp0"
set "DOTNET_ROOT=%USERPROFILE%\.dotnet"
if exist "%DOTNET_ROOT%\dotnet.exe" set "PATH=%DOTNET_ROOT%;%PATH%"
set ASPNETCORE_ENVIRONMENT=DockerLocal
echo WMess API - DockerLocal (DB localhost:5434)
echo Leave this window open.
echo.
dotnet run --project WMess.Api\WMess.Api.csproj --no-launch-profile --urls http://127.0.0.1:5241
echo.
echo API stopped.
pause
