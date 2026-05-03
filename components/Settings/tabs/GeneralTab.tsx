'use client';

/**
 * GeneralTab — site core. Name, format, hub link, opening hours,
 * sales factor.
 *
 * The hub link picker only shows for SPOKE / HYBRID / linked-STANDALONE
 * sites; HUBs render a read-only "Acts as the hub for N sites" badge.
 * Sales factor only matters for hub-linked sites — hidden for true HUBs.
 */

import QtyStepper, { getStepperValueStyle } from '@/components/Production/QtyStepper';
import {
  PRET_FORMATS,
  PRET_SITES,
  type FormatId,
  type SiteId,
} from '@/components/Production/fixtures';
import { useSiteSettings } from '../siteSettingsStore';
import {
  FieldRow,
  HealthAlertStrip,
  PillPicker,
  ReadOnlyValue,
  Section,
  TextInput,
  TimeInput,
  type TabProps,
} from './_shared';

export default function GeneralTab({ siteId, editing, staged, onStage, health }: TabProps) {
  const { effective } = useSiteSettings(siteId);
  const core = effective.core;
  const stagedCore = staged.core ?? {};

  const isHub = core.type === 'HUB';
  const hubOptions = PRET_SITES.filter(s => s.type === 'HUB').map(s => ({
    id: s.id,
    label: s.name,
  }));

  // Resolve the candidate values: staged → persisted overlay → fixture default
  const name = stagedCore.name ?? core.name;
  const formatId = stagedCore.formatId ?? core.formatId;
  const hubId = stagedCore.hubId === undefined ? core.hubId : stagedCore.hubId;
  const open = stagedCore.openingHours?.open ?? core.openingHours.open;
  const close = stagedCore.openingHours?.close ?? core.openingHours.close;
  const salesFactor = stagedCore.salesFactor ?? core.salesFactor;

  // Validation
  const openInvalid =
    open && close && close <= open
      ? `Close (${close}) must be after open (${open}). Did you mean ${suggestCloseTime(open)}?`
      : null;

  function setCore(patch: Partial<typeof stagedCore>) {
    onStage({ core: patch });
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, maxWidth: 880 }}>
      <HealthAlertStrip items={health} />

      <Section title="Site identity" description="The name shown across the app, plus where this site sits in the estate.">
        <FieldRow
          label="Site name"
          control={
            <TextInput
              value={name}
              disabled={!editing}
              onChange={v => setCore({ name: v })}
            />
          }
          fullWidthControl
          cascade={
            stagedCore.name === undefined && core.name === core.defaults.name
              ? `Default · ${core.defaults.name}`
              : undefined
          }
          isOverridden={
            (stagedCore.name !== undefined && stagedCore.name !== core.defaults.name) ||
            core.name !== core.defaults.name
          }
          onReset={() => setCore({ name: core.defaults.name })}
        />

        <FieldRow
          label="Site type"
          hint="Type is structural — change it via Quinn rather than a single-field edit."
          control={
            <ReadOnlyValue
              value={core.type}
              hint={
                isHub
                  ? `Acts as the hub for ${
                      PRET_SITES.filter(s => s.hubId === siteId).length
                    } site(s)`
                  : core.hubId
                  ? `Hub-linked · receives from ${core.hubId.replace(/-/g, ' ')}`
                  : 'Self-producing'
              }
            />
          }
        />

        <FieldRow
          label="Format"
          hint="Determines the cascade defaults — opening hours, cutoffs, run profile."
          control={
            <PillPicker<FormatId>
              options={PRET_FORMATS.map(f => ({ id: f.id, label: f.name }))}
              value={formatId}
              onChange={v => setCore({ formatId: v })}
              disabled={!editing}
            />
          }
          cascade={`Format default · ${
            PRET_FORMATS.find(f => f.id === core.defaults.formatId)?.name ?? core.defaults.formatId
          }`}
          isOverridden={formatId !== core.defaults.formatId}
          onReset={() => setCore({ formatId: core.defaults.formatId })}
        />
      </Section>

      <Section title="Opening hours" description="Used by Quinn to schedule production windows and dispatch arrival times.">
        <FieldRow
          label="Open"
          control={
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <TimeInput
                value={open}
                disabled={!editing}
                onChange={v => setCore({ openingHours: { open: v, close } })}
              />
              <span style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>to</span>
              <TimeInput
                value={close}
                disabled={!editing}
                onChange={v => setCore({ openingHours: { open, close: v } })}
              />
            </div>
          }
          cascade={`Default · ${core.defaults.openingHours.open}–${core.defaults.openingHours.close}`}
          isOverridden={
            open !== core.defaults.openingHours.open ||
            close !== core.defaults.openingHours.close
          }
          onReset={() =>
            setCore({
              openingHours: {
                open: core.defaults.openingHours.open,
                close: core.defaults.openingHours.close,
              },
            })
          }
        />
        {openInvalid && (
          <div
            style={{
              padding: '8px 12px',
              borderRadius: 8,
              background: 'var(--color-error-light)',
              border: '1px solid var(--color-error-border)',
              color: 'var(--color-error)',
              fontSize: 11,
              fontWeight: 700,
            }}
          >
            {openInvalid}
          </div>
        )}
      </Section>

      {!isHub && (
        <Section
          title="Hub link"
          description={
            core.type === 'SPOKE'
              ? 'Spokes always order from one hub. Switching here re-points future orders only.'
              : core.type === 'HYBRID'
              ? 'Hybrid sites bake some items themselves and pull the rest from the hub.'
              : 'Standalone sites can optionally be linked to a hub for shared production (PAC139).'
          }
        >
          <FieldRow
            label="Ordering from"
            control={
              <PillPicker<SiteId>
                options={[
                  { id: '__none' as SiteId, label: 'None — self-producing' },
                  ...hubOptions,
                ]}
                value={(hubId ?? '__none') as SiteId}
                onChange={v => setCore({ hubId: v === '__none' ? null : v })}
                disabled={!editing || core.type === 'SPOKE' || core.type === 'HYBRID'}
              />
            }
            cascade={
              core.defaults.hubId
                ? `Default · ${core.defaults.hubId.replace(/-/g, ' ')}`
                : 'Default · self-producing'
            }
            isOverridden={hubId !== core.defaults.hubId}
            onReset={() => setCore({ hubId: core.defaults.hubId })}
          />

          {hubId && (
            <FieldRow
              label="Sales factor"
              hint="Demand share relative to the hub. Quinn uses this to derive a per-site forecast when none is set explicitly."
              control={
                <QtyStepper
                  size="emphasized"
                  disabled={!editing}
                  onIncrement={() =>
                    setCore({
                      salesFactor: Math.min(2, round2(salesFactor + 0.05)),
                    })
                  }
                  onDecrement={() =>
                    setCore({
                      salesFactor: Math.max(0.05, round2(salesFactor - 0.05)),
                    })
                  }
                  decrementLabel="Lower factor"
                  incrementLabel="Raise factor"
                >
                  <span style={getStepperValueStyle('emphasized')}>{salesFactor.toFixed(2)}</span>
                </QtyStepper>
              }
              cascade={`Default · ${core.defaults.salesFactor.toFixed(2)}`}
              isOverridden={round2(salesFactor) !== round2(core.defaults.salesFactor)}
              onReset={() => setCore({ salesFactor: core.defaults.salesFactor })}
            />
          )}
        </Section>
      )}

      {isHub && (
        <Section
          title="Hub coverage"
          description="The sites this hub bakes for. Manage links from each spoke's Hub link field."
        >
          <div
            style={{
              display: 'flex',
              gap: 6,
              flexWrap: 'wrap',
            }}
          >
            {PRET_SITES.filter(s => s.hubId === siteId).length === 0 ? (
              <span style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>
                No spokes linked yet. Add a hub link from a spoke site to wire it in.
              </span>
            ) : (
              PRET_SITES.filter(s => s.hubId === siteId).map(s => (
                <span
                  key={s.id}
                  style={{
                    padding: '6px 10px',
                    borderRadius: 999,
                    background: 'var(--color-bg-hover)',
                    border: '1px solid var(--color-border-subtle)',
                    fontSize: 11,
                    fontWeight: 700,
                    color: 'var(--color-text-primary)',
                  }}
                >
                  {s.name}
                </span>
              ))
            )}
          </div>
        </Section>
      )}
    </div>
  );
}

function suggestCloseTime(open: string): string {
  // Bump open by 12h, capped at 23:59 — a sensible "did you mean".
  const [h, m] = open.split(':').map(n => parseInt(n, 10));
  if (Number.isNaN(h) || Number.isNaN(m)) return '22:00';
  const totalMin = h * 60 + m + 12 * 60;
  const cappedMin = Math.min(totalMin, 23 * 60 + 59);
  const hh = String(Math.floor(cappedMin / 60)).padStart(2, '0');
  const mm = String(cappedMin % 60).padStart(2, '0');
  return `${hh}:${mm}`;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
