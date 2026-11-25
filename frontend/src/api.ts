import type {
  DashboardResponse,
  DatasetResponse,
  EvaluationResponse,
  FoodAnalyticsResponse,
  MetadataResponse,
  PredictionResponse,
  WasteAnalyticsResponse,
} from "./types";

const API_BASE = "";

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${url}`, init);
  if (!res.ok) {
    let detail = `Request failed (${res.status})`;
    try {
      const body = await res.json();
      if (body?.detail) detail = String(body.detail);
    } catch {
      // ignore json parse errors
    }
    throw new Error(detail);
  }
  return res.json() as Promise<T>;
}

export const api = {
  getMetadata: () => fetchJson<MetadataResponse>("/api/metadata"),
  getDashboard: () => fetchJson<DashboardResponse>("/api/dashboard"),
  predictMeal: (payload: {
    date: string;
    meal_type: string;
    menu: string;
    safety_buffer: number;
    day_type?: string | null;
    is_holiday?: boolean | null;
    is_exam_period?: boolean | null;
    event_name?: string | null;
    save_to_history?: boolean;
  }) =>
    fetchJson<PredictionResponse>("/api/predict", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }),
  getFoodAnalytics: (mealType?: string) => {
    const q = mealType && mealType !== "All" ? `?meal_type=${encodeURIComponent(mealType)}` : "";
    return fetchJson<FoodAnalyticsResponse>(`/api/analytics/food${q}`);
  },
  getWasteAnalytics: () => fetchJson<WasteAnalyticsResponse>("/api/analytics/waste"),
  getEvaluation: () => fetchJson<EvaluationResponse>("/api/evaluation"),
  getDataset: (
    name: string,
    params: {
      search?: string;
      date_from?: string;
      date_to?: string;
      meal_type?: string;
      sort_by?: string;
      sort_dir?: "asc" | "desc";
      page?: number;
      page_size?: number;
    }
  ) => {
    const sp = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== "") sp.set(k, String(v));
    });
    return fetchJson<DatasetResponse>(`/api/datasets/${name}?${sp.toString()}`);
  },
  getExportUrl: (
    name: string,
    params: {
      search?: string;
      date_from?: string;
      date_to?: string;
      meal_type?: string;
    }
  ) => {
    const sp = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== "") sp.set(k, String(v));
    });
    return `/api/datasets/${name}/export?${sp.toString()}`;
  },
};
