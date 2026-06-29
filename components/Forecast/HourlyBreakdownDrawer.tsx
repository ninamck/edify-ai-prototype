'use client';

/**
 * HourlyBreakdownDrawer — right-anchored drawer that shows one SKU's
 * hourly forecast curve for the page's active date.
 *
 * Opened from the recipe-label cell in HorizonGrid. Mirrors the WhyPanel
 * drawer mechanics (portal, AnimatePresence, Esc-to-close, scrim) so the
 * forecast page feels like one tool rather than two.
 *
 * Body sections, top → bottom:
 *   1. Header     — SKU name + category, day caption, multiplier badge.
 *   2. Callouts   — Peak hour and Lunch share (11:00–14:00). These two
 *                   numbers answer the operator's two real questions:
 *                   "when does this thing peak?" and "how lunch-heavy is
 *                   it?".
 *   3. Bar chart  — one bar per kitchen hour. Lunch window is shaded so
 *                   the peak shape reads at a glance. Peak hour is filled
 *                   solid; the shoulders are light. On the Result tab,
 *                   past hours overlay a darker fill from the bottom that
 *                   shows the actual sold inside each forecast bar; the
 *                   current hour gets a diagonal stripe.
 *   4. Phase split — morning/midday/afternoon totals as a small recap,
 *                   so the drawer doubles as a "where does this SKU's
 *                   demand live?" surface.
 *
 * Total-level multipliers from the page cascade in — the same operator
 * nudge that shifts the headline KPIs scales every hourly bar here, so
 * the forecast page stays internally consistent.
 */

import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Clock, X } from 'lucide-react';
import {
  DEMO_TODAY,
  dayOfWeek,
  type SiteId,
} from '@/components/Production/fixtures';
import { DEMO_NOW_HHMM } from '@/components/Production/PlanStore';
import {
  buildHourlySalesByRecipe,
  formatHour,
  type RecipeHourCell,
  type RecipeSalesRow,
} from '@/components/Production/salesActuals';
import { formatCount } from './economics';

type Mode = 'forecast' | 'result';

const LUNCH_START_HOUR = 11;
const LUNCH_END_HOUR = 14; // inclusive: 11, 12, 13, 14

type Props = {
  siteId: SiteId;
  /** SKU to render. null means the drawer is closed. */
  skuId: string | null;
  /** Date the page is focused on — drawer follows the page's date. */
  date: string;
  /** Pre-formatted label like "Today" / "Yesterday · Wed 22 Apr". */
  dateLabel: string;
  /** Operator-applied total-level multiplier (1.0 = baseline). */
  multiplier: number;
  /** Forecast tab hides actuals; Result tab overlays them on past hours. */
  mode: Mode;
  onClose: () => void;
};

export default function HourlyBreakdownDrawer({
  siteId,
  skuId,
  date,
  dateLabel,
  multiplier,
  mode,
  onClose,
}: Props) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    if (skuId) window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [skuId, onClose]);

  if (!mounted) return null;

  return createPortal(
    <AnimatePresence>
      {skuId && (
        <DrawerBody
          key={`${skuId}|${date}`}
          siteId={siteId}
          skuId={skuId}
          date={date}
          dateLabel={dateLabel}
          multiplier={multiplier}
          mode={mode}
          onClose={onClose}
        />
      )}
    </AnimatePresence>,
    document.body,
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Drawer body
// ────────────────────────────────────────────────────────────────────────────

function DrawerBody({
  siteId,
  skuId,
  date,
  dateLabel,
  multiplier,
  mode,
  onClose,
}: {
  siteId: SiteId;
  skuId: string;
  date: string;
  dateLabel: string;
  multiplier: number;
  mode: Mode;
  onClose: () => void;
}) {
  const nowHHMM = useMemo(() => effectiveNowHHMM(date), [date]);
  const data = useMemo(
    () => buildHourlySalesByRecipe(siteId, date, nowHHMM, true),
    [siteId, date, nowHHMM],
  );
  const row = useMemo(
    () => data.rows.find(r => r.line.item.skuId === skuId) ?? null,
    [data.rows, skuId],
  );

  const showActuals = mode === 'result';
  const isOverridden = Math.abs(multiplier - 1) > 0.005;

  return (
    <>
      {/* Scrim */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.18 }}
        onClick={onClose}
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(15, 18, 24, 0.25)',
          zIndex: 950,
        }}
      />
      <motion.aside
        initial={{ x: '100%' }}
        animate={{ x: 0 }}
        exit={{ x: '100%' }}
        transition={{ type: 'tween', duration: 0.22, ease: 'easeOut' }}
        style={{
          position: 'fixed',
          top: 0,
          right: 0,
          height: '100vh',
          width: 'min(460px, 92vw)',
          background: '#ffffff',
          boxShadow: '-12px 0 32px rgba(0, 0, 0, 0.08)',
          zIndex: 951,
          display: 'flex',
          flexDirection: 'column',
          fontFamily: 'var(--font-primary)',
        }}
        aria-label={`Hourly forecast${row ? ` for ${row.line.recipe.name}` : ''}`}
      >
        {/* Header */}
        <header
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            gap: 12,
            padding: '16px 18px',
            borderBottom: '1px solid var(--color-border-subtle)',
          }}
        >
          <div style={{ minWidth: 0, flex: 1 }}>
            <span
              style={{
                fontSize: 10,
                fontWeight: 700,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                color: 'var(--color-text-muted)',
              }}
            >
              Hourly demand
            </span>
            <h2
              style={{
                margin: '4px 0 2px',
                fontSize: 18,
                fontWeight: 700,
                color: 'var(--color-text-primary)',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
              title={row?.line.recipe.name}
            >
              {row?.line.recipe.name ?? 'Recipe'}
            </h2>
            <div
              style={{
                display: 'flex',
                gap: 8,
                alignItems: 'center',
                fontSize: 13,
                color: 'var(--color-text-secondary)',
                flexWrap: 'wrap',
              }}
            >
              <span>
                {dateLabel} · {dayOfWeek(date)}
              </span>
              {row && (
                <span
                  style={{
                    fontSize: 10,
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    letterSpacing: '0.06em',
                    padding: '2px 6px',
                    background: 'var(--color-bg-hover)',
                    border: '1px solid var(--color-border-subtle)',
                    borderRadius: 999,
                    color: 'var(--color-text-muted)',
                  }}
                >
                  {row.line.recipe.category}
                </span>
              )}
              {isOverridden && (
                <span
                  style={{
                    fontSize: 10,
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    letterSpacing: '0.04em',
                    padding: '2px 6px',
                    background: 'color-mix(in srgb, var(--color-accent-active) 12%, white)',
                    border: '1px solid color-mix(in srgb, var(--color-accent-active) 35%, white)',
                    borderRadius: 999,
                    color: 'var(--color-accent-active)',
                    fontVariantNumeric: 'tabular-nums',
                  }}
                  title="Total-level forecast edit is applied to these bars"
                >
                  Edited {multiplier > 1 ? '+' : ''}
                  {Math.round((multiplier - 1) * 100)}%
                </span>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close hourly breakdown"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 32,
              height: 32,
              border: '1px solid var(--color-border-subtle)',
              borderRadius: 8,
              background: '#ffffff',
              color: 'var(--color-text-secondary)',
              cursor: 'pointer',
              flexShrink: 0,
            }}
          >
            <X size={15} />
          </button>
        </header>

        {/* Body */}
        <div
          style={{
            padding: '18px',
            display: 'flex',
            flexDirection: 'column',
            gap: 18,
            overflowY: 'auto',
            flex: 1,
          }}
        >
          {!row ? (
            <p style={{ fontSize: 13, color: 'var(--color-text-muted)', margin: 0 }}>
              No forecast for this SKU on {dateLabel}. Pick another date from the
              day picker above and re-open the drawer to see its hourly shape.
            </p>
          ) : (
            <SkuHourBody
              row={row}
              multiplier={multiplier}
              showActuals={showActuals}
              isLiveToday={date === DEMO_TODAY}
            />
          )}
        </div>
      </motion.aside>
    </>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Single-SKU body — callouts + bar chart + phase recap
// ────────────────────────────────────────────────────────────────────────────

function SkuHourBody({
  row,
  multiplier,
  showActuals,
  isLiveToday,
}: {
  row: RecipeSalesRow;
  multiplier: number;
  showActuals: boolean;
  isLiveToday: boolean;
}) {
  const cells = row.cells;
  const forecastByHour = useMemo(
    () => cells.map(c => c.forecast * multiplier),
    [cells, multiplier],
  );
  const maxBar = Math.max(...forecastByHour, 1);
  const forecastDayScaled = row.forecastDay * multiplier;

  const peakIdx = forecastByHour.reduce(
    (best, v, i) => (v > forecastByHour[best] ? i : best),
    0,
  );
  const peakCell = cells[peakIdx];

  const lunchUnits = useMemo(
    () =>
      cells.reduce(
        (acc, c, i) =>
          acc +
          (c.hour >= LUNCH_START_HOUR && c.hour <= LUNCH_END_HOUR
            ? forecastByHour[i]
            : 0),
        0,
      ),
    [cells, forecastByHour],
  );
  const lunchSharePct = forecastDayScaled > 0
    ? Math.round((lunchUnits / forecastDayScaled) * 100)
    : 0;

  // Phase recap — morning/midday/afternoon totals from the forecast.
  const phaseTotals = useMemo(() => {
    const t = { morning: 0, midday: 0, afternoon: 0 };
    for (let i = 0; i < cells.length; i++) {
      const h = cells[i].hour;
      const v = forecastByHour[i];
      if (h < LUNCH_START_HOUR) t.morning += v;
      else if (h <= LUNCH_END_HOUR) t.midday += v;
      else t.afternoon += v;
    }
    return t;
  }, [cells, forecastByHour]);

  return (
    <>
      {/* Day-total summary */}
      <div
        style={{
          display: 'flex',
          alignItems: 'baseline',
          gap: 10,
          flexWrap: 'wrap',
        }}
      >
        <span
          style={{
            fontSize: 26,
            fontWeight: 700,
            color: 'var(--color-text-primary)',
            fontVariantNumeric: 'tabular-nums',
            lineHeight: 1.1,
          }}
        >
          {formatCount(Math.round(forecastDayScaled))}
        </span>
        <span style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>
          forecast across the day
        </span>
      </div>

      {/* Peak + lunch share callouts */}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <Callout
          label="Peak hour"
          value={formatHour(peakCell.hour)}
          sub={`${formatCount(Math.round(forecastByHour[peakIdx]))} units`}
          tone="accent"
        />
        <Callout
          label="Lunch share"
          value={`${lunchSharePct}%`}
          sub={`${formatCount(Math.round(lunchUnits))} units · 11:00–14:00`}
          tone="warn"
        />
      </div>

      {/* Bar chart */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <h3 style={subheading}>By the hour</h3>
        <HourlyBars
          cells={cells}
          forecastByHour={forecastByHour}
          maxBar={maxBar}
          peakIdx={peakIdx}
          showActuals={showActuals}
          isLiveToday={isLiveToday}
        />
        {showActuals && (
          <div
            style={{
              display: 'flex',
              gap: 14,
              flexWrap: 'wrap',
              fontSize: 11.5,
              color: 'var(--color-text-secondary)',
              marginTop: 4,
            }}
          >
            <LegendSwatch
              label="Forecast"
              style={{
                background: 'color-mix(in srgb, var(--color-accent-active) 15%, white)',
                border: '1px solid color-mix(in srgb, var(--color-accent-active) 40%, white)',
              }}
            />
            <LegendSwatch
              label="Sold so far"
              style={{ background: 'var(--color-accent-active)' }}
            />
            <LegendSwatch
              label="Lunch window"
              style={{
                background: 'color-mix(in srgb, var(--color-warning) 12%, white)',
                border: '1px dashed color-mix(in srgb, var(--color-warning) 40%, white)',
              }}
            />
          </div>
        )}
      </div>

      {/* Phase recap */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <h3 style={subheading}>Within the day</h3>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: 8,
          }}
        >
          <PhaseRecap
            label="Morning"
            hours="06–10"
            value={phaseTotals.morning}
            share={
              forecastDayScaled > 0 ? phaseTotals.morning / forecastDayScaled : 0
            }
            tone="muted"
          />
          <PhaseRecap
            label="Midday"
            hours="11–14"
            value={phaseTotals.midday}
            share={
              forecastDayScaled > 0 ? phaseTotals.midday / forecastDayScaled : 0
            }
            tone="accent"
          />
          <PhaseRecap
            label="Afternoon"
            hours="15–19"
            value={phaseTotals.afternoon}
            share={
              forecastDayScaled > 0
                ? phaseTotals.afternoon / forecastDayScaled
                : 0
            }
            tone="muted"
          />
        </div>
      </div>

      {/* Live-day footnote — only meaningful on Result · Today. */}
      {showActuals && isLiveToday && (
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            padding: '8px 10px',
            fontSize: 11.5,
            color: 'var(--color-text-secondary)',
            background: 'var(--color-bg-hover)',
            border: '1px solid var(--color-border-subtle)',
            borderRadius: 8,
          }}
        >
          <Clock size={12} />
          Sold-so-far is as of {DEMO_NOW_HHMM}. Hours that haven&apos;t
          started yet show forecast only.
        </div>
      )}
    </>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Bar chart + small pieces
// ────────────────────────────────────────────────────────────────────────────

function HourlyBars({
  cells,
  forecastByHour,
  maxBar,
  peakIdx,
  showActuals,
  isLiveToday,
}: {
  cells: RecipeHourCell[];
  forecastByHour: number[];
  maxBar: number;
  peakIdx: number;
  showActuals: boolean;
  isLiveToday: boolean;
}) {
  const BAR_AREA_HEIGHT = 140;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <div
        style={{
          position: 'relative',
          display: 'grid',
          gridTemplateColumns: `repeat(${cells.length}, 1fr)`,
          gap: 3,
          height: BAR_AREA_HEIGHT,
          alignItems: 'end',
          padding: '0 2px',
        }}
      >
        {cells.map((cell, i) => {
          const fc = forecastByHour[i];
          const heightPct = (fc / maxBar) * 100;
          const inLunch =
            cell.hour >= LUNCH_START_HOUR && cell.hour <= LUNCH_END_HOUR;
          const isPeak = i === peakIdx;
          const actualFillPct = showActuals
            ? computeActualFill(cell, fc)
            : null;

          const titleParts: string[] = [
            `${formatHour(cell.hour)} — ${formatCount(Math.round(fc))} forecast`,
          ];
          if (showActuals && cell.actual != null) {
            titleParts.push(`${formatCount(cell.actual)} sold`);
          }
          if (cell.isCurrent && isLiveToday) {
            titleParts.push('in progress');
          }
          const title = titleParts.join(' · ');

          return (
            <div
              key={cell.hour}
              title={title}
              style={{
                position: 'relative',
                height: '100%',
                background: inLunch
                  ? 'color-mix(in srgb, var(--color-warning) 10%, white)'
                  : 'transparent',
                borderLeft:
                  inLunch && cell.hour === LUNCH_START_HOUR
                    ? '1px dashed color-mix(in srgb, var(--color-warning) 45%, white)'
                    : 'none',
                borderRight:
                  inLunch && cell.hour === LUNCH_END_HOUR
                    ? '1px dashed color-mix(in srgb, var(--color-warning) 45%, white)'
                    : 'none',
                display: 'flex',
                alignItems: 'end',
                justifyContent: 'center',
              }}
            >
              {/* Forecast bar */}
              <div
                style={{
                  position: 'relative',
                  width: '78%',
                  height: `${Math.max(heightPct, 2)}%`,
                  background: isPeak
                    ? 'var(--color-accent-active)'
                    : 'color-mix(in srgb, var(--color-accent-active) 18%, white)',
                  border: isPeak
                    ? '1px solid var(--color-accent-active)'
                    : '1px solid color-mix(in srgb, var(--color-accent-active) 35%, white)',
                  borderRadius: 3,
                  overflow: 'hidden',
                }}
              >
                {/* Actual fill from the bottom — Result tab past hours */}
                {showActuals && actualFillPct != null && (
                  <div
                    style={{
                      position: 'absolute',
                      left: 0,
                      right: 0,
                      bottom: 0,
                      height: `${actualFillPct}%`,
                      background: 'var(--color-accent-active)',
                      opacity: isPeak ? 0.85 : 1,
                    }}
                  />
                )}
                {/* Current-hour stripe */}
                {showActuals && cell.isCurrent && isLiveToday && (
                  <div
                    style={{
                      position: 'absolute',
                      inset: 0,
                      background:
                        'repeating-linear-gradient(45deg, transparent 0 4px, rgba(255,255,255,0.4) 4px 6px)',
                    }}
                  />
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Hour axis — label every 2nd hour */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: `repeat(${cells.length}, 1fr)`,
          gap: 3,
          padding: '0 2px',
        }}
      >
        {cells.map(cell => {
          const isLabelled = cell.hour % 2 === 0;
          return (
            <span
              key={cell.hour}
              style={{
                fontSize: 10,
                color: 'var(--color-text-muted)',
                textAlign: 'center',
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              {isLabelled ? `${String(cell.hour).padStart(2, '0')}` : ''}
            </span>
          );
        })}
      </div>
    </div>
  );
}

function Callout({
  label,
  value,
  sub,
  tone,
}: {
  label: string;
  value: string;
  sub: string;
  tone: 'accent' | 'warn';
}) {
  const palette =
    tone === 'accent'
      ? {
          bg: 'color-mix(in srgb, var(--color-accent-active) 10%, white)',
          border: 'color-mix(in srgb, var(--color-accent-active) 35%, white)',
          color: 'var(--color-accent-active)',
        }
      : {
          bg: 'color-mix(in srgb, var(--color-warning) 12%, white)',
          border: 'color-mix(in srgb, var(--color-warning) 35%, white)',
          color: 'var(--color-warning)',
        };
  return (
    <div
      style={{
        flex: 1,
        minWidth: 140,
        padding: '10px 12px',
        background: palette.bg,
        border: `1px solid ${palette.border}`,
        borderRadius: 10,
        display: 'flex',
        flexDirection: 'column',
        gap: 2,
      }}
    >
      <span
        style={{
          fontSize: 10,
          fontWeight: 700,
          textTransform: 'uppercase',
          letterSpacing: '0.06em',
          color: 'var(--color-text-muted)',
        }}
      >
        {label}
      </span>
      <span
        style={{
          fontSize: 18,
          fontWeight: 700,
          color: palette.color,
          fontVariantNumeric: 'tabular-nums',
          lineHeight: 1.1,
        }}
      >
        {value}
      </span>
      <span
        style={{
          fontSize: 12,
          color: 'var(--color-text-secondary)',
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        {sub}
      </span>
    </div>
  );
}

function PhaseRecap({
  label,
  hours,
  value,
  share,
  tone,
}: {
  label: string;
  hours: string;
  value: number;
  share: number;
  tone: 'accent' | 'muted';
}) {
  const isAccent = tone === 'accent';
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 6,
        padding: 10,
        background: 'var(--color-bg-hover)',
        border: '1px solid var(--color-border-subtle)',
        borderRadius: 10,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
        <span
          style={{
            fontSize: 11,
            fontWeight: 600,
            textTransform: 'uppercase',
            letterSpacing: '0.04em',
            color: isAccent
              ? 'var(--color-accent-active)'
              : 'var(--color-text-secondary)',
          }}
        >
          {label}
        </span>
        <span style={{ fontSize: 10, color: 'var(--color-text-muted)' }}>
          {hours}
        </span>
      </div>
      <div
        style={{
          height: 4,
          background: 'var(--color-border-subtle)',
          borderRadius: 999,
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            height: '100%',
            width: `${Math.round(share * 100)}%`,
            background: isAccent
              ? 'var(--color-accent-active)'
              : 'color-mix(in srgb, var(--color-accent-active) 35%, white)',
            borderRadius: 999,
          }}
        />
      </div>
      <div
        style={{
          display: 'flex',
          alignItems: 'baseline',
          justifyContent: 'space-between',
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        <span
          style={{
            fontSize: 14,
            fontWeight: 700,
            color: 'var(--color-text-primary)',
          }}
        >
          {formatCount(Math.round(value))}
        </span>
        <span style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>
          {Math.round(share * 100)}%
        </span>
      </div>
    </div>
  );
}

function LegendSwatch({
  label,
  style,
}: {
  label: string;
  style: React.CSSProperties;
}) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
      <span
        style={{
          width: 14,
          height: 10,
          borderRadius: 2,
          ...style,
        }}
      />
      {label}
    </span>
  );
}

const subheading: React.CSSProperties = {
  margin: 0,
  fontSize: 12,
  fontWeight: 600,
  textTransform: 'uppercase',
  letterSpacing: '0.06em',
  color: 'var(--color-text-secondary)',
};

// ────────────────────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────────────────────

function computeActualFill(
  cell: RecipeHourCell,
  forecastScaled: number,
): number | null {
  if (cell.actual == null) return null;
  if (forecastScaled <= 0) return cell.actual > 0 ? 100 : 0;
  const pct = (cell.actual / forecastScaled) * 100;
  return Math.min(100, Math.max(0, pct));
}

function effectiveNowHHMM(date: string): string {
  if (date === DEMO_TODAY) return DEMO_NOW_HHMM;
  if (date > DEMO_TODAY) return '00:00';
  return '23:59';
}
