export type RiskLevel = "Low" | "Medium" | "High";

export type MealType = "Breakfast" | "Lunch" | "Dinner";

export interface UnitTotals {
  predicted_consumption: number;
  recommended_preparation: number;
  historical_avg_preparation: number;
  expected_leftover: number;
  potential_savings: number;
}

export interface WastageUnitSummary {
  total_prepared: number;
  total_consumed: number;
  total_leftover: number;
  wastage_pct: number;
}

export interface MetadataResponse {
  meal_types: MealType[];
  menus_by_meal: Record<MealType, string[]>;
  all_menus: string[];
  day_types: string[];
  events: string[];
  date_min: string;
  date_max: string;
  default_next_date: string;
  selected_model: string;
  data_quality: {
    calendar_rows: number;
    meals_rows: number;
    food_prep_rows: number;
    date_min: string;
    date_max: string;
    zero_leftover_records: number;
    units_present: string[];
  };
}

export interface DashboardResponse {
  kpis: {
    next_meal: {
      date: string;
      meal_type: MealType;
      menu: string;
      predicted_attendance: number;
      totals_by_unit: Record<string, UnitTotals>;
      overall_risk: RiskLevel;
    };
    wastage_by_unit: Record<string, WastageUnitSummary>;
    avg_wastage_pct: number;
    high_risk_meals: number;
    total_meals: number;
    shortage_alerts_count: number;
    shortage_meals_count: number;
    model_r2: number;
    model_mae: number;
    selected_model: string;
  };
  attendance_trend: Array<{
    date: string;
    expected: number;
    actual: number;
    wastage_pct: number;
    day_type: string;
  }>;
  monthly_food_trend: Array<{
    month: string;
    kg_prepared: number;
    kg_consumed: number;
    kg_leftover: number;
    avg_wastage_pct: number;
    avg_actual: number;
  }>;
  meal_performance: Array<{
    meal_type: MealType;
    meals_count: number;
    avg_expected: number;
    avg_actual: number;
    avg_wastage_pct: number;
    high_risk_meals: number;
    shortage_events: number;
  }>;
  risk_distribution: Record<RiskLevel, number>;
  recent_predictions: Array<{
    id: number;
    created_at: string;
    date: string;
    meal_type: MealType;
    menu: string;
    predicted_attendance: number;
    safety_buffer: number;
    overall_risk: RiskLevel;
    model_used: string;
    totals_by_unit: Record<string, UnitTotals>;
  }>;
  recent_shortage_alerts: ShortageAlert[];
}

export interface FoodItemRecommendation {
  food_item: string;
  unit: string;
  historical_samples: number;
  avg_consumed_per_student: number;
  predicted_consumption: number;
  recommended_preparation: number;
  historical_avg_preparation: number;
  expected_leftover: number;
  historical_avg_leftover: number;
  potential_savings: number;
  leftover_reduction: number;
  historical_wastage_pct: number;
  historical_shortage_rate_pct: number;
  risk_level: RiskLevel;
  risk_reason: string;
}

export interface PredictionResponse {
  prediction_id?: number;
  date: string;
  day_of_week: string;
  meal_type: MealType;
  menu: string;
  safety_buffer: number;
  model_used: string;
  predicted_attendance: number;
  historical_meal_average: number;
  overall_risk: RiskLevel;
  items: FoodItemRecommendation[];
  totals_by_unit: Record<string, UnitTotals>;
  used_fallback_menu: boolean;
  explanation: {
    summary: string;
    factors: Array<{
      factor: string;
      value: string;
      impact: number;
      detail: string;
    }>;
    sparse_evidence_warnings: string[];
    evidence_sufficiency: "Sufficient" | "Limited";
    risk_notes: string[];
    calendar_flags: {
      day_of_week: string;
      day_type: string;
      is_weekend: boolean;
      is_holiday: boolean;
      is_exam_period: boolean;
      event_name: string | null;
    };
  };
  similar_meals: Array<{
    date: string;
    day_of_week: string;
    day_type: string;
    menu: string;
    expected_students: number;
    actual_students: number;
    avg_wastage_pct: number;
    risk_level: RiskLevel;
  }>;
  actual_outcome?: {
    expected_students: number;
    actual_students: number;
    recorded_menu: string;
    avg_wastage_pct: number;
    kg_prepared: number;
    kg_leftover: number;
  } | null;
}

export interface FoodAnalyticsResponse {
  items: Array<{
    food_item: string;
    unit: string;
    meals: number;
    avg_prepared: number;
    avg_consumed: number;
    avg_leftover: number;
    total_prepared: number;
    total_consumed: number;
    total_leftover: number;
    avg_wastage_pct: number;
    shortage_events: number;
  }>;
  menus: Array<{
    meal_type: MealType;
    menu: string;
    meals: number;
    avg_expected: number;
    avg_actual: number;
    attendance_lift: number;
    avg_wastage_pct: number;
    shortage_meals: number;
  }>;
  weekday_attendance: Array<{
    day_of_week: string;
    Breakfast: number;
    Lunch: number;
    Dinner: number;
  }>;
}

export interface ShortageAlert {
  date: string;
  meal_type: MealType;
  menu: string;
  food_item: string;
  unit: string;
  quantity_prepared: number;
  expected_students: number;
  actual_students: number;
  attendance_surge: number;
  day_type: string;
  risk_level: RiskLevel;
  reason: string;
}

export interface WasteAnalyticsResponse {
  items: Array<{
    food_item: string;
    unit: string;
    occurrences: number;
    total_prepared: number;
    total_consumed: number;
    total_leftover: number;
    overall_wastage_pct: number;
    max_wastage_pct: number;
    shortage_events: number;
    shortage_rate_pct: number;
    high_waste_events: number;
    risk_level: RiskLevel;
    reason: string;
  }>;
  menus: Array<{
    meal_type: MealType;
    menu: string;
    meal_count: number;
    avg_expected: number;
    avg_actual: number;
    attendance_gap: number;
    avg_wastage_pct: number;
    shortage_events: number;
    high_risk_meals: number;
    risk_level: RiskLevel;
    reason: string;
  }>;
  shortage_alerts: ShortageAlert[];
  unusual_days: Array<{
    date: string;
    day_of_week: string;
    day_type: string;
    event_name: string;
    total_expected: number;
    total_actual: number;
    gap: number;
    z_score: number;
    avg_wastage_pct: number;
    risk_level: RiskLevel;
    reason: string;
  }>;
  calendar_impacts: Array<{
    day_type: string;
    meal_count: number;
    avg_expected: number;
    avg_actual: number;
    vs_regular_pct: number;
    avg_wastage_pct: number;
    shortage_meals: number;
    evidence_status: "Sufficient" | "Limited";
  }>;
  risk_distribution: Record<RiskLevel, number>;
}

export interface EvaluationResponse {
  selected_model: string;
  split: {
    total_meals: number;
    train_meals: number;
    test_meals: number;
    train_start: string;
    train_end: string;
    test_start: string;
    test_end: string;
  };
  models: Record<
    string,
    {
      mae: number;
      rmse: number;
      r2: number;
      mape: number;
    }
  >;
  feature_importances: Array<{
    feature: string;
    importance: number;
  }>;
  backtest_summary: {
    test_meals_evaluated: number;
    actual_kg_prepared: number;
    actual_kg_leftover: number;
    simulated_kg_recommended: number;
    simulated_kg_leftover: number;
    estimated_wastage_reduction_kg: number;
    estimated_wastage_reduction_pct: number;
    note: string;
  };
  backtest_records: Array<{
    date: string;
    day_of_week: string;
    day_type: string;
    meal_type: MealType;
    menu: string;
    expected_students: number;
    actual_students: number;
    predicted_students: number;
    rf_predicted: number;
    gb_predicted: number;
    error: number;
    abs_error: number;
    actual_kg_prepared: number;
    actual_kg_leftover: number;
    simulated_kg_recommended: number;
    simulated_kg_leftover: number;
    wastage_pct: number;
  }>;
}

export interface DatasetResponse {
  dataset: string;
  columns: string[];
  rows: Array<Record<string, unknown>>;
  pagination: {
    page: number;
    page_size: number;
    total_rows: number;
    total_pages: number;
  };
  stats: Record<string, unknown>;
}

export interface ChatTrace {
  tool: string;
  detail: string;
  ms: number;
}

export interface ChatCard {
  type: "metrics" | "table";
  title: string;
  items?: Array<{ label: string; value: string }>;
  headers?: string[];
  rows?: Array<{
    col1: string;
    col2: string;
    col3: string;
    col4: string;
    risk: RiskLevel;
  }>;
}

export interface ChatResponse {
  intent: string;
  reply: string;
  traces: ChatTrace[];
  cards: ChatCard[];
  suggestions: string[];
}
