#!/usr/bin/env bash
set -euo pipefail

echo "==> Checking Python virtual environment..."
if [ ! -d ".venv" ]; then
  python3 -m venv .venv
fi

echo "==> Installing Python dependencies..."
.venv/bin/python -m pip install -r backend/requirements.txt

echo "==> Training ML models from csv files/..."
.venv/bin/python ml/train.py

echo "==> Installing Frontend dependencies..."
(cd frontend && npm install)

echo "==> Starting FastAPI backend (http://127.0.0.1:8000) & Vite frontend (http://127.0.0.1:5173)..."
.venv/bin/uvicorn backend.main:app --host 127.0.0.1 --port 8000 &
BACKEND_PID=$!
trap 'kill $BACKEND_PID 2>/dev/null || true' EXIT

(cd frontend && npm run dev -- --host 127.0.0.1 --port 5173)
