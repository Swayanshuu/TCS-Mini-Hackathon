"""Explainable AI and calendar intelligence grounded strictly in observed historical data."""

from __future__ import annotations

from typing import Any, Dict, List

import pandas as pd


def resolve_calendar_context(
    target_date: str,
    calendar_df: pd.DataFrame,
    day_type_override: str | None = None,
    is_holiday_override: bool | None = None,
    is_exam_override: bool | None = None,
    event_name_override: str | None = None,
) -> Dict[str, Any]:
    """Resolve calendar flags for a target date, supporting future dates beyond 2025."""
    dt = pd.Timestamp(target_date)
    date_str = dt.strftime("%Y-%m-%d")
    day_of_week = dt.day_name()
    is_weekend = bool(dt.dayofweek >= 5)

    match = calendar_df[calendar_df["date_str"] == date_str]
    known_in_calendar = not match.empty

    if known_in_calendar:
        row = match.iloc[0]
        day_type = str(row["day_type"])
        is_holiday = bool(row["is_holiday"])
        is_exam_period = bool(row["is_exam_period"])
        event_name = str(row["event_name"])
    else:
        # Check same month-day in historical calendar for recurring fixed-date national holidays
        md = dt.strftime("%m-%d")
        recurring = calendar_df[
            (calendar_df["date"].dt.strftime("%m-%d") == md) & (calendar_df["is_holiday"])
        ]
        if not recurring.empty:
            r0 = recurring.iloc[0]
            day_type = str(r0["day_type"])
            is_holiday = True
            is_exam_period = False
            event_name = str(r0["event_name"])
        else:
            day_type = "weekend" if is_weekend else "regular"
            is_holiday = False
            is_exam_period = False
            event_name = ""

    # Apply explicit staff overrides when forecasting future dates
    if day_type_override and day_type_override.strip():
        day_type = day_type_override.strip().lower()
    if is_holiday_override is not None:
        is_holiday = bool(is_holiday_override)
        if is_holiday and day_type in ("regular", "weekend"):
            day_type = "holiday"
    if is_exam_override is not None:
        is_exam_period = bool(is_exam_override)
        if is_exam_period and day_type in ("regular", "weekend"):
            day_type = "examination"
    if event_name_override is not None and event_name_override.strip():
        event_name = event_name_override.strip()
        if day_type in ("regular", "weekend") and not is_holiday:
            day_type = "campus_event"

    return {
        "date": dt,
        "date_str": date_str,
        "day_of_week": day_of_week,
        "day_type": day_type,
        "is_weekend": is_weekend,
        "is_holiday": is_holiday,
        "is_exam_period": is_exam_period,
        "event_name": event_name,
        "has_event": bool(event_name),
        "known_in_calendar": known_in_calendar,
    }


def build_prediction_explanation(
    predicted_attendance: float,
    context: Dict[str, Any],
    meal_type: str,
    menu: str,
    features: Dict[str, Any],
    joined_meals: pd.DataFrame,
    food_recommendations: Dict[str, Any],
    safety_buffer: float,
) -> Dict[str, Any]:
    """Generate grounded, non-fabricated explanations backed by historical sample counts."""
    meal_subset = joined_meals[joined_meals["meal_type"] == meal_type]
    overall_meal_avg = float(meal_subset["actual_students"].mean())
    regular_meal_avg = float(
        meal_subset[meal_subset["day_type"] == "regular"]["actual_students"].mean()
    )

    # Calendar regime stats
    day_type = context["day_type"]
    regime_subset = meal_subset[meal_subset["day_type"] == day_type]
    regime_count = int(len(regime_subset))
    regime_avg = (
        float(regime_subset["actual_students"].mean()) if regime_count > 0 else overall_meal_avg
    )
    regime_delta = regime_avg - regular_meal_avg

    # Weekday stats
    dow = context["day_of_week"]
    dow_subset = meal_subset[meal_subset["day_of_week"] == dow]
    dow_count = int(len(dow_subset))
    dow_avg = float(dow_subset["actual_students"].mean()) if dow_count > 0 else overall_meal_avg

    # Menu stats
    menu_subset = meal_subset[meal_subset["menu"] == menu]
    menu_count = int(len(menu_subset))
    menu_avg = float(menu_subset["actual_students"].mean()) if menu_count > 0 else overall_meal_avg
    menu_delta = menu_avg - overall_meal_avg

    # Event stats
    event_name = context["event_name"]
    event_count = 0
    event_avg = None
    if event_name:
        ev_sub = joined_meals[
            (joined_meals["event_name"].str.lower() == event_name.lower())
            & (joined_meals["meal_type"] == meal_type)
        ]
        event_count = int(len(ev_sub))
        if event_count > 0:
            event_avg = float(ev_sub["actual_students"].mean())

    # Evidence sufficiency assessment
    sparse_warnings: List[str] = []
    if regime_count < 15:
        sparse_warnings.append(
            f"Limited historical evidence for '{day_type}' on {meal_type} ({regime_count} recorded meal(s)); model relies more heavily on broader calendar flags and recent trend."
        )
    if menu_count == 0:
        sparse_warnings.append(
            f"Unseen menu '{menu}' for {meal_type}; fallback historical consumption rates were used."
        )
    elif menu_count < 10:
        sparse_warnings.append(
            f"Small historical sample for '{menu}' ({menu_count} records)."
        )
    if event_name and event_count <= 1:
        sparse_warnings.append(
            f"Event '{event_name}' has {event_count} exact historical record(s) for {meal_type}; treat event impact as low-sample estimate."
        )

    factors = [
        {
            "factor": f"Base {meal_type} demand",
            "value": f"{overall_meal_avg:.0f} students",
            "impact": 0.0,
            "detail": f"Overall {meal_type} average across {len(meal_subset)} historical meals.",
        },
        {
            "factor": f"Calendar regime ({day_type})",
            "value": f"{regime_avg:.0f} avg ({regime_count} meals)",
            "impact": round(regime_delta, 1),
            "detail": (
                f"{day_type.replace('_', ' ').title()} averages {regime_delta:+.1f} students vs regular days ({regular_meal_avg:.0f})."
            ),
        },
        {
            "factor": f"Menu selection ({menu})",
            "value": f"{menu_avg:.0f} avg ({menu_count} meals)" if menu_count else "Unseen menu",
            "impact": round(menu_delta, 1),
            "detail": (
                f"'{menu}' historically shifts {meal_type} turnout by {menu_delta:+.1f} students vs {meal_type} mean."
                if menu_count
                else f"No exact history for '{menu}' in {meal_type}; fallback baseline applied."
            ),
        },
        {
            "factor": f"Weekday pattern ({dow})",
            "value": f"{dow_avg:.0f} avg ({dow_count} meals)",
            "impact": round(dow_avg - overall_meal_avg, 1),
            "detail": f"{dow} {meal_type} averages {dow_avg:.0f} students across {dow_count} weeks.",
        },
        {
            "factor": "Recent 3-day vs 14-day trend",
            "value": f"{features['recent_trend_delta']:+.1f} students",
            "impact": round(float(features["recent_trend_delta"]), 1),
            "detail": f"Last 3-day rolling average ({features['rolling_3d_overall_avg']:.0f}) vs recent 14-day baseline.",
        },
    ]

    summary_parts = [
        f"Predicted {round(predicted_attendance)} students for {meal_type} ({menu}) on {context['date_str']} ({dow}, {day_type.replace('_', ' ')})."
    ]
    if context["is_holiday"]:
        summary_parts.append(
            f"Holiday status significantly reduces campus presence (historical holiday {meal_type} avg: {regime_avg:.0f} students across {regime_count} records)."
        )
    elif context["is_exam_period"]:
        summary_parts.append(
            f"Examination period typically moderates turnout to ~{regime_avg:.0f} students vs {regular_meal_avg:.0f} on regular days."
        )
    elif context["is_weekend"]:
        summary_parts.append(
            f"Weekend pattern lowers attendance compared to weekday regular meals ({regime_avg:.0f} vs {regular_meal_avg:.0f})."
        )
    if event_name:
        if event_avg is not None:
            summary_parts.append(
                f"Special event '{event_name}' previously recorded {event_avg:.0f} students ({event_count} record)."
            )
        else:
            summary_parts.append(
                f"Special event '{event_name}' has no prior exact match in the dataset."
            )

    summary_parts.append(
        f"Food quantities are scaled by historical per-student consumption × {round(predicted_attendance)} predicted students × {safety_buffer:.2f}x safety buffer."
    )

    risk_notes: List[str] = []
    high_risk_items = [
        it for it in food_recommendations["items"] if it["risk_level"] == "High"
    ]
    if high_risk_items:
        for it in high_risk_items:
            risk_notes.append(f"{it['food_item']}: {it['risk_reason']}")
    else:
        risk_notes.append(
            "All menu items sit within normal historical variance under the selected safety buffer."
        )

    if safety_buffer < 1.02:
        risk_notes.append(
            "Safety buffer below 1.02x leaves minimal margin for sudden attendance spikes above expected turnout."
        )
    elif safety_buffer > 1.12:
        risk_notes.append(
            f"Safety buffer of {safety_buffer:.2f}x increases expected leftover (~{((safety_buffer - 1) * 100):.0f}% over predicted consumption)."
        )

    return {
        "summary": " ".join(summary_parts),
        "factors": factors,
        "sparse_evidence_warnings": sparse_warnings,
        "evidence_sufficiency": "Limited" if sparse_warnings else "Sufficient",
        "risk_notes": risk_notes,
        "calendar_flags": {
            "day_of_week": dow,
            "day_type": day_type,
            "is_weekend": context["is_weekend"],
            "is_holiday": context["is_holiday"],
            "is_exam_period": context["is_exam_period"],
            "event_name": event_name or None,
        },
    }
