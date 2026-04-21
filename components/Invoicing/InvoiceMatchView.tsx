'use client';

import { useState, useMemo } from 'react';
import StatusBadge from '@/components/Receiving/StatusBadge';
import {
  Invoice,
  MatchVariance,
  PriceResolution,
  QtyResolution,
  OverInvoiceResolution,
  MOCK_INVOICES,
  getGRNsForInvoice,
  getUnmatchedInvoiceLines,
  invoiceGRNTotal,
  getSuggestedGRN,
  getPOContextForInvoice,
  POContextForInvoice,
  getPriorInvoicedForInvoiceLine,
  categorizeSku,
  defaultVatRate,
  vatCategoryLabel,
  VatCategory,
  GRN,
} from './mockData';
import {
  AUTO_APPLIED_VARIANCES,
  getAutoAppliedForVariance,
  getAISuggestion,
} from '@/components/InvoicingRules/mockData';
import Link from 'next/link';
import { MOCK_POS, POLine } from '@/components/Receiving/mockData';

type AnyResolution = PriceResolution | QtyResolution | OverInvoiceResolution;

interface InvoiceMatchViewProps {
  invoice: Invoice;
  onApprove: () => void;
  onBack: () => void;
}

const PRICE_OPTIONS: PriceResolution[] = ['Accept & Update Cost in Edify', 'Accept for this delivery', 'Dispute → Credit Note'];
const QTY_OPTIONS: QtyResolution[] = ['Credit Note', 'Accept Short'];
const OVER_OPTIONS: OverInvoiceResolution[] = ['Request credit note'];

function resolutionOptionsFor(type: MatchVariance['type']): readonly AnyResolution[] {
  if (type === 'price') return PRICE_OPTIONS;
  if (type === 'over-invoice') return OVER_OPTIONS;
  return QTY_OPTIONS;
}

function varianceLabel(type: MatchVariance['type']): string {
  if (type === 'price') return 'Price';
  if (type === 'over-invoice') return 'Over-invoice';
  return 'Quantity';
}

function varianceBadgeVariant(type: MatchVariance['type']): 'warning' | 'info' | 'error' {
  if (type === 'price') return 'warning';
  if (type === 'over-invoice') return 'error';
  return 'info';
}

function VarianceTypeChip({ type }: { type: MatchVariance['type'] }) {
  const styles: Record<MatchVariance['type'], { bg: string; color: string; border: string }> = {
    price: { bg: 'rgba(217,119,6,0.1)', color: 'var(--color-warning)', border: 'rgba(217,119,6,0.3)' },
    qty: { bg: 'rgba(3,105,161,0.08)', color: 'var(--color-info)', border: 'rgba(3,105,161,0.25)' },
    'over-invoice': { bg: 'rgba(185,28,28,0.09)', color: 'var(--color-error)', border: 'rgba(185,28,28,0.3)' },
  };
  const s = styles[type];
  return (
    <span style={{ fontSize: '11px', fontWeight: 700, padding: '2px 7px', borderRadius: '4px', background: s.bg, color: s.color, border: `1px solid ${s.border}` }}>
      {varianceLabel(type)}
    </span>
  );
}

function varianceShortLabel(variance: MatchVariance, priceDiff: number): string {
  if (variance.type === 'price') return `${priceDiff > 0 ? '+' : ''}£${Math.abs(priceDiff).toFixed(2)} / unit`;
  if (variance.type === 'over-invoice') return `+${variance.invoiceValue - variance.poValue} over`;
  return `${variance.invoiceValue > variance.grnValue ? '+' : ''}${variance.invoiceValue - variance.grnValue} unit${Math.abs(variance.invoiceValue - variance.grnValue) !== 1 ? 's' : ''}`;
}

function varianceDetailText(variance: MatchVariance): string {
  if (variance.type === 'price') {
    const d = variance.invoiceValue - variance.poValue;
    return `PO: £${variance.poValue.toFixed(2)} → Invoice: £${variance.invoiceValue.toFixed(2)} (${d >= 0 ? '+' : ''}£${d.toFixed(2)}/unit)`;
  }
  if (variance.type === 'over-invoice') {
    const extra = variance.invoiceValue - variance.poValue;
    return `PO ordered ${variance.poValue} · Invoice bills ${variance.invoiceValue} (+${extra} over)`;
  }
  return `GRN: ${variance.grnValue} → Invoice claims: ${variance.invoiceValue}`;
}

export default function InvoiceMatchView({ invoice, onApprove, onBack }: InvoiceMatchViewProps) {
  const [resolutions, setResolutions] = useState<Record<string, AnyResolution>>({});
  const [showConfirm, setShowConfirm] = useState(false);
  const [linkedGRNs, setLinkedGRNs] = useState<string[]>([]);

  const suggestedGRN = getSuggestedGRN(invoice);
  const poContexts = useMemo(() => getPOContextForInvoice(invoice), [invoice]);
  const splitPOContexts = useMemo(() => poContexts.filter(c => c.totalInvoices > 1), [poContexts]);

  const grns = useMemo(() => getGRNsForInvoice(invoice, linkedGRNs), [invoice, linkedGRNs]);
  const grnTotal = useMemo(() => invoiceGRNTotal(invoice, linkedGRNs), [invoice, linkedGRNs]);
  const unmatchedLines = useMemo(() => getUnmatchedInvoiceLines(invoice, linkedGRNs), [invoice, linkedGRNs]);
  const varianceTotal = invoice.total - grnTotal;

  const hasUnmatched = unmatchedLines.length > 0;
  const canSuggest = hasUnmatched && suggestedGRN && !linkedGRNs.includes(suggestedGRN.grnNumber);

  const [lineTaxRates, setLineTaxRates] = useState<Record<string, number>>(
    () => Object.fromEntries(
      invoice.lines
        .map(il => {
          const rate = defaultVatRate(categorizeSku(il.sku));
          return rate === null ? null : [il.id, rate];
        })
        .filter((x): x is [string, number] => x !== null)
    )
  );
  const setLineRate = (lineId: string, rate: number) => {
    setLineTaxRates(prev => {
      const next = { ...prev };
      if (rate === 0) delete next[lineId];
      else next[lineId] = rate;
      return next;
    });
  };
  const totalTax = useMemo(
    () => invoice.lines.reduce((sum, il) => sum + il.lineTotal * (lineTaxRates[il.id] ?? 0) / 100, 0),
    [invoice.lines, lineTaxRates]
  );
  const anyTax = totalTax > 0;

  const autoAppliedVariances = useMemo(
    () => invoice.variances.filter(v => getAutoAppliedForVariance(v.id) !== undefined),
    [invoice.variances]
  );
  const autoAppliedIds = useMemo(() => new Set(autoAppliedVariances.map(v => v.id)), [autoAppliedVariances]);
  const [dismissAISuggestion, setDismissAISuggestion] = useState(false);
  const aiSuggestion = useMemo(
    () => (dismissAISuggestion ? undefined : getAISuggestion(invoice.id)),
    [invoice.id, dismissAISuggestion]
  );
  const resolvedOrAuto = (v: MatchVariance) => !!resolutions[v.id] || autoAppliedIds.has(v.id);
  const allResolved = invoice.variances.length > 0 && invoice.variances.every(resolvedOrAuto);
  const noVariances = invoice.variances.length === 0;
  const awaitingDelivery = grns.length === 0 && invoice.lines.length > 0 && invoice.status !== 'Parse Failed' && invoice.status !== 'Duplicate';
  const [overrideDuplicate, setOverrideDuplicate] = useState(false);
  const isDuplicate = invoice.status === 'Duplicate';
  const canApprove = (noVariances || allResolved) && !awaitingDelivery && (!isDuplicate || overrideDuplicate);

  const setRes = (varianceId: string, res: AnyResolution | null) => {
    setResolutions(prev => {
      const next = { ...prev };
      if (res === null) delete next[varianceId];
      else next[varianceId] = res;
      return next;
    });
  };

  const handleLinkGRN = (grnNumber: string) => {
    setLinkedGRNs(prev => [...prev, grnNumber]);
  };

  if (showConfirm) {
    return (
      <ApprovalConfirmation
        invoice={invoice}
        resolutions={resolutions}
        grns={grns}
        unmatchedLines={unmatchedLines}
        poContexts={poContexts}
        onBack={() => setShowConfirm(false)}
        onConfirm={onApprove}
      />
    );
  }

  return (
    <div style={{ fontFamily: 'var(--font-primary)' }}>
      {/* Header */}
      <button
        onClick={onBack}
        style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '13px', fontWeight: 600, color: 'var(--color-accent-deep)', fontFamily: 'var(--font-primary)', marginBottom: '4px' }}
      >
        ← Back to Invoices
      </button>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px', marginBottom: '20px' }}>
        <div>
          <h1 style={{ fontSize: '22px', fontWeight: 700, color: 'var(--color-text-primary)', margin: '0 0 4px' }}>
            {invoice.invoiceNumber} — {invoice.supplier}
          </h1>
          <p style={{ fontSize: '13px', color: 'var(--color-text-secondary)', margin: 0 }}>
            Three-way match: Invoice ↔ GRN{grns.length > 1 ? 's' : ''} ↔ PO
          </p>
        </div>
        <button
          disabled={!canApprove}
          onClick={() => setShowConfirm(true)}
          style={{
            padding: '10px 22px',
            borderRadius: '8px',
            background: canApprove ? 'var(--color-accent-active)' : 'var(--color-bg-hover)',
            color: canApprove ? '#fff' : 'var(--color-text-secondary)',
            border: canApprove ? 'none' : '1px solid var(--color-border)',
            fontWeight: 700,
            fontSize: '14px',
            fontFamily: 'var(--font-primary)',
            cursor: canApprove ? 'pointer' : 'not-allowed',
            whiteSpace: 'nowrap',
            flexShrink: 0,
          }}
        >
          Approve & Sync
        </button>
      </div>

      {/* Summary cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px', marginBottom: '24px' }}>
        <MatchSummaryCard
          label="GRN Total"
          value={`£${grnTotal.toFixed(2)}`}
          sub={grns.length > 0
            ? grns.map(g => g.grnNumber).join(' + ') + (hasUnmatched ? ' (partial)' : '')
            : '—'
          }
          variant="default"
        />
        <MatchSummaryCard
          label="Invoice Total"
          value={`£${(invoice.total + totalTax).toFixed(2)}`}
          sub={anyTax ? `Incl. VAT · Ex-VAT £${invoice.total.toFixed(2)}` : 'Per supplier invoice'}
          variant="default"
        />
        <MatchSummaryCard
          label="VAT"
          value={`£${totalTax.toFixed(2)}`}
          sub="Total VAT on this invoice"
          variant="default"
        />
        <MatchSummaryCard
          label="Variance"
          value={varianceTotal === 0 ? '£0.00' : `${varianceTotal > 0 ? '+' : ''}£${varianceTotal.toFixed(2)}`}
          sub={hasUnmatched ? `${unmatchedLines.length} unmatched items` : varianceTotal === 0 ? 'Matched' : varianceTotal > 0 ? 'Invoice higher' : 'Invoice lower'}
          variant={hasUnmatched ? 'error' : varianceTotal === 0 ? 'success' : 'error'}
        />
        {grns.length > 0 && (
          <MatchSummaryCard
            label="Items Matched"
            value={`${invoice.lines.length - unmatchedLines.length} / ${invoice.lines.length}`}
            sub={hasUnmatched ? `${unmatchedLines.length} unmatched` : 'All items matched'}
            variant={hasUnmatched ? 'warning' : 'default'}
          />
        )}
      </div>

      {/* Shared note — cross-reviewer context */}
      <InvoiceNoteSection
        initialNote={invoice.note ?? ''}
        initialAuthor={invoice.noteAuthor}
        initialUpdatedAt={invoice.noteUpdatedAt}
      />

      {/* PO context — running total when this invoice is one of several against a PO */}
      {splitPOContexts.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '20px' }}>
          {splitPOContexts.map(ctx => (
            <POContextStrip key={ctx.poNumber} ctx={ctx} currentInvoiceId={invoice.id} />
          ))}
        </div>
      )}

      {/* Rules: auto-accepted variances */}
      {autoAppliedVariances.length > 0 && (
        <AutoAppliedBanner variances={autoAppliedVariances} />
      )}

      {/* Rules: AI pattern suggestion */}
      {aiSuggestion && (
        <AISuggestionBanner
          suggestion={aiSuggestion}
          onDismiss={() => setDismissAISuggestion(true)}
        />
      )}

      {/* Awaiting delivery — no GRN linked yet */}
      {awaitingDelivery && (
        <AwaitingDeliveryBanner invoice={invoice} />
      )}

      {/* Duplicate detection — invoice references a PO that may already be closed */}
      {isDuplicate && (
        <DuplicateInvoiceBanner invoice={invoice} overridden={overrideDuplicate} onOverride={() => setOverrideDuplicate(true)} />
      )}

      {/* Unmatched items alert + suggest GRN */}
      {canSuggest && suggestedGRN && (
        <SuggestGRNBanner
          unmatchedLines={unmatchedLines}
          suggestedGRN={suggestedGRN}
          onLink={() => handleLinkGRN(suggestedGRN.grnNumber)}
        />
      )}

      {hasUnmatched && !canSuggest && (
        <div style={{ padding: '14px 18px', borderRadius: '12px', background: 'var(--color-error-light)', border: '1px solid var(--color-error-border)', marginBottom: '20px', fontSize: '13px', color: 'var(--color-error)', fontWeight: 600 }}>
          {unmatchedLines.length} invoice item{unmatchedLines.length > 1 ? 's' : ''} could not be matched to any linked GRN. Manual review required.
        </div>
      )}

      {/* Linked GRN success banner */}
      {linkedGRNs.length > 0 && !hasUnmatched && (
        <div style={{ padding: '14px 18px', borderRadius: '12px', background: 'var(--color-success-light)', border: '1px solid var(--color-success-border)', marginBottom: '20px', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span style={{ fontSize: '18px' }}>✓</span>
          <div>
            <div style={{ fontWeight: 700, color: 'var(--color-success)' }}>All items now matched across {grns.length} GRNs</div>
            <div style={{ color: 'var(--color-success)', marginTop: '2px' }}>
              {grns.map(g => g.grnNumber).join(' + ')} — {invoice.lines.length} line items fully covered
            </div>
          </div>
        </div>
      )}

      {/* Split view — variance resolution is inline within the table */}
      <SplitView invoice={invoice} grns={grns} unmatchedLines={unmatchedLines} resolutions={resolutions} onResolve={setRes} lineTaxRates={lineTaxRates} setLineRate={setLineRate} totalTax={totalTax} anyTax={anyTax} />

      {/* Variance status banner */}
      {invoice.variances.length > 0 && !hasUnmatched && (
        <div style={{ marginTop: '16px' }}>
          {allResolved ? (
            <div style={{ padding: '12px 16px', borderRadius: '12px', background: 'var(--color-success-light)', border: '1px solid var(--color-success-border)', fontSize: '13px', fontWeight: 600, color: 'var(--color-success)' }}>
              All variances resolved. Ready for approval.
            </div>
          ) : (
            <div style={{ padding: '12px 16px', borderRadius: '12px', background: 'var(--color-warning-light)', border: '1px solid var(--color-warning-border)', fontSize: '13px', fontWeight: 500, color: 'var(--color-warning)', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontWeight: 700 }}>{invoice.variances.filter(resolvedOrAuto).length} of {invoice.variances.length} variances resolved{autoAppliedIds.size > 0 ? ` (${autoAppliedIds.size} auto ✨)` : ''}</span>
              <span>— click ⚠ on any highlighted row to resolve.</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ──────────── PO Context Strip ──────────── */

function POContextStrip({ ctx, currentInvoiceId }: { ctx: POContextForInvoice; currentInvoiceId: string }) {
  const priorPercent = ctx.poAmount > 0 ? Math.min(100, (ctx.priorInvoicedAmount / ctx.poAmount) * 100) : 0;
  const thisPercent = ctx.poAmount > 0 ? Math.min(100 - priorPercent, (ctx.thisInvoiceAmount / ctx.poAmount) * 100) : 0;
  const afterPct = Math.round((ctx.afterThisAmount / Math.max(ctx.poAmount, 0.01)) * 100);

  const implicationColor = ctx.overInvoiceIfApproved ? 'var(--color-error)' :
    ctx.closesIfApproved ? 'var(--color-success)' :
    'var(--color-info)';
  const implicationText = ctx.overInvoiceIfApproved
    ? `Over-invoices PO by £${ctx.overBy.toFixed(2)} — resolve before approving.`
    : ctx.closesIfApproved
      ? `Approving closes ${ctx.poNumber} — fully invoiced.`
      : `${ctx.poNumber} stays open: £${(ctx.poAmount - ctx.afterThisAmount).toFixed(2)} remaining after this invoice.`;

  return (
    <div style={{
      padding: '16px 18px',
      borderRadius: '12px',
      background: 'var(--color-info-light)',
      border: '1px solid rgba(3, 105, 161, 0.2)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap', marginBottom: '10px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '16px' }}>🧾</span>
          <span style={{ fontWeight: 700, fontSize: '14px', color: 'var(--color-info)' }}>
            {ctx.poNumber} · invoice {ctx.invoiceIndex} of {ctx.totalInvoices}
          </span>
        </div>
        <a
          href={`/purchase-orders/${ctx.poId}`}
          style={{
            padding: '6px 14px',
            borderRadius: '6px',
            background: '#fff',
            border: '1px solid rgba(3, 105, 161, 0.25)',
            fontSize: '12px', fontWeight: 600,
            fontFamily: 'var(--font-primary)',
            color: 'var(--color-info)',
            textDecoration: 'none',
            whiteSpace: 'nowrap',
          }}
        >
          View PO →
        </a>
      </div>

      <div style={{ display: 'flex', alignItems: 'baseline', gap: '10px', flexWrap: 'wrap' }}>
        <span style={{ fontSize: '18px', fontWeight: 700, color: 'var(--color-text-primary)' }}>
          £{ctx.afterThisAmount.toFixed(2)}
        </span>
        <span style={{ fontSize: '13px', fontWeight: 500, color: 'var(--color-text-secondary)' }}>
          of £{ctx.poAmount.toFixed(2)} after approval ({afterPct}%)
        </span>
      </div>

      <div style={{ marginTop: '8px', height: '8px', borderRadius: '999px', background: 'rgba(3, 105, 161, 0.1)', overflow: 'hidden', display: 'flex' }}>
        <div style={{ width: `${priorPercent}%`, background: 'var(--color-info)', opacity: 0.55 }} />
        <div style={{ width: `${thisPercent}%`, background: 'var(--color-info)' }} />
        {afterPct > 100 && <div style={{ flex: 1, background: 'var(--color-error)', opacity: 0.6 }} />}
      </div>

      {ctx.priorInvoices.length > 0 && (
        <div style={{ marginTop: '10px', fontSize: '12px', fontWeight: 500, color: 'var(--color-text-secondary)' }}>
          Prior: {ctx.priorInvoices.map(p => (
            <a
              key={p.id}
              href={`/invoices/match?id=${p.id}`}
              style={{ color: 'var(--color-info)', textDecoration: 'none', fontWeight: 600, marginRight: '6px' }}
            >
              {p.invoiceNumber} (£{applicationTotalForInvoiceOnPO(ctx, p.id).toFixed(2)})
            </a>
          ))}
        </div>
      )}

      {ctx.laterInvoices.length > 0 && (
        <div style={{ marginTop: '4px', fontSize: '12px', fontWeight: 500, color: 'var(--color-text-secondary)' }}>
          Later: {ctx.laterInvoices.map(l => (
            <a
              key={l.id}
              href={`/invoices/match?id=${l.id}`}
              style={{ color: 'var(--color-info)', textDecoration: 'none', fontWeight: 600, marginRight: '6px' }}
            >
              {l.invoiceNumber} (£{applicationTotalForInvoiceOnPO(ctx, l.id).toFixed(2)})
            </a>
          ))}
        </div>
      )}

      <div style={{ marginTop: '10px', fontSize: '13px', fontWeight: 600, color: implicationColor }}>
        {implicationText}
      </div>
    </div>
  );
}

function applicationTotalForInvoiceOnPO(ctx: POContextForInvoice, invoiceId: string): number {
  const inv = ctx.allInvoices.find(i => i.id === invoiceId);
  if (!inv) return 0;
  return inv.total;
}

/* ──────────── Rules banners + chip ──────────── */

function AutoAppliedBanner({ variances }: { variances: MatchVariance[] }) {
  const entries = variances
    .map(v => ({ variance: v, meta: AUTO_APPLIED_VARIANCES[v.id] }))
    .filter((x): x is { variance: MatchVariance; meta: { ruleId: string; note: string } } => !!x.meta);
  return (
    <div style={{
      padding: '14px 18px',
      borderRadius: '12px',
      background: 'var(--color-success-light)',
      border: '1px solid var(--color-success-border)',
      marginBottom: '20px',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
        <span style={{ fontSize: '16px' }}>✨</span>
        <span style={{ fontWeight: 700, fontSize: '14px', color: 'var(--color-success)' }}>
          {entries.length} variance{entries.length === 1 ? '' : 's'} auto-accepted by rules
        </span>
        <div style={{ flex: 1 }} />
        <Link
          href="/invoices/settings"
          style={{
            fontSize: '12px', fontWeight: 600, color: 'var(--color-success)',
            textDecoration: 'none', whiteSpace: 'nowrap',
          }}
        >
          See rules →
        </Link>
      </div>
      <ul style={{ margin: 0, padding: '0 0 0 24px', fontSize: '13px', color: 'var(--color-text-primary)', lineHeight: 1.6 }}>
        {entries.map(e => (
          <li key={e.variance.id}>{e.meta.note}</li>
        ))}
      </ul>
    </div>
  );
}

function AutoAppliedChip() {
  return (
    <span
      title="Auto-accepted by rule. Click 'See rules' in the banner above to view."
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '4px',
        padding: '3px 9px',
        borderRadius: '100px',
        fontSize: '11px',
        fontWeight: 700,
        background: 'var(--color-success-light)',
        color: 'var(--color-success)',
        border: '1px solid var(--color-success-border)',
        whiteSpace: 'nowrap',
      }}
    >
      ✨ auto
    </span>
  );
}

function AISuggestionBanner({ suggestion, onDismiss }: { suggestion: ReturnType<typeof getAISuggestion> & {}; onDismiss: () => void }) {
  if (!suggestion) return null;
  return (
    <div style={{
      padding: '16px 18px',
      borderRadius: '12px',
      background: 'linear-gradient(135deg, rgba(34, 68, 68, 0.05), rgba(3, 105, 161, 0.05))',
      border: '1px solid rgba(34, 68, 68, 0.2)',
      marginBottom: '20px',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
        <span style={{ fontSize: '16px' }}>✨</span>
        <span style={{ fontWeight: 700, fontSize: '14px', color: 'var(--color-accent-deep)' }}>
          {suggestion.title}
        </span>
        <div style={{ flex: 1 }} />
        <button
          onClick={onDismiss}
          aria-label="Dismiss"
          style={{
            background: 'transparent', border: 'none', cursor: 'pointer',
            color: 'var(--color-text-secondary)', fontSize: '16px', lineHeight: 1,
          }}
        >
          ×
        </button>
      </div>
      <p style={{ fontSize: '13px', color: 'var(--color-text-primary)', margin: '0 0 12px', lineHeight: 1.5 }}>
        {suggestion.body}
      </p>
      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
        <button
          onClick={onDismiss}
          style={{
            padding: '7px 14px',
            borderRadius: '8px',
            background: 'var(--color-accent-active)',
            color: '#fff',
            border: 'none',
            fontSize: '12px',
            fontWeight: 700,
            fontFamily: 'var(--font-primary)',
            cursor: 'pointer',
          }}
        >
          Update catalogue
        </button>
        <button
          onClick={onDismiss}
          style={{
            padding: '7px 14px',
            borderRadius: '8px',
            background: '#fff',
            border: '1px solid var(--color-border)',
            fontSize: '12px',
            fontWeight: 600,
            fontFamily: 'var(--font-primary)',
            color: 'var(--color-text-primary)',
            cursor: 'pointer',
          }}
        >
          Keep prompting
        </button>
        <Link
          href="/invoices/settings"
          style={{
            padding: '7px 14px',
            borderRadius: '8px',
            background: 'transparent',
            border: '1px solid var(--color-border)',
            fontSize: '12px',
            fontWeight: 600,
            fontFamily: 'var(--font-primary)',
            color: 'var(--color-text-primary)',
            textDecoration: 'none',
            cursor: 'pointer',
          }}
        >
          Create a rule…
        </Link>
      </div>
    </div>
  );
}

/* ──────────── Awaiting Delivery Banner ──────────── */

function AwaitingDeliveryBanner({ invoice }: { invoice: Invoice }) {
  const [parked, setParked] = useState(invoice.parked ?? false);
  const poHint = invoice.poNumbers && invoice.poNumbers.length > 0 ? invoice.poNumbers.join(', ') : null;
  return (
    <div style={{
      padding: '18px 20px',
      borderRadius: '12px',
      background: 'var(--color-warning-light)',
      border: '1px solid var(--color-warning-border)',
      marginBottom: '20px',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
        <span style={{ fontSize: '16px' }}>⏳</span>
        <span style={{ fontWeight: 700, fontSize: '14px', color: 'var(--color-warning)' }}>
          {parked ? 'Parked — awaiting delivery' : 'No delivery received yet'}
        </span>
      </div>
      <p style={{ fontSize: '13px', color: 'var(--color-text-primary)', margin: '0 0 12px', lineHeight: 1.5 }}>
        {parked
          ? `${invoice.supplier} invoice ${invoice.invoiceNumber} is parked. It will surface automatically when a matching GRN${poHint ? ` for ${poHint}` : ''} is logged.`
          : `${invoice.supplier} has billed for ${poHint ?? 'a PO'} but no goods have been received against it yet. Three-way match is blocked until a GRN exists.`}
      </p>
      {!parked && (
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <button
            onClick={() => setParked(true)}
            style={{
              padding: '8px 16px',
              borderRadius: '8px',
              background: 'var(--color-accent-active)',
              color: '#fff',
              border: 'none',
              fontSize: '12px', fontWeight: 600,
              fontFamily: 'var(--font-primary)',
              cursor: 'pointer',
            }}
          >
            Park until delivery
          </button>
          <button
            disabled
            title="Manual GRN link not available in prototype"
            style={{
              padding: '8px 16px',
              borderRadius: '8px',
              background: '#fff',
              border: '1px solid var(--color-border)',
              fontSize: '12px', fontWeight: 600,
              fontFamily: 'var(--font-primary)',
              color: 'var(--color-text-secondary)',
              cursor: 'not-allowed',
              opacity: 0.7,
            }}
          >
            Link GRN manually…
          </button>
        </div>
      )}
    </div>
  );
}

/* ──────────── Duplicate Invoice Banner ──────────── */

function DuplicateInvoiceBanner({ invoice, overridden, onOverride }: { invoice: Invoice; overridden: boolean; onOverride: () => void }) {
  const siblings = MOCK_INVOICES.filter(i => i.id !== invoice.id && i.invoiceNumber === invoice.invoiceNumber);
  return (
    <div style={{
      padding: '18px 20px',
      borderRadius: '12px',
      background: 'var(--color-error-light)',
      border: '1px solid var(--color-error-border)',
      marginBottom: '20px',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
        <span style={{ fontSize: '16px' }}>⚠️</span>
        <span style={{ fontWeight: 700, fontSize: '14px', color: 'var(--color-error)' }}>
          Possible duplicate — PO already fully invoiced
        </span>
      </div>
      <p style={{ fontSize: '13px', color: 'var(--color-text-primary)', margin: '0 0 12px', lineHeight: 1.5 }}>
        {siblings.length > 0
          ? <>A previous invoice with the same number (<strong>{invoice.invoiceNumber}</strong>) has already been processed. Verify with {invoice.supplier} before re-opening the PO.</>
          : <>This invoice references a PO that is already closed or fully invoiced. Verify with {invoice.supplier} before proceeding.</>}
      </p>
      <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
        {overridden ? (
          <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--color-warning)' }}>
            ✓ Marked not-a-duplicate — PO would re-open on approval
          </span>
        ) : (
          <>
            <button
              onClick={onOverride}
              style={{
                padding: '8px 16px',
                borderRadius: '8px',
                background: '#fff',
                border: '1px solid var(--color-error-border)',
                fontSize: '12px', fontWeight: 600,
                fontFamily: 'var(--font-primary)',
                color: 'var(--color-error)',
                cursor: 'pointer',
              }}
            >
              Not a duplicate · re-open PO
            </button>
            <button
              disabled
              title="Reject action not wired in prototype"
              style={{
                padding: '8px 16px',
                borderRadius: '8px',
                background: 'transparent',
                border: '1px solid var(--color-border)',
                fontSize: '12px', fontWeight: 600,
                fontFamily: 'var(--font-primary)',
                color: 'var(--color-text-secondary)',
                cursor: 'not-allowed',
                opacity: 0.7,
              }}
            >
              Reject invoice
            </button>
          </>
        )}
      </div>
    </div>
  );
}

/* ──────────── Suggest GRN Banner ──────────── */

function SuggestGRNBanner({ unmatchedLines, suggestedGRN, onLink }: { unmatchedLines: { description: string; sku: string }[]; suggestedGRN: GRN; onLink: () => void }) {
  return (
    <div style={{
      padding: '18px 20px',
      borderRadius: '12px',
      background: 'var(--color-info-light)',
      border: '1px solid rgba(3, 105, 161, 0.2)',
      marginBottom: '20px',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '16px', flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: '200px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
            <span style={{ fontSize: '16px' }}>💡</span>
            <span style={{ fontWeight: 700, fontSize: '14px', color: 'var(--color-info)' }}>
              {unmatchedLines.length} item{unmatchedLines.length > 1 ? 's' : ''} not found in linked Goods Received Notice (GRN)
            </span>
          </div>
          <p style={{ fontSize: '13px', color: 'var(--color-text-primary)', margin: '0 0 10px', lineHeight: 1.5 }}>
            This invoice covers items from two separate deliveries. We found a matching GRN for the remaining items:
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginBottom: '12px' }}>
            {unmatchedLines.map(line => (
              <div key={line.sku} style={{ fontSize: '12px', fontWeight: 500, color: 'var(--color-text-secondary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ color: 'var(--color-error)', fontWeight: 700 }}>✕</span>
                {line.description} <span style={{ opacity: 0.6 }}>({line.sku})</span>
              </div>
            ))}
          </div>
          <div style={{
            padding: '10px 14px',
            borderRadius: '8px',
            background: '#fff',
            border: '1px solid rgba(3, 105, 161, 0.15)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '12px',
            flexWrap: 'wrap',
          }}>
            <div>
              <div style={{ fontWeight: 700, fontSize: '13px', color: 'var(--color-text-primary)' }}>
                {suggestedGRN.grnNumber}
              </div>
              <div style={{ fontSize: '12px', fontWeight: 500, color: 'var(--color-text-secondary)', marginTop: '2px' }}>
                {suggestedGRN.supplier} · Received {suggestedGRN.dateReceived} · {suggestedGRN.lines.length} items · PO {suggestedGRN.poNumbers.join(', ')}
              </div>
            </div>
            <button
              onClick={onLink}
              style={{
                padding: '8px 18px',
                borderRadius: '8px',
                background: 'var(--color-accent-active)',
                color: '#fff',
                border: 'none',
                fontSize: '12px', fontWeight: 500,
                fontFamily: 'var(--font-primary)',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
              }}
            >
              Link {suggestedGRN.grnNumber}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ──────────── Invoice Note Section ──────────── */

function InvoiceNoteSection({ initialNote, initialAuthor, initialUpdatedAt }: {
  initialNote: string;
  initialAuthor?: string;
  initialUpdatedAt?: string;
}) {
  const [note, setNote] = useState(initialNote);
  const [author, setAuthor] = useState(initialAuthor);
  const [updatedAt, setUpdatedAt] = useState(initialUpdatedAt);
  const [isExpanded, setIsExpanded] = useState(initialNote.length > 0);
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState(initialNote);

  const hasNote = note.trim().length > 0;
  const preview = note.length > 60 ? note.slice(0, 60) + '…' : note;

  const startEdit = () => {
    setDraft(note);
    setIsEditing(true);
    setIsExpanded(true);
  };

  const save = () => {
    const trimmed = draft.trim();
    setNote(trimmed);
    if (trimmed.length > 0) {
      setAuthor('You');
      setUpdatedAt('Just now');
    } else {
      setAuthor(undefined);
      setUpdatedAt(undefined);
    }
    setIsEditing(false);
  };

  const cancel = () => {
    setDraft(note);
    setIsEditing(false);
  };

  return (
    <div style={{
      borderRadius: '12px',
      background: '#fff',
      border: '1px solid var(--color-border-subtle)',
      marginBottom: '20px',
      overflow: 'hidden',
    }}>
      {/* Header / collapsed row */}
      <button
        onClick={() => setIsExpanded(v => !v)}
        style={{
          width: '100%',
          padding: '12px 16px',
          background: 'none',
          border: 'none',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '12px',
          cursor: 'pointer',
          fontFamily: 'var(--font-primary)',
          textAlign: 'left',
        }}
        aria-expanded={isExpanded}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0, flex: 1 }}>
          <span style={{ fontSize: '16px' }}>📝</span>
          <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--color-text-primary)' }}>
            Note
          </span>
          {!isExpanded && (
            <span style={{
              fontSize: '12px',
              fontWeight: 500,
              color: hasNote ? 'var(--color-text-secondary)' : 'var(--color-text-muted)',
              fontStyle: hasNote ? 'normal' : 'italic',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              minWidth: 0,
            }}>
              {hasNote ? preview : 'Add a note'}
            </span>
          )}
        </div>
        <span style={{
          fontSize: '12px',
          color: 'var(--color-text-muted)',
          transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
          transition: 'transform 0.15s',
          display: 'inline-block',
        }}>
          ▾
        </span>
      </button>

      {/* Expanded body */}
      {isExpanded && (
        <div style={{ padding: '0 16px 16px', borderTop: '1px solid var(--color-border-subtle)' }}>
          {isEditing ? (
            <div style={{ paddingTop: '12px' }}>
              <textarea
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder="e.g. Waiting on supplier credit note — don't approve yet."
                rows={3}
                autoFocus
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  borderRadius: '8px',
                  border: '1px solid var(--color-border)',
                  fontSize: '13px',
                  fontFamily: 'var(--font-primary)',
                  resize: 'vertical',
                  boxSizing: 'border-box',
                  outline: 'none',
                  color: 'var(--color-text-primary)',
                }}
              />
              <div style={{ display: 'flex', gap: '8px', marginTop: '10px', justifyContent: 'flex-end' }}>
                <button
                  onClick={cancel}
                  style={{
                    padding: '7px 14px',
                    borderRadius: '6px',
                    background: 'var(--color-bg-hover)',
                    border: '1px solid var(--color-border)',
                    fontSize: '12px',
                    fontWeight: 600,
                    fontFamily: 'var(--font-primary)',
                    color: 'var(--color-text-primary)',
                    cursor: 'pointer',
                  }}
                >
                  Cancel
                </button>
                <button
                  onClick={save}
                  style={{
                    padding: '7px 14px',
                    borderRadius: '6px',
                    background: 'var(--color-accent-active)',
                    border: 'none',
                    fontSize: '12px',
                    fontWeight: 700,
                    fontFamily: 'var(--font-primary)',
                    color: '#fff',
                    cursor: 'pointer',
                  }}
                >
                  Save
                </button>
              </div>
            </div>
          ) : (
            <div style={{ paddingTop: '12px' }}>
              {hasNote ? (
                <>
                  <p style={{
                    margin: 0,
                    fontSize: '13px',
                    lineHeight: 1.5,
                    color: 'var(--color-text-primary)',
                    whiteSpace: 'pre-wrap',
                  }}>
                    {note}
                  </p>
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '12px',
                    marginTop: '10px',
                    flexWrap: 'wrap',
                  }}>
                    <span style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>
                      {author && updatedAt
                        ? `Last edited by ${author}, ${updatedAt}`
                        : author
                          ? `Last edited by ${author}`
                          : updatedAt
                            ? `Last edited ${updatedAt}`
                            : ''}
                    </span>
                    <button
                      onClick={startEdit}
                      style={{
                        padding: '6px 12px',
                        borderRadius: '6px',
                        background: 'var(--color-bg-hover)',
                        border: '1px solid var(--color-border)',
                        fontSize: '12px',
                        fontWeight: 600,
                        fontFamily: 'var(--font-primary)',
                        color: 'var(--color-text-primary)',
                        cursor: 'pointer',
                      }}
                    >
                      Edit note
                    </button>
                  </div>
                </>
              ) : (
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '12px',
                  flexWrap: 'wrap',
                }}>
                  <p style={{
                    margin: 0,
                    fontSize: '13px',
                    color: 'var(--color-text-secondary)',
                    fontStyle: 'italic',
                  }}>
                    No note yet. Leave context for anyone else reviewing this invoice.
                  </p>
                  <button
                    onClick={startEdit}
                    style={{
                      padding: '7px 14px',
                      borderRadius: '6px',
                      background: 'var(--color-accent-active)',
                      border: 'none',
                      fontSize: '12px',
                      fontWeight: 700,
                      fontFamily: 'var(--font-primary)',
                      color: '#fff',
                      cursor: 'pointer',
                    }}
                  >
                    Add a note
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ──────────── Split View ──────────── */

function SplitView({ invoice, grns, unmatchedLines, resolutions, onResolve, lineTaxRates, setLineRate, totalTax, anyTax }: {
  invoice: Invoice;
  grns: GRN[];
  unmatchedLines: { description: string; sku: string; qty: number; unitPrice: number; lineTotal: number }[];
  resolutions: Record<string, AnyResolution>;
  onResolve: (varianceId: string, res: AnyResolution | null) => void;
  lineTaxRates: Record<string, number>;
  setLineRate: (lineId: string, rate: number) => void;
  totalTax: number;
  anyTax: boolean;
}) {
  const [rightTab, setRightTab] = useState<'grn' | 'po'>('grn');
  const [expandedVariance, setExpandedVariance] = useState<string | null>(null);

  const grnGroups = grns.map(grn => {
    const lines = grn.lines.map(gl => ({
      id: gl.id,
      description: gl.name,
      sku: gl.sku,
      orderedQty: gl.expectedQty,
      receivedQty: gl.receivedQty,
      unitPrice: gl.price,
      lineTotal: gl.receivedQty * gl.price,
      matched: !invoice.variances.some(v => v.sku === gl.sku),
    }));
    const pos = MOCK_POS.filter(p => grn.poNumbers.includes(p.poNumber));
    return { grn, lines, pos };
  });

  const multiGroup = grns.length > 1;
  const matchedSkus = new Set(grnGroups.flatMap(g => g.lines.map(l => l.sku)));
  const unmatchedInvRows = invoice.lines.filter(il => !matchedSkus.has(il.sku));

  const allGrnTotal = grnGroups.reduce((s, g) => s + g.lines.reduce((ss, l) => ss + l.lineTotal, 0), 0);
  const allPoTotal = grnGroups.reduce((s, g) => s + g.pos.reduce((ss, p) => ss + p.lines.reduce((sss, l) => sss + l.price * l.expectedQty, 0), 0), 0);

  // right column count differs by tab
  const RC = rightTab === 'grn' ? 6 : 5;

  const cell: React.CSSProperties = { padding: '8px 12px', borderBottom: '1px solid var(--color-border-subtle)', fontSize: '12px' };
  const divider: React.CSSProperties = { borderRight: '2px solid var(--color-border)' };
  const colLabelStyle: React.CSSProperties = {
    textAlign: 'center', padding: '8px 12px', fontWeight: 600, fontSize: '11px',
    textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--color-text-secondary)',
    borderBottom: '1px solid var(--color-border-subtle)', whiteSpace: 'nowrap',
    background: 'var(--color-bg-subtle, #fafafa)',
  };

  const TaxSelect = ({ lineId, sku }: { lineId: string; sku: string }) => {
    const category = categorizeSku(sku);
    const isUncategorized = category === 'unknown';
    const hasRate = lineId in lineTaxRates;
    const rate = lineTaxRates[lineId] ?? 0;
    const needsPrompt = isUncategorized && !hasRate;
    return (
      <select
        value={hasRate ? rate : ''}
        onChange={e => setLineRate(lineId, Number(e.target.value))}
        title={needsPrompt ? 'Set VAT — this line is not auto-categorised' : vatCategoryLabel(category)}
        style={{
          fontSize: '11px', fontFamily: 'var(--font-primary)',
          border: needsPrompt ? '1.5px solid var(--color-warning)' : '1px solid var(--color-border)',
          borderRadius: '4px',
          padding: '2px 4px',
          background: needsPrompt ? 'var(--color-warning-light)' : '#fff',
          color: needsPrompt ? 'var(--color-warning)' : 'var(--color-text-primary)',
          fontWeight: needsPrompt ? 700 : 400,
          cursor: 'pointer', outline: 'none',
        }}
      >
        {needsPrompt && <option value="" disabled>Set VAT…</option>}
        <option value={0}>0%</option>
        <option value={5}>5%</option>
        <option value={20}>20%</option>
      </select>
    );
  };

  const Chevron = ({ open }: { open: boolean }) => (
    <svg width="10" height="6" viewBox="0 0 10 6" fill="none" style={{ transition: 'transform 0.15s', transform: open ? 'rotate(180deg)' : 'none', flexShrink: 0 }}>
      <path d="M1 1L5 5L9 1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );

  const VarBadge = ({ varianceId, label }: { varianceId: string; label: string }) => {
    const resolution = resolutions[varianceId];
    const isOpen = expandedVariance === varianceId;
    const toggle = () => setExpandedVariance(isOpen ? null : varianceId);

    if (resolution) {
      const resolvedLabel = resolution === 'Accept & Update Cost in Edify' ? 'Price Updated'
        : resolution === 'Accept for this delivery' ? 'Accepted'
        : resolution === 'Dispute → Credit Note' ? 'Disputed'
        : resolution === 'Credit Note' ? 'Credit Note'
        : resolution === 'Accept Short' ? 'Short Accepted'
        : 'Resolved';
      return (
        <button onClick={toggle} title="Click to change resolution" style={{
          display: 'inline-flex', alignItems: 'center', gap: '6px',
          padding: '4px 12px', borderRadius: '6px',
          border: '1.5px solid var(--color-success)',
          background: 'rgba(16, 185, 129, 0.08)',
          color: 'var(--color-success)', fontWeight: 700, fontSize: '12px',
          fontFamily: 'var(--font-primary)', cursor: 'pointer', lineHeight: 1.3,
        }}>
          {resolvedLabel}<Chevron open={isOpen} />
        </button>
      );
    }

    return (
      <button onClick={toggle} title="Click to resolve" style={{
        display: 'inline-flex', alignItems: 'center', gap: '6px',
        padding: '4px 12px', borderRadius: '6px',
        border: '1.5px solid var(--color-warning)',
        background: isOpen ? 'rgba(217, 119, 6, 0.14)' : 'rgba(217, 119, 6, 0.08)',
        color: 'var(--color-warning)', fontWeight: 700, fontSize: '12px',
        fontFamily: 'var(--font-primary)', cursor: 'pointer', lineHeight: 1.3,
      }}>
        {label}<Chevron open={isOpen} />
      </button>
    );
  };

  return (
    <>
      <style>{`
        .split-tab-toggle { display: inline-flex; border: 1px solid var(--color-border); border-radius: 6px; overflow: hidden; flex-shrink: 0; }
        .split-tab-toggle button { padding: 3px 10px; font-size: 12px; font-weight: 600; font-family: var(--font-primary); border: none; background: transparent; color: var(--color-text-secondary); cursor: pointer; transition: background 0.12s, color 0.12s; white-space: nowrap; }
        .split-tab-toggle button.active { background: var(--color-text-primary); color: #fff; }
        .split-tab-toggle button:not(.active):hover { background: var(--color-bg-subtle, #f5f5f5); }
        @keyframes expandSlide {
          from { grid-template-rows: 0fr; }
          to   { grid-template-rows: 1fr; }
        }
        .expand-row-outer {
          display: grid;
          animation: expandSlide 0.32s ease-out;
          animation-fill-mode: forwards;
        }
        .expand-row-content { overflow: hidden; min-height: 0; }
      `}</style>

      <div style={{ border: '1px solid var(--color-border-subtle)', borderRadius: '10px', overflow: 'hidden', background: '#fff', fontFamily: 'var(--font-primary)' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', fontWeight: 500 }}>

          {/* ── Panel headers ── */}
          <thead>
            <tr>
              {/* Invoice panel header */}
              <td colSpan={6} style={{ padding: '14px 16px', borderBottom: '1px solid var(--color-border-subtle)', ...divider }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: '14px', color: 'var(--color-text-primary)' }}>Supplier Invoice</div>
                    <div style={{ fontSize: '12px', fontWeight: 500, color: 'var(--color-text-secondary)', marginTop: '2px' }}>{invoice.invoiceNumber} · {invoice.date}</div>
                  </div>
                  <button style={{ padding: '5px 12px', borderRadius: '6px', background: 'transparent', border: '1px solid var(--color-border)', fontSize: '12px', fontWeight: 600, fontFamily: 'var(--font-primary)', color: 'var(--color-text-secondary)', cursor: 'pointer' }}>
                    View PDF
                  </button>
                </div>
              </td>
              {/* GRN/PO panel header */}
              <td colSpan={RC} style={{ padding: '14px 16px', borderBottom: '1px solid var(--color-border-subtle)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px' }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: '14px', color: 'var(--color-text-primary)' }}>
                      {rightTab === 'grn' ? (grns.length > 1 ? `${grns.length} GRNs` : 'GRN') : 'PO Prices'}
                    </div>
                    <div style={{ fontSize: '12px', fontWeight: 500, color: 'var(--color-text-secondary)', marginTop: '2px' }}>
                      {rightTab === 'grn'
                        ? (grns.length > 0 ? grns.map((g, i) => <span key={g.id}>{i > 0 && ' + '}{g.grnNumber} · {g.dateReceived}</span>) : 'No linked GRN')
                        : (grnGroups.some(g => g.pos.length > 0)
                            ? grnGroups.filter(g => g.pos.length > 0).map((g, i) => <span key={g.grn.id}>{i > 0 && ' + '}{g.pos.map(p => p.poNumber).join(', ')} via {g.grn.grnNumber}</span>)
                            : 'No linked PO')
                      }
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                    <div className="split-tab-toggle">
                      <button className={rightTab === 'grn' ? 'active' : ''} onClick={() => setRightTab('grn')}>GRN</button>
                      <button className={rightTab === 'po' ? 'active' : ''} onClick={() => setRightTab('po')}>PO Prices</button>
                    </div>
                  </div>
                </div>
              </td>
            </tr>

            {/* Column labels */}
            <tr>
              <th style={colLabelStyle}>Description</th>
              <th style={colLabelStyle}>Qty</th>
              <th style={colLabelStyle}>Price</th>
              <th style={colLabelStyle}>Total</th>
              <th style={colLabelStyle}>VAT %</th>
              <th style={{ ...colLabelStyle, ...divider }}>VAT £</th>
              {rightTab === 'grn' ? (
                <>
                  <th style={colLabelStyle}>Ordered</th>
                  <th style={colLabelStyle}>Received</th>
                  <th style={colLabelStyle}>Price</th>
                  <th style={colLabelStyle}>Total</th>
                  <th style={colLabelStyle}>VAT £</th>
                  <th style={{ ...colLabelStyle, width: '32px' }}></th>
                </>
              ) : (
                <>
                  <th style={colLabelStyle}>Ordered</th>
                  <th style={colLabelStyle} title="Quantity already invoiced against this PO line by earlier invoices">Prev. inv</th>
                  <th style={colLabelStyle}>PO Price</th>
                  <th style={colLabelStyle}>Total</th>
                  <th style={{ ...colLabelStyle, width: '32px' }}></th>
                </>
              )}
            </tr>
          </thead>

          {/* ── GRN groups ── */}
          {grnGroups.map(({ grn, lines, pos }) => {
            const invGroupSkus = new Set(lines.map(l => l.sku));
            const invGroupTotal = invoice.lines.filter(il => invGroupSkus.has(il.sku)).reduce((s, l) => s + l.lineTotal, 0);
            const grnGroupTotal = lines.reduce((s, l) => s + l.lineTotal, 0);
            const poGroupTotal = pos.reduce((s, p) => s + p.lines.reduce((ss, l) => ss + l.price * l.expectedQty, 0), 0);
            const poLines = pos.flatMap(p => p.lines);

            return (
              <tbody key={grn.id}>
                {/* Group section header (multi-GRN only) */}
                {multiGroup && (
                  <tr>
                    <td colSpan={6} style={{ padding: '8px 12px', background: 'var(--color-bg-subtle, #f9f9f9)', borderTop: '2px solid var(--color-border)', borderBottom: '1px solid var(--color-border-subtle)', ...divider }} />
                    <td colSpan={RC} style={{ padding: '8px 12px', background: 'var(--color-bg-subtle, #f9f9f9)', borderTop: '2px solid var(--color-border)', borderBottom: '1px solid var(--color-border-subtle)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
                        <div>
                          <span style={{ fontWeight: 700, fontSize: '12px', color: 'var(--color-text-primary)' }}>
                            {rightTab === 'grn' ? grn.grnNumber : (pos.length > 0 ? pos.map(p => p.poNumber).join(' + ') : 'No PO')}
                          </span>
                          <span style={{ fontWeight: 500, fontSize: '12px', color: 'var(--color-text-secondary)', marginLeft: '6px' }}>
                            {rightTab === 'grn' ? `Received ${grn.dateReceived} · ${grn.receivedBy}` : `via ${grn.grnNumber}`}
                          </span>
                        </div>
                      </div>
                    </td>
                  </tr>
                )}

                {/* GRN tab rows */}
                {rightTab === 'grn' && lines.flatMap(grnLine => {
                  const invLine = invoice.lines.find(il => il.sku === grnLine.sku);
                  const isShort = grnLine.receivedQty < grnLine.orderedQty;
                  const priceVar = invLine ? invLine.unitPrice !== grnLine.unitPrice : false;
                  const priceDiff = invLine ? invLine.unitPrice - grnLine.unitPrice : 0;
                  const variance = invoice.variances.find(v => v.sku === grnLine.sku);
                  const isExpanded = !!variance && expandedVariance === variance.id;
                  const isResolved = !!variance && !!resolutions[variance.id];
                  const hasVar = (priceVar || variance?.type === 'qty') && !isResolved;
                  const rowBg = hasVar ? 'rgba(217, 119, 6, 0.11)' : 'transparent';
                  const leftAccent: React.CSSProperties = hasVar ? { boxShadow: 'inset 4px 0 0 #D97706' } : {};
                  const qtyDiff = variance?.type === 'qty' ? variance.invoiceValue - variance.grnValue : 0;
                  const varLabel = variance?.type === 'qty'
                    ? `${qtyDiff > 0 ? '+' : ''}${qtyDiff} unit${Math.abs(qtyDiff) !== 1 ? 's' : ''}`
                    : `${priceDiff > 0 ? '+' : ''}£${Math.abs(priceDiff).toFixed(2)} / unit`;

                  const dataRow = (
                    <tr key={grnLine.id} style={{ background: rowBg }}>
                      <td style={{ ...cell, ...leftAccent }}>
                        <div style={{ fontWeight: hasVar ? 600 : 400 }}>{invLine?.description ?? grnLine.description}</div>
                        <div style={{ fontSize: '11px', color: 'var(--color-text-secondary)' }}>{grnLine.sku}</div>
                      </td>
                      <td style={{ ...cell, fontWeight: variance?.type === 'qty' ? 700 : 400, color: variance?.type === 'qty' ? 'var(--color-warning)' : undefined }}>{invLine?.qty ?? '—'}</td>
                      <td style={{ ...cell, fontWeight: priceVar ? 700 : 400, color: priceVar ? 'var(--color-warning)' : undefined }}>
                        {invLine ? `£${invLine.unitPrice.toFixed(2)}` : '—'}
                      </td>
                      <td style={{ ...cell, fontWeight: 600 }}>
                        {invLine ? `£${invLine.lineTotal.toFixed(2)}` : '—'}
                      </td>
                      <td style={{ ...cell }}>
                        {invLine && <TaxSelect lineId={invLine.id} sku={invLine.sku} />}
                      </td>
                      <td style={{ ...cell, ...divider, fontWeight: 600, color: invLine && (lineTaxRates[invLine.id] ?? 0) > 0 ? 'var(--color-text-primary)' : 'var(--color-text-secondary)' }}>
                        {invLine && (lineTaxRates[invLine.id] ?? 0) > 0
                          ? `£${(invLine.lineTotal * (lineTaxRates[invLine.id] ?? 0) / 100).toFixed(2)}`
                          : '—'}
                      </td>
                      <td style={{ ...cell, color: 'var(--color-text-secondary)', textAlign: 'center' }}>{grnLine.orderedQty}</td>
                      <td style={{ ...cell, textAlign: 'center', fontWeight: isShort || variance?.type === 'qty' ? 700 : 600, color: isShort || variance?.type === 'qty' ? 'var(--color-warning)' : undefined }}>
                        {grnLine.receivedQty}
                        {isShort && <span style={{ fontSize: '11px', fontWeight: 400, color: 'var(--color-text-secondary)', marginLeft: '4px' }}>of {grnLine.orderedQty}</span>}
                      </td>
                      <td style={{ ...cell, fontWeight: priceVar ? 700 : 400, color: priceVar ? 'var(--color-warning)' : undefined }}>£{grnLine.unitPrice.toFixed(2)}</td>
                      <td style={{ ...cell, fontWeight: 600 }}>£{grnLine.lineTotal.toFixed(2)}</td>
                      <td style={{ ...cell, color: 'var(--color-text-secondary)', fontWeight: 500 }}>
                        £{(grnLine.lineTotal * (invLine ? (lineTaxRates[invLine.id] ?? 10) : 10) / 100).toFixed(2)}
                      </td>
                      <td style={{ ...cell, padding: '6px 12px', textAlign: 'center' }}>
                        {variance
                          ? getAutoAppliedForVariance(variance.id)
                            ? <AutoAppliedChip />
                            : <VarBadge varianceId={variance.id} label={varLabel} />
                          : <span style={{ color: 'var(--color-success)', fontSize: '13px', fontWeight: 600, opacity: 0.7 }}>✓</span>
                        }
                      </td>
                    </tr>
                  );

                  if (!variance || !isExpanded) return [dataRow];

                  const resolution = resolutions[variance.id] as AnyResolution | undefined;
                  const options = resolutionOptionsFor(variance.type);
                  const vDiff = variance.invoiceValue - variance.poValue;
                  const detail = varianceDetailText(variance);
                  const impactLabel = variance.impact >= 0 ? `+£${variance.impact.toFixed(2)}` : `-£${Math.abs(variance.impact).toFixed(2)}`;

                  const expandBg = isResolved ? 'rgba(16,185,129,0.03)' : 'rgba(217,119,6,0.04)';
                  const expandAccent = isResolved ? 'inset 3px 0 0 var(--color-success)' : 'inset 3px 0 0 var(--color-warning)';

                  const expandRow = (
                    <tr key={`expand-${grnLine.id}`}>
                      <td colSpan={6 + RC} style={{ padding: 0, background: expandBg, borderBottom: '1px solid var(--color-border-subtle)', boxShadow: expandAccent }}>
                        <div className="expand-row-outer">
                        <div className="expand-row-content">
                        <div style={{ padding: '14px 18px', display: 'flex', alignItems: 'flex-start', gap: '16px', flexWrap: 'wrap' }}>
                          <div style={{ flex: '1 1 200px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '5px' }}>
                              <span style={{ fontWeight: 700, fontSize: '13px', color: 'var(--color-text-primary)' }}>{variance.itemName}</span>
                              <VarianceTypeChip type={variance.type} />
                              <span style={{ fontWeight: 700, fontSize: '13px', color: variance.impact >= 0 ? 'var(--color-error)' : 'var(--color-success)' }}>{impactLabel}</span>
                            </div>
                            <div style={{ fontSize: '12px', color: 'var(--color-text-secondary)', fontWeight: 500 }}>{detail}</div>
                          </div>
                          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center', flex: '2 1 280px' }}>
                            {options.map(opt => (
                              <button
                                key={opt}
                                onClick={() => {
                                  const isDeselect = resolution === opt;
                                  onResolve(variance.id, isDeselect ? null : opt as AnyResolution);
                                  if (!isDeselect) setExpandedVariance(null);
                                }}
                                style={{
                                  padding: '6px 16px', borderRadius: '999px',
                                  border: resolution === opt ? '1.5px solid var(--color-accent-active)' : '1px solid var(--color-border)',
                                  background: resolution === opt ? 'rgba(34,68,68,0.08)' : '#fff',
                                  color: resolution === opt ? 'var(--color-accent-active)' : 'var(--color-text-primary)',
                                  fontWeight: resolution === opt ? 700 : 600, fontSize: '12px',
                                  fontFamily: 'var(--font-primary)', cursor: 'pointer',
                                }}
                              >{opt}</button>
                            ))}
                          </div>
                          <button onClick={() => setExpandedVariance(null)} style={{ padding: '4px 6px', background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--color-text-secondary)', fontSize: '15px', lineHeight: 1, alignSelf: 'flex-start', flexShrink: 0 }}>✕</button>
                        </div>
                        </div>
                        </div>
                      </td>
                    </tr>
                  );

                  return [dataRow, expandRow];
                })}

                {/* PO Prices tab rows */}
                {rightTab === 'po' && poLines.flatMap(poLine => {
                  const invLine = invoice.lines.find(il => il.sku === poLine.sku);
                  const priceMatch = invLine ? invLine.unitPrice === poLine.price : true;
                  const priceDiff = invLine ? invLine.unitPrice - poLine.price : 0;
                  const lineTotal = poLine.price * poLine.expectedQty;
                  const variance = invoice.variances.find(v => v.sku === poLine.sku);
                  const isExpanded = !!variance && expandedVariance === variance.id;
                  const isResolved = !!variance && !!resolutions[variance.id];
                  const rowBg = !priceMatch && !isResolved ? 'rgba(217, 119, 6, 0.11)' : 'transparent';
                  const leftAccent: React.CSSProperties = !priceMatch && !isResolved ? { boxShadow: 'inset 4px 0 0 #D97706' } : {};
                  const prior = getPriorInvoicedForInvoiceLine(invoice, poLine.sku);
                  const thisQty = invLine?.qty ?? 0;
                  const coveredAfter = prior.qty + thisQty;
                  const overOnLine = coveredAfter > poLine.expectedQty;

                  const dataRow = (
                    <tr key={poLine.id} style={{ background: rowBg }}>
                      <td style={{ ...cell, ...leftAccent }}>
                        <div style={{ fontWeight: !priceMatch ? 600 : 400 }}>{invLine?.description ?? poLine.name}</div>
                        <div style={{ fontSize: '11px', color: 'var(--color-text-secondary)' }}>{poLine.sku}</div>
                      </td>
                      <td style={cell}>{invLine?.qty ?? '—'}</td>
                      <td style={{ ...cell, fontWeight: !priceMatch ? 700 : 400, color: !priceMatch ? 'var(--color-warning)' : undefined }}>
                        {invLine ? `£${invLine.unitPrice.toFixed(2)}` : '—'}
                      </td>
                      <td style={{ ...cell, fontWeight: 600 }}>
                        {invLine ? `£${invLine.lineTotal.toFixed(2)}` : '—'}
                      </td>
                      <td style={{ ...cell }}>
                        {invLine && <TaxSelect lineId={invLine.id} sku={invLine.sku} />}
                      </td>
                      <td style={{ ...cell, ...divider, fontWeight: 600, color: invLine && (lineTaxRates[invLine.id] ?? 0) > 0 ? 'var(--color-text-primary)' : 'var(--color-text-secondary)' }}>
                        {invLine && (lineTaxRates[invLine.id] ?? 0) > 0
                          ? `£${(invLine.lineTotal * (lineTaxRates[invLine.id] ?? 0) / 100).toFixed(2)}`
                          : '—'}
                      </td>
                      <td style={{ ...cell, color: 'var(--color-text-secondary)' }}>{poLine.expectedQty}</td>
                      <td style={{ ...cell, color: prior.qty > 0 ? 'var(--color-text-primary)' : 'var(--color-text-secondary)', fontWeight: prior.qty > 0 ? 600 : 400 }} title={prior.qty > 0 ? prior.applications.map(a => `${a.invoice.invoiceNumber}: ${a.qty}`).join(' · ') : 'No prior invoices'}>
                        {prior.qty > 0 ? prior.qty : '—'}
                      </td>
                      <td style={{ ...cell, fontWeight: !priceMatch ? 700 : 400, color: !priceMatch ? 'var(--color-warning)' : undefined }}>
                        £{poLine.price.toFixed(2)}
                      </td>
                      <td style={{ ...cell, fontWeight: 600 }}>£{lineTotal.toFixed(2)}</td>
                      <td style={{ ...cell, padding: '6px 12px', textAlign: 'center' }}>
                        {variance
                          ? getAutoAppliedForVariance(variance.id)
                            ? <AutoAppliedChip />
                            : <VarBadge varianceId={variance.id} label={varianceShortLabel(variance, priceDiff)} />
                          : overOnLine
                            ? <span style={{ color: 'var(--color-error)', fontSize: '11px', fontWeight: 700, padding: '2px 7px', borderRadius: '4px', background: 'rgba(185,28,28,0.09)', border: '1px solid rgba(185,28,28,0.3)' }}>Over</span>
                            : <span style={{ color: 'var(--color-success)', fontSize: '13px', fontWeight: 600, opacity: 0.7 }}>✓</span>
                        }
                      </td>
                    </tr>
                  );

                  if (!variance || !isExpanded) return [dataRow];

                  const resolution = resolutions[variance.id] as AnyResolution | undefined;
                  const options = resolutionOptionsFor(variance.type);
                  const vDiff = variance.invoiceValue - variance.poValue;
                  const detail = varianceDetailText(variance);
                  const impactLabel = variance.impact >= 0 ? `+£${variance.impact.toFixed(2)}` : `-£${Math.abs(variance.impact).toFixed(2)}`;

                  const expandBgPo = isResolved ? 'rgba(16,185,129,0.03)' : 'rgba(217,119,6,0.04)';
                  const expandAccentPo = isResolved ? 'inset 3px 0 0 var(--color-success)' : 'inset 3px 0 0 var(--color-warning)';

                  const expandRow = (
                    <tr key={`expand-po-${poLine.id}`}>
                      <td colSpan={6 + RC} style={{ padding: 0, background: expandBgPo, borderBottom: '1px solid var(--color-border-subtle)', boxShadow: expandAccentPo }}>
                        <div className="expand-row-outer">
                        <div className="expand-row-content">
                        <div style={{ padding: '14px 18px', display: 'flex', alignItems: 'flex-start', gap: '16px', flexWrap: 'wrap' }}>
                          <div style={{ flex: '1 1 200px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '5px' }}>
                              <span style={{ fontWeight: 700, fontSize: '13px', color: 'var(--color-text-primary)' }}>{variance.itemName}</span>
                              <VarianceTypeChip type={variance.type} />
                              <span style={{ fontWeight: 700, fontSize: '13px', color: variance.impact >= 0 ? 'var(--color-error)' : 'var(--color-success)' }}>{impactLabel}</span>
                            </div>
                            <div style={{ fontSize: '12px', color: 'var(--color-text-secondary)', fontWeight: 500 }}>{detail}</div>
                          </div>
                          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center', flex: '2 1 280px' }}>
                            {options.map(opt => (
                              <button
                                key={opt}
                                onClick={() => {
                                  const isDeselect = resolution === opt;
                                  onResolve(variance.id, isDeselect ? null : opt as AnyResolution);
                                  if (!isDeselect) setExpandedVariance(null);
                                }}
                                style={{
                                  padding: '6px 16px', borderRadius: '999px',
                                  border: resolution === opt ? '1.5px solid var(--color-accent-active)' : '1px solid var(--color-border)',
                                  background: resolution === opt ? 'rgba(34,68,68,0.08)' : '#fff',
                                  color: resolution === opt ? 'var(--color-accent-active)' : 'var(--color-text-primary)',
                                  fontWeight: resolution === opt ? 700 : 600, fontSize: '12px',
                                  fontFamily: 'var(--font-primary)', cursor: 'pointer',
                                }}
                              >{opt}</button>
                            ))}
                          </div>
                          <button onClick={() => setExpandedVariance(null)} style={{ padding: '4px 6px', background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--color-text-secondary)', fontSize: '15px', lineHeight: 1, alignSelf: 'flex-start', flexShrink: 0 }}>✕</button>
                        </div>
                        </div>
                        </div>
                      </td>
                    </tr>
                  );

                  return [dataRow, expandRow];
                })}

              </tbody>
            );
          })}

          {/* ── Unmatched invoice lines (no GRN) ── */}
          {unmatchedInvRows.length > 0 && (
            <tbody>
              {unmatchedInvRows.map(il => {
                const priceVar = invoice.variances.find(v => v.sku === il.sku && v.type === 'price');
                return (
                  <tr key={il.id} style={{ background: 'rgba(185, 28, 28, 0.05)' }}>
                    <td style={cell}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 600 }}>
                        {il.description}
                        <span style={{ fontSize: '11px', fontWeight: 700, padding: '2px 6px', borderRadius: '4px', background: 'rgba(185, 28, 28, 0.1)', color: 'var(--color-error)', border: '1px solid rgba(185, 28, 28, 0.25)', whiteSpace: 'nowrap', flexShrink: 0 }}>NO GRN</span>
                      </div>
                      <div style={{ fontSize: '11px', color: 'var(--color-text-secondary)' }}>{il.sku}</div>
                    </td>
                    <td style={cell}>{il.qty}</td>
                    <td style={{ ...cell, color: priceVar ? 'var(--color-warning)' : undefined }}>£{il.unitPrice.toFixed(2)}</td>
                    <td style={{ ...cell, fontWeight: 600 }}>£{il.lineTotal.toFixed(2)}</td>
                    <td style={{ ...cell }}>
                      <TaxSelect lineId={il.id} sku={il.sku} />
                    </td>
                    <td style={{ ...cell, ...divider, fontWeight: 600, color: (lineTaxRates[il.id] ?? 0) > 0 ? 'var(--color-text-primary)' : 'var(--color-text-secondary)' }}>
                      {(lineTaxRates[il.id] ?? 0) > 0
                        ? `£${(il.lineTotal * (lineTaxRates[il.id] ?? 0) / 100).toFixed(2)}`
                        : '—'}
                    </td>
                    <td colSpan={RC} style={{ ...cell, color: 'var(--color-text-secondary)', textAlign: 'center' }}>—</td>
                  </tr>
                );
              })}
            </tbody>
          )}

          {/* ── Grand totals ── */}
          <tfoot>
            {/* Subtotal row */}
            <tr style={{ borderTop: '1px solid var(--color-border-subtle)' }}>
              <td colSpan={2} />
              <td style={{ padding: '8px 12px', fontWeight: anyTax ? 500 : 700, textAlign: 'right', color: anyTax ? 'var(--color-text-secondary)' : undefined }}>
                {anyTax ? 'Subtotal' : (multiGroup ? 'Grand Total' : 'Total')}
              </td>
              <td style={{ padding: '8px 12px', fontWeight: anyTax ? 500 : 700, color: anyTax ? 'var(--color-text-secondary)' : undefined }}>
                £{invoice.total.toFixed(2)}
              </td>
              <td />
              <td style={{ padding: '8px 12px', fontWeight: anyTax ? 600 : 400, ...divider, color: anyTax ? 'var(--color-text-primary)' : 'var(--color-text-secondary)' }}>
                {anyTax ? `£${totalTax.toFixed(2)}` : '—'}
              </td>
              {rightTab === 'grn' ? (
                <>
                  <td colSpan={3} />
                  <td style={{ padding: '8px 12px', fontWeight: 700 }}>£{allGrnTotal.toFixed(2)}</td>
                  <td style={{ padding: '8px 12px', fontWeight: 600, color: 'var(--color-text-secondary)' }}>£{(allGrnTotal * 0.10).toFixed(2)}</td>
                  <td />
                </>
              ) : (
                <>
                  <td colSpan={2} />
                  <td style={{ padding: '8px 12px', fontWeight: 700 }}>£{allPoTotal.toFixed(2)}</td>
                  <td />
                </>
              )}
            </tr>
            {/* Grand total row — only shown when VAT applies */}
            {anyTax && (
              <tr style={{ borderTop: '1px solid var(--color-border-subtle)' }}>
                <td colSpan={2} />
                <td style={{ padding: '10px 12px', fontWeight: 700, textAlign: 'right', whiteSpace: 'nowrap' }}>Total (incl. VAT)</td>
                <td colSpan={3} style={{ padding: '10px 12px', fontWeight: 700, ...divider }}>
                  £{(invoice.total + totalTax).toFixed(2)}
                </td>
                <td colSpan={RC} />
              </tr>
            )}
          </tfoot>
        </table>
      </div>
    </>
  );
}

/* ──────────── Variance Card ──────────── */

function VarianceCard({ variance, resolution, onResolve }: { variance: MatchVariance; resolution?: AnyResolution; onResolve: (r: AnyResolution) => void }) {
  const options = resolutionOptionsFor(variance.type);
  const priceDiff = variance.invoiceValue - variance.poValue;
  const detail = varianceDetailText(variance);
  const impactLabel = variance.impact >= 0
    ? `+£${variance.impact.toFixed(2)}`
    : `-£${Math.abs(variance.impact).toFixed(2)}`;

  return (
    <div
      id={`variance-${variance.sku}`}
      style={{
        padding: '14px 16px',
        borderRadius: '10px',
        border: '1px solid var(--color-border-subtle)',
        background: '#fff',
        transition: 'outline 0.1s',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '10px', marginBottom: '10px', flexWrap: 'wrap' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontWeight: 700, fontSize: '14px', color: 'var(--color-text-primary)' }}>{variance.itemName}</span>
            <StatusBadge status={varianceLabel(variance.type)} variant={varianceBadgeVariant(variance.type)} />
          </div>
          <div style={{ fontSize: '12px', fontWeight: 500, color: 'var(--color-text-secondary)', marginTop: '4px' }}>{detail}</div>
        </div>
        <span style={{ fontWeight: 700, fontSize: '14px', color: variance.impact >= 0 ? 'var(--color-error)' : 'var(--color-success)', whiteSpace: 'nowrap' }}>{impactLabel}</span>
      </div>

      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
        {options.map(opt => (
          <button
            key={opt}
            onClick={() => onResolve(opt)}
            style={{
              padding: '8px 16px',
              borderRadius: '8px',
              fontSize: '12px',
              fontWeight: 600,
              fontFamily: 'var(--font-primary)',
              cursor: 'pointer',
              border: resolution === opt ? '1.5px solid var(--color-accent-active)' : '1px solid var(--color-border)',
              background: resolution === opt ? 'rgba(34,68,68,0.08)' : '#fff',
              color: resolution === opt ? 'var(--color-accent-active)' : 'var(--color-text-primary)',
              transition: 'all 0.15s',
            }}
          >
            {opt}
          </button>
        ))}
      </div>

      {resolution === 'Accept & Update Cost in Edify' && variance.type === 'price' && (
        <div style={{ marginTop: '12px', padding: '10px 14px', borderRadius: '8px', background: 'var(--color-info-light)', fontSize: '12px', fontWeight: 500, color: 'var(--color-info)' }}>
          Updates master ingredient cost to £{variance.invoiceValue.toFixed(2)} — cascades to recipe costing and GP%.
        </div>
      )}
      {resolution === 'Accept for this delivery' && variance.type === 'price' && (
        <div style={{ marginTop: '12px', padding: '10px 14px', borderRadius: '8px', background: 'var(--color-success-light)', fontSize: '12px', fontWeight: 500, color: 'var(--color-success)' }}>
          Pays £{variance.invoiceValue.toFixed(2)} for this delivery only. Ingredient cost stays at £{variance.poValue.toFixed(2)}.
        </div>
      )}
    </div>
  );
}

/* ──────────── Match Summary Card ──────────── */

function MatchSummaryCard({ label, value, sub, variant }: { label: string; value: string; sub: string; variant: 'default' | 'success' | 'error' | 'warning' }) {
  const bg = variant === 'error' ? 'var(--color-error-light)' : variant === 'success' ? 'var(--color-success-light)' : variant === 'warning' ? 'var(--color-warning-light)' : '#fff';
  const border = variant === 'error' ? 'var(--color-error-border)' : variant === 'success' ? 'var(--color-success-border)' : variant === 'warning' ? 'var(--color-warning-border)' : 'var(--color-border-subtle)';
  const valueColor = variant === 'error' ? 'var(--color-error)' : variant === 'success' ? 'var(--color-success)' : variant === 'warning' ? 'var(--color-warning)' : 'var(--color-text-primary)';

  return (
    <div style={{ padding: '14px 18px', borderRadius: '10px', background: bg, border: `1px solid ${border}` }}>
      <div style={{ fontSize: '12px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--color-text-secondary)', marginBottom: '6px' }}>{label}</div>
      <div style={{ fontSize: '22px', fontWeight: 700, color: valueColor }}>{value}</div>
      <div style={{ fontSize: '12px', fontWeight: 500, color: 'var(--color-text-secondary)', marginTop: '2px' }}>{sub}</div>
    </div>
  );
}

/* ──────────── Approval Confirmation ──────────── */

function ApprovalConfirmation({ invoice, resolutions, grns, unmatchedLines, poContexts, onBack, onConfirm }: {
  invoice: Invoice;
  resolutions: Record<string, AnyResolution>;
  grns: GRN[];
  unmatchedLines: { description: string; sku: string; qty: number; unitPrice: number; lineTotal: number }[];
  poContexts: POContextForInvoice[];
  onBack: () => void;
  onConfirm: () => void;
}) {
  const creditNotes = invoice.variances.filter(v => {
    const r = resolutions[v.id];
    if (!r) return false;
    return r.includes('Credit Note') || r.includes('Dispute') || r === 'Request credit note';
  });
  const creditTotal = creditNotes.reduce((s, v) => s + Math.abs(v.impact), 0);
  const costUpdates = invoice.variances.filter(v => resolutions[v.id] === 'Accept & Update Cost in Edify');
  const deliveryOnly = invoice.variances.filter(v => resolutions[v.id] === 'Accept for this delivery');

  return (
    <div style={{ fontFamily: 'var(--font-primary)' }}>
      <button
        onClick={onBack}
        style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '13px', fontWeight: 600, color: 'var(--color-accent-deep)', fontFamily: 'var(--font-primary)', marginBottom: '16px' }}
      >
        ← Back to match
      </button>

      <h1 style={{ fontSize: '22px', fontWeight: 700, color: 'var(--color-text-primary)', margin: '0 0 20px' }}>
        Confirm Approval — {invoice.invoiceNumber}
      </h1>

      {/* Resolution Summary */}
      <div style={{ border: '1px solid var(--color-border-subtle)', borderRadius: '10px', background: '#fff', padding: '18px', marginBottom: '16px' }}>
        <h3 style={{ fontSize: '14px', fontWeight: 700, color: 'var(--color-text-primary)', margin: '0 0 14px' }}>Resolution Summary</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {invoice.variances.map(v => {
            const res = resolutions[v.id];
            return (
              <div key={v.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', padding: '10px 14px', borderRadius: '8px', background: 'var(--color-bg-hover)', flexWrap: 'wrap' }}>
                <div>
                  <span style={{ fontWeight: 600, fontSize: '13px', color: 'var(--color-text-primary)' }}>{v.itemName}</span>
                  <span style={{ fontSize: '12px', fontWeight: 500, color: 'var(--color-text-secondary)', marginLeft: '8px' }}>
                    {v.type === 'price' ? `£${v.poValue.toFixed(2)} → £${v.invoiceValue.toFixed(2)}` : `GRN: ${v.grnValue} vs Invoice: ${v.invoiceValue}`}
                  </span>
                </div>
                <StatusBadge status={res ?? 'Unresolved'} variant={res ? 'success' : 'error'} />
              </div>
            );
          })}
        </div>
      </div>

      {/* GRNs linked */}
      {grns.length > 1 && (
        <div style={{ border: '1px solid var(--color-border-subtle)', borderRadius: '10px', background: '#fff', padding: '18px', marginBottom: '16px' }}>
          <h3 style={{ fontSize: '14px', fontWeight: 700, color: 'var(--color-text-primary)', margin: '0 0 10px' }}>Linked GRNs ({grns.length})</h3>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            {grns.map(g => (
              <div key={g.id} style={{ padding: '8px 14px', borderRadius: '8px', background: 'var(--color-bg-hover)', fontSize: '12px', fontWeight: 500 }}>
                <span style={{ fontWeight: 700 }}>{g.grnNumber}</span>
                <span style={{ color: 'var(--color-text-secondary)', marginLeft: '6px' }}>{g.lines.length} items · PO {g.poNumbers.join(', ')}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* What happens on approval */}
      <div style={{ border: '1px solid var(--color-border-subtle)', borderRadius: '10px', background: '#fff', padding: '18px', marginBottom: '16px' }}>
        <h3 style={{ fontSize: '14px', fontWeight: 700, color: 'var(--color-text-primary)', margin: '0 0 12px' }}>What Happens on Approval</h3>
        <ul style={{ margin: 0, padding: '0 0 0 18px', fontSize: '13px', color: 'var(--color-text-primary)', lineHeight: 1.8 }}>
          {costUpdates.map(v => (
            <li key={v.id}>
              <strong>{v.itemName}</strong> master cost updated £{v.poValue.toFixed(2)} → £{v.invoiceValue.toFixed(2)}
              <span style={{ fontSize: '12px', fontWeight: 500, color: 'var(--color-info)', marginLeft: '6px' }}>Affects recipes & GP%</span>
            </li>
          ))}
          {costUpdates.length > 0 && <li>Recipe GP% recalculated for affected recipes</li>}
          {deliveryOnly.map(v => (
            <li key={v.id}>
              <strong>{v.itemName}</strong> charged at £{v.invoiceValue.toFixed(2)} for this delivery
              <span style={{ fontSize: '12px', fontWeight: 500, color: 'var(--color-success)', marginLeft: '6px' }}>Cost stays at £{v.poValue.toFixed(2)}</span>
            </li>
          ))}
          {poContexts.map(ctx => (
            <li key={ctx.poNumber}>
              {ctx.overInvoiceIfApproved ? (
                <>
                  <strong style={{ color: 'var(--color-error)' }}>{ctx.poNumber}</strong> over-invoiced by <strong>£{ctx.overBy.toFixed(2)}</strong> — dispute flow required before this approval can complete
                </>
              ) : ctx.closesIfApproved ? (
                <>
                  <strong>{ctx.poNumber}</strong> closes — fully invoiced at £{ctx.poAmount.toFixed(2)}
                  <span style={{ fontSize: '12px', fontWeight: 500, color: 'var(--color-success)', marginLeft: '6px' }}>PO marked complete</span>
                </>
              ) : (
                <>
                  <strong>{ctx.poNumber}</strong> stays open — £{(ctx.poAmount - ctx.afterThisAmount).toFixed(2)} remaining after this invoice
                </>
              )}
            </li>
          ))}
          <li>Invoice pushed to Xero (account codes mapped)</li>
          {creditTotal > 0 && <li>Credit note for <strong>£{creditTotal.toFixed(2)}</strong> exported to Xero separately</li>}
        </ul>
      </div>

      {/* Unmatched items warning */}
      {unmatchedLines.length > 0 && (
        <div style={{ border: '1.5px solid var(--color-warning-border)', borderRadius: '10px', background: 'var(--color-warning-light)', padding: '18px', marginBottom: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
            <span style={{ fontSize: '18px' }}>⚠</span>
            <h3 style={{ fontSize: '14px', fontWeight: 700, color: 'var(--color-warning)', margin: 0 }}>
              {unmatchedLines.length} item{unmatchedLines.length !== 1 ? 's' : ''} not matched to a Goods Received Notice
            </h3>
          </div>
          <p style={{ fontSize: '13px', color: 'var(--color-text-primary)', margin: '0 0 12px', fontWeight: 500, lineHeight: 1.5 }}>
            You are approving payment for the following items with no proof of receipt on file. Confirm delivery was received through another channel before proceeding.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {unmatchedLines.map(il => (
              <div key={il.sku} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', borderRadius: '7px', background: 'rgba(255,255,255,0.65)', gap: '12px', flexWrap: 'wrap' }}>
                <div>
                  <span style={{ fontWeight: 600, fontSize: '13px' }}>{il.description}</span>
                  <span style={{ fontSize: '11px', color: 'var(--color-text-secondary)', marginLeft: '6px' }}>({il.sku})</span>
                </div>
                <span style={{ fontSize: '12px', fontWeight: 700, whiteSpace: 'nowrap' }}>
                  {il.qty} × £{il.unitPrice.toFixed(2)} = £{il.lineTotal.toFixed(2)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Final warning */}
      <div style={{ padding: '12px 16px', borderRadius: '12px', background: 'var(--color-warning-light)', border: '1px solid var(--color-warning-border)', marginBottom: '20px', fontSize: '13px', fontWeight: 600, color: 'var(--color-warning)' }}>
        Approval is final. Costs update and invoice pushes to Xero. Logged for audit.
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', gap: '12px' }}>
        <button
          onClick={onBack}
          style={{ padding: '12px 24px', borderRadius: '8px', background: '#fff', border: '1px solid var(--color-border)', fontWeight: 600, fontSize: '14px', fontFamily: 'var(--font-primary)', color: 'var(--color-text-primary)', cursor: 'pointer' }}
        >
          Back
        </button>
        <button
          onClick={onConfirm}
          style={{ padding: '12px 24px', borderRadius: '8px', background: 'var(--color-accent-active)', border: 'none', fontWeight: 700, fontSize: '14px', fontFamily: 'var(--font-primary)', color: '#fff', cursor: 'pointer' }}
        >
          Approve & Sync
        </button>
      </div>
    </div>
  );
}
