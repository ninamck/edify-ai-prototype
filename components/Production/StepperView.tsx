'use client';

import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Calendar,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Pause,
  Play,
  Settings,
  Sparkles,
  TrendingUp,
  X,
  Boxes,
} from 'lucide-react';
import { usePlan, type PlanLine } from './PlanStore';
import {
  benchesAt,
  PRET_INGREDIENT_USAGE,
  PRET_INGREDIENTS,
  componentPrepWork,
  DEMO_TODAY,
  type Bench,
  type RunSchedule,
  type SiteId,
  type RecipeId,
} from './fixtures';

/**
 * StepperView — "play mode" for a bench during a single production run.
 *
 * Opened from any plan table via {@link StepperLauncher}. Two states:
 *   1. Picker — choose a Bench + Production Run on this site.
 *   2. Active — render the live recipe stepper for that selection,
 *      walking one recipe at a time with ingredients, timer, and a
 *      recipe-card preview on the right.
 *
 * Recipes are pulled from the live PlanStore so manager overrides on the
 * plan tables flow straight through into the stepper.
 */

type Props = {
  open: boolean;
  onClose: () => void;
  siteId: SiteId;
  /** Pre-selected date in YYYY-MM-DD form. Defaults to DEMO_TODAY. */
  date?: string;
};

type IngredientSummary = {
  id: string;
  name: string;
  /** Display-formatted quantity, e.g. "1.2kg", "360 ml", "12 pcs", "5g". */
  display: string;
};

type StepRecipe = {
  /** PlanLine for this recipe on this bench in this run. */
  line: PlanLine;
  ingredients: IngredientSummary[];
  /** Estimated total prep+cook minutes for this batch. */
  expectedMinutes: number;
};

// Time-of-day buckets used when a bench has no scheduled `runs` so we can
// still slice work into pickable "Run 1 / Run 2 / Run 3" buckets. Matches
// the morning / midday / afternoon framing already used elsewhere.
const FALLBACK_RUNS: RunSchedule[] = [
  { id: 'morning',   label: 'Morning',   startTime: '05:30', durationMinutes: 180 },
  { id: 'midday',    label: 'Midday',    startTime: '10:30', durationMinutes: 150 },
  { id: 'afternoon', label: 'Afternoon', startTime: '13:00', durationMinutes: 180 },
];

function hhmmToMins(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
}

function formatDateLong(iso: string): string {
  // "2026-07-04" → "Tuesday, July 4". Falls back to the raw string if the
  // input doesn't parse so we never blow up the header on bad demo data.
  try {
    const d = new Date(iso + 'T00:00:00');
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleDateString('en-GB', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
    });
  } catch {
    return iso;
  }
}

function formatDateShort(iso: string): string {
  // "2026-07-04" → "04.07.2026" — matches the small date pill in the mockup.
  try {
    const d = new Date(iso + 'T00:00:00');
    if (Number.isNaN(d.getTime())) return iso;
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    return `${dd}.${mm}.${d.getFullYear()}`;
  } catch {
    return iso;
  }
}

function formatTimerSeconds(seconds: number): string {
  const safe = Math.max(0, Math.floor(seconds));
  const m = Math.floor(safe / 60);
  const s = safe % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function formatNowHHMM(): string {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

/**
 * Pick which scheduled run a line "belongs to" for the stepper. Same
 * intent as the bench-card board's `pickRunIndex` but trimmed down to
 * what the stepper picker needs: rough phase match against forecast,
 * with a graceful fallback when forecast data is sparse.
 */
function pickRunIdForLine(line: PlanLine, runs: RunSchedule[]): string {
  if (runs.length === 0) return 'morning';
  if (runs.length === 1) return runs[0].id;
  const phases = line.forecast?.byPhase;
  if (phases) {
    const peak = Math.max(phases.morning, phases.midday, phases.afternoon);
    if (peak === phases.morning) {
      // Bias toward earliest run (excluding overnight).
      const earliest = runs.find(r => hhmmToMins(r.startTime) >= 4 * 60) ?? runs[0];
      return earliest.id;
    }
    if (peak === phases.midday) {
      // Closest to noon.
      let best = runs[0];
      let bestDelta = Infinity;
      for (const r of runs) {
        const delta = Math.abs(hhmmToMins(r.startTime) - 11 * 60);
        if (delta < bestDelta) {
          best = r;
          bestDelta = delta;
        }
      }
      return best.id;
    }
    // Afternoon: latest run.
    return [...runs].sort((a, b) => hhmmToMins(b.startTime) - hhmmToMins(a.startTime))[0].id;
  }
  // Tag-based fallback.
  const tags = line.recipe.selectionTags ?? [];
  if (tags.includes('morning') || tags.includes('breakfast')) return runs[0].id;
  if (tags.includes('afternoon') || tags.includes('closing')) return runs[runs.length - 1].id;
  return runs[Math.floor(runs.length / 2)].id;
}

/**
 * Roll an aggregated ingredient list up for one recipe at a target
 * quantity. Walks both the recipe itself and its sub-recipes so an
 * assembly (sandwich, salad) shows the right list. Quantities are
 * formatted to the mockup's style (kg / g / ml / L / pcs).
 */
function ingredientsForLine(line: PlanLine): IngredientSummary[] {
  const recipe = line.recipe;
  const targetUnits = Math.max(1, line.effectivePlanned);
  const recipeIds = new Set<RecipeId>([recipe.id, ...(recipe.subRecipes ?? []).map(s => s.recipeId)]);

  // ingredientId → { name, totalQty, unit }
  const totals = new Map<string, { name: string; total: number; unit: 'g' | 'ml' | 'unit' }>();

  for (const usage of PRET_INGREDIENT_USAGE) {
    if (!recipeIds.has(usage.recipeId)) continue;
    const ingredient = PRET_INGREDIENTS.find(i => i.id === usage.ingredientId);
    // We tolerate missing ingredients defensively — bad demo data
    // shouldn't crash the stepper, just skip the row.
    if (!ingredient) continue;
    let perUnit = usage.quantityPerUnit;
    // Sub-recipe usage scales by the sub-recipe's per-unit consumption
    // on the parent. If we're walking a sub-recipe, find the matching
    // SubRecipeRef and multiply through.
    if (usage.recipeId !== recipe.id) {
      const sub = recipe.subRecipes?.find(s => s.recipeId === usage.recipeId);
      if (sub) perUnit = perUnit * sub.quantityPerUnit;
    }
    const total = perUnit * targetUnits;
    // Use the per-recipe prep-work override / master defaults to nudge
    // the display unit toward what's natural on the bench (whole "pcs"
    // tomatoes vs grams). componentPrepWork itself doesn't change unit
    // — we trust `usage.unit` here.
    componentPrepWork(usage.prepWorkOverride, ingredient);
    const key = usage.ingredientId;
    const existing = totals.get(key);
    if (existing) {
      existing.total += total;
    } else {
      totals.set(key, {
        name: ingredient.name,
        total,
        unit: usage.unit,
      });
    }
  }

  const out: IngredientSummary[] = [];
  for (const [id, { name, total, unit }] of totals.entries()) {
    out.push({
      id,
      name,
      display: formatIngredientQty(total, unit),
    });
  }
  // Sort largest first so the most material ingredients sit at the top
  // of the list (matches the mockup where chicken / dressing / lettuce
  // sit above smaller seasonings).
  out.sort((a, b) => a.name.localeCompare(b.name));
  return out;
}

function formatIngredientQty(total: number, unit: 'g' | 'ml' | 'unit'): string {
  const rounded = Math.round(total * 10) / 10;
  if (unit === 'unit') return `${Math.max(1, Math.round(total))} pcs`;
  if (unit === 'g') {
    if (rounded >= 1000) return `${(rounded / 1000).toFixed(1)}kg`;
    return `${Math.max(1, Math.round(rounded))}g`;
  }
  if (rounded >= 1000) return `${(rounded / 1000).toFixed(1)}L`;
  return `${Math.max(1, Math.round(rounded))} ml`;
}

/** Rough per-recipe time budget — clamped between 5 and 45 minutes so
 *  the "Expected Time" card always feels like a single-recipe estimate
 *  rather than an entire shift. */
function expectedMinutesFor(line: PlanLine): number {
  const units = Math.max(1, line.effectivePlanned);
  // Two-pass heuristic: assemblies pace at ~1.5 min/unit (build, label,
  // pack); bakes pace at ~0.5 min/unit because the oven does most of
  // the work in parallel. We cap so the "Expected Time" card stays
  // readable for big runs.
  const perUnit = (line.recipe.subRecipes?.length ?? 0) > 0 ? 1.5 : 0.5;
  const raw = Math.round(units * perUnit) + 5;
  return Math.min(45, Math.max(5, raw));
}

/** Render the whole stepper modal as a portal so it lives above the
 *  rest of the app chrome (top bar, sub-nav, etc.) without fighting
 *  z-index with sticky table headers. We deliberately offset the
 *  backdrop to the right of the app sidebar so the menu rail stays
 *  visible and clickable while the stepper is open — managers shouldn't
 *  lose their way back to other parts of the app.
 */
export default function StepperView({ open, onClose, siteId, date = DEMO_TODAY }: Props) {
  const benches = useMemo(() => benchesAt(siteId), [siteId]);
  const lines = usePlan(siteId, date);

  const [selectedBenchId, setSelectedBenchId] = useState<string | null>(null);
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);
  const [stepIndex, setStepIndex] = useState(0);
  const [completedIds, setCompletedIds] = useState<Set<string>>(new Set());
  const [startedAt, setStartedAt] = useState<string | null>(null);
  const [timerSeconds, setTimerSeconds] = useState(150); // 02:30 — matches the mockup
  const [paused, setPaused] = useState(false);
  const [pdfPage, setPdfPage] = useState(1);
  const pdfPageCount = 3;

  // Live sidebar width — the modal's left edge tracks this so the rail
  // remains visible whether the sidebar is expanded (240px) or
  // collapsed (68px). Measured on open and on every sidebar resize via
  // ResizeObserver.
  const [sidebarWidth, setSidebarWidth] = useState(240);
  useEffect(() => {
    if (!open) return;
    if (typeof document === 'undefined') return;
    // The shell renders the sidebar as the first <aside> in the doc.
    // If a future layout adds another aside above it we'll need a more
    // specific selector, but right now this is the safest cross-page
    // hook.
    const el = document.querySelector('aside');
    if (!el) return;
    const update = () => setSidebarWidth(el.getBoundingClientRect().width);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [open]);

  // Reset state when the modal closes so reopening doesn't leak the
  // previous bench/run/progress into a fresh session.
  useEffect(() => {
    if (open) return;
    setSelectedBenchId(null);
    setSelectedRunId(null);
    setStepIndex(0);
    setCompletedIds(new Set());
    setStartedAt(null);
    setTimerSeconds(150);
    setPaused(false);
    setPdfPage(1);
  }, [open]);

  // Escape closes the modal; matches the rest of the app's modal pattern.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  // Lock body scroll while the modal is open — the stepper takes the
  // full viewport and we don't want the page underneath scrolling
  // when the user wheels inside one of the columns.
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  // Visible-second tick for the timer. Decrements only while not
  // paused and only after a bench/run has been picked. Lives on the
  // same effect so we can clean it up on close / unmount.
  useEffect(() => {
    if (!open || !selectedBenchId || !selectedRunId || paused) return;
    const id = window.setInterval(() => {
      setTimerSeconds(s => Math.max(0, s - 1));
    }, 1000);
    return () => window.clearInterval(id);
  }, [open, selectedBenchId, selectedRunId, paused]);

  const selectedBench: Bench | null = useMemo(
    () => benches.find(b => b.id === selectedBenchId) ?? null,
    [benches, selectedBenchId],
  );

  // Compose the list of pickable runs for the current bench — either
  // its authored `runs` schedule, or our fallback morning/midday/
  // afternoon split if the bench doesn't define one.
  const runsForSelectedBench: RunSchedule[] = useMemo(() => {
    if (!selectedBench) return [];
    if (selectedBench.runs && selectedBench.runs.length > 0) return selectedBench.runs;
    return FALLBACK_RUNS;
  }, [selectedBench]);

  // Resolve the stepper recipe list for the active bench + run. Lines
  // are bucketed by `pickRunIdForLine` so the manager sees the same
  // recipes that the bench-card board groups into that run.
  const stepRecipes: StepRecipe[] = useMemo(() => {
    if (!selectedBenchId || !selectedRunId) return [];
    const onBench = lines.filter(
      l => l.primaryBench?.id === selectedBenchId && l.effectivePlanned > 0,
    );
    const inRun = onBench.filter(l => pickRunIdForLine(l, runsForSelectedBench) === selectedRunId);
    // Stable sort by recipe category then name — gives the manager a
    // predictable walk-through and matches how the plan table is
    // ordered.
    inRun.sort((a, b) => {
      if (a.recipe.category !== b.recipe.category) {
        return a.recipe.category.localeCompare(b.recipe.category);
      }
      return a.recipe.name.localeCompare(b.recipe.name);
    });
    return inRun.map(line => ({
      line,
      ingredients: ingredientsForLine(line),
      expectedMinutes: expectedMinutesFor(line),
    }));
  }, [selectedBenchId, selectedRunId, lines, runsForSelectedBench]);

  const totalRecipes = stepRecipes.length;
  const currentStep = stepRecipes[stepIndex] ?? null;
  const completedCount = completedIds.size;
  const progressPct = totalRecipes === 0 ? 0 : Math.round((completedCount / totalRecipes) * 100);

  function startStepper(benchId: string, runId: string) {
    setSelectedBenchId(benchId);
    setSelectedRunId(runId);
    setStepIndex(0);
    setCompletedIds(new Set());
    setStartedAt(formatNowHHMM());
    setTimerSeconds(150);
    setPaused(false);
  }

  function stepBack() {
    setStepIndex(i => Math.max(0, i - 1));
    setTimerSeconds(150);
  }

  function stepNext() {
    setStepIndex(i => Math.min(totalRecipes - 1, i + 1));
    setTimerSeconds(150);
  }

  function markComplete() {
    if (!currentStep) return;
    const id = currentStep.line.item.id;
    setCompletedIds(prev => {
      const next = new Set(prev);
      next.add(id);
      return next;
    });
    if (stepIndex < totalRecipes - 1) {
      setStepIndex(stepIndex + 1);
      setTimerSeconds(150);
      setPaused(false);
    }
  }

  if (!open) return null;
  if (typeof document === 'undefined') return null;

  const benchPosition = selectedBench
    ? benches.findIndex(b => b.id === selectedBench.id) + 1
    : null;
  const runIndex = selectedRunId
    ? runsForSelectedBench.findIndex(r => r.id === selectedRunId) + 1
    : null;

  const headerSubtitle =
    selectedBench && selectedRunId
      ? `Production ${runIndex} | Bench ${benchPosition} | ${formatDateLong(date)}`
      : 'Open stepper';

  return createPortal(
    <AnimatePresence>
      <motion.div
        key="stepper-modal"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.18 }}
        style={{
          position: 'fixed',
          top: 0,
          right: 0,
          bottom: 0,
          // Leave the app sidebar visible to the left of the backdrop
          // so the menu rail stays available while the stepper is open.
          left: sidebarWidth,
          // Sits above the sticky production sub-nav (z-index 150) and
          // the shell top bar so the modal owns the rest of the viewport.
          zIndex: 1000,
          // Solid white backdrop frames the stepper with a clean gutter
          // against both the sidebar (left) and the viewport edge
          // (right), so the modal reads as a deliberate panel rather
          // than something pasted against the chrome.
          background: '#ffffff',
          display: 'flex',
          flexDirection: 'column',
          fontFamily: 'var(--font-primary)',
        }}
        onClick={onClose}
      >
        <motion.div
          initial={{ y: 24, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 12, opacity: 0 }}
          transition={{ duration: 0.22, ease: 'easeOut' }}
          onClick={e => e.stopPropagation()}
          style={{
            // 12px white gutter only on the left so it reads as a
            // breathing strip between the menu rail and the stepper.
            // Top / right / bottom hug the viewport edge.
            marginTop: 0,
            marginRight: 0,
            marginBottom: 0,
            marginLeft: 12,
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            borderRadius: 0,
            overflow: 'hidden',
            background: 'var(--color-bg-nav)',
            boxShadow: '0 24px 64px rgba(0,0,0,0.35)',
            minHeight: 0,
          }}
        >
          <StepperTopBar
            subtitle={headerSubtitle}
            date={date}
            onClose={onClose}
            onChangeSelection={
              selectedBenchId && selectedRunId
                ? () => {
                    setSelectedBenchId(null);
                    setSelectedRunId(null);
                  }
                : null
            }
          />

          <div
            style={{
              flex: 1,
              minHeight: 0,
              padding: '12px 16px 16px',
              display: 'flex',
            }}
          >
            {!selectedBenchId || !selectedRunId ? (
              <PickerScreen
                benches={benches}
                lines={lines}
                onPick={startStepper}
              />
            ) : totalRecipes === 0 ? (
              <EmptyState
                bench={selectedBench!}
                onPickAnother={() => {
                  setSelectedBenchId(null);
                  setSelectedRunId(null);
                }}
              />
            ) : (
              <StepperBody
                step={currentStep!}
                stepIndex={stepIndex}
                totalRecipes={totalRecipes}
                completedCount={completedCount}
                progressPct={progressPct}
                startedAt={startedAt ?? '—'}
                timerSeconds={timerSeconds}
                paused={paused}
                onBack={stepBack}
                onNext={stepNext}
                onTogglePause={() => setPaused(p => !p)}
                onComplete={markComplete}
                pdfPage={pdfPage}
                pdfPageCount={pdfPageCount}
                onPdfPrev={() => setPdfPage(p => Math.max(1, p - 1))}
                onPdfNext={() => setPdfPage(p => Math.min(pdfPageCount, p + 1))}
              />
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>,
    document.body,
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Top bar — dark teal strip with date pill / Forecast / settings
// ─────────────────────────────────────────────────────────────────────────────

function StepperTopBar({
  subtitle,
  date,
  onClose,
  onChangeSelection,
}: {
  subtitle: string;
  date: string;
  onClose: () => void;
  onChangeSelection: (() => void) | null;
}) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '16px 24px',
        color: '#ffffff',
        fontFamily: 'var(--font-primary)',
        background: 'var(--color-bg-nav)',
      }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
        <span style={{ fontSize: 15, fontWeight: 700, letterSpacing: '-0.01em' }}>
          {subtitle}
        </span>
        {onChangeSelection && (
          <button
            type="button"
            onClick={onChangeSelection}
            style={{
              alignSelf: 'flex-start',
              border: 'none',
              background: 'transparent',
              color: 'rgba(255,255,255,0.72)',
              cursor: 'pointer',
              fontSize: 11,
              fontWeight: 600,
              padding: 0,
              fontFamily: 'var(--font-primary)',
              textDecoration: 'underline',
            }}
          >
            Change bench or run
          </button>
        )}
      </div>

      <div style={{ flex: 1 }} />

      <DatePill date={date} />

      <button
        type="button"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          padding: '8px 14px',
          borderRadius: 10,
          background: '#ffffff',
          color: 'var(--color-bg-nav)',
          border: 'none',
          fontSize: 12,
          fontWeight: 700,
          fontFamily: 'var(--font-primary)',
          cursor: 'pointer',
        }}
        title="Forecast (preview)"
      >
        Forecast <TrendingUp size={13} />
      </button>

      <button
        type="button"
        aria-label="Stepper settings"
        title="Stepper settings"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: 38,
          height: 38,
          borderRadius: 10,
          background: '#ffffff',
          color: 'var(--color-bg-nav)',
          border: 'none',
          cursor: 'pointer',
        }}
      >
        <Settings size={16} />
      </button>

      <button
        type="button"
        aria-label="Close stepper"
        onClick={onClose}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: 38,
          height: 38,
          borderRadius: 10,
          background: 'transparent',
          color: '#ffffff',
          border: '1px solid rgba(255,255,255,0.25)',
          cursor: 'pointer',
          marginLeft: 4,
        }}
      >
        <X size={16} />
      </button>
    </div>
  );
}

function DatePill({ date }: { date: string }) {
  return (
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 8,
        padding: '8px 14px',
        borderRadius: 10,
        background: '#ffffff',
        color: 'var(--color-bg-nav)',
        fontSize: 12,
        fontWeight: 700,
        fontFamily: 'var(--font-primary)',
        fontVariantNumeric: 'tabular-nums',
      }}
      title={`Stepper date: ${formatDateLong(date)}`}
    >
      {formatDateShort(date)}
      <Calendar size={13} />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Picker — bench grid + run pills
// ─────────────────────────────────────────────────────────────────────────────

function PickerScreen({
  benches,
  lines,
  onPick,
}: {
  benches: Bench[];
  lines: PlanLine[];
  onPick: (benchId: string, runId: string) => void;
}) {
  const [pickedBenchId, setPickedBenchId] = useState<string | null>(null);

  // Pre-compute "recipes on this bench" counts so each bench tile can
  // tell the user how much work it actually has today. Otherwise an
  // empty bench looks the same as a busy one in the picker.
  const benchRecipeCounts = useMemo(() => {
    const map = new Map<string, number>();
    for (const line of lines) {
      const id = line.primaryBench?.id;
      if (!id) continue;
      if (line.effectivePlanned <= 0) continue;
      map.set(id, (map.get(id) ?? 0) + 1);
    }
    return map;
  }, [lines]);

  const pickedBench = pickedBenchId ? benches.find(b => b.id === pickedBenchId) ?? null : null;
  const pickedRuns: RunSchedule[] = !pickedBench
    ? []
    : pickedBench.runs && pickedBench.runs.length > 0
      ? pickedBench.runs
      : FALLBACK_RUNS;

  return (
    <div
      style={{
        flex: 1,
        minHeight: 0,
        display: 'flex',
        flexDirection: 'column',
        background: '#ffffff',
        borderRadius: 14,
        padding: '24px 28px',
        overflow: 'auto',
      }}
    >
      <h2
        style={{
          margin: 0,
          fontSize: 22,
          fontWeight: 800,
          color: 'var(--color-text-primary)',
          letterSpacing: '-0.01em',
        }}
      >
        Pick a bench and production run
      </h2>
      <p
        style={{
          margin: '6px 0 0',
          fontSize: 13,
          color: 'var(--color-text-secondary)',
          maxWidth: 560,
        }}
      >
        The stepper walks one recipe at a time so the person on the bench
        knows exactly what's next. Choose where they're working and which
        scheduled run.
      </p>

      <div style={{ marginTop: 22 }}>
        <SectionLabel>1. Bench</SectionLabel>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
            gap: 10,
            marginTop: 10,
          }}
        >
          {benches.length === 0 && (
            <div style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>
              No benches configured for this site.
            </div>
          )}
          {benches.map(bench => {
            const active = pickedBenchId === bench.id;
            const count = benchRecipeCounts.get(bench.id) ?? 0;
            return (
              <button
                key={bench.id}
                type="button"
                onClick={() => setPickedBenchId(bench.id)}
                style={{
                  textAlign: 'left',
                  border: `1.5px solid ${active ? 'var(--color-bg-nav)' : 'var(--color-border)'}`,
                  background: active ? 'var(--color-bg-hover)' : '#ffffff',
                  borderRadius: 12,
                  padding: '12px 14px',
                  cursor: 'pointer',
                  fontFamily: 'var(--font-primary)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 4,
                  transition: 'border-color 0.15s, background 0.15s',
                }}
              >
                <span
                  style={{
                    fontSize: 13,
                    fontWeight: 700,
                    color: 'var(--color-text-primary)',
                  }}
                >
                  {bench.name}
                </span>
                <span
                  style={{
                    fontSize: 11,
                    color: 'var(--color-text-secondary)',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                  }}
                >
                  {count > 0 ? (
                    <>
                      <Boxes size={11} /> {count} recipe{count === 1 ? '' : 's'} today
                    </>
                  ) : (
                    <span style={{ color: 'var(--color-text-muted)' }}>
                      Nothing planned today
                    </span>
                  )}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div style={{ marginTop: 24 }}>
        <SectionLabel>2. Production run</SectionLabel>
        {!pickedBench && (
          <div style={{ marginTop: 10, fontSize: 12, color: 'var(--color-text-muted)' }}>
            Pick a bench above to see its scheduled runs.
          </div>
        )}
        {pickedBench && (
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: 10,
              marginTop: 10,
            }}
          >
            {pickedRuns.map((run, idx) => (
              <button
                key={run.id}
                type="button"
                onClick={() => onPick(pickedBench.id, run.id)}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '12px 16px',
                  borderRadius: 12,
                  border: '1.5px solid var(--color-border)',
                  background: '#ffffff',
                  color: 'var(--color-text-primary)',
                  fontFamily: 'var(--font-primary)',
                  fontSize: 13,
                  fontWeight: 700,
                  cursor: 'pointer',
                  transition: 'border-color 0.15s, background 0.15s',
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.borderColor = 'var(--color-bg-nav)';
                  e.currentTarget.style.background = 'var(--color-bg-hover)';
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.borderColor = 'var(--color-border)';
                  e.currentTarget.style.background = '#ffffff';
                }}
              >
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: 28,
                    height: 28,
                    borderRadius: 8,
                    background: 'var(--color-bg-nav)',
                    color: '#ffffff',
                    fontSize: 12,
                    fontWeight: 800,
                  }}
                >
                  {idx + 1}
                </span>
                <span style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <span>{run.label || `Run ${idx + 1}`}</span>
                  <span
                    style={{
                      fontSize: 11,
                      fontWeight: 600,
                      color: 'var(--color-text-secondary)',
                    }}
                  >
                    Starts {run.startTime} · {Math.round(run.durationMinutes / 60)}h window
                  </span>
                </span>
                <ChevronRight size={14} color="var(--color-text-secondary)" />
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <span
      style={{
        display: 'inline-block',
        fontSize: 11,
        fontWeight: 700,
        letterSpacing: '0.08em',
        textTransform: 'uppercase',
        color: 'var(--color-text-secondary)',
      }}
    >
      {children}
    </span>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Empty state — bench+run picked but nothing planned
// ─────────────────────────────────────────────────────────────────────────────

function EmptyState({
  bench,
  onPickAnother,
}: {
  bench: Bench;
  onPickAnother: () => void;
}) {
  return (
    <div
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#ffffff',
        borderRadius: 14,
        padding: 32,
        gap: 14,
      }}
    >
      <Sparkles size={36} color="var(--color-text-muted)" />
      <div style={{ textAlign: 'center', maxWidth: 360 }}>
        <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--color-text-primary)' }}>
          Nothing scheduled on {bench.name} for this run
        </div>
        <div style={{ fontSize: 12, color: 'var(--color-text-secondary)', marginTop: 6 }}>
          No recipes were bucketed into the run you picked. Try a different
          run or bench — once work is planned, it'll show here.
        </div>
      </div>
      <button
        type="button"
        onClick={onPickAnother}
        style={{
          padding: '10px 16px',
          borderRadius: 10,
          background: 'var(--color-bg-nav)',
          color: '#ffffff',
          border: 'none',
          fontSize: 12,
          fontWeight: 700,
          cursor: 'pointer',
          fontFamily: 'var(--font-primary)',
        }}
      >
        Change selection
      </button>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Active stepper — recipe walk-through + recipe-card preview
// ─────────────────────────────────────────────────────────────────────────────

function StepperBody({
  step,
  stepIndex,
  totalRecipes,
  completedCount,
  progressPct,
  startedAt,
  timerSeconds,
  paused,
  onBack,
  onNext,
  onTogglePause,
  onComplete,
  pdfPage,
  pdfPageCount,
  onPdfPrev,
  onPdfNext,
}: {
  step: StepRecipe;
  stepIndex: number;
  totalRecipes: number;
  completedCount: number;
  progressPct: number;
  startedAt: string;
  timerSeconds: number;
  paused: boolean;
  onBack: () => void;
  onNext: () => void;
  onTogglePause: () => void;
  onComplete: () => void;
  pdfPage: number;
  pdfPageCount: number;
  onPdfPrev: () => void;
  onPdfNext: () => void;
}) {
  const ingredientCount = step.ingredients.length;

  return (
    <div
      style={{
        flex: 1,
        minHeight: 0,
        display: 'grid',
        gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1.05fr)',
        gap: 16,
      }}
    >
      {/* Left panel — recipe stepper card */}
      <div
        style={{
          background: '#ffffff',
          borderRadius: 14,
          padding: '18px 20px 20px',
          display: 'flex',
          flexDirection: 'column',
          minHeight: 0,
          overflow: 'hidden',
        }}
      >
        <ProgressBar percent={progressPct} />

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 18,
            marginTop: 10,
            fontSize: 12,
            color: 'var(--color-text-secondary)',
          }}
        >
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <CheckCircle2 size={13} color="var(--color-text-secondary)" />
            {completedCount} of {totalRecipes} Recipes completed
          </span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <Clock size={13} color="var(--color-text-secondary)" /> Started at {startedAt}
          </span>
        </div>

        <div
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: 12,
            marginTop: 14,
          }}
        >
          <h1
            style={{
              margin: 0,
              flex: 1,
              fontSize: 26,
              fontWeight: 800,
              letterSpacing: '-0.015em',
              color: 'var(--color-text-primary)',
              lineHeight: 1.15,
            }}
          >
            {step.line.recipe.name}
          </h1>
          <NavArrows
            onBack={onBack}
            onNext={onNext}
            backDisabled={stepIndex === 0}
            nextDisabled={stepIndex >= totalRecipes - 1}
          />
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: 10,
            marginTop: 14,
          }}
        >
          <StatCard
            tone="info"
            label="Quantity"
            icon={<Boxes size={13} />}
            value={`${step.line.effectivePlanned} item${step.line.effectivePlanned === 1 ? '' : 's'}`}
          />
          <StatCard
            tone="warning"
            label="Expected Time"
            icon={<Clock size={13} />}
            value={`${step.expectedMinutes} min`}
          />
        </div>

        <div
          style={{
            marginTop: 16,
            display: 'flex',
            flexDirection: 'column',
            border: '1px solid var(--color-border-subtle)',
            borderRadius: 12,
            overflow: 'hidden',
            background: '#ffffff',
            flex: 1,
            minHeight: 0,
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              padding: '12px 14px',
              borderBottom: '1px solid var(--color-border-subtle)',
            }}
          >
            <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--color-text-primary)' }}>
              Ingredients Needed
            </span>
            <span style={{ flex: 1 }} />
            <span style={{ fontSize: 12, fontWeight: 700, color: '#c2410c' }}>
              {ingredientCount} ingredient{ingredientCount === 1 ? '' : 's'}
            </span>
          </div>
          <div
            style={{
              padding: '6px 8px',
              display: 'flex',
              flexDirection: 'column',
              overflowY: 'auto',
              minHeight: 0,
            }}
          >
            {step.ingredients.length === 0 && (
              <div
                style={{
                  padding: '14px 8px',
                  fontSize: 12,
                  color: 'var(--color-text-muted)',
                }}
              >
                No ingredient mapping for this recipe yet — check the recipe
                card on the right.
              </div>
            )}
            {step.ingredients.map(ing => (
              <IngredientRow key={ing.id} display={ing.display} name={ing.name} />
            ))}
          </div>
        </div>

        <div
          style={{
            marginTop: 14,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '14px 18px',
            border: '1px solid var(--color-border-subtle)',
            borderRadius: 12,
            background: paused ? 'var(--color-bg-hover)' : '#ffffff',
            fontFamily: 'var(--font-primary)',
            fontVariantNumeric: 'tabular-nums',
            fontSize: 22,
            fontWeight: 800,
            color: 'var(--color-text-primary)',
            gap: 10,
          }}
        >
          <Clock size={16} color="var(--color-text-secondary)" />
          {formatTimerSeconds(timerSeconds)}
          {paused && (
            <span
              style={{
                fontSize: 10,
                fontWeight: 700,
                letterSpacing: '0.06em',
                color: 'var(--color-text-secondary)',
                textTransform: 'uppercase',
                marginLeft: 6,
              }}
            >
              Paused
            </span>
          )}
        </div>

        <div
          style={{
            marginTop: 12,
            display: 'grid',
            gridTemplateColumns: '1fr 1.4fr',
            gap: 10,
          }}
        >
          <button
            type="button"
            onClick={onTogglePause}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              padding: '14px 18px',
              borderRadius: 12,
              background: '#ffffff',
              color: 'var(--color-text-primary)',
              border: '1.5px solid var(--color-border)',
              fontSize: 14,
              fontWeight: 700,
              fontFamily: 'var(--font-primary)',
              cursor: 'pointer',
            }}
          >
            {paused ? <Play size={15} /> : <Pause size={15} />}
            {paused ? 'Resume' : 'Pause'}
          </button>
          <button
            type="button"
            onClick={onComplete}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              padding: '14px 18px',
              borderRadius: 12,
              background: 'var(--color-success)',
              color: '#ffffff',
              border: 'none',
              fontSize: 14,
              fontWeight: 800,
              fontFamily: 'var(--font-primary)',
              cursor: 'pointer',
            }}
          >
            <CheckCircle2 size={16} /> Complete
          </button>
        </div>
      </div>

      {/* Right panel — recipe card preview (PDF stand-in) */}
      <RecipeCardPanel
        recipeName={step.line.recipe.name}
        ingredients={step.ingredients}
        page={pdfPage}
        pageCount={pdfPageCount}
        onPrev={onPdfPrev}
        onNext={onPdfNext}
      />
    </div>
  );
}

function ProgressBar({ percent }: { percent: number }) {
  return (
    <div
      style={{
        height: 6,
        borderRadius: 999,
        background: 'var(--color-bg-hover)',
        overflow: 'hidden',
        position: 'relative',
      }}
    >
      <div
        style={{
          width: `${Math.min(100, Math.max(0, percent))}%`,
          height: '100%',
          background: 'var(--color-success)',
          transition: 'width 0.3s ease',
        }}
      />
    </div>
  );
}

function NavArrows({
  onBack,
  onNext,
  backDisabled,
  nextDisabled,
}: {
  onBack: () => void;
  onNext: () => void;
  backDisabled: boolean;
  nextDisabled: boolean;
}) {
  return (
    <div style={{ display: 'inline-flex', gap: 6 }}>
      <button
        type="button"
        onClick={onBack}
        disabled={backDisabled}
        aria-label="Previous recipe"
        style={{
          width: 36,
          height: 36,
          borderRadius: 10,
          background: backDisabled ? 'var(--color-bg-hover)' : '#ffffff',
          color: 'var(--color-text-primary)',
          border: '1px solid var(--color-border)',
          cursor: backDisabled ? 'not-allowed' : 'pointer',
          opacity: backDisabled ? 0.5 : 1,
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <ChevronLeft size={16} />
      </button>
      <button
        type="button"
        onClick={onNext}
        disabled={nextDisabled}
        aria-label="Next recipe"
        style={{
          width: 36,
          height: 36,
          borderRadius: 10,
          background: nextDisabled ? 'var(--color-bg-hover)' : 'var(--color-bg-nav)',
          color: nextDisabled ? 'var(--color-text-muted)' : '#ffffff',
          border: 'none',
          cursor: nextDisabled ? 'not-allowed' : 'pointer',
          opacity: nextDisabled ? 0.6 : 1,
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <ChevronRight size={16} />
      </button>
    </div>
  );
}

function StatCard({
  tone,
  label,
  icon,
  value,
}: {
  tone: 'info' | 'warning';
  label: string;
  icon: React.ReactNode;
  value: string;
}) {
  const palette =
    tone === 'info'
      ? { bg: '#eef5fa', label: '#0f5e8a', value: 'var(--color-text-primary)' }
      : { bg: '#fdeadc', label: '#9a3a0a', value: 'var(--color-text-primary)' };
  return (
    <div
      style={{
        background: palette.bg,
        borderRadius: 12,
        padding: '12px 14px',
        display: 'flex',
        flexDirection: 'column',
        gap: 6,
      }}
    >
      <span style={{ fontSize: 11, fontWeight: 700, color: palette.label }}>{label}</span>
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          fontSize: 17,
          fontWeight: 800,
          color: palette.value,
        }}
      >
        {icon}
        {value}
      </span>
    </div>
  );
}

function IngredientRow({ display, name }: { display: string; name: string }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '8px 8px',
        borderRadius: 8,
      }}
    >
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '6px 12px',
          minWidth: 60,
          borderRadius: 999,
          background: '#fde6cf',
          color: '#7a3800',
          fontSize: 12,
          fontWeight: 800,
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        {display}
      </span>
      <span
        style={{
          fontSize: 13,
          fontWeight: 600,
          color: 'var(--color-text-primary)',
        }}
      >
        {name}
      </span>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Right column — recipe card preview (PDF stand-in)
// ─────────────────────────────────────────────────────────────────────────────

function RecipeCardPanel({
  recipeName,
  ingredients,
  page,
  pageCount,
  onPrev,
  onNext,
}: {
  recipeName: string;
  ingredients: IngredientSummary[];
  page: number;
  pageCount: number;
  onPrev: () => void;
  onNext: () => void;
}) {
  return (
    <div
      style={{
        background: '#ffffff',
        borderRadius: 14,
        padding: '18px 20px 20px',
        display: 'flex',
        flexDirection: 'column',
        minHeight: 0,
        overflow: 'hidden',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
          <span
            style={{
              fontSize: 14,
              fontWeight: 700,
              color: 'var(--color-text-primary)',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {recipeName} Recipe.pdf
          </span>
          <span style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>
            {page} / {pageCount}
          </span>
        </div>
        <span style={{ flex: 1 }} />
        <NavArrows
          onBack={onPrev}
          onNext={onNext}
          backDisabled={page <= 1}
          nextDisabled={page >= pageCount}
        />
      </div>

      <div
        style={{
          flex: 1,
          minHeight: 0,
          marginTop: 14,
          border: '1px solid var(--color-border-subtle)',
          borderRadius: 10,
          background: '#ffffff',
          overflow: 'auto',
        }}
      >
        <RecipeCardPage recipeName={recipeName} ingredients={ingredients} page={page} />
      </div>
    </div>
  );
}

function RecipeCardPage({
  recipeName,
  ingredients,
  page,
}: {
  recipeName: string;
  ingredients: IngredientSummary[];
  page: number;
}) {
  // 3 pages of static "printed recipe" content. Page 1 = overview +
  // ingredient table; Page 2 = preparation; Page 3 = assembly & QA.
  // Keeps the demo grounded: real ingredient list on page 1, static
  // copy on the others so the navigation feels real.
  return (
    <div
      style={{
        padding: '24px 28px',
        fontFamily: 'var(--font-primary)',
        color: '#1a1a1a',
      }}
    >
      <div
        style={{
          textAlign: 'center',
          fontSize: 14,
          fontWeight: 800,
          textTransform: 'uppercase',
          letterSpacing: '0.04em',
          paddingBottom: 12,
          borderBottom: '1px solid #d4d4d4',
        }}
      >
        Restaurant Kitchen Recipe: {recipeName}
      </div>

      {page === 1 && (
        <>
          <p style={{ fontSize: 11.5, lineHeight: 1.55, marginTop: 14 }}>
            This Standard Recipe (the &ldquo;Recipe&rdquo;) is to be used by
            all kitchen staff for the preparation and assembly of the{' '}
            {recipeName}. Follow all instructions precisely for consistency.
          </p>
          <div
            style={{
              fontSize: 11.5,
              lineHeight: 1.6,
              marginTop: 10,
            }}
          >
            <strong>Date:</strong> [Current Date]
            <br />
            <strong>Prep Time:</strong> 20 min
            <br />
            <strong>Cook Time:</strong> 15 min
            <br />
            <strong>Yield:</strong> 1 portion
            <br />
            <strong>Station:</strong> Cold Prep / Grill
          </div>

          <h3
            style={{
              fontSize: 12,
              fontWeight: 800,
              textTransform: 'uppercase',
              letterSpacing: '0.04em',
              marginTop: 18,
              marginBottom: 8,
            }}
          >
            Ingredients & Quantities
          </h3>
          <table
            style={{
              width: '100%',
              borderCollapse: 'collapse',
              fontSize: 11.5,
            }}
          >
            <thead>
              <tr>
                <th style={recipeTableHeadStyle}>INGREDIENT</th>
                <th style={recipeTableHeadStyle}>QUANTITY</th>
                <th style={recipeTableHeadStyle}>UNIT</th>
              </tr>
            </thead>
            <tbody>
              {ingredients.length === 0 ? (
                <tr>
                  <td colSpan={3} style={recipeTableCellStyle}>
                    <em>No ingredient mapping for this recipe yet.</em>
                  </td>
                </tr>
              ) : (
                ingredients.map(ing => (
                  <tr key={ing.id}>
                    <td style={recipeTableCellStyle}>{ing.name}</td>
                    <td style={recipeTableCellStyle}>
                      {parseDisplayQty(ing.display).qty}
                    </td>
                    <td style={recipeTableCellStyle}>
                      {parseDisplayQty(ing.display).unit}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </>
      )}

      {page === 2 && (
        <>
          <h3 style={recipeHeadingStyle}>Preparation Instructions</h3>
          <ol style={{ fontSize: 11.5, lineHeight: 1.7, paddingLeft: 18 }}>
            <li>
              <strong>Mise en place.</strong> Pull all chilled components and
              check temperature on arrival. Discard anything outside the
              02&ndash;05&deg;C window.
            </li>
            <li>
              <strong>Weigh-up.</strong> Confirm the listed quantities against
              the recipe&apos;s production target.
            </li>
            <li>
              <strong>Cook / assemble.</strong> Cook proteins to internal
              temperature; portion components per the listed yield.
            </li>
            <li>
              <strong>Label.</strong> Apply station label with the produced-on
              time + day-dot.
            </li>
          </ol>
        </>
      )}

      {page === 3 && (
        <>
          <h3 style={recipeHeadingStyle}>Assembly & Quality Checks</h3>
          <ol style={{ fontSize: 11.5, lineHeight: 1.7, paddingLeft: 18 }}>
            <li>Lay base evenly across the build surface.</li>
            <li>Layer in proteins and produce; finish with sauces / dressings last.</li>
            <li>Pack, label, and date.</li>
          </ol>
          <h3 style={recipeHeadingStyle}>QA Sign-off</h3>
          <p style={{ fontSize: 11.5, lineHeight: 1.7 }}>
            The shift lead must visually inspect the first three units off the
            line and sign the PCR card before further units leave the bench.
          </p>
        </>
      )}
    </div>
  );
}

const recipeHeadingStyle: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 800,
  textTransform: 'uppercase',
  letterSpacing: '0.04em',
  marginTop: 16,
  marginBottom: 8,
};

const recipeTableHeadStyle: React.CSSProperties = {
  textAlign: 'left',
  border: '1px solid #6f6f6f',
  background: '#f0f0f0',
  padding: '6px 8px',
  fontSize: 10.5,
  fontWeight: 800,
};

const recipeTableCellStyle: React.CSSProperties = {
  textAlign: 'left',
  border: '1px solid #6f6f6f',
  padding: '5px 8px',
  fontSize: 11,
};

/** Split a formatted ingredient string ("1.2kg" / "360 ml" / "12 pcs")
 *  into qty + unit for the printed recipe table. */
function parseDisplayQty(display: string): { qty: string; unit: string } {
  const match = display.match(/^([0-9.,]+)\s*(.*)$/);
  if (!match) return { qty: display, unit: '' };
  return { qty: match[1], unit: match[2] || '' };
}
