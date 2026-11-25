"""Load, clean, validate, and join the three mess CSV datasets."""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import Dict

import numpy as np
import pandas as pd

ROOT_DIR = Path(__file__).resolve().parent.parent
CSV_DIR = ROOT_DIR / "csv files"


@dataclass
class MessDatasets:
    calendar: pd.DataFrame
    meals: pd.DataFrame
    food_prep: pd.DataFrame
    joined_meals: pd.DataFrame
    data_quality_report: Dict[str, object]


def _parse_bool(series: pd.Series) -> pd.Series:
    return (
        series.astype(str)
        .str.strip()
        .str.lower()
        .isin(["true", "1", "yes", "y"])
    )


def load_and_clean_datasets(csv_dir: Path | None = None) -> MessDatasets:
    """Dynamically load and clean calendar.csv, meals.csv, and food_preparation.csv."""
    base = Path(csv_dir) if csv_dir else CSV_DIR

    cal_path = base / "calendar.csv"
    meals_path = base / "meals.csv"
    prep_path = base / "food_preparation.csv"

    for p in (cal_path, meals_path, prep_path):
        if not p.exists():
            raise FileNotFoundError(f"Required dataset not found: {p}")

    cal_raw = pd.read_csv(cal_path)
    meals_raw = pd.read_csv(meals_path)
    prep_raw = pd.read_csv(prep_path)

    # 1. Clean calendar
    cal = cal_raw.copy()
    cal["date"] = pd.to_datetime(cal["date"], errors="coerce")
    cal_missing_dates = int(cal["date"].isna().sum())
    cal = cal.dropna(subset=["date"]).drop_duplicates(subset=["date"], keep="last")
    cal["date_str"] = cal["date"].dt.strftime("%Y-%m-%d")
    cal["day_of_week"] = cal["day_of_week"].astype(str).str.strip()
    cal["day_type"] = cal["day_type"].astype(str).str.strip().str.lower()
    cal["is_weekend"] = _parse_bool(cal["is_weekend"])
    cal["is_holiday"] = _parse_bool(cal["is_holiday"])
    cal["is_exam_period"] = _parse_bool(cal["is_exam_period"])
    cal["event_name"] = cal["event_name"].fillna("").astype(str).str.strip()
    cal["has_event"] = cal["event_name"] != ""
    cal = cal.sort_values("date").reset_index(drop=True)

    # 2. Clean meals
    meals = meals_raw.copy()
    meals["date"] = pd.to_datetime(meals["date"], errors="coerce")
    meals = meals.dropna(subset=["date"])
    meals["date_str"] = meals["date"].dt.strftime("%Y-%m-%d")
    meals["meal_type"] = meals["meal_type"].astype(str).str.strip().str.title()
    meals["menu"] = meals["menu"].astype(str).str.strip()
    meals["day_type"] = meals["day_type"].astype(str).str.strip().str.lower()
    meals["expected_students"] = pd.to_numeric(meals["expected_students"], errors="coerce")
    meals["actual_students"] = pd.to_numeric(meals["actual_students"], errors="coerce")

    meal_order_map = {"Breakfast": 0, "Lunch": 1, "Dinner": 2}
    meals["meal_order"] = meals["meal_type"].map(meal_order_map).fillna(9).astype(int)

    meals_dups = int(meals.duplicated(subset=["date_str", "meal_type"]).sum())
    meals = meals.drop_duplicates(subset=["date_str", "meal_type"], keep="last")

    # Impute missing numeric values if any occur in future datasets
    meals_missing_actual = int(meals["actual_students"].isna().sum())
    if meals_missing_actual > 0:
        meals["actual_students"] = meals["actual_students"].fillna(
            meals.groupby("meal_type")["actual_students"].transform("median")
        )
    meals["expected_students"] = meals["expected_students"].fillna(
        meals.groupby("meal_type")["expected_students"].transform("median")
    )
    meals["expected_students"] = meals["expected_students"].clip(lower=0)
    meals["actual_students"] = meals["actual_students"].clip(lower=0)

    meals = meals.sort_values(["date", "meal_order"]).reset_index(drop=True)

    # 3. Clean food_preparation
    prep = prep_raw.copy()
    prep["date"] = pd.to_datetime(prep["date"], errors="coerce")
    prep = prep.dropna(subset=["date"])
    prep["date_str"] = prep["date"].dt.strftime("%Y-%m-%d")
    prep["meal_type"] = prep["meal_type"].astype(str).str.strip().str.title()
    prep["menu"] = prep["menu"].astype(str).str.strip()
    prep["food_item"] = prep["food_item"].astype(str).str.strip()
    prep["unit"] = prep["unit"].astype(str).str.strip().str.lower()

    for col in ("quantity_prepared", "quantity_consumed", "quantity_leftover"):
        prep[col] = pd.to_numeric(prep[col], errors="coerce")

    prep_dups = int(prep.duplicated(subset=["date_str", "meal_type", "food_item"]).sum())
    prep = prep.drop_duplicates(subset=["date_str", "meal_type", "food_item"], keep="last")

    # Handle missing or inconsistent food quantities
    prep["quantity_prepared"] = prep["quantity_prepared"].fillna(
        prep.groupby(["meal_type", "food_item"])["quantity_prepared"].transform("median")
    ).clip(lower=0)
    prep["quantity_consumed"] = prep["quantity_consumed"].fillna(
        prep.groupby(["meal_type", "food_item"])["quantity_consumed"].transform("median")
    ).clip(lower=0)
    # Reconcile leftover if missing
    missing_leftover = prep["quantity_leftover"].isna()
    if missing_leftover.any():
        prep.loc[missing_leftover, "quantity_leftover"] = (
            prep.loc[missing_leftover, "quantity_prepared"]
            - prep.loc[missing_leftover, "quantity_consumed"]
        ).clip(lower=0)
    prep["quantity_leftover"] = prep["quantity_leftover"].clip(lower=0)

    prep["wastage_pct"] = np.where(
        prep["quantity_prepared"] > 0,
        (prep["quantity_leftover"] / prep["quantity_prepared"]) * 100.0,
        0.0,
    )
    prep["is_shortage_risk"] = (prep["quantity_leftover"] <= 0.05) | (
        prep["quantity_consumed"] >= prep["quantity_prepared"] * 0.995
    )
    prep["meal_order"] = prep["meal_type"].map(meal_order_map).fillna(9).astype(int)
    prep = prep.sort_values(["date", "meal_order", "food_item"]).reset_index(drop=True)

    # 4. Aggregate food preparation per meal by unit (never mixing kg, litre, pieces)
    unit_pivot = (
        prep.pivot_table(
            index=["date_str", "meal_type"],
            columns="unit",
            values=["quantity_prepared", "quantity_consumed", "quantity_leftover"],
            aggfunc="sum",
            fill_value=0.0,
        )
    )
    unit_pivot.columns = [f"{metric}_{unit}" for metric, unit in unit_pivot.columns]
    unit_pivot = unit_pivot.reset_index()

    meal_prep_stats = (
        prep.groupby(["date_str", "meal_type"], as_index=False)
        .agg(
            item_count=("food_item", "count"),
            avg_item_wastage_pct=("wastage_pct", "mean"),
            max_item_wastage_pct=("wastage_pct", "max"),
            shortage_items=("is_shortage_risk", "sum"),
        )
    )

    # 5. Join meals + calendar + meal_prep_stats + unit_pivot
    joined = meals.merge(
        cal[
            [
                "date_str",
                "day_of_week",
                "day_type",
                "is_weekend",
                "is_holiday",
                "is_exam_period",
                "event_name",
                "has_event",
            ]
        ],
        on="date_str",
        how="left",
        suffixes=("_meal", ""),
    )
    # Prefer calendar day_type if present, fallback to meal's day_type
    joined["day_type"] = joined["day_type"].fillna(joined["day_type_meal"]).fillna("regular")
    joined["day_of_week"] = joined["day_of_week"].fillna(joined["date"].dt.day_name())
    joined["is_weekend"] = joined["is_weekend"].fillna(joined["date"].dt.dayofweek >= 5)
    joined["is_holiday"] = joined["is_holiday"].fillna(False)
    joined["is_exam_period"] = joined["is_exam_period"].fillna(False)
    joined["event_name"] = joined["event_name"].fillna("")
    joined["has_event"] = joined["has_event"].fillna(False)

    joined = joined.merge(meal_prep_stats, on=["date_str", "meal_type"], how="left")
    joined = joined.merge(unit_pivot, on=["date_str", "meal_type"], how="left")

    # Compute mass wastage % (kg + litre combined as mass/volume, plus separate kg-only wastage)
    for col in [
        "quantity_prepared_kg",
        "quantity_consumed_kg",
        "quantity_leftover_kg",
        "quantity_prepared_litre",
        "quantity_consumed_litre",
        "quantity_leftover_litre",
        "quantity_prepared_pieces",
        "quantity_consumed_pieces",
        "quantity_leftover_pieces",
    ]:
        if col not in joined.columns:
            joined[col] = 0.0
        joined[col] = joined[col].fillna(0.0)

    joined["attendance_error_expected"] = joined["actual_students"] - joined["expected_students"]
    joined["shortage_items"] = joined["shortage_items"].fillna(0).astype(int)
    joined["avg_item_wastage_pct"] = joined["avg_item_wastage_pct"].fillna(0.0)
    joined["max_item_wastage_pct"] = joined["max_item_wastage_pct"].fillna(0.0)

    # Risk classification per meal
    def _meal_risk(row: pd.Series) -> str:
        if row["avg_item_wastage_pct"] >= 10.0 or row["shortage_items"] >= 2:
            return "High"
        if row["avg_item_wastage_pct"] >= 6.5 or row["shortage_items"] == 1:
            return "Medium"
        return "Low"

    joined["risk_level"] = joined.apply(_meal_risk, axis=1)
    joined = joined.sort_values(["date", "meal_order"]).reset_index(drop=True)

    quality = {
        "calendar_rows": int(len(cal)),
        "meals_rows": int(len(meals)),
        "food_prep_rows": int(len(prep)),
        "date_min": cal["date_str"].min(),
        "date_max": cal["date_str"].max(),
        "calendar_missing_dates": cal_missing_dates,
        "meals_duplicates_removed": meals_dups,
        "meals_missing_actual_imputed": meals_missing_actual,
        "prep_duplicates_removed": prep_dups,
        "zero_leftover_records": int((prep["quantity_leftover"] <= 0.01).sum()),
        "units_present": sorted(prep["unit"].unique().tolist()),
    }

    return MessDatasets(
        calendar=cal,
        meals=meals,
        food_prep=prep,
        joined_meals=joined,
        data_quality_report=quality,
    )
