'use client';

/**
 * Single-line before → after diff for a structured ChangeRecord.
 *
 * Scalar fields render as "Old → New" with an optional delta chip on
 * the right. Array fields (ingredient lists, modifier groups) show an
 * added / removed / changed row count summary — the underlying data
 * model isn't keyed so we can't always reconcile a true row-level
 * diff, and pretending we can would mislead the operator.
 *
 * The component is dense by design: the page renders many of these
 * inside a single expanded row, so the visual weight per change has
 * to stay light.
 */

import { ArrowRight, Plus, Minus, Pencil } from 'lucide-react';
import type { ChangeRecord } from '@/components/Feed/taskHistoryStore';
import { formatScalar, formatDelta } from './format';

export default function ChangeDiff({ change }: { change: ChangeRecord }) {
  const isArray = change.valueKind === 'array' || Array.isArray(change.before) || Array.isArray(change.after);
  const isCreate = change.before === null && change.fieldPath === '__created__';

  if (isCreate) {
    return (
      <div style={rowStyle}>
        <div style={labelColStyle}>
          <span style={fieldLabelStyle}>{change.fieldLabel}</span>
          <span style={entityLabelStyle}>{change.entityLabel}</span>
        </div>
        <div style={valueColStyle}>
          <span style={addedChipStyle}>
            <Plus size={11} strokeWidth={2.4} /> New
          </span>
          <span style={afterValStyle}>{formatScalar(change.after, change)}</span>
        </div>
      </div>
    );
  }

  if (isArray) {
    const before = Array.isArray(change.before) ? change.before : [];
    const after = Array.isArray(change.after) ? change.after : [];
    const summary = summariseArrayDiff(before, after);
    return (
      <div style={rowStyle}>
        <div style={labelColStyle}>
          <span style={fieldLabelStyle}>{change.fieldLabel}</span>
          <span style={entityLabelStyle}>{change.entityLabel}</span>
        </div>
        <div style={{ ...valueColStyle, flexWrap: 'wrap' }}>
          {summary.added > 0 && (
            <span style={addedChipStyle}>
              <Plus size={11} strokeWidth={2.4} /> {summary.added} added
            </span>
          )}
          {summary.removed > 0 && (
            <span style={removedChipStyle}>
              <Minus size={11} strokeWidth={2.4} /> {summary.removed} removed
            </span>
          )}
          {summary.changed > 0 && (
            <span style={changedChipStyle}>
              <Pencil size={10} strokeWidth={2.4} /> {summary.changed} changed
            </span>
          )}
          {summary.added === 0 && summary.removed === 0 && summary.changed === 0 && (
            <span style={mutedLabelStyle}>No visible change</span>
          )}
          <span style={mutedLabelStyle}>
            ({before.length} → {after.length} rows)
          </span>
        </div>
      </div>
    );
  }

  const beforeLabel = formatScalar(change.before, change);
  const afterLabel = formatScalar(change.after, change);
  const numericDelta =
    typeof change.before === 'number' && typeof change.after === 'number'
      ? formatDelta(change.before, change.after, { unit: change.unit })
      : null;

  return (
    <div style={rowStyle}>
      <div style={labelColStyle}>
        <span style={fieldLabelStyle}>{change.fieldLabel}</span>
        <span style={entityLabelStyle}>{change.entityLabel}</span>
      </div>
      <div style={valueColStyle}>
        <span style={beforeValStyle}>{beforeLabel}</span>
        <ArrowRight size={12} strokeWidth={2.4} color="var(--color-text-muted)" />
        <span style={afterValStyle}>{afterLabel}</span>
        {numericDelta && !numericDelta.zero && (
          <span
            style={{
              ...deltaChipStyle,
              background: '#fff',
              color: numericDelta.positive ? '#22573F' : '#A8401C',
              border: `1px solid ${numericDelta.positive ? '#22573F' : '#A8401C'}`,
            }}
          >
            {numericDelta.label}
          </span>
        )}
      </div>
    </div>
  );
}

// ── Array diff summary ─────────────────────────────────────────────
//
// We can't always identify rows uniquely (legacy `ingredients` items
// are free text — two "milk" rows are indistinguishable). The
// summary uses a name-based heuristic: by-name diffing for rows
// that carry a `.name`, length comparison for everything else.

function summariseArrayDiff(
  before: unknown[],
  after: unknown[],
): { added: number; removed: number; changed: number } {
  const beforeNames = extractNames(before);
  const afterNames = extractNames(after);
  if (beforeNames && afterNames) {
    const beforeSet = new Map<string, number>();
    for (const n of beforeNames) beforeSet.set(n, (beforeSet.get(n) ?? 0) + 1);
    const afterSet = new Map<string, number>();
    for (const n of afterNames) afterSet.set(n, (afterSet.get(n) ?? 0) + 1);
    let added = 0;
    let removed = 0;
    const seen = new Set<string>([...beforeSet.keys(), ...afterSet.keys()]);
    for (const n of seen) {
      const d = (afterSet.get(n) ?? 0) - (beforeSet.get(n) ?? 0);
      if (d > 0) added += d;
      else if (d < 0) removed += -d;
    }
    // "changed" is a soft heuristic — we don't have a stable id so we
    // assume any pair (added + removed) at equal counts is actually a
    // change. e.g. swap whole milk → oat milk = 1 added + 1 removed,
    // which reads as "1 changed".
    const changed = Math.min(added, removed);
    return { added: added - changed, removed: removed - changed, changed };
  }
  // Fall back to length comparison if we can't read names.
  if (after.length > before.length) {
    return { added: after.length - before.length, removed: 0, changed: 0 };
  }
  if (after.length < before.length) {
    return { added: 0, removed: before.length - after.length, changed: 0 };
  }
  return { added: 0, removed: 0, changed: 0 };
}

function extractNames(rows: unknown[]): string[] | null {
  const names: string[] = [];
  for (const r of rows) {
    if (!r || typeof r !== 'object') return null;
    const name = (r as { name?: unknown }).name;
    if (typeof name !== 'string') return null;
    names.push(name.toLowerCase().trim());
  }
  return names;
}

// ── Styles ─────────────────────────────────────────────────────────

const rowStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'flex-start',
  gap: 14,
  padding: '8px 0',
  borderTop: '1px dashed var(--color-border-subtle)',
};

const labelColStyle: React.CSSProperties = {
  flex: '0 0 36%',
  display: 'flex',
  flexDirection: 'column',
  gap: 2,
  minWidth: 0,
};

const valueColStyle: React.CSSProperties = {
  flex: 1,
  minWidth: 0,
  display: 'inline-flex',
  alignItems: 'center',
  gap: 8,
  flexWrap: 'wrap',
};

const fieldLabelStyle: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 700,
  color: 'var(--color-text-primary)',
  fontFamily: 'var(--font-primary)',
};

const entityLabelStyle: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 500,
  color: 'var(--color-text-muted)',
  fontFamily: 'var(--font-primary)',
};

const beforeValStyle: React.CSSProperties = {
  fontSize: 12.5,
  fontWeight: 500,
  color: 'var(--color-text-muted)',
  fontFamily: 'var(--font-primary)',
  textDecoration: 'line-through',
};

const afterValStyle: React.CSSProperties = {
  fontSize: 12.5,
  fontWeight: 700,
  color: 'var(--color-text-primary)',
  fontFamily: 'var(--font-primary)',
};

const mutedLabelStyle: React.CSSProperties = {
  fontSize: 11.5,
  color: 'var(--color-text-muted)',
  fontFamily: 'var(--font-primary)',
};

const chipBase: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 4,
  padding: '2px 8px',
  borderRadius: 100,
  fontSize: 11,
  fontWeight: 700,
  fontFamily: 'var(--font-primary)',
};

const deltaChipStyle: React.CSSProperties = { ...chipBase };

const addedChipStyle: React.CSSProperties = {
  ...chipBase,
  background: '#fff',
  color: '#22573F',
  border: '1px solid #22573F',
};

const removedChipStyle: React.CSSProperties = {
  ...chipBase,
  background: '#fff',
  color: '#A8401C',
  border: '1px solid #A8401C',
};

const changedChipStyle: React.CSSProperties = {
  ...chipBase,
  background: '#fff',
  color: 'var(--color-text-secondary)',
  border: '1px solid var(--color-border, rgba(0,28,53,0.18))',
};
