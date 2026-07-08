@echo off
cd /d "%~dp0"
set "DOTNET_ROOT=%USERPROFILE%\.dotnet"
if exist "%DOTNET_ROOT%\dotnet.exe" set "PATH=%DOTNET_ROOT%;%PATH%"
set ASPNETCORE_ENVIRONMENT=DockerLocal
echo WMess Web (BFF) - DockerLocal
echo Site: http://localhost:9080
echo Leave this window open.
echo.
dotnet run --project WMess.Web\WMess.Web.csproj --no-launch-profile --urls http://127.0.0.1:9080
echo.
echo Web stopped.
pause
