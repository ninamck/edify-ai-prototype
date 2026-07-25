'use client';

/**
 * Scheduled reports — governance page.
 *
 * The drawer is for creation (the 80% path from a card); this page is
 * for management. It doubles as the admin-visible audit of every active
 * schedule for the company: who owns each report, what it contains, who
 * receives it, and when it last went out. Multi-insight digests are
 * built from scratch here via "New report".
 */

import { useState } from 'react';
import { Eye, Mail, Pause, Pencil, Play, Plus, Trash2 } from 'lucide-react';
import ScheduleReportDrawer from '@/components/ScheduledReports/ScheduleReportDrawer';
import {
  cadenceLabel,
  useScheduledReports,
  type ScheduledReport,
} from '@/components/ScheduledReports/scheduledReportsStore';
import type { CSSProperties } from 'react';

const NAVY = '#001C35';
const OK_TEXT = '#166534';
const WARN_TEXT = '#B45309';

const TH: CSSProperties = {
  fontSize: 11,
  fontWeight: 700,
  color: 'var(--color-text-muted)',
  textTransform: 'uppercase',
  letterSpacing: '0.03em',
  padding: '10px 14px',
  textAlign: 'left',
  whiteSpace: 'nowrap',
  borderBottom: '1px solid var(--color-border-subtle)',
};

const TD: CSSProperties = {
  fontSize: 12.5,
  fontWeight: 500,
  color: 'var(--color-text-primary)',
  padding: '11px 14px',
  textAlign: 'left',
  verticalAlign: 'top',
  borderBottom: '1px solid var(--color-border-subtle)',
};

export default function ScheduledReportsPage() {
  const { reports, removeReport, toggleActive } = useScheduledReports();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editing, setEditing] = useState<ScheduledReport | null>(null);

  function openNew() {
    setEditing(null);
    setDrawerOpen(true);
  }

  function openEdit(report: ScheduledReport) {
    setEditing(report);
    setDrawerOpen(true);
  }

  /** Mock of the email this report sends, opened in a new tab. */
  function previewHref(r: ScheduledReport): string {
    const qs = new URLSearchParams({
      insights: r.contents.join('|'),
      name: r.name,
      site: r.siteScope,
      window: r.dataWindow,
      to: r.recipients.join(','),
      format: r.format,
      owner: r.owner,
      cadence: `${cadenceLabel(r.cadence)} at ${r.sendTime}`,
    });
    return `/email-preview?${qs.toString()}`;
  }

  return (
    <div style={{ padding: '28px 32px 48px', maxWidth: 1500, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap', marginBottom: 18 }}>
        <div style={{ minWidth: 0, flex: 1 }}>
          <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: 'var(--color-text-primary)' }}>
            Scheduled reports
          </h1>
          <p style={{ margin: '6px 0 0', fontSize: 12.5, color: 'var(--color-text-muted)', maxWidth: 720, lineHeight: 1.5 }}>
            Every email schedule for this company, across all owners. Reports render with their owner&rsquo;s
            access at the moment of sending — if an owner loses access to a site, its reports pause rather
            than keep sending.
          </p>
        </div>
        <button
          onClick={openNew}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            padding: '9px 16px',
            borderRadius: 10,
            border: 'none',
            background: NAVY,
            color: '#fff',
            fontSize: 12.5,
            fontWeight: 700,
            cursor: 'pointer',
            fontFamily: 'inherit',
          }}
        >
          <Plus size={14} strokeWidth={2.4} />
          New report
        </button>
      </div>

      {/* Table */}
      <div
        style={{
          borderRadius: '12px 0 12px 12px',
          border: `1px solid ${NAVY}`,
          background: '#fff',
          boxShadow: '0 2px 12px rgba(0, 28, 53,0.1), 0 0 0 1px rgba(0, 28, 53,0.03)',
          overflow: 'hidden',
        }}
      >
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={TH}>Report</th>
                <th style={TH}>Contents</th>
                <th style={TH}>Recipients</th>
                <th style={TH}>Cadence</th>
                <th style={TH}>Format</th>
                <th style={TH}>Site</th>
                <th style={TH}>Owner</th>
                <th style={TH}>Last sent</th>
                <th style={TH}>Status</th>
                <th style={{ ...TH, textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {reports.length === 0 && (
                <tr>
                  <td style={{ ...TD, textAlign: 'center', padding: '28px 14px', color: 'var(--color-text-muted)' }} colSpan={10}>
                    No scheduled reports yet — create one here, or from any chart&rsquo;s Email button.
                  </td>
                </tr>
              )}
              {reports.map((r) => (
                <tr key={r.id} style={{ opacity: r.active ? 1 : 0.75 }}>
                  <td style={{ ...TD, fontWeight: 700, whiteSpace: 'nowrap' }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7 }}>
                      <Mail size={13} color="var(--color-text-muted)" strokeWidth={2} />
                      {r.name}
                    </span>
                  </td>
                  <td style={{ ...TD, maxWidth: 260 }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                      {r.contents.map((c) => (
                        <span key={c} style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>{c}</span>
                      ))}
                    </div>
                  </td>
                  <td style={{ ...TD, maxWidth: 220 }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                      {r.recipients.map((rc) => (
                        <span key={rc} style={{ fontSize: 12, color: 'var(--color-text-secondary)', wordBreak: 'break-all' }}>{rc}</span>
                      ))}
                    </div>
                  </td>
                  <td style={{ ...TD, whiteSpace: 'nowrap' }}>
                    {cadenceLabel(r.cadence)} · {r.sendTime}
                    <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 2 }}>site time</div>
                  </td>
                  <td style={{ ...TD, whiteSpace: 'nowrap', textTransform: 'uppercase', fontWeight: 700, fontSize: 11.5 }}>
                    {r.format}
                  </td>
                  <td style={{ ...TD, whiteSpace: 'nowrap' }}>{r.siteScope}</td>
                  <td style={{ ...TD, whiteSpace: 'nowrap' }}>{r.owner}</td>
                  <td style={{ ...TD, whiteSpace: 'nowrap', color: 'var(--color-text-secondary)' }}>{r.lastSentLabel}</td>
                  <td style={{ ...TD, whiteSpace: 'nowrap' }}>
                    {r.active ? (
                      <span style={{ fontWeight: 700, color: OK_TEXT, fontSize: 12 }}>Active</span>
                    ) : (
                      <span style={{ fontWeight: 700, color: WARN_TEXT, fontSize: 12 }}>
                        Paused
                        {r.pausedReason && (
                          <div style={{ fontWeight: 500, fontSize: 11, color: 'var(--color-text-muted)', marginTop: 2, maxWidth: 200, whiteSpace: 'normal' }}>
                            {r.pausedReason}
                          </div>
                        )}
                      </span>
                    )}
                  </td>
                  <td style={{ ...TD, textAlign: 'right', whiteSpace: 'nowrap' }}>
                    <a
                      href={previewHref(r)}
                      target="_blank"
                      rel="noreferrer"
                      title="Preview email"
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 4,
                        padding: '5px 9px',
                        marginLeft: 6,
                        borderRadius: 8,
                        border: '1px solid var(--color-border-subtle)',
                        background: '#fff',
                        color: 'var(--color-text-secondary)',
                        fontSize: 11.5,
                        fontWeight: 600,
                        textDecoration: 'none',
                      }}
                    >
                      <Eye size={13} strokeWidth={2.2} />
                      Preview
                    </a>
                    <RowAction
                      label={r.active ? 'Pause' : 'Resume'}
                      icon={r.active ? <Pause size={13} strokeWidth={2.2} /> : <Play size={13} strokeWidth={2.2} />}
                      onClick={() => toggleActive(r.id)}
                    />
                    <RowAction label="Edit" icon={<Pencil size={13} strokeWidth={2.2} />} onClick={() => openEdit(r)} />
                    <RowAction
                      label="Delete"
                      icon={<Trash2 size={13} strokeWidth={2.2} />}
                      onClick={() => removeReport(r.id)}
                      danger
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* The drawer's grouped insight catalogue covers every dashboard and
          template view, so no sibling list is needed here. */}
      <ScheduleReportDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        editingReport={editing}
        siteLabel="Fitzroy"
        dataWindowLabel="Last complete week as of send date"
        defaultMode="schedule"
      />
    </div>
  );
}

function RowAction({
  label,
  icon,
  onClick,
  danger = false,
}: {
  label: string;
  icon: React.ReactNode;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      title={label}
      aria-label={label}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        padding: '5px 9px',
        marginLeft: 6,
        borderRadius: 8,
        border: '1px solid var(--color-border-subtle)',
        background: '#fff',
        color: danger ? WARN_TEXT : 'var(--color-text-secondary)',
        fontSize: 11.5,
        fontWeight: 600,
        cursor: 'pointer',
        fontFamily: 'inherit',
      }}
    >
      {icon}
      {label}
    </button>
  );
}
