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
  EQUIPMENT_CAPACITY_UNIT,
  EQUIPMENT_LABELS,
  EQUIPMENT_ORDER,
  siteBrand,
  type Bench,
  type BenchCapability,
  type BenchId,
  type BenchKitItem,
  type Equipment,
  type ProductionMode,
} from '@/components/Production/fixtures';
import { FJ_WORK_ROLES, FJ_WORK_ROLE_BY_ID, isFjLine } from '@/components/Production/farmerj/fjFixtures';
import type { Section as WorkRole } from '@/components/Production/farmerj/recipes';
import { ALL_CHANNELS, CHANNEL_LABELS } from '@/components/Production/farmerj/lines';
import type { SalesChannel } from '@/components/Production/farmerj/salesDay';
import {
  KNOWN_BENCH_CAPABILITIES,
  KNOWN_PRIMARY_MODES,
  MAX_BENCHES,
  useSiteSettings,
  type BenchOverlay,
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
  const isFarmerJ = siteBrand(siteId) === 'farmerj';

  // The saved list, with the staged additions, removals and order on top.
  const byId = new Map<BenchId, EffectiveBench>(effective.benches.map(b => [b.id, b]));
  for (const [id, b] of Object.entries(staged.addedBenches ?? {})) byId.set(id, { ...b, hasOverride: true });
  const order = staged.benchOrder ?? effective.benches.map(b => b.id);
  const benches = order.map(id => byId.get(id)).filter(Boolean) as EffectiveBench[];

  // Farmer J splits its benches: lines plate for sales channels and are
  // capped at five; kitchen benches own the kit (ovens, rice cookers).
  const lines = isFarmerJ ? benches.filter(isFjLine) : benches;
  const kitchen = isFarmerJ ? benches.filter(b => !isFjLine(b)) : [];

  function addBench(kind: 'line' | 'kitchen') {
    if (kind === 'line' && lines.length >= MAX_BENCHES) return;
    const pool = kind === 'line' ? lines : kitchen;
    let n = pool.length + 1;
    const stem = kind === 'kitchen' ? `${siteId}-kitchen-` : `${siteId}-bench-`;
    while (byId.has(`${stem}${n}`)) n += 1;
    const id = `${stem}${n}`;
    const bench: Bench = kind === 'kitchen'
      ? {
        id, siteId, name: `Kitchen bench ${n}`,
        capabilities: ['prep'], workTypes: ['mise', 'portion'], equipment: ['prep-table'], kit: [],
        online: true, primaryMode: 'variable',
      }
      : {
        id, siteId, name: isFarmerJ ? `Line ${n}` : `Bench ${n}`,
        capabilities: ['assemble'], workTypes: ['assemble', 'portion'], equipment: ['prep-table'],
        online: true, primaryMode: 'variable', halfBatches: false, channels: isFarmerJ ? [] : undefined,
      };
    onStage({ benchOrder: [...order, id], addedBenches: { ...(staged.addedBenches ?? {}), [id]: bench } });
  }

  function removeBench(id: BenchId) {
    if (benches.length <= 1) return;
    const added = { ...(staged.addedBenches ?? {}) };
    delete added[id];
    onStage({ benchOrder: order.filter(x => x !== id), addedBenches: added });
  }

  const addButtonStyle: React.CSSProperties = {
    padding: '9px 14px', borderRadius: 8, background: '#ffffff', border: '1px dashed var(--color-border)',
    color: 'var(--color-info)', fontSize: 12, fontWeight: 700, fontFamily: 'var(--font-primary)', cursor: 'pointer',
    display: 'inline-flex', alignItems: 'center', gap: 6, width: 'fit-content',
  };

  const addButton = editing && lines.length < MAX_BENCHES && (
    <button type="button" onClick={() => addBench('line')} style={addButtonStyle}>
      <Plus size={12} /> {isFarmerJ ? 'Add a line' : 'Add a bench'}
    </button>
  );

  const addKitchenButton = editing && (
    <button type="button" onClick={() => addBench('kitchen')} style={addButtonStyle}>
      <Plus size={12} /> Add a kitchen bench
    </button>
  );

  if (benches.length === 0 && isFarmerJ) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, maxWidth: 880 }}>
        <HealthAlertStrip items={health} />
        <Section title="No lines at this shop">
          {addButton}
        </Section>
        <Section title="No kitchen benches at this shop">
          {addKitchenButton}
        </Section>
      </div>
    );
  }

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
        title={isFarmerJ ? 'Lines' : 'Benches'}
        description={
          isFarmerJ
            ? `${lines.length} of up to ${MAX_BENCHES} lines. Each line takes the sales channels that plate on it; a half-batch line plates small containers.`
            : `${benches.length} of up to ${MAX_BENCHES} bench${benches.length === 1 ? '' : 'es'} at this site. Tap a row to edit batch rules, kit and run schedule.`
        }
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {lines.map(bench => (
            <BenchCard
              key={bench.id}
              bench={bench}
              editing={editing}
              showChannels={isFarmerJ}
              canRemove={editing && benches.length > 1}
              onRemove={() => removeBench(bench.id)}
              stagedBench={staged.benches?.[bench.id]}
              onStage={patch => onStage({ benches: { [bench.id]: patch } })}
            />
          ))}
          {addButton}
        </div>
      </Section>

      {isFarmerJ && (
        <Section
          title="Kitchen"
          description="The benches that own the kit. How many ovens, rice cookers and food processors this shop has, and what each holds, sizes the cook loads on the sections board. Company defaults come from Setup; edit here when this shop differs."
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {kitchen.map(bench => (
              <BenchCard
                key={bench.id}
                bench={bench}
                editing={editing}
                showChannels={false}
                kitchen
                canRemove={editing && benches.length > 1}
                onRemove={() => removeBench(bench.id)}
                stagedBench={staged.benches?.[bench.id]}
                onStage={patch => onStage({ benches: { [bench.id]: patch } })}
              />
            ))}
            {addKitchenButton}
          </div>
        </Section>
      )}
    </div>
  );
}

// ─── Single bench card ───────────────────────────────────────────────────────

function BenchCard({
  bench,
  editing,
  showChannels,
  kitchen = false,
  canRemove,
  onRemove,
  stagedBench,
  onStage,
}: {
  bench: EffectiveBench;
  editing: boolean;
  showChannels: boolean;
  /** A Farmer J kitchen bench: leads with its kit, no half batches or channels. */
  kitchen?: boolean;
  canRemove: boolean;
  onRemove: () => void;
  stagedBench: BenchOverlay | undefined;
  onStage: (patch: BenchOverlay) => void;
}) {
  const [expanded, setExpanded] = useState(false);

  const name = stagedBench?.name ?? bench.name;
  const online = stagedBench?.online ?? bench.online;
  const halfBatches = stagedBench?.halfBatches ?? bench.halfBatches ?? false;
  const channels = (stagedBench?.channels ?? bench.channels ?? []) as SalesChannel[];
  const primaryMode = (stagedBench?.primaryMode ?? bench.primaryMode ?? 'variable') as ProductionMode;
  const capabilities = (stagedBench?.capabilities ?? bench.capabilities) as BenchCapability[];
  const batchRules = stagedBench?.batchRules ?? bench.batchRules;
  const runs = stagedBench?.runs ?? bench.runs ?? [];
  const kit = stagedBench?.kit ?? bench.kit ?? [];
  const roles = ((stagedBench?.sections ?? bench.sections ?? []) as string[]).filter((r): r is WorkRole => r in FJ_WORK_ROLE_BY_ID);
  const kitSummary = kit.map(k => `${k.count} ${plural(k.count, EQUIPMENT_LABELS[k.equipment].toLowerCase())}${k.capacity && EQUIPMENT_CAPACITY_UNIT[k.equipment] ? ` of ${k.capacity} ${EQUIPMENT_CAPACITY_UNIT[k.equipment]}` : ''}`).join(' · ');

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
            {!kitchen && halfBatches && <StatusPill tone="neutral" label="Half batches" size="xs" />}
            {bench.hasOverride && <StatusPill tone="info" label="Edited" size="xs" />}
          </div>
          <div style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>
            {kitchen
              ? [roles.length ? roles.map(r => FJ_WORK_ROLE_BY_ID[r].label).join(' · ') : 'Takes no work', kitSummary || 'No kit counted yet'].join(' · ')
              : showChannels
                ? channels.length === 0 ? 'No sales channels plate here' : channels.map(c => CHANNEL_LABELS[c] ?? c).join(' · ')
                : capabilities.length === 0 ? 'No capabilities set' : capabilities.join(' · ')}
            {!kitchen && kit.length > 0 && ` · ${kitSummary}`}
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

          {/* Kit: what this bench owns, in quantities */}
          <Row
            label="Kit"
            hint="What this bench owns and how many. Ovens also take how many trays each holds. Cook loads are sized from these counts against the kit each recipe needs."
          >
            <KitEditor kit={kit} editing={editing} onChange={next => onStage({ kit: next })} />
          </Row>

          {/* Work roles (Farmer J): what lands on this bench, so it is a card on the Sections board */}
          {(kitchen || showChannels) && (
            <Row label="Work that lands here" hint="The planner's work by kind. A bench that takes any is a card on the Sections board under its name here. Two kinds on one bench merge them into one card; the company default is on Setup, Benches.">
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <PillMultiPicker<WorkRole>
                  options={FJ_WORK_ROLES.map(r => ({ id: r.id, label: r.label }))}
                  value={roles}
                  disabled={!editing}
                  onChange={next => onStage({ sections: next })}
                />
                <span style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>
                  {roles.length ? roles.map(r => FJ_WORK_ROLE_BY_ID[r].what).join(' ') : 'Not on the Sections board.'}
                </span>
              </div>
            </Row>
          )}

          {/* Half batches */}
          {!kitchen && (
            <Row
              label="Half batches"
              hint="On: this bench plates small containers and a recipe that allows halves rounds to halves here. The recipe must allow halves too."
            >
              <PillPicker
                options={[
                  { id: 'on', label: 'Half batches' },
                  { id: 'off', label: 'Full batches' },
                ]}
                value={halfBatches ? 'on' : 'off'}
                disabled={!editing}
                onChange={v => onStage({ halfBatches: v === 'on' })}
              />
            </Row>
          )}

          {/* Sales channels (Farmer J lines) */}
          {showChannels && (
            <Row label="Plates for" hint="Which sales channels land on this line. Every channel should plate on exactly one line.">
              <PillMultiPicker<SalesChannel>
                options={ALL_CHANNELS.map(c => ({ id: c, label: CHANNEL_LABELS[c] }))}
                value={channels}
                disabled={!editing}
                onChange={next => onStage({ channels: next })}
              />
            </Row>
          )}

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

          {canRemove && (
            <div>
              <button
                type="button"
                onClick={onRemove}
                style={{
                  padding: '7px 12px', borderRadius: 8, background: '#ffffff', border: '1px solid var(--color-border)',
                  color: 'var(--color-danger, #b42318)', fontSize: 11, fontWeight: 700, fontFamily: 'var(--font-primary)',
                  cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6,
                }}
              >
                <Trash2 size={12} /> {showChannels && !kitchen ? 'Remove line' : 'Remove bench'}
              </button>
            </div>
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

// ─── Kit editor ──────────────────────────────────────────────────────────────

function plural(n: number, noun: string): string {
  if (n === 1) return noun;
  return /(x|s|ch|sh)$/.test(noun) ? `${noun}es` : `${noun}s`;
}

/**
 * One row per piece of kit: what, how many, and for kit that holds
 * things (ovens hold trays) how many each. Shared by every brand; a Pret
 * bench can count its ovens the same way.
 */
export function KitEditor({
  kit,
  editing,
  onChange,
}: {
  kit: BenchKitItem[];
  editing: boolean;
  onChange: (next: BenchKitItem[]) => void;
}) {
  const used = new Set(kit.map(k => k.equipment));
  const available = EQUIPMENT_ORDER.filter(e => !used.has(e));

  function update(i: number, patch: Partial<BenchKitItem>) {
    const next = kit.slice();
    next[i] = { ...next[i], ...patch };
    onChange(next);
  }
  function remove(i: number) {
    const next = kit.slice();
    next.splice(i, 1);
    onChange(next);
  }
  function add(equipment: Equipment) {
    const capUnit = EQUIPMENT_CAPACITY_UNIT[equipment];
    onChange([...kit, { equipment, count: 1, ...(capUnit ? { capacity: 6 } : {}) }]);
  }

  const selectStyle: React.CSSProperties = {
    padding: '7px 9px', borderRadius: 6, border: '1px solid var(--color-border)', fontSize: 12, fontWeight: 600,
    fontFamily: 'var(--font-primary)', color: 'var(--color-text-primary)', background: editing ? '#ffffff' : 'var(--color-bg-hover)',
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {kit.length === 0 && (
        <span style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>No kit counted on this bench.</span>
      )}
      {kit.map((k, i) => {
        const capUnit = EQUIPMENT_CAPACITY_UNIT[k.equipment];
        return (
          <div
            key={k.equipment}
            style={{
              display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', padding: '8px 10px',
              background: '#ffffff', border: '1px solid var(--color-border-subtle)', borderRadius: 8,
            }}
          >
            <span style={{ fontSize: 12, fontWeight: 700, minWidth: 110 }}>{EQUIPMENT_LABELS[k.equipment]}</span>
            <QtyStepper
              size="emphasized"
              disabled={!editing}
              canDecrement={k.count > 1}
              onDecrement={() => update(i, { count: Math.max(1, k.count - 1) })}
              onIncrement={() => update(i, { count: k.count + 1 })}
              decrementLabel={`Fewer ${plural(2, EQUIPMENT_LABELS[k.equipment].toLowerCase())}`}
              incrementLabel={`More ${plural(2, EQUIPMENT_LABELS[k.equipment].toLowerCase())}`}
            >
              <span style={getStepperValueStyle('emphasized')}>{k.count}</span>
            </QtyStepper>
            {capUnit && (
              <>
                <span style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>each holds</span>
                <QtyStepper
                  size="emphasized"
                  disabled={!editing}
                  canDecrement={(k.capacity ?? 1) > 1}
                  onDecrement={() => update(i, { capacity: Math.max(1, (k.capacity ?? 1) - 1) })}
                  onIncrement={() => update(i, { capacity: (k.capacity ?? 1) + 1 })}
                  decrementLabel={`Fewer ${capUnit}`}
                  incrementLabel={`More ${capUnit}`}
                >
                  <span style={getStepperValueStyle('emphasized')}>{k.capacity ?? 1}</span>
                </QtyStepper>
                <span style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>{capUnit}</span>
              </>
            )}
            {editing && (
              <button
                type="button"
                onClick={() => remove(i)}
                title={`Remove ${EQUIPMENT_LABELS[k.equipment].toLowerCase()}`}
                aria-label={`Remove ${EQUIPMENT_LABELS[k.equipment].toLowerCase()}`}
                style={{
                  marginLeft: 'auto', width: 32, height: 32, borderRadius: 6, border: '1px solid var(--color-border)',
                  background: '#ffffff', color: 'var(--color-text-secondary)', cursor: 'pointer',
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                }}
              >
                <Trash2 size={13} />
              </button>
            )}
          </div>
        );
      })}
      {editing && available.length > 0 && (
        <select
          value=""
          onChange={e => { if (e.target.value) add(e.target.value as Equipment); }}
          aria-label="Add kit"
          style={{ ...selectStyle, width: 'fit-content' }}
        >
          <option value="">Add kit…</option>
          {available.map(e => <option key={e} value={e}>{EQUIPMENT_LABELS[e]}</option>)}
        </select>
      )}
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

// Make the underlying bench id type available to consumers without
// re-exporting from fixtures (kept local to avoid cycles).
export type { BenchId };
