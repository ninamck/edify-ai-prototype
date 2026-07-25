'use client';

// Publish & audience picker — the heart of the whole model. Audiences are
// role-at-sites, never named individuals. The site list only offers the
// sites the publisher can see, which is how a manager's ceiling enforces
// itself without extra rules: Ed literally cannot tick a site he doesn't
// have.

import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { Radio, X } from 'lucide-react';
import type { Audience, DemoDashboard } from './model';
import { ALL_SITES, siteListPhrase, type DemoRole, type SiteId, type Viewer } from './sites';

const AUDIENCE_ROLES: { id: Exclude<DemoRole, 'admin'>; label: string; hint: string }[] = [
  { id: 'manager', label: 'Managers', hint: 'Can view, each limited to their own sites' },
  { id: 'employee', label: 'Employees', hint: 'View only, their own site\u2019s data' },
];

export default function PublishDialog({
  open,
  dashboard,
  viewer,
  onClose,
  onPublish,
  onUnpublish,
}: {
  open: boolean;
  dashboard: DemoDashboard | null;
  viewer: Viewer;
  onClose: () => void;
  onPublish: (audience: Audience) => void;
  onUnpublish: () => void;
}) {
  const [roles, setRoles] = useState<Exclude<DemoRole, 'admin'>[]>([]);
  const [siteIds, setSiteIds] = useState<SiteId[]>([]);

  // Managers only see their own sites as options — the self-enforcing ceiling.
  const availableSites = useMemo(
    () => ALL_SITES.filter((s) => viewer.siteIds.includes(s.id)),
    [viewer.siteIds],
  );

  useEffect(() => {
    if (!open || !dashboard) return;
    // The company dashboard's default (no audience) means everyone at every
    // site — open with the full selection rather than an empty draft state.
    if (dashboard.kind === 'company' && !dashboard.audience) {
      setRoles(AUDIENCE_ROLES.map((r) => r.id));
      setSiteIds(availableSites.map((s) => s.id));
      return;
    }
    setRoles(dashboard.audience?.roles ?? []);
    setSiteIds(dashboard.audience?.siteIds.filter((s) => viewer.siteIds.includes(s)) ?? []);
  }, [open, dashboard, viewer.siteIds, availableSites]);

  if (typeof document === 'undefined') return null;

  const isCompany = dashboard?.kind === 'company';
  // Company dashboards are always live; published ones are live once they
  // have an audience.
  const isLive = isCompany || !!dashboard?.audience;
  const canSubmit = roles.length > 0 && siteIds.length > 0;

  const fullSelection =
    roles.length === AUDIENCE_ROLES.length && siteIds.length === ALL_SITES.length;

  const previewSummary =
    roles.length > 0 && siteIds.length > 0
      ? isCompany && fullSelection
        ? 'Everyone at the company — each person sees their own sites\u2019 data.'
        : `All ${roles.map((r) => (r === 'manager' ? 'managers' : 'employees')).join(' and ')} at ${siteListPhrase(siteIds)}.`
      : 'Pick at least one role and one site.';

  function toggleRole(role: Exclude<DemoRole, 'admin'>) {
    setRoles((prev) => (prev.includes(role) ? prev.filter((r) => r !== role) : [...prev, role]));
  }

  function toggleSite(id: SiteId) {
    setSiteIds((prev) => (prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]));
  }

  return createPortal(
    <AnimatePresence>
      {open && dashboard && (
        <>
          <motion.div
            key="publish-backdrop"
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
            key="publish-wrap"
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
              key="publish-panel"
              initial={{ opacity: 0, y: 20, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 12, scale: 0.97 }}
              transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
              style={{
                pointerEvents: 'auto',
                width: 'min(520px, 94vw)',
                maxHeight: '88vh',
                overflowY: 'auto',
                borderRadius: 16,
                background: '#fff',
                border: '1px solid var(--color-border-subtle)',
                boxShadow: '0 12px 40px rgba(0, 28, 53,0.18)',
                fontFamily: 'var(--font-primary)',
                padding: 22,
                display: 'flex',
                flexDirection: 'column',
                gap: 18,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--color-text-primary)' }}>
                    {isLive ? `Audience for “${dashboard.name}”` : `Publish “${dashboard.name}”`}
                  </div>
                  <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--color-text-muted)', marginTop: 3, lineHeight: 1.5 }}>
                    Choose an audience by <strong>role at sites</strong> — never by naming
                    individuals. Everyone in the audience sees this dashboard with their
                    own sites’ data.
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

              <div>
                <div style={sectionLabelStyle}>Who</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {AUDIENCE_ROLES.map((r) => {
                    const checked = roles.includes(r.id);
                    return (
                      <label
                        key={r.id}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 10,
                          padding: '10px 12px',
                          borderRadius: 10,
                          border: checked
                            ? '1.5px solid var(--color-accent-active)'
                            : '1.5px solid var(--color-border-subtle)',
                          cursor: 'pointer',
                          background: checked ? 'rgba(0,28,53,0.03)' : '#fff',
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleRole(r.id)}
                          style={{ accentColor: 'var(--color-accent-active)' }}
                        />
                        <div>
                          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--color-text-primary)' }}>{r.label}</div>
                          <div style={{ fontSize: 11, fontWeight: 500, color: 'var(--color-text-muted)' }}>{r.hint}</div>
                        </div>
                      </label>
                    );
                  })}
                </div>
              </div>

              <div>
                <div style={sectionLabelStyle}>
                  At which sites
                  {viewer.role !== 'admin' && (
                    <span style={{ fontWeight: 500, textTransform: 'none', letterSpacing: 0, marginLeft: 6 }}>
                      — you can only publish to your own sites
                    </span>
                  )}
                </div>
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
                    gap: 6,
                  }}
                >
                  {availableSites.map((s) => {
                    const checked = siteIds.includes(s.id);
                    return (
                      <label
                        key={s.id}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 8,
                          padding: '7px 10px',
                          borderRadius: 8,
                          border: checked
                            ? '1.5px solid var(--color-accent-active)'
                            : '1.5px solid var(--color-border-subtle)',
                          cursor: 'pointer',
                          fontSize: 12,
                          fontWeight: 600,
                          color: 'var(--color-text-primary)',
                          background: checked ? 'rgba(0,28,53,0.03)' : '#fff',
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleSite(s.id)}
                          style={{ accentColor: 'var(--color-accent-active)' }}
                        />
                        {s.name}
                      </label>
                    );
                  })}
                </div>
                {availableSites.length > 1 && (
                  <button
                    type="button"
                    onClick={() =>
                      setSiteIds(
                        siteIds.length === availableSites.length ? [] : availableSites.map((s) => s.id),
                      )
                    }
                    style={{
                      all: 'unset',
                      cursor: 'pointer',
                      fontSize: 11,
                      fontWeight: 700,
                      color: 'var(--color-accent-mid)',
                      marginTop: 8,
                      fontFamily: 'var(--font-primary)',
                    }}
                  >
                    {siteIds.length === availableSites.length ? 'Clear all sites' : 'Select all sites'}
                  </button>
                )}
              </div>

              <div
                style={{
                  padding: '10px 12px',
                  borderRadius: 10,
                  background: 'var(--color-bg-hover)',
                  border: '1px solid var(--color-border-subtle)',
                }}
              >
                <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--color-text-muted)', marginBottom: 3 }}>
                  Who can see this?
                </div>
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-text-primary)' }}>
                  {previewSummary}
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                {!!dashboard.audience && (
                  <button
                    type="button"
                    onClick={() => {
                      onUnpublish();
                      onClose();
                    }}
                    style={{
                      all: 'unset',
                      cursor: 'pointer',
                      fontSize: 12,
                      fontWeight: 700,
                      color: 'var(--color-error)',
                      padding: '8px 10px',
                      fontFamily: 'var(--font-primary)',
                    }}
                  >
                    {isCompany ? 'Reset to everyone' : 'Unpublish'}
                  </button>
                )}
                <div style={{ flex: 1 }} />
                <button
                  type="button"
                  onClick={onClose}
                  style={{
                    padding: '8px 14px',
                    borderRadius: 8,
                    border: '1px solid var(--color-border-subtle)',
                    background: '#fff',
                    cursor: 'pointer',
                    fontFamily: 'var(--font-primary)',
                    fontSize: 13,
                    fontWeight: 600,
                    color: 'var(--color-text-secondary)',
                  }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={!canSubmit}
                  onClick={() => {
                    // Everyone at every site is the company dashboard's
                    // natural state — store it as "no audience" so the
                    // summary keeps reading "Everyone at the company".
                    if (isCompany && fullSelection) onUnpublish();
                    else onPublish({ roles, siteIds });
                    onClose();
                  }}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    padding: '8px 16px',
                    borderRadius: 8,
                    border: 'none',
                    background: canSubmit ? 'var(--color-accent-active)' : 'var(--color-border)',
                    color: '#fff',
                    cursor: canSubmit ? 'pointer' : 'default',
                    fontFamily: 'var(--font-primary)',
                    fontSize: 13,
                    fontWeight: 700,
                  }}
                >
                  <Radio size={13} strokeWidth={2.4} />
                  {isLive ? 'Update audience' : 'Publish'}
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

const sectionLabelStyle: React.CSSProperties = {
  fontSize: 10,
  fontWeight: 700,
  letterSpacing: '0.06em',
  textTransform: 'uppercase',
  color: 'var(--color-text-muted)',
  marginBottom: 8,
};
