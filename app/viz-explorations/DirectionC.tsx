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

/* ─── Direction C — Mixed surface ─────────────────────────────────────
 *
 * Tiles alternate by metric class: financial = navy surface, with cream
 * + cyan ink on top; operational/efficiency = cream surface, with navy
 * ink and royal-blue accents. Every chart picks its accent from
 * whichever surface it's sitting on.
 *
 *   Contrast (calc'd from relative luminance):
 *   - Cream  #FCF6EE on Navy  #001C35 → 15.2:1  AAA
 *   - Cyan   #28AFC9 on Navy  #001C35 →  6.5:1  AA
 *   - Navy   #001C35 on Cream #FCF6EE → 15.2:1  AAA
 *   - Royal  #1A148A on Cream #FCF6EE → 10.7:1  AAA
 *   - Royal  #1A148A on Sand  #F8E8D6 →  9.5:1  AAA
 *
 *   Royal #1A148A is *only* used on light surfaces. On navy it would
 *   read as ~1.4:1 and is therefore avoided as text.
 *
 * Feel: modern editorial. The shifting surface gives the dashboard
 * rhythm — no single tile dominates and the mix telegraphs metric type.
 * ──────────────────────────────────────────────────────────────────── */

const NAVY = PALETTE.navy;
const ROYAL = PALETTE.royal;
const CYAN = PALETTE.cyan;
const CREAM = PALETTE.cream;
const SAND = PALETTE.sand;
const WHITE = PALETTE.white;

type Surface = 'navy' | 'cream';

// ─────────────────────────────────────────────────────────────────────
// Key figure tile
// ─────────────────────────────────────────────────────────────────────

function MixedTile({
  label,
  value,
  sub,
  delta,
  surface,
}: {
  label: string;
  value: string;
  sub?: string;
  delta?: { value: number; positiveIsGood?: boolean };
  surface: Surface;
}) {
  const isNavy = surface === 'navy';
  const bg = isNavy ? NAVY : CREAM;
  const ink = isNavy ? CREAM : NAVY;
  const labelInk = isNavy ? SAND : ROYAL; // royal on cream 10.7:1 / sand on navy 13.7:1
  const accent = isNavy ? CYAN : ROYAL;

  return (
    <div
      style={{
        background: bg,
        padding: '18px 16px 18px',
        borderRadius: 12,
        border: isNavy ? `1px solid ${NAVY}` : `1px solid ${ROYAL}`,
        boxSizing: 'border-box',
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span
          aria-hidden
          style={{
            display: 'inline-block',
            width: 6,
            height: 6,
            borderRadius: 999,
            background: accent,
          }}
        />
        <span
          style={{
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: '0.14em',
            textTransform: 'uppercase',
            color: labelInk,
          }}
        >
          {label}
        </span>
      </div>

      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap', marginTop: 4 }}>
        <span
          style={{
            fontSize: 'clamp(28px, 8vw, 36px)',
            fontWeight: 700,
            color: ink,
            letterSpacing: '-0.02em',
            lineHeight: 1,
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          {value}
        </span>
        {delta && <MixedDelta value={delta.value} surface={surface} positiveIsGood={delta.positiveIsGood ?? true} />}
      </div>

      {sub && (
        <div
          style={{
            fontSize: 12,
            fontWeight: 500,
            color: ink,
            opacity: 0.78,
            marginTop: 2,
          }}
        >
          {sub}
        </div>
      )}
    </div>
  );
}

function MixedDelta({
  value,
  surface,
  positiveIsGood,
}: {
  value: number;
  surface: Surface;
  positiveIsGood: boolean;
}) {
  const isGood = positiveIsGood ? value >= 0 : value <= 0;
  // On navy: cyan chip with navy ink (6.5:1 AA) for good, outlined cream for bad.
  // On cream: royal chip with cream ink (10.7:1 AAA) for good, outlined navy for bad.
  if (surface === 'navy') {
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
          borderRadius: 999,
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        {fmtSignedPct(value)}
      </span>
    );
  }
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        padding: '2px 7px',
        background: isGood ? ROYAL : 'transparent',
        color: isGood ? CREAM : NAVY,
        border: isGood ? `1px solid ${ROYAL}` : `1px solid ${NAVY}`,
        fontSize: 11,
        fontWeight: 700,
        borderRadius: 999,
        fontVariantNumeric: 'tabular-nums',
      }}
    >
      {fmtSignedPct(value)}
    </span>
  );
}

// ─────────────────────────────────────────────────────────────────────
// Comparison bar — financial → navy surface
// ─────────────────────────────────────────────────────────────────────

function MixedComparisonBar() {
  const max = Math.max(TODAY.netSales, TODAY.labourCosts);
  const salesPct = (TODAY.netSales / max) * 100;
  const labourPct = (TODAY.labourCosts / max) * 100;

  return (
    <div
      style={{
        background: NAVY,
        padding: 16,
        borderRadius: 12,
        border: `1px solid ${NAVY}`,
      }}
    >
      <SectionHeader surface="navy" label="Today" detail="Net Sales · Labour" />

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
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 4, gap: 8 }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: SAND, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
            {label}
          </span>
          <span style={{ fontSize: 13, fontWeight: 700, color: CREAM, fontVariantNumeric: 'tabular-nums' }}>
            {value}
          </span>
        </div>
        <div
          style={{
            height: 12,
            background: 'rgba(252,246,238,0.10)',
            borderRadius: 6,
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          <div
            aria-hidden
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              bottom: 0,
              width: `${fillPct}%`,
              background: fill,
              borderRadius: 6,
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
// Stacked daily bars — financial → navy surface
// ─────────────────────────────────────────────────────────────────────

function MixedDailyBars() {
  const max = Math.max(...WEEK.map((d) => d.netSales + d.labour));
  const todayIdx = WEEK.length - 1;

  return (
    <div
      style={{
        background: CREAM,
        padding: 16,
        borderRadius: 12,
        border: `1px solid ${ROYAL}`,
      }}
    >
      <SectionHeader surface="cream" label="This week" detail="Net Sales (navy) · Labour (royal)" />

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
                  borderRadius: 4,
                  overflow: 'hidden',
                  position: 'relative',
                }}
              >
                {isToday && (
                  <span
                    aria-hidden
                    style={{
                      position: 'absolute',
                      top: -8,
                      left: '50%',
                      transform: 'translateX(-50%)',
                      width: 6,
                      height: 6,
                      borderRadius: 999,
                      background: CYAN,
                    }}
                  />
                )}
                <div style={{ flex: salesH, background: NAVY }} aria-hidden />
                <div style={{ flex: labourH, background: ROYAL }} aria-hidden />
              </div>
              <div
                style={{
                  fontSize: 10,
                  fontWeight: isToday ? 700 : 500,
                  color: isToday ? ROYAL : NAVY,
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
// Hourly scrubber — operational → cream/sand surface
// ─────────────────────────────────────────────────────────────────────

function MixedScrubber() {
  const [idx, setIdx] = useState(0);
  const window = `${HOURLY_SAMPLE.startLabel} – ${HOURLY_SAMPLE.endLabel}`;

  return (
    <div
      style={{
        background: CREAM,
        padding: 16,
        borderRadius: 12,
        border: `1px solid ${ROYAL}`,
      }}
    >
      <SectionHeader surface="cream" label="Hour" detail="Step through the day" />

      <div style={{ marginTop: 14, display: 'flex', alignItems: 'stretch', gap: 8 }}>
        <ScrubBtn aria-label="Previous hour" onClick={() => setIdx((i) => i - 1)}>
          <ChevronLeft size={18} color={ROYAL} strokeWidth={2.25} />
        </ScrubBtn>

        <div
          style={{
            flex: 1,
            background: SAND,
            border: `1px solid ${ROYAL}`,
            padding: '8px 12px',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            textAlign: 'center',
            borderRadius: 8,
          }}
        >
          <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase', color: ROYAL }}>
            Window
          </div>
          <div
            style={{
              fontSize: 17,
              fontWeight: 700,
              color: NAVY, // 13.7:1 on sand
              fontVariantNumeric: 'tabular-nums',
              marginTop: 1,
              letterSpacing: '-0.01em',
            }}
          >
            {window}
          </div>
        </div>

        <ScrubBtn aria-label="Next hour" onClick={() => setIdx((i) => i + 1)}>
          <ChevronRight size={18} color={ROYAL} strokeWidth={2.25} />
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
          borderLeft: accent ? `2px solid ${ROYAL}` : `1px solid rgba(0, 28, 53, 0.12)`,
        }}
      >
        <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: ROYAL }}>
          {label}
        </div>
        <div
          style={{
            fontSize: 20,
            fontWeight: 700,
            color: NAVY,
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
        background: WHITE,
        border: `1px solid ${ROYAL}`,
        borderRadius: 8,
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

function SectionHeader({ surface, label, detail }: { surface: Surface; label: string; detail: string }) {
  const labelInk = surface === 'navy' ? CYAN : ROYAL;
  const detailInk = surface === 'navy' ? CREAM : NAVY;
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 }}>
      <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.16em', textTransform: 'uppercase', color: labelInk }}>
        {label}
      </div>
      <div style={{ fontSize: 11, fontWeight: 500, color: detailInk, opacity: 0.78 }}>
        {detail}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────
// Direction wrapper
// ─────────────────────────────────────────────────────────────────────

export default function DirectionC() {
  return (
    <div
      style={{
        background: SAND,
        padding: 'clamp(16px, 4vw, 28px)',
        fontFamily: 'var(--font-primary)',
        color: NAVY,
        borderRadius: 12,
      }}
    >
      <div style={{ marginBottom: 18 }}>
        <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase', color: ROYAL }}>
          Direction C
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
          Mixed surface
        </div>
        <div style={{ fontSize: 12, fontWeight: 500, color: NAVY, opacity: 0.78, marginTop: 4 }}>
          Tiles alternate by metric class — financial on navy, operational on
          cream. Royal blue and cyan deployed as accents per surface.
        </div>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: 10,
        }}
      >
        <MixedTile
          label="Sales to date"
          value={fmtUSD(SUMMARY.salesToDate)}
          sub="Week to date · all venues"
          delta={{ value: SUMMARY.salesDelta }}
          surface="navy"
        />
        <MixedTile
          label="Operational profit"
          value={fmtUSD(SUMMARY.opProfit, { decimals: 2 })}
          sub={`${fmtPct(SUMMARY.opProfitPct, 2)} of sales`}
          delta={{ value: SUMMARY.opProfitDelta }}
          surface="cream"
        />
        <MixedTile
          label="Gross margin"
          value={fmtPct(SUMMARY.grossMargin)}
          sub="Vs 36% prior week"
          delta={{ value: SUMMARY.grossMarginDelta }}
          surface="navy"
        />
      </div>

      <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 10 }}>
        <MixedComparisonBar />
        <MixedDailyBars />
        <MixedScrubber />
      </div>
    </div>
  );
}
