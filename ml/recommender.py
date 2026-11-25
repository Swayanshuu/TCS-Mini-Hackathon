"""Food preparation recommendations and waste/shortage risk detection."""

from __future__ import annotations

from typing import Any, Dict, List

import numpy as np
import pandas as pd


def compute_item_consumption_rates(
    food_prep: pd.DataFrame,
    meals: pd.DataFrame,
) -> pd.DataFrame:
    """Compute historical per-student consumption & preparation stats per (meal_type, menu, food_item)."""
    merged = food_prep.merge(
        meals[["date_str", "meal_type", "actual_students"]],
        on=["date_str", "meal_type"],
        how="inner",
    )
    merged = merged[merged["actual_students"] > 0].copy()
    merged["consumed_per_student"] = merged["quantity_consumed"] / merged["actual_students"]
    merged["prepared_per_student"] = merged["quantity_prepared"] / merged["actual_students"]

    stats = (
        merged.groupby(["meal_type", "menu", "food_item", "unit"], as_index=False)
        .agg(
            sample_count=("date_str", "count"),
            avg_consumed_per_student=("consumed_per_student", "mean"),
            std_consumed_per_student=("consumed_per_student", "std"),
            p90_consumed_per_student=("consumed_per_student", lambda s: float(np.percentile(s, 90))),
            avg_prepared=("quantity_prepared", "mean"),
            avg_consumed=("quantity_consumed", "mean"),
            avg_leftover=("quantity_leftover", "mean"),
            avg_wastage_pct=("wastage_pct", "mean"),
            shortage_count=("is_shortage_risk", "sum"),
            high_waste_count=("wastage_pct", lambda s: int((s >= 10.0).sum())),
        )
    )
    stats["std_consumed_per_student"] = stats["std_consumed_per_student"].fillna(0.0)
    stats["shortage_rate_pct"] = (stats["shortage_count"] / stats["sample_count"]) * 100.0
    stats["high_waste_rate_pct"] = (stats["high_waste_count"] / stats["sample_count"]) * 100.0
    return stats


def recommend_food_preparation(
    predicted_attendance: float,
    meal_type: str,
    menu: str,
    item_stats: pd.DataFrame,
    food_prep: pd.DataFrame,
    safety_buffer: float = 1.05,
) -> Dict[str, Any]:
    """Generate unit-accurate, explainable item-wise food preparation recommendations."""
    subset = item_stats[
        (item_stats["meal_type"] == meal_type) & (item_stats["menu"] == menu)
    ].copy()

    used_fallback = False
    if subset.empty:
        # Fallback for unseen menu: use items typical for that meal_type or menu name match
        subset = item_stats[item_stats["menu"] == menu].copy()
        if subset.empty:
            subset = item_stats[item_stats["meal_type"] == meal_type].head(4).copy()
        used_fallback = True

    recommendations: List[Dict[str, Any]] = []
    totals_by_unit: Dict[str, Dict[str, float]] = {}

    for _, row in subset.iterrows():
        unit = str(row["unit"])
        per_student = float(row["avg_consumed_per_student"])
        pred_consumed = predicted_attendance * per_student
        rec_prep = pred_consumed * safety_buffer
        hist_avg_prep = float(row["avg_prepared"])
        hist_avg_leftover = float(row["avg_leftover"])
        expected_leftover = max(0.0, rec_prep - pred_consumed)

        # Potential savings relative to historical average leftover vs recommended buffer leftover
        # (positive when recommended prep wastes less than historical avg leftover or reduces over-prep)
        potential_savings = max(0.0, hist_avg_prep - rec_prep) if hist_avg_prep > rec_prep else 0.0
        leftover_reduction = max(0.0, hist_avg_leftover - expected_leftover)

        # Determine item risk level & reason
        avg_waste_pct = float(row["avg_wastage_pct"])
        shortage_rate = float(row["shortage_rate_pct"])
        reasons: List[str] = []

        if shortage_rate >= 10.0 and safety_buffer < 1.05:
            risk = "High"
            reasons.append(
                f"Depleted completely (0 leftover) in {shortage_rate:.1f}% of historical meals; buffer {safety_buffer:.2f}x may risk shortage."
            )
        elif avg_waste_pct >= 10.0:
            risk = "High"
            reasons.append(
                f"Chronically over-prepared historically ({avg_waste_pct:.1f}% avg wastage, {hist_avg_leftover:.1f} {unit} leftover/meal)."
            )
        elif shortage_rate >= 7.0:
            risk = "Medium"
            reasons.append(
                f"Periodic stockout signal ({shortage_rate:.1f}% zero-leftover rate); monitor serving portions."
            )
        elif avg_waste_pct >= 6.5:
            risk = "Medium"
            reasons.append(
                f"Moderate historical wastage ({avg_waste_pct:.1f}% avg leftover); calibrated recommendation trims excess."
            )
        else:
            risk = "Low"
            reasons.append(
                f"Stable consumption ({per_student:.3f} {unit}/student) with low historical waste ({avg_waste_pct:.1f}%)."
            )

        digits = 0 if unit == "pieces" else 2
        recommendations.append(
            {
                "food_item": str(row["food_item"]),
                "unit": unit,
                "historical_samples": int(row["sample_count"]),
                "avg_consumed_per_student": round(per_student, 4),
                "predicted_consumption": round(pred_consumed, digits),
                "recommended_preparation": round(rec_prep, digits),
                "historical_avg_preparation": round(hist_avg_prep, digits),
                "expected_leftover": round(expected_leftover, digits),
                "historical_avg_leftover": round(hist_avg_leftover, digits),
                "potential_savings": round(potential_savings, digits),
                "leftover_reduction": round(leftover_reduction, digits),
                "historical_wastage_pct": round(avg_waste_pct, 1),
                "historical_shortage_rate_pct": round(shortage_rate, 1),
                "risk_level": risk,
                "risk_reason": " ".join(reasons),
            }
        )

        if unit not in totals_by_unit:
            totals_by_unit[unit] = {
                "predicted_consumption": 0.0,
                "recommended_preparation": 0.0,
                "historical_avg_preparation": 0.0,
                "expected_leftover": 0.0,
                "potential_savings": 0.0,
            }
        totals_by_unit[unit]["predicted_consumption"] += pred_consumed
        totals_by_unit[unit]["recommended_preparation"] += rec_prep
        totals_by_unit[unit]["historical_avg_preparation"] += hist_avg_prep
        totals_by_unit[unit]["expected_leftover"] += expected_leftover
        totals_by_unit[unit]["potential_savings"] += potential_savings

    # Round totals cleanly
    for u, vals in totals_by_unit.items():
        d = 0 if u == "pieces" else 2
        for k in vals:
            vals[k] = round(vals[k], d)

    return {
        "items": recommendations,
        "totals_by_unit": totals_by_unit,
        "used_fallback_menu": used_fallback,
    }
