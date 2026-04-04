'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  CheckCircle2,
  Clock,
  MapPin,
  User,
  ChevronRight,
  Filter,
  AlertTriangle,
} from 'lucide-react';
import { getAllHistoryInstances, MOCK_TEMPLATES, MOCK_SITES } from '../mockData';
import { getTemplateForInstance } from '../mockData';
import type { ChecklistInstance } from '../types';

// ─── helpers ─────────────────────────────────────────────────────────────────

function formatDateHeading(dateStr: string): string {
  const today = '2026-04-04';
  const yesterday = '2026-04-03';
  if (dateStr === today) return 'Today';
  if (dateStr === yesterday) return 'Yesterday';
  const [, month, day] = dateStr.split('-');
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${parseInt(day)} ${months[parseInt(month) - 1]}`;
}

/** Detect if any answer triggered a follow-up (indicates something needed attention) */
function hasFlags(instance: ChecklistInstance): boolean {
  const template = getTemplateForInstance(instance);
  if (!template) return false;
  return instance.answers.some((ans) => {
    const q = template.questions.find((q) => q.id === ans.questionId);
    if (!q) return false;
    if (ans.value === false) return true; // checkbox No
    if (typeof ans.value === 'number' && q.followUpRules.length > 0) {
      return q.followUpRules.some((r) => {
        if (r.condition.type === 'greater_than' && typeof r.condition.value === 'number') {
          return (ans.value as number) > r.condition.value;
        }
        if (r.condition.type === 'less_than' && typeof r.condition.value === 'number') {
          return (ans.value as number) < r.condition.value;
        }
        return false;
      });
    }
    return false;
  });
}

// ─── sub-components ───────────────────────────────────────────────────────────

function HistoryCard({ instance, onClick }: { instance: ChecklistInstance; onClick: () => void }) {
  const flagged = hasFlags(instance);

  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        width: '100%',
        textAlign: 'left',
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        padding: '14px 16px',
        borderRadius: '12px',
        border: flagged ? '1px solid #FDE68A' : '1px solid var(--color-border-subtle)',
        background: flagged ? '#FFFBEB' : '#fff',
        boxShadow: '0 1px 3px rgba(58,48,40,0.06)',
        cursor: 'pointer',
        fontFamily: 'var(--font-primary)',
        transition: 'box-shadow 0.15s ease',
      }}
    >
      {/* Icon */}
      <div style={{
        width: '40px',
        height: '40px',
        borderRadius: '10px',
        background: flagged ? '#FEF3C7' : '#F0FDF4',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
      }}>
        {flagged
          ? <AlertTriangle size={18} color="#D97706" />
          : <CheckCircle2 size={18} color="#15803D" />
        }
      </div>

      {/* Content */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          marginBottom: '3px',
        }}>
          <span style={{
            fontSize: '13px',
            fontWeight: 700,
            color: 'var(--color-text-primary)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}>
            {instance.templateName}
          </span>
          {flagged && (
            <span style={{
              fontSize: '9px',
              fontWeight: 700,
              padding: '2px 6px',
              borderRadius: '100px',
              background: '#FEF3C7',
              color: '#B45309',
              flexShrink: 0,
            }}>
              Action taken
            </span>
          )}
        </div>

        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '11px', color: 'var(--color-text-muted)', display: 'flex', alignItems: 'center', gap: '3px' }}>
            <Clock size={10} />
            {instance.completedAt}
          </span>
          <span style={{ fontSize: '11px', color: 'var(--color-text-muted)', display: 'flex', alignItems: 'center', gap: '3px' }}>
            <MapPin size={10} />
            {instance.site}
          </span>
          {instance.completedBy && (
            <span style={{ fontSize: '11px', color: 'var(--color-text-muted)', display: 'flex', alignItems: 'center', gap: '3px' }}>
              <User size={10} />
              {instance.completedBy}
            </span>
          )}
        </div>
      </div>

      <ChevronRight size={15} color="var(--color-text-muted)" style={{ flexShrink: 0 }} />
    </button>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function ChecklistHistoryPage() {
  const router = useRouter();
  const allHistory = getAllHistoryInstances();

  const [filterChecklist, setFilterChecklist] = useState('all');
  const [filterSite, setFilterSite] = useState('all');
  const [showFilters, setShowFilters] = useState(false);

  const checklistNames = ['all', ...Array.from(new Set(MOCK_TEMPLATES.map((t) => t.name)))];
  const sites = ['all', ...MOCK_SITES];

  const filtered = allHistory.filter((inst) => {
    if (filterChecklist !== 'all' && inst.templateName !== filterChecklist) return false;
    if (filterSite !== 'all' && inst.site !== filterSite) return false;
    return true;
  });

  // Group by date
  const grouped = filtered.reduce<Record<string, ChecklistInstance[]>>((acc, inst) => {
    const key = inst.completedDate ?? 'unknown';
    if (!acc[key]) acc[key] = [];
    acc[key].push(inst);
    return acc;
  }, {});

  const sortedDates = Object.keys(grouped).sort((a, b) => b.localeCompare(a));
  const flaggedCount = filtered.filter(hasFlags).length;

  return (
    <div style={{ minHeight: '100%', background: '#fff' }}>
      <div style={{ maxWidth: '560px', margin: '0 auto', padding: '20px 16px 48px' }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
          <div>
            <h1 style={{ margin: 0, fontSize: '18px', fontWeight: 800, color: 'var(--color-text-primary)' }}>
              History
            </h1>
            <p style={{ margin: '2px 0 0', fontSize: '11px', color: 'var(--color-text-secondary)' }}>
              {filtered.length} completed · {flaggedCount} with flags
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowFilters((f) => !f)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '5px',
              padding: '8px 13px',
              borderRadius: '8px',
              border: (filterChecklist !== 'all' || filterSite !== 'all')
                ? 'none'
                : '1px solid var(--color-border)',
              background: (filterChecklist !== 'all' || filterSite !== 'all')
                ? 'var(--color-accent-active)'
                : '#fff',
              fontSize: '12px',
              fontWeight: 600,
              color: (filterChecklist !== 'all' || filterSite !== 'all') ? '#F4F1EC' : 'var(--color-text-secondary)',
              cursor: 'pointer',
              fontFamily: 'var(--font-primary)',
            }}
          >
            <Filter size={13} />
            Filter
            {(filterChecklist !== 'all' || filterSite !== 'all') && (
              <span style={{
                minWidth: '16px',
                height: '16px',
                borderRadius: '100px',
                background: 'rgba(255,255,255,0.25)',
                fontSize: '9px',
                fontWeight: 800,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}>
                {(filterChecklist !== 'all' ? 1 : 0) + (filterSite !== 'all' ? 1 : 0)}
              </span>
            )}
          </button>
        </div>

        {/* Filter panel */}
        {showFilters && (
          <div style={{
            padding: '14px',
            borderRadius: '10px',
            border: '1px solid var(--color-border-subtle)',
            background: 'var(--color-bg-surface)',
            marginBottom: '16px',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
          }}>
            <div>
              <div style={filterLabelStyle}>Checklist</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                {checklistNames.map((name) => (
                  <FilterPill
                    key={name}
                    label={name === 'all' ? 'All checklists' : name}
                    active={filterChecklist === name}
                    onClick={() => setFilterChecklist(name)}
                  />
                ))}
              </div>
            </div>
            <div>
              <div style={filterLabelStyle}>Site</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                {sites.map((s) => (
                  <FilterPill
                    key={s}
                    label={s === 'all' ? 'All sites' : s}
                    active={filterSite === s}
                    onClick={() => setFilterSite(s)}
                  />
                ))}
              </div>
            </div>
            {(filterChecklist !== 'all' || filterSite !== 'all') && (
              <button
                type="button"
                onClick={() => { setFilterChecklist('all'); setFilterSite('all'); }}
                style={{
                  alignSelf: 'flex-start',
                  padding: '5px 12px',
                  borderRadius: '7px',
                  border: '1px solid var(--color-border)',
                  background: '#fff',
                  fontSize: '11px',
                  fontWeight: 600,
                  color: 'var(--color-text-secondary)',
                  cursor: 'pointer',
                  fontFamily: 'var(--font-primary)',
                }}
              >
                Clear filters
              </button>
            )}
          </div>
        )}

        {/* Day-grouped list */}
        {sortedDates.length === 0 ? (
          <div style={{ padding: '60px 0', textAlign: 'center', color: 'var(--color-text-muted)', fontSize: '13px' }}>
            No completed checklists found.
          </div>
        ) : (
          sortedDates.map((date) => (
            <div key={date} style={{ marginBottom: '24px' }}>
              <div style={dayHeadingStyle}>{formatDateHeading(date)}</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {grouped[date].map((inst) => (
                  <HistoryCard
                    key={inst.id}
                    instance={inst}
                    onClick={() => router.push(`/checklists/history/${inst.id}`)}
                  />
                ))}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function FilterPill({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        padding: '5px 11px',
        borderRadius: '100px',
        border: active ? 'none' : '1px solid var(--color-border)',
        background: active ? 'var(--color-accent-active)' : '#fff',
        color: active ? '#F4F1EC' : 'var(--color-text-secondary)',
        fontSize: '11px',
        fontWeight: 600,
        cursor: 'pointer',
        fontFamily: 'var(--font-primary)',
      }}
    >
      {label}
    </button>
  );
}

const filterLabelStyle: React.CSSProperties = {
  fontSize: '10px',
  fontWeight: 700,
  letterSpacing: '0.07em',
  textTransform: 'uppercase',
  color: 'var(--color-text-muted)',
  marginBottom: '7px',
};

const dayHeadingStyle: React.CSSProperties = {
  fontSize: '11px',
  fontWeight: 700,
  letterSpacing: '0.06em',
  textTransform: 'uppercase',
  color: 'var(--color-text-muted)',
  marginBottom: '8px',
  paddingBottom: '6px',
  borderBottom: '1px solid var(--color-border-subtle)',
};
