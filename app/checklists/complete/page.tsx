'use client';

import { useRouter } from 'next/navigation';
import { ClipboardList, Clock, MapPin, ChevronRight, CheckCircle2, History } from 'lucide-react';
import { MOCK_INSTANCES } from '../mockData';
import type { ChecklistInstance, InstanceStatus, UserRole } from '../types';

const STATUS_CONFIG: Record<InstanceStatus, { label: string; bg: string; text: string }> = {
  pending: { label: 'Pending', bg: '#FFF7ED', text: '#C2410C' },
  in_progress: { label: 'In progress', bg: '#EFF6FF', text: '#1D4ED8' },
  complete: { label: 'Complete', bg: '#F0FDF4', text: '#15803D' },
};

const ROLE_LABELS: Record<UserRole, string> = {
  kitchen: 'Kitchen',
  manager: 'Manager',
  admin: 'Admin',
};

function StatusPill({ status }: { status: InstanceStatus }) {
  const cfg = STATUS_CONFIG[status];
  return (
    <span style={{
      display: 'inline-flex',
      alignItems: 'center',
      padding: '3px 9px',
      borderRadius: '100px',
      fontSize: '10px',
      fontWeight: 700,
      background: cfg.bg,
      color: cfg.text,
    }}>
      {cfg.label}
    </span>
  );
}

function InstanceCard({ instance, onClick }: { instance: ChecklistInstance; onClick: () => void }) {
  const isComplete = instance.status === 'complete';

  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        width: '100%',
        textAlign: 'left',
        display: 'flex',
        alignItems: 'center',
        gap: '14px',
        padding: '16px',
        borderRadius: '12px',
        border: '1px solid var(--color-border-subtle)',
        background: isComplete ? 'var(--color-bg-surface)' : '#fff',
        boxShadow: isComplete ? 'none' : '0 1px 4px rgba(58,48,40,0.07)',
        cursor: 'pointer',
        fontFamily: 'var(--font-primary)',
        opacity: isComplete ? 0.85 : 1,
        transition: 'box-shadow 0.15s ease, border-color 0.15s ease',
      }}
    >
      {/* Icon */}
      <div style={{
        width: '44px',
        height: '44px',
        borderRadius: '10px',
        background: isComplete ? '#F0FDF4' : 'var(--color-bg-surface)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
      }}>
        {isComplete
          ? <CheckCircle2 size={22} color="#15803D" />
          : <ClipboardList size={20} color="var(--color-text-secondary)" />
        }
      </div>

      {/* Content */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: '14px',
          fontWeight: 700,
          color: 'var(--color-text-primary)',
          marginBottom: '4px',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}>
          {instance.templateName}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '8px', marginBottom: '6px' }}>
          <StatusPill status={instance.status} />
          <span style={{
            fontSize: '11px',
            color: 'var(--color-text-secondary)',
            display: 'flex',
            alignItems: 'center',
            gap: '3px',
          }}>
            <Clock size={11} />
            {instance.dueLabel}
          </span>
        </div>

        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '11px', color: 'var(--color-text-muted)', display: 'flex', alignItems: 'center', gap: '3px' }}>
            <MapPin size={11} />
            {instance.site}
          </span>
          <span style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>
            {ROLE_LABELS[instance.assignedRole]} · {instance.questionCount} questions
          </span>
        </div>

        {/* Progress bar for in_progress */}
        {instance.status === 'in_progress' && instance.answers.length > 0 && (
          <div style={{ marginTop: '8px' }}>
            <div style={{
              height: '4px',
              borderRadius: '100px',
              background: 'var(--color-border-subtle)',
              overflow: 'hidden',
            }}>
              <div style={{
                height: '100%',
                width: `${Math.round((instance.answers.length / instance.questionCount) * 100)}%`,
                background: 'var(--color-accent-active)',
                borderRadius: '100px',
                transition: 'width 0.3s ease',
              }} />
            </div>
            <span style={{ fontSize: '10px', color: 'var(--color-text-muted)', marginTop: '3px', display: 'block' }}>
              {instance.answers.length} of {instance.questionCount} answered
            </span>
          </div>
        )}
      </div>

      <ChevronRight size={16} color="var(--color-text-muted)" style={{ flexShrink: 0 }} />
    </button>
  );
}

export default function CompleteTasksPage() {
  const router = useRouter();

  const pending = MOCK_INSTANCES.filter((i) => i.status !== 'complete');
  const complete = MOCK_INSTANCES.filter((i) => i.status === 'complete');

  return (
    <div style={{ minHeight: '100%', background: '#fff' }}>
      {/* Mobile-friendly max-width container */}
      <div style={{ maxWidth: '560px', margin: '0 auto', padding: '20px 16px 40px' }}>

        {/* Summary strip */}
        <div style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
          <div style={summaryCardStyle}>
            <span style={{ fontSize: '22px', fontWeight: 800, color: 'var(--color-text-primary)' }}>{pending.length}</span>
            <span style={{ fontSize: '11px', color: 'var(--color-text-secondary)', fontWeight: 500 }}>To do</span>
          </div>
          <div style={summaryCardStyle}>
            <span style={{ fontSize: '22px', fontWeight: 800, color: '#15803D' }}>{complete.length}</span>
            <span style={{ fontSize: '11px', color: 'var(--color-text-secondary)', fontWeight: 500 }}>Done today</span>
          </div>
          <button
            type="button"
            onClick={() => router.push('/checklists/history')}
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '14px 16px',
              borderRadius: '10px',
              border: '1px solid var(--color-border-subtle)',
              background: 'var(--color-bg-surface)',
              gap: '3px',
              cursor: 'pointer',
              fontFamily: 'var(--font-primary)',
              flexShrink: 0,
            }}
          >
            <History size={18} color="var(--color-text-secondary)" />
            <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--color-text-secondary)' }}>History</span>
          </button>
        </div>

        {/* Pending section */}
        {pending.length > 0 && (
          <div style={{ marginBottom: '24px' }}>
            <div style={sectionHeaderStyle}>To do</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {pending.map((inst) => (
                <InstanceCard
                  key={inst.id}
                  instance={inst}
                  onClick={() => router.push(`/checklists/complete/${inst.id}`)}
                />
              ))}
            </div>
          </div>
        )}

        {/* Complete section */}
        {complete.length > 0 && (
          <div>
            <div style={sectionHeaderStyle}>Completed today</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {complete.map((inst) => (
                <InstanceCard
                  key={inst.id}
                  instance={inst}
                  onClick={() => router.push(`/checklists/history/${inst.id}`)}
                />
              ))}
            </div>
          </div>
        )}

        {MOCK_INSTANCES.length === 0 && (
          <div style={{ padding: '60px 0', textAlign: 'center' }}>
            <CheckCircle2 size={40} color="#15803D" style={{ marginBottom: '12px' }} />
            <p style={{ fontSize: '16px', fontWeight: 700, color: 'var(--color-text-primary)', margin: '0 0 4px' }}>
              All done!
            </p>
            <p style={{ fontSize: '13px', color: 'var(--color-text-secondary)', margin: 0 }}>
              No checklists due right now.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

const summaryCardStyle: React.CSSProperties = {
  flex: 1,
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  padding: '14px 12px',
  borderRadius: '10px',
  border: '1px solid var(--color-border-subtle)',
  background: 'var(--color-bg-surface)',
  gap: '2px',
};

const sectionHeaderStyle: React.CSSProperties = {
  fontSize: '10px',
  fontWeight: 700,
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
  color: 'var(--color-text-muted)',
  marginBottom: '10px',
};
