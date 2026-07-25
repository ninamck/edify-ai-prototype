'use client';

// "View as" preview state. An admin can look at any dashboard as a manager
// or employee at a given site — because every viewer sees different data, an
// admin can't verify what a manager experiences from their own all-sites
// view. Session-only by design (not persisted): a preview should never
// survive a reload and surprise the presenter.

import { useSyncExternalStore } from 'react';
import {
  ROLE_LABEL,
  siteName,
  VIEWER_BY_PERSONA,
  type DemoRole,
  type RolesPersonaId,
  type SiteId,
  type Viewer,
} from './sites';

export type ViewAsState = {
  role: Exclude<DemoRole, 'admin'>;
  siteId: SiteId;
} | null;

let viewAs: ViewAsState = null;

const listeners = new Set<() => void>();

function emit() {
  for (const l of listeners) l();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getSnapshot(): ViewAsState {
  return viewAs;
}

export function useViewAs(): ViewAsState {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

export function setViewAs(next: ViewAsState) {
  viewAs = next;
  emit();
}

export function viewAsLabel(state: NonNullable<ViewAsState>): string {
  return `${ROLE_LABEL[state.role]} at ${siteName(state.siteId)}`;
}

/**
 * The viewer whose eyes the dashboard renders through. Only admins can
 * preview; for everyone else the persona's own profile is returned.
 */
export function effectiveViewer(personaId: RolesPersonaId, preview: ViewAsState): Viewer {
  const base = VIEWER_BY_PERSONA[personaId];
  if (!preview || base.role !== 'admin') return base;
  return {
    personaId,
    role: preview.role,
    name: viewAsLabel(preview),
    siteIds: [preview.siteId],
    previewing: true,
  };
}
