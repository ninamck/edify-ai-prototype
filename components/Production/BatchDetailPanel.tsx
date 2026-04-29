'use client';

import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import Link from 'next/link';
import { X, AlertTriangle, Split, PauseCircle, ArrowRight, ClipboardCheck, Trash2 } from 'lucide-react';
import StatusPill from './StatusPill';
import PCRGate, { type PCRSubmission } from './PCRGate';
import { SelectionTagChip, AvailabilityWindows } from './RangeTierChips';
import { wasteLogUrlForBatch } from './wasteRouting';
import { useRole } from './RoleContext';
import {
  PRET_PLAN,
  effectiveBatchRules,
  proposeBatchSplit,
  getBench,
  getProductionItem,
  getRecipe,
  getWorkflow,
  type ProductionBatch,
  type PlannedInstance,
} from './fixtures';

type Props = {
  batchId: string | null;
  onClose: () => void;
};

export default function BatchDetailPanel({ batchId, onClose }: Props) {
  const { can } = useRole();
  const canReview = can('pcr.sign');
  const [pcrOpenForBatch, setPcrOpenForBatch] = useState<string | null>(null);
  const [reviewedNow, setReviewedNow] = useState<Set<string>>(new Set());
  const [failedNow, setFailedNow] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!batchId) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [batchId, onClose]);

  const data = useMemo(() => {
    if (!batchId) return null;

    // Resolve target — could be a batch id or a planned instance id
    let batch = PRET_PLAN.batches.find(b => b.id === batchId);
    let planned = !batch ? PRET_PLAN.plannedInstances.find(pi => pi.id === batchId) : undefined;
    if (!batch && planned) {
      batch = PRET_PLAN.batches.find(b => b.plannedInstanceId === planned!.id);
    }
    if (batch && !planned && batch.plannedInstanceId) {
      planned = PRET_PLAN.plannedInstances.find(pi => pi.id === batch!.plannedInstanceId);
    }
    if (!batch && !planned) return null;

    const productionItemId = batch?.productionItemId ?? planned?.productionItemId;
    const benchId = batch?.benchId ?? planned?.benchId;
    if (!productionItemId || !benchId) return null;

    const item = getProductionItem(productionItemId);
    const bench = getBench(benchId);
    if (!item || !bench) return null;
    const recipe = getRecipe(item.recipeId);
    const workflow = recipe ? getWorkflow(recipe.workflowId) : undefined;
    if (!recipe) return null;

    // Qty preference: actual (if a batch exists) else planned
    const displayQty = batch?.actualQty ?? planned?.plannedQty ?? 0;
    const startTime = batch?.startTime ?? planned?.startTime ?? '';
    const endTime = batch?.endTime ?? planned?.endTime ?? '';
    const date = batch?.date ?? planned?.date ?? '';
    const status = batch?.status ?? 'planned';

    const eff = effectiveBatchRules(recipe.batchRules, bench.batchRules);
    const split = Number.isFinite(eff.max)
      ? proposeBatchSplit(displayQty, eff)
      : { batches: [displayQty], total: displayQty, overshoot: 0, undershoot: 0 };
    const violatesMax = Number.isFinite(eff.max) && displayQty > eff.max;

    // Siblings: same productionItem + same date
    const siblings = PRET_PLAN.plannedInstances.filter(
      pi => pi.productionItemId === item.id && pi.date === date,
    );
    const siblingBatches = PRET_PLAN.batches.filter(
      b => b.productionItemId === item.id && b.date === date,
    );
    const plannedTotal = siblings.reduce((a, b) => a + b.plannedQty, 0);

    return {
      batch,
      planned,
      item,
      recipe,
      bench,
      workflow,
      eff,
      split,
      violatesMax,
      siblings,
      siblingBatches,
      plannedTotal,
      displayQty,
      startTime,
      endTime,
      date,
      status,
    };
  }, [batchId]);

  if (typeof document === 'undefined') return null;

  return createPortal(
    <AnimatePresence>
      {batchId && data && (
        <>
          {/* Backdrop */}
          <motion.div
            key="batch-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            onClick={onClose}
            style={{
              position: 'fixed',
              inset: 0,
              background: 'rgba(12, 20, 44, 0.35)',
              zIndex: 1200,
            }}
          />
          {/* Drawer */}
          <motion.aside
            key="batch-drawer"
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 320 }}
            style={{
              position: 'fixed',
              right: 0,
              top: 0,
              bottom: 0,
              width: 'min(480px, 100vw)',
              zIndex: 1201,
              display: 'flex',
              flexDirection: 'column',
              background: '#ffffff',
              boxShadow: '-8px 0 32px rgba(12,20,44,0.18)',
              fontFamily: 'var(--font-primary)',
              overflow: 'hidden',
            }}
          >
            <PanelHeader
              title={data.recipe.name}
              subtitle={`${data.bench.name} · ${data.startTime}–${data.endTime}`}
              onClose={onClose}
              mode={data.item.mode}
              status={data.status}
            />

            <div style={{ flex: 1, overflow: 'auto', padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 18 }}>
              {/* Quantity hero */}
              <QuantityHero
                qty={data.displayQty}
                plannedQty={data.batch ? data.planned?.plannedQty : undefined}
                unit={data.item.mode === 'increment' && data.item.recipeId === 'prec-brewed-coffee' ? 'urns' : 'units'}
              />

              {/* Batch rule card */}
              <BatchRuleCard eff={data.eff} recipe={data.recipe} bench={data.bench} />

              {/* Violation + split proposal */}
              {data.violatesMax && (
                <ViolationCard
                  attemptedQty={data.displayQty}
                  eff={data.eff}
                  split={data.split}
                  onSplit={() => {
                    console.log('Split accepted', { target: batchId, split: data.split.batches });
                    onClose();
                  }}
                  onHold={() => {
                    console.log('Hold at max accepted', { target: batchId, newQty: data.eff.max });
                    onClose();
                  }}
                />
              )}

              {/* Workflow breadcrumb */}
              {data.workflow && (
                <WorkflowBreadcrumb
                  stages={data.workflow.stages.map(s => ({
                    id: s.id,
                    label: s.label,
                    leadOffset: s.leadOffset,
                    isCurrent: data.planned?.stageId === s.id,
                  }))}
                />
              )}

              {/* Tier availability + selection tags */}
              <section>
                <SectionHeader title="Sellable window + tags" />
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 8,
                    padding: '10px 12px',
                    border: '1px solid var(--color-border-subtle)',
                    borderRadius: 'var(--radius-card)',
                    background: '#ffffff',
                  }}
                >
                  <AvailabilityWindows
                    skuId={data.item.skuId}
                    siteId={data.item.siteId}
                    date={data.date ?? ''}
                  />
                  {data.recipe.selectionTags.length > 0 && (
                    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                      {data.recipe.selectionTags.map(t => (
                        <SelectionTagChip key={t} tag={t} size="xs" />
                      ))}
                    </div>
                  )}
                </div>
              </section>

              {/* Daily plan context */}
              <PlanContext
                recipeName={data.recipe.name}
                mode={data.item.mode}
                plannedTotal={data.plannedTotal}
                siblingCount={data.siblings.length}
                completedCount={data.siblingBatches.filter(b => b.status === 'reviewed' || b.status === 'dispatched').length}
              />
            </div>

            {/* Action footer — primary CTA depends on state */}
            {data.batch && (data.batch.status === 'failed' || failedNow.has(data.batch.id)) ? (
              <FailedFooter wasteUrl={wasteLogUrlForBatch(data.batch)} />
            ) : data.batch && (data.batch.status === 'complete' || reviewedNow.has(data.batch.id)) ? (
              <ActionFooter
                status={reviewedNow.has(data.batch.id) ? 'reviewed' : data.batch.status}
                canReview={canReview}
                onReview={() => setPcrOpenForBatch(data.batch!.id)}
              />
            ) : (
              <PanelFooter />
            )}
          </motion.aside>

          <PCRGate
            batchId={pcrOpenForBatch}
            onClose={() => setPcrOpenForBatch(null)}
            onSubmit={(pcr: PCRSubmission) => {
              console.log('PCR submitted', pcr);
              if (pcr.qualityCheck === false) {
                setFailedNow(prev => new Set(prev).add(pcr.batchId));
              } else {
                setReviewedNow(prev => new Set(prev).add(pcr.batchId));
              }
              setPcrOpenForBatch(null);
            }}
          />
        </>
      )}
    </AnimatePresence>,
    document.body,
  );
}

function FailedFooter({ wasteUrl }: { wasteUrl: string }) {
  return (
    <div
      style={{
        flexShrink: 0,
        padding: '12px 20px',
        borderTop: '1px solid var(--color-error-border)',
        background: 'var(--color-error-light)',
        display: 'flex',
        gap: 10,
        alignItems: 'center',
      }}
    >
      <AlertTriangle size={14} color="var(--color-error)" style={{ flexShrink: 0 }} />
      <span style={{ fontSize: 11, color: 'var(--color-text-primary)', lineHeight: 1.4 }}>
        Failed batch routed to waste. Quinn has queued a remake against the day&rsquo;s plan.
      </span>
      <div style={{ flex: 1 }} />
      <Link
        href={wasteUrl}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          padding: '10px 14px',
          borderRadius: 8,
          fontSize: 12,
          fontWeight: 700,
          fontFamily: 'var(--font-primary)',
          cursor: 'pointer',
          background: 'var(--color-error)',
          color: '#ffffff',
          border: '1px solid var(--color-error)',
          minHeight: 40,
          whiteSpace: 'nowrap',
          textDecoration: 'none',
        }}
      >
        <Trash2 size={14} /> Log to waste
      </Link>
    </div>
  );
}

function ActionFooter({ status, canReview, onReview }: { status: string; canReview: boolean; onReview: () => void }) {
  const isReviewed = status === 'reviewed';
  const disabled = isReviewed || !canReview;
  return (
    <div
      style={{
        flexShrink: 0,
        padding: '12px 20px',
        borderTop: '1px solid var(--color-border-subtle)',
        background: 'var(--color-bg-hover)',
        display: 'flex',
        gap: 10,
        alignItems: 'center',
      }}
    >
      <span style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>
        {isReviewed
          ? 'Signed & released — batch moved to reviewed.'
          : canReview
          ? 'Production complete — awaiting review.'
          : 'Manager sign-off needed before release.'}
      </span>
      <div style={{ flex: 1 }} />
      <button
        type="button"
        disabled={disabled}
        onClick={onReview}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          padding: '10px 14px',
          borderRadius: 8,
          fontSize: 12,
          fontWeight: 700,
          fontFamily: 'var(--font-primary)',
          cursor: disabled ? 'not-allowed' : 'pointer',
          background: disabled ? 'var(--color-bg-hover)' : 'var(--color-accent-active)',
          color: disabled ? 'var(--color-text-muted)' : 'var(--color-text-on-active)',
          border: `1px solid ${disabled ? 'var(--color-border)' : 'var(--color-accent-active)'}`,
          minHeight: 40,
          opacity: disabled ? 0.6 : 1,
        }}
      >
        <ClipboardCheck size={14} /> {isReviewed ? 'Reviewed' : canReview ? 'Review batch' : 'Manager reviews'}
      </button>
    </div>
  );
}

// ─── Subcomponents ────────────────────────────────────────────────────────────

function PanelHeader({
  title,
  subtitle,
  onClose,
  mode,
  status,
}: {
  title: string;
  subtitle: string;
  onClose: () => void;
  mode: 'run' | 'variable' | 'increment';
  status: ProductionBatch['status'];
}) {
  const modeLabels = { run: 'Run', variable: 'Variable', increment: 'Increment' };
  return (
    <header
      style={{
        flexShrink: 0,
        padding: '14px 20px 12px',
        borderBottom: '1px solid var(--color-border-subtle)',
        background: '#ffffff',
        display: 'flex',
        flexDirection: 'column',
        gap: 6,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
          <StatusPill tone="brand" label={modeLabels[mode]} size="xs" />
          <StatusPill status={status} size="xs" />
        </div>
        <button
          onClick={onClose}
          aria-label="Close"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 32,
            height: 32,
            borderRadius: 8,
            background: 'transparent',
            border: '1px solid var(--color-border-subtle)',
            cursor: 'pointer',
            color: 'var(--color-text-secondary)',
          }}
        >
          <X size={16} />
        </button>
      </div>
      <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: 'var(--color-text-primary)' }}>
        {title}
      </h2>
      <p style={{ margin: 0, fontSize: 12, color: 'var(--color-text-muted)' }}>{subtitle}</p>
    </header>
  );
}

function QuantityHero({ qty, plannedQty, unit }: { qty: number; plannedQty?: number; unit: string }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'baseline',
        gap: 12,
        padding: '12px 16px',
        border: '1px solid var(--color-border-subtle)',
        borderRadius: 'var(--radius-card)',
        background: '#ffffff',
      }}
    >
      <span style={{ fontSize: 40, fontWeight: 700, fontVariantNumeric: 'tabular-nums', color: 'var(--color-text-primary)', lineHeight: 1 }}>
        {qty}
      </span>
      <span style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>
        {unit}
        {plannedQty !== undefined && plannedQty !== qty && (
          <> · planned <span style={{ color: 'var(--color-text-primary)', fontWeight: 600 }}>{plannedQty}</span></>
        )}
      </span>
    </div>
  );
}

function BatchRuleCard({
  eff,
  recipe,
  bench,
}: {
  eff: ReturnType<typeof effectiveBatchRules>;
  recipe: { batchRules?: { min: number; max: number; multipleOf: number }; name: string };
  bench: { batchRules?: { min: number; max: number; multipleOf: number }; name: string };
}) {
  const line = (
    label: string,
    rules: { min: number; max: number; multipleOf: number } | undefined,
    active: boolean,
  ) => (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '8px 10px',
        borderRadius: 8,
        border: `1px solid ${active ? 'var(--color-accent-active)' : 'var(--color-border-subtle)'}`,
        background: active ? 'var(--color-badge-active-bg)' : '#ffffff',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span
          style={{
            width: 8,
            height: 8,
            borderRadius: '50%',
            background: active ? 'var(--color-accent-active)' : 'var(--color-border)',
          }}
        />
        <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-text-primary)' }}>{label}</span>
      </div>
      <span style={{ fontSize: 12, color: 'var(--color-text-secondary)', fontVariantNumeric: 'tabular-nums' }}>
        {rules ? `${rules.min}–${rules.max} · ×${rules.multipleOf}` : '—'}
      </span>
    </div>
  );

  const bindingLabel =
    eff.binding === 'recipe' ? 'Recipe wins' :
    eff.binding === 'bench' ? 'Bench wins' :
    eff.binding === 'recipe+bench' ? 'Both agree' : 'No rules';

  return (
    <section>
      <SectionHeader title="Batch rules" trailing={<StatusPill tone="neutral" label={bindingLabel} size="xs" />} />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {line(`Recipe · ${recipe.name}`, recipe.batchRules, eff.binding === 'recipe' || eff.binding === 'recipe+bench')}
        {line(`Bench · ${bench.name}`, bench.batchRules, eff.binding === 'bench' || eff.binding === 'recipe+bench')}
        <div
          style={{
            padding: '10px 12px',
            borderRadius: 8,
            background: 'var(--color-success-light)',
            border: '1px solid var(--color-success-border)',
            display: 'flex',
            flexDirection: 'column',
            gap: 4,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--color-success)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Effective
            </span>
            <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--color-success)', fontVariantNumeric: 'tabular-nums' }}>
              {eff.min}–{Number.isFinite(eff.max) ? eff.max : '∞'} · ×{eff.multipleOf}
            </span>
          </div>
          <p style={{ margin: 0, fontSize: 12, color: 'var(--color-text-secondary)', lineHeight: 1.4 }}>
            {eff.explain}
          </p>
        </div>
      </div>
    </section>
  );
}

function ViolationCard({
  attemptedQty,
  eff,
  split,
  onSplit,
  onHold,
}: {
  attemptedQty: number;
  eff: ReturnType<typeof effectiveBatchRules>;
  split: { batches: number[]; total: number; overshoot: number; undershoot: number };
  onSplit: () => void;
  onHold: () => void;
}) {
  return (
    <section>
      <SectionHeader
        title="Batch exceeds effective max"
        trailing={<StatusPill tone="error" label={`+${attemptedQty - (eff.max as number)} over`} size="xs" />}
      />
      <div
        style={{
          padding: '12px 14px',
          border: '1px solid var(--color-error-border)',
          borderRadius: 'var(--radius-card)',
          background: 'var(--color-error-light)',
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
          <AlertTriangle size={16} color="var(--color-error)" style={{ flexShrink: 0, marginTop: 1 }} />
          <p style={{ margin: 0, fontSize: 12, color: 'var(--color-text-primary)', lineHeight: 1.5 }}>
            Tried <strong>{attemptedQty}</strong> in a single batch.
            {' '}Effective cap is <strong>{eff.max}</strong>.
            {' '}Outcome: over-capacity run — quality and yield degrade.
          </p>
        </div>

        {/* Split preview */}
        <div
          style={{
            background: '#ffffff',
            borderRadius: 8,
            padding: 10,
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Quinn proposes
            </span>
            <span style={{ fontSize: 12, color: 'var(--color-text-primary)', fontVariantNumeric: 'tabular-nums' }}>
              {split.batches.length} batches · total {split.total}
              {split.overshoot > 0 && ` (+${split.overshoot} surplus)`}
              {split.undershoot > 0 && ` (−${split.undershoot} short)`}
            </span>
          </div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {split.batches.map((b, i) => (
              <span
                key={i}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  padding: '4px 8px',
                  borderRadius: 6,
                  background: 'var(--color-bg-hover)',
                  border: '1px solid var(--color-border-subtle)',
                  fontSize: 12,
                  fontWeight: 700,
                  fontVariantNumeric: 'tabular-nums',
                  color: 'var(--color-text-primary)',
                }}
              >
                {b}
              </span>
            ))}
          </div>
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            type="button"
            onClick={onSplit}
            style={actionBtnStyle('primary')}
          >
            <Split size={14} /> Split into {split.batches.length}
          </button>
          <button
            type="button"
            onClick={onHold}
            style={actionBtnStyle('secondary')}
          >
            <PauseCircle size={14} /> Hold at {eff.max}
          </button>
        </div>
      </div>
    </section>
  );
}

function WorkflowBreadcrumb({
  stages,
}: {
  stages: Array<{ id: string; label: string; leadOffset: number; isCurrent: boolean }>;
}) {
  return (
    <section>
      <SectionHeader title="Workflow" />
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
        {stages.map((s, i) => (
          <div key={s.id} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <div
              style={{
                display: 'inline-flex',
                flexDirection: 'column',
                alignItems: 'flex-start',
                padding: '6px 10px',
                borderRadius: 8,
                background: s.isCurrent ? 'var(--color-accent-active)' : '#ffffff',
                color: s.isCurrent ? 'var(--color-text-on-active)' : 'var(--color-text-primary)',
                border: `1px solid ${s.isCurrent ? 'var(--color-accent-active)' : 'var(--color-border-subtle)'}`,
              }}
            >
              <span style={{ fontSize: 12, fontWeight: 600 }}>{s.label}</span>
              <span style={{ fontSize: 10, opacity: 0.7, fontVariantNumeric: 'tabular-nums' }}>
                {s.leadOffset === 0 ? 'D0' : `D${s.leadOffset}`}
              </span>
            </div>
            {i < stages.length - 1 && <ArrowRight size={14} color="var(--color-text-muted)" />}
          </div>
        ))}
      </div>
    </section>
  );
}

function PlanContext({
  recipeName,
  mode,
  plannedTotal,
  siblingCount,
  completedCount,
}: {
  recipeName: string;
  mode: 'run' | 'variable' | 'increment';
  plannedTotal: number;
  siblingCount: number;
  completedCount: number;
}) {
  return (
    <section>
      <SectionHeader title="Today's plan for this recipe" />
      <div
        style={{
          padding: '12px 14px',
          border: '1px solid var(--color-border-subtle)',
          borderRadius: 'var(--radius-card)',
          background: '#ffffff',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 12,
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text-primary)' }}>{recipeName}</span>
          <span style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>
            {mode === 'increment' ? 'Continuous cadence' : `${siblingCount} ${siblingCount === 1 ? 'batch' : 'batches'} planned`}
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 20, fontWeight: 700, fontVariantNumeric: 'tabular-nums', lineHeight: 1 }}>
              {plannedTotal}
            </div>
            <div style={{ fontSize: 10, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Day total
            </div>
          </div>
          <StatusPill
            tone={completedCount === siblingCount && siblingCount > 0 ? 'success' : 'neutral'}
            label={`${completedCount}/${siblingCount} done`}
            size="xs"
          />
        </div>
      </div>
    </section>
  );
}

function PanelFooter() {
  return (
    <div
      style={{
        flexShrink: 0,
        padding: '10px 20px',
        borderTop: '1px solid var(--color-border-subtle)',
        background: 'var(--color-bg-hover)',
        fontSize: 10,
        color: 'var(--color-text-muted)',
        letterSpacing: '0.02em',
      }}
    >
      Tap any bench block on the board to inspect. Esc to close.
    </div>
  );
}

function SectionHeader({ title, trailing }: { title: string; trailing?: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
      <span
        style={{
          fontSize: 11,
          fontWeight: 700,
          color: 'var(--color-text-muted)',
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
        }}
      >
        {title}
      </span>
      {trailing}
    </div>
  );
}

function actionBtnStyle(kind: 'primary' | 'secondary'): React.CSSProperties {
  return {
    flex: 1,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    padding: '10px 12px',
    borderRadius: 8,
    fontSize: 12,
    fontWeight: 600,
    fontFamily: 'var(--font-primary)',
    cursor: 'pointer',
    background: kind === 'primary' ? 'var(--color-accent-active)' : '#ffffff',
    color: kind === 'primary' ? 'var(--color-text-on-active)' : 'var(--color-text-primary)',
    border: `1px solid ${kind === 'primary' ? 'var(--color-accent-active)' : 'var(--color-border)'}`,
    minHeight: 40,
  };
}

export type { PlannedInstance };
