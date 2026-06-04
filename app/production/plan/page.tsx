'use client';

import { useState } from 'react';
import RecipeFirstGrid from '@/components/Production/RecipeFirstGrid';
import DaySelectorStrip from '@/components/Production/DaySelectorStrip';
import { useRole } from '@/components/Production/RoleContext';
import {
  PRET_SITES,
  getSite,
  isHubLinked,
  DEMO_TODAY,
  dayOfWeek,
} from '@/components/Production/fixtures';
import { useProductionSite } from '@/components/Production/ProductionSiteContext';
import { usePlanConfirm } from '@/components/Production/planConfirmStore';
import PlanConfirmBar from '@/components/Production/PlanConfirmBar';
// Polymorphic Plan view — when a hub-linked site (spoke / hybrid /
// linked-standalone) is selected in the layout site picker, the Plan
// tab swaps over to the spoke-order workflow that used to live behind
// the dedicated "Spoke plans" tab. Same component the spoke persona's
// Order tab uses, so order-flow logic lives in one place.
//
// HYBRID is the interesting case: from the recipe-first plan view, a
// HYBRID site sees its full recipe set with `Make` / `Receive` tags per
// row (per the assumption A2 in the strip-back plan). It does NOT swap
// to the spoke flow. So the polymorphic fallback only fires for SPOKE
// + linked STANDALONE.
import SpokeSubmissionsPage from '../spokes/page';

/**
 * 14-day window for the day strip: yesterday on the far left, today as the
 * second card, and the next 12 days drafting forward. Matches the manager's
 * mental model of "look back one, plan forward two weeks".
 */
const DAY_STRIP_RANGE = [-1, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

/**
 * Multi-day production planner — recipe-first.
 *
 * Replaces the previous "Detailed / Overview" toggle (PlanStrip + AmountsView).
 * The recipe-first grid does both jobs in one surface — one row per recipe,
 * site-type-gated columns, focus panel for the dense detail.
 */
export default function ProductionPlanPage() {
  // RoleContext is still consulted by the grid's downstream pieces; we don't
  // need to gate the body itself on `canEdit` because the grid is read-only
  // in this iteration (overrides happen via the focus panel). See the plan's
  // open question 2 for the VP-math editing decision.
  useRole();
  const { siteId } = useProductionSite();
  const { isConfirmed, isDayUnlocked } = usePlanConfirm();
  const [selectedDate, setSelectedDate] = useState(DEMO_TODAY);
  const site = getSite(siteId) ?? PRET_SITES[0];

  // SPOKE + linked STANDALONE swap to the spoke-order workflow. HYBRID and
  // the producing hybrid (HYBRID_HUB) stay on the recipe-first grid: each row
  // already self-tags Make/Receive, and the producing hybrid additionally
  // surfaces its per-spoke production columns here so the plan shows both its
  // own production and what it produces for others.
  if (isHubLinked(site) && site.type !== 'HYBRID' && site.type !== 'HYBRID_HUB') {
    return <SpokeSubmissionsPage />;
  }

  const isPastDay = selectedDate < DEMO_TODAY;
  const dow = dayOfWeek(selectedDate);
  const isToday = selectedDate === DEMO_TODAY;

  // Lock state for the grid:
  //   • Today is locked by default — its plan was committed the day before
  //     and the kitchen is already running to it. The manager can Unlock it
  //     for live edits from the bar above.
  //   • Future days lock once the manager confirms the plan.
  // Either way an explicit unlock wins, and the lock dims the grid + blocks
  // interaction (steppers, focus panel, filters).
  const planLocked = isDayUnlocked(site.id, selectedDate)
    ? false
    : isToday || isConfirmed(site.id, selectedDate);

  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      {/* Day strip — D-1..D+12 (today sits in second slot) */}
      <DaySelectorStrip
        siteId={site.id}
        selectedDate={selectedDate}
        onSelect={setSelectedDate}
        range={DAY_STRIP_RANGE}
      />

      {/* Selected day caption */}
      <div
        style={{
          padding: '8px 16px',
          background: 'var(--color-bg-surface)',
          borderBottom: '1px solid var(--color-border-subtle)',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          fontSize: 11,
          color: 'var(--color-text-muted)',
        }}
      >
        <span style={{ fontWeight: 700, color: 'var(--color-text-secondary)' }}>
          {isToday ? 'Planning today' : `Planning ${dow} ${selectedDate}`}
        </span>
        {!isToday && (
          <span>
            ·{' '}
            {isPastDay
              ? 'historical view — runs are locked'
              : 'drafting ahead — edits flow through the focus panel'}
          </span>
        )}
      </div>

      {/* Confirm-and-flow-through bar — the manager locks the day's plan
          here and it becomes the committed bake target for Run production. */}
      <PlanConfirmBar siteId={site.id} date={selectedDate} variant="plan" />

      {/* When locked we don't dim the whole surface — the page stays fully
          readable and the filters / drill-in still work. Only the editable
          numbers (the per-run / VP steppers) are pinned read-only via the
          grid's `locked` flag. */}
      <RecipeFirstGrid siteId={site.id} date={selectedDate} surface="plan" locked={planLocked} />
    </div>
  );
}
