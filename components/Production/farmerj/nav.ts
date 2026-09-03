/**
 * Farmer J production navigation. Shared by the /production layout (tab
 * strips) and the sidebar (Run / Plan highlighting) so both read one list.
 *
 * Farmer J scratch-cooks in every shop. No hub, no dispatch, no benches.
 * The kitchen lead's day runs top-down from finished products:
 *   • Run  = today on the floor. Day plan (cast irons and batches per
 *            dish, main line vs second make line), the prep list it
 *            cascades to, each person's section with AM/PM tasks and
 *            timing prompts, the end-of-day close (carryover count) and
 *            the production record (planned, made, sold, left, who).
 *   • Plan = shaping ahead. The twice-weekly plan managers set on Monday
 *            and Friday, Jana's cross-shop board and the central setup she
 *            owns (yield, shelf life, production days, portion-to-batch
 *            mapping). Ordering lives in the Orders area (Predictive
 *            ordering), built from the same plans.
 * Routes are Farmer J-only so they never collide with the Pret or Burger
 * King pages that share /production.
 */

export type FjSubTab = { id: string; label: string; href: string };

export const FJ_RUN_TABS: FjSubTab[] = [
  { id: 'day',        label: 'Day plan',   href: '/production/day' },
  { id: 'prep-list',  label: 'Prep list',  href: '/production/prep-list' },
  { id: 'sections',   label: 'Sections',   href: '/production/sections' },
  { id: 'close',      label: 'Close',      href: '/production/close' },
  { id: 'record',     label: 'Record',     href: '/production/record' },
];

export const FJ_PLAN_TABS: FjSubTab[] = [
  { id: 'week',  label: 'Week plan', href: '/production/week' },
  { id: 'shops', label: 'Shops',     href: '/production/shops' },
  { id: 'setup', label: 'Setup',     href: '/production/setup' },
];

/** Where each sidebar entry lands. */
export const FJ_RUN_HOME = FJ_RUN_TABS[0].href;
export const FJ_PLAN_HOME = FJ_PLAN_TABS[0].href;

const FJ_RUN_PREFIXES = FJ_RUN_TABS.map(t => t.href);

export function isFarmerJRunPath(pathname: string): boolean {
  return FJ_RUN_PREFIXES.some(p => pathname === p || pathname.startsWith(p + '/'));
}
