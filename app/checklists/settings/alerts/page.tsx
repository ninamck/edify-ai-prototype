'use client';

/**
 * Alert settings — who gets emailed when an audit question fails,
 * per severity. Recipients are role mappings (resolved to the actual
 * person at the failed audit's site), never hard-coded addresses.
 * Includes a preview of the email an alert would send; delivery
 * itself is out of scope for the prototype.
 */

import { useState } from 'react';
import { AlertTriangle, Bell, BellOff, Mail } from 'lucide-react';
import {
  ALERT_ROLE_LABELS,
  resolveRecipients,
  setAlertRouting,
  useAlertRouting,
  type AlertRole,
} from '../../alertsStore';
import { SEVERITY_COLORS, severityLabel } from '../../scoring';
import type { Severity } from '../../types';

const ALL_ROLES = Object.keys(ALERT_ROLE_LABELS) as AlertRole[];

const SEVERITY_BLURB: Record<Severity, string> = {
  critical: 'Immediate email the moment the audit is submitted — for the "smashed window" class of problem.',
  medium: 'Email to the people responsible for that site.',
  low: 'No email. Appears in the actions list only.',
};

/** Sample data for the email preview — the seeded Richmond critical fail. */
const PREVIEW = {
  site: 'Richmond',
  auditName: 'Brand standards audit',
  question: 'Storefront glass and windows intact, clean and free of damage?',
  comment:
    'Left-hand front window smashed overnight — glass swept but pane boarded up. Glazier needed urgently; storefront visibly damaged.',
  actionId: 'ca-audit-1',
  severity: 'critical' as Severity,
};

export default function AlertSettingsPage() {
  const routing = useAlertRouting();
  const [previewSeverity, setPreviewSeverity] = useState<Severity>('critical');

  function toggleRole(severity: Severity, role: AlertRole) {
    const current = routing[severity];
    const next = current.includes(role)
      ? current.filter((r) => r !== role)
      : [...current, role];
    setAlertRouting(severity, next);
  }

  const previewRecipients = resolveRecipients(routing, previewSeverity, PREVIEW.site);

  return (
    <div style={{ maxWidth: '720px', margin: '0 auto', padding: '24px 16px 48px' }}>
      <div style={{ marginBottom: '20px' }}>
        <h1 style={{ margin: 0, fontSize: '18px', fontWeight: 800, color: 'var(--color-text-primary)' }}>
          Audit alerts
        </h1>
        <p style={{ margin: '4px 0 0', fontSize: '13px', color: 'var(--color-text-secondary)', lineHeight: 1.5 }}>
          When an audit question fails, its severity decides who gets emailed. Recipients are
          roles, not addresses — site-scoped roles resolve to whoever holds them at the failed
          audit&rsquo;s site, so nothing breaks when people change.
        </p>
      </div>

      {/* Severity → role mapping */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '28px' }}>
        {(['critical', 'medium', 'low'] as Severity[]).map((sev) => {
          const c = SEVERITY_COLORS[sev];
          const roles = routing[sev];
          return (
            <div
              key={sev}
              style={{
                padding: '16px',
                borderRadius: '12px',
                border: `1px solid ${c.border}`,
                background: '#fff',
                display: 'flex',
                flexDirection: 'column',
                gap: '10px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{
                  padding: '3px 12px',
                  borderRadius: '100px',
                  fontSize: '12px',
                  fontWeight: 800,
                  background: c.bg,
                  color: c.text,
                }}>
                  {severityLabel(sev)} fail
                </span>
                {roles.length > 0
                  ? <Bell size={13} color="var(--color-text-muted)" />
                  : <BellOff size={13} color="var(--color-text-muted)" />}
                <span style={{ fontSize: '12px', color: 'var(--color-text-secondary)', fontWeight: 500 }}>
                  {SEVERITY_BLURB[sev]}
                </span>
              </div>

              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                {ALL_ROLES.map((role) => {
                  const active = roles.includes(role);
                  return (
                    <button
                      key={role}
                      type="button"
                      onClick={() => toggleRole(sev, role)}
                      style={{
                        padding: '6px 12px',
                        borderRadius: '100px',
                        border: active ? 'none' : '1px solid var(--color-border)',
                        background: active ? 'var(--color-accent-active)' : '#fff',
                        color: active ? '#F4F1EC' : 'var(--color-text-secondary)',
                        fontSize: '12px',
                        fontWeight: 600,
                        cursor: 'pointer',
                        fontFamily: 'var(--font-primary)',
                      }}
                    >
                      {ALERT_ROLE_LABELS[role]}
                    </button>
                  );
                })}
              </div>

              {roles.length === 0 && (
                <span style={{ fontSize: '12px', color: 'var(--color-text-muted)', fontWeight: 500 }}>
                  No email for {severityLabel(sev).toLowerCase()} fails — they still appear in the actions list.
                </span>
              )}
            </div>
          );
        })}
      </div>

      {/* Email preview */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', marginBottom: '10px', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '12px', fontWeight: 700, letterSpacing: '0.04em', color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>
            Email preview
          </span>
          <div style={{ display: 'flex', gap: '5px' }}>
            {(['critical', 'medium', 'low'] as Severity[]).map((sev) => (
              <button
                key={sev}
                type="button"
                onClick={() => setPreviewSeverity(sev)}
                style={{
                  padding: '4px 10px',
                  borderRadius: '100px',
                  border: previewSeverity === sev ? 'none' : '1px solid var(--color-border)',
                  background: previewSeverity === sev ? SEVERITY_COLORS[sev].bg : '#fff',
                  color: previewSeverity === sev ? SEVERITY_COLORS[sev].text : 'var(--color-text-secondary)',
                  fontSize: '12px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  fontFamily: 'var(--font-primary)',
                }}
              >
                {severityLabel(sev)}
              </button>
            ))}
          </div>
        </div>

        {previewRecipients.length === 0 ? (
          <div style={{
            padding: '20px',
            borderRadius: '12px',
            border: '1px dashed var(--color-border)',
            background: 'var(--color-bg-surface)',
            fontSize: '13px',
            color: 'var(--color-text-secondary)',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}>
            <BellOff size={15} color="var(--color-text-muted)" />
            No email is sent for {severityLabel(previewSeverity).toLowerCase()} fails — the action
            just lands in the actions list.
          </div>
        ) : (
          <div style={{
            borderRadius: '12px',
            border: '1px solid var(--color-border-subtle)',
            background: '#fff',
            overflow: 'hidden',
            boxShadow: '0 2px 8px rgba(0, 28, 53,0.07)',
          }}>
            {/* Envelope header */}
            <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--color-border-subtle)', background: 'var(--color-bg-surface)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '7px', marginBottom: '6px' }}>
                <Mail size={14} color="var(--color-text-muted)" />
                <span style={{ fontSize: '13px', fontWeight: 800, color: 'var(--color-text-primary)' }}>
                  {previewSeverity === 'critical' ? '🔴 ' : ''}
                  {severityLabel(previewSeverity)} audit fail — {PREVIEW.site}: {PREVIEW.auditName}
                </span>
              </div>
              <div style={{ fontSize: '12px', color: 'var(--color-text-secondary)', lineHeight: 1.6 }}>
                <strong>To:</strong> {previewRecipients.join('; ')}
                <br />
                <strong>From:</strong> Edify alerts &lt;alerts@edify.app&gt;
              </div>
            </div>

            {/* Body */}
            <div style={{ padding: '18px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{
                padding: '10px 12px',
                borderRadius: '9px',
                background: SEVERITY_COLORS[previewSeverity].bg,
                border: `1px solid ${SEVERITY_COLORS[previewSeverity].border}`,
                display: 'flex',
                alignItems: 'center',
                gap: '7px',
                fontSize: '13px',
                fontWeight: 700,
                color: SEVERITY_COLORS[previewSeverity].text,
              }}>
                <AlertTriangle size={14} />
                A {severityLabel(previewSeverity).toLowerCase()}-severity question failed at {PREVIEW.site}
              </div>

              <table style={{ fontSize: '13px', color: 'var(--color-text-primary)', borderSpacing: 0, lineHeight: 1.6 }}>
                <tbody>
                  <tr><td style={previewLabelCell}>Site</td><td>{PREVIEW.site}</td></tr>
                  <tr><td style={previewLabelCell}>Audit</td><td>{PREVIEW.auditName}</td></tr>
                  <tr><td style={previewLabelCell}>Failed question</td><td>{PREVIEW.question}</td></tr>
                  <tr><td style={previewLabelCell}>Auditor&rsquo;s comment</td><td style={{ fontStyle: 'italic' }}>&ldquo;{PREVIEW.comment}&rdquo;</td></tr>
                </tbody>
              </table>

              {/* Photo placeholder */}
              <div style={{
                width: '150px',
                height: '100px',
                borderRadius: '9px',
                background: '#D8D3CB',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '12px',
                color: '#555',
                fontWeight: 500,
              }}>
                Evidence photo
              </div>

              <a
                href={`/checklists/actions/${PREVIEW.actionId}`}
                style={{
                  alignSelf: 'flex-start',
                  padding: '10px 16px',
                  borderRadius: '9px',
                  background: 'var(--color-accent-active)',
                  color: '#F4F1EC',
                  fontSize: '13px',
                  fontWeight: 700,
                  textDecoration: 'none',
                }}
              >
                Open the action in Edify →
              </a>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

const previewLabelCell: React.CSSProperties = {
  fontWeight: 700,
  color: 'var(--color-text-secondary)',
  paddingRight: '14px',
  verticalAlign: 'top',
  whiteSpace: 'nowrap',
};
