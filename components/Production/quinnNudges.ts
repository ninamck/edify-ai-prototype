import {
  PRET_PLAN,
  PRET_CARRY_OVER,
  PRET_SETTINGS_HEALTH,
  PRET_SPOKE_SUBMISSION,
  getProductionItem,
  getRecipe,
} from './fixtures';

export type QuinnNudgeTone = 'info' | 'warning' | 'error' | 'success';

export type QuinnNudge = {
  id: string;
  surface: 'board' | 'pcr' | 'carry-over' | 'spokes' | 'settings' | 'setup' | 'plan';
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

  // 4) Spoke submission not yet submitted
  if (PRET_SPOKE_SUBMISSION.status === 'draft') {
    nudges.push({
      id: 'nudge-spoke-submission',
      surface: 'spokes',
      tone: 'warning',
      title: `Spoke order draft — cutoff ${PRET_SPOKE_SUBMISSION.cutoff}`,
      body: 'Submit before cutoff or the hub won’t cover tomorrow’s opening.',
      cta: { label: 'Submit order', href: '/production/spokes' },
    });
  }

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

  return nudges;
}
