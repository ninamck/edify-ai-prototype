'use client';

import { useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { X, ArrowRight, AlertTriangle, Info, CheckCircle2 } from 'lucide-react';
import EdifyMark from '@/components/EdifyMark/EdifyMark';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { getQuinnNudges, getSpokeSubmissionNudges, type QuinnNudge, type QuinnNudgeTone } from './quinnNudges';
import { usePlanNudges } from './PlanStore';
import { useRejectNudges } from './rejectsStore';
import { useHubAdhocNudges, useSpokeAdhocNudges } from './adhocStore';
import { useHubRemakeNudges, useSpokeRemakeNudges } from './remakeStore';
import { useSpokeUnlockNudges } from './hubUnlockStore';
import { DEMO_TODAY } from './fixtures';
import { useActiveSite } from '@/components/ActiveSite/ActiveSiteContext';
import { useDemoNotifications, type DemoNotificationKey } from './demoNotificationsStore';

const TONE_STYLE: Record<QuinnNudgeTone, { bg: string; color: string; border: string; icon: React.ReactNode }> = {
  info:    { bg: 'var(--color-info-light)',    color: 'var(--color-info)',    border: 'var(--color-info-light)',    icon: <Info size={14} /> },
  warning: { bg: 'var(--color-warning-light)', color: 'var(--color-warning)', border: 'var(--color-warning-border)', icon: <AlertTriangle size={14} /> },
  error:   { bg: 'var(--color-error-light)',   color: 'var(--color-error)',   border: 'var(--color-error-border)',   icon: <AlertTriangle size={14} /> },
  success: { bg: 'var(--color-success-light)', color: 'var(--color-success)', border: 'var(--color-success-border)', icon: <CheckCircle2 size={14} /> },
};

export default function QuinnProductionPanel() {
  const [open, setOpen] = useState(false);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const pathname = usePathname();
  const { isSpoke } = useActiveSite();

  const planNudges = usePlanNudges('hub-central', DEMO_TODAY);
  const rejectNudges = useRejectNudges('hub-central');
  const hubAdhocNudges = useHubAdhocNudges('hub-central');
  // Spoke nudges scoped to the demo's primary spoke; in real life the
  // panel would react to the current user's site.
  const spokeAdhocNudges = useSpokeAdhocNudges('site-spoke-south');
  const hubRemakeNudges = useHubRemakeNudges('hub-central');
  const spokeRemakeNudges = useSpokeRemakeNudges('site-spoke-south');
  // PAC-unlock — surfaces in the spoke manager's panel while the hub
  // has reopened their order past cutoff. Tone is success/positive
  // since the hub has actively offered them more capacity.
  const spokeUnlockNudges = useSpokeUnlockNudges('site-spoke-south');
  const staticNudges = useMemo(() => getQuinnNudges(), []);
  const spokeStaticNudges = useMemo(() => getSpokeSubmissionNudges(), []);
  const nudges = useMemo<QuinnNudge[]>(() => {
    // Lift plan nudges to the shared shape (surface = 'plan' so existing filter keeps working).
    const planAsGeneric: QuinnNudge[] = planNudges.map(n => ({
      id: n.id,
      tone: n.tone,
      title: n.title,
      body: n.body,
      cta: n.cta,
      surface: 'plan',
    }));
    // Reject nudges land on the dispatch surface so the panel auto-pins
    // them when the user is already on /production/dispatch.
    const rejectsAsGeneric: QuinnNudge[] = rejectNudges.map(n => ({
      id: n.id,
      tone: n.tone,
      title: n.title,
      body: n.body,
      cta: n.cta,
      surface: 'spokes',
    }));
    // Hub-side ad-hoc requests pin to the dispatch (spokes) surface so the
    // hub manager sees them when reviewing what's about to ship.
    const hubAdhocAsGeneric: QuinnNudge[] = hubAdhocNudges.map(n => ({
      id: n.id,
      tone: n.tone,
      title: n.title,
      body: n.body,
      cta: n.cta,
      surface: 'spokes',
    }));
    // Spoke-side responses pin to the spokes surface for the spoke manager.
    const spokeAdhocAsGeneric: QuinnNudge[] = spokeAdhocNudges.map(n => ({
      id: n.id,
      tone: n.tone,
      title: n.title,
      body: n.body,
      cta: n.cta,
      surface: 'spokes',
    }));
    // Critical remake — hub-side pins to dispatch (spokes surface) so the
    // hub manager sees them when triaging incoming. Tone is always the
    // most severe, so they end up at the top of the panel by sort order.
    const hubRemakeAsGeneric: QuinnNudge[] = hubRemakeNudges.map(n => ({
      id: n.id,
      tone: n.tone,
      title: n.title,
      body: n.body,
      cta: n.cta,
      surface: 'spokes',
    }));
    const spokeRemakeAsGeneric: QuinnNudge[] = spokeRemakeNudges.map(n => ({
      id: n.id,
      tone: n.tone,
      title: n.title,
      body: n.body,
      cta: n.cta,
      surface: 'spokes',
    }));
    const spokeUnlockAsGeneric: QuinnNudge[] = spokeUnlockNudges.map(n => ({
      id: n.id,
      tone: n.tone,
      title: n.title,
      body: n.body,
      cta: n.cta,
      surface: 'spokes',
    }));
    // Spoke persona: only surface what a spoke manager can act on.
    // - Critical incidents the spoke raised (status updates back).
    // - Hub unlock offers (active editing window for tomorrow's order).
    // - Their own ad-hoc requests (responses from hub).
    // No PCR / failed batches / carry-over / plan / productivity /
    // sales-report / settings / submit-to-hub reminders — all of those
    // are about hub operations or recipe/amount editing the spoke can't do.
    if (isSpoke) {
      return [
        ...spokeRemakeAsGeneric,
        ...spokeUnlockAsGeneric,
        ...spokeStaticNudges,
        ...spokeAdhocAsGeneric,
      ].filter(n => !dismissed.has(n.id));
    }

    return [
      // Critical-incident nudges first — they outrank everything.
      ...hubRemakeAsGeneric,
      ...spokeRemakeAsGeneric,
      // Active-window nudges (unlock) sit right behind critical incidents
      // so the spoke can't miss the hub's open offer.
      ...spokeUnlockAsGeneric,
      ...hubAdhocAsGeneric,
      ...spokeAdhocAsGeneric,
      ...rejectsAsGeneric,
      ...planAsGeneric,
      ...staticNudges,
    ].filter(n => !dismissed.has(n.id));
  }, [isSpoke, planNudges, rejectNudges, hubAdhocNudges, spokeAdhocNudges, hubRemakeNudges, spokeRemakeNudges, spokeUnlockNudges, staticNudges, spokeStaticNudges, dismissed]);
  const visible = nudges.length;

  // Keep the panel relevant to the current surface first
  const sorted = useMemo(() => {
    const currentSurface = inferSurface(pathname);
    if (!currentSurface) return nudges;
    return [...nudges].sort((a, b) => {
      if (a.surface === currentSurface && b.surface !== currentSurface) return -1;
      if (b.surface === currentSurface && a.surface !== currentSurface) return 1;
      return 0;
    });
  }, [nudges, pathname]);

  return (
    <>
      {/* Floating trigger */}
      <button
        type="button"
        aria-label="Open Quinn"
        onClick={() => setOpen(o => !o)}
        style={{
          position: 'fixed',
          right: 18,
          bottom: 18,
          zIndex: 500,
          width: 52,
          height: 52,
          borderRadius: '50%',
          background: 'var(--color-accent-active)',
          color: '#ffffff',
          border: 'none',
          cursor: 'pointer',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: '0 8px 24px rgba(0,0,0,0.18)',
        }}
      >
        <EdifyMark size={22} />
        {visible > 0 && (
          <span
            style={{
              position: 'absolute',
              top: -4,
              right: -4,
              minWidth: 20,
              height: 20,
              padding: '0 6px',
              borderRadius: 10,
              background: 'var(--color-error)',
              color: '#ffffff',
              fontSize: 11,
              fontWeight: 700,
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontFamily: 'var(--font-primary)',
            }}
          >
            {visible}
          </span>
        )}
      </button>

      <AnimatePresence>
        {open && (
          <>
            <motion.div
              key="scrim"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              onClick={() => setOpen(false)}
              style={{
                position: 'fixed',
                inset: 0,
                background: 'rgba(0,0,0,0.22)',
                zIndex: 450,
              }}
            />
            <motion.aside
              key="panel"
              initial={{ x: 360, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: 360, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 320, damping: 32 }}
              style={{
                position: 'fixed',
                top: 0,
                bottom: 0,
                right: 0,
                width: 'min(380px, 100vw)',
                background: '#ffffff',
                borderLeft: '1px solid var(--color-border-subtle)',
                zIndex: 460,
                display: 'flex',
                flexDirection: 'column',
                boxShadow: '-8px 0 24px rgba(0,0,0,0.08)',
                fontFamily: 'var(--font-primary)',
              }}
            >
              <div
                style={{
                  padding: '14px 16px',
                  borderBottom: '1px solid var(--color-border-subtle)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                }}
              >
                <div
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: '50%',
                    background: 'var(--color-accent-active)',
                    color: '#ffffff',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <EdifyMark size={16} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 700 }}>Quinn — today at a glance</div>
                  <div style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>
                    {visible === 0 ? 'Nothing needs you right now.' : `${visible} item${visible === 1 ? '' : 's'} worth a look.`}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  aria-label="Close"
                  style={{
                    width: 30,
                    height: 30,
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    border: '1px solid var(--color-border)',
                    borderRadius: 8,
                    background: '#ffffff',
                    cursor: 'pointer',
                    color: 'var(--color-text-muted)',
                  }}
                >
                  <X size={14} />
                </button>
              </div>

              {!isSpoke && <DemoNotificationToggles />}

              <div style={{ flex: 1, minHeight: 0, overflow: 'auto', padding: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
                {sorted.length === 0 && (
                  <div
                    style={{
                      padding: '32px 12px',
                      textAlign: 'center',
                      color: 'var(--color-text-muted)',
                      fontSize: 13,
                    }}
                  >
                    <CheckCircle2 size={24} style={{ marginBottom: 8, color: 'var(--color-success)' }} />
                    <div style={{ fontWeight: 700 }}>All clean.</div>
                    <div style={{ fontSize: 11, marginTop: 4 }}>No production nudges right now — go enjoy the coffee.</div>
                  </div>
                )}
                {sorted.map(nudge => (
                  <NudgeCard
                    key={nudge.id}
                    nudge={nudge}
                    onDismiss={() => setDismissed(prev => new Set(prev).add(nudge.id))}
                    onFollow={() => setOpen(false)}
                  />
                ))}
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </>
  );
}

function NudgeCard({
  nudge,
  onDismiss,
  onFollow,
}: {
  nudge: QuinnNudge;
  onDismiss: () => void;
  onFollow: () => void;
}) {
  const tone = TONE_STYLE[nudge.tone];
  return (
    <div
      style={{
        padding: 12,
        borderRadius: 'var(--radius-card)',
        border: `1px solid ${tone.border}`,
        background: '#ffffff',
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
        <span
          style={{
            width: 26,
            height: 26,
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: 8,
            background: tone.bg,
            color: tone.color,
            flexShrink: 0,
          }}
        >
          {tone.icon}
        </span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 700, lineHeight: 1.3, color: 'var(--color-text-primary)' }}>
            {nudge.title}
          </div>
          <div style={{ fontSize: 11, color: 'var(--color-text-secondary)', lineHeight: 1.45, marginTop: 3 }}>
            {nudge.body}
          </div>
        </div>
      </div>
      <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
        <button
          type="button"
          onClick={onDismiss}
          style={{
            padding: '6px 10px',
            borderRadius: 8,
            border: '1px solid var(--color-border)',
            background: '#ffffff',
            fontSize: 11,
            fontWeight: 600,
            color: 'var(--color-text-secondary)',
            cursor: 'pointer',
            fontFamily: 'var(--font-primary)',
          }}
        >
          Not now
        </button>
        <Link
          href={nudge.cta.href}
          onClick={onFollow}
          style={{
            padding: '6px 10px',
            borderRadius: 8,
            border: '1px solid var(--color-accent-active)',
            background: 'var(--color-accent-active)',
            color: 'var(--color-text-on-active)',
            fontSize: 11,
            fontWeight: 700,
            cursor: 'pointer',
            textDecoration: 'none',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4,
            fontFamily: 'var(--font-primary)',
          }}
        >
          {nudge.cta.label} <ArrowRight size={12} />
        </Link>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Demo notification toggles — collapsible pad inside the Quinn panel that
// lets the demoer flip the three hub-side incoming surfaces (urgent
// remake banner, spoke rejects strip, ad-hoc requests strip) on and off
// without leaving the panel.
// ─────────────────────────────────────────────────────────────────────────────

const DEMO_TOGGLE_ROWS: Array<{ key: DemoNotificationKey; label: string; hint: string }> = [
  { key: 'urgentRemake', label: 'Urgent remake banner',  hint: 'Critical incident · Today header' },
  { key: 'rejects',      label: 'Incoming rejects',      hint: 'Spoke-reject strip on Today' },
  { key: 'adhoc',        label: 'Ad-hoc requests',       hint: 'Spoke top-up strip on Today' },
];

function DemoNotificationToggles() {
  const flags = useDemoNotifications();
  const [open, setOpen] = useState(false);
  const onCount = DEMO_TOGGLE_ROWS.filter(r => flags[r.key]).length;
  return (
    <div style={{ borderBottom: '1px solid var(--color-border-subtle)', background: 'var(--color-bg-surface)' }}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        aria-expanded={open}
        style={{
          width: '100%',
          padding: '10px 16px',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          background: 'transparent',
          border: 'none',
          cursor: 'pointer',
          fontFamily: 'var(--font-primary)',
          color: 'var(--color-text-secondary)',
          fontSize: 11,
          fontWeight: 700,
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
        }}
      >
        <span style={{ flex: 1, textAlign: 'left' }}>Demo notifications</span>
        <span style={{ color: 'var(--color-text-muted)', textTransform: 'none', letterSpacing: 0, fontWeight: 600 }}>
          {onCount} of {DEMO_TOGGLE_ROWS.length} on
        </span>
        <span
          style={{
            display: 'inline-flex',
            transform: open ? 'rotate(180deg)' : undefined,
            transition: 'transform 0.15s ease',
            color: 'var(--color-text-muted)',
          }}
        >
          <ChevronDownIcon />
        </span>
      </button>
      {open && (
        <div style={{ padding: '4px 12px 12px', display: 'flex', flexDirection: 'column', gap: 6 }}>
          {DEMO_TOGGLE_ROWS.map(row => (
            <DemoToggleRow
              key={row.key}
              label={row.label}
              hint={row.hint}
              checked={flags[row.key]}
              onToggle={() => flags.toggle(row.key)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function DemoToggleRow({
  label, hint, checked, onToggle,
}: {
  label: string;
  hint: string;
  checked: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      role="switch"
      aria-checked={checked}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '8px 10px',
        borderRadius: 8,
        background: '#ffffff',
        border: '1px solid var(--color-border-subtle)',
        cursor: 'pointer',
        textAlign: 'left',
        fontFamily: 'var(--font-primary)',
      }}
    >
      <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 1 }}>
        <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-text-primary)' }}>{label}</span>
        <span style={{ fontSize: 10, color: 'var(--color-text-muted)' }}>{hint}</span>
      </span>
      <span
        aria-hidden
        style={{
          width: 32,
          height: 18,
          borderRadius: 999,
          background: checked ? 'var(--color-accent-active)' : 'var(--color-border)',
          position: 'relative',
          transition: 'background 0.15s ease',
          flexShrink: 0,
        }}
      >
        <span
          style={{
            position: 'absolute',
            top: 2,
            left: checked ? 16 : 2,
            width: 14,
            height: 14,
            borderRadius: '50%',
            background: '#ffffff',
            boxShadow: '0 1px 3px rgba(0,0,0,0.18)',
            transition: 'left 0.15s ease',
          }}
        />
      </span>
    </button>
  );
}

function ChevronDownIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );
}

function inferSurface(pathname: string | null): QuinnNudge['surface'] | null {
  if (!pathname) return null;
  if (pathname.includes('/production/amounts')) return 'plan';
  if (pathname.includes('/production/board')) return 'board';
  if (pathname.includes('/production/pcr')) return 'pcr';
  if (pathname.includes('/production/carry-over')) return 'carry-over';
  if (pathname.includes('/production/spokes')) return 'spokes';
  if (pathname.includes('/production/settings-health')) return 'settings';
  if (pathname.includes('/production/setup')) return 'setup';
  if (pathname.includes('/production/productivity')) return 'productivity';
  if (pathname.includes('/production/sales-report')) return 'sales-report';
  if (pathname.includes('/production/plan')) return 'plan';
  return null;
}
