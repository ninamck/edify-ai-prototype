'use client';

import { useEffect, useMemo, useState } from 'react';
import { Send, Lock, CheckCircle2, RotateCcw } from 'lucide-react';
import EdifyMark from '@/components/EdifyMark/EdifyMark';
import { useRole } from './RoleContext';
import { useHybridOrderActions, sumSlots, type HybridOrderState } from './hybridOrderStore';
import { dayOfWeek, type SiteId } from './fixtures';

/**
 * Submit-to-hub bar for the HYBRID Plan view.
 *
 * Mirrors the spoke-order page's "day header + cutoff + submit" pattern but
 * trimmed to the essentials: this surface is *also* showing make-rows in the
 * grid below, so we don't want to dominate the page. The bar carries:
 *   • A short caption ("Receive order to {hub} for {day}")
 *   • Live cutoff countdown ticking once a minute
 *   • Quinn note while in draft, status pill once submitted/acknowledged
 *   • Reset-to-Quinn affordance so a hybrid manager can scrap their edits
 *     in one click before submitting
 *   • Submit button (status-driven copy)
 *
 * Locking / auto-finalisation, hub unlock, and the demo "skip to cutoff"
 * controls all live on the dedicated spoke page — once a HYBRID needs them
 * they can be lifted in unchanged. V1 keeps this lean.
 */
type Props = {
  siteId: SiteId;
  hubId: SiteId;
  hubLabel: string;
  date: string;
  /** Live order state for this (siteId, date). `null` while we're hydrating. */
  order: HybridOrderState | null;
};

export default function HybridOrderSubmitBar({ siteId, hubId, hubLabel, date, order }: Props) {
  const { can } = useRole();
  const canSubmit = can('spoke.submit');
  const { submit, acknowledge, resetToHydration } = useHybridOrderActions();

  // Tick once a minute so the cutoff countdown stays current without
  // forcing the parent grid to re-render. Pauses once submitted /
  // acknowledged because the bar no longer counts down then.
  const [, setTick] = useState(0);
  useEffect(() => {
    if (!order) return;
    if (order.status !== 'draft') return;
    const id = window.setInterval(() => setTick(t => t + 1), 60_000);
    return () => window.clearInterval(id);
  }, [order]);

  // Demo auto-progression — `submitted` flips to `acknowledged` after a
  // short beat so the success state lands without needing a fake hub
  // back-channel. Mirrors the spoke order page's behaviour exactly so
  // the two surfaces feel like the same conversation.
  useEffect(() => {
    if (!order) return;
    if (order.status !== 'submitted') return;
    const t = window.setTimeout(() => acknowledge(siteId, date), 800);
    return () => window.clearTimeout(t);
  }, [order, siteId, date, acknowledge]);

  const totalUnits = useMemo(() => {
    if (!order) return 0;
    let n = 0;
    for (const slots of Object.values(order.perSlot)) n += sumSlots(slots);
    return n;
  }, [order]);

  if (!order) {
    // Hydration is one render away; render an inert placeholder so the
    // grid doesn't jump as the bar appears.
    return <div style={{ minHeight: 0 }} />;
  }

  const cutoffDate = new Date(order.cutoffISO);
  const msLeft = cutoffDate.getTime() - Date.now();
  const cutoffPassed = msLeft <= 0;

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '12px 14px',
        margin: '0 16px 12px',
        borderRadius: 'var(--radius-card)',
        background: order.status === 'acknowledged' ? 'var(--color-success-light)' : '#ffffff',
        border: `1px solid ${
          order.status === 'acknowledged'
            ? 'var(--color-success)'
            : 'var(--color-border-subtle)'
        }`,
        flexWrap: 'wrap',
        fontFamily: 'var(--font-primary)',
      }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
        <div
          style={{
            fontSize: 10,
            fontWeight: 700,
            color: 'var(--color-text-muted)',
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
          }}
        >
          Receive from hub · {hubLabel}
        </div>
        <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--color-text-primary)' }}>
          Order for {dayOfWeek(date)} {date}
        </div>
        {order.status === 'draft' && (
          <span style={{ fontSize: 10, color: 'var(--color-text-muted)', marginTop: 2 }}>
            {cutoffPassed
              ? <>Cutoff has passed — submit ASAP and Quinn will flag it as a late add.</>
              : <>Submit before <strong>{formatCutoff(order.cutoffISO)}</strong> ({formatTimeLeft(msLeft)} left) so {hubLabel} can plan.</>
            }
          </span>
        )}
      </div>

      <div style={{ flex: 1 }} />

      {/* Total units — small ledger so the manager sees what's about
          to ship without scrolling the grid below. */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-end',
          gap: 2,
          padding: '4px 10px',
          borderRadius: 6,
          background: 'var(--color-bg-surface)',
        }}
        title="Sum of every receive row's per-slot quantities"
      >
        <span
          style={{
            fontSize: 9,
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.04em',
            color: 'var(--color-text-muted)',
          }}
        >
          Order total
        </span>
        <span style={{ fontSize: 16, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
          {totalUnits}
        </span>
      </div>

      {/* Reset-to-Quinn — only meaningful while the manager is still
          drafting. Wipes their per-slot edits so the next read re-seeds
          from `spokeOrderForDate`. */}
      {order.status === 'draft' && (
        <button
          type="button"
          onClick={() => resetToHydration(siteId, date)}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 5,
            padding: '8px 12px',
            borderRadius: 8,
            border: '1px solid var(--color-border)',
            background: '#ffffff',
            fontSize: 11,
            fontWeight: 600,
            color: 'var(--color-text-secondary)',
            cursor: 'pointer',
            fontFamily: 'var(--font-primary)',
            minHeight: 38,
          }}
          title="Wipe your edits and re-seed from Edify's proposal"
        >
          <RotateCcw size={11} /> Reset to Edify
        </button>
      )}

      {/* Action — varies by status. */}
      {order.status === 'draft' && (
        <button
          type="button"
          onClick={() => submit(siteId, date)}
          disabled={!canSubmit}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            padding: '10px 16px',
            borderRadius: 8,
            fontSize: 13,
            fontWeight: 700,
            fontFamily: 'var(--font-primary)',
            background: !canSubmit ? 'var(--color-bg-hover)' : 'var(--color-accent-active)',
            color: !canSubmit ? 'var(--color-text-muted)' : 'var(--color-text-on-active)',
            border: `1px solid ${!canSubmit ? 'var(--color-border)' : 'var(--color-accent-active)'}`,
            cursor: !canSubmit ? 'not-allowed' : 'pointer',
            minHeight: 38,
          }}
          title={
            canSubmit
              ? `Send your order to ${hubLabel}`
              : 'Only the site manager can submit'
          }
        >
          <Send size={14} /> {canSubmit ? 'Submit to hub' : 'Manager submits'}
        </button>
      )}

      {order.status === 'submitted' && (
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            fontSize: 12,
            color: 'var(--color-text-secondary)',
            fontWeight: 600,
          }}
        >
          <Lock size={14} color="var(--color-text-secondary)" /> Sending to {hubLabel}…
        </span>
      )}

      {order.status === 'acknowledged' && (
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            fontSize: 12,
            color: 'var(--color-text-primary)',
            fontWeight: 700,
          }}
        >
          <CheckCircle2 size={16} color="var(--color-success)" />
          Acknowledged · scheduled for {dayOfWeek(date)} dispatch
        </span>
      )}

      {/* Quinn pre-submit note — sits as a small inline bubble next to
          the bar so the bar itself stays one row tall, but the manager
          still gets the "Quinn drafted these numbers" framing. Only
          shown on draft. */}
      {order.status === 'draft' && (
        <div
          style={{
            flexBasis: '100%',
            display: 'flex',
            alignItems: 'flex-start',
            gap: 8,
            padding: '10px 12px',
            borderRadius: 'var(--radius-card)',
            background: 'var(--color-info-light)',
            border: '1px solid var(--color-info)',
          }}
        >
          <EdifyMark size={14} color="var(--color-info)" style={{ flexShrink: 0, marginTop: 2 }} />
          <span style={{ fontSize: 11, color: 'var(--color-text-secondary)', lineHeight: 1.45 }}>
            <strong style={{ color: 'var(--color-text-primary)' }}>Edify drafted these numbers</strong> from your{' '}
            {dayOfWeek(date)} forecast. Tweak any P-slot stepper on a Receive row, then submit so {hubLabel}{' '}
            can bake your share with the rest of the day&rsquo;s plan.
          </span>
        </div>
      )}
    </div>
  );
}

function formatCutoff(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString('en-GB', { weekday: 'short', hour: '2-digit', minute: '2-digit' });
}

function formatTimeLeft(ms: number): string {
  if (ms <= 0) return 'overdue';
  const minutes = Math.floor(ms / 60_000);
  const hours = Math.floor(minutes / 60);
  if (hours >= 24) return `${Math.floor(hours / 24)}d ${hours % 24}h`;
  if (hours >= 1) return `${hours}h ${minutes % 60}m`;
  return `${minutes}m`;
}
