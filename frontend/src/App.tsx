import { useEffect, useState } from "react";
import {
  AlertTriangle,
  BarChart3,
  Cpu,
  Database,
  LayoutDashboard,
  Menu,
  Moon,
  Sparkles,
  Sun,
  X,
  type LucideIcon,
} from "lucide-react";
import { api } from "./api";
import type { DashboardResponse, MetadataResponse, PredictionResponse } from "./types";
import { KolamToast, TheRingMark } from "./components/FusionMarks";
import { ErrorNotice, LoadingSkeleton, StatusDotText } from "./components/UiPrimitives";
import { OverviewPage } from "./pages/OverviewPage";
import { MealPredictorPage } from "./pages/MealPredictorPage";
import { FoodAnalyticsPage } from "./pages/FoodAnalyticsPage";
import { WasteAnalysisPage } from "./pages/WasteAnalysisPage";
import { ModelPerformancePage } from "./pages/ModelPerformancePage";
import { DatasetExplorerPage } from "./pages/DatasetExplorerPage";

type NavKey =
  | "overview"
  | "predictor"
  | "food"
  | "waste"
  | "performance"
  | "datasets";

const NAV_ITEMS: Array<{ key: NavKey; label: string; icon: LucideIcon }> = [
  { key: "overview", label: "Overview", icon: LayoutDashboard },
  { key: "predictor", label: "Meal Predictor", icon: Sparkles },
  { key: "food", label: "Food Analytics", icon: BarChart3 },
  { key: "waste", label: "Waste Analysis", icon: AlertTriangle },
  { key: "performance", label: "Model Performance", icon: Cpu },
  { key: "datasets", label: "Dataset Explorer", icon: Database },
];

export function App() {
  const [activeTab, setActiveTab] = useState<NavKey>("overview");
  const [mobileOpen, setMobileOpen] = useState(false);
  const [darkMode, setDarkMode] = useState(false);

  const [metadata, setMetadata] = useState<MetadataResponse | null>(null);
  const [dashboard, setDashboard] = useState<DashboardResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<{ title: string; subtitle: string } | null>(null);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", darkMode ? "dark" : "light");
  }, [darkMode]);

  const loadCore = async () => {
    setLoading(true);
    setError(null);
    try {
      const [meta, dash] = await Promise.all([api.getMetadata(), api.getDashboard()]);
      setMetadata(meta);
      setDashboard(dash);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to connect to FastAPI server");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCore();
  }, []);

  const handlePredictionSaved = (pred: PredictionResponse) => {
    setToast({
      title: `Forecast saved: ${pred.predicted_attendance} students`,
      subtitle: `${pred.date} · ${pred.meal_type} (${pred.menu})`,
    });
    api.getDashboard().then(setDashboard).catch(() => {});
  };

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 5000);
    return () => clearTimeout(t);
  }, [toast]);

  const SidebarContent = (
    <div className="flex h-full flex-col justify-between p-3">
      <div>
        <div className="flex items-center gap-2.5 px-2 py-2">
          <TheRingMark size={28} />
          <div className="min-w-0">
            <div className="truncate text-[15px] font-semibold tracking-[-0.03em] text-[var(--ink-strong)]">
              MessIQ
            </div>
            <div className="text-[11px] text-[var(--ink-faint)]">AI Food-Waste Predictor</div>
          </div>
        </div>

        <div className="my-2 border-t border-[var(--line)]" />

        <nav className="space-y-1" aria-label="Primary Navigation">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const active = activeTab === item.key;
            return (
              <button
                key={item.key}
                type="button"
                onClick={() => {
                  setActiveTab(item.key);
                  setMobileOpen(false);
                }}
                className={`flex h-[34px] w-full items-center gap-2.5 rounded-[8px] px-2.5 text-[13px] font-medium transition-colors ${
                  active
                    ? "border border-[var(--line)] bg-[var(--surface-paper)] text-[var(--ink-strong)]"
                    : "border border-transparent text-[var(--ink-muted)] hover:bg-[var(--surface-sunken)] hover:text-[var(--ink-strong)]"
                }`}
              >
                <Icon size={16} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>
      </div>

      <div className="space-y-2 border-t border-[var(--line)] pt-3">
        {metadata && (
          <div className="rounded-[8px] border border-[var(--line)] bg-[var(--surface-paper)] px-2.5 py-2">
            <StatusDotText label="FastAPI + ML Ready" tone="green" />
            <div className="mt-1 text-[11px] text-[var(--ink-faint)]">
              {metadata.data_quality.meals_rows.toLocaleString()} meals ·{" "}
              {metadata.data_quality.food_prep_rows.toLocaleString()} prep logs
            </div>
          </div>
        )}
        <button
          type="button"
          onClick={() => setDarkMode((d) => !d)}
          className="f3-btn f3-btn-sm f3-btn-outline w-full justify-between"
        >
          <span className="inline-flex items-center gap-1.5">
            {darkMode ? <Sun size={14} /> : <Moon size={14} />}
            <span>{darkMode ? "Fusion Paper Light" : "Charcoal Dark"}</span>
          </span>
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[var(--surface-canvas)] text-[var(--ink-body)]">
      {/* Mobile Header */}
      <header className="sticky top-0 z-30 flex h-12 items-center justify-between border-b border-[var(--line)] bg-[var(--surface-paper)] px-4 lg:hidden">
        <div className="flex items-center gap-2">
          <TheRingMark size={24} />
          <span className="text-[15px] font-semibold tracking-[-0.03em] text-[var(--ink-strong)]">
            MessIQ
          </span>
        </div>
        <button
          type="button"
          onClick={() => setMobileOpen((o) => !o)}
          className="f3-btn f3-btn-sm f3-btn-outline"
          aria-label="Toggle Menu"
        >
          {mobileOpen ? <X size={16} /> : <Menu size={16} />}
        </button>
      </header>

      <div className="mx-auto flex max-w-[1440px]">
        {/* Desktop Sidebar */}
        <aside className="sticky top-0 hidden h-screen w-[240px] shrink-0 border-r border-[var(--line)] bg-[var(--surface-subtle)] lg:block">
          {SidebarContent}
        </aside>

        {/* Mobile Drawer */}
        {mobileOpen && (
          <div className="fixed inset-0 z-40 flex lg:hidden">
            <div className="w-64 border-r border-[var(--line)] bg-[var(--surface-subtle)]">
              {SidebarContent}
            </div>
            <div className="flex-1 bg-black/30" onClick={() => setMobileOpen(false)} />
          </div>
        )}

        {/* Main Content */}
        <main className="min-w-0 flex-1 p-4 sm:p-6">
          {loading && !dashboard ? (
            <LoadingSkeleton rows={6} />
          ) : error && !dashboard ? (
            <ErrorNotice message={error} onRetry={loadCore} />
          ) : (
            <>
              {activeTab === "overview" && dashboard && (
                <OverviewPage data={dashboard} onNavigate={(tab) => setActiveTab(tab as NavKey)} />
              )}
              {activeTab === "predictor" && metadata && (
                <MealPredictorPage metadata={metadata} onPredictionSaved={handlePredictionSaved} />
              )}
              {activeTab === "food" && <FoodAnalyticsPage />}
              {activeTab === "waste" && <WasteAnalysisPage />}
              {activeTab === "performance" && <ModelPerformancePage />}
              {activeTab === "datasets" && <DatasetExplorerPage />}
            </>
          )}
        </main>
      </div>

      {toast && (
        <KolamToast title={toast.title} subtitle={toast.subtitle} onClose={() => setToast(null)} />
      )}
    </div>
  );
}

export default App;
