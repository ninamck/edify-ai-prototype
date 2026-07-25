'use client';

import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { Plus, X, Table2, LayoutDashboard, CalendarDays, CalendarRange, CalendarCheck2 } from 'lucide-react';
import { PINNED_TAB_IDS, type Mvp1Tab } from '@/hooks/useMvp1Tabs';
import type { DashboardPeriod } from '@/components/Dashboard/permissions/model';

const PERIOD_OPTIONS: { id: DashboardPeriod; label: string; hint: string; icon: typeof CalendarDays }[] = [
  { id: 'daily', label: 'Daily', hint: 'Always shows yesterday', icon: CalendarDays },
  { id: 'weekly', label: 'Weekly', hint: 'Always shows the current week', icon: CalendarRange },
  { id: 'period-end', label: 'Period end', hint: 'Always shows the current period', icon: CalendarCheck2 },
];

type Props = {
  tabs: Mvp1Tab[];
  activeId: string;
  onSelect: (id: string) => void;
  onAddTablesTab: () => void;
  onRemove: (id: string) => void;
  onRename: (id: string, name: string) => void;
  /** When provided, the add menu also offers "Dashboard" — a roles-model
   *  dashboard built from pinned insights (roles & permissions demo). */
  onAddDashboard?: () => void;
  /** Period-bound dashboards: every chart on them is locked to that
   *  reporting window and refreshes for the current date. */
  onAddPeriodDashboard?: (period: DashboardPeriod) => void;
};

export default function Mvp1Tabs({
  tabs,
  activeId,
  onSelect,
  onAddTablesTab,
  onRemove,
  onRename,
  onAddDashboard,
  onAddPeriodDashboard,
}: Props) {
  const [addMenuOpen, setAddMenuOpen] = useState(false);
  const addBtnRef = useRef<HTMLButtonElement | null>(null);
  const addMenuRef = useRef<HTMLDivElement | null>(null);
  const [menuAlignRight, setMenuAlignRight] = useState(false);

  useEffect(() => {
    if (!addMenuOpen) return;
    function onDown(e: MouseEvent) {
      const t = e.target as Node;
      if (addBtnRef.current?.contains(t) || addMenuRef.current?.contains(t)) return;
      setAddMenuOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setAddMenuOpen(false);
    }
    document.addEventListener('mousedown', onDown);
    window.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      window.removeEventListener('keydown', onKey);
    };
  }, [addMenuOpen]);

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
      <div
        role="tablist"
        aria-label="Workspace views"
        style={{
          alignSelf: 'flex-start',
          display: 'flex',
          gap: 4,
          padding: 4,
          borderRadius: 999,
          background: 'var(--color-bg-hover)',
          border: '1px solid var(--color-border-subtle)',
        }}
      >
        {tabs.map((tab) => (
          <Tab
            key={tab.id}
            tab={tab}
            active={tab.id === activeId}
            onSelect={() => onSelect(tab.id)}
            onRemove={() => onRemove(tab.id)}
            onRename={(name) => onRename(tab.id, name)}
          />
        ))}
      </div>

      <div style={{ position: 'relative' }}>
        <button
          ref={addBtnRef}
          type="button"
          onClick={() => {
            // With many tabs the "+" button ends up near the right edge —
            // anchor the menu to the button's right side when a left-anchored
            // 220px panel would spill outside the viewport.
            if (!addMenuOpen && addBtnRef.current) {
              const rect = addBtnRef.current.getBoundingClientRect();
              setMenuAlignRight(rect.left + 232 > window.innerWidth);
            }
            setAddMenuOpen((v) => !v);
          }}
          aria-label="Add view"
          title="Add view"
          style={{
            all: 'unset',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 28,
            height: 28,
            borderRadius: 999,
            border: '1px solid var(--color-border-subtle)',
            background: '#fff',
            cursor: 'pointer',
            color: 'var(--color-text-muted)',
            fontFamily: 'var(--font-primary)',
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLButtonElement).style.background = 'var(--color-bg-hover)';
            (e.currentTarget as HTMLButtonElement).style.color = 'var(--color-text-secondary)';
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLButtonElement).style.background = '#fff';
            (e.currentTarget as HTMLButtonElement).style.color = 'var(--color-text-muted)';
          }}
        >
          <Plus size={13} strokeWidth={2.4} />
        </button>
        {addMenuOpen && (
          <div
            ref={addMenuRef}
            role="menu"
            style={{
              position: 'absolute',
              top: 'calc(100% + 6px)',
              ...(menuAlignRight ? { right: 0 } : { left: 0 }),
              zIndex: 200,
              minWidth: 220,
              background: '#fff',
              border: '1px solid var(--color-border-subtle)',
              borderRadius: 8,
              boxShadow: '0 4px 16px rgba(0, 28, 53,0.12), 0 0 0 1px rgba(0, 28, 53,0.04)',
              padding: 4,
              fontFamily: 'var(--font-primary)',
            }}
          >
            <div
              style={{
                fontSize: 10,
                fontWeight: 700,
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
                color: 'var(--color-text-muted)',
                padding: '6px 10px 4px',
              }}
            >
              Create new
            </div>
            <button
              type="button"
              onClick={() => {
                onAddTablesTab();
                setAddMenuOpen(false);
              }}
              style={{
                all: 'unset',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '8px 10px',
                borderRadius: 6,
                cursor: 'pointer',
                fontSize: 12,
                fontWeight: 500,
                color: 'var(--color-text-secondary)',
                width: 'calc(100% - 4px)',
                boxSizing: 'border-box',
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLButtonElement).style.background = 'var(--color-bg-hover)';
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLButtonElement).style.background = 'transparent';
              }}
            >
              <Table2 size={13} strokeWidth={2.2} color="var(--color-text-muted)" />
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <span style={{ fontWeight: 600 }}>View — just for you</span>
                <span style={{ fontSize: 10, color: 'var(--color-text-muted)' }}>
                  Your private workspace of tables and charts
                </span>
              </div>
            </button>
            {onAddDashboard && (
              <button
                type="button"
                onClick={() => {
                  onAddDashboard();
                  setAddMenuOpen(false);
                }}
                style={{
                  all: 'unset',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '8px 10px',
                  borderRadius: 6,
                  cursor: 'pointer',
                  fontSize: 12,
                  fontWeight: 500,
                  color: 'var(--color-text-secondary)',
                  width: 'calc(100% - 4px)',
                  boxSizing: 'border-box',
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.background = 'var(--color-bg-hover)';
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.background = 'transparent';
                }}
              >
                <LayoutDashboard size={13} strokeWidth={2.2} color="var(--color-text-muted)" />
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <span style={{ fontWeight: 600 }}>Dashboard — to share</span>
                  <span style={{ fontSize: 10, color: 'var(--color-text-muted)' }}>
                    Pin insights, publish to roles at sites
                  </span>
                </div>
              </button>
            )}
            {onAddPeriodDashboard && (
              <>
                <div
                  style={{
                    fontSize: 10,
                    fontWeight: 700,
                    letterSpacing: '0.06em',
                    textTransform: 'uppercase',
                    color: 'var(--color-text-muted)',
                    padding: '8px 10px 4px',
                    borderTop: '1px solid var(--color-border-subtle)',
                    marginTop: 4,
                  }}
                >
                  Period dashboard — auto-refreshing
                </div>
                {PERIOD_OPTIONS.map((p) => {
                  const Icon = p.icon;
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => {
                        onAddPeriodDashboard(p.id);
                        setAddMenuOpen(false);
                      }}
                      style={{
                        all: 'unset',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        padding: '8px 10px',
                        borderRadius: 6,
                        cursor: 'pointer',
                        fontSize: 12,
                        fontWeight: 500,
                        color: 'var(--color-text-secondary)',
                        width: 'calc(100% - 4px)',
                        boxSizing: 'border-box',
                      }}
                      onMouseEnter={(e) => {
                        (e.currentTarget as HTMLButtonElement).style.background = 'var(--color-bg-hover)';
                      }}
                      onMouseLeave={(e) => {
                        (e.currentTarget as HTMLButtonElement).style.background = 'transparent';
                      }}
                    >
                      <Icon size={13} strokeWidth={2.2} color="var(--color-text-muted)" />
                      <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <span style={{ fontWeight: 600 }}>{p.label}</span>
                        <span style={{ fontSize: 10, color: 'var(--color-text-muted)' }}>{p.hint}</span>
                      </div>
                    </button>
                  );
                })}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function Tab({
  tab,
  active,
  onSelect,
  onRemove,
  onRename,
}: {
  tab: Mvp1Tab;
  active: boolean;
  onSelect: () => void;
  onRemove: () => void;
  onRename: (name: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(tab.name);
  const [hovered, setHovered] = useState(false);
  const isDashboard = tab.kind === 'dashboard';
  const canRemove = !isDashboard && !PINNED_TAB_IDS.has(tab.id);

  function commit() {
    if (draft.trim()) onRename(draft);
    else setDraft(tab.name);
    setEditing(false);
  }

  const baseStyle: CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    padding: '8px 14px',
    borderRadius: 999,
    border: 'none',
    cursor: 'pointer',
    fontFamily: 'var(--font-primary)',
    fontSize: 12,
    fontWeight: 600,
    color: active ? '#fff' : 'var(--color-text-muted)',
    background: active ? 'var(--color-accent-active)' : 'transparent',
    boxShadow: active ? '0 2px 8px rgba(34,68,68,0.25)' : 'none',
    transition: 'background 0.15s ease, color 0.15s ease, box-shadow 0.15s ease',
    whiteSpace: 'nowrap',
  };

  return (
    <div
      role="tab"
      aria-selected={active}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={() => {
        if (!editing) onSelect();
      }}
      onMouseOver={(e) => {
        if (!active) {
          (e.currentTarget as HTMLDivElement).style.color = 'var(--color-text-secondary)';
        }
      }}
      onMouseOut={(e) => {
        if (!active) {
          (e.currentTarget as HTMLDivElement).style.color = 'var(--color-text-muted)';
        }
      }}
      style={baseStyle}
    >
      {editing ? (
        <input
          autoFocus
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === 'Enter') commit();
            if (e.key === 'Escape') {
              setDraft(tab.name);
              setEditing(false);
            }
          }}
          onClick={(e) => e.stopPropagation()}
          style={{
            fontFamily: 'var(--font-primary)',
            fontSize: 12,
            fontWeight: 600,
            padding: '2px 6px',
            border: '1px solid var(--color-border-subtle)',
            borderRadius: 4,
            outline: 'none',
            minWidth: 100,
            background: '#fff',
            color: 'var(--color-text-primary)',
          }}
        />
      ) : (
        <span
          onDoubleClick={(e) => {
            if (isDashboard) return;
            e.stopPropagation();
            setDraft(tab.name);
            setEditing(true);
          }}
          title={isDashboard ? undefined : 'Double-click to rename'}
        >
          {tab.name}
        </span>
      )}

      {canRemove && hovered && !editing && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          aria-label={`Remove ${tab.name} tab`}
          title="Remove tab"
          style={{
            all: 'unset',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 16,
            height: 16,
            borderRadius: 999,
            cursor: 'pointer',
            color: active ? 'rgba(255,255,255,0.85)' : 'var(--color-text-muted)',
            marginLeft: 2,
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLButtonElement).style.background = active
              ? 'rgba(255,255,255,0.18)'
              : 'rgba(0, 28, 53,0.08)';
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLButtonElement).style.background = 'transparent';
          }}
        >
          <X size={11} strokeWidth={2.4} />
        </button>
      )}
    </div>
  );
}
