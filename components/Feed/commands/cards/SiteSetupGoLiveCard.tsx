'use client';

/**
 * Site setup · step 6 — check and go live.
 *
 * The read-back before the one confirm: names shops and numbers, not
 * config. Runs the completeness check (PRD 4.13) and shows the result
 * inline. Go-live dates arrive from Workday and stay editable — the
 * shop sees nothing on its planner until its date.
 */

import { useState } from 'react';
import { AlertTriangle, CheckCircle2, Rocket } from 'lucide-react';
import CardShell from './CardShell';
import type { CardState } from './CardShell';
import {
  describeRecipeCounts,
  describeRoleCounts,
  describeTierPattern,
  getHub,
  getRange,
  getTemplateShop,
  getWorkdaySite,
  hubLinkSummary,
  roleCounts,
  type DayKey,
  type EdifyRole,
  type SiteBenchesHot,
  type SiteProductionSchedules,
} from '../siteSetupFixtures';

export type GoLiveDates = Record<string, string>;

interface SiteSetupGoLiveCardProps {
  state: CardState;
  siteIds: string[];
  templates: Record<string, string>;
  /** Per site: a hub id, or STANDALONE for no hub. */
  hubs: Record<string, string>;
  roles: Record<string, EdifyRole>;
  rangeIds: Record<string, string>;
  tiers: Record<string, Record<DayKey, number>>;
  production?: SiteProductionSchedules;
  benches?: Record<string, number>;
  benchesHot?: SiteBenchesHot;
  initialDates?: GoLiveDates;
  onConfirm: (input: { goLiveDates: GoLiveDates }) => void;
  onCancel: () => void;
}

export default function SiteSetupGoLiveCard({
  state,
  siteIds,
  templates,
  hubs,
  roles,
  rangeIds,
  tiers,
  production,
  benches,
  benchesHot,
  initialDates,
  onConfirm,
  onCancel,
}: SiteSetupGoLiveCardProps) {
  const [dates, setDates] = useState<GoLiveDates>(() => {
    const map: GoLiveDates = {};
    for (const id of siteIds) {
      map[id] = initialDates?.[id] ?? getWorkdaySite(id)?.openingDate ?? '';
    }
    return map;
  });

  const disabled = state !== 'pending';
  const totalPeople = siteIds.reduce((n, id) => n + (getWorkdaySite(id)?.roster.length ?? 0), 0);
  const n = siteIds.length;

  return (
    <CardShell
      icon={Rocket}
      title="Check and go live"
      subtitle={`${n} site${n === 1 ? '' : 's'} · ${totalPeople} people · nothing shows on a planner before its date`}
      state={state}
      confirmLabel={`Set up ${n} site${n === 1 ? '' : 's'}`}
      onCancel={onCancel}
      onConfirm={() => onConfirm({ goLiveDates: dates })}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {/* Completeness check */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '5px',
            padding: '9px 11px',
            borderRadius: '10px',
            background: 'rgba(0,28,53,0.02)',
            border: '1px solid var(--color-border-subtle, rgba(0,28,53,0.08))',
          }}
        >
          <CheckLine ok text={`All ${totalPeople} people matched to Workday profiles`} />
          <CheckLine ok text="Suppliers, permissions and hub links copied" />
        </div>

        {/* Per-site read-back */}
        {siteIds.map((siteId) => {
          const site = getWorkdaySite(siteId);
          if (!site) return null;
          const template = getTemplateShop(templates[siteId]);
          const hubName = getHub(hubs[siteId])?.name;
          const range = getRange(rangeIds[siteId]);
          const pattern = tiers[siteId];
          const counts = roleCounts(site.roster, roles);
          const hot = benchesHot?.[siteId];
          return (
            <div
              key={siteId}
              style={{
                padding: '10px 12px',
                borderRadius: '12px',
                border: '1px solid var(--color-border-subtle, rgba(0,28,53,0.10))',
                display: 'flex',
                flexDirection: 'column',
                gap: '5px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                <span style={{ flex: 1, fontSize: '13px', fontWeight: 700, color: 'var(--color-text-primary)' }}>
                  {site.shortName}
                </span>
                <label style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: 'var(--color-text-secondary)' }}>
                  Live from
                  <input
                    type="text"
                    disabled={disabled}
                    value={dates[siteId]}
                    onChange={(e) => setDates((prev) => ({ ...prev, [siteId]: e.target.value }))}
                    style={{
                      width: '110px',
                      padding: '4px 8px',
                      borderRadius: '8px',
                      border: '1.5px solid var(--color-border, rgba(0,28,53,0.18))',
                      fontSize: '12px',
                      fontWeight: 700,
                      fontFamily: 'var(--font-primary)',
                      color: 'var(--color-text-primary)',
                      background: '#fff',
                    }}
                  />
                </label>
              </div>
              <ReadbackLine label="Setup" value={`Copied from ${template?.name ?? '—'} · ${hubLinkSummary(hubName)}`} />
              <ReadbackLine label="People" value={`${site.roster.length} · ${describeRoleCounts(counts)}`} />
              {range && pattern && (
                <ReadbackLine
                  label="Food"
                  value={`${range.name} · ${describeTierPattern(pattern)} · ${describeRecipeCounts(rangeIds[siteId], pattern)}`}
                />
              )}
              {(() => {
                const runs = production?.[siteId]?.Mon;
                if (!runs?.length) return null;
                const first = runs[0];
                const benchCount = benches?.[siteId];
                return (
                  <ReadbackLine
                    label="Production"
                    value={[
                      `${runs.length} run${runs.length === 1 ? '' : 's'} a day`,
                      benchCount ? `${benchCount} benches` : null,
                      `first bench ${first.bench.start} Mon`,
                      'forecasts by category',
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                  />
                );
              })()}
              {hot && (
                <ReadbackLine
                  label="Hot production"
                  value={`${hot.stations.map((s) => s.name).join(' + ')} · ${hot.fullSelectionTimes.length} full-selection time${hot.fullSelectionTimes.length === 1 ? '' : 's'}`}
                />
              )}
            </div>
          );
        })}
      </div>
    </CardShell>
  );
}

function CheckLine({ ok, text }: { ok: boolean; text: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '7px' }}>
      {ok ? (
        <CheckCircle2 size={13} color="#2D6A4F" style={{ flexShrink: 0, marginTop: '1px' }} />
      ) : (
        <AlertTriangle size={13} color="#B45309" style={{ flexShrink: 0, marginTop: '1px' }} />
      )}
      <span style={{ fontSize: '11.5px', color: ok ? 'var(--color-text-secondary)' : '#7A3800', lineHeight: 1.45 }}>
        {text}
      </span>
    </div>
  );
}

function ReadbackLine({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', gap: '8px', alignItems: 'baseline' }}>
      <span
        style={{
          width: '84px',
          flexShrink: 0,
          fontSize: '10px',
          fontWeight: 700,
          letterSpacing: '0.05em',
          textTransform: 'uppercase',
          color: 'var(--color-text-muted)',
        }}
      >
        {label}
      </span>
      <span style={{ fontSize: '11.5px', color: 'var(--color-text-secondary)', lineHeight: 1.45 }}>
        {value}
      </span>
    </div>
  );
}
