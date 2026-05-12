'use client';

import { useState, useMemo } from 'react';
import HubSpokeBreakdown, {
  type SpokeDispatchRequest,
} from '@/components/Production/HubSpokeBreakdown';
import DispatchConfirmSheet, {
  type DispatchManifestEntry,
} from '@/components/Production/DispatchConfirmSheet';
import { useDispatchTransfers } from '@/components/Production/dispatchStore';
import { useSpokeRejects } from '@/components/Production/rejectsStore';
import { useHubUnlocks } from '@/components/Production/hubUnlockStore';
import {
  PRET_SITES,
  dayOffset,
  dayOfWeek,
  getRecipe,
  type DispatchTransfer,
  type RecipeId,
  type SiteId,
} from '@/components/Production/fixtures';
import type { ShortfallReallocationResult } from '@/components/Production/ShortfallReallocationModal';
import { useRole } from '@/components/Production/RoleContext';

/**
 * Dispatch › Today — hub-side aggregated view of what each spoke has
 * ordered for the next dispatch day, plus the controls to SEND those
 * drops. Pairs with the spoke-side `/production/spokes` page where
 * individual spoke managers confirm or edit Quinn's draft.
 *
 * Scope: outbound only. Incoming-from-spokes triage (rejects, ad-hoc
 * requests, urgent remakes) lives on the Today screen (/production/amounts)
 * so the hub manager has one inbox. The matrix here still consumes the
 * same stores so approved ad-hoc qty + unrolled rejects keep showing as
 * cell augmentations — but the *triage* happens on Today.
 *
 * PAC137 — one-click bulk transfer. The matrix surfaces a "Send" action on
 * each spoke control card (and a "Send all submitted" action in the
 * dispatch summary card header); confirming opens a manifest sheet, then
 * writes a `DispatchTransfer` to the page-scoped store so the matrix can
 * render the sent state immediately.
 */
export default function DispatchTodayPage() {
  // The dispatch transfer store now lives in HubOperatorProviders so the
  // production module (Today / Run sheet) and the dispatch flow share
  // a single source of truth. Once a hub manager hits Send here, the
  // unlock affordance on the production grid hides automatically.
  return <DispatchTodayPageInner />;
}

function DispatchTodayPageInner() {
  const hubs = useMemo(() => PRET_SITES.filter(s => s.type === 'HUB'), []);
  const [hubId, setHubId] = useState<SiteId>(hubs[0]?.id ?? 'hub-central');
  const forDate = dayOffset(1);

  // Pending requests fed into the confirm sheet — `null` means closed.
  const [pendingRequests, setPendingRequests] = useState<SpokeDispatchRequest[] | null>(null);
  const { recordBulkTransfer } = useDispatchTransfers();
  const { forHub: rejectsForHub, markRolled } = useSpokeRejects();
  const { hasRecord: hubHasUnlockRecord, markClosed: markUnlockClosed } = useHubUnlocks();
  const { user } = useRole();
  const sentBy = user?.name ?? 'Hub manager';

  // Shortfall reallocations applied via the matrix banner — keyed by
  // recipeId. The matrix reads this to know which rows are already
  // resolved (banner flips to green) and the request builder stamps the
  // chosen cuts + reasons onto the outgoing transfer lines.
  const [shortfallApplied, setShortfallApplied] = useState<
    Record<RecipeId, ShortfallReallocationResult>
  >({});

  // Reset shortfall state when the hub changes — supply stubs are
  // hub-scoped, so the resolutions a manager built for hub-central
  // don't apply (and shouldn't carry) to a different hub.
  function changeHub(next: SiteId) {
    setHubId(next);
    setShortfallApplied({});
  }

  function applyShortfall(result: ShortfallReallocationResult) {
    setShortfallApplied(prev => ({ ...prev, [result.recipeId]: result }));
  }

  function openSingle(req: SpokeDispatchRequest) {
    setPendingRequests([req]);
  }

  function openBulk(reqs: SpokeDispatchRequest[]) {
    setPendingRequests(reqs);
  }

  function handleConfirm(note: string | undefined, adjustedManifest: DispatchManifestEntry[]) {
    if (!pendingRequests) return;
    const nowISO = new Date().toISOString();
    // Match each pending request to the (possibly edited) manifest entry by
    // spokeId so we keep the original request's `forDate` while sending the
    // manager-adjusted line quantities.
    const adjustedBySpoke = new Map(adjustedManifest.map(m => [m.spokeId, m]));
    const transfers: DispatchTransfer[] = pendingRequests.map(req => {
      const adjusted = adjustedBySpoke.get(req.spokeId);
      return {
        id: `transfer-${hubId}-${req.spokeId}-${req.forDate}-${Date.now()}`,
        hubId,
        spokeId: req.spokeId,
        forDate: req.forDate,
        sentAtISO: nowISO,
        sentBy,
        lines: adjusted?.lines ?? req.lines,
        totalUnits: adjusted?.totalUnits ?? req.totalUnits,
        note,
      };
    });
    recordBulkTransfer(transfers);

    // PAC142 — mark any prior unrolled rejects for these (hub, spoke)
    // pairs as rolled now, so the matrix doesn't keep adding the same
    // rejects to every future drop. We mark by spoke (any reject for
    // that spoke + hub that hasn't been rolled) since the new transfer
    // is the make-up shipment by definition.
    const sentSpokeIds = new Set(transfers.map(t => t.spokeId));
    for (const r of rejectsForHub(hubId)) {
      if (!r.rolledIntoNext && sentSpokeIds.has(r.spokeId)) {
        markRolled(r.id);
      }
    }

    // PAC-unlock — close any open / consumed unlock records for the
    // (hub, spoke, day) tuples we just dispatched. The audit chip on
    // the matrix disappears once the loop is closed; the spoke-side
    // banner clears too.
    for (const t of transfers) {
      if (hubHasUnlockRecord(t.hubId, t.spokeId, t.forDate)) {
        markUnlockClosed(t.hubId, t.spokeId, t.forDate);
      }
    }

    setPendingRequests(null);
  }

  // Shape the pending requests into the confirm sheet's manifest format.
  const manifest: DispatchManifestEntry[] = useMemo(() => {
    if (!pendingRequests) return [];
    return pendingRequests.map(req => ({
      spokeId: req.spokeId,
      lines: req.lines,
      totalUnits: req.totalUnits,
      submissionStatus: req.submissionStatus,
    }));
  }, [pendingRequests]);

  // Across the pending manifest, find every recipe that had cuts
  // applied (auto-reallocated at Send or manager-edited via the matrix
  // modal). Names + auto-count drive a non-blocking info banner at the
  // top of the confirm sheet so the manager has a one-line summary
  // before scanning the per-line reason chips.
  const reallocatedRecipes = useMemo(() => {
    if (!pendingRequests) return [];
    const seen = new Set<RecipeId>();
    const names: string[] = [];
    for (const req of pendingRequests) {
      for (const line of req.lines) {
        if (line.shortfallReason === undefined) continue;
        if (seen.has(line.recipeId)) continue;
        seen.add(line.recipeId);
        names.push(getRecipe(line.recipeId)?.name ?? line.recipeId);
      }
    }
    return names;
  }, [pendingRequests]);

  // Auto vs manual split — anything not present in `shortfallApplied`
  // was filled in automatically by the matrix's effective-allocations
  // pass on Send. Pure derivation from page state; the sheet just
  // reads the numbers.
  const autoReallocatedCount = useMemo(() => {
    if (!pendingRequests) return 0;
    const seen = new Set<RecipeId>();
    let n = 0;
    for (const req of pendingRequests) {
      for (const line of req.lines) {
        if (line.shortfallReason === undefined) continue;
        if (seen.has(line.recipeId)) continue;
        seen.add(line.recipeId);
        if (!shortfallApplied[line.recipeId]) n += 1;
      }
    }
    return n;
  }, [pendingRequests, shortfallApplied]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      {/* Page header — hub picker + dispatch date caption */}
      <div
        style={{
          padding: '12px 32px',
          borderBottom: '1px solid var(--color-border-subtle)',
          background: '#ffffff',
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          flexWrap: 'wrap',
        }}
      >
        <label
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            fontSize: 10,
            color: 'var(--color-text-muted)',
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
          }}
        >
          Hub
        </label>
        <div style={{ display: 'flex', gap: 6 }}>
          {hubs.map(s => {
            const active = s.id === hubId;
            return (
              <button
                key={s.id}
                onClick={() => changeHub(s.id)}
                style={{
                  padding: '10px 14px',
                  borderRadius: 8,
                  fontSize: 11,
                  fontWeight: 600,
                  fontFamily: 'var(--font-primary)',
                  background: active ? 'var(--color-accent-active)' : '#ffffff',
                  color: active ? 'var(--color-text-on-active)' : 'var(--color-text-secondary)',
                  border: `1px solid ${active ? 'var(--color-accent-active)' : 'var(--color-border)'}`,
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                }}
              >
                {s.name}
              </button>
            );
          })}
        </div>
        <span style={{ fontSize: 10, color: 'var(--color-text-muted)', marginLeft: 'auto' }}>
          Dispatching for {forDate} ({dayOfWeek(forDate)})
        </span>
      </div>

      {/* Dispatch is for SENDING only. Incoming-from-spokes triage
          (rejects, ad-hoc requests, urgent remakes) lives on the Today
          screen so the hub manager has a single inbox for things needing
          their attention. The dispatch matrix below still reads from the
          same stores, so approved ad-hoc + unrolled rejects still
          augment the cells with their chips. */}
      <HubSpokeBreakdown
        hubId={hubId}
        forDate={forDate}
        onSendSpoke={openSingle}
        onSendAll={openBulk}
        shortfallApplied={shortfallApplied}
        onApplyShortfall={applyShortfall}
      />

      {pendingRequests && pendingRequests.length > 0 && (
        <DispatchConfirmSheet
          hubId={hubId}
          forDate={forDate}
          manifest={manifest}
          sentBy={sentBy}
          reallocatedRecipes={reallocatedRecipes}
          autoReallocatedCount={autoReallocatedCount}
          onCancel={() => setPendingRequests(null)}
          onConfirm={handleConfirm}
        />
      )}
    </div>
  );
}
