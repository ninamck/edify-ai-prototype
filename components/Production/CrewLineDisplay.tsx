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
  Info,
  Timer,
  ChevronRight,
  SkipForward,
  Plus,
  Maximize2,
  Minimize2,
  Sun,
  Moon,
  RefreshCw,
} from 'lucide-react';
import { useCrewLoop, type DropItem, type HeldDisplay, type RecutTone } from './crewLoopStore';
import { useCookTimers, remainingSeconds, clearAllCookTimers } from './cookTimerStore';
import StepperViewBK from './StepperViewBK';
import { getRecipe } from './fixtures';
import { bkStationForRecipe } from './bkFixtures';
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

export default function CrewLineDisplay({ siteId: _siteId }: { siteId: SiteId }) {
  const loop = useCrewLoop();
  const timers = useCookTimers();
  const [stepperRecipe, setStepperRecipe] = useState<RecipeId | null>(null);
  const [cookQty, setCookQty] = useState(1);
  const [fullscreen, setFullscreen] = useState(false);
  const [mode, setMode] = useState<Mode>('light');
  const pal = PALETTES[mode];
  const cook = (recipeId: RecipeId, qty = 1) => {
    setStepperRecipe(recipeId);
    setCookQty(qty);
  };

  // Crew-started batches (from the stepper) move through the same lifecycle the
  // crew watches: while the cook timer runs they're ON THE LINE with a live
  // mm:ss countdown; once it lands ('done') they drop into the CABINET and age
  // on their hold-life. These are layered on top of the auto-driven loop.
  const crewCooking: DropItem[] = timers
    .filter(t => t.status !== 'done')
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

  const crewCabinet: HeldDisplay[] = timers
    .filter(t => t.status === 'done')
    .map(t => {
      const recipe = getRecipe(t.recipeId);
      const shelfLifeMin = recipe?.shelfLifeMinutes ?? 20;
      const agedMin = t.doneAt ? (Date.now() - t.doneAt) / 60000 : 0;
      return {
        id: `crew-${t.recipeId}`,
        recipeId: t.recipeId,
        name: recipe?.name ?? t.recipeId,
        count: t.qty,
        expiresInMin: Math.max(0, Math.round(shelfLifeMin - agedMin)),
        shelfLifeMin,
      } as HeldDisplay;
    })
    .filter(h => h.expiresInMin > 0);

  // A crew-started cook is a clean hand-off: while it's on the line it leaves
  // the urgent "Drop now" list (the crew is already on it) and the auto-loop's
  // own batch for that recipe is suppressed so it doesn't appear twice. Crew
  // batches lead each list so a just-started cook is the first thing seen.
  const crewCookingIds = new Set(crewCooking.map(i => i.recipeId));
  const onLine = [...crewCooking, ...loop.cooking.filter(c => !crewCookingIds.has(c.recipeId))];
  const dropNow = loop.dropNow.filter(d => !crewCookingIds.has(d.recipeId));
  const cabinet = [...crewCabinet, ...loop.cabinet];

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
          ...(fullscreen
            ? { position: 'fixed', inset: 0, zIndex: 9999, height: '100vh', width: '100vw' }
            : { height: '100%' }),
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
          <Flame size={18} color={pal.accent} />
          <span
            style={{
              fontSize: 13,
              fontWeight: 700,
              letterSpacing: '0.04em',
              textTransform: 'uppercase',
              color: pal.textSecondary,
            }}
          >
            Kitchen line
          </span>
          <span style={{ fontSize: 20, fontWeight: 800, fontVariantNumeric: 'tabular-nums', marginLeft: 4 }}>
            {loop.nowHHMM}
          </span>
          <ForecastSyncBadge nowHHMM={loop.nowHHMM} />
          <div style={{ flex: 1 }} />
          {/* Dark / light screen */}
          <TransportButton
            onClick={() => setMode(m => (m === 'dark' ? 'light' : 'dark'))}
            label={mode === 'dark' ? 'Light' : 'Dark'}
          >
            {mode === 'dark' ? <Sun size={14} /> : <Moon size={14} />}
          </TransportButton>
          {/* Stepped demo: the presenter advances the clock by hand so the
              room can see what changes between drops. */}
          <TransportButton onClick={() => loop.step(5)} label="+5 min" disabled={loop.atEnd}>
            <Plus size={14} />
          </TransportButton>
          <TransportButton onClick={loop.stepToNextDrop} label="Next drop" disabled={loop.atEnd} primary>
            <SkipForward size={14} />
          </TransportButton>
          <TransportButton onClick={loop.togglePlay} label={loop.playing ? 'Pause' : 'Auto'} disabled={loop.atEnd}>
            {loop.playing ? <Pause size={14} /> : <Play size={14} />}
          </TransportButton>
          <TransportButton onClick={resetAll} label="Reset">
            <RotateCcw size={14} />
          </TransportButton>
          <TransportButton
            onClick={() => setFullscreen(f => !f)}
            label={fullscreen ? 'Exit' : 'Full screen'}
          >
            {fullscreen ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
          </TransportButton>
        </div>

        {/* Quinn re-cut banner */}
        <RecutBanner recut={loop.recut} />

        {/* Cabinet strip — what's held + freshness, kept up top. Crew-cooked
            batches land here once their timer is done. */}
        <CabinetStrip cabinet={cabinet} />

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

          <span style={{ fontSize: 12, color: pal.textSecondary, whiteSpace: 'nowrap' }}>
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
          {dropNow.length > 0 && (
            <Section label="Drop now" tone="urgent" hint="Demand is ahead of the cabinet — get these on">
              <CardGrid>
                {dropNow.map(item => (
                  <DropCard key={item.id} item={item} variant="urgent" onCook={cook} />
                ))}
              </CardGrid>
            </Section>
          )}

          <Section label="On the line" hint="Broiling now">
            {onLine.length === 0 ? (
              <Empty>Nothing on the broiler — cabinet&apos;s covering demand</Empty>
            ) : (
              <CardGrid>
                {onLine.map(item => (
                  <DropCard key={item.id} item={item} variant="cooking" onCook={cook} />
                ))}
              </CardGrid>
            )}
          </Section>

          <Section
            label={`Coming up · ${loop.nextDropHHMM}`}
            hint="Expected demand next 15 min — pace for it"
            tone="muted"
          >
            {loop.nextDrop.length === 0 ? (
              <Empty>Quiet window ahead</Empty>
            ) : (
              <CardGrid>
                {loop.nextDrop.map(item => (
                  <DropCard key={item.id} item={item} variant="next" onCook={cook} />
                ))}
              </CardGrid>
            )}
          </Section>
        </div>

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
}: {
  item: DropItem;
  variant: 'urgent' | 'cooking' | 'next';
  onCook: (recipeId: RecipeId, qty: number) => void;
}) {
  const pal = useTheme();
  const liveLabel =
    item.crew && item.liveSeconds != null
      ? item.liveSeconds <= 0
        ? 'Ready'
        : `${Math.floor(item.liveSeconds / 60)}:${(item.liveSeconds % 60)
            .toString()
            .padStart(2, '0')}`
      : null;
  const isNext = variant === 'next';
  const isUrgent = variant === 'urgent';
  // Colour is reserved for meaning: red only on the urgent "drop now" card,
  // the station shows as a small dot (not a filled block), and "coming up"
  // recedes. That gives the eye one place to land per section.
  const surface = isUrgent ? pal.urgentSurface : pal.surface;
  const borderCol = isUrgent ? pal.urgentBorder : pal.borderCard;
  const countColor = isUrgent ? pal.urgent : pal.text;

  return (
    <button
      type="button"
      onClick={() => onCook(item.recipeId, item.count)}
      style={{
        textAlign: 'left',
        border: `1px solid ${borderCol}`,
        borderRadius: 12,
        background: surface,
        boxShadow: isUrgent ? 'none' : pal.cardShadow,
        color: pal.text,
        padding: '14px 16px',
        cursor: 'pointer',
        fontFamily: 'var(--font-primary)',
        opacity: isNext ? (pal.mode === 'light' ? 0.7 : 0.55) : 1,
        // Uniform card size — chips pin to the bottom, the name clamps so a
        // long component name can't make one card taller than its neighbours.
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
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            minWidth: 0,
            overflow: 'hidden',
          }}
        >
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
            title="Demand surging — cooking ahead"
            style={{
              fontSize: 11,
              fontWeight: 700,
              padding: '2px 7px',
              borderRadius: 100,
              background: pal.accentChipBg,
              color: pal.accentChipFg,
              whiteSpace: 'nowrap',
              flexShrink: 0,
            }}
          >
            Ahead
          </span>
        )}

        {liveLabel !== null ? (
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
              fontSize: 12,
              fontWeight: 800,
              fontVariantNumeric: 'tabular-nums',
              color: liveLabel === 'Ready' ? pal.green : pal.accent,
              marginLeft: 'auto',
              flexShrink: 0,
            }}
          >
            <Timer size={12} />
            {liveLabel}
          </span>
        ) : variant === 'cooking' && item.readyInMin !== null ? (
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
              fontSize: 12,
              fontWeight: 700,
              color: item.readyInMin <= 0 ? pal.green : pal.accent,
              marginLeft: 'auto',
              flexShrink: 0,
            }}
          >
            <Timer size={12} />
            {item.readyInMin <= 0 ? 'Ready' : `${item.readyInMin}m`}
          </span>
        ) : (
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 2,
              fontSize: 12,
              fontWeight: 600,
              color: isUrgent ? pal.urgent : pal.textFaint,
              marginLeft: 'auto',
              flexShrink: 0,
            }}
          >
            Steps <ChevronRight size={13} />
          </span>
        )}
      </div>
    </button>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Cabinet strip — what's held + freshness
// ─────────────────────────────────────────────────────────────────────────────

function CabinetStrip({ cabinet }: { cabinet: HeldDisplay[] }) {
  const pal = useTheme();
  const total = cabinet.reduce((a, h) => a + h.count, 0);
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '10px 24px',
        borderBottom: `1px solid ${pal.border}`,
        background: pal.surfaceSubtle,
        flexWrap: 'wrap',
      }}
    >
      <span
        style={{
          fontSize: 11,
          fontWeight: 800,
          letterSpacing: '0.1em',
          textTransform: 'uppercase',
          color: pal.textMuted,
          whiteSpace: 'nowrap',
        }}
      >
        Cabinet · {total}
      </span>
      {cabinet.length === 0 ? (
        <span style={{ fontSize: 13, color: pal.textFaint }}>Empty</span>
      ) : (
        cabinet.map(h => <CabinetChip key={h.id} held={h} />)
      )}
    </div>
  );
}

function CabinetChip({ held }: { held: HeldDisplay }) {
  const pal = useTheme();
  const frac = Math.max(0, Math.min(1, held.expiresInMin / held.shelfLifeMin));
  const color = frac > 0.5 ? pal.green : frac > 0.25 ? pal.accent : pal.urgent;
  // Freshness lives in a small dot + the expiry figure, so the cabinet reads
  // as quiet inventory and doesn't compete with the urgent "drop now" cards.
  return (
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 8,
        padding: '5px 10px',
        borderRadius: 100,
        background: pal.chip,
        border: `1px solid ${pal.borderCard}`,
        boxShadow: pal.cardShadow,
        whiteSpace: 'nowrap',
      }}
    >
      <span
        style={{
          width: 7,
          height: 7,
          borderRadius: '50%',
          background: color,
          flexShrink: 0,
        }}
      />
      <span style={{ fontSize: 14, fontWeight: 800, fontVariantNumeric: 'tabular-nums' }}>
        {held.count}
      </span>
      <span style={{ fontSize: 13, color: pal.textSecondary }}>{held.name}</span>
      <span
        style={{
          fontSize: 11,
          fontWeight: 700,
          color,
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        {held.expiresInMin <= 0 ? 'bin' : `${held.expiresInMin}m`}
      </span>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Re-cut banner
// ─────────────────────────────────────────────────────────────────────────────

function RecutBanner({ recut }: { recut: { message: string; tone: RecutTone } | null }) {
  const pal = useTheme();
  if (!recut) return null;
  const styles: Record<RecutTone, { bg: string; fg: string }> = {
    'cook-ahead': { bg: pal.accentChipBg, fg: pal.accentChipFg },
    'ease-off': { bg: pal.greenSurface, fg: pal.green },
    info: { bg: pal.infoBg, fg: pal.textSecondary },
  };
  const s = styles[recut.tone];
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '10px 22px',
        background: s.bg,
        color: s.fg,
        fontSize: 14,
        fontWeight: 600,
        borderBottom: `1px solid ${pal.border}`,
      }}
    >
      <Info size={16} />
      <span>{recut.message}</span>
      <span
        style={{
          marginLeft: 'auto',
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          opacity: 0.7,
        }}
      >
        Quinn re-cut
      </span>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Forecast sync badge — the demand the line cooks to is pulled from BK's POS
// (a third-party system), not typed in here. Shows it's connected + current.
// ─────────────────────────────────────────────────────────────────────────────

function ForecastSyncBadge({ nowHHMM }: { nowHHMM: string }) {
  const pal = useTheme();
  return (
    <span
      title={
        'Demand forecast synced from Burger King POS (drive-thru, kiosk & app). ' +
        'Blends 4-week sales history, local events and weather. Auto-syncs every 15 min.'
      }
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 7,
        marginLeft: 12,
        padding: '4px 10px',
        borderRadius: 100,
        background: pal.chip,
        border: `1px solid ${pal.borderCard}`,
        boxShadow: pal.cardShadow,
        whiteSpace: 'nowrap',
      }}
    >
      <RefreshCw size={12} color={pal.green} />
      <span style={{ fontSize: 11, fontWeight: 700, color: pal.text }}>Forecast synced</span>
      <span style={{ fontSize: 11, fontWeight: 600, color: pal.textFaint }}>
        · BK POS · {nowHHMM}
      </span>
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
