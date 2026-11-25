import { type FormEvent, useEffect, useState } from "react";
import { ArrowDownUp, Download, Search } from "lucide-react";
import { api } from "../api";
import type { DatasetResponse } from "../types";
import { CategoryBadge, EmptyRingState, ErrorNotice, LoadingSkeleton } from "../components/UiPrimitives";

type DatasetName = "meals" | "food_preparation" | "calendar";

export function DatasetExplorerPage() {
  const [dataset, setDataset] = useState<DatasetName>("meals");
  const [search, setSearch] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [mealType, setMealType] = useState("All");
  const [sortBy, setSortBy] = useState("date");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [page, setPage] = useState(1);

  const [data, setData] = useState<DatasetResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.getDataset(dataset, {
        search,
        date_from: dateFrom,
        date_to: dateTo,
        meal_type: mealType,
        sort_by: sortBy,
        sort_dir: sortDir,
        page,
        page_size: 25,
      });
      setData(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load dataset");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dataset, mealType, sortBy, sortDir, page]);

  const handleSearchSubmit = (e: FormEvent) => {
    e.preventDefault();
    setPage(1);
    load();
  };

  const toggleSort = (col: string) => {
    if (sortBy === col) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortBy(col);
      setSortDir("asc");
    }
    setPage(1);
  };

  const exportUrl = api.getExportUrl(dataset, {
    search,
    date_from: dateFrom,
    date_to: dateTo,
    meal_type: mealType,
  });

  return (
    <div className="space-y-4">
      {/* Header & Dataset Switcher */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="f3-title">Dataset Explorer</h1>
          <div className="f3-caption">Search, filter, sort, and export raw CSVs</div>
        </div>

        <div className="inline-flex rounded-[8px] border border-[var(--line)] bg-[var(--surface-canvas)] p-0.5">
          {[
            { id: "meals", label: "meals.csv" },
            { id: "food_preparation", label: "food_preparation.csv" },
            { id: "calendar", label: "calendar.csv" },
          ].map((d) => (
            <button
              key={d.id}
              type="button"
              onClick={() => {
                setDataset(d.id as DatasetName);
                setSortBy("date");
                setPage(1);
              }}
              className={`h-[26px] rounded-[6px] px-3 text-[13px] font-medium ${
                dataset === d.id
                  ? "border border-[var(--line)] bg-[var(--surface-paper)] text-[var(--ink-strong)]"
                  : "text-[var(--ink-muted)] hover:text-[var(--ink-strong)]"
              }`}
            >
              {d.label}
            </button>
          ))}
        </div>
      </div>

      {/* Bandhani x Sashiko Stitched Filter & Export Bar */}
      <form
        onSubmit={handleSearchSubmit}
        className="f3-sashiko-zone flex flex-wrap items-end justify-between gap-3 bg-[var(--surface-paper)] p-4"
      >
        <div className="flex flex-1 flex-wrap items-end gap-2.5">
          <div className="min-w-[200px] flex-1">
            <label className="f3-label mb-1 block">Search</label>
            <div className="relative">
              <Search size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--ink-faint)]" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search menu, food item, event…"
                className="f3-input w-full pl-8"
              />
            </div>
          </div>

          <div>
            <label className="f3-label mb-1 block">From</label>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="f3-input"
            />
          </div>

          <div>
            <label className="f3-label mb-1 block">To</label>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="f3-input"
            />
          </div>

          {dataset !== "calendar" && (
            <div>
              <label className="f3-label mb-1 block">Meal</label>
              <select
                value={mealType}
                onChange={(e) => {
                  setMealType(e.target.value);
                  setPage(1);
                }}
                className="f3-input"
              >
                <option value="All">All Meals</option>
                <option value="Breakfast">Breakfast</option>
                <option value="Lunch">Lunch</option>
                <option value="Dinner">Dinner</option>
              </select>
            </div>
          )}

          <button type="submit" className="f3-btn f3-btn-md f3-btn-primary">
            Apply
          </button>
        </div>

        <a
          href={exportUrl}
          className="f3-btn f3-btn-md f3-btn-outline has-leading-icon"
          download
        >
          <Download size={15} />
          <span>Export CSV</span>
        </a>
      </form>

      {/* Dataset Live Stats */}
      {data && (
        <div className="flex flex-wrap items-center gap-2">
          <CategoryBadge
            label={`Showing ${data.pagination.total_rows.toLocaleString()} of ${String(data.stats.total_rows_unfiltered ?? 0)} rows`}
            tone="blue"
          />
          {Object.entries(data.stats)
            .filter(([k]) => !["total_rows_unfiltered", "filtered_rows", "columns"].includes(k))
            .map(([k, v]) => (
              <span key={k} className="f3-count">
                {k.replace(/_/g, " ")}: {String(v)}
              </span>
            ))}
        </div>
      )}

      {loading && !data ? (
        <LoadingSkeleton rows={6} />
      ) : error ? (
        <ErrorNotice message={error} onRetry={load} />
      ) : !data || data.rows.length === 0 ? (
        <EmptyRingState
          title="No matching rows found"
          subtitle="Try clearing your search or broadening the date filter."
          action={
            <button
              type="button"
              onClick={() => {
                setSearch("");
                setDateFrom("");
                setDateTo("");
                setMealType("All");
                setPage(1);
              }}
              className="f3-btn f3-btn-md f3-btn-outline"
            >
              Reset Filters
            </button>
          }
        />
      ) : (
        <div className="f3-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-[13px]">
              <thead>
                <tr className="border-b border-[var(--line)] bg-[var(--surface-subtle)]">
                  {data.columns.map((col) => (
                    <th key={col} className="px-3 py-2.5">
                      <button
                        type="button"
                        onClick={() => toggleSort(col)}
                        className="f3-label inline-flex items-center gap-1 hover:text-[var(--ink-strong)]"
                      >
                        <span>{col.replace(/_/g, " ")}</span>
                        <ArrowDownUp size={11} />
                      </button>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.rows.map((row, idx) => (
                  <tr key={idx} className="border-b border-[var(--line)] last:border-0 hover:bg-[var(--surface-subtle)]">
                    {data.columns.map((col) => (
                      <td key={col} className="f3-mono whitespace-nowrap px-3 py-2 text-[12px]">
                        {String(row[col] ?? "—")}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[var(--line)] px-4 py-2.5">
            <span className="f3-caption">
              Page {data.pagination.page} of {data.pagination.total_pages}
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={data.pagination.page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="f3-btn f3-btn-sm f3-btn-outline"
              >
                Previous
              </button>
              <button
                type="button"
                disabled={data.pagination.page >= data.pagination.total_pages}
                onClick={() => setPage((p) => p + 1)}
                className="f3-btn f3-btn-sm f3-btn-outline"
              >
                Next
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
