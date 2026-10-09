'use client';

import type { ReactNode } from 'react';
import { CheckCircle2, Info } from 'lucide-react';
import { StatusPill } from '@/components/ui/StatusPill';
import { LineCrop } from './PhotoParts';
import {
  PRICE_TOLERANCE_PCT,
  docNoun,
  priceChangePct,
  type DocLine,
  type PoLinePlan,
  type ReceiptLinePlan,
  type SampleDocument,
  type SampleId,
  type SubstitutePlan,
} from './fixtures';
import { shortName } from './resolve';
import type { LineDecision } from './types';
import { ChoiceGroup, Stepper, cardStyle, gbp } from './ui';

type Decide = (patch: LineDecision) => void;

/** What every card needs to show the photo the line came from. */
export interface CardContext {
  doc: SampleDocument;
  /** Null for a real camera photo, which has no line positions to crop from. */
  photoId: SampleId | null;
  openPhoto: (lineId: string) => void;
}

const CLEAR_REPORT: LineDecision = { problem: undefined, affected: undefined, choice: undefined };

function CardShell({
  ctx, paper, title, money, status, children,
}: {
  ctx: CardContext;
  paper: DocLine;
  title: string;
  money?: ReactNode;
  status: 'needs' | 'decided' | 'info';
  children: ReactNode;
}) {
  const showPrinted = !ctx.photoId && !title.toLowerCase().includes(paper.text.toLowerCase());
  return (
    <article data-testid={`card-${paper.id}`} style={{ ...cardStyle, display: 'flex', flexDirection: 'column', gap: 12 }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'flex-start' }}>
        <div>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: 'var(--color-text-primary)', lineHeight: 1.35 }}>{title}</h3>
          {money && <p style={{ margin: '4px 0 0', fontSize: 14, color: 'var(--color-text-secondary)', lineHeight: 1.4 }}>{money}</p>}
          {showPrinted && (
            <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--color-text-secondary)' }}>
              On the {docNoun(ctx.doc)}: &ldquo;{paper.text}&rdquo;
            </p>
          )}
        </div>
        {status === 'needs' && <StatusPill tone="warning">Needs you</StatusPill>}
        {status === 'decided' && <StatusPill tone="success">Decided</StatusPill>}
        {status === 'info' && <StatusPill tone="neutral">No action</StatusPill>}
      </header>
      {ctx.photoId && <LineCrop sampleId={ctx.photoId} lineId={paper.id} label={`"${paper.text}" on the ${docNoun(ctx.doc)}`} onOpen={ctx.openPhoto} />}
      {children}
    </article>
  );
}

function Question({ children }: { children: ReactNode }) {
  return <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: 'var(--color-text-primary)' }}>{children}</p>;
}

function Note({ children }: { children: ReactNode }) {
  return (
    <p style={{ margin: 0, fontSize: 13, color: 'var(--color-text-secondary)', display: 'flex', gap: 6, lineHeight: 1.45 }}>
      <Info size={16} aria-hidden style={{ flexShrink: 0, marginTop: 1 }} />
      <span>{children}</span>
    </p>
  );
}

function PutBack({ onDecide }: { onDecide: Decide }) {
  return (
    <button
      type="button"
      onClick={() => onDecide(CLEAR_REPORT)}
      style={{
        alignSelf: 'flex-start', minHeight: 40, padding: 0, background: 'none', border: 'none',
        fontFamily: 'var(--font-primary)', fontSize: 14, fontWeight: 600, color: 'var(--color-accent-deep)',
        textDecoration: 'underline', cursor: 'pointer',
      }}
    >
      No problem after all, it arrived as listed
    </button>
  );
}

// ── Lines against an order ─────────────────────────────────────────────

export function ExceptionCard({
  ctx, plan, paper, decision, decided, onDecide,
}: {
  ctx: CardContext;
  plan: PoLinePlan;
  paper: DocLine;
  decision: LineDecision | undefined;
  decided: boolean;
  onDecide: Decide;
}) {
  const status = decided ? 'decided' : 'needs';
  const name = shortName(paper.text);

  switch (plan.kind) {
    case 'short': {
      const missing = plan.ordered - plan.received;
      return (
        <CardShell
          ctx={ctx}
          paper={paper}
          status={status}
          title={plan.reported ? `${name}: fewer arrived than the ${docNoun(ctx.doc)} says` : `${name}: ${plan.received} of ${plan.ordered} arrived`}
          money={`${missing} short, ${gbp(missing * paper.unitPrice)} at the order price`}
        >
          {plan.reported && (
            <>
              <Question>How many arrived?</Question>
              <Stepper label="How many arrived" value={plan.received} min={0} max={plan.ordered - 1} onChange={n => onDecide({ affected: plan.ordered - n })} />
            </>
          )}
          <Question>What about the other {missing}?</Question>
          <ChoiceGroup
            label={`What about the other ${missing} ${name.toLowerCase()}`}
            stacked
            value={decision?.choice}
            onChange={choice => onDecide({ choice })}
            options={[
              { id: 'later', label: 'Rest coming later' },
              { id: 'credit', label: 'Ask for a credit note' },
              { id: 'cancel', label: 'Cancel the rest' },
            ]}
          />
          {plan.reported && <PutBack onDecide={onDecide} />}
        </CardShell>
      );
    }
    case 'damaged': {
      const good = plan.delivered - plan.damaged;
      return (
        <CardShell ctx={ctx} paper={paper} status={status} title={`${name}: damaged`} money={`${good} of ${plan.delivered} are fine. The damaged ${plan.damaged === 1 ? 'one goes' : 'ones go'} back with the driver.`}>
          <Question>How many are damaged?</Question>
          <Stepper label="How many are damaged" value={plan.damaged} min={1} max={plan.delivered} onChange={n => onDecide({ affected: n })} />
          <Question>What about the {plan.damaged} damaged?</Question>
          <ChoiceGroup
            label={`What about the ${plan.damaged} damaged ${name.toLowerCase()}`}
            stacked
            value={decision?.choice}
            onChange={choice => onDecide({ choice })}
            options={[
              { id: 'resend', label: 'Replacements coming' },
              { id: 'credit', label: 'Ask for a credit note' },
            ]}
          />
          <PutBack onDecide={onDecide} />
        </CardShell>
      );
    }
    case 'over': {
      const extra = paper.qty - plan.ordered;
      return (
        <CardShell ctx={ctx} paper={paper} status={status} title={`${name}: ${paper.qty} arrived, ${plan.ordered} ordered`} money={`${extra} extra, +${gbp(extra * paper.unitPrice)}`}>
          <Question>Keep the extra {extra}?</Question>
          <ChoiceGroup
            label={`Keep the extra ${extra} ${name.toLowerCase()}`}
            value={decision?.choice}
            onChange={choice => onDecide({ choice })}
            options={[
              { id: 'accept', label: 'Keep them' },
              { id: 'refuse', label: `Send ${extra} back` },
            ]}
          />
          {decision?.choice === 'accept' && <Note>Finance will see the invoice is higher than the order, and why.</Note>}
        </CardShell>
      );
    }
    case 'substitute':
      return <SubstituteCard ctx={ctx} plan={plan} paper={paper} decision={decision} status={status} onDecide={onDecide} />;
    case 'extra':
      return (
        <CardShell ctx={ctx} paper={paper} status={status} title={`${paper.text}: not on any order`} money={`${paper.qty} at ${gbp(paper.unitPrice)} = ${gbp(paper.qty * paper.unitPrice)}`}>
          <Question>Keep it?</Question>
          <ChoiceGroup
            label={`Keep ${paper.text}`}
            value={decision?.choice}
            onChange={choice => onDecide({ choice })}
            options={[
              { id: 'accept', label: 'Accept, add to delivery' },
              { id: 'refuse', label: 'Send it back' },
            ]}
          />
        </CardShell>
      );
    case 'price-held': {
      const pct = priceChangePct(plan.poPrice, paper.unitPrice);
      return (
        <CardShell
          ctx={ctx}
          paper={paper}
          status="info"
          title={`${name}: ${gbp(paper.unitPrice)} each, the order says ${gbp(plan.poPrice)}`}
          money={`${pct > 0 ? 'Up' : 'Down'} ${Math.abs(pct).toFixed(0)}%, over your ${PRICE_TOLERANCE_PCT}% tolerance. ${gbp(Math.abs(paper.unitPrice - plan.poPrice) * paper.qty)} ${pct > 0 ? 'more' : 'less'} on this delivery.`}
        >
          <Note>All {paper.qty} are received at the order price. The new price waits for an admin to approve, so product costs don&apos;t move until then.</Note>
        </CardShell>
      );
    }
    default:
      return null;
  }
}

function SubstituteCard({
  ctx, plan, paper, decision, status, onDecide,
}: {
  ctx: CardContext;
  plan: SubstitutePlan;
  paper: DocLine;
  decision: LineDecision | undefined;
  status: 'needs' | 'decided';
  onDecide: Decide;
}) {
  const pack = plan.packOptions.find(p => p.id === decision?.packId);
  const priced = ctx.doc.kind !== 'delivery-note';
  const money = priced
    ? `${paper.qty} ${plan.deliveredUnit} at ${gbp(paper.unitPrice)}. You ordered ${plan.replacedQty} ${plan.replacedUnit} at ${gbp(plan.replacedPrice)}.`
    : `${paper.qty} ${plan.deliveredUnit} delivered. You ordered ${plan.replacedQty} ${plan.replacedUnit}.`;
  const equiv = pack ? paper.qty * pack.masterQty : 0;
  // Edify places the product itself; the GM at the door only confirms the swap and the pack size.
  const where = plan.options.find(o => o.id === plan.suggestedOption) ?? plan.options[0];
  const supplier = ctx.doc.supplierName;

  return (
    <CardShell ctx={ctx} paper={paper} status={status} title={`${plan.productName} instead of ${plan.replacedName}`} money={money}>
      <Question>Accept it as the replacement?</Question>
      <ChoiceGroup
        label="Accept it as the replacement"
        value={decision?.choice}
        onChange={choice => onDecide(choice === 'accept' ? { choice, subOption: plan.suggestedOption } : { choice })}
        options={[
          { id: 'accept', label: 'Accept the swap' },
          { id: 'refuse', label: 'Send it back' },
        ]}
      />
      {decision?.choice === 'accept' && (
        <>
          <Question>{plan.packQuestion}</Question>
          <ChoiceGroup
            label={plan.packQuestion}
            compact
            value={decision.packId}
            onChange={packId => onDecide({ packId })}
            options={plan.packOptions.map(p => ({ id: p.id, label: p.label }))}
          />
          {pack ? (
            <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: 'var(--color-success)' }}>
              {paper.qty} {plan.deliveredUnit} = {equiv} {plan.masterUnitLabel}
              {equiv === plan.replacedQty ? ', the same as you ordered.' : `, ${plan.replacedQty} ordered.`}
            </p>
          ) : (
            <Note>Edify needs the pack size to count the {plan.deliveredUnit} against your {plan.masterUnitLabel}.</Note>
          )}
          <Note>
            {where.kind === 'supplier-product'
              ? <>Already in {supplier}&apos;s catalogue in Edify under <strong>{where.masterName}</strong>, so recipes cost from it straight away.</>
              : <>New to Edify. It counts under <strong>{where.masterName}</strong> from this delivery. Allergens, sites and recipes are set up in the Command Centre afterwards. It opens from the done screen with the name, supplier, pack and price filled in.</>}
          </Note>
        </>
      )}
      {decision?.choice === 'refuse' && <Note>{plan.replacedName} stays open on the order for the next delivery.</Note>}
    </CardShell>
  );
}

export function QuestionCard({
  ctx, plan, paper, decision, onDecide,
}: {
  ctx: CardContext;
  plan: Extract<PoLinePlan, { kind: 'ambiguous' }>;
  paper: DocLine;
  decision: LineDecision | undefined;
  onDecide: Decide;
}) {
  const suggested = plan.candidates[plan.suggested];
  return (
    <CardShell
      ctx={ctx}
      paper={paper}
      status={decision?.choice ? 'decided' : 'needs'}
      title={`Which ${paper.text.toLowerCase()} is this?`}
      money={`The ${docNoun(ctx.doc)} just says "${paper.text}", ${paper.qty} at ${gbp(paper.unitPrice)}.`}
    >
      <Note>Edify thinks it&apos;s {suggested.label.toLowerCase()}: the quantity and price match that line.</Note>
      <ChoiceGroup
        label={`Which ${paper.text.toLowerCase()} is this`}
        stacked
        value={decision?.choice}
        onChange={choice => onDecide({ choice })}
        options={plan.candidates.map((c, i) => ({ id: String(i), label: c.label, hint: c.detail }))}
      />
    </CardShell>
  );
}

// ── Shop receipt lines ─────────────────────────────────────────────────

export function ReceiptLineCard({
  ctx, plan, paper, decision, decided, onDecide,
}: {
  ctx: CardContext;
  plan: ReceiptLinePlan;
  paper: DocLine;
  decision: LineDecision | undefined;
  decided: boolean;
  onDecide: Decide;
}) {
  const money = `${paper.qty} at ${gbp(paper.unitPrice)} = ${gbp(paper.qty * paper.unitPrice)}`;
  const status = plan.kind === 'supplier-product' ? 'info' : decided ? 'decided' : 'needs';
  const supplier = ctx.doc.supplierName;

  switch (plan.kind) {
    case 'supplier-product':
      return (
        <CardShell ctx={ctx} paper={paper} status={status} title={plan.productName} money={money}>
          <p style={{ margin: 0, fontSize: 14, color: 'var(--color-text-primary)', display: 'flex', gap: 6, alignItems: 'center' }}>
            <CheckCircle2 size={16} aria-hidden style={{ color: 'var(--color-success)' }} />
            Matched to the product you bought here on {plan.lastBought}.
          </p>
        </CardShell>
      );
    case 'master': {
      const pack = plan.packOptions.find(p => p.id === decision?.packId);
      return (
        <CardShell ctx={ctx} paper={paper} status={status} title={plan.suggestedName} money={money}>
          <Note>No {supplier} product yet, but it&apos;s the same thing as your <strong>{plan.masterName}</strong> master product. Edify adds it under that so it counts with your other milk.</Note>
          <Question>How much is in one bottle?</Question>
          <ChoiceGroup
            label="How much is in one bottle"
            value={decision?.packId}
            onChange={packId => onDecide({ packId })}
            options={plan.packOptions.map(p => ({ id: p.id, label: p.label }))}
          />
          {pack ? (
            <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: 'var(--color-success)' }}>
              {paper.qty} bottles = {+(paper.qty * pack.masterQty).toFixed(3)} {plan.masterUnit} of {plan.masterName}
            </p>
          ) : (
            <Note>Your master is counted in {plan.masterPack}s. Edify won&apos;t guess the size from the name.</Note>
          )}
        </CardShell>
      );
    }
    case 'new':
      return (
        <CardShell ctx={ctx} paper={paper} status={status} title={paper.text.charAt(0) + paper.text.slice(1).toLowerCase()} money={money}>
          <Note>Nothing in your products matches. The closest is {plan.closest}, which isn&apos;t the same thing.</Note>
          <ChoiceGroup
            label={`What to do with ${paper.text.toLowerCase()}`}
            value={decision?.choice}
            onChange={choice => onDecide({ choice })}
            options={[
              { id: 'create', label: 'Add as a new product' },
              { id: 'ignore', label: 'Not stock, ignore' },
            ]}
          />
          {decision?.choice === 'create' && (
            <Note>
              Edify books the {paper.qty} in now as <strong>{plan.suggestedName}</strong> from {supplier}, {plan.category.toLowerCase()}, counted {plan.unit}.
              Allergens, sites and recipes are set up in the Command Centre afterwards. It opens from the done screen with these details filled in.
            </Note>
          )}
        </CardShell>
      );
    case 'not-stock':
      return (
        <CardShell ctx={ctx} paper={paper} status={status} title={paper.text.charAt(0) + paper.text.slice(1).toLowerCase()} money={money}>
          <Note>{plan.reason}</Note>
          <ChoiceGroup
            label="Is the carrier bag stock"
            value={decision?.choice}
            onChange={choice => onDecide({ choice })}
            options={[
              { id: 'ignore', label: 'Not stock, ignore' },
              { id: 'stock', label: "It's stock, book it in" },
            ]}
          />
        </CardShell>
      );
  }
}
