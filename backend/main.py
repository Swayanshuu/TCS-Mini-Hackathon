"""FastAPI backend for AI Mess Food-Waste Predictor."""

from __future__ import annotations

import io
import sys
from contextlib import asynccontextmanager
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional

import numpy as np
import pandas as pd
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, StreamingResponse
from fastapi.staticfiles import StaticFiles

ROOT_DIR = Path(__file__).resolve().parent.parent
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

from backend.database import init_db, list_predictions, save_prediction
from backend.schemas import PredictionRequest
from ml.pipeline import TrainedArtifacts, predict_for_meal, train_and_evaluate

APP_STATE: Dict[str, Any] = {"artifacts": None}


def get_artifacts() -> TrainedArtifacts:
    if APP_STATE["artifacts"] is None:
        APP_STATE["artifacts"] = train_and_evaluate(save_artifacts=True)
    return APP_STATE["artifacts"]


@asynccontextmanager
async def lifespan(_: FastAPI):
    init_db()
    APP_STATE["artifacts"] = train_and_evaluate(save_artifacts=True)
    yield


app = FastAPI(
    title="MessIQ API",
    version="1.0.0",
    description="Meal attendance forecasting, unit-aware preparation recommendations, and waste/shortage analytics.",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/health")
def health() -> Dict[str, Any]:
    art = get_artifacts()
    return {
        "status": "ok",
        "selected_model": art.best_model_name,
        "dataset_rows": art.datasets.data_quality_report,
    }


@app.get("/status")
@app.get("/api/status")
def status() -> Dict[str, Any]:
    art = get_artifacts()
    db_ok = True
    try:
        init_db()
    except Exception:
        db_ok = False
    dq = art.datasets.data_quality_report
    return {
        "status": "healthy" if db_ok else "degraded",
        "service": "MessIQ Backend",
        "version": "1.0.0",
        "model_loaded": True,
        "selected_model": art.best_model_name,
        "database": "connected" if db_ok else "unavailable",
        "datasets_loaded": {
            "calendar": dq["calendar_rows"],
            "meals": dq["meals_rows"],
            "food_preparation": dq["food_prep_rows"],
        },
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }


@app.get("/api/metadata")
def metadata() -> Dict[str, Any]:
    art = get_artifacts()
    meals = art.datasets.meals
    cal = art.datasets.calendar
    menus_by_meal: Dict[str, List[str]] = {}
    for mt in ("Breakfast", "Lunch", "Dinner"):
        menus_by_meal[mt] = sorted(
            meals[meals["meal_type"] == mt]["menu"].unique().tolist()
        )
    all_menus = sorted(meals["menu"].unique().tolist())
    day_types = sorted(cal["day_type"].unique().tolist())
    events = sorted([e for e in cal["event_name"].unique().tolist() if e])

    last_date = pd.Timestamp(meals["date"].max())
    next_date = (last_date + timedelta(days=1)).strftime("%Y-%m-%d")

    return {
        "meal_types": ["Breakfast", "Lunch", "Dinner"],
        "menus_by_meal": menus_by_meal,
        "all_menus": all_menus,
        "day_types": day_types,
        "events": events,
        "date_min": str(meals["date_str"].min()),
        "date_max": str(meals["date_str"].max()),
        "default_next_date": next_date,
        "selected_model": art.best_model_name,
        "data_quality": art.datasets.data_quality_report,
    }


@app.get("/api/dashboard")
def dashboard() -> Dict[str, Any]:
    art = get_artifacts()
    jm = art.datasets.joined_meals
    prep = art.datasets.food_prep

    # Next meal prediction (day after dataset end, Lunch as default or next logical meal)
    last_date = pd.Timestamp(jm["date"].max())
    next_date_str = (last_date + timedelta(days=1)).strftime("%Y-%m-%d")
    last_meal_menu = (
        jm[jm["meal_type"] == "Lunch"].iloc[-1]["menu"]
        if not jm[jm["meal_type"] == "Lunch"].empty
        else "Rice-Dal"
    )
    next_meal_pred = predict_for_meal(
        art,
        target_date=next_date_str,
        meal_type="Lunch",
        menu=str(last_meal_menu),
        safety_buffer=1.05,
    )

    # Historical wastage totals strictly separated by unit
    wastage_by_unit = {}
    for unit, grp in prep.groupby("unit"):
        total_prep = float(grp["quantity_prepared"].sum())
        total_cons = float(grp["quantity_consumed"].sum())
        total_left = float(grp["quantity_leftover"].sum())
        d = 0 if unit == "pieces" else 1
        wastage_by_unit[str(unit)] = {
            "total_prepared": round(total_prep, d),
            "total_consumed": round(total_cons, d),
            "total_leftover": round(total_left, d),
            "wastage_pct": round((total_left / total_prep) * 100.0, 2) if total_prep > 0 else 0.0,
        }

    avg_wastage_pct = round(float(prep["wastage_pct"].mean()), 2)
    high_risk_meals = int((jm["risk_level"] == "High").sum())
    shortage_alerts_count = int((prep["is_shortage_risk"]).sum())
    shortage_meals_count = int((jm["shortage_items"] > 0).sum())

    # Daily attendance & wastage trend (aggregate per day for clean charts)
    daily = (
        jm.groupby("date_str", as_index=False)
        .agg(
            expected_avg=("expected_students", "mean"),
            actual_avg=("actual_students", "mean"),
            avg_wastage_pct=("avg_item_wastage_pct", "mean"),
            kg_prepared=("quantity_prepared_kg", "sum"),
            kg_consumed=("quantity_consumed_kg", "sum"),
            kg_leftover=("quantity_leftover_kg", "sum"),
            day_type=("day_type", "first"),
        )
        .sort_values("date_str")
    )
    # Weekly aggregate for smooth long-horizon trend + last 30 days daily
    daily["month"] = daily["date_str"].str.slice(0, 7)
    monthly = (
        daily.groupby("month", as_index=False)
        .agg(
            expected_avg=("expected_avg", "mean"),
            actual_avg=("actual_avg", "mean"),
            avg_wastage_pct=("avg_wastage_pct", "mean"),
            kg_prepared=("kg_prepared", "sum"),
            kg_consumed=("kg_consumed", "sum"),
            kg_leftover=("kg_leftover", "sum"),
        )
        .sort_values("month")
    )

    attendance_trend = [
        {
            "date": str(r["date_str"]),
            "expected": round(float(r["expected_avg"]), 0),
            "actual": round(float(r["actual_avg"]), 0),
            "wastage_pct": round(float(r["avg_wastage_pct"]), 2),
            "day_type": str(r["day_type"]),
        }
        for _, r in daily.tail(45).iterrows()
    ]

    monthly_food_trend = [
        {
            "month": str(r["month"]),
            "kg_prepared": round(float(r["kg_prepared"]), 1),
            "kg_consumed": round(float(r["kg_consumed"]), 1),
            "kg_leftover": round(float(r["kg_leftover"]), 1),
            "avg_wastage_pct": round(float(r["avg_wastage_pct"]), 2),
            "avg_actual": round(float(r["actual_avg"]), 0),
        }
        for _, r in monthly.iterrows()
    ]

    # Meal-wise performance
    meal_perf = []
    for mt in ("Breakfast", "Lunch", "Dinner"):
        sub = jm[jm["meal_type"] == mt]
        prep_sub = prep[prep["meal_type"] == mt]
        meal_perf.append(
            {
                "meal_type": mt,
                "meals_count": int(len(sub)),
                "avg_expected": round(float(sub["expected_students"].mean()), 1),
                "avg_actual": round(float(sub["actual_students"].mean()), 1),
                "avg_wastage_pct": round(float(prep_sub["wastage_pct"].mean()), 2),
                "high_risk_meals": int((sub["risk_level"] == "High").sum()),
                "shortage_events": int(prep_sub["is_shortage_risk"].sum()),
            }
        )

    history = list_predictions(limit=10)

    return {
        "kpis": {
            "next_meal": {
                "date": next_meal_pred["date"],
                "meal_type": next_meal_pred["meal_type"],
                "menu": next_meal_pred["menu"],
                "predicted_attendance": next_meal_pred["predicted_attendance"],
                "totals_by_unit": next_meal_pred["totals_by_unit"],
                "overall_risk": next_meal_pred["overall_risk"],
            },
            "wastage_by_unit": wastage_by_unit,
            "avg_wastage_pct": avg_wastage_pct,
            "high_risk_meals": high_risk_meals,
            "total_meals": int(len(jm)),
            "shortage_alerts_count": shortage_alerts_count,
            "shortage_meals_count": shortage_meals_count,
            "model_r2": art.all_model_metrics[art.best_model_name]["r2"],
            "model_mae": art.all_model_metrics[art.best_model_name]["mae"],
            "selected_model": art.best_model_name,
        },
        "attendance_trend": attendance_trend,
        "monthly_food_trend": monthly_food_trend,
        "meal_performance": meal_perf,
        "risk_distribution": art.waste_analysis["risk_distribution"],
        "recent_predictions": history,
        "recent_shortage_alerts": art.waste_analysis["shortage_alerts"][:6],
    }


@app.post("/api/predict")
def predict(req: PredictionRequest) -> Dict[str, Any]:
    try:
        datetime.strptime(req.date, "%Y-%m-%d")
    except ValueError as exc:
        raise HTTPException(status_code=400, detail="Invalid date format. Use YYYY-MM-DD.") from exc

    art = get_artifacts()
    try:
        result = predict_for_meal(
            artifacts=art,
            target_date=req.date,
            meal_type=req.meal_type,
            menu=req.menu,
            safety_buffer=req.safety_buffer,
            day_type_override=req.day_type,
            is_holiday_override=req.is_holiday,
            is_exam_override=req.is_exam_period,
            event_name_override=req.event_name,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    if req.save_to_history:
        pred_id = save_prediction(result)
        result["prediction_id"] = pred_id
    return result


@app.get("/api/predictions/history")
def prediction_history(limit: int = Query(default=25, ge=1, le=200)) -> Dict[str, Any]:
    return {"predictions": list_predictions(limit=limit)}


@app.get("/api/analytics/food")
def food_analytics(meal_type: Optional[str] = None) -> Dict[str, Any]:
    art = get_artifacts()
    prep = art.datasets.food_prep
    jm = art.datasets.joined_meals

    if meal_type and meal_type.strip().title() in ("Breakfast", "Lunch", "Dinner"):
        mt = meal_type.strip().title()
        prep = prep[prep["meal_type"] == mt]
        jm = jm[jm["meal_type"] == mt]

    item_summary = (
        prep.groupby(["food_item", "unit"], as_index=False)
        .agg(
            meals=("date_str", "count"),
            avg_prepared=("quantity_prepared", "mean"),
            avg_consumed=("quantity_consumed", "mean"),
            avg_leftover=("quantity_leftover", "mean"),
            total_prepared=("quantity_prepared", "sum"),
            total_consumed=("quantity_consumed", "sum"),
            total_leftover=("quantity_leftover", "sum"),
            avg_wastage_pct=("wastage_pct", "mean"),
            shortage_events=("is_shortage_risk", "sum"),
        )
        .sort_values("avg_wastage_pct", ascending=False)
    )

    items = []
    for _, r in item_summary.iterrows():
        d = 0 if r["unit"] == "pieces" else 2
        items.append(
            {
                "food_item": str(r["food_item"]),
                "unit": str(r["unit"]),
                "meals": int(r["meals"]),
                "avg_prepared": round(float(r["avg_prepared"]), d),
                "avg_consumed": round(float(r["avg_consumed"]), d),
                "avg_leftover": round(float(r["avg_leftover"]), d),
                "total_prepared": round(float(r["total_prepared"]), d),
                "total_consumed": round(float(r["total_consumed"]), d),
                "total_leftover": round(float(r["total_leftover"]), d),
                "avg_wastage_pct": round(float(r["avg_wastage_pct"]), 2),
                "shortage_events": int(r["shortage_events"]),
            }
        )

    menu_summary = (
        jm.groupby(["meal_type", "menu"], as_index=False)
        .agg(
            meals=("date_str", "count"),
            avg_expected=("expected_students", "mean"),
            avg_actual=("actual_students", "mean"),
            avg_wastage_pct=("avg_item_wastage_pct", "mean"),
            shortage_meals=("shortage_items", lambda s: int((s > 0).sum())),
        )
        .sort_values("avg_actual", ascending=False)
    )
    menus = [
        {
            "meal_type": str(r["meal_type"]),
            "menu": str(r["menu"]),
            "meals": int(r["meals"]),
            "avg_expected": round(float(r["avg_expected"]), 1),
            "avg_actual": round(float(r["avg_actual"]), 1),
            "attendance_lift": round(float(r["avg_actual"] - r["avg_expected"]), 1),
            "avg_wastage_pct": round(float(r["avg_wastage_pct"]), 2),
            "shortage_meals": int(r["shortage_meals"]),
        }
        for _, r in menu_summary.iterrows()
    ]

    weekday_summary = (
        jm.groupby(["day_of_week", "meal_type"], as_index=False)
        .agg(avg_actual=("actual_students", "mean"), avg_expected=("expected_students", "mean"))
    )
    dow_order = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
    weekday_pivot = []
    for dow in dow_order:
        sub = weekday_summary[weekday_summary["day_of_week"] == dow]
        row: Dict[str, Any] = {"day_of_week": dow}
        for mt in ("Breakfast", "Lunch", "Dinner"):
            m = sub[sub["meal_type"] == mt]
            row[mt] = round(float(m["avg_actual"].iloc[0]), 0) if not m.empty else 0
        weekday_pivot.append(row)

    return {
        "items": items,
        "menus": menus,
        "weekday_attendance": weekday_pivot,
    }


@app.get("/api/analytics/waste")
def waste_analytics() -> Dict[str, Any]:
    art = get_artifacts()
    return art.waste_analysis


@app.get("/api/evaluation")
def evaluation() -> Dict[str, Any]:
    art = get_artifacts()
    bt = art.backtest_records

    total_actual_kg_prep = sum(r["actual_kg_prepared"] for r in bt)
    total_actual_kg_left = sum(r["actual_kg_leftover"] for r in bt)
    total_sim_kg_prep = sum(r["simulated_kg_recommended"] for r in bt)
    total_sim_kg_left = sum(r["simulated_kg_leftover"] for r in bt)

    wastage_reduction_kg = max(0.0, total_actual_kg_left - total_sim_kg_left)
    wastage_reduction_pct = (
        (wastage_reduction_kg / total_actual_kg_left) * 100.0
        if total_actual_kg_left > 0
        else 0.0
    )

    return {
        "selected_model": art.best_model_name,
        "split": art.split_info,
        "models": art.all_model_metrics,
        "feature_importances": art.feature_importances,
        "backtest_summary": {
            "test_meals_evaluated": len(bt),
            "actual_kg_prepared": round(total_actual_kg_prep, 1),
            "actual_kg_leftover": round(total_actual_kg_left, 1),
            "simulated_kg_recommended": round(total_sim_kg_prep, 1),
            "simulated_kg_leftover": round(total_sim_kg_left, 1),
            "estimated_wastage_reduction_kg": round(wastage_reduction_kg, 1),
            "estimated_wastage_reduction_pct": round(wastage_reduction_pct, 1),
            "note": "Chronological out-of-time backtest (final 20% of meals). Simulated recommendations apply training-period per-student rates × predicted attendance × 1.05x buffer and are clearly distinguished from actual recorded kitchen preparation.",
        },
        "backtest_records": bt,
    }


def _get_dataset_df(dataset_name: str) -> pd.DataFrame:
    art = get_artifacts()
    name = dataset_name.strip().lower()
    if name == "meals":
        return art.datasets.meals.drop(columns=["date_str", "meal_order"], errors="ignore").assign(
            date=lambda d: d["date"].dt.strftime("%Y-%m-%d")
        )
    if name == "food_preparation":
        return art.datasets.food_prep.drop(
            columns=["date_str", "meal_order"], errors="ignore"
        ).assign(date=lambda d: d["date"].dt.strftime("%Y-%m-%d"))
    if name == "calendar":
        return art.datasets.calendar.drop(columns=["date_str", "has_event"], errors="ignore").assign(
            date=lambda d: d["date"].dt.strftime("%Y-%m-%d")
        )
    raise HTTPException(
        status_code=404,
        detail="Dataset must be one of: meals, food_preparation, calendar",
    )


def _filter_dataset(
    df: pd.DataFrame,
    search: Optional[str],
    date_from: Optional[str],
    date_to: Optional[str],
    meal_type: Optional[str],
) -> pd.DataFrame:
    out = df.copy()
    if date_from:
        out = out[out["date"] >= date_from]
    if date_to:
        out = out[out["date"] <= date_to]
    if meal_type and "meal_type" in out.columns and meal_type.strip().lower() != "all":
        out = out[out["meal_type"].str.lower() == meal_type.strip().lower()]
    if search and search.strip():
        q = search.strip().lower()
        mask = pd.Series(False, index=out.index)
        for col in out.columns:
            mask = mask | out[col].astype(str).str.lower().str.contains(q, regex=False)
        out = out[mask]
    return out


@app.get("/api/datasets/{dataset_name}")
def inspect_dataset(
    dataset_name: str,
    search: Optional[str] = None,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    meal_type: Optional[str] = None,
    sort_by: Optional[str] = "date",
    sort_dir: str = Query(default="asc", pattern="^(asc|desc)$"),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=25, ge=5, le=200),
) -> Dict[str, Any]:
    df = _get_dataset_df(dataset_name)
    filtered = _filter_dataset(df, search, date_from, date_to, meal_type)

    if sort_by and sort_by in filtered.columns:
        filtered = filtered.sort_values(
            by=sort_by, ascending=(sort_dir == "asc"), kind="mergesort"
        )

    total_rows = int(len(filtered))
    total_pages = max(1, int(np.ceil(total_rows / page_size)))
    page_clamped = min(page, total_pages)
    start = (page_clamped - 1) * page_size
    page_df = filtered.iloc[start : start + page_size]

    # Dynamic summary statistics
    stats: Dict[str, Any] = {
        "total_rows_unfiltered": int(len(df)),
        "filtered_rows": total_rows,
        "columns": list(df.columns),
    }
    if dataset_name == "meals" and not filtered.empty:
        stats["avg_expected"] = round(float(filtered["expected_students"].mean()), 1)
        stats["avg_actual"] = round(float(filtered["actual_students"].mean()), 1)
        stats["min_actual"] = int(filtered["actual_students"].min())
        stats["max_actual"] = int(filtered["actual_students"].max())
    elif dataset_name == "food_preparation" and not filtered.empty:
        stats["avg_wastage_pct"] = round(float(filtered["wastage_pct"].mean()), 2)
        stats["shortage_rows"] = int(filtered["is_shortage_risk"].sum())
        stats["unique_items"] = int(filtered["food_item"].nunique())
    elif dataset_name == "calendar" and not filtered.empty:
        stats["weekends"] = int(filtered["is_weekend"].sum())
        stats["holidays"] = int(filtered["is_holiday"].sum())
        stats["exam_days"] = int(filtered["is_exam_period"].sum())
        stats["events"] = int((filtered["event_name"] != "").sum())

    # Convert booleans/numbers cleanly for JSON
    records = page_df.replace({np.nan: None}).to_dict(orient="records")
    return {
        "dataset": dataset_name,
        "columns": list(df.columns),
        "rows": records,
        "pagination": {
            "page": page_clamped,
            "page_size": page_size,
            "total_rows": total_rows,
            "total_pages": total_pages,
        },
        "stats": stats,
    }


@app.get("/api/datasets/{dataset_name}/export")
def export_dataset(
    dataset_name: str,
    search: Optional[str] = None,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    meal_type: Optional[str] = None,
) -> StreamingResponse:
    df = _get_dataset_df(dataset_name)
    filtered = _filter_dataset(df, search, date_from, date_to, meal_type)
    buf = io.StringIO()
    filtered.to_csv(buf, index=False)
    buf.seek(0)
    return StreamingResponse(
        iter([buf.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={dataset_name}_filtered.csv"},
    )


FRONTEND_DIST = ROOT_DIR / "frontend" / "dist"
if (FRONTEND_DIST / "assets").is_dir():
    app.mount("/assets", StaticFiles(directory=str(FRONTEND_DIST / "assets")), name="assets")


@app.get("/{full_path:path}")
def serve_spa(full_path: str):
    if full_path.startswith("api/"):
        raise HTTPException(status_code=404, detail="API route not found")
    index_file = FRONTEND_DIST / "index.html"
    if index_file.is_file():
        candidate = FRONTEND_DIST / full_path
        if full_path and candidate.is_file():
            return FileResponse(candidate)
        return FileResponse(index_file)
    raise HTTPException(
        status_code=404,
        detail="Frontend build not found. Run `npm run build` in frontend/ or open Vite dev server.",
    )
