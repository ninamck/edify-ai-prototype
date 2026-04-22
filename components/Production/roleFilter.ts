import type { RoleId } from './productionStore';

export const ALL_ROLES: RoleId[] = ['planner', 'maker', 'manager', 'dispatcher', 'store_gm'];

export const ROLE_LABEL: Record<RoleId, string> = {
  planner: 'Hub Planner',
  maker: 'Maker',
  manager: 'Manager',
  dispatcher: 'Dispatcher',
  store_gm: 'Store GM',
};

export const ROLE_SHORT: Record<RoleId, string> = {
  planner: 'Planner',
  maker: 'Maker',
  manager: 'Manager',
  dispatcher: 'Dispatcher',
  store_gm: 'Store GM',
};

export const ROLE_DESCRIPTION: Record<RoleId, string> = {
  planner: 'Turns demand into plans. Locks runs, reviews exceptions.',
  maker: 'Works a bench. Starts and completes tasks hands-on.',
  manager: 'Passes PCR / label checks. Triggers replacement runs on fail.',
  dispatcher: 'Reserves stocked items and builds delivery manifests.',
  store_gm: 'Runs a spoke site. Orders, receives, logs sales.',
};

// Route visibility — used by the sidebar to hide items the current role
// shouldn't see. Hub-based roles see most of Production; spoke roles
// (Store GM) see Ordering + Receive.
const ROLE_ROUTES: Record<RoleId, string[]> = {
  planner: [
    '/',
    '/production/demand',
    '/production/plan',
    '/production/dispatch',
    '/production/pcr',
    '/production/pick',
    '/production/sales',
    '/recipes',
    '/checklists',
    '/invoices',
    '/approvals',
    '/assisted-ordering',
    '/order-history',
    '/credit-notes',
    '/dashboard',
    '/analytics',
    '/compare',
    '/suppliers',
    '/users',
    '/settings',
  ],
  maker: [
    '/production/bench',
  ],
  manager: [
    '/',
    '/production/pcr',
    '/production/demand',
    '/production/plan',
    '/recipes',
  ],
  dispatcher: [
    '/',
    '/production/dispatch',
    '/production/pick',
    '/production/plan',
  ],
  store_gm: [
    '/',
    '/ordering',
    '/receive',
    '/order-history',
    '/invoices',
    '/log-waste',
    '/checklists',
  ],
};

export function canSeeRoute(role: RoleId, href: string): boolean {
  const routes = ROLE_ROUTES[role];
  return routes.some(r => href === r || href.startsWith(r + '/') || r.startsWith(href + '/'));
}

export function defaultRouteForRole(role: RoleId): string {
  switch (role) {
    case 'planner': return '/production/demand';
    case 'maker': return '/production/bench/bench-bake/tasks';
    case 'manager': return '/production/pcr';
    case 'dispatcher': return '/production/dispatch';
    case 'store_gm': return '/ordering';
  }
}
