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

/* ─── Direction B — Control room ──────────────────────────────────────
 *
 * Navy backgrounds dominate. Cream and cyan are the working ink. High
 * density: smaller leading, tighter padding, more numbers per inch.
 * Cyan carries the *primary* number on each tile (exception: when the
 * number is genuinely "not the headline" we drop to cream).
 *
 *   Contrast (calc'd from relative luminance):
 *   - Cream #FCF6EE on Navy #001C35 → 15.2:1  AAA
 *   - White #FFFFFF on Navy #001C35 → 16.7:1  AAA
 *   - Sand  #F8E8D6 on Navy #001C35 → 13.7:1  AAA
 *   - Cyan  #28AFC9 on Navy #001C35 →  6.5:1  AA  (used freely)
 *
 *   Royal #1A148A is *not* used as text on navy (1.4:1 — fails). It
 *   appears only as a sparing inset/border accent on cyan blocks.
 *
 * Feel: GM operations console. What you'd glance at during service.
 * ──────────────────────────────────────────────────────────────────── */

const NAVY = PALETTE.navy;
const CREAM = PALETTE.cream;
const CYAN = PALETTE.cyan;
const SAND = PALETTE.sand;

// ─────────────────────────────────────────────────────────────────────
// Key figure tile
// ─────────────────────────────────────────────────────────────────────

function ConsoleTile({
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
  isHero?: boolean;
}) {
  return (
    <div
      style={{
        background: NAVY,
        padding: '14px 14px 16px',
        borderRadius: 6,
        border: `1px solid ${CYAN}`,
        boxSizing: 'border-box',
        display: 'flex',
        flexDirection: 'column',
        gap: 6,
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {isHero && (
        <span
          aria-hidden
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: 3,
            background: CYAN,
          }}
        />
      )}

      <div
        style={{
          fontSize: 10,
          fontWeight: 700,
          letterSpacing: '0.16em',
          textTransform: 'uppercase',
          color: SAND, // 13.7:1 on navy — AAA
        }}
      >
        {label}
      </div>

      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
        <span
          style={{
            fontSize: 'clamp(26px, 8vw, 34px)',
            fontWeight: 700,
            color: isHero ? CYAN : CREAM, // cyan 6.5:1 AA / cream 15.2:1 AAA on navy
            letterSpacing: '-0.02em',
            lineHeight: 1,
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          {value}
        </span>
        {delta && <ConsoleDelta value={delta.value} positiveIsGood={delta.positiveIsGood ?? true} />}
      </div>

      {sub && (
        <div
          style={{
            fontSize: 11,
            fontWeight: 500,
            color: CREAM,
            opacity: 0.85, // 0.85 × 15.2:1 still AAA
          }}
        >
          {sub}
        </div>
      )}
    </div>
  );
}

function ConsoleDelta({ value, positiveIsGood }: { value: number; positiveIsGood: boolean }) {
  const isGood = positiveIsGood ? value >= 0 : value <= 0;
  // Navy on cyan = 6.5:1 (good). For "bad", we use cream-on-navy via outline so AA holds.
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        padding: '2px 7px',
        background: isGood ? CYAN : 'transparent',
        color: isGood ? NAVY : CREAM,
        border: isGood ? `1px solid ${CYAN}` : `1px solid ${CREAM}`,
        fontSize: 11,
        fontWeight: 700,
        letterSpacing: '0.02em',
        borderRadius: 3,
        fontVariantNumeric: 'tabular-nums',
      }}
    >
      {fmtSignedPct(value)}
    </span>
  );
}

// ─────────────────────────────────────────────────────────────────────
// Comparison bar — Net Sales vs Labour
// ─────────────────────────────────────────────────────────────────────

function ConsoleComparisonBar() {
  const max = Math.max(TODAY.netSales, TODAY.labourCosts);
  const salesPct = (TODAY.netSales / max) * 100;
  const labourPct = (TODAY.labourCosts / max) * 100;

  return (
    <div
      style={{
        background: NAVY,
        padding: '14px 14px',
        borderRadius: 6,
        border: `1px solid ${CYAN}`,
      }}
    >
      <ConsoleHeader label="Today" detail="Net Sales · Labour" />

      <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 12 }}>
        <Row
          label="Net Sales"
          value={fmtUSD(TODAY.netSales, { decimals: 2 })}
          fillPct={salesPct}
          fill={CYAN}
        />
        <Row
          label="Labour"
          value={fmtUSD(TODAY.labourCosts, { decimals: 2 })}
          subValue={`${fmtPct(TODAY.labourPct)} of sales`}
          fillPct={labourPct}
          fill={CREAM}
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
  }: {
    label: string;
    value: string;
    subValue?: string;
    fillPct: number;
    fill: string;
  }) {
    return (
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8, marginBottom: 4 }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: SAND, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
            {label}
          </span>
          <span style={{ fontSize: 13, fontWeight: 700, color: CREAM, fontVariantNumeric: 'tabular-nums' }}>
            {value}
          </span>
        </div>
        <div style={{ height: 10, background: 'rgba(252, 246, 238, 0.12)', borderRadius: 2, position: 'relative', overflow: 'hidden' }}>
          <div
            aria-hidden
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              bottom: 0,
              width: `${fillPct}%`,
              background: fill,
              borderRadius: 2,
            }}
          />
        </div>
        {subValue && (
          <div style={{ fontSize: 11, fontWeight: 500, color: CREAM, opacity: 0.7, marginTop: 4 }}>
            {subValue}
          </div>
        )}
      </div>
    );
  }
}

// ─────────────────────────────────────────────────────────────────────
// Stacked daily bars
// ─────────────────────────────────────────────────────────────────────

function ConsoleDailyBars() {
  const max = Math.max(...WEEK.map((d) => d.netSales + d.labour));
  const todayIdx = WEEK.length - 1;

  return (
    <div
      style={{
        background: NAVY,
        padding: '14px 14px',
        borderRadius: 6,
        border: `1px solid ${CYAN}`,
      }}
    >
      <ConsoleHeader label="This week" detail="Net Sales (cyan) · Labour (cream)" />

      <div
        style={{
          marginTop: 18,
          display: 'grid',
          gridTemplateColumns: `repeat(${WEEK.length}, 1fr)`,
          gap: 6,
          alignItems: 'end',
          minHeight: 160,
        }}
      >
        {WEEK.map((d, i) => {
          const total = d.netSales + d.labour;
          const totalH = (total / max) * 142;
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
                  borderRadius: 2,
                  overflow: 'hidden',
                  outline: isToday ? `1px solid ${CYAN}` : 'none',
                  outlineOffset: 2,
                }}
              >
                <div style={{ flex: salesH, background: CYAN }} aria-hidden />
                <div style={{ flex: labourH, background: CREAM }} aria-hidden />
              </div>
              <div
                style={{
                  fontSize: 10,
                  fontWeight: isToday ? 700 : 500,
                  color: isToday ? CYAN : SAND, // cyan 6.5:1 / sand 13.7:1
                  letterSpacing: '0.04em',
                  textTransform: 'uppercase',
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

function ConsoleScrubber() {
  const [idx, setIdx] = useState(0);
  const window = `${HOURLY_SAMPLE.startLabel} – ${HOURLY_SAMPLE.endLabel}`;

  return (
    <div
      style={{
        background: NAVY,
        padding: '14px 14px',
        borderRadius: 6,
        border: `1px solid ${CYAN}`,
      }}
    >
      <ConsoleHeader label="Hour" detail="Step through the day" />

      <div style={{ marginTop: 14, display: 'flex', alignItems: 'stretch', gap: 8 }}>
        <ScrubBtn aria-label="Previous hour" onClick={() => setIdx((i) => i - 1)}>
          <ChevronLeft size={18} color={CREAM} strokeWidth={2.25} />
        </ScrubBtn>

        <div
          style={{
            flex: 1,
            background: 'transparent',
            border: `1px solid ${CYAN}`,
            padding: '8px 12px',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            textAlign: 'center',
            borderRadius: 4,
          }}
        >
          <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase', color: SAND }}>
            Window
          </div>
          <div
            style={{
              fontSize: 17,
              fontWeight: 700,
              color: CYAN, // 6.5:1 on navy
              fontVariantNumeric: 'tabular-nums',
              marginTop: 1,
              letterSpacing: '-0.01em',
            }}
          >
            {window}
          </div>
        </div>

        <ScrubBtn aria-label="Next hour" onClick={() => setIdx((i) => i + 1)}>
          <ChevronRight size={18} color={CREAM} strokeWidth={2.25} />
        </ScrubBtn>
      </div>

      <div style={{ marginTop: 14, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 0 }}>
        <Stat
          label="Net Sales"
          value={fmtUSD(HOURLY_SAMPLE.netSales, { compact: true })}
          accent
        />
        <Stat
          label="Labour"
          value={fmtUSD(HOURLY_SAMPLE.labourCosts, { compact: true })}
        />
      </div>

      <span style={{ display: 'none' }}>{idx}</span>
    </div>
  );

  function Stat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
    return (
      <div
        style={{
          padding: '10px 12px',
          borderLeft: accent ? `2px solid ${CYAN}` : `1px solid rgba(252,246,238,0.18)`,
          marginLeft: accent ? 0 : 0,
        }}
      >
        <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: SAND }}>
          {label}
        </div>
        <div
          style={{
            fontSize: 20,
            fontWeight: 700,
            color: accent ? CYAN : CREAM,
            fontVariantNumeric: 'tabular-nums',
            marginTop: 2,
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
        background: 'transparent',
        border: `1px solid ${CREAM}`,
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

function ConsoleHeader({ label, detail }: { label: string; detail: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 }}>
      <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.16em', textTransform: 'uppercase', color: CYAN }}>
        {label}
      </div>
      <div style={{ fontSize: 11, fontWeight: 500, color: CREAM, opacity: 0.78 }}>
        {detail}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────
// Direction wrapper
// ─────────────────────────────────────────────────────────────────────

export default function DirectionB() {
  return (
    <div
      style={{
        background: NAVY,
        padding: 'clamp(16px, 4vw, 28px)',
        fontFamily: 'var(--font-primary)',
        color: CREAM,
        borderRadius: 6,
      }}
    >
      <div style={{ marginBottom: 18 }}>
        <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase', color: CYAN }}>
          Direction B
        </div>
        <div
          style={{
            fontSize: 'clamp(20px, 5vw, 26px)',
            fontWeight: 700,
            color: CREAM,
            letterSpacing: '-0.01em',
            marginTop: 2,
          }}
        >
          Control room
        </div>
        <div style={{ fontSize: 12, fontWeight: 500, color: CREAM, opacity: 0.78, marginTop: 4 }}>
          Navy surfaces. Cream and cyan as data ink. Higher density. Cyan carries
          the headline metric on each tile.
        </div>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: 8,
        }}
      >
        <ConsoleTile
          label="Sales to date"
          value={fmtUSD(SUMMARY.salesToDate)}
          sub="Week to date · all venues"
          delta={{ value: SUMMARY.salesDelta }}
          isHero
        />
        <ConsoleTile
          label="Op profit"
          value={fmtUSD(SUMMARY.opProfit, { decimals: 2 })}
          sub={`${fmtPct(SUMMARY.opProfitPct, 2)} of sales`}
          delta={{ value: SUMMARY.opProfitDelta }}
          isHero
        />
        <ConsoleTile
          label="Gross margin"
          value={fmtPct(SUMMARY.grossMargin)}
          sub="Vs 36% prior week"
          delta={{ value: SUMMARY.grossMarginDelta }}
          isHero
        />
      </div>

      <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 8 }}>
        <ConsoleComparisonBar />
        <ConsoleDailyBars />
        <ConsoleScrubber />
      </div>
    </div>
  );
}
