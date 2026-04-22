'use client';

import { useState, useMemo } from 'react';
import StatusBadge from '@/components/Receiving/StatusBadge';
import {
  Invoice,
  MatchVariance,
  PriceResolution,
  QtyResolution,
  OverInvoiceResolution,
  AnyResolution,
  MOCK_INVOICES,
  updateInvoiceLine,
  getGRNsForInvoice,
  getUnmatchedInvoiceLines,
  invoiceGRNTotal,
  getSuggestedGRN,
  getPOContextForInvoice,
  POContextForInvoice,
  getAutoStatusNote,
  AutoStatusNote as AutoStatusNoteData,
  getInvoiceStatusBadgeVariant,
  categorizeSku,
  defaultVatRate,
  vatCategoryLabel,
  VatCategory,
  GRN,
  saveApprovedResolutions,
} from './mockData';
import {
  AUTO_APPLIED_VARIANCES,
  getAutoAppliedForVariance,
  getAISuggestion,
} from '@/components/InvoicingRules/mockData';
import Link from 'next/link';
import { MOCK_POS, MOCK_COMPLETED_DELIVERIES, POLine } from '@/components/Receiving/mockData';

interface InvoiceMatchViewProps {
  invoice: Invoice;
  onApprove: (approvedIds: string[]) => void;
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
  // Forces a re-render after mutating invoice lines in place via updateInvoiceLine.
  const [, setEditBump] = useState(0);
  const bumpEdits = () => setEditBump(b => b + 1);
  // Auto-link the system-suggested GRN on mount. User can unlink from the chip banner if wrong.
  const initialSuggested = getSuggestedGRN(invoice);
  const [linkedGRNs, setLinkedGRNs] = useState<string[]>(
    initialSuggested ? [initialSuggested.grnNumber] : []
  );

  const suggestedGRN = getSuggestedGRN(invoice);
  const poContexts = useMemo(() => getPOContextForInvoice(invoice), [invoice]);
  const splitPOContexts = useMemo(() => poContexts.filter(c => c.totalInvoices > 1), [poContexts]);
  const siblingInvoicesAcrossPOs = useMemo(() => {
    const seen = new Set<string>();
    const out: Invoice[] = [];
    for (const ctx of splitPOContexts) {
      for (const other of [...ctx.priorInvoices, ...ctx.laterInvoices]) {
        if (other.id === invoice.id || seen.has(other.id)) continue;
        seen.add(other.id);
        out.push(other);
      }
    }
    return out;
  }, [splitPOContexts, invoice.id]);

  const grns = useMemo(() => getGRNsForInvoice(invoice, linkedGRNs), [invoice, linkedGRNs]);
  const grnTotal = useMemo(() => invoiceGRNTotal(invoice, linkedGRNs), [invoice, linkedGRNs]);
  const unmatchedLines = useMemo(() => getUnmatchedInvoiceLines(invoice, linkedGRNs), [invoice, linkedGRNs]);
  const varianceTotal = invoice.total - grnTotal;

  const hasUnmatched = unmatchedLines.length > 0;
  const canSuggest = hasUnmatched && suggestedGRN && !linkedGRNs.includes(suggestedGRN.grnNumber);

  const [lineTaxRates, setLineTaxRates] = useState<Record<string, number>>(() => {
    const entries: [string, number][] = [];
    const addLines = (lines: { id: string; sku: string }[]) => {
      for (const il of lines) {
        const rate = defaultVatRate(categorizeSku(il.sku));
        if (rate !== null) entries.push([il.id, rate]);
      }
    };
    addLines(invoice.lines);
    // siblings are editable too — seed their defaults so the dropdown works out of the box
    for (const ctx of splitPOContexts) {
      for (const other of [...ctx.priorInvoices, ...ctx.laterInvoices]) {
        if (other.id === invoice.id) continue;
        addLines(other.lines);
      }
    }
    return Object.fromEntries(entries);
  });
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

  // Sibling invoices on the same PO(s) that are clean-matched and can be bulk-approved in one click
  const approvableSiblings = useMemo(
    () => siblingInvoicesAcrossPOs.filter(s => s.status === 'Matched' && s.variances.every(v => getAutoAppliedForVariance(v.id) !== undefined)),
    [siblingInvoicesAcrossPOs]
  );
  const bulkApproveInvoices = useMemo(
    () => [invoice, ...approvableSiblings],
    [invoice, approvableSiblings]
  );
  const isBulkApprove = bulkApproveInvoices.length > 1;

  const setRes = (varianceId: string, res: AnyResolution | null) => {
    setResolutions(prev => {
      const next = { ...prev };
      if (res === null) delete next[varianceId];
      else next[varianceId] = res;
      return next;
    });
  };

  const [dismissedGRNs, setDismissedGRNs] = useState<string[]>([]);
  const handleLinkGRN = (grnNumber: string) => {
    setLinkedGRNs(prev => prev.includes(grnNumber) ? prev : [...prev, grnNumber]);
  };
  const handleUnlinkGRN = (grnNumber: string) => {
    setLinkedGRNs(prev => prev.filter(n => n !== grnNumber));
    setDismissedGRNs(prev => prev.includes(grnNumber) ? prev : [...prev, grnNumber]);
  };
  const autoLinkedGRN = (suggestedGRN && linkedGRNs.includes(suggestedGRN.grnNumber)) ? suggestedGRN : null;
  const alternateSuggestion = useMemo(() => {
    if (!hasUnmatched) return null;
    if (autoLinkedGRN) return null;
    const excluded = new Set([...linkedGRNs, ...dismissedGRNs, ...invoice.grnNumbers]);
    const candidate = MOCK_COMPLETED_DELIVERIES.find(g =>
      g.supplier === invoice.supplier &&
      !excluded.has(g.grnNumber)
    );
    return candidate ?? null;
  }, [hasUnmatched, autoLinkedGRN, linkedGRNs, dismissedGRNs, invoice.supplier, invoice.grnNumbers]);

  if (showConfirm) {
    return (
      <ApprovalConfirmation
        invoice={invoice}
        resolutions={resolutions}
        grns={grns}
        unmatchedLines={unmatchedLines}
        poContexts={poContexts}
        bulkInvoices={bulkApproveInvoices}
        onBack={() => setShowConfirm(false)}
        onConfirm={() => {
          for (const inv of bulkApproveInvoices) {
            saveApprovedResolutions(inv.id, inv.id === invoice.id ? resolutions : {});
          }
          onApprove(bulkApproveInvoices.map(i => i.id));
        }}
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

      <div style={{
        position: 'sticky',
        top: 0,
        zIndex: 20,
        background: 'var(--color-bg-surface)',
        paddingTop: '4px',
        paddingBottom: '12px',
        marginBottom: '12px',
        borderBottom: '1px solid var(--color-border-subtle)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '12px',
      }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            <h1 style={{ fontSize: '20px', fontWeight: 700, color: 'var(--color-text-primary)', margin: 0 }}>
              {invoice.invoiceNumber} — {invoice.supplier}
            </h1>
            <StatusBadge status={invoice.status} variant={getInvoiceStatusBadgeVariant(invoice.status)} />
          </div>
          <p style={{ fontSize: '12px', color: 'var(--color-text-secondary)', margin: '4px 0 0' }}>
            Three-way match · Invoice ↔ GRN{grns.length > 1 ? 's' : ''} ↔ PO
            {invoice.variances.length > 0 && (
              <> · <strong style={{ color: 'var(--color-text-primary)' }}>{invoice.variances.filter(resolvedOrAuto).length} of {invoice.variances.length}</strong> resolved{autoAppliedIds.size > 0 ? ` (${autoAppliedIds.size} auto ✨)` : ''}</>
            )}
          </p>
        </div>
        <button
          disabled={!canApprove}
          onClick={() => setShowConfirm(true)}
          title={isBulkApprove ? `Approves ${bulkApproveInvoices.map(i => i.invoiceNumber).join(' + ')} in one action` : undefined}
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
          {isBulkApprove ? `Approve ${bulkApproveInvoices.length} invoices & Sync` : 'Approve & Sync'}
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
          sub={hasUnmatched ? `${unmatchedLines.length} unmatched items` : varianceTotal === 0 ? 'Matched' : allResolved ? 'All caught & cleared' : varianceTotal > 0 ? 'Invoice higher' : 'Invoice lower'}
          variant={hasUnmatched ? 'error' : varianceTotal === 0 ? 'success' : allResolved ? 'default' : 'warning'}
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

      {/* Auto-generated status note — system-authored, based on invoice state */}
      <AutoStatusNoteCard invoice={invoice} />

      {/* Colleague comment — free-form, human-written, separate from status */}
      <InvoiceCommentSection
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

      {/* Awaiting delivery — no GRN linked yet (blocker — full card) */}
      {awaitingDelivery && (
        <AwaitingDeliveryBanner invoice={invoice} />
      )}

      {/* Duplicate detection — invoice references a PO that may already be closed (blocker — full card) */}
      {isDuplicate && (
        <DuplicateInvoiceBanner invoice={invoice} overridden={overrideDuplicate} onOverride={() => setOverrideDuplicate(true)} />
      )}

      {/* Context chips — non-blocker signals collapsed into a pill row, expand on click */}
      {(() => {
        const chips: { id: string; icon: string; label: string; tone: 'neutral' | 'info' | 'success' | 'warning' | 'error'; content: React.ReactNode }[] = [];

        if (autoAppliedVariances.length > 0) {
          chips.push({
            id: 'auto-applied',
            icon: '✨',
            label: `${autoAppliedVariances.length} auto-accepted`,
            tone: 'neutral',
            content: <AutoAppliedBanner variances={autoAppliedVariances} />,
          });
        }

        if (aiSuggestion) {
          chips.push({
            id: 'ai-suggestion',
            icon: '💡',
            label: 'Price pattern spotted',
            tone: 'info',
            content: <AISuggestionBanner suggestion={aiSuggestion} onDismiss={() => setDismissAISuggestion(true)} />,
          });
        }

        if (autoLinkedGRN) {
          chips.push({
            id: 'auto-linked-grn',
            icon: '✨',
            label: `Auto-linked ${autoLinkedGRN.grnNumber}`,
            tone: 'neutral',
            content: (
              <AutoLinkedGRNBanner
                grn={autoLinkedGRN}
                invoiceSupplier={invoice.supplier}
                onUnlink={() => handleUnlinkGRN(autoLinkedGRN.grnNumber)}
                coverageSummary={!hasUnmatched && linkedGRNs.length > 0 ? { grnNumbers: grns.map(g => g.grnNumber), lineCount: invoice.lines.length } : undefined}
              />
            ),
          });
        } else if (alternateSuggestion) {
          chips.push({
            id: 'alternate-grn',
            icon: '🔗',
            label: `Try ${alternateSuggestion.grnNumber} instead`,
            tone: 'info',
            content: (
              <SuggestGRNBanner
                unmatchedLines={unmatchedLines}
                suggestedGRN={alternateSuggestion}
                onLink={() => handleLinkGRN(alternateSuggestion.grnNumber)}
                alternateMode
                previouslyDismissed={dismissedGRNs}
              />
            ),
          });
        } else if (canSuggest && suggestedGRN) {
          chips.push({
            id: 'suggest-grn',
            icon: '🔗',
            label: `Link ${suggestedGRN.grnNumber}`,
            tone: 'info',
            content: (
              <SuggestGRNBanner
                unmatchedLines={unmatchedLines}
                suggestedGRN={suggestedGRN}
                onLink={() => handleLinkGRN(suggestedGRN.grnNumber)}
              />
            ),
          });
        }

        if (hasUnmatched && !canSuggest) {
          chips.push({
            id: 'unmatched',
            icon: '⚠️',
            label: `${unmatchedLines.length} unmatched`,
            tone: 'error',
            content: (
              <div style={{ padding: '14px 18px', borderRadius: '12px', background: 'var(--color-error-light)', border: '1px solid var(--color-error-border)', fontSize: '13px', color: 'var(--color-error)', fontWeight: 600 }}>
                {unmatchedLines.length} invoice item{unmatchedLines.length > 1 ? 's' : ''} could not be matched to any linked GRN. Manual review required.
              </div>
            ),
          });
        }

        if (chips.length === 0) return null;
        return <MatchContextBar chips={chips} initialExpandedId={null} />;
      })()}

      {/* Split view — variance resolution is inline within the table */}
      <SplitView invoice={invoice} grns={grns} unmatchedLines={unmatchedLines} resolutions={resolutions} onResolve={setRes} lineTaxRates={lineTaxRates} setLineRate={setLineRate} totalTax={totalTax} anyTax={anyTax} siblingInvoices={siblingInvoicesAcrossPOs} onLineEdit={bumpEdits} />

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
      padding: '10px 14px',
      borderRadius: '10px',
      background: 'var(--color-info-light)',
      border: '1px solid rgba(3, 105, 161, 0.2)',
      display: 'flex',
      alignItems: 'center',
      gap: '12px',
      flexWrap: 'wrap',
    }}>
      <span style={{ fontSize: '14px', lineHeight: 1 }}>🧾</span>
      <span style={{ fontWeight: 700, fontSize: '13px', color: 'var(--color-info)', whiteSpace: 'nowrap' }}>
        {ctx.poNumber}
      </span>
      <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--color-text-primary)', whiteSpace: 'nowrap' }}>
        Invoice {ctx.invoiceIndex} of {ctx.totalInvoices}
      </span>
      <span aria-hidden="true" style={{ color: 'rgba(3, 105, 161, 0.35)' }}>·</span>
      <span style={{ fontSize: '12px', fontWeight: 500, color: 'var(--color-text-primary)', whiteSpace: 'nowrap' }}>
        £{ctx.afterThisAmount.toFixed(2)} of £{ctx.poAmount.toFixed(2)} ({afterPct}%) after approval
      </span>
      <span aria-hidden="true" style={{ color: 'rgba(3, 105, 161, 0.35)' }}>·</span>
      <span style={{ fontSize: '12px', fontWeight: 600, color: implicationColor, whiteSpace: 'nowrap' }}>
        {implicationText}
      </span>
      <div style={{ flex: 1 }} />
      <a
        href={`/purchase-orders/${ctx.poId}`}
        style={{
          padding: '5px 12px',
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
  );
}

function applicationTotalForInvoiceOnPO(ctx: POContextForInvoice, invoiceId: string): number {
  const inv = ctx.allInvoices.find(i => i.id === invoiceId);
  if (!inv) return 0;
  return inv.total;
}

/* ──────────── Match Context Bar (chip strip with accordion) ──────────── */

function MatchContextBar({ chips, initialExpandedId }: {
  chips: { id: string; icon: string; label: string; tone: 'neutral' | 'info' | 'success' | 'warning' | 'error'; content: React.ReactNode }[];
  initialExpandedId: string | null;
}) {
  const [expandedId, setExpandedId] = useState<string | null>(initialExpandedId);
  type Tone = 'neutral' | 'info' | 'success' | 'warning' | 'error';
  const palette: Record<Tone, { bg: string; bgActive: string; color: string; border: string }> = {
    neutral: { bg: 'var(--color-bg-hover)', bgActive: 'rgba(58,48,40,0.08)', color: 'var(--color-text-primary)', border: 'var(--color-border-subtle)' },
    info: { bg: 'rgba(3,105,161,0.06)', bgActive: 'rgba(3,105,161,0.14)', color: 'var(--color-info)', border: 'rgba(3,105,161,0.3)' },
    success: { bg: 'rgba(21,128,61,0.06)', bgActive: 'rgba(21,128,61,0.14)', color: 'var(--color-success)', border: 'var(--color-success-border)' },
    warning: { bg: 'rgba(217,119,6,0.08)', bgActive: 'rgba(217,119,6,0.18)', color: 'var(--color-warning)', border: 'var(--color-warning-border)' },
    error: { bg: 'rgba(185,28,28,0.08)', bgActive: 'rgba(185,28,28,0.16)', color: 'var(--color-error)', border: 'var(--color-error-border)' },
  };
  const toneStyle = (tone: Tone, active: boolean): React.CSSProperties => {
    const p = palette[tone];
    return {
      padding: '6px 12px',
      borderRadius: '100px',
      border: `1px solid ${p.border}`,
      background: active ? p.bgActive : p.bg,
      color: p.color,
      fontSize: '12px',
      fontWeight: 700,
      fontFamily: 'var(--font-primary)',
      cursor: 'pointer',
      display: 'inline-flex',
      alignItems: 'center',
      gap: '6px',
      whiteSpace: 'nowrap',
      boxShadow: active ? '0 0 0 2px rgba(34,68,68,0.08)' : 'none',
    };
  };
  const activeChip = chips.find(c => c.id === expandedId);
  return (
    <div style={{ marginBottom: '20px' }}>
      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: activeChip ? '10px' : 0 }}>
        {chips.map(chip => (
          <button
            key={chip.id}
            onClick={() => setExpandedId(expandedId === chip.id ? null : chip.id)}
            style={toneStyle(chip.tone, chip.id === expandedId)}
          >
            <span style={{ fontSize: '13px', lineHeight: 1 }}>{chip.icon}</span>
            {chip.label}
            <span style={{ fontSize: '10px', opacity: 0.7 }}>{chip.id === expandedId ? '▴' : '▾'}</span>
          </button>
        ))}
      </div>
      {activeChip && <div>{activeChip.content}</div>}
    </div>
  );
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
      background: 'var(--color-bg-hover)',
      border: '1px solid var(--color-border-subtle)',
      marginBottom: '20px',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
        <span style={{ fontSize: '16px' }}>✨</span>
        <span style={{ fontWeight: 700, fontSize: '14px', color: 'var(--color-text-primary)' }}>
          {entries.length} variance{entries.length === 1 ? '' : 's'} auto-accepted by rules
        </span>
        <div style={{ flex: 1 }} />
        <Link
          href="/invoices/settings"
          style={{
            fontSize: '12px', fontWeight: 600, color: 'var(--color-accent-deep)',
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

function AutoAppliedChip({ varianceId }: { varianceId?: string }) {
  const [hover, setHover] = useState(false);
  const meta = varianceId ? getAutoAppliedForVariance(varianceId) : undefined;
  return (
    <span
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        position: 'relative',
        display: 'inline-flex',
        alignItems: 'center',
        gap: '4px',
        padding: '3px 9px',
        borderRadius: '100px',
        fontSize: '11px',
        fontWeight: 700,
        background: 'var(--color-bg-hover)',
        color: 'var(--color-text-secondary)',
        border: '1px solid var(--color-border-subtle)',
        whiteSpace: 'nowrap',
        cursor: meta ? 'help' : 'default',
      }}
    >
      ✨ auto
      {hover && meta && (
        <span
          role="tooltip"
          style={{
            position: 'absolute',
            bottom: 'calc(100% + 8px)',
            left: '50%',
            transform: 'translateX(-50%)',
            background: '#fff',
            color: 'var(--color-text-primary)',
            fontSize: '12px',
            fontWeight: 500,
            padding: '10px 14px',
            borderRadius: '8px',
            border: '1px solid var(--color-border-subtle)',
            boxShadow: '0 8px 24px rgba(58,48,40,0.12)',
            whiteSpace: 'normal',
            width: '260px',
            textAlign: 'left',
            zIndex: 30,
            lineHeight: 1.5,
            pointerEvents: 'none',
          }}
        >
          <div style={{ fontWeight: 700, fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--color-text-secondary)', marginBottom: '4px' }}>
            Auto-accepted by rule
          </div>
          {meta.note}
          <span
            aria-hidden="true"
            style={{
              position: 'absolute',
              top: '100%',
              left: '50%',
              transform: 'translateX(-50%)',
              width: 0,
              height: 0,
              borderLeft: '6px solid transparent',
              borderRight: '6px solid transparent',
              borderTop: '6px solid #fff',
              filter: 'drop-shadow(0 1px 0 var(--color-border-subtle))',
            }}
          />
        </span>
      )}
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

function AutoLinkedGRNBanner({ grn, invoiceSupplier, onUnlink, coverageSummary }: { grn: GRN; invoiceSupplier: string; onUnlink: () => void; coverageSummary?: { grnNumbers: string[]; lineCount: number } }) {
  return (
    <div style={{
      padding: '14px 16px',
      borderRadius: '10px',
      background: '#fff',
      border: '1px solid var(--color-border-subtle)',
    }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', marginBottom: '6px', flexWrap: 'wrap' }}>
        <span style={{ fontSize: '13px' }}>✨</span>
        <span style={{ fontWeight: 700, fontSize: '13px', color: 'var(--color-text-primary)' }}>
          Auto-linked <strong>{grn.grnNumber}</strong>
        </span>
        <span style={{ fontSize: '12px', fontWeight: 500, color: 'var(--color-text-secondary)' }}>
          · {grn.supplier} · Received {grn.dateReceived} · {grn.lines.length} items · PO {grn.poNumbers.join(', ')}
        </span>
      </div>
      <p style={{ fontSize: '12px', color: 'var(--color-text-secondary)', fontWeight: 500, margin: '0 0 10px', lineHeight: 1.5 }}>
        We think this belongs here — supplier ({invoiceSupplier}) and line items match. Unlink if wrong and we'll try another.
      </p>
      {coverageSummary && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          padding: '8px 12px',
          borderRadius: '6px',
          background: 'var(--color-bg-hover)',
          fontSize: '12px',
          fontWeight: 500,
          color: 'var(--color-text-primary)',
          marginBottom: '10px',
        }}>
          <span style={{ color: 'var(--color-text-secondary)' }}>✓</span>
          All {coverageSummary.lineCount} line items covered across {coverageSummary.grnNumbers.join(' + ')}
        </div>
      )}
      <button
        onClick={onUnlink}
        style={{
          padding: '6px 12px',
          borderRadius: '6px',
          background: 'transparent',
          border: '1px solid var(--color-border)',
          fontSize: '12px', fontWeight: 600,
          fontFamily: 'var(--font-primary)',
          color: 'var(--color-text-primary)',
          cursor: 'pointer',
        }}
      >
        Unlink {grn.grnNumber}
      </button>
    </div>
  );
}

function SuggestGRNBanner({ unmatchedLines, suggestedGRN, onLink, alternateMode, previouslyDismissed }: { unmatchedLines: { description: string; sku: string }[]; suggestedGRN: GRN; onLink: () => void; alternateMode?: boolean; previouslyDismissed?: string[] }) {
  const headerText = alternateMode
    ? `Try a different GRN?`
    : `${unmatchedLines.length} item${unmatchedLines.length > 1 ? 's' : ''} not found in linked Goods Received Notice (GRN)`;
  const bodyText = alternateMode
    ? `You unlinked ${previouslyDismissed && previouslyDismissed.length > 0 ? previouslyDismissed.join(', ') : 'our first guess'} — here's another candidate from the same supplier:`
    : 'This invoice covers items from two separate deliveries. We found a matching GRN for the remaining items:';
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
              {headerText}
            </span>
          </div>
          <p style={{ fontSize: '13px', color: 'var(--color-text-primary)', margin: '0 0 10px', lineHeight: 1.5 }}>
            {bodyText}
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginBottom: '12px' }}>
            {unmatchedLines.map(line => (
              <div key={line.sku} style={{ fontSize: '12px', fontWeight: 500, color: 'var(--color-text-secondary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ color: 'var(--color-text-secondary)', fontWeight: 600, opacity: 0.6 }}>–</span>
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

/* ──────────── Auto Status Note (system-authored, read-only) ──────────── */

function AutoStatusNoteCard({ invoice }: { invoice: Invoice }) {
  const note = getAutoStatusNote(invoice);
  if (!note) return null;
  const toneStyles: Record<AutoStatusNoteData['tone'], { bg: string; border: string; icon: string; iconColor: string }> = {
    info:    { bg: 'var(--color-info-light)',    border: 'rgba(3,105,161,0.2)',      icon: 'ℹ',  iconColor: 'var(--color-info)' },
    warning: { bg: 'var(--color-warning-light)', border: 'var(--color-warning-border)', icon: '⚠', iconColor: 'var(--color-warning)' },
    error:   { bg: 'var(--color-error-light)',   border: 'var(--color-error-border)',   icon: '⚠', iconColor: 'var(--color-error)' },
    success: { bg: 'var(--color-success-light)', border: 'var(--color-success-border)', icon: '✓', iconColor: 'var(--color-success)' },
    neutral: { bg: 'var(--color-bg-hover)',      border: 'var(--color-border-subtle)',  icon: 'ℹ',  iconColor: 'var(--color-text-secondary)' },
  };
  const s = toneStyles[note.tone];
  return (
    <div style={{
      padding: '10px 14px',
      borderRadius: '10px',
      background: s.bg,
      border: `1px solid ${s.border}`,
      marginBottom: '12px',
      display: 'flex',
      alignItems: 'center',
      gap: '10px',
      flexWrap: 'wrap',
    }}>
      <span style={{ fontSize: '14px', color: s.iconColor, lineHeight: 1, fontWeight: 700 }}>{s.icon}</span>
      <div style={{ flex: 1, minWidth: '200px', fontSize: '13px', color: 'var(--color-text-primary)', fontWeight: 500, lineHeight: 1.5 }}>
        {note.text}
      </div>
      <span
        title={`Auto-generated from: ${note.reason}`}
        style={{
          fontSize: '10px',
          fontWeight: 700,
          padding: '2px 8px',
          borderRadius: '4px',
          background: '#fff',
          color: 'var(--color-text-secondary)',
          border: '1px solid var(--color-border-subtle)',
          whiteSpace: 'nowrap',
          letterSpacing: '0.06em',
          textTransform: 'uppercase',
        }}
      >
        ✨ Auto
      </span>
    </div>
  );
}

/* ──────────── Colleague Comment Section (free-form, human-written) ──────────── */

function InvoiceCommentSection({ initialNote, initialAuthor, initialUpdatedAt }: {
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
          <span style={{ fontSize: '16px' }}>💬</span>
          <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--color-text-primary)' }}>
            Comment
          </span>
          <span style={{ fontSize: '11px', fontWeight: 500, color: 'var(--color-text-muted)' }}>
            for colleagues
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
              {hasNote ? preview : 'Add a comment'}
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
                placeholder="e.g. Sam will chase the credit note Thursday if nothing lands first."
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
                      Edit comment
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

function SplitView({ invoice, grns, unmatchedLines, resolutions, onResolve, lineTaxRates, setLineRate, totalTax, anyTax, siblingInvoices, onLineEdit }: {
  invoice: Invoice;
  grns: GRN[];
  unmatchedLines: { description: string; sku: string; qty: number; unitPrice: number; lineTotal: number }[];
  resolutions: Record<string, AnyResolution>;
  onResolve: (varianceId: string, res: AnyResolution | null) => void;
  lineTaxRates: Record<string, number>;
  setLineRate: (lineId: string, rate: number) => void;
  totalTax: number;
  anyTax: boolean;
  siblingInvoices: Invoice[];
  onLineEdit: () => void;
}) {
  const [rightTab, setRightTab] = useState<'grn' | 'po'>('grn');
  const [expandedVariance, setExpandedVariance] = useState<string | null>(null);
  const editable = invoice.editable === true;

  const commitQty = (lineId: string, current: number, raw: string) => {
    const n = parseFloat(raw);
    if (isNaN(n) || n === current) return false;
    updateInvoiceLine(invoice.id, lineId, { qty: n });
    onLineEdit();
    return true;
  };
  const commitPrice = (lineId: string, current: number, raw: string) => {
    const n = parseFloat(raw);
    if (isNaN(n) || n === current) return false;
    updateInvoiceLine(invoice.id, lineId, { unitPrice: n });
    onLineEdit();
    return true;
  };

  const EditableQty = ({ lineId, value }: { lineId: string; value: number }) => (
    <input
      // key on value → input remounts when value changes via external mutation,
      // picking up the new defaultValue.
      key={`${lineId}-${value}`}
      type="number"
      defaultValue={value}
      onBlur={e => {
        if (!commitQty(lineId, value, e.target.value)) e.target.value = String(value);
      }}
      onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
      style={{
        width: '60px', padding: '4px 6px', borderRadius: '5px',
        border: '1px solid var(--color-border)', fontSize: '13px',
        fontFamily: 'var(--font-primary)', background: '#fff',
        color: 'var(--color-text-primary)', textAlign: 'right',
        outline: 'none',
      }}
    />
  );

  const EditablePrice = ({ lineId, value }: { lineId: string; value: number }) => (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '2px' }}>
      <span style={{ color: 'var(--color-text-secondary)', fontSize: '12px' }}>£</span>
      <input
        key={`${lineId}-${value}`}
        type="number"
        step="0.01"
        defaultValue={value.toFixed(2)}
        onBlur={e => {
          if (!commitPrice(lineId, value, e.target.value)) e.target.value = value.toFixed(2);
        }}
        onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
        style={{
          width: '70px', padding: '4px 6px', borderRadius: '5px',
          border: '1px solid var(--color-border)', fontSize: '13px',
          fontFamily: 'var(--font-primary)', background: '#fff',
          color: 'var(--color-text-primary)', textAlign: 'right',
          outline: 'none',
        }}
      />
    </span>
  );

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

  // All GRNs involved across primary + siblings (used in the right-panel header when there are split-billing siblings)
  const allDisplayGRNs = useMemo(() => {
    const seen = new Set<string>();
    const out: GRN[] = [];
    for (const g of grns) {
      if (seen.has(g.id)) continue;
      seen.add(g.id);
      out.push(g);
    }
    for (const sibling of siblingInvoices) {
      for (const g of getGRNsForInvoice(sibling)) {
        if (seen.has(g.id)) continue;
        seen.add(g.id);
        out.push(g);
      }
    }
    return out;
  }, [grns, siblingInvoices]);

  const allGrnTotal = grnGroups.reduce((s, g) => s + g.lines.reduce((ss, l) => ss + l.lineTotal, 0), 0);
  const allPoTotal = grnGroups.reduce((s, g) => s + g.pos.reduce((ss, p) => ss + p.lines.reduce((sss, l) => sss + l.price * l.expectedQty, 0), 0), 0);

  // right column count differs by tab
  const RC = rightTab === 'grn' ? 6 : 4;

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
                      {rightTab === 'grn' ? (allDisplayGRNs.length > 1 ? `${allDisplayGRNs.length} GRNs` : 'GRN') : 'PO Prices'}
                    </div>
                    <div style={{ fontSize: '12px', fontWeight: 500, color: 'var(--color-text-secondary)', marginTop: '2px' }}>
                      {rightTab === 'grn'
                        ? (allDisplayGRNs.length > 0 ? allDisplayGRNs.map((g, i) => <span key={g.id}>{i > 0 && ' + '}{g.grnNumber} · {g.dateReceived}</span>) : 'No linked GRN')
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
                  <th style={colLabelStyle}>PO Price</th>
                  <th style={colLabelStyle}>Total</th>
                  <th style={{ ...colLabelStyle, width: '32px' }}></th>
                </>
              )}
            </tr>
          </thead>

          {/* ── GRN groups (per-GRN section header labels invoice | GRN) ── */}
          {grnGroups.map(({ grn, lines, pos }) => {
            const invGroupSkus = new Set(lines.map(l => l.sku));
            const invGroupTotal = invoice.lines.filter(il => invGroupSkus.has(il.sku)).reduce((s, l) => s + l.lineTotal, 0);
            const grnGroupTotal = lines.reduce((s, l) => s + l.lineTotal, 0);
            const poGroupTotal = pos.reduce((s, p) => s + p.lines.reduce((ss, l) => ss + l.price * l.expectedQty, 0), 0);
            const poLines = pos.flatMap(p => p.lines);

            return (
              <tbody key={grn.id}>
                {/* Group section header (multi-GRN OR multi-invoice) — split invoice | GRN with divider through */}
                {(multiGroup || siblingInvoices.length > 0) && (
                  <tr>
                    <td colSpan={6} style={{ padding: '8px 14px', background: 'rgba(34, 68, 68, 0.06)', borderTop: '2px solid var(--color-accent-active)', borderBottom: '1px solid var(--color-border-subtle)', ...divider }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                        <span style={{ fontWeight: 700, fontSize: '12px', color: 'var(--color-accent-active)' }}>
                          {invoice.invoiceNumber}
                        </span>
                        <span style={{ fontWeight: 500, fontSize: '12px', color: 'var(--color-text-secondary)' }}>
                          {invoice.date} · {invoice.supplier}
                        </span>
                        {siblingInvoices.length > 0 && (
                          <span style={{ fontSize: '10px', fontWeight: 700, padding: '2px 7px', borderRadius: '4px', background: 'var(--color-accent-active)', color: '#fff', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                            This invoice
                          </span>
                        )}
                      </div>
                    </td>
                    <td colSpan={RC} style={{ padding: '8px 14px', background: 'rgba(34, 68, 68, 0.06)', borderTop: '2px solid var(--color-accent-active)', borderBottom: '1px solid var(--color-border-subtle)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                        <span style={{ fontWeight: 700, fontSize: '12px', color: 'var(--color-text-primary)' }}>
                          {rightTab === 'grn' ? grn.grnNumber : (pos.length > 0 ? pos.map(p => p.poNumber).join(' + ') : 'No PO')}
                        </span>
                        <span style={{ fontWeight: 500, fontSize: '12px', color: 'var(--color-text-secondary)' }}>
                          {rightTab === 'grn' ? `Received ${grn.dateReceived} · ${grn.receivedBy}` : `via ${grn.grnNumber}`}
                        </span>
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
                  const isAutoApplied = !!variance && !!getAutoAppliedForVariance(variance.id);
                  const isResolved = !!variance && !!resolutions[variance.id];
                  const isCleared = isResolved || isAutoApplied;
                  const hasVar = (priceVar || variance?.type === 'qty') && !isCleared;
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
                      <td style={{ ...cell, fontWeight: variance?.type === 'qty' && !isCleared ? 700 : 400, color: variance?.type === 'qty' && !isCleared ? 'var(--color-warning)' : undefined }}>
                        {editable && invLine ? <EditableQty lineId={invLine.id} value={invLine.qty} /> : (invLine?.qty ?? '—')}
                      </td>
                      <td style={{ ...cell, fontWeight: priceVar && !isCleared ? 700 : 400, color: priceVar && !isCleared ? 'var(--color-warning)' : undefined }}>
                        {editable && invLine ? <EditablePrice lineId={invLine.id} value={invLine.unitPrice} /> : (invLine ? `£${invLine.unitPrice.toFixed(2)}` : '—')}
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
                      <td style={{ ...cell, textAlign: 'center', fontWeight: (isShort || variance?.type === 'qty') && !isCleared ? 700 : 600, color: (isShort || variance?.type === 'qty') && !isCleared ? 'var(--color-warning)' : undefined }}>
                        {grnLine.receivedQty}
                        {isShort && <span style={{ fontSize: '11px', fontWeight: 400, color: 'var(--color-text-secondary)', marginLeft: '4px' }}>of {grnLine.orderedQty}</span>}
                      </td>
                      <td style={{ ...cell, fontWeight: priceVar && !isCleared ? 700 : 400, color: priceVar && !isCleared ? 'var(--color-warning)' : undefined }}>£{grnLine.unitPrice.toFixed(2)}</td>
                      <td style={{ ...cell, fontWeight: 600 }}>£{grnLine.lineTotal.toFixed(2)}</td>
                      <td style={{ ...cell, color: 'var(--color-text-secondary)', fontWeight: 500 }}>
                        £{(grnLine.lineTotal * (invLine ? (lineTaxRates[invLine.id] ?? 10) : 10) / 100).toFixed(2)}
                      </td>
                      <td style={{ ...cell, padding: '6px 12px', textAlign: 'center' }}>
                        {variance
                          ? getAutoAppliedForVariance(variance.id)
                            ? <AutoAppliedChip varianceId={variance.id} />
                            : <VarBadge varianceId={variance.id} label={varLabel} />
                          : <span style={{ color: 'var(--color-text-secondary)', fontSize: '13px', fontWeight: 600, opacity: 0.5 }}>✓</span>
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
                              <span style={{ fontWeight: 700, fontSize: '13px', color: 'var(--color-text-primary)' }}>{impactLabel}</span>
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
                  const isAutoApplied = !!variance && !!getAutoAppliedForVariance(variance.id);
                  const isResolved = !!variance && !!resolutions[variance.id];
                  const isCleared = isResolved || isAutoApplied;
                  const rowBg = !priceMatch && !isCleared ? 'rgba(217, 119, 6, 0.11)' : 'transparent';
                  const leftAccent: React.CSSProperties = !priceMatch && !isCleared ? { boxShadow: 'inset 4px 0 0 #D97706' } : {};
                  const thisQty = invLine?.qty ?? 0;
                  const overOnLine = thisQty > poLine.expectedQty;

                  const dataRow = (
                    <tr key={poLine.id} style={{ background: rowBg }}>
                      <td style={{ ...cell, ...leftAccent }}>
                        <div style={{ fontWeight: !priceMatch && !isCleared ? 600 : 400 }}>{invLine?.description ?? poLine.name}</div>
                        <div style={{ fontSize: '11px', color: 'var(--color-text-secondary)' }}>{poLine.sku}</div>
                      </td>
                      <td style={cell}>
                        {editable && invLine ? <EditableQty lineId={invLine.id} value={invLine.qty} /> : (invLine?.qty ?? '—')}
                      </td>
                      <td style={{ ...cell, fontWeight: !priceMatch && !isCleared ? 700 : 400, color: !priceMatch && !isCleared ? 'var(--color-warning)' : undefined }}>
                        {editable && invLine ? <EditablePrice lineId={invLine.id} value={invLine.unitPrice} /> : (invLine ? `£${invLine.unitPrice.toFixed(2)}` : '—')}
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
                      <td style={{ ...cell, fontWeight: !priceMatch && !isCleared ? 700 : 400, color: !priceMatch && !isCleared ? 'var(--color-warning)' : undefined }}>
                        £{poLine.price.toFixed(2)}
                      </td>
                      <td style={{ ...cell, fontWeight: 600 }}>£{lineTotal.toFixed(2)}</td>
                      <td style={{ ...cell, padding: '6px 12px', textAlign: 'center' }}>
                        {variance
                          ? getAutoAppliedForVariance(variance.id)
                            ? <AutoAppliedChip varianceId={variance.id} />
                            : <VarBadge varianceId={variance.id} label={varianceShortLabel(variance, priceDiff)} />
                          : overOnLine
                            ? <span style={{ color: 'var(--color-error)', fontSize: '11px', fontWeight: 700, padding: '2px 7px', borderRadius: '4px', background: 'rgba(185,28,28,0.09)', border: '1px solid rgba(185,28,28,0.3)' }}>Over</span>
                            : <span style={{ color: 'var(--color-text-secondary)', fontSize: '13px', fontWeight: 600, opacity: 0.5 }}>✓</span>
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
                              <span style={{ fontWeight: 700, fontSize: '13px', color: 'var(--color-text-primary)' }}>{impactLabel}</span>
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

          {/* ── Sibling invoice groups (editable — share same PO) ── */}
          {siblingInvoices.map(sibling => {
            const sibGRNs = getGRNsForInvoice(sibling);
            const sibGRNLinesBySku = new Map<string, { orderedQty: number; receivedQty: number; unitPrice: number; lineTotal: number; grnNumber: string }>();
            sibGRNs.forEach(g => g.lines.forEach(gl => {
              sibGRNLinesBySku.set(gl.sku, {
                orderedQty: gl.expectedQty,
                receivedQty: gl.receivedQty,
                unitPrice: gl.price,
                lineTotal: gl.receivedQty * gl.price,
                grnNumber: g.grnNumber,
              });
            }));
            const sibPOLinesBySku = new Map<string, { expectedQty: number; price: number }>();
            sibGRNs.forEach(g => {
              const sibPOs = MOCK_POS.filter(p => g.poNumbers.includes(p.poNumber));
              sibPOs.forEach(p => p.lines.forEach(pl => {
                sibPOLinesBySku.set(pl.sku, { expectedQty: pl.expectedQty, price: pl.price });
              }));
            });
            const siblingStatusVariant = sibling.status === 'Approved' || sibling.status === 'Matched' ? 'success' : 'warning';
            return (
              <tbody key={`sibling-${sibling.id}`}>
                {/* Sibling section header — split invoice | GRN with divider through */}
                <tr>
                  <td colSpan={6} style={{ padding: '8px 14px', background: 'var(--color-bg-subtle, #fafafa)', borderTop: '2px solid var(--color-border)', borderBottom: '1px solid var(--color-border-subtle)', ...divider }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                      <span style={{ fontWeight: 700, fontSize: '12px', color: 'var(--color-text-primary)' }}>
                        {sibling.invoiceNumber}
                      </span>
                      <span style={{ fontWeight: 500, fontSize: '12px', color: 'var(--color-text-secondary)' }}>
                        {sibling.date} · {sibling.supplier}
                      </span>
                      <StatusBadge status={sibling.status} variant={siblingStatusVariant} />
                      <div style={{ flex: 1 }} />
                      <a
                        href={`/invoices/match?id=${sibling.id}`}
                        style={{ padding: '3px 10px', borderRadius: '6px', background: 'transparent', border: '1px solid var(--color-border)', fontSize: '11px', fontWeight: 600, fontFamily: 'var(--font-primary)', color: 'var(--color-accent-active)', cursor: 'pointer', textDecoration: 'none', whiteSpace: 'nowrap' }}
                      >
                        Open INV →
                      </a>
                    </div>
                  </td>
                  <td colSpan={RC} style={{ padding: '8px 14px', background: 'var(--color-bg-subtle, #fafafa)', borderTop: '2px solid var(--color-border)', borderBottom: '1px solid var(--color-border-subtle)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                      {sibGRNs.length === 0 ? (
                        <span style={{ fontSize: '12px', fontWeight: 500, color: 'var(--color-text-secondary)' }}>No linked GRN</span>
                      ) : (
                        sibGRNs.map((g, i) => (
                          <span key={g.id} style={{ display: 'inline-flex', gap: '6px', alignItems: 'baseline' }}>
                            {i > 0 && <span style={{ color: 'var(--color-border)' }}>+</span>}
                            <span style={{ fontWeight: 700, fontSize: '12px', color: 'var(--color-text-primary)' }}>{g.grnNumber}</span>
                            <span style={{ fontWeight: 500, fontSize: '12px', color: 'var(--color-text-secondary)' }}>Received {g.dateReceived} · {g.receivedBy}</span>
                          </span>
                        ))
                      )}
                    </div>
                  </td>
                </tr>
                {/* Sibling line rows (editable) */}
                {sibling.lines.map(il => {
                  const grnMatch = sibGRNLinesBySku.get(il.sku);
                  const poMatch = sibPOLinesBySku.get(il.sku);
                  const rate = lineTaxRates[il.id] ?? 0;
                  const vatAmount = il.lineTotal * rate / 100;
                  return (
                    <tr key={`sibling-${sibling.id}-${il.id}`}>
                      <td style={cell}>
                        <div style={{ fontWeight: 500 }}>{il.description}</div>
                        <div style={{ fontSize: '11px', color: 'var(--color-text-secondary)' }}>{il.sku}</div>
                      </td>
                      <td style={cell}>{il.qty}</td>
                      <td style={cell}>£{il.unitPrice.toFixed(2)}</td>
                      <td style={{ ...cell, fontWeight: 600 }}>£{il.lineTotal.toFixed(2)}</td>
                      <td style={cell}>
                        <TaxSelect lineId={il.id} sku={il.sku} />
                      </td>
                      <td style={{ ...cell, ...divider, fontWeight: 600, color: rate > 0 ? 'var(--color-text-primary)' : 'var(--color-text-secondary)' }}>
                        {rate > 0 ? `£${vatAmount.toFixed(2)}` : '—'}
                      </td>
                      {rightTab === 'grn' ? (
                        <>
                          <td style={cell}>{grnMatch?.orderedQty ?? '—'}</td>
                          <td style={cell}>{grnMatch?.receivedQty ?? '—'}</td>
                          <td style={cell}>{grnMatch ? `£${grnMatch.unitPrice.toFixed(2)}` : '—'}</td>
                          <td style={{ ...cell, fontWeight: 600 }}>{grnMatch ? `£${grnMatch.lineTotal.toFixed(2)}` : '—'}</td>
                          <td style={cell}>{grnMatch && rate > 0 ? `£${(grnMatch.lineTotal * rate / 100).toFixed(2)}` : '—'}</td>
                          <td style={{ ...cell, textAlign: 'center' }}>
                            <span style={{ color: 'var(--color-text-secondary)', fontSize: '13px', fontWeight: 600, opacity: 0.5 }}>✓</span>
                          </td>
                        </>
                      ) : (
                        <>
                          <td style={cell}>{poMatch?.expectedQty ?? '—'}</td>
                          <td style={cell}>{poMatch ? `£${poMatch.price.toFixed(2)}` : '—'}</td>
                          <td style={{ ...cell, fontWeight: 600 }}>{poMatch ? `£${(poMatch.price * poMatch.expectedQty).toFixed(2)}` : '—'}</td>
                          <td style={{ ...cell, textAlign: 'center' }}>
                            <span style={{ color: 'var(--color-text-secondary)', fontSize: '13px', fontWeight: 600, opacity: 0.5 }}>✓</span>
                          </td>
                        </>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            );
          })}

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
                  <td colSpan={2} />
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
        <span style={{ fontWeight: 700, fontSize: '14px', color: 'var(--color-text-primary)', whiteSpace: 'nowrap' }}>{impactLabel}</span>
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
        <div style={{ marginTop: '12px', padding: '10px 14px', borderRadius: '8px', background: 'var(--color-bg-hover)', fontSize: '12px', fontWeight: 500, color: 'var(--color-text-primary)' }}>
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

function ApprovalConfirmation({ invoice, resolutions, grns, unmatchedLines, poContexts, bulkInvoices, onBack, onConfirm }: {
  invoice: Invoice;
  resolutions: Record<string, AnyResolution>;
  grns: GRN[];
  unmatchedLines: { description: string; sku: string; qty: number; unitPrice: number; lineTotal: number }[];
  poContexts: POContextForInvoice[];
  bulkInvoices: Invoice[];
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
  const isBulk = bulkInvoices.length > 1;
  const bulkTotal = bulkInvoices.reduce((s, i) => s + i.total, 0);

  return (
    <div style={{ fontFamily: 'var(--font-primary)' }}>
      <button
        onClick={onBack}
        style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '13px', fontWeight: 600, color: 'var(--color-accent-deep)', fontFamily: 'var(--font-primary)', marginBottom: '16px' }}
      >
        ← Back to match
      </button>

      <h1 style={{ fontSize: '22px', fontWeight: 700, color: 'var(--color-text-primary)', margin: '0 0 20px' }}>
        {isBulk
          ? `Confirm Approval — ${bulkInvoices.length} invoices on ${poContexts[0]?.poNumber ?? 'PO'}`
          : `Confirm Approval — ${invoice.invoiceNumber}`}
      </h1>

      {/* Bulk invoice list (split-billing) */}
      {isBulk && (
        <div style={{ border: '1px solid var(--color-border-subtle)', borderRadius: '10px', background: '#fff', padding: '18px', marginBottom: '16px' }}>
          <h3 style={{ fontSize: '14px', fontWeight: 700, color: 'var(--color-text-primary)', margin: '0 0 10px' }}>Invoices being approved</h3>
          <p style={{ fontSize: '12px', fontWeight: 500, color: 'var(--color-text-secondary)', margin: '0 0 12px' }}>
            Both invoices are linked to the same PO and can be approved in one action. Combined total <strong style={{ color: 'var(--color-text-primary)' }}>£{bulkTotal.toFixed(2)}</strong>.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {bulkInvoices.map((inv, i) => (
              <div key={inv.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', padding: '10px 14px', borderRadius: '8px', background: 'var(--color-bg-hover)', flexWrap: 'wrap' }}>
                <div>
                  <span style={{ fontWeight: 700, fontSize: '13px', color: 'var(--color-text-primary)' }}>{inv.invoiceNumber}</span>
                  <span style={{ fontSize: '12px', fontWeight: 500, color: 'var(--color-text-secondary)', marginLeft: '8px' }}>
                    {inv.date} · {inv.supplier}{i === 0 ? ' · this invoice' : ''}
                  </span>
                </div>
                <span style={{ fontWeight: 700, fontSize: '13px', color: 'var(--color-text-primary)' }}>£{inv.total.toFixed(2)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Resolution Summary */}
      <div style={{ border: '1px solid var(--color-border-subtle)', borderRadius: '10px', background: '#fff', padding: '18px', marginBottom: '16px' }}>
        <h3 style={{ fontSize: '14px', fontWeight: 700, color: 'var(--color-text-primary)', margin: '0 0 14px' }}>Resolution Summary</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {invoice.variances.map(v => {
            const res = resolutions[v.id];
            const auto = getAutoAppliedForVariance(v.id);
            return (
              <div key={v.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', padding: '10px 14px', borderRadius: '8px', background: 'var(--color-bg-hover)', flexWrap: 'wrap' }}>
                <div>
                  <span style={{ fontWeight: 600, fontSize: '13px', color: 'var(--color-text-primary)' }}>{v.itemName}</span>
                  <span style={{ fontSize: '12px', fontWeight: 500, color: 'var(--color-text-secondary)', marginLeft: '8px' }}>
                    {v.type === 'price' ? `£${v.poValue.toFixed(2)} → £${v.invoiceValue.toFixed(2)}` : `GRN: ${v.grnValue} vs Invoice: ${v.invoiceValue}`}
                  </span>
                </div>
                {auto ? (
                  <span
                    title={auto.note}
                    style={{
                      display: 'inline-flex', alignItems: 'center', gap: '5px',
                      padding: '3px 10px', borderRadius: '100px',
                      fontSize: '11px', fontWeight: 700,
                      background: '#fff',
                      color: 'var(--color-text-secondary)',
                      border: '1px solid var(--color-border-subtle)',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    ✨ Auto-accepted
                  </span>
                ) : (
                  <StatusBadge status={res ?? 'Unresolved'} variant={res ? 'success' : 'error'} />
                )}
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
              <span style={{ fontSize: '12px', fontWeight: 500, color: 'var(--color-text-secondary)', marginLeft: '6px' }}>Cost stays at £{v.poValue.toFixed(2)}</span>
            </li>
          ))}
          {poContexts.map(ctx => (
            <li key={ctx.poNumber}>
              {ctx.overInvoiceIfApproved ? (
                <>
                  <strong>{ctx.poNumber}</strong> ends <strong>£{ctx.overBy.toFixed(2)}</strong> above PO amount
                  <span style={{ fontSize: '12px', fontWeight: 500, color: 'var(--color-text-secondary)', marginLeft: '6px' }}>Accounted for in your variance resolutions above</span>
                </>
              ) : ctx.closesIfApproved ? (
                <>
                  <strong>{ctx.poNumber}</strong> closes — fully invoiced at £{ctx.poAmount.toFixed(2)}
                  <span style={{ fontSize: '12px', fontWeight: 500, color: 'var(--color-text-secondary)', marginLeft: '6px' }}>PO marked complete</span>
                </>
              ) : (
                <>
                  <strong>{ctx.poNumber}</strong> stays open — £{(ctx.poAmount - ctx.afterThisAmount).toFixed(2)} remaining after this invoice
                </>
              )}
            </li>
          ))}
          {isBulk ? (
            <li><strong>{bulkInvoices.length} invoices</strong> pushed to Xero in one batch (account codes mapped, total £{bulkTotal.toFixed(2)})</li>
          ) : (
            <li>Invoice pushed to Xero (account codes mapped)</li>
          )}
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
          {isBulk ? `Approve ${bulkInvoices.length} invoices & Sync` : 'Approve & Sync'}
        </button>
      </div>
    </div>
  );
}
