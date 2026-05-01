import type { SiteId } from './fixtures';

/**
 * Tiny static directory of staff names per site, used to populate the
 * "Made by" dropdown on PCR cards. Demo only — a real implementation
 * would pull from the staff roster scheduled for the shift.
 *
 * The first entry per site is treated as the default selection if the
 * current user isn't in the list.
 */
const OPERATORS_BY_SITE: Record<SiteId, string[]> = {
  'hub-central': [
    'Abdoulaye Diallo',
    'Priya Naidoo',
    'Marco Rossi',
    'Hannah Lee',
    'Tomás Álvarez',
  ],
  'spoke-islington': [
    'Esme Patel',
    'Joseph Okafor',
    'Lin Chen',
    'Sara Aboud',
  ],
  'spoke-clapham': [
    'Daniel Stojanović',
    'Mei Watanabe',
    'Rashid Karimov',
    'Aoife Byrne',
  ],
  'spoke-heathrow': [
    'Olu Adebayo',
    'Hiro Tanaka',
    'Carla Mendes',
    'Yusuf Demir',
  ],
};

const FALLBACK = ['Manager on shift'];

export function operatorsForSite(siteId: SiteId): string[] {
  return OPERATORS_BY_SITE[siteId] ?? FALLBACK;
}

/**
 * Choose a sensible default operator for the made-by select. Prefers the
 * current user when their name matches one in the site list, otherwise
 * falls back to the first roster entry.
 */
export function defaultOperatorForSite(siteId: SiteId, currentUserName?: string): string {
  const list = operatorsForSite(siteId);
  if (currentUserName) {
    const trimmed = currentUserName.split('—')[0].trim();
    const match = list.find(o => o.toLowerCase() === trimmed.toLowerCase());
    if (match) return match;
  }
  return list[0];
}
