/**
 * Natural-language parser for the rota rebalance skill.
 *
 * Fires on rota / roster / schedule / shifts / labour phrasing with a
 * checking or balancing verb, or on a bare "rota". Pulls an optional
 * site name and an optional labour target ("keep us under 27%").
 *
 *   "Check next week's rota against the forecast"
 *   "Rebalance King's Cross rota, keep labour under 27%"
 *   "Is the Kings Cross rota right for Saturday?"
 *   "/rota"
 */

import type { CommandIntent } from '../types';
import { ACTIVE_SITES } from '@/components/ActiveSite/ActiveSiteContext';
import { sitesWithDrafts } from './deputy';

const NOUN = /\b(rota|roster|rosters|schedule|shifts?|labour|staffing|rostered)\b/i;
const VERB = /\b(check|rebalance|balance|review|fix|tidy|look at|compare|right|match|against|under|below|cut|trim|save)\b/i;

function normalise(s: string): string {
  return s.toLowerCase().replace(/[’']/g, '').replace(/\s+/g, ' ').trim();
}

/** Match a site by name from the prompt. Tries the sites that have a
 *  Deputy draft first so "kings cross" wins over a partial match. */
export function siteFromText(text: string): { id: string; name: string } | null {
  const t = normalise(text);
  const withDrafts = new Set(sitesWithDrafts());
  const ordered = [...ACTIVE_SITES].sort((a, b) => Number(withDrafts.has(b.id)) - Number(withDrafts.has(a.id)));
  for (const s of ordered) {
    if (s.id === 'all-sites') continue;
    const full = normalise(s.name);
    if (t.includes(full)) return { id: s.id, name: s.name };
    // Last word of the name ("kings cross", "heathrow", "flagship").
    const tail = full.replace(/^(fitzroy|burger king|chagee)\s*[—-]?\s*/i, '').trim();
    if (tail.length >= 4 && t.includes(tail)) return { id: s.id, name: s.name };
  }
  return null;
}

/** Intraday: an order has landed with lead time and the question is
 *  whether to move a break or a start today, not next week's rota. */
const NUDGE = /\b(group order|pre-?order|bulk order|big order|large order)\b.*\b(landed|came in|just|confirmed|arrived|for (today|this afternoon|\d{1,2}(:\d{2})?))\b|\b(landed|came in|just confirmed)\b.*\b(group order|pre-?order|bulk order)\b|^\/rota\s+nudge\b|\bintraday\b/i;

export function parseRotaRebalance(text: string): CommandIntent | null {
  const t = text.trim();
  const slash = /^\/(rota|roster|labour)\b/i.test(t);
  const lower = t.toLowerCase();

  if (NUDGE.test(t)) {
    const args: Record<string, unknown> = { nudge: true };
    const site = siteFromText(t);
    if (site) {
      args.siteId = site.id;
      args.siteName = site.name;
    }
    return { commandId: 'rota-rebalance', args, confidence: 0.9 };
  }

  if (!slash) {
    if (!NOUN.test(lower)) return null;
    const bare = /^(the\s+)?(rota|roster)\b/i.test(lower) && lower.split(' ').length <= 3;
    if (!bare && !VERB.test(lower)) return null;
    // "shifts" alone is too broad (stock shifts, menu shifts). Require a
    // rota-ish companion.
    if (/\bshifts?\b/.test(lower) && !/\b(rota|roster|next week|this week|forecast|labour|cover)\b/.test(lower)) return null;
  }

  const args: Record<string, unknown> = {};
  const site = siteFromText(t);
  if (site) {
    args.siteId = site.id;
    args.siteName = site.name;
  }
  const target = lower.match(/(?:under|below|to|at|max(?:imum)?)\s*(\d{1,2}(?:\.\d)?)\s*%/) ?? lower.match(/(\d{1,2}(?:\.\d)?)\s*%\s*labour/);
  if (target) args.targetPct = Number(target[1]);
  if (/\bstation/.test(lower)) args.view = 'station';

  return { commandId: 'rota-rebalance', args, confidence: slash ? 1 : 0.9 };
}
