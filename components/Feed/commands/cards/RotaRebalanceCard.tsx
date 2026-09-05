'use client';

/**
 * Rota rebalance workspace card.
 *
 * Reads the site's draft from the workforce tool (Deputy), runs the
 * pure engine against the workload Edify knows about, and lays the
 * result out in the order the GM decides:
 *   the verdict, one sentence
 *   tiles (hours, labour %, peak cover gaps, rules)
 *   the week in one row; click a day to see its shifts
 *   rule fixes, applied
 *   the tickable changes, grouped by day, with hours and pounds
 *   the rules in one line
 *   Write to Deputy draft, Re-check, Discard
 *
 * Every tick and untick re-runs the tiles, the strip and the rules, so
 * the GM sees the cost of each line before writing anything. Edify
 * writes the draft. Deputy still publishes and notifies staff.
 */

import { useMemo, useState } from 'react';
import { CalendarClock } from 'lucide-react';
import CardShell, { type CardState } from './CardShell';
import { useActiveSite, ACTIVE_SITES } from '@/components/ActiveSite/ActiveSiteContext';
import { deputyDraftFor, sitesWithDrafts } from '@/components/Feed/commands/rota/deputy';
import { siteLabourFor } from '@/components/Feed/commands/rota/sources';
import { rebalance, computeTiles } from '@/components/Feed/commands/rota/engine';
import type { DayKey, Proposal, RuleResult, Shift, Tiles } from '@/components/Feed/commands/rota/types';
import RotaTiles from '@/components/Feed/commands/rota/ui/Tiles';
import WeekStrip from '@/components/Feed/commands/rota/ui/WeekStrip';
import CapacityNotes from '@/components/Feed/commands/rota/ui/CapacityNotes';
import RuleFixes from '@/components/Feed/commands/rota/ui/RuleFixes';
import ChangeList from '@/components/Feed/commands/rota/ui/ChangeList';
import RulesLine from '@/components/Feed/commands/rota/ui/RulesLine';
import { body, ghostButton, primaryButton, small, textButton } from '@/components/Feed/commands/rota/ui/tokens';

export interface RotaRebalanceArgs {
  siteId?: string;
  siteName?: string;
  targetPct?: number;
  view?: 'area' | 'grid' | 'station';
}

export interface RotaRebalanceFinal {
  siteId: string;
  siteName: string;
  weekLabel: string;
  toolName: string;
  basedOnSync: string;
  accepted: Proposal[];
  declined: Proposal[];
  shifts: Shift[];
  tiles: Tiles;
  rules: RuleResult[];
}

/** Which site the card should read. The prompt's site wins; then the
 *  active site if it has a draft; then the one site with a draft in
 *  this build. Chagee data exists on main but its site does not, so
 *  the filter against ACTIVE_SITES keeps it inert here. */
export function resolveRotaSite(requested: string | undefined, activeSiteId: string): { siteId: string | null; fallback: boolean } {
  const known = new Set(ACTIVE_SITES.map((s) => s.id));
  const drafts = sitesWithDrafts().filter((id) => known.has(id));
  if (requested && drafts.includes(requested)) return { siteId: requested, fallback: false };
  if (drafts.includes(activeSiteId)) return { siteId: activeSiteId, fallback: false };
  return { siteId: drafts[0] ?? null, fallback: true };
}

/** The first thing the GM reads. What is wrong with the draft, in
 *  numbers, then where the week lands with the current ticks. Most
 *  weeks this should be one short sentence. */
function verdictFor(breachesBefore: number, tiles: Tiles, proposals: number, ticked: number): string {
  if (proposals === 0) return 'The draft matches the workload and passes every rule. Nothing to write.';
  const problems: string[] = [];
  if (breachesBefore > 0) problems.push(`${breachesBefore} rule breach${breachesBefore === 1 ? '' : 'es'}`);
  if (tiles.peakGapsBefore > 0) problems.push(`${tiles.peakGapsBefore} peak${tiles.peakGapsBefore === 1 ? '' : 's'} short of cover`);
  const first = problems.length > 0 ? `The draft has ${problems.join(' and ')}.` : 'The draft passes the rules but has hours where the work is not.';
  const landing = `${tiles.scheduledHours}h and ${tiles.labourPct}% labour against a ${tiles.targetPct}% target`;
  const second =
    ticked === 0
      ? `${proposals} change${proposals === 1 ? '' : 's'} below, none in, so the week stays at ${landing}.`
      : `${proposals} change${proposals === 1 ? '' : 's'} below. With ${ticked === proposals ? `all ${proposals}` : `${ticked} of the ${proposals}`} in, the week lands at ${landing}.`;
  return `${first} ${second}`;
}

export default function RotaRebalanceCard({
  initialArgs,
  state,
  onConfirm,
  onCancel,
  onSwitchSite,
}: {
  initialArgs: RotaRebalanceArgs;
  state: CardState;
  onConfirm: (final: RotaRebalanceFinal) => void;
  onCancel: () => void;
  /** Re-run the skill for a different site, when the asked-for site has
   *  no draft. */
  onSwitchSite?: (siteId: string) => void;
}) {
  const { activeSiteId } = useActiveSite();
  const { siteId } = resolveRotaSite(initialArgs.siteId, activeSiteId);
  const [recheckNonce, setRecheckNonce] = useState(0);
  const [recheckedAt, setRecheckedAt] = useState<string | null>(null);
  const [openDay, setOpenDay] = useState<DayKey | null>(null);

  // recheckNonce is a deliberate input: a re-check pulls the draft again.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const draft = useMemo(() => (siteId ? deputyDraftFor(siteId) : undefined), [siteId, recheckNonce]);
  const site = useMemo(() => (siteId ? siteLabourFor(siteId) : undefined), [siteId]);
  const result = useMemo(() => (draft && site ? rebalance(draft, site, initialArgs.targetPct) : undefined), [draft, site, initialArgs.targetPct]);

  // Seeded once from the engine's defaults; a re-check keeps the GM's
  // ticks since the draft in Deputy has not changed.
  const [selected, setSelected] = useState<Set<string>>(
    () => new Set((result?.proposals ?? []).filter((p) => p.defaultSelected).map((p) => p.id)),
  );

  const computed = useMemo(() => (result ? computeTiles(result, selected) : undefined), [result, selected]);

  const disabled = state !== 'pending';
  const requestedName = initialArgs.siteName ?? ACTIVE_SITES.find((s) => s.id === initialArgs.siteId)?.name;

  if (!draft || !site || !result || !computed) {
    const withDrafts = sitesWithDrafts().filter((id) => ACTIVE_SITES.some((s) => s.id === id));
    return (
      <CardShell icon={CalendarClock} title="Rota rebalance" state={state} onCancel={disabled ? undefined : onCancel} cancelLabel="Close">
        <div style={{ fontSize: '12.5px', color: 'var(--color-text-primary)', lineHeight: 1.5 }}>
          {requestedName ? `No Deputy draft for ${requestedName} next week.` : 'No Deputy draft for this site next week.'} Deputy shows the week as unpublished with no shifts. Ask the GM to start the draft, or check another site.
        </div>
        {withDrafts.length > 0 && onSwitchSite && !disabled && (
          <div style={{ display: 'flex', gap: '6px', marginTop: '10px', flexWrap: 'wrap' }}>
            {withDrafts.map((id) => (
              <button key={id} type="button" style={ghostButton} onClick={() => onSwitchSite(id)}>
                Check {ACTIVE_SITES.find((s) => s.id === id)?.name ?? id}
              </button>
            ))}
          </div>
        )}
      </CardShell>
    );
  }

  const toggle = (id: string) => {
    if (disabled) return;
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const accepted = result.proposals.filter((p) => selected.has(p.id));
  const declined = result.proposals.filter((p) => !selected.has(p.id));
  const fails = computed.rules.filter((r) => r.status === 'fail');
  const fixes = result.proposals.filter((p) => p.tag === 'rule-fix');
  const changes = result.proposals.filter((p) => p.tag !== 'rule-fix');
  const verdict = verdictFor(result.rulesBefore.filter((r) => r.status === 'fail').length, computed.tiles, result.proposals.length, accepted.length);

  const recheck = () => {
    setRecheckNonce((n) => n + 1);
    const now = new Date();
    setRecheckedAt(`${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`);
  };

  const subtitle = `${draft.tool} draft, ${draft.weekLabel}. Synced ${draft.lastSynced}${recheckedAt ? `, re-checked ${recheckedAt}: no changes in ${draft.tool}` : ''}.`;

  return (
    <CardShell icon={CalendarClock} title={`Rota rebalance: ${draft.siteName}`} subtitle={subtitle} state={state}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <p role="status" style={{ ...body, fontSize: '13.5px', lineHeight: 1.5, margin: 0 }}>
          {verdict}
        </p>

        <RotaTiles tiles={computed.tiles} rules={computed.rules} />

        <WeekStrip
          draft={draft}
          site={site}
          proposals={result.proposals}
          selected={selected}
          analysis={computed.analysis}
          shifts={computed.shifts}
          openDay={openDay}
          onOpenDay={setOpenDay}
          initialMode={initialArgs.view === 'station' ? 'station' : initialArgs.view === 'grid' ? 'grid' : 'week'}
        />

        <RuleFixes fixes={fixes} selected={selected} onToggle={toggle} disabled={disabled} weekStart={draft.weekStart} onShowDay={(d) => setOpenDay(d)} />

        <ChangeList
          proposals={changes}
          selected={selected}
          onToggle={toggle}
          disabled={disabled}
          weekStart={draft.weekStart}
          hourlyCostGBP={draft.hourlyCostGBP}
          onShowDay={(d) => setOpenDay(d)}
        />

        {result.proposals.length === 0 && (
          <div style={{ padding: '10px 12px', borderRadius: '10px', border: '1px solid var(--color-border-subtle)', ...small, color: 'var(--color-text-primary)' }}>
            Nothing to change. Publish in {draft.tool} when you are ready.
          </div>
        )}

        <RulesLine rules={computed.rules} toolName={draft.tool} />

        <CapacityNotes notes={result.capacity} />

        <div style={{ ...small, lineHeight: 1.45 }}>
          Edify writes the draft. {draft.tool} still publishes, notifies staff and runs payroll. Nobody is told until the GM publishes in {draft.tool}.
        </div>

        {state === 'pending' && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'flex-end',
              gap: '8px',
              margin: '0 -12px -12px',
              padding: '10px 12px',
              borderTop: '1px solid var(--color-border-subtle)',
              background: 'rgba(0,28,53,0.015)',
            }}
          >
            <button type="button" style={{ ...textButton, marginRight: 'auto' }} onClick={onCancel}>
              Discard
            </button>
            <button type="button" style={ghostButton} onClick={recheck}>
              Re-check against {draft.tool}
            </button>
            <button
              type="button"
              style={{ ...primaryButton, opacity: fails.length > 0 || accepted.length === 0 ? 0.55 : 1, cursor: fails.length > 0 || accepted.length === 0 ? 'not-allowed' : 'pointer' }}
              disabled={fails.length > 0 || accepted.length === 0}
              title={fails.length > 0 ? 'Fix the rule breach first' : accepted.length === 0 ? 'Tick at least one change' : undefined}
              onClick={() =>
                onConfirm({
                  siteId: draft.siteId,
                  siteName: draft.siteName,
                  weekLabel: draft.weekLabel,
                  toolName: draft.tool,
                  basedOnSync: draft.lastSynced,
                  accepted,
                  declined,
                  shifts: computed.shifts,
                  tiles: computed.tiles,
                  rules: computed.rules,
                })
              }
            >
              Write {accepted.length} change{accepted.length === 1 ? '' : 's'} to {draft.tool} draft
            </button>
          </div>
        )}
      </div>
    </CardShell>
  );
}
