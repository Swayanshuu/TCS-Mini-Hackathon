import { AlertTriangle, Check } from "lucide-react";

/**
 * MessIQ Q-Ring Mark (Fusion 3 48-unit grid):
 * Centre (24,24), r=11, stroke=6.5, bottom-right Q opening with diagonal strike tail.
 * Four Confetti segments: Blue (Calendar), Pink (ML/AI), Yellow (Risk), Green (Consumption).
 */
export function TheRingMark({
  size = 28,
  variant = "confetti",
}: {
  size?: number;
  variant?: "confetti" | "halftone";
}) {
  if (variant === "halftone") {
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 48 48"
        fill="none"
        aria-hidden="true"
      >
        <defs>
          <pattern id="ring-ht" width="4" height="4" patternUnits="userSpaceOnUse">
            <circle cx="2" cy="2" r="1.15" fill="var(--ink-disabled)" />
          </pattern>
        </defs>
        <path
          d="M 34.2 28.0 A 11 11 0 1 0 28.0 34.2"
          stroke="url(#ring-ht)"
          strokeWidth="6.5"
          strokeLinecap="round"
        />
        <line
          x1="27.5"
          y1="27.5"
          x2="35.5"
          y2="35.5"
          stroke="var(--ink-disabled)"
          strokeWidth="5.2"
          strokeLinecap="round"
        />
      </svg>
    );
  }

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      aria-label="MessIQ logo mark"
    >
      {/* Top arc: Blue */}
      <path
        d="M 31.8 16.2 A 11 11 0 0 0 16.2 16.2"
        stroke="#1871da"
        strokeWidth="6.5"
        strokeLinecap="round"
      />
      {/* Left arc: Pink */}
      <path
        d="M 16.2 16.2 A 11 11 0 0 0 16.2 31.8"
        stroke="#f6609f"
        strokeWidth="6.5"
        strokeLinecap="round"
      />
      {/* Bottom arc: Yellow */}
      <path
        d="M 16.2 31.8 A 11 11 0 0 0 26.8 34.6"
        stroke="#ffbb38"
        strokeWidth="6.5"
        strokeLinecap="round"
      />
      {/* Upper-right arc: Green */}
      <path
        d="M 34.6 26.8 A 11 11 0 0 0 31.8 16.2"
        stroke="#1ec072"
        strokeWidth="6.5"
        strokeLinecap="round"
      />
      {/* Bayer-stepped junction dots */}
      <rect x="15.2" y="15.2" width="2" height="2" fill="#7b6cff" opacity="0.85" />
      <rect x="15.2" y="30.8" width="2" height="2" fill="#ffad4a" opacity="0.85" />
      {/* Q Tail / Strike in strong ink */}
      <line
        x1="27.5"
        y1="27.5"
        x2="35.5"
        y2="35.5"
        stroke="var(--ink-strong)"
        strokeWidth="5.2"
        strokeLinecap="round"
      />
    </svg>
  );
}

/**
 * Fusion 3 Truchet-Tile Symmetric Kolam Header Band.
 * Drawn live from a deterministic seed on a Meadow ramp wash — zero image files.
 */
export function TruchetKolamBand({
  seed = 3,
  ramp = "meadow",
}: {
  seed?: number;
  ramp?: "meadow" | "dawn";
}) {
  // 4x2 quadrant mirrored into 8x4 symmetric Truchet grid
  const cols = 4;
  const rows = 2;
  const cell = 18;
  const tiles: boolean[][] = [];
  let s = seed * 97 + 13;
  for (let r = 0; r < rows; r++) {
    const row: boolean[] = [];
    for (let c = 0; c < cols; c++) {
      s = (s * 16807) % 2147483647;
      row.push(s % 2 === 0);
    }
    tiles.push(row);
  }

  const paths: string[] = [];
  const dots: Array<[number, number]> = [];
  for (let r = 0; r < rows * 2; r++) {
    for (let c = 0; c < cols * 2; c++) {
      const mr = r < rows ? r : rows * 2 - 1 - r;
      const mc = c < cols ? c : cols * 2 - 1 - c;
      const flip = ((r >= rows ? 1 : 0) + (c >= cols ? 1 : 0)) % 2 === 1;
      const state = flip ? !tiles[mr][mc] : tiles[mr][mc];
      const x = c * cell;
      const y = r * cell;
      const half = cell / 2;
      if (state) {
        paths.push(
          `M ${x + half} ${y} A ${half} ${half} 0 0 1 ${x + cell} ${y + half}`,
          `M ${x} ${y + half} A ${half} ${half} 0 0 1 ${x + half} ${y + cell}`
        );
      } else {
        paths.push(
          `M ${x + half} ${y} A ${half} ${half} 0 0 0 ${x} ${y + half}`,
          `M ${x + cell} ${y + half} A ${half} ${half} 0 0 0 ${x + half} ${y + cell}`
        );
      }
      dots.push([x + half, y + half]);
    }
  }

  const bg =
    ramp === "meadow"
      ? "linear-gradient(125deg, #1d4a24 0%, #5aa64a 62%, #d8e87a 100%)"
      : "linear-gradient(125deg, #2b2470 0%, #5b5fe0 55%, #8ccaf5 100%)";

  return (
    <div
      className="relative overflow-hidden rounded-[10px] border border-[var(--line)]"
      style={{ background: bg }}
    >
      <svg
        className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 opacity-30"
        width={cols * 2 * cell}
        height={rows * 2 * cell}
        viewBox={`0 0 ${cols * 2 * cell} ${rows * 2 * cell}`}
        fill="none"
        aria-hidden="true"
      >
        {paths.map((d, i) => (
          <path key={i} d={d} stroke="#ffffff" strokeWidth="1.5" strokeLinecap="round" />
        ))}
        {dots.map(([cx, cy], i) => (
          <circle key={i} cx={cx} cy={cy} r="1.4" fill="#ffffff" />
        ))}
      </svg>
      <div className="relative z-10 flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-white">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/90">
            <TheRingMark size={22} />
          </div>
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.06em] text-white/80">
              MessIQ · Campus Mess Intelligence
            </div>
            <div className="text-[15px] font-semibold tracking-tight text-white">
              MessIQ Food-Waste Predictor
            </div>
          </div>
        </div>
        <div className="text-[12px] text-white/85">
          Chronological ML · Unit-aware kitchen prep · Seeded Kolam #{seed}
        </div>
      </div>
    </div>
  );
}

/**
 * Fusion 3 AI Agent Aura Face (Dusk palette + Bayer stipple + eye moods)
 */
export function AgentAuraFace({
  mood = "idle",
  size = 40,
}: {
  mood?: "idle" | "thinking" | "done" | "warning";
  size?: number;
}) {
  const eyeOffsetY = mood === "thinking" ? -2.2 : mood === "done" ? -0.8 : 0;
  return (
    <div
      className="relative inline-flex shrink-0 items-center justify-center rounded-full"
      style={{
        width: size,
        height: size,
        background:
          mood === "warning"
            ? "radial-gradient(circle at 30% 30%, #ffad4a 0%, #ff6fa8 60%, #986400 100%)"
            : "radial-gradient(circle at 28% 28%, #4cc3ff 0%, #7b6cff 45%, #ff6fa8 82%, #ffad4a 100%)",
      }}
      aria-hidden="true"
    >
      <svg width={size} height={size} viewBox="0 0 40 40" fill="none">
        <defs>
          <pattern id="bayer-shade" width="4" height="4" patternUnits="userSpaceOnUse">
            <rect x="0" y="0" width="1.5" height="1.5" fill="rgba(17,17,17,0.22)" />
            <rect x="2" y="2" width="1.5" height="1.5" fill="rgba(17,17,17,0.22)" />
          </pattern>
        </defs>
        {/* Bayer shaded right crescent */}
        <path
          d="M 24 3 A 18 18 0 0 1 24 37 A 13 18 0 0 0 24 3 Z"
          fill="url(#bayer-shade)"
        />
        {/* Pill eyes */}
        <rect
          x="13"
          y={15 + eyeOffsetY}
          width="4"
          height={mood === "done" ? "6" : "8"}
          rx="2"
          fill="#ffffff"
        />
        <rect
          x="23"
          y={15 + eyeOffsetY}
          width="4"
          height={mood === "done" ? "6" : "8"}
          rx="2"
          fill="#ffffff"
        />
      </svg>
    </div>
  );
}

/**
 * Fusion 3 Jaali x Asanoha 44px Notice Band for Shortage / High-Waste Warnings
 */
export function JaaliNoticeBand({
  tone = "yellow",
  title,
  subtitle,
  actionLabel,
  onAction,
}: {
  tone?: "yellow" | "red";
  title: string;
  subtitle: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  const bg = tone === "red" ? "var(--red-tint)" : "var(--yellow-tint)";
  const fg = tone === "red" ? "var(--red-text)" : "var(--yellow-text)";
  const accent = tone === "red" ? "var(--red-fill)" : "var(--yellow-fill)";

  return (
    <div
      className="relative flex min-h-[44px] flex-wrap items-center justify-between gap-3 overflow-hidden rounded-[10px] border border-[var(--line)] px-3 py-2"
      style={{ backgroundColor: bg }}
    >
      {/* Subtle Jaali x Asanoha lattice on left */}
      <svg
        className="pointer-events-none absolute left-0 top-0 h-full w-32 opacity-40"
        viewBox="0 0 128 44"
        fill="none"
        aria-hidden="true"
      >
        <path
          d="M0 22 L22 0 L44 22 L22 44 Z M44 22 L66 0 L88 22 L66 44 Z M22 0 L22 44 M66 0 L66 44"
          stroke="#ffffff"
          strokeWidth="1.25"
        />
      </svg>
      <div className="relative z-10 flex items-center gap-3">
        <div
          className="flex h-6 w-6 shrink-0 items-center justify-center rounded-[4px] bg-[var(--surface-paper)]"
          style={{ border: `1px solid ${accent}` }}
        >
          <AlertTriangle size={13} style={{ color: fg }} />
        </div>
        <div>
          <span className="text-[13px] font-semibold" style={{ color: fg }}>
            {title}
          </span>
          <span className="ml-2 text-[12px] text-[var(--ink-muted)]">{subtitle}</span>
        </div>
      </div>
      {actionLabel && onAction && (
        <button
          type="button"
          onClick={onAction}
          className="f3-btn f3-btn-sm f3-btn-outline relative z-10"
        >
          {actionLabel}
        </button>
      )}
    </div>
  );
}

/**
 * Fusion 3 Kolam x Seigaiha Toast Tile
 */
export function KolamToast({
  title,
  subtitle,
  onClose,
}: {
  title: string;
  subtitle: string;
  onClose: () => void;
}) {
  return (
    <div
      className="f3-card fixed bottom-5 right-5 z-50 flex max-w-sm items-center gap-3 p-3"
      role="status"
      aria-live="polite"
    >
      <div
        className="relative flex h-7 w-7 shrink-0 items-center justify-center overflow-hidden rounded-[4px]"
        style={{ backgroundColor: "var(--green-tint)" }}
      >
        <svg
          className="pointer-events-none absolute inset-0 opacity-75"
          width="28"
          height="28"
          viewBox="0 0 28 28"
          fill="none"
        >
          <path d="M0 14 Q7 7 14 14 T28 14" stroke="#ffffff" strokeWidth="1.3" />
          <path d="M0 22 Q7 15 14 22 T28 22" stroke="#ffffff" strokeWidth="1.3" />
          <circle cx="7" cy="10" r="1.1" fill="#ffffff" />
          <circle cx="21" cy="10" r="1.1" fill="#ffffff" />
        </svg>
        <Check size={14} strokeWidth={2.2} style={{ color: "var(--green-text)" }} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="truncate text-[13px] font-semibold text-[var(--ink-strong)]">
          {title}
        </div>
        <div className="truncate text-[12px] text-[var(--ink-faint)]">{subtitle}</div>
      </div>
      <button type="button" onClick={onClose} className="f3-btn f3-btn-xs f3-btn-ghost">
        Dismiss
      </button>
    </div>
  );
}

/**
 * Fusion 3 Halftone Area Sparkline (dots under the curve instead of gradient wash)
 */
export function HalftoneSparkline({
  values,
  color = "#1871da",
  height = 36,
}: {
  values: number[];
  color?: string;
  height?: number;
}) {
  if (!values || values.length < 2) return null;
  const w = 140;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;

  const pts = values.map((v, i) => {
    const x = (i / (values.length - 1)) * (w - 6) + 3;
    const y = height - 4 - ((v - min) / span) * (height - 10);
    return [x, y] as const;
  });

  const linePath = pts.map(([x, y], i) => `${i === 0 ? "M" : "L"} ${x.toFixed(1)} ${y.toFixed(1)}`).join(" ");
  const areaPath = `${linePath} L ${pts[pts.length - 1][0].toFixed(1)} ${height} L ${pts[0][0].toFixed(1)} ${height} Z`;
  const pid = `ht-${color.replace(/[^a-z0-9]/gi, "")}`;

  return (
    <svg width="100%" height={height} viewBox={`0 0 ${w} ${height}`} preserveAspectRatio="none" aria-hidden="true">
      <defs>
        <pattern id={pid} width="4" height="4" patternUnits="userSpaceOnUse">
          <circle cx="2" cy="2" r="0.95" fill={color} fillOpacity="0.45" />
        </pattern>
      </defs>
      <path d={areaPath} fill={`url(#${pid})`} />
      <path d={linePath} fill="none" stroke={color} strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={pts[pts.length - 1][0]} cy={pts[pts.length - 1][1]} r="2.5" fill={color} />
    </svg>
  );
}
