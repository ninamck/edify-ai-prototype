'use client';

import { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ClipboardCheck, CheckCircle2, AlertCircle } from 'lucide-react';
import PCRBatchCard, { type PCRDraft } from '@/components/Production/PCRBatchCard';
import { useRole, StaffLockBanner } from '@/components/Production/RoleContext';
import { DEMO_NOW_HHMM, useBoardPlan } from '@/components/Production/PlanStore';
import {
  DEMO_TODAY,
  benchesAt,
  getProductionItem,
  type BenchId,
  type ProductionBatch,
  type BatchStatus,
} from '@/components/Production/fixtures';
import { hhmmToMinutes } from '@/components/Production/time';
import { useProductionSite } from '@/components/Production/ProductionSiteContext';

type BenchFilter = 'all' | BenchId;

export default function PCRQueuePage() {
  const { can } = useRole();
  const canSign = can('pcr.sign');
  const { siteId } = useProductionSite();
  const [benchFilter, setBenchFilter] = useState<BenchFilter>('all');
  /** Map of batchId -> signed PCR draft (locally captured this session). */
  const [signed, setSigned] = useState<Record<string, PCRDraft>>({});
  /** Map of batchId -> failed PCR draft (quality or label fail). */
  const [failed, setFailed] = useState<Record<string, PCRDraft>>({});

  // Source-of-truth batches come from the live board plan (same data the
  // Benches page renders), not the static `PRET_PLAN.batches` array which
  // references stale bench IDs. Each `PlannedInstance` is treated as a batch
  // and assigned a status by comparing its time window to `DEMO_NOW_HHMM`:
  //   end <= now           -> 'complete'   (in the awaiting queue)
  //   start <= now < end   -> 'in-progress' (excluded from queue)
  //   start > now          -> 'planned'     (excluded from queue, but shown
  //                                          as upcoming on the timeline)
  const board = useBoardPlan(siteId, DEMO_TODAY);
  const allSiteBatches: ProductionBatch[] = useMemo(() => {
    const nowMins = hhmmToMinutes(DEMO_NOW_HHMM);
    return board.plannedInstances
      .filter(pi => pi.date === DEMO_TODAY)
      .filter(pi => {
        // Only include instances at this site (defensive — board plan is
        // already site-scoped, but PRET_PLAN.plannedInstances includes all).
        const item = getProductionItem(pi.productionItemId);
        return item?.siteId === siteId;
      })
      .map(pi => {
        const start = hhmmToMinutes(pi.startTime);
        const end = hhmmToMinutes(pi.endTime);
        let status: BatchStatus = 'planned';
        if (end <= nowMins) status = 'complete';
        else if (start <= nowMins) status = 'in-progress';
        return {
          id: `pcr-${pi.id}`,
          plannedInstanceId: pi.id,
          productionItemId: pi.productionItemId,
          benchId: pi.benchId,
          date: pi.date,
          startTime: pi.startTime,
          endTime: pi.endTime,
          actualQty: pi.plannedQty,
          status,
        };
      });
  }, [board.plannedInstances, siteId]);

  // Bench filter strip. Surfaces every bench at the site (so the strip is
  // stable regardless of what's queued today), in the same order the
  // Benches page renders them. "All" is always prepended.
  const benchTabs = useMemo(() => benchesAt(siteId), [siteId]);

  // Drop filter when switching site (or when the active bench drops off the
  // strip because nothing's planned on it any more).
  useEffect(() => {
    if (benchFilter === 'all') return;
    if (!benchTabs.some(b => b.id === benchFilter)) setBenchFilter('all');
  }, [benchFilter, benchTabs]);

  function matchesBench(b: ProductionBatch): boolean {
    return benchFilter === 'all' || b.benchId === benchFilter;
  }

  // Awaiting = complete batches that the manager hasn't signed/failed in this
  // session yet. Sorted globally by start time so the queue mirrors the order
  // the benches are actually producing them in.
  const awaiting = useMemo(
    () =>
      allSiteBatches
        .filter(b => b.status === 'complete' && !signed[b.id] && !failed[b.id])
        .filter(matchesBench)
        .sort((a, b) => hhmmToMinutes(a.startTime) - hhmmToMinutes(b.startTime)),
    [allSiteBatches, signed, failed, benchFilter],
  );

  // Signed today = anything reviewed/dispatched in fixtures + anything we
  // signed in this session. Order by signedAt (most recent first) for the
  // session items; static items keep their fixture order.
  const signedToday = useMemo(() => {
    const fixtureSigned = allSiteBatches.filter(
      b => (b.status === 'reviewed' || b.status === 'dispatched') && !signed[b.id] && !failed[b.id],
    );
    const sessionSigned = allSiteBatches.filter(b => signed[b.id]);
    sessionSigned.sort((a, b) => (signed[b.id].signedAt.localeCompare(signed[a.id].signedAt)));
    return [...sessionSigned, ...fixtureSigned].filter(matchesBench);
  }, [allSiteBatches, signed, failed, benchFilter]);

  const failedToday = useMemo(() => {
    const fixtureFailed = allSiteBatches.filter(b => b.status === 'failed' && !failed[b.id]);
    const sessionFailed = allSiteBatches.filter(b => failed[b.id]);
    sessionFailed.sort((a, b) => (failed[b.id].signedAt.localeCompare(failed[a.id].signedAt)));
    return [...sessionFailed, ...fixtureFailed].filter(matchesBench);
  }, [allSiteBatches, failed, benchFilter]);

  function handleComplete(draft: PCRDraft) {
    setSigned(prev => ({ ...prev, [draft.batchId]: draft }));
    setFailed(prev => {
      if (!(draft.batchId in prev)) return prev;
      const next = { ...prev };
      delete next[draft.batchId];
      return next;
    });
  }

  function handleFail(draft: PCRDraft) {
    setFailed(prev => ({ ...prev, [draft.batchId]: draft }));
    setSigned(prev => {
      if (!(draft.batchId in prev)) return prev;
      const next = { ...prev };
      delete next[draft.batchId];
      return next;
    });
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      {/* Page caption — site picker lives in the layout (shared) */}
      <div
        style={{
          padding: '8px 16px',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          borderBottom: '1px solid var(--color-border-subtle)',
          background: '#ffffff',
          flexWrap: 'wrap',
          justifyContent: 'flex-end',
        }}
      >
        <span style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>
          {awaiting.length} awaiting · {signedToday.length} reviewed · {failedToday.length} failed
        </span>
      </div>

      {/* Bench filter strip — All + one tab per bench at the site */}
      <div
        style={{
          padding: '10px 16px',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          borderBottom: '1px solid var(--color-border-subtle)',
          background: '#ffffff',
          overflowX: 'auto',
        }}
      >
        <span
          style={{
            fontSize: 10,
            fontWeight: 700,
            color: 'var(--color-text-muted)',
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            flexShrink: 0,
          }}
        >
          Bench
        </span>
        <div
          role="tablist"
          aria-label="Filter by bench"
          style={{
            display: 'flex',
            background: 'var(--color-bg-hover)',
            borderRadius: 100,
            padding: 3,
            width: 'fit-content',
          }}
        >
          <BenchTab
            label="All"
            count={
              allSiteBatches.filter(
                b => b.status === 'complete' && !signed[b.id] && !failed[b.id],
              ).length
            }
            active={benchFilter === 'all'}
            onClick={() => setBenchFilter('all')}
          />
          {benchTabs.map(bench => {
            const count = allSiteBatches.filter(
              b => b.benchId === bench.id && b.status === 'complete' && !signed[b.id] && !failed[b.id],
            ).length;
            return (
              <BenchTab
                key={bench.id}
                label={bench.name}
                count={count}
                active={benchFilter === bench.id}
                onClick={() => setBenchFilter(bench.id)}
              />
            );
          })}
        </div>
      </div>

      <div style={{ padding: '16px 16px 32px', display: 'flex', flexDirection: 'column', gap: 18 }}>
        <StaffLockBanner reason="Only Managers can sign off PCR." />
            <Section
              icon={<ClipboardCheck size={14} color="var(--color-warning)" />}
              title="Awaiting review"
              count={awaiting.length}
              empty={awaiting.length === 0 ? 'All caught up. Nothing to sign off.' : null}
            >
              <AnimatePresence initial={false}>
                {awaiting.map(b => (
                  <motion.div
                    key={b.id}
                    layout
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.98 }}
                    transition={{ duration: 0.18 }}
                  >
                    <PCRBatchCard
                      batch={b}
                      canSign={canSign}
                      onComplete={handleComplete}
                      onFail={handleFail}
                    />
                  </motion.div>
                ))}
              </AnimatePresence>
            </Section>

            {failedToday.length > 0 && (
              <Section
                icon={<AlertCircle size={14} color="var(--color-error)" />}
                title="Failed — routed to waste"
                count={failedToday.length}
              >
                <AnimatePresence initial={false}>
                  {failedToday.map(b => (
                    <motion.div
                      key={b.id}
                      layout
                      initial={{ opacity: 0, y: -4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.98 }}
                      transition={{ duration: 0.18 }}
                    >
                      <PCRBatchCard
                        batch={b}
                        canSign={canSign}
                        failed={failed[b.id]}
                        onComplete={handleComplete}
                        onFail={handleFail}
                      />
                    </motion.div>
                  ))}
                </AnimatePresence>
              </Section>
            )}

            <Section
              icon={<CheckCircle2 size={14} color="var(--color-success)" />}
              title="Reviewed today"
              count={signedToday.length}
              empty={signedToday.length === 0 ? 'No reviews yet today.' : null}
            >
              <AnimatePresence initial={false}>
                {signedToday.map(b => (
                  <motion.div
                    key={b.id}
                    layout
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.98 }}
                    transition={{ duration: 0.18 }}
                  >
                    <PCRBatchCard
                      batch={b}
                      canSign={canSign}
                      signed={signed[b.id]}
                      onComplete={handleComplete}
                      onFail={handleFail}
                    />
                  </motion.div>
                ))}
              </AnimatePresence>
            </Section>
      </div>
    </div>
  );
}

// ─── Subcomponents ────────────────────────────────────────────────────────────

function Section({
  icon,
  title,
  count,
  children,
  empty,
}: {
  icon: React.ReactNode;
  title: string;
  count: number;
  children: React.ReactNode;
  empty?: string | null;
}) {
  return (
    <section>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
        {icon}
        <h2 style={{ fontSize: 13, fontWeight: 700, margin: 0, letterSpacing: '0.02em' }}>{title}</h2>
        <span
          style={{
            fontSize: 10,
            padding: '1px 6px',
            borderRadius: 6,
            background: 'var(--color-bg-hover)',
            color: 'var(--color-text-muted)',
            fontWeight: 700,
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          {count}
        </span>
      </div>
      {empty ? (
        <div
          style={{
            fontSize: 12,
            color: 'var(--color-text-muted)',
            padding: '12px 14px',
            border: '1px dashed var(--color-border-subtle)',
            borderRadius: 'var(--radius-card)',
          }}
        >
          {empty}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>{children}</div>
      )}
    </section>
  );
}

function BenchTab({
  label,
  count,
  active,
  onClick,
}: {
  label: string;
  count: number;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      style={{
        padding: '8px 18px',
        borderRadius: 100,
        border: 'none',
        fontSize: 13,
        fontWeight: 600,
        fontFamily: 'var(--font-primary)',
        cursor: 'pointer',
        background: active ? 'var(--color-accent-active)' : 'transparent',
        color: active ? '#ffffff' : 'var(--color-text-secondary)',
        transition: 'all 0.15s',
        display: 'inline-flex',
        alignItems: 'center',
        gap: 8,
        whiteSpace: 'nowrap',
      }}
    >
      {label}
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          minWidth: 18,
          height: 18,
          padding: '0 5px',
          borderRadius: 100,
          fontSize: 12,
          fontWeight: 700,
          background: active ? 'rgba(255,255,255,0.25)' : 'var(--color-border-subtle)',
          color: active ? '#ffffff' : 'var(--color-text-secondary)',
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        {count}
      </span>
    </button>
  );
}
