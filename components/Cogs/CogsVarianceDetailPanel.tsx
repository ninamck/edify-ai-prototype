'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowRight, X } from 'lucide-react';
import EdifyMark from '@/components/EdifyMark/EdifyMark';
import { COGS_VARIANCE_ROWS, type CogsVarianceRow } from './fixtures';
import { getVarianceReason, getVarianceAction } from './insights';
import { gbp } from './format';

function qty(n: number): string {
  return n.toLocaleString('en-GB', { maximumFractionDigits: 3 });
}

function signed(n: number): string {
  return `${n >= 0 ? '+' : '\u2212'}${qty(Math.abs(n))}`;
}

function varColor(varCost: number): string {
  return varCost > 0 ? 'var(--color-error)' : 'var(--color-success)';
}

/** Compact label + value row used in the breakdown blocks. */
function Line({
  label,
  value,
  strong,
  muted,
  color,
  divider,
}: {
  label: ReactNode;
  value: ReactNode;
  strong?: boolean;
  muted?: boolean;
  color?: string;
  divider?: boolean;
}) {
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'baseline',
        gap: 12,
        padding: '6px 0',
        borderTop: divider ? '1px solid var(--color-border-subtle)' : 'none',
        marginTop: divider ? 2 : 0,
      }}
    >
      <span
        style={{
          fontSize: 12.5,
          fontWeight: strong ? 700 : 500,
          color: muted ? 'var(--color-text-muted)' : 'var(--color-text-secondary)',
        }}
      >
        {label}
      </span>
      <span
        style={{
          fontSize: 13,
          fontWeight: strong ? 700 : 600,
          color: color ?? 'var(--color-text-primary)',
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        {value}
      </span>
    </div>
  );
}

function SectionTitle({ children }: { children: ReactNode }) {
  return (
    <div
      style={{
        fontSize: 10,
        fontWeight: 700,
        letterSpacing: '0.06em',
        textTransform: 'uppercase',
        color: 'var(--color-text-muted)',
      }}
    >
      {children}
    </div>
  );
}

export default function CogsVarianceDetailPanel({
  rowId,
  onClose,
}: {
  rowId: string | null;
  onClose: () => void;
}) {
  const [mounted, setMounted] = useState(false);
  const router = useRouter();

  useEffect(() => setMounted(true), []);

  const row: CogsVarianceRow | undefined = rowId
    ? COGS_VARIANCE_ROWS.find((r) => r.id === rowId)
    : undefined;
  const open = Boolean(row);

  if (!mounted) return null;

  const fix = row ? getVarianceAction(row.id) : undefined;

  return createPortal(
    <AnimatePresence>
      {open && row && (
        <>
          <motion.div
            key="cogs-detail-scrim"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            onClick={onClose}
            style={{
              position: 'fixed',
              inset: 0,
              background: 'rgba(0, 28, 53, 0.18)',
              zIndex: 310,
            }}
          />
          <motion.aside
            key="cogs-detail-panel"
            initial={{ x: 460, opacity: 0.6 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: 460, opacity: 0.4 }}
            transition={{ type: 'spring', stiffness: 320, damping: 34 }}
            style={{
              position: 'fixed',
              top: 0,
              right: 0,
              height: '100vh',
              width: 'min(440px, 100vw)',
              background: '#fff',
              borderLeft: '1px solid var(--color-border-subtle)',
              boxShadow: '-12px 0 36px rgba(0, 28, 53,0.16)',
              zIndex: 320,
              display: 'flex',
              flexDirection: 'column',
              fontFamily: 'var(--font-primary)',
            }}
          >
            {/* Header */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '16px 18px',
                borderBottom: '1px solid var(--color-border-subtle)',
              }}
            >
              <span
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 8,
                  background: 'var(--color-accent-deep)',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                <EdifyMark size={16} color="#fff" />
              </span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  style={{
                    fontSize: 15,
                    fontWeight: 700,
                    color: 'var(--color-text-primary)',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                >
                  {row.name}
                </div>
                <div style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>
                  {row.productClass} · {gbp(row.unitCost)} / {row.packType}
                </div>
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close"
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: 7,
                  border: 'none',
                  background: 'var(--color-bg-hover)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                <X size={14} color="var(--color-text-muted)" />
              </button>
            </div>

            {/* Body */}
            <div
              style={{
                flex: 1,
                overflowY: 'auto',
                padding: '18px',
                display: 'flex',
                flexDirection: 'column',
                gap: 20,
              }}
            >
              {/* Variance headline */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'baseline',
                  justifyContent: 'space-between',
                  gap: 12,
                  padding: '14px 16px',
                  borderRadius: 10,
                  background: 'var(--color-bg-hover)',
                  border: '1px solid var(--color-border-subtle)',
                }}
              >
                <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <SectionTitle>Variance vs theoretical</SectionTitle>
                  <span style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>
                    {qty(row.actualUsage)} actual vs {qty(row.theoUsage)} expected
                  </span>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 22, fontWeight: 800, color: varColor(row.varCost) }}>
                    {gbp(row.varCost, { sign: true, decimals: 0 })}
                  </div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: varColor(row.varCost) }}>
                    {row.varPct > 0 ? '+' : ''}
                    {row.varPct.toFixed(1)}%
                  </div>
                </div>
              </div>

              {/* Why */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <SectionTitle>Likely cause</SectionTitle>
                <div
                  style={{
                    display: 'flex',
                    gap: 8,
                    alignItems: 'flex-start',
                    fontSize: 13,
                    lineHeight: 1.5,
                    color: 'var(--color-text-primary)',
                  }}
                >
                  <span style={{ marginTop: 2, flexShrink: 0 }}>
                    <EdifyMark size={13} color="var(--color-accent-deep)" />
                  </span>
                  <span>{getVarianceReason(row)}</span>
                </div>
              </div>

              {/* Actual vs theoretical */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <SectionTitle>Actual vs theoretical</SectionTitle>
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr auto auto',
                    columnGap: 16,
                    fontSize: 12.5,
                  }}
                >
                  {/* header row */}
                  <span />
                  <span style={{ textAlign: 'right', fontSize: 10, fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--color-text-muted)', padding: '6px 0' }}>
                    Usage
                  </span>
                  <span style={{ textAlign: 'right', fontSize: 10, fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--color-text-muted)', padding: '6px 0' }}>
                    Cost
                  </span>

                  <Cell>Theoretical</Cell>
                  <Cell right>{qty(row.theoUsage)}</Cell>
                  <Cell right>{gbp(row.theoCost, { decimals: 0 })}</Cell>

                  <Cell>Actual</Cell>
                  <Cell right>{qty(row.actualUsage)}</Cell>
                  <Cell right>{gbp(row.actualCost, { decimals: 0 })}</Cell>

                  <Cell strong divider>
                    Variance
                  </Cell>
                  <Cell right strong divider color={varColor(row.varCost)}>
                    {signed(row.varQty)}
                  </Cell>
                  <Cell right strong divider color={varColor(row.varCost)}>
                    {gbp(row.varCost, { sign: true, decimals: 0 })}
                  </Cell>
                </div>
              </div>

              {/* Stock movement → actual usage */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <SectionTitle>How actual usage is built</SectionTitle>
                <Line label="Opening stock" value={qty(row.openingStock)} />
                <Line label="Purchases" value={signed(row.purchases)} />
                <Line label="Transfers (net)" value={signed(row.transfer)} />
                <Line label="Waste" value={signed(-row.waste)} />
                <Line label="Closing stock" value={signed(-row.closingStock)} />
                <Line label="Actual usage" value={`${qty(row.actualUsage)} ${row.packType}`} strong divider />
              </div>

              {/* Suggested action */}
              {fix && (
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 8,
                    padding: '14px 16px',
                    borderRadius: 10,
                    border: '1px solid var(--color-border-subtle)',
                    background: '#fff',
                  }}
                >
                  <SectionTitle>Suggested action</SectionTitle>
                  <span style={{ fontSize: 13, lineHeight: 1.5, color: 'var(--color-text-primary)' }}>
                    {fix.action}
                  </span>
                  {fix.link && (
                    <button
                      type="button"
                      onClick={() => router.push(fix.link!.href)}
                      style={{
                        alignSelf: 'flex-start',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 6,
                        padding: '8px 14px',
                        borderRadius: 9,
                        border: 'none',
                        background: 'var(--color-accent-deep)',
                        color: '#fff',
                        fontSize: 13,
                        fontWeight: 600,
                        fontFamily: 'var(--font-primary)',
                        cursor: 'pointer',
                      }}
                    >
                      {fix.link.label}
                      <ArrowRight size={14} />
                    </button>
                  )}
                </div>
              )}
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>,
    document.body,
  );
}

/** Grid cell for the actual-vs-theoretical table. */
function Cell({
  children,
  right,
  strong,
  muted,
  color,
  divider,
}: {
  children: ReactNode;
  right?: boolean;
  strong?: boolean;
  muted?: boolean;
  color?: string;
  divider?: boolean;
}) {
  return (
    <span
      style={{
        textAlign: right ? 'right' : 'left',
        fontSize: 12.5,
        fontWeight: strong ? 700 : 500,
        color: color ?? (muted ? 'var(--color-text-muted)' : 'var(--color-text-primary)'),
        padding: '7px 0',
        borderTop: divider ? '1px solid var(--color-border-subtle)' : 'none',
        fontVariantNumeric: 'tabular-nums',
      }}
    >
      {children}
    </span>
  );
}
