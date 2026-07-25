'use client';

// Workspace-level admin tools, collapsed into one dropdown that sits to the
// right of the home tab strip: "All published" (governance overview) and
// "View as" (preview as a role at a site). The View as item expands to the
// role + site picker inside the same panel.

import { useEffect, useRef, useState } from 'react';
import { ChevronDown, ChevronLeft, Eye, LayoutGrid, Settings2 } from 'lucide-react';
import { ALL_SITES, ROLE_LABEL, type DemoRole, type SiteId } from './sites';
import { setViewAs } from './viewAsStore';

export default function AdminToolsMenu({
  onOpenPublishedOverview,
}: {
  onOpenPublishedOverview: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<'menu' | 'viewAs'>('menu');
  const [role, setRole] = useState<Exclude<DemoRole, 'admin'>>('manager');
  const wrapperRef = useRef<HTMLDivElement>(null);

  function close() {
    setOpen(false);
    setMode('menu');
  }

  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (!wrapperRef.current?.contains(e.target as Node)) close();
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') close();
    }
    document.addEventListener('mousedown', onDown);
    window.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      window.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div ref={wrapperRef} style={{ position: 'relative', flexShrink: 0 }}>
      <button
        type="button"
        onClick={() => (open ? close() : setOpen(true))}
        aria-haspopup="menu"
        aria-expanded={open}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          padding: '9px 12px',
          borderRadius: 999,
          border: '1px solid var(--color-border-subtle)',
          background: open ? 'var(--color-bg-hover)' : '#fff',
          cursor: 'pointer',
          fontFamily: 'var(--font-primary)',
          fontSize: 13,
          fontWeight: 600,
          color: 'var(--color-text-primary)',
        }}
        onMouseEnter={(e) => ((e.currentTarget as HTMLButtonElement).style.background = 'var(--color-bg-hover)')}
        onMouseLeave={(e) => {
          if (!open) (e.currentTarget as HTMLButtonElement).style.background = '#fff';
        }}
      >
        <Settings2 size={14} strokeWidth={2.2} />
        Admin tools
        <ChevronDown size={13} strokeWidth={2.4} color="var(--color-text-muted)" />
      </button>

      {open && (
        <div
          role="menu"
          style={{
            position: 'absolute',
            top: 'calc(100% + 6px)',
            right: 0,
            zIndex: 300,
            width: 280,
            background: '#fff',
            border: '1px solid var(--color-border-subtle)',
            borderRadius: 12,
            boxShadow: '0 10px 30px rgba(0, 28, 53,0.14)',
            padding: mode === 'menu' ? 4 : 12,
            fontFamily: 'var(--font-primary)',
          }}
        >
          {mode === 'menu' ? (
            <>
              <button
                type="button"
                onClick={() => {
                  onOpenPublishedOverview();
                  close();
                }}
                style={menuItemStyle}
                onMouseEnter={(e) => ((e.currentTarget as HTMLButtonElement).style.background = 'var(--color-bg-hover)')}
                onMouseLeave={(e) => ((e.currentTarget as HTMLButtonElement).style.background = 'transparent')}
              >
                <LayoutGrid size={14} strokeWidth={2.2} color="var(--color-text-muted)" />
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <span style={{ fontWeight: 600 }}>All published</span>
                  <span style={{ fontSize: 10, color: 'var(--color-text-muted)' }}>
                    Everything shared across the company
                  </span>
                </div>
              </button>
              <button
                type="button"
                onClick={() => setMode('viewAs')}
                style={menuItemStyle}
                onMouseEnter={(e) => ((e.currentTarget as HTMLButtonElement).style.background = 'var(--color-bg-hover)')}
                onMouseLeave={(e) => ((e.currentTarget as HTMLButtonElement).style.background = 'transparent')}
              >
                <Eye size={14} strokeWidth={2.2} color="var(--color-text-muted)" />
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <span style={{ fontWeight: 600 }}>View as…</span>
                  <span style={{ fontSize: 10, color: 'var(--color-text-muted)' }}>
                    Preview as a role at a site
                  </span>
                </div>
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={() => setMode('menu')}
                style={{
                  all: 'unset',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 4,
                  cursor: 'pointer',
                  fontSize: 10,
                  fontWeight: 700,
                  letterSpacing: '0.06em',
                  textTransform: 'uppercase',
                  color: 'var(--color-text-muted)',
                  marginBottom: 8,
                  fontFamily: 'var(--font-primary)',
                }}
              >
                <ChevronLeft size={12} strokeWidth={2.4} />
                View this workspace as
              </button>

              <div
                style={{
                  display: 'flex',
                  gap: 4,
                  padding: 3,
                  borderRadius: 999,
                  background: 'var(--color-bg-hover)',
                  border: '1px solid var(--color-border-subtle)',
                  marginBottom: 10,
                }}
              >
                {(['manager', 'employee'] as const).map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setRole(r)}
                    style={{
                      flex: 1,
                      padding: '6px 10px',
                      borderRadius: 999,
                      border: 'none',
                      cursor: 'pointer',
                      fontFamily: 'var(--font-primary)',
                      fontSize: 12,
                      fontWeight: 600,
                      background: role === r ? 'var(--color-accent-active)' : 'transparent',
                      color: role === r ? '#fff' : 'var(--color-text-muted)',
                    }}
                  >
                    {ROLE_LABEL[r]}
                  </button>
                ))}
              </div>

              <div style={{ maxHeight: 220, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 1 }}>
                {ALL_SITES.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => {
                      setViewAs({ role, siteId: s.id });
                      close();
                    }}
                    style={{
                      all: 'unset',
                      cursor: 'pointer',
                      padding: '7px 10px',
                      borderRadius: 6,
                      fontSize: 12,
                      fontWeight: 600,
                      color: 'var(--color-text-primary)',
                      fontFamily: 'var(--font-primary)',
                    }}
                    onMouseEnter={(e) => ((e.currentTarget as HTMLButtonElement).style.background = 'var(--color-bg-hover)')}
                    onMouseLeave={(e) => ((e.currentTarget as HTMLButtonElement).style.background = 'transparent')}
                  >
                    at {s.name}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

const menuItemStyle: React.CSSProperties = {
  all: 'unset',
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  padding: '8px 10px',
  borderRadius: 8,
  cursor: 'pointer',
  fontSize: 12.5,
  fontWeight: 500,
  color: 'var(--color-text-primary)',
  width: '100%',
  boxSizing: 'border-box' as const,
  fontFamily: 'var(--font-primary)',
};
