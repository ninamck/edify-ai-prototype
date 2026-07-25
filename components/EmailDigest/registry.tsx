/**
 * Email digest section registry — the "logic that knows what to do".
 *
 * A designed email is a stack of sections. Each section is a typed data
 * shape, not a report: the builder that assembles an email from a dashboard
 * maps every insight to one of these shapes (or the fallback) and the
 * registry decides how it renders. Customers compose WHICH sections and in
 * WHAT order; the registry owns HOW each one looks. That's what keeps
 * customer-built emails looking designed without a free-form editor.
 *
 * Shapes (the archetypes from the reference digest):
 *   top-story     — one KPI + comparison, promoted to the headline
 *   kpi-row       — a strip of 3–4 headline stats
 *   league-table  — entities × metrics with comparisons, totals, null flags
 *   ranked-bars   — one metric per entity as horizontal bars (± diverging)
 *   compliance    — per-check pass/attention cells
 *   fallback      — anything unrecognised: top-N rows + "open in Edify"
 *
 * Everything renders with email-safe primitives (tables, divs, inline
 * styles, no JS) so the same renderers could emit real HTML email.
 */

import type { CSSProperties, ReactNode } from 'react';

// ── Palette (editorial digest, Edify-branded) ──────────────────────────────

export const DIGEST = {
  ink: '#001C35',
  inkMuted: '#6B6455',
  cream: '#F6F1E7',
  card: '#FDFBF6',
  rule: '#E3DCCB',
  ruleStrong: '#001C35',
  good: '#166534',
  bad: '#B4380D',
  warn: '#B45309',
  accent: '#FF0058',
  chipA: '#001C35',
  chipB: '#C2402A',
  totalBg: '#F0EADA',
};

const UPPER: CSSProperties = {
  textTransform: 'uppercase',
  letterSpacing: '0.08em',
};

// ── Section data shapes ─────────────────────────────────────────────────────

export type DeltaValue = {
  /** Percentage (or pp/£) change; null = comparison unavailable → renders "—". */
  value: number | null;
  prefix?: string;
  suffix?: string;
  dp?: number;
  /** For costs/waste a fall is good; defaults to up-is-good. */
  goodWhenDown?: boolean;
};

export type LeagueCell =
  | { kind: 'text'; value: string; strong?: boolean; muted?: boolean }
  | { kind: 'money'; value: number; currency?: string }
  | { kind: 'pct'; value: number; dp?: number }
  | { kind: 'delta'; delta: DeltaValue }
  | { kind: 'flag'; text: string; span?: number };

export type TopStorySection = {
  shape: 'top-story';
  /** e.g. "TOP STORY · ESTATE SALES · VS LAST WEEK" */
  kicker: string;
  /** Headline parts; { em } fragments get the accent treatment. */
  headline: (string | { em: string })[];
  subline: string;
};

export type KpiRowSection = {
  shape: 'kpi-row';
  items: { label: string; value: string; sub: string; tone?: 'good' | 'bad' | 'plain' }[];
};

export type LeagueTableSection = {
  shape: 'league-table';
  title: string;
  contextNote?: string;
  badge?: string;
  columns: { label: string; align?: 'left' | 'right' }[];
  /** Rank numbers are added automatically when `ranked` is true. */
  ranked?: boolean;
  rows: LeagueCell[][];
  totals?: LeagueCell[];
  footnote?: string;
};

export type RankedBarsSection = {
  shape: 'ranked-bars';
  title: string;
  contextNote?: string;
  unit: string;
  rows: { label: string; value: number; good: boolean }[];
  /** Diverging mode: bars extend either side of zero (e.g. vs own baseline). */
  diverging?: boolean;
  targetNote?: string;
  footnote?: string;
};

export type ComplianceSection = {
  shape: 'compliance';
  title: string;
  contextNote?: string;
  items: { label: string; value: string; good: boolean; detail: string }[];
};

export type FallbackSection = {
  shape: 'fallback';
  title: string;
  contextNote?: string;
  /** Top-N rows of an unrecognised table, plus how many were left behind. */
  columns: string[];
  rows: string[][];
  remainingRows?: number;
};

export type DigestSection =
  | TopStorySection
  | KpiRowSection
  | LeagueTableSection
  | RankedBarsSection
  | ComplianceSection
  | FallbackSection;

// ── Dispatcher ──────────────────────────────────────────────────────────────

/** Sections that get a numbered chip + title bar. */
function isNumbered(s: DigestSection): boolean {
  return s.shape !== 'top-story' && s.shape !== 'kpi-row';
}

export function DigestBody({ sections }: { sections: DigestSection[] }) {
  let number = 0;
  return (
    <>
      {sections.map((section, i) => {
        const n = isNumbered(section) ? ++number : null;
        return (
          <div key={i} style={{ marginTop: i === 0 ? 0 : 28 }}>
            <SectionView section={section} number={n} />
          </div>
        );
      })}
    </>
  );
}

function SectionView({ section, number }: { section: DigestSection; number: number | null }) {
  switch (section.shape) {
    case 'top-story':
      return <TopStory s={section} />;
    case 'kpi-row':
      return <KpiRow s={section} />;
    case 'league-table':
      return (
        <SectionFrame n={number} title={section.title} contextNote={section.contextNote} badge={section.badge}>
          <LeagueTable s={section} />
          {section.footnote && <Footnote text={section.footnote} />}
        </SectionFrame>
      );
    case 'ranked-bars':
      return (
        <SectionFrame n={number} title={section.title} contextNote={section.contextNote}>
          <RankedBars s={section} />
          {section.footnote && <Footnote text={section.footnote} />}
        </SectionFrame>
      );
    case 'compliance':
      return (
        <SectionFrame n={number} title={section.title} contextNote={section.contextNote}>
          <ComplianceGrid s={section} />
        </SectionFrame>
      );
    case 'fallback':
      return (
        <SectionFrame n={number} title={section.title} contextNote={section.contextNote}>
          <FallbackTable s={section} />
        </SectionFrame>
      );
  }
}

// ── Shared frame ────────────────────────────────────────────────────────────

function SectionFrame({
  n,
  title,
  contextNote,
  badge,
  children,
}: {
  n: number | null;
  title: string;
  contextNote?: string;
  badge?: string;
  children: ReactNode;
}) {
  return (
    <div>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          paddingBottom: 8,
          borderBottom: `2px solid ${DIGEST.ruleStrong}`,
        }}
      >
        {n !== null && (
          <span
            style={{
              width: 22,
              height: 22,
              borderRadius: 4,
              background: n % 2 === 1 ? DIGEST.chipB : DIGEST.chipA,
              color: '#fff',
              fontSize: 10.5,
              fontWeight: 800,
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            {String(n).padStart(2, '0')}
          </span>
        )}
        <span style={{ ...UPPER, fontSize: 13, fontWeight: 800, color: DIGEST.ink, flex: 1, minWidth: 0 }}>
          {title}
        </span>
        {badge && (
          <span
            style={{
              ...UPPER,
              fontSize: 9,
              fontWeight: 800,
              color: DIGEST.good,
              border: `1px solid ${DIGEST.good}`,
              borderRadius: 999,
              padding: '2px 8px',
              whiteSpace: 'nowrap',
            }}
          >
            {badge}
          </span>
        )}
        {contextNote && (
          <span style={{ ...UPPER, fontSize: 9, fontWeight: 700, color: DIGEST.inkMuted, whiteSpace: 'nowrap' }}>
            {contextNote}
          </span>
        )}
      </div>
      {children}
    </div>
  );
}

function Footnote({ text }: { text: string }) {
  return (
    <p style={{ margin: '10px 0 0', fontSize: 11, color: DIGEST.inkMuted, lineHeight: 1.55 }}>{text}</p>
  );
}

// ── Renderers ───────────────────────────────────────────────────────────────

function TopStory({ s }: { s: TopStorySection }) {
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <span
          style={{
            ...UPPER,
            fontSize: 10,
            fontWeight: 800,
            color: '#fff',
            background: DIGEST.good,
            borderRadius: 3,
            padding: '3px 8px',
          }}
        >
          Top story
        </span>
        <span style={{ ...UPPER, fontSize: 10, fontWeight: 700, color: DIGEST.inkMuted }}>{s.kicker}</span>
      </div>
      <h2
        style={{
          margin: '12px 0 0',
          fontSize: 27,
          lineHeight: 1.25,
          fontWeight: 900,
          color: DIGEST.ink,
          textTransform: 'uppercase',
          letterSpacing: '0.01em',
        }}
      >
        {s.headline.map((part, i) =>
          typeof part === 'string' ? (
            <span key={i}>{part}</span>
          ) : (
            <span key={i} style={{ color: DIGEST.accent }}>{part.em}</span>
          ),
        )}
      </h2>
      <p style={{ ...UPPER, margin: '10px 0 0', fontSize: 10.5, fontWeight: 700, color: DIGEST.inkMuted, letterSpacing: '0.06em', lineHeight: 1.6 }}>
        {s.subline}
      </p>
    </div>
  );
}

function KpiRow({ s }: { s: KpiRowSection }) {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: `repeat(${Math.min(s.items.length, 4)}, 1fr)`,
        gap: 18,
        borderTop: `1px solid ${DIGEST.rule}`,
        borderBottom: `1px solid ${DIGEST.rule}`,
        padding: '14px 0',
      }}
    >
      {s.items.map((item) => (
        <div key={item.label}>
          <div style={{ ...UPPER, fontSize: 9.5, fontWeight: 700, color: DIGEST.inkMuted }}>{item.label}</div>
          <div
            style={{
              fontSize: 21,
              fontWeight: 800,
              marginTop: 5,
              color: item.tone === 'good' ? DIGEST.good : item.tone === 'bad' ? DIGEST.bad : DIGEST.ink,
            }}
          >
            {item.value}
          </div>
          <div style={{ ...UPPER, fontSize: 9, fontWeight: 600, color: DIGEST.inkMuted, marginTop: 4, letterSpacing: '0.05em' }}>
            {item.sub}
          </div>
        </div>
      ))}
    </div>
  );
}

const CELL_BASE: CSSProperties = {
  padding: '9px 8px',
  fontSize: 12,
  color: DIGEST.ink,
  borderBottom: `1px solid ${DIGEST.rule}`,
  whiteSpace: 'nowrap',
};

function formatDelta(d: DeltaValue): { text: string; color: string } {
  if (d.value === null) return { text: '—', color: DIGEST.inkMuted };
  const up = d.value >= 0;
  const good = d.goodWhenDown ? !up : up;
  const sign = up ? '+' : '−';
  return {
    text: `${sign}${d.prefix ?? ''}${Math.abs(d.value).toFixed(d.dp ?? 1)}${d.suffix ?? '%'}`,
    color: good ? DIGEST.good : DIGEST.bad,
  };
}

function CellView({ cell }: { cell: LeagueCell }) {
  switch (cell.kind) {
    case 'text':
      return (
        <span style={{ fontWeight: cell.strong ? 700 : 500, color: cell.muted ? DIGEST.inkMuted : undefined }}>
          {cell.value}
        </span>
      );
    case 'money':
      return <span style={{ fontWeight: 700 }}>{cell.currency ?? '£'}{cell.value.toLocaleString('en-GB')}</span>;
    case 'pct':
      return <span>{cell.value.toFixed(cell.dp ?? 1)}%</span>;
    case 'delta': {
      const d = formatDelta(cell.delta);
      return <span style={{ fontWeight: 700, color: d.color }}>{d.text}</span>;
    }
    case 'flag':
      return (
        <span style={{ ...UPPER, fontSize: 9.5, fontWeight: 700, color: DIGEST.warn, letterSpacing: '0.05em' }}>
          {cell.text}
        </span>
      );
  }
}

function LeagueTable({ s }: { s: LeagueTableSection }) {
  return (
    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
      <thead>
        <tr>
          {s.columns.map((c, i) => (
            <th
              key={i}
              style={{
                ...CELL_BASE,
                ...UPPER,
                fontSize: 9,
                fontWeight: 700,
                color: DIGEST.inkMuted,
                textAlign: c.align ?? (i === 0 ? 'left' : 'right'),
                borderBottom: `1px solid ${DIGEST.ruleStrong}`,
              }}
            >
              {c.label}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {s.rows.map((row, ri) => (
          <tr key={ri}>
            {row.map((cell, ci) => (
              <td
                key={ci}
                colSpan={cell.kind === 'flag' ? cell.span ?? 1 : 1}
                style={{
                  ...CELL_BASE,
                  textAlign: s.columns[ci]?.align ?? (ci === 0 ? 'left' : 'right'),
                }}
              >
                {ci === 0 && s.ranked && (
                  <span style={{ color: DIGEST.inkMuted, fontWeight: 700, marginRight: 8, fontSize: 10.5 }}>
                    {ri + 1}
                  </span>
                )}
                <CellView cell={cell} />
              </td>
            ))}
          </tr>
        ))}
        {s.totals && (
          <tr>
            {s.totals.map((cell, ci) => (
              <td
                key={ci}
                colSpan={cell.kind === 'flag' ? cell.span ?? 1 : 1}
                style={{
                  ...CELL_BASE,
                  textAlign: s.columns[ci]?.align ?? (ci === 0 ? 'left' : 'right'),
                  background: DIGEST.totalBg,
                  borderTop: `2px solid ${DIGEST.ruleStrong}`,
                  borderBottom: 'none',
                  fontWeight: 700,
                }}
              >
                <CellView cell={cell} />
              </td>
            ))}
          </tr>
        )}
      </tbody>
    </table>
  );
}

function RankedBars({ s }: { s: RankedBarsSection }) {
  const maxAbs = Math.max(...s.rows.map((r) => Math.abs(r.value)), 0.001);
  return (
    <div style={{ paddingTop: 4 }}>
      {s.rows.map((row) => {
        const widthPct = (Math.abs(row.value) / maxAbs) * 100;
        const color = row.good ? DIGEST.good : DIGEST.bad;
        const sign = s.diverging && row.value >= 0 ? '+' : s.diverging ? '−' : '';
        return (
          <div
            key={row.label}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              padding: '7px 0',
              borderBottom: `1px solid ${DIGEST.rule}`,
            }}
          >
            <span style={{ ...UPPER, width: 96, flexShrink: 0, fontSize: 10, fontWeight: 700, color: DIGEST.ink }}>
              {row.label}
            </span>
            <span style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
              <span
                style={{
                  display: 'inline-block',
                  height: 10,
                  width: `${Math.max(widthPct, 2)}%`,
                  maxWidth: '72%',
                  background: color,
                  borderRadius: 2,
                  opacity: 0.85,
                }}
              />
              <span style={{ fontSize: 11.5, fontWeight: 700, color }}>
                {sign}{Math.abs(row.value).toFixed(1)}{s.unit}
              </span>
            </span>
          </div>
        );
      })}
      {s.targetNote && (
        <div style={{ ...UPPER, fontSize: 9, fontWeight: 700, color: DIGEST.inkMuted, marginTop: 8 }}>
          {s.targetNote}
        </div>
      )}
    </div>
  );
}

function ComplianceGrid({ s }: { s: ComplianceSection }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 0 }}>
      {s.items.map((item, i) => (
        <div
          key={item.label}
          style={{
            padding: '12px 12px 12px 0',
            borderBottom: `1px solid ${DIGEST.rule}`,
            borderRight: i % 2 === 0 ? `1px solid ${DIGEST.rule}` : 'none',
            paddingLeft: i % 2 === 1 ? 12 : 0,
          }}
        >
          <div style={{ ...UPPER, fontSize: 9.5, fontWeight: 700, color: DIGEST.inkMuted }}>{item.label}</div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginTop: 4 }}>
            <span style={{ fontSize: 18, fontWeight: 800, color: item.good ? DIGEST.good : DIGEST.bad }}>
              {item.value}
            </span>
            <span style={{ fontSize: 12, fontWeight: 800, color: item.good ? DIGEST.good : DIGEST.bad }}>
              {item.good ? '✓' : '✗'}
            </span>
          </div>
          <div style={{ fontSize: 10.5, color: DIGEST.inkMuted, marginTop: 3, lineHeight: 1.45 }}>{item.detail}</div>
        </div>
      ))}
    </div>
  );
}

function FallbackTable({ s }: { s: FallbackSection }) {
  return (
    <div>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            {s.columns.map((c, i) => (
              <th
                key={c}
                style={{
                  ...CELL_BASE,
                  ...UPPER,
                  fontSize: 9,
                  fontWeight: 700,
                  color: DIGEST.inkMuted,
                  textAlign: i === 0 ? 'left' : 'right',
                  borderBottom: `1px solid ${DIGEST.ruleStrong}`,
                }}
              >
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {s.rows.map((row, ri) => (
            <tr key={ri}>
              {row.map((v, ci) => (
                <td key={ci} style={{ ...CELL_BASE, textAlign: ci === 0 ? 'left' : 'right', fontWeight: ci === 0 ? 600 : 500 }}>
                  {v}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {s.remainingRows ? (
        <p style={{ margin: '10px 0 0', fontSize: 11, fontWeight: 700, color: DIGEST.inkMuted }}>
          …and {s.remainingRows} more rows —{' '}
          <span style={{ textDecoration: 'underline', cursor: 'pointer', color: DIGEST.ink }}>open in Edify</span>
        </p>
      ) : null}
    </div>
  );
}
