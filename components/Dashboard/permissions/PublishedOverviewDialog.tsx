'use client';

// Published dashboards overview — the governance backstop. One admin screen
// listing everything published (and drafted) across the company: what
// exists, who made it, who sees it, with unpublish.

import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { Radio, X } from 'lucide-react';
import { audienceSummary, type DemoDashboard } from './model';
import { ROLE_LABEL, VIEWER_BY_PERSONA, type RolesPersonaId } from './sites';

function ownerLabel(personaId: RolesPersonaId): string {
  const v = VIEWER_BY_PERSONA[personaId];
  return `${v.name} (${ROLE_LABEL[v.role]})`;
}

export default function PublishedOverviewDialog({
  open,
  dashboards,
  onClose,
  onOpenDashboard,
  onUnpublish,
}: {
  open: boolean;
  dashboards: DemoDashboard[];
  onClose: () => void;
  onOpenDashboard: (id: string) => void;
  onUnpublish: (id: string) => void;
}) {
  if (typeof document === 'undefined') return null;

  const published = dashboards.filter((d) => d.kind === 'published');

  return createPortal(
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            key="overview-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            onClick={onClose}
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 1300,
              background: 'rgba(0, 28, 53, 0.25)',
              backdropFilter: 'blur(2px)',
            }}
          />
          <div
            key="overview-wrap"
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
              key="overview-panel"
              initial={{ opacity: 0, y: 20, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 12, scale: 0.97 }}
              transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
              style={{
                pointerEvents: 'auto',
                width: 'min(680px, 94vw)',
                maxHeight: '84vh',
                overflowY: 'auto',
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
                  <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--color-text-primary)' }}>
                    Published dashboards
                  </div>
                  <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--color-text-muted)', marginTop: 3 }}>
                    Everything shared across the company — who made it, who sees it.
                  </div>
                </div>
                <button
                  type="button"
                  onClick={onClose}
                  aria-label="Close"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: 30,
                    height: 30,
                    borderRadius: 8,
                    border: 'none',
                    background: 'var(--color-bg-hover)',
                    cursor: 'pointer',
                    flexShrink: 0,
                  }}
                >
                  <X size={15} color="var(--color-text-muted)" />
                </button>
              </div>

              {published.length === 0 ? (
                <div
                  style={{
                    padding: '28px 16px',
                    textAlign: 'center',
                    fontSize: 13,
                    fontWeight: 500,
                    color: 'var(--color-text-muted)',
                    border: '1px dashed var(--color-border)',
                    borderRadius: 12,
                  }}
                >
                  Nothing has been published yet.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {published.map((d) => {
                    const live = !!d.audience;
                    return (
                      <div
                        key={d.id}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 12,
                          padding: '12px 14px',
                          borderRadius: 12,
                          border: '1px solid var(--color-border-subtle)',
                          background: '#fff',
                        }}
                      >
                        <div
                          style={{
                            width: 34,
                            height: 34,
                            borderRadius: 10,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            background: live ? 'var(--color-info-light)' : 'var(--color-bg-hover)',
                            color: live ? 'var(--color-info)' : 'var(--color-text-muted)',
                            flexShrink: 0,
                          }}
                        >
                          <Radio size={16} strokeWidth={2.2} />
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <button
                              type="button"
                              onClick={() => {
                                onOpenDashboard(d.id);
                                onClose();
                              }}
                              title="Open dashboard"
                              style={{
                                all: 'unset',
                                cursor: 'pointer',
                                fontSize: 13,
                                fontWeight: 700,
                                color: 'var(--color-text-primary)',
                                fontFamily: 'var(--font-primary)',
                              }}
                            >
                              {d.name}
                            </button>
                            {!live && (
                              <span
                                style={{
                                  fontSize: 9,
                                  fontWeight: 700,
                                  letterSpacing: '0.05em',
                                  textTransform: 'uppercase',
                                  padding: '2px 6px',
                                  borderRadius: 999,
                                  background: 'rgba(0,28,53,0.08)',
                                  color: 'var(--color-text-muted)',
                                }}
                              >
                                Draft
                              </span>
                            )}
                          </div>
                          <div style={{ fontSize: 11, fontWeight: 500, color: 'var(--color-text-muted)', marginTop: 2 }}>
                            {audienceSummary(d)} · Created by {ownerLabel(d.owner)} ·{' '}
                            {d.insights.length} insight{d.insights.length === 1 ? '' : 's'}
                          </div>
                        </div>
                        {live && (
                          <button
                            type="button"
                            onClick={() => onUnpublish(d.id)}
                            style={{
                              padding: '6px 12px',
                              borderRadius: 8,
                              border: '1px solid var(--color-error-border)',
                              background: '#fff',
                              cursor: 'pointer',
                              fontFamily: 'var(--font-primary)',
                              fontSize: 12,
                              fontWeight: 700,
                              color: 'var(--color-error)',
                              flexShrink: 0,
                            }}
                            onMouseEnter={(e) =>
                              ((e.currentTarget as HTMLButtonElement).style.background = 'var(--color-error-light)')
                            }
                            onMouseLeave={(e) => ((e.currentTarget as HTMLButtonElement).style.background = '#fff')}
                          >
                            Unpublish
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              <div style={{ fontSize: 11, fontWeight: 500, color: 'var(--color-text-muted)', lineHeight: 1.5 }}>
                Unpublishing needs no clean-up: dashboards answer questions fresh each
                time, so viewers simply stop seeing it the next time they look.
              </div>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>,
    document.body,
  );
}
