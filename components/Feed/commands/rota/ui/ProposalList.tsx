'use client';

/**
 * The tickable list. One line per proposed change: checkbox, tag,
 * title, signed hours, then the evidence in grey. Lines that leave a
 * rule in warning carry the warning under the evidence and start
 * unticked when the strain is more than half a shift.
 */

import { AlertTriangle } from 'lucide-react';
import { StatusPill } from '@/components/ui/StatusPill';
import type { Proposal } from '../types';
import { TAG_LABEL, TAG_TONE, label } from './tokens';

export default function ProposalList({
  proposals,
  selected,
  onToggle,
  disabled,
}: {
  proposals: Proposal[];
  selected: Set<string>;
  onToggle: (id: string) => void;
  disabled?: boolean;
}) {
  if (proposals.length === 0) {
    return (
      <div style={{ padding: '10px 12px', borderRadius: '10px', border: '1px solid var(--color-border-subtle)', fontSize: '12.5px', color: 'var(--color-text-secondary)' }}>
        The draft already matches the workload and passes every rule. Nothing to change.
      </div>
    );
  }
  const on = proposals.filter((p) => selected.has(p.id)).length;
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: '6px' }}>
        <span style={label}>Proposed changes</span>
        <span style={{ fontSize: '11.5px', fontWeight: 500, color: 'var(--color-text-secondary)' }}>
          {on} of {proposals.length} ticked
        </span>
      </div>
      <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: '4px' }}>
        {proposals.map((p) => {
          const checked = selected.has(p.id);
          const id = `rota-prop-${p.id}`;
          return (
            <li
              key={p.id}
              style={{
                display: 'grid',
                gridTemplateColumns: '18px 1fr auto',
                gap: '8px',
                alignItems: 'start',
                padding: '7px 9px',
                borderRadius: '8px',
                border: '1px solid var(--color-border-subtle)',
                background: checked ? '#fff' : 'var(--color-bg-hover)',
                opacity: disabled && !checked ? 0.7 : 1,
              }}
            >
              <input
                id={id}
                type="checkbox"
                checked={checked}
                disabled={disabled}
                onChange={() => onToggle(p.id)}
                style={{ width: '15px', height: '15px', marginTop: '2px', accentColor: 'var(--color-accent-active)', cursor: disabled ? 'default' : 'pointer' }}
              />
              <div style={{ minWidth: 0 }}>
                <label
                  htmlFor={id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    flexWrap: 'wrap',
                    fontSize: '12.5px',
                    fontWeight: 600,
                    color: 'var(--color-text-primary)',
                    cursor: disabled ? 'default' : 'pointer',
                    lineHeight: 1.35,
                  }}
                >
                  <StatusPill tone={TAG_TONE[p.tag]} size="xs">
                    {TAG_LABEL[p.tag]}
                  </StatusPill>
                  <span>{p.title}</span>
                </label>
                <div style={{ fontSize: '11.5px', fontWeight: 500, color: 'var(--color-text-secondary)', marginTop: '2px', lineHeight: 1.4 }}>
                  {p.evidence}
                </div>
                {p.warning && (
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                      marginTop: '3px',
                      fontSize: '11.5px',
                      fontWeight: 600,
                      color: 'var(--color-badge-text)',
                    }}
                  >
                    <AlertTriangle size={11} strokeWidth={2.2} /> {p.warning}
                  </div>
                )}
              </div>
              <span
                style={{
                  fontSize: '12px',
                  fontWeight: 700,
                  fontVariantNumeric: 'tabular-nums',
                  color: p.hoursDelta > 0 ? 'var(--color-text-primary)' : 'var(--color-text-secondary)',
                  whiteSpace: 'nowrap',
                }}
              >
                {p.hoursDelta > 0 ? '+' : ''}
                {p.hoursDelta}h
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
