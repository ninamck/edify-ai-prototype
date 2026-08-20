'use client';

import type { CSSProperties, ReactNode } from 'react';
import {
  formatNumber,
  formatPctSigned,
} from '@/components/Dashboard/CulinaryCollective/parts/format';
import {
  FIS_FLASH_PNL,
  type FlashPnLRow,
  type WeekValueColumn,
} from '@/components/Dashboard/CulinaryCollective/data/fisMockData';

/** Visual block grouping a contiguous run of P&L rows. The walker collapses
 *  the spreadsheet's `spacer` rows into block boundaries and inherits a
 *  block's title from its section header or its emphasised total. */
type Block = {
  /** When `null`, the block is rendered without a title bar -- used for
   *  continuation ratio rows like "Bar GP %" / "Food GP %". */
  title: string | null;
  rows: FlashPnLRow[];
};

function buildBlocks(rows: FlashPnLRow[]): Block[] {
  const blocks: Block[] = [];
  let current: FlashPnLRow[] = [];
  for (const r of rows) {
    if (r.kind === 'spacer') {
      if (current.length) blocks.push(makeBlock(current));
      current = [];
    } else {
      current.push(r);
    }
  }
  if (current.length) blocks.push(makeBlock(current));
  return blocks;
}

function makeBlock(rows: FlashPnLRow[]): Block {
  const section = rows.find((r) => r.kind === 'section');
  if (section) {
    return { title: section.label, rows: rows.filter((r) => r.kind !== 'section') };
  }
  const emph = rows.find((r) => r.kind === 'total' && r.emphasised);
  if (emph) return { title: emph.label, rows };
  return { title: null, rows };
}

const BLOCKS = buildBlocks(FIS_FLASH_PNL);

// ---------------------------------------------------------------------------
// Cell formatters
// ---------------------------------------------------------------------------

/** Currency cell -- 0 → blank, negatives in parentheses, no $ prefix because
 *  the unit is implied by the column header. Matches the spreadsheet style
 *  where every cell in a P&L row is in $. */
function fmtCurrency(value: number | null | undefined): string {
  if (value === null || value === undefined) return '';
  if (value === 0) return '';
  return formatNumber(value, { decimals: 0 });
}

/** Variance % cell -- "+3.3%" / "(23.1%)". */
function fmtPctSigned(value: number | null | undefined): string {
  if (value === null || value === undefined) return '';
  return formatPctSigned(value, { decimals: 1 });
}

/** Ratio % cell (used for `kind === 'pct'` rows where actual values are
 *  themselves percentages). */
function fmtPctValue(value: number | null | undefined): string {
  if (value === null || value === undefined) return '';
  if (value === 0) return '';
  const pct = value * 100;
  const abs = Math.abs(pct);
  const fixed = abs.toFixed(1);
  return pct < 0 ? `(${fixed}%)` : `${fixed}%`;
}

/** Variance pp cell for ratio rows -- shows percentage points with a sign. */
function fmtPctPp(value: number | null | undefined): string {
  if (value === null || value === undefined) return '';
  if (value === 0) return '';
  const pp = value * 100;
  const sign = pp > 0 ? '+' : '';
  return `${sign}${pp.toFixed(1)}pp`;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

const COL_TEMPLATE = 'minmax(180px, 1.6fr) repeat(4, minmax(72px, 1fr)) 14px repeat(4, minmax(72px, 1fr))';

const headerStyle: CSSProperties = {
  fontSize: 10,
  fontWeight: 700,
  letterSpacing: '0.04em',
  textTransform: 'uppercase',
  color: 'var(--color-text-muted)',
  textAlign: 'right',
  padding: '4px 8px',
};

const cellBase: CSSProperties = {
  fontSize: 12,
  fontVariantNumeric: 'tabular-nums',
  textAlign: 'right',
  padding: '6px 8px',
  whiteSpace: 'nowrap',
};

const labelBase: CSSProperties = {
  ...cellBase,
  textAlign: 'left',
  color: 'var(--color-text-primary)',
};

const dividerCellStyle: CSSProperties = {
  alignSelf: 'stretch',
  borderLeft: '1px solid var(--color-border-subtle)',
};

function SignedColor({ value }: { value: number | null | undefined }): CSSProperties {
  if (value === null || value === undefined || value === 0) return { color: 'var(--color-text-primary)' };
  return { color: value > 0 ? '#14532d' : '#7f1d1d' };
}

function ColumnHeaders() {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: COL_TEMPLATE, alignItems: 'end' }}>
      <div style={{ ...headerStyle, textAlign: 'left' }}>Line</div>
      <div style={headerStyle}>Wk Actual</div>
      <div style={headerStyle}>Wk Budget</div>
      <div style={headerStyle}>Wk vs Bud</div>
      <div style={headerStyle}>Wk Var %</div>
      <div style={dividerCellStyle} aria-hidden />
      <div style={headerStyle}>MTD Actual</div>
      <div style={headerStyle}>MTD Budget</div>
      <div style={headerStyle}>MTD vs Bud</div>
      <div style={headerStyle}>MTD Var %</div>
    </div>
  );
}

function BlockCard({ block }: { block: Block }) {
  return (
    <div
      style={{
        border: '1px solid var(--color-border-subtle)',
        borderRadius: 10,
        background: '#fff',
        overflow: 'hidden',
        boxShadow: '0 1px 4px rgba(0, 28, 53, 0.04)',
      }}
    >
      {block.title && (
        <div
          style={{
            padding: '8px 12px',
            fontSize: 13,
            fontWeight: 700,
            color: 'var(--color-text-primary)',
            background: 'var(--color-bg-hover)',
            borderBottom: '1px solid var(--color-border-subtle)',
          }}
        >
          {block.title}
        </div>
      )}
      <div style={{ padding: '4px 0' }}>
        {block.rows.map((row, idx) => (
          <PnLRowView key={`${row.label}-${idx}`} row={row} />
        ))}
      </div>
    </div>
  );
}

function PnLRowView({ row }: { row: FlashPnLRow }) {
  const isTotal = row.kind === 'total';
  const isPct = row.kind === 'pct';
  const indent = (row.indent ?? 0) * 12;

  // Decide formatter per kind. `total` and `data` rows are currency; `pct`
  // rows store decimals that should render as percentages. The Vs Bud
  // column on a pct row stores percentage-point variance, so it's handled
  // specially below.
  const fmtVal = (cell: WeekValueColumn['actual']) =>
    isPct ? fmtPctValue(cell) : fmtCurrency(cell);

  const renderRow = (col: WeekValueColumn) => (
    <>
      <div style={{ ...cellBase, ...SignedColor({ value: col.actual }) }}>{fmtVal(col.actual)}</div>
      <div style={{ ...cellBase, color: 'var(--color-text-muted)' }}>{fmtVal(col.budget)}</div>
      <div style={{ ...cellBase, ...SignedColor({ value: col.vsBud }) }}>
        {isPct ? fmtPctPp(col.vsBud) : fmtCurrency(col.vsBud)}
      </div>
      <div style={{ ...cellBase, ...SignedColor({ value: col.pct }) }}>
        {isPct ? '' : fmtPctSigned(col.pct)}
      </div>
    </>
  );

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: COL_TEMPLATE,
        alignItems: 'center',
        background: isTotal ? 'rgba(34, 68, 68, 0.04)' : 'transparent',
        borderTop: isTotal ? '1px solid var(--color-border-subtle)' : 'none',
        fontWeight: isTotal || row.emphasised ? 700 : 500,
      }}
    >
      <div
        style={{
          ...labelBase,
          paddingLeft: 8 + indent,
          fontWeight: isTotal || row.emphasised ? 700 : isPct ? 500 : 500,
          fontStyle: isPct ? 'italic' : 'normal',
          color: isPct ? 'var(--color-text-muted)' : 'var(--color-text-primary)',
        }}
      >
        {row.label}
      </div>
      {renderRow(row.week)}
      <div style={dividerCellStyle} aria-hidden />
      {renderRow(row.mtd)}
    </div>
  );
}

/** Spreadsheet-style grouped P&L view -- each section is rendered as its own
 *  bordered block with a bold title and a bold total row at the bottom.
 *  Kept dependency-free (no DataTable) so the look matches the FIS_FLASH
 *  spreadsheet exactly. */
export default function PnLGroupedView({
  weekEnding,
  monthLabel,
}: {
  weekEnding: string;
  monthLabel: string;
}) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
        // The full layout is wide; horizontal scroll for narrow viewports keeps
        // the columns aligned without wrapping cells.
        overflowX: 'auto',
        paddingBottom: 4,
      }}
    >
      <SubLabels weekEnding={weekEnding} monthLabel={monthLabel} />
      <div style={{ minWidth: 980 }}>
        <ColumnHeaders />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 8 }}>
          {BLOCKS.map((block, i) => (
            <BlockCard key={`${block.title ?? 'cont'}-${i}`} block={block} />
          ))}
        </div>
      </div>
    </div>
  );
}

function SubLabels({
  weekEnding,
  monthLabel,
}: {
  weekEnding: string;
  monthLabel: string;
}) {
  const wrap: CSSProperties = {
    display: 'flex',
    gap: 16,
    fontSize: 12,
    fontWeight: 600,
    color: 'var(--color-text-muted)',
    alignItems: 'center',
  };
  const pill: (label: string, sub: string) => ReactNode = (label, sub) => (
    <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
      <span style={{ color: 'var(--color-text-primary)', fontWeight: 700 }}>{label}</span>
      <span>{sub}</span>
    </div>
  );
  return (
    <div style={wrap}>
      {pill('Week', `ending ${weekEnding}`)}
      <span aria-hidden style={{ color: 'var(--color-border-subtle)' }}>|</span>
      {pill('MTD', `${monthLabel} to date`)}
    </div>
  );
}
