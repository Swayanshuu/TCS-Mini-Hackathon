$ErrorActionPreference = "Stop"

Write-Host "==> Checking Python virtual environment..." -ForegroundColor Cyan
if (!(Test-Path ".venv\Scripts\python.exe")) {
    python -m venv .venv
}

Write-Host "==> Installing Python dependencies..." -ForegroundColor Cyan
.\.venv\Scripts\python.exe -m pip install -r backend\requirements.txt

Write-Host "==> Training ML models from csv files/..." -ForegroundColor Cyan
.\.venv\Scripts\python.exe ml\train.py

Write-Host "==> Installing Frontend dependencies..." -ForegroundColor Cyan
Push-Location frontend
npm install
Pop-Location

Write-Host "==> Starting FastAPI backend (http://127.0.0.1:8000) & Vite frontend (http://127.0.0.1:5173)..." -ForegroundColor Green
$backend = Start-Process -FilePath ".\.venv\Scripts\uvicorn.exe" -ArgumentList "backend.main:app --host 127.0.0.1 --port 8000" -PassThru
try {
    Push-Location frontend
    npm run dev -- --host 127.0.0.1 --port 5173
} finally {
    Pop-Location
    if ($backend -and !$backend.HasExited) {
        Stop-Process -Id $backend.Id -Force
    }
}
