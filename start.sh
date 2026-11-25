#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"

if [ ! -f ".venv/bin/python" ]; then
  echo "==> Creating Python virtual environment (.venv)..."
  python3 -m venv .venv
fi

REQ_HASH=$(shasum -a 256 backend/requirements.txt 2>/dev/null | awk '{print $1}' || sha256sum backend/requirements.txt | awk '{print $1}')
if [ ! -f ".venv/.reqs_hash" ] || [ "$(cat .venv/.reqs_hash)" != "$REQ_HASH" ]; then
  echo "==> Installing Python dependencies..."
  .venv/bin/python -m pip install -r backend/requirements.txt
  printf "%s" "$REQ_HASH" > .venv/.reqs_hash
fi

if [ "${1:-}" = "--retrain" ] || [ ! -f "ml/artifacts/model_bundle.pkl" ]; then
  echo "==> Training ML models from csv files/..."
  .venv/bin/python ml/train.py
fi

if [ ! -d "frontend/node_modules" ]; then
  echo "==> Installing Frontend dependencies..."
  (cd frontend && npm install)
fi

echo "==> Starting MessIQ Backend (http://127.0.0.1:8000)..."
.venv/bin/uvicorn backend.main:app --host 127.0.0.1 --port 8000 &
BACKEND_PID=$!
trap 'kill $BACKEND_PID 2>/dev/null || true' EXIT

echo "==> Waiting for API healthcheck..."
for _ in $(seq 1 30); do
  if curl -fsS http://127.0.0.1:8000/api/health >/dev/null 2>&1; then
    echo "==> Backend ready! Frontend: http://127.0.0.1:5173"
    if command -v open >/dev/null 2>&1; then open "http://127.0.0.1:5173" || true; fi
    if command -v xdg-open >/dev/null 2>&1; then xdg-open "http://127.0.0.1:5173" >/dev/null 2>&1 || true; fi
    break
  fi
  sleep 0.5
done

(cd frontend && npm run dev -- --host 127.0.0.1 --port 5173)
