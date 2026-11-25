"""Historical waste, shortage, calendar, and food-item analytics computed directly from CSVs."""

from __future__ import annotations

from typing import Any, Dict, List

import numpy as np
import pandas as pd


def compute_waste_and_shortage_analysis(
    joined_meals: pd.DataFrame,
    food_prep: pd.DataFrame,
) -> Dict[str, Any]:
    """Identify high-waste items, high-waste menus, shortage meals, and unusual attendance days."""
    # 1. Item-level waste & shortage stats
    item_agg = (
        food_prep.groupby(["food_item", "unit"], as_index=False)
        .agg(
            occurrences=("date_str", "count"),
            total_prepared=("quantity_prepared", "sum"),
            total_consumed=("quantity_consumed", "sum"),
            total_leftover=("quantity_leftover", "sum"),
            avg_wastage_pct=("wastage_pct", "mean"),
            max_wastage_pct=("wastage_pct", "max"),
            shortage_events=("is_shortage_risk", "sum"),
            high_waste_events=("wastage_pct", lambda s: int((s >= 10.0).sum())),
        )
    )
    item_agg["overall_wastage_pct"] = (
        item_agg["total_leftover"] / item_agg["total_prepared"].replace(0, np.nan)
    ).fillna(0.0) * 100.0
    item_agg["shortage_rate_pct"] = (item_agg["shortage_events"] / item_agg["occurrences"]) * 100.0
    item_agg["high_waste_rate_pct"] = (item_agg["high_waste_events"] / item_agg["occurrences"]) * 100.0

    def _item_risk(row: pd.Series) -> tuple[str, str]:
        if row["overall_wastage_pct"] >= 10.0:
            return (
                "High",
                f"Consistent over-preparation: {row['overall_wastage_pct']:.1f}% average leftover across {int(row['occurrences'])} meals ({int(row['high_waste_events'])} meals >=10% waste).",
            )
        if row["shortage_rate_pct"] >= 8.0:
            return (
                "High",
                f"Frequent depletion risk: 0 leftover in {int(row['shortage_events'])} of {int(row['occurrences'])} meals ({row['shortage_rate_pct']:.1f}%).",
            )
        if row["overall_wastage_pct"] >= 6.5 or row["shortage_rate_pct"] >= 5.0:
            return (
                "Medium",
                f"Moderate variance: {row['overall_wastage_pct']:.1f}% wastage and {int(row['shortage_events'])} zero-leftover events.",
            )
        return (
            "Low",
            f"Well calibrated: {row['overall_wastage_pct']:.1f}% wastage across {int(row['occurrences'])} meals.",
        )

    risks = item_agg.apply(_item_risk, axis=1)
    item_agg["risk_level"] = [r[0] for r in risks]
    item_agg["reason"] = [r[1] for r in risks]
    item_agg = item_agg.sort_values("overall_wastage_pct", ascending=False)

    items_list: List[Dict[str, Any]] = []
    for _, r in item_agg.iterrows():
        d = 0 if r["unit"] == "pieces" else 2
        items_list.append(
            {
                "food_item": str(r["food_item"]),
                "unit": str(r["unit"]),
                "occurrences": int(r["occurrences"]),
                "total_prepared": round(float(r["total_prepared"]), d),
                "total_consumed": round(float(r["total_consumed"]), d),
                "total_leftover": round(float(r["total_leftover"]), d),
                "overall_wastage_pct": round(float(r["overall_wastage_pct"]), 2),
                "max_wastage_pct": round(float(r["max_wastage_pct"]), 2),
                "shortage_events": int(r["shortage_events"]),
                "shortage_rate_pct": round(float(r["shortage_rate_pct"]), 1),
                "high_waste_events": int(r["high_waste_events"]),
                "risk_level": str(r["risk_level"]),
                "reason": str(r["reason"]),
            }
        )

    # 2. Menu-level waste & attendance error
    menu_prep = (
        food_prep.groupby(["meal_type", "menu"], as_index=False)
        .agg(
            avg_wastage_pct=("wastage_pct", "mean"),
            shortage_events=("is_shortage_risk", "sum"),
            item_rows=("food_item", "count"),
        )
    )
    menu_att = (
        joined_meals.groupby(["meal_type", "menu"], as_index=False)
        .agg(
            meal_count=("date_str", "count"),
            avg_expected=("expected_students", "mean"),
            avg_actual=("actual_students", "mean"),
            high_risk_meals=("risk_level", lambda s: int((s == "High").sum())),
        )
    )
    menu_stats = menu_att.merge(menu_prep, on=["meal_type", "menu"], how="left")
    menu_stats["attendance_gap"] = menu_stats["avg_actual"] - menu_stats["avg_expected"]
    menu_stats = menu_stats.sort_values("avg_wastage_pct", ascending=False)

    menus_list: List[Dict[str, Any]] = []
    for _, r in menu_stats.iterrows():
        wp = float(r["avg_wastage_pct"])
        gap = float(r["attendance_gap"])
        if wp >= 8.5 or int(r["high_risk_meals"]) >= 12:
            risk = "High"
        elif wp >= 6.8 or abs(gap) >= 20:
            risk = "Medium"
        else:
            risk = "Low"
        reason = (
            f"Avg wastage {wp:.1f}%; actual turnout differs from expected by {gap:+.1f} students/meal."
        )
        menus_list.append(
            {
                "meal_type": str(r["meal_type"]),
                "menu": str(r["menu"]),
                "meal_count": int(r["meal_count"]),
                "avg_expected": round(float(r["avg_expected"]), 1),
                "avg_actual": round(float(r["avg_actual"]), 1),
                "attendance_gap": round(gap, 1),
                "avg_wastage_pct": round(wp, 2),
                "shortage_events": int(r["shortage_events"]),
                "high_risk_meals": int(r["high_risk_meals"]),
                "risk_level": risk,
                "reason": reason,
            }
        )

    # 3. Shortage-risk meals (where items ran out to 0 leftover and actual exceeded expected)
    shortage_df = food_prep[food_prep["is_shortage_risk"]].merge(
        joined_meals[
            [
                "date_str",
                "meal_type",
                "expected_students",
                "actual_students",
                "day_type",
                "event_name",
            ]
        ],
        on=["date_str", "meal_type"],
        how="left",
    )
    shortage_df["attendance_surge"] = (
        shortage_df["actual_students"] - shortage_df["expected_students"]
    )
    shortage_df = shortage_df.sort_values(["date_str", "meal_type"], ascending=[False, True])
    shortage_alerts: List[Dict[str, Any]] = []
    for _, r in shortage_df.head(50).iterrows():
        surge = float(r["attendance_surge"])
        reason = (
            f"{r['food_item']} depleted completely ({r['quantity_prepared']} {r['unit']} prepared & consumed)."
        )
        if surge > 0:
            reason += f" Actual attendance ({int(r['actual_students'])}) exceeded expected ({int(r['expected_students'])}) by +{int(surge)}."
        shortage_alerts.append(
            {
                "date": str(r["date_str"]),
                "meal_type": str(r["meal_type"]),
                "menu": str(r["menu"]),
                "food_item": str(r["food_item"]),
                "unit": str(r["unit"]),
                "quantity_prepared": round(float(r["quantity_prepared"]), 2),
                "expected_students": int(r["expected_students"]),
                "actual_students": int(r["actual_students"]),
                "attendance_surge": int(surge),
                "day_type": str(r["day_type"]),
                "risk_level": "High" if surge >= 15 else "Medium",
                "reason": reason,
            }
        )

    # 4. Unusual attendance days (z-score within day_type or large expected-vs-actual gap)
    day_totals = (
        joined_meals.groupby(
            ["date_str", "day_of_week", "day_type", "event_name"], as_index=False
        )
        .agg(
            total_expected=("expected_students", "sum"),
            total_actual=("actual_students", "sum"),
            avg_wastage_pct=("avg_item_wastage_pct", "mean"),
        )
    )
    day_totals["gap"] = day_totals["total_actual"] - day_totals["total_expected"]
    regime_mean = day_totals.groupby("day_type")["total_actual"].transform("mean")
    regime_std = day_totals.groupby("day_type")["total_actual"].transform("std").fillna(1.0).replace(0, 1.0)
    day_totals["z_score"] = (day_totals["total_actual"] - regime_mean) / regime_std
    unusual = day_totals[
        (day_totals["z_score"].abs() >= 1.8) | (day_totals["gap"].abs() >= 100)
    ].sort_values("gap", key=lambda s: s.abs(), ascending=False)

    unusual_days: List[Dict[str, Any]] = []
    for _, r in unusual.head(25).iterrows():
        gap = int(r["gap"])
        ev = f" ({r['event_name']})" if r["event_name"] else ""
        direction = "surge" if gap > 0 else "drop"
        unusual_days.append(
            {
                "date": str(r["date_str"]),
                "day_of_week": str(r["day_of_week"]),
                "day_type": str(r["day_type"]),
                "event_name": str(r["event_name"]),
                "total_expected": int(r["total_expected"]),
                "total_actual": int(r["total_actual"]),
                "gap": gap,
                "z_score": round(float(r["z_score"]), 2),
                "avg_wastage_pct": round(float(r["avg_wastage_pct"]), 2),
                "risk_level": "High" if abs(gap) >= 110 or abs(float(r["z_score"])) >= 2.2 else "Medium",
                "reason": f"Unusual {direction}{ev}: {int(r['total_actual'])} actual vs {int(r['total_expected'])} expected ({gap:+d} across 3 meals, z={r['z_score']:+.2f}).",
            }
        )

    # 5. Calendar impact summary
    cal_impact = (
        joined_meals.groupby("day_type", as_index=False)
        .agg(
            meal_count=("date_str", "count"),
            avg_expected=("expected_students", "mean"),
            avg_actual=("actual_students", "mean"),
            avg_wastage_pct=("avg_item_wastage_pct", "mean"),
            shortage_meals=("shortage_items", lambda s: int((s > 0).sum())),
        )
        .sort_values("avg_actual", ascending=False)
    )
    reg_row = cal_impact[cal_impact["day_type"] == "regular"]
    reg_avg = float(reg_row["avg_actual"].iloc[0]) if not reg_row.empty else float(joined_meals["actual_students"].mean())

    calendar_impacts = []
    for _, r in cal_impact.iterrows():
        cnt = int(r["meal_count"])
        avg_a = float(r["avg_actual"])
        delta_pct = ((avg_a - reg_avg) / reg_avg) * 100.0 if reg_avg > 0 else 0.0
        calendar_impacts.append(
            {
                "day_type": str(r["day_type"]),
                "meal_count": cnt,
                "avg_expected": round(float(r["avg_expected"]), 1),
                "avg_actual": round(avg_a, 1),
                "vs_regular_pct": round(delta_pct, 1),
                "avg_wastage_pct": round(float(r["avg_wastage_pct"]), 2),
                "shortage_meals": int(r["shortage_meals"]),
                "evidence_status": "Limited" if cnt < 15 else "Sufficient",
            }
        )

    return {
        "items": items_list,
        "menus": menus_list,
        "shortage_alerts": shortage_alerts,
        "unusual_days": unusual_days,
        "calendar_impacts": calendar_impacts,
        "risk_distribution": {
            "Low": int((joined_meals["risk_level"] == "Low").sum()),
            "Medium": int((joined_meals["risk_level"] == "Medium").sum()),
            "High": int((joined_meals["risk_level"] == "High").sum()),
        },
    }
