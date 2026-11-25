"""SQLite persistence for meal prediction history."""

from __future__ import annotations

import json
import sqlite3
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List

DB_PATH = Path(__file__).resolve().parent / "predictions.db"


def init_db() -> None:
    with sqlite3.connect(DB_PATH) as conn:
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS predictions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                created_at TEXT NOT NULL,
                target_date TEXT NOT NULL,
                meal_type TEXT NOT NULL,
                menu TEXT NOT NULL,
                predicted_attendance INTEGER NOT NULL,
                safety_buffer REAL NOT NULL,
                overall_risk TEXT NOT NULL,
                model_used TEXT NOT NULL,
                totals_json TEXT NOT NULL,
                payload_json TEXT NOT NULL
            )
            """
        )
        conn.commit()


def save_prediction(result: Dict[str, Any]) -> int:
    init_db()
    now = datetime.now(timezone.utc).isoformat()
    with sqlite3.connect(DB_PATH) as conn:
        cur = conn.execute(
            """
            INSERT INTO predictions (
                created_at, target_date, meal_type, menu,
                predicted_attendance, safety_buffer, overall_risk,
                model_used, totals_json, payload_json
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                now,
                result["date"],
                result["meal_type"],
                result["menu"],
                int(result["predicted_attendance"]),
                float(result["safety_buffer"]),
                result["overall_risk"],
                result["model_used"],
                json.dumps(result["totals_by_unit"]),
                json.dumps(result),
            ),
        )
        conn.commit()
        return int(cur.lastrowid)


def list_predictions(limit: int = 20) -> List[Dict[str, Any]]:
    init_db()
    with sqlite3.connect(DB_PATH) as conn:
        conn.row_factory = sqlite3.Row
        rows = conn.execute(
            """
            SELECT id, created_at, target_date, meal_type, menu,
                   predicted_attendance, safety_buffer, overall_risk,
                   model_used, totals_json
            FROM predictions
            ORDER BY id DESC
            LIMIT ?
            """,
            (limit,),
        ).fetchall()
    return [
        {
            "id": r["id"],
            "created_at": r["created_at"],
            "date": r["target_date"],
            "meal_type": r["meal_type"],
            "menu": r["menu"],
            "predicted_attendance": r["predicted_attendance"],
            "safety_buffer": r["safety_buffer"],
            "overall_risk": r["overall_risk"],
            "model_used": r["model_used"],
            "totals_by_unit": json.loads(r["totals_json"]),
        }
        for r in rows
    ]
