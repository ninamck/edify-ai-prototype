/**
 * The people the walkthroughs play. Names are made up; the roles are Pret's.
 * Keyed by the persona ids in ActiveSiteContext.
 */
export type PretPerson = { name: string; role: string };

const BY_PERSONA: Record<string, PretPerson> = {
  'fitzroy-espresso': { name: 'Tom Bailey', role: 'Hub kitchen leader' },
  'fitzroy-kings-cross': { name: 'Priya Shah', role: 'Shop manager' },
  'fitzroy-heathrow': { name: 'Marta Silva', role: 'Shop manager' },
  'fitzroy-gatwick': { name: 'Dan Kerr', role: 'Hub kitchen leader' },
  'fitzroy-islington': { name: 'Jo Evans', role: 'Shop manager' },
  'all-sites': { name: 'Leah Morgan', role: 'Support Centre supply chain' },
};

export const SUPPORT_CENTRE: PretPerson = BY_PERSONA['all-sites'];

/** Support Centre cash office: sets cash rules and follows up on cash across the estate. */
export const CASH_OFFICE: PretPerson = { name: 'Ruth Adeyemi', role: 'Support Centre cash office' };

/** Team member who counts on a phone at the Spoke. */
export const TEAM_MEMBER: PretPerson = { name: 'Ade Okoro', role: 'Team member' };

export function personFor(personaId: string): PretPerson {
  return BY_PERSONA[personaId] ?? { name: 'Shop manager', role: 'Shop manager' };
}

/** Production fixture site id to the person who manages it. */
const BY_PRODUCTION_SITE: Record<string, PretPerson> = {
  'hub-central': BY_PERSONA['fitzroy-espresso'],
  'site-spoke-south': BY_PERSONA['fitzroy-kings-cross'],
  'site-spoke-east': { name: 'Sam Reid', role: 'Shop manager' },
  'site-spoke-west': { name: 'Hannah Cole', role: 'Shop manager' },
  'site-hybrid-airport': BY_PERSONA['fitzroy-heathrow'],
  'site-hybrid-hub-gatwick': BY_PERSONA['fitzroy-gatwick'],
  'site-standalone-north': BY_PERSONA['fitzroy-islington'],
};

export function personForSite(siteId: string): PretPerson {
  return BY_PRODUCTION_SITE[siteId] ?? { name: 'Shop manager', role: 'Shop manager' };
}
