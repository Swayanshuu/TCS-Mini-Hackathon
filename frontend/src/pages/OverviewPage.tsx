import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useState } from "react";
import { ArrowRight, Flame, ShieldAlert, TrendingDown, Users, Utensils } from "lucide-react";
import type { DashboardResponse } from "../types";
import { HalftoneSparkline } from "../components/FusionMarks";
import { CategoryBadge, CategoryTile, EmptyRingState, StatusDotText, mealToTone, riskToTone } from "../components/UiPrimitives";

export function OverviewPage({
  data,
  onNavigate,
}: {
  data: DashboardResponse;
  onNavigate: (tab: string) => void;
}) {
  const [bottomTab, setBottomTab] = useState<"predictions" | "shortages">("predictions");
  const {
    kpis,
    attendance_trend,
    monthly_food_trend,
    meal_performance,
    risk_distribution,
    recent_predictions,
    recent_shortage_alerts,
  } = data;

  const kgWastage = kpis.wastage_by_unit.kg;
  const litreWastage = kpis.wastage_by_unit.litre;
  const piecesWastage = kpis.wastage_by_unit.pieces;

  const nextKg = kpis.next_meal.totals_by_unit.kg?.recommended_preparation ?? 0;
  const nextLitre = kpis.next_meal.totals_by_unit.litre?.recommended_preparation ?? 0;
  const nextPieces = kpis.next_meal.totals_by_unit.pieces?.recommended_preparation ?? 0;

  const attendanceSpark = attendance_trend.slice(-16).map((d) => d.actual);
  const wasteSpark = attendance_trend.slice(-16).map((d) => d.wastage_pct);

  const totalRisk = (risk_distribution.Low || 0) + (risk_distribution.Medium || 0) + (risk_distribution.High || 0) || 1;
  const lowPct = Math.round(((risk_distribution.Low || 0) / totalRisk) * 100);
  const medPct = Math.round(((risk_distribution.Medium || 0) / totalRisk) * 100);
  const highPct = Math.max(0, 100 - lowPct - medPct);

  return (
    <div className="space-y-4">
      {/* Compact Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="f3-title">Overview</h1>
          <div className="f3-caption">
            {kpis.total_meals.toLocaleString()} meals · {kpis.selected_model} (R² {kpis.model_r2.toFixed(3)})
          </div>
        </div>
        <button
          type="button"
          onClick={() => onNavigate("predictor")}
          className="f3-btn f3-btn-md f3-btn-primary has-leading-icon"
        >
          <span>Predict Meal</span>
          <ArrowRight size={15} />
        </button>
      </div>

      {/* 4 Crisp KPI Cards */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <div className="f3-card flex flex-col justify-between p-3.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CategoryTile size={20} tone="blue">
                <Users size={12} />
              </CategoryTile>
              <span className="f3-label">Next Meal</span>
            </div>
            <CategoryBadge label={kpis.next_meal.meal_type} tone={mealToTone(kpis.next_meal.meal_type)} />
          </div>
          <div className="mt-2.5 flex items-baseline justify-between">
            <span className="f3-metric">{kpis.next_meal.predicted_attendance}</span>
            <span className="f3-caption">
              {kpis.next_meal.date} · {kpis.next_meal.menu}
            </span>
          </div>
          <div className="mt-2">
            <HalftoneSparkline values={attendanceSpark} color="#1871da" height={24} />
          </div>
        </div>

        <div className="f3-card flex flex-col justify-between p-3.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CategoryTile size={20} tone="orange">
                <Utensils size={12} />
              </CategoryTile>
              <span className="f3-label">Recommended Prep</span>
            </div>
            <span className="f3-caption">1.05× buffer</span>
          </div>
          <div className="mt-2.5 flex items-baseline gap-1.5">
            <span className="f3-metric">{nextKg.toFixed(1)}</span>
            <span className="text-[13px] font-medium text-[var(--ink-muted)]">kg</span>
          </div>
          <div className="mt-2 flex items-center gap-3 border-t border-[var(--line)] pt-2 text-[12px] text-[var(--ink-muted)]">
            {nextLitre > 0 && <span className="f3-mono">{nextLitre.toFixed(1)} L</span>}
            {nextPieces > 0 && <span className="f3-mono">{nextPieces} pcs</span>}
            <span className="ml-auto font-medium text-[var(--ink-strong)]">{kpis.next_meal.menu}</span>
          </div>
        </div>

        <div className="f3-card flex flex-col justify-between p-3.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CategoryTile size={20} tone="green">
                <TrendingDown size={12} />
              </CategoryTile>
              <span className="f3-label">Total Wastage</span>
            </div>
            <CategoryBadge label={`${kpis.avg_wastage_pct}% avg`} tone="yellow" />
          </div>
          <div className="mt-2.5 flex items-baseline justify-between gap-2">
            <span className="f3-metric">
              {kgWastage ? kgWastage.total_leftover.toLocaleString() : "0"}
            </span>
            <span className="f3-mono text-[12px] text-[var(--ink-muted)]">
              kg · {litreWastage?.total_leftover.toLocaleString()} L · {piecesWastage?.total_leftover.toLocaleString()} pcs
            </span>
          </div>
          <div className="mt-2">
            <HalftoneSparkline values={wasteSpark} color="#ff5500" height={24} />
          </div>
        </div>

        <div className="f3-card flex flex-col justify-between p-3.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CategoryTile size={20} tone="red">
                <ShieldAlert size={12} />
              </CategoryTile>
              <span className="f3-label">Risk & Shortages</span>
            </div>
            <button
              type="button"
              onClick={() => onNavigate("waste")}
              className="text-[12px] font-medium text-[var(--blue-text)] hover:underline"
            >
              Inspect
            </button>
          </div>
          <div className="mt-2.5 flex items-baseline justify-between">
            <span className="f3-metric">{kpis.high_risk_meals}</span>
            <span className="f3-caption">high-risk meals</span>
          </div>
          <div className="mt-2 flex items-center justify-between border-t border-[var(--line)] pt-2 text-[12px]">
            <StatusDotText label={`${kpis.shortage_alerts_count} item depletions`} tone="red" />
            <span className="f3-mono text-[var(--ink-faint)]">MAE {kpis.model_mae}</span>
          </div>
        </div>
      </div>

      {/* Main Charts Row */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        <div className="f3-card p-4 lg:col-span-6">
          <div className="mb-3 flex items-center justify-between">
            <div className="f3-subheading">Attendance Trend (45 Days)</div>
            <div className="flex items-center gap-3">
              <StatusDotText label="Actual" tone="blue" />
              <StatusDotText label="Expected" tone="yellow" />
            </div>
          </div>
          <div className="h-60 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={attendance_trend} margin={{ top: 4, right: 8, left: -18, bottom: 0 }}>
                <CartesianGrid stroke="var(--line)" strokeDasharray="3 3" vertical={false} />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 11, fill: "var(--ink-faint)" }}
                  tickFormatter={(v) => String(v).slice(5)}
                  minTickGap={24}
                />
                <YAxis tick={{ fontSize: 11, fill: "var(--ink-faint)" }} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "var(--surface-paper)",
                    borderColor: "var(--line)",
                    borderRadius: 8,
                    fontSize: 12,
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="expected"
                  name="Expected"
                  stroke="#ffbb38"
                  strokeWidth={1.75}
                  fill="#ffbb38"
                  fillOpacity={0.08}
                />
                <Area
                  type="monotone"
                  dataKey="actual"
                  name="Actual"
                  stroke="#1871da"
                  strokeWidth={2}
                  fill="#1871da"
                  fillOpacity={0.12}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="f3-card p-4 lg:col-span-6">
          <div className="mb-3 flex items-center justify-between">
            <div className="f3-subheading">Preparation vs Consumption (kg)</div>
            <div className="flex items-center gap-3">
              <StatusDotText label="Prepared" tone="blue" />
              <StatusDotText label="Consumed" tone="green" />
              <StatusDotText label="Leftover" tone="red" />
            </div>
          </div>
          <div className="h-60 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthly_food_trend} margin={{ top: 4, right: 8, left: -14, bottom: 0 }}>
                <CartesianGrid stroke="var(--line)" strokeDasharray="3 3" vertical={false} />
                <XAxis
                  dataKey="month"
                  tick={{ fontSize: 11, fill: "var(--ink-faint)" }}
                  tickFormatter={(v) => String(v).slice(5)}
                />
                <YAxis tick={{ fontSize: 11, fill: "var(--ink-faint)" }} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "var(--surface-paper)",
                    borderColor: "var(--line)",
                    borderRadius: 8,
                    fontSize: 12,
                  }}
                />
                <Bar dataKey="kg_prepared" name="Prepared (kg)" fill="#1871da" radius={[2, 2, 0, 0]} />
                <Bar dataKey="kg_consumed" name="Consumed (kg)" fill="#1ec072" radius={[2, 2, 0, 0]} />
                <Bar dataKey="kg_leftover" name="Leftover (kg)" fill="#ff5500" radius={[2, 2, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Bottom Data Row: Meal Breakdown + Risk Bar | Tabbed Predictions & Shortages */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        <div className="f3-card flex flex-col justify-between p-4 lg:col-span-5">
          <div>
            <div className="mb-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CategoryTile size={20} tone="violet">
                  <Flame size={12} />
                </CategoryTile>
                <span className="f3-subheading">Meal Performance</span>
              </div>
              <span className="f3-caption">2025 averages</span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-[13px]">
                <thead>
                  <tr className="border-b border-[var(--line)]">
                    <th className="f3-label pb-2">Meal</th>
                    <th className="f3-label pb-2 text-right">Actual</th>
                    <th className="f3-label pb-2 text-right">Waste</th>
                    <th className="f3-label pb-2 text-right">Short</th>
                  </tr>
                </thead>
                <tbody>
                  {meal_performance.map((m) => (
                    <tr key={m.meal_type} className="border-b border-[var(--line)] last:border-0">
                      <td className="py-2">
                        <CategoryBadge label={m.meal_type} tone={mealToTone(m.meal_type)} />
                      </td>
                      <td className="f3-mono py-2 text-right font-semibold">{m.avg_actual}</td>
                      <td className="f3-mono py-2 text-right">{m.avg_wastage_pct}%</td>
                      <td className="f3-mono py-2 text-right text-[var(--ink-muted)]">
                        {m.shortage_events}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="mt-4 border-t border-[var(--line)] pt-3">
            <div className="mb-1.5 flex items-center justify-between text-[12px]">
              <span className="f3-label">Risk Split ({kpis.total_meals} meals)</span>
              <span className="f3-mono text-[var(--ink-muted)]">
                Low {lowPct}% · Med {medPct}% · High {highPct}%
              </span>
            </div>
            <div className="flex h-2 w-full overflow-hidden rounded-full bg-[var(--surface-sunken)]">
              <div style={{ width: `${lowPct}%`, backgroundColor: "#1ec072" }} />
              <div style={{ width: `${medPct}%`, backgroundColor: "#ffbb38" }} />
              <div style={{ width: `${highPct}%`, backgroundColor: "#dc2626" }} />
            </div>
          </div>
        </div>

        <div className="f3-card p-4 lg:col-span-7">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div className="inline-flex rounded-[8px] border border-[var(--line)] bg-[var(--surface-canvas)] p-0.5">
              <button
                type="button"
                onClick={() => setBottomTab("predictions")}
                className={`h-[26px] rounded-[6px] px-3 text-[13px] font-medium ${
                  bottomTab === "predictions"
                    ? "border border-[var(--line)] bg-[var(--surface-paper)] text-[var(--ink-strong)]"
                    : "text-[var(--ink-muted)]"
                }`}
              >
                Recent Predictions ({recent_predictions.length})
              </button>
              <button
                type="button"
                onClick={() => setBottomTab("shortages")}
                className={`h-[26px] rounded-[6px] px-3 text-[13px] font-medium ${
                  bottomTab === "shortages"
                    ? "border border-[var(--line)] bg-[var(--surface-paper)] text-[var(--ink-strong)]"
                    : "text-[var(--ink-muted)]"
                }`}
              >
                Shortage Alerts ({recent_shortage_alerts.length})
              </button>
            </div>
            <button
              type="button"
              onClick={() => onNavigate(bottomTab === "predictions" ? "predictor" : "waste")}
              className="f3-btn f3-btn-sm f3-btn-outline"
            >
              Open Full View
            </button>
          </div>

          {bottomTab === "predictions" ? (
            recent_predictions.length === 0 ? (
              <EmptyRingState
                title="No predictions logged yet"
                subtitle="Run a forecast in Meal Predictor to see saved results here."
              />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-[13px]">
                  <thead>
                    <tr className="border-b border-[var(--line)]">
                      <th className="f3-label pb-2">Date</th>
                      <th className="f3-label pb-2">Meal</th>
                      <th className="f3-label pb-2">Menu</th>
                      <th className="f3-label pb-2 text-right">Students</th>
                      <th className="f3-label pb-2 text-right">Prep (kg)</th>
                      <th className="f3-label pb-2 text-right">Risk</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recent_predictions.slice(0, 6).map((p, idx) => (
                      <tr
                        key={p.id}
                        className={`border-b border-[var(--line)] last:border-0 ${idx === 0 ? "f3-arrival-wash" : ""}`}
                      >
                        <td className="f3-mono py-2 text-[12px]">{p.date}</td>
                        <td className="py-2">
                          <CategoryBadge label={p.meal_type} tone={mealToTone(p.meal_type)} />
                        </td>
                        <td className="py-2 font-medium text-[var(--ink-strong)]">{p.menu}</td>
                        <td className="f3-mono py-2 text-right font-semibold">{p.predicted_attendance}</td>
                        <td className="f3-mono py-2 text-right text-[var(--ink-muted)]">
                          {p.totals_by_unit?.kg?.recommended_preparation ?? 0}
                        </td>
                        <td className="py-2 text-right">
                          <CategoryBadge label={p.overall_risk} tone={riskToTone(p.overall_risk)} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-[13px]">
                <thead>
                  <tr className="border-b border-[var(--line)]">
                    <th className="f3-label pb-2">Date</th>
                    <th className="f3-label pb-2">Item</th>
                    <th className="f3-label pb-2 text-right">Prepared</th>
                    <th className="f3-label pb-2 text-right">Turnout</th>
                    <th className="f3-label pb-2 text-right">Risk</th>
                  </tr>
                </thead>
                <tbody>
                  {recent_shortage_alerts.map((al, i) => (
                    <tr key={`${al.date}-${al.food_item}-${i}`} className="border-b border-[var(--line)] last:border-0">
                      <td className="f3-mono py-2 text-[12px]">{al.date}</td>
                      <td className="py-2">
                        <span className="font-medium text-[var(--ink-strong)]">{al.food_item}</span>{" "}
                        <span className="text-[11px] text-[var(--ink-faint)]">({al.meal_type})</span>
                      </td>
                      <td className="f3-mono py-2 text-right">
                        {al.quantity_prepared} {al.unit}
                      </td>
                      <td className="f3-mono py-2 text-right">
                        {al.actual_students}/{al.expected_students}
                      </td>
                      <td className="py-2 text-right">
                        <CategoryBadge label={al.risk_level} tone={riskToTone(al.risk_level)} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
