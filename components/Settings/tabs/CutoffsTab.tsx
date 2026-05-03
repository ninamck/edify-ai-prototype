'use client';

/**
 * CutoffsTab — when spokes have to commit their order by, and what
 * happens if they miss it.
 *
 * Lock policy is the only knob that already flows through the rest of
 * the app today (`hubSettingsFor` → `/production/spokes`). The cutoff
 * time wires through after Save via the effective resolver in
 * `siteSettingsStore`.
 */

import { Clock, Lock, Unlock } from 'lucide-react';
import QtyStepper, { getStepperValueStyle } from '@/components/Production/QtyStepper';
import StatusPill from '@/components/Production/StatusPill';
import { useSiteSettings, type LockPolicy } from '../siteSettingsStore';
import {
  FieldRow,
  HealthAlertStrip,
  Section,
  TimeInput,
  type TabProps,
} from './_shared';

export default function CutoffsTab({ siteId, editing, staged, onStage, health }: TabProps) {
  const { effective } = useSiteSettings(siteId);
  const c = effective.cutoffs;
  const stagedC = staged.cutoffs ?? {};

  const cutoffTime = stagedC.cutoffTime ?? c.cutoffTime;
  const lockPolicy = (stagedC.lockPolicy ?? c.lockPolicy) as LockPolicy;
  const coverDays = stagedC.coverDays ?? c.coverDays;
  const leadTimeHours = stagedC.leadTimeHours ?? c.leadTimeHours;

  // Validation — soft warning if cutoff is later than the site opens
  // (in spoke-land that means the order locks after service starts,
  // which is a smell rather than a hard error).
  const openTime = effective.core.openingHours.open;
  const cutoffWarning =
    cutoffTime && openTime && cutoffTime > openTime
      ? `Cutoff is later than the site opens (${openTime}). The hub may not have time to bake.`
      : null;

  function setCutoffs(patch: Partial<typeof stagedC>) {
    onStage({ cutoffs: patch });
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, maxWidth: 880 }}>
      <HealthAlertStrip items={health} />

      <Section
        title="Cutoff time"
        description="The deadline for the spoke to commit tomorrow's order. Hub plans the bake at this point."
      >
        <FieldRow
          label="Daily cutoff"
          control={
            <TimeInput
              value={cutoffTime}
              disabled={!editing}
              onChange={v => setCutoffs({ cutoffTime: v })}
            />
          }
          cascade={`Inherits from ${c.cascadeNotes.cutoffTime}`}
          isOverridden={cutoffTime !== c.defaults.cutoffTime}
          onReset={() => setCutoffs({ cutoffTime: c.defaults.cutoffTime })}
        />

        {cutoffWarning && (
          <div
            style={{
              padding: '8px 12px',
              borderRadius: 8,
              background: 'var(--color-warning-light)',
              border: '1px solid var(--color-warning-border)',
              color: 'var(--color-warning)',
              fontSize: 11,
              fontWeight: 700,
            }}
          >
            {cutoffWarning}
          </div>
        )}

        <div
          style={{
            padding: '10px 12px',
            borderRadius: 8,
            background: 'var(--color-info-light)',
            border: '1px solid var(--color-info)',
            color: 'var(--color-info)',
            fontSize: 12,
            fontWeight: 600,
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            width: 'fit-content',
          }}
        >
          <Clock size={13} /> Spokes have until <strong>{cutoffTime}</strong> today to lock
          tomorrow's order.
        </div>
      </Section>

      <Section
        title="Lock policy"
        description="What Quinn does when the cutoff passes and a draft is still open."
      >
        <LockPolicyChooser
          value={lockPolicy}
          editing={editing}
          onChange={v => setCutoffs({ lockPolicy: v })}
        />
        <FieldRow
          label="Default"
          hint="Estate / hub default in PRET_HUB_SETTINGS."
          control={
            <StatusPill
              tone={c.defaults.lockPolicy === 'lock' ? 'brand' : 'neutral'}
              label={c.defaults.lockPolicy === 'lock' ? 'Hard lock' : 'Soft lock'}
              size="sm"
            />
          }
          isOverridden={lockPolicy !== c.defaults.lockPolicy}
          onReset={() => setCutoffs({ lockPolicy: c.defaults.lockPolicy })}
        />
      </Section>

      <Section
        title="Window & lead time"
        description="How far ahead Quinn plans and how long production needs once the order is locked."
      >
        <FieldRow
          label="Cover days"
          hint="How many days of cover the cutoff window represents (1 = next day)."
          control={
            <QtyStepper
              size="emphasized"
              disabled={!editing}
              canDecrement={coverDays > 1}
              canIncrement={coverDays < 7}
              onDecrement={() => setCutoffs({ coverDays: Math.max(1, coverDays - 1) })}
              onIncrement={() => setCutoffs({ coverDays: Math.min(7, coverDays + 1) })}
            >
              <span style={getStepperValueStyle('emphasized')}>{coverDays}</span>
            </QtyStepper>
          }
          cascade={`Default · ${c.defaults.coverDays} day${c.defaults.coverDays === 1 ? '' : 's'}`}
          isOverridden={coverDays !== c.defaults.coverDays}
          onReset={() => setCutoffs({ coverDays: c.defaults.coverDays })}
        />
        <FieldRow
          label="Lead time"
          hint="Hours between cutoff and the time the order needs to be on the bench."
          control={
            <QtyStepper
              size="emphasized"
              disabled={!editing}
              canDecrement={leadTimeHours > 1}
              canIncrement={leadTimeHours < 48}
              onDecrement={() => setCutoffs({ leadTimeHours: Math.max(1, leadTimeHours - 1) })}
              onIncrement={() => setCutoffs({ leadTimeHours: Math.min(48, leadTimeHours + 1) })}
            >
              <span style={getStepperValueStyle('emphasized')}>{leadTimeHours}h</span>
            </QtyStepper>
          }
          cascade={`Default · ${c.defaults.leadTimeHours}h`}
          isOverridden={leadTimeHours !== c.defaults.leadTimeHours}
          onReset={() => setCutoffs({ leadTimeHours: c.defaults.leadTimeHours })}
        />
      </Section>
    </div>
  );
}

// ─── Lock policy chooser (two-card radio) ────────────────────────────────────

function LockPolicyChooser({
  value,
  editing,
  onChange,
}: {
  value: LockPolicy;
  editing: boolean;
  onChange: (v: LockPolicy) => void;
}) {
  const options: Array<{ id: LockPolicy; title: string; body: string; preview: string; icon: React.ReactNode }> = [
    {
      id: 'lock',
      title: 'Hard lock',
      body: 'Auto-finalise the order on Quinn\u2019s numbers when cutoff passes.',
      preview: 'Spokes lose the ability to edit · the hub still bakes the right amount.',
      icon: <Lock size={14} />,
    },
    {
      id: 'soft',
      title: 'Soft lock',
      body: 'Stay editable past cutoff, but flag the order as overdue.',
      preview: 'No auto-finalisation · the hub waits for a manual submit.',
      icon: <Unlock size={14} />,
    },
  ];

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
        gap: 10,
      }}
    >
      {options.map(o => {
        const active = o.id === value;
        return (
          <button
            key={o.id}
            type="button"
            disabled={!editing}
            onClick={() => onChange(o.id)}
            style={{
              padding: '12px 14px',
              borderRadius: 10,
              border: `2px solid ${active ? 'var(--color-accent-active)' : 'var(--color-border)'}`,
              background: active ? 'var(--color-info-light)' : '#ffffff',
              color: 'var(--color-text-primary)',
              cursor: editing ? 'pointer' : 'not-allowed',
              opacity: editing || active ? 1 : 0.7,
              textAlign: 'left',
              fontFamily: 'var(--font-primary)',
              display: 'flex',
              flexDirection: 'column',
              gap: 6,
            }}
          >
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
              <span
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: 8,
                  background: active ? 'var(--color-accent-active)' : 'var(--color-bg-hover)',
                  color: active ? 'var(--color-text-on-active)' : 'var(--color-text-secondary)',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {o.icon}
              </span>
              <span style={{ fontSize: 13, fontWeight: 700 }}>{o.title}</span>
              {active && <StatusPill tone="brand" label="Active" size="xs" />}
            </div>
            <span style={{ fontSize: 11.5, color: 'var(--color-text-secondary)', fontWeight: 600 }}>
              {o.body}
            </span>
            <span
              style={{
                fontSize: 10.5,
                fontWeight: 700,
                color: active ? 'var(--color-info)' : 'var(--color-text-muted)',
              }}
            >
              {active ? 'What changes · ' : 'Preview · '}
              {o.preview}
            </span>
          </button>
        );
      })}
    </div>
  );
}
