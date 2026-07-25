// Demo estate + viewer profiles for the roles & permissions dashboard mock.
// Everything here is static demo data — there is no real ACL. The three
// default briefing personas map onto the three roles in the business rules:
// Cheryl = Admin (all sites), Ed = Manager (3 sites), the Employee persona
// sees a single site.

export type SiteId = string;

export type Site = {
  id: SiteId;
  name: string;
};

/** The whole estate — 12 sites. Order is stable and used for deterministic
 *  per-site data generation. */
export const ALL_SITES: Site[] = [
  { id: 'soho', name: 'Soho' },
  { id: 'borough', name: 'Borough' },
  { id: 'fitzroy', name: 'Fitzroy' },
  { id: 'shoreditch', name: 'Shoreditch' },
  { id: 'kings-cross', name: 'Kings Cross' },
  { id: 'canary', name: 'Canary Wharf' },
  { id: 'riverside', name: 'Riverside' },
  { id: 'city', name: 'City Centre' },
  { id: 'camden', name: 'Camden' },
  { id: 'greenwich', name: 'Greenwich' },
  { id: 'brixton', name: 'Brixton' },
  { id: 'richmond', name: 'Richmond' },
];

export const ALL_SITE_IDS: SiteId[] = ALL_SITES.map((s) => s.id);

export function siteName(id: SiteId): string {
  return ALL_SITES.find((s) => s.id === id)?.name ?? id;
}

export function siteNames(ids: SiteId[]): string[] {
  // Preserve estate order so summaries read consistently.
  return ALL_SITES.filter((s) => ids.includes(s.id)).map((s) => s.name);
}

/** "Soho, Borough and Fitzroy" — plain-English site list. */
export function siteListPhrase(ids: SiteId[]): string {
  if (ids.length >= ALL_SITES.length) return `all ${ALL_SITES.length} sites`;
  const names = siteNames(ids);
  if (names.length === 0) return 'no sites';
  if (names.length === 1) return names[0];
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
}

// ── Viewers ────────────────────────────────────────────────────────────────

export type DemoRole = 'admin' | 'manager' | 'employee';

/** Persona ids that participate in the roles & permissions demo. */
export type RolesPersonaId = 'cheryl' | 'ed' | 'gm';

export type Viewer = {
  /** Which briefing persona this viewer is derived from ('view-as' previews
   *  keep the admin's persona but swap role + sites). */
  personaId: RolesPersonaId;
  role: DemoRole;
  name: string;
  siteIds: SiteId[];
  /** True while an admin is previewing through "View as". */
  previewing?: boolean;
};

export const VIEWER_BY_PERSONA: Record<RolesPersonaId, Viewer> = {
  cheryl: {
    personaId: 'cheryl',
    role: 'admin',
    name: 'Cheryl',
    siteIds: ALL_SITE_IDS,
  },
  ed: {
    personaId: 'ed',
    role: 'manager',
    name: 'Ed',
    siteIds: ['soho', 'borough', 'fitzroy'],
  },
  gm: {
    personaId: 'gm',
    role: 'employee',
    name: 'Sam',
    siteIds: ['soho'],
  },
};

export function isRolesPersona(id: string): id is RolesPersonaId {
  return id === 'cheryl' || id === 'ed' || id === 'gm';
}

export const ROLE_LABEL: Record<DemoRole, string> = {
  admin: 'Admin',
  manager: 'Manager',
  employee: 'Employee',
};
