'use client';

/**
 * Stocktake review — the surface a manager opens when a finished
 * count came back with variances that need a human decision before
 * the record can close. Built around the few moves a reviewer
 * actually makes per line:
 *
 *   1. Read the headline numbers — counted vs theoretical, in £.
 *   2. Read the counter's note (why they think the gap exists).
 *   3. Pick a resolution: accept the new figure as the truth,
 *      attribute the loss to waste, or flag for a recount.
 *   4. Optionally drop a reviewer note.
 *
 * On submit:
 *   • Each resolved line fires `onLineResolved` so the page-level
 *     override map can update `currentStock` (accept-count + log-
 *     waste both push the counted figure; recount holds).
 *   • `onSubmit` closes the record. The page flips its status to
 *     'completed' via the stocktake-status override map, so the
 *     surface immediately reflects the decision on the next render.
 *
 * The 23 lines that reconciled cleanly aren't itemised — they live
 * in the summary header ("23 reconciled cleanly") so the reviewer's
 * attention stays on the 5 lines that need a call.
 *
 * Voice / continued-count flows still use `StocktakeView`; the
 * review view is dispatch-driven by the page when `countRecord`
 * carries `status === 'needs-review'` and a `lines` array.
 */

import { useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  Check,
  ClipboardCheck,
  RotateCcw,
  Trash2,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { StocktakeLine, StocktakeRecord } from './status';
import { formatPrice, formatRelativeDate, formatStock } from './status';

// Resolution choices a reviewer can make per variance line. Mirrors
// what a real-world product (Marketman, Apicbase, …) offers: accept
// the count as the new truth, write the gap off as waste, or hold
// for a recount before closing the record.
export type StocktakeLineResolution =
  | 'accept-count'
  | 'log-waste'
  | 'recount';

interface Props {
  record: StocktakeRecord;
  siteName: string;
  onBack: () => void;
  /** Fires for each variance line that ends up with a stock-affecting
   *  resolution (accept-count / log-waste). Recount holds the variance
   *  open and does not call this. The page applies the new
   *  `currentStock` via its existing override map. */
  onLineResolved: (
    line: StocktakeLine,
    resolution: StocktakeLineResolution,
  ) => void;
  /** Fires when the reviewer hits Submit and the record is closed.
   *  The page flips the record's status to 'completed' via its
   *  stocktake-status override map and pops back to the list. */
  onSubmit: (summary: ReviewSubmitSummary) => void;
}

export interface ReviewSubmitSummary {
  recordId: string;
  acceptedCount: number;
  loggedWasteCount: number;
  pendingRecountCount: number;
  /** Net £ value of the lines the reviewer accepted as stock-affecting
   *  variance (excludes recount-pending lines). */
  netResolvedValue: number;
}

// What the row visualises per resolution. Kept here (not inline) so
// the same tone strings drive the chip + the description + the
// active-state outline.
const RESOLUTION_META: Record<
  StocktakeLineResolution,
  {
    label: string;
    icon: LucideIcon;
    tone: string;
    description: string;
  }
> = {
  'accept-count': {
    label: 'Accept count',
    icon: Check,
    tone: 'var(--color-success)',
    description: 'New on-hand becomes the counted figure.',
  },
  'log-waste': {
    label: 'Log as waste',
    icon: Trash2,
    tone: 'var(--color-warning)',
    description: 'Adjusts stock and records the loss as waste.',
  },
  recount: {
    label: 'Recount',
    icon: RotateCcw,
    tone: 'var(--color-text-secondary)',
    description: 'Keeps the line open — no stock change on submit.',
  },
};

const RESOLUTION_ORDER: StocktakeLineResolution[] = [
  'accept-count',
  'log-waste',
  'recount',
];

export default function StocktakeReviewView({
  record,
  siteName,
  onBack,
  onLineResolved,
  onSubmit,
}: Props) {
  const lines = record.lines ?? [];
  const cleanLineCount = Math.max(0, record.itemsCounted - lines.length);

  // Per-line resolution + reviewer note, keyed by line id. Default
  // resolution depends on the variance:
  //   • Anything counted at zero → 'log-waste' is the most likely
  //     call; the counter's notes on the Produce fridge fixture
  //     already point that way ("block missing from the cheese
  //     tray"), and pre-selecting it saves the reviewer a click.
  //   • Otherwise → 'accept-count' (treat the new count as truth).
  // The reviewer can flip either default freely.
  const [resolutions, setResolutions] = useState<
    Record<string, StocktakeLineResolution>
  >(() => {
    const out: Record<string, StocktakeLineResolution> = {};
    for (const line of lines) {
      out[line.id] = line.countedQty === 0 ? 'log-waste' : 'accept-count';
    }
    return out;
  });
  const [reviewerNotes, setReviewerNotes] = useState<Record<string, string>>({});
  const [submitted, setSubmitted] = useState(false);

  // Per-line variance helpers — pre-compute so the bottom-of-page
  // summary and each row use exactly the same numbers without
  // re-deriving inline.
  const lineMeta = useMemo(() => {
    return lines.map(line => {
      const variance = line.countedQty - line.theoreticalAtCount;
      const variancePct = line.theoreticalAtCount > 0
        ? Math.round((Math.abs(variance) / line.theoreticalAtCount) * 100)
        : null;
      const varianceValue =
        line.unitPrice !== null ? variance * line.unitPrice : null;
      return { line, variance, variancePct, varianceValue };
    });
  }, [lines]);

  const decisionCounts = useMemo(() => {
    let accepted = 0;
    let waste = 0;
    let recount = 0;
    let netResolvedValue = 0;
    for (const meta of lineMeta) {
      const r = resolutions[meta.line.id] ?? 'accept-count';
      if (r === 'accept-count') {
        accepted += 1;
        if (meta.varianceValue !== null) netResolvedValue += meta.varianceValue;
      } else if (r === 'log-waste') {
        waste += 1;
        if (meta.varianceValue !== null) netResolvedValue += meta.varianceValue;
      } else {
        recount += 1;
      }
    }
    return { accepted, waste, recount, netResolvedValue };
  }, [lineMeta, resolutions]);

  function setResolution(lineId: string, next: StocktakeLineResolution) {
    setResolutions(prev => ({ ...prev, [lineId]: next }));
  }

  function setReviewerNote(lineId: string, value: string) {
    setReviewerNotes(prev => ({ ...prev, [lineId]: value }));
  }

  function applyToAll(resolution: StocktakeLineResolution) {
    setResolutions(() => {
      const next: Record<string, StocktakeLineResolution> = {};
      for (const line of lines) next[line.id] = resolution;
      return next;
    });
  }

  function handleSubmit() {
    if (submitted) return;
    for (const meta of lineMeta) {
      const r = resolutions[meta.line.id] ?? 'accept-count';
      if (r !== 'recount') onLineResolved(meta.line, r);
    }
    onSubmit({
      recordId: record.id,
      acceptedCount: decisionCounts.accepted,
      loggedWasteCount: decisionCounts.waste,
      pendingRecountCount: decisionCounts.recount,
      netResolvedValue: decisionCounts.netResolvedValue,
    });
    setSubmitted(true);
  }

  const subtitle = `${record.scope}${
    record.sectionName ? ` · ${record.sectionName}` : ''
  } · counted ${formatRelativeDate(record.date)} by ${record.counterName}`;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <button
        type="button"
        onClick={onBack}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          padding: '4px 8px',
          marginLeft: -8,
          background: 'transparent',
          border: 'none',
          color: 'var(--color-text-secondary)',
          fontFamily: 'var(--font-primary)',
          fontSize: 12,
          fontWeight: 600,
          cursor: 'pointer',
          width: 'fit-content',
        }}
      >
        <ArrowLeft size={14} strokeWidth={2.4} /> Back to stocktakes
      </button>

      <header
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: 16,
          flexWrap: 'wrap',
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <h2
              style={{
                margin: 0,
                fontSize: 20,
                fontWeight: 700,
                color: 'var(--color-text-primary)',
                letterSpacing: '0.01em',
              }}
            >
              {siteName.toUpperCase()}
            </h2>
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '2px 8px',
                borderRadius: 'var(--radius-badge)',
                background: 'transparent',
                color: 'var(--color-warning)',
                border: '1px solid var(--color-warning)',
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: '0.04em',
                textTransform: 'uppercase',
              }}
            >
              <AlertTriangle size={11} strokeWidth={2.4} /> Needs review
            </span>
          </div>
          <div
            style={{
              marginTop: 2,
              fontSize: 12,
              color: 'var(--color-text-secondary)',
            }}
          >
            {subtitle}
          </div>
        </div>

        <button
          type="button"
          onClick={handleSubmit}
          disabled={submitted}
          style={{
            padding: '8px 18px',
            borderRadius: 'var(--radius-item)',
            background: submitted
              ? 'var(--color-success)'
              : 'var(--color-accent-active)',
            color: 'var(--color-text-on-active)',
            border: 'none',
            fontSize: 13,
            fontWeight: 600,
            fontFamily: 'var(--font-primary)',
            cursor: submitted ? 'default' : 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
          }}
        >
          {submitted ? (
            <>
              <Check size={14} strokeWidth={2.6} /> Review submitted
            </>
          ) : (
            <>Submit review</>
          )}
        </button>
      </header>

      {/* Summary card. Mirrors the StocktakeList summary tiles in
          tone: 18px headline numbers with caption beneath. Three
          tiles read left-to-right as the operator's progress so far:
          how many lines settled cleanly, how many need a call, and
          what £ is on the table. */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: 8,
        }}
      >
        <SummaryTile
          label="Reconciled cleanly"
          value={cleanLineCount.toString()}
          meta={
            cleanLineCount === record.itemsCounted
              ? 'No further action needed'
              : `of ${record.itemsCounted} lines counted`
          }
          tone="var(--color-success)"
        />
        <SummaryTile
          label="Need a decision"
          value={lines.length.toString()}
          meta={`${decisionCounts.recount} pending recount`}
          tone={
            lines.length === 0
              ? 'var(--color-success)'
              : 'var(--color-warning)'
          }
        />
        <SummaryTile
          label="Net variance"
          value={
            record.netVarianceValue !== undefined
              ? `${record.netVarianceValue < 0 ? '−' : record.netVarianceValue > 0 ? '+' : ''}${formatPrice(Math.abs(record.netVarianceValue))}`
              : '—'
          }
          meta="Counted vs theoretical"
          tone={
            record.netVarianceValue && record.netVarianceValue < 0
              ? 'var(--color-error)'
              : 'var(--color-text-primary)'
          }
        />
      </div>

      {/* Bulk-action strip — saves the reviewer from clicking through
          each row when they want to apply one decision to everything.
          Quiet outlined treatment so it doesn't compete with the
          per-line selectors that drive the actual review. */}
      {lines.length > 0 && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
            padding: '10px 14px',
            border: '1px dashed var(--color-border-subtle)',
            borderRadius: 'var(--radius-card)',
            background: 'var(--color-bg-hover)',
            flexWrap: 'wrap',
          }}
        >
          <div
            style={{
              fontSize: 12,
              fontWeight: 600,
              color: 'var(--color-text-secondary)',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            <ClipboardCheck size={13} /> Apply to every line:
          </div>
          <div style={{ display: 'inline-flex', gap: 6, flexWrap: 'wrap' }}>
            {RESOLUTION_ORDER.map(option => {
              const meta = RESOLUTION_META[option];
              const Icon = meta.icon;
              return (
                <button
                  key={option}
                  type="button"
                  onClick={() => applyToAll(option)}
                  disabled={submitted}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    padding: '6px 12px',
                    background: '#fff',
                    border: `1px solid ${meta.tone}`,
                    borderRadius: 'var(--radius-item)',
                    color: meta.tone,
                    fontFamily: 'var(--font-primary)',
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: submitted ? 'not-allowed' : 'pointer',
                    opacity: submitted ? 0.6 : 1,
                  }}
                >
                  <Icon size={13} strokeWidth={2.2} /> {meta.label}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {lines.length === 0 ? (
        <div
          style={{
            padding: 24,
            textAlign: 'center',
            border: '1px dashed var(--color-border)',
            borderRadius: 'var(--radius-card)',
            color: 'var(--color-text-secondary)',
            fontSize: 13,
          }}
        >
          No variance lines captured for this stocktake yet.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div
            style={{
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: '0.04em',
              textTransform: 'uppercase',
              color: 'var(--color-text-secondary)',
              padding: '0 4px',
            }}
          >
            {lines.length} variance line{lines.length === 1 ? '' : 's'} ·
            {' '}
            {decisionCounts.accepted} accepting · {decisionCounts.waste} as waste ·
            {' '}
            {decisionCounts.recount} pending recount
          </div>
          {lineMeta.map(({ line, variance, variancePct, varianceValue }) => (
            <ReviewLineCard
              key={line.id}
              line={line}
              variance={variance}
              variancePct={variancePct}
              varianceValue={varianceValue}
              resolution={resolutions[line.id] ?? 'accept-count'}
              onResolution={r => setResolution(line.id, r)}
              reviewerNote={reviewerNotes[line.id] ?? ''}
              onReviewerNote={v => setReviewerNote(line.id, v)}
              disabled={submitted}
            />
          ))}
        </div>
      )}

      {/* Sticky-feeling footer summary so the Submit CTA at the top
          isn't the only one. Mirrors the summary card up top but
          with the resolved £ tally so the reviewer can sanity-check
          before committing. */}
      <div
        style={{
          marginTop: 8,
          padding: '12px 14px',
          background: '#fff',
          border: '1px solid var(--color-border-subtle)',
          borderRadius: 'var(--radius-card)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
          flexWrap: 'wrap',
        }}
      >
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 2,
          }}
        >
          <span
            style={{
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: '0.04em',
              textTransform: 'uppercase',
              color: 'var(--color-text-secondary)',
            }}
          >
            Net resolved
          </span>
          <span
            style={{
              fontSize: 18,
              fontWeight: 700,
              color: decisionCounts.netResolvedValue < 0
                ? 'var(--color-error)'
                : decisionCounts.netResolvedValue > 0
                  ? 'var(--color-success)'
                  : 'var(--color-text-primary)',
            }}
          >
            {decisionCounts.netResolvedValue < 0
              ? '−'
              : decisionCounts.netResolvedValue > 0
                ? '+'
                : ''}
            {formatPrice(Math.abs(decisionCounts.netResolvedValue))}
          </span>
          <span
            style={{
              fontSize: 11,
              color: 'var(--color-text-secondary)',
            }}
          >
            {decisionCounts.recount > 0
              ? `Excludes ${decisionCounts.recount} line${decisionCounts.recount === 1 ? '' : 's'} pending recount`
              : 'Across all decided lines'}
          </span>
        </div>

        <button
          type="button"
          onClick={handleSubmit}
          disabled={submitted}
          style={{
            padding: '10px 22px',
            borderRadius: 'var(--radius-item)',
            background: submitted
              ? 'var(--color-success)'
              : 'var(--color-accent-active)',
            color: 'var(--color-text-on-active)',
            border: 'none',
            fontSize: 13,
            fontWeight: 600,
            fontFamily: 'var(--font-primary)',
            cursor: submitted ? 'default' : 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
          }}
        >
          {submitted ? (
            <>
              <Check size={14} strokeWidth={2.6} /> Review submitted
            </>
          ) : (
            <>Submit review</>
          )}
        </button>
      </div>
    </div>
  );
}

// ─── ReviewLineCard ──────────────────────────────────────────────────────────

function ReviewLineCard({
  line,
  variance,
  variancePct,
  varianceValue,
  resolution,
  onResolution,
  reviewerNote,
  onReviewerNote,
  disabled,
}: {
  line: StocktakeLine;
  variance: number;
  variancePct: number | null;
  varianceValue: number | null;
  resolution: StocktakeLineResolution;
  onResolution: (r: StocktakeLineResolution) => void;
  reviewerNote: string;
  onReviewerNote: (v: string) => void;
  disabled: boolean;
}) {
  const isShrinkage = variance < 0;
  const varianceTone = isShrinkage
    ? 'var(--color-error)'
    : variance > 0
      ? 'var(--color-success)'
      : 'var(--color-text-secondary)';

  // Render the counted breakdown ("4 punnets + 0.5 kg") only when
  // more than one unit was entered. Keeps the typical single-unit
  // case from looking noisy ("5 kg = 5 kg").
  const countEntries = Object.entries(line.counts).filter(
    ([, qty]) => qty !== 0,
  );
  const showBreakdown = countEntries.length > 1;

  return (
    <article
      style={{
        background: '#fff',
        border: `1px solid ${
          isShrinkage ? 'var(--color-error-border)' : 'var(--color-border-subtle)'
        }`,
        borderLeft: `4px solid ${varianceTone}`,
        borderRadius: 'var(--radius-card)',
        padding: '14px 16px',
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
      }}
    >
      {/* Header row — title + theoretical / counted / variance pair */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr auto',
          gap: 14,
          alignItems: 'flex-start',
        }}
      >
        <div style={{ minWidth: 0 }}>
          <div
            style={{
              fontSize: 14,
              fontWeight: 600,
              color: 'var(--color-text-primary)',
            }}
          >
            {line.itemName}
            {line.itemVariant && (
              <span style={{ color: 'var(--color-text-secondary)', fontWeight: 500 }}>
                {' '}
                · {line.itemVariant}
              </span>
            )}
          </div>
          <div
            style={{
              marginTop: 2,
              fontSize: 11,
              color: 'var(--color-text-secondary)',
              textTransform: 'uppercase',
              letterSpacing: '0.04em',
            }}
          >
            {line.category} · {formatPrice(line.unitPrice, line.stockUnit)}
          </div>
        </div>

        <div
          style={{
            display: 'flex',
            gap: 16,
            textAlign: 'right',
          }}
        >
          <div>
            <div
              style={{
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: '0.04em',
                textTransform: 'uppercase',
                color: 'var(--color-text-secondary)',
              }}
            >
              Theoretical
            </div>
            <div
              style={{
                fontSize: 18,
                fontWeight: 700,
                color: 'var(--color-text-primary)',
                whiteSpace: 'nowrap',
              }}
            >
              {formatStock(line.theoreticalAtCount, line.stockUnit)}
            </div>
          </div>
          <div>
            <div
              style={{
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: '0.04em',
                textTransform: 'uppercase',
                color: varianceTone,
              }}
            >
              Counted
            </div>
            <div
              style={{
                fontSize: 18,
                fontWeight: 700,
                color: 'var(--color-text-primary)',
                whiteSpace: 'nowrap',
              }}
            >
              {formatStock(line.countedQty, line.stockUnit)}
            </div>
            {showBreakdown && (
              <div
                style={{
                  fontSize: 11,
                  color: 'var(--color-text-secondary)',
                  whiteSpace: 'nowrap',
                }}
              >
                {countEntries
                  .map(([unit, qty]) => `${formatStock(qty, unit)}`)
                  .join(' + ')}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Variance + counter note row. The variance pill carries the
          tone so the reviewer's eye lands on the gap; the counter
          note sits next to it (italicised) so the *why* is right
          where the *what* is. */}
      <div
        style={{
          display: 'flex',
          gap: 12,
          alignItems: 'flex-start',
          flexWrap: 'wrap',
        }}
      >
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            padding: '4px 10px',
            borderRadius: 'var(--radius-badge)',
            background: 'transparent',
            color: varianceTone,
            border: `1px solid ${varianceTone}`,
            fontSize: 12,
            fontWeight: 600,
            whiteSpace: 'nowrap',
          }}
        >
          <AlertTriangle size={12} strokeWidth={2.4} />
          {variance > 0 ? '+' : variance < 0 ? '−' : ''}
          {Math.abs(variance).toFixed(1)} {line.stockUnit}
          {variancePct !== null ? ` · ${variancePct}%` : ''}
          {varianceValue !== null
            ? ` · ${varianceValue < 0 ? '−' : varianceValue > 0 ? '+' : ''}${formatPrice(Math.abs(varianceValue))}`
            : ''}
        </span>
        {line.note && (
          <span
            style={{
              flex: 1,
              minWidth: 200,
              fontSize: 12,
              fontStyle: 'italic',
              color: 'var(--color-text-secondary)',
              lineHeight: 1.45,
            }}
          >
            &ldquo;{line.note}&rdquo;
          </span>
        )}
      </div>

      {/* Resolution selector — three pills, one active. Larger tap
          targets than a plain radio so it works on a tablet without
          fiddly clicking. */}
      <div
        role="radiogroup"
        aria-label={`Resolution for ${line.itemName}`}
        style={{
          display: 'flex',
          gap: 6,
          flexWrap: 'wrap',
        }}
      >
        {RESOLUTION_ORDER.map(option => {
          const meta = RESOLUTION_META[option];
          const active = resolution === option;
          const Icon = meta.icon;
          return (
            <button
              key={option}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => onResolution(option)}
              disabled={disabled}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '8px 14px',
                borderRadius: 'var(--radius-item)',
                background: active ? `${meta.tone}14` : '#fff',
                border: active
                  ? `1.5px solid ${meta.tone}`
                  : '1px solid var(--color-border)',
                color: active ? meta.tone : 'var(--color-text-primary)',
                fontFamily: 'var(--font-primary)',
                fontSize: 12,
                fontWeight: 600,
                cursor: disabled ? 'not-allowed' : 'pointer',
                opacity: disabled ? 0.6 : 1,
                whiteSpace: 'nowrap',
              }}
            >
              <Icon size={13} strokeWidth={2.2} />
              {meta.label}
            </button>
          );
        })}
      </div>

      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          gap: 8,
          flexWrap: 'wrap',
        }}
      >
        <span
          style={{
            fontSize: 11,
            fontWeight: 600,
            color: 'var(--color-text-secondary)',
            flexShrink: 0,
            paddingTop: 8,
            minWidth: 110,
          }}
        >
          {RESOLUTION_META[resolution].description}
        </span>
        <input
          type="text"
          value={reviewerNote}
          onChange={e => onReviewerNote(e.target.value)}
          placeholder="Reviewer note (optional)"
          disabled={disabled}
          style={{
            flex: 1,
            minWidth: 180,
            padding: '8px 12px',
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-item)',
            fontSize: 13,
            fontFamily: 'var(--font-primary)',
            color: 'var(--color-text-primary)',
            background: '#fff',
            outline: 'none',
          }}
        />
      </div>
    </article>
  );
}

// ─── SummaryTile ─────────────────────────────────────────────────────────────
// Same shape as the StocktakeList tiles — kept local rather than
// exported so the two surfaces can drift if needed without dragging
// each other along.

function SummaryTile({
  label,
  value,
  meta,
  tone,
}: {
  label: string;
  value: string;
  meta?: string;
  tone?: string;
}) {
  return (
    <div
      style={{
        padding: '12px 14px',
        border: '1px solid var(--color-border-subtle)',
        borderRadius: 'var(--radius-card)',
        background: '#fff',
      }}
    >
      <div
        style={{
          fontSize: 11,
          color: 'var(--color-text-secondary)',
          textTransform: 'uppercase',
          letterSpacing: '0.04em',
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontSize: 18,
          fontWeight: 700,
          marginTop: 2,
          color: tone ?? 'var(--color-text-primary)',
        }}
      >
        {value}
      </div>
      {meta && (
        <div
          style={{
            fontSize: 11,
            color: 'var(--color-text-secondary)',
            marginTop: 2,
          }}
        >
          {meta}
        </div>
      )}
    </div>
  );
}
