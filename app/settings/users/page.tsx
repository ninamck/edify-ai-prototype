'use client';

/**
 * /settings/users — recreates the "Users" surface of Edify's Settings
 * area (staging.edifysystems.io/users). Tabular list of every operator
 * with search + "Add new user" CTA. The role badge mirrors Edify's
 * Admin / Manager / Employee taxonomy.
 */

import { useMemo, useState } from 'react';
import { ArrowUpDown, Pencil, Plus, Search } from 'lucide-react';
import StatusPill from '@/components/Production/StatusPill';
import {
  DIRECTORY_USERS,
  type DirectoryUser,
} from '@/components/Settings/companyDirectory';

type SortField = 'name' | 'role' | 'status';
type SortDir = 'asc' | 'desc';

export default function UsersSettingsPage() {
  const [query, setQuery] = useState('');
  const [sortField, setSortField] = useState<SortField>('name');
  const [sortDir, setSortDir] = useState<SortDir>('asc');

  const rows = useMemo<DirectoryUser[]>(() => {
    const q = query.trim().toLowerCase();
    const filtered = q
      ? DIRECTORY_USERS.filter(
          u =>
            u.name.toLowerCase().includes(q) ||
            u.email.toLowerCase().includes(q) ||
            u.role.toLowerCase().includes(q),
        )
      : DIRECTORY_USERS;
    const sorted = [...filtered].sort((a, b) => {
      const va = (a[sortField] ?? '').toString().toLowerCase();
      const vb = (b[sortField] ?? '').toString().toLowerCase();
      if (va < vb) return sortDir === 'asc' ? -1 : 1;
      if (va > vb) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });
    return sorted;
  }, [query, sortField, sortDir]);

  function toggleSort(f: SortField) {
    if (f === sortField) setSortDir(d => (d === 'asc' ? 'desc' : 'asc'));
    else {
      setSortField(f);
      setSortDir('asc');
    }
  }

  return (
    <div style={{ padding: '20px 24px 96px' }}>
      <div style={{ maxWidth: 1080, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 14 }}>
        <PageHeader
          title="Users"
          subtitle={`${DIRECTORY_USERS.length} active team member${DIRECTORY_USERS.length === 1 ? '' : 's'}`}
          query={query}
          onQueryChange={setQuery}
          searchPlaceholder="Search users..."
          addLabel="Add new user"
        />

        <div
          style={{
            borderRadius: 'var(--radius-card)',
            border: '1px solid var(--color-border-subtle)',
            background: '#ffffff',
            overflow: 'hidden',
          }}
        >
          <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: 'var(--font-primary)' }}>
            <thead>
              <tr style={{ background: 'var(--color-bg-surface)' }}>
                <Th onClick={() => toggleSort('name')} sortable>
                  Name <ArrowUpDown size={11} style={{ opacity: 0.5 }} />
                </Th>
                <Th>Email</Th>
                <Th>Contact Phone</Th>
                <Th onClick={() => toggleSort('role')} sortable>
                  Role <ArrowUpDown size={11} style={{ opacity: 0.5 }} />
                </Th>
                <Th onClick={() => toggleSort('status')} sortable>
                  Status <ArrowUpDown size={11} style={{ opacity: 0.5 }} />
                </Th>
                <Th align="right">Action</Th>
              </tr>
            </thead>
            <tbody>
              {rows.map(user => (
                <tr key={user.id} style={{ borderTop: '1px solid var(--color-border-subtle)' }}>
                  <Td>
                    <span style={{ fontWeight: 600, color: 'var(--color-text-primary)' }}>{user.name}</span>
                  </Td>
                  <Td>
                    <span style={{ color: 'var(--color-text-secondary)' }}>{user.email}</span>
                  </Td>
                  <Td>
                    <span style={{ color: 'var(--color-text-muted)' }}>
                      {user.contactPhone ?? '—'}
                    </span>
                  </Td>
                  <Td>
                    <span style={{ color: 'var(--color-text-secondary)' }}>{user.role}</span>
                  </Td>
                  <Td>
                    <StatusPill
                      tone={user.status === 'active' ? 'success' : 'neutral'}
                      label={user.status === 'active' ? 'Active' : 'Inactive'}
                      size="xs"
                    />
                  </Td>
                  <Td align="right">
                    <button type="button" style={editBtn()}>
                      <Pencil size={11} /> Edit
                    </button>
                  </Td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td
                    colSpan={6}
                    style={{
                      padding: 28,
                      textAlign: 'center',
                      fontSize: 12,
                      color: 'var(--color-text-muted)',
                    }}
                  >
                    No users match &quot;{query}&quot;.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ─── Reused chrome ───────────────────────────────────────────────────────────
// NOTE: small, page-local duplication of the same primitives used in
// /settings/sites. Kept inline (rather than lifted to a shared module)
// because there are only two tables in this surface and the styles are
// likely to drift per page (e.g. Users will want filter chips for role).

function PageHeader({
  title,
  subtitle,
  query,
  onQueryChange,
  searchPlaceholder,
  addLabel,
}: {
  title: string;
  subtitle: string;
  query: string;
  onQueryChange: (v: string) => void;
  searchPlaceholder: string;
  addLabel: string;
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
      <div style={{ minWidth: 0, flex: 1 }}>
        <h1
          style={{
            margin: 0,
            fontSize: 22,
            fontWeight: 700,
            color: 'var(--color-text-primary)',
            fontFamily: 'var(--font-primary)',
          }}
        >
          {title}
        </h1>
        <div style={{ marginTop: 2, fontSize: 12, color: 'var(--color-text-muted)' }}>{subtitle}</div>
      </div>
      <div style={{ position: 'relative' }}>
        <Search
          size={14}
          style={{
            position: 'absolute',
            left: 10,
            top: '50%',
            transform: 'translateY(-50%)',
            color: 'var(--color-text-muted)',
            pointerEvents: 'none',
          }}
        />
        <input
          value={query}
          onChange={e => onQueryChange(e.target.value)}
          placeholder={searchPlaceholder}
          style={{
            padding: '8px 12px 8px 30px',
            borderRadius: 8,
            border: '1px solid var(--color-border)',
            background: '#ffffff',
            fontSize: 12,
            fontFamily: 'var(--font-primary)',
            color: 'var(--color-text-primary)',
            minWidth: 220,
            outline: 'none',
          }}
        />
      </div>
      <button type="button" style={primaryBtn()}>
        <Plus size={12} /> {addLabel}
      </button>
    </div>
  );
}

function Th({
  children,
  align = 'left',
  onClick,
  sortable,
}: {
  children: React.ReactNode;
  align?: 'left' | 'right';
  onClick?: () => void;
  sortable?: boolean;
}) {
  return (
    <th
      onClick={onClick}
      style={{
        textAlign: align,
        padding: '12px 16px',
        fontSize: 10.5,
        fontWeight: 700,
        letterSpacing: '0.06em',
        textTransform: 'uppercase',
        color: 'var(--color-text-muted)',
        borderBottom: '1px solid var(--color-border-subtle)',
        userSelect: 'none',
        cursor: sortable ? 'pointer' : 'default',
        whiteSpace: 'nowrap',
      }}
    >
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>{children}</span>
    </th>
  );
}

function Td({
  children,
  align = 'left',
}: {
  children: React.ReactNode;
  align?: 'left' | 'right';
}) {
  return (
    <td
      style={{
        textAlign: align,
        padding: '14px 16px',
        fontSize: 12.5,
        color: 'var(--color-text-primary)',
        verticalAlign: 'middle',
      }}
    >
      {children}
    </td>
  );
}

function primaryBtn(): React.CSSProperties {
  return {
    padding: '9px 14px',
    borderRadius: 8,
    fontSize: 12,
    fontWeight: 700,
    fontFamily: 'var(--font-primary)',
    background: 'var(--color-accent-active)',
    color: 'var(--color-text-on-active)',
    border: '1px solid var(--color-accent-active)',
    cursor: 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    whiteSpace: 'nowrap',
  };
}

function editBtn(): React.CSSProperties {
  return {
    padding: '6px 12px',
    borderRadius: 8,
    fontSize: 11,
    fontWeight: 700,
    fontFamily: 'var(--font-primary)',
    background: '#ffffff',
    color: 'var(--color-text-secondary)',
    border: '1px solid var(--color-border)',
    cursor: 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    whiteSpace: 'nowrap',
  };
}
