'use client';

/**
 * CrewLineDisplay — the Burger King crew line, built as a DROP CLOCK.
 *
 * A hot-production restaurant runs on 15-minute drops. The whole screen is
 * organised around the next drop, so a crew member glancing up from the line
 * always knows two things instantly:
 *
 *   1. How long until the next drop  (the big countdown — the hero).
 *   2. Exactly what to cook, in real burger counts, on which station.
 *
 * Three concrete blocks, never abstract:
 *   • DROP NOW   — a shortfall the system needs covered this second (only
 *                  appears when demand outruns the cabinet — e.g. a surge).
 *   • ON THE LINE — batches broiling right now, each with a live cook timer.
 *   • NEXT DROP   — the plan for the upcoming window so the crew can pace.
 *
 * A thin cabinet strip along the bottom shows what's being held and how fresh
 * it is, and a quiet Quinn banner explains any re-cut. Everything is driven by
 * the simulated closed loop in `crewLoopStore`.
 *
 * Themeable: a `dark` (kitchen screen) and a `light` (white background)
 * palette, toggled from the transport row. Colour meaning is identical in
 * both — red = act now, blue = cooking, green = fresh/ready — only the
 * surfaces and text invert.
 */

import { useState, createContext, useContext } from 'react';
import { createPortal } from 'react-dom';
import {
  Pause,
  Play,
  RotateCcw,
  Flame,
  SkipForward,
  Plus,
  Maximize2,
  Minimize2,
  Sun,
  Moon,
  RefreshCw,
  X,
  SlidersHorizontal,
  ChevronDown,
  Trash2,
  Radar,
  Check,
} from 'lucide-react';
import {
  useCrewLoop,
  type DropItem,
  type HeldDisplay,
  type RecutTone,
  type RecutLogEntry,
  type RadarItem,
} from './crewLoopStore';
import { minutesToHHMM } from './time';
import {
  useCookTimers,
  remainingSeconds,
  clearAllCookTimers,
  startCookTimer,
  addToCookTimer,
} from './cookTimerStore';
import StepperViewBK from './StepperViewBK';
import QtyStepper, { getStepperValueStyle } from './QtyStepper';
import { getRecipe } from './fixtures';
import { bkStationForRecipe, BK_BROILER_ID, BK_CREW_STEPS, BK_LINES, type BkStation } from './bkFixtures';
import type { RecipeId, SiteId } from './fixtures';

// ─────────────────────────────────────────────────────────────────────────────
// Theme — one palette object per mode, read through context so subcomponents
// don't need a prop chain. Accent *meaning* is constant; on the light palette
// the accents are darkened so they stay legible on white.
// ─────────────────────────────────────────────────────────────────────────────

type Mode = 'dark' | 'light';

interface Palette {
  mode: Mode;
  appBg: string;
  text: string;
  textSecondary: string;
  textMuted: string;
  textFaint: string;
  border: string;
  borderCard: string;
  borderStrong: string;
  surface: string;
  surfaceSubtle: string;
  chip: string;
  track: string;
  cardShadow: string;
  heroBg: string;
  heroImminentBg: string;
  cookStripBg: string;
  infoBg: string;
  sectionLabel: string;
  urgent: string;
  urgentSoft: string;
  urgentSurface: string;
  urgentBorder: string;
  accent: string;
  accentSolid: string;
  accentChipBg: string;
  accentChipFg: string;
  green: string;
  greenSurface: string;
  paused: string;
  onAccent: string;
}

const PALETTES: Record<Mode, Palette> = {
  dark: {
    mode: 'dark',
    appBg: '#0b0c0f',
    text: '#ffffff',
    textSecondary: 'rgba(255,255,255,0.6)',
    textMuted: 'rgba(255,255,255,0.45)',
    textFaint: 'rgba(255,255,255,0.35)',
    border: 'rgba(255,255,255,0.08)',
    borderCard: 'rgba(255,255,255,0.09)',
    borderStrong: 'rgba(255,255,255,0.2)',
    surface: 'rgba(255,255,255,0.045)',
    surfaceSubtle: 'rgba(255,255,255,0.02)',
    chip: 'rgba(255,255,255,0.06)',
    track: 'rgba(255,255,255,0.12)',
    cardShadow: 'none',
    heroBg: 'rgba(255,255,255,0.03)',
    heroImminentBg: 'linear-gradient(90deg, rgba(245,91,74,0.18), rgba(123,116,230,0.12))',
    cookStripBg: 'rgba(123,116,230,0.10)',
    infoBg: 'rgba(255,255,255,0.08)',
    sectionLabel: 'rgba(255,255,255,0.9)',
    urgent: '#ff7a68',
    urgentSoft: '#ffb4a8',
    urgentSurface: 'rgba(245,91,74,0.10)',
    urgentBorder: 'rgba(245,91,74,0.55)',
    accent: '#7b74e6',
    accentSolid: '#191484',
    accentChipBg: 'rgba(123,116,230,0.2)',
    accentChipFg: '#b9b4f5',
    green: '#3ec07a',
    greenSurface: 'rgba(62,192,122,0.12)',
    paused: '#9aa0aa',
    onAccent: '#ffffff',
  },
  light: {
    mode: 'light',
    appBg: '#f4f5f7',
    text: '#16181d',
    textSecondary: 'rgba(0,0,0,0.6)',
    textMuted: 'rgba(0,0,0,0.5)',
    textFaint: 'rgba(0,0,0,0.4)',
    border: 'rgba(0,0,0,0.1)',
    borderCard: 'rgba(0,0,0,0.12)',
    borderStrong: 'rgba(0,0,0,0.2)',
    surface: '#ffffff',
    surfaceSubtle: 'rgba(0,0,0,0.025)',
    chip: '#ffffff',
    track: 'rgba(0,0,0,0.1)',
    cardShadow: '0 1px 2px rgba(0,0,0,0.06)',
    heroBg: '#ffffff',
    heroImminentBg: 'linear-gradient(90deg, rgba(214,35,0,0.10), rgba(25,20,132,0.10))',
    cookStripBg: 'rgba(25,20,132,0.08)',
    infoBg: 'rgba(0,0,0,0.05)',
    sectionLabel: 'rgba(0,0,0,0.85)',
    urgent: '#d62300',
    urgentSoft: '#d62300',
    urgentSurface: 'rgba(214,35,0,0.06)',
    urgentBorder: 'rgba(214,35,0,0.4)',
    accent: '#191484',
    accentSolid: '#191484',
    accentChipBg: 'rgba(25,20,132,0.12)',
    accentChipFg: '#191484',
    green: '#1f9d57',
    greenSurface: 'rgba(62,192,122,0.16)',
    paused: '#6b7280',
    onAccent: '#ffffff',
  },
};

const ThemeContext = createContext<Palette>(PALETTES.dark);
const useTheme = () => useContext(ThemeContext);

// Every component a line can cook, for the manual "add a large order" picker —
// scoped to the active line so the order matches the screen you're on.
type OrderRecipe = { recipeId: RecipeId; name: string; stationName: string; accent: string };
function orderRecipesForLine(line: BkStation): OrderRecipe[] {
  return line.recipeIds.map(rid => ({
    recipeId: rid,
    name: getRecipe(rid)?.name ?? rid,
    stationName: line.name,
    accent: line.accent,
  }));
}

export default function CrewLineDisplay({ siteId: _siteId }: { siteId: SiteId }) {
  const loop = useCrewLoop();
  const timers = useCookTimers();
  const [stepperRecipe, setStepperRecipe] = useState<RecipeId | null>(null);
  const [cookQty, setCookQty] = useState(1);
  const [fullscreen, setFullscreen] = useState(false);
  const [mode, setMode] = useState<Mode>('light');
  const [orderOpen, setOrderOpen] = useState(false);
  const [orderQtys, setOrderQtys] = useState<Record<string, number>>({});
  // Which crew screen is showing. BK runs three: Burgers / Chicken & fish /
  // Sides — switched from the demo controls.
  const [lineId, setLineId] = useState<string>(BK_LINES[0].id);
  const pal = PALETTES[mode];

  const line = BK_LINES.find(l => l.id === lineId) ?? BK_LINES[0];
  const lineRecipes = new Set<RecipeId>(line.recipeIds);
  const inLine = (recipeId: RecipeId) => lineRecipes.has(recipeId);
  const orderRecipes = orderRecipesForLine(line);
  // "Sold today" scoped to the items on this screen.
  const lineSold = line.recipeIds.reduce((a, rid) => a + (loop.soldByRecipe[rid] ?? 0), 0);
  const cook = (recipeId: RecipeId, qty = 1) => {
    setStepperRecipe(recipeId);
    setCookQty(qty);
  };

  // Crew-started batches move through a two-state lifecycle the crew watches:
  // while the cook timer runs the batch sits in DROP NOW with a live mm:ss
  // cooking cue; once it lands ('done') it drops straight into the CABINET and
  // ages on its hold-life. These are layered on top of the auto-driven loop.
  const crewCooking: DropItem[] = timers
    .filter(t => t.status !== 'done' && inLine(t.recipeId))
    .map(t => {
      const recipe = getRecipe(t.recipeId);
      const st = bkStationForRecipe(t.recipeId);
      const secs = remainingSeconds(t);
      return {
        id: `crew-${t.recipeId}`,
        recipeId: t.recipeId,
        name: recipe?.name ?? t.recipeId,
        count: t.qty,
        stationId: st?.id ?? '',
        stationName: st?.name ?? 'Broiler',
        stationAccent: st?.accent ?? '#d62300',
        cookMinutes: Math.ceil(t.totalSeconds / 60),
        readyInMin: Math.ceil(secs / 60),
        surged: false,
        crew: true,
        liveSeconds: secs,
      } as DropItem;
    });

  // Crew-cooked batches age on the wall clock. Past their hold they stay in the
  // cabinet flagged WASTE (so the crew can pull them), then drop off after a
  // grace window — mirroring the auto-loop's waste behaviour.
  const CREW_WASTE_GRACE_MIN = 20;
  const crewCabinet: HeldDisplay[] = timers
    .filter(t => t.status === 'done' && inLine(t.recipeId))
    .map(t => {
      const recipe = getRecipe(t.recipeId);
      const shelfLifeMin = recipe?.shelfLifeMinutes ?? 20;
      const agedMin = t.doneAt ? (Date.now() - t.doneAt) / 60000 : 0;
      const leftMin = shelfLifeMin - agedMin;
      return {
        id: `crew-${t.recipeId}`,
        recipeId: t.recipeId,
        name: recipe?.name ?? t.recipeId,
        count: t.qty,
        expiresInMin: Math.max(0, Math.round(leftMin)),
        shelfLifeMin,
        expired: leftMin <= 0,
        _overdueMin: -leftMin,
      } as HeldDisplay & { _overdueMin: number };
    })
    .filter(h => (h as HeldDisplay & { _overdueMin: number })._overdueMin <= CREW_WASTE_GRACE_MIN);

  // Everything cooking right now (crew-started + the loop's own auto-drops),
  // de-duped so a recipe shows once. These render in the "Drop now" area with
  // a cooking cue; when a cook finishes it drops straight into the cabinet.
  const crewCookingIds = new Set(crewCooking.map(i => i.recipeId));
  const cooking = [
    ...crewCooking,
    ...loop.cooking.filter(c => inLine(c.recipeId) && !crewCookingIds.has(c.recipeId)),
  ];
  const cookingIds = new Set(cooking.map(i => i.recipeId));
  // Shortfall still needing a cook — anything not already cooking. These get a
  // Start button.
  const toStart = loop.dropNow.filter(d => inLine(d.recipeId) && !cookingIds.has(d.recipeId));
  // Waste-now items lead the cabinet, then freshest-expiring first.
  const cabinet = [...crewCabinet, ...loop.cabinet.filter(c => inLine(c.recipeId))].sort((a, b) => {
    if (a.expired !== b.expired) return a.expired ? -1 : 1;
    return a.expiresInMin - b.expiresInMin;
  });

  // The flame-broil step for a recipe — the cook timer keys to it so that if the
  // crew open the steps later, the running timer lines up with the cook step.
  const cookStepFor = (recipeId: RecipeId) => {
    const steps = BK_CREW_STEPS[recipeId] ?? [];
    const cookStep = steps.find(s => s.workType === 'grill') ?? steps[0];
    return { seconds: cookStep?.seconds ?? 240, stepId: cookStep?.label ?? 'Cook' };
  };

  // Start a cook straight from the card (no step walkthrough needed on the line).
  const startCook = (item: DropItem) => {
    const { seconds, stepId } = cookStepFor(item.recipeId);
    startCookTimer(item.recipeId, stepId, stepId, seconds, item.count);
  };

  const bumpOrderQty = (recipeId: RecipeId, delta: number) =>
    setOrderQtys(prev => ({ ...prev, [recipeId]: Math.max(0, (prev[recipeId] ?? 0) + delta) }));

  // Manual "large order just came in": drop extra batches onto the line now —
  // any number of recipes in one go (the automatic loop does this too, via
  // Quinn's re-cuts). Stacks onto an in-flight cook if one's already broiling.
  const addLargeOrder = () => {
    let added = false;
    for (const r of orderRecipes) {
      const qty = orderQtys[r.recipeId] ?? 0;
      if (qty <= 0) continue;
      const { seconds, stepId } = cookStepFor(r.recipeId);
      addToCookTimer(r.recipeId, stepId, stepId, seconds, qty);
      added = true;
    }
    if (added) setOrderOpen(false);
  };

  const openOrder = () => {
    setOrderQtys({});
    setOrderOpen(true);
  };

  const resetAll = () => {
    loop.reset();
    clearAllCookTimers();
  };

  const elapsedFrac = Math.max(
    0,
    Math.min(1, (loop.dropIntervalMin - loop.minsToNextDrop) / loop.dropIntervalMin),
  );
  const imminent = loop.minsToNextDrop <= 2;

  const content = (
    <ThemeContext.Provider value={pal}>
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          // Fit one screen — never scroll. Full screen sits above the app
          // chrome (header + production sub-nav) so the line is all you see.
          // `relative` (embedded) / `fixed` (full screen) both anchor the FAB
          // and order overlay.
          ...(fullscreen
            ? { position: 'fixed', inset: 0, zIndex: 9999, height: '100vh', width: '100vw' }
            : { position: 'relative', height: '100%' }),
          minHeight: 0,
          overflow: 'hidden',
          background: pal.appBg,
          color: pal.text,
          fontFamily: 'var(--font-primary)',
        }}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            padding: '10px 22px',
            borderBottom: `1px solid ${pal.border}`,
          }}
        >
          <span style={{ width: 9, height: 9, borderRadius: '50%', background: line.accent, flexShrink: 0 }} />
          <span
            style={{
              fontSize: 13,
              fontWeight: 800,
              letterSpacing: '0.04em',
              textTransform: 'uppercase',
              color: pal.text,
            }}
          >
            {line.name}
          </span>
          <span
            style={{
              fontSize: 11,
              fontWeight: 600,
              color: pal.textFaint,
              whiteSpace: 'nowrap',
            }}
          >
            line
          </span>
          <span style={{ fontSize: 20, fontWeight: 800, fontVariantNumeric: 'tabular-nums', marginLeft: 4 }}>
            {loop.nowHHMM}
          </span>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, marginLeft: 12 }}>
            <SyncBadge
              label="POS synced"
              detail={`· BK POS · ${loop.nowHHMM}`}
              title={
                'Live sales synced from the Burger King POS (drive-thru, kiosk & app). ' +
                'Auto-syncs every 15 min.'
              }
            />
            <SyncBadge
              label="Forecast synced"
              detail={`· ${loop.nowHHMM}`}
              title={
                'Demand forecast synced. Blends 4-week sales history, local events and ' +
                'weather. Auto-syncs every 15 min.'
              }
            />
          </div>
          <div style={{ flex: 1 }} />
          {/* All the demo plumbing (step the clock, auto-play, theme, full
              screen, reset) tucked into one menu so the line reads like a real
              floor screen, not a control panel. */}
          <DemoMenu
            mode={mode}
            onToggleMode={() => setMode(m => (m === 'dark' ? 'light' : 'dark'))}
            playing={loop.playing}
            atEnd={loop.atEnd}
            onStep5={() => loop.step(5)}
            onNextDrop={loop.stepToNextDrop}
            onTogglePlay={loop.togglePlay}
            onReset={resetAll}
            fullscreen={fullscreen}
            onToggleFullscreen={() => setFullscreen(f => !f)}
            lineId={lineId}
            onSelectLine={setLineId}
          />
        </div>

        {/* Quinn — persistent presence: current call, recent history + radar */}
        <QuinnStrip recutLog={loop.recutLog} radar={loop.radar} />

        {/* HERO — the drop clock, kept to a compact bar */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 16,
            padding: '10px 24px',
            background: imminent ? pal.heroImminentBg : pal.heroBg,
            borderBottom: `1px solid ${pal.border}`,
          }}
        >
          <span
            style={{
              fontSize: 11,
              fontWeight: 800,
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
              color: imminent ? pal.urgentSoft : pal.textMuted,
              whiteSpace: 'nowrap',
            }}
          >
            {imminent ? 'Drop incoming' : 'Next drop'}
          </span>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 5 }}>
            <span
              style={{
                fontSize: 32,
                fontWeight: 900,
                lineHeight: 1,
                fontVariantNumeric: 'tabular-nums',
                color: imminent ? pal.urgent : pal.text,
              }}
            >
              {loop.minsToNextDrop}
            </span>
            <span style={{ fontSize: 14, fontWeight: 700, color: pal.textSecondary }}>min</span>
          </div>

          <div
            style={{
              flex: 1,
              height: 6,
              borderRadius: 3,
              background: pal.track,
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                width: `${elapsedFrac * 100}%`,
                height: '100%',
                background: imminent ? pal.urgent : pal.accent,
                transition: 'width 0.6s linear',
              }}
            />
          </div>

          <span
            style={{ fontSize: 12, fontWeight: 500, color: pal.textSecondary, whiteSpace: 'nowrap' }}
          >
            Drop at{' '}
            <strong style={{ color: pal.text, fontVariantNumeric: 'tabular-nums' }}>
              {loop.nextDropHHMM}
            </strong>
          </span>
        </div>

        {/* MAIN — cook instructions. Fits one screen when there's little on,
            but when a section (esp. "Coming up") grows past the viewport the
            area scrolls instead of clipping, so nothing stays hidden. */}
        <div
          style={{
            flex: 1,
            minHeight: 0,
            overflow: 'auto',
            display: 'flex',
            flexDirection: 'column',
            gap: 14,
            padding: '16px 24px',
          }}
        >
          {/* CABINET — the hero of this screen: what's ready to serve right
              now. Cooks land here the moment they finish. */}
          <CabinetSection cabinet={cabinet} sold={lineSold} />

          {(toStart.length > 0 || cooking.length > 0 || line.id !== BK_BROILER_ID) && (
            <Section
              label="Drop now"
              tone={toStart.length > 0 ? 'urgent' : undefined}
              hint="Hit Start — it moves to the cabinet when it's cooked"
            >
              {toStart.length === 0 && cooking.length === 0 ? (
                <Empty>Cabinet covered · next drop {loop.nextDropHHMM}</Empty>
              ) : (
                <CardGrid>
                  {toStart.map(item => (
                    <DropCard
                      key={item.id}
                      item={item}
                      variant="start"
                      onCook={cook}
                      onStart={startCook}
                    />
                  ))}
                  {cooking.map(item => (
                    <DropCard key={item.id} item={item} variant="cooking" onCook={cook} />
                  ))}
                </CardGrid>
              )}
            </Section>
          )}

          <Section
            label={`Coming up · ${loop.nextDropHHMM}`}
            hint="Expected demand next 15 min — pace for it"
            tone="muted"
          >
            {loop.nextDrop.filter(item => inLine(item.recipeId)).length === 0 ? (
              <Empty>Quiet window ahead</Empty>
            ) : (
              <CardGrid>
                {loop.nextDrop.filter(item => inLine(item.recipeId)).map(item => (
                  <DropCard
                    key={item.id}
                    item={item}
                    variant="next"
                    onCook={cook}
                    onStart={startCook}
                  />
                ))}
              </CardGrid>
            )}
          </Section>
        </div>

        {/* Big manual hook for a large order landing — the crew can drop an
            extra batch even when the forecast didn't see it coming. */}
        <button
          type="button"
          onClick={openOrder}
          style={{
            position: 'absolute',
            right: 24,
            bottom: 24,
            zIndex: 20,
            display: 'inline-flex',
            alignItems: 'center',
            gap: 9,
            padding: '15px 24px',
            borderRadius: 100,
            border: 'none',
            background: pal.accentSolid,
            color: pal.onAccent,
            fontSize: 16,
            fontWeight: 800,
            fontFamily: 'var(--font-primary)',
            cursor: 'pointer',
            boxShadow: '0 8px 24px rgba(0,0,0,0.28)',
          }}
        >
          <Plus size={20} /> Add order
        </button>

        <AddOrderModal
          open={orderOpen}
          recipes={orderRecipes}
          lineName={line.name}
          qtys={orderQtys}
          onBump={bumpOrderQty}
          onConfirm={addLargeOrder}
          onClear={() => setOrderQtys({})}
          onClose={() => setOrderOpen(false)}
        />

        <StepperViewBK
          recipeId={stepperRecipe}
          cookQty={cookQty}
          onClose={() => setStepperRecipe(null)}
        />
      </div>
    </ThemeContext.Provider>
  );

  // In full screen, portal to <body> so the overlay escapes the app shell
  // (sidebar / header / sub-nav) and any transformed ancestor — `position:
  // fixed` alone anchors to a transformed parent, which is why it clipped.
  if (fullscreen && typeof document !== 'undefined') {
    return createPortal(content, document.body);
  }
  return content;
}

// ─────────────────────────────────────────────────────────────────────────────
// Section wrapper
// ─────────────────────────────────────────────────────────────────────────────

function Section({
  label,
  hint,
  tone,
  children,
}: {
  label: string;
  hint?: string;
  tone?: 'urgent' | 'muted';
  children: React.ReactNode;
}) {
  const pal = useTheme();
  const labelColor =
    tone === 'urgent' ? pal.urgent : tone === 'muted' ? pal.textFaint : pal.sectionLabel;
  return (
    // flexShrink:0 — keep each section at its natural height. Without it the
    // flex column compresses sections when content grows (e.g. a batch lands on
    // the line), and the fixed-height cards overflow and overlap the next block.
    <div style={{ flexShrink: 0, display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 8 }}>
        <span
          style={{
            fontSize: 13,
            fontWeight: 800,
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
            color: labelColor,
          }}
        >
          {label}
        </span>
        {hint && <span style={{ fontSize: 12, color: pal.textFaint }}>{hint}</span>}
      </div>
      <div style={{ minHeight: 0 }}>{children}</div>
    </div>
  );
}

function CardGrid({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
        gap: 12,
      }}
    >
      {children}
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  const pal = useTheme();
  return (
    <div
      style={{
        fontSize: 14,
        color: pal.textFaint,
        padding: '10px 0',
      }}
    >
      {children}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Drop card — one component to cook
// ─────────────────────────────────────────────────────────────────────────────

function DropCard({
  item,
  variant,
  onCook,
  onStart,
}: {
  item: DropItem;
  variant: 'start' | 'cooking' | 'next';
  onCook: (recipeId: RecipeId, qty: number) => void;
  onStart?: (item: DropItem) => void;
}) {
  const pal = useTheme();
  const isNext = variant === 'next';
  const isStart = variant === 'start';
  const isCooking = variant === 'cooking';

  // Cooking cue label: crew batches tick a live mm:ss; the loop's own cooks
  // count down in whole minutes. Either way the card is tinted so a glance
  // says "this is on".
  const liveLabel =
    item.crew && item.liveSeconds != null
      ? item.liveSeconds <= 0
        ? 'Ready'
        : `${Math.floor(item.liveSeconds / 60)}:${(item.liveSeconds % 60).toString().padStart(2, '0')}`
      : null;
  const cookLabel =
    liveLabel ?? (item.readyInMin != null ? (item.readyInMin <= 0 ? 'Ready' : `${item.readyInMin}m`) : null);
  const cookReady = cookLabel === 'Ready';

  // Colour carries meaning: red = needs starting, accent tint = cooking,
  // "coming up" recedes.
  const surface = isStart ? pal.urgentSurface : isCooking ? pal.accentChipBg : pal.surface;
  const borderCol = isStart ? pal.urgentBorder : isCooking ? pal.accent : pal.borderCard;
  const countColor = isStart ? pal.urgent : pal.text;

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onCook(item.recipeId, item.count)}
      style={{
        textAlign: 'left',
        border: `1px solid ${borderCol}`,
        borderRadius: 12,
        background: surface,
        boxShadow: isStart ? 'none' : pal.cardShadow,
        color: pal.text,
        padding: '14px 16px',
        cursor: 'pointer',
        fontFamily: 'var(--font-primary)',
        opacity: isNext ? (pal.mode === 'light' ? 0.85 : 0.72) : 1,
        height: 116,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        gap: 8,
        overflow: 'hidden',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, minWidth: 0 }}>
        <span
          style={{
            fontSize: isNext ? 28 : 34,
            fontWeight: 900,
            lineHeight: 1,
            fontVariantNumeric: 'tabular-nums',
            color: countColor,
            flexShrink: 0,
          }}
        >
          {item.count}
        </span>
        <span
          style={{
            fontSize: isNext ? 14 : 15,
            fontWeight: 700,
            lineHeight: 1.2,
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
            minWidth: 0,
          }}
        >
          {item.name}
        </span>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'nowrap', minWidth: 0 }}>
        {/* Station as a quiet dot + label, not a coloured block. */}
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, minWidth: 0, overflow: 'hidden' }}>
          <span
            style={{
              width: 7,
              height: 7,
              borderRadius: '50%',
              background: item.stationAccent,
              flexShrink: 0,
            }}
          />
          <span
            style={{
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: '0.04em',
              textTransform: 'uppercase',
              color: pal.textMuted,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {item.stationName}
          </span>
        </span>

        {item.surged && (
          <span
            title={
              item.surgeLanded
                ? 'Edify predicted this surge — the order just landed'
                : 'Demand surging — cooking ahead'
            }
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
              fontSize: 11,
              fontWeight: 800,
              padding: '2px 8px',
              borderRadius: 100,
              background: item.surgeLanded ? pal.greenSurface : pal.accentChipBg,
              color: item.surgeLanded ? pal.green : pal.accentChipFg,
              whiteSpace: 'nowrap',
              flexShrink: 0,
            }}
          >
            Ahead
          </span>
        )}

        {(isStart || isNext) && onStart ? (
          <button
            type="button"
            onClick={e => {
              e.stopPropagation();
              onStart(item);
            }}
            style={{
              marginLeft: 'auto',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
              minHeight: 36,
              padding: '0 18px',
              borderRadius: 100,
              border: `1px solid ${pal.accentSolid}`,
              background: pal.accentSolid,
              color: pal.onAccent,
              fontSize: 13,
              fontWeight: 800,
              cursor: 'pointer',
              flexShrink: 0,
              fontFamily: 'var(--font-primary)',
            }}
          >
            <Play size={14} /> {isStart ? 'Start' : 'Drop now'}
          </button>
        ) : isCooking ? (
          <span
            style={{
              marginLeft: 'auto',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 5,
              fontSize: 12,
              fontWeight: 800,
              fontVariantNumeric: 'tabular-nums',
              color: cookReady ? pal.green : pal.accent,
              flexShrink: 0,
            }}
          >
            <Flame size={13} />
            {cookReady ? 'Ready' : `Cooking ${cookLabel ?? ''}`}
          </span>
        ) : null}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Cabinet strip — what's held + freshness
// ─────────────────────────────────────────────────────────────────────────────

// ─────────────────────────────────────────────────────────────────────────────
// Add-order modal — manual "a large order just came in" hook. A clean light
// dialog (so the shared QtyStepper looks at home) over the line.
// ─────────────────────────────────────────────────────────────────────────────

function AddOrderModal({
  open,
  recipes,
  lineName,
  qtys,
  onBump,
  onConfirm,
  onClear,
  onClose,
}: {
  open: boolean;
  recipes: OrderRecipe[];
  lineName: string;
  qtys: Record<string, number>;
  onBump: (recipeId: RecipeId, delta: number) => void;
  onConfirm: () => void;
  onClear: () => void;
  onClose: () => void;
}) {
  const pal = useTheme();
  if (!open) return null;
  const accent = pal.accentSolid;

  const total = recipes.reduce((a, r) => a + (qtys[r.recipeId] ?? 0), 0);
  const recipeCount = recipes.filter(r => (qtys[r.recipeId] ?? 0) > 0).length;

  return (
    <div
      onClick={onClose}
      style={{
        position: 'absolute',
        inset: 0,
        zIndex: 40,
        background: 'rgba(0,0,0,0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: 'min(820px, 96%)',
          maxHeight: '92%',
          display: 'flex',
          flexDirection: 'column',
          background: '#ffffff',
          color: '#16181d',
          borderRadius: 16,
          boxShadow: '0 24px 64px rgba(0,0,0,0.4)',
          fontFamily: 'var(--font-primary)',
          overflow: 'hidden',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '24px 24px 12px' }}>
          <div style={{ flex: 1 }}>
            <h2 style={{ margin: 0, fontSize: 20, fontWeight: 800 }}>Add a large order · {lineName}</h2>
            <p style={{ margin: '4px 0 0', fontSize: 13, color: '#6b7280' }}>
              Set how many of each — they all drop onto the line at once and land in the cabinet
              when cooked.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            style={{
              border: '1px solid rgba(0,0,0,0.1)',
              background: '#fff',
              borderRadius: 8,
              width: 40,
              height: 40,
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              color: '#6b7280',
              flexShrink: 0,
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Recipe cards — each with its own quantity */}
        <div
          style={{
            overflow: 'auto',
            padding: '4px 24px 12px',
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: 10,
          }}
        >
          {recipes.map(r => {
            const qty = qtys[r.recipeId] ?? 0;
            const active = qty > 0;
            return (
              <div
                key={r.recipeId}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 12,
                  padding: '12px 14px',
                  borderRadius: 12,
                  border: `1px solid ${active ? accent : 'rgba(0,0,0,0.12)'}`,
                  background: active ? `${accent}0d` : '#fff',
                  minWidth: 0,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 9, minWidth: 0 }}>
                  <span
                    style={{
                      width: 9,
                      height: 9,
                      borderRadius: '50%',
                      background: r.accent,
                      flexShrink: 0,
                    }}
                  />
                  <div style={{ minWidth: 0 }}>
                    <div
                      style={{
                        fontSize: 13,
                        fontWeight: 700,
                        color: '#16181d',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}
                    >
                      {r.name}
                    </div>
                    <div
                      style={{
                        fontSize: 11,
                        fontWeight: 700,
                        letterSpacing: '0.03em',
                        textTransform: 'uppercase',
                        color: '#9ca3af',
                      }}
                    >
                      {r.stationName}
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <QtyStepper
                    size="touch"
                    canDecrement={qty > 0}
                    onDecrement={() => onBump(r.recipeId, -6)}
                    onIncrement={() => onBump(r.recipeId, 6)}
                    style={{ flexShrink: 0 }}
                  >
                    <span
                      style={{ ...getStepperValueStyle('touch'), color: active ? '#16181d' : '#9ca3af' }}
                    >
                      {qty}
                    </span>
                  </QtyStepper>
                  <div style={{ flex: 1 }} />
                  {[12, 24].map(n => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => onBump(r.recipeId, n)}
                      style={{
                        minHeight: 40,
                        padding: '0 12px',
                        borderRadius: 100,
                        border: '1px solid rgba(0,0,0,0.12)',
                        background: '#fff',
                        color: '#374151',
                        fontSize: 14,
                        fontWeight: 700,
                        cursor: 'pointer',
                        fontFamily: 'var(--font-primary)',
                        flexShrink: 0,
                      }}
                    >
                      +{n}
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: '14px 24px',
            borderTop: '1px solid rgba(0,0,0,0.08)',
          }}
        >
          <button
            type="button"
            onClick={onClear}
            disabled={total === 0}
            style={{
              minHeight: 44,
              padding: '0 16px',
              borderRadius: 10,
              border: 'none',
              background: 'transparent',
              color: total === 0 ? '#c7c9d1' : '#9ca3af',
              fontSize: 14,
              fontWeight: 700,
              cursor: total === 0 ? 'default' : 'pointer',
              fontFamily: 'var(--font-primary)',
            }}
          >
            Clear all
          </button>
          <div style={{ flex: 1 }} />
          <span style={{ fontSize: 13, color: '#6b7280', fontWeight: 600 }}>
            {total > 0 ? `${total} units · ${recipeCount} recipe${recipeCount === 1 ? '' : 's'}` : 'Nothing added yet'}
          </span>
          <button
            type="button"
            onClick={onConfirm}
            disabled={total <= 0}
            style={{
              minHeight: 44,
              padding: '0 22px',
              borderRadius: 10,
              border: 'none',
              background: total <= 0 ? '#c7c9d1' : accent,
              color: pal.onAccent,
              fontSize: 15,
              fontWeight: 800,
              cursor: total <= 0 ? 'not-allowed' : 'pointer',
              fontFamily: 'var(--font-primary)',
            }}
          >
            Add to the line
          </button>
        </div>
      </div>
    </div>
  );
}

function CabinetSection({ cabinet, sold }: { cabinet: HeldDisplay[]; sold: number }) {
  const pal = useTheme();
  const fresh = cabinet.filter(h => !h.expired);
  const total = fresh.reduce((a, h) => a + h.count, 0);
  const wasteCount = cabinet.filter(h => h.expired).reduce((a, h) => a + h.count, 0);
  return (
    <div style={{ flexShrink: 0, display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 10 }}>
        <span
          style={{
            fontSize: 15,
            fontWeight: 800,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            color: pal.text,
          }}
        >
          Pan Holding Unit
        </span>
        <span
          style={{
            fontSize: 15,
            fontWeight: 900,
            fontVariantNumeric: 'tabular-nums',
            color: pal.accent,
          }}
        >
          {total}
        </span>
        <span style={{ fontSize: 12, color: pal.textFaint }}>ready to serve</span>
        <span
          title="Burgers sold from the line so far today"
          style={{
            display: 'inline-flex',
            alignItems: 'baseline',
            gap: 5,
            marginLeft: 4,
            fontSize: 12,
            fontWeight: 700,
            color: pal.textSecondary,
          }}
        >
          <span style={{ fontSize: 15, fontWeight: 900, fontVariantNumeric: 'tabular-nums', color: pal.green }}>
            {sold.toLocaleString('en-GB')}
          </span>
          sold today
        </span>
        {wasteCount > 0 && (
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              marginLeft: 4,
              padding: '3px 10px',
              borderRadius: 100,
              background: pal.urgentSurface,
              border: `1px solid ${pal.urgentBorder}`,
              color: pal.urgent,
              fontSize: 12,
              fontWeight: 800,
            }}
          >
            <Trash2 size={12} /> {wasteCount} to waste
          </span>
        )}
      </div>
      {cabinet.length === 0 ? (
        <Empty>Pan Holding Unit empty — start a batch below</Empty>
      ) : (
        <CardGrid>
          {cabinet.map(h => (
            <CabinetCard key={h.id} held={h} />
          ))}
        </CardGrid>
      )}
    </div>
  );
}

function CabinetCard({ held }: { held: HeldDisplay }) {
  const pal = useTheme();
  const frac = Math.max(0, Math.min(1, held.expiresInMin / held.shelfLifeMin));
  // Escalate as the hold runs down; once it's up the whole card flips to WASTE.
  const expired = held.expired;
  const color = expired ? pal.urgent : frac > 0.4 ? pal.green : pal.accent;
  const useSoon = !expired && held.expiresInMin <= 3;

  return (
    <div
      style={{
        border: `1px solid ${expired ? pal.urgent : pal.borderCard}`,
        borderRadius: 12,
        background: expired ? pal.urgentSurface : pal.surface,
        boxShadow: expired ? 'none' : pal.cardShadow,
        padding: '14px 16px',
        height: 104,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        overflow: 'hidden',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, minWidth: 0 }}>
        <span
          style={{
            fontSize: 40,
            fontWeight: 900,
            lineHeight: 1,
            fontVariantNumeric: 'tabular-nums',
            color: expired ? pal.urgent : pal.text,
            flexShrink: 0,
          }}
        >
          {held.count}
        </span>
        <span
          style={{
            fontSize: 15,
            fontWeight: 700,
            lineHeight: 1.2,
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
            minWidth: 0,
          }}
        >
          {held.name}
        </span>
      </div>

      {expired ? (
        // Hold window is up — pull and bin it.
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '4px 10px',
              borderRadius: 100,
              background: pal.urgent,
              color: '#ffffff',
              fontSize: 12,
              fontWeight: 800,
              letterSpacing: '0.04em',
            }}
          >
            <Trash2 size={13} /> WASTE NOW
          </span>
        </div>
      ) : (
        // Freshness bar + time left — quiet, but legible at a glance.
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span
            style={{
              flex: 1,
              height: 5,
              borderRadius: 3,
              background: pal.track,
              overflow: 'hidden',
            }}
          >
            <span
              style={{ display: 'block', width: `${frac * 100}%`, height: '100%', background: color }}
            />
          </span>
          <span
            style={{
              fontSize: 12,
              fontWeight: 700,
              color,
              fontVariantNumeric: 'tabular-nums',
              flexShrink: 0,
            }}
          >
            {useSoon ? `use ${held.expiresInMin}m` : `${held.expiresInMin}m`}
          </span>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Re-cut banner
// ─────────────────────────────────────────────────────────────────────────────

/** Tone → chip colours, shared by the Quinn line + radar chips. */
function useRecutToneStyles(): Record<RecutTone, { bg: string; fg: string; label: string }> {
  const pal = useTheme();
  return {
    'cook-ahead': { bg: pal.accentChipBg, fg: pal.accentChipFg, label: 'Cook ahead' },
    'ease-off': { bg: pal.greenSurface, fg: pal.green, label: 'Ease off' },
    info: { bg: pal.infoBg, fg: pal.textSecondary, label: 'Steady' },
  };
}

/**
 * QuinnStrip — Quinn's persistent presence on the line.
 *
 * Always visible (a calm teammate, not a pop-up). Top row is Quinn's current
 * call with a tap-to-expand log of recent calls; the second row is the
 * "on the radar" ribbon of what Quinn sees coming, with countdowns, so a
 * cook-ahead is never a surprise.
 */
function QuinnStrip({ recutLog, radar }: { recutLog: RecutLogEntry[]; radar: RadarItem[] }) {
  const pal = useTheme();
  const toneStyles = useRecutToneStyles();
  const [historyOpen, setHistoryOpen] = useState(false);
  const current = recutLog[0] ?? null;
  const s = current ? toneStyles[current.tone] : { bg: pal.infoBg, fg: pal.textSecondary, label: 'Watching' };

  return (
    <div style={{ borderBottom: `1px solid ${pal.border}`, background: pal.surfaceSubtle }}>
      {/* Current call */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '9px 22px', position: 'relative' }}>
        <EdifyOrb pal={pal} />
        <span
          style={{
            fontSize: 11,
            fontWeight: 800,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            color: pal.textSecondary,
            whiteSpace: 'nowrap',
          }}
        >
          Edify
        </span>
        <span
          style={{
            fontSize: 10.5,
            fontWeight: 800,
            letterSpacing: '0.04em',
            textTransform: 'uppercase',
            padding: '2px 8px',
            borderRadius: 100,
            background: s.bg,
            color: s.fg,
            whiteSpace: 'nowrap',
          }}
        >
          {s.label}
        </span>
        <span style={{ fontSize: 14, fontWeight: 600, color: pal.text, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {current ? current.message : 'On plan — watching POS + forecast. Cabinet is covering demand.'}
        </span>

        {recutLog.length > 0 && (
          <button
            type="button"
            onClick={() => setHistoryOpen(o => !o)}
            aria-expanded={historyOpen}
            style={{
              marginLeft: 'auto',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 5,
              flexShrink: 0,
              padding: '4px 10px',
              borderRadius: 100,
              border: `1px solid ${pal.border}`,
              background: 'transparent',
              color: pal.textSecondary,
              fontSize: 11.5,
              fontWeight: 700,
              cursor: 'pointer',
              fontFamily: 'var(--font-primary)',
            }}
          >
            Recent calls
            <span style={{ fontVariantNumeric: 'tabular-nums', opacity: 0.8 }}>{recutLog.length}</span>
            <ChevronDown size={13} style={{ transform: historyOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }} />
          </button>
        )}

        {historyOpen && recutLog.length > 0 && (
          <div
            style={{
              position: 'absolute',
              top: 'calc(100% - 2px)',
              right: 22,
              zIndex: 40,
              width: 'min(420px, 80vw)',
              background: pal.surface,
              border: `1px solid ${pal.borderStrong}`,
              borderRadius: 12,
              boxShadow: pal.cardShadow === 'none' ? '0 16px 40px rgba(0,0,0,0.45)' : pal.cardShadow,
              padding: 8,
              display: 'flex',
              flexDirection: 'column',
              gap: 2,
            }}
          >
            {recutLog.slice(0, 5).map(entry => {
              const es = toneStyles[entry.tone];
              return (
                <div key={`${entry.id}-${entry.atMin}`} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '8px 10px', borderRadius: 8 }}>
                  <span style={{ fontSize: 11, fontWeight: 800, fontVariantNumeric: 'tabular-nums', color: pal.textMuted, minWidth: 38, marginTop: 1 }}>
                    {minutesToHHMM(entry.atMin)}
                  </span>
                  <span style={{ width: 7, height: 7, borderRadius: '50%', background: es.fg, marginTop: 6, flexShrink: 0 }} />
                  <span style={{ fontSize: 13, color: pal.text, lineHeight: 1.4 }}>{entry.message}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* On the radar */}
      {radar.length > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '0 22px 9px', flexWrap: 'wrap' }}>
          <span
            title="Edify predicts from history — what the POS has actually done at this slot on past comparable days. Not foreknowledge of one-off events."
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 10.5, fontWeight: 800, letterSpacing: '0.06em', textTransform: 'uppercase', color: pal.textMuted, whiteSpace: 'nowrap' }}
          >
            <Radar size={13} /> Edify expects
          </span>
          {radar.map(item => {
            const rs = toneStyles[item.tone];
            return (
              <span
                key={item.id}
                title={`Based on ${item.basis}`}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 7,
                  padding: '4px 10px',
                  borderRadius: 100,
                  background: pal.chip,
                  border: `1px solid ${pal.border}`,
                  fontSize: 12,
                  fontWeight: 700,
                  color: pal.text,
                  whiteSpace: 'nowrap',
                }}
              >
                <span style={{ width: 7, height: 7, borderRadius: '50%', background: rs.fg }} />
                {item.label}
                <span style={{ color: pal.textMuted, fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
                  · {item.minsUntil}m
                </span>
              </span>
            );
          })}
        </div>
      )}
    </div>
  );
}

/** Small Edify identity orb — accent disc carrying the Edify logo mark. */
function EdifyOrb({ pal }: { pal: Palette }) {
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: 26,
        height: 26,
        borderRadius: '50%',
        background: pal.accentSolid,
        flexShrink: 0,
        boxShadow: `0 0 0 3px ${pal.accentChipBg}`,
      }}
    >
      <span
        role="img"
        aria-label="Edify"
        style={{
          display: 'block',
          width: 9,
          height: 15,
          backgroundColor: pal.onAccent,
          WebkitMaskImage: 'url(/edify-logo.svg)',
          maskImage: 'url(/edify-logo.svg)',
          WebkitMaskRepeat: 'no-repeat',
          maskRepeat: 'no-repeat',
          WebkitMaskPosition: 'center',
          maskPosition: 'center',
          WebkitMaskSize: 'contain',
          maskSize: 'contain',
        }}
      />
    </span>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Forecast sync badge — the demand the line cooks to is pulled from BK's POS
// (a third-party system), not typed in here. Shows it's connected + current.
// ─────────────────────────────────────────────────────────────────────────────

function SyncBadge({ label, detail, title }: { label: string; detail: string; title: string }) {
  const pal = useTheme();
  return (
    <span
      title={title}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 7,
        padding: '4px 10px',
        borderRadius: 100,
        background: pal.chip,
        border: `1px solid ${pal.borderCard}`,
        boxShadow: pal.cardShadow,
        whiteSpace: 'nowrap',
      }}
    >
      <RefreshCw size={12} color={pal.green} />
      <span style={{ fontSize: 11, fontWeight: 700, color: pal.text }}>{label}</span>
      <span style={{ fontSize: 11, fontWeight: 600, color: pal.textFaint }}>{detail}</span>
      <span
        style={{
          width: 6,
          height: 6,
          borderRadius: '50%',
          background: pal.green,
          boxShadow: `0 0 0 3px ${pal.greenSurface}`,
        }}
      />
    </span>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Transport button
// ─────────────────────────────────────────────────────────────────────────────

// ─────────────────────────────────────────────────────────────────────────────
// Demo menu — every presenter control behind one dropdown so the header stays
// clean. Stepping/auto/theme keep the menu open (you click them repeatedly);
// full screen closes it since the layout changes underneath.
// ─────────────────────────────────────────────────────────────────────────────

function DemoMenu({
  mode,
  onToggleMode,
  playing,
  atEnd,
  onStep5,
  onNextDrop,
  onTogglePlay,
  onReset,
  fullscreen,
  onToggleFullscreen,
  lineId,
  onSelectLine,
}: {
  mode: Mode;
  onToggleMode: () => void;
  playing: boolean;
  atEnd: boolean;
  onStep5: () => void;
  onNextDrop: () => void;
  onTogglePlay: () => void;
  onReset: () => void;
  fullscreen: boolean;
  onToggleFullscreen: () => void;
  lineId: string;
  onSelectLine: (id: string) => void;
}) {
  const pal = useTheme();
  const [open, setOpen] = useState(false);

  return (
    <div style={{ position: 'relative' }}>
      <TransportButton onClick={() => setOpen(o => !o)} label="Demo">
        <SlidersHorizontal size={14} />
        <ChevronDown size={13} style={{ marginLeft: -2 }} />
      </TransportButton>

      {open && (
        <>
          {/* Outside-click catcher */}
          <div
            onClick={() => setOpen(false)}
            style={{ position: 'fixed', inset: 0, zIndex: 40 }}
          />
          <div
            style={{
              position: 'absolute',
              top: 'calc(100% + 8px)',
              right: 0,
              zIndex: 41,
              minWidth: 230,
              padding: 6,
              borderRadius: 12,
              background: pal.surface,
              border: `1px solid ${pal.borderStrong}`,
              boxShadow: '0 16px 40px rgba(0,0,0,0.3)',
              display: 'flex',
              flexDirection: 'column',
              gap: 2,
            }}
          >
            <MenuLabel>Crew screen</MenuLabel>
            {BK_LINES.map(l => (
              <MenuItem
                key={l.id}
                icon={
                  <span
                    style={{
                      width: 10,
                      height: 10,
                      borderRadius: '50%',
                      background: l.accent,
                      boxShadow: lineId === l.id ? `0 0 0 3px ${l.accent}33` : 'none',
                    }}
                  />
                }
                label={l.name}
                trailing={lineId === l.id ? <Check size={15} color={pal.green} /> : undefined}
                onClick={() => onSelectLine(l.id)}
              />
            ))}

            <MenuDivider />
            <MenuLabel>Step the clock</MenuLabel>
            <MenuItem icon={<Plus size={15} />} label="+5 min" disabled={atEnd} onClick={onStep5} />
            <MenuItem
              icon={<SkipForward size={15} />}
              label="Next drop"
              disabled={atEnd}
              onClick={onNextDrop}
            />
            <MenuItem
              icon={playing ? <Pause size={15} /> : <Play size={15} />}
              label={playing ? 'Pause auto-play' : 'Auto-play'}
              disabled={atEnd}
              onClick={onTogglePlay}
            />

            <MenuDivider />
            <MenuLabel>Screen</MenuLabel>
            <MenuItem
              icon={mode === 'dark' ? <Sun size={15} /> : <Moon size={15} />}
              label={mode === 'dark' ? 'Light mode' : 'Dark mode'}
              onClick={onToggleMode}
            />
            <MenuItem
              icon={fullscreen ? <Minimize2 size={15} /> : <Maximize2 size={15} />}
              label={fullscreen ? 'Exit full screen' : 'Full screen'}
              onClick={() => {
                setOpen(false);
                onToggleFullscreen();
              }}
            />

            <MenuDivider />
            <MenuItem icon={<RotateCcw size={15} />} label="Reset demo" onClick={onReset} />
          </div>
        </>
      )}
    </div>
  );
}

function MenuLabel({ children }: { children: React.ReactNode }) {
  const pal = useTheme();
  return (
    <div
      style={{
        fontSize: 10,
        fontWeight: 800,
        letterSpacing: '0.08em',
        textTransform: 'uppercase',
        color: pal.textMuted,
        padding: '6px 10px 2px',
      }}
    >
      {children}
    </div>
  );
}

function MenuDivider() {
  const pal = useTheme();
  return <div style={{ height: 1, background: pal.border, margin: '4px 2px' }} />;
}

function MenuItem({
  icon,
  label,
  onClick,
  disabled,
  trailing,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  trailing?: React.ReactNode;
}) {
  const pal = useTheme();
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        width: '100%',
        padding: '9px 10px',
        borderRadius: 8,
        border: 'none',
        background: 'transparent',
        color: pal.text,
        cursor: disabled ? 'default' : 'pointer',
        opacity: disabled ? 0.4 : 1,
        fontSize: 13,
        fontWeight: 600,
        textAlign: 'left',
        fontFamily: 'var(--font-primary)',
      }}
      onMouseEnter={e => {
        if (!disabled) e.currentTarget.style.background = pal.chip;
      }}
      onMouseLeave={e => {
        e.currentTarget.style.background = 'transparent';
      }}
    >
      <span style={{ display: 'inline-flex', color: pal.textSecondary }}>{icon}</span>
      {label}
      {trailing && <span style={{ marginLeft: 'auto', display: 'inline-flex' }}>{trailing}</span>}
    </button>
  );
}

function TransportButton({
  children,
  onClick,
  label,
  primary,
  disabled,
}: {
  children: React.ReactNode;
  onClick: () => void;
  label: string;
  primary?: boolean;
  disabled?: boolean;
}) {
  const pal = useTheme();
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      disabled={disabled}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        padding: '6px 12px',
        borderRadius: 100,
        border: primary ? `1px solid ${pal.accentSolid}` : `1px solid ${pal.borderStrong}`,
        background: primary ? pal.accentSolid : pal.chip,
        color: primary ? pal.onAccent : pal.text,
        cursor: disabled ? 'default' : 'pointer',
        opacity: disabled ? 0.4 : 1,
        fontSize: 12,
        fontWeight: 700,
        fontFamily: 'var(--font-primary)',
      }}
    >
      {children}
      {label}
    </button>
  );
}
