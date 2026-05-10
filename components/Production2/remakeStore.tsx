'use client';

import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import {
  PRET_REMAKE_REQUEST_SEEDS,
  getRecipe,
  getSite,
  type RemakeDeliverySlot,
  type RemakeEvidence,
  type RemakeReason,
  type RemakeRequest,
  type RemakeRequestId,
  type RemakeRequestLine,
  type RemakeStatus,
  type SiteId,
} from './fixtures';

/**
 * In-memory store for spoke urgent-remake requests (PAC-remake).
 *
 * Pairs the spoke-side incident form with the hub-side urgent banner.
 * Lifecycle:
 *   submit          → 'pending'
 *   hub accept(slot) → 'accepted'
 *   hub decline      → 'declined'
 *   hub markStarted  → 'in-production'
 *   hub markDispatched(transferId) → 'dispatched'
 *
 * The seeded record opens the demo with one critical incident already on
 * the hub's plate (Clapham · temperature breach on yesterday's drop), so
 * the hub-side banner appears the moment the page loads.
 */

type RemakeStore = {
  requests: Record<RemakeRequestId, RemakeRequest>;
  /** Spoke pushes a new incident into the loop. */
  submit: (request: RemakeRequest) => void;
  /** Hub accepts and commits to a delivery slot. */
  accept: (
    id: RemakeRequestId,
    slot: RemakeDeliverySlot,
    meta: { respondedBy?: string; notes?: string },
  ) => void;
  /** Hub declines with a reason. */
  decline: (
    id: RemakeRequestId,
    declineReason: string,
    meta: { respondedBy?: string },
  ) => void;
  /** Hub flags production has started on the remake batches. */
  markStarted: (id: RemakeRequestId) => void;
  /** Hub flags the remake is on its way (closes the loop). */
  markDispatched: (id: RemakeRequestId, transferId?: string) => void;
  /** Spoke withdraws (only while pending). */
  withdraw: (id: RemakeRequestId) => void;
  /** All requests across the estate. */
  all: RemakeRequest[];
  /** Requests targeting a hub. */
  forHub: (hubId: SiteId) => RemakeRequest[];
  /** Requests this spoke raised. */
  forSpoke: (spokeId: SiteId) => RemakeRequest[];
};

const RemakeContext = createContext<RemakeStore | null>(null);

export function RemakeRequestStoreProvider({ children }: { children: React.ReactNode }) {
  const [requests, setRequests] = useState<Record<RemakeRequestId, RemakeRequest>>(() => {
    const seeded: Record<RemakeRequestId, RemakeRequest> = {};
    for (const r of PRET_REMAKE_REQUEST_SEEDS) seeded[r.id] = r;
    return seeded;
  });

  const submit = useCallback((request: RemakeRequest) => {
    setRequests(prev => ({ ...prev, [request.id]: request }));
  }, []);

  const accept = useCallback((
    id: RemakeRequestId,
    slot: RemakeDeliverySlot,
    meta: { respondedBy?: string; notes?: string },
  ) => {
    setRequests(prev => {
      const r = prev[id];
      if (!r || r.status !== 'pending') return prev;
      return {
        ...prev,
        [id]: {
          ...r,
          status: 'accepted',
          hubResponse: {
            respondedAtISO: new Date().toISOString(),
            respondedBy: meta.respondedBy,
            notes: meta.notes,
            slot,
          },
        },
      };
    });
  }, []);

  const decline = useCallback((
    id: RemakeRequestId,
    declineReason: string,
    meta: { respondedBy?: string },
  ) => {
    setRequests(prev => {
      const r = prev[id];
      if (!r || r.status !== 'pending') return prev;
      return {
        ...prev,
        [id]: {
          ...r,
          status: 'declined',
          hubResponse: {
            respondedAtISO: new Date().toISOString(),
            respondedBy: meta.respondedBy,
            declineReason,
          },
        },
      };
    });
  }, []);

  const markStarted = useCallback((id: RemakeRequestId) => {
    setRequests(prev => {
      const r = prev[id];
      if (!r || r.status !== 'accepted') return prev;
      return { ...prev, [id]: { ...r, status: 'in-production' } };
    });
  }, []);

  const markDispatched = useCallback((id: RemakeRequestId, transferId?: string) => {
    setRequests(prev => {
      const r = prev[id];
      if (!r || (r.status !== 'accepted' && r.status !== 'in-production')) return prev;
      return {
        ...prev,
        [id]: { ...r, status: 'dispatched', fulfilmentTransferId: transferId },
      };
    });
  }, []);

  const withdraw = useCallback((id: RemakeRequestId) => {
    setRequests(prev => {
      const r = prev[id];
      if (!r || r.status !== 'pending') return prev;
      const next = { ...prev };
      delete next[id];
      return next;
    });
  }, []);

  const all = useMemo(() => Object.values(requests), [requests]);
  const forHub = useCallback((hubId: SiteId) => all.filter(r => r.hubId === hubId), [all]);
  const forSpoke = useCallback((spokeId: SiteId) => all.filter(r => r.spokeId === spokeId), [all]);

  const value = useMemo<RemakeStore>(() => ({
    requests,
    submit,
    accept,
    decline,
    markStarted,
    markDispatched,
    withdraw,
    all,
    forHub,
    forSpoke,
  }), [requests, submit, accept, decline, markStarted, markDispatched, withdraw, all, forHub, forSpoke]);

  return <RemakeContext.Provider value={value}>{children}</RemakeContext.Provider>;
}

export function useRemakeRequests(): RemakeStore {
  const ctx = useContext(RemakeContext);
  if (!ctx) {
    return {
      requests: {},
      submit: () => {},
      accept: () => {},
      decline: () => {},
      markStarted: () => {},
      markDispatched: () => {},
      withdraw: () => {},
      all: [],
      forHub: () => [],
      forSpoke: () => [],
    };
  }
  return ctx;
}

/**
 * Build a RemakeRequest from a source DispatchTransfer. Centralised so
 * the spoke-side form (and any future API path) emits the same shape.
 */
export function buildRemakeRequest(args: {
  spokeId: SiteId;
  hubId: SiteId;
  sourceTransferId: string;
  sourceTransferDate: string;
  /** Mirrored from the source transfer lines. */
  lines: Array<{ skuId: string; recipeId: string; units: number }>;
  reason: RemakeReason;
  evidence: RemakeEvidence;
  submittedBy?: string;
}): RemakeRequest {
  const lines: RemakeRequestLine[] = args.lines
    .filter(ln => ln.units > 0)
    .map(ln => ({ skuId: ln.skuId, recipeId: ln.recipeId, units: ln.units }));
  return {
    id: `remake-${args.spokeId}-${Date.now()}`,
    spokeId: args.spokeId,
    hubId: args.hubId,
    sourceTransferId: args.sourceTransferId,
    sourceTransferDate: args.sourceTransferDate,
    submittedAtISO: new Date().toISOString(),
    submittedBy: args.submittedBy,
    reason: args.reason,
    evidence: args.evidence,
    lines,
    totalUnits: lines.reduce((a, ln) => a + ln.units, 0),
    status: 'pending',
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Quinn nudges
// ─────────────────────────────────────────────────────────────────────────────

export type RemakeNudge = {
  id: string;
  tone: 'error' | 'warning' | 'success' | 'info';
  title: string;
  body: string;
  cta: { label: string; href: string };
};

/** Hub-facing: pending remakes are critical-priority — never auto-dismiss. */
export function useHubRemakeNudges(hubId: SiteId): RemakeNudge[] {
  const { forHub } = useRemakeRequests();
  return useMemo(() => {
    const all = forHub(hubId);
    const pending = all.filter(r => r.status === 'pending');
    if (pending.length === 0) return [];
    const first = pending[0];
    const spokeName = getSite(first.spokeId)?.name ?? first.spokeId;
    const lineNames = first.lines.slice(0, 2).map(l => getRecipe(l.recipeId)?.name ?? l.recipeId);
    const moreLines = first.lines.length - lineNames.length;
    return [
      {
        id: 'remake-pending-hub',
        tone: 'error',
        title:
          pending.length === 1
            ? `URGENT: ${spokeName} needs a full remake (${first.totalUnits} units)`
            : `URGENT: ${pending.length} critical remake requests waiting`,
        body:
          pending.length === 1
            ? `${reasonHeadline(first.reason)} on the ${first.sourceTransferDate} drop. Affects ${lineNames.join(', ')}${moreLines > 0 ? ` + ${moreLines} more` : ''}. Open dispatch to accept a delivery slot or decline.`
            : `${pending.reduce((a, r) => a + r.totalUnits, 0)} units across ${pending.length} incident${pending.length === 1 ? '' : 's'}. These block the spoke from trading — triage immediately.`,
        cta: { label: 'Open dispatch', href: '/production/dispatch' },
      },
    ];
  }, [forHub, hubId]);
}

/** Spoke-facing: status updates after submission. */
export function useSpokeRemakeNudges(spokeId: SiteId): RemakeNudge[] {
  const { forSpoke } = useRemakeRequests();
  return useMemo(() => {
    const all = forSpoke(spokeId);
    const responded = all.filter(r => r.status !== 'pending' && r.hubResponse);
    if (responded.length === 0) return [];
    const latest = [...responded].sort((a, b) =>
      (b.hubResponse?.respondedAtISO ?? '').localeCompare(a.hubResponse?.respondedAtISO ?? '')
    )[0];
    const tone =
      latest.status === 'accepted'      ? 'success' :
      latest.status === 'declined'      ? 'error'   :
      latest.status === 'in-production' ? 'info'    :
      'success';
    const title =
      latest.status === 'declined'
        ? `Hub declined your urgent remake — ${latest.hubResponse?.declineReason ?? 'see details'}`
      : latest.status === 'in-production'
        ? `Hub is making your remake batch now`
      : latest.status === 'dispatched'
        ? `Your remake is on its way`
      : `Hub committed to ${latest.hubResponse?.slot?.label ?? 'next slot'}`;
    const body =
      latest.status === 'declined'
        ? `Your incident from ${latest.sourceTransferDate} couldn't be remade. Open the spoke page for full notes.`
      : latest.status === 'in-production'
        ? `${latest.totalUnits} units. Slot: ${latest.hubResponse?.slot?.label ?? 'next available'}.`
      : latest.status === 'dispatched'
        ? `${latest.totalUnits} units leaving the hub. Receive on the next drop.`
      : `${latest.totalUnits} units will arrive ${latest.hubResponse?.slot?.label ?? 'soon'}.`;
    return [
      {
        id: `remake-response-${latest.id}`,
        tone,
        title,
        body,
        cta: { label: 'See details', href: '/production/spokes' },
      },
    ];
  }, [forSpoke, spokeId]);
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function reasonHeadline(reason: RemakeReason): string {
  switch (reason) {
    case 'temperature-breach':     return 'Cold-chain failure';
    case 'contamination':          return 'Contamination reported';
    case 'allergen-cross-contact': return 'Allergen cross-contact';
    case 'vehicle-failure':        return 'Vehicle failure';
    case 'packaging-failure':      return 'Packaging failure';
    case 'other':                  return 'Critical incident';
  }
}
