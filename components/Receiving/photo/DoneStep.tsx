'use client';

import Link from 'next/link';
import { ArrowRight, Camera, CheckCircle2, Sparkles, Undo2 } from 'lucide-react';
import type { CommitResult } from './PhotoCaptureFlow';
import { SecondaryButton, cardStyle, gbp, sectionLabel } from './ui';

export default function DoneStep({
  result, onUndo, onAnother,
}: {
  result: CommitResult;
  onUndo: () => void;
  onAnother: () => void;
}) {
  const { grn, plan, time } = result;
  return (
    <div>
      <div
        role="status"
        style={{
          ...cardStyle, background: 'var(--color-success-light)', borderColor: 'var(--color-success-border)',
          display: 'flex', gap: 12, alignItems: 'flex-start', marginBottom: 16,
        }}
      >
        <CheckCircle2 size={24} aria-hidden style={{ color: 'var(--color-success)', flexShrink: 0 }} />
        <div>
          <p style={{ margin: 0, fontSize: 17, fontWeight: 700, color: 'var(--color-success)' }}>
            Accepted. {grn.grnNumber} at {time}.
          </p>
          <p style={{ margin: '2px 0 0', fontSize: 14, color: 'var(--color-text-primary)' }}>
            {plan.lineCount} lines from {plan.supplier}, {gbp(plan.stockValue)} of stock.
          </p>
        </div>
      </div>

      <div style={{ ...cardStyle, marginBottom: 12 }}>
        <h2 style={sectionLabel}>What Edify wrote</h2>
        <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
          {plan.outcomes.map(o => (
            <li key={o.id} style={{ display: 'flex', gap: 10, fontSize: 14, lineHeight: 1.45, color: 'var(--color-text-primary)' }}>
              <CheckCircle2 size={16} aria-hidden style={{ flexShrink: 0, marginTop: 2, color: 'var(--color-success)' }} />
              {o.past}
            </li>
          ))}
        </ul>
      </div>

      {plan.followUps.length > 0 && (
        <div style={{ ...cardStyle, marginBottom: 12, borderColor: 'var(--color-accent-active)' }}>
          <h2 style={sectionLabel}>Next</h2>
          <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 12 }}>
            {plan.followUps.map(f => (
              <li key={f.id} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <p style={{ margin: 0, fontSize: 14, lineHeight: 1.45, color: 'var(--color-text-primary)' }}>{f.detail}</p>
                <Link
                  href={f.href}
                  data-testid={f.id}
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, minHeight: 48, borderRadius: 'var(--radius-item)',
                    background: 'var(--color-accent-active)', color: 'var(--color-text-on-active)', fontWeight: 700, fontSize: 15, textDecoration: 'none',
                  }}
                >
                  <Sparkles size={18} aria-hidden />
                  {f.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}

      {plan.handoffs.length > 0 && (
        <div style={{ ...cardStyle, marginBottom: 16 }}>
          <h2 style={sectionLabel}>Passed on</h2>
          <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
            {plan.handoffs.map(h => (
              <li key={h} style={{ display: 'flex', gap: 10, fontSize: 14, lineHeight: 1.45, color: 'var(--color-text-primary)' }}>
                <ArrowRight size={16} aria-hidden style={{ flexShrink: 0, marginTop: 2, color: 'var(--color-text-secondary)' }} />
                {h}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <Link
          href={`/receive/grn/${grn.id}`}
          style={
            plan.followUps.length > 0
              ? {
                  display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 44, borderRadius: 'var(--radius-item)',
                  border: '1px solid var(--color-border)', background: '#fff', color: 'var(--color-accent-deep)', fontWeight: 600, fontSize: 14, textDecoration: 'none',
                }
              : {
                  display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 48, borderRadius: 'var(--radius-item)',
                  background: 'var(--color-accent-active)', color: 'var(--color-text-on-active)', fontWeight: 700, fontSize: 15, textDecoration: 'none',
                }
          }
        >
          View {grn.grnNumber}
        </Link>
        <SecondaryButton full icon={<Camera size={18} aria-hidden />} onClick={onAnother}>
          Photo another delivery
        </SecondaryButton>
      </div>

      <div style={{ marginTop: 24, paddingTop: 16, borderTop: '1px solid var(--color-border-subtle)' }}>
        <SecondaryButton full icon={<Undo2 size={18} aria-hidden />} onClick={onUndo} testId="undo-batch">
          Undo the whole batch
        </SecondaryButton>
        <p style={{ margin: '6px 0 0', fontSize: 13, color: 'var(--color-text-secondary)', textAlign: 'center' }}>
          Removes {grn.grnNumber}, puts the orders back as they were and drops any new products.
        </p>
      </div>
    </div>
  );
}
