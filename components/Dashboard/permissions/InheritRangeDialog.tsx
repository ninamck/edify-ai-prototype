'use client';

/**
 * Shown when a chart built in Ask Edify lands on a dashboard that carries a
 * date window of its own.
 *
 * Ask Edify answers a question against whatever window the question implied
 * — "what were sales last week?" produces a last-week chart. Dropping that
 * onto a period dashboard silently re-cuts it, and a reader who remembers
 * asking about last week would have no way of knowing. So the swap is made
 * explicit at the one moment the user is thinking about it: add the chart
 * and let it follow the dashboard's date picker, or cancel.
 *
 * The dialog is skipped entirely when there is no decision to make: charts
 * whose range is intrinsic never inherit, so asking would be noise.
 */

import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { CalendarClock, X } from 'lucide-react';
import { capabilityFor, type RangeBinding } from '@/lib/chartRange';
import { resolveDateRange, type DateRange } from '@/lib/dateRange';

export type PendingAdd = {
  chartId: string;
  targetId: string;
  targetName: string;
  targetRange: DateRange;
};

/**
 * Whether adding this chart to this dashboard involves a real choice. Only
 * polymorphic charts can inherit, so only they need asking about.
 */
export function needsInheritPrompt(
  chartId: string,
  targetRange: DateRange | undefined,
): boolean {
  if (!targetRange) return false;
  return capabilityFor(chartId).behaviour === 'polymorphic';
}

export default function InheritRangeDialog({
  pending,
  fallbackLabel,
  onCancel,
  onConfirm,
}: {
  pending: PendingAdd | null;
  /** Title to fall back on for charts with no capability entry. */
  fallbackLabel?: string;
  onCancel: () => void;
  onConfirm: (binding: RangeBinding | undefined) => void;
}) {
  if (typeof document === 'undefined') return null;

  const cap = pending ? capabilityFor(pending.chartId) : null;
  const native = pending ? resolveDateRange(cap!.nativeRange) : null;
  const target = pending ? resolveDateRange(pending.targetRange) : null;

  return createPortal(
    <AnimatePresence>
      {pending && cap && native && target && (
        <>
          <motion.div
            key="inherit-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            onClick={onCancel}
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 1300,
              background: 'rgba(0, 28, 53, 0.25)',
              backdropFilter: 'blur(2px)',
            }}
          />
          <div
            key="inherit-wrap"
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 1301,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 16,
              pointerEvents: 'none',
            }}
          >
            <motion.div
              key="inherit-panel"
              initial={{ opacity: 0, y: 20, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 12, scale: 0.97 }}
              transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
              style={{
                pointerEvents: 'auto',
                width: 'min(520px, 94vw)',
                borderRadius: 16,
                background: '#fff',
                border: '1px solid var(--color-border-subtle)',
                boxShadow: '0 12px 40px rgba(0, 28, 53,0.18)',
                fontFamily: 'var(--font-primary)',
                padding: 22,
                display: 'flex',
                flexDirection: 'column',
                gap: 16,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      fontSize: 16,
                      fontWeight: 700,
                      color: 'var(--color-text-primary)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 7,
                    }}
                  >
                    <CalendarClock size={16} strokeWidth={2.3} />
                    This chart will follow the dashboard date
                  </div>
                  <div
                    style={{
                      fontSize: 12,
                      fontWeight: 500,
                      color: 'var(--color-text-muted)',
                      marginTop: 4,
                      lineHeight: 1.55,
                    }}
                  >
                    You built <strong>{cap.metric || fallbackLabel}</strong> for{' '}
                    <strong>{native.label.toLowerCase()}</strong>, but{' '}
                    <strong>{pending.targetName}</strong> shows{' '}
                    <strong>{target.label.toLowerCase()}</strong>. It will show data
                    for the date range selected on the dashboard.
                  </div>
                </div>
                <button
                  type="button"
                  onClick={onCancel}
                  aria-label="Cancel"
                  style={{
                    border: 'none',
                    background: 'transparent',
                    cursor: 'pointer',
                    color: 'var(--color-text-muted)',
                    padding: 2,
                  }}
                >
                  <X size={18} strokeWidth={2.2} />
                </button>
              </div>

              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                <button type="button" onClick={onCancel} style={secondaryButtonStyle}>
                  Cancel
                </button>
                <button
                  type="button"
                  autoFocus
                  onClick={() => onConfirm(undefined)}
                  style={primaryButtonStyle}
                >
                  Add and follow the date
                </button>
              </div>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>,
    document.body,
  );
}

const primaryButtonStyle: React.CSSProperties = {
  padding: '8px 14px',
  borderRadius: 8,
  border: '1px solid var(--color-accent-active)',
  background: 'var(--color-accent-active)',
  color: '#fff',
  fontFamily: 'var(--font-primary)',
  fontSize: 13,
  fontWeight: 700,
  cursor: 'pointer',
};

const secondaryButtonStyle: React.CSSProperties = {
  padding: '8px 14px',
  borderRadius: 8,
  border: '1px solid var(--color-border-subtle)',
  background: '#fff',
  color: 'var(--color-text-primary)',
  fontFamily: 'var(--font-primary)',
  fontSize: 13,
  fontWeight: 600,
  cursor: 'pointer',
};
