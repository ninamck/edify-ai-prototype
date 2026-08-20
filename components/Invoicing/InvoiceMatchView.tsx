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
  getDeliveryReconciledSubstitutions,
  getSuggestedGRN,
  getCandidateGRNs,
  CandidateGRNWithData,
  resolveAmbiguousMatch,
  setDuplicateConfirmed,
  getPOContextForInvoice,
  getPOsForInvoice,
  POContextForInvoice,
  getAutoStatusNote,
  AutoStatusNote as AutoStatusNoteData,
  getInvoiceStatusBadgeVariant,
  categorizeSku,
  defaultVatRate,
  vatCategoryLabel,
  VatCategory,
  GRN,
  DeliveryReconciledSubstitution,
  saveApprovedResolutions,
  PARSE_CONFIDENCE_THRESHOLD,
} from './mockData';
import {
  AUTO_APPLIED_VARIANCES,
  getAutoAppliedForVariance,
  getAISuggestion,
} from '@/components/InvoicingRules/mockData';
import Link from 'next/link';
import { MOCK_POS, MOCK_COMPLETED_DELIVERIES, PO } from '@/components/Receiving/mockData';
import PODocDrawer from './PODocDrawer';
import InvoiceDocDrawer from './InvoiceDocDrawer';
import GRNDocDrawer from './GRNDocDrawer';
import { BASE_CURRENCY, currencySymbol, formatMoney, type CurrencyCode } from '@/lib/currency';

interface InvoiceMatchViewProps {
  invoice: Invoice;
  onApprove: (approvedIds: string[]) => void;
  onBack: () => void;
}

// Variance highlight treatment — amber accents (bars, borders, badge fills)
// carry the warning signal; the text itself stays neutral so it never needs a
// dark legible yellow, which is what reads as brown.
const VARIANCE_ACCENT = '#001C35';
const VARIANCE_BADGE_BG = '#FEF6DA';
const VARIANCE_BADGE_BG_ACTIVE = '#F6E9CD';

// Parse-confidence badge: green = good, amber = maybe, red = warning.
// Amber starts below PARSE_CONFIDENCE_THRESHOLD (90); red below 75.
// Backgrounds are faded but fully opaque (pre-blended against white) so the
// row colour underneath never bleeds through the badge.
const PARSE_CONFIDENCE_RED = 75;
function confidenceBadgeStyle(score: number): React.CSSProperties {
  const base: React.CSSProperties = {
    display: 'inline-flex', alignItems: 'center',
    fontSize: '10px', fontWeight: 700, padding: '2px 7px', borderRadius: '4px',
    whiteSpace: 'nowrap',
  };
  if (score < PARSE_CONFIDENCE_RED) {
    return { ...base, background: '#FCE5EB', color: 'var(--color-error)', border: '1px solid #F5B5B5' };
  }
  if (score < PARSE_CONFIDENCE_THRESHOLD) {
    return { ...base, background: VARIANCE_BADGE_BG, color: VARIANCE_ACCENT, border: `1px solid ${VARIANCE_ACCENT}` };
  }
  return { ...base, background: '#E9F4ED', color: '#157535', border: '1px solid #B9DFC6' };
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
    price: { bg: 'var(--color-warning-light)', color: 'var(--color-warning)', border: 'var(--color-warning-border)' },
    qty: { bg: 'rgba(25, 20, 132, 0.08)', color: 'var(--color-info)', border: 'rgba(25, 20, 132, 0.25)' },
    'over-invoice': { bg: 'rgba(176, 16, 56, 0.09)', color: 'var(--color-error)', border: 'rgba(176, 16, 56, 0.3)' },
  };
  const s = styles[type];
  return (
    <span style={{ fontSize: '11px', fontWeight: 700, padding: '2px 7px', borderRadius: '4px', background: s.bg, color: s.color, border: `1px solid ${s.border}` }}>
      {varianceLabel(type)}
    </span>
  );
}

function varianceShortLabel(variance: MatchVariance, priceDiff: number, sym = '$'): string {
  if (variance.type === 'price') return `${priceDiff > 0 ? '+' : ''}${sym}${Math.abs(priceDiff).toFixed(2)}`;
  if (variance.type === 'over-invoice') return `+${variance.invoiceValue - variance.poValue} over`;
  return `${variance.invoiceValue > variance.grnValue ? '+' : ''}${variance.invoiceValue - variance.grnValue} unit${Math.abs(variance.invoiceValue - variance.grnValue) !== 1 ? 's' : ''}`;
}

function varianceDetailText(variance: MatchVariance, sym = '$'): string {
  if (variance.type === 'price') {
    const d = variance.invoiceValue - variance.poValue;
    return `PO: ${sym}${variance.poValue.toFixed(2)} → Invoice: ${sym}${variance.invoiceValue.toFixed(2)} (${d >= 0 ? '+' : ''}${sym}${d.toFixed(2)}/unit)`;
  }
  if (variance.type === 'over-invoice') {
    const extra = variance.invoiceValue - variance.poValue;
    return `PO ordered ${variance.poValue} · Invoice bills ${variance.invoiceValue} (+${extra} over)`;
  }
  return `GRN: ${variance.grnValue} → Invoice claims: ${variance.invoiceValue}`;
}

export default function InvoiceMatchView({ invoice, onApprove, onBack }: InvoiceMatchViewProps) {
  // Foreign-currency invoices (e.g. CAD from Second Cup Central Supply) are
  // matched in the supplier's original currency; the base (GBP) translation
  // is shown alongside at the rate locked at goods receipt.
  const invCurrency: CurrencyCode = invoice.currency ?? BASE_CURRENCY;
  const isForeignCurrency = invCurrency !== BASE_CURRENCY;
  const lockedRate = invoice.lockedFxRate ?? 1;
  const toBaseAtLockedRate = (amount: number) => amount * lockedRate;

  const [resolutions, setResolutions] = useState<Record<string, AnyResolution>>({});
  const [showConfirm, setShowConfirm] = useState(false);
  // Forces a re-render after mutating the invoice in place (updateInvoiceLine,
  // resolveAmbiguousMatch). Included in memo deps so derived data recomputes.
  const [editBump, setEditBump] = useState(0);
  const bumpEdits = () => setEditBump(b => b + 1);
  // Auto-link the system-suggested GRN on mount. User can unlink from the chip banner if wrong.
  const initialSuggested = getSuggestedGRN(invoice);
  const [linkedGRNs, setLinkedGRNs] = useState<string[]>(
    initialSuggested ? [initialSuggested.grnNumber] : []
  );

  const suggestedGRN = getSuggestedGRN(invoice);
  // Ambiguous match — system found multiple plausible GRNs and won't guess.
  const candidateGRNs = useMemo(() => getCandidateGRNs(invoice), [invoice, editBump]);
  const needsManualMatch = invoice.status === 'Needs GRN Match' && candidateGRNs.length > 0;
  const poContexts = useMemo(() => getPOContextForInvoice(invoice), [invoice, editBump]);
  const siblingInvoicesAcrossPOs = useMemo(() => {
    const seen = new Set<string>();
    const out: Invoice[] = [];
    for (const ctx of poContexts) {
      for (const other of [...ctx.priorInvoices, ...ctx.laterInvoices]) {
        if (other.id === invoice.id || seen.has(other.id)) continue;
        seen.add(other.id);
        out.push(other);
      }
    }
    return out;
  }, [poContexts, invoice.id]);

  const grns = useMemo(() => getGRNsForInvoice(invoice, linkedGRNs), [invoice, linkedGRNs, editBump]);
  const grnTotal = useMemo(() => invoiceGRNTotal(invoice, linkedGRNs), [invoice, linkedGRNs, editBump]);
  const unmatchedLines = useMemo(() => getUnmatchedInvoiceLines(invoice, linkedGRNs), [invoice, linkedGRNs, editBump]);
  const deliverySubstitutions = useMemo(
    () => getDeliveryReconciledSubstitutions(invoice, linkedGRNs),
    [invoice, linkedGRNs, editBump],
  );
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
    for (const ctx of poContexts) {
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
  const awaitingDelivery = grns.length === 0 && invoice.lines.length > 0 && invoice.status !== 'Parse Failed' && invoice.status !== 'Duplicate' && !needsManualMatch;
  const [overrideDuplicate, setOverrideDuplicate] = useState(false);
  const isDuplicate = invoice.status === 'Duplicate';
  const duplicateConfirmed = !!invoice.duplicateConfirmed;
  const canApprove = (noVariances || allResolved) && !awaitingDelivery && !needsManualMatch && (!isDuplicate || overrideDuplicate) && !duplicateConfirmed;

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
    if (needsManualMatch) return null; // the picker card owns GRN selection here
    const excluded = new Set([...linkedGRNs, ...dismissedGRNs, ...invoice.grnNumbers]);
    const candidate = MOCK_COMPLETED_DELIVERIES.find(g =>
      g.supplier === invoice.supplier &&
      !excluded.has(g.grnNumber)
    );
    return candidate ?? null;
  }, [hasUnmatched, autoLinkedGRN, needsManualMatch, linkedGRNs, dismissedGRNs, invoice.supplier, invoice.grnNumbers]);

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

      {/* Foreign-currency invoice: matched in the supplier's original currency,
          with the base (GBP) translation at the rate locked at goods receipt. */}
      {isForeignCurrency && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap',
          padding: '10px 14px', borderRadius: '10px', marginBottom: '16px',
          background: 'rgba(25, 20, 132, 0.06)',
          border: '1px solid rgba(25, 20, 132, 0.25)',
          fontSize: '12.5px', color: 'var(--color-text-secondary)',
        }}>
          <span style={{
            padding: '2px 9px', borderRadius: '100px',
            background: 'var(--color-info)', color: '#fff',
            fontSize: '11px', fontWeight: 700, letterSpacing: '0.02em',
          }}>
            Invoiced in {invCurrency}
          </span>
          <span style={{ fontWeight: 600, color: 'var(--color-text-primary)' }}>
            Matched against the {invCurrency} PO · booked at 1 {invCurrency} = {lockedRate} USD (locked at receipt)
          </span>
          <span>
            The {BASE_CURRENCY} translation is stored alongside the original — never replacing it.
          </span>
        </div>
      )}

      {/* Summary cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px', marginBottom: '24px' }}>
        <MatchSummaryCard
          label="GRN Total"
          value={formatMoney(grnTotal, invCurrency)}
          sub={(grns.length > 0
            ? `${grns.length} GRN${grns.length === 1 ? '' : 's'}${hasUnmatched ? ' (partial)' : ''}`
            : '—')
            + (isForeignCurrency ? ` · ${formatMoney(toBaseAtLockedRate(grnTotal), BASE_CURRENCY)}` : '')
          }
          variant="default"
        />
        <MatchSummaryCard
          label="Invoice Total"
          value={formatMoney(invoice.total + totalTax, invCurrency)}
          sub={isForeignCurrency
            ? `${formatMoney(toBaseAtLockedRate(invoice.total + totalTax), BASE_CURRENCY)} at locked rate`
            : anyTax ? `Incl. VAT · Ex-VAT $${invoice.total.toFixed(2)}` : 'Per supplier invoice'}
          variant="default"
        />
        <MatchSummaryCard
          label="VAT"
          value={formatMoney(totalTax, invCurrency)}
          sub="Total VAT on this invoice"
          variant="default"
        />
        <MatchSummaryCard
          label="Variance"
          value={varianceTotal === 0 ? formatMoney(0, invCurrency) : `${varianceTotal > 0 ? '+' : ''}${formatMoney(varianceTotal, invCurrency)}`}
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

      {/* Auto-generated status note — system-authored, based on invoice state.
          Suppressed for Variance: the badge states it and the progress banner
          below the table carries the note text, so a third card is repetition. */}
      {invoice.status !== 'Variance' && <AutoStatusNoteCard invoice={invoice} />}

      {/* Ambiguous match — system found several plausible GRNs, reviewer picks (blocker — full card) */}
      {needsManualMatch && (
        <AmbiguousGRNPicker
          invoice={invoice}
          candidates={candidateGRNs}
          onConfirm={(grnNumbers) => {
            resolveAmbiguousMatch(invoice.id, grnNumbers);
            bumpEdits();
          }}
        />
      )}

      {/* Awaiting delivery — no GRN linked yet (blocker — full card) */}
      {awaitingDelivery && (
        <AwaitingDeliveryBanner invoice={invoice} />
      )}

      {/* Duplicate detection — invoice references a PO that may already be closed (blocker — full card) */}
      {isDuplicate && (
        <DuplicateInvoiceBanner
          invoice={invoice}
          overridden={overrideDuplicate}
          onOverride={() => setOverrideDuplicate(true)}
          confirmed={duplicateConfirmed}
          onConfirmDuplicate={() => { setDuplicateConfirmed(invoice.id, true); bumpEdits(); }}
          onUndoConfirm={() => { setDuplicateConfirmed(invoice.id, false); bumpEdits(); }}
        />
      )}

      {/* Context chips — non-blocker signals collapsed into a pill row, expand on click */}
      {(() => {
        const chips: { id: string; icon: string; label: string; tone: 'neutral' | 'info' | 'success' | 'warning' | 'error'; content: React.ReactNode }[] = [];

        if (deliverySubstitutions.length > 0) {
          chips.push({
            id: 'delivery-substitution',
            icon: '✓',
            label: `${deliverySubstitutions.length} delivery alternative${deliverySubstitutions.length === 1 ? '' : 's'} reconciled`,
            tone: 'success',
            content: <DeliverySubstitutionBanner substitutions={deliverySubstitutions} />,
          });
        }

        if (!autoLinkedGRN && alternateSuggestion) {
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

      {/* GRN provenance footnote — how the link was made, with the undo beside it.
          Lives under the table with the other footnotes instead of a chip up top. */}
      {autoLinkedGRN && (
        <div style={{ marginTop: '10px', padding: '9px 14px', borderRadius: '10px', background: '#fff', border: '1px solid var(--color-border-subtle)', fontSize: '12px', color: 'var(--color-text-secondary)', display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <span aria-hidden>✨</span>
          <span>
            <strong style={{ color: 'var(--color-text-primary)' }}>{autoLinkedGRN.grnNumber}</strong> linked automatically — supplier and line items match
            {!hasUnmatched && linkedGRNs.length > 0 && ` · all ${invoice.lines.length} lines covered`}
          </span>
          <button
            onClick={() => handleUnlinkGRN(autoLinkedGRN.grnNumber)}
            title="Wrong delivery? Unlink it and we'll suggest another."
            style={{ marginLeft: 'auto', padding: '4px 10px', borderRadius: '6px', background: 'transparent', border: '1px solid var(--color-border)', fontSize: '11px', fontWeight: 600, fontFamily: 'var(--font-primary)', color: 'var(--color-text-primary)', cursor: 'pointer', whiteSpace: 'nowrap' }}
          >
            Unlink
          </button>
        </div>
      )}

      {/* Variance status banner */}
      {invoice.variances.length > 0 && !hasUnmatched && (
        <div style={{ marginTop: '16px' }}>
          {allResolved ? (
            <div style={{ padding: '12px 16px', borderRadius: '12px', background: '#fff', border: '1px solid var(--color-border-subtle)', borderLeft: '3px solid var(--color-success)', fontSize: '13px', fontWeight: 600, color: 'var(--color-text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ color: 'var(--color-success)', fontWeight: 700 }}>✓</span>
              All variances resolved. Ready for approval.
            </div>
          ) : (
            <div style={{ padding: '12px 16px', borderRadius: '12px', background: VARIANCE_BADGE_BG, border: `1px solid ${VARIANCE_ACCENT}`, fontSize: '13px', color: 'var(--color-text-primary)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 500 }}>
                <span style={{ fontWeight: 700 }}>{invoice.variances.filter(resolvedOrAuto).length} of {invoice.variances.length} variances resolved{autoAppliedIds.size > 0 ? ` (${autoAppliedIds.size} auto ✨)` : ''}</span>
                <span>— click the amber badge on any highlighted row to resolve.</span>
              </div>
              {/* System status note folded in — was its own card above the table */}
              {invoice.status === 'Variance' && (() => {
                const note = getAutoStatusNote(invoice);
                return note ? (
                  <div style={{ marginTop: '6px', fontSize: '12px', fontWeight: 500, color: 'var(--color-text-secondary)' }}>
                    ✨ {note.text}
                  </div>
                ) : null;
              })()}
            </div>
          )}
        </div>
      )}

      {/* AI price-pattern insight — advisory, so it sits below the state banners */}
      {aiSuggestion && (
        <div style={{ marginTop: '16px' }}>
          <AISuggestionBanner suggestion={aiSuggestion} onDismiss={() => setDismissAISuggestion(true)} />
        </div>
      )}

      {/* Colleague comment — free-form, human-written, separate from status */}
      <div style={{ marginTop: '16px' }}>
        <InvoiceCommentSection
          initialNote={invoice.note ?? ''}
          initialAuthor={invoice.noteAuthor}
          initialUpdatedAt={invoice.noteUpdatedAt}
        />
      </div>
    </div>
  );
}

/* ──────────── Match Context Bar (chip strip with accordion) ──────────── */

function MatchContextBar({ chips, initialExpandedId }: {
  chips: { id: string; icon: string; label: string; tone: 'neutral' | 'info' | 'success' | 'warning' | 'error'; content: React.ReactNode }[];
  initialExpandedId: string | null;
}) {
  const [expandedId, setExpandedId] = useState<string | null>(initialExpandedId);
  type Tone = 'neutral' | 'info' | 'success' | 'warning' | 'error';
  const palette: Record<Tone, { bg: string; bgActive: string; color: string; border: string }> = {
    neutral: { bg: 'var(--color-bg-hover)', bgActive: 'rgba(0, 28, 53,0.08)', color: 'var(--color-text-primary)', border: 'var(--color-border-subtle)' },
    info: { bg: 'rgba(25, 20, 132, 0.06)', bgActive: 'rgba(25, 20, 132, 0.14)', color: 'var(--color-info)', border: 'rgba(25, 20, 132, 0.3)' },
    success: { bg: 'rgba(22, 101, 52, 0.06)', bgActive: 'rgba(22, 101, 52, 0.14)', color: 'var(--color-success)', border: 'var(--color-success-border)' },
    warning: { bg: 'var(--color-warning-bg)', bgActive: 'var(--color-warning-light)', color: 'var(--color-warning)', border: 'var(--color-warning-border)' },
    error: { bg: 'rgba(176, 16, 56, 0.08)', bgActive: 'rgba(176, 16, 56, 0.16)', color: 'var(--color-error)', border: 'var(--color-error-border)' },
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

function DeliverySubstitutionBanner({ substitutions }: { substitutions: DeliveryReconciledSubstitution[] }) {
  return (
    <div style={{
      padding: '14px 18px',
      borderRadius: '12px',
      background: 'rgba(22, 101, 52, 0.06)',
      border: '1px solid var(--color-success-border)',
      marginBottom: '20px',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
        <span style={{ fontSize: '16px', color: 'var(--color-success)' }}>✓</span>
        <span style={{ fontWeight: 700, fontSize: '14px', color: 'var(--color-text-primary)' }}>
          Alternative item already reconciled at delivery
        </span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {substitutions.map(({ grnNumber, invoiceLine, grnLine }) => (
          <div key={`${grnNumber}-${grnLine.id}`} style={{ fontSize: '13px', color: 'var(--color-text-primary)', lineHeight: 1.45 }}>
            <strong>{invoiceLine.description}</strong> on the invoice matches <strong>{grnLine.name}</strong> on {grnNumber}.
            {' '}The PO ordered <strong>{grnLine.alternativeFor?.poName}</strong>, but receiving marked it as an alternative product, linked it to the master product, and captured the delivered cost.
            <div style={{ marginTop: '4px', fontSize: '12px', color: 'var(--color-text-secondary)' }}>
              Invoice/GRN: {invoiceLine.qty} × ${invoiceLine.unitPrice.toFixed(2)} · PO item replaced: {grnLine.alternativeFor?.poSku}
            </div>
          </div>
        ))}
      </div>
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
            boxShadow: '0 8px 24px rgba(0, 28, 53,0.12)',
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
      background: 'linear-gradient(135deg, rgba(34, 68, 68, 0.05), rgba(25, 20, 132, 0.05))',
      border: '1px solid rgba(34, 68, 68, 0.2)',
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

/* ──────────── Ambiguous GRN match — reviewer picks the delivery ──────────── */

function AmbiguousGRNPicker({ invoice, candidates, onConfirm }: {
  invoice: Invoice;
  candidates: CandidateGRNWithData[];
  onConfirm: (grnNumbers: string[]) => void;
}) {
  const [selected, setSelected] = useState<string | null>(null);

  const grnTotalOf = (c: CandidateGRNWithData) =>
    c.grn.lines.reduce((s, l) => s + l.receivedQty * l.price, 0);

  return (
    <div style={{
      padding: '18px 20px',
      borderRadius: '12px',
      background: VARIANCE_BADGE_BG,
      border: `1px solid ${VARIANCE_ACCENT}`,
      marginBottom: '20px',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
        <span style={{ fontSize: '16px' }}>🔍</span>
        <span style={{ fontWeight: 700, fontSize: '14px', color: 'var(--color-text-primary)' }}>
          Which delivery does this invoice bill?
        </span>
      </div>
      <p style={{ fontSize: '13px', color: 'var(--color-text-primary)', margin: '0 0 14px', lineHeight: 1.5 }}>
        {invoice.invoiceNumber} doesn&rsquo;t quote a delivery note, and <strong>{candidates.length} deliveries</strong> from {invoice.supplier} fit it
        {invoice.poNumbers && invoice.poNumbers.length > 0 ? <> — both received against <strong>{invoice.poNumbers.join(', ')}</strong> and still awaiting an invoice</> : null}.
        The match won&rsquo;t run on a guess: pick the delivery this invoice covers.
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '12px', marginBottom: '14px' }}>
        {candidates.map(c => {
          const isSelected = selected === c.grnNumber;
          return (
            <button
              key={c.grnNumber}
              onClick={() => setSelected(c.grnNumber)}
              style={{
                textAlign: 'left',
                padding: '14px 16px',
                borderRadius: '10px',
                background: '#fff',
                border: isSelected ? `2px solid ${VARIANCE_ACCENT}` : '1px solid var(--color-border)',
                cursor: 'pointer',
                fontFamily: 'var(--font-primary)',
                boxShadow: isSelected ? '0 2px 8px rgba(234, 209, 115, 0.3)' : 'none',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', marginBottom: '6px' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span aria-hidden="true" style={{
                    width: '16px', height: '16px', borderRadius: '50%', flexShrink: 0,
                    border: isSelected ? `5px solid ${VARIANCE_ACCENT}` : '2px solid var(--color-border)',
                    background: '#fff',
                    display: 'inline-block',
                  }} />
                  <span style={{ fontWeight: 700, fontSize: '14px', color: 'var(--color-text-primary)' }}>{c.grn.grnNumber}</span>
                </span>
                <span style={{
                  fontSize: '11px', fontWeight: 700, padding: '2px 8px', borderRadius: '100px',
                  background: VARIANCE_BADGE_BG, border: `1px solid ${VARIANCE_ACCENT}`, color: 'var(--color-text-primary)',
                }}>
                  {c.confidence}% match
                </span>
              </div>
              <div style={{ fontSize: '12px', color: 'var(--color-text-secondary)', marginBottom: '10px' }}>
                Received {c.grn.dateReceived} · {c.grn.receivedBy} · {c.grn.poNumbers.join(', ')}
              </div>

              {/* Line-by-line comparison vs the invoice */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginBottom: '10px' }}>
                {invoice.lines.map(il => {
                  const gl = c.grn.lines.find(l => l.sku === il.sku);
                  const received = gl?.receivedQty ?? 0;
                  const matches = received === il.qty;
                  return (
                    <div key={il.id} style={{ display: 'flex', justifyContent: 'space-between', gap: '8px', fontSize: '12px' }}>
                      <span style={{ color: 'var(--color-text-primary)' }}>{il.description}</span>
                      <span style={{ whiteSpace: 'nowrap', fontWeight: 600, color: matches ? 'var(--color-success)' : VARIANCE_ACCENT }}>
                        {matches
                          ? `${il.qty} billed = ${received} received ✓`
                          : `${il.qty} billed vs ${received} received`}
                      </span>
                    </div>
                  );
                })}
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', paddingTop: '8px', borderTop: '1px solid var(--color-border-subtle)' }}>
                <span style={{ color: 'var(--color-text-secondary)' }}>GRN total vs invoice ${invoice.total.toFixed(2)}</span>
                <span style={{ fontWeight: 700, color: 'var(--color-text-primary)' }}>${grnTotalOf(c).toFixed(2)}</span>
              </div>
              <p style={{ fontSize: '11px', color: 'var(--color-text-secondary)', margin: '8px 0 0', lineHeight: 1.45 }}>
                {c.reason}
              </p>
            </button>
          );
        })}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
        <button
          disabled={!selected}
          onClick={() => selected && onConfirm([selected])}
          style={{
            padding: '9px 18px',
            borderRadius: '8px',
            background: selected ? 'var(--color-accent-active)' : 'var(--color-bg-hover)',
            color: selected ? '#fff' : 'var(--color-text-secondary)',
            border: selected ? 'none' : '1px solid var(--color-border)',
            fontSize: '13px', fontWeight: 700,
            fontFamily: 'var(--font-primary)',
            cursor: selected ? 'pointer' : 'not-allowed',
          }}
        >
          {selected ? `Link ${selected} & run match` : 'Select a delivery to continue'}
        </button>
        <span style={{ fontSize: '12px', color: 'var(--color-text-secondary)' }}>
          Not one of these? Check <Link href="/receive" style={{ color: 'var(--color-accent-deep)', fontWeight: 600 }}>Receiving</Link> — the delivery may not be logged yet.
        </span>
      </div>
    </div>
  );
}

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

function DuplicateInvoiceBanner({ invoice, overridden, onOverride, confirmed, onConfirmDuplicate, onUndoConfirm }: {
  invoice: Invoice;
  overridden: boolean;
  onOverride: () => void;
  confirmed: boolean;
  onConfirmDuplicate: () => void;
  onUndoConfirm: () => void;
}) {
  const siblings = MOCK_INVOICES.filter(i => i.id !== invoice.id && i.invoiceNumber === invoice.invoiceNumber);

  // Confirmed duplicate — resolved state: neutral card, invoice discarded
  if (confirmed) {
    return (
      <div style={{
        padding: '18px 20px',
        borderRadius: '12px',
        background: '#fff',
        border: '1px solid var(--color-border-subtle)',
        borderLeft: '3px solid var(--color-error)',
        marginBottom: '20px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
          <span style={{ color: 'var(--color-error)', fontWeight: 700, fontSize: '14px' }}>✓</span>
          <span style={{ fontWeight: 700, fontSize: '14px', color: 'var(--color-text-primary)' }}>
            Confirmed duplicate — discarded
          </span>
        </div>
        <p style={{ fontSize: '13px', color: 'var(--color-text-primary)', margin: '0 0 12px', lineHeight: 1.5 }}>
          {invoice.invoiceNumber} has been removed from the review queue and will not sync to Xero.
          {siblings.length > 0 ? <> The original invoice stays untouched.</> : null} {invoice.supplier} won&rsquo;t
          be paid twice.
        </p>
        <button
          onClick={onUndoConfirm}
          style={{
            padding: '8px 16px',
            borderRadius: '8px',
            background: 'transparent',
            border: '1px solid var(--color-border)',
            fontSize: '12px', fontWeight: 600,
            fontFamily: 'var(--font-primary)',
            color: 'var(--color-text-secondary)',
            cursor: 'pointer',
          }}
        >
          Undo — flagged this by mistake
        </button>
      </div>
    );
  }

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
              onClick={onConfirmDuplicate}
              style={{
                padding: '8px 16px',
                borderRadius: '8px',
                background: 'var(--color-error)',
                border: 'none',
                fontSize: '12px', fontWeight: 700,
                fontFamily: 'var(--font-primary)',
                color: '#fff',
                cursor: 'pointer',
              }}
            >
              Confirm duplicate · discard
            </button>
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
          </>
        )}
      </div>
    </div>
  );
}

/* ──────────── Suggest GRN Banner ──────────── */

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
      border: '1px solid rgba(25, 20, 132, 0.2)',
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
            border: '1px solid rgba(25, 20, 132, 0.15)',
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
    info:    { bg: 'var(--color-info-light)',    border: 'rgba(25, 20, 132, 0.2)',      icon: 'ℹ',  iconColor: 'var(--color-info)' },
    warning: { bg: 'var(--color-bg-surface)',    border: 'var(--color-warning)',        icon: '⚠', iconColor: 'var(--color-warning)' },
    error:   { bg: 'var(--color-error-light)',   border: 'var(--color-error-border)',   icon: '⚠', iconColor: 'var(--color-error)' },
    success: { bg: 'var(--color-bg-surface)',    border: 'var(--color-success-border)', icon: '✓', iconColor: 'var(--color-success)' },
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

/* ──────────── Document map strip ────────────
   Answers "how many documents am I looking at?" before the user reads a single
   line item. Counts are stated as numerals + words, never implied by layout. */

const docMapChip: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: '5px',
  padding: '2px 9px', borderRadius: '100px',
  background: '#fff', border: '1px solid var(--color-border)',
  fontSize: '11px', fontWeight: 700, whiteSpace: 'nowrap',
  color: 'var(--color-text-primary)', lineHeight: 1.4,
};

function DocMapSegment({ count, noun, children }: { count: number; noun: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '7px', flexWrap: 'wrap' }}>
      <span style={{ fontSize: '18px', fontWeight: 800, color: 'var(--color-text-primary)', lineHeight: 1 }}>{count}</span>
      <span style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', color: 'var(--color-text-secondary)' }}>
        {noun}{count === 1 ? '' : 's'}
      </span>
      {children}
    </div>
  );
}

function DocMapStrip({ invoices, currentInvoiceId, grns, poNumbers }: {
  invoices: Invoice[];
  currentInvoiceId: string;
  grns: GRN[];
  poNumbers: string[];
}) {
  const connector = <span aria-hidden="true" style={{ color: 'var(--color-text-secondary)', fontSize: '13px', opacity: 0.6 }}>⇄</span>;
  const none = <span style={{ fontSize: '11px', color: 'var(--color-text-secondary)', fontWeight: 600 }}>none linked</span>;
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap',
      padding: '10px 16px',
      background: 'var(--color-bg-subtle, #fafafa)',
      borderBottom: '1px solid var(--color-border-subtle)',
    }}>
      <DocMapSegment count={invoices.length} noun="invoice">
        {invoices.map(inv => {
          const isCurrent = inv.id === currentInvoiceId;
          const highlight = isCurrent && invoices.length > 1;
          return (
            <span
              key={inv.id}
              style={{
                ...docMapChip,
                ...(highlight ? { border: '1.5px solid var(--color-accent-active)', color: 'var(--color-accent-active)' } : {}),
              }}
            >
              {inv.invoiceNumber}
              {highlight && <span style={{ fontSize: '9px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' }}>· this one</span>}
            </span>
          );
        })}
      </DocMapSegment>
      {connector}
      <DocMapSegment count={grns.length} noun="GRN">
        {grns.length === 0 ? none : grns.map(g => (
          <span key={g.id} style={docMapChip} title={`Received ${g.dateReceived}`}>{g.grnNumber}</span>
        ))}
      </DocMapSegment>
      {connector}
      <DocMapSegment count={poNumbers.length} noun="PO">
        {poNumbers.length === 0 ? none : poNumbers.map(po => (
          <span key={po} style={docMapChip}>{po}</span>
        ))}
      </DocMapSegment>
    </div>
  );
}

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
  const [expandedVariance, setExpandedVariance] = useState<string | null>(null);
  const [showDoc, setShowDoc] = useState(false);
  // Manual override: lets the reviewer edit every invoice field when the
  // parse came through wrong, even on invoices that matched automatically.
  const [manualEdit, setManualEdit] = useState(false);
  const editable = invoice.editable === true || manualEdit;
  // Clean-matched lines collapse into a summary band so exceptions carry the
  // page; expanding restores full verifiability.
  const [expandedCleanGroups, setExpandedCleanGroups] = useState<Set<string>>(new Set());
  const toggleCleanGroup = (key: string) => setExpandedCleanGroups(prev => {
    const next = new Set(prev);
    if (next.has(key)) next.delete(key); else next.add(key);
    return next;
  });
  // Per-delivery split for a SKU received across several GRNs. Rows with an
  // open variance default to split (you can't judge a discrepancy without
  // seeing which delivery it sits on); the override lets the user toggle.
  const [splitOverrides, setSplitOverrides] = useState<Record<string, boolean>>({});
  // GRN detail drawer — opened from delivery chips or the panel header
  const [showGRN, setShowGRN] = useState<GRN | null>(null);
  // PO drawer — the order behind the agreed prices, opened from header chips
  const [showPO, setShowPO] = useState<PO | null>(null);
  // Amounts render in the invoice's own currency (CAD for Second Cup Central
  // Supply); GBP invoices keep the familiar $.
  const sym = currencySymbol(invoice.currency ?? BASE_CURRENCY);

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
      <span style={{ color: 'var(--color-text-secondary)', fontSize: '12px' }}>{sym}</span>
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
      alternativeFor: gl.alternativeFor,
      matched: !invoice.variances.some(v => v.sku === gl.sku),
    }));
    const pos = MOCK_POS.filter(p => grn.poNumbers.includes(p.poNumber));
    return { grn, lines, pos };
  });

  const multiGroup = grns.length > 1;
  const matchedSkus = new Set(grnGroups.flatMap(g => g.lines.map(l => l.sku)));
  const unmatchedInvRows = invoice.lines.filter(il => !matchedSkus.has(il.sku));

  // ── Merged lines across all deliveries, hoisted from the table body so the
  // clean-lines summary can live outside the table as a footnote. A SKU
  // delivered across several GRNs becomes one aggregated row (quantities
  // summed, prices never blended). ──
  type DeliverySource = { grn: GRN; orderedQty: number; receivedQty: number; unitPrice: number; lineTotal: number };
  type MergedLine = {
    sku: string;
    description: string;
    alternativeFor?: (typeof grnGroups)[number]['lines'][number]['alternativeFor'];
    sources: DeliverySource[];
    orderedQty: number;
    receivedQty: number;
    lineTotal: number;
    unitPrice: number | null; // null = differs between deliveries
  };
  const bySku = new Map<string, MergedLine>();
  const mergedLines: MergedLine[] = [];
  grnGroups.forEach(({ grn, lines: glines }) => glines.forEach(l => {
    let m = bySku.get(l.sku);
    if (!m) {
      m = { sku: l.sku, description: l.description, alternativeFor: l.alternativeFor, sources: [], orderedQty: 0, receivedQty: 0, lineTotal: 0, unitPrice: null };
      bySku.set(l.sku, m);
      mergedLines.push(m);
    }
    m.alternativeFor = m.alternativeFor ?? l.alternativeFor;
    m.sources.push({ grn, orderedQty: l.orderedQty, receivedQty: l.receivedQty, unitPrice: l.unitPrice, lineTotal: l.lineTotal });
    m.orderedQty += l.orderedQty;
    m.receivedQty += l.receivedQty;
    m.lineTotal += l.lineTotal;
  }));
  // A summed quantity is real; an averaged price is fiction — never blend.
  mergedLines.forEach(m => {
    m.unitPrice = new Set(m.sources.map(s => s.unitPrice)).size === 1 ? m.sources[0].unitPrice : null;
  });

  const isSignalLine = (m: MergedLine) => {
    const invLine = invoice.lines.find(il => il.sku === m.sku);
    if (!invLine) return true; // GRN line the invoice doesn't bill — worth seeing
    const variance = invoice.variances.find(v => v.sku === m.sku);
    const priceVar = m.sources.some(s => s.unitPrice !== invLine.unitPrice);
    // A shakily-read line can't be called clean even if the numbers agree —
    // the agreement itself might be a misread.
    const lowParse = invLine.parseConfidence !== undefined && invLine.parseConfidence < PARSE_CONFIDENCE_THRESHOLD;
    return !!variance || priceVar || !!m.alternativeFor || m.receivedQty < m.orderedQty || lowParse;
  };
  const signalLines = mergedLines.filter(isSignalLine);
  const cleanLines = mergedLines.filter(l => !isSignalLine(l));
  // Editing needs every field on screen; a band of 1 saves nothing
  const collapseClean = !editable && cleanLines.length >= 2;
  const cleanExpanded = expandedCleanGroups.has('grn');
  const cleanInvTotal = cleanLines.reduce((s, gl) => {
    const il = invoice.lines.find(l => l.sku === gl.sku);
    return s + (il?.lineTotal ?? 0);
  }, 0);

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
  // Unique POs behind these deliveries — rendered as header chips → PO drawer
  const allPOsInView = useMemo(() => {
    const seen = new Set<string>();
    const out: PO[] = [];
    for (const g of grnGroups) for (const p of g.pos) {
      if (seen.has(p.id)) continue;
      seen.add(p.id);
      out.push(p);
    }
    return out;
  }, [grnGroups]);

  // Everything visible in this table, for the document map strip and "n of N" badges
  const allInvoicesInView = useMemo(() => [invoice, ...siblingInvoices], [invoice, siblingInvoices]);
  const allPONumbersInView = useMemo(() => Array.from(new Set([
    ...grnGroups.flatMap(g => g.pos.map(p => p.poNumber)),
    ...siblingInvoices.flatMap(s => getPOsForInvoice(s)),
  ])), [grnGroups, siblingInvoices]);
  const invoiceCountInView = allInvoicesInView.length;

  const RC = 5;

  // Numeric columns centre under their centred header labels; description
  // cells opt back out to left alignment.
  const cell: React.CSSProperties = { padding: '8px 12px', borderBottom: '1px solid var(--color-border-subtle)', fontSize: '12px', textAlign: 'center' };
  const descCell: React.CSSProperties = { textAlign: 'left' };
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
    // Choosing a rate is a correction task, not a matching task — outside edit
    // mode show the applied rate as quiet text. The one exception is a line the
    // system couldn't categorise: that prompt must stay visible to be actioned.
    if (!editable && !needsPrompt) {
      return (
        <span title={vatCategoryLabel(category)} style={{ fontSize: '11px', fontWeight: 500, color: hasRate && rate > 0 ? 'var(--color-text-primary)' : 'var(--color-text-secondary)' }}>
          {hasRate ? `${rate}%` : '—'}
        </span>
      );
    }
    return (
      <select
        value={hasRate ? rate : ''}
        onChange={e => setLineRate(lineId, Number(e.target.value))}
        title={needsPrompt ? 'Set VAT — this line is not auto-categorised' : vatCategoryLabel(category)}
        style={{
          fontSize: '11px', fontFamily: 'var(--font-primary)',
          border: needsPrompt ? `1.5px solid ${VARIANCE_ACCENT}` : '1px solid var(--color-border)',
          borderRadius: '4px',
          padding: '2px 4px',
          background: needsPrompt ? VARIANCE_BADGE_BG : '#fff',
          color: 'var(--color-text-primary)',
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
          whiteSpace: 'nowrap',
        }}>
          {resolvedLabel}<Chevron open={isOpen} />
        </button>
      );
    }

    return (
      <button onClick={toggle} title="Click to resolve" style={{
        display: 'inline-flex', alignItems: 'center', gap: '6px',
        padding: '4px 12px', borderRadius: '6px',
        border: `1.5px solid ${VARIANCE_ACCENT}`,
        background: isOpen ? VARIANCE_BADGE_BG_ACTIVE : VARIANCE_BADGE_BG,
        color: 'var(--color-text-primary)', fontWeight: 700, fontSize: '12px',
        fontFamily: 'var(--font-primary)', cursor: 'pointer', lineHeight: 1.3,
        whiteSpace: 'nowrap',
      }}>
        {label}<Chevron open={isOpen} />
      </button>
    );
  };

  return (
    <>
      <style>{`
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
        <DocMapStrip
          invoices={allInvoicesInView}
          currentInvoiceId={invoice.id}
          grns={allDisplayGRNs}
          poNumbers={allPONumbersInView}
        />
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', fontWeight: 500, tableLayout: 'fixed' }}>
          {/* Fixed column widths — without these, expanding a sibling dropdown
              adds new content that reflows every column and shifts the headers */}
          <colgroup>
            {/* Invoice side */}
            <col style={{ width: '26%' }} />
            <col style={{ width: '6%' }} />
            <col style={{ width: '8%' }} />
            <col style={{ width: '8%' }} />
            <col style={{ width: '6%' }} />
            <col style={{ width: '7%' }} />
            {/* GRN / PO side — no VAT column: a GRN carries no VAT, and deriving
                one from the invoice's rate corroborates nothing */}
            <col style={{ width: '6%' }} />
            <col style={{ width: '8%' }} />
            <col style={{ width: '7%' }} />
            <col style={{ width: '8%' }} />
            <col style={{ width: '90px' }} />
          </colgroup>

          {/* ── Panel headers ── */}
          <thead>
            <tr>
              {/* Invoice panel header */}
              <td colSpan={6} style={{ padding: '14px 16px', borderBottom: '1px solid var(--color-border-subtle)', ...divider }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', minWidth: 0 }}>
                    <span style={{ fontWeight: 700, fontSize: '14px', color: 'var(--color-text-primary)' }}>{invoice.invoiceNumber}</span>
                    <span style={{ fontSize: '12px', fontWeight: 500, color: 'var(--color-text-secondary)' }}>{invoice.date}</span>
                    {siblingInvoices.length > 0 && (
                      <span style={{ fontSize: '10px', fontWeight: 700, padding: '2px 7px', borderRadius: '4px', background: 'var(--color-accent-active)', color: '#fff', textTransform: 'uppercase', letterSpacing: '0.04em', whiteSpace: 'nowrap' }}>
                        Invoice 1 of {invoiceCountInView} · this one
                      </span>
                    )}
                    {editable && (
                      <span style={{ fontSize: '10px', fontWeight: 700, padding: '2px 7px', borderRadius: '100px', border: `1px solid ${VARIANCE_ACCENT}`, background: VARIANCE_BADGE_BG, color: 'var(--color-text-primary)', textTransform: 'uppercase', letterSpacing: '0.04em', whiteSpace: 'nowrap' }}>
                        Editing — match recalculates live
                      </span>
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
                    <button
                      onClick={() => setManualEdit(e => !e)}
                      title="Correct the invoice fields if the PDF parse came through wrong"
                      style={{
                        padding: '5px 12px', borderRadius: '6px',
                        background: manualEdit ? 'var(--color-accent-active)' : 'transparent',
                        border: manualEdit ? '1px solid var(--color-accent-active)' : '1px solid var(--color-border)',
                        fontSize: '12px', fontWeight: 600, fontFamily: 'var(--font-primary)',
                        color: manualEdit ? '#fff' : 'var(--color-text-secondary)', cursor: 'pointer', whiteSpace: 'nowrap',
                      }}
                    >
                      {manualEdit ? '✓ Done editing' : '✎ Edit invoice'}
                    </button>
                    <button
                      onClick={() => setShowDoc(true)}
                      style={{ padding: '5px 12px', borderRadius: '6px', background: 'transparent', border: '1px solid var(--color-border)', fontSize: '12px', fontWeight: 600, fontFamily: 'var(--font-primary)', color: 'var(--color-text-secondary)', cursor: 'pointer', whiteSpace: 'nowrap' }}
                    >
                      View PDF
                    </button>
                  </div>
                </div>
              </td>
              {/* GRN panel header — received quantities and agreed prices on one
                  surface; the PO behind them is a chip opening its drawer */}
              <td colSpan={RC} style={{ padding: '14px 16px', borderBottom: '1px solid var(--color-border-subtle)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px' }}>
                  <div style={{ minWidth: 0, display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                    <span style={{ fontWeight: 700, fontSize: '14px', color: 'var(--color-text-primary)', display: 'inline-flex', alignItems: 'center', gap: '4px', flexWrap: 'wrap' }}>
                      {grns.length > 0
                        ? grns.map((g, i) => (
                            <span key={g.id} style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                              {i > 0 && <span style={{ color: 'var(--color-text-secondary)', fontWeight: 500 }}>+</span>}
                              <button
                                onClick={() => setShowGRN(g)}
                                title={`Open ${g.grnNumber} — full delivery detail`}
                                style={{ padding: 0, background: 'transparent', border: 'none', cursor: 'pointer', font: 'inherit', color: 'inherit', textDecoration: 'underline', textDecorationColor: 'var(--color-border)', textUnderlineOffset: '3px' }}
                              >
                                {g.grnNumber}
                              </button>
                            </span>
                          ))
                        : 'GRN'}
                    </span>
                    <span style={{ fontSize: '12px', fontWeight: 500, color: 'var(--color-text-secondary)' }}>
                      {grns.length === 0
                        ? 'No linked GRN'
                        : grns.map(g => g.dateReceived).join(' + ')}
                    </span>
                  </div>
                  {/* Ordered against — the price authority behind the agreed prices */}
                  {allPOsInView.length > 0 && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                      <span style={{ fontSize: '11px', fontWeight: 500, color: 'var(--color-text-secondary)', whiteSpace: 'nowrap' }}>Ordered on</span>
                      {allPOsInView.map(p => (
                        <button
                          key={p.id}
                          onClick={() => setShowPO(p)}
                          title={`Open ${p.poNumber} — agreed items and prices`}
                          style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '11px', fontWeight: 700, padding: '2px 8px', borderRadius: '4px', background: 'var(--color-bg-hover)', color: 'var(--color-text-primary)', border: '1px solid var(--color-border)', cursor: 'pointer', fontFamily: 'var(--font-primary)', whiteSpace: 'nowrap' }}
                        >
                          {p.poNumber}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </td>
            </tr>

            {/* Column labels */}
            <tr>
              <th style={{ ...colLabelStyle, textAlign: 'left' }}>Description</th>
              <th style={colLabelStyle}>Qty</th>
              <th style={colLabelStyle}>Price</th>
              <th style={colLabelStyle}>Total</th>
              <th style={colLabelStyle}>VAT %</th>
              <th style={{ ...colLabelStyle, ...divider }}>VAT {sym}</th>
              <th style={colLabelStyle}>Ordered</th>
              <th style={colLabelStyle}>Received</th>
              <th style={colLabelStyle}>Price</th>
              <th style={colLabelStyle}>Total</th>
              <th style={colLabelStyle}></th>
            </tr>
          </thead>

          {/* ── GRN tab: one merged table across all deliveries. Exceptions render
              first; clean rows fold away behind the footnote below the table. ── */}
          {(() => {
                const grnChipStyle: React.CSSProperties = {
                  display: 'inline-flex', alignItems: 'center', gap: '4px',
                  fontSize: '10px', fontWeight: 700, padding: '1px 6px', borderRadius: '4px',
                  background: 'var(--color-bg-hover)', color: 'var(--color-text-secondary)',
                  border: '1px solid var(--color-border)', cursor: 'pointer',
                  fontFamily: 'var(--font-primary)', whiteSpace: 'nowrap',
                };

                const renderMergedRow = (m: MergedLine) => {
                  const invLine = invoice.lines.find(il => il.sku === m.sku);
                  const alternativeFor = m.alternativeFor;
                  const isShort = m.receivedQty < m.orderedQty;
                  const priceVar = invLine ? m.sources.some(s => s.unitPrice !== invLine.unitPrice) : false;
                  const priceDiff = invLine && m.unitPrice !== null ? invLine.unitPrice - m.unitPrice : 0;
                  const variance = invoice.variances.find(v => v.sku === m.sku);
                  const isExpanded = !!variance && expandedVariance === variance.id;
                  const isAutoApplied = !!variance && !!getAutoAppliedForVariance(variance.id);
                  const isResolved = !!variance && !!resolutions[variance.id];
                  const isCleared = isResolved || isAutoApplied;
                  const hasVar = (priceVar || variance?.type === 'qty') && !isCleared;
                  const rowBg = hasVar ? '#FEFBEE' : 'transparent';
                  const leftAccent: React.CSSProperties = hasVar ? { boxShadow: `inset 4px 0 0 ${VARIANCE_ACCENT}` } : {};
                  const qtyDiff = variance?.type === 'qty' ? variance.invoiceValue - variance.grnValue : 0;
                  const varLabel = variance?.type === 'qty'
                    ? `${qtyDiff > 0 ? '+' : ''}${qtyDiff} unit${Math.abs(qtyDiff) !== 1 ? 's' : ''}`
                    : `${priceDiff > 0 ? '+' : ''}${sym}${Math.abs(priceDiff).toFixed(2)}`;
                  const multi = m.sources.length > 1;
                  // Collapsed on entry — the aggregated row is the summary; the
                  // per-delivery split opens on demand via the GRNs chip.
                  const splitOpen = multi && (splitOverrides[m.sku] ?? false);

                  const dataRow = (
                    <tr key={`merged-${m.sku}`} style={{ background: rowBg }}>
                      <td style={{ ...cell, ...descCell, ...leftAccent }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap', fontWeight: hasVar ? 600 : 400 }}>
                          {invLine?.description ?? m.description}
                          {alternativeFor && (
                            <span style={{ marginLeft: 'auto', fontSize: '10px', fontWeight: 700, padding: '2px 6px', borderRadius: '4px', background: 'rgba(22, 101, 52, 0.08)', color: 'var(--color-success)', border: '1px solid var(--color-success-border)', whiteSpace: 'nowrap' }}>
                              Reconciled alternative
                            </span>
                          )}
                        </div>
                        {alternativeFor && (
                          <div style={{ fontSize: '11px', color: 'var(--color-text-secondary)', marginTop: '2px' }}>
                            PO ordered {alternativeFor.poName}
                          </div>
                        )}
                        <div style={{ fontSize: '11px', color: 'var(--color-text-secondary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                          {m.sku}
                          <span style={{ marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                            {multi && (
                              <button
                                onClick={() => setSplitOverrides(p => ({ ...p, [m.sku]: !splitOpen }))}
                                title={splitOpen ? 'Hide the per-delivery split' : 'Show the per-delivery split'}
                                style={{ ...grnChipStyle, background: '#fff', color: 'var(--color-text-primary)' }}
                              >
                                {m.sources.length} GRNs <Chevron open={splitOpen} />
                              </button>
                            )}
                            {!multi && multiGroup && (
                              <button
                                onClick={() => setShowGRN(m.sources[0].grn)}
                                title={`Open ${m.sources[0].grn.grnNumber}`}
                                style={grnChipStyle}
                              >
                                {m.sources[0].grn.grnNumber}
                              </button>
                            )}
                            {invLine?.parseConfidence !== undefined && (
                              <span
                                title="How sure the document reader is about this line"
                                style={confidenceBadgeStyle(invLine.parseConfidence)}
                              >
                                Confidence {invLine.parseConfidence}%
                              </span>
                            )}
                          </span>
                        </div>
                      </td>
                      <td style={{ ...cell, fontWeight: variance?.type === 'qty' && !isCleared ? 700 : 400 }}>
                        {editable && invLine ? <EditableQty lineId={invLine.id} value={invLine.qty} /> : (invLine?.qty ?? '—')}
                      </td>
                      <td style={{ ...cell, fontWeight: priceVar && !isCleared ? 700 : 400 }}>
                        {editable && invLine ? <EditablePrice lineId={invLine.id} value={invLine.unitPrice} /> : (invLine ? `${sym}${invLine.unitPrice.toFixed(2)}` : '—')}
                      </td>
                      <td style={{ ...cell, fontWeight: 600 }}>
                        {invLine ? `${sym}${invLine.lineTotal.toFixed(2)}` : '—'}
                      </td>
                      <td style={{ ...cell }}>
                        {invLine && <TaxSelect lineId={invLine.id} sku={invLine.sku} />}
                      </td>
                      <td style={{ ...cell, ...divider, fontWeight: 600, color: invLine && (lineTaxRates[invLine.id] ?? 0) > 0 ? 'var(--color-text-primary)' : 'var(--color-text-secondary)' }}>
                        {invLine && (lineTaxRates[invLine.id] ?? 0) > 0
                          ? `${sym}${(invLine.lineTotal * (lineTaxRates[invLine.id] ?? 0) / 100).toFixed(2)}`
                          : '—'}
                      </td>
                      <td style={{ ...cell, color: 'var(--color-text-secondary)', textAlign: 'center' }}>{m.orderedQty}</td>
                      <td style={{ ...cell, textAlign: 'center', fontWeight: (isShort || variance?.type === 'qty') && !isCleared ? 700 : 600 }}>
                        {m.receivedQty}
                        {isShort && <span style={{ fontSize: '11px', fontWeight: 400, color: 'var(--color-text-secondary)', marginLeft: '4px' }}>of {m.orderedQty}</span>}
                      </td>
                      <td style={{ ...cell, fontWeight: priceVar && !isCleared ? 700 : 400 }}>
                        {m.unitPrice !== null
                          ? `${sym}${m.unitPrice.toFixed(2)}`
                          : <span style={{ fontSize: '11px', color: 'var(--color-text-secondary)', fontStyle: 'italic' }}>varies</span>}
                      </td>
                      <td style={{ ...cell, fontWeight: 600 }}>{sym}{m.lineTotal.toFixed(2)}</td>
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

                  // Per-delivery split — GRN-side numbers only; the invoice line
                  // above stays the single billed row.
                  const subRows = splitOpen
                    ? m.sources.map(s => {
                        const srcShort = s.receivedQty < s.orderedQty;
                        return (
                          <tr key={`src-${m.sku}-${s.grn.id}`} style={{ background: '#fff' }}>
                            {/* Sits in the description column, right-aligned, so the
                                GRN chip stacks directly under the "n GRNs" toggle */}
                            <td style={{ ...cell, ...descCell, textAlign: 'right' }}>
                              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', fontSize: '11px', color: 'var(--color-text-secondary)' }}>
                                ↳
                                <button onClick={() => setShowGRN(s.grn)} title={`Open ${s.grn.grnNumber}`} style={grnChipStyle}>
                                  {s.grn.grnNumber} ↗
                                </button>
                                Received {s.grn.dateReceived}
                              </span>
                            </td>
                            <td colSpan={5} style={{ ...cell, ...divider }} />
                            <td style={{ ...cell, color: 'var(--color-text-secondary)', textAlign: 'center', fontSize: '11px' }}>{s.orderedQty}</td>
                            <td style={{ ...cell, textAlign: 'center', fontSize: '11px', fontWeight: srcShort ? 700 : 500 }}>
                              {s.receivedQty}
                              {srcShort && <span style={{ fontSize: '11px', fontWeight: 400, color: 'var(--color-text-secondary)', marginLeft: '4px' }}>of {s.orderedQty}</span>}
                            </td>
                            <td style={{ ...cell, fontSize: '11px' }}>{sym}{s.unitPrice.toFixed(2)}</td>
                            <td style={{ ...cell, fontSize: '11px', fontWeight: 600 }}>{sym}{s.lineTotal.toFixed(2)}</td>
                            <td style={{ ...cell, textAlign: 'center' }}>
                              {srcShort
                                ? <span style={{ fontSize: '10px', fontWeight: 700, padding: '2px 6px', borderRadius: '4px', border: `1px solid ${VARIANCE_ACCENT}`, background: VARIANCE_BADGE_BG, color: 'var(--color-text-primary)', whiteSpace: 'nowrap' }}>
                                    {s.orderedQty - s.receivedQty} short
                                  </span>
                                : <span style={{ color: 'var(--color-text-secondary)', fontSize: '13px', fontWeight: 600, opacity: 0.5 }}>✓</span>}
                            </td>
                          </tr>
                        );
                      })
                    : [];

                  if (!variance || !isExpanded) return [dataRow, ...subRows];

                  const resolution = resolutions[variance.id] as AnyResolution | undefined;
                  const options = resolutionOptionsFor(variance.type);
                  const vDiff = variance.invoiceValue - variance.poValue;
                  const detail = varianceDetailText(variance, sym);
                  const impactLabel = variance.impact >= 0 ? `+${sym}${variance.impact.toFixed(2)}` : `-${sym}${Math.abs(variance.impact).toFixed(2)}`;

                  const expandBg = isResolved ? 'rgba(16,185,129,0.03)' : '#FEFBEE';
                  const expandAccent = isResolved ? 'inset 3px 0 0 var(--color-success)' : `inset 3px 0 0 ${VARIANCE_ACCENT}`;

                  const expandRow = (
                    <tr key={`expand-${m.sku}`}>
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

                  return [dataRow, ...subRows, expandRow];
                };

                if (!collapseClean) return <tbody>{mergedLines.flatMap(renderMergedRow)}</tbody>;

                return (
                  <tbody>
                    {signalLines.flatMap(renderMergedRow)}
                    {cleanExpanded && cleanLines.flatMap(renderMergedRow)}
                  </tbody>
                );
          })()}

          {/* ── Unmatched invoice lines (no GRN) ── */}
          {unmatchedInvRows.length > 0 && (
            <tbody>
              {unmatchedInvRows.map(il => {
                const priceVar = invoice.variances.find(v => v.sku === il.sku && v.type === 'price');
                return (
                  <tr key={il.id} style={{ background: 'rgba(176, 16, 56, 0.05)' }}>
                    <td style={{ ...cell, ...descCell }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 600, flexWrap: 'wrap' }}>
                        {il.description}
                        <span style={{ fontSize: '11px', fontWeight: 700, padding: '2px 6px', borderRadius: '4px', background: 'rgba(176, 16, 56, 0.1)', color: 'var(--color-error)', border: '1px solid rgba(176, 16, 56, 0.25)', whiteSpace: 'nowrap', flexShrink: 0 }}>NO GRN</span>
                      </div>
                      <div style={{ fontSize: '11px', color: 'var(--color-text-secondary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        {il.sku}
                        {il.parseConfidence !== undefined && (
                          <span
                            title="How sure the document reader is about this line"
                            style={{ ...confidenceBadgeStyle(il.parseConfidence), marginLeft: 'auto' }}
                          >
                            Confidence {il.parseConfidence}%
                          </span>
                        )}
                      </div>
                    </td>
                    <td style={cell}>
                      {editable ? <EditableQty lineId={il.id} value={il.qty} /> : il.qty}
                    </td>
                    <td style={{ ...cell, fontWeight: priceVar ? 700 : 400 }}>
                      {editable ? <EditablePrice lineId={il.id} value={il.unitPrice} /> : `${sym}${il.unitPrice.toFixed(2)}`}
                    </td>
                    <td style={{ ...cell, fontWeight: 600 }}>{sym}{il.lineTotal.toFixed(2)}</td>
                    <td style={{ ...cell }}>
                      <TaxSelect lineId={il.id} sku={il.sku} />
                    </td>
                    <td style={{ ...cell, ...divider, fontWeight: 600, color: (lineTaxRates[il.id] ?? 0) > 0 ? 'var(--color-text-primary)' : 'var(--color-text-secondary)' }}>
                      {(lineTaxRates[il.id] ?? 0) > 0
                        ? `${sym}${(il.lineTotal * (lineTaxRates[il.id] ?? 0) / 100).toFixed(2)}`
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
              <td style={{ padding: '8px 12px', fontWeight: anyTax ? 500 : 700, textAlign: 'center', color: anyTax ? 'var(--color-text-secondary)' : undefined }}>
                {sym}{invoice.total.toFixed(2)}
              </td>
              <td />
              <td style={{ padding: '8px 12px', fontWeight: anyTax ? 600 : 400, textAlign: 'center', ...divider, color: anyTax ? 'var(--color-text-primary)' : 'var(--color-text-secondary)' }}>
                {anyTax ? `${sym}${totalTax.toFixed(2)}` : '—'}
              </td>
              {/* Right side: Ordered | Received | Price stay empty (colSpan 3), so
                  the total lands under "Total", mirroring the rows above */}
              <td colSpan={3} />
              <td style={{ padding: '8px 12px', fontWeight: 700, textAlign: 'center' }}>{sym}{allGrnTotal.toFixed(2)}</td>
              <td />
            </tr>
            {/* Grand total row — only shown when VAT applies */}
            {anyTax && (
              <tr style={{ borderTop: '1px solid var(--color-border-subtle)' }}>
                <td colSpan={2} />
                <td style={{ padding: '10px 12px', fontWeight: 700, textAlign: 'right', whiteSpace: 'nowrap' }}>Total (incl. VAT)</td>
                <td style={{ padding: '10px 12px', fontWeight: 700, textAlign: 'center' }}>
                  {sym}{(invoice.total + totalTax).toFixed(2)}
                </td>
                <td colSpan={2} style={divider} />
                <td colSpan={RC} />
              </tr>
            )}
            {/* Clean-matched lines — closing band of the table rather than a row
                between the lines; toggling folds the clean rows back into the body */}
            {collapseClean && (
              <tr
                onClick={() => toggleCleanGroup('grn')}
                title={cleanExpanded ? 'Hide the clean-matched lines again' : 'Show the clean-matched lines in the table above'}
                style={{ cursor: 'pointer' }}
              >
                <td colSpan={6 + RC} style={{ padding: '9px 14px', background: 'var(--color-bg-subtle, #fafafa)', borderTop: '1px solid var(--color-border-subtle)', fontSize: '12px', color: 'var(--color-text-secondary)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                    <span style={{ color: 'var(--color-success)', fontWeight: 700, fontSize: '13px' }}>✓</span>
                    <span style={{ fontWeight: 500 }}>
                      {cleanLines.length} line{cleanLines.length === 1 ? '' : 's'} matched clean · {sym}{cleanInvTotal.toFixed(2)}
                    </span>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '3px 10px', borderRadius: '6px', background: '#fff', border: '1px solid var(--color-border)', fontSize: '11px', fontWeight: 600, color: 'var(--color-accent-active)', whiteSpace: 'nowrap' }}>
                      {cleanExpanded ? 'Hide from table' : 'Show in table'} <Chevron open={cleanExpanded} />
                    </span>
                  </div>
                </td>
              </tr>
            )}
          </tfoot>
        </table>
      </div>

      {/* Linked invoices — footnote outside the table so the line rows read
          uninterrupted; the rest of the split-billing group lives on its own pages */}
      {siblingInvoices.length > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap', padding: '8px 4px 0', fontSize: '12px' }}>
          <span style={{ fontSize: '13px' }}>🔗</span>
          <span style={{ fontWeight: 500, color: 'var(--color-text-secondary)' }}>
            {siblingInvoices.length} other invoice{siblingInvoices.length === 1 ? '' : 's'} linked to these deliveries
          </span>
          {siblingInvoices.map(sibling => (
            <a
              key={sibling.id}
              href={`/invoices/match?id=${sibling.id}`}
              title={`Open ${sibling.invoiceNumber}`}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '3px 10px', borderRadius: '6px', background: '#fff', border: '1px solid var(--color-border)', fontSize: '11px', fontWeight: 600, fontFamily: 'var(--font-primary)', color: 'var(--color-accent-active)', textDecoration: 'none', whiteSpace: 'nowrap' }}
            >
              {sibling.invoiceNumber}
              <span style={{ color: 'var(--color-text-secondary)', fontWeight: 500 }}>{sym}{sibling.total.toFixed(2)}</span>
              →
            </a>
          ))}
        </div>
      )}

      {showDoc && <InvoiceDocDrawer invoice={invoice} onClose={() => setShowDoc(false)} />}
      {showGRN && <GRNDocDrawer grn={showGRN} onClose={() => setShowGRN(null)} />}
      {showPO && <PODocDrawer po={showPO} onClose={() => setShowPO(null)} />}
    </>
  );
}

/* ──────────── Variance Card ──────────── */

function VarianceCard({ variance, resolution, onResolve }: { variance: MatchVariance; resolution?: AnyResolution; onResolve: (r: AnyResolution) => void }) {
  const options = resolutionOptionsFor(variance.type);
  const priceDiff = variance.invoiceValue - variance.poValue;
  const detail = varianceDetailText(variance);
  const impactLabel = variance.impact >= 0
    ? `+$${variance.impact.toFixed(2)}`
    : `-$${Math.abs(variance.impact).toFixed(2)}`;

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
          Updates master ingredient cost to ${variance.invoiceValue.toFixed(2)} — cascades to recipe costing and GP%.
        </div>
      )}
      {resolution === 'Accept for this delivery' && variance.type === 'price' && (
        <div style={{ marginTop: '12px', padding: '10px 14px', borderRadius: '8px', background: 'var(--color-bg-hover)', fontSize: '12px', fontWeight: 500, color: 'var(--color-text-primary)' }}>
          Pays ${variance.invoiceValue.toFixed(2)} for this delivery only. Ingredient cost stays at ${variance.poValue.toFixed(2)}.
        </div>
      )}
    </div>
  );
}

/* ──────────── Match Summary Card ──────────── */

function MatchSummaryCard({ label, value, sub, variant }: { label: string; value: string; sub: string; variant: 'default' | 'success' | 'error' | 'warning' }) {
  const bg = variant === 'error' ? 'var(--color-error-light)' : variant === 'warning' ? 'var(--color-warning-light)' : '#fff';
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
  // Amounts stay in the invoice's own currency (all bulk siblings share the
  // same supplier, hence the same currency).
  const sym = currencySymbol(invoice.currency ?? BASE_CURRENCY);
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
            Both invoices are linked to the same PO and can be approved in one action. Combined total <strong style={{ color: 'var(--color-text-primary)' }}>{sym}{bulkTotal.toFixed(2)}</strong>.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {bulkInvoices.map((inv, i) => (
              <div key={inv.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', padding: '10px 14px', borderRadius: '8px', background: 'var(--color-bg-hover)', flexWrap: 'wrap' }}>
                <div>
                  <span style={{ fontWeight: 700, fontSize: '13px', color: 'var(--color-text-primary)' }}>{inv.invoiceNumber}</span>
                  <span style={{ fontSize: '12px', fontWeight: 500, color: 'var(--color-text-secondary)', marginLeft: '8px' }}>
                    {inv.date}{i === 0 ? ' · this invoice' : ''}
                  </span>
                </div>
                <span style={{ fontWeight: 700, fontSize: '13px', color: 'var(--color-text-primary)' }}>{sym}{inv.total.toFixed(2)}</span>
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
                    {v.type === 'price' ? `${sym}${v.poValue.toFixed(2)} → ${sym}${v.invoiceValue.toFixed(2)}` : `GRN: ${v.grnValue} vs Invoice: ${v.invoiceValue}`}
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
              <strong>{v.itemName}</strong> master cost updated {sym}{v.poValue.toFixed(2)} → {sym}{v.invoiceValue.toFixed(2)}
              <span style={{ fontSize: '12px', fontWeight: 500, color: 'var(--color-info)', marginLeft: '6px' }}>Affects recipes & GP%</span>
            </li>
          ))}
          {costUpdates.length > 0 && <li>Recipe GP% recalculated for affected recipes</li>}
          {deliveryOnly.map(v => (
            <li key={v.id}>
              <strong>{v.itemName}</strong> charged at {sym}{v.invoiceValue.toFixed(2)} for this delivery
              <span style={{ fontSize: '12px', fontWeight: 500, color: 'var(--color-text-secondary)', marginLeft: '6px' }}>Cost stays at {sym}{v.poValue.toFixed(2)}</span>
            </li>
          ))}
          {poContexts.map(ctx => (
            <li key={ctx.poNumber}>
              {ctx.overInvoiceIfApproved ? (
                <>
                  <strong>{ctx.poNumber}</strong> ends <strong>{sym}{ctx.overBy.toFixed(2)}</strong> above PO amount
                  <span style={{ fontSize: '12px', fontWeight: 500, color: 'var(--color-text-secondary)', marginLeft: '6px' }}>Accounted for in your variance resolutions above</span>
                </>
              ) : ctx.closesIfApproved ? (
                <>
                  <strong>{ctx.poNumber}</strong> closes — fully invoiced at {sym}{ctx.poAmount.toFixed(2)}
                  <span style={{ fontSize: '12px', fontWeight: 500, color: 'var(--color-text-secondary)', marginLeft: '6px' }}>PO marked complete</span>
                </>
              ) : (
                <>
                  <strong>{ctx.poNumber}</strong> stays open — {sym}{(ctx.poAmount - ctx.afterThisAmount).toFixed(2)} remaining after this invoice
                </>
              )}
            </li>
          ))}
          {isBulk ? (
            <li><strong>{bulkInvoices.length} invoices</strong> pushed to Xero in one batch (account codes mapped, total {sym}{bulkTotal.toFixed(2)})</li>
          ) : (
            <li>Invoice pushed to Xero (account codes mapped)</li>
          )}
          {creditTotal > 0 && <li>Credit note for <strong>{sym}{creditTotal.toFixed(2)}</strong> exported to Xero separately</li>}
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
                  {il.qty} × {sym}{il.unitPrice.toFixed(2)} = {sym}{il.lineTotal.toFixed(2)}
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
