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
 */

import { useState } from 'react';
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
} from 'lucide-react';
import { useCrewLoop, type DropItem, type HeldDisplay, type RecutTone } from './crewLoopStore';
import {
  useCookTimers,
  remainingSeconds,
  clearCookTimer,
  type CookTimer,
} from './cookTimerStore';
import StepperViewBK from './StepperViewBK';
import { getRecipe } from './fixtures';
import type { RecipeId, SiteId } from './fixtures';

export default function CrewLineDisplay({ siteId: _siteId }: { siteId: SiteId }) {
  const loop = useCrewLoop();
  const [stepperRecipe, setStepperRecipe] = useState<RecipeId | null>(null);
  const [fullscreen, setFullscreen] = useState(false);
  const cook = (recipeId: RecipeId) => setStepperRecipe(recipeId);

  const elapsedFrac = Math.max(
    0,
    Math.min(1, (loop.dropIntervalMin - loop.minsToNextDrop) / loop.dropIntervalMin),
  );
  const imminent = loop.minsToNextDrop <= 2;

  const content = (
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
        background: '#0b0c0f',
        color: '#fff',
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
          borderBottom: '1px solid rgba(255,255,255,0.08)',
        }}
      >
        <Flame size={18} color="#f5a623" />
        <span
          style={{
            fontSize: 13,
            fontWeight: 700,
            letterSpacing: '0.04em',
            textTransform: 'uppercase',
            color: 'rgba(255,255,255,0.6)',
          }}
        >
          Kitchen line
        </span>
        <span style={{ fontSize: 20, fontWeight: 800, fontVariantNumeric: 'tabular-nums', marginLeft: 4 }}>
          {loop.nowHHMM}
        </span>
        <div style={{ flex: 1 }} />
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
        <TransportButton onClick={loop.reset} label="Reset">
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

      {/* Cabinet strip — what's held + freshness, kept up top */}
      <CabinetStrip cabinet={loop.cabinet} />

      {/* Live cook timers started from the stepper — they keep running after
          the card is closed, so the line shows what's on and when it's ready. */}
      <CookTimersStrip onOpen={cook} />

      {/* HERO — the drop clock, kept to a compact bar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 16,
          padding: '10px 24px',
          background: imminent
            ? 'linear-gradient(90deg, rgba(245,91,74,0.18), rgba(245,166,35,0.10))'
            : 'rgba(255,255,255,0.03)',
          borderBottom: '1px solid rgba(255,255,255,0.08)',
        }}
      >
        <span
          style={{
            fontSize: 11,
            fontWeight: 800,
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
            color: imminent ? '#ffb4a8' : 'rgba(255,255,255,0.5)',
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
              color: imminent ? '#ff7a68' : '#fff',
            }}
          >
            {loop.minsToNextDrop}
          </span>
          <span style={{ fontSize: 14, fontWeight: 700, color: 'rgba(255,255,255,0.6)' }}>min</span>
        </div>

        <div
          style={{
            flex: 1,
            height: 6,
            borderRadius: 3,
            background: 'rgba(255,255,255,0.1)',
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              width: `${elapsedFrac * 100}%`,
              height: '100%',
              background: imminent ? '#ff7a68' : '#f5a623',
              transition: 'width 0.6s linear',
            }}
          />
        </div>

        <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)', whiteSpace: 'nowrap' }}>
          Drop at{' '}
          <strong style={{ color: '#fff', fontVariantNumeric: 'tabular-nums' }}>
            {loop.nextDropHHMM}
          </strong>
        </span>
      </div>

      {/* MAIN — cook instructions. Shares the remaining height and never
          scrolls: the three sections flex to fit one screen. */}
      <div
        style={{
          flex: 1,
          minHeight: 0,
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          gap: 14,
          padding: '16px 24px',
        }}
      >
        {loop.dropNow.length > 0 && (
          <Section label="Drop now" tone="urgent" hint="Demand is ahead of the cabinet — get these on">
            <CardGrid>
              {loop.dropNow.map(item => (
                <DropCard key={item.id} item={item} variant="urgent" onCook={cook} />
              ))}
            </CardGrid>
          </Section>
        )}

        <Section label="On the line" hint="Broiling now">
          {loop.cooking.length === 0 ? (
            <Empty>Nothing on the broiler — cabinet's covering demand</Empty>
          ) : (
            <CardGrid>
              {loop.cooking.map(item => (
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

      <StepperViewBK recipeId={stepperRecipe} onClose={() => setStepperRecipe(null)} />
    </div>
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
  const labelColor =
    tone === 'urgent'
      ? '#ff7a68'
      : tone === 'muted'
        ? 'rgba(255,255,255,0.4)'
        : 'rgba(255,255,255,0.9)';
  return (
    <div style={{ minHeight: 0, display: 'flex', flexDirection: 'column' }}>
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
        {hint && (
          <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)' }}>{hint}</span>
        )}
      </div>
      <div style={{ minHeight: 0, overflow: 'hidden' }}>{children}</div>
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
  return (
    <div
      style={{
        fontSize: 14,
        color: 'rgba(255,255,255,0.4)',
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
  onCook: (recipeId: RecipeId) => void;
}) {
  const isNext = variant === 'next';
  const isUrgent = variant === 'urgent';
  // Colour is reserved for meaning: red only on the urgent "drop now" card,
  // the station shows as a small dot (not a filled block), and "coming up"
  // recedes. That gives the eye one place to land per section.
  const surface = isUrgent ? 'rgba(245,91,74,0.10)' : 'rgba(255,255,255,0.045)';
  const borderCol = isUrgent ? 'rgba(245,91,74,0.55)' : 'rgba(255,255,255,0.09)';
  const countColor = isUrgent ? '#ff7a68' : '#fff';

  return (
    <button
      type="button"
      onClick={() => onCook(item.recipeId)}
      style={{
        textAlign: 'left',
        border: `1px solid ${borderCol}`,
        borderRadius: 12,
        background: surface,
        color: '#fff',
        padding: '14px 16px',
        cursor: 'pointer',
        fontFamily: 'var(--font-primary)',
        opacity: isNext ? 0.55 : 1,
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
              color: 'rgba(255,255,255,0.45)',
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
              background: 'rgba(245,166,35,0.18)',
              color: '#f7c46c',
              whiteSpace: 'nowrap',
              flexShrink: 0,
            }}
          >
            Ahead
          </span>
        )}

        {variant === 'cooking' && item.readyInMin !== null ? (
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
              fontSize: 12,
              fontWeight: 700,
              color: item.readyInMin <= 0 ? '#3ec07a' : '#f5a623',
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
              color: isUrgent ? '#ff7a68' : 'rgba(255,255,255,0.4)',
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
// Cook timers strip — live timers started from the stepper
// ─────────────────────────────────────────────────────────────────────────────

function CookTimersStrip({ onOpen }: { onOpen: (recipeId: RecipeId) => void }) {
  const timers = useCookTimers();
  if (timers.length === 0) return null;
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '10px 24px',
        borderBottom: '1px solid rgba(255,255,255,0.08)',
        background: 'rgba(245,166,35,0.06)',
        flexWrap: 'wrap',
      }}
    >
      <span
        style={{
          fontSize: 11,
          fontWeight: 800,
          letterSpacing: '0.1em',
          textTransform: 'uppercase',
          color: 'rgba(255,255,255,0.5)',
          whiteSpace: 'nowrap',
        }}
      >
        Cooking
      </span>
      {timers.map(t => (
        <CookTimerChip key={t.recipeId} timer={t} onOpen={onOpen} />
      ))}
    </div>
  );
}

function CookTimerChip({
  timer,
  onOpen,
}: {
  timer: CookTimer;
  onOpen: (recipeId: RecipeId) => void;
}) {
  const left = remainingSeconds(timer);
  const done = timer.status === 'done';
  const paused = timer.status === 'paused';
  const frac = timer.totalSeconds > 0 ? left / timer.totalSeconds : 0;
  const name = getRecipe(timer.recipeId as RecipeId)?.name ?? timer.recipeId;
  const accent = done ? '#3ec07a' : paused ? '#9aa0aa' : '#f5a623';
  return (
    <button
      type="button"
      onClick={() => (done ? clearCookTimer(timer.recipeId) : onOpen(timer.recipeId as RecipeId))}
      title={done ? 'Clear' : 'Open cook steps'}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 10,
        padding: '6px 12px',
        borderRadius: 100,
        border: `1px solid ${accent}66`,
        background: done ? 'rgba(62,192,122,0.12)' : 'rgba(255,255,255,0.05)',
        color: '#fff',
        cursor: 'pointer',
        fontFamily: 'var(--font-primary)',
      }}
    >
      <span style={{ fontSize: 13, fontWeight: 700 }}>{name}</span>
      <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)' }}>{timer.label}</span>
      <span
        style={{
          fontSize: 14,
          fontWeight: 800,
          fontVariantNumeric: 'tabular-nums',
          color: accent,
          minWidth: 52,
          textAlign: 'right',
        }}
      >
        {done
          ? 'Ready'
          : `${Math.floor(left / 60)}:${(left % 60).toString().padStart(2, '0')}${paused ? ' ❚❚' : ''}`}
      </span>
      {!done && (
        <span style={{ width: 40, height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.15)', overflow: 'hidden' }}>
          <span
            style={{
              display: 'block',
              width: `${Math.max(0, Math.min(1, frac)) * 100}%`,
              height: '100%',
              background: accent,
            }}
          />
        </span>
      )}
    </button>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Cabinet strip — what's held + freshness
// ─────────────────────────────────────────────────────────────────────────────

function CabinetStrip({ cabinet }: { cabinet: HeldDisplay[] }) {
  const total = cabinet.reduce((a, h) => a + h.count, 0);
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '10px 24px',
        borderBottom: '1px solid rgba(255,255,255,0.08)',
        background: 'rgba(255,255,255,0.02)',
        flexWrap: 'wrap',
      }}
    >
      <span
        style={{
          fontSize: 11,
          fontWeight: 800,
          letterSpacing: '0.1em',
          textTransform: 'uppercase',
          color: 'rgba(255,255,255,0.45)',
          whiteSpace: 'nowrap',
        }}
      >
        Cabinet · {total}
      </span>
      {cabinet.length === 0 ? (
        <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.35)' }}>Empty</span>
      ) : (
        cabinet.map(h => <CabinetChip key={h.id} held={h} />)
      )}
    </div>
  );
}

function CabinetChip({ held }: { held: HeldDisplay }) {
  const frac = Math.max(0, Math.min(1, held.expiresInMin / held.shelfLifeMin));
  const color = frac > 0.5 ? '#3ec07a' : frac > 0.25 ? '#f5a623' : '#ff5b4a';
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
        background: 'rgba(255,255,255,0.05)',
        border: '1px solid rgba(255,255,255,0.1)',
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
      <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.8)' }}>{held.name}</span>
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

const RECUT_STYLES: Record<RecutTone, { bg: string; fg: string }> = {
  'cook-ahead': { bg: 'rgba(245,166,35,0.16)', fg: '#f7c46c' },
  'ease-off': { bg: 'rgba(62,192,122,0.16)', fg: '#7ddaa3' },
  info: { bg: 'rgba(255,255,255,0.08)', fg: 'rgba(255,255,255,0.8)' },
};

function RecutBanner({ recut }: { recut: { message: string; tone: RecutTone } | null }) {
  if (!recut) return null;
  const s = RECUT_STYLES[recut.tone];
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
        borderBottom: '1px solid rgba(255,255,255,0.08)',
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
        border: primary ? '1px solid #f5a623' : '1px solid rgba(255,255,255,0.2)',
        background: primary ? '#f5a623' : 'rgba(255,255,255,0.06)',
        color: primary ? '#10110f' : '#fff',
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
