'use client';

import { Plus, Pencil, Check } from 'lucide-react';

export default function DashboardEditToolbar({
  editing,
  onToggleEdit,
  onAddInsight,
}: {
  editing: boolean;
  onToggleEdit: () => void;
  onAddInsight: () => void;
}) {
  return (
    <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexShrink: 0 }}>
      <button
        type="button"
        onClick={onAddInsight}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          padding: '7px 12px',
          borderRadius: 8,
          border: '1px solid var(--color-border-subtle)',
          background: '#fff',
          cursor: 'pointer',
          fontFamily: 'var(--font-primary)',
          fontSize: 13,
          fontWeight: 600,
          color: 'var(--color-text-primary)',
          transition: 'background 0.15s',
        }}
        onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--color-bg-hover)')}
        onMouseLeave={(e) => (e.currentTarget.style.background = '#fff')}
      >
        <Plus size={14} strokeWidth={2.5} />
        Add insight
      </button>

      <button
        type="button"
        onClick={onToggleEdit}
        aria-pressed={editing}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          padding: '7px 12px',
          borderRadius: 8,
          border: editing
            ? '1px solid var(--color-accent-active)'
            : '1px solid var(--color-border-subtle)',
          background: editing ? 'var(--color-accent-active)' : '#fff',
          color: editing ? '#fff' : 'var(--color-text-primary)',
          cursor: 'pointer',
          fontFamily: 'var(--font-primary)',
          fontSize: 13,
          fontWeight: 600,
          transition: 'background 0.15s',
        }}
      >
        {editing ? <Check size={14} strokeWidth={2.5} /> : <Pencil size={14} strokeWidth={2.5} />}
        {editing ? 'Done' : 'Edit view'}
      </button>
    </div>
  );
}
