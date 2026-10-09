'use client';

import { Circle } from 'lucide-react';
import { SITE, docNoun, type SampleDocument } from './fixtures';
import type { WritePlan } from './resolve';
import { PrimaryButton, SecondaryButton, StepHeading, cardStyle, gbp, sectionLabel } from './ui';

export default function ConfirmStep({
  doc, plan, onConfirm, onEdit,
}: {
  doc: SampleDocument;
  plan: WritePlan;
  onConfirm: () => void;
  onEdit: () => void;
}) {
  const orders = plan.pos.map(p => p.poNumber).join(' and ');
  const isReceipt = doc.kind === 'receipt';
  return (
    <div>
      <StepHeading
        title="Accept this delivery?"
        sub={
          plan.pos.length > 0
            ? `${plan.lineCount} lines from ${plan.supplier} against ${orders}, ${gbp(plan.stockValue)} of stock at ${SITE}.`
            : `${plan.lineCount} lines from ${plan.supplier}, ${gbp(plan.stockValue)} of stock at ${SITE}.`
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
      <p style={{ margin: '0 0 16px', fontSize: 13, color: 'var(--color-text-secondary)', lineHeight: 1.45 }}>
        {isReceipt
          ? `Nothing is written until you say yes. ${doc.supplierName} receipts go to the expense account, not invoice matching.`
          : `Nothing is written until you say yes. The ${docNoun(doc)} photo stays on the GRN as the record of what came in.`}
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <PrimaryButton onClick={onConfirm} testId="confirm-book">Yes, accept it</PrimaryButton>
        <SecondaryButton full onClick={onEdit}>Change something</SecondaryButton>
      </div>
    </div>
  );
}
