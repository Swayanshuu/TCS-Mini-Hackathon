import { useEffect, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Award } from "lucide-react";
import { api } from "../api";
import type { EvaluationResponse } from "../types";
import { CategoryBadge, CategoryTile, ErrorNotice, LoadingSkeleton, StatusDotText, mealToTone } from "../components/UiPrimitives";

export function ModelPerformancePage() {
  const [data, setData] = useState<EvaluationResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      setData(await api.getEvaluation());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load model evaluation");
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

  const { selected_model, split, models, feature_importances, backtest_summary, backtest_records } = data;
  const chartSlice = backtest_records.slice(-60);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="f3-title">Model Performance</h1>
          <div className="f3-caption">
            Chronological backtest: Train {split.train_meals} meals ({split.train_start} → {split.train_end}) · Test {split.test_meals} meals ({split.test_start} → {split.test_end})
          </div>
        </div>
        <CategoryBadge label={`Winner: ${selected_model}`} tone="green" />
      </div>

      {/* Model Comparison Cards + Simulated Impact */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        {Object.entries(models).map(([name, m]) => {
          const isWinner = name === selected_model;
          return (
            <div
              key={name}
              className="f3-card p-4 lg:col-span-4"
              style={isWinner ? { borderColor: "var(--green-fill)" } : undefined}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CategoryTile size={20} tone={isWinner ? "green" : "neutral"}>
                    <Award size={12} />
                  </CategoryTile>
                  <span className="f3-subheading text-[14px]">{name}</span>
                </div>
                <CategoryBadge label={isWinner ? "Selected" : "Candidate"} tone={isWinner ? "green" : "neutral"} />
              </div>
              <div className="mt-3 grid grid-cols-4 gap-2 border-t border-[var(--line)] pt-3">
                <div>
                  <div className="f3-label">MAE</div>
                  <div className="f3-mono mt-1 text-[18px] font-semibold text-[var(--ink-strong)]">{m.mae}</div>
                </div>
                <div>
                  <div className="f3-label">RMSE</div>
                  <div className="f3-mono mt-1 text-[18px] font-semibold text-[var(--ink-strong)]">{m.rmse}</div>
                </div>
                <div>
                  <div className="f3-label">R²</div>
                  <div className="f3-mono mt-1 text-[18px] font-semibold text-[var(--ink-strong)]">{m.r2.toFixed(3)}</div>
                </div>
                <div>
                  <div className="f3-label">MAPE</div>
                  <div className="f3-mono mt-1 text-[18px] font-semibold text-[var(--ink-strong)]">{m.mape}%</div>
                </div>
              </div>
            </div>
          );
        })}

        <div className="f3-card p-4 lg:col-span-4">
          <div className="flex items-center justify-between">
            <span className="f3-subheading text-[14px]">Simulated Wastage Reduction</span>
            <CategoryBadge label="1.05× buffer" tone="blue" />
          </div>
          <div className="mt-3 grid grid-cols-3 gap-2 border-t border-[var(--line)] pt-3">
            <div>
              <div className="f3-label">Actual Left</div>
              <div className="f3-mono mt-1 text-[18px] font-semibold text-[var(--ink-strong)]">
                {backtest_summary.actual_kg_leftover} kg
              </div>
            </div>
            <div>
              <div className="f3-label">Sim. Left</div>
              <div className="f3-mono mt-1 text-[18px] font-semibold text-[var(--ink-strong)]">
                {backtest_summary.simulated_kg_leftover} kg
              </div>
            </div>
            <div>
              <div className="f3-label">Saved</div>
              <div className="f3-mono mt-1 text-[18px] font-semibold" style={{ color: "var(--green-text)" }}>
                -{backtest_summary.estimated_wastage_reduction_kg} kg
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        <div className="f3-card p-4 lg:col-span-7">
          <div className="mb-3 flex items-center justify-between">
            <span className="f3-subheading">Actual vs Predicted (Last 60 Test Meals)</span>
            <div className="flex items-center gap-3">
              <StatusDotText label="Actual" tone="blue" />
              <StatusDotText label="Predicted" tone="green" />
            </div>
          </div>
          <div className="h-60 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartSlice} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
                <CartesianGrid stroke="var(--line)" strokeDasharray="3 3" vertical={false} />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 11, fill: "var(--ink-faint)" }}
                  tickFormatter={(v) => String(v).slice(5)}
                  minTickGap={20}
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
                <Line type="monotone" dataKey="actual_students" name="Actual" stroke="#1871da" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="predicted_students" name="Predicted" stroke="#1ec072" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="f3-card p-4 lg:col-span-5">
          <div className="mb-3 f3-subheading">Feature Importances (%)</div>
          <div className="h-60 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={feature_importances.slice(0, 7)}
                layout="vertical"
                margin={{ top: 4, right: 16, left: 40, bottom: 0 }}
              >
                <CartesianGrid stroke="var(--line)" strokeDasharray="3 3" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 11, fill: "var(--ink-faint)" }} unit="%" />
                <YAxis type="category" dataKey="feature" width={125} tick={{ fontSize: 11, fill: "var(--ink-body)" }} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "var(--surface-paper)",
                    borderColor: "var(--line)",
                    borderRadius: 8,
                    fontSize: 12,
                  }}
                />
                <Bar dataKey="importance" name="Importance %" fill="#9664d7" radius={[0, 2, 2, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Backtest Table */}
      <div className="f3-card p-4">
        <div className="mb-2.5 flex items-center justify-between">
          <span className="f3-subheading">Holdout Backtest Log (Simulated vs Recorded)</span>
          <span className="f3-count">{backtest_records.length} meals</span>
        </div>
        <div className="max-h-80 overflow-auto">
          <table className="w-full text-left text-[13px]">
            <thead className="sticky top-0 bg-[var(--surface-paper)]">
              <tr className="border-b border-[var(--line)]">
                <th className="f3-label py-2">Date</th>
                <th className="f3-label py-2">Meal / Menu</th>
                <th className="f3-label py-2 text-right">Actual</th>
                <th className="f3-label py-2 text-right">Predicted</th>
                <th className="f3-label py-2 text-right">Error</th>
                <th className="f3-label py-2 text-right">Actual Prep (kg)</th>
                <th className="f3-label py-2 text-right">Sim. ML Prep (kg)</th>
              </tr>
            </thead>
            <tbody>
              {backtest_records.map((r) => (
                <tr key={`${r.date}-${r.meal_type}`} className="border-b border-[var(--line)] last:border-0">
                  <td className="f3-mono py-2 text-[12px]">{r.date}</td>
                  <td className="py-2">
                    <div className="flex items-center gap-2">
                      <CategoryBadge label={r.meal_type} tone={mealToTone(r.meal_type)} />
                      <span className="font-medium text-[var(--ink-strong)]">{r.menu}</span>
                    </div>
                  </td>
                  <td className="f3-mono py-2 text-right font-semibold">{r.actual_students}</td>
                  <td className="f3-mono py-2 text-right">{r.predicted_students}</td>
                  <td
                    className="f3-mono py-2 text-right"
                    style={{ color: Math.abs(r.error) <= 15 ? "var(--green-text)" : "var(--yellow-text)" }}
                  >
                    {r.error >= 0 ? `+${r.error}` : r.error}
                  </td>
                  <td className="f3-mono py-2 text-right text-[var(--ink-muted)]">{r.actual_kg_prepared}</td>
                  <td className="f3-mono py-2 text-right font-medium text-[var(--ink-strong)]">
                    {r.simulated_kg_recommended}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
