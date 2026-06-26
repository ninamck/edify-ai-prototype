'use client';

/**
 * PretCrewLineDisplay — the Pret hot line, built as a BATCH CLOCK.
 *
 * A Pret hot shelf runs on 30-minute batches. The whole screen is organised
 * around the next batch, so a crew member glancing up from the line always
 * knows two things instantly:
 *
 *   1. How long until the next batch  (the big countdown — the hero).
 *   2. Exactly what to make, in real counts.
 *
 * Three concrete blocks, never abstract:
 *   • NOW          — what the shelf is short of this batch; the count is
 *                    tap-to-edit so the crew can override how many to make.
 *   • COOKING NOW  — batches in the oven / on the press right now, with a
 *                    live cook timer.
 *   • COMING UP    — the forecast for the upcoming batch so the crew can pace.
 *
 * An "Available" shelf strip up top shows what's held, how fresh it is, and
 * how many of each have sold so far today. Everything is driven by the
 * simulated closed loop in `pretHotLoopStore`.
 *
 * Adapted from the Burger King CrewLineDisplay, tuned for Pret: 30-min
 * batches, the Pret hot-prod menu, sold-per-item on the shelf, editable
 * make counts, and no Edify/Quinn recommendation strip.
 */

import { useState, createContext, useContext } from 'react';
import { createPortal } from 'react-dom';
import {
  Pause,
  Play,
  RotateCcw,
  Flame,
  SkipForward,
  Maximize2,
  Minimize2,
  Sun,
  Moon,
  RefreshCw,
  Trash2,
  Pencil,
  Plus,
  X,
  SlidersHorizontal,
  ChevronDown,
  Check,
} from 'lucide-react';
import {
  usePretHotLoop,
  type HotDropItem,
  type HotHeldDisplay,
  type UpcomingBatch,
} from './pretHotLoopStore';
import { PRET_HOT_ITEMS } from './pretHotFixtures';
import QtyStepper, { getStepperValueStyle } from './QtyStepper';
import type { SiteId, RecipeId } from './fixtures';

// ─────────────────────────────────────────────────────────────────────────────
// Theme — one palette object per mode, read through context. Accent meaning is
// constant; the hot line leans warm (orange = hot food) with a green "fresh".
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
    heroImminentBg: 'linear-gradient(90deg, rgba(234,88,12,0.20), rgba(194,65,12,0.10))',
    sectionLabel: 'rgba(255,255,255,0.9)',
    urgent: '#ff7a68',
    urgentSoft: '#ffb4a8',
    urgentSurface: 'rgba(234,88,12,0.12)',
    urgentBorder: 'rgba(234,88,12,0.55)',
    accent: '#fb923c',
    accentSolid: '#c2410c',
    accentChipBg: 'rgba(234,88,12,0.22)',
    accentChipFg: '#fdba74',
    green: '#3ec07a',
    greenSurface: 'rgba(62,192,122,0.12)',
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
    heroImminentBg: 'linear-gradient(90deg, rgba(194,65,12,0.10), rgba(234,88,12,0.08))',
    sectionLabel: 'rgba(0,0,0,0.85)',
    urgent: '#c2410c',
    urgentSoft: '#c2410c',
    urgentSurface: 'rgba(194,65,12,0.07)',
    urgentBorder: 'rgba(194,65,12,0.4)',
    accent: '#c2410c',
    accentSolid: '#c2410c',
    accentChipBg: 'rgba(194,65,12,0.12)',
    accentChipFg: '#9a3412',
    green: '#1f9d57',
    greenSurface: 'rgba(62,192,122,0.16)',
    onAccent: '#ffffff',
  },
};

const ThemeContext = createContext<Palette>(PALETTES.light);
const useTheme = () => useContext(ThemeContext);

export default function PretCrewLineDisplay({ siteId: _siteId }: { siteId: SiteId }) {
  const loop = usePretHotLoop();
  const [fullscreen, setFullscreen] = useState(false);
  const [mode, setMode] = useState<Mode>('light');
  // Crew overrides for "make this many" — keyed by recipe, tap-to-edit.
  const [editedQty, setEditedQty] = useState<Record<string, number>>({});
  const [editingId, setEditingId] = useState<RecipeId | null>(null);
  // "Coming up" — collapsed shows the next batch; expanded shows the next few.
  const [showUpcoming, setShowUpcoming] = useState(false);
  // Add-order ("a large order just came in") modal.
  const [orderOpen, setOrderOpen] = useState(false);
  const [orderQtys, setOrderQtys] = useState<Record<string, number>>({});
  const pal = PALETTES[mode];

  const cookingIds = new Set(loop.cooking.map(i => i.recipeId));
  // Anything still short that isn't already cooking — the "Now" make list.
  const toMake = loop.toMake.filter(d => !cookingIds.has(d.recipeId));

  const setQty = (recipeId: RecipeId, qty: number) =>
    setEditedQty(prev => ({ ...prev, [recipeId]: Math.max(0, qty) }));

  const bumpOrderQty = (recipeId: RecipeId, delta: number) =>
    setOrderQtys(prev => ({ ...prev, [recipeId]: Math.max(0, (prev[recipeId] ?? 0) + delta) }));

  const openOrder = () => {
    setOrderQtys({});
    setOrderOpen(true);
  };

  const addLargeOrder = () => {
    const orders = PRET_HOT_ITEMS.map(r => ({
      recipeId: r.recipeId,
      qty: orderQtys[r.recipeId] ?? 0,
    })).filter(o => o.qty > 0);
    if (orders.length > 0) loop.addOrder(orders);
    setOrderOpen(false);
    setOrderQtys({});
  };

  const elapsedFrac = Math.max(
    0,
    Math.min(1, (loop.batchIntervalMin - loop.minsToNextBatch) / loop.batchIntervalMin),
  );
  const imminent = loop.minsToNextBatch <= 4;

  const content = (
    <ThemeContext.Provider value={pal}>
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          ...(fullscreen
            ? { position: 'fixed', inset: 0, zIndex: 9999, height: '100vh', width: '100vw' }
            : { position: 'relative', height: '100%', width: '100%', flex: 1 }),
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
            Hot line
          </span>
          <span style={{ fontSize: 20, fontWeight: 800, fontVariantNumeric: 'tabular-nums', marginLeft: 4 }}>
            {loop.nowHHMM}
          </span>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, marginLeft: 12 }}>
            <SyncBadge
              label="POS synced"
              detail={`· Pret POS · ${loop.nowHHMM}`}
              title={
                'Live sales synced from the Pret POS (till, kiosk & Click & Collect). ' +
                'Auto-syncs every few minutes.'
              }
            />
          </div>
          <div style={{ flex: 1 }} />
          <DemoMenu
            mode={mode}
            onToggleMode={() => setMode(m => (m === 'dark' ? 'light' : 'dark'))}
            playing={loop.playing}
            atEnd={loop.atEnd}
            onStep5={() => loop.step(5)}
            onNextBatch={loop.stepToNextBatch}
            onTogglePlay={loop.togglePlay}
            onReset={loop.reset}
            fullscreen={fullscreen}
            onToggleFullscreen={() => setFullscreen(f => !f)}
          />
        </div>

        {/* HERO — the batch clock, kept to a compact bar */}
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
            {imminent ? 'Batch incoming' : 'Next batch'}
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
              {loop.minsToNextBatch}
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

          <span style={{ fontSize: 12, fontWeight: 500, color: pal.textSecondary, whiteSpace: 'nowrap' }}>
            Next batch at{' '}
            <strong style={{ color: pal.text, fontVariantNumeric: 'tabular-nums' }}>
              {loop.nextBatchHHMM}
            </strong>
          </span>
        </div>

        {/* MAIN */}
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
          {/* AVAILABLE — the hero of this screen: what's ready to serve now. */}
          <ShelfSection shelf={loop.shelf} sold={loop.soldTotal} />

          {toMake.length > 0 && (
            <Section
              label="Now"
              tone="urgent"
              hint="What the shelf is short of — tap a count to change how many to make"
            >
              <CardGrid>
                {toMake.map(item => (
                  <HotCard
                    key={item.id}
                    item={item}
                    variant="now"
                    editing={editingId === item.recipeId}
                    qty={editedQty[item.recipeId] ?? item.count}
                    edited={editedQty[item.recipeId] != null}
                    onStartEdit={() => setEditingId(item.recipeId)}
                    onStopEdit={() => setEditingId(null)}
                    onSetQty={q => setQty(item.recipeId, q)}
                  />
                ))}
              </CardGrid>
            </Section>
          )}

          {loop.cooking.length > 0 && (
            <Section label="Cooking now" hint="In the oven / on the press — lands on the shelf when it's ready">
              <CardGrid>
                {loop.cooking.map(item => (
                  <HotCard key={item.id} item={item} variant="cooking" />
                ))}
              </CardGrid>
            </Section>
          )}

          <ComingUpSection
            batches={loop.upcomingBatches}
            expanded={showUpcoming}
            onToggle={() => setShowUpcoming(v => !v)}
          />
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
          qtys={orderQtys}
          onBump={bumpOrderQty}
          onConfirm={addLargeOrder}
          onClear={() => setOrderQtys({})}
          onClose={() => setOrderOpen(false)}
        />
      </div>
    </ThemeContext.Provider>
  );

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
  return <div style={{ fontSize: 14, color: pal.textFaint, padding: '10px 0' }}>{children}</div>;
}

// ─────────────────────────────────────────────────────────────────────────────
// Coming up — the next batch by default, with a toggle to reveal the next few
// batch windows so the crew can pace further ahead.
// ─────────────────────────────────────────────────────────────────────────────

function ComingUpSection({
  batches,
  expanded,
  onToggle,
}: {
  batches: UpcomingBatch[];
  expanded: boolean;
  onToggle: () => void;
}) {
  const pal = useTheme();
  const shown = expanded ? batches : batches.slice(0, 1);
  const moreCount = batches.length - 1;

  return (
    <div style={{ flexShrink: 0, display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 8 }}>
        <span
          style={{
            fontSize: 13,
            fontWeight: 800,
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
            color: pal.textFaint,
          }}
        >
          Coming up
        </span>
        <span style={{ fontSize: 12, color: pal.textFaint }}>Expected demand — pace for it</span>
        <div style={{ flex: 1 }} />
        {moreCount > 0 && (
          <button
            type="button"
            onClick={onToggle}
            aria-expanded={expanded}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 5,
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
            {expanded ? 'Show less' : `Show next ${moreCount} batch${moreCount === 1 ? '' : 'es'}`}
            <ChevronDown
              size={13}
              style={{ transform: expanded ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }}
            />
          </button>
        )}
      </div>

      {batches.length === 0 ? (
        <Empty>Quiet window ahead</Empty>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {shown.map(b => (
            <div key={b.id}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 6 }}>
                <span
                  style={{
                    fontSize: 12,
                    fontWeight: 800,
                    fontVariantNumeric: 'tabular-nums',
                    color: pal.textSecondary,
                  }}
                >
                  {b.hhmm}
                </span>
                <span style={{ fontSize: 11, color: pal.textFaint }}>in {b.minsUntil}m</span>
              </div>
              <CardGrid>
                {b.items.map(item => (
                  <HotCard key={item.id} item={item} variant="next" />
                ))}
              </CardGrid>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Add-order modal — manual "a large order just came in" hook. Drops the chosen
// items straight onto the line; they land on the shelf when cooked.
// ─────────────────────────────────────────────────────────────────────────────

function AddOrderModal({
  open,
  qtys,
  onBump,
  onConfirm,
  onClear,
  onClose,
}: {
  open: boolean;
  qtys: Record<string, number>;
  onBump: (recipeId: RecipeId, delta: number) => void;
  onConfirm: () => void;
  onClear: () => void;
  onClose: () => void;
}) {
  const pal = useTheme();
  if (!open) return null;
  const accent = pal.accentSolid;

  const total = PRET_HOT_ITEMS.reduce((a, r) => a + (qtys[r.recipeId] ?? 0), 0);
  const itemCount = PRET_HOT_ITEMS.filter(r => (qtys[r.recipeId] ?? 0) > 0).length;

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
            <h2 style={{ margin: 0, fontSize: 20, fontWeight: 800 }}>Add a large order</h2>
            <p style={{ margin: '4px 0 0', fontSize: 13, color: '#6b7280' }}>
              Set how many of each — they drop onto the line now and land on the shelf when cooked.
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

        <div
          style={{
            overflow: 'auto',
            padding: '4px 24px 12px',
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: 10,
          }}
        >
          {PRET_HOT_ITEMS.map(r => {
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
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <QtyStepper
                    size="touch"
                    canDecrement={qty > 0}
                    onDecrement={() => onBump(r.recipeId, -1)}
                    onIncrement={() => onBump(r.recipeId, 1)}
                    style={{ flexShrink: 0 }}
                  >
                    <span
                      style={{ ...getStepperValueStyle('touch'), color: active ? '#16181d' : '#9ca3af' }}
                    >
                      {qty}
                    </span>
                  </QtyStepper>
                  <div style={{ flex: 1 }} />
                  {[2, 4].map(n => (
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
            {total > 0 ? `${total} units · ${itemCount} item${itemCount === 1 ? '' : 's'}` : 'Nothing added yet'}
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

// ─────────────────────────────────────────────────────────────────────────────
// Hot card — one item to make / cooking / coming up
// ─────────────────────────────────────────────────────────────────────────────

function HotCard({
  item,
  variant,
  editing,
  qty,
  edited,
  onStartEdit,
  onStopEdit,
  onSetQty,
}: {
  item: HotDropItem;
  variant: 'now' | 'cooking' | 'next';
  editing?: boolean;
  qty?: number;
  edited?: boolean;
  onStartEdit?: () => void;
  onStopEdit?: () => void;
  onSetQty?: (q: number) => void;
}) {
  const pal = useTheme();
  const isNext = variant === 'next';
  const isNow = variant === 'now';
  const isCooking = variant === 'cooking';

  const cookLabel =
    item.readyInMin != null ? (item.readyInMin <= 0 ? 'Ready' : `${item.readyInMin}m`) : null;
  const cookReady = cookLabel === 'Ready';

  const surface = isNow ? pal.urgentSurface : isCooking ? pal.accentChipBg : pal.surface;
  const borderCol = isNow ? pal.urgentBorder : isCooking ? pal.accent : pal.borderCard;
  const countColor = isNow ? pal.urgent : pal.text;
  const shownQty = isNow ? qty ?? item.count : item.count;

  return (
    <div
      style={{
        textAlign: 'left',
        border: `1px solid ${borderCol}`,
        borderRadius: 12,
        background: surface,
        boxShadow: isNow ? 'none' : pal.cardShadow,
        color: pal.text,
        padding: '14px 16px',
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
        {isNow && editing ? (
          <QtyStepper
            size="touch"
            canDecrement={shownQty > 0}
            onDecrement={() => onSetQty?.(shownQty - 1)}
            onIncrement={() => onSetQty?.(shownQty + 1)}
            style={{ flexShrink: 0 }}
          >
            <span style={{ ...getStepperValueStyle('touch'), color: '#16181d' }}>{shownQty}</span>
          </QtyStepper>
        ) : (
          <button
            type="button"
            onClick={isNow ? onStartEdit : undefined}
            title={isNow ? 'Tap to change how many to make' : undefined}
            style={{
              display: 'inline-flex',
              alignItems: 'baseline',
              gap: 4,
              border: 'none',
              background: 'transparent',
              padding: 0,
              margin: 0,
              cursor: isNow ? 'pointer' : 'default',
              fontFamily: 'var(--font-primary)',
              flexShrink: 0,
            }}
          >
            <span
              style={{
                fontSize: isNext ? 28 : 34,
                fontWeight: 900,
                lineHeight: 1,
                fontVariantNumeric: 'tabular-nums',
                color: countColor,
              }}
            >
              {shownQty}
            </span>
            {isNow && <Pencil size={13} color={pal.urgent} style={{ alignSelf: 'center' }} />}
          </button>
        )}
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

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
        {isCooking ? (
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 5,
              fontSize: 12,
              fontWeight: 800,
              fontVariantNumeric: 'tabular-nums',
              color: cookReady ? pal.green : pal.accent,
            }}
          >
            <Flame size={13} />
            {cookReady ? 'Ready' : `Cooking ${cookLabel ?? ''}`}
          </span>
        ) : isNow ? (
          editing ? (
            <button
              type="button"
              onClick={onStopEdit}
              style={{
                marginLeft: 'auto',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                minHeight: 32,
                padding: '0 14px',
                borderRadius: 100,
                border: `1px solid ${pal.accentSolid}`,
                background: pal.accentSolid,
                color: pal.onAccent,
                fontSize: 12,
                fontWeight: 800,
                cursor: 'pointer',
                fontFamily: 'var(--font-primary)',
              }}
            >
              <Check size={13} /> Done
            </button>
          ) : (
            <span style={{ fontSize: 11, fontWeight: 700, color: pal.textMuted }}>
              {edited ? 'Adjusted · tap to edit' : 'to make'}
            </span>
          )
        ) : (
          <span style={{ fontSize: 11, fontWeight: 700, color: pal.textMuted }}>expected</span>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Available shelf — what's held + freshness + sold per item
// ─────────────────────────────────────────────────────────────────────────────

function ShelfSection({ shelf, sold }: { shelf: HotHeldDisplay[]; sold: number }) {
  const pal = useTheme();
  const fresh = shelf.filter(h => !h.expired);
  const total = fresh.reduce((a, h) => a + h.count, 0);
  const pullCount = shelf.filter(h => h.expired).reduce((a, h) => a + h.count, 0);
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
          Available
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
          title="Hot items sold from the line so far today"
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
        {pullCount > 0 && (
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
            <Trash2 size={12} /> {pullCount} to pull
          </span>
        )}
      </div>
      {shelf.length === 0 ? (
        <Empty>Shelf empty — make a batch below</Empty>
      ) : (
        <CardGrid>
          {shelf.map(h => (
            <ShelfCard key={h.id} held={h} />
          ))}
        </CardGrid>
      )}
    </div>
  );
}

function ShelfCard({ held }: { held: HotHeldDisplay }) {
  const pal = useTheme();
  const frac = Math.max(0, Math.min(1, held.expiresInMin / held.shelfLifeMin));
  const expired = held.expired;
  const color = expired ? pal.urgent : frac > 0.4 ? pal.green : pal.accent;
  const useSoon = !expired && held.expiresInMin <= 5;

  return (
    <div
      style={{
        border: `1px solid ${expired ? pal.urgent : pal.borderCard}`,
        borderRadius: 12,
        background: expired ? pal.urgentSurface : pal.surface,
        boxShadow: expired ? 'none' : pal.cardShadow,
        padding: '14px 16px',
        height: 116,
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
            color: expired ? pal.urgent : pal.text,
            flexShrink: 0,
          }}
        >
          {held.count}
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
          {held.name}
        </span>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        {expired ? (
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
            <Trash2 size={13} /> PULL NOW
          </span>
        ) : (
          <>
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
              {useSoon ? `use ${held.expiresInMin}m` : `${held.expiresInMin}m`}
            </span>
          </>
        )}
        {/* Amount sold — in the box, per item. */}
        <span
          title="Sold so far today"
          style={{
            display: 'inline-flex',
            alignItems: 'baseline',
            gap: 4,
            flexShrink: 0,
            fontSize: 11,
            fontWeight: 700,
            color: pal.textMuted,
            paddingLeft: 8,
            borderLeft: `1px solid ${pal.border}`,
          }}
        >
          <span style={{ fontSize: 13, fontWeight: 900, fontVariantNumeric: 'tabular-nums', color: pal.green }}>
            {held.sold}
          </span>
          sold
        </span>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// POS sync badge
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
// Demo menu — presenter controls behind one dropdown so the line reads like a
// real floor screen, not a control panel.
// ─────────────────────────────────────────────────────────────────────────────

function DemoMenu({
  mode,
  onToggleMode,
  playing,
  atEnd,
  onStep5,
  onNextBatch,
  onTogglePlay,
  onReset,
  fullscreen,
  onToggleFullscreen,
}: {
  mode: Mode;
  onToggleMode: () => void;
  playing: boolean;
  atEnd: boolean;
  onStep5: () => void;
  onNextBatch: () => void;
  onTogglePlay: () => void;
  onReset: () => void;
  fullscreen: boolean;
  onToggleFullscreen: () => void;
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
          <div onClick={() => setOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 40 }} />
          <div
            style={{
              position: 'absolute',
              top: 'calc(100% + 8px)',
              right: 0,
              zIndex: 41,
              minWidth: 220,
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
            <MenuLabel>Step the clock</MenuLabel>
            <MenuItem icon={<SkipForward size={15} />} label="+5 min" disabled={atEnd} onClick={onStep5} />
            <MenuItem
              icon={<SkipForward size={15} />}
              label="Next batch"
              disabled={atEnd}
              onClick={onNextBatch}
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
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  disabled?: boolean;
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
    </button>
  );
}

function TransportButton({
  children,
  onClick,
  label,
}: {
  children: React.ReactNode;
  onClick: () => void;
  label: string;
}) {
  const pal = useTheme();
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
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
      {children}
      {label}
    </button>
  );
}
