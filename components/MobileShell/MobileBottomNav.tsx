'use client';

import { useRouter } from 'next/navigation';
import { Truck, ClipboardList, LayoutGrid, Trash2, Sparkles } from 'lucide-react';

type NavTab = 'receive' | 'checklists' | 'tasks' | 'waste' | 'insights';

function NavButton({
  icon: Icon,
  label,
  badge,
  dot,
  active,
  onClick,
}: {
  icon: React.ElementType;
  label: string;
  badge?: number;
  dot?: boolean;
  active?: boolean;
  onClick: () => void;
}) {
  const color = active ? 'var(--color-accent-active)' : 'var(--color-text-muted)';

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '4px',
        padding: '8px 4px',
        border: 'none',
        background: 'transparent',
        cursor: 'pointer',
        fontFamily: 'var(--font-primary)',
        position: 'relative',
        WebkitTapHighlightColor: 'transparent',
      }}
    >
      <span style={{ position: 'relative', display: 'inline-flex' }}>
        <Icon size={22} color={color} strokeWidth={active ? 2.2 : 1.8} />
        {badge != null && (
          <span style={{
            position: 'absolute',
            top: '-5px',
            right: '-8px',
            minWidth: '16px',
            height: '16px',
            padding: '0 4px',
            borderRadius: '100px',
            background: 'var(--color-accent-deep)',
            color: '#F4F1EC',
            fontSize: '12px',
            fontWeight: 700,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            lineHeight: 1,
          }}>
            {badge}
          </span>
        )}
        {dot && (
          <span style={{
            position: 'absolute',
            top: '-2px',
            right: '-3px',
            width: '7px',
            height: '7px',
            borderRadius: '50%',
            background: 'var(--color-accent-active)',
            border: '1.5px solid #fff',
          }} />
        )}
      </span>
      <span style={{
        fontSize: '12px',
        fontWeight: active ? 700 : 500,
        color,
        letterSpacing: '0.01em',
        lineHeight: 1,
      }}>
        {label}
      </span>
    </button>
  );
}

export default function MobileBottomNav({
  activeTab,
  onTabChange,
}: {
  activeTab: NavTab | null;
  onTabChange: (tab: NavTab) => void;
}) {
  const router = useRouter();

  return (
    <nav
      style={{
        position: 'fixed',
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 200,
        display: 'flex',
        flexDirection: 'row',
        alignItems: 'flex-end',
        background: '#fff',
        borderTop: '1px solid var(--color-border-subtle)',
        paddingBottom: 'env(safe-area-inset-bottom)',
        boxShadow: '0 -4px 16px rgba(58,48,40,0.08)',
        fontFamily: 'var(--font-primary)',
      }}
      aria-label="Main navigation"
    >
      <NavButton
        icon={Truck}
        label="Receive"
        dot
        active={activeTab === 'receive'}
        onClick={() => {
          onTabChange('receive');
          router.push('/receive');
        }}
      />
      <NavButton
        icon={ClipboardList}
        label="Checklists"
        active={activeTab === 'checklists'}
        onClick={() => {
          onTabChange('checklists');
          router.push('/checklists/complete');
        }}
      />
      <NavButton
        icon={LayoutGrid}
        label="Actions"
        active={activeTab === 'tasks'}
        onClick={() => onTabChange('tasks')}
      />
      <NavButton
        icon={Trash2}
        label="Log waste"
        active={activeTab === 'waste'}
        onClick={() => onTabChange('waste')}
      />
      <NavButton
        icon={Sparkles}
        label="Quinn"
        active={activeTab === 'insights'}
        onClick={() => onTabChange('insights')}
      />
    </nav>
  );
}
