"""Train, evaluate, persist, and run attendance & food preparation ML pipeline."""

from __future__ import annotations

import json
import pickle
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Dict, List

import numpy as np
import pandas as pd
from sklearn.compose import ColumnTransformer
from sklearn.ensemble import GradientBoostingRegressor, RandomForestRegressor
from sklearn.impute import SimpleImputer
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder

from ml.analytics import compute_waste_and_shortage_analysis
from ml.data_loader import MessDatasets, load_and_clean_datasets
from ml.explainer import build_prediction_explanation, resolve_calendar_context
from ml.features import (
    ALL_FEATURES,
    CATEGORICAL_FEATURES,
    NUMERIC_FEATURES,
    CausalHistoryTracker,
    build_causal_feature_matrix,
)
from ml.recommender import compute_item_consumption_rates, recommend_food_preparation

ML_DIR = Path(__file__).resolve().parent
ARTIFACTS_DIR = ML_DIR / "artifacts"


@dataclass
class TrainedArtifacts:
    datasets: MessDatasets
    best_model_name: str
    best_pipeline: Pipeline
    all_model_metrics: Dict[str, Dict[str, float]]
    backtest_records: List[Dict[str, Any]]
    feature_importances: List[Dict[str, Any]]
    tracker: CausalHistoryTracker
    item_stats: pd.DataFrame
    waste_analysis: Dict[str, Any]
    split_info: Dict[str, Any]


def _make_preprocessor() -> ColumnTransformer:
    return ColumnTransformer(
        transformers=[
            (
                "cat",
                OneHotEncoder(handle_unknown="ignore", sparse_output=False),
                CATEGORICAL_FEATURES,
            ),
            (
                "num",
                SimpleImputer(strategy="median"),
                NUMERIC_FEATURES,
            ),
        ]
    )


def _compute_metrics(y_true: np.ndarray, y_pred: np.ndarray) -> Dict[str, float]:
    mae = float(mean_absolute_error(y_true, y_pred))
    rmse = float(np.sqrt(mean_squared_error(y_true, y_pred)))
    r2 = float(r2_score(y_true, y_pred))
    mape = float(np.mean(np.abs((y_true - y_pred) / np.maximum(y_true, 1.0))) * 100.0)
    return {
        "mae": round(mae, 2),
        "rmse": round(rmse, 2),
        "r2": round(r2, 4),
        "mape": round(mape, 2),
    }


def train_and_evaluate(csv_dir: Path | None = None, save_artifacts: bool = True) -> TrainedArtifacts:
    """Run full chronological ML training, model comparison, backtesting, and persistence."""
    datasets = load_and_clean_datasets(csv_dir)
    df = datasets.joined_meals.sort_values(["date", "meal_order"]).reset_index(drop=True)

    X_all, tracker = build_causal_feature_matrix(df)
    y_all = df["actual_students"].astype(float).values

    # Strict chronological 80/20 split (no shuffling, zero future leakage)
    n_total = len(df)
    split_idx = int(n_total * 0.80)
    X_train, X_test = X_all.iloc[:split_idx], X_all.iloc[split_idx:]
    y_train, y_test = y_all[:split_idx], y_all[split_idx:]
    df_test = df.iloc[split_idx:].copy().reset_index(drop=True)

    candidates = {
        "Random Forest Regressor": RandomForestRegressor(
            n_estimators=260,
            max_depth=12,
            min_samples_leaf=3,
            random_state=42,
            n_jobs=-1,
        ),
        "Gradient Boosting Regressor": GradientBoostingRegressor(
            n_estimators=220,
            learning_rate=0.05,
            max_depth=4,
            min_samples_leaf=4,
            subsample=0.85,
            random_state=42,
        ),
    }

    trained_models: Dict[str, Pipeline] = {}
    metrics_map: Dict[str, Dict[str, float]] = {}
    test_predictions_map: Dict[str, np.ndarray] = {}

    for name, estimator in candidates.items():
        pipe = Pipeline([("pre", _make_preprocessor()), ("reg", estimator)])
        pipe.fit(X_train[ALL_FEATURES], y_train)
        preds = np.clip(pipe.predict(X_test[ALL_FEATURES]), 0.0, None)
        trained_models[name] = pipe
        metrics_map[name] = _compute_metrics(y_test, preds)
        test_predictions_map[name] = preds

    # Select best model strictly on chronological validation RMSE (tie-break: MAE)
    best_model_name = min(
        metrics_map.keys(),
        key=lambda k: (metrics_map[k]["rmse"], metrics_map[k]["mae"]),
    )
    best_eval_pipe = trained_models[best_model_name]
    best_test_preds = test_predictions_map[best_model_name]

    # Feature importances from the selected tree ensemble
    pre = best_eval_pipe.named_steps["pre"]
    reg = best_eval_pipe.named_steps["reg"]
    feature_names = pre.get_feature_names_out()
    raw_importances = reg.feature_importances_
    # Aggregate one-hot features back to base feature names for clean interpretability
    grouped_imp: Dict[str, float] = {}
    for fname, imp in zip(feature_names, raw_importances):
        clean_name = fname.split("__", 1)[-1]
        base = clean_name
        for cat in CATEGORICAL_FEATURES:
            if clean_name.startswith(cat + "_"):
                base = cat
                break
        grouped_imp[base] = grouped_imp.get(base, 0.0) + float(imp)
    total_imp = sum(grouped_imp.values()) or 1.0
    feature_importances = sorted(
        [
            {"feature": k, "importance": round((v / total_imp) * 100.0, 2)}
            for k, v in grouped_imp.items()
        ],
        key=lambda x: x["importance"],
        reverse=True,
    )

    # Item-level historical stats computed from training period for honest backtesting,
    # and full dataset stats for production future predictions.
    train_meals = df.iloc[:split_idx]
    train_cutoff = train_meals["date"].max()
    train_prep = datasets.food_prep[datasets.food_prep["date"] <= train_cutoff]
    train_item_stats = compute_item_consumption_rates(train_prep, train_meals)
    full_item_stats = compute_item_consumption_rates(datasets.food_prep, datasets.meals)

    # Build chronological backtest records (out-of-time test set only!)
    backtest_records: List[Dict[str, Any]] = []
    for i, row in df_test.iterrows():
        pred_att = float(best_test_preds[i])
        actual_att = float(row["actual_students"])
        err = pred_att - actual_att

        # Simulated item recommendations for this historical test meal using training-only consumption rates
        sim = recommend_food_preparation(
            predicted_attendance=pred_att,
            meal_type=str(row["meal_type"]),
            menu=str(row["menu"]),
            item_stats=train_item_stats,
            food_prep=train_prep,
            safety_buffer=1.05,
        )
        # Compare actual recorded kg/litre/pieces prep vs simulated recommended prep
        meal_actual_prep = datasets.food_prep[
            (datasets.food_prep["date_str"] == row["date_str"])
            & (datasets.food_prep["meal_type"] == row["meal_type"])
        ]
        actual_kg_prep = float(
            meal_actual_prep[meal_actual_prep["unit"] == "kg"]["quantity_prepared"].sum()
        )
        actual_kg_left = float(
            meal_actual_prep[meal_actual_prep["unit"] == "kg"]["quantity_leftover"].sum()
        )
        actual_kg_cons = float(
            meal_actual_prep[meal_actual_prep["unit"] == "kg"]["quantity_consumed"].sum()
        )
        sim_kg_prep = float(sim["totals_by_unit"].get("kg", {}).get("recommended_preparation", 0.0))
        sim_kg_left = max(0.0, sim_kg_prep - actual_kg_cons) if sim_kg_prep > 0 else actual_kg_left

        backtest_records.append(
            {
                "date": str(row["date_str"]),
                "day_of_week": str(row["day_of_week"]),
                "day_type": str(row["day_type"]),
                "meal_type": str(row["meal_type"]),
                "menu": str(row["menu"]),
                "expected_students": int(row["expected_students"]),
                "actual_students": int(round(actual_att)),
                "predicted_students": int(round(pred_att)),
                "rf_predicted": int(round(float(test_predictions_map["Random Forest Regressor"][i]))),
                "gb_predicted": int(round(float(test_predictions_map["Gradient Boosting Regressor"][i]))),
                "error": round(err, 1),
                "abs_error": round(abs(err), 1),
                "actual_kg_prepared": round(actual_kg_prep, 2),
                "actual_kg_leftover": round(actual_kg_left, 2),
                "simulated_kg_recommended": round(sim_kg_prep, 2),
                "simulated_kg_leftover": round(sim_kg_left, 2),
                "wastage_pct": round(float(row["avg_item_wastage_pct"]), 2),
            }
        )

    # Refit winning architecture on 100% of historical data for live future predictions
    best_estimator = candidates[best_model_name]
    production_pipe = Pipeline([("pre", _make_preprocessor()), ("reg", best_estimator)])
    production_pipe.fit(X_all[ALL_FEATURES], y_all)

    waste_analysis = compute_waste_and_shortage_analysis(datasets.joined_meals, datasets.food_prep)

    split_info = {
        "total_meals": n_total,
        "train_meals": int(split_idx),
        "test_meals": int(n_total - split_idx),
        "train_start": str(df.iloc[0]["date_str"]),
        "train_end": str(df.iloc[split_idx - 1]["date_str"]),
        "test_start": str(df.iloc[split_idx]["date_str"]),
        "test_end": str(df.iloc[-1]["date_str"]),
    }

    artifacts = TrainedArtifacts(
        datasets=datasets,
        best_model_name=best_model_name,
        best_pipeline=production_pipe,
        all_model_metrics=metrics_map,
        backtest_records=backtest_records,
        feature_importances=feature_importances,
        tracker=tracker,
        item_stats=full_item_stats,
        waste_analysis=waste_analysis,
        split_info=split_info,
    )

    if save_artifacts:
        ARTIFACTS_DIR.mkdir(parents=True, exist_ok=True)
        with open(ARTIFACTS_DIR / "model_bundle.pkl", "wb") as f:
            pickle.dump(
                {
                    "best_model_name": best_model_name,
                    "best_pipeline": production_pipe,
                    "all_model_metrics": metrics_map,
                    "feature_importances": feature_importances,
                    "tracker": tracker,
                    "item_stats": full_item_stats,
                    "split_info": split_info,
                },
                f,
            )
        with open(ARTIFACTS_DIR / "metrics.json", "w", encoding="utf-8") as f:
            json.dump(
                {
                    "selected_model": best_model_name,
                    "models": metrics_map,
                    "split": split_info,
                    "feature_importances": feature_importances,
                },
                f,
                indent=2,
            )

    return artifacts


def predict_for_meal(
    artifacts: TrainedArtifacts,
    target_date: str,
    meal_type: str,
    menu: str,
    safety_buffer: float = 1.05,
    day_type_override: str | None = None,
    is_holiday_override: bool | None = None,
    is_exam_override: bool | None = None,
    event_name_override: str | None = None,
) -> Dict[str, Any]:
    """Predict attendance, food quantities, risks, and explanations for a meal."""
    meal_clean = meal_type.strip().title()
    if meal_clean not in ("Breakfast", "Lunch", "Dinner"):
        raise ValueError("meal_type must be Breakfast, Lunch, or Dinner")

    context = resolve_calendar_context(
        target_date=target_date,
        calendar_df=artifacts.datasets.calendar,
        day_type_override=day_type_override,
        is_holiday_override=is_holiday_override,
        is_exam_override=is_exam_override,
        event_name_override=event_name_override,
    )

    jm = artifacts.datasets.joined_meals
    max_hist_date = pd.Timestamp(jm["date"].max())
    target_dt = context["date"]
    meal_order = {"Breakfast": 0, "Lunch": 1, "Dinner": 2}[meal_clean]

    # Build leakage-free causal tracker for the requested date:
    # - If target_date is inside the historical range (<= 2025-12-31), use rows strictly prior to (date, meal_order).
    # - If target_date is within 2 days of the last historical meal, use the full end-of-year tracker.
    # - If target_date is a general future date (> 2 days after last historical meal), anchor lag/rolling
    #   priors to the historical mean of that calendar regime so stale year-end winter_break doesn't skew 2026+ dates.
    if target_dt <= max_hist_date:
        prior_df = jm[
            (jm["date"] < target_dt)
            | ((jm["date"] == target_dt) & (jm["meal_order"] < meal_order))
        ]
        _, date_tracker = build_causal_feature_matrix(prior_df) if not prior_df.empty else (None, CausalHistoryTracker())
        tracker_for_pred = date_tracker
    else:
        tracker_for_pred = artifacts.tracker

    feat_row = tracker_for_pred.extract_features(
        {
            "date": target_dt,
            "meal_type": meal_clean,
            "menu": menu.strip(),
            "day_of_week": context["day_of_week"],
            "day_type": context["day_type"],
            "is_weekend": context["is_weekend"],
            "is_holiday": context["is_holiday"],
            "is_exam_period": context["is_exam_period"],
            "has_event": context["has_event"],
        }
    )

    if (target_dt - max_hist_date).days > 2:
        regime_avg = feat_row["same_day_type_avg_actual"]
        feat_row["prev_meal_actual"] = regime_avg
        feat_row["prev_day_same_meal_actual"] = regime_avg
        feat_row["rolling_7d_same_meal_avg"] = regime_avg
        feat_row["rolling_3d_overall_avg"] = regime_avg
        feat_row["recent_trend_delta"] = 0.0

    X_pred = pd.DataFrame([feat_row])[ALL_FEATURES]
    pred_raw = float(artifacts.best_pipeline.predict(X_pred)[0])
    predicted_attendance = max(0, int(round(pred_raw)))

    # If the user chose a historical 2025 date, attach recorded outcome strictly for post-prediction comparison
    hist_match = jm[(jm["date_str"] == context["date_str"]) & (jm["meal_type"] == meal_clean)]
    actual_outcome = None
    if not hist_match.empty:
        hr = hist_match.iloc[0]
        actual_outcome = {
            "expected_students": int(hr["expected_students"]),
            "actual_students": int(hr["actual_students"]),
            "recorded_menu": str(hr["menu"]),
            "avg_wastage_pct": round(float(hr["avg_item_wastage_pct"]), 1),
            "kg_prepared": round(float(hr["quantity_prepared_kg"]), 2),
            "kg_leftover": round(float(hr["quantity_leftover_kg"]), 2),
        }

    food_rec = recommend_food_preparation(
        predicted_attendance=float(predicted_attendance),
        meal_type=meal_clean,
        menu=menu.strip(),
        item_stats=artifacts.item_stats,
        food_prep=artifacts.datasets.food_prep,
        safety_buffer=safety_buffer,
    )

    explanation = build_prediction_explanation(
        predicted_attendance=float(predicted_attendance),
        context=context,
        meal_type=meal_clean,
        menu=menu.strip(),
        features=feat_row,
        joined_meals=artifacts.datasets.joined_meals,
        food_recommendations=food_rec,
        safety_buffer=safety_buffer,
    )

    # Similar historical meals for comparison
    jm = artifacts.datasets.joined_meals
    similar = jm[
        (jm["meal_type"] == meal_clean)
        & ((jm["menu"] == menu.strip()) | (jm["day_type"] == context["day_type"]))
    ].copy()
    similar["match_score"] = (
        (similar["menu"] == menu.strip()).astype(int) * 2
        + (similar["day_type"] == context["day_type"]).astype(int) * 2
        + (similar["day_of_week"] == context["day_of_week"]).astype(int)
    )
    similar = similar.sort_values(["match_score", "date"], ascending=[False, False]).head(6)
    similar_meals = [
        {
            "date": str(r["date_str"]),
            "day_of_week": str(r["day_of_week"]),
            "day_type": str(r["day_type"]),
            "menu": str(r["menu"]),
            "expected_students": int(r["expected_students"]),
            "actual_students": int(r["actual_students"]),
            "avg_wastage_pct": round(float(r["avg_item_wastage_pct"]), 1),
            "risk_level": str(r["risk_level"]),
        }
        for _, r in similar.iterrows()
    ]

    # Overall meal risk summary
    item_risks = [it["risk_level"] for it in food_rec["items"]]
    if "High" in item_risks:
        overall_risk = "High"
    elif "Medium" in item_risks or explanation["evidence_sufficiency"] == "Limited":
        overall_risk = "Medium"
    else:
        overall_risk = "Low"

    return {
        "date": context["date_str"],
        "day_of_week": context["day_of_week"],
        "meal_type": meal_clean,
        "menu": menu.strip(),
        "safety_buffer": safety_buffer,
        "model_used": artifacts.best_model_name,
        "predicted_attendance": predicted_attendance,
        "historical_meal_average": round(float(feat_row["same_meal_avg_actual"]), 1),
        "overall_risk": overall_risk,
        "items": food_rec["items"],
        "totals_by_unit": food_rec["totals_by_unit"],
        "used_fallback_menu": food_rec["used_fallback_menu"],
        "explanation": explanation,
        "similar_meals": similar_meals,
        "actual_outcome": actual_outcome,
    }
