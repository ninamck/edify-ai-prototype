/**
 * Deputy drafts by site id. Only sites that have a draft in the
 * workforce tool appear here; the chat says so plainly for the rest.
 */

import type { DeputyDraft } from '../types';
import { KINGS_CROSS_DEPUTY_DRAFT } from './fitzroy-kings-cross';
import { CHAGEE_FLAGSHIP_DEPUTY_DRAFT } from './chagee-flagship';

const DRAFTS: Record<string, () => DeputyDraft> = {
  'fitzroy-kings-cross': KINGS_CROSS_DEPUTY_DRAFT,
  'chagee-flagship': CHAGEE_FLAGSHIP_DEPUTY_DRAFT,
};

export function deputyDraftFor(siteId: string): DeputyDraft | undefined {
  return DRAFTS[siteId]?.();
}

export function sitesWithDrafts(): string[] {
  return Object.keys(DRAFTS);
}
