'use client';

/**
 * Intraday nudge: a Lane C question card in the chat stream.
 *
 * An order landed with lead time. Edify says what it is, what it does
 * to the next hour, and proposes one move. Yes writes the break change
 * to today's rota in Deputy as a draft edit; Not now does nothing and
 * the card says so. No logic runs behind this card in the prototype:
 * the point is the shape of the ask, not the maths.
 */

import { Bell } from 'lucide-react';
import CardShell, { type CardState } from './CardShell';
import type { RotaNudge } from '@/components/Feed/commands/rota/nudge';
import { body, label, small } from '@/components/Feed/commands/rota/ui/tokens';

export default function RotaNudgeCard({
  nudge,
  state,
  onYes,
  onNotNow,
}: {
  nudge: RotaNudge;
  state: CardState;
  onYes: () => void;
  onNotNow: () => void;
}) {
  return (
    <CardShell
      icon={Bell}
      title={`${nudge.siteName}: order landed`}
      subtitle="Intraday. One move, your call."
      state={state}
      confirmLabel={`Yes, move ${nudge.personName.split(' ')[0]}'s break`}
      cancelLabel="Not now"
      onConfirm={onYes}
      onCancel={onNotNow}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        <div style={{ ...body, fontSize: '13px', lineHeight: 1.5 }}>{nudge.trigger}</div>
        <div style={{ ...body, lineHeight: 1.5, color: 'var(--color-text-secondary)' }}>{nudge.effect}</div>
        <div
          style={{
            padding: '10px 12px',
            borderRadius: '10px',
            background: 'var(--color-review-light)',
            border: '1px solid var(--color-review-border)',
            fontSize: '13px',
            fontWeight: 700,
            color: 'var(--color-text-primary)',
            lineHeight: 1.45,
          }}
        >
          {nudge.question}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '4px 12px', alignItems: 'baseline' }}>
          <span style={label}>{nudge.change.label}</span>
          <span style={{ ...body, fontVariantNumeric: 'tabular-nums' }}>
            <span style={{ textDecoration: 'line-through', color: 'var(--color-text-secondary)' }}>{nudge.change.before}</span> {nudge.change.after}
          </span>
        </div>
        <ul style={{ margin: 0, paddingLeft: '16px', display: 'flex', flexDirection: 'column', gap: '3px' }}>
          {nudge.notes.map((n) => (
            <li key={n} style={{ ...small, lineHeight: 1.45 }}>
              {n}
            </li>
          ))}
        </ul>
        {state === 'cancelled' && <div style={{ ...small, fontStyle: 'italic' }}>Left as it is. Nothing changed in {nudge.tool}.</div>}
      </div>
    </CardShell>
  );
}
