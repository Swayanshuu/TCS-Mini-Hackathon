import { useEffect, useState } from "react";
import { ChevronDown, ChevronUp, Sparkles } from "lucide-react";
import { api } from "../api";
import type { MealType, MetadataResponse, PredictionResponse } from "../types";
import { AgentAuraFace, JaaliNoticeBand } from "../components/FusionMarks";
import { CategoryBadge, EmptyRingState, StatusDotText, riskToTone } from "../components/UiPrimitives";

export function MealPredictorPage({
  metadata,
  onPredictionSaved,
}: {
  metadata: MetadataResponse;
  onPredictionSaved: (pred: PredictionResponse) => void;
}) {
  const [date, setDate] = useState<string>(metadata.default_next_date || "2026-01-01");
  const [mealType, setMealType] = useState<MealType>("Lunch");
  const [menu, setMenu] = useState<string>(metadata.menus_by_meal?.Lunch?.[0] || "Rice-Dal");
  const [customMenu, setCustomMenu] = useState<string>("");
  const [safetyBuffer, setSafetyBuffer] = useState<number>(1.05);
  const [showOverrides, setShowOverrides] = useState<boolean>(false);
  const [dayTypeOverride, setDayTypeOverride] = useState<string>("");
  const [isHoliday, setIsHoliday] = useState<boolean>(false);
  const [isExam, setIsExam] = useState<boolean>(false);
  const [eventName, setEventName] = useState<string>("");

  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<PredictionResponse | null>(null);

  useEffect(() => {
    const options = metadata.menus_by_meal[mealType] || [];
    if (options.length > 0 && !options.includes(menu)) {
      setMenu(options[0]);
    }
  }, [mealType, metadata, menu]);

  async function runPrediction(saveToHistory = true) {
    setLoading(true);
    setError(null);
    try {
      const selectedMenu = customMenu.trim() ? customMenu.trim() : menu;
      const res = await api.predictMeal({
        date,
        meal_type: mealType,
        menu: selectedMenu,
        safety_buffer: safetyBuffer,
        day_type: dayTypeOverride || null,
        is_holiday: isHoliday ? true : null,
        is_exam_period: isExam ? true : null,
        event_name: eventName.trim() || null,
        save_to_history: saveToHistory,
      });
      setResult(res);
      if (saveToHistory) onPredictionSaved(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Prediction failed");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    runPrediction(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const mealOptions = metadata.menus_by_meal[mealType] || metadata.all_menus;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <AgentAuraFace
            mood={loading ? "thinking" : result?.overall_risk === "High" ? "warning" : result ? "done" : "idle"}
            size={36}
          />
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="f3-title">Meal Predictor</h1>
              {loading ? (
                <span className="inline-flex items-center gap-1.5 text-[12px] font-medium dusk-thinking-text">
                  <span className="dusk-ember" />
                  Computing…
                </span>
              ) : (
                <StatusDotText label={metadata.selected_model} tone="green" />
              )}
            </div>
          </div>
        </div>
        {result && (
          <div className="flex items-center gap-2">
            <CategoryBadge
              label={`Evidence: ${result.explanation.evidence_sufficiency}`}
              tone={result.explanation.evidence_sufficiency === "Limited" ? "yellow" : "blue"}
            />
            <CategoryBadge label={`Risk: ${result.overall_risk}`} tone={riskToTone(result.overall_risk)} />
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        {/* Compact Input Panel */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            runPrediction(true);
          }}
          className={`f3-card space-y-3.5 self-start p-4 lg:col-span-4 ${loading ? "dusk-halo-active" : ""}`}
        >
          <div>
            <label className="f3-label mb-1 block">Date</label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="f3-input w-full"
              required
            />
          </div>

          <div>
            <label className="f3-label mb-1 block">Meal</label>
            <div className="grid grid-cols-3 gap-1 rounded-[8px] border border-[var(--line)] bg-[var(--surface-canvas)] p-0.5">
              {(["Breakfast", "Lunch", "Dinner"] as MealType[]).map((mt) => (
                <button
                  key={mt}
                  type="button"
                  onClick={() => setMealType(mt)}
                  className={`h-[26px] rounded-[6px] text-[13px] font-medium ${
                    mealType === mt
                      ? "border border-[var(--line)] bg-[var(--surface-paper)] text-[var(--ink-strong)]"
                      : "text-[var(--ink-muted)] hover:text-[var(--ink-strong)]"
                  }`}
                >
                  {mt}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="f3-label mb-1 block">Menu</label>
            <select value={menu} onChange={(e) => setMenu(e.target.value)} className="f3-input w-full">
              {mealOptions.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
            <input
              type="text"
              value={customMenu}
              onChange={(e) => setCustomMenu(e.target.value)}
              placeholder="Custom menu (optional)"
              className="f3-input mt-2 w-full"
            />
          </div>

          <div>
            <div className="mb-1 flex items-center justify-between">
              <label className="f3-label">Safety Buffer</label>
              <span className="f3-mono text-[12px] font-semibold text-[var(--ink-strong)]">
                {safetyBuffer.toFixed(2)}× (+{Math.round((safetyBuffer - 1) * 100)}%)
              </span>
            </div>
            <input
              type="range"
              min="0.95"
              max="1.25"
              step="0.01"
              value={safetyBuffer}
              onChange={(e) => setSafetyBuffer(Number(e.target.value))}
              className="w-full accent-[var(--ink-strong)]"
            />
          </div>

          {/* Collapsible Calendar Overrides */}
          <div className="border-t border-[var(--line)] pt-2">
            <button
              type="button"
              onClick={() => setShowOverrides((s) => !s)}
              className="flex w-full items-center justify-between py-1 text-[12px] font-medium text-[var(--ink-muted)] hover:text-[var(--ink-strong)]"
            >
              <span>Calendar Overrides</span>
              {showOverrides ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </button>

            {showOverrides && (
              <div className="mt-2 space-y-2.5">
                <select
                  value={dayTypeOverride}
                  onChange={(e) => setDayTypeOverride(e.target.value)}
                  className="f3-input w-full"
                >
                  <option value="">Auto-detect ({date})</option>
                  {metadata.day_types.map((dt) => (
                    <option key={dt} value={dt}>
                      {dt.replace("_", " ")}
                    </option>
                  ))}
                </select>

                <div className="flex flex-wrap gap-3 text-[13px]">
                  <label className="inline-flex cursor-pointer items-center gap-1.5">
                    <input
                      type="checkbox"
                      checked={isHoliday}
                      onChange={(e) => setIsHoliday(e.target.checked)}
                    />
                    <span>Holiday</span>
                  </label>
                  <label className="inline-flex cursor-pointer items-center gap-1.5">
                    <input
                      type="checkbox"
                      checked={isExam}
                      onChange={(e) => setIsExam(e.target.checked)}
                    />
                    <span>Exam period</span>
                  </label>
                </div>

                <input
                  type="text"
                  value={eventName}
                  onChange={(e) => setEventName(e.target.value)}
                  placeholder="Event name (e.g. Campus Fest)"
                  className="f3-input w-full"
                />
              </div>
            )}
          </div>

          {error && (
            <div
              className="rounded-[8px] border p-2 text-[12px]"
              style={{ borderColor: "var(--red-fill)", backgroundColor: "var(--red-tint)", color: "var(--red-text)" }}
            >
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="f3-btn f3-btn-lg f3-btn-primary has-leading-icon w-full"
          >
            <Sparkles size={15} />
            <span>{loading ? "Predicting…" : "Predict & Save"}</span>
          </button>
        </form>

        {/* Data-First Results Column */}
        <div className="space-y-4 lg:col-span-8">
          {!result ? (
            <EmptyRingState
              title="Ready to predict"
              subtitle="Choose date, meal, and menu on the left."
            />
          ) : (
            <>
              {/* Hero Metric Strip */}
              <div className="f3-card overflow-hidden">
                {loading && <div className="dusk-dreamline" />}
                <div className="grid grid-cols-2 gap-4 p-4 sm:grid-cols-4">
                  <div>
                    <div className="f3-label">Predicted Turnout</div>
                    <div className="f3-display mt-1">{result.predicted_attendance}</div>
                    <div className="f3-caption">
                      {result.actual_outcome
                        ? `actual ${result.actual_outcome.actual_students} (${result.actual_outcome.recorded_menu})`
                        : `avg ${result.historical_meal_average}`}
                    </div>
                  </div>
                  <div>
                    <div className="f3-label">Context</div>
                    <div className="mt-2 flex flex-wrap gap-1">
                      <CategoryBadge label={result.day_of_week.slice(0, 3)} tone="blue" />
                      <CategoryBadge
                        label={result.explanation.calendar_flags.day_type.replace("_", " ")}
                        tone="violet"
                      />
                      {result.explanation.calendar_flags.is_holiday && <CategoryBadge label="Holiday" tone="red" />}
                      {result.explanation.calendar_flags.is_exam_period && <CategoryBadge label="Exam" tone="yellow" />}
                      {result.explanation.calendar_flags.event_name && (
                        <CategoryBadge label={result.explanation.calendar_flags.event_name} tone="pink" />
                      )}
                    </div>
                  </div>
                  {Object.entries(result.totals_by_unit).slice(0, 2).map(([unit, vals]) => (
                    <div key={unit}>
                      <div className="f3-label">Prep ({unit})</div>
                      <div className="f3-metric mt-1">{vals.recommended_preparation}</div>
                      <div className="f3-mono text-[11px]" style={{ color: "var(--green-text)" }}>
                        save {vals.potential_savings} {unit}
                      </div>
                    </div>
                  ))}
                </div>
                <div className="border-t border-[var(--line)] bg-[var(--surface-subtle)] px-4 py-2 text-[12px] text-[var(--ink-muted)]">
                  {result.explanation.summary}
                </div>
              </div>

              {(result.overall_risk === "High" || result.explanation.sparse_evidence_warnings.length > 0) && (
                <JaaliNoticeBand
                  tone={result.overall_risk === "High" ? "red" : "yellow"}
                  title={
                    result.overall_risk === "High"
                      ? "Staff Alert: High Wastage / Shortage Risk"
                      : "Limited Historical Evidence"
                  }
                  subtitle={[
                    ...result.explanation.sparse_evidence_warnings,
                    ...result.explanation.risk_notes,
                  ].join(" ")}
                />
              )}

              {/* Item-Wise Preparation Table */}
              <div className="f3-card p-4">
                <div className="mb-2.5 flex flex-wrap items-center justify-between gap-2">
                  <span className="f3-subheading">Recommended Kitchen Quantities</span>
                  <div className="flex items-center gap-2">
                    {result.used_fallback_menu && <CategoryBadge label="Fallback menu" tone="yellow" />}
                    <span className="f3-mono text-[12px] text-[var(--ink-faint)]">
                      {result.safety_buffer.toFixed(2)}× buffer
                    </span>
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-[13px]">
                    <thead>
                      <tr className="border-b border-[var(--line)]">
                        <th className="f3-label pb-2">Item</th>
                        <th className="f3-label pb-2 text-right">Est. Consumed</th>
                        <th className="f3-label pb-2 text-right">Recommended</th>
                        <th className="f3-label pb-2 text-right">Hist. Avg</th>
                        <th className="f3-label pb-2 text-right">Exp. Leftover</th>
                        <th className="f3-label pb-2 text-right">Savings</th>
                        <th className="f3-label pb-2 text-right">Risk</th>
                      </tr>
                    </thead>
                    <tbody>
                      {result.items.map((item) => (
                        <tr
                          key={item.food_item}
                          title={item.risk_reason}
                          className="border-b border-[var(--line)] last:border-0"
                        >
                          <td className="py-2 font-semibold text-[var(--ink-strong)]">
                            {item.food_item}{" "}
                            <span className="text-[11px] font-normal text-[var(--ink-faint)]">
                              ({item.avg_consumed_per_student}/{item.unit})
                            </span>
                          </td>
                          <td className="f3-mono py-2 text-right">
                            {item.predicted_consumption} {item.unit}
                          </td>
                          <td className="f3-mono py-2 text-right font-semibold text-[var(--ink-strong)]">
                            {item.recommended_preparation} {item.unit}
                          </td>
                          <td className="f3-mono py-2 text-right text-[var(--ink-muted)]">
                            {item.historical_avg_preparation} {item.unit}
                          </td>
                          <td className="f3-mono py-2 text-right">
                            {item.expected_leftover} {item.unit}
                          </td>
                          <td
                            className="f3-mono py-2 text-right font-medium"
                            style={{ color: item.potential_savings > 0 ? "var(--green-text)" : "var(--ink-faint)" }}
                          >
                            {item.potential_savings > 0 ? `-${item.potential_savings} ${item.unit}` : "0"}
                          </td>
                          <td className="py-2 text-right">
                            <CategoryBadge label={item.risk_level} tone={riskToTone(item.risk_level)} />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Compact Bottom Split: Quantitative Factor Impacts + Similar Meals */}
              <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
                <div className="f3-card p-4">
                  <div className="mb-2.5 flex items-center justify-between">
                    <span className="f3-subheading">Model Drivers</span>
                    {result.explanation.sparse_evidence_warnings.length > 0 && (
                      <CategoryBadge label="Low sample warning" tone="yellow" />
                    )}
                  </div>
                  <div className="space-y-2">
                    {result.explanation.factors.map((f) => (
                      <div key={f.factor} className="flex items-center justify-between border-b border-[var(--line)] pb-1.5 last:border-0">
                        <span className="text-[12px] text-[var(--ink-body)]">{f.factor}</span>
                        <div className="flex items-center gap-2">
                          <span className="f3-mono text-[12px] text-[var(--ink-muted)]">{f.value}</span>
                          {f.impact !== 0 && (
                            <CategoryBadge
                              label={`${f.impact > 0 ? "+" : ""}${f.impact}`}
                              tone={f.impact > 0 ? "green" : "orange"}
                            />
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="f3-card p-4">
                  <div className="mb-2.5 flex items-center justify-between">
                    <span className="f3-subheading">Similar Historical Meals</span>
                    <span className="f3-count">{result.similar_meals.length}</span>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-[12px]">
                      <thead>
                        <tr className="border-b border-[var(--line)]">
                          <th className="f3-label pb-1.5">Date</th>
                          <th className="f3-label pb-1.5">Menu</th>
                          <th className="f3-label pb-1.5 text-right">Actual</th>
                          <th className="f3-label pb-1.5 text-right">Waste</th>
                        </tr>
                      </thead>
                      <tbody>
                        {result.similar_meals.slice(0, 5).map((m) => (
                          <tr key={`${m.date}-${m.menu}`} className="border-b border-[var(--line)] last:border-0">
                            <td className="f3-mono py-1.5">{m.date}</td>
                            <td className="py-1.5 font-medium text-[var(--ink-strong)]">{m.menu}</td>
                            <td className="f3-mono py-1.5 text-right font-semibold">{m.actual_students}</td>
                            <td className="f3-mono py-1.5 text-right">{m.avg_wastage_pct}%</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
