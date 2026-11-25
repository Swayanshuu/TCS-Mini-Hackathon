"""CLI script to train, evaluate, and persist the ML pipeline."""

from __future__ import annotations

import json
import sys
from pathlib import Path

ROOT_DIR = Path(__file__).resolve().parent.parent
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

from ml.pipeline import train_and_evaluate


def main() -> None:
    artifacts = train_and_evaluate(save_artifacts=True)
    summary = {
        "selected_model": artifacts.best_model_name,
        "split": artifacts.split_info,
        "models": artifacts.all_model_metrics,
        "top_features": artifacts.feature_importances[:6],
        "data_quality": artifacts.datasets.data_quality_report,
    }
    print(json.dumps(summary, indent=2))


if __name__ == "__main__":
    main()
