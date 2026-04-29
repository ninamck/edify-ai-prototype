'use client';

import { useMemo, useState } from 'react';
import {
  Sparkles,
  Settings,
  ArchiveRestore,
  PencilLine,
  RefreshCw,
  Clock,
  AlertTriangle,
  Eye,
  Check,
} from 'lucide-react';
import StatusPill from '@/components/Production/StatusPill';
import { useRole, StaffLockBanner } from '@/components/Production/RoleContext';
import {
  PRET_SETTINGS_HEALTH,
  getSite,
  type SettingsHealthItem,
  type SettingsHealthStatus,
} from '@/components/Production/fixtures';

const STATUS_META: Record<SettingsHealthStatus, { label: string; tone: 'warning' | 'info' | 'error'; icon: React.ReactNode }> = {
  stale: { label: 'Stale', tone: 'warning', icon: <Clock size={14} /> },
  unused: { label: 'Unused', tone: 'info', icon: <Eye size={14} /> },
  suspect: { label: 'Suspect', tone: 'error', icon: <AlertTriangle size={14} /> },
};

const REMEDIATION_ICONS = {
  archive: <ArchiveRestore size={12} />,
  refresh: <RefreshCw size={12} />,
  edit: <PencilLine size={12} />,
  'ask-quinn': <Sparkles size={12} />,
};

export default function SettingsHealthPage() {
  const { can } = useRole();
  const canRemediate = can('settings.remediate');
  const [scopeFilter, setScopeFilter] = useState<'all' | 'estate' | 'format' | 'site'>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | SettingsHealthStatus>('all');
  const [resolved, setResolved] = useState<Set<string>>(new Set());

  const filtered = useMemo(() => {
    return PRET_SETTINGS_HEALTH.filter(item => {
      if (resolved.has(item.id)) return false;
      if (scopeFilter !== 'all' && item.scope.kind !== scopeFilter) return false;
      if (statusFilter !== 'all' && item.status !== statusFilter) return false;
      return true;
    });
  }, [scopeFilter, statusFilter, resolved]);

  const counts = useMemo(() => {
    const all = PRET_SETTINGS_HEALTH.filter(i => !resolved.has(i.id));
    return {
      total: all.length,
      stale: all.filter(i => i.status === 'stale').length,
      unused: all.filter(i => i.status === 'unused').length,
      suspect: all.filter(i => i.status === 'suspect').length,
      resolved: resolved.size,
    };
  }, [resolved]);

  function resolve(id: string) {
    setResolved(prev => new Set(prev).add(id));
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Summary header */}
      <div
        style={{
          padding: '14px 16px',
          borderBottom: '1px solid var(--color-border-subtle)',
          background: '#ffffff',
          display: 'flex',
          gap: 12,
          alignItems: 'center',
          flexWrap: 'wrap',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Settings size={16} color="var(--color-text-muted)" />
          <div>
            <div style={{ fontSize: 13, fontWeight: 700 }}>Settings health</div>
            <div style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>
              Keep the foundation clean. One-tap fixes, or hand it to Quinn.
            </div>
          </div>
        </div>
        <div style={{ flex: 1 }} />
        <Pill tone="neutral" label={`${counts.total} open`} />
        <Pill tone="warning" label={`${counts.stale} stale`} />
        <Pill tone="info" label={`${counts.unused} unused`} />
        <Pill tone="error" label={`${counts.suspect} suspect`} />
        {counts.resolved > 0 && <Pill tone="success" label={`${counts.resolved} resolved`} />}
      </div>

      {/* Filters */}
      <div
        style={{
          padding: '8px 16px',
          borderBottom: '1px solid var(--color-border-subtle)',
          background: '#ffffff',
          display: 'flex',
          gap: 10,
          flexWrap: 'wrap',
        }}
      >
        <FilterGroup
          label="Scope"
          options={[
            { id: 'all', label: 'All' },
            { id: 'estate', label: 'Estate' },
            { id: 'format', label: 'Format' },
            { id: 'site', label: 'Site' },
          ]}
          value={scopeFilter}
          onChange={v => setScopeFilter(v as typeof scopeFilter)}
        />
        <FilterGroup
          label="Status"
          options={[
            { id: 'all', label: 'All' },
            { id: 'stale', label: 'Stale' },
            { id: 'unused', label: 'Unused' },
            { id: 'suspect', label: 'Suspect' },
          ]}
          value={statusFilter}
          onChange={v => setStatusFilter(v as typeof statusFilter)}
        />
      </div>

      <div style={{ flex: 1, minHeight: 0, overflow: 'auto', padding: '16px 16px 32px' }}>
        <StaffLockBanner reason="Only Managers can remediate or archive setting drift." />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {filtered.map(item => (
            <HealthCard
              key={item.id}
              item={item}
              canRemediate={canRemediate}
              onResolve={() => resolve(item.id)}
            />
          ))}
          {filtered.length === 0 && (
            <div
              style={{
                padding: '32px 16px',
                textAlign: 'center',
                borderRadius: 'var(--radius-card)',
                border: '1px dashed var(--color-border-subtle)',
                color: 'var(--color-text-muted)',
                fontSize: 13,
              }}
            >
              No issues match this filter. Nice and tidy.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Subcomponents ────────────────────────────────────────────────────────────

function HealthCard({
  item,
  canRemediate,
  onResolve,
}: {
  item: SettingsHealthItem;
  canRemediate: boolean;
  onResolve: () => void;
}) {
  const meta = STATUS_META[item.status];
  const scopeLabel = scopeToLabel(item.scope);

  return (
    <div
      style={{
        padding: '14px 16px',
        borderRadius: 'var(--radius-card)',
        border: '1px solid var(--color-border-subtle)',
        background: '#ffffff',
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
        <div
          style={{
            width: 32,
            height: 32,
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: 8,
            background:
              meta.tone === 'error'
                ? 'var(--color-error-light)'
                : meta.tone === 'warning'
                ? 'var(--color-warning-light)'
                : 'var(--color-info-light)',
            color:
              meta.tone === 'error'
                ? 'var(--color-error)'
                : meta.tone === 'warning'
                ? 'var(--color-warning)'
                : 'var(--color-info)',
            flexShrink: 0,
          }}
        >
          {meta.icon}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginBottom: 2 }}>
            <StatusPill tone={meta.tone} label={meta.label} size="xs" />
            <StatusPill tone="neutral" label={scopeLabel} size="xs" />
            <StatusPill tone="neutral" label={surfaceLabel(item.surface)} size="xs" />
          </div>
          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--color-text-primary)', lineHeight: 1.3 }}>
            {item.title}
          </div>
          <div style={{ fontSize: 12, color: 'var(--color-text-secondary)', lineHeight: 1.5, marginTop: 4 }}>
            {item.body}
          </div>
          {item.impactSummary && (
            <div
              style={{
                marginTop: 6,
                fontSize: 11,
                color: 'var(--color-info)',
                fontWeight: 600,
              }}
            >
              Impact · {item.impactSummary}
            </div>
          )}
        </div>
      </div>

      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'flex-end', borderTop: '1px solid var(--color-border-subtle)', paddingTop: 10, marginTop: 2 }}>
        {item.remediations.map(r => (
          <button
            key={r.id}
            type="button"
            disabled={!canRemediate}
            onClick={() => {
              console.log('Remediation', { itemId: item.id, action: r.kind });
              onResolve();
            }}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
              padding: '8px 12px',
              borderRadius: 8,
              fontSize: 11,
              fontWeight: 700,
              fontFamily: 'var(--font-primary)',
              background: r.kind === 'ask-quinn' ? 'var(--color-info-light)' : '#ffffff',
              color: r.kind === 'ask-quinn' ? 'var(--color-info)' : 'var(--color-text-primary)',
              border: `1px solid ${r.kind === 'ask-quinn' ? 'var(--color-info)' : 'var(--color-border)'}`,
              cursor: canRemediate ? 'pointer' : 'not-allowed',
              whiteSpace: 'nowrap',
              opacity: canRemediate ? 1 : 0.45,
            }}
          >
            {REMEDIATION_ICONS[r.kind]} {r.label}
          </button>
        ))}
        <button
          type="button"
          onClick={onResolve}
          disabled={!canRemediate}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4,
            padding: '8px 12px',
            borderRadius: 8,
            fontSize: 11,
            fontWeight: 700,
            fontFamily: 'var(--font-primary)',
            background: canRemediate ? 'var(--color-accent-active)' : 'var(--color-bg-hover)',
            color: canRemediate ? 'var(--color-text-on-active)' : 'var(--color-text-muted)',
            border: `1px solid ${canRemediate ? 'var(--color-accent-active)' : 'var(--color-border)'}`,
            cursor: canRemediate ? 'pointer' : 'not-allowed',
            whiteSpace: 'nowrap',
            opacity: canRemediate ? 1 : 0.5,
          }}
        >
          <Check size={12} /> Mark fixed
        </button>
      </div>
    </div>
  );
}

function FilterGroup({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: { id: string; label: string }[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
        {label}
      </span>
      <div style={{ display: 'flex', gap: 4 }}>
        {options.map(o => {
          const active = o.id === value;
          return (
            <button
              key={o.id}
              type="button"
              onClick={() => onChange(o.id)}
              style={{
                padding: '5px 10px',
                borderRadius: 6,
                fontSize: 11,
                fontWeight: 600,
                fontFamily: 'var(--font-primary)',
                background: active ? 'var(--color-accent-active)' : '#ffffff',
                color: active ? 'var(--color-text-on-active)' : 'var(--color-text-secondary)',
                border: `1px solid ${active ? 'var(--color-accent-active)' : 'var(--color-border)'}`,
                cursor: 'pointer',
              }}
            >
              {o.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function Pill({ tone, label }: { tone: 'neutral' | 'info' | 'warning' | 'error' | 'success'; label: string }) {
  return <StatusPill tone={tone} label={label} size="xs" />;
}

function scopeToLabel(scope: SettingsHealthItem['scope']): string {
  if (scope.kind === 'estate') return 'Estate';
  if (scope.kind === 'format') return `Format: ${scope.id}`;
  const site = getSite(scope.id as never);
  return site ? `Site: ${site.name}` : `Site: ${scope.id}`;
}

function surfaceLabel(surface: SettingsHealthItem['surface']): string {
  const labels: Record<SettingsHealthItem['surface'], string> = {
    'batch-rules': 'Batch rules',
    'selection-tags': 'Selection tags',
    'cutoffs': 'Cutoffs',
    'bench-capabilities': 'Bench capabilities',
    'ranges': 'Ranges',
  };
  return labels[surface];
}
