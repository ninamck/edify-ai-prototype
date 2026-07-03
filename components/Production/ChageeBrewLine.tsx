'use client';

/**
 * ChageeBrewLine — CHAGEE's tea brew line, built as a BREW CLOCK.
 *
 * Where the Burger King line is a 15-minute drop clock (cook fast, hold short),
 * CHAGEE's problem is the opposite: several teas take up to ~2 hours from start
 * to serve-ready, so the crew must START ahead of demand, not react to it. This
 * screen is organised around that single question — "what do I need to put on
 * NOW so the urns never run dry, in the right amount for today's forecast?"
 *
 * Four blocks, top to bottom:
 *   • IN THE URNS  — what's ready to serve right now + how fresh it is (CHAGEE
 *                    sells "freshly brewed, never stewed", so freshness leads).
 *   • START NOW    — batches the back-scheduler says must go on now/next, sized
 *                    to the forecast. The long ~2h brews light up here first.
 *   • BREWING      — what's steeping/cooling now, each with a countdown to ready.
 *   • LATER TODAY  — the rest of the day's brew plan as a timeline.
 *
 * All of it is projected from `chageeBrewSchedule` onto a simulated clock the
 * presenter can step, so the story is identical every run.
 */

import { createContext, useContext, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  Play,
  Pause,
  Plus,
  SkipForward,
  RotateCcw,
  Maximize2,
  Minimize2,
  Sun,
  Moon,
  SlidersHorizontal,
  ChevronDown,
  Check,
  RefreshCw,
  Timer,
  Flame,
  Clock,
} from 'lucide-react';
import {
  CHAGEE_SERVICE_START_MIN,
  CHAGEE_SERVICE_END_MIN,
  CHAGEE_STATIONS,
} from './chageeFixtures';
import {
  deriveBrewLineState,
  minutesToHHMM,
  type BrewBatch,
  type HoldingNow,
} from './chageeBrewSchedule';
import type { SiteId } from './fixtures';

// ─────────────────────────────────────────────────────────────────────────────
// Theme
// ─────────────────────────────────────────────────────────────────────────────

type Mode = 'light' | 'dark';

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
  sectionLabel: string;
  urgent: string;
  urgentSurface: string;
  urgentBorder: string;
  accent: string;
  accentSolid: string;
  accentChipBg: string;
  accentChipFg: string;
  green: string;
  greenSurface: string;
  amber: string;
  amberSurface: string;
  onAccent: string;
}

/** CHAGEE red. */
const CG_RED = '#A4123F';

const PALETTES: Record<Mode, Palette> = {
  light: {
    mode: 'light',
    appBg: '#f6f4f2',
    text: '#1a1416',
    textSecondary: 'rgba(0,0,0,0.62)',
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
    sectionLabel: 'rgba(0,0,0,0.85)',
    urgent: CG_RED,
    urgentSurface: 'rgba(164,18,63,0.07)',
    urgentBorder: 'rgba(164,18,63,0.4)',
    accent: CG_RED,
    accentSolid: CG_RED,
    accentChipBg: 'rgba(164,18,63,0.1)',
    accentChipFg: CG_RED,
    green: '#1f9d57',
    greenSurface: 'rgba(31,157,87,0.14)',
    amber: '#b45309',
    amberSurface: 'rgba(180,83,9,0.1)',
    onAccent: '#ffffff',
  },
  dark: {
    mode: 'dark',
    appBg: '#141013',
    text: '#ffffff',
    textSecondary: 'rgba(255,255,255,0.62)',
    textMuted: 'rgba(255,255,255,0.46)',
    textFaint: 'rgba(255,255,255,0.36)',
    border: 'rgba(255,255,255,0.08)',
    borderCard: 'rgba(255,255,255,0.1)',
    borderStrong: 'rgba(255,255,255,0.22)',
    surface: 'rgba(255,255,255,0.05)',
    surfaceSubtle: 'rgba(255,255,255,0.02)',
    chip: 'rgba(255,255,255,0.07)',
    track: 'rgba(255,255,255,0.13)',
    cardShadow: 'none',
    heroBg: 'rgba(255,255,255,0.03)',
    sectionLabel: 'rgba(255,255,255,0.9)',
    urgent: '#ff6b8f',
    urgentSurface: 'rgba(164,18,63,0.22)',
    urgentBorder: 'rgba(255,107,143,0.5)',
    accent: '#ff6b8f',
    accentSolid: CG_RED,
    accentChipBg: 'rgba(255,107,143,0.2)',
    accentChipFg: '#ff9db4',
    green: '#3ec07a',
    greenSurface: 'rgba(62,192,122,0.14)',
    amber: '#f0a94a',
    amberSurface: 'rgba(240,169,74,0.14)',
    onAccent: '#ffffff',
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

/** "1h 40m" / "45m" from a minute count. */
function durLabel(mins: number): string {
  if (mins <= 0) return 'now';
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h > 0) return m > 0 ? `${h}h ${m}m` : `${h}h`;
  return `${m}m`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Where the brew clock opens: 17:05, late afternoon. It's the sharpest moment
 * for CHAGEE's story — the urns are full and things are brewing, yet Edify is
 * already calling the 2-hour aged pu'er (and the tapioca) to START NOW so
 * they're ready for the evening peak. The presenter can step back/forward.
 */
const BREW_DEMO_START_MIN = 17 * 60 + 5;

export default function ChageeBrewLine({ siteId: _siteId }: { siteId: SiteId }) {
  const [nowMin, setNowMin] = useState<number>(BREW_DEMO_START_MIN);
  const [playing, setPlaying] = useState(false);
  const [mode, setMode] = useState<Mode>('light');
  const [fullscreen, setFullscreen] = useState(false);
  const [lineId, setLineId] = useState<string>(CHAGEE_STATIONS[0].id);
  const pal = PALETTES[mode];

  const line = CHAGEE_STATIONS.find(l => l.id === lineId) ?? CHAGEE_STATIONS[0];
  const state = deriveBrewLineState(nowMin, line.id);
  const atEnd = nowMin >= CHAGEE_SERVICE_END_MIN;

  // Auto-play: advance the clock in 5-min ticks.
  useEffect(() => {
    if (!playing) return;
    const t = setInterval(() => {
      setNowMin(prev => {
        const next = prev + 5;
        if (next >= CHAGEE_SERVICE_END_MIN) {
          setPlaying(false);
          return CHAGEE_SERVICE_END_MIN;
        }
        return next;
      });
    }, 1400);
    return () => clearInterval(t);
  }, [playing]);

  const step = (mins: number) =>
    setNowMin(prev => Math.min(CHAGEE_SERVICE_END_MIN, Math.max(CHAGEE_SERVICE_START_MIN, prev + mins)));

  // Jump to the next moment something happens (a start or a batch landing).
  const stepToNextEvent = () => {
    const events = state.schedule
      .flatMap(b => [b.startMin, b.readyMin])
      .filter(m => m > nowMin)
      .sort((a, b) => a - b);
    if (events.length) setNowMin(Math.min(CHAGEE_SERVICE_END_MIN, events[0]));
  };

  const reset = () => {
    setPlaying(false);
    setNowMin(BREW_DEMO_START_MIN);
  };

  // Pressing Start on a due batch = "yes, putting it on now" → move the clock to
  // its start so the crew watch it enter Brewing with its full countdown.
  const startBatch = (b: BrewBatch) => setNowMin(prev => Math.max(prev, b.startMin));

  // The next long brew that must go on — the headline the manager cares about.
  const nextLongBrew =
    state.startNow.find(b => b.longLead) ??
    state.later.find(b => b.longLead) ??
    null;

  const content = (
    <ThemeContext.Provider value={pal}>
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
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
          <span style={{ fontSize: 11, fontWeight: 600, color: pal.textFaint, whiteSpace: 'nowrap' }}>
            {line.caption}
          </span>
          <span style={{ fontSize: 20, fontWeight: 800, fontVariantNumeric: 'tabular-nums', marginLeft: 6 }}>
            {minutesToHHMM(nowMin)}
          </span>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, marginLeft: 10 }}>
            <SyncBadge
              label="Forecast synced"
              detail={`· ${minutesToHHMM(nowMin)}`}
              title={
                "Today's demand forecast — blends 4-week sales history, local footfall and " +
                'weather. The brew plan back-schedules from it.'
              }
            />
          </div>
          <div style={{ flex: 1 }} />
          <DemoMenu
            mode={mode}
            onToggleMode={() => setMode(m => (m === 'dark' ? 'light' : 'dark'))}
            playing={playing}
            atEnd={atEnd}
            onStep5={() => step(5)}
            onNextEvent={stepToNextEvent}
            onTogglePlay={() => setPlaying(p => !p)}
            onReset={reset}
            fullscreen={fullscreen}
            onToggleFullscreen={() => setFullscreen(f => !f)}
            lineId={lineId}
            onSelectLine={setLineId}
          />
        </div>

        {/* Edify strip — the lead-time call the manager most needs to hear. */}
        <EdifyStrip nextLongBrew={nextLongBrew} startNow={state.startNow} nowMin={nowMin} />

        {/* Body */}
        <div
          style={{
            flex: 1,
            minHeight: 0,
            overflow: 'auto',
            display: 'flex',
            flexDirection: 'column',
            gap: 16,
            padding: '16px 24px 88px',
          }}
        >
          <UrnsSection holding={state.holding} />

          <Section
            label="Start soon"
            tone={state.startNow.some(b => b.startMin <= nowMin) ? 'urgent' : undefined}
            hint="Put each on at the time shown — sized to today's forecast so it lands before the urn runs dry"
          >
            {state.startNow.length === 0 ? (
              <Empty>Nothing to start in the next 20 min — urns are covered</Empty>
            ) : (
              <CardGrid>
                {state.startNow.map(b => (
                  <StartCard key={b.id} batch={b} nowMin={nowMin} onStart={startBatch} />
                ))}
              </CardGrid>
            )}
          </Section>

          <Section label="Brewing now" hint="Steeping / cooling — counting down to serve-ready" tone="muted">
            {state.brewing.length === 0 ? (
              <Empty>Nothing on the brew right now</Empty>
            ) : (
              <CardGrid>
                {state.brewing.map(b => (
                  <BrewingCard key={b.id} batch={b} nowMin={nowMin} />
                ))}
              </CardGrid>
            )}
          </Section>

          <Section label="Later today" hint="The rest of the day's brew plan" tone="muted">
            {state.later.length === 0 ? (
              <Empty>No more brews scheduled today</Empty>
            ) : (
              <TimelineList batches={state.later} nowMin={nowMin} />
            )}
          </Section>
        </div>
      </div>
    </ThemeContext.Provider>
  );

  if (fullscreen && typeof document !== 'undefined') {
    return createPortal(content, document.body);
  }
  return content;
}

// ─────────────────────────────────────────────────────────────────────────────
// Theme context
// ─────────────────────────────────────────────────────────────────────────────

const ThemeContext = createContext<Palette>(PALETTES.light);
const useTheme = () => useContext(ThemeContext);

// ─────────────────────────────────────────────────────────────────────────────
// Sections + layout
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
  const labelColor = tone === 'urgent' ? pal.urgent : tone === 'muted' ? pal.textFaint : pal.sectionLabel;
  return (
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
        gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
        gap: 12,
      }}
    >
      {children}
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  const pal = useTheme();
  return <div style={{ fontSize: 14, color: pal.textFaint, padding: '8px 0' }}>{children}</div>;
}

// ─────────────────────────────────────────────────────────────────────────────
// Urns section — what's ready to serve now + freshness
// ─────────────────────────────────────────────────────────────────────────────

function UrnsSection({ holding }: { holding: HoldingNow[] }) {
  const pal = useTheme();
  const total = holding.reduce((a, h) => a + h.servings, 0);
  const lowFresh = holding.filter(h => h.minsToExpiry !== null && h.minsToExpiry <= 30 && h.servings > 0).length;
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
          In the urns
        </span>
        <span style={{ fontSize: 15, fontWeight: 900, fontVariantNumeric: 'tabular-nums', color: pal.accent }}>
          {total}
        </span>
        <span style={{ fontSize: 12, color: pal.textFaint }}>servings ready</span>
        {lowFresh > 0 && (
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              marginLeft: 4,
              padding: '3px 10px',
              borderRadius: 100,
              background: pal.amberSurface,
              color: pal.amber,
              fontSize: 12,
              fontWeight: 800,
            }}
          >
            <Timer size={12} /> {lowFresh} brewing low on freshness
          </span>
        )}
      </div>
      {holding.length === 0 ? (
        <Empty>Urns empty — start a batch below</Empty>
      ) : (
        <CardGrid>
          {holding.map(h => (
            <UrnCard key={h.recipeId} held={h} />
          ))}
        </CardGrid>
      )}
    </div>
  );
}

function UrnCard({ held }: { held: HoldingNow }) {
  const pal = useTheme();
  const frac =
    held.minsToExpiry !== null ? Math.max(0, Math.min(1, held.minsToExpiry / held.shelfLifeMin)) : 0;
  const empty = held.servings <= 0;
  const useSoon = !empty && held.minsToExpiry !== null && held.minsToExpiry <= 30;
  const color = empty ? pal.urgent : frac > 0.4 ? pal.green : pal.amber;

  return (
    <div
      style={{
        border: `1px solid ${empty ? pal.urgentBorder : pal.borderCard}`,
        borderRadius: 12,
        background: empty ? pal.urgentSurface : pal.surface,
        boxShadow: empty ? 'none' : pal.cardShadow,
        padding: '14px 16px',
        height: 108,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        overflow: 'hidden',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, minWidth: 0 }}>
        <span
          style={{
            fontSize: 38,
            fontWeight: 900,
            lineHeight: 1,
            fontVariantNumeric: 'tabular-nums',
            color: empty ? pal.urgent : pal.text,
            flexShrink: 0,
          }}
        >
          {held.servings}
        </span>
        <span
          style={{
            fontSize: 14,
            fontWeight: 700,
            lineHeight: 1.2,
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
            minWidth: 0,
          }}
        >
          {held.recipeName}
        </span>
      </div>

      {empty ? (
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            alignSelf: 'flex-start',
            padding: '4px 10px',
            borderRadius: 100,
            background: pal.urgent,
            color: '#fff',
            fontSize: 12,
            fontWeight: 800,
            letterSpacing: '0.04em',
          }}
        >
          RUN DRY
        </span>
      ) : (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ flex: 1, height: 5, borderRadius: 3, background: pal.track, overflow: 'hidden' }}>
            <span style={{ display: 'block', width: `${frac * 100}%`, height: '100%', background: color }} />
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
            {held.minsToExpiry === null ? '—' : useSoon ? `use ${durLabel(held.minsToExpiry)}` : `${durLabel(held.minsToExpiry)} fresh`}
          </span>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Start-now card
// ─────────────────────────────────────────────────────────────────────────────

function StartCard({ batch, nowMin, onStart }: { batch: BrewBatch; nowMin: number; onStart: (b: BrewBatch) => void }) {
  const pal = useTheme();
  const dueIn = batch.startMin - nowMin;
  // Due (or overdue) → urgent red, "Start now". Still minutes out → a calmer
  // card with an honest countdown, so nobody starts a long brew early and
  // burns its freshness in the urn.
  const due = dueIn <= 0;
  return (
    <div
      style={{
        border: `1px solid ${due ? pal.urgentBorder : pal.borderCard}`,
        borderRadius: 12,
        background: due ? pal.urgentSurface : pal.surface,
        boxShadow: due ? 'none' : pal.cardShadow,
        padding: '14px 16px',
        minHeight: 132,
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
            fontSize: 34,
            fontWeight: 900,
            lineHeight: 1,
            fontVariantNumeric: 'tabular-nums',
            color: due ? pal.urgent : pal.text,
            flexShrink: 0,
          }}
        >
          {batch.qty}
        </span>
        <span style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
          <span
            style={{
              fontSize: 15,
              fontWeight: 700,
              lineHeight: 1.2,
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
            }}
          >
            {batch.recipeName}
          </span>
          <span style={{ fontSize: 11, color: pal.textMuted, marginTop: 2 }}>servings · {batch.reason}</span>
        </span>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        {batch.longLead && (
          <span
            title="A long brew — plan hours ahead"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 5,
              padding: '3px 9px',
              borderRadius: 100,
              background: pal.accentChipBg,
              color: pal.accentChipFg,
              fontSize: 11,
              fontWeight: 800,
            }}
          >
            <Clock size={12} /> {durLabel(batch.leadMinutes)} brew
          </span>
        )}
        <span style={{ fontSize: 12, fontWeight: 700, color: pal.textSecondary }}>
          ready {minutesToHHMM(batch.readyMin)}
        </span>
      </div>

      <button
        type="button"
        onClick={() => onStart(batch)}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
          width: '100%',
          minHeight: 40,
          borderRadius: 100,
          border: due ? 'none' : `1px solid ${pal.accentSolid}`,
          background: due ? pal.accentSolid : 'transparent',
          color: due ? pal.onAccent : pal.accentSolid,
          fontSize: 14,
          fontWeight: 800,
          cursor: 'pointer',
          fontFamily: 'var(--font-primary)',
        }}
      >
        <Play size={15} /> {due ? 'Start now' : `Start ${minutesToHHMM(batch.startMin)} · in ${durLabel(dueIn)}`}
      </button>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Brewing card
// ─────────────────────────────────────────────────────────────────────────────

function BrewingCard({ batch, nowMin }: { batch: BrewBatch; nowMin: number }) {
  const pal = useTheme();
  const readyIn = Math.max(0, batch.readyMin - nowMin);
  const elapsed = Math.max(0, Math.min(1, (nowMin - batch.startMin) / Math.max(1, batch.leadMinutes)));
  const ready = readyIn <= 0;
  return (
    <div
      style={{
        border: `1px solid ${ready ? pal.green : pal.accentChipBg}`,
        borderRadius: 12,
        background: ready ? pal.greenSurface : pal.surface,
        boxShadow: pal.cardShadow,
        padding: '14px 16px',
        minHeight: 116,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        gap: 10,
        overflow: 'hidden',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, minWidth: 0 }}>
        <span
          style={{
            fontSize: 30,
            fontWeight: 900,
            lineHeight: 1,
            fontVariantNumeric: 'tabular-nums',
            flexShrink: 0,
          }}
        >
          {batch.qty}
        </span>
        <span
          style={{
            fontSize: 14,
            fontWeight: 700,
            lineHeight: 1.2,
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
            minWidth: 0,
          }}
        >
          {batch.recipeName}
        </span>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ flex: 1, height: 5, borderRadius: 3, background: pal.track, overflow: 'hidden' }}>
          <span
            style={{
              display: 'block',
              width: `${elapsed * 100}%`,
              height: '100%',
              background: ready ? pal.green : pal.accent,
              transition: 'width 0.6s linear',
            }}
          />
        </span>
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 5,
            fontSize: 12,
            fontWeight: 800,
            color: ready ? pal.green : pal.accent,
            fontVariantNumeric: 'tabular-nums',
            flexShrink: 0,
          }}
        >
          <Flame size={13} />
          {ready ? 'Ready' : `${durLabel(readyIn)} → ${minutesToHHMM(batch.readyMin)}`}
        </span>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Later-today timeline
// ─────────────────────────────────────────────────────────────────────────────

function TimelineList({ batches, nowMin }: { batches: BrewBatch[]; nowMin: number }) {
  const pal = useTheme();
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        border: `1px solid ${pal.borderCard}`,
        borderRadius: 12,
        background: pal.surface,
        boxShadow: pal.cardShadow,
        overflow: 'hidden',
      }}
    >
      {batches.slice(0, 12).map((b, i) => (
        <div
          key={b.id}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            padding: '11px 16px',
            borderTop: i === 0 ? 'none' : `1px solid ${pal.border}`,
          }}
        >
          <span
            style={{
              fontSize: 14,
              fontWeight: 800,
              fontVariantNumeric: 'tabular-nums',
              color: pal.text,
              minWidth: 46,
            }}
          >
            {minutesToHHMM(b.startMin)}
          </span>
          <span style={{ width: 7, height: 7, borderRadius: '50%', background: b.accent, flexShrink: 0 }} />
          <span style={{ fontSize: 13, fontWeight: 600, color: pal.text, flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            Start <strong>{b.qty}</strong> {b.recipeName}
          </span>
          {b.longLead && (
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
                padding: '2px 8px',
                borderRadius: 100,
                background: pal.accentChipBg,
                color: pal.accentChipFg,
                fontSize: 10.5,
                fontWeight: 800,
                flexShrink: 0,
              }}
            >
              <Clock size={11} /> {durLabel(b.leadMinutes)}
            </span>
          )}
          <span style={{ fontSize: 12, fontWeight: 600, color: pal.textMuted, whiteSpace: 'nowrap', flexShrink: 0 }}>
            ready {minutesToHHMM(b.readyMin)}
          </span>
        </div>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Edify strip — the lead-time call
// ─────────────────────────────────────────────────────────────────────────────

function EdifyStrip({
  nextLongBrew,
  startNow,
  nowMin,
}: {
  nextLongBrew: BrewBatch | null;
  startNow: BrewBatch[];
  nowMin: number;
}) {
  const pal = useTheme();
  const message = nextLongBrew
    ? `${nextLongBrew.recipeName} takes ${durLabel(nextLongBrew.leadMinutes)} — start ${nextLongBrew.qty} at ${minutesToHHMM(nextLongBrew.startMin)} to have it ready for ${minutesToHHMM(nextLongBrew.readyMin)}.`
    : startNow.length > 0
      ? `${startNow.length} batch${startNow.length === 1 ? '' : 'es'} to start now — all sized to today's forecast.`
      : 'Urns are covered for the window ahead — brewing to plan.';
  const tone = nextLongBrew ? 'cook-ahead' : startNow.length > 0 ? 'cook-ahead' : 'steady';
  const chip =
    tone === 'cook-ahead'
      ? { bg: pal.accentChipBg, fg: pal.accentChipFg, label: 'Brew ahead' }
      : { bg: pal.greenSurface, fg: pal.green, label: 'On plan' };

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '9px 22px',
        borderBottom: `1px solid ${pal.border}`,
        background: pal.surfaceSubtle,
      }}
    >
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
          background: chip.bg,
          color: chip.fg,
          whiteSpace: 'nowrap',
        }}
      >
        {chip.label}
      </span>
      <span
        style={{
          fontSize: 14,
          fontWeight: 600,
          color: pal.text,
          minWidth: 0,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
      >
        {message}
      </span>
      <span style={{ marginLeft: 'auto', fontSize: 11, fontWeight: 600, color: pal.textFaint, whiteSpace: 'nowrap' }}>
        {minutesToHHMM(nowMin)}
      </span>
    </div>
  );
}

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
// Forecast sync badge
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
// Demo menu
// ─────────────────────────────────────────────────────────────────────────────

function DemoMenu({
  mode,
  onToggleMode,
  playing,
  atEnd,
  onStep5,
  onNextEvent,
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
  onNextEvent: () => void;
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
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        aria-label="Demo controls"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          padding: '6px 12px',
          borderRadius: 100,
          border: `1px solid ${pal.borderStrong}`,
          background: pal.chip,
          color: pal.text,
          cursor: 'pointer',
          fontSize: 12,
          fontWeight: 700,
          fontFamily: 'var(--font-primary)',
        }}
      >
        <SlidersHorizontal size={14} />
        Demo
        <ChevronDown size={13} style={{ marginLeft: -2 }} />
      </button>

      {open && (
        <>
          <div onClick={() => setOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 40 }} />
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
            {CHAGEE_STATIONS.map(l => (
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
            <MenuItem icon={<SkipForward size={15} />} label="Next event" disabled={atEnd} onClick={onNextEvent} />
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
