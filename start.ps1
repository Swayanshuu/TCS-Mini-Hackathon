param(
    [switch]$Retrain
)

$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot

function Find-Python {
    foreach ($cmd in @("py -3.12", "python", "python3")) {
        try {
            $parts = $cmd -split " "
            if ($parts.Length -eq 2) {
                $ver = & $parts[0] $parts[1] --version 2>$null
                if ($LASTEXITCODE -eq 0 -and $ver -match "Python 3\.") { return $parts }
            } else {
                $ver = & $cmd --version 2>$null
                if ($LASTEXITCODE -eq 0 -and $ver -match "Python 3\.") { return @($cmd) }
            }
        } catch {}
    }
    $localPy = "$env:LOCALAPPDATA\Programs\Python\Python312\python.exe"
    if (Test-Path $localPy) { return @($localPy) }
    throw "Python 3.10-3.12 not found. Install via: winget install Python.Python.3.12"
}

$venvPy = ".\.venv\Scripts\python.exe"
if (!(Test-Path $venvPy)) {
    Write-Host "==> Creating Python virtual environment (.venv)..." -ForegroundColor Cyan
    $pyCmd = Find-Python
    if ($pyCmd.Length -eq 2) {
        & $pyCmd[0] $pyCmd[1] -m venv .venv
    } else {
        & $pyCmd[0] -m venv .venv
    }
}

$reqHash = (Get-FileHash "backend\requirements.txt" -Algorithm SHA256).Hash
$stampFile = ".venv\.reqs_hash"
$needsPip = $true
if (Test-Path $stampFile) {
    if ((Get-Content $stampFile -Raw).Trim() -eq $reqHash) {
        $needsPip = $false
    }
}

if ($needsPip) {
    Write-Host "==> Installing Python dependencies..." -ForegroundColor Cyan
    & $venvPy -m pip install -r backend\requirements.txt
    Set-Content -Path $stampFile -Value $reqHash -NoNewline
}

if ($Retrain -or !(Test-Path "ml\artifacts\model_bundle.pkl")) {
    Write-Host "==> Training ML models from csv files/..." -ForegroundColor Cyan
    & $venvPy ml\train.py
}

if (!(Test-Path "frontend\node_modules")) {
    Write-Host "==> Installing Frontend dependencies..." -ForegroundColor Cyan
    Push-Location frontend
    npm install
    Pop-Location
}

Write-Host "==> Starting MessIQ Backend (http://127.0.0.1:8000)..." -ForegroundColor Green
$backend = Start-Process -FilePath ".\.venv\Scripts\uvicorn.exe" -ArgumentList "backend.main:app --host 127.0.0.1 --port 8000" -PassThru -NoNewWindow

try {
    Write-Host "==> Waiting for API healthcheck..." -ForegroundColor Cyan
    $ready = $false
    for ($i = 0; $i -lt 30; $i++) {
        try {
            $resp = Invoke-RestMethod -Uri "http://127.0.0.1:8000/api/health" -TimeoutSec 2
            if ($resp.status -eq "ok") {
                $ready = $true
                break
            }
        } catch {}
        Start-Sleep -Milliseconds 500
    }
    if ($ready) {
        Write-Host "==> Backend ready! Opening http://127.0.0.1:5173 in browser..." -ForegroundColor Green
        Start-Process "http://127.0.0.1:5173"
    }

    Push-Location frontend
    npm run dev -- --host 127.0.0.1 --port 5173
} finally {
    if ((Get-Location).Path -ne $PSScriptRoot) { Pop-Location }
    if ($backend -and !$backend.HasExited) {
        Write-Host "`n==> Stopping MessIQ Backend..." -ForegroundColor Yellow
        Stop-Process -Id $backend.Id -Force -ErrorAction SilentlyContinue
    }
}
