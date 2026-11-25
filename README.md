# MessIQ — AI Mess Food-Waste Predictor

Predicts hostel meal attendance, recommends unit-aware food quantities (`kg`, `litre`, `pieces`), detects wastage/shortage risks, and benchmarks Random Forest vs. Gradient Boosting on chronological 2025 mess data.

---

## 1. Clone or Pull

First time:

```bash
git clone https://github.com/Swayanshuu/TCS-Mini-Hackathon.git
cd TCS-Mini-Hackathon
```

Already cloned? Pull latest:

```bash
git pull origin main
```

---

## 2. Run Everything (Copy & Paste)

> **Requirements:** Python 3.10–3.12 and Node.js 18+

### Windows (Double-Click or 1 Command)

Double-click **`run.bat`** in the root folder, or run:
```powershell
.\run.bat
```

### macOS / Linux (1 Command)

```bash
chmod +x start.sh && ./start.sh
```

That automatically creates `.venv`, installs dependencies (cached on repeat runs), trains the ML models if needed, starts FastAPI (`8000`) + Vite (`5173`), and opens **`http://127.0.0.1:5173`** in your browser. *(Pass `--retrain` / `-Retrain` to force re-training.)*

---

## 3. Manual Run (2 Terminals)

### Terminal 1 — Backend + ML (`http://127.0.0.1:8000`)

**Windows (PowerShell):**

```powershell
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r backend\requirements.txt
.\.venv\Scripts\python.exe ml\train.py
.\.venv\Scripts\uvicorn.exe backend.main:app --reload --port 8000
```

**macOS / Linux:**

```bash
python3 -m venv .venv
.venv/bin/python -m pip install -r backend/requirements.txt
.venv/bin/python ml/train.py
.venv/bin/uvicorn backend.main:app --reload --port 8000
```

### Terminal 2 — Frontend (`http://127.0.0.1:5173`)

```bash
cd frontend
npm install
npm run dev
```

Open **`http://127.0.0.1:5173`** _(API docs: `http://127.0.0.1:8000/docs`)_

---

## 4. Production Single-Server / Docker

Run both UI and API from a single server on port `8000`:

```bash
cd frontend && npm install && npm run build && cd ..
uvicorn backend.main:app --host 0.0.0.0 --port 8000
```

Or with Docker:

```bash
docker build -t messiq .
docker run -p 8000:8000 messiq
```

Open **`http://127.0.0.1:8000`**

To deploy online for free: push to GitHub, open [render.com](https://render.com) → **New → Blueprint**, and select this repo (`render.yaml` + `Dockerfile` are preconfigured).

---

## 5. Folder Structure

- `csv files/` — Source CSVs (`calendar.csv`, `meals.csv`, `food_preparation.csv`)
- `ml/` — Leakage-free chronological feature engineering, training, recommender, explainer
- `backend/` — FastAPI server + SQLite prediction history (`predictions.db`)
- `frontend/` — React + Vite + TypeScript + Tailwind + Recharts UI

---

## 6. Quick Fixes

- **`python` opens Microsoft Store (Windows):** Install Python 3.12 via `winget install Python.Python.3.12` and reopen terminal.
- **PowerShell script blocked:** Always use `.\.venv\Scripts\python.exe` instead of `Activate.ps1`, or run `powershell -ExecutionPolicy Bypass -File .\start.ps1`.
- **Frontend says backend failed:** Make sure `uvicorn backend.main:app` is started from the **repo root folder**, not inside `backend/`.
