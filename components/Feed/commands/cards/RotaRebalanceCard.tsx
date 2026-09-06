'use client';

/**
 * Rota rebalance workspace card.
 *
 * Reads the site's draft from the workforce tool, runs the pure engine
 * against the workload Edify knows about, and lays the result out in
 * the order the GM decides:
 *   the verdict, one sentence
 *   tiles (hours, labour %, peak cover gaps, rules)
 *   the week: by day, as a rota, or by station
 *   rule fixes, applied, as tiles
 *   the tickable changes, as tiles, with hours and pounds
 *   the rules in one line
 *   Write to the draft, Re-check, Let agent plan rota, Discard
 *
 * "Let agent plan rota" is the second mode. The agent sets the GM's
 * shifts aside and builds the week from the forecast and the team. The
 * card then shows the plan as a rota with the differences drawn on, and
 * one confirm writes it. Agent drafts, operator decides.
 *
 * Every tick and untick re-runs the tiles, the strip and the rules, so
 * the GM sees the cost of each line before writing anything. Edify
 * writes the draft. The workforce tool still publishes and notifies.
 */

import { useMemo, useState } from 'react';
import { CalendarClock } from 'lucide-react';
import CardShell, { type CardState } from './CardShell';
import { useActiveSite, ACTIVE_SITES } from '@/components/ActiveSite/ActiveSiteContext';
import { deputyDraftFor, sitesWithDrafts } from '@/components/Feed/commands/rota/deputy';
import { siteLabourFor } from '@/components/Feed/commands/rota/sources';
import { rebalance, planWeek, computeTiles, effectiveProposal, hhmm } from '@/components/Feed/commands/rota/engine';
import type { DayKey, PlanResult, Proposal, RuleResult, Shift, Tiles } from '@/components/Feed/commands/rota/types';
import RotaTiles, { StatsLine } from '@/components/Feed/commands/rota/ui/Tiles';
import WeekStrip from '@/components/Feed/commands/rota/ui/WeekStrip';
import CapacityNotes from '@/components/Feed/commands/rota/ui/CapacityNotes';
import RuleFixes from '@/components/Feed/commands/rota/ui/RuleFixes';
import ChangeList from '@/components/Feed/commands/rota/ui/ChangeList';
import RulesLine from '@/components/Feed/commands/rota/ui/RulesLine';
import { body, ghostButton, label, primaryButton, small, textButton } from '@/components/Feed/commands/rota/ui/tokens';

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
  /** True when the agent's plan was written whole, not ticked edits. */
  planned: boolean;
}

type Mode = 'rebalance' | 'plan';

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

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/** The first thing the GM reads: what is wrong with the draft, in
 *  numbers. The tiles carry where the week lands. */
function verdictFor(breachesBefore: number, tiles: Tiles, proposals: number): string {
  if (proposals === 0) return 'The draft matches the workload and passes every rule. Nothing to write.';
  const problems: string[] = [];
  if (breachesBefore > 0) problems.push(plural(breachesBefore, 'rule breach', 'rule breaches'));
  if (tiles.peakGapsBefore > 0) problems.push(`${plural(tiles.peakGapsBefore, 'peak')} short of cover`);
  const first = problems.length > 0 ? `${problems.join(' and ')}.` : 'Rules pass, but hours sit where the work is not.';
  return `${first.charAt(0).toUpperCase()}${first.slice(1)} ${plural(proposals, 'change')} below.`;
}

function planVerdict(plan: PlanResult, tiles: Tiles, rules: RuleResult[]): string {
  const fails = rules.filter((r) => r.status === 'fail').length;
  const rulesText = fails > 0 ? plural(fails, 'rule breach', 'rule breaches') : 'all rules pass';
  const diff = plan.proposals.length;
  return `Planned from the forecast: ${tiles.scheduledHours}h, ${tiles.labourPct}% labour, ${rulesText}. ${diff === 0 ? 'Matches your draft.' : `${plural(diff, 'shift')} differ from your draft.`}`;
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
  const [mode, setMode] = useState<Mode>('rebalance');
  const [showDiff, setShowDiff] = useState(false);

  // recheckNonce is a deliberate input: a re-check pulls the draft again.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const draft = useMemo(() => (siteId ? deputyDraftFor(siteId) : undefined), [siteId, recheckNonce]);
  const site = useMemo(() => (siteId ? siteLabourFor(siteId) : undefined), [siteId]);
  const rebalanced = useMemo(() => (draft && site ? rebalance(draft, site, initialArgs.targetPct) : undefined), [draft, site, initialArgs.targetPct]);
  const plan = useMemo(() => (mode === 'plan' && draft && site ? planWeek(draft, site, initialArgs.targetPct) : undefined), [mode, draft, site, initialArgs.targetPct]);
  const result = mode === 'plan' ? plan : rebalanced;

  // Seeded once from the engine's defaults; a re-check keeps the GM's
  // ticks since the draft in the workforce tool has not changed.
  const [ticked, setTicked] = useState<Set<string>>(
    () => new Set((rebalanced?.proposals ?? []).filter((p) => p.defaultSelected).map((p) => p.id)),
  );

  // Alternatives the GM chose in place of the engine's pick, by proposal.
  const [chosen, setChosen] = useState<Map<string, string>>(() => new Map());

  // A plan is whole: every difference is in.
  const selected = useMemo(() => (mode === 'plan' ? new Set((plan?.proposals ?? []).map((p) => p.id)) : ticked), [mode, plan, ticked]);
  const computed = useMemo(() => (result ? computeTiles(result, selected, mode === 'plan' ? undefined : chosen) : undefined), [result, selected, chosen, mode]);
  const effProposals = useMemo(() => (result?.proposals ?? []).map((p) => (mode === 'plan' ? p : effectiveProposal(p, chosen))), [result, chosen, mode]);

  const disabled = state !== 'pending';
  const requestedName = initialArgs.siteName ?? ACTIVE_SITES.find((s) => s.id === initialArgs.siteId)?.name;

  if (!draft || !site || !result || !computed) {
    const withDrafts = sitesWithDrafts().filter((id) => ACTIVE_SITES.some((s) => s.id === id));
    return (
      <CardShell icon={CalendarClock} title="Rota rebalance" state={state} onCancel={disabled ? undefined : onCancel} cancelLabel="Close">
        <div style={{ fontSize: '12.5px', color: 'var(--color-text-primary)', lineHeight: 1.5 }}>
          {requestedName ? `No draft for ${requestedName} next week.` : 'No draft for this site next week.'} Ask the GM to start it, or check another site.
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
    setTicked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const choose = (proposalId: string, altId: string | null) => {
    if (disabled) return;
    setChosen((prev) => {
      const next = new Map(prev);
      if (altId) next.set(proposalId, altId);
      else next.delete(proposalId);
      return next;
    });
  };

  const accepted = effProposals.filter((p) => selected.has(p.id));
  const declined = effProposals.filter((p) => !selected.has(p.id));
  const fails = computed.rules.filter((r) => r.status === 'fail');
  const fixes = mode === 'plan' ? [] : result.proposals.filter((p) => p.tag === 'rule-fix');
  const changes = mode === 'plan' ? result.proposals : result.proposals.filter((p) => p.tag !== 'rule-fix');
  const verdict = plan ? planVerdict(plan, computed.tiles, computed.rules) : verdictFor(result.rulesBefore.filter((r) => r.status === 'fail').length, computed.tiles, result.proposals.length);

  // The checklist, once for the card and once beside the full-screen
  // grid, so a tick or a pill redraws the rota while the GM watches.
  const checklist = (inDialog: boolean) => (
    <>
      <RuleFixes
        fixes={fixes}
        selected={selected}
        chosen={chosen}
        onToggle={toggle}
        onChoose={choose}
        disabled={disabled}
        weekStart={draft.weekStart}
        onShowDay={inDialog ? undefined : (d) => setOpenDay(d)}
      />
      {mode === 'plan' && !showDiff && changes.length > 0 ? (
        // The grid above already draws every difference; the list is
        // there for the GM who wants to read them one by one.
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: '8px' }}>
          <span style={label}>What differs from your draft</span>
          <button type="button" aria-expanded={false} style={{ ...textButton, padding: '2px 0', textDecoration: 'underline dotted', textUnderlineOffset: '3px' }} onClick={() => setShowDiff(true)}>
            Show {plural(changes.length, 'shift')}
          </button>
        </div>
      ) : (
        <ChangeList
          proposals={changes}
          selected={selected}
          chosen={chosen}
          onToggle={toggle}
          onChoose={choose}
          disabled={disabled}
          weekStart={draft.weekStart}
          hourlyCostGBP={draft.hourlyCostGBP}
          onShowDay={inDialog ? undefined : (d) => setOpenDay(d)}
          readOnly={mode === 'plan'}
          title={mode === 'plan' ? 'What differs from your draft' : 'Changes'}
        />
      )}
    </>
  );

  const recheck = () => {
    setRecheckNonce((n) => n + 1);
    const now = new Date();
    setRecheckedAt(`${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`);
  };

  const subtitle =
    mode === 'plan'
      ? `Edify's plan, ${draft.weekLabel}. Your ${draft.tool} draft is untouched.`
      : `${draft.tool} draft, ${draft.weekLabel}. Synced ${draft.lastSynced}${recheckedAt ? `, re-checked ${recheckedAt}: no changes` : ''}.`;

  const confirm = () =>
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
      planned: mode === 'plan',
    });

  const writeBlocked = fails.length > 0 || accepted.length === 0;
  const writeTitle = fails.length > 0 ? 'Fix the rule breach first' : accepted.length === 0 ? (mode === 'plan' ? 'The plan matches your draft' : 'Tick at least one change') : undefined;

  return (
    <CardShell icon={CalendarClock} title={`${mode === 'plan' ? 'Rota plan' : 'Rota rebalance'}: ${draft.siteName}`} subtitle={subtitle} state={state}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <p role="status" style={{ ...body, fontSize: '13.5px', lineHeight: 1.5, margin: 0 }}>
          {verdict}
        </p>

        <RotaTiles tiles={computed.tiles} rules={computed.rules} />

        <WeekStrip
          key={mode}
          draft={draft}
          site={site}
          proposals={effProposals}
          selected={selected}
          analysis={computed.analysis}
          shifts={computed.shifts}
          openDay={openDay}
          onOpenDay={setOpenDay}
          initialMode={mode === 'plan' ? 'grid' : initialArgs.view === 'station' ? 'station' : initialArgs.view === 'grid' ? 'grid' : 'week'}
          fullScreenPanel={
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <StatsLine tiles={computed.tiles} rules={computed.rules} />
              {checklist(true)}
            </div>
          }
        />

        {plan && (plan.unfilled.length > 0 || plan.notes.length > 0) && (
          <section aria-label="Needs a hand" style={{ padding: '10px 12px', borderRadius: '10px', border: '1px solid var(--color-warning-border)', background: 'var(--color-warning-light)' }}>
            <div style={{ ...label, marginBottom: '4px' }}>Needs a hand</div>
            <ul style={{ margin: 0, padding: '0 0 0 16px', ...body, lineHeight: 1.5 }}>
              {plan.unfilled.map((u) => (
                <li key={`${u.day}-${u.start}`}>
                  {u.day} {hhmm(u.start)} to {hhmm(u.end)}: {plural(u.depth, 'head')} short, nobody available who passes the rules.
                </li>
              ))}
              {plan.notes.map((n) => (
                <li key={n}>{n}.</li>
              ))}
            </ul>
          </section>
        )}

        {checklist(false)}

        {result.proposals.length === 0 && mode === 'rebalance' && (
          <div style={{ padding: '10px 12px', borderRadius: '10px', border: '1px solid var(--color-border-subtle)', ...small, color: 'var(--color-text-primary)' }}>
            Nothing to change. Publish in {draft.tool} when you are ready.
          </div>
        )}

        <RulesLine rules={computed.rules} toolName={draft.tool} />

        <CapacityNotes notes={result.capacity} />

        <div style={{ ...small, lineHeight: 1.45 }}>Writes the draft only. Nobody is notified until you publish in {draft.tool}.</div>

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
              flexWrap: 'wrap',
            }}
          >
            <button type="button" style={{ ...textButton, marginRight: 'auto' }} onClick={onCancel}>
              Discard
            </button>
            {mode === 'plan' ? (
              <button type="button" style={ghostButton} onClick={() => setMode('rebalance')}>
                Back to your draft
              </button>
            ) : (
              <>
                <button type="button" style={ghostButton} onClick={recheck}>
                  Re-check
                </button>
                <button type="button" style={ghostButton} onClick={() => setMode('plan')}>
                  Let agent plan rota
                </button>
              </>
            )}
            <button
              type="button"
              style={{ ...primaryButton, opacity: writeBlocked ? 0.55 : 1, cursor: writeBlocked ? 'not-allowed' : 'pointer' }}
              disabled={writeBlocked}
              title={writeTitle}
              onClick={confirm}
            >
              {mode === 'plan' ? `Write plan to ${draft.tool} draft` : `Write ${plural(accepted.length, 'change')} to ${draft.tool}`}
            </button>
          </div>
        )}
      </div>
    </CardShell>
  );
}
