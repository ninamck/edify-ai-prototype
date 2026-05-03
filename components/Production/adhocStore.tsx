'use client';

import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import {
  PRET_ADHOC_REQUEST_SEEDS,
  getRecipe,
  getSite,
  type AdhocRequest,
  type AdhocRequestId,
  type AdhocRequestLine,
  type AdhocRequestReason,
  type AdhocRequestStatus,
  type RecipeId,
  type SiteId,
  type SkuId,
} from './fixtures';

/**
 * In-memory store for spoke ad-hoc requests (PAC-adhoc).
 * Mirrors the rejects store shape: a single provider mounted high in the
 * production tree so every surface (spoke compose, hub review, dispatch
 * matrix augmentation, Quinn nudges) sees the same picture.
 *
 * Lifecycle:
 *   spoke `submit` → status: 'pending'
 *   hub `respond` (per-line approved units) →
 *     - all lines approved at requested qty → 'approved'
 *     - mix of approved + partial / 0      → 'partial'
 *     - every line at 0 units              → 'rejected'
 *
 * The line-level status mirrors the per-line outcome so the spoke can see
 * exactly which items the hub couldn't cover.
 */

type LineDecision = {
  /** What the hub agreed to send for this line. 0 = rejected. */
  approvedUnits: number;
  /** Optional hub note (e.g., "out of butter"). */
  hubNote?: string;
};

type AdhocStore = {
  requests: Record<AdhocRequestId, AdhocRequest>;
  /** Spoke pushes a fresh request into the loop. */
  submit: (request: AdhocRequest) => void;
  /**
   * Hub manager records a decision per-line, with optional global notes.
   * Computes record-level status + totals from the decisions.
   */
  respond: (
    id: AdhocRequestId,
    decisions: Record<string, LineDecision>,
    meta: { respondedBy?: string; notes?: string },
  ) => void;
  /** Withdraw a pending request (spoke side). No-op if already responded. */
  withdraw: (id: AdhocRequestId) => void;
  /** All requests across the estate. */
  all: AdhocRequest[];
  /** Requests targeting a particular hub (for the hub-side strip). */
  forHub: (hubId: SiteId) => AdhocRequest[];
  /** Requests this spoke submitted (for the spoke history list). */
  forSpoke: (spokeId: SiteId) => AdhocRequest[];
  /**
   * Sum of approved units for (hub, spoke, sku, forDate). Used by the
   * dispatch matrix to surface the augmentation alongside rejects.
   */
  approvedUnitsFor: (hubId: SiteId, spokeId: SiteId, skuId: SkuId, forDate: string) => number;
};

const AdhocContext = createContext<AdhocStore | null>(null);

export function AdhocRequestStoreProvider({ children }: { children: React.ReactNode }) {
  const [requests, setRequests] = useState<Record<AdhocRequestId, AdhocRequest>>(() => {
    const seeded: Record<AdhocRequestId, AdhocRequest> = {};
    for (const r of PRET_ADHOC_REQUEST_SEEDS) seeded[r.id] = r;
    return seeded;
  });

  const submit = useCallback((request: AdhocRequest) => {
    setRequests(prev => ({ ...prev, [request.id]: request }));
  }, []);

  const respond = useCallback((
    id: AdhocRequestId,
    decisions: Record<string, LineDecision>,
    meta: { respondedBy?: string; notes?: string },
  ) => {
    setRequests(prev => {
      const r = prev[id];
      if (!r || r.status !== 'pending') return prev;
      let totalApproved = 0;
      let allFull = true;
      let anyApproved = false;
      const nextLines: AdhocRequestLine[] = r.lines.map(ln => {
        const d = decisions[ln.id];
        const approved = Math.max(0, Math.min(ln.requestedUnits, d?.approvedUnits ?? 0));
        totalApproved += approved;
        if (approved === 0) {
          allFull = false;
          return { ...ln, approvedUnits: 0, hubNote: d?.hubNote, lineStatus: 'rejected' as const };
        }
        anyApproved = true;
        if (approved < ln.requestedUnits) {
          allFull = false;
          return { ...ln, approvedUnits: approved, hubNote: d?.hubNote, lineStatus: 'partial' as const };
        }
        return { ...ln, approvedUnits: approved, hubNote: d?.hubNote, lineStatus: 'approved' as const };
      });
      const status: AdhocRequestStatus =
        !anyApproved ? 'rejected' :
        allFull ? 'approved' :
        'partial';
      return {
        ...prev,
        [id]: {
          ...r,
          lines: nextLines,
          totalApprovedUnits: totalApproved,
          status,
          hubResponse: {
            respondedAtISO: new Date().toISOString(),
            respondedBy: meta.respondedBy,
            notes: meta.notes,
          },
        },
      };
    });
  }, []);

  const withdraw = useCallback((id: AdhocRequestId) => {
    setRequests(prev => {
      const r = prev[id];
      if (!r || r.status !== 'pending') return prev;
      const next = { ...prev };
      delete next[id];
      return next;
    });
  }, []);

  const all = useMemo(() => Object.values(requests), [requests]);

  const forHub = useCallback(
    (hubId: SiteId) => all.filter(r => r.hubId === hubId),
    [all],
  );
  const forSpoke = useCallback(
    (spokeId: SiteId) => all.filter(r => r.spokeId === spokeId),
    [all],
  );
  const approvedUnitsFor = useCallback(
    (hubId: SiteId, spokeId: SiteId, skuId: SkuId, forDate: string) => {
      let total = 0;
      for (const r of all) {
        if (r.hubId !== hubId || r.spokeId !== spokeId || r.forDate !== forDate) continue;
        if (r.status === 'pending' || r.status === 'rejected') continue;
        for (const ln of r.lines) {
          if (ln.skuId === skuId && ln.approvedUnits) total += ln.approvedUnits;
        }
      }
      return total;
    },
    [all],
  );

  const value = useMemo<AdhocStore>(
    () => ({
      requests,
      submit,
      respond,
      withdraw,
      all,
      forHub,
      forSpoke,
      approvedUnitsFor,
    }),
    [requests, submit, respond, withdraw, all, forHub, forSpoke, approvedUnitsFor],
  );

  return <AdhocContext.Provider value={value}>{children}</AdhocContext.Provider>;
}

export function useAdhocRequests(): AdhocStore {
  const ctx = useContext(AdhocContext);
  if (!ctx) {
    return {
      requests: {},
      submit: () => {},
      respond: () => {},
      withdraw: () => {},
      all: [],
      forHub: () => [],
      forSpoke: () => [],
      approvedUnitsFor: () => 0,
    };
  }
  return ctx;
}

/**
 * Build a fresh AdhocRequest from a list of lines + metadata. Centralised
 * here so the spoke-side compose form (and any future API/bulk paths)
 * produce the same shape.
 */
export function buildAdhocRequest(args: {
  spokeId: SiteId;
  hubId: SiteId;
  forDate: string;
  submittedBy?: string;
  reason: AdhocRequestReason;
  notes?: string;
  lines: Array<{ skuId: SkuId; recipeId: RecipeId; requestedUnits: number }>;
}): AdhocRequest {
  const ts = Date.now();
  const lines: AdhocRequestLine[] = args.lines
    .filter(ln => ln.requestedUnits > 0)
    .map((ln, i) => ({
      id: `adhoc-line-${ts}-${i}`,
      skuId: ln.skuId,
      recipeId: ln.recipeId,
      requestedUnits: ln.requestedUnits,
      lineStatus: 'pending',
    }));
  return {
    id: `adhoc-${args.spokeId}-${args.forDate}-${ts}`,
    spokeId: args.spokeId,
    hubId: args.hubId,
    forDate: args.forDate,
    submittedAtISO: new Date().toISOString(),
    submittedBy: args.submittedBy,
    reason: args.reason,
    notes: args.notes,
    lines,
    totalRequestedUnits: lines.reduce((a, ln) => a + ln.requestedUnits, 0),
    totalApprovedUnits: 0,
    status: 'pending',
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Quinn nudges
// ─────────────────────────────────────────────────────────────────────────────

export type AdhocNudge = {
  id: string;
  tone: 'warning' | 'info' | 'success' | 'error';
  title: string;
  body: string;
  cta: { label: string; href: string };
};

/** Hub-facing: pending requests need a decision. */
export function useHubAdhocNudges(hubId: SiteId): AdhocNudge[] {
  const { forHub } = useAdhocRequests();
  return useMemo(() => {
    const all = forHub(hubId);
    const pending = all.filter(r => r.status === 'pending');
    if (pending.length === 0) return [];
    const totalUnits = pending.reduce((a, r) => a + r.totalRequestedUnits, 0);
    const first = pending[0];
    const firstSpoke = getSite(first.spokeId)?.name ?? first.spokeId;
    const firstLine = first.lines[0];
    const firstRecipe = firstLine ? getRecipe(firstLine.recipeId) : undefined;
    return [
      {
        id: 'adhoc-pending-hub',
        tone: 'warning',
        title:
          pending.length === 1
            ? `${firstSpoke} requested an extra ${first.totalRequestedUnits} unit${first.totalRequestedUnits === 1 ? '' : 's'}`
            : `${pending.length} ad-hoc request${pending.length === 1 ? '' : 's'} need a decision`,
        body:
          pending.length === 1 && firstRecipe
            ? `${first.lines.length} line${first.lines.length === 1 ? '' : 's'} (incl. ${firstLine.requestedUnits}× ${firstRecipe.name}) for ${first.forDate}. Review on dispatch — approve, adjust or reject.`
            : `${totalUnits} unit${totalUnits === 1 ? '' : 's'} across ${pending.length} request${pending.length === 1 ? '' : 's'}. Open dispatch to triage.`,
        cta: { label: 'Open dispatch', href: '/production/dispatch' },
      },
    ];
  }, [forHub, hubId]);
}

/** Spoke-facing: status changes since last view (approved/partial/rejected). */
export function useSpokeAdhocNudges(spokeId: SiteId): AdhocNudge[] {
  const { forSpoke } = useAdhocRequests();
  return useMemo(() => {
    const all = forSpoke(spokeId);
    const responded = all.filter(r => r.status !== 'pending' && r.hubResponse);
    if (responded.length === 0) return [];
    // Surface the most recent decision so it doesn't flood the panel.
    const latest = [...responded].sort((a, b) =>
      (b.hubResponse?.respondedAtISO ?? '').localeCompare(a.hubResponse?.respondedAtISO ?? '')
    )[0];
    const tone =
      latest.status === 'approved' ? 'success' :
      latest.status === 'rejected' ? 'error' :
      'info';
    const title =
      latest.status === 'approved' ? `Hub approved your ${latest.totalApprovedUnits}-unit request`
      : latest.status === 'rejected' ? `Hub couldn't fulfil your request`
      : `Hub partially approved (${latest.totalApprovedUnits}/${latest.totalRequestedUnits})`;
    const body =
      latest.status === 'approved'
        ? `For ${latest.forDate}. Will be on the next drop.`
        : latest.status === 'rejected'
          ? `For ${latest.forDate}. ${latest.hubResponse?.notes ?? 'Open the spoke page for the reason.'}`
          : `For ${latest.forDate}. ${latest.hubResponse?.notes ?? 'See the line breakdown for what they could cover.'}`;
    return [
      {
        id: `adhoc-response-${latest.id}`,
        tone,
        title,
        body,
        cta: { label: 'See details', href: '/production/spokes' },
      },
    ];
  }, [forSpoke, spokeId]);
}
