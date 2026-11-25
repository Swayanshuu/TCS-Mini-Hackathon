import { useEffect, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { api } from "../api";
import type { WasteAnalyticsResponse } from "../types";
import { CategoryBadge, ErrorNotice, LoadingSkeleton, mealToTone, riskToTone } from "../components/UiPrimitives";

export function WasteAnalysisPage() {
  const [data, setData] = useState<WasteAnalyticsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<"items" | "menus" | "shortages" | "unusual">("items");

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      setData(await api.getWasteAnalytics());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load waste analytics");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  if (loading && !data) return <LoadingSkeleton rows={6} />;
  if (error) return <ErrorNotice message={error} onRetry={load} />;
  if (!data) return null;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="f3-title">Waste & Shortage Analysis</h1>
          <div className="f3-caption">
            Over-preparation, zero-leftover shortages, unusual days, and calendar regimes
          </div>
        </div>
        <div className="flex items-center gap-2">
          <CategoryBadge label={`High ${data.risk_distribution.High}`} tone="red" />
          <CategoryBadge label={`Med ${data.risk_distribution.Medium}`} tone="yellow" />
          <CategoryBadge label={`Low ${data.risk_distribution.Low}`} tone="green" />
        </div>
      </div>

      {/* Calendar Intelligence Row */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        <div className="f3-card p-4 lg:col-span-6">
          <div className="mb-3 f3-subheading">Attendance by Calendar Regime</div>
          <div className="h-56 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.calendar_impacts} margin={{ top: 4, right: 8, left: -14, bottom: 14 }}>
                <CartesianGrid stroke="var(--line)" strokeDasharray="3 3" vertical={false} />
                <XAxis
                  dataKey="day_type"
                  tick={{ fontSize: 11, fill: "var(--ink-faint)" }}
                  tickFormatter={(v) => String(v).replace("_", " ")}
                  angle={-15}
                  textAnchor="end"
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
                <Bar dataKey="avg_actual" name="Actual" fill="#1871da" radius={[2, 2, 0, 0]} />
                <Bar dataKey="avg_expected" name="Expected" fill="#ffbb38" radius={[2, 2, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="f3-card p-4 lg:col-span-6">
          <div className="mb-3 f3-subheading">Calendar Regime Impact</div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-[13px]">
              <thead>
                <tr className="border-b border-[var(--line)]">
                  <th className="f3-label pb-2">Regime</th>
                  <th className="f3-label pb-2 text-right">Meals</th>
                  <th className="f3-label pb-2 text-right">Avg Actual</th>
                  <th className="f3-label pb-2 text-right">vs Regular</th>
                  <th className="f3-label pb-2 text-right">Evidence</th>
                </tr>
              </thead>
              <tbody>
                {data.calendar_impacts.map((c) => (
                  <tr key={c.day_type} className="border-b border-[var(--line)] last:border-0">
                    <td className="py-1.5 font-medium capitalize text-[var(--ink-strong)]">
                      {c.day_type.replace("_", " ")}
                    </td>
                    <td className="f3-mono py-1.5 text-right">{c.meal_count}</td>
                    <td className="f3-mono py-1.5 text-right font-semibold">{c.avg_actual}</td>
                    <td
                      className="f3-mono py-1.5 text-right"
                      style={{ color: c.vs_regular_pct >= 0 ? "var(--green-text)" : "var(--red-text)" }}
                    >
                      {c.vs_regular_pct >= 0 ? `+${c.vs_regular_pct}%` : `${c.vs_regular_pct}%`}
                    </td>
                    <td className="py-1.5 text-right">
                      <CategoryBadge
                        label={c.evidence_status}
                        tone={c.evidence_status === "Limited" ? "yellow" : "green"}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Tabbed Detection Table */}
      <div className="f3-card p-4">
        <div className="mb-3 flex flex-wrap gap-5 border-b border-[var(--line)] pb-2.5">
          {[
            { id: "items", label: "Items", count: data.items.length },
            { id: "menus", label: "Menus", count: data.menus.length },
            { id: "shortages", label: "Shortages", count: data.shortage_alerts.length },
            { id: "unusual", label: "Unusual Days", count: data.unusual_days.length },
          ].map((t) => {
            const active = tab === t.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id as typeof tab)}
                className={`relative flex items-center gap-1.5 text-[14px] font-medium ${
                  active ? "text-[var(--ink-strong)]" : "text-[var(--ink-muted)] hover:text-[var(--ink-strong)]"
                }`}
              >
                <span>{t.label}</span>
                <span className="f3-count">{t.count}</span>
                {active && (
                  <span className="absolute -bottom-[11px] left-0 right-0 h-[2px] bg-[var(--ink-strong)]" />
                )}
              </button>
            );
          })}
        </div>

        {tab === "items" && (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-[13px]">
              <thead>
                <tr className="border-b border-[var(--line)]">
                  <th className="f3-label pb-2">Item</th>
                  <th className="f3-label pb-2 text-right">Total Leftover</th>
                  <th className="f3-label pb-2 text-right">Waste %</th>
                  <th className="f3-label pb-2 text-right">Shortage %</th>
                  <th className="f3-label pb-2 text-right">Risk</th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((it) => (
                  <tr
                    key={`${it.food_item}-${it.unit}`}
                    title={it.reason}
                    className="border-b border-[var(--line)] last:border-0"
                  >
                    <td className="py-2 font-semibold text-[var(--ink-strong)]">
                      {it.food_item}{" "}
                      <span className="text-[11px] font-normal text-[var(--ink-faint)]">({it.unit})</span>
                    </td>
                    <td className="f3-mono py-2 text-right">
                      {it.total_leftover.toLocaleString()} {it.unit}
                    </td>
                    <td className="f3-mono py-2 text-right font-semibold">{it.overall_wastage_pct}%</td>
                    <td className="f3-mono py-2 text-right">{it.shortage_rate_pct}%</td>
                    <td className="py-2 text-right">
                      <CategoryBadge label={it.risk_level} tone={riskToTone(it.risk_level)} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {tab === "menus" && (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-[13px]">
              <thead>
                <tr className="border-b border-[var(--line)]">
                  <th className="f3-label pb-2">Menu</th>
                  <th className="f3-label pb-2">Meal</th>
                  <th className="f3-label pb-2 text-right">Avg Waste %</th>
                  <th className="f3-label pb-2 text-right">Turnout Gap</th>
                  <th className="f3-label pb-2 text-right">High-Risk</th>
                  <th className="f3-label pb-2 text-right">Risk</th>
                </tr>
              </thead>
              <tbody>
                {data.menus.map((m) => (
                  <tr key={`${m.meal_type}-${m.menu}`} className="border-b border-[var(--line)] last:border-0">
                    <td className="py-2 font-semibold text-[var(--ink-strong)]">{m.menu}</td>
                    <td className="py-2">
                      <CategoryBadge label={m.meal_type} tone={mealToTone(m.meal_type)} />
                    </td>
                    <td className="f3-mono py-2 text-right font-semibold">{m.avg_wastage_pct}%</td>
                    <td className="f3-mono py-2 text-right">
                      {m.attendance_gap >= 0 ? `+${m.attendance_gap}` : m.attendance_gap}
                    </td>
                    <td className="f3-mono py-2 text-right">{m.high_risk_meals}</td>
                    <td className="py-2 text-right">
                      <CategoryBadge label={m.risk_level} tone={riskToTone(m.risk_level)} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {tab === "shortages" && (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-[13px]">
              <thead>
                <tr className="border-b border-[var(--line)]">
                  <th className="f3-label pb-2">Date</th>
                  <th className="f3-label pb-2">Item</th>
                  <th className="f3-label pb-2">Meal</th>
                  <th className="f3-label pb-2 text-right">Prepared</th>
                  <th className="f3-label pb-2 text-right">Actual / Exp</th>
                  <th className="f3-label pb-2 text-right">Risk</th>
                </tr>
              </thead>
              <tbody>
                {data.shortage_alerts.map((s, idx) => (
                  <tr key={`${s.date}-${s.food_item}-${idx}`} className="border-b border-[var(--line)] last:border-0">
                    <td className="f3-mono py-2 text-[12px]">{s.date}</td>
                    <td className="py-2 font-semibold text-[var(--ink-strong)]">{s.food_item}</td>
                    <td className="py-2">
                      <CategoryBadge label={s.meal_type} tone={mealToTone(s.meal_type)} />
                    </td>
                    <td className="f3-mono py-2 text-right">
                      {s.quantity_prepared} {s.unit}
                    </td>
                    <td className="f3-mono py-2 text-right">
                      {s.actual_students} / {s.expected_students}
                    </td>
                    <td className="py-2 text-right">
                      <CategoryBadge label={s.risk_level} tone={riskToTone(s.risk_level)} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {tab === "unusual" && (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-[13px]">
              <thead>
                <tr className="border-b border-[var(--line)]">
                  <th className="f3-label pb-2">Date</th>
                  <th className="f3-label pb-2">Regime</th>
                  <th className="f3-label pb-2 text-right">Actual / Exp</th>
                  <th className="f3-label pb-2 text-right">Gap</th>
                  <th className="f3-label pb-2 text-right">Z-Score</th>
                  <th className="f3-label pb-2 text-right">Risk</th>
                </tr>
              </thead>
              <tbody>
                {data.unusual_days.map((d) => (
                  <tr key={d.date} className="border-b border-[var(--line)] last:border-0">
                    <td className="f3-mono py-2 text-[12px]">
                      {d.date} ({d.day_of_week.slice(0, 3)})
                    </td>
                    <td className="py-2 capitalize">{d.day_type.replace("_", " ")}</td>
                    <td className="f3-mono py-2 text-right">
                      {d.total_actual} / {d.total_expected}
                    </td>
                    <td className="f3-mono py-2 text-right font-semibold">
                      {d.gap >= 0 ? `+${d.gap}` : d.gap}
                    </td>
                    <td className="f3-mono py-2 text-right">{d.z_score}</td>
                    <td className="py-2 text-right">
                      <CategoryBadge label={d.risk_level} tone={riskToTone(d.risk_level)} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
