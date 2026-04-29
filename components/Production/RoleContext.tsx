'use client';

import { createContext, useContext, useMemo, useState } from 'react';
import { User, UserCog, Lock } from 'lucide-react';
import {
  PRET_USERS,
  DEMO_CURRENT_USER_ID,
  type User as UserType,
  type Role,
  type UserId,
} from './fixtures';

// ─────────────────────────────────────────────────────────────────────────────
// Permission matrix
// Staff: read-only on planning; can tick off batches during production.
// Manager: full access — approve plan, sign PCR, remediate settings, etc.
// ─────────────────────────────────────────────────────────────────────────────

export type Permission =
  | 'plan.approve'
  | 'plan.editQuantity'
  | 'carry-over.adjust'
  | 'carry-over.confirm'
  | 'spoke.adjust'
  | 'spoke.submit'
  | 'pcr.sign'
  | 'pcr.fail'
  | 'batch.tickOff'
  | 'settings.remediate'
  | 'setup.save';

const PERMISSION_MATRIX: Record<Role, Set<Permission>> = {
  Manager: new Set([
    'plan.approve',
    'plan.editQuantity',
    'carry-over.adjust',
    'carry-over.confirm',
    'spoke.adjust',
    'spoke.submit',
    'pcr.sign',
    'pcr.fail',
    'batch.tickOff',
    'settings.remediate',
    'setup.save',
  ]),
  Staff: new Set<Permission>([
    'batch.tickOff',
  ]),
};

type RoleContextValue = {
  user: UserType;
  role: Role;
  setUserId: (id: UserId) => void;
  can: (perm: Permission) => boolean;
};

const RoleContext = createContext<RoleContextValue | null>(null);

export function RoleProvider({ children }: { children: React.ReactNode }) {
  const [userId, setUserId] = useState<UserId>(DEMO_CURRENT_USER_ID);
  const value = useMemo<RoleContextValue>(() => {
    const user =
      PRET_USERS.find(u => u.id === userId) ??
      PRET_USERS.find(u => u.id === DEMO_CURRENT_USER_ID)!;
    return {
      user,
      role: user.role,
      setUserId,
      can: (perm: Permission) => PERMISSION_MATRIX[user.role].has(perm),
    };
  }, [userId]);
  return <RoleContext.Provider value={value}>{children}</RoleContext.Provider>;
}

export function useRole(): RoleContextValue {
  const ctx = useContext(RoleContext);
  if (!ctx) {
    // Sensible fallback outside the provider — behaves like Manager for demo continuity.
    const user = PRET_USERS.find(u => u.id === DEMO_CURRENT_USER_ID)!;
    return {
      user,
      role: user.role,
      setUserId: () => {},
      can: (perm: Permission) => PERMISSION_MATRIX[user.role].has(perm),
    };
  }
  return ctx;
}

// ─────────────────────────────────────────────────────────────────────────────
// Role switcher — demo affordance for flipping roles in the prototype
// ─────────────────────────────────────────────────────────────────────────────

export function RoleSwitcher() {
  const { user, setUserId } = useRole();
  return (
    <label
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        padding: '5px 10px 5px 8px',
        borderRadius: 8,
        background: '#ffffff',
        border: '1px solid var(--color-border)',
        fontSize: 11,
        fontFamily: 'var(--font-primary)',
        cursor: 'pointer',
      }}
    >
      {user.role === 'Manager' ? (
        <UserCog size={14} color="var(--color-accent-active)" />
      ) : (
        <User size={14} color="var(--color-text-muted)" />
      )}
      <select
        value={user.id}
        onChange={e => setUserId(e.target.value as UserId)}
        style={{
          border: 'none',
          background: 'transparent',
          fontSize: 11,
          fontWeight: 600,
          fontFamily: 'var(--font-primary)',
          color: 'var(--color-text-primary)',
          cursor: 'pointer',
          outline: 'none',
          paddingRight: 4,
        }}
      >
        {PRET_USERS.map(u => (
          <option key={u.id} value={u.id}>
            {u.role} · {u.name.split('—')[0].trim()}
          </option>
        ))}
      </select>
    </label>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// StaffLockBanner — reusable read-only banner for gated surfaces
// ─────────────────────────────────────────────────────────────────────────────

export function StaffLockBanner({ reason }: { reason: string }) {
  const { role } = useRole();
  if (role === 'Manager') return null;
  return (
    <div
      style={{
        padding: '8px 12px',
        borderRadius: 8,
        background: 'var(--color-warning-light)',
        border: '1px solid var(--color-warning-border)',
        display: 'inline-flex',
        alignItems: 'center',
        gap: 8,
        fontSize: 11,
        fontWeight: 600,
        color: 'var(--color-warning)',
        fontFamily: 'var(--font-primary)',
        margin: '0 0 12px 0',
      }}
    >
      <Lock size={12} /> Read-only as Staff — {reason}
    </div>
  );
}
