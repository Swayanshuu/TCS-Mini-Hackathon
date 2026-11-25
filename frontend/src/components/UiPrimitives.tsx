import React from "react";
import type { RiskLevel } from "../types";
import { TheRingMark } from "./FusionMarks";

const BADGE_TONES = {
  blue: { bg: "var(--blue-tint)", color: "var(--blue-text)" },
  green: { bg: "var(--green-tint)", color: "var(--green-text)" },
  pink: { bg: "var(--pink-tint)", color: "var(--pink-text)" },
  yellow: { bg: "var(--yellow-tint)", color: "var(--yellow-text)" },
  orange: { bg: "var(--orange-tint)", color: "var(--orange-text)" },
  violet: { bg: "var(--violet-tint)", color: "var(--violet-text)" },
  red: { bg: "var(--red-tint)", color: "var(--red-text)" },
  neutral: { bg: "var(--surface-sunken)", color: "var(--ink-muted)" },
} as const;

export type BadgeTone = keyof typeof BADGE_TONES;

export function CategoryBadge({
  label,
  tone = "neutral",
}: {
  label: string;
  tone?: BadgeTone;
}) {
  const style = BADGE_TONES[tone];
  return (
    <span className="f3-badge" style={{ backgroundColor: style.bg, color: style.color }}>
      {label}
    </span>
  );
}

export function riskToTone(risk: RiskLevel): BadgeTone {
  if (risk === "High") return "red";
  if (risk === "Medium") return "yellow";
  return "green";
}

export function mealToTone(meal: string): BadgeTone {
  if (meal === "Breakfast") return "violet";
  if (meal === "Lunch") return "orange";
  if (meal === "Dinner") return "pink";
  return "blue";
}

/**
 * Fusion 3 Status Dot + Word (6px dot beside text for table columns, never inside a capsule)
 */
export function StatusDotText({
  label,
  tone,
}: {
  label: string;
  tone: "green" | "yellow" | "red" | "blue";
}) {
  const fillMap = {
    green: "var(--green-fill)",
    yellow: "var(--yellow-fill)",
    red: "var(--red-fill)",
    blue: "var(--blue-fill)",
  };
  return (
    <span className="inline-flex items-center gap-1.5 text-[13px] font-medium text-[var(--ink-body)]">
      <span
        className="h-1.5 w-1.5 shrink-0 rounded-full"
        style={{ backgroundColor: fillMap[tone] }}
      />
      <span>{label}</span>
    </span>
  );
}

/**
 * Fusion 3 Category Tile (2px radius, half-size centered glyph)
 */
export function CategoryTile({
  size = 24,
  tone = "blue",
  children,
}: {
  size?: 20 | 24 | 32 | 40;
  tone?: BadgeTone;
  children: React.ReactNode;
}) {
  const style = BADGE_TONES[tone];
  return (
    <div
      className="inline-flex shrink-0 items-center justify-center rounded-[2px]"
      style={{
        width: size,
        height: size,
        backgroundColor: style.bg,
        color: style.color,
      }}
    >
      {children}
    </div>
  );
}

export function EmptyRingState({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="f3-card flex flex-col items-center justify-center px-6 py-12 text-center">
      <TheRingMark size={40} variant="halftone" />
      <div className="mt-3 text-[15px] font-semibold text-[var(--ink-strong)]">{title}</div>
      <div className="mt-1 max-w-md text-[13px] text-[var(--ink-faint)]">{subtitle}</div>
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function ErrorNotice({
  message,
  onRetry,
}: {
  message: string;
  onRetry?: () => void;
}) {
  return (
    <div
      className="f3-card flex flex-wrap items-center justify-between gap-3 p-4"
      style={{ borderColor: "var(--red-fill)", backgroundColor: "var(--red-tint)" }}
    >
      <div>
        <div className="text-[13px] font-semibold" style={{ color: "var(--red-text)" }}>
          Failed to load data from FastAPI backend
        </div>
        <div className="mt-0.5 text-[12px] text-[var(--ink-muted)]">{message}</div>
      </div>
      {onRetry && (
        <button type="button" onClick={onRetry} className="f3-btn f3-btn-sm f3-btn-outline">
          Retry
        </button>
      )}
    </div>
  );
}

export function LoadingSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="f3-card h-28 animate-pulse bg-[var(--surface-subtle)] p-4" />
        ))}
      </div>
      <div className="f3-card space-y-2.5 p-4">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="h-8 animate-pulse rounded bg-[var(--surface-sunken)]" />
        ))}
      </div>
    </div>
  );
}
