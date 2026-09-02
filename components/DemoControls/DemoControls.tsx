'use client';

import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { FlaskConical, ChevronDown } from 'lucide-react';
import { USERS, getRoleRules } from '@/components/Approvals/approvalsStore';
import { useActiveSite } from '@/components/ActiveSite/ActiveSiteContext';
import {
  isDemoBuild,
  isBrandSwitchable,
  isFarmerJDemo,
  DEMO_CUSTOMERS,
  DEMO_CUSTOMER_ID,
  setDemoBrand,
} from '@/lib/demoConfig';
import { useFranchise, type FranchiseViewMode } from '@/components/Franchise/FranchiseContext';
import { BRIEFING_ROLES } from '@/components/briefing';
import type { BriefingRole } from '@/components/briefing';
import {
  useActingUser,
  useDemoBriefingRole,
  useDemoVersion,
  setActingUser,
  setDemoBriefingRole,
  setDemoVersion,
  type ActingUserId,
  type DemoVersion,
} from './demoStore';

const USER_ORDER: ActingUserId[] = ['u-manager', 'u-sam', 'u-jordan', 'u-reese'];

const VERSION_OPTIONS: { id: DemoVersion; label: string; route: string }[] = [
  { id: 'original', label: 'Original', route: '/' },
  { id: 'mvp1', label: 'MVP 1', route: '/mvp-1' },
  { id: 'prod2', label: 'Prod 2.0', route: '/prod-2' },
];

type Variant = 'floating' | 'inline';

type Props = {
  variant?: Variant;
  /**
   * Optional content rendered at the bottom of the panel, above the
   * "demo-only" footer note. Used by routes that want to slot in their
   * own demo affordances (e.g. the production / dispatch RoleSwitcher)
   * without cluttering the page header. Wrap content in
   * `DemoControlsSection` to inherit the section heading style.
   */
  extraSection?: ReactNode;
};

// Demo controls only appear on the home screens. Each demo version has
// its own home, and the panel's Version switcher is the only way to move
// between them — so all three roots count as "home".
const HOME_PATHS = new Set(['/', '', '/mvp-1', '/prod-2']);

export default function DemoControls({ variant = 'floating', extraSection }: Props) {
  const pathname = usePathname() ?? '';

  // Customer-facing demo builds never expose the internal demo controls
  // (brand/version/acting-as switches). The internal build keeps them even
  // while wearing another brand via the runtime Demo brand switch — that's
  // the only way back.
  if (isDemoBuild && !isBrandSwitchable) return null;

  // Hidden everywhere except the home screens — inner pages keep their
  // mounts (layouts pass this into their top bars) but render nothing.
  if (!HOME_PATHS.has(pathname)) return null;

  return variant === 'inline' ? (
    <InlineDemoControls extraSection={extraSection} />
  ) : (
    <FloatingDemoControls extraSection={extraSection} />
  );
}

function FloatingDemoControls({ extraSection }: { extraSection?: ReactNode }) {
  const [open, setOpen] = useState(false);
  const actingUserId = useActingUser();
  const actingUser = USERS.find((u) => u.id === actingUserId);

  return (
    <div
      style={{
        position: 'fixed',
        top: 16,
        left: 72,
        zIndex: 900,
        fontFamily: 'var(--font-primary)',
      }}
    >
      {open ? (
        <div style={panelContainerStyle}>
          <PanelHeader onClose={() => setOpen(false)} />
          <PanelBody extraSection={extraSection} />
        </div>
      ) : (
        <TriggerButton
          actingUserName={actingUser?.name}
          variant="floating"
          onClick={() => setOpen(true)}
        />
      )}
    </div>
  );
}

function InlineDemoControls({ extraSection }: { extraSection?: ReactNode }) {
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const actingUserId = useActingUser();
  const actingUser = USERS.find((u) => u.id === actingUserId);

  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (wrapperRef.current?.contains(e.target as Node)) return;
      setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', onDown);
    window.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      window.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div
      ref={wrapperRef}
      style={{
        position: 'relative',
        display: 'inline-flex',
        fontFamily: 'var(--font-primary)',
      }}
    >
      <TriggerButton
        actingUserName={actingUser?.name}
        variant="inline"
        active={open}
        onClick={() => setOpen((v) => !v)}
      />
      {open && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% + 6px)',
            right: 0,
            zIndex: 900,
            ...panelContainerStyle,
          }}
        >
          <PanelHeader onClose={() => setOpen(false)} />
          <PanelBody extraSection={extraSection} />
        </div>
      )}
    </div>
  );
}

const panelContainerStyle: CSSProperties = {
  width: 280,
  background: '#fff',
  border: '1px solid var(--color-border-subtle)',
  borderRadius: 14,
  boxShadow: '0 12px 32px rgba(10,20,25,0.18)',
  overflow: 'hidden',
};

function PanelHeader({ onClose }: { onClose: () => void }) {
  return (
    <button
      type="button"
      onClick={onClose}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
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
      <span
        style={{
          flex: 1,
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: '0.04em',
          textTransform: 'uppercase',
          color: 'var(--color-text-secondary)',
        }}
      >
        Demo controls
      </span>
      <ChevronDown
        size={13}
        color="var(--color-text-muted)"
        strokeWidth={2.2}
        style={{ transform: 'rotate(180deg)' }}
      />
    </button>
  );
}

const VIEW_OPTIONS: { id: FranchiseViewMode; label: string }[] = [
  { id: 'store', label: 'Store' },
  { id: 'group', label: 'Franchise admin' },
];

const BRAND_OPTIONS: { id: 'pret' | 'bk' | 'farmerj'; label: string; activeSiteId: string; landing: string }[] = [
  { id: 'pret', label: 'Pret', activeSiteId: 'fitzroy-espresso', landing: '/production' },
  { id: 'bk', label: 'Burger King', activeSiteId: 'burger-king-stratford', landing: '/production' },
  { id: 'farmerj', label: 'Farmer J', activeSiteId: 'fj-marylebone', landing: '/production/day' },
];

const BRAND_HINT: Record<'pret' | 'bk' | 'farmerj', string> = {
  pret: 'Pret is a hub-and-spoke estate — the hub bakes and dispatches to spokes.',
  bk: 'Burger King is a standalone hot-production restaurant — plan + make, no dispatch.',
  farmerj:
    'Farmer J scratch-cooks in every shop — day plan in cast irons and batches, prep by shelf life, no hub.',
};

function PanelBody({ extraSection }: { extraSection?: ReactNode }) {
  const router = useRouter();
  const actingUserId = useActingUser();
  const briefingRole = useDemoBriefingRole();
  const demoVersion = useDemoVersion();
  const { viewMode, setViewMode } = useFranchise();
  const { brand, setActiveSiteId } = useActiveSite();
  const actingUser = USERS.find((u) => u.id === actingUserId);
  const rules = actingUser ? getRoleRules(actingUser.role) : null;

  return (
    <div style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 14 }}>
      {isBrandSwitchable && (
        <div>
          <div style={sectionLabelStyle}>Demo brand</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
            {DEMO_CUSTOMERS.map((c) => {
              const active = DEMO_CUSTOMER_ID === c.id;
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => {
                    if (!active) setDemoBrand(c.id);
                  }}
                  style={{ ...pillOptionStyle(active), flex: '1 1 auto' }}
                >
                  {c.name}
                </button>
              );
            })}
          </div>
          <div
            style={{
              fontSize: 10,
              lineHeight: 1.4,
              color: 'var(--color-text-muted)',
              marginTop: 6,
            }}
          >
            Customer demo branding and gated features (e.g. Second Cup&apos;s multi-currency
            purchasing). Switching reloads the app.
          </div>
        </div>
      )}

      {/* The Farmer J customer build is locked to Farmer J shops, so the
          production-brand pill is hidden there. */}
      {!isFarmerJDemo && (
      <div>
        <div style={sectionLabelStyle}>Brand</div>
        <div style={{ display: 'flex', gap: 4 }}>
          {BRAND_OPTIONS.map((b) => {
            const active = brand === b.id;
            return (
              <button
                key={b.id}
                type="button"
                onClick={() => {
                  setActiveSiteId(b.activeSiteId);
                  router.push(b.landing);
                }}
                style={pillOptionStyle(active)}
              >
                {b.label}
              </button>
            );
          })}
        </div>
        <div
          style={{
            fontSize: 10,
            lineHeight: 1.4,
            color: 'var(--color-text-muted)',
            marginTop: 6,
          }}
        >
          {BRAND_HINT[brand]}
        </div>
      </div>
      )}

      <div>
        <div style={sectionLabelStyle}>View</div>
        <div style={{ display: 'flex', gap: 4 }}>
          {VIEW_OPTIONS.map((v) => {
            const active = viewMode === v.id;
            return (
              <button
                key={v.id}
                type="button"
                onClick={() => {
                  setViewMode(v.id);
                  // Group view lands on the franchise overview; switching
                  // back to Store drops into the normal single-site app.
                  router.push(v.id === 'group' ? '/franchise' : '/');
                }}
                style={pillOptionStyle(active)}
              >
                {v.label}
              </button>
            );
          })}
        </div>
        <div
          style={{
            fontSize: 10,
            lineHeight: 1.4,
            color: 'var(--color-text-muted)',
            marginTop: 6,
          }}
        >
          Franchise admin sees every brand in the group and picks which stores to view.
        </div>
      </div>

      <div>
        <div style={sectionLabelStyle}>Version</div>
        <div style={{ display: 'flex', gap: 4 }}>
          {VERSION_OPTIONS.map((v) => {
            const active = demoVersion === v.id;
            return (
              <button
                key={v.id}
                type="button"
                onClick={() => {
                  setDemoVersion(v.id);
                  router.push(v.route);
                }}
                style={pillOptionStyle(active)}
              >
                {v.label}
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <div style={sectionLabelStyle}>Acting as</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {USER_ORDER.map((id) => {
            const u = USERS.find((x) => x.id === id);
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
                  gap: 8,
                  padding: '7px 10px',
                  borderRadius: 8,
                  border: active
                    ? '1.5px solid var(--color-accent-active)'
                    : '1px solid var(--color-border-subtle)',
                  background: active ? 'rgba(34,68,68,0.06)' : '#fff',
                  cursor: 'pointer',
                  fontFamily: 'var(--font-primary)',
                  textAlign: 'left',
                }}
              >
                <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--color-text-primary)' }}>
                    {u.name}
                  </span>
                  <span style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>
                    {u.role.replace('_', ' ')}
                  </span>
                </div>
                {active && (
                  <span
                    style={{
                      fontSize: 10,
                      fontWeight: 700,
                      color: 'var(--color-accent-active)',
                    }}
                  >
                    CURRENT
                  </span>
                )}
              </button>
            );
          })}
        </div>
        {rules && (
          <div
            style={{
              fontSize: 10,
              lineHeight: 1.4,
              color: 'var(--color-text-muted)',
              marginTop: 6,
            }}
          >
            {rules.description}
          </div>
        )}
      </div>

      <div>
        <div style={sectionLabelStyle}>Briefing persona</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
          {BRIEFING_ROLES.map((r) => {
            const active = briefingRole === r.id;
            return (
              <button
                key={r.id}
                type="button"
                onClick={() => setDemoBriefingRole(r.id as BriefingRole)}
                style={{ ...pillOptionStyle(active), flex: '0 1 auto' }}
              >
                {r.short}
              </button>
            );
          })}
        </div>
      </div>

      {extraSection}

      <div
        style={{
          fontSize: 10,
          color: 'var(--color-text-muted)',
          lineHeight: 1.4,
          fontStyle: 'italic',
        }}
      >
        Demo-only controls — not part of the product.
      </div>
    </div>
  );
}

/**
 * Wrapper for content slotted into `DemoControls`'s `extraSection` prop.
 * Renders a section heading in the same style as the built-in
 * Version / Acting as / Briefing persona sections so route-owned
 * affordances (like the production RoleSwitcher) sit visually inside
 * the panel rather than floating in the page header.
 */
export function DemoControlsSection({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div>
      <div style={sectionLabelStyle}>{label}</div>
      {children}
    </div>
  );
}

const sectionLabelStyle: CSSProperties = {
  fontSize: 10,
  fontWeight: 700,
  letterSpacing: '0.04em',
  textTransform: 'uppercase',
  color: 'var(--color-text-muted)',
  marginBottom: 6,
};

function pillOptionStyle(active: boolean): CSSProperties {
  return {
    flex: 1,
    padding: '6px 8px',
    borderRadius: 100,
    fontSize: 11,
    fontWeight: 600,
    fontFamily: 'var(--font-primary)',
    cursor: 'pointer',
    border: active
      ? '1.5px solid var(--color-accent-active)'
      : '1.5px solid var(--color-border-subtle)',
    background: active ? 'rgba(34,68,68,0.08)' : '#fff',
    color: active ? 'var(--color-accent-active)' : 'var(--color-text-muted)',
  };
}

function TriggerButton({
  actingUserName,
  variant,
  active,
  onClick,
}: {
  actingUserName: string | undefined;
  variant: Variant;
  active?: boolean;
  onClick: () => void;
}) {
  const isInline = variant === 'inline';
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Open demo controls"
      aria-expanded={active}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 7,
        padding: isInline ? '6px 10px' : '8px 12px',
        borderRadius: 100,
        background: active ? 'rgba(34,68,68,0.06)' : '#fff',
        border: active
          ? '1px solid var(--color-accent-active)'
          : '1px solid var(--color-border-subtle)',
        boxShadow: isInline ? 'none' : '0 6px 20px rgba(10,20,25,0.14)',
        cursor: 'pointer',
        fontFamily: 'var(--font-primary)',
        fontSize: isInline ? 11 : 12,
        fontWeight: 600,
        color: 'var(--color-text-primary)',
        whiteSpace: 'nowrap',
      }}
    >
      <FlaskConical
        size={isInline ? 12 : 13}
        color="var(--color-accent-active)"
        strokeWidth={2.2}
      />
      <span
        style={{
          color: 'var(--color-text-muted)',
          fontSize: 10,
          fontWeight: 700,
          letterSpacing: '0.04em',
          textTransform: 'uppercase',
        }}
      >
        Demo
      </span>
      <span style={{ color: 'var(--color-text-primary)' }}>{actingUserName ?? '—'}</span>
    </button>
  );
}
