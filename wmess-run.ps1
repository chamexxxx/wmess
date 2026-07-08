param(
    [Parameter(Position = 0)]
    [ValidateSet('up', 'down', 'status')]
    [string]$Action = 'up',

    [switch]$RebuildClient,
    [switch]$Windows
)

$ErrorActionPreference = 'Stop'
$Root = $PSScriptRoot
$StateDir = Join-Path $Root '.wmess'
$PidFile = Join-Path $StateDir 'pids.json'
$LogDir = Join-Path $StateDir 'logs'

function Ensure-DotnetPath {
    $dotnetRoot = Join-Path $env:USERPROFILE '.dotnet'
    $dotnetExe = Join-Path $dotnetRoot 'dotnet.exe'
    if (Test-Path $dotnetExe) {
        $env:PATH = "$dotnetRoot;$env:PATH"
    }
    if (-not (Get-Command dotnet -ErrorAction SilentlyContinue)) {
        throw 'dotnet not found. Install .NET SDK or check PATH.'
    }
}

function Test-Docker {
    if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
        throw 'Docker not found. Install Docker Desktop.'
    }
    docker info 2>$null | Out-Null
    if ($LASTEXITCODE -ne 0) {
        throw 'Docker is not running. Start Docker Desktop first.'
    }
}

function Stop-WMessApps {
    if (Test-Path $PidFile) {
        try {
            $saved = Get-Content $PidFile -Raw | ConvertFrom-Json
            foreach ($pid in @($saved.apiPid, $saved.webPid)) {
                if ($pid -and (Get-Process -Id $pid -ErrorAction SilentlyContinue)) {
                    Stop-Process -Id $pid -Force -ErrorAction SilentlyContinue
                }
            }
        }
        catch { }
        Remove-Item $PidFile -Force -ErrorAction SilentlyContinue
    }

    foreach ($name in @('WMess.Api', 'WMess.Web')) {
        Get-Process -Name $name -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
    }
}

function Build-Frontend {
    $distIndex = Join-Path $Root 'WMess.Client\dist\index.html'
    if (-not $RebuildClient -and (Test-Path $distIndex)) {
        Write-Host '[1/4] Frontend: using existing dist' -ForegroundColor DarkGray
        return
    }

    if (-not (Get-Command npm -ErrorAction SilentlyContinue)) {
        throw 'npm not found and dist is missing. Run with existing dist or install Node.js.'
    }

    Write-Host '[1/4] Building frontend...' -ForegroundColor Cyan
    Push-Location (Join-Path $Root 'WMess.Client')
    try {
        if (-not (Test-Path 'node_modules\vite\package.json')) {
            npm install
            if ($LASTEXITCODE -ne 0) { throw 'npm install failed.' }
        }
        npm run build:docker
        if ($LASTEXITCODE -ne 0) { throw 'Frontend build failed.' }
    }
    finally {
        Pop-Location
    }
}

function Copy-Frontend {
    Write-Host '[2/4] Copying frontend to wwwroot...' -ForegroundColor Cyan
    $wwwroot = Join-Path $Root 'WMess.Web\wwwroot'
    $dist = Join-Path $Root 'WMess.Client\dist'
    if (-not (Test-Path (Join-Path $dist 'index.html'))) {
        throw 'WMess.Client\dist\index.html not found.'
    }
    New-Item -ItemType Directory -Force -Path $wwwroot | Out-Null
    Copy-Item -Path (Join-Path $dist '*') -Destination $wwwroot -Recurse -Force
}

function Build-Dotnet {
    Write-Host '[3/4] Building .NET...' -ForegroundColor Cyan
    dotnet build (Join-Path $Root 'WMess.Api\WMess.Api.csproj') -c Debug --nologo -v q
    if ($LASTEXITCODE -ne 0) { throw 'WMess.Api build failed.' }
    dotnet build (Join-Path $Root 'WMess.Web\WMess.Web.csproj') -c Debug --nologo -v q
    if ($LASTEXITCODE -ne 0) { throw 'WMess.Web build failed.' }
}

function Start-Database {
    Write-Host '[4/4] Starting database...' -ForegroundColor Cyan
    Push-Location $Root
    try {
        docker compose up db -d
        if ($LASTEXITCODE -ne 0) { throw 'docker compose up failed.' }

        Write-Host '      Waiting for database...' -ForegroundColor DarkGray
        for ($i = 0; $i -lt 30; $i++) {
            docker compose exec -T db pg_isready -U wmess -d wmess 2>$null | Out-Null
            if ($LASTEXITCODE -eq 0) { return }
            Start-Sleep -Seconds 2
        }
        throw 'Database not ready after 60 seconds.'
    }
    finally {
        Pop-Location
    }
}

function Start-WMessApp {
    param(
        [string]$Title,
        [string]$Project,
        [string]$Urls,
        [string]$LogName
    )

    $env:ASPNETCORE_ENVIRONMENT = 'DockerLocal'
    $projectPath = Join-Path $Root $Project

    if ($Windows) {
        $runner = if ($Project -like '*Api*') { 'run-api-docker.cmd' } else { 'run-web-docker.cmd' }
        $proc = Start-Process -FilePath 'cmd.exe' -ArgumentList @('/k', (Join-Path $Root $runner)) -PassThru
        return $proc.Id
    }

    New-Item -ItemType Directory -Force -Path $LogDir | Out-Null
    $logOut = Join-Path $LogDir "$LogName.log"
    $logErr = Join-Path $LogDir "$LogName.err.log"

    $proc = Start-Process -FilePath 'dotnet' -ArgumentList @(
        'run', '--project', $projectPath, '--no-launch-profile', '--urls', $Urls
    ) -WorkingDirectory $Root -WindowStyle Hidden -PassThru `
        -RedirectStandardOutput $logOut -RedirectStandardError $logErr

    return $proc.Id
}

function Save-Pids {
    param([int]$ApiPid, [int]$WebPid)
    New-Item -ItemType Directory -Force -Path $StateDir | Out-Null
    @{ apiPid = $ApiPid; webPid = $WebPid; startedAt = (Get-Date).ToString('o') } |
        ConvertTo-Json |
        Set-Content $PidFile -Encoding UTF8
}

function Wait-ForSite {
    Write-Host '      Waiting for site...' -ForegroundColor DarkGray
    for ($i = 0; $i -lt 30; $i++) {
        try {
            $r = Invoke-WebRequest -Uri 'http://127.0.0.1:9080' -UseBasicParsing -TimeoutSec 2
            if ($r.StatusCode -ge 200) { return $true }
        }
        catch { }
        Start-Sleep -Seconds 1
    }
    return $false
}

function Show-UpResult {
    param([bool]$SiteReady)
    Write-Host ''
    Write-Host '========================================' -ForegroundColor Green
    Write-Host '  WMess is running' -ForegroundColor Green
    Write-Host '  Site: http://localhost:9080' -ForegroundColor White
    Write-Host '  API:  http://127.0.0.1:5241' -ForegroundColor DarkGray
    Write-Host '  DB:   localhost:5434' -ForegroundColor DarkGray
    if (-not $Windows) {
        Write-Host "  Logs: $LogDir" -ForegroundColor DarkGray
    }
    if (-not $SiteReady) {
        Write-Host '  (site not ready yet — check logs)' -ForegroundColor Yellow
    }
    Write-Host '  Stop: .\docker-down.cmd' -ForegroundColor Cyan
    Write-Host '========================================' -ForegroundColor Green
    Write-Host ''
}

function Show-Status {
    Write-Host ''
    Write-Host 'WMess status' -ForegroundColor Cyan
    Write-Host ''

    Push-Location $Root
    try { docker compose ps } finally { Pop-Location }

    $api = Get-Process -Name 'WMess.Api' -ErrorAction SilentlyContinue
    $web = Get-Process -Name 'WMess.Web' -ErrorAction SilentlyContinue

    Write-Host ''
    if ($api) { Write-Host "  API: running (pid $($api.Id))" -ForegroundColor Green }
    else { Write-Host '  API: stopped' -ForegroundColor DarkGray }

    if ($web) { Write-Host "  Web: running (pid $($web.Id))" -ForegroundColor Green }
    else { Write-Host '  Web: stopped' -ForegroundColor DarkGray }

    if (Test-Path $LogDir) {
        Write-Host "  Logs: $LogDir" -ForegroundColor DarkGray
    }
    Write-Host ''
}

Push-Location $Root
try {
    switch ($Action) {
        'up' {
            Write-Host '=== WMess ===' -ForegroundColor Cyan
            Write-Host ''

            Ensure-DotnetPath
            Test-Docker
            Build-Frontend
            Copy-Frontend
            Build-Dotnet
            Start-Database

            Stop-WMessApps

            if ($Windows) {
                Write-Host 'Starting API and Web (console windows)...' -ForegroundColor Cyan
            }
            else {
                Write-Host 'Starting API and Web (background)...' -ForegroundColor Cyan
            }

            $apiPid = Start-WMessApp -Title 'WMess API' -Project 'WMess.Api\WMess.Api.csproj' -Urls 'http://127.0.0.1:5241' -LogName 'api'
            Start-Sleep -Seconds 4
            $webPid = Start-WMessApp -Title 'WMess Web' -Project 'WMess.Web\WMess.Web.csproj' -Urls 'http://127.0.0.1:9080' -LogName 'web'
            Save-Pids -ApiPid $apiPid -WebPid $webPid

            $ready = Wait-ForSite
            Show-UpResult -SiteReady $ready
        }
        'down' {
            Write-Host 'Stopping WMess...' -ForegroundColor Cyan
            Stop-WMessApps
            docker compose down
            if ($LASTEXITCODE -ne 0) { throw 'docker compose down failed.' }
            Write-Host 'Done.' -ForegroundColor Green
        }
        'status' {
            Show-Status
        }
    }
}
catch {
    Write-Host "ERROR: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}
finally {
    Pop-Location
}
