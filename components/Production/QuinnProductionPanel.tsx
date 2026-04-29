'use client';

import { useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Sparkles, X, ArrowRight, AlertTriangle, Info, CheckCircle2 } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { getQuinnNudges, type QuinnNudge, type QuinnNudgeTone } from './quinnNudges';
import { usePlanNudges } from './PlanStore';
import { DEMO_TODAY } from './fixtures';

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

  const planNudges = usePlanNudges('hub-central', DEMO_TODAY);
  const staticNudges = useMemo(() => getQuinnNudges(), []);
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
    return [...planAsGeneric, ...staticNudges].filter(n => !dismissed.has(n.id));
  }, [planNudges, staticNudges, dismissed]);
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
          background: 'linear-gradient(135deg, var(--color-accent-active) 0%, var(--color-info) 100%)',
          color: '#ffffff',
          border: 'none',
          cursor: 'pointer',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: '0 8px 24px rgba(0,0,0,0.18)',
        }}
      >
        <Sparkles size={22} />
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
                    background: 'linear-gradient(135deg, var(--color-accent-active) 0%, var(--color-info) 100%)',
                    color: '#ffffff',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Sparkles size={16} />
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

function inferSurface(pathname: string | null): QuinnNudge['surface'] | null {
  if (!pathname) return null;
  if (pathname.includes('/production/amounts')) return 'plan';
  if (pathname.includes('/production/board')) return 'board';
  if (pathname.includes('/production/pcr')) return 'pcr';
  if (pathname.includes('/production/carry-over')) return 'carry-over';
  if (pathname.includes('/production/spokes')) return 'spokes';
  if (pathname.includes('/production/settings-health')) return 'settings';
  if (pathname.includes('/production/setup')) return 'setup';
  if (pathname.includes('/production/plan')) return 'plan';
  return null;
}
