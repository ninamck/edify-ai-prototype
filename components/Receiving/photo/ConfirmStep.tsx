'use client';

import { Circle } from 'lucide-react';
import type { SampleDocument } from './fixtures';
import type { WritePlan } from './resolve';
import { PrimaryButton, SecondaryButton, StepHeading, cardStyle, gbp, sectionLabel } from './ui';

export default function ConfirmStep({
  doc, isInvoice, plan, onConfirm, onEdit,
}: {
  doc: SampleDocument;
  isInvoice: boolean;
  plan: WritePlan;
  onConfirm: () => void;
  onEdit: () => void;
}) {
  const orders = plan.pos.map(p => p.poNumber).join(' and ');
  return (
    <div>
      <StepHeading
        title="Book this into stock?"
        sub={
          isInvoice
            ? `${plan.lineCount} lines from ${plan.supplier} against ${orders}, ${gbp(plan.stockValue)} of stock at Fitzroy Espresso.`
            : `${plan.lineCount} lines from ${plan.supplier}, ${gbp(plan.stockValue)} of stock at Fitzroy Espresso.`
        }
      />
      <div style={{ ...cardStyle, marginBottom: 16 }}>
        <h2 style={sectionLabel}>What Edify will write</h2>
        <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
          {plan.outcomes.map(o => (
            <li key={o.id} style={{ display: 'flex', gap: 10, fontSize: 14, lineHeight: 1.45, color: 'var(--color-text-primary)' }}>
              <Circle size={8} aria-hidden style={{ flexShrink: 0, marginTop: 6, fill: 'var(--color-accent-active)', color: 'var(--color-accent-active)' }} />
              {o.future}
            </li>
          ))}
        </ul>
      </div>
      {!isInvoice && (
        <p style={{ margin: '0 0 16px', fontSize: 13, color: 'var(--color-text-secondary)', lineHeight: 1.45 }}>
          Nothing is written until you say yes. {doc.supplierName} receipts go to the expense account, not invoice matching.
        </p>
      )}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <PrimaryButton onClick={onConfirm} testId="confirm-book">Yes, book it in</PrimaryButton>
        <SecondaryButton full onClick={onEdit}>Change something</SecondaryButton>
      </div>
    </div>
  );
}
