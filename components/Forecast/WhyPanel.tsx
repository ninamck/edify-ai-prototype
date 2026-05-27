'use client';

/**
 * WhyPanel — right-anchored drawer that explains a single forecast cell.
 *
 * This is the "teach what Quinn is doing" surface. The forecast itself
 * is just a number; the panel turns that number into something a
 * manager can defend, by surfacing the weighted signals the model used
 * and the recent history each signal is implicitly leaning on.
 *
 * Four sections, top → bottom:
 *   1. Header        — SKU name, day caption, projected qty (read-only).
 *   2. Signal stack  — each signal as a bar weighted by its contribution,
 *                      with the model's authored note inline. Sorted by
 *                      weight descending; weights are already normalised
 *                      in the fixture but we still display percentages
 *                      so the bar widths and labels stay legible.
 *   3. Phase split   — the byPhase morning/midday/afternoon mini-bar so
 *                      the operator can see when in the day this demand
 *                      materialises (often as informative as the total).
 *   4. Sparkline     — 7-day forecast vs actual line so the panel
 *                      doubles as a per-SKU accuracy chart. This is the
 *                      proof that today's forecast is in the same shape
 *                      as last week's that already played out.
 *
 * Implementation choices:
 *  - Portal + AnimatePresence mirror the Stock ItemDetailDrawer so the
 *    drawer animations feel identical across the app.
 *  - Sparkline drawn as an inline SVG — no chart library dependency.
 */

import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';
import {
  DEMO_TODAY,
  dayOffset,
  dayOfWeek,
  forecastFor,
  type DemandSignal,
  type SiteId,
} from '@/components/Production/fixtures';
import { buildSparklineForSku } from './accuracy';
import type { ForecastRow } from './accuracy';

type Props = {
  siteId: SiteId;
  row: ForecastRow | null;
  date: string | null;
  onClose: () => void;
};

const SIGNAL_LABELS: Record<DemandSignal, string> = {
  'sales-history': 'Sales history',
  weather: 'Weather',
  'stock-on-hand': 'Stock on hand',
  'online-orders': 'Online orders',
  'waste-history': 'Waste history',
  event: 'Local events',
  promo: 'Promotions',
};

const SPARKLINE_DAYS = 7;

export default function WhyPanel({ siteId, row, date, onClose }: Props) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  // Esc to close — matches the Stock drawer interaction pattern.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    if (row) window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [row, onClose]);

  if (!mounted) return null;

  return createPortal(
    <AnimatePresence>
      {row && date && (
        <DrawerBody key={`${row.skuId}|${date}`} row={row} date={date} siteId={siteId} onClose={onClose} />
      )}
    </AnimatePresence>,
    document.body,
  );
}

function DrawerBody({
  row,
  date,
  siteId,
  onClose,
}: {
  row: ForecastRow;
  date: string;
  siteId: SiteId;
  onClose: () => void;
}) {
  const forecast = useMemo(() => forecastFor(siteId, row.skuId, date), [siteId, row.skuId, date]);

  const sparklineDates = useMemo(
    () => Array.from({ length: SPARKLINE_DAYS }, (_, i) => dayOffset(-(SPARKLINE_DAYS - 1 - i), DEMO_TODAY)),
    [],
  );
  const sparkline = useMemo(
    () => buildSparklineForSku(siteId, row.skuId, sparklineDates),
    [siteId, row.skuId, sparklineDates],
  );

  const normalisedSignals = useMemo(() => {
    if (!forecast) return [];
    const total = forecast.signals.reduce((a, s) => a + s.weight, 0);
    if (total <= 0) return [];
    return [...forecast.signals]
      .map(s => ({ ...s, pct: (s.weight / total) * 100 }))
      .sort((a, b) => b.pct - a.pct);
  }, [forecast]);

  return (
    <>
      {/* Scrim — soft, just enough to focus attention on the drawer. */}
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
          width: 'min(420px, 92vw)',
          background: '#ffffff',
          boxShadow: '-12px 0 32px rgba(0, 0, 0, 0.08)',
          zIndex: 951,
          display: 'flex',
          flexDirection: 'column',
          fontFamily: 'var(--font-primary)',
        }}
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
              Why this number?
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
              title={row.recipe.name}
            >
              {row.recipe.name}
            </h2>
            <span style={{ fontSize: 13, color: 'var(--color-text-secondary)' }}>
              {dayOfWeek(date)} · {date} · {row.category}
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close panel"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 32,
              height: 32,
              border: '1px solid var(--color-border)',
              borderRadius: 8,
              background: '#ffffff',
              color: 'var(--color-text-secondary)',
              cursor: 'pointer',
            }}
          >
            <X size={15} />
          </button>
        </header>

        <div
          style={{
            padding: '16px 18px',
            display: 'flex',
            flexDirection: 'column',
            gap: 18,
            overflowY: 'auto',
            flex: 1,
          }}
        >
          {!forecast ? (
            <p style={{ fontSize: 13, color: 'var(--color-text-muted)', margin: 0 }}>
              No forecast on file for {dayOfWeek(date)} {date}.
            </p>
          ) : (
            <>
              {/* Projected qty headline */}
              <section
                style={{
                  background: 'var(--color-bg-hover)',
                  border: '1px solid var(--color-border-subtle)',
                  borderRadius: 8,
                  padding: '12px 14px',
                  display: 'flex',
                  alignItems: 'baseline',
                  gap: 10,
                }}
              >
                <span
                  style={{
                    fontSize: 30,
                    fontWeight: 800,
                    color: 'var(--color-text-primary)',
                    fontVariantNumeric: 'tabular-nums',
                    lineHeight: 1,
                  }}
                >
                  {forecast.projectedUnits.toLocaleString()}
                </span>
                <span style={{ fontSize: 13, color: 'var(--color-text-secondary)' }}>
                  units projected · status{' '}
                  <span
                    style={{
                      fontWeight: 600,
                      color: forecast.status === 'confirmed' ? 'var(--color-success)' : 'var(--color-warning)',
                    }}
                  >
                    {forecast.status}
                  </span>
                </span>
              </section>

              {/* Signal stack */}
              <section>
                <SectionHeader title="Signals driving this forecast" />
                {normalisedSignals.length === 0 ? (
                  <p style={{ fontSize: 13, color: 'var(--color-text-muted)', margin: '6px 0 0' }}>
                    No signal weights recorded for this entry.
                  </p>
                ) : (
                  <ul
                    style={{
                      listStyle: 'none',
                      margin: 0,
                      padding: 0,
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 10,
                    }}
                  >
                    {normalisedSignals.map(s => (
                      <li key={s.signal}>
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'baseline',
                            gap: 8,
                            marginBottom: 4,
                          }}
                        >
                          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text-primary)' }}>
                            {SIGNAL_LABELS[s.signal] ?? s.signal}
                          </span>
                          <span style={{ fontSize: 12, color: 'var(--color-text-muted)', fontVariantNumeric: 'tabular-nums' }}>
                            {Math.round(s.pct)}%
                          </span>
                        </div>
                        <div
                          style={{
                            height: 8,
                            background: 'var(--color-bg-hover)',
                            borderRadius: 4,
                            overflow: 'hidden',
                          }}
                        >
                          <div
                            style={{
                              width: `${Math.max(2, s.pct)}%`,
                              height: '100%',
                              background: 'var(--color-accent-active)',
                              transition: 'width 0.22s ease-out',
                            }}
                          />
                        </div>
                        {s.note && (
                          <span
                            style={{
                              display: 'block',
                              fontSize: 12,
                              color: 'var(--color-text-secondary)',
                              marginTop: 4,
                              lineHeight: 1.4,
                            }}
                          >
                            {s.note}
                          </span>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              {/* By-phase breakdown */}
              {forecast.byPhase && (
                <section>
                  <SectionHeader title="When in the day" />
                  <PhaseBars byPhase={forecast.byPhase} total={forecast.projectedUnits} />
                </section>
              )}

              {/* Sparkline */}
              <section>
                <SectionHeader title={`Last ${SPARKLINE_DAYS} days · forecast vs actual`} />
                <Sparkline points={sparkline} />
                <p
                  style={{
                    margin: '8px 0 0',
                    fontSize: 12,
                    color: 'var(--color-text-muted)',
                    lineHeight: 1.5,
                  }}
                >
                  Solid line is the prior forecast for each day. Dotted line is what
                  actually sold (synthesised from the till feed). The closer they sit, the
                  less work the model needs from a manager override.
                </p>
              </section>
            </>
          )}
        </div>
      </motion.aside>
    </>
  );
}

function SectionHeader({ title }: { title: string }) {
  return (
    <h3
      style={{
        margin: '0 0 8px',
        fontSize: 10,
        fontWeight: 700,
        letterSpacing: '0.08em',
        textTransform: 'uppercase',
        color: 'var(--color-text-muted)',
      }}
    >
      {title}
    </h3>
  );
}

function PhaseBars({
  byPhase,
  total,
}: {
  byPhase: { morning: number; midday: number; afternoon: number };
  total: number;
}) {
  const phases: Array<{ key: keyof typeof byPhase; label: string }> = [
    { key: 'morning', label: 'Morning' },
    { key: 'midday', label: 'Midday' },
    { key: 'afternoon', label: 'Afternoon' },
  ];
  const denom = total > 0 ? total : 1;
  return (
    <div style={{ display: 'flex', gap: 8 }}>
      {phases.map(p => {
        const v = byPhase[p.key];
        const pct = (v / denom) * 100;
        return (
          <div
            key={p.key}
            style={{
              flex: 1,
              background: 'var(--color-bg-hover)',
              border: '1px solid var(--color-border-subtle)',
              borderRadius: 8,
              padding: '8px 10px',
              display: 'flex',
              flexDirection: 'column',
              gap: 4,
            }}
          >
            <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--color-text-muted)' }}>
              {p.label}
            </span>
            <span style={{ fontSize: 18, fontWeight: 700, color: 'var(--color-text-primary)', fontVariantNumeric: 'tabular-nums' }}>
              {v}
            </span>
            <span style={{ fontSize: 11, color: 'var(--color-text-muted)', fontVariantNumeric: 'tabular-nums' }}>
              {Math.round(pct)}%
            </span>
          </div>
        );
      })}
    </div>
  );
}

/**
 * Inline SVG sparkline — two lines, both 0-based.
 *  - solid: forecast
 *  - dotted: actual
 * Y axis scales to whichever line is taller in the window so the
 * visual variance reads honestly even when one side is large.
 */
function Sparkline({ points }: { points: Array<{ date: string; forecast: number; actual: number }> }) {
  const width = 360;
  const height = 96;
  const padX = 8;
  const padY = 10;
  const innerW = width - padX * 2;
  const innerH = height - padY * 2;

  const max = Math.max(1, ...points.flatMap(p => [p.forecast, p.actual]));
  const xAt = (i: number) => padX + (i * innerW) / Math.max(1, points.length - 1);
  const yAt = (v: number) => padY + innerH - (v / max) * innerH;

  const forecastPath = points
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${xAt(i).toFixed(1)} ${yAt(p.forecast).toFixed(1)}`)
    .join(' ');

  const actualPath = points
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${xAt(i).toFixed(1)} ${yAt(p.actual).toFixed(1)}`)
    .join(' ');

  return (
    <div>
      <svg viewBox={`0 0 ${width} ${height}`} width="100%" height={height} role="img" aria-label="Forecast vs actual sparkline">
        {/* Baseline guide */}
        <line
          x1={padX}
          x2={width - padX}
          y1={padY + innerH}
          y2={padY + innerH}
          stroke="var(--color-border-subtle)"
          strokeWidth={1}
        />
        {/* Forecast line */}
        <path d={forecastPath} stroke="var(--color-accent-active)" strokeWidth={2} fill="none" />
        {/* Actual line — dotted */}
        <path d={actualPath} stroke="var(--color-success)" strokeWidth={2} fill="none" strokeDasharray="3 3" />
        {/* Latest-day dots */}
        {points.length > 0 && (
          <>
            <circle cx={xAt(points.length - 1)} cy={yAt(points[points.length - 1].forecast)} r={3} fill="var(--color-accent-active)" />
            <circle cx={xAt(points.length - 1)} cy={yAt(points[points.length - 1].actual)} r={3} fill="var(--color-success)" />
          </>
        )}
      </svg>
      {/* Legend + day labels */}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'var(--color-text-secondary)' }}>
          <span style={{ width: 14, height: 2, background: 'var(--color-accent-active)' }} /> Forecast
          <span style={{ width: 14, height: 2, background: 'var(--color-success)', marginLeft: 10 }} /> Actual
        </span>
        <span style={{ fontSize: 11, color: 'var(--color-text-muted)', fontVariantNumeric: 'tabular-nums' }}>
          {points[0]?.date} → {points[points.length - 1]?.date}
        </span>
      </div>
    </div>
  );
}
