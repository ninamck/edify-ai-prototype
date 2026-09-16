'use client';

/**
 * Site setup · step 8 — check and go live.
 *
 * The read-back before the one confirm: names shops and numbers, not
 * config. Runs the completeness check (PRD 4.13) and shows the result
 * inline.
 *
 * Go-live is not opening day. Natalia (Pret): the team needs access at
 * least a day before opening to set production, and a couple of days
 * before that to place first orders. So each shop shows its ShopDB
 * opening date and a separate "Live from" date in Edify, defaulted by
 * a batch-wide rule ("live N days before opening") and editable per
 * shop. Nothing shows on a shop's planner before its live date.
 *
 * Suppliers and ingredients are not a review step (Chel, Pret): if the
 * shop has the recipes it has the ingredients. The check confirms it
 * and moves on. Forecast Manager SKUs are checked against each shop's
 * tier; a mismatch is flagged to admins and never blocks go-live.
 */

import { useState } from 'react';
import { AlertTriangle, CheckCircle2, Rocket } from 'lucide-react';
import CardShell from './CardShell';
import type { CardState } from './CardShell';
import { Stepper } from './timeControls';
import {
  DEFAULT_GO_LIVE_OFFSET_DAYS,
  SHOPDB_SOURCE,
  addDays,
  coreRecipeCount,
  describeFood,
  describeFullSelectionCounts,
  describeRoleCounts,
  describeMenuPattern,
  describeRanges,
  describeTierSchedule,
  daysBetween,
  forecastMismatches,
  formatDay,
  getHub,
  type RangeByDay,
  getTemplateShop,
  getNewSite,
  hubLinkSummary,
  roleCounts,
  type DayKey,
  type EdifyRole,
  type RecipeExclusions,
  type SiteBenchesHot,
  type SiteDetails,
  type SiteProductionSchedules,
  type TierSchedules,
} from '../siteSetupFixtures';

export type GoLiveDates = Record<string, string>;

interface SiteSetupGoLiveCardProps {
  state: CardState;
  siteIds: string[];
  templates: Record<string, string>;
  /** Per site: a hub id, or STANDALONE for no hub. */
  hubs: Record<string, string>;
  roles: Record<string, EdifyRole>;
  ranges: Record<string, RangeByDay>;
  tiers: Record<string, Record<DayKey, number>>;
  tierSchedules?: TierSchedules;
  production?: SiteProductionSchedules;
  benches?: Record<string, number>;
  benchesHot?: SiteBenchesHot;
  /** Per site: flexible-line recipe ids unticked. */
  recipeExclusions?: RecipeExclusions;
  /** Create-site details as synced from ShopDB and edited in step 1. */
  sites?: Record<string, SiteDetails>;
  initialDates?: GoLiveDates;
  initialOffsetDays?: number;
  onConfirm: (input: { goLiveDates: GoLiveDates; goLiveOffsetDays: number }) => void;
  onCancel: () => void;
}

export default function SiteSetupGoLiveCard({
  state,
  siteIds,
  templates,
  hubs,
  roles,
  ranges,
  tiers,
  tierSchedules,
  production,
  benches,
  benchesHot,
  recipeExclusions,
  sites,
  initialDates,
  initialOffsetDays,
  onConfirm,
  onCancel,
}: SiteSetupGoLiveCardProps) {
  const openingFor = (siteId: string): string =>
    sites?.[siteId]?.openingDate?.trim() || getNewSite(siteId)?.openingDate || '';

  const [offsetDays, setOffsetDays] = useState<number>(initialOffsetDays ?? DEFAULT_GO_LIVE_OFFSET_DAYS);
  const [dates, setDates] = useState<GoLiveDates>(() => {
    const map: GoLiveDates = {};
    for (const id of siteIds) {
      map[id] = initialDates?.[id] ?? addDays(openingFor(id), -(initialOffsetDays ?? DEFAULT_GO_LIVE_OFFSET_DAYS));
    }
    return map;
  });

  /** The rule re-applies to every shop; per-shop edits after that win. */
  function applyOffset(next: number) {
    setOffsetDays(next);
    setDates(() => {
      const map: GoLiveDates = {};
      for (const id of siteIds) map[id] = addDays(openingFor(id), -next);
      return map;
    });
  }

  const disabled = state !== 'pending';
  const totalPeople = siteIds.reduce((n, id) => n + (getNewSite(id)?.roster.length ?? 0), 0);
  const totalRecipes = siteIds.reduce((n, id) => {
    const pattern = tiers[id];
    return pattern ? n + coreRecipeCount(ranges[id], pattern) - (recipeExclusions?.[id]?.length ?? 0) : n;
  }, 0);
  const n = siteIds.length;

  // Shops whose live date isn't before opening: the team would have no
  // time to set production or order. Warn, don't block.
  const lateShops = siteIds.filter((id) => daysBetween(dates[id], openingFor(id)) < 1);
  // Forecast Manager SKUs outside the tier, per shop.
  const mismatches = siteIds
    .map((id) => ({ id, skus: tiers[id] ? forecastMismatches(id, tiers[id]) : [] }))
    .filter((m) => m.skus.length > 0);
  const hotChefCount = siteIds.filter((id) => benchesHot?.[id]?.stations.some((s) => /hot chef/i.test(s.name))).length;

  return (
    <CardShell
      icon={Rocket}
      title="Check and go live"
      subtitle={`${n} site${n === 1 ? '' : 's'} · ${totalRecipes} recipes · ${totalPeople} people · nothing shows on a planner before its live date`}
      state={state}
      confirmLabel={`Set up ${n} site${n === 1 ? '' : 's'}`}
      warning={
        lateShops.length > 0
          ? `${getNewSite(lateShops[0])?.shortName ?? 'One shop'} goes live on or after its opening day. The team won\u2019t have time to set production or order.`
          : undefined
      }
      onCancel={onCancel}
      onConfirm={() => onConfirm({ goLiveDates: dates, goLiveOffsetDays: offsetDays })}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {/* Go-live rule, applied to every shop */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            flexWrap: 'wrap',
            padding: '9px 11px',
            borderRadius: '10px',
            border: '1px solid var(--color-border-subtle, rgba(0,28,53,0.08))',
            background: '#fff',
          }}
        >
          <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--color-text-primary)' }}>Live in Edify</span>
          <Stepper value={offsetDays} min={0} max={30} disabled={disabled} onChange={applyOffset} />
          <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--color-text-primary)' }}>
            day{offsetDays === 1 ? '' : 's'} before opening
          </span>
          <span style={{ fontSize: '11px', color: 'var(--color-text-muted)', flex: 1, minWidth: '160px' }}>
            Time to set production and place first orders. Change any shop&rsquo;s date below.
          </span>
        </div>

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
          <CheckLine ok text={`Shop details for all ${n} synced from ${SHOPDB_SOURCE}, required fields complete`} />
          <CheckLine ok text={`${totalPeople} people matched in Workday · access through Okta single sign-on, invites a week before each live date`} />
          <CheckLine ok text={`Ingredients and suppliers for every tier recipe available to each shop${hubs && Object.values(hubs).some((h) => h && h !== 'STANDALONE') ? ', hub links copied' : ''}`} />
          <CheckLine
            ok
            text={`Every tier recipe visible on all production runs${hotChefCount > 0 ? ` · Hot Chef recipes on the Hot Chef station` : ''}`}
          />
          {mismatches.length === 0 ? (
            <CheckLine ok text={`Forecast Manager SKUs checked against each shop\u2019s tier · no mismatches`} />
          ) : (
            mismatches.map((m) => (
              <CheckLine
                key={m.id}
                ok={false}
                amber
                text={`Forecast Manager sends ${m.skus.length} SKU${m.skus.length === 1 ? '' : 's'} to ${getNewSite(m.id)?.shortName ?? m.id} that ${m.skus.length === 1 ? 'isn\u2019t' : 'aren\u2019t'} in ${describeRanges(ranges[m.id])} Tier ${Math.max(...Object.values(tiers[m.id]))}: ${m.skus.join(', ')}. Admins alerted to fix the forecast or the tier. Doesn\u2019t block go-live.`}
              />
            ))
          )}
        </div>

        {/* Per-site read-back */}
        {siteIds.map((siteId) => {
          const site = getNewSite(siteId);
          if (!site) return null;
          const template = getTemplateShop(templates[siteId]);
          const hubName = getHub(hubs[siteId])?.name;
          const siteRanges = ranges[siteId];
          const pattern = tiers[siteId];
          const counts = roleCounts(site.roster, roles);
          const hot = benchesHot?.[siteId];
          const opening = openingFor(siteId);
          const gap = daysBetween(dates[siteId], opening);
          const schedules = tierSchedules?.[siteId] ?? [];
          const name = sites?.[siteId]?.name?.trim() || site.shortName;
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
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ display: 'block', fontSize: '13px', fontWeight: 700, color: 'var(--color-text-primary)' }}>
                    {name === site.shortName ? site.shortName : name}
                  </span>
                  <span style={{ display: 'block', fontSize: '11px', color: 'var(--color-text-muted)', marginTop: '1px' }}>
                    Opens {formatDay(opening)} ({SHOPDB_SOURCE}) · live {gap > 0 ? `${gap} day${gap === 1 ? '' : 's'} before` : gap === 0 ? 'on opening day' : `${-gap} day${gap === -1 ? '' : 's'} after opening`}
                  </span>
                </span>
                <label style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: gap < 1 ? '#7A3800' : 'var(--color-text-secondary)', fontWeight: 600 }}>
                  Live from
                  <input
                    type="date"
                    disabled={disabled}
                    value={dates[siteId]}
                    max={opening || undefined}
                    onChange={(e) => setDates((prev) => ({ ...prev, [siteId]: e.target.value }))}
                    style={{
                      padding: '4px 8px',
                      borderRadius: '8px',
                      border: gap < 1
                        ? '1.5px solid #B45309'
                        : '1.5px solid var(--color-border, rgba(0,28,53,0.18))',
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
              <ReadbackLine label="People" value={`${site.roster.length} · ${describeRoleCounts(counts)} · Okta invites ${formatDay(addDays(dates[siteId], -7))}`} />
              {siteRanges && pattern && (
                <ReadbackLine
                  label="Food"
                  value={[
                    describeMenuPattern(siteRanges, pattern),
                    describeFood(siteRanges, pattern, recipeExclusions?.[siteId]),
                    ...schedules.map((s) => describeTierSchedule(s)),
                  ].join(' · ')}
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
                  value={`${hot.stations.map((s) => s.name).join(' + ')} · ${describeFullSelectionCounts(hot.byDay)} · planner from ${hot.byDay.Mon.plannerWindow.start} weekdays, ${hot.byDay.Sat.plannerWindow.start} weekends`}
                />
              )}
            </div>
          );
        })}
      </div>
    </CardShell>
  );
}

function CheckLine({ ok, amber, text }: { ok: boolean; amber?: boolean; text: string }) {
  const warn = !ok;
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '7px' }}>
      {ok ? (
        <CheckCircle2 size={13} color="#2D6A4F" style={{ flexShrink: 0, marginTop: '1px' }} />
      ) : (
        <AlertTriangle size={13} color={amber ? '#B45309' : '#B42318'} style={{ flexShrink: 0, marginTop: '1px' }} />
      )}
      <span style={{ fontSize: '11.5px', color: warn ? '#7A3800' : 'var(--color-text-secondary)', lineHeight: 1.45 }}>
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
