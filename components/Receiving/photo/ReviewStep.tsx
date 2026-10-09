'use client';

import { useState } from 'react';
import { CheckCircle2, ChevronDown } from 'lucide-react';
import { MOCK_POS } from '@/components/Receiving/mockData';
import { StatusPill } from '@/components/ui/StatusPill';
import { CleanLineList, type MatchedPlan } from './CleanStep';
import { ExceptionCard, QuestionCard, ReceiptLineCard, type CardContext } from './ExceptionCards';
import { MatchedOrders } from './MatchedOrders';
import { RECEIPT_PLANS, docTotal, type PoSampleId } from './fixtures';
import {
  effectivePoPlans,
  lineDecided,
  needsDecision,
  paperLine,
  receiptLineDecided,
  receiptNeedsDecision,
} from './resolve';
import type { Decisions, LineDecision } from './types';
import { PrimaryButton, StepHeading, cardStyle, gbp, sectionLabel } from './ui';

type Decide = (lineId: string, patch: LineDecision) => void;

function ContinueBar({ decided, total, onContinue }: { decided: number; total: number; onContinue: () => void }) {
  const ready = decided === total;
  return (
    <div style={{ position: 'sticky', bottom: 0, background: 'var(--color-bg-surface)', padding: '14px 0 8px', marginTop: 16, borderTop: '1px solid var(--color-border-subtle)' }}>
      <p aria-live="polite" style={{ ...sectionLabel, textAlign: 'center' }}>
        {total === 0 ? 'Nothing to decide' : ready ? `All ${total} decided` : `${decided} of ${total} decided`}
      </p>
      <PrimaryButton disabled={!ready} onClick={onContinue} testId="review-continue">
        Check what gets accepted
      </PrimaryButton>
    </div>
  );
}

export function PoReview({
  ctx, docId, selectedPoIds, decisions, onDecide, onContinue, onChangeOrders,
}: {
  ctx: CardContext;
  docId: PoSampleId;
  selectedPoIds: string[];
  decisions: Decisions;
  onDecide: Decide;
  onContinue: () => void;
  onChangeOrders: () => void;
}) {
  const { doc } = ctx;
  const [showClean, setShowClean] = useState(false);
  const plans = effectivePoPlans(docId, selectedPoIds, decisions);
  const clean = plans.filter((p): p is MatchedPlan => p.kind === 'clean');
  const exceptions = plans.filter(p => p.kind !== 'clean');
  const toDecide = exceptions.filter(needsDecision);
  const decidedCount = toDecide.filter(p => lineDecided(p, decisions[p.lineId])).length;
  const pos = MOCK_POS.filter(p => selectedPoIds.includes(p.id));

  return (
    <div>
      <StepHeading title="Check what arrived" />

      <MatchedOrders doc={doc} plans={plans} pos={pos} onChange={onChangeOrders} />

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
          <div style={{ padding: '4px 16px 8px', borderTop: '1px solid var(--color-border-subtle)' }}>
            <CleanLineList
              doc={doc}
              plans={clean}
              decisions={decisions}
              onReport={(lineId, problem, affected) => onDecide(lineId, { problem, affected })}
              onPrice={(lineId, price) => onDecide(lineId, { price })}
            />
          </div>
        )}
      </div>

      {exceptions.length > 0 && <h2 style={sectionLabel}>Needs you</h2>}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {exceptions.map(p => {
          const paper = paperLine(doc, p.lineId);
          const decide = (patch: LineDecision) => onDecide(p.lineId, patch);
          if (p.kind === 'ambiguous') {
            return <QuestionCard key={p.lineId} ctx={ctx} plan={p} paper={paper} decision={decisions[p.lineId]} onDecide={decide} />;
          }
          return (
            <ExceptionCard
              key={p.lineId}
              ctx={ctx}
              plan={p}
              paper={paper}
              decision={decisions[p.lineId]}
              decided={lineDecided(p, decisions[p.lineId])}
              onDecide={decide}
            />
          );
        })}
      </div>

      <ContinueBar decided={decidedCount} total={toDecide.length} onContinue={onContinue} />
    </div>
  );
}

export function ReceiptReview({
  ctx, offContract, decisions, onDecide, onContinue,
}: {
  ctx: CardContext;
  offContract: boolean;
  decisions: Decisions;
  onDecide: Decide;
  onContinue: () => void;
}) {
  const { doc } = ctx;
  const toDecide = RECEIPT_PLANS.filter(receiptNeedsDecision);
  const decidedCount = toDecide.filter(p => receiptLineDecided(p, decisions[p.lineId])).length;

  return (
    <div>
      <StepHeading
        title="Check what you bought"
        sub={`${doc.supplierName} receipt, ${gbp(docTotal(doc))}. Edify matched each line to your products. Confirm the ones it can't be sure of.`}
      />

      {offContract && (
        <div data-testid="off-contract" style={{ ...cardStyle, display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 16 }}>
          <span style={{ alignSelf: 'flex-start' }}>
            <StatusPill tone="warning">Off-contract</StatusPill>
          </span>
          <p style={{ margin: 0, fontSize: 14, lineHeight: 1.45, color: 'var(--color-text-primary)' }}>
            {doc.supplierName} isn&apos;t one of your agreed suppliers. The stock still counts in COGS, and your ops lead sees it in off-contract spend.
          </p>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {RECEIPT_PLANS.map(p => (
          <ReceiptLineCard
            key={p.lineId}
            ctx={ctx}
            plan={p}
            paper={paperLine(doc, p.lineId)}
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
