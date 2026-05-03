'use client';

import { useState } from 'react';
import { usePathname } from 'next/navigation';
import { FlaskConical, ChevronDown } from 'lucide-react';
import { USERS, getRoleRules } from '@/components/Approvals/approvalsStore';
import { BRIEFING_ROLES } from '@/components/briefing';
import type { BriefingRole } from '@/components/briefing';
import {
  useActingUser,
  useDemoBriefingRole,
  setActingUser,
  setDemoBriefingRole,
  type ActingUserId,
} from './demoStore';

const USER_ORDER: ActingUserId[] = ['u-manager', 'u-sam', 'u-jordan', 'u-reese'];

type Props = {
  /**
   * When true, the wrapper renders inline (no `position: fixed`) so the
   * caller can place the trigger inside their own header. The opened
   * panel anchors over the trigger using `position: absolute` so it
   * doesn't push surrounding header elements around.
   */
  inline?: boolean;
};

export default function DemoControls({ inline = false }: Props) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname() ?? '';
  const actingUserId = useActingUser();
  const briefingRole = useDemoBriefingRole();
  const actingUser = USERS.find(u => u.id === actingUserId);
  const rules = actingUser ? getRoleRules(actingUser.role) : null;

  // The global (root-layout) mount yields control to the inline mount
  // on every route that already docks the trigger into its own header
  // — otherwise both render and we end up with two triggers on the
  // same screen. Inline mounts always render regardless of route.
  if (!inline) {
    const isHome = pathname === '/' || pathname === '';
    if (
      isHome ||
      pathname.startsWith('/production') ||
      pathname.startsWith('/recipes') ||
      pathname.startsWith('/settings')
    ) {
      return null;
    }
  }

  const wrapperStyle: React.CSSProperties = inline
    ? {
        position: 'relative',
        zIndex: 1,
        fontFamily: 'var(--font-primary)',
      }
    : {
        position: 'fixed',
        top: '16px',
        left: '72px',
        zIndex: 900,
        fontFamily: 'var(--font-primary)',
      };

  // When inline, the open panel floats over neighbouring header content
  // (anchored to the trigger's right edge) so the row doesn't reflow.
  const panelStyle: React.CSSProperties = inline
    ? {
        position: 'absolute',
        top: 'calc(100% + 6px)',
        right: 0,
        width: '280px',
        background: '#fff',
        border: '1px solid var(--color-border-subtle)',
        borderRadius: '14px',
        boxShadow: '0 12px 32px rgba(10,20,25,0.18)',
        overflow: 'hidden',
        zIndex: 1000,
      }
    : {
        width: '280px',
        background: '#fff',
        border: '1px solid var(--color-border-subtle)',
        borderRadius: '14px',
        boxShadow: '0 12px 32px rgba(10,20,25,0.18)',
        overflow: 'hidden',
      };

  // Inline triggers are tucked into a busy header — drop the heavy
  // shadow and shrink the chrome so it sits comfortably next to the
  // role switcher / Home button.
  const triggerStyle: React.CSSProperties = inline
    ? {
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
        padding: '6px 10px',
        borderRadius: '100px',
        background: '#fff',
        border: '1px solid var(--color-border)',
        cursor: 'pointer',
        fontFamily: 'var(--font-primary)',
        fontSize: '11px',
        fontWeight: 600,
        color: 'var(--color-text-primary)',
        whiteSpace: 'nowrap',
      }
    : {
        display: 'flex',
        alignItems: 'center',
        gap: '7px',
        padding: '8px 12px',
        borderRadius: '100px',
        background: '#fff',
        border: '1px solid var(--color-border-subtle)',
        boxShadow: '0 6px 20px rgba(10,20,25,0.14)',
        cursor: 'pointer',
        fontFamily: 'var(--font-primary)',
        fontSize: '12px',
        fontWeight: 600,
        color: 'var(--color-text-primary)',
      };

  return (
    <div style={wrapperStyle}>
      {open ? (
        <div style={panelStyle}>
          <button
            type="button"
            onClick={() => setOpen(false)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              width: '100%',
              padding: '10px 12px',
              border: 'none',
              borderBottom: '1px solid var(--color-border-subtle)',
              background: 'var(--color-bg-surface)',
              cursor: 'pointer',
              textAlign: 'left',
              fontFamily: 'var(--font-primary)',
            }}
          >
            <FlaskConical size={13} color="var(--color-accent-active)" strokeWidth={2.2} />
            <span style={{ flex: 1, fontSize: '11px', fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--color-text-secondary)' }}>
              Demo controls
            </span>
            <ChevronDown size={13} color="var(--color-text-muted)" strokeWidth={2.2} style={{ transform: 'rotate(180deg)' }} />
          </button>

          <div style={{ padding: '12px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {/* Acting as */}
            <div>
              <div style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--color-text-muted)', marginBottom: '6px' }}>
                Acting as
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                {USER_ORDER.map(id => {
                  const u = USERS.find(x => x.id === id);
                  if (!u) return null;
                  const active = actingUserId === id;
                  return (
                    <button
                      key={id}
                      type="button"
                      onClick={() => setActingUser(id)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: '8px',
                        padding: '7px 10px',
                        borderRadius: '8px',
                        border: active ? '1.5px solid var(--color-accent-active)' : '1px solid var(--color-border-subtle)',
                        background: active ? 'rgba(34,68,68,0.06)' : '#fff',
                        cursor: 'pointer',
                        fontFamily: 'var(--font-primary)',
                        textAlign: 'left',
                      }}
                    >
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '1px' }}>
                        <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--color-text-primary)' }}>
                          {u.name}
                        </span>
                        <span style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>
                          {u.role.replace('_', ' ')}
                        </span>
                      </div>
                      {active && (
                        <span style={{ fontSize: '10px', fontWeight: 700, color: 'var(--color-accent-active)' }}>
                          CURRENT
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
              {rules && (
                <div style={{ fontSize: '10px', lineHeight: 1.4, color: 'var(--color-text-muted)', marginTop: '6px' }}>
                  {rules.description}
                </div>
              )}
            </div>

            {/* Briefing persona */}
            <div>
              <div style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--color-text-muted)', marginBottom: '6px' }}>
                Briefing persona
              </div>
              <div style={{ display: 'flex', gap: '4px' }}>
                {BRIEFING_ROLES.map(r => {
                  const active = briefingRole === r.id;
                  return (
                    <button
                      key={r.id}
                      type="button"
                      onClick={() => setDemoBriefingRole(r.id as BriefingRole)}
                      style={{
                        flex: 1,
                        padding: '6px 8px',
                        borderRadius: '100px',
                        fontSize: '11px',
                        fontWeight: 600,
                        fontFamily: 'var(--font-primary)',
                        cursor: 'pointer',
                        border: active ? '1.5px solid var(--color-accent-active)' : '1.5px solid var(--color-border-subtle)',
                        background: active ? 'rgba(34,68,68,0.08)' : '#fff',
                        color: active ? 'var(--color-accent-active)' : 'var(--color-text-muted)',
                      }}
                    >
                      {r.short}
                    </button>
                  );
                })}
              </div>
            </div>

            <div style={{ fontSize: '10px', color: 'var(--color-text-muted)', lineHeight: 1.4, fontStyle: 'italic' }}>
              Demo-only controls — not part of the product.
            </div>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          style={triggerStyle}
          aria-label="Open demo controls"
        >
          <FlaskConical size={13} color="var(--color-accent-active)" strokeWidth={2.2} />
          <span style={{ color: 'var(--color-text-muted)', fontSize: '10px', fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
            Demo
          </span>
          <span style={{ color: 'var(--color-text-primary)' }}>
            {actingUser?.name ?? '—'}
          </span>
        </button>
      )}
    </div>
  );
}
