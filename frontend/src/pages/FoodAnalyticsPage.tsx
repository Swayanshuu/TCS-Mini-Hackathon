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
import type { FoodAnalyticsResponse } from "../types";
import { CategoryBadge, ErrorNotice, LoadingSkeleton, mealToTone } from "../components/UiPrimitives";

export function FoodAnalyticsPage() {
  const [mealFilter, setMealFilter] = useState<string>("All");
  const [tableTab, setTableTab] = useState<"items" | "menus">("items");
  const [data, setData] = useState<FoodAnalyticsResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const load = async (filter: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.getFoodAnalytics(filter);
      setData(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load food analytics");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load(mealFilter);
  }, [mealFilter]);

  if (loading && !data) return <LoadingSkeleton rows={6} />;
  if (error) return <ErrorNotice message={error} onRetry={() => load(mealFilter)} />;
  if (!data) return null;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="f3-title">Food Analytics</h1>
          <div className="f3-caption">
            {data.items.length} food items · {data.menus.length} menus
          </div>
        </div>
        <div className="inline-flex rounded-[8px] border border-[var(--line)] bg-[var(--surface-canvas)] p-0.5">
          {["All", "Breakfast", "Lunch", "Dinner"].map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMealFilter(m)}
              className={`h-[26px] rounded-[6px] px-3 text-[13px] font-medium ${
                mealFilter === m
                  ? "border border-[var(--line)] bg-[var(--surface-paper)] text-[var(--ink-strong)]"
                  : "text-[var(--ink-muted)] hover:text-[var(--ink-strong)]"
              }`}
            >
              {m}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="f3-card p-4">
          <div className="mb-3 f3-subheading">Weekday Turnout by Meal</div>
          <div className="h-60 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.weekday_attendance} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
                <CartesianGrid stroke="var(--line)" strokeDasharray="3 3" vertical={false} />
                <XAxis
                  dataKey="day_of_week"
                  tick={{ fontSize: 11, fill: "var(--ink-faint)" }}
                  tickFormatter={(v) => String(v).slice(0, 3)}
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
                <Bar dataKey="Breakfast" fill="#9664d7" radius={[2, 2, 0, 0]} />
                <Bar dataKey="Lunch" fill="#ff5500" radius={[2, 2, 0, 0]} />
                <Bar dataKey="Dinner" fill="#f6609f" radius={[2, 2, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="f3-card p-4">
          <div className="mb-3 f3-subheading">Menu Turnout Lift (Actual − Expected)</div>
          <div className="h-60 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.menus} layout="vertical" margin={{ top: 4, right: 16, left: 28, bottom: 0 }}>
                <CartesianGrid stroke="var(--line)" strokeDasharray="3 3" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 11, fill: "var(--ink-faint)" }} />
                <YAxis type="category" dataKey="menu" width={92} tick={{ fontSize: 11, fill: "var(--ink-body)" }} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "var(--surface-paper)",
                    borderColor: "var(--line)",
                    borderRadius: 8,
                    fontSize: 12,
                  }}
                />
                <Bar dataKey="attendance_lift" name="Lift" fill="#1871da" radius={[0, 2, 2, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="f3-card p-4">
        <div className="mb-3 flex items-center justify-between border-b border-[var(--line)] pb-2.5">
          <div className="flex gap-5">
            <button
              type="button"
              onClick={() => setTableTab("items")}
              className={`relative flex items-center gap-1.5 text-[14px] font-medium ${
                tableTab === "items" ? "text-[var(--ink-strong)]" : "text-[var(--ink-muted)]"
              }`}
            >
              <span>Food Items</span>
              <span className="f3-count">{data.items.length}</span>
              {tableTab === "items" && (
                <span className="absolute -bottom-[11px] left-0 right-0 h-[2px] bg-[var(--ink-strong)]" />
              )}
            </button>
            <button
              type="button"
              onClick={() => setTableTab("menus")}
              className={`relative flex items-center gap-1.5 text-[14px] font-medium ${
                tableTab === "menus" ? "text-[var(--ink-strong)]" : "text-[var(--ink-muted)]"
              }`}
            >
              <span>Menus</span>
              <span className="f3-count">{data.menus.length}</span>
              {tableTab === "menus" && (
                <span className="absolute -bottom-[11px] left-0 right-0 h-[2px] bg-[var(--ink-strong)]" />
              )}
            </button>
          </div>
        </div>

        {tableTab === "items" ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-[13px]">
              <thead>
                <tr className="border-b border-[var(--line)]">
                  <th className="f3-label pb-2">Item</th>
                  <th className="f3-label pb-2">Unit</th>
                  <th className="f3-label pb-2 text-right">Prepared</th>
                  <th className="f3-label pb-2 text-right">Consumed</th>
                  <th className="f3-label pb-2 text-right">Leftover</th>
                  <th className="f3-label pb-2 text-right">Waste %</th>
                  <th className="f3-label pb-2 text-right">0-Leftover</th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((it) => (
                  <tr key={`${it.food_item}-${it.unit}`} className="border-b border-[var(--line)] last:border-0">
                    <td className="py-2 font-semibold text-[var(--ink-strong)]">{it.food_item}</td>
                    <td className="py-2">
                      <CategoryBadge label={it.unit} tone="blue" />
                    </td>
                    <td className="f3-mono py-2 text-right">{it.avg_prepared}</td>
                    <td className="f3-mono py-2 text-right">{it.avg_consumed}</td>
                    <td className="f3-mono py-2 text-right text-[var(--ink-muted)]">{it.avg_leftover}</td>
                    <td className="py-2 text-right">
                      <CategoryBadge
                        label={`${it.avg_wastage_pct}%`}
                        tone={it.avg_wastage_pct >= 10 ? "red" : it.avg_wastage_pct >= 6.5 ? "yellow" : "green"}
                      />
                    </td>
                    <td className="f3-mono py-2 text-right">{it.shortage_events}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-[13px]">
              <thead>
                <tr className="border-b border-[var(--line)]">
                  <th className="f3-label pb-2">Menu</th>
                  <th className="f3-label pb-2">Meal</th>
                  <th className="f3-label pb-2 text-right">Expected</th>
                  <th className="f3-label pb-2 text-right">Actual</th>
                  <th className="f3-label pb-2 text-right">Lift</th>
                  <th className="f3-label pb-2 text-right">Waste %</th>
                </tr>
              </thead>
              <tbody>
                {data.menus.map((m) => (
                  <tr key={`${m.meal_type}-${m.menu}`} className="border-b border-[var(--line)] last:border-0">
                    <td className="py-2 font-semibold text-[var(--ink-strong)]">{m.menu}</td>
                    <td className="py-2">
                      <CategoryBadge label={m.meal_type} tone={mealToTone(m.meal_type)} />
                    </td>
                    <td className="f3-mono py-2 text-right">{m.avg_expected}</td>
                    <td className="f3-mono py-2 text-right font-semibold">{m.avg_actual}</td>
                    <td
                      className="f3-mono py-2 text-right font-medium"
                      style={{ color: m.attendance_lift >= 0 ? "var(--green-text)" : "var(--red-text)" }}
                    >
                      {m.attendance_lift >= 0 ? `+${m.attendance_lift}` : m.attendance_lift}
                    </td>
                    <td className="f3-mono py-2 text-right">{m.avg_wastage_pct}%</td>
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
