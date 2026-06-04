'use client';

import { useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle2, ClipboardCheck, ArrowRight, Lock, LockOpen } from 'lucide-react';
import { usePlanConfirm } from './planConfirmStore';
import { useRole } from './RoleContext';
import { DEMO_TODAY, dayOfWeek } from './fixtures';

/**
 * Plan confirmation bar — the "confirm and flow through the system" step.
 *
 * A manager drafts the next day's bake on the Plan screen (typically
 * around midday the day before) and then confirms it here. Confirming is
 * a soft commit: it locks the plan read-only and the numbers become the
 * committed bake target for that day's Run production. Reopen rolls it
 * back to a draft for further edits.
 *
 * Two variants:
 *   • 'plan' (default) — full control: the Confirm CTA + confirm modal
 *     when drafting, or the confirmed banner with a Reopen button.
 *   • 'run'  — read-only status strip for the Run / Today surface. Renders
 *     nothing until the plan is confirmed, then shows the committed badge
 *     so the kitchen knows it's running to a locked plan.
 */
export default function PlanConfirmBar({
  siteId,
  date,
  variant = 'plan',
}: {
  siteId: string;
  date: string;
  variant?: 'plan' | 'run';
}) {
  const { isConfirmed, get, confirm, reopen, isDayUnlocked, getUnlock, unlockDay, relockDay } =
    usePlanConfirm();
  const { user, can } = useRole();
  const [confirmOpen, setConfirmOpen] = useState(false);

  const confirmed = isConfirmed(siteId, date);
  const record = get(siteId, date);
  const canApprove = can('plan.approve');
  const managerName = user.name.split('—')[0].trim();

  const isToday = date === DEMO_TODAY;
  const isPastDay = date < DEMO_TODAY;
  const dayLabel = relativeDayLabel(date);
  const dayUnlocked = isDayUnlocked(siteId, date);
  const unlockRecord = getUnlock(siteId, date);

  const confirmedAt = record
    ? new Date(record.confirmedAtISO).toLocaleTimeString('en-GB', {
        hour: '2-digit',
        minute: '2-digit',
      })
    : '';

  // Run / Today surface: only a passive status strip, and only once
  // the plan has actually been confirmed. Nothing to draft here.
  if (variant === 'run') {
    if (!confirmed) return null;
    return (
      <div style={confirmedBannerStyle}>
        <CheckCircle2 size={16} color="var(--color-success)" />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <span style={bannerTitleStyle}>Running to a confirmed plan</span>
          <span style={bannerSubStyle}>
            {capitalize(dayLabel)}&apos;s plan was confirmed at {confirmedAt}
            {record?.confirmedBy ? ` by ${record.confirmedBy}` : ''} — these are the committed
            bake numbers.
          </span>
        </div>
      </div>
    );
  }

  // The live day (today) is already committed — its plan was confirmed
  // yesterday and the kitchen is running to it. So there's no "confirm"
  // step here: it's locked by default. We only surface a quiet lock strip
  // with an Unlock affordance for the rare case the manager needs to amend
  // the live plan, plus a one-click Re-lock once they're done.
  if (isToday) {
    if (dayUnlocked) {
      const unlockedAt = unlockRecord
        ? new Date(unlockRecord.unlockedAtISO).toLocaleTimeString('en-GB', {
            hour: '2-digit',
            minute: '2-digit',
          })
        : '';
      return (
        <div style={unlockedStripStyle}>
          <LockOpen size={14} color="var(--color-warning)" />
          <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-text-secondary)' }}>
            Editing today&apos;s live plan
            {unlockedAt ? ` · unlocked at ${unlockedAt}` : ''}
            {unlockRecord?.unlockedBy ? ` by ${unlockRecord.unlockedBy}` : ''}
          </span>
          {canApprove && (
            <button
              type="button"
              onClick={() => relockDay(siteId, date)}
              style={{ ...reopenButtonStyle, marginLeft: 'auto' }}
            >
              <Lock size={11} style={{ marginRight: 4, verticalAlign: 'middle' }} />
              Re-lock
            </button>
          )}
        </div>
      );
    }
    return (
      <div style={lockedStripStyle}>
        <Lock size={14} color="var(--color-text-muted)" />
        <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-text-secondary)' }}>
          Today&apos;s plan is locked — committed and in production.
        </span>
        {canApprove && (
          <button
            type="button"
            onClick={() => unlockDay({ siteId, date, unlockedBy: managerName })}
            style={{ ...reopenButtonStyle, marginLeft: 'auto' }}
          >
            <LockOpen size={11} style={{ marginRight: 4, verticalAlign: 'middle' }} />
            Unlock to edit
          </button>
        )}
      </div>
    );
  }

  // Plan surface, already confirmed → locked banner + Reopen.
  if (confirmed) {
    return (
      <div style={confirmedBannerStyle}>
        <CheckCircle2 size={16} color="var(--color-success)" />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <span style={bannerTitleStyle}>Plan confirmed · committed to {dayLabel} production</span>
          <span style={bannerSubStyle}>
            Locked at {confirmedAt}
            {record?.confirmedBy ? ` by ${record.confirmedBy}` : ''}. The kitchen runs to these
            numbers — reopen to edit.
          </span>
        </div>
        {canApprove && (
          <button type="button" onClick={() => reopen(siteId, date)} style={reopenButtonStyle}>
            Reopen to edit
          </button>
        )}
      </div>
    );
  }

  // Plan surface, not yet confirmed.
  // Past days are historical — nothing to confirm.
  if (isPastDay) return null;

  // Staff can draft alongside the manager but can't commit the plan.
  if (!canApprove) {
    return (
      <div style={pendingBannerStyle}>
        <Lock size={14} color="var(--color-text-muted)" />
        <span>
          {capitalize(dayLabel)}&apos;s plan isn&apos;t confirmed yet — your manager confirms it
          before it flows to production.
        </span>
      </div>
    );
  }

  return (
    <>
      <div style={draftBarStyle}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
          <div style={draftIconStyle}>
            <ClipboardCheck size={16} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
            <span style={bannerTitleStyle}>Confirm {dayLabel} plan</span>
            <span style={bannerSubStyle}>
              Lock these numbers and flow them through to {dayLabel} production.
            </span>
          </div>
        </div>
        <button type="button" onClick={() => setConfirmOpen(true)} style={confirmButtonStyle}>
          <ClipboardCheck size={14} /> Confirm plan
        </button>
      </div>

      <AnimatePresence>
        {confirmOpen && (
          <PlanConfirmModal
            dayLabel={dayLabel}
            onCancel={() => setConfirmOpen(false)}
            onConfirm={() => {
              confirm({ siteId, date, confirmedBy: managerName });
              setConfirmOpen(false);
            }}
          />
        )}
      </AnimatePresence>
    </>
  );
}

/** "today" / "tomorrow" / "Mon 2026-04-28" — friendly date framing. */
function relativeDayLabel(date: string): string {
  if (date === DEMO_TODAY) return 'today';
  // Compare calendar days without timezone drift.
  const d = new Date(`${date}T00:00:00`);
  const today = new Date(`${DEMO_TODAY}T00:00:00`);
  const diffDays = Math.round((d.getTime() - today.getTime()) / 86_400_000);
  if (diffDays === 1) return 'tomorrow';
  return `${dayOfWeek(date)} ${date}`;
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// ─────────────────────────────────────────────────────────────────────────────
// Confirm modal — mirrors EndProductionControl's soft-commit modal so the
// two planning commits feel like one family.
// ─────────────────────────────────────────────────────────────────────────────

function PlanConfirmModal({
  dayLabel,
  onCancel,
  onConfirm,
}: {
  dayLabel: string;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  if (typeof window === 'undefined') return null;
  return createPortal(
    <>
      <motion.div
        key="plan-confirm-backdrop"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.15 }}
        onClick={onCancel}
        style={{ position: 'fixed', inset: 0, background: 'rgba(12, 20, 44, 0.55)', zIndex: 1300 }}
      />
      <div
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
          key="plan-confirm-card"
          role="dialog"
          aria-label="Confirm plan"
          initial={{ y: 16, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 16, opacity: 0 }}
          transition={{ type: 'spring', damping: 24, stiffness: 300 }}
          style={{
            width: 'min(460px, 100%)',
            borderRadius: 'var(--radius-card)',
            background: '#ffffff',
            boxShadow: '0 24px 64px rgba(12,20,44,0.32)',
            fontFamily: 'var(--font-primary)',
            display: 'flex',
            flexDirection: 'column',
            pointerEvents: 'auto',
            overflow: 'hidden',
          }}
        >
          <div style={{ padding: '20px 22px 16px', display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: 10,
                background: 'var(--color-info-light)',
                color: 'var(--color-info)',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <ClipboardCheck size={18} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: 'var(--color-text-primary)' }}>
                Confirm the {dayLabel} plan?
              </h2>
              <p style={{ margin: 0, fontSize: 12, lineHeight: 1.5, color: 'var(--color-text-secondary)' }}>
                These numbers will be locked and committed to {dayLabel} production — the Run sheet,
                benches and live floor all run to this plan. You can reopen it to make edits at any
                time before the day starts.
              </p>
            </div>
          </div>
          <div
            style={{
              display: 'flex',
              justifyContent: 'flex-end',
              gap: 8,
              padding: '12px 16px',
              background: 'var(--color-bg-hover)',
              borderTop: '1px solid var(--color-border-subtle)',
            }}
          >
            <button type="button" onClick={onCancel} style={modalCancelStyle}>
              Cancel
            </button>
            <button type="button" onClick={onConfirm} style={modalConfirmStyle}>
              <ClipboardCheck size={12} /> Confirm &amp; flow through <ArrowRight size={12} />
            </button>
          </div>
        </motion.div>
      </div>
    </>,
    document.body,
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Styles
// ─────────────────────────────────────────────────────────────────────────────

const bannerTitleStyle: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 700,
  color: 'var(--color-text-primary)',
};

const bannerSubStyle: React.CSSProperties = {
  fontSize: 11,
  color: 'var(--color-text-secondary)',
};

const confirmedBannerStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 10,
  padding: '12px 16px',
  margin: '12px 30px 0',
  background: 'var(--color-success-light)',
  border: '1px solid var(--color-success-border)',
  borderRadius: 'var(--radius-card)',
  fontFamily: 'var(--font-primary)',
};

const lockedStripStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  padding: '8px 14px',
  margin: '12px 30px 0',
  background: 'var(--color-bg-hover)',
  border: '1px solid var(--color-border-subtle)',
  borderRadius: 'var(--radius-card)',
  fontFamily: 'var(--font-primary)',
};

const unlockedStripStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  padding: '8px 14px',
  margin: '12px 30px 0',
  background: 'var(--color-warning-light)',
  border: '1px solid var(--color-warning-border)',
  borderRadius: 'var(--radius-card)',
  fontFamily: 'var(--font-primary)',
};

const pendingBannerStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  padding: '10px 14px',
  margin: '12px 30px 0',
  background: 'var(--color-bg-hover)',
  border: '1px solid var(--color-border-subtle)',
  borderRadius: 'var(--radius-card)',
  fontSize: 11,
  fontWeight: 600,
  color: 'var(--color-text-secondary)',
  fontFamily: 'var(--font-primary)',
};

const draftBarStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 12,
  padding: '12px 16px',
  margin: '12px 30px 0',
  background: '#ffffff',
  border: '1px solid var(--color-border)',
  borderRadius: 'var(--radius-card)',
  boxShadow: '0 1px 2px rgba(12,20,44,0.06)',
  fontFamily: 'var(--font-primary)',
};

const draftIconStyle: React.CSSProperties = {
  width: 32,
  height: 32,
  flexShrink: 0,
  borderRadius: 9,
  background: 'var(--color-info-light)',
  color: 'var(--color-info)',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
};

const confirmButtonStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
  flexShrink: 0,
  minHeight: 40,
  padding: '10px 16px',
  borderRadius: 10,
  fontSize: 13,
  fontWeight: 700,
  fontFamily: 'var(--font-primary)',
  background: 'var(--color-accent-active)',
  color: 'var(--color-text-on-active)',
  border: '1px solid var(--color-accent-active)',
  cursor: 'pointer',
  whiteSpace: 'nowrap',
};

const reopenButtonStyle: React.CSSProperties = {
  marginLeft: 'auto',
  flexShrink: 0,
  padding: '6px 12px',
  fontSize: 11,
  fontWeight: 700,
  background: '#ffffff',
  color: 'var(--color-text-secondary)',
  border: '1px solid var(--color-border)',
  borderRadius: 6,
  cursor: 'pointer',
  fontFamily: 'var(--font-primary)',
};

const modalCancelStyle: React.CSSProperties = {
  padding: '9px 14px',
  borderRadius: 8,
  fontSize: 12,
  fontWeight: 600,
  background: '#ffffff',
  color: 'var(--color-text-secondary)',
  border: '1px solid var(--color-border)',
  cursor: 'pointer',
  fontFamily: 'var(--font-primary)',
};

const modalConfirmStyle: React.CSSProperties = {
  padding: '9px 16px',
  borderRadius: 8,
  fontSize: 12,
  fontWeight: 700,
  background: 'var(--color-accent-active)',
  color: 'var(--color-text-on-active)',
  border: '1px solid var(--color-accent-active)',
  cursor: 'pointer',
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
  fontFamily: 'var(--font-primary)',
};
