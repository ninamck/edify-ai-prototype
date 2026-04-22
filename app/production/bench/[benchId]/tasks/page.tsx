'use client';

import { use, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { CheckCircle2, ArrowRightCircle, Sprout } from 'lucide-react';
import Stepper from '@/components/Receiving/Stepper';
import TaskCard from '@/components/Production/primitives/TaskCard';
import {
  useBenches,
  useProductionRuns,
  useProducts,
  useMadeOutputs,
  usePcrChecks,
  startTask,
  completeTask,
  type BenchAssignment,
  type ProductionRun,
} from '@/components/Production/productionStore';
import { formatMinutes } from '@/components/Production/batchTimeLookup';
import {
  setCurrentRole,
  setCurrentSiteId,
} from '@/components/DemoControls/demoStore';
import { DEFAULT_HUB_ID } from '@/components/Production/fixtures/fitzroyCpu';
import { defaultRouteForRole } from '@/components/Production/roleFilter';

type EnrichedAssignment = {
  run: ProductionRun;
  assignment: BenchAssignment;
};

const STATUS_ORDER: Record<BenchAssignment['status'], number> = {
  in_progress: 0,
  pending: 1,
  complete: 2,
};

export default function BenchTasksPage({
  params,
}: {
  params: Promise<{ benchId: string }>;
}) {
  const { benchId } = use(params);
  const benches = useBenches();
  const runs = useProductionRuns();
  const products = useProducts();
  const madeOutputs = useMadeOutputs();
  const pcrChecks = usePcrChecks();
  const router = useRouter();

  const bench = benches.find(b => b.id === benchId);

  // Pull every assignment for this bench from locked / in-progress runs.
  const assignments: EnrichedAssignment[] = useMemo(() => {
    const out: EnrichedAssignment[] = [];
    for (const run of runs) {
      if (run.status === 'draft' || run.status === 'complete') continue;
      for (const a of run.benchAssignments) {
        if (a.benchId !== benchId) continue;
        out.push({ run, assignment: a });
      }
    }
    return out.sort((a, b) => {
      const s = STATUS_ORDER[a.assignment.status] - STATUS_ORDER[b.assignment.status];
      if (s !== 0) return s;
      return a.run.scheduledStart.localeCompare(b.run.scheduledStart);
    });
  }, [runs, benchId]);

  const pending = assignments.filter(x => x.assignment.status !== 'complete');
  const done = assignments.filter(x => x.assignment.status === 'complete');

  const [completeFor, setCompleteFor] = useState<string | null>(null);
  const [actualQty, setActualQty] = useState<number>(0);
  const [rejectCount, setRejectCount] = useState<number>(0);

  function openCompleteForm(a: BenchAssignment) {
    setCompleteFor(a.id);
    setActualQty(a.quantity);
    setRejectCount(0);
  }

  function submitComplete(runId: string, assignmentId: string) {
    completeTask({ runId, assignmentId, actualQuantity: actualQty, rejectCount });
    setCompleteFor(null);
    setActualQty(0);
    setRejectCount(0);
  }

  if (!bench) {
    return (
      <div style={{ padding: '32px 20px', textAlign: 'center', maxWidth: '480px', margin: '0 auto' }}>
        <div style={{ fontSize: '16px', fontWeight: 700, color: 'var(--color-text-primary)', marginBottom: '8px' }}>
          No bench with id &ldquo;{benchId}&rdquo;
        </div>
        <div style={{ fontSize: '13px', color: 'var(--color-text-secondary)' }}>
          Pick a different bench from the sidebar or role switcher.
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        maxWidth: '480px',
        margin: '0 auto',
        padding: '20px 16px 120px',
        fontFamily: 'var(--font-primary)',
      }}
    >
      {/* Header */}
      <div style={{ marginBottom: '18px' }}>
        <div
          style={{
            fontSize: '11px',
            fontWeight: 700,
            letterSpacing: '0.05em',
            textTransform: 'uppercase',
            color: 'var(--color-text-muted)',
            marginBottom: '4px',
          }}
        >
          My bench
        </div>
        <h1 style={{ fontSize: '26px', fontWeight: 700, color: 'var(--color-text-primary)', margin: '0 0 8px' }}>
          {bench.name}
        </h1>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '13px', color: 'var(--color-text-secondary)' }}>
          <span>
            <strong style={{ color: 'var(--color-text-primary)' }}>{pending.length}</strong> to do
          </span>
          <span>·</span>
          <span>
            <strong style={{ color: 'var(--color-text-primary)' }}>{done.length}</strong> done
          </span>
        </div>
      </div>

      {assignments.length === 0 && (
        <div
          style={{
            padding: '32px 20px',
            textAlign: 'center',
            background: 'var(--color-bg-hover)',
            border: '1px dashed var(--color-border-subtle)',
            borderRadius: 'var(--radius-card)',
          }}
        >
          <Sprout size={24} strokeWidth={2} color="var(--color-text-muted)" style={{ marginBottom: '8px' }} />
          <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--color-text-primary)', marginBottom: '4px' }}>
            No tasks yet
          </div>
          <div style={{ fontSize: '12px', color: 'var(--color-text-secondary)', lineHeight: 1.5 }}>
            Tasks appear here when the Hub Planner locks a plan that assigns products to this bench.
          </div>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
        {pending.map(({ run, assignment }) => {
          const product = products.find(p => p.id === assignment.productId);
          const inProgress = assignment.status === 'in_progress';
          const isCompleting = completeFor === assignment.id;

          return (
            <TaskCard
              key={assignment.id}
              title={product?.name ?? assignment.productId}
              headline={assignment.quantity}
              headlineLabel="units to make"
              priority={product?.priorityFlag}
              tone={inProgress ? 'in_progress' : 'pending'}
              statusLabel={inProgress ? 'In progress' : 'Ready'}
              metaRows={[
                { label: 'Est. time', value: `~${formatMinutes(assignment.estimatedMinutes)}` },
                { label: 'Run', value: run.name.split(' · ')[0] },
                { label: 'Start by', value: run.scheduledStart },
              ]}
              primaryAction={
                isCompleting
                  ? undefined
                  : inProgress
                  ? { label: 'Complete', onClick: () => openCompleteForm(assignment) }
                  : { label: 'Start', onClick: () => startTask(run.id, assignment.id) }
              }
            >
              {isCompleting && (
                <div
                  style={{
                    padding: '14px',
                    borderRadius: 'var(--radius-item)',
                    background: 'var(--color-bg-hover)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '12px',
                  }}
                >
                  <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--color-text-primary)' }}>
                    How many came out?
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
                    <span style={{ fontSize: '13px', color: 'var(--color-text-secondary)' }}>Actual made</span>
                    <Stepper value={actualQty} onChange={setActualQty} label="actual quantity" />
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
                    <span style={{ fontSize: '13px', color: 'var(--color-text-secondary)' }}>Rejects</span>
                    <Stepper value={rejectCount} onChange={setRejectCount} label="rejects" />
                  </div>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button
                      type="button"
                      onClick={() => submitComplete(run.id, assignment.id)}
                      style={{
                        flex: 1,
                        padding: '12px 14px',
                        minHeight: '48px',
                        borderRadius: '10px',
                        border: 'none',
                        background: 'var(--color-success)',
                        color: '#fff',
                        fontSize: '14px',
                        fontWeight: 700,
                        fontFamily: 'var(--font-primary)',
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '6px',
                      }}
                    >
                      <CheckCircle2 size={16} strokeWidth={2.4} />
                      Confirm
                    </button>
                    <button
                      type="button"
                      onClick={() => setCompleteFor(null)}
                      style={{
                        padding: '12px 14px',
                        minHeight: '48px',
                        borderRadius: '10px',
                        border: '1px solid var(--color-border-subtle)',
                        background: '#fff',
                        color: 'var(--color-text-secondary)',
                        fontSize: '14px',
                        fontWeight: 600,
                        fontFamily: 'var(--font-primary)',
                        cursor: 'pointer',
                      }}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </TaskCard>
          );
        })}
      </div>

      {done.length > 0 && (
        <>
          <div
            style={{
              fontSize: '11px',
              fontWeight: 700,
              letterSpacing: '0.05em',
              textTransform: 'uppercase',
              color: 'var(--color-text-muted)',
              margin: '28px 0 10px',
            }}
          >
            Done today
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {done.map(({ run, assignment }) => {
              const product = products.find(p => p.id === assignment.productId);
              const mo = madeOutputs.find(m => m.benchAssignmentId === assignment.id);
              const checked = mo ? pcrChecks.some(c => c.madeOutputId === mo.id) : false;
              return (
                <TaskCard
                  key={assignment.id}
                  title={product?.name ?? assignment.productId}
                  headline={assignment.actualQuantity ?? assignment.quantity}
                  headlineLabel={`made${assignment.rejectCount ? ` · ${assignment.rejectCount} rejected` : ''}`}
                  tone="complete"
                  statusLabel={checked ? 'PCR passed' : 'Awaiting PCR'}
                  metaRows={[{ label: 'Run', value: run.name.split(' · ')[0] }]}
                  priority={product?.priorityFlag}
                />
              );
            })}
          </div>
        </>
      )}

      {pending.length === 0 && done.length > 0 && (
        <div style={{ marginTop: '28px', textAlign: 'center' }}>
          <button
            type="button"
            onClick={() => {
              setCurrentSiteId(DEFAULT_HUB_ID);
              setCurrentRole('manager');
              router.push(defaultRouteForRole('manager'));
            }}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '9px 14px',
              borderRadius: '8px',
              background: '#fff',
              border: '1px solid var(--color-border-subtle)',
              color: 'var(--color-text-secondary)',
              fontSize: '12px',
              fontWeight: 600,
              fontFamily: 'var(--font-primary)',
              cursor: 'pointer',
            }}
          >
            <ArrowRightCircle size={13} strokeWidth={2.2} />
            Hand over to Manager for PCR
          </button>
        </div>
      )}
    </div>
  );
}
