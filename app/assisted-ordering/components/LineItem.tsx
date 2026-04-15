'use client';

import { useState } from 'react';
import type { SuggestedOrderLine, DismissReason } from '../types';
import { getIngredient, getProduct } from '../data/mockOrders';
import QtyControl from './QtyControl';
import ConfidenceBadge from './ConfidenceBadge';
import DismissReasonPrompt from './DismissReason';

interface Props {
  line: SuggestedOrderLine;
  qty: number;
  removed: boolean;
  showDetail: boolean;
  onQtyChange: (qty: number) => void;
  onRemove: () => void;
  onRestore: () => void;
  onDismissReason: (reason: DismissReason) => void;
  supplierName?: string;
  deliveryDate?: string;
}

function buildWhyCopy(
  line: SuggestedOrderLine,
  qty: number,
  ingredient: ReturnType<typeof getIngredient>,
  product: ReturnType<typeof getProduct>,
): string[] {
  const { currentStock, stockUnit, parLevel } = ingredient;
  const projected = (currentStock + qty * product.unitSize).toFixed(1);
  const parStr = parLevel !== null ? `${parLevel}${stockUnit}` : 'not set';
  const daysEstimate = line.salesVelocity7d
    ? Math.round((qty * product.unitSize) / line.salesVelocity7d)
    : null;

  if (line.movAutoAdded) {
    const supplier = product.supplierId;
    const daysLeft = parLevel && line.salesVelocity7d
      ? Math.round((currentStock - (parLevel ?? 0)) / line.salesVelocity7d)
      : null;
    return [
      `Current stock: ${currentStock}${stockUnit} — target is ${parStr}`,
      daysLeft !== null
        ? `Would need reordering in ~${Math.abs(daysLeft)} days anyway`
        : `Would need reordering soon anyway`,
      `Included now to help reach ${supplier.replace('sup-', '')} minimum order`,
    ];
  }

  if (!line.posDataAvailable) {
    return [
      `Current stock: ${currentStock}${stockUnit} — target is ${parStr}`,
      `No POS data available — suggestion based on par levels and stocktake only`,
      `${qty} ${product.unitName} brings you to ${projected}${stockUnit}`,
    ];
  }

  if (line.salesVelocity7d) {
    const runOutDay = Math.ceil(currentStock / line.salesVelocity7d);
    const dayNames = ['today', 'tomorrow', 'in 2 days', 'in 3 days', 'by Friday', 'by the weekend', 'next week'];
    const dayStr = dayNames[Math.min(runOutDay, dayNames.length - 1)];
    return [
      `Current stock: ${currentStock}${stockUnit} — target is ${parStr}`,
      `Selling ~${line.salesVelocity7d}${stockUnit}/day — you'd run out ${dayStr} without this order`,
      `${qty} ${product.unitName} (${(qty * product.unitSize).toFixed(1)}${stockUnit}) brings you to ${projected}${stockUnit}${daysEstimate ? ` — ~${daysEstimate} days cover` : ''}`,
    ];
  }

  return [
    `Current stock: ${currentStock}${stockUnit} — target is ${parStr}`,
    `${qty} ${product.unitName} brings you to ${projected}${stockUnit}`,
  ];
}

export default function LineItem({
  line,
  qty,
  removed,
  showDetail,
  onQtyChange,
  onRemove,
  onRestore,
  onDismissReason,
  supplierName,
  deliveryDate,
}: Props) {
  const [whyExpanded, setWhyExpanded] = useState(line.whyHighlight ?? false);
  const [showDismiss, setShowDismiss] = useState(false);

  const ingredient = getIngredient(line.ingredientId);
  const product = getProduct(line.ingredientId, line.supplierId);
  const lineTotal = qty * product.unitCost;
  const projectedStock = ingredient.currentStock + qty * product.unitSize;
  const wasEdited = qty !== line.suggestedQty;

  const whyCopy = line.whyOverride ?? buildWhyCopy(line, qty, ingredient, product);

  // ─── Removed state ────────────────────────────────────────────────────────

  if (removed) {
    return (
      <div>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '10px 14px',
            borderRadius: showDismiss
              ? 'var(--radius-item) var(--radius-item) 0 0'
              : 'var(--radius-item)',
            border: '1.5px dashed var(--color-border-subtle)',
            background: 'var(--color-bg-hover)',
            opacity: 0.7,
          }}
        >
          <span
            style={{
              fontSize: '13px',
              color: 'var(--color-text-secondary)',
              fontFamily: 'var(--font-primary)',
              textDecoration: 'line-through',
            }}
          >
            {ingredient.name} — {ingredient.variant}
          </span>
          <button
            type="button"
            onClick={() => {
              setShowDismiss(false);
              onRestore();
            }}
            style={{
              padding: '4px 12px',
              borderRadius: 'var(--radius-badge)',
              border: '1px solid var(--color-border-subtle)',
              background: 'var(--color-bg-surface)',
              color: 'var(--color-text-primary)',
              fontSize: '12px',
              fontWeight: 600,
              fontFamily: 'var(--font-primary)',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
            }}
          >
            Restore
          </button>
        </div>
        {showDismiss && (
          <DismissReasonPrompt
            onSelect={(reason) => {
              onDismissReason(reason);
              setShowDismiss(false);
            }}
            onDismiss={() => setShowDismiss(false)}
          />
        )}
      </div>
    );
  }

  // ─── MOV auto-added banner ────────────────────────────────────────────────

  const movBanner = line.movAutoAdded && showDetail ? (
    <div
      style={{
        padding: '6px 14px',
        background: 'rgba(34, 68, 68, 0.06)',
        borderRadius: 'var(--radius-item) var(--radius-item) 0 0',
        borderBottom: '1px solid rgba(34,68,68,0.10)',
        fontSize: '12px',
        fontWeight: 600,
        color: 'var(--color-accent-active)',
        fontFamily: 'var(--font-primary)',
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
      }}
    >
      <span>↑</span>
      <span>Added to meet minimum order — {ingredient.currentStock}{ingredient.stockUnit} left, par is {ingredient.parLevel}{ingredient.stockUnit}</span>
    </div>
  ) : null;

  // ─── Active line ──────────────────────────────────────────────────────────

  const hasMovBanner = line.movAutoAdded && showDetail;

  return (
    <div
      style={{
        borderRadius: 'var(--radius-item)',
        border: '1px solid var(--color-border-subtle)',
        background: line.movAutoAdded ? 'rgba(34,68,68,0.03)' : 'var(--color-bg-surface)',
        overflow: 'hidden',
      }}
    >
      {movBanner}

      {/* Supplier + delivery context (shown in detail mode for ingredient/day views) */}
      {supplierName && showDetail && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '6px 14px 0',
          }}
        >
          <span
            style={{
              fontSize: '11px',
              fontWeight: 600,
              color: 'var(--color-text-secondary)',
              fontFamily: 'var(--font-primary)',
              letterSpacing: '0.03em',
            }}
          >
            {supplierName}
          </span>
          {deliveryDate && (
            <span
              style={{
                fontSize: '11px',
                fontWeight: 500,
                color: 'var(--color-text-secondary)',
                fontFamily: 'var(--font-primary)',
              }}
            >
              · 📦 {deliveryDate}
            </span>
          )}
        </div>
      )}

      {/* Main row */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          padding: supplierName && showDetail ? '4px 14px 10px' : '10px 14px',
        }}
      >
        {/* Name + badges */}
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: '3px', overflow: 'hidden' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', overflow: 'hidden' }}>
            <span
              style={{
                fontSize: '13px',
                fontWeight: 600,
                color: 'var(--color-text-primary)',
                fontFamily: 'var(--font-primary)',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                flexShrink: 1,
                minWidth: 0,
              }}
            >
              {ingredient.name}
            </span>
            <span
              style={{
                fontSize: '12px', fontWeight: 500,
                color: 'var(--color-text-secondary)',
                fontFamily: 'var(--font-primary)',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                flexShrink: 2,
                minWidth: 0,
              }}
            >
              {ingredient.variant}
            </span>
            <ConfidenceBadge score={line.confidenceScore} factors={line.confidenceFactors} />
            {wasEdited && (
              <span
                style={{
                  padding: '2px 6px',
                  borderRadius: 'var(--radius-badge)',
                  background: 'rgba(34,68,68,0.10)',
                  color: 'var(--color-accent-active)',
                  fontSize: '12px',
                  fontWeight: 700,
                  letterSpacing: '0.05em',
                  fontFamily: 'var(--font-primary)',
                }}
              >
                EDITED
              </span>
            )}
            {line.movAutoAdded && !showDetail && (
              <span
                style={{
                  padding: '2px 6px',
                  borderRadius: 'var(--radius-badge)',
                  background: 'rgba(34,68,68,0.10)',
                  color: 'var(--color-accent-active)',
                  fontSize: '12px',
                  fontWeight: 700,
                  letterSpacing: '0.05em',
                  fontFamily: 'var(--font-primary)',
                }}
              >
                MOV
              </span>
            )}
          </div>
        </div>

        {/* Qty + unit + total — never wraps, always right-aligned */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0, marginLeft: 'auto' }}>
          <QtyControl value={qty} onChange={onQtyChange} min={0} />
          <span
            style={{
              fontSize: '12px', fontWeight: 500,
              color: 'var(--color-text-secondary)',
              fontFamily: 'var(--font-primary)',
              whiteSpace: 'nowrap',
            }}
          >
            {product.unitName}
          </span>
          <span
            style={{
              fontSize: '13px',
              fontWeight: 700,
              color: 'var(--color-text-primary)',
              fontFamily: 'var(--font-primary)',
              minWidth: '52px',
              textAlign: 'right',
            }}
          >
            £{lineTotal.toFixed(0)}
          </span>
          <button
            type="button"
            aria-label={`Remove ${ingredient.name}`}
            onClick={() => {
              onRemove();
              setShowDismiss(true);
            }}
            style={{
              width: '26px',
              height: '26px',
              borderRadius: '6px',
              border: 'none',
              background: 'transparent',
              color: 'var(--color-text-secondary)',
              fontSize: '14px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
              transition: 'background 0.1s ease',
            }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'var(--color-bg-hover)'; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'transparent'; }}
          >
            ✕
          </button>
        </div>
      </div>

      {/* Detail section */}
      {showDetail && (
        <div
          style={{
            padding: '0 14px 12px',
            display: 'flex',
            flexDirection: 'column',
            gap: '4px',
            borderTop: '1px solid var(--color-border-subtle)',
            paddingTop: '8px',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '16px',
              flexWrap: 'wrap',
            }}
          >
            <span
              style={{
                fontSize: '12px', fontWeight: 500,
                color: 'var(--color-text-secondary)',
                fontFamily: 'var(--font-primary)',
              }}
            >
              {ingredient.currentStock}{ingredient.stockUnit} →{' '}
              <strong style={{ color: 'var(--color-text-primary)' }}>
                {projectedStock.toFixed(1)}{ingredient.stockUnit}
              </strong>{' '}
              after delivery
            </span>

            <span
              style={{
                fontSize: '12px', fontWeight: 500,
                color: 'var(--color-text-secondary)',
                fontFamily: 'var(--font-primary)',
                fontStyle: ingredient.parLevel !== null && !ingredient.parConfirmed ? 'italic' : 'normal',
              }}
            >
              Par:{' '}
              {ingredient.parLevel !== null
                ? `${ingredient.parLevel}${ingredient.stockUnit}${!ingredient.parConfirmed ? ' (suggested)' : ''}`
                : 'not set'}
            </span>

            {wasEdited && (
              <span
                style={{
                  fontSize: '12px', fontWeight: 500,
                  color: 'var(--color-text-secondary)',
                  fontFamily: 'var(--font-primary)',
                }}
              >
                was {line.suggestedQty}
              </span>
            )}

            <button
              type="button"
              onClick={() => setWhyExpanded((v) => !v)}
              style={{
                background: 'transparent',
                border: 'none',
                color: 'var(--color-accent-active)',
                fontSize: '12px',
                fontWeight: 600,
                fontFamily: 'var(--font-primary)',
                cursor: 'pointer',
                padding: 0,
                textDecoration: 'underline',
                textUnderlineOffset: '2px',
              }}
            >
              {whyExpanded ? 'Hide ▲' : 'Why? ▼'}
            </button>
          </div>

          {whyExpanded && (
            <ul
              style={{
                margin: '6px 0 0 0',
                padding: '10px 14px',
                background: 'var(--color-bg-hover)',
                borderRadius: 'var(--radius-item)',
                listStyle: 'disc',
                paddingLeft: '28px',
                display: 'flex',
                flexDirection: 'column',
                gap: '4px',
              }}
            >
              {whyCopy.map((text, i) => (
                <li
                  key={i}
                  style={{
                    fontSize: '12px',
                    fontWeight: line.whyHighlight && i === 0 ? 600 : 500,
                    color: line.whyHighlight && i === 0
                      ? 'var(--color-text-primary)'
                      : 'var(--color-text-secondary)',
                    fontFamily: 'var(--font-primary)',
                    lineHeight: 1.5,
                  }}
                >
                  {text}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
