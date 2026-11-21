'use client';

/**
 * Changed in Square. Lists everything changed on the till since
 * Edify last published, field by field, and lets the user pick:
 *
 *   Use Square's   Edify takes the change
 *   Keep Edify's   the next publish puts Edify's value back
 *   Decide later   stays flagged; publish leaves that field alone
 *
 * Also covers an item deleted in Square and an option added to a group
 * in Square. Nothing is overwritten or taken without a decision.
 */

import { useState } from 'react';
import { Check, Clock } from 'lucide-react';
import { findGroup, useModifierGroups } from '@/components/Modifiers/store';
import type { ModifierGroup } from '@/components/Modifiers/types';
import { StatusPill } from '@/components/ui/StatusPill';
import {
  resolveDeleted,
  resolveGroupChange,
  resolveSquareChange,
  takeAllSquareChanges,
  useSquareMenu,
  type SquareDecision,
} from './squareMenuStore';
import {
  FIELD_LABELS,
  gpPct,
  money,
  squareChangeKeys,
  type FieldKey,
  type TillFields,
  type TillItem,
} from './tillItems';
import { Sheet, card, primaryBtn, secondaryBtn } from './ui';

function valueOf(key: FieldKey, f: TillFields, groups: ModifierGroup[]): string {
  switch (key) {
    case 'prices':
      return f.sizes.map((s) => `${f.sizes.length > 1 || s !== 'Regular' ? `${s} ` : ''}${money(f.prices[s])}`).join(', ');
    case 'sizes':
      return f.sizes.join(', ');
    case 'groups':
      return f.groups.map((id) => groups.find((g) => g.id === id)?.name ?? id).join(', ') || 'None';
    case 'sites':
      return f.sites.length ? f.sites.join(', ') : 'All sites';
    case 'photo':
      return f.photo ? 'Photo' : 'No photo';
    default:
      return String(f[key] || 'Blank');
  }
}

/** What taking Square's price does to GP, per size that changed. */
function marginLine(item: TillItem): string | null {
  if (!item.published || !item.inSquare) return null;
  const parts: string[] = [];
  for (const s of item.inSquare.sizes) {
    const before = item.published.prices[s];
    const after = item.inSquare.prices[s];
    if (before === after) continue;
    const a = gpPct(before, item.sizeCosts[s], item.current.vat);
    const b = gpPct(after, item.sizeCosts[s], item.current.vat);
    if (a == null || b == null) continue;
    const label = item.inSquare.sizes.length > 1 ? `${s}: ` : '';
    parts.push(`${label}GP goes from ${a}% to ${b}%`);
  }
  return parts.length ? parts.join('. ') : null;
}

export function ChangedInSquarePanel({ onClose, onEditGroup }: { onClose: () => void; onEditGroup: (g: ModifierGroup) => void }) {
  const sm = useSquareMenu();
  const groups = useModifierGroups();
  const [taken, setTaken] = useState<string[]>([]);

  const changed = sm.items.filter((i) => !i.deletedInSquare && squareChangeKeys(i).length > 0);
  const deleted = sm.items.filter((i) => i.deletedInSquare);
  const total = changed.reduce((n, i) => n + squareChangeKeys(i).length, 0) + deleted.length + sm.groupChanges.length;

  function decide(item: TillItem, key: FieldKey, d: SquareDecision) {
    resolveSquareChange(item.id, key, d);
    if (d !== 'later') setTaken((t) => [...t, `${item.current.name}: ${d === 'square' ? "used Square's" : "kept Edify's"} ${FIELD_LABELS[key].toLowerCase()}`]);
  }

  const footer = (
    <>
      <span style={{ flex: 1, fontSize: 12.5, color: 'var(--color-text-muted)' }}>
        {total === 0 ? 'All decided' : `${total} to decide`}
      </span>
      {changed.length > 0 && (
        <button type="button" style={secondaryBtn} onClick={() => { takeAllSquareChanges(); setTaken((t) => [...t, "Used every change made in Square"]); }}>
          Use all Square&apos;s
        </button>
      )}
      <button type="button" style={primaryBtn} onClick={onClose}>Done</button>
    </>
  );

  return (
    <Sheet title="Changed in Square" onClose={onClose} footer={footer}>
      <p style={{ fontSize: 13, color: 'var(--color-text-muted)', margin: '0 0 14px', lineHeight: 1.5 }}>
        Pick what to keep for each change. Keep Edify&apos;s goes back to Square on your next publish.
      </p>

      {total === 0 && (
        <div style={{ ...card, padding: 16, fontSize: 13.5 }}>
          Nothing left to decide.
        </div>
      )}

      {changed.map((item) => {
        const keys = squareChangeKeys(item);
        return (
          <section key={item.id} style={{ ...card, padding: 14, marginBottom: 12 }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
              <h3 style={{ fontSize: 14, fontWeight: 700, margin: 0 }}>{item.current.name}</h3>
              <span style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>
                {item.squareChangedAt ? `Changed ${item.squareChangedAt}` : 'Changed since you last published'}
              </span>
            </div>
            {keys.map((k) => {
              const later = item.laterKeys.includes(k);
              const margin = k === 'prices' ? marginLine(item) : null;
              return (
                <div key={k} style={{ borderTop: '1px solid var(--color-border-subtle)', marginTop: 10, paddingTop: 10 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 12.5, fontWeight: 700 }}>{FIELD_LABELS[k]}</span>
                    {later && <StatusPill tone="neutral" size="xs" icon={<Clock size={10} />}>Deciding later</StatusPill>}
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 6 }}>
                    <Value label="In Edify" value={valueOf(k, item.current, groups)} />
                    <Value label="In Square now" value={valueOf(k, item.inSquare!, groups)} strong />
                  </div>
                  {margin && (
                    <p style={{ fontSize: 12.5, color: 'var(--color-text-secondary)', margin: '6px 0 0' }}>
                      If you use Square&apos;s price: {margin}.
                    </p>
                  )}
                  {k === 'name' && (
                    <p style={{ fontSize: 12.5, color: 'var(--color-text-muted)', margin: '6px 0 0' }}>
                      The recipe keeps its own name.
                    </p>
                  )}
                  <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
                    <button type="button" style={primaryBtn} onClick={() => decide(item, k, 'square')}>Use Square&apos;s</button>
                    <button type="button" style={secondaryBtn} onClick={() => decide(item, k, 'edify')}>Keep Edify&apos;s</button>
                    {!later && (
                      <button type="button" style={secondaryBtn} onClick={() => decide(item, k, 'later')}>Decide later</button>
                    )}
                  </div>
                </div>
              );
            })}
          </section>
        );
      })}

      {deleted.map((item) => (
        <section key={item.id} style={{ ...card, padding: 14, marginBottom: 12 }}>
          <h3 style={{ fontSize: 14, fontWeight: 700, margin: 0 }}>{item.current.name} was deleted in Square</h3>
          <p style={{ fontSize: 13, color: 'var(--color-text-secondary)', margin: '6px 0 0', lineHeight: 1.45 }}>
            Deleted {item.deletedInSquare!.at}. Staff can&apos;t ring it up. The recipe stays in Edify either way.
          </p>
          <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
            <button type="button" style={primaryBtn} onClick={() => { resolveDeleted(item.id, 'remove'); setTaken((t) => [...t, `${item.current.name}: taken off the till in Edify too`]); }}>
              Take it off in Edify too
            </button>
            <button type="button" style={secondaryBtn} onClick={() => { resolveDeleted(item.id, 'restore'); setTaken((t) => [...t, `${item.current.name}: goes back on the till next publish`]); }}>
              Put it back on the till
            </button>
          </div>
        </section>
      ))}

      {sm.groupChanges.map((c) => {
        const g = findGroup(c.groupId);
        if (!g) return null;
        return (
          <section key={c.id} style={{ ...card, padding: 14, marginBottom: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <h3 style={{ fontSize: 14, fontWeight: 700, margin: 0 }}>
                {c.optionName} was added to {g.name}
              </h3>
              {c.later && <StatusPill tone="neutral" size="xs" icon={<Clock size={10} />}>Deciding later</StatusPill>}
            </div>
            <p style={{ fontSize: 13, color: 'var(--color-text-secondary)', margin: '6px 0 0', lineHeight: 1.45 }}>
              Added {c.at}{c.priceDelta ? ` at +${money(c.priceDelta)}` : ''}. Until you set its recipe change, stock and costs miss it.
            </p>
            <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
              <button
                type="button"
                style={primaryBtn}
                onClick={() => {
                  resolveGroupChange(c.id, 'add');
                  const updated = findGroup(c.groupId);
                  if (updated) onEditGroup(updated);
                }}
              >
                Add it and set the recipe change
              </button>
              <button type="button" style={secondaryBtn} onClick={() => { resolveGroupChange(c.id, 'add'); setTaken((t) => [...t, `${c.optionName} added to ${g.name}, no recipe change`]); }}>
                Add it, no recipe change
              </button>
              <button type="button" style={secondaryBtn} onClick={() => { resolveGroupChange(c.id, 'remove'); setTaken((t) => [...t, `${c.optionName} comes off ${g.name} next publish`]); }}>
                Take it off the till
              </button>
              {!c.later && (
                <button type="button" style={secondaryBtn} onClick={() => resolveGroupChange(c.id, 'later')}>Decide later</button>
              )}
            </div>
          </section>
        );
      })}

      {taken.length > 0 && (
        <section aria-live="polite" style={{ marginTop: 16 }}>
          <h3 style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--color-text-muted)', margin: '0 0 6px' }}>Decided</h3>
          <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 4 }}>
            {taken.map((t, idx) => (
              <li key={`${t}-${idx}`} style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 12.5, color: 'var(--color-text-secondary)' }}>
                <Check size={13} color="var(--color-success, #166534)" aria-hidden /> {t}
              </li>
            ))}
          </ul>
        </section>
      )}
    </Sheet>
  );
}

function Value({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div style={{ padding: '8px 10px', borderRadius: 8, background: '#FBFAF8', border: '1px solid var(--color-border-subtle)' }}>
      <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--color-text-muted)' }}>{label}</div>
      <div style={{ fontSize: 13, fontWeight: strong ? 600 : 500, marginTop: 2 }}>{value}</div>
    </div>
  );
}
