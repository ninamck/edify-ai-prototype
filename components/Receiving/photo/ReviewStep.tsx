'use client';

import { useState } from 'react';
import { CheckCircle2, ChevronDown } from 'lucide-react';
import { ExceptionCard, QuestionCard, ReceiptLineCard } from './ExceptionCards';
import {
  PRICE_TOLERANCE_PCT,
  RECEIPT_PLANS,
  docTotal,
  priceChangePct,
  type SampleDocument,
} from './fixtures';
import {
  effectiveInvoicePlans,
  invoiceLineDecided,
  needsDecision,
  paperLine,
  receiptLineDecided,
  receiptNeedsDecision,
} from './resolve';
import type { Decisions, LineDecision } from './types';
import { PrimaryButton, StepHeading, cardStyle, gbp, sectionLabel } from './ui';

interface ReviewProps {
  doc: SampleDocument;
  isInvoice: boolean;
  selectedPoIds: string[];
  decisions: Decisions;
  onDecide: (lineId: string, patch: LineDecision) => void;
  onContinue: () => void;
}

function ContinueBar({ decided, total, onContinue }: { decided: number; total: number; onContinue: () => void }) {
  const ready = decided === total;
  return (
    <div style={{ position: 'sticky', bottom: 0, background: 'var(--color-bg-surface)', padding: '14px 0 8px', marginTop: 16, borderTop: '1px solid var(--color-border-subtle)' }}>
      <p aria-live="polite" style={{ ...sectionLabel, textAlign: 'center' }}>
        {total === 0 ? 'Nothing to decide' : ready ? `All ${total} decided` : `${decided} of ${total} decided`}
      </p>
      <PrimaryButton disabled={!ready} onClick={onContinue} testId="review-continue">
        Check what gets booked in
      </PrimaryButton>
    </div>
  );
}

function InvoiceReview({ doc, selectedPoIds, decisions, onDecide, onContinue }: ReviewProps) {
  const [showClean, setShowClean] = useState(false);
  const plans = effectiveInvoicePlans(selectedPoIds);
  const clean = plans.filter(p => p.kind === 'clean');
  const exceptions = plans.filter(p => p.kind !== 'clean');
  const toDecide = exceptions.filter(needsDecision);
  const decidedCount = toDecide.filter(p => invoiceLineDecided(p, decisions[p.lineId])).length;

  return (
    <div>
      <StepHeading
        title="Check what arrived"
        sub={`${doc.supplierName} invoice ${doc.docNumber}, ${gbp(docTotal(doc))}. ${clean.length} lines match the orders and ${toDecide.length} need a decision from you.`}
      />

      <div style={{ ...cardStyle, padding: 0, marginBottom: 16 }}>
        <button
          type="button"
          aria-expanded={showClean}
          onClick={() => setShowClean(v => !v)}
          style={{ width: '100%', minHeight: 52, padding: '0 16px', display: 'flex', alignItems: 'center', gap: 10, background: 'none', border: 'none', fontFamily: 'var(--font-primary)', cursor: 'pointer', textAlign: 'left' }}
        >
          <CheckCircle2 size={20} aria-hidden style={{ color: 'var(--color-success)' }} />
          <span style={{ flex: 1, fontSize: 15, fontWeight: 700, color: 'var(--color-text-primary)' }}>
            {clean.length} lines match, received
          </span>
          <ChevronDown size={18} aria-hidden style={{ transform: showClean ? 'rotate(180deg)' : undefined, color: 'var(--color-text-secondary)' }} />
        </button>
        {showClean && (
          <ul style={{ listStyle: 'none', margin: 0, padding: '0 16px 12px', display: 'flex', flexDirection: 'column' }}>
            {clean.map(p => {
              const paper = paperLine(doc, p.lineId);
              const pct = p.kind === 'clean' ? priceChangePct(p.poPrice, paper.unitPrice) : 0;
              return (
                <li key={p.lineId} style={{ padding: '10px 0', borderTop: '1px solid var(--color-border-subtle)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, fontSize: 14 }}>
                    <span style={{ color: 'var(--color-text-primary)' }}>{paper.text}</span>
                    <span style={{ color: 'var(--color-text-secondary)', whiteSpace: 'nowrap' }}>{paper.qty} × {gbp(paper.unitPrice)}</span>
                  </div>
                  {Math.abs(pct) > 0.001 && (
                    <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--color-text-secondary)' }}>
                      Price {pct > 0 ? 'up' : 'down'} {Math.abs(pct).toFixed(0)}% from {p.kind === 'clean' ? gbp(p.poPrice) : ''}, inside your {PRICE_TOLERANCE_PCT}% tolerance. New price applied.
                    </p>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <h2 style={sectionLabel}>Needs you</h2>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {exceptions.map(p => {
          const paper = paperLine(doc, p.lineId);
          if (p.kind === 'ambiguous') {
            return <QuestionCard key={p.lineId} plan={p} paper={paper} doc={doc} decision={decisions[p.lineId]} onDecide={patch => onDecide(p.lineId, patch)} />;
          }
          return (
            <ExceptionCard
              key={p.lineId}
              plan={p}
              paper={paper}
              doc={doc}
              decision={decisions[p.lineId]}
              decided={invoiceLineDecided(p, decisions[p.lineId])}
              onDecide={patch => onDecide(p.lineId, patch)}
            />
          );
        })}
      </div>

      <ContinueBar decided={decidedCount} total={toDecide.length} onContinue={onContinue} />
    </div>
  );
}

function ReceiptReview({ doc, decisions, onDecide, onContinue }: ReviewProps) {
  const toDecide = RECEIPT_PLANS.filter(receiptNeedsDecision);
  const decidedCount = toDecide.filter(p => receiptLineDecided(p, decisions[p.lineId])).length;

  return (
    <div>
      <StepHeading
        title="Check what you bought"
        sub={`${doc.supplierName} receipt, ${gbp(docTotal(doc))}. Edify matched each line to your products. Confirm the ones it can't be sure of.`}
      />

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {RECEIPT_PLANS.map(p => (
          <ReceiptLineCard
            key={p.lineId}
            plan={p}
            paper={paperLine(doc, p.lineId)}
            doc={doc}
            decision={decisions[p.lineId]}
            decided={receiptLineDecided(p, decisions[p.lineId])}
            onDecide={patch => onDecide(p.lineId, patch)}
          />
        ))}
      </div>

      <ContinueBar decided={decidedCount} total={toDecide.length} onContinue={onContinue} />
    </div>
  );
}

export default function ReviewStep(props: ReviewProps) {
  return props.isInvoice ? <InvoiceReview {...props} /> : <ReceiptReview {...props} />;
}
