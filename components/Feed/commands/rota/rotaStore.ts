/**
 * Written drafts. When the GM clicks "Write to Deputy draft", the
 * accepted lines and the resulting rota are kept here so the receipt,
 * the /labour page and a re-run of the skill can read them. Session
 * memory only: this is a prototype, and Deputy remains the system of
 * record for the rota.
 */

import { useEffect, useState } from 'react';
import type { Proposal, RuleResult, Shift, Tiles } from './types';

export interface WrittenDraft {
  siteId: string;
  siteName: string;
  weekLabel: string;
  /** Wall-clock label captured at write time ("10:42"). */
  writtenAt: string;
  accepted: Proposal[];
  declined: Proposal[];
  shifts: Shift[];
  tiles: Tiles;
  rules: RuleResult[];
  /** Deputy draft version we wrote over, for the receipt copy. */
  basedOnSync: string;
}

const drafts = new Map<string, WrittenDraft>();
const listeners = new Set<() => void>();

function emit() {
  for (const l of listeners) l();
}

export function saveWrittenDraft(d: WrittenDraft) {
  drafts.set(d.siteId, d);
  emit();
}

export function clearWrittenDraft(siteId: string) {
  drafts.delete(siteId);
  emit();
}

export function getWrittenDraft(siteId: string): WrittenDraft | undefined {
  return drafts.get(siteId);
}

export function useWrittenDraft(siteId: string | undefined): WrittenDraft | undefined {
  const [, force] = useState(0);
  useEffect(() => {
    const l = () => force((n) => n + 1);
    listeners.add(l);
    return () => {
      listeners.delete(l);
    };
  }, []);
  return siteId ? drafts.get(siteId) : undefined;
}
