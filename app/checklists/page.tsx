'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, ClipboardList, Edit2, Clock, MapPin, Users, History, AlertTriangle } from 'lucide-react';
import { getAllHistoryInstances } from './mockData';
import { MOCK_TEMPLATES, MOCK_USERS } from './mockData';
import type { ChecklistTemplate, Frequency, UserRole } from './types';

const FREQUENCY_LABELS: Record<Frequency, string> = {
  daily: 'Daily',
  weekly: 'Weekly',
  monthly: 'Monthly',
  once: 'One-off',
};

const ROLE_LABELS: Record<UserRole, string> = {
  kitchen: 'Kitchen',
  manager: 'Manager',
  admin: 'Admin',
};

const ROLE_COLORS: Record<UserRole, { bg: string; text: string }> = {
  kitchen: { bg: '#EEF4FF', text: '#3B5BDB' },
  manager: { bg: '#F0FDF4', text: '#15803D' },
  admin: { bg: '#FFF7ED', text: '#EA580C' },
};

function Pill({ label, color }: { label: string; color?: { bg: string; text: string } }) {
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        padding: '2px 8px',
        borderRadius: '100px',
        fontSize: '12px',
        fontWeight: 600,
        background: color?.bg ?? 'var(--color-bg-surface)',
        color: color?.text ?? 'var(--color-text-secondary)',
        border: color ? 'none' : '1px solid var(--color-border-subtle)',
        whiteSpace: 'nowrap',
      }}
    >
      {label}
    </span>
  );
}

function TemplateCard({ template, onEdit }: { template: ChecklistTemplate; onEdit: () => void }) {
  const notifyNames = template.notifyUserIds
    .map((id) => MOCK_USERS.find((u) => u.id === id)?.name)
    .filter(Boolean)
    .join(', ');

  const rootQuestions = template.questions.filter((q) => !q.parentQuestionId);

  return (
    <div
      style={{
        background: '#fff',
        borderRadius: '10px',
        border: '1px solid var(--color-border-subtle)',
        boxShadow: '0 1px 4px rgba(58,48,40,0.07)',
        padding: '16px',
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
      }}
    >
      {/* Header row */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
            <ClipboardList size={15} color="var(--color-text-secondary)" />
            <span style={{ fontSize: '14px', fontWeight: 700, color: 'var(--color-text-primary)' }}>
              {template.name}
            </span>
            {!template.active && (
              <span style={{
                padding: '1px 7px',
                borderRadius: '100px',
                background: '#F5F4F2',
                color: 'var(--color-text-muted)',
                fontSize: '12px',
                fontWeight: 600,
              }}>
                Inactive
              </span>
            )}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
            {template.assignedRoles.map((r) => (
              <Pill key={r} label={ROLE_LABELS[r]} color={ROLE_COLORS[r]} />
            ))}
            <Pill label={FREQUENCY_LABELS[template.frequency]} />
            <span style={{ fontSize: '12px', fontWeight: 500, color: 'var(--color-text-secondary)', display: 'flex', alignItems: 'center', gap: '3px' }}>
              <Clock size={11} />
              {template.timeOfDay}
            </span>
          </div>
        </div>

        <button
          onClick={onEdit}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '5px',
            padding: '7px 12px',
            borderRadius: '8px',
            border: '1px solid var(--color-border)',
            background: '#fff',
            fontSize: '12px',
            fontWeight: 600,
            color: 'var(--color-text-secondary)',
            cursor: 'pointer',
            whiteSpace: 'nowrap',
            flexShrink: 0,
            fontFamily: 'var(--font-primary)',
          }}
        >
          <Edit2 size={12} />
          Edit
        </button>
      </div>

      {/* Meta row */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
          <MapPin size={12} color="var(--color-text-muted)" />
          <span style={{ fontSize: '12px', fontWeight: 500, color: 'var(--color-text-secondary)' }}>
            {template.sites.length === 1
              ? template.sites[0]
              : `${template.sites.length} sites`}
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
          <ClipboardList size={12} color="var(--color-text-muted)" />
          <span style={{ fontSize: '12px', fontWeight: 500, color: 'var(--color-text-secondary)' }}>
            {rootQuestions.length} {rootQuestions.length === 1 ? 'question' : 'questions'}
          </span>
        </div>

        {notifyNames && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
            <Users size={12} color="var(--color-text-muted)" />
            <span style={{ fontSize: '12px', fontWeight: 500, color: 'var(--color-text-secondary)' }}>
              Notify {notifyNames}
            </span>
          </div>
        )}
      </div>

      {/* Site pills (if multiple) */}
      {template.sites.length > 1 && (
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
          {template.sites.map((s) => (
            <Pill key={s} label={s} />
          ))}
        </div>
      )}
    </div>
  );
}

export default function ManageChecklistsPage() {
  const router = useRouter();
  const [templates] = useState(MOCK_TEMPLATES);
  const [activeFilter, setActiveFilter] = useState<'all' | 'active' | 'inactive'>('all');

  const filtered = templates.filter((t) => {
    if (activeFilter === 'active') return t.active;
    if (activeFilter === 'inactive') return !t.active;
    return true;
  });

  const history = getAllHistoryInstances();
  const recentFlagged = history.filter((inst) => {
    // Quick flag check — any 'No' checkbox answer
    return inst.answers.some((a) => a.value === false);
  });

  return (
    <div style={{ padding: '24px', maxWidth: '860px', margin: '0 auto' }}>

      {/* History entry point card */}
      <button
        type="button"
        onClick={() => router.push('/checklists/history')}
        style={{
          width: '100%',
          textAlign: 'left',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '16px',
          padding: '14px 18px',
          borderRadius: '10px',
          border: recentFlagged.length > 0 ? '1px solid #FDE68A' : '1px solid var(--color-border-subtle)',
          background: recentFlagged.length > 0 ? '#FFFBEB' : 'var(--color-bg-surface)',
          marginBottom: '20px',
          cursor: 'pointer',
          fontFamily: 'var(--font-primary)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{
            width: '36px',
            height: '36px',
            borderRadius: '8px',
            background: recentFlagged.length > 0 ? '#FEF3C7' : '#fff',
            border: '1px solid var(--color-border-subtle)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}>
            {recentFlagged.length > 0
              ? <AlertTriangle size={16} color="#D97706" />
              : <History size={16} color="var(--color-text-secondary)" />
            }
          </div>
          <div>
            <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--color-text-primary)' }}>
              View completion history
            </div>
            <div style={{ fontSize: '12px', fontWeight: 500, color: 'var(--color-text-secondary)', marginTop: '1px' }}>
              {history.length} completed records
              {recentFlagged.length > 0 && (
                <span style={{ color: '#B45309', fontWeight: 600 }}>
                  {' '}· {recentFlagged.length} with flags needing review
                </span>
              )}
            </div>
          </div>
        </div>
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0 }}>
          <path d="M6 3l5 5-5 5" stroke="var(--color-text-muted)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </button>

      {/* Page header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '16px',
        marginBottom: '20px',
        flexWrap: 'wrap',
      }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '20px', fontWeight: 700, color: 'var(--color-text-primary)' }}>
            Checklists
          </h1>
          <p style={{ margin: '2px 0 0', fontSize: '12px', fontWeight: 500, color: 'var(--color-text-secondary)' }}>
            {templates.filter((t) => t.active).length} active · {templates.length} total
          </p>
        </div>

        <button
          onClick={() => router.push('/checklists/new')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            padding: '9px 16px',
            borderRadius: '9px',
            background: 'var(--color-accent-active)',
            border: 'none',
            fontSize: '13px',
            fontWeight: 600,
            color: '#F4F1EC',
            cursor: 'pointer',
            fontFamily: 'var(--font-primary)',
          }}
        >
          <Plus size={15} strokeWidth={2.5} />
          Create checklist
        </button>
      </div>

      {/* Filter tabs */}
      <div style={{
        display: 'flex',
        gap: '4px',
        marginBottom: '20px',
        background: 'var(--color-bg-surface)',
        padding: '4px',
        borderRadius: '9px',
        width: 'fit-content',
      }}>
        {(['all', 'active', 'inactive'] as const).map((f) => (
          <button
            key={f}
            onClick={() => setActiveFilter(f)}
            style={{
              padding: '6px 14px',
              borderRadius: '7px',
              border: 'none',
              fontSize: '12px',
              fontWeight: activeFilter === f ? 700 : 500,
              background: activeFilter === f ? '#fff' : 'transparent',
              color: activeFilter === f ? 'var(--color-text-primary)' : 'var(--color-text-secondary)',
              cursor: 'pointer',
              fontFamily: 'var(--font-primary)',
              boxShadow: activeFilter === f ? '0 1px 3px rgba(58,48,40,0.1)' : 'none',
              transition: 'all 0.15s ease',
            }}
          >
            {f === 'all' ? 'All' : f === 'active' ? 'Active' : 'Inactive'}
          </button>
        ))}
      </div>

      {/* Template list */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {filtered.length === 0 ? (
          <div style={{
            padding: '48px 24px',
            textAlign: 'center',
            color: 'var(--color-text-muted)',
            fontSize: '13px',
          }}>
            No checklists found
          </div>
        ) : (
          filtered.map((tpl) => (
            <TemplateCard
              key={tpl.id}
              template={tpl}
              onEdit={() => router.push(`/checklists/${tpl.id}`)}
            />
          ))
        )}
      </div>
    </div>
  );
}
