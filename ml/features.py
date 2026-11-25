"""Chronological, leakage-free feature engineering for meal attendance prediction."""

from __future__ import annotations

from collections import defaultdict, deque
from typing import Any, Dict, List, Tuple

import numpy as np
import pandas as pd

CATEGORICAL_FEATURES = ["meal_type", "menu", "day_of_week", "day_type"]
NUMERIC_FEATURES = [
    "is_weekend_int",
    "is_holiday_int",
    "is_exam_period_int",
    "has_event_int",
    "dow_sin",
    "dow_cos",
    "month_sin",
    "month_cos",
    "prev_meal_actual",
    "prev_day_same_meal_actual",
    "same_weekday_avg_actual",
    "same_meal_avg_actual",
    "same_menu_avg_actual",
    "same_day_type_avg_actual",
    "rolling_7d_same_meal_avg",
    "rolling_3d_overall_avg",
    "recent_trend_delta",
    "menu_popularity_lift",
]
ALL_FEATURES = CATEGORICAL_FEATURES + NUMERIC_FEATURES

DAY_NAME_TO_IDX = {
    "Monday": 0,
    "Tuesday": 1,
    "Wednesday": 2,
    "Thursday": 3,
    "Friday": 4,
    "Saturday": 5,
    "Sunday": 6,
}


def _deque7() -> deque[float]:
    return deque(maxlen=7)


class CausalHistoryTracker:
    """Maintains causal historical statistics strictly up to t-1 (no future leakage)."""

    def __init__(self) -> None:
        self.all_actuals: List[float] = []
        self.recent_overall_9: deque[float] = deque(maxlen=9)
        self.recent_overall_42: deque[float] = deque(maxlen=42)
        self.by_meal: Dict[str, List[float]] = defaultdict(list)
        self.recent_by_meal_7: Dict[str, deque[float]] = defaultdict(_deque7)
        self.by_weekday_meal: Dict[Tuple[str, str], List[float]] = defaultdict(list)
        self.by_menu_meal: Dict[Tuple[str, str], List[float]] = defaultdict(list)
        self.by_day_type_meal: Dict[Tuple[str, str], List[float]] = defaultdict(list)
        self.last_meal_actual: float | None = None
        self.last_same_meal_actual: Dict[str, float] = {}

    def extract_features(self, row: Dict[str, Any]) -> Dict[str, Any]:
        meal_type = str(row["meal_type"])
        menu = str(row["menu"])
        day_of_week = str(row["day_of_week"])
        day_type = str(row["day_type"])
        dt = pd.Timestamp(row["date"])
        dow_idx = DAY_NAME_TO_IDX.get(day_of_week, int(dt.dayofweek))
        month = int(dt.month)

        global_mean = float(np.mean(self.all_actuals)) if self.all_actuals else 350.0
        meal_hist = self.by_meal[meal_type]
        meal_mean = float(np.mean(meal_hist)) if meal_hist else global_mean

        weekday_hist = self.by_weekday_meal[(day_of_week, meal_type)]
        weekday_mean = float(np.mean(weekday_hist)) if weekday_hist else meal_mean

        menu_hist = self.by_menu_meal[(meal_type, menu)]
        menu_mean = float(np.mean(menu_hist)) if menu_hist else meal_mean

        day_type_hist = self.by_day_type_meal[(day_type, meal_type)]
        day_type_mean = float(np.mean(day_type_hist)) if day_type_hist else meal_mean

        rolling_7_hist = list(self.recent_by_meal_7[meal_type])
        rolling_7_mean = float(np.mean(rolling_7_hist)) if rolling_7_hist else meal_mean

        rolling_3d_mean = (
            float(np.mean(self.recent_overall_9)) if self.recent_overall_9 else global_mean
        )
        rolling_14d_mean = (
            float(np.mean(self.recent_overall_42)) if self.recent_overall_42 else global_mean
        )

        prev_meal = self.last_meal_actual if self.last_meal_actual is not None else global_mean
        prev_day_same_meal = self.last_same_meal_actual.get(meal_type, meal_mean)

        return {
            "meal_type": meal_type,
            "menu": menu,
            "day_of_week": day_of_week,
            "day_type": day_type,
            "is_weekend_int": int(bool(row["is_weekend"])),
            "is_holiday_int": int(bool(row["is_holiday"])),
            "is_exam_period_int": int(bool(row["is_exam_period"])),
            "has_event_int": int(bool(row.get("has_event", False))),
            "dow_sin": float(np.sin(2 * np.pi * dow_idx / 7.0)),
            "dow_cos": float(np.cos(2 * np.pi * dow_idx / 7.0)),
            "month_sin": float(np.sin(2 * np.pi * (month - 1) / 12.0)),
            "month_cos": float(np.cos(2 * np.pi * (month - 1) / 12.0)),
            "prev_meal_actual": prev_meal,
            "prev_day_same_meal_actual": prev_day_same_meal,
            "same_weekday_avg_actual": weekday_mean,
            "same_meal_avg_actual": meal_mean,
            "same_menu_avg_actual": menu_mean,
            "same_day_type_avg_actual": day_type_mean,
            "rolling_7d_same_meal_avg": rolling_7_mean,
            "rolling_3d_overall_avg": rolling_3d_mean,
            "recent_trend_delta": rolling_3d_mean - rolling_14d_mean,
            "menu_popularity_lift": menu_mean - meal_mean,
        }

    def update(self, row: Dict[str, Any], actual_students: float) -> None:
        meal_type = str(row["meal_type"])
        menu = str(row["menu"])
        day_of_week = str(row["day_of_week"])
        day_type = str(row["day_type"])

        val = float(actual_students)
        self.all_actuals.append(val)
        self.recent_overall_9.append(val)
        self.recent_overall_42.append(val)
        self.by_meal[meal_type].append(val)
        self.recent_by_meal_7[meal_type].append(val)
        self.by_weekday_meal[(day_of_week, meal_type)].append(val)
        self.by_menu_meal[(meal_type, menu)].append(val)
        self.by_day_type_meal[(day_type, meal_type)].append(val)
        self.last_meal_actual = val
        self.last_same_meal_actual[meal_type] = val


def build_causal_feature_matrix(joined_meals: pd.DataFrame) -> Tuple[pd.DataFrame, CausalHistoryTracker]:
    """Build leakage-free feature matrix in strict chronological order."""
    df = joined_meals.sort_values(["date", "meal_order"]).reset_index(drop=True)
    tracker = CausalHistoryTracker()
    rows: List[Dict[str, Any]] = []

    for _, r in df.iterrows():
        row_dict = r.to_dict()
        feats = tracker.extract_features(row_dict)
        rows.append(feats)
        tracker.update(row_dict, float(row_dict["actual_students"]))

    feature_df = pd.DataFrame(rows)
    return feature_df, tracker
