'use client';

/**
 * Batch review — the table-shaped work card for reviewing many
 * proposed changes at once (integrity fixes, bulk price updates,
 * sheet imports). Each row shows the entity, the area of it that's
 * wrong as it reads today (`context`), before → after with the AFTER
 * value editable in place (rule #6: everything the AI inputs is
 * editable), a ConfidenceFlag (rule #5: low-confidence rows are never
 * in the bulk selection), and a checkbox. An optional Impact summary
 * strip renders the blast radius above the rows (rule #3: anything
 * touching more than one entity shows it before confirm). Confirm
 * applies only the ticked rows; if the caller reports per-row
 * failures the card re-renders them inline and the shell flips to
 * `partial`.
 *
 * Sits inside CardShell like every other work card, so it inherits
 * the pending / confirmed / cancelled / partial chrome for free.
 */

import { useMemo, useState } from 'react';
import { AlertTriangle, Check, Pencil, X } from 'lucide-react';
import type React from 'react';
import CardShell, { type CardIcon, type CardState } from './CardShell';

export type RowConfidence = 'high' | 'medium' | 'low';

export interface BatchReviewRow {
  id: string;
  /** Entity the change applies to, e.g. "Oat Milk — Barista Edition". */
  entity: string;
  /** Secondary context under the entity, e.g. "Minor Figures · 12 × 1L". */
  entityMeta?: string;
  /** What's changing, e.g. "Unit price" or "Allergens". */
  field: string;
  /** Current value (may be empty for "missing"). */
  before: string;
  /** Proposed value — editable in place while pending. */
  after: string;
  /** Optional impact chip, e.g. "−1.2% COGS" or "3 recipes affected". */
  impact?: string;
  /** Start unticked — for changes that need a human call (e.g. "check
   *  with the kitchen") before they're safe to apply. Defaults to true.
   *  Low-confidence rows start unticked regardless. */
  defaultSelected?: boolean;
  /** How sure the agent is about this suggestion. Low-confidence rows
   *  are excluded from the bulk selection — the user opts in per row. */
  confidence?: RowConfidence;
  /** The slice of the recipe the fix lives in, rendered as a mini
   *  recipe editor: surrounding lines read-only for orientation, the
   *  flagged line as real input fields pre-filled with the suggestion
   *  so the user can type over any part of it (rule #6). */
  recipe?: {
    /** Which part of the recipe, e.g. "Packaging" or "Ingredients". */
    section: string;
    lines: RecipeContextLine[];
  };
  /** When the wrong thing is the product's own setup (pack size, base
   *  unit, price) rather than a recipe line: the product's settings
   *  rendered the same way — read-only fields for orientation, the
   *  flagged field as an input pre-filled with the suggestion. */
  product?: {
    /** Panel label, e.g. "Product setup". */
    section?: string;
    fields: ProductSetupField[];
  };
}

export interface ProductSetupField {
  label: string;
  value: string;
  /** When set, this field is the wrong one: it renders as an input
   *  pre-filled with the suggested value, with today's value struck
   *  through below and an optional note on why it's flagged. */
  flagged?: { was: string; note?: string };
}

export interface RecipeContextLine {
  name: string;
  qty: string;
  unit: string;
  cost?: string;
  /** When set, this is the wrong line: name/qty/unit render as inputs
   *  pre-filled with the suggested values, with the line as it reads
   *  today struck through below so the change is visible as a diff. */
  flagged?: {
    /** The line as it reads today. */
    was: { name: string; qty: string; unit: string; cost?: string };
    /** Why it's flagged. */
    note?: string;
  };
}

/** Editable values for a flagged recipe line. */
type LineEdit = { name: string; qty: string; unit: string };

export interface BatchRowResult {
  id: string;
  ok: boolean;
  /** Failure reason shown inline when ok is false. */
  error?: string;
}

export interface BatchReviewSubmission {
  id: string;
  after: string;
}

interface BatchReviewCardProps {
  icon: CardIcon;
  title: string;
  subtitle?: string;
  rows: BatchReviewRow[];
  state: CardState;
  /** Verb for the confirm button, e.g. "Apply". Row count is appended. */
  confirmVerb?: string;
  /** Called with the ticked rows (with any in-place edits) on confirm. */
  onConfirm: (rows: BatchReviewSubmission[]) => void;
  onCancel?: () => void;
  /** Per-row outcomes, provided by the caller after applying. */
  results?: BatchRowResult[];
  /** Blast-radius stats shown above the rows, e.g. 4 recipes affected ·
   *  −£3.35 per drink. Required by rule #3 whenever the batch touches
   *  more than one entity. */
  impactSummary?: Array<{ value: string; label: string }>;
}

const MONO_VALUE: React.CSSProperties = {
  fontSize: '12px',
  fontWeight: 600,
  fontFamily: 'var(--font-primary)',
  color: 'var(--color-text-primary)',
};

const CONFIDENCE_STYLE: Record<RowConfidence, { label: string; color: string; bg: string }> = {
  high: { label: 'High', color: '#2D6A4F', bg: 'rgba(45,106,79,0.09)' },
  medium: { label: 'Medium', color: '#B45309', bg: 'rgba(234, 209, 115, 0.2)' },
  low: { label: 'Low', color: '#B01038', bg: 'rgba(220,38,38,0.08)' },
};

function ConfidenceFlag({ level }: { level: RowConfidence }) {
  const s = CONFIDENCE_STYLE[level];
  return (
    <span style={{
      padding: '1px 7px', borderRadius: '999px', background: s.bg,
      fontSize: '10px', fontWeight: 700, letterSpacing: '0.04em',
      textTransform: 'uppercase', color: s.color, flexShrink: 0,
    }}>
      {s.label}
    </span>
  );
}

export default function BatchReviewCard({
  icon,
  title,
  subtitle,
  rows,
  state,
  confirmVerb = 'Apply',
  onConfirm,
  onCancel,
  results,
  impactSummary,
}: BatchReviewCardProps) {
  // Rule #5: low-confidence suggestions never ride along in the bulk
  // selection — the user has to tick them deliberately.
  const [selected, setSelected] = useState<Set<string>>(
    () => new Set(
      rows
        .filter((r) => r.defaultSelected !== false && r.confidence !== 'low')
        .map((r) => r.id),
    ),
  );
  const [edits, setEdits] = useState<Record<string, string>>({});
  const [lineEdits, setLineEdits] = useState<Record<string, LineEdit>>({});
  const [fieldEdits, setFieldEdits] = useState<Record<string, Record<string, string>>>({});
  const [editingId, setEditingId] = useState<string | null>(null);

  const pending = state === 'pending';
  const allOn = selected.size === rows.length;
  const resultById = useMemo(() => {
    const m = new Map<string, BatchRowResult>();
    for (const r of results ?? []) m.set(r.id, r);
    return m;
  }, [results]);
  const failed = (results ?? []).filter((r) => !r.ok).length;
  const applied = (results ?? []).filter((r) => r.ok).length;

  const afterValue = (r: BatchReviewRow) => edits[r.id] ?? r.after;

  /** Current values of a row's flagged recipe line — the user's edits
   *  where present, the AI suggestion otherwise. */
  const lineValue = (r: BatchReviewRow): LineEdit => {
    const existing = lineEdits[r.id];
    if (existing) return existing;
    const flaggedLine = r.recipe?.lines.find((l) => l.flagged);
    return {
      name: flaggedLine?.name ?? '',
      qty: flaggedLine?.qty ?? '',
      unit: flaggedLine?.unit ?? '',
    };
  };

  const setLineField = (rowId: string, row: BatchReviewRow, field: keyof LineEdit, value: string) => {
    setLineEdits((prev) => ({ ...prev, [rowId]: { ...lineValue(row), ...prev[rowId], [field]: value } }));
  };

  /** Current value of a flagged product-setup field — the user's edit
   *  where present, the AI suggestion otherwise. */
  const fieldValue = (rowId: string, f: ProductSetupField): string =>
    fieldEdits[rowId]?.[f.label] ?? f.value;

  const submissionAfter = (r: BatchReviewRow): string => {
    if (r.recipe) {
      const v = lineValue(r);
      return `${v.name} · ${v.qty} ${v.unit}`.trim();
    }
    if (r.product) {
      return r.product.fields
        .filter((f) => f.flagged)
        .map((f) => `${f.label}: ${fieldValue(r.id, f)}`)
        .join(' · ');
    }
    return afterValue(r);
  };

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <CardShell
      icon={icon}
      title={title}
      subtitle={subtitle}
      state={state}
      confirmLabel={`${confirmVerb} ${selected.size} change${selected.size === 1 ? '' : 's'}`}
      confirmDisabled={selected.size === 0}
      onConfirm={() =>
        onConfirm(
          rows
            .filter((r) => selected.has(r.id))
            .map((r) => ({ id: r.id, after: submissionAfter(r) })),
        )
      }
      onCancel={onCancel}
    >
      {/* Impact summary — the blast radius, before anything is applied. */}
      {impactSummary && impactSummary.length > 0 && (
        <div style={{
          display: 'grid',
          gridTemplateColumns: `repeat(${impactSummary.length}, 1fr)`,
          gap: '1px',
          background: 'var(--color-border-subtle, rgba(0,28,53,0.12))',
          border: '1px solid var(--color-border-subtle, rgba(0,28,53,0.12))',
          borderRadius: '10px',
          overflow: 'hidden',
          marginBottom: '10px',
        }}>
          {impactSummary.map((s) => (
            <div key={s.label} style={{ background: '#fff', padding: '8px 10px' }}>
              <div style={{ fontSize: '15px', fontWeight: 700, color: 'var(--color-text-primary)', lineHeight: 1.2 }}>
                {s.value}
              </div>
              <div style={{ fontSize: '10.5px', fontWeight: 500, color: 'var(--color-text-muted)', marginTop: '1px', lineHeight: 1.3 }}>
                {s.label}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Select-all header row */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
        <span style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--color-text-secondary)' }}>
          {pending
            ? `${selected.size} of ${rows.length} selected`
            : results
              ? `${applied} applied${failed > 0 ? ` · ${failed} failed` : ''}`
              : `${rows.length} changes`}
        </span>
        {pending && (
          <button
            type="button"
            onClick={() => setSelected(allOn ? new Set() : new Set(rows.map((r) => r.id)))}
            style={{
              padding: '3px 10px',
              borderRadius: '999px',
              border: '1px solid var(--color-border-subtle, rgba(0,28,53,0.12))',
              background: '#fff',
              fontSize: '11px',
              fontWeight: 600,
              fontFamily: 'var(--font-primary)',
              color: 'var(--color-text-secondary)',
              cursor: 'pointer',
            }}
          >
            {allOn ? 'None' : 'All'}
          </button>
        )}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
        {rows.map((r) => {
          const on = selected.has(r.id);
          const result = resultById.get(r.id);
          const skipped = !pending && !on;
          const editing = editingId === r.id && pending;
          return (
            <div
              key={r.id}
              style={{
                padding: '8px 10px',
                borderRadius: '10px',
                border: result && !result.ok
                  ? '1.5px solid #E8A03D'
                  : on && pending
                    ? '1.5px solid var(--color-accent-active, #001C35)'
                    : '1.5px solid var(--color-border-subtle, rgba(0,28,53,0.12))',
                background: result && !result.ok ? '#FEF9F3' : '#fff',
                opacity: skipped ? 0.45 : 1,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                {/* Checkbox / outcome glyph */}
                {pending ? (
                  <button
                    type="button"
                    onClick={() => toggle(r.id)}
                    aria-label={on ? 'Exclude row' : 'Include row'}
                    style={{
                      width: '18px',
                      height: '18px',
                      marginTop: '1px',
                      borderRadius: '5px',
                      flexShrink: 0,
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      border: on ? 'none' : '1.5px solid var(--color-border, rgba(0,28,53,0.18))',
                      background: on ? 'var(--color-accent-active, #001C35)' : '#fff',
                      cursor: 'pointer',
                      padding: 0,
                    }}
                  >
                    {on && <Check size={12} strokeWidth={3} color="#fff" />}
                  </button>
                ) : (
                  <span style={{ width: '18px', marginTop: '1px', flexShrink: 0, display: 'inline-flex', justifyContent: 'center' }}>
                    {result ? (
                      result.ok
                        ? <Check size={14} strokeWidth={2.6} color="#2D6A4F" />
                        : <X size={14} strokeWidth={2.6} color="#B45309" />
                    ) : on ? (
                      <Check size={14} strokeWidth={2.6} color="#2D6A4F" />
                    ) : null}
                  </span>
                )}

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: '12.5px', fontWeight: 600, color: 'var(--color-text-primary)' }}>
                      {r.entity}
                    </span>
                    {r.confidence && <ConfidenceFlag level={r.confidence} />}
                    {r.entityMeta && (
                      <span style={{ fontSize: '11px', fontWeight: 500, color: 'var(--color-text-muted)' }}>
                        {r.entityMeta}
                      </span>
                    )}
                    {(r.recipe || r.product) && r.impact && (
                      <span style={{
                        marginLeft: 'auto',
                        padding: '2px 8px',
                        borderRadius: '999px',
                        background: 'rgba(0,28,53,0.05)',
                        fontSize: '10.5px',
                        fontWeight: 700,
                        color: 'var(--color-text-secondary)',
                        flexShrink: 0,
                      }}>
                        {r.impact}
                      </span>
                    )}
                  </div>

                  {/* The slice of the recipe the fix lives in. Surrounding
                      lines are read-only orientation; the flagged line is
                      real inputs pre-filled with the suggestion. */}
                  {r.recipe && (
                    <div style={{
                      marginTop: '6px',
                      border: '1px solid var(--color-border-subtle, rgba(0,28,53,0.10))',
                      borderRadius: '8px',
                      overflow: 'hidden',
                    }}>
                      <div style={{ padding: '4px 9px', background: 'rgba(0,28,53,0.03)', fontSize: '10px', fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--color-text-muted)' }}>
                        {r.recipe.section}
                      </div>
                      {r.recipe.lines.map((l, i) => {
                        if (!l.flagged) {
                          return (
                            <div key={i} style={{
                              display: 'flex', alignItems: 'center', gap: '8px',
                              padding: '4px 9px',
                              borderTop: '1px solid var(--color-border-subtle, rgba(0,28,53,0.06))',
                              fontSize: '12px', fontWeight: 500, color: 'var(--color-text-muted)',
                            }}>
                              <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{l.name}</span>
                              <span style={{ flexShrink: 0 }}>{l.qty} {l.unit}</span>
                              {l.cost && <span style={{ width: '48px', textAlign: 'right', flexShrink: 0 }}>{l.cost}</span>}
                            </div>
                          );
                        }
                        const v = lineValue(r);
                        const inputBase: React.CSSProperties = {
                          ...MONO_VALUE,
                          padding: '3px 7px',
                          border: '1.5px solid ' + (pending ? 'var(--color-accent-active, #001C35)' : 'var(--color-border-subtle, rgba(0,28,53,0.12))'),
                          borderRadius: '6px',
                          background: pending ? '#fff' : 'rgba(0,28,53,0.02)',
                          color: pending ? 'var(--color-text-primary)' : 'var(--color-text-secondary)',
                        };
                        return (
                          <div key={i} style={{
                            padding: '7px 9px',
                            background: '#FFF9F0',
                            borderTop: '1px solid var(--color-border-subtle, rgba(0,28,53,0.06))',
                          }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <input
                                aria-label="Product"
                                value={v.name}
                                disabled={!pending}
                                onChange={(e) => setLineField(r.id, r, 'name', e.target.value)}
                                style={{ ...inputBase, flex: 1, minWidth: '110px' }}
                              />
                              <input
                                aria-label="Quantity"
                                value={v.qty}
                                disabled={!pending}
                                onChange={(e) => setLineField(r.id, r, 'qty', e.target.value)}
                                style={{ ...inputBase, width: '44px', textAlign: 'right', flexShrink: 0 }}
                              />
                              <input
                                aria-label="Unit"
                                value={v.unit}
                                disabled={!pending}
                                onChange={(e) => setLineField(r.id, r, 'unit', e.target.value)}
                                style={{ ...inputBase, width: '58px', flexShrink: 0 }}
                              />
                              {l.cost && (
                                <span style={{ ...MONO_VALUE, width: '48px', textAlign: 'right', flexShrink: 0, color: '#2D6A4F' }}>
                                  {l.cost}
                                </span>
                              )}
                            </div>
                            {/* The line as it reads today, struck through, so
                                the change reads as a diff. */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '6px', fontSize: '12px', fontWeight: 500, color: 'var(--color-text-muted)' }}>
                              <span style={{ fontSize: '9.5px', fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', flexShrink: 0 }}>
                                Was
                              </span>
                              <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textDecoration: 'line-through' }}>
                                {l.flagged.was.name}
                              </span>
                              <span style={{ flexShrink: 0, textDecoration: 'line-through' }}>
                                {l.flagged.was.qty} {l.flagged.was.unit}
                              </span>
                              {l.flagged.was.cost && (
                                <span style={{ width: '48px', textAlign: 'right', flexShrink: 0, textDecoration: 'line-through', color: '#B01038', fontWeight: 600 }}>
                                  {l.flagged.was.cost}
                                </span>
                              )}
                            </div>
                            {l.flagged.note && (
                              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '4px', marginTop: '4px', fontSize: '11.5px', fontWeight: 600, color: '#B45309', lineHeight: 1.35 }}>
                                <AlertTriangle size={11} strokeWidth={2.4} style={{ flexShrink: 0, marginTop: '2px' }} />
                                {l.flagged.note}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* When the wrong thing is the product's setup, bring the
                      product's settings up — flagged field editable. */}
                  {r.product && (
                    <div style={{
                      marginTop: '6px',
                      border: '1px solid var(--color-border-subtle, rgba(0,28,53,0.10))',
                      borderRadius: '8px',
                      overflow: 'hidden',
                    }}>
                      <div style={{ padding: '4px 9px', background: 'rgba(0,28,53,0.03)', fontSize: '10px', fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--color-text-muted)' }}>
                        {r.product.section ?? 'Product setup'}
                      </div>
                      {r.product.fields.map((f) => {
                        if (!f.flagged) {
                          return (
                            <div key={f.label} style={{
                              display: 'flex', alignItems: 'center', gap: '8px',
                              padding: '4px 9px',
                              borderTop: '1px solid var(--color-border-subtle, rgba(0,28,53,0.06))',
                              fontSize: '12px', fontWeight: 500, color: 'var(--color-text-muted)',
                            }}>
                              <span style={{ width: '110px', flexShrink: 0, fontSize: '10.5px', fontWeight: 700, letterSpacing: '0.03em', textTransform: 'uppercase' }}>{f.label}</span>
                              <span style={{ flex: 1, minWidth: 0 }}>{f.value}</span>
                            </div>
                          );
                        }
                        return (
                          <div key={f.label} style={{
                            padding: '7px 9px',
                            background: '#FFF9F0',
                            borderTop: '1px solid var(--color-border-subtle, rgba(0,28,53,0.06))',
                          }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <span style={{ width: '110px', flexShrink: 0, fontSize: '10.5px', fontWeight: 700, letterSpacing: '0.03em', textTransform: 'uppercase', color: 'var(--color-text-secondary)' }}>
                                {f.label}
                              </span>
                              <input
                                aria-label={f.label}
                                value={fieldValue(r.id, f)}
                                disabled={!pending}
                                onChange={(e) => setFieldEdits((prev) => ({
                                  ...prev,
                                  [r.id]: { ...prev[r.id], [f.label]: e.target.value },
                                }))}
                                style={{
                                  ...MONO_VALUE,
                                  flex: 1,
                                  minWidth: '90px',
                                  padding: '3px 7px',
                                  border: '1.5px solid ' + (pending ? 'var(--color-accent-active, #001C35)' : 'var(--color-border-subtle, rgba(0,28,53,0.12))'),
                                  borderRadius: '6px',
                                  background: pending ? '#fff' : 'rgba(0,28,53,0.02)',
                                  color: pending ? 'var(--color-text-primary)' : 'var(--color-text-secondary)',
                                }}
                              />
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '6px', fontSize: '12px', fontWeight: 500, color: 'var(--color-text-muted)' }}>
                              <span style={{ width: '110px', flexShrink: 0, fontSize: '9.5px', fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                                Was
                              </span>
                              <span style={{ textDecoration: 'line-through', color: '#B01038', fontWeight: 600 }}>
                                {f.flagged.was}
                              </span>
                            </div>
                            {f.flagged.note && (
                              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '4px', marginTop: '4px', fontSize: '11.5px', fontWeight: 600, color: '#B45309', lineHeight: 1.35 }}>
                                <AlertTriangle size={11} strokeWidth={2.4} style={{ flexShrink: 0, marginTop: '2px' }} />
                                {f.flagged.note}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}

                  <div style={{ display: (r.recipe || r.product) ? 'none' : 'flex', alignItems: 'center', gap: '6px', marginTop: '4px', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.03em', textTransform: 'uppercase', color: 'var(--color-text-muted)' }}>
                      {r.field}
                    </span>
                    <span style={{ ...MONO_VALUE, color: 'var(--color-text-muted)', textDecoration: 'line-through' }}>
                      {r.before || '—'}
                    </span>
                    <span style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>→</span>
                    {editing ? (
                      <input
                        autoFocus
                        value={afterValue(r)}
                        onChange={(e) => setEdits((prev) => ({ ...prev, [r.id]: e.target.value }))}
                        onBlur={() => setEditingId(null)}
                        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === 'Escape') setEditingId(null); }}
                        style={{
                          ...MONO_VALUE,
                          padding: '2px 6px',
                          border: '1.5px solid var(--color-accent-active, #001C35)',
                          borderRadius: '6px',
                          background: '#fff',
                          minWidth: '90px',
                        }}
                      />
                    ) : (
                      <button
                        type="button"
                        disabled={!pending}
                        onClick={() => setEditingId(r.id)}
                        title={pending ? 'Edit value' : undefined}
                        style={{
                          ...MONO_VALUE,
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                          padding: '2px 6px',
                          border: '1px dashed transparent',
                          borderColor: pending ? 'var(--color-border, rgba(0,28,53,0.18))' : 'transparent',
                          borderRadius: '6px',
                          background: 'transparent',
                          cursor: pending ? 'text' : 'default',
                        }}
                      >
                        {afterValue(r)}
                        {pending && <Pencil size={10.5} strokeWidth={2} color="var(--color-text-muted)" />}
                      </button>
                    )}
                    {r.impact && (
                      <span
                        style={{
                          padding: '2px 8px',
                          borderRadius: '999px',
                          background: 'rgba(0,28,53,0.05)',
                          fontSize: '10.5px',
                          fontWeight: 700,
                          color: 'var(--color-text-secondary)',
                        }}
                      >
                        {r.impact}
                      </span>
                    )}
                  </div>

                  {result && !result.ok && result.error && (
                    <div style={{ marginTop: '4px', fontSize: '11.5px', fontWeight: 600, color: '#7A3800' }}>
                      {result.error}
                    </div>
                  )}
                  {skipped && (
                    <div style={{ marginTop: '4px', fontSize: '11px', fontWeight: 500, color: 'var(--color-text-muted)' }}>
                      Skipped
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </CardShell>
  );
}
