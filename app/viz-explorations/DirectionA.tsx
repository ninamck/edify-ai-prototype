'use client';

import { useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import {
  PALETTE,
  SUMMARY,
  TODAY,
  HOURLY_SAMPLE,
  WEEK,
  fmtUSD,
  fmtPct,
  fmtSignedPct,
} from './mockData';

/* ─── Direction A — Editorial ─────────────────────────────────────────
 *
 * Cream/sand backgrounds dominate. Navy ink. Cyan is reserved as a
 * decorative accent on the *single most important* number per tile —
 * rendered as a thick cyan underline (decorative, no text) and a
 * small filled chip carrying the delta. Cyan is never used as text on
 * a light surface because it fails AA there (cyan #28AFC9 on cream =
 * ~2.5:1; on white = ~2.6:1). All copy is navy on cream/sand which is
 * AAA throughout.
 *
 *   Contrast (calc'd from relative luminance):
 *   - Navy #001C35 on Cream  #FCF6EE → 15.2:1  AAA
 *   - Navy #001C35 on Sand   #F8E8D6 → 13.7:1  AAA
 *   - Navy #001C35 on White  #FFFFFF → 16.7:1  AAA
 *   - Navy #001C35 on Cyan   #28AFC9 →  6.5:1  AA  (used in delta chips)
 *
 * Feel: printed business report. Restrained chart styling, generous
 * whitespace, display-weight numerals.
 * ──────────────────────────────────────────────────────────────────── */

const NAVY = PALETTE.navy;
const CREAM = PALETTE.cream;
const SAND = PALETTE.sand;
const CYAN = PALETTE.cyan;

// ─────────────────────────────────────────────────────────────────────
// Key figure tile
// ─────────────────────────────────────────────────────────────────────

function EditorialTile({
  label,
  value,
  sub,
  delta,
  isHero,
}: {
  label: string;
  value: string;
  sub?: string;
  delta?: { value: number; positiveIsGood?: boolean };
  /** Hero tile gets the cyan underline + delta chip treatment. */
  isHero?: boolean;
}) {
  return (
    <div
      style={{
        background: SAND,
        padding: '20px 18px 22px',
        borderRadius: 4,
        border: `1px solid ${NAVY}`,
        boxSizing: 'border-box',
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
        minHeight: 132,
      }}
    >
      <div
        style={{
          fontSize: 10,
          fontWeight: 700,
          letterSpacing: '0.14em',
          textTransform: 'uppercase',
          color: NAVY, // 13.7:1 AAA on sand
        }}
      >
        {label}
      </div>

      <div style={{ display: 'flex', alignItems: 'baseline', flexWrap: 'wrap', gap: 8 }}>
        <span
          style={{
            fontSize: 'clamp(28px, 8vw, 38px)',
            fontWeight: 700,
            color: NAVY, // 13.7:1 AAA on sand
            letterSpacing: '-0.02em',
            lineHeight: 1,
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          {value}
        </span>

        {delta && (
          <DeltaChip value={delta.value} positiveIsGood={delta.positiveIsGood ?? true} />
        )}
      </div>

      {sub && (
        <div
          style={{
            fontSize: 12,
            fontWeight: 500,
            color: NAVY, // full navy, not muted: 13.7:1 AAA
            opacity: 0.78, // visual hierarchy via opacity, navy stays AA at this opacity
          }}
        >
          {sub}
        </div>
      )}

      {isHero && (
        <div
          aria-hidden
          style={{
            marginTop: 'auto',
            height: 4,
            background: CYAN,
            width: '36%',
          }}
        />
      )}
    </div>
  );
}

function DeltaChip({ value, positiveIsGood }: { value: number; positiveIsGood: boolean }) {
  const isGood = positiveIsGood ? value >= 0 : value <= 0;
  // Navy ink on cyan: 6.5:1 (AA). Navy on sand for "bad" delta: 13.7:1.
  const bg = isGood ? CYAN : SAND;
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        padding: '2px 8px',
        background: bg,
        color: NAVY,
        fontSize: 11,
        fontWeight: 700,
        letterSpacing: '0.02em',
        border: `1px solid ${NAVY}`,
        borderRadius: 999,
        fontVariantNumeric: 'tabular-nums',
      }}
    >
      {fmtSignedPct(value)}
    </span>
  );
}

// ─────────────────────────────────────────────────────────────────────
// Comparison bar (Net Sales vs Labour, point in time)
// ─────────────────────────────────────────────────────────────────────

function EditorialComparisonBar() {
  const max = Math.max(TODAY.netSales, TODAY.labourCosts);
  const salesPct = (TODAY.netSales / max) * 100;
  const labourPct = (TODAY.labourCosts / max) * 100;

  return (
    <div
      style={{
        background: CREAM,
        padding: '20px 18px',
        borderRadius: 4,
        border: `1px solid ${NAVY}`,
        boxSizing: 'border-box',
      }}
    >
      <Header label="Today, point in time" detail="Net Sales vs Labour" />

      <div style={{ marginTop: 18, display: 'flex', flexDirection: 'column', gap: 14 }}>
        <Row
          label="Net Sales"
          value={fmtUSD(TODAY.netSales, { decimals: 2 })}
          fillPct={salesPct}
          fill={NAVY}
        />
        <Row
          label="Labour Costs"
          value={fmtUSD(TODAY.labourCosts, { decimals: 2 })}
          subValue={`${fmtPct(TODAY.labourPct)} of sales`}
          fillPct={labourPct}
          fill={SAND}
          stroke
        />
      </div>
    </div>
  );

  function Row({
    label,
    value,
    subValue,
    fillPct,
    fill,
    stroke,
  }: {
    label: string;
    value: string;
    subValue?: string;
    fillPct: number;
    fill: string;
    stroke?: boolean;
  }) {
    return (
      <div>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'baseline',
            marginBottom: 6,
            gap: 8,
          }}
        >
          <span style={{ fontSize: 12, fontWeight: 600, color: NAVY, letterSpacing: '0.02em' }}>
            {label}
          </span>
          <span style={{ fontSize: 14, fontWeight: 700, color: NAVY, fontVariantNumeric: 'tabular-nums' }}>
            {value}
          </span>
        </div>
        <div style={{ height: 14, background: 'transparent', border: `1px solid ${NAVY}`, position: 'relative' }}>
          <div
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              bottom: 0,
              width: `${fillPct}%`,
              background: fill,
              ...(stroke ? { borderRight: `1px solid ${NAVY}` } : null),
            }}
            aria-hidden
          />
        </div>
        {subValue && (
          <div style={{ fontSize: 11, fontWeight: 500, color: NAVY, opacity: 0.7, marginTop: 4 }}>
            {subValue}
          </div>
        )}
      </div>
    );
  }
}

// ─────────────────────────────────────────────────────────────────────
// Stacked daily bars (7 days)
// ─────────────────────────────────────────────────────────────────────

function EditorialDailyBars() {
  const max = Math.max(...WEEK.map((d) => d.netSales + d.labour));
  const todayIdx = WEEK.length - 1;

  return (
    <div
      style={{
        background: CREAM,
        padding: '20px 18px',
        borderRadius: 4,
        border: `1px solid ${NAVY}`,
        boxSizing: 'border-box',
      }}
    >
      <Header label="This week" detail="Net Sales (navy) over Labour (sand)" />

      <div
        style={{
          marginTop: 22,
          display: 'grid',
          gridTemplateColumns: `repeat(${WEEK.length}, 1fr)`,
          gap: 10,
          alignItems: 'end',
          minHeight: 160,
        }}
      >
        {WEEK.map((d, i) => {
          const total = d.netSales + d.labour;
          const totalH = (total / max) * 140;
          const salesH = (d.netSales / total) * totalH;
          const labourH = (d.labour / total) * totalH;
          const isToday = i === todayIdx;
          return (
            <div key={d.day} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
              <div
                style={{
                  width: '100%',
                  display: 'flex',
                  flexDirection: 'column',
                  height: totalH,
                  position: 'relative',
                }}
              >
                {isToday && (
                  <div
                    aria-hidden
                    style={{
                      position: 'absolute',
                      top: -10,
                      left: 0,
                      right: 0,
                      height: 4,
                      background: CYAN,
                    }}
                  />
                )}
                <div style={{ flex: salesH, background: NAVY, border: `1px solid ${NAVY}` }} aria-hidden />
                <div style={{ flex: labourH, background: SAND, border: `1px solid ${NAVY}`, borderTop: 'none' }} aria-hidden />
              </div>
              <div
                style={{
                  fontSize: 10,
                  fontWeight: isToday ? 700 : 500,
                  color: NAVY,
                  letterSpacing: '0.02em',
                }}
              >
                {d.day}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────
// Hourly scrubber
// ─────────────────────────────────────────────────────────────────────

function EditorialScrubber() {
  const [idx, setIdx] = useState(0); // dummy stepper
  const window = `${HOURLY_SAMPLE.startLabel} – ${HOURLY_SAMPLE.endLabel}`;

  return (
    <div
      style={{
        background: CREAM,
        padding: '20px 18px',
        borderRadius: 4,
        border: `1px solid ${NAVY}`,
        boxSizing: 'border-box',
      }}
    >
      <Header label="Hour" detail="Tap to step through the day" />

      <div
        style={{
          marginTop: 16,
          display: 'flex',
          alignItems: 'center',
          gap: 12,
        }}
      >
        <ScrubBtn aria-label="Previous hour" onClick={() => setIdx((i) => i - 1)}>
          <ChevronLeft size={18} color={NAVY} strokeWidth={2.25} />
        </ScrubBtn>

        <div
          style={{
            flex: 1,
            background: SAND,
            border: `1px solid ${NAVY}`,
            padding: '10px 14px',
            textAlign: 'center',
          }}
        >
          <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: NAVY }}>
            Window
          </div>
          <div
            style={{
              fontSize: 18,
              fontWeight: 700,
              color: NAVY, // 13.7:1 AAA on sand
              fontVariantNumeric: 'tabular-nums',
              marginTop: 2,
            }}
          >
            {window}
          </div>
        </div>

        <ScrubBtn aria-label="Next hour" onClick={() => setIdx((i) => i + 1)}>
          <ChevronRight size={18} color={NAVY} strokeWidth={2.25} />
        </ScrubBtn>
      </div>

      <div style={{ marginTop: 18, display: 'flex', justifyContent: 'space-between', gap: 12 }}>
        <Stat
          label="Net Sales"
          value={fmtUSD(HOURLY_SAMPLE.netSales, { compact: true })}
          accent
        />
        <Stat
          label="Labour Costs"
          value={fmtUSD(HOURLY_SAMPLE.labourCosts, { compact: true })}
        />
      </div>

      {/* Hidden idx to silence unused warning */}
      <span style={{ display: 'none' }}>{idx}</span>
    </div>
  );

  function Stat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
    return (
      <div style={{ flex: 1, position: 'relative', paddingTop: 10 }}>
        {accent && (
          <span
            aria-hidden
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: 18,
              height: 4,
              background: CYAN,
            }}
          />
        )}
        <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: NAVY }}>
          {label}
        </div>
        <div
          style={{
            fontSize: 22,
            fontWeight: 700,
            color: NAVY,
            fontVariantNumeric: 'tabular-nums',
            marginTop: 4,
            letterSpacing: '-0.01em',
          }}
        >
          {value}
        </div>
      </div>
    );
  }
}

function ScrubBtn({
  children,
  onClick,
  ...rest
}: { children: React.ReactNode; onClick: () => void } & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      onClick={onClick}
      {...rest}
      style={{
        width: 38,
        height: 38,
        background: CREAM,
        border: `1px solid ${NAVY}`,
        borderRadius: 4,
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
      }}
    >
      {children}
    </button>
  );
}

// ─────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────

function Header({ label, detail }: { label: string; detail: string }) {
  return (
    <div>
      <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: NAVY }}>
        {label}
      </div>
      <div style={{ fontSize: 13, fontWeight: 500, color: NAVY, marginTop: 4, opacity: 0.78 }}>
        {detail}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────
// Direction wrapper
// ─────────────────────────────────────────────────────────────────────

export default function DirectionA() {
  return (
    <div
      style={{
        background: CREAM,
        padding: 'clamp(16px, 4vw, 28px)',
        fontFamily: 'var(--font-primary)',
        color: NAVY,
        borderRadius: 4,
        border: `1px solid ${NAVY}`,
      }}
    >
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase', color: NAVY }}>
          Direction A
        </div>
        <div
          style={{
            fontSize: 'clamp(20px, 5vw, 26px)',
            fontWeight: 700,
            color: NAVY,
            letterSpacing: '-0.01em',
            marginTop: 2,
          }}
        >
          Editorial
        </div>
        <div style={{ fontSize: 12, fontWeight: 500, color: NAVY, opacity: 0.78, marginTop: 4 }}>
          Cream and sand surfaces. Navy ink throughout. Cyan reserved as decorative
          accent and inside delta chips (where contrast permits).
        </div>
      </div>

      {/* Tiles row — 1 col mobile, 3 col desktop */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: 12,
        }}
      >
        <EditorialTile
          label="Sales to date"
          value={fmtUSD(SUMMARY.salesToDate)}
          sub="Week to date · all venues"
          delta={{ value: SUMMARY.salesDelta }}
          isHero
        />
        <EditorialTile
          label="Operational profit"
          value={fmtUSD(SUMMARY.opProfit, { decimals: 2 })}
          sub={`${fmtPct(SUMMARY.opProfitPct, 2)} of sales`}
          delta={{ value: SUMMARY.opProfitDelta }}
        />
        <EditorialTile
          label="Gross margin"
          value={fmtPct(SUMMARY.grossMargin)}
          sub="Vs 36% prior week"
          delta={{ value: SUMMARY.grossMarginDelta }}
        />
      </div>

      <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 12 }}>
        <EditorialComparisonBar />
        <EditorialDailyBars />
        <EditorialScrubber />
      </div>
    </div>
  );
}
