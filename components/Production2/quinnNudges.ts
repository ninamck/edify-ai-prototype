import {
  PRET_PLAN,
  PRET_CARRY_OVER,
  PRET_SETTINGS_HEALTH,
  PRET_SPOKE_SUBMISSION,
  dayOffset,
  getProductionItem,
  getRecipe,
} from './fixtures';
import { siteProductivity, formatDelta } from './productivity';
import { siteSalesReport, formatSignedPct } from './salesReport';

export type QuinnNudgeTone = 'info' | 'warning' | 'error' | 'success';

export type QuinnNudge = {
  id: string;
  surface: 'board' | 'pcr' | 'carry-over' | 'spokes' | 'settings' | 'setup' | 'plan' | 'productivity' | 'sales-report';
  tone: QuinnNudgeTone;
  title: string;
  body: string;
  cta: { label: string; href: string };
  /** Optional shortcut to the detail (for nudges that should auto-scroll). */
  anchorId?: string;
};

export function getQuinnNudges(): QuinnNudge[] {
  const nudges: QuinnNudge[] = [];

  // 1) PCR queue — any batches sitting in 'complete'
  const needsReview = PRET_PLAN.batches.filter(b => b.status === 'complete');
  if (needsReview.length > 0) {
    nudges.push({
      id: 'nudge-pcr-queue',
      surface: 'pcr',
      tone: 'warning',
      title: `${needsReview.length} batch${needsReview.length === 1 ? '' : 'es'} awaiting PCR`,
      body:
        needsReview.length === 1
          ? 'One finished batch is waiting on quality + label sign-off.'
          : 'Manager sign-off needed before these move to the floor.',
      cta: { label: 'Open PCR queue', href: '/production/pcr' },
    });
  }

  // 2) Failed batches — push to waste log
  const failed = PRET_PLAN.batches.filter(b => b.status === 'failed');
  if (failed.length > 0) {
    nudges.push({
      id: 'nudge-failed-batches',
      surface: 'pcr',
      tone: 'error',
      title: `${failed.length} failed batch${failed.length === 1 ? '' : 'es'} — log waste`,
      body: failed
        .map(b => {
          const item = getProductionItem(b.productionItemId);
          const recipe = item ? getRecipe(item.recipeId) : undefined;
          return recipe?.name ?? item?.id ?? 'Unknown';
        })
        .join(', '),
      cta: { label: 'Review failed', href: '/production/pcr' },
    });
  }

  // 3) Carry-over proposals pending
  const carryPending = PRET_CARRY_OVER.length;
  if (carryPending > 0) {
    nudges.push({
      id: 'nudge-carry-over',
      surface: 'carry-over',
      tone: 'info',
      title: `${carryPending} carry-over proposal${carryPending === 1 ? '' : 's'} drafted`,
      body: 'I pulled yesterday’s unsold units forward. Quick scan and confirm before the 08:30 run.',
      cta: { label: 'Review carry-over', href: '/production/carry-over' },
    });
  }

  // 4) Spoke submission nudges live on the spoke persona only — see
  //    `getSpokeSubmissionNudges` below. The hub's Quinn doesn't surface
  //    them because the hub doesn't draft the spoke's order.

  // 5) Settings health — surface the most impactful stale/suspect items
  const healthIssues = PRET_SETTINGS_HEALTH.filter(i => i.status === 'stale' || i.status === 'suspect');
  if (healthIssues.length > 0) {
    const top = healthIssues[0];
    nudges.push({
      id: 'nudge-settings-health',
      surface: 'settings',
      tone: top.status === 'suspect' ? 'error' : 'warning',
      title: top.title,
      body: top.impactSummary ? `${top.body} · ${top.impactSummary}` : top.body,
      cta: { label: 'Open settings health', href: '/production/settings-health' },
    });

    if (healthIssues.length > 1) {
      nudges.push({
        id: 'nudge-settings-more',
        surface: 'settings',
        tone: 'info',
        title: `${healthIssues.length - 1} more setting${healthIssues.length - 1 === 1 ? '' : 's'} to review`,
        body: 'Tidy these when you get a minute — Quinn can draft the change if you ask.',
        cta: { label: 'See all', href: '/production/settings-health' },
      });
    }
  }

  // 6) Productivity (PAC169 / PAC172) — celebrate top performer + flag slow benches.
  // Anchored to yesterday so the demo always has data to work with on a fresh load.
  const yesterday = dayOffset(-1);
  const prod = siteProductivity('hub-central', [yesterday]);
  if (prod.batchCount > 0) {
    const star = prod.employees.find(e => e.avgDeltaPercent != null && e.avgDeltaPercent < -8);
    if (star) {
      nudges.push({
        id: 'nudge-productivity-star',
        surface: 'productivity',
        tone: 'success',
        title: `${star.workerName} ran ${formatDelta(star.avgDeltaPercent)} yesterday`,
        body: `${star.batchCount} batches · ${star.totalUnits} units. Worth a mention on the morning huddle.`,
        cta: { label: 'See the leaderboard', href: '/production/productivity' },
      });
    }

    const slowBench = [...prod.benches]
      .filter(b => b.avgDeltaPercent != null && b.avgDeltaPercent > 8 && b.batchCount >= 1)
      .sort((a, b) => (b.avgDeltaPercent ?? 0) - (a.avgDeltaPercent ?? 0))[0];
    if (slowBench) {
      nudges.push({
        id: 'nudge-productivity-slow-bench',
        surface: 'productivity',
        tone: 'warning',
        title: `${slowBench.benchName} ran ${formatDelta(slowBench.avgDeltaPercent)} yesterday`,
        body: `${slowBench.batchCount} batches across ${slowBench.workerCount} worker${slowBench.workerCount === 1 ? '' : 's'}. Could be equipment, recipe complexity or training. Worth a quick look.`,
        cta: { label: 'Open report', href: '/production/productivity' },
      });
    }
  }

  // 7) Sales vs forecast — flag the most-out-of-spec recipe over the last week.
  // Anchored to a 7-day window so we get stable bias signal rather than noise.
  const last7 = Array.from({ length: 7 }, (_, i) => dayOffset(-i));
  const sales = siteSalesReport('hub-central', last7);
  if (sales.recipes.length > 0) {
    // Underproducing (real demand higher than forecast) — money on the table
    const topOver = sales.recipes.find(r => r.tendency === 'overshoot' && r.variancePct >= 12);
    if (topOver) {
      nudges.push({
        id: 'nudge-sales-overshoot',
        surface: 'sales-report',
        tone: 'warning',
        title: `${topOver.recipe.name} is selling ${formatSignedPct(topOver.variancePct)} above forecast`,
        body: `Last 7 days. We're ${topOver.variance > 0 ? 'leaving' : 'covering'} ${Math.abs(topOver.variance)} units of demand. Worth uplifting the model.`,
        cta: { label: 'Review forecast', href: '/production/sales-report' },
      });
    }
    // Overproducing (forecast too high) — waste risk
    const topUnder = [...sales.recipes].reverse().find(r => r.tendency === 'undershoot' && r.variancePct <= -12);
    if (topUnder) {
      nudges.push({
        id: 'nudge-sales-undershoot',
        surface: 'sales-report',
        tone: 'error',
        title: `${topUnder.recipe.name} is overproducing — ${formatSignedPct(topUnder.variancePct)} below sales`,
        body: `Last 7 days. ${Math.abs(topUnder.variance)} units cooked but not sold. Scale the forecast down or expect carry-over.`,
        cta: { label: 'See suggestions', href: '/production/sales-report' },
      });
    }
  }

  return nudges;
}

/**
 * Spoke-only nudges — surfaced in the spoke manager's Quinn panel.
 * Today this is just the "submit your draft before cutoff" reminder, but
 * over time anything that is purely the spoke's responsibility (e.g.
 * count stock, review approvals) should slot in here.
 */
export function getSpokeSubmissionNudges(): QuinnNudge[] {
  const nudges: QuinnNudge[] = [];
  if (PRET_SPOKE_SUBMISSION.status === 'draft') {
    nudges.push({
      id: 'nudge-spoke-submission',
      surface: 'spokes',
      tone: 'warning',
      title: `Spoke order draft — cutoff ${PRET_SPOKE_SUBMISSION.cutoffDateTime}`,
      body: 'Submit before cutoff or the hub won’t cover tomorrow’s opening.',
      cta: { label: 'Submit order', href: '/production/spokes' },
    });
  }
  return nudges;
}
