'use client';

/**
 * Site setup · step 3 — load the people.
 *
 * Rosters come straight from Workday (integration assumed live in this
 * demo). Roles are pre-mapped from each person's Workday job and stay
 * editable per person. Roles match Edify main (Employee / Manager /
 * Admin); Managers carry the standard shop permission set on top,
 * suppliers through to stocktakes. Bench lists default from each
 * shop's own roster (PRD 4.5).
 */

import { useState } from 'react';
import { ChevronDown, Users } from 'lucide-react';
import CardShell, { PillRow } from './CardShell';
import type { CardState } from './CardShell';
import {
  EDIFY_ROLES,
  defaultEdifyRole,
  describeRoleCounts,
  getWorkdaySite,
  roleCounts,
  type EdifyRole,
} from '../siteSetupFixtures';

interface SiteSetupTeamCardProps {
  state: CardState;
  siteIds: string[];
  initialRoles?: Record<string, EdifyRole>;
  onSubmit: (input: { roles: Record<string, EdifyRole> }) => void;
  onCancel: () => void;
  /** Reopen for edits after confirm — available until final go-live. */
  onEdit?: () => void;
}

export default function SiteSetupTeamCard({
  state,
  siteIds,
  initialRoles,
  onSubmit,
  onCancel,
  onEdit,
}: SiteSetupTeamCardProps) {
  const [roles, setRoles] = useState<Record<string, EdifyRole>>(initialRoles ?? {});
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const disabled = state !== 'pending';
  const totalPeople = siteIds.reduce((n, id) => n + (getWorkdaySite(id)?.roster.length ?? 0), 0);

  return (
    <CardShell
      icon={Users}
      title={`${totalPeople} people from Workday`}
      subtitle="Roles mapped from job titles. Change any of them"
      state={state}
      confirmLabel={`Load ${totalPeople} people`}
      onCancel={onCancel}
      onEdit={onEdit}
      onConfirm={() => onSubmit({ roles })}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {siteIds.map((siteId) => {
          const site = getWorkdaySite(siteId);
          if (!site) return null;
          const counts = roleCounts(site.roster, roles);
          const isOpen = !!expanded[siteId];
          return (
            <div
              key={siteId}
              style={{
                borderRadius: '12px',
                border: '1px solid var(--color-border-subtle, rgba(0,28,53,0.10))',
                overflow: 'hidden',
              }}
            >
              <button
                type="button"
                onClick={() => setExpanded((prev) => ({ ...prev, [siteId]: !prev[siteId] }))}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  width: '100%',
                  padding: '10px 12px',
                  border: 'none',
                  background: 'rgba(0,28,53,0.015)',
                  textAlign: 'left',
                  cursor: 'pointer',
                  fontFamily: 'var(--font-primary)',
                }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ display: 'block', fontSize: '13px', fontWeight: 700, color: 'var(--color-text-primary)' }}>
                    {site.shortName} · {site.roster.length} people
                  </span>
                  <span style={{ display: 'block', fontSize: '11px', color: 'var(--color-text-muted)', marginTop: '1px' }}>
                    {describeRoleCounts(counts)}
                  </span>
                </div>
                <ChevronDown
                  size={14}
                  color="var(--color-text-muted)"
                  style={{ flexShrink: 0, transform: isOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.12s' }}
                />
              </button>
              {isOpen && (
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  {site.roster.map((p) => {
                    const current = roles[p.id] ?? defaultEdifyRole(p.workdayRole);
                    return (
                      <div
                        key={p.id}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '10px',
                          padding: '7px 12px',
                          borderTop: '1px solid var(--color-border-subtle, rgba(0,28,53,0.06))',
                          flexWrap: 'wrap',
                        }}
                      >
                        <div style={{ flex: 1, minWidth: '140px' }}>
                          <span style={{ display: 'block', fontSize: '12.5px', fontWeight: 600, color: 'var(--color-text-primary)' }}>
                            {p.name}
                          </span>
                          <span style={{ display: 'block', fontSize: '10.5px', color: 'var(--color-text-muted)' }}>
                            {p.workdayRole} in Workday
                          </span>
                        </div>
                        <PillRow
                          small
                          disabled={disabled}
                          options={EDIFY_ROLES.map((r) => ({ value: r, label: r }))}
                          selected={current}
                          onSelect={(v) =>
                            setRoles((prev) => ({ ...prev, [p.id]: v as EdifyRole }))
                          }
                        />
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
        <div style={{ fontSize: '11px', color: 'var(--color-text-muted)', lineHeight: 1.5 }}>
          Managers get the standard shop permissions, suppliers through to stocktakes. Invites go out the week before each opening.
        </div>
      </div>
    </CardShell>
  );
}
