import type { Metadata } from 'next';
import DirectionA from './DirectionA';
import DirectionB from './DirectionB';
import DirectionC from './DirectionC';
import { PALETTE } from './mockData';

/**
 * /viz-explorations
 *
 * Three stylistic directions for the Command Centre data layer rendered
 * back-to-back with identical mock data. Mobile-first; everything is
 * legible at 380px wide.
 *
 * Direction A — Editorial: cream/sand surfaces, navy ink, cyan as
 *   decorative accent only (cyan-on-cream fails AA so it's never used
 *   for text on light surfaces in this direction).
 * Direction B — Control room: navy surfaces, cream + cyan as ink, dense.
 * Direction C — Mixed surface: tiles alternate navy/cream by metric
 *   class; royal blue + cyan as per-surface accents.
 *
 * Contrast (relative-luminance ratios, all directions):
 *   - Navy   #001C35 on Cream #FCF6EE → 15.2:1   AAA ✓
 *   - Navy   #001C35 on Sand  #F8E8D6 → 13.7:1   AAA ✓
 *   - Cream  #FCF6EE on Navy  #001C35 → 15.2:1   AAA ✓
 *   - Sand   #F8E8D6 on Navy  #001C35 → 13.7:1   AAA ✓
 *   - Cyan   #28AFC9 on Navy  #001C35 →  6.5:1   AA  ✓ (text-only on navy)
 *   - Royal  #1A148A on Cream #FCF6EE → 10.7:1   AAA ✓
 *   - Royal  #1A148A on Sand  #F8E8D6 →  9.5:1   AAA ✓
 *   - Navy   #001C35 on Cyan  #28AFC9 →  6.5:1   AA  ✓ (delta chips)
 *
 * The pairs explicitly *avoided* because they fail AA for body text:
 *   - Cyan   on Cream / Sand / White (≈2.5:1) — used as fill only
 *   - Royal  on Navy             (≈1.4:1) — never used as text on navy
 */

export const metadata: Metadata = {
  title: 'Viz explorations · Edify',
};

export default function VizExplorationsPage() {
  return (
    <main
      style={{
        minHeight: '100vh',
        background: PALETTE.cream,
        fontFamily: 'var(--font-primary)',
        color: PALETTE.navy,
        padding: 'clamp(16px, 4vw, 32px)',
        boxSizing: 'border-box',
      }}
    >
      <div
        style={{
          maxWidth: 980,
          margin: '0 auto',
          display: 'flex',
          flexDirection: 'column',
          gap: 'clamp(20px, 4vw, 32px)',
        }}
      >
        <PageHeader />
        <PaletteRow />
        <DirectionA />
        <DirectionB />
        <DirectionC />
      </div>
    </main>
  );
}

function PageHeader() {
  return (
    <header style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <span
        style={{
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: '0.18em',
          textTransform: 'uppercase',
          color: PALETTE.navy,
          // 15.2:1 on cream — AAA
          opacity: 0.7,
        }}
      >
        Command Centre · Visual exploration
      </span>
      <h1
        style={{
          fontSize: 'clamp(26px, 6vw, 36px)',
          fontWeight: 700,
          color: PALETTE.navy,
          letterSpacing: '-0.02em',
          margin: 0,
          lineHeight: 1.1,
        }}
      >
        Three takes on the same numbers
      </h1>
      <p
        style={{
          fontSize: 14,
          fontWeight: 500,
          color: PALETTE.navy,
          opacity: 0.78,
          margin: 0,
          maxWidth: 64 + 'ch',
          lineHeight: 1.5,
        }}
      >
        Editorial, Control room, and Mixed surface — same data set, same four
        components in each. Scroll through to compare. All directions verified
        at AA on every text element (see file-level comments in each direction
        for ratios).
      </p>
    </header>
  );
}

function PaletteRow() {
  // Reference strip so it's easy to eyeball the source palette.
  const swatches: { name: string; hex: string; ink: string }[] = [
    { name: 'Navy', hex: PALETTE.navy, ink: PALETTE.cream },
    { name: 'Royal', hex: PALETTE.royal, ink: PALETTE.cream },
    { name: 'Cyan', hex: PALETTE.cyan, ink: PALETTE.navy },
    { name: 'Cream', hex: PALETTE.cream, ink: PALETTE.navy },
    { name: 'Sand', hex: PALETTE.sand, ink: PALETTE.navy },
    { name: 'White', hex: PALETTE.white, ink: PALETTE.navy },
  ];
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(108px, 1fr))',
        gap: 6,
      }}
    >
      {swatches.map((s) => (
        <div
          key={s.hex}
          style={{
            background: s.hex,
            color: s.ink,
            padding: '10px 12px',
            borderRadius: 6,
            border: `1px solid ${PALETTE.navy}`,
            display: 'flex',
            flexDirection: 'column',
            gap: 2,
          }}
        >
          <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.06em' }}>
            {s.name}
          </span>
          <span style={{ fontSize: 11, fontWeight: 500, opacity: 0.85, fontVariantNumeric: 'tabular-nums' }}>
            {s.hex}
          </span>
        </div>
      ))}
    </div>
  );
}
