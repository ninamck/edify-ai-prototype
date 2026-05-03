'use client';

/**
 * BenchesTab — bench list with collapsible per-bench config.
 *
 * Each bench card shows the canonical anatomy (status pill, title,
 * metadata, action) and uses QtyStepper for batch rule numerics. Run
 * schedules are collapsed by default behind a "N runs scheduled" tap
 * target so the page stays scannable at a glance (principle 5).
 */

import { useState } from 'react';
import { ChevronDown, ChevronRight, Plus, Trash2 } from 'lucide-react';
import QtyStepper, { getStepperValueStyle } from '@/components/Production/QtyStepper';
import StatusPill from '@/components/Production/StatusPill';
import {
  type BenchCapability,
  type BenchId,
  type ProductionMode,
} from '@/components/Production/fixtures';
import {
  KNOWN_BENCH_CAPABILITIES,
  KNOWN_PRIMARY_MODES,
  useSiteSettings,
  type EffectiveBench,
} from '../siteSettingsStore';
import {
  HealthAlertStrip,
  PillMultiPicker,
  PillPicker,
  Section,
  TextInput,
  TimeInput,
  type TabProps,
} from './_shared';

export default function BenchesTab({ siteId, editing, staged, onStage, health }: TabProps) {
  const { effective } = useSiteSettings(siteId);
  const benches = effective.benches;

  if (benches.length === 0) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, maxWidth: 880 }}>
        <HealthAlertStrip items={health} />
        <Section
          title="No benches at this site"
          description="Spokes and most hybrid sites don't run their own benches — the linked hub bakes for them."
        >
          <span style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>
            Switch to the hub site (e.g. Fitzroy Espresso) from the picker above to manage its
            benches.
          </span>
        </Section>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, maxWidth: 1040 }}>
      <HealthAlertStrip items={health} />

      <Section
        title="Benches"
        description={`${benches.length} bench${benches.length === 1 ? '' : 'es'} at this site. Tap a row to edit batch rules and run schedule.`}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {benches.map(bench => (
            <BenchCard
              key={bench.id}
              bench={bench}
              editing={editing}
              stagedBench={staged.benches?.[bench.id]}
              onStage={patch => onStage({ benches: { [bench.id]: patch } })}
            />
          ))}
        </div>
      </Section>
    </div>
  );
}

// ─── Single bench card ───────────────────────────────────────────────────────

function BenchCard({
  bench,
  editing,
  stagedBench,
  onStage,
}: {
  bench: EffectiveBench;
  editing: boolean;
  stagedBench: BenchOverlay | undefined;
  onStage: (patch: BenchOverlay) => void;
}) {
  const [expanded, setExpanded] = useState(false);

  const name = stagedBench?.name ?? bench.name;
  const online = stagedBench?.online ?? bench.online;
  const primaryMode = (stagedBench?.primaryMode ?? bench.primaryMode ?? 'variable') as ProductionMode;
  const capabilities = (stagedBench?.capabilities ?? bench.capabilities) as BenchCapability[];
  const batchRules = stagedBench?.batchRules ?? bench.batchRules;
  const runs = stagedBench?.runs ?? bench.runs ?? [];

  return (
    <div
      style={{
        border: `1px solid ${bench.hasOverride ? 'var(--color-info)' : 'var(--color-border-subtle)'}`,
        borderRadius: 'var(--radius-card)',
        background: '#ffffff',
        overflow: 'hidden',
      }}
    >
      {/* Card header — always visible */}
      <button
        type="button"
        onClick={() => setExpanded(e => !e)}
        style={{
          width: '100%',
          padding: '12px 14px',
          background: 'transparent',
          border: 'none',
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          cursor: 'pointer',
          textAlign: 'left',
          fontFamily: 'var(--font-primary)',
        }}
      >
        {expanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 4 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 13, fontWeight: 700 }}>{name}</span>
            <StatusPill
              tone={online ? 'success' : 'neutral'}
              label={online ? 'Online' : 'Offline'}
              size="xs"
            />
            <StatusPill tone="brand" label={primaryMode} size="xs" />
            {bench.hasOverride && <StatusPill tone="info" label="Edited" size="xs" />}
          </div>
          <div style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>
            {capabilities.length === 0 ? 'No capabilities set' : capabilities.join(' · ')}
            {runs.length > 0 && ` · ${runs.length} run${runs.length === 1 ? '' : 's'} scheduled`}
            {batchRules &&
              ` · batch ${batchRules.min}–${batchRules.max} (× ${batchRules.multipleOf})`}
          </div>
        </div>
      </button>

      {expanded && (
        <div
          style={{
            padding: '14px 16px',
            borderTop: '1px solid var(--color-border-subtle)',
            background: 'var(--color-bg-hover)',
            display: 'flex',
            flexDirection: 'column',
            gap: 14,
          }}
        >
          {/* Identity */}
          <Row label="Bench name">
            <TextInput
              value={name}
              disabled={!editing}
              onChange={v => onStage({ name: v })}
              width={240}
            />
          </Row>

          {/* Online toggle */}
          <Row label="Status">
            <PillPicker
              options={[
                { id: 'online', label: 'Online' },
                { id: 'offline', label: 'Offline' },
              ]}
              value={online ? 'online' : 'offline'}
              disabled={!editing}
              onChange={v => onStage({ online: v === 'online' })}
            />
          </Row>

          {/* Primary mode */}
          <Row
            label="Primary mode"
            hint="Run = scheduled batches. Variable = topped up through the day. Increment = small drops."
          >
            <PillPicker<ProductionMode>
              options={KNOWN_PRIMARY_MODES.map(m => ({ id: m, label: m }))}
              value={primaryMode}
              disabled={!editing}
              onChange={v => onStage({ primaryMode: v })}
            />
          </Row>

          {/* Capabilities */}
          <Row label="Capabilities">
            <PillMultiPicker<BenchCapability>
              options={KNOWN_BENCH_CAPABILITIES.map(c => ({ id: c, label: c }))}
              value={capabilities}
              disabled={!editing}
              onChange={next => onStage({ capabilities: next })}
            />
          </Row>

          {/* Batch rules */}
          <Row label="Batch rules" hint="Hardware limits — recipes can override.">
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <BatchStepper
                label="Min"
                value={batchRules?.min ?? 1}
                disabled={!editing}
                onChange={v =>
                  onStage({
                    batchRules: {
                      min: Math.max(1, v),
                      max: Math.max(batchRules?.max ?? v, v),
                      multipleOf: batchRules?.multipleOf ?? 1,
                    },
                  })
                }
              />
              <BatchStepper
                label="Max"
                value={batchRules?.max ?? 12}
                disabled={!editing}
                onChange={v =>
                  onStage({
                    batchRules: {
                      min: batchRules?.min ?? 1,
                      max: Math.max(batchRules?.min ?? 1, v),
                      multipleOf: batchRules?.multipleOf ?? 1,
                    },
                  })
                }
              />
              <BatchStepper
                label="Multiple of"
                value={batchRules?.multipleOf ?? 1}
                disabled={!editing}
                onChange={v =>
                  onStage({
                    batchRules: {
                      min: batchRules?.min ?? 1,
                      max: batchRules?.max ?? 12,
                      multipleOf: Math.max(1, v),
                    },
                  })
                }
              />
            </div>
          </Row>

          {/* Run schedule (only meaningful for run-mode benches) */}
          {primaryMode === 'run' && (
            <Row
              label="Run schedule"
              hint="One row per scheduled bake. Quinn buckets demand into the closest run."
            >
              <RunScheduleEditor
                runs={runs as Array<{ id: string; label: string; startTime: string; durationMinutes: number }>}
                editing={editing}
                onChange={next => onStage({ runs: next })}
              />
            </Row>
          )}
        </div>
      )}
    </div>
  );
}

function Row({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--color-text-primary)' }}>
          {label}
        </span>
        {hint && (
          <span style={{ fontSize: 10.5, color: 'var(--color-text-muted)', marginTop: 2 }}>
            {hint}
          </span>
        )}
      </div>
      {children}
    </div>
  );
}

function BatchStepper({
  label,
  value,
  disabled,
  onChange,
}: {
  label: string;
  value: number;
  disabled?: boolean;
  onChange: (n: number) => void;
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'flex-start' }}>
      <span style={{ fontSize: 9.5, fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
        {label}
      </span>
      <QtyStepper
        size="emphasized"
        disabled={disabled}
        canDecrement={value > 1}
        onIncrement={() => onChange(value + 1)}
        onDecrement={() => onChange(Math.max(1, value - 1))}
      >
        <span style={getStepperValueStyle('emphasized')}>{value}</span>
      </QtyStepper>
    </div>
  );
}

// ─── Run schedule editor ─────────────────────────────────────────────────────

type RunRow = { id: string; label: string; startTime: string; durationMinutes: number };

function RunScheduleEditor({
  runs,
  editing,
  onChange,
}: {
  runs: RunRow[];
  editing: boolean;
  onChange: (next: RunRow[]) => void;
}) {
  function update(i: number, patch: Partial<RunRow>) {
    const next = runs.slice();
    next[i] = { ...next[i], ...patch };
    onChange(next);
  }
  function remove(i: number) {
    const next = runs.slice();
    next.splice(i, 1);
    onChange(next);
  }
  function add() {
    const id = `r-${Math.random().toString(36).slice(2, 8)}`;
    const labelN = runs.length + 1;
    onChange([
      ...runs,
      { id, label: `R${labelN}`, startTime: '08:00', durationMinutes: 90 },
    ]);
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {runs.length === 0 ? (
        <span style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>
          No runs scheduled yet.
        </span>
      ) : (
        runs.map((r, i) => (
          <div
            key={r.id}
            style={{
              display: 'grid',
              gridTemplateColumns: 'minmax(70px, 90px) auto auto auto auto',
              gap: 8,
              alignItems: 'center',
              padding: '8px 10px',
              background: '#ffffff',
              border: '1px solid var(--color-border-subtle)',
              borderRadius: 8,
            }}
          >
            <input
              type="text"
              value={r.label}
              disabled={!editing}
              onChange={e => update(i, { label: e.target.value })}
              style={{
                padding: '7px 9px',
                borderRadius: 6,
                border: '1px solid var(--color-border)',
                fontSize: 12,
                fontWeight: 700,
                fontFamily: 'var(--font-primary)',
                color: 'var(--color-text-primary)',
                background: editing ? '#ffffff' : 'var(--color-bg-hover)',
                width: 80,
              }}
            />
            <TimeInput
              value={r.startTime}
              disabled={!editing}
              onChange={v => update(i, { startTime: v })}
            />
            <span style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>for</span>
            <QtyStepper
              size="emphasized"
              disabled={!editing}
              canDecrement={r.durationMinutes > 15}
              onDecrement={() =>
                update(i, { durationMinutes: Math.max(15, r.durationMinutes - 15) })
              }
              onIncrement={() => update(i, { durationMinutes: r.durationMinutes + 15 })}
              decrementLabel="Shorter run"
              incrementLabel="Longer run"
            >
              <span style={getStepperValueStyle('emphasized')}>{r.durationMinutes}m</span>
            </QtyStepper>
            <button
              type="button"
              disabled={!editing}
              onClick={() => remove(i)}
              title="Remove run"
              aria-label="Remove run"
              style={{
                width: 32,
                height: 32,
                borderRadius: 6,
                border: '1px solid var(--color-border)',
                background: '#ffffff',
                color: 'var(--color-text-secondary)',
                cursor: editing ? 'pointer' : 'not-allowed',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                opacity: editing ? 1 : 0.5,
              }}
            >
              <Trash2 size={13} />
            </button>
          </div>
        ))
      )}
      {editing && (
        <button
          type="button"
          onClick={add}
          style={{
            padding: '7px 12px',
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
          }}
        >
          <Plus size={11} /> Add run
        </button>
      )}
    </div>
  );
}

// Local re-export of the BenchOverlay shape so we don't need to import
// the long path inside the same module twice.
type BenchOverlay = {
  name?: string;
  capabilities?: BenchCapability[];
  online?: boolean;
  primaryMode?: ProductionMode;
  batchRules?: { min: number; max: number; multipleOf: number };
  runs?: Array<{ id: string; label: string; startTime: string; durationMinutes: number }>;
};

// Make the underlying bench id type available to consumers without
// re-exporting from fixtures (kept local to avoid cycles).
export type { BenchId };
