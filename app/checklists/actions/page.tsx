'use client';

/**
 * Actions view — the central working screen for an ops manager.
 * Every open action across the estate (audit fails + checklist
 * corrective actions), filterable by status, site, severity and age.
 */

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { AlertTriangle, CheckCircle2, ClipboardList, MapPin, UserCheck, Wrench } from 'lucide-react';
import { useCorrectiveActions } from '../correctiveActionsStore';
import { MOCK_SITES } from '../mockData';
import { SEVERITY_COLORS, severityLabel } from '../scoring';
import type { CorrectiveAction, CorrectiveActionStatus, Severity } from '../types';

/** The demo world's "today" — ages are computed against it; actions
 *  raised live (real clock ahead of the demo world) count as today. */
const DEMO_TODAY = '2026-04-04';

function ageInDays(raisedDate: string): number {
  const raised = new Date(raisedDate).getTime();
  const today = new Date(DEMO_TODAY).getTime();
  if (Number.isNaN(raised) || raised >= today) return 0;
  return Math.floor((today - raised) / 86_400_000);
}

function ageLabel(days: number): string {
  if (days === 0) return 'Raised today';
  if (days === 1) return '1 day old';
  return `${days} days old`;
}

const STATUS_META: Record<CorrectiveActionStatus, { label: string; bg: string; text: string }> = {
  open: { label: 'Open', bg: '#FCE5EB', text: '#B01038' },
  in_progress: { label: 'In progress', bg: '#E4EDFB', text: '#3D5CA6' },
  resolved: { label: 'Resolved', bg: '#E3F2E8', text: '#166534' },
};

function FilterPill({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
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
        whiteSpace: 'nowrap',
      }}
    >
      {label}
    </button>
  );
}

function ActionCard({ action, onClick }: { action: CorrectiveAction; onClick: () => void }) {
  const status = STATUS_META[action.status];
  const days = ageInDays(action.raisedDate);
  const isCriticalOpen = action.severity === 'critical' && action.status !== 'resolved';

  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        width: '100%',
        textAlign: 'left',
        display: 'flex',
        gap: '12px',
        padding: '14px 16px',
        borderRadius: '12px',
        border: isCriticalOpen ? '1px solid #F5B5B5' : '1px solid var(--color-border-subtle)',
        boxShadow: isCriticalOpen
          ? 'inset 3px 0 0 #B91C1C, 0 1px 3px rgba(0, 28, 53, 0.06)'
          : '0 1px 3px rgba(0, 28, 53, 0.06)',
        background: '#fff',
        cursor: 'pointer',
        fontFamily: 'var(--font-primary)',
      }}
    >
      <div style={{
        width: '38px',
        height: '38px',
        borderRadius: '10px',
        background: status.bg,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
      }}>
        {action.status === 'resolved'
          ? <CheckCircle2 size={17} color={status.text} />
          : action.status === 'in_progress'
          ? <Wrench size={16} color={status.text} />
          : <AlertTriangle size={16} color={status.text} />}
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--color-text-primary)', lineHeight: 1.4, marginBottom: '3px' }}>
          {action.questionText}
        </div>
        <div style={{ fontSize: '12px', color: 'var(--color-text-secondary)', lineHeight: 1.45, marginBottom: '7px', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
          {action.issueSummary}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
          <span style={{ padding: '1px 8px', borderRadius: '100px', fontSize: '11px', fontWeight: 700, background: status.bg, color: status.text }}>
            {status.label}
          </span>
          {action.severity && (
            <span style={{
              padding: '1px 8px',
              borderRadius: '100px',
              fontSize: '11px',
              fontWeight: 700,
              background: SEVERITY_COLORS[action.severity].bg,
              color: SEVERITY_COLORS[action.severity].text,
            }}>
              {severityLabel(action.severity)}
            </span>
          )}
          <span style={metaStyle}><MapPin size={11} />{action.site}</span>
          <span style={metaStyle}><UserCheck size={11} />{action.assigneeName}</span>
          <span style={{ ...metaStyle, color: action.status !== 'resolved' && days > 7 ? '#B45309' : undefined, fontWeight: action.status !== 'resolved' && days > 7 ? 600 : 500 }}>
            {ageLabel(days)}
          </span>
          <span style={metaStyle}><ClipboardList size={11} />{action.templateName}</span>
        </div>
      </div>
    </button>
  );
}

const metaStyle: React.CSSProperties = {
  fontSize: '11px',
  fontWeight: 500,
  color: 'var(--color-text-muted)',
  display: 'flex',
  alignItems: 'center',
  gap: '3px',
};

type StatusFilter = 'all' | 'needs_work' | CorrectiveActionStatus;
type SeverityFilter = 'all' | Severity | 'none';
type AgeFilter = 'all' | 'week' | 'older';

export default function ActionsPage() {
  const router = useRouter();
  const actions = useCorrectiveActions();

  const [statusFilter, setStatusFilter] = useState<StatusFilter>('needs_work');
  const [siteFilter, setSiteFilter] = useState<string>('all');
  const [severityFilter, setSeverityFilter] = useState<SeverityFilter>('all');
  const [ageFilter, setAgeFilter] = useState<AgeFilter>('all');

  const filtered = actions.filter((a) => {
    if (statusFilter === 'needs_work' && a.status === 'resolved') return false;
    if (statusFilter !== 'all' && statusFilter !== 'needs_work' && a.status !== statusFilter) return false;
    if (siteFilter !== 'all' && a.site !== siteFilter) return false;
    if (severityFilter === 'none' && a.severity) return false;
    if (severityFilter !== 'all' && severityFilter !== 'none' && a.severity !== severityFilter) return false;
    const days = ageInDays(a.raisedDate);
    if (ageFilter === 'week' && days > 7) return false;
    if (ageFilter === 'older' && days <= 7) return false;
    return true;
  });

  const openCount = actions.filter((a) => a.status !== 'resolved').length;
  const criticalOpen = actions.filter((a) => a.status !== 'resolved' && a.severity === 'critical').length;

  return (
    <div style={{ minHeight: '100%', background: '#fff' }}>
      <div style={{ maxWidth: '620px', margin: '0 auto', padding: '20px 16px 48px' }}>

        {/* Header */}
        <div style={{ marginBottom: '16px' }}>
          <h1 style={{ margin: 0, fontSize: '18px', fontWeight: 800, color: 'var(--color-text-primary)' }}>
            Actions
          </h1>
          <p style={{ margin: '2px 0 0', fontSize: '12px', fontWeight: 500, color: 'var(--color-text-secondary)' }}>
            {openCount} needing work across all sites
            {criticalOpen > 0 && (
              <span style={{ color: '#B91C1C', fontWeight: 700 }}> · {criticalOpen} critical</span>
            )}
          </p>
        </div>

        {/* Filters */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '18px' }}>
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
            <FilterPill label="Needs work" active={statusFilter === 'needs_work'} onClick={() => setStatusFilter('needs_work')} />
            <FilterPill label="Open" active={statusFilter === 'open'} onClick={() => setStatusFilter('open')} />
            <FilterPill label="In progress" active={statusFilter === 'in_progress'} onClick={() => setStatusFilter('in_progress')} />
            <FilterPill label="Resolved" active={statusFilter === 'resolved'} onClick={() => setStatusFilter('resolved')} />
            <FilterPill label="All" active={statusFilter === 'all'} onClick={() => setStatusFilter('all')} />
          </div>
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
            <FilterPill label="All severities" active={severityFilter === 'all'} onClick={() => setSeverityFilter('all')} />
            {(['critical', 'medium', 'low'] as Severity[]).map((s) => (
              <FilterPill key={s} label={severityLabel(s)} active={severityFilter === s} onClick={() => setSeverityFilter(s)} />
            ))}
          </div>
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
            <FilterPill label="All sites" active={siteFilter === 'all'} onClick={() => setSiteFilter('all')} />
            {MOCK_SITES.map((s) => (
              <FilterPill key={s} label={s} active={siteFilter === s} onClick={() => setSiteFilter(s)} />
            ))}
          </div>
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
            <FilterPill label="Any age" active={ageFilter === 'all'} onClick={() => setAgeFilter('all')} />
            <FilterPill label="This week" active={ageFilter === 'week'} onClick={() => setAgeFilter('week')} />
            <FilterPill label="Older than a week" active={ageFilter === 'older'} onClick={() => setAgeFilter('older')} />
          </div>
        </div>

        {/* List */}
        {filtered.length === 0 ? (
          <div style={{ padding: '48px 24px', textAlign: 'center' }}>
            <CheckCircle2 size={36} color="#166534" style={{ marginBottom: '10px' }} />
            <p style={{ margin: 0, fontSize: '14px', fontWeight: 700, color: 'var(--color-text-primary)' }}>
              Nothing here
            </p>
            <p style={{ margin: '4px 0 0', fontSize: '12px', color: 'var(--color-text-secondary)' }}>
              No actions match these filters.
            </p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {filtered.map((a) => (
              <ActionCard key={a.id} action={a} onClick={() => router.push(`/checklists/actions/${a.id}`)} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
