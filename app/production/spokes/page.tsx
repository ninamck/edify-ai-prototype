'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Clock,
  FastForward,
  Lock,
  RotateCcw,
  Search,
  Send,
  Unlock,
  X,
} from 'lucide-react';
import EdifyMark from '@/components/EdifyMark/EdifyMark';
import StatusPill from '@/components/Production/StatusPill';
import QtyStepper from '@/components/Production/QtyStepper';
import { useRole, StaffLockBanner } from '@/components/Production/RoleContext';
import { useHubUnlocks } from '@/components/Production/hubUnlockStore';
import {
  useIngredientShortfallStore,
  type AppliedIngredientShortfall,
} from '@/components/Production/ingredientShortfallStore';
import {
  PRET_INGREDIENT_SHORTFALL_SEEDS,
  PRET_SITES,
  getRecipe,
  getSite,
  isHubLinked,
  spokeOrderForDate,
  submissionsForHub,
  productionItemsAt,
  primaryBenchForItem,
  dayOfWeek,
  dayOffset,
  DEMO_TODAY,
  type SiteId,
  type SkuId,
  type SpokeOrderSummary,
  type SpokeSubmission,
  type ProductionRecipe,
} from '@/components/Production/fixtures';
import { useDispatchTransfers } from '@/components/Production/dispatchStore';
import SpokeUnlockControl from '@/components/Production/SpokeUnlockControl';
import { useActiveSite } from '@/components/ActiveSite/ActiveSiteContext';
import { useSiteSettings } from '@/components/Settings/siteSettingsStore';
import { useProductionSite } from '@/components/Production/ProductionSiteContext';
import { productionSiteLabel } from '@/components/Production/productionSiteOptions';

// When the demo's active persona is a SPOKE, this page locks onto the
// matching fixture site and presents the persona names in the header
// (top-bar says "Fitzroy King's Cross" / "Fitzroy Espresso", so the
// page should too — even though the underlying fixtures are still
// keyed by `site-spoke-south` / `hub-central`).
const SPOKE_PERSONA_SITE_ID: SiteId = 'site-spoke-south';

type DisplayStatus = SpokeSubmission['status'] | 'derived';

/**
 * Per-day, per-spoke editor state. Keyed by `${spokeId}|${date}` so the
 * page can hold a few days in flight at once and switch between them
 * without losing edits.
 *
 * `lines` stores a per-slot array of units for every SKU (one entry per
 * P-slot in the hub's bake schedule). The total the spoke is committing
 * to is `sum(lines[skuId])` — splitting it lets the spoke express which
 * batch they want each chunk in (e.g. 12 croissants on P1, 6 on P2 for
 * the midday top-up), which mirrors the standalone Plan view exactly.
 */
type DayState = {
  lines: Record<SkuId, number[]>;
  status: DisplayStatus;
};

// 7-day window: yesterday + today + next 5 days. Spokes can plan a few
// days ahead and revise before each day's cutoff.
const DAY_RANGE = [-1, 0, 1, 2, 3, 4, 5];

// Cap the per-slot column count at 3 — the standalone Plan view uses
// the same cap, and the hub's bake schedule almost always lands at three
// runs (early / mid / late). Anything wider gets folded into the last
// column so the row stays readable.
const MAX_P_COLUMNS = 3;

/**
 * Sum a single SKU's per-slot units. Defensive against undefined entries
 * so it works during hydration.
 */
function sumSlots(arr: number[] | undefined): number {
  if (!arr) return 0;
  let n = 0;
  for (const v of arr) n += Math.max(0, v || 0);
  return n;
}

/**
 * Split a single quantity across `slotCount` slots using the forecast's
 * morning/midday/afternoon weights when available. Falls back to an even
 * split. The result always sums back to `total` (rounding error parked
 * on the last slot) so the spoke's per-slot totals reconcile with the
 * single-number ledger we hydrate from.
 */
function splitAcrossSlots(
  total: number,
  byPhase: { morning: number; midday: number; afternoon: number } | undefined,
  slotCount: number,
): number[] {
  if (slotCount <= 0) return [];
  if (slotCount === 1) return [Math.max(0, Math.round(total))];

  const weights: number[] =
    byPhase && (byPhase.morning + byPhase.midday + byPhase.afternoon) > 0
      ? phaseWeights(byPhase, slotCount)
      : Array.from({ length: slotCount }, () => 1 / slotCount);

  const out: number[] = [];
  let placed = 0;
  for (let i = 0; i < slotCount - 1; i++) {
    const v = Math.max(0, Math.round(total * weights[i]));
    out.push(v);
    placed += v;
  }
  out.push(Math.max(0, Math.round(total - placed)));
  return out;
}

/** Map AM/MID/PM phase weights onto 1–3 evenly-distributed slots. */
function phaseWeights(
  byPhase: { morning: number; midday: number; afternoon: number },
  slotCount: number,
): number[] {
  const sum = byPhase.morning + byPhase.midday + byPhase.afternoon || 1;
  const m = byPhase.morning / sum;
  const mid = byPhase.midday / sum;
  const pm = byPhase.afternoon / sum;
  if (slotCount === 2) return [m + mid * 0.5, pm + mid * 0.5];
  // 3 slots → 1:1 mapping with the three phases.
  return [m, mid, pm];
}

export default function SpokeSubmissionsPage() {
  const { can, user } = useRole();
  const canAdjust = can('spoke.adjust');
  const canSubmit = can('spoke.submit');
  const recordedBy = user?.name ?? 'Spoke manager';

  const { isSpoke } = useActiveSite();

  // Hub-linked receivers: regular spokes + dark-kitchen standalones (PAC139)
  // + hybrids. The page is now a generic "site → hub" order editor, not just
  // for SPOKE-typed sites.
  const spokes = useMemo(() => PRET_SITES.filter(isHubLinked), []);
  // Spoke selection is driven by the layout-level ProductionSiteSelector —
  // the spoke picker that used to live in this page body has been removed
  // so there's a single source of truth for "which site am I viewing".
  //  - Spoke persona: locked to their own fixture site (site-spoke-south)
  //  - Hub persona: whatever is selected in the top site picker. If the
  //    hub itself is selected (e.g. hub-central), this surface falls back
  //    to the first hub-linked site since you can't place a spoke order
  //    against the hub itself.
  const { siteId: pickerSiteId } = useProductionSite();
  const fallbackSpokeId: SiteId = spokes[0]?.id ?? 'site-spoke-south';
  const spokeId: SiteId = isSpoke
    ? SPOKE_PERSONA_SITE_ID
    : isHubLinked(getSite(pickerSiteId))
      ? pickerSiteId
      : fallbackSpokeId;
  const spoke = getSite(spokeId);
  const hubId = spoke?.hubId ?? 'hub-central';
  const hub = getSite(hubId);

  // Display names — always use the persona-mapped Fitzroy labels
  // (the same ones the layout-level site picker shows) so the page
  // header, captions, and prompts read consistently across every
  // spoke. Falls back to the raw fixture name only for sites we
  // haven't mapped (which shouldn't happen for any picker option).
  const spokeDisplayName = productionSiteLabel(spokeId) || spoke?.name || 'Spoke';
  const hubDisplayName = productionSiteLabel(hubId) || hub?.name || 'Hub';
  // Cutoff policy + cutoff time both flow through SiteSettingsStore so a
  // change made on /settings (or the production Settings sub-tab) shows
  // up here without a refresh. We resolve against the *hub*'s settings
  // because the cutoff is a hub-side knob in the data model.
  const hubSettings = useSiteSettings(hubId);
  const cutoffPolicy = hubSettings.effective.cutoffs.lockPolicy;
  const effectiveCutoffTime = hubSettings.effective.cutoffs.cutoffTime;

  const [date, setDate] = useState<string>(dayOffset(1));
  const [query, setQuery] = useState('');
  const [expanded, setExpanded] = useState<Set<SkuId>>(new Set());

  // Synthetic "now" — the demo defaults to 10:30 today and can be skipped
  // forward past a cutoff via the Demo button.
  const defaultNowISO = `${DEMO_TODAY}T10:30:00Z`;
  const [nowISO, setNowISO] = useState(defaultNowISO);

  // Per-day editor state, lazily populated from `spokeOrderForDate`.
  const [dayStates, setDayStates] = useState<Record<string, DayState>>({});

  function dayKey(s: SiteId, d: string) {
    return `${s}|${d}`;
  }

  // Build (and cache) the editor state for the active (spoke, date). If
  // we already have edits for this key we keep them; otherwise we hydrate
  // from the seeded submission / Quinn defaults.
  const order: SpokeOrderSummary = useMemo(() => {
    const base = spokeOrderForDate(spokeId, hubId, date);
    // Overlay the hub's effective cutoff time onto the order's
    // `cutoffDateTime`. The base value is `dayOffset(-1, forDate)` +
    // 15:00 UTC; we keep the date and swap in the configured HH:MM.
    const [h, m] = effectiveCutoffTime.split(':');
    const cutoffDay = dayOffset(-1, date); // day before forDate
    const overridden = `${cutoffDay}T${h ?? '15'}:${m ?? '00'}:00Z`;
    return { ...base, cutoffDateTime: overridden };
  }, [spokeId, hubId, date, effectiveCutoffTime]);
  // Per-slot column count — derived from the hub's run-mode benches so
  // the spoke ordering view matches whatever bake schedule the hub is
  // actually running. (Both the bakery and prep benches at hub-central
  // run three slots — N1/R1/R2 — which is why the standalone Plan view
  // also lands on three columns.)
  const pColumnCount = useMemo(() => {
    const items = productionItemsAt(hubId);
    let max = 1;
    for (const item of items) {
      if (item.mode !== 'run') continue;
      const bench = primaryBenchForItem(item);
      const runs = bench?.runs?.length ?? 0;
      if (runs > max) max = runs;
    }
    return Math.min(MAX_P_COLUMNS, max);
  }, [hubId]);

  const key = dayKey(spokeId, date);
  useEffect(() => {
    setDayStates(prev => {
      if (prev[key]) return prev;
      const lines: Record<SkuId, number[]> = {};
      for (const ln of order.lines) {
        // Hydrate each line's per-slot vector from the spoke's
        // confirmed total. We split using the forecast's AM/MID/PM
        // weights so the seeded breakdown reads as Quinn's "best
        // guess at when you'll need each batch".
        lines[ln.skuId] = splitAcrossSlots(
          ln.confirmed,
          ln.forecast?.byPhase,
          pColumnCount,
        );
      }
      return { ...prev, [key]: { lines, status: order.status } };
    });
  }, [key, order, pColumnCount]);

  const dayState = dayStates[key];

  // Auto-finalise effect: once cutoff has passed and the hub is on the
  // 'lock' policy, any still-draft day gets locked at Quinn's numbers.
  const cutoff = new Date(order.cutoffDateTime);
  const now = new Date(nowISO);
  const minutesToCutoff = Math.round((cutoff.getTime() - now.getTime()) / 60000);
  const past = minutesToCutoff < 0;
  useEffect(() => {
    if (!dayState) return;
    if (!past) return;
    if (cutoffPolicy !== 'lock') return;
    if (dayState.status !== 'draft' && dayState.status !== 'derived') return;
    setDayStates(prev => {
      const cur = prev[key];
      if (!cur) return prev;
      const lines = { ...cur.lines };
      // Snap any untouched derived lines back to their Quinn proposal so
      // the auto-locked total is exactly what the hub will plan against.
      for (const ln of order.lines) {
        if (lines[ln.skuId] === undefined) {
          lines[ln.skuId] = splitAcrossSlots(
            ln.quinnProposed,
            ln.forecast?.byPhase,
            pColumnCount,
          );
        }
      }
      return { ...prev, [key]: { lines, status: 'auto-finalised' } };
    });
  }, [past, cutoffPolicy, dayState, key, order.lines, pColumnCount]);

  // Submitted → acknowledged after a beat (mirrors the original demo).
  useEffect(() => {
    if (!dayState) return;
    if (dayState.status !== 'submitted') return;
    const t = setTimeout(() => {
      setDayStates(prev => ({ ...prev, [key]: { ...prev[key], status: 'acknowledged' } }));
    }, 1500);
    return () => clearTimeout(t);
  }, [dayState, key]);

  const status: DisplayStatus = dayState?.status ?? order.status;

  // PAC-unlock — when the hub manager has reopened this order past
  // cutoff, we treat it as editable again (regardless of the underlying
  // status) and surface the unlock context to the manager so they know
  // why the steppers came alive.
  const { isActive: isUnlockActive, get: getUnlock, markConsumed: markUnlockConsumed } =
    useHubUnlocks();
  const isUnlocked = isUnlockActive(hubId, spokeId, date);
  const unlockRecord = getUnlock(hubId, spokeId, date);
  /** Per-SKU floor for the additive stepper (only set when unlocked). */
  const unlockBaseline: Record<SkuId, number> | null = isUnlocked
    ? unlockRecord?.baselineBySku ?? null
    : null;

  const baseLocked =
    status === 'submitted' || status === 'acknowledged' || status === 'auto-finalised';
  const locked = baseLocked && !isUnlocked;
  const autoFinalised = status === 'auto-finalised' && !isUnlocked;

  // Ingredient-shortfall — when the hub manager has applied a
  // pro-rata cut from the recipe-first plan grid, the spoke needs to
  // see exactly which recipes lost units and by how much. We pull
  // the records from the store and filter to ones touching this
  // (spoke, hub, forDate). The Quinn nudge feed already mirrors the
  // headline; this banner adds line-level detail right above the
  // ledger so the spoke's eye lands on it before they open
  // individual rows.
  const { forSpoke: shortfallsForSpoke } = useIngredientShortfallStore();
  const spokeShortfallsToday = useMemo<AppliedIngredientShortfall[]>(() => {
    return shortfallsForSpoke(spokeId).filter(
      r => r.hubId === hubId && r.forDate === date,
    );
  }, [shortfallsForSpoke, spokeId, hubId, date]);

  // Hub-side unlock affordance — only relevant when the active persona is
  // the hub manager. The control needs the underlying SpokeSubmission
  // (not the SpokeOrderSummary used elsewhere on this page) so it can
  // seed the additive baseline. We also need to know whether a dispatch
  // transfer has already been sent — once dispatched, unlock is moot.
  const { transferFor } = useDispatchTransfers();
  const hubSubmission: SpokeSubmission | undefined = useMemo(
    () => submissionsForHub(hubId, date).find(s => s.fromSiteId === spokeId),
    [hubId, spokeId, date],
  );
  const hubHasTransfer = !!transferFor(hubId, spokeId, date);
  // The unlock affordance keys off the submission's *real* cutoff clock
  // rather than the page's synthetic `nowISO` — the demo's seeded
  // cutoffs sit in the wall-clock past, and the dispatch-matrix version
  // of this control did the same, so the button is visible immediately
  // for any submission in a locked state.
  const hubCutoffPassed = hubSubmission
    ? new Date(hubSubmission.cutoffDateTime).getTime() < Date.now()
    : false;

  /**
   * Set a single P-slot's units for a SKU. Other slots are preserved.
   * Honours the unlock-only-additions floor by computing the current
   * total against the unlocked baseline and refusing to dip below it.
   */
  function setSlotUnits(sku: SkuId, slotIdx: number, units: number) {
    const floor = unlockBaseline?.[sku] ?? 0;
    setDayStates(prev => {
      const cur = prev[key] ?? { lines: {}, status: order.status };
      const existing = cur.lines[sku] ?? Array.from({ length: pColumnCount }, () => 0);
      // Pad/trim to current pColumnCount so editing while the schedule
      // shape changes underneath us doesn't leave orphan slots.
      const next = Array.from({ length: pColumnCount }, (_, i) =>
        i === slotIdx ? Math.max(0, units) : Math.max(0, existing[i] ?? 0),
      );
      // Enforce additive-only floor against the SKU total. If the new
      // total dips below the locked baseline, snap the edited slot back
      // up so we never silently shrink the hub's commitment.
      const total = sumSlots(next);
      if (total < floor) {
        const diff = floor - total;
        next[slotIdx] = Math.max(0, next[slotIdx] + diff);
      }
      return {
        ...prev,
        [key]: {
          ...cur,
          lines: { ...cur.lines, [sku]: next },
          status: cur.status === 'derived' ? 'draft' : cur.status,
        },
      };
    });
  }

  function bumpSlot(sku: SkuId, slotIdx: number, delta: number) {
    if (!dayState) return;
    // Steppers move in single-unit increments — spokes order in real
    // units they expect to sell, not in the hub's bench batch sizes.
    // The hub-side bench batching is enforced when the order flows
    // into a bake run, not at the order surface.
    const current = dayState.lines[sku]?.[slotIdx] ?? 0;
    setSlotUnits(sku, slotIdx, current + delta);
  }

  /**
   * Reset a single SKU's per-slot vector to Quinn's proposal split
   * across slots — used by the row-level "Reset to Quinn" affordance.
   */
  function resetLineToQuinn(sku: SkuId) {
    const ln = order.lines.find(l => l.skuId === sku);
    if (!ln) return;
    const split = splitAcrossSlots(ln.quinnProposed, ln.forecast?.byPhase, pColumnCount);
    setDayStates(prev => {
      const cur = prev[key] ?? { lines: {}, status: order.status };
      return {
        ...prev,
        [key]: {
          ...cur,
          lines: { ...cur.lines, [sku]: split },
          status: cur.status === 'derived' ? 'draft' : cur.status,
        },
      };
    });
  }

  function resetToQuinn() {
    setDayStates(prev => {
      const lines: Record<SkuId, number[]> = {};
      for (const ln of order.lines) {
        lines[ln.skuId] = splitAcrossSlots(
          ln.quinnProposed,
          ln.forecast?.byPhase,
          pColumnCount,
        );
      }
      return { ...prev, [key]: { lines, status: 'draft' } };
    });
  }

  function submitDay() {
    // If we're closing out an unlock window, mark the unlock consumed
    // so the audit trail reflects the resubmit and the hub matrix can
    // re-show the Send affordance against the new totals.
    if (isUnlocked) markUnlockConsumed(hubId, spokeId, date);
    setDayStates(prev => ({ ...prev, [key]: { ...prev[key], status: 'submitted' } }));
  }

  function skipToCutoff() {
    setNowISO(new Date(cutoff.getTime() + 60_000).toISOString());
  }
  function rewindToOpen() {
    setNowISO(defaultNowISO);
    if (autoFinalised) {
      setDayStates(prev => ({ ...prev, [key]: { ...prev[key], status: 'draft' } }));
    }
  }

  function toggleExpand(sku: SkuId) {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(sku)) next.delete(sku);
      else next.add(sku);
      return next;
    });
  }

  // Build the rows for the current (spoke, date), filtered by query, and
  // grouped by category for the section headers.
  const viewLines = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = q
      ? order.lines.filter(l => l.recipe.name.toLowerCase().includes(q))
      : order.lines;
    return filtered;
  }, [order.lines, query]);

  const grouped = useMemo(() => {
    const map = new Map<ProductionRecipe['category'], typeof viewLines>();
    for (const l of viewLines) {
      const arr = map.get(l.recipe.category) ?? [];
      arr.push(l);
      map.set(l.recipe.category, arr);
    }
    const order: ProductionRecipe['category'][] = ['Bakery', 'Sandwich', 'Salad', 'Snack', 'Beverage'];
    return order
      .filter(c => map.has(c))
      .map(c => ({ category: c, rows: map.get(c)! }));
  }, [viewLines]);

  const totalQuinn = useMemo(() => order.lines.reduce((a, l) => a + l.quinnProposed, 0), [order.lines]);
  const totalConfirmed = useMemo(
    () => Object.values(dayState?.lines ?? {}).reduce((a, slots) => a + sumSlots(slots), 0),
    [dayState],
  );
  const delta = totalConfirmed - totalQuinn;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Ordering-from caption.
          The spoke picker that used to live here was a duplicate of the
          layout-level site selector, so it's been removed. We keep a
          short "ordering from {hub}" line so hub managers planning a
          spoke can confirm at a glance which hub the order routes to.
          Hidden for the spoke persona — their top-bar already names
          their site and hub, so this row would be pure noise. */}
      {!isSpoke && (
        <div
          style={{
            padding: '10px 32px',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            borderBottom: '1px solid var(--color-border-subtle)',
            background: '#ffffff',
            fontSize: 11,
            color: 'var(--color-text-muted)',
            flexWrap: 'wrap',
          }}
        >
          <span style={{ fontWeight: 700, color: 'var(--color-text-secondary)' }}>
            {spokeDisplayName}
          </span>
          <span>
            {spoke?.type === 'STANDALONE' && spoke?.linkType === 'linked' ? (
              <>· linked standalone — ordering from </>
            ) : spoke?.type === 'HYBRID' ? (
              <>· hybrid site — ordering from </>
            ) : (
              <>· ordering from </>
            )}
            <strong style={{ color: 'var(--color-text-secondary)' }}>{hubDisplayName}</strong>
          </span>
        </div>
      )}

      {/* Day strip — one tile per day, status badge + total order units */}
      <DayStrip
        spokeId={spokeId}
        hubId={hubId}
        selectedDate={date}
        nowISO={nowISO}
        cutoffPolicy={cutoffPolicy}
        cutoffTime={effectiveCutoffTime}
        dayStates={dayStates}
        onSelect={setDate}
      />

      <div style={{ flex: 1, minHeight: 0, overflow: 'auto', padding: '14px 16px 32px' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 12 }}>
          {/* Reject logging used to live here; it now lives on the spoke
              Today view as part of the unified delivery-confirmation
              flow (SpokeDeliveryConfirmCard). The order page stays
              focused on the order itself. */}
          <StaffLockBanner reason="Spoke orders are confirmed by the Manager before cutoff." />

          {/* Day header — day caption + cutoff marker + submit action all
              in one bar so the "what am I doing / when is it due / send it"
              loop sits at the top of the editor. */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              padding: '12px 14px',
              borderRadius: 'var(--radius-card)',
              background: status === 'auto-finalised' ? 'var(--color-bg-hover)' : '#ffffff',
              // Keep the surface neutral — the confirmed state shows up as a
              // green border around the bar, with the ✓ icon and copy carrying
              // the rest of the semantic.
              border: `1px solid ${
                status === 'acknowledged' ? 'var(--color-success)' : 'var(--color-border-subtle)'
              }`,
              flexWrap: 'wrap',
            }}
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
              <div
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  color: 'var(--color-text-muted)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                }}
              >
                {spokeDisplayName} → {hubDisplayName}
              </div>
              <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--color-text-primary)' }}>
                Order for {dayOfWeek(date)} {date}
                {date === DEMO_TODAY && (
                  <span style={{ marginLeft: 8, fontSize: 11, fontWeight: 600, color: 'var(--color-text-muted)' }}>
                    (today)
                  </span>
                )}
              </div>
              {(status === 'draft' || status === 'derived') && (
                <span style={{ fontSize: 10, color: 'var(--color-text-muted)', marginTop: 2 }}>
                  Submit before <strong>{formatCutoff(order.cutoffDateTime)}</strong> so {hubDisplayName} can plan.
                </span>
              )}
            </div>
            <div style={{ flex: 1 }} />
            <CutoffMarker
              cutoffISO={order.cutoffDateTime}
              minutesLeft={minutesToCutoff}
              past={past}
              locked={autoFinalised || status === 'submitted' || status === 'acknowledged'}
            />

            {/* Hub-side unlock affordance — lets the hub manager reopen
                this spoke's order past cutoff (with a reason) so the
                spoke can add to the locked baseline. Sits right next to
                the cutoff marker so it reads "the cutoff has passed →
                here's how I unlock it". The control self-hides for spoke
                personas, and SpokeUnlockControl itself returns null when
                the unlock isn't currently meaningful (still pre-cutoff,
                already dispatched, etc.). */}
            {!isSpoke && hubSubmission && (
              <SpokeUnlockControl
                hubId={hubId}
                spokeId={spokeId}
                forDate={date}
                submission={hubSubmission}
                cutoffPassed={hubCutoffPassed}
                hasTransfer={hubHasTransfer}
                unlockedBy={recordedBy}
              />
            )}

            {/* Action area — varies by status. Submit/demo controls when
                editable, soft confirmations otherwise. The unlocked branch
                takes precedence so the spoke always gets a clear way to
                resubmit additions while the window is open. */}
            {isUnlocked ? (
              <button
                type="button"
                onClick={submitDay}
                disabled={!canSubmit}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '10px 16px',
                  borderRadius: 8,
                  fontSize: 13,
                  fontWeight: 700,
                  fontFamily: 'var(--font-primary)',
                  background: !canSubmit ? 'var(--color-bg-hover)' : 'var(--color-success)',
                  color: !canSubmit ? 'var(--color-text-muted)' : '#ffffff',
                  border: `1px solid ${!canSubmit ? 'var(--color-border)' : 'var(--color-success)'}`,
                  cursor: !canSubmit ? 'not-allowed' : 'pointer',
                  minHeight: 38,
                }}
                title={
                  canSubmit
                    ? 'Submit your additions to the hub'
                    : 'Only the spoke manager can submit'
                }
              >
                <Send size={14} /> {canSubmit ? 'Submit additions' : 'Manager submits additions'}
              </button>
            ) : (status === 'draft' || status === 'derived') ? (
              <>
                {!past && (
                  <button
                    type="button"
                    onClick={skipToCutoff}
                    style={demoBtn('dashed')}
                    title="Demo: jump synthetic 'now' past the cutoff to trigger auto-finalisation"
                  >
                    <FastForward size={11} /> Demo: skip to cutoff
                  </button>
                )}
                <button
                  type="button"
                  onClick={submitDay}
                  disabled={past || !canSubmit}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    padding: '10px 16px',
                    borderRadius: 8,
                    fontSize: 13,
                    fontWeight: 700,
                    fontFamily: 'var(--font-primary)',
                    background: past || !canSubmit ? 'var(--color-bg-hover)' : 'var(--color-accent-active)',
                    color: past || !canSubmit ? 'var(--color-text-muted)' : 'var(--color-text-on-active)',
                    border: `1px solid ${past || !canSubmit ? 'var(--color-border)' : 'var(--color-accent-active)'}`,
                    cursor: past || !canSubmit ? 'not-allowed' : 'pointer',
                    minHeight: 38,
                  }}
                >
                  <Send size={14} /> {canSubmit ? 'Submit to hub' : 'Manager submits'}
                </button>
              </>
            ) : status === 'submitted' ? (
              <span style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>Sending to hub…</span>
            ) : status === 'acknowledged' ? (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--color-text-primary)', fontWeight: 600 }}>
                <CheckCircle2 size={16} color="var(--color-success)" />
                Acknowledged · scheduled for {dayOfWeek(date)} dispatch
              </span>
            ) : status === 'auto-finalised' ? (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--color-text-secondary)', fontWeight: 600 }}>
                <Lock size={14} color="var(--color-text-secondary)" />
                Locked at cutoff · {totalConfirmed} units on {hubDisplayName}&rsquo;s plan
              </span>
            ) : null}
          </div>

          {/* Quinn intro (only on draft / derived) */}
          {(status === 'draft' || status === 'derived') && (
            <div
              style={{
                padding: '12px 14px',
                borderRadius: 'var(--radius-card)',
                border: '1px solid var(--color-info)',
                background: 'var(--color-info-light)',
                display: 'flex',
                gap: 10,
                alignItems: 'flex-start',
              }}
            >
              <EdifyMark size={16} color="var(--color-info)" style={{ flexShrink: 0, marginTop: 1 }} />
              <div style={{ flex: 1, fontSize: 12, color: 'var(--color-text-secondary)', lineHeight: 1.5 }}>
                <strong style={{ color: 'var(--color-text-primary)' }}>
                  Edify has drafted your full {dayOfWeek(date)} order.
                </strong>{' '}
                Each row uses your forecast for {dayOfWeek(date)}, nets out anything you carried over from yesterday,
                and lands on the proposed quantity. Adjust whatever feels off, then submit before cutoff.
                {cutoffPolicy === 'lock' && (
                  <> If you don&rsquo;t submit by cutoff, Edify&rsquo;s draft is sent through automatically.</>
                )}
              </div>
            </div>
          )}

          {/* Auto-finalised banner — hidden when the hub has unlocked the
              order, since the unlocked banner below supersedes it. */}
          {autoFinalised && (
            <div
              style={{
                padding: '14px 32px',
                borderRadius: 'var(--radius-card)',
                border: '1px solid var(--color-warning-border)',
                background: 'var(--color-warning-light)',
                display: 'flex',
                alignItems: 'flex-start',
                gap: 12,
              }}
            >
              <Lock size={18} color="var(--color-warning)" style={{ flexShrink: 0, marginTop: 1 }} />
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--color-text-primary)' }}>
                  Auto-finalised at cutoff
                </div>
                <div style={{ fontSize: 12, color: 'var(--color-text-secondary)', lineHeight: 1.5 }}>
                  The {formatCutoff(order.cutoffDateTime)} cutoff passed before you submitted, so {hubDisplayName} is on
                  the hook for Edify&rsquo;s draft as-is ({totalConfirmed} units). The order is locked and
                  acknowledged on the hub side.
                </div>
              </div>
              <button
                type="button"
                onClick={rewindToOpen}
                style={demoBtn()}
                title="Demo: jump back to before the cutoff to see the editable state again"
              >
                Demo: rewind
              </button>
            </div>
          )}

          {/* Ingredient-shortfall banner — fires when the hub has
              applied a pro-rata cut on a recipe in this spoke's order
              for `date`. Lists each affected recipe with its before
              → after units so the spoke sees the line-level impact
              before scrolling the ledger below. Multiple records
              stack as separate rows under one shared banner header
              (a single butter shortage typically hits both croissant
              and pain au chocolat — they read as one event). */}
          {spokeShortfallsToday.length > 0 && (
            <div
              style={{
                padding: '14px 16px',
                borderRadius: 'var(--radius-card)',
                border: '1px solid var(--color-warning-border)',
                background: 'var(--color-warning-light)',
                display: 'flex',
                alignItems: 'flex-start',
                gap: 12,
              }}
            >
              <AlertTriangle
                size={18}
                color="var(--color-warning)"
                style={{ flexShrink: 0, marginTop: 1 }}
              />
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
                <div
                  style={{
                    fontSize: 13,
                    fontWeight: 700,
                    color: 'var(--color-text-primary)',
                  }}
                >
                  {hubDisplayName} cut {spokeShortfallsToday.length} recipe
                  {spokeShortfallsToday.length === 1 ? '' : 's'} due to ingredient shortage
                </div>
                <div
                  style={{
                    fontSize: 12,
                    color: 'var(--color-text-secondary)',
                    lineHeight: 1.5,
                  }}
                >
                  The hub re-allocated everyone&rsquo;s order pro-rata so the bake fits
                  the available ingredient stock. Your committed quantities are below;
                  no action needed unless you want to discuss with the hub.
                </div>
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 4,
                    marginTop: 2,
                  }}
                >
                  {spokeShortfallsToday.map(rec => {
                    const seed = PRET_INGREDIENT_SHORTFALL_SEEDS.find(
                      s => s.id === rec.seedId,
                    );
                    const recipeName = getRecipe(rec.recipeId)?.name ?? rec.recipeId;
                    const myLine = rec.lines.find(l => l.spokeId === spokeId);
                    if (!myLine) return null;
                    const cut = myLine.cutUnits;
                    return (
                      <div
                        key={rec.seedId}
                        style={{
                          display: 'flex',
                          alignItems: 'baseline',
                          gap: 8,
                          padding: '6px 10px',
                          background: '#ffffff',
                          borderRadius: 6,
                          border: '1px solid var(--color-warning-border)',
                          fontSize: 12,
                          flexWrap: 'wrap',
                        }}
                      >
                        <span
                          style={{
                            fontWeight: 700,
                            color: 'var(--color-text-primary)',
                          }}
                        >
                          {recipeName}
                        </span>
                        <span style={{ color: 'var(--color-text-muted)' }}>
                          {seed?.reason ?? 'Ingredient shortage'} — bottleneck:{' '}
                          {seed?.bottleneckIngredient ?? 'an ingredient'}
                        </span>
                        <span
                          style={{
                            marginLeft: 'auto',
                            fontVariantNumeric: 'tabular-nums',
                            color: 'var(--color-text-muted)',
                          }}
                        >
                          {myLine.requestedUnits} → {myLine.allocatedUnits}
                        </span>
                        <span
                          style={{
                            color: 'var(--color-warning)',
                            fontWeight: 700,
                            fontVariantNumeric: 'tabular-nums',
                          }}
                        >
                          -{cut}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* Hub-unlock banner — shown when the hub manager has reopened
              this order past cutoff. Trumps any "locked" or "auto-finalised"
              messaging because the spoke can now ADD to the order. */}
          {isUnlocked && unlockRecord && (
            <div
              style={{
                padding: '14px 32px',
                borderRadius: 'var(--radius-card)',
                border: '1px solid var(--color-success-border)',
                background: 'var(--color-success-light)',
                display: 'flex',
                alignItems: 'flex-start',
                gap: 12,
              }}
            >
              <Unlock size={18} color="var(--color-success)" style={{ flexShrink: 0, marginTop: 1 }} />
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--color-text-primary)' }}>
                  {hubDisplayName} reopened your order — add what you need
                </div>
                <div style={{ fontSize: 12, color: 'var(--color-text-secondary)', lineHeight: 1.5 }}>
                  <strong>{unlockRecord.unlockedBy}</strong> unlocked at{' '}
                  {new Date(unlockRecord.unlockedAtISO).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                  : &ldquo;{unlockRecord.reason}&rdquo;. Your locked baseline is{' '}
                  <strong>{Object.values(unlockRecord.baselineBySku).reduce((a, b) => a + b, 0)} units</strong>{' '}
                  — you can only <strong>increase</strong> from there. Resubmit when you&rsquo;re done so
                  the hub can dispatch the new total.
                </div>
              </div>
            </div>
          )}

          {/* Totals + actions */}
          <div
            style={{
              display: 'flex',
              gap: 16,
              padding: '12px 14px',
              borderRadius: 'var(--radius-card)',
              border: '1px solid var(--color-border-subtle)',
              background: '#ffffff',
              alignItems: 'center',
              flexWrap: 'wrap',
            }}
          >
            <Metric label="Edify proposed" value={totalQuinn} />
            <Metric label="You confirmed" value={totalConfirmed} bold />
            <Metric label="Delta" value={delta} signed />
            <div style={{ flex: 1 }} />
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                padding: '6px 10px',
                background: 'var(--color-bg-hover)',
                borderRadius: 6,
                border: '1px solid var(--color-border-subtle)',
              }}
            >
              <Search size={12} color="var(--color-text-muted)" />
              <input
                type="text"
                placeholder="Filter recipes…"
                value={query}
                onChange={e => setQuery(e.target.value)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  outline: 'none',
                  fontFamily: 'var(--font-primary)',
                  fontSize: 11,
                  color: 'var(--color-text-primary)',
                  width: 140,
                }}
              />
              {query && (
                <button
                  type="button"
                  onClick={() => setQuery('')}
                  aria-label="Clear filter"
                  style={{
                    background: 'transparent',
                    border: 'none',
                    cursor: 'pointer',
                    color: 'var(--color-text-muted)',
                    display: 'inline-flex',
                  }}
                >
                  <X size={12} />
                </button>
              )}
            </div>
            {delta !== 0 && (
              <button
                type="button"
                onClick={resetToQuinn}
                disabled={locked}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 5,
                  padding: '8px 12px',
                  borderRadius: 8,
                  fontSize: 11,
                  fontWeight: 600,
                  fontFamily: 'var(--font-primary)',
                  background: '#ffffff',
                  border: '1px solid var(--color-border)',
                  color: 'var(--color-text-secondary)',
                  cursor: locked ? 'not-allowed' : 'pointer',
                  opacity: locked ? 0.5 : 1,
                }}
              >
                <RotateCcw size={11} /> Reset to Edify
              </button>
            )}
          </div>

          {/* Ledger table — column structure mirrors the standalone Plan
              production view so the spoke is editing in the same shape as
              they would if they were planning their own bake: Carry-over
              up front, then a stepper per P-slot (P1/P2/P3) showing
              Quinn's per-slot forecast underneath the input. There's no
              On-demand column on this surface (the standalone view's VP
              column doesn't apply — spokes don't make hot prod). */}
          <div
            style={{
              background: '#ffffff',
              borderRadius: 'var(--radius-card)',
              border: '1px solid var(--color-border-subtle)',
              overflow: 'hidden',
            }}
          >
            {/* Column header */}
            <div
              style={spokeOrderGridStyle(pColumnCount, {
                padding: '12px 32px',
                gap: 12,
                background: 'var(--color-bg-hover)',
                borderBottom: '1px solid var(--color-border-subtle)',
                fontSize: 10,
                fontWeight: 700,
                color: 'var(--color-text-muted)',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                position: 'sticky',
                top: 0,
                zIndex: 4,
              })}
            >
              <span>Recipe</span>
              <span style={{ textAlign: 'center' }}>Carry-over</span>
              {Array.from({ length: pColumnCount }, (_, i) => (
                <span key={`p-head-${i}`} style={{ textAlign: 'center' }}>
                  P{i + 1}
                </span>
              ))}
              <span style={{ textAlign: 'center' }}>Total</span>
            </div>

            {grouped.length === 0 && (
              <div style={{ padding: '32px 20px', textAlign: 'center', color: 'var(--color-text-muted)', fontSize: 12 }}>
                {query ? `No recipes match “${query}”.` : 'Hub has no recipes set up yet.'}
              </div>
            )}

            {grouped.map(group => {
              const groupTotal = group.rows.reduce(
                (a, r) => a + sumSlots(dayState?.lines[r.skuId]),
                0,
              );
              return (
                <div key={group.category}>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                      padding: '10px 16px',
                      background: 'var(--color-bg-surface)',
                      borderBottom: '1px solid var(--color-border-subtle)',
                      borderTop: '1px solid var(--color-border-subtle)',
                    }}
                  >
                    <StatusPill tone="neutral" label={group.category} size="xs" />
                    <span style={{ fontSize: 10, color: 'var(--color-text-muted)', fontWeight: 600 }}>
                      {group.rows.length} SKU{group.rows.length === 1 ? '' : 's'} · {groupTotal} units ordered
                    </span>
                  </div>
                  {group.rows.map(row => {
                    const slots =
                      dayState?.lines[row.skuId] ??
                      splitAcrossSlots(row.confirmed, row.forecast?.byPhase, pColumnCount);
                    const slotForecasts = splitAcrossSlots(
                      row.quinnProposed,
                      row.forecast?.byPhase,
                      pColumnCount,
                    );
                    return (
                      <SpokeOrderRow
                        key={row.skuId}
                        row={row}
                        slots={slots}
                        slotForecasts={slotForecasts}
                        pColumnCount={pColumnCount}
                        isExpanded={expanded.has(row.skuId)}
                        onToggle={() => toggleExpand(row.skuId)}
                        onSetSlot={(slotIdx, v) => setSlotUnits(row.skuId, slotIdx, v)}
                        onBumpSlot={(slotIdx, d) => bumpSlot(row.skuId, slotIdx, d)}
                        onResetLine={() => resetLineToQuinn(row.skuId)}
                        locked={locked}
                        canAdjust={canAdjust}
                        floor={unlockBaseline?.[row.skuId] ?? 0}
                      />
                    );
                  })}
                </div>
              );
            })}
          </div>

        </div>
      </div>
    </div>
  );
}

// ─── Day strip ─────────────────────────────────────────────────────────────

function DayStrip({
  spokeId,
  hubId,
  selectedDate,
  nowISO,
  cutoffPolicy,
  cutoffTime,
  dayStates,
  onSelect,
}: {
  spokeId: SiteId;
  hubId: SiteId;
  selectedDate: string;
  nowISO: string;
  cutoffPolicy: 'lock' | 'soft';
  cutoffTime: string;
  dayStates: Record<string, DayState>;
  onSelect: (date: string) => void;
}) {
  return (
    <div
      role="tablist"
      aria-label="Select day"
      style={{
        display: 'flex',
        gap: 8,
        padding: '12px 32px',
        background: '#ffffff',
        borderBottom: '1px solid var(--color-border-subtle)',
        overflowX: 'auto',
      }}
    >
      {DAY_RANGE.map(offset => {
        const d = dayOffset(offset);
        return (
          <DayCard
            key={d}
            spokeId={spokeId}
            hubId={hubId}
            date={d}
            selected={d === selectedDate}
            nowISO={nowISO}
            cutoffPolicy={cutoffPolicy}
            cutoffTime={cutoffTime}
            dayState={dayStates[`${spokeId}|${d}`]}
            onSelect={() => onSelect(d)}
          />
        );
      })}
    </div>
  );
}

function DayCard({
  spokeId,
  hubId,
  date,
  selected,
  nowISO,
  cutoffPolicy,
  cutoffTime,
  dayState,
  onSelect,
}: {
  spokeId: SiteId;
  hubId: SiteId;
  date: string;
  selected: boolean;
  nowISO: string;
  cutoffPolicy: 'lock' | 'soft';
  cutoffTime: string;
  dayState?: DayState;
  onSelect: () => void;
}) {
  // Re-derive the day's snapshot so the strip is accurate even if the day
  // hasn't been visited yet (we want totals for unloaded days too).
  const order = useMemo(() => spokeOrderForDate(spokeId, hubId, date), [spokeId, hubId, date]);
  // Override the cutoff to honour the hub's effective settings (mirrors
  // the page-level computation above).
  const [h, m] = cutoffTime.split(':');
  const overriddenCutoff = `${dayOffset(-1, date)}T${h ?? '15'}:${m ?? '00'}:00Z`;
  const cutoff = new Date(overriddenCutoff);
  const now = new Date(nowISO);
  const past = cutoff.getTime() < now.getTime();

  const status: DisplayStatus = dayState?.status ?? order.status;
  // dayState.lines is `Record<SkuId, number[]>` (one entry per P-slot),
  // so we sum across slots first, then across SKUs. Previously this used
  // `(a, b) => a + b` with `b` being an array, which JavaScript happily
  // string-concatenates — producing the giant comma list the day tile
  // briefly showed in place of a unit count.
  const total = dayState
    ? Object.values(dayState.lines).reduce((a, slots) => a + sumSlots(slots), 0)
    : order.lines.reduce((a, l) => a + l.confirmed, 0);

  // What the user sees on the badge — promote derived-and-overdue to
  // "auto" because that's what will happen the moment they open it.
  const effectiveStatus: DisplayStatus =
    status === 'derived' && past && cutoffPolicy === 'lock' ? 'auto-finalised' : status;

  const isToday = date === DEMO_TODAY;
  const isPast = date < DEMO_TODAY;
  const dow = dayOfWeek(date);
  const dayNum = date.slice(8, 10);

  const borderColor = selected ? 'var(--color-accent-active)' : 'var(--color-border-subtle)';
  const background = selected ? 'var(--color-accent-active)' : '#ffffff';
  const labelColor = selected ? '#ffffff' : isPast ? 'var(--color-text-muted)' : 'var(--color-text-secondary)';
  const dayColor = selected ? '#ffffff' : 'var(--color-text-primary)';

  return (
    <button
      role="tab"
      aria-selected={selected}
      type="button"
      onClick={onSelect}
      style={{
        flex: '0 0 auto',
        minWidth: 110,
        padding: '10px 12px',
        borderRadius: 10,
        border: `1px solid ${borderColor}`,
        background,
        cursor: 'pointer',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-start',
        gap: 4,
        fontFamily: 'var(--font-primary)',
        textAlign: 'left',
        opacity: isPast && !selected ? 0.85 : 1,
        transition: 'background 0.15s, border-color 0.15s',
      }}
      title={`${dow} ${date}${isToday ? ' (today)' : ''} · ${total} units · ${displayStatusLabel(effectiveStatus)}`}
    >
      <span
        style={{
          fontSize: 9,
          fontWeight: 700,
          letterSpacing: '0.05em',
          textTransform: 'uppercase',
          color: labelColor,
        }}
      >
        {isToday ? 'Today' : dow}
      </span>
      <span
        style={{
          fontSize: 18,
          fontWeight: 700,
          color: dayColor,
          fontVariantNumeric: 'tabular-nums',
          lineHeight: 1,
        }}
      >
        {dayNum}
      </span>
      <span
        style={{
          fontSize: 10,
          fontWeight: 600,
          color: selected ? 'rgba(255,255,255,0.85)' : 'var(--color-text-muted)',
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        {total} units
      </span>
      <DayStatusBadge status={effectiveStatus} selected={selected} />
    </button>
  );
}

function DayStatusBadge({ status, selected }: { status: DisplayStatus; selected: boolean }) {
  const treatment = displayStatusTreatment(status);
  const fg = selected ? '#ffffff' : treatment.fg;
  const bg = selected ? 'rgba(255,255,255,0.18)' : treatment.bg;
  const border = selected ? 'rgba(255,255,255,0.35)' : treatment.border;
  return (
    <span
      style={{
        marginTop: 2,
        display: 'inline-flex',
        alignItems: 'center',
        padding: '2px 6px',
        borderRadius: 4,
        fontSize: 9,
        fontWeight: 700,
        textTransform: 'uppercase',
        letterSpacing: '0.04em',
        color: fg,
        background: bg,
        border: `1px solid ${border}`,
      }}
    >
      {treatment.label}
    </span>
  );
}

function displayStatusLabel(status: DisplayStatus): string {
  return displayStatusTreatment(status).label;
}

function displayStatusTreatment(status: DisplayStatus): {
  label: string;
  fg: string;
  bg: string;
  border: string;
} {
  switch (status) {
    case 'draft':           return { label: 'Draft',        fg: 'var(--color-warning)',          bg: 'var(--color-warning-light)', border: 'var(--color-warning-border)' };
    case 'submitted':       return { label: 'Submitted',    fg: 'var(--color-info)',             bg: 'var(--color-info-light)',    border: 'var(--color-info)' };
    case 'acknowledged':    return { label: 'Acknowledged', fg: 'var(--color-text-secondary)',   bg: 'var(--color-bg-hover)',      border: 'var(--color-border-subtle)' };
    case 'modified-by-hub': return { label: 'Modified',     fg: 'var(--color-text-secondary)',   bg: 'var(--color-bg-hover)',      border: 'var(--color-border-subtle)' };
    case 'auto-finalised':  return { label: 'Auto-locked',  fg: 'var(--color-text-secondary)',   bg: 'var(--color-bg-hover)',      border: 'var(--color-border-subtle)' };
    case 'derived':         return { label: 'Edify draft',  fg: 'var(--color-text-muted)',       bg: '#ffffff',                    border: 'var(--color-border-subtle)' };
  }
}

// ─── Row ───────────────────────────────────────────────────────────────────

function SpokeOrderRow({
  row,
  slots,
  slotForecasts,
  pColumnCount,
  isExpanded,
  onToggle,
  onSetSlot,
  onBumpSlot,
  onResetLine,
  locked,
  canAdjust,
  floor = 0,
}: {
  row: ReturnType<typeof spokeOrderForDate>['lines'][number];
  /** Per-P-slot units the spoke is currently committing to. */
  slots: number[];
  /** Quinn's per-slot forecast — shown as a hint under each stepper. */
  slotForecasts: number[];
  pColumnCount: number;
  isExpanded: boolean;
  onToggle: () => void;
  onSetSlot: (slotIdx: number, v: number) => void;
  onBumpSlot: (slotIdx: number, d: number) => void;
  onResetLine: () => void;
  locked: boolean;
  canAdjust: boolean;
  /**
   * Lower bound for the SKU total. Used by the PAC-unlock flow to
   * enforce "spoke can only ADD on top of the locked baseline" — when
   * set > 0, decrementing slots refuses to push the sum below `floor`.
   */
  floor?: number;
}) {
  const { recipe, carryOver, quinnProposed, forecast } = row;
  const carriedUnits = carryOver?.carriedUnits ?? 0;
  const total = sumSlots(slots);
  const lineDelta = total - quinnProposed;
  const editable = !locked && canAdjust;

  return (
    <>
      <div
        style={spokeOrderGridStyle(pColumnCount, {
          padding: '8px 16px 8px 13px',
          gap: 12,
          alignItems: 'center',
          borderBottom: '1px solid var(--color-border-subtle)',
          borderLeft: '3px solid transparent',
          background: '#ffffff',
          cursor: 'pointer',
          fontSize: 11,
        })}
        onClick={onToggle}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
          <button
            type="button"
            aria-label={isExpanded ? 'Collapse' : 'Expand'}
            onClick={e => {
              e.stopPropagation();
              onToggle();
            }}
            style={{
              width: 28,
              height: 28,
              border: '1px solid var(--color-border-subtle)',
              borderRadius: 6,
              background: '#ffffff',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              color: 'var(--color-text-muted)',
              flexShrink: 0,
            }}
          >
            {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          </button>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--color-text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {recipe.name}
            </div>
            <div style={{ display: 'flex', gap: 6, marginTop: 3, alignItems: 'center', fontSize: 9, color: 'var(--color-text-muted)' }}>
              {row.hasSeeded ? (
                <StatusPill tone="info" label="You changed" size="xs" />
              ) : (
                <StatusPill tone="neutral" label="Edify default" size="xs" />
              )}
            </div>
          </div>
        </div>

        {/* Carry-over — same display semantic as the standalone Plan view
            (fixed value with a leading minus when there's stock to net). */}
        <div style={{ textAlign: 'center', fontSize: 13, fontVariantNumeric: 'tabular-nums' }}>
          {carriedUnits > 0 ? (
            <span style={{ fontWeight: 700, color: 'var(--color-text-secondary)' }}>−{carriedUnits}</span>
          ) : (
            <span style={{ color: 'var(--color-text-muted)' }}>0</span>
          )}
        </div>

        {/* Per-slot steppers — one per P-column. The forecast pill under
            each stepper is the standalone Plan view's "fc N" hint, which
            keeps Quinn's expectation visible while the spoke edits. */}
        {Array.from({ length: pColumnCount }, (_, i) => {
          const v = slots[i] ?? 0;
          const fc = slotForecasts[i] ?? 0;
          // The minus button is disabled at the floor when honouring an
          // unlock baseline. The floor is on the SKU total, so we
          // disable when the total is at the floor and this slot is
          // contributing — any decrement would dip the total below it.
          const atFloor = floor > 0 && total <= floor && v > 0;
          return (
            <div
              key={`slot-${i}`}
              style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}
              onClick={e => e.stopPropagation()}
            >
              <QtyStepper
                size="default"
                disabled={!editable}
                canDecrement={editable && v > 0 && !atFloor}
                onDecrement={() => onBumpSlot(i, -1)}
                onIncrement={() => onBumpSlot(i, 1)}
                decrementLabel={
                  atFloor
                    ? `Hub locked ${floor} units already — additions only while unlocked`
                    : 'Decrease'
                }
              >
                <input
                  type="number"
                  value={v}
                  disabled={!editable}
                  onChange={e => onSetSlot(i, Number(e.target.value) || 0)}
                  style={{
                    width: 40,
                    textAlign: 'center',
                    fontSize: 14,
                    fontWeight: 700,
                    fontVariantNumeric: 'tabular-nums',
                    border: 'none',
                    background: 'transparent',
                    outline: 'none',
                    color: 'var(--color-text-primary)',
                    fontFamily: 'var(--font-primary)',
                    appearance: 'textfield',
                    MozAppearance: 'textfield',
                  }}
                />
              </QtyStepper>
              <span
                style={{
                  fontSize: 9,
                  fontWeight: 700,
                  color: 'var(--color-text-muted)',
                  fontVariantNumeric: 'tabular-nums',
                  letterSpacing: '0.04em',
                  textTransform: 'uppercase',
                }}
                title={`Edify forecast for P${i + 1}: ${fc} units`}
              >
                fc {fc}
              </span>
            </div>
          );
        })}

        <div style={{ textAlign: 'center', fontSize: 14, fontWeight: 800, fontVariantNumeric: 'tabular-nums' }}>
          {total}
          {lineDelta !== 0 && (
            <div style={{ fontSize: 9, fontWeight: 700, color: lineDelta > 0 ? 'var(--color-warning)' : 'var(--color-info)' }}>
              {lineDelta > 0 ? `+${lineDelta}` : lineDelta} vs Edify
            </div>
          )}
        </div>
      </div>

      {/* Expanded panel */}
      {isExpanded && (
        <div
          style={{
            padding: '14px 20px 14px 56px',
            background: 'var(--color-bg-surface)',
            borderBottom: '1px solid var(--color-border-subtle)',
            display: 'grid',
            gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)',
            gap: 24,
          }}
          onClick={e => e.stopPropagation()}
        >
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--color-text-muted)', marginBottom: 8 }}>
              Forecast signals
            </div>
            {forecast ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {forecast.signals.map((s, i) => (
                  <div key={i} style={{ fontSize: 11, color: 'var(--color-text-secondary)' }}>
                    <strong style={{ color: 'var(--color-text-primary)' }}>{s.signal}</strong>
                    {s.note && <> · {s.note}</>}
                  </div>
                ))}
                {forecast.byPhase && (
                  <div style={{ marginTop: 6, display: 'flex', gap: 8, fontSize: 10 }}>
                    <PhaseChip label="AM" value={forecast.byPhase.morning} />
                    <PhaseChip label="MID" value={forecast.byPhase.midday} />
                    <PhaseChip label="PM" value={forecast.byPhase.afternoon} />
                  </div>
                )}
              </div>
            ) : (
              <div style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>
                No forecast signal — recipe isn&rsquo;t historically sold here yet.
              </div>
            )}
          </div>
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--color-text-muted)', marginBottom: 8 }}>
              How Edify got to {quinnProposed}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 3, fontVariantNumeric: 'tabular-nums', fontSize: 11, color: 'var(--color-text-secondary)' }}>
              <LedgerLine label="Forecast" value={forecast?.projectedUnits ?? 0} />
              <LedgerLine label="Carry-over" value={-(carriedUnits)} />
              <div style={{ borderTop: '1px dashed var(--color-border-subtle)', paddingTop: 4, marginTop: 2, display: 'flex', gap: 6 }}>
                <EdifyMark size={11} color="var(--color-text-muted)" />
                <span style={{ fontWeight: 700, color: 'var(--color-text-primary)' }}>Edify proposes</span>
                <span style={{ marginLeft: 'auto', fontWeight: 700, color: 'var(--color-text-primary)' }}>{quinnProposed}</span>
              </div>
              {lineDelta !== 0 && (
                <div style={{ marginTop: 6, display: 'flex', gap: 6, alignItems: 'center' }}>
                  <span style={{ fontWeight: 700, color: 'var(--color-text-primary)' }}>You order</span>
                  <span style={{ marginLeft: 'auto', fontWeight: 800, color: 'var(--color-text-primary)' }}>{total}</span>
                  <button
                    type="button"
                    onClick={onResetLine}
                    disabled={locked}
                    style={{
                      padding: '4px 8px',
                      fontSize: 10,
                      fontWeight: 600,
                      borderRadius: 4,
                      background: '#ffffff',
                      border: '1px solid var(--color-border)',
                      cursor: locked ? 'not-allowed' : 'pointer',
                      color: 'var(--color-text-secondary)',
                      opacity: locked ? 0.5 : 1,
                    }}
                  >
                    Reset to Edify
                  </button>
                </div>
              )}
              {carryOver?.reason && (
                <div style={{ marginTop: 6, fontSize: 10, color: 'var(--color-text-muted)' }}>
                  {carryOver.reason}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ─── Subcomponents ─────────────────────────────────────────────────────────

function CutoffMarker({
  cutoffISO,
  minutesLeft,
  past,
  locked,
}: {
  cutoffISO: string;
  minutesLeft: number;
  past: boolean;
  locked: boolean;
}) {
  const urgent = minutesLeft <= 60 && minutesLeft >= 0;
  const borderColor = locked
    ? 'var(--color-border-subtle)'
    : past
      ? 'var(--color-error-border)'
      : urgent
        ? 'var(--color-warning-border)'
        : 'var(--color-border-subtle)';
  const bg = locked
    ? 'var(--color-bg-hover)'
    : past
      ? 'var(--color-error-light)'
      : urgent
        ? 'var(--color-warning-light)'
        : '#ffffff';
  return (
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 10,
        padding: '8px 12px',
        borderRadius: 8,
        border: `1px solid ${borderColor}`,
        background: bg,
      }}
    >
      {locked ? (
        <Lock size={14} color="var(--color-text-secondary)" />
      ) : past ? (
        <AlertCircle size={14} color="var(--color-error)" />
      ) : (
        <Clock size={14} color={urgent ? 'var(--color-warning)' : 'var(--color-text-muted)'} />
      )}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
        <span style={{ fontSize: 9, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 700 }}>
          Cutoff
        </span>
        <span style={{ fontSize: 12, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
          {formatCutoff(cutoffISO)}
        </span>
        <span
          style={{
            fontSize: 9,
            color: locked
              ? 'var(--color-text-secondary)'
              : past
                ? 'var(--color-error)'
                : urgent
                  ? 'var(--color-warning)'
                  : 'var(--color-text-muted)',
            fontWeight: 600,
          }}
        >
          {locked
            ? 'Auto-locked'
            : past
              ? `${Math.abs(minutesLeft)}m overdue`
              : `${minutesLeft}m left`}
        </span>
      </div>
    </div>
  );
}

function Metric({ label, value, signed = false, bold = false }: { label: string; value: number; signed?: boolean; bold?: boolean }) {
  const sign = signed && value !== 0 ? (value > 0 ? '+' : '') : '';
  const color = signed ? (value > 0 ? 'var(--color-warning)' : value < 0 ? 'var(--color-info)' : 'var(--color-text-primary)') : 'var(--color-text-primary)';
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <span style={{ fontSize: 10, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 700 }}>
        {label}
      </span>
      <span style={{ fontSize: bold ? 22 : 18, fontWeight: 700, fontVariantNumeric: 'tabular-nums', color, lineHeight: 1 }}>
        {sign}{value}
      </span>
    </div>
  );
}

function PhaseChip({ label, value }: { label: string; value: number }) {
  return (
    <span
      style={{
        padding: '3px 8px',
        borderRadius: 4,
        background: '#ffffff',
        border: '1px solid var(--color-border-subtle)',
        fontSize: 9,
        fontWeight: 700,
        color: 'var(--color-text-secondary)',
        fontVariantNumeric: 'tabular-nums',
      }}
    >
      {label} {value}
    </span>
  );
}

function LedgerLine({ label, value }: { label: string; value: number }) {
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
      <span style={{ fontWeight: 600, color: 'var(--color-text-primary)' }}>{label}</span>
      <span style={{ marginLeft: 'auto', fontWeight: 700 }}>
        {value > 0 ? `+${value}` : value}
      </span>
    </div>
  );
}

function formatCutoff(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString('en-GB', { weekday: 'short', hour: '2-digit', minute: '2-digit' });
}

/**
 * Shared grid template for the spoke order header + rows. Mirrors the
 * column shape of the standalone Plan view: a wide recipe column, a
 * Carry-over column, one stepper column per P-slot, and a Total. No
 * On-demand column on this surface — spokes don't bake hot prod.
 */
function spokeOrderGridStyle(
  pColumnCount: number,
  base: React.CSSProperties,
): React.CSSProperties {
  const slotCols = Array.from({ length: pColumnCount }, () => '110px').join(' ');
  return {
    display: 'grid',
    gridTemplateColumns: `minmax(220px, 1.6fr) 90px ${slotCols} 80px`,
    ...base,
  };
}

function demoBtn(variant: 'solid' | 'dashed' = 'solid'): React.CSSProperties {
  return {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 4,
    padding: '6px 10px',
    borderRadius: 6,
    fontSize: 11,
    fontWeight: 600,
    fontFamily: 'var(--font-primary)',
    background: '#ffffff',
    color: 'var(--color-text-muted)',
    border: variant === 'dashed' ? '1px dashed var(--color-border)' : '1px solid var(--color-border)',
    cursor: 'pointer',
  };
}
