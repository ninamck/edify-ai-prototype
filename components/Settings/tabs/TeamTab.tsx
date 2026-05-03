'use client';

/**
 * TeamTab — bench users + site duties.
 *
 * Mirrors the Pret screenshots (Bench Users + Site Duties) but uses
 * canonical pill pickers for labels / bench links and QtyStepper for
 * duty duration. Spoke / hub-linked sites with no benches see a
 * directed empty-state (principle 1 — defaults that explain themselves).
 */

import { Plus, Trash2 } from 'lucide-react';
import QtyStepper, { getStepperValueStyle } from '@/components/Production/QtyStepper';
import {
  type BenchId,
  type SiteId,
} from '@/components/Production/fixtures';
import {
  useSiteSettings,
  type SiteDuty,
  type TeamUser,
} from '../siteSettingsStore';
import {
  HealthAlertStrip,
  PillMultiPicker,
  PillPicker,
  Section,
  TextInput,
  type TabProps,
} from './_shared';

const LABEL_OPTIONS = [
  { id: 'GM', label: 'GM' },
  { id: 'TM', label: 'TM' },
  { id: 'Lead', label: 'Lead' },
  { id: '__none', label: 'No label' },
] as const;

export default function TeamTab({ siteId, editing, staged, onStage, health }: TabProps) {
  const { effective } = useSiteSettings(siteId);
  const team = effective.team;
  const stagedTeam = staged.team ?? {};
  const users = stagedTeam.users ?? team.users;
  const duties = stagedTeam.duties ?? team.duties;
  const benchOptions = effective.benches.map(b => ({ id: b.id, label: b.name }));

  function setUsers(next: TeamUser[]) {
    onStage({ team: { users: next } });
  }
  function setDuties(next: SiteDuty[]) {
    onStage({ team: { duties: next } });
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, maxWidth: 1040 }}>
      <HealthAlertStrip items={health} />

      <Section
        title="Bench users"
        description="People assigned to bench rotations at this site. Labels (GM, TM, Lead) flag accountability."
      >
        <UserList
          users={users}
          editing={editing}
          onChange={setUsers}
        />
      </Section>

      <Section
        title="Site duties"
        description={
          benchOptions.length === 0
            ? 'Duties live on a bench. Add a bench first to wire them up.'
            : 'Cleaning + ad-hoc tasks Quinn can drop into the schedule. Leave bench blank for random assignment.'
        }
      >
        <DutyList
          duties={duties}
          editing={editing}
          benchOptions={benchOptions}
          onChange={setDuties}
        />
      </Section>

      {benchOptions.length === 0 && effective.core.hubId && (
        <div
          style={{
            padding: '12px 14px',
            borderRadius: 'var(--radius-card)',
            background: 'var(--color-info-light)',
            border: '1px solid var(--color-info)',
            color: 'var(--color-text-primary)',
            fontSize: 12,
          }}
        >
          {(() => {
            const _id: SiteId | null = effective.core.hubId;
            return null;
          })()}
          This site receives from {effective.core.hubId.replace(/-/g, ' ')}. Most spokes don't run their
          own benches — the hub bakes for them. Bench users + duties only matter if the spoke
          starts assembling its own product.
        </div>
      )}
    </div>
  );
}

// ─── User list ───────────────────────────────────────────────────────────────

function UserList({
  users,
  editing,
  onChange,
}: {
  users: TeamUser[];
  editing: boolean;
  onChange: (next: TeamUser[]) => void;
}) {
  function update(i: number, patch: Partial<TeamUser>) {
    const next = users.slice();
    next[i] = { ...next[i], ...patch };
    onChange(next);
  }
  function remove(i: number) {
    const next = users.slice();
    next.splice(i, 1);
    onChange(next);
  }
  function add() {
    onChange([
      ...users,
      { id: `u-${Math.random().toString(36).slice(2, 8)}`, name: '', label: undefined },
    ]);
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {users.length === 0 && (
        <span style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>No users yet.</span>
      )}
      {users.map((u, i) => (
        <div
          key={u.id}
          style={{
            display: 'grid',
            gridTemplateColumns: 'minmax(220px, 1fr) auto auto',
            gap: 10,
            alignItems: 'center',
            padding: '8px 12px',
            background: '#ffffff',
            border: '1px solid var(--color-border-subtle)',
            borderRadius: 8,
          }}
        >
          <TextInput
            value={u.name}
            disabled={!editing}
            placeholder="Full name"
            onChange={v => update(i, { name: v })}
          />
          <PillPicker
            options={LABEL_OPTIONS as unknown as Array<{ id: string; label: string }>}
            value={u.label ?? '__none'}
            disabled={!editing}
            onChange={v => update(i, { label: v === '__none' ? undefined : v })}
          />
          <button
            type="button"
            disabled={!editing}
            onClick={() => remove(i)}
            title="Remove user"
            aria-label="Remove user"
            style={iconBtn(editing)}
          >
            <Trash2 size={13} />
          </button>
        </div>
      ))}
      {editing && (
        <button type="button" onClick={add} style={addBtn()}>
          <Plus size={11} /> Add user
        </button>
      )}
    </div>
  );
}

// ─── Duty list ───────────────────────────────────────────────────────────────

function DutyList({
  duties,
  editing,
  benchOptions,
  onChange,
}: {
  duties: SiteDuty[];
  editing: boolean;
  benchOptions: Array<{ id: BenchId; label: string }>;
  onChange: (next: SiteDuty[]) => void;
}) {
  function update(i: number, patch: Partial<SiteDuty>) {
    const next = duties.slice();
    next[i] = { ...next[i], ...patch };
    onChange(next);
  }
  function remove(i: number) {
    const next = duties.slice();
    next.splice(i, 1);
    onChange(next);
  }
  function add() {
    onChange([
      ...duties,
      {
        id: `d-${Math.random().toString(36).slice(2, 8)}`,
        name: '',
        durationMinutes: 3,
        benchIds: [],
      },
    ]);
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {duties.length === 0 && (
        <span style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>No duties yet.</span>
      )}
      {duties.map((d, i) => (
        <div
          key={d.id}
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
            padding: '10px 12px',
            background: '#ffffff',
            border: '1px solid var(--color-border-subtle)',
            borderRadius: 8,
          }}
        >
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'minmax(200px, 1fr) auto auto',
              gap: 10,
              alignItems: 'center',
            }}
          >
            <TextInput
              value={d.name}
              disabled={!editing}
              placeholder="Duty name (e.g. Bins)"
              onChange={v => update(i, { name: v })}
            />
            <QtyStepper
              size="emphasized"
              disabled={!editing}
              canDecrement={d.durationMinutes > 1}
              onDecrement={() => update(i, { durationMinutes: Math.max(1, d.durationMinutes - 1) })}
              onIncrement={() => update(i, { durationMinutes: d.durationMinutes + 1 })}
              decrementLabel="Shorter duty"
              incrementLabel="Longer duty"
            >
              <span style={getStepperValueStyle('emphasized')}>{d.durationMinutes}m</span>
            </QtyStepper>
            <button
              type="button"
              disabled={!editing}
              onClick={() => remove(i)}
              title="Remove duty"
              aria-label="Remove duty"
              style={iconBtn(editing)}
            >
              <Trash2 size={13} />
            </button>
          </div>
          {benchOptions.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <span
                style={{
                  fontSize: 9.5,
                  fontWeight: 700,
                  color: 'var(--color-text-muted)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.06em',
                }}
              >
                Associated benches · leave blank for random assignment
              </span>
              <PillMultiPicker<BenchId>
                options={benchOptions}
                value={d.benchIds}
                disabled={!editing}
                onChange={next => update(i, { benchIds: next })}
              />
            </div>
          )}
        </div>
      ))}
      {editing && (
        <button type="button" onClick={add} style={addBtn()}>
          <Plus size={11} /> Add duty
        </button>
      )}
    </div>
  );
}

// ─── Buttons ────────────────────────────────────────────────────────────────

function iconBtn(enabled: boolean): React.CSSProperties {
  return {
    width: 32,
    height: 32,
    borderRadius: 6,
    border: '1px solid var(--color-border)',
    background: '#ffffff',
    color: 'var(--color-text-secondary)',
    cursor: enabled ? 'pointer' : 'not-allowed',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    opacity: enabled ? 1 : 0.5,
  };
}

function addBtn(): React.CSSProperties {
  return {
    padding: '8px 12px',
    borderRadius: 8,
    background: '#ffffff',
    border: '1px dashed var(--color-border)',
    color: 'var(--color-info)',
    fontSize: 11,
    fontWeight: 700,
    fontFamily: 'var(--font-primary)',
    cursor: 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    width: 'fit-content',
  };
}
