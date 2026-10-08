'use client';

import type { ReactNode } from 'react';
import { CheckCircle2, Info } from 'lucide-react';
import { ALL_ALLERGENS, type Allergen } from '@/components/Suppliers/fixtures';
import { StatusPill } from '@/components/ui/StatusPill';
import { pageOfLine } from './PaperDocument';
import {
  PRICE_TOLERANCE_PCT,
  priceChangePct,
  type DocLine,
  type InvoiceLinePlan,
  type ReceiptLinePlan,
  type SampleDocument,
} from './fixtures';
import type { LineDecision } from './types';
import { ChoiceGroup, cardStyle, gbp } from './ui';

type Decide = (patch: LineDecision) => void;

function shortName(text: string): string {
  return text.replace(/\s+\d.*$/, '');
}

function CardShell({
  title, money, status, doc, paper, children, testId,
}: {
  title: string;
  money?: ReactNode;
  status: 'needs' | 'decided' | 'info';
  doc: SampleDocument;
  paper: DocLine;
  children: ReactNode;
  testId?: string;
}) {
  // The printed wording only adds anything when the title uses a different name.
  const showPrinted = !title.toLowerCase().includes(paper.text.toLowerCase());
  const where = doc.kind === 'invoice' ? `On the invoice, page ${pageOfLine(doc, paper.id)}` : 'On the receipt';
  return (
    <article
      data-testid={testId}
      style={{ ...cardStyle, display: 'flex', flexDirection: 'column', gap: 12 }}
    >
      <header style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'flex-start' }}>
        <div>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: 'var(--color-text-primary)', lineHeight: 1.35 }}>{title}</h3>
          {money && <p style={{ margin: '4px 0 0', fontSize: 14, color: 'var(--color-text-secondary)', lineHeight: 1.4 }}>{money}</p>}
          {showPrinted && (
            <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--color-text-secondary)' }}>
              {where}: &ldquo;{paper.text}&rdquo;
            </p>
          )}
        </div>
        {status === 'needs' && <StatusPill tone="warning">Needs you</StatusPill>}
        {status === 'decided' && <StatusPill tone="success">Decided</StatusPill>}
        {status === 'info' && <StatusPill tone="neutral">No action</StatusPill>}
      </header>
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

// ── Invoice exceptions ─────────────────────────────────────────────────

export function ExceptionCard({
  plan, paper, doc, decision, decided, onDecide,
}: {
  plan: InvoiceLinePlan;
  paper: DocLine;
  doc: SampleDocument;
  decision: LineDecision | undefined;
  decided: boolean;
  onDecide: Decide;
}) {
  const status = decided ? 'decided' : 'needs';
  const name = shortName(paper.text);

  switch (plan.kind) {
    case 'short': {
      const missing = plan.ordered - paper.qty;
      return (
        <CardShell doc={doc} paper={paper} testId={`card-${paper.id}`} status={status} title={`${name}: ${paper.qty} of ${plan.ordered} arrived`} money={`${missing} short, ${gbp(missing * paper.unitPrice)} not delivered`}>
          <Question>What about the other {missing}?</Question>
          <ChoiceGroup
            label={`What about the other ${missing} ${name.toLowerCase()}`}
            stacked
            value={decision?.choice}
            onChange={choice => onDecide({ choice })}
            options={[
              { id: 'later', label: 'Rest coming later', hint: `The order stays open for ${missing}` },
              { id: 'credit', label: 'Ask for a credit note', hint: `${gbp(missing * paper.unitPrice)} back from ${doc.supplierName}` },
              { id: 'cancel', label: 'Cancel the rest', hint: `Close the line at ${paper.qty}` },
            ]}
          />
        </CardShell>
      );
    }
    case 'over': {
      const extra = paper.qty - plan.ordered;
      return (
        <CardShell doc={doc} paper={paper} testId={`card-${paper.id}`} status={status} title={`${name}: ${paper.qty} arrived, ${plan.ordered} ordered`} money={`${extra} extra, +${gbp(extra * paper.unitPrice)}`}>
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
        </CardShell>
      );
    }
    case 'substitute': {
      const pack = plan.packOptions.find(p => p.id === decision?.packId);
      return (
        <CardShell
          doc={doc} paper={paper} testId={`card-${paper.id}`}
          status={status}
          title={`${paper.text} instead of ${plan.replacedName.toLowerCase()}`}
          money={`${paper.qty} boxes at ${gbp(paper.unitPrice)} = ${gbp(paper.qty * paper.unitPrice)}. You ordered ${plan.replacedQty} punnets at ${gbp(plan.replacedPrice)} = ${gbp(plan.replacedQty * plan.replacedPrice)}.`}
        >
          <Question>Accept the swap?</Question>
          <ChoiceGroup
            label="Accept the swap"
            value={decision?.choice}
            onChange={choice => onDecide({ choice })}
            options={[
              { id: 'accept', label: 'Accept the swap' },
              { id: 'refuse', label: 'Send it back' },
            ]}
          />
          {decision?.choice === 'accept' && (
            <>
              <Note>Edify adds {paper.text} as a {doc.supplierName} product under your {plan.masterName} master product, linked to the cherry tomatoes line it replaces.</Note>
              <Question>How big is one box?</Question>
              <ChoiceGroup
                label="How big is one box"
                stacked
                value={decision.packId}
                onChange={packId => onDecide({ packId })}
                options={plan.packOptions.map(p => ({ id: p.id, label: p.label }))}
              />
              {pack ? (
                <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: 'var(--color-success)' }}>
                  {paper.qty} boxes = {paper.qty * pack.masterQty} {plan.masterUnitLabel}
                  {paper.qty * pack.masterQty === plan.replacedQty ? ', the same as you ordered.' : `, ${plan.replacedQty} ordered.`}
                </p>
              ) : (
                <Note>Edify won&apos;t guess the pack size. It needs this to count the boxes against your {plan.masterUnitLabel}.</Note>
              )}
            </>
          )}
          {decision?.choice === 'refuse' && <Note>{plan.replacedName} stay open on the order for the next delivery.</Note>}
        </CardShell>
      );
    }
    case 'extra':
      return (
        <CardShell doc={doc} paper={paper} testId={`card-${paper.id}`} status={status} title={`${paper.text}: not on any order`} money={`${paper.qty} at ${gbp(paper.unitPrice)} = ${gbp(paper.qty * paper.unitPrice)}`}>
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
          doc={doc} paper={paper} testId={`card-${paper.id}`}
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

export function QuestionCard({
  plan, paper, doc, decision, onDecide,
}: {
  plan: Extract<InvoiceLinePlan, { kind: 'ambiguous' }>;
  paper: DocLine;
  doc: SampleDocument;
  decision: LineDecision | undefined;
  onDecide: Decide;
}) {
  const suggested = plan.candidates[plan.suggested];
  return (
    <CardShell
      doc={doc} paper={paper} testId={`card-${paper.id}`}
      status={decision?.choice ? 'decided' : 'needs'}
      title={`Which ${paper.text.toLowerCase()} is this?`}
      money={`The invoice just says "${paper.text}", ${paper.qty} at ${gbp(paper.unitPrice)}.`}
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

function AllergenPicker({ value, none, onChange }: { value: Allergen[]; none: boolean; onChange: (patch: LineDecision) => void }) {
  const toggle = (a: Allergen) =>
    onChange({ allergens: value.includes(a) ? value.filter(x => x !== a) : [...value, a], noAllergens: false });
  const pill = (on: boolean) => ({
    minHeight: 40, padding: '0 14px', borderRadius: 999,
    border: on ? '1.5px solid var(--color-accent-active)' : '1px solid var(--color-border)',
    background: on ? 'var(--color-accent-active)' : '#fff',
    color: on ? 'var(--color-text-on-active)' : 'var(--color-text-primary)',
    fontFamily: 'var(--font-primary)', fontSize: 14, fontWeight: 600, cursor: 'pointer',
  });
  return (
    <div>
      <Question>Allergens</Question>
      <p style={{ margin: '2px 0 8px', fontSize: 13, color: 'var(--color-text-secondary)' }}>Pick every one that applies, or no allergens.</p>
      <div role="group" aria-label="Allergens" style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        <button type="button" aria-pressed={none} onClick={() => onChange({ noAllergens: !none, allergens: [] })} style={pill(none)}>
          No allergens
        </button>
        {ALL_ALLERGENS.map(a => (
          <button key={a} type="button" aria-pressed={value.includes(a)} onClick={() => toggle(a)} style={pill(value.includes(a))}>
            {a}
          </button>
        ))}
      </div>
    </div>
  );
}

export function ReceiptLineCard({
  plan, paper, doc, decision, decided, onDecide,
}: {
  plan: ReceiptLinePlan;
  paper: DocLine;
  doc: SampleDocument;
  decision: LineDecision | undefined;
  decided: boolean;
  onDecide: Decide;
}) {
  const money = `${paper.qty} at ${gbp(paper.unitPrice)} = ${gbp(paper.qty * paper.unitPrice)}`;
  const status = plan.kind === 'supplier-product' ? 'info' : decided ? 'decided' : 'needs';

  switch (plan.kind) {
    case 'supplier-product':
      return (
        <CardShell doc={doc} paper={paper} testId={`card-${paper.id}`} status={status} title={plan.productName} money={money}>
          <p style={{ margin: 0, fontSize: 14, color: 'var(--color-text-primary)', display: 'flex', gap: 6, alignItems: 'center' }}>
            <CheckCircle2 size={16} aria-hidden style={{ color: 'var(--color-success)' }} />
            Matched to the product you bought here on {plan.lastBought}.
          </p>
        </CardShell>
      );
    case 'master': {
      const pack = plan.packOptions.find(p => p.id === decision?.packId);
      return (
        <CardShell doc={doc} paper={paper} testId={`card-${paper.id}`} status={status} title={plan.suggestedName} money={money}>
          <Note>No {doc.supplierName} product yet, but it&apos;s the same thing as your <strong>{plan.masterName}</strong> master product. Edify adds it under that so it counts with your other milk.</Note>
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
        <CardShell doc={doc} paper={paper} testId={`card-${paper.id}`} status={status} title={paper.text} money={money}>
          <Note>Nothing in your products matches. The closest is {plan.closest}, which isn&apos;t the same thing.</Note>
          <ChoiceGroup
            label={`What to do with ${paper.text.toLowerCase()}`}
            value={decision?.choice}
            onChange={choice => onDecide({ choice })}
            options={[
              { id: 'create', label: 'Create a new product' },
              { id: 'ignore', label: 'Not stock, ignore' },
            ]}
          />
          {decision?.choice === 'create' && (
            <>
              <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--color-text-primary)' }}>Product name</span>
                <input
                  value={decision.name ?? ''}
                  onChange={e => onDecide({ name: e.target.value })}
                  style={{ minHeight: 44, padding: '0 12px', borderRadius: 'var(--radius-item)', border: '1px solid var(--color-border)', fontSize: 15, fontFamily: 'var(--font-primary)', color: 'var(--color-text-primary)' }}
                />
              </label>
              <p style={{ margin: 0, fontSize: 13, color: 'var(--color-text-secondary)' }}>
                {plan.category} · counted {plan.unit} · supplier {doc.supplierName}
              </p>
              <AllergenPicker value={decision.allergens ?? []} none={!!decision.noAllergens} onChange={onDecide} />
            </>
          )}
        </CardShell>
      );
    case 'not-stock':
      return (
        <CardShell doc={doc} paper={paper} testId={`card-${paper.id}`} status={status} title={paper.text.charAt(0) + paper.text.slice(1).toLowerCase()} money={money}>
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
