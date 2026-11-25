"""Pydantic request and response schemas for FastAPI."""

from __future__ import annotations

from typing import Optional

from pydantic import BaseModel, Field, field_validator


class PredictionRequest(BaseModel):
    date: str = Field(..., description="Target date in YYYY-MM-DD format")
    meal_type: str = Field(..., description="Breakfast, Lunch, or Dinner")
    menu: str = Field(..., min_length=1, max_length=120)
    safety_buffer: float = Field(default=1.05, ge=0.90, le=1.50)
    day_type: Optional[str] = None
    is_holiday: Optional[bool] = None
    is_exam_period: Optional[bool] = None
    event_name: Optional[str] = None
    save_to_history: bool = True

    @field_validator("meal_type")
    @classmethod
    def validate_meal_type(cls, v: str) -> str:
        clean = v.strip().title()
        if clean not in ("Breakfast", "Lunch", "Dinner"):
            raise ValueError("meal_type must be one of: Breakfast, Lunch, Dinner")
        return clean


class ChatRequest(BaseModel):
    message: str = Field(..., min_length=1, max_length=600)
    context: Optional[dict] = None
