'use client';

import { useMemo, useState } from 'react';
import { ClipboardCheck, CheckCircle2, AlertCircle } from 'lucide-react';
import Link from 'next/link';
import { Trash2 } from 'lucide-react';
import PCRGate, { type PCRSubmission } from '@/components/Production/PCRGate';
import StatusPill from '@/components/Production/StatusPill';
import { wasteLogUrlForBatch } from '@/components/Production/wasteRouting';
import { useRole, StaffLockBanner } from '@/components/Production/RoleContext';
import {
  PRET_PLAN,
  DEMO_TODAY,
  PRET_SITES,
  getSite,
  getProductionItem,
  getRecipe,
  getBench,
  type ProductionBatch,
} from '@/components/Production/fixtures';

export default function PCRQueuePage() {
  const { can } = useRole();
  const canSign = can('pcr.sign');
  const [siteId, setSiteId] = useState('hub-central');
  const [pcrForBatch, setPcrForBatch] = useState<string | null>(null);
  const [sessionReviewed, setSessionReviewed] = useState<Set<string>>(new Set());

  const site = getSite(siteId) ?? PRET_SITES[0];

  const allSiteBatches = useMemo(
    () =>
      PRET_PLAN.batches.filter(b => {
        const item = getProductionItem(b.productionItemId);
        return item?.siteId === siteId && b.date === DEMO_TODAY;
      }),
    [siteId],
  );

  const pendingBatches = allSiteBatches.filter(
    b => b.status === 'complete' && !sessionReviewed.has(b.id),
  );
  const reviewedBatches = allSiteBatches.filter(
    b => b.status === 'reviewed' || b.status === 'dispatched' || sessionReviewed.has(b.id),
  );
  const failedBatches = allSiteBatches.filter(b => b.status === 'failed');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Site selector */}
      <div
        style={{
          padding: '10px 16px',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          borderBottom: '1px solid var(--color-border-subtle)',
          background: '#ffffff',
          flexWrap: 'wrap',
        }}
      >
        <span
          style={{
            fontSize: 11,
            fontWeight: 600,
            color: 'var(--color-text-muted)',
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
          }}
        >
          Site
        </span>
        <div style={{ display: 'flex', gap: 4 }}>
          {PRET_SITES.map(s => {
            const active = s.id === siteId;
            return (
              <button
                key={s.id}
                onClick={() => setSiteId(s.id)}
                style={{
                  padding: '6px 10px',
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
                {s.name} · {s.type}
              </button>
            );
          })}
        </div>
        <div style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--color-text-muted)' }}>
          {pendingBatches.length} awaiting review · {reviewedBatches.length} signed today
        </div>
      </div>

      <div style={{ flex: 1, minHeight: 0, overflow: 'auto', padding: '16px 16px 32px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          <StaffLockBanner reason="Only Managers can sign off PCR." />
          <Section
            icon={<ClipboardCheck size={14} color="var(--color-warning)" />}
            title="Awaiting review"
            count={pendingBatches.length}
            empty={pendingBatches.length === 0 ? 'All caught up. Nothing to sign off.' : null}
          >
            {pendingBatches.map(b => (
              <BatchQueueRow
                key={b.id}
                batch={b}
                onOpenPCR={canSign ? () => setPcrForBatch(b.id) : undefined}
                readOnly={!canSign}
              />
            ))}
          </Section>

          {failedBatches.length > 0 && (
            <Section
              icon={<AlertCircle size={14} color="var(--color-error)" />}
              title="Failed — routed to waste"
              count={failedBatches.length}
            >
              {failedBatches.map(b => (
                <BatchQueueRow key={b.id} batch={b} onOpenPCR={() => setPcrForBatch(b.id)} readOnly />
              ))}
            </Section>
          )}

          <Section
            icon={<CheckCircle2 size={14} color="var(--color-success)" />}
            title="Signed today"
            count={reviewedBatches.length}
            empty={reviewedBatches.length === 0 ? 'No sign-offs yet today.' : null}
          >
            {reviewedBatches.map(b => (
              <BatchQueueRow key={b.id} batch={b} readOnly />
            ))}
          </Section>
        </div>
      </div>

      <PCRGate
        batchId={pcrForBatch}
        onClose={() => setPcrForBatch(null)}
        onSubmit={(pcr: PCRSubmission) => {
          console.log('PCR submitted', pcr);
          setSessionReviewed(prev => new Set(prev).add(pcr.batchId));
          setPcrForBatch(null);
        }}
      />
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
        <div style={{ fontSize: 12, color: 'var(--color-text-muted)', padding: '12px 14px', border: '1px dashed var(--color-border-subtle)', borderRadius: 'var(--radius-card)' }}>
          {empty}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>{children}</div>
      )}
    </section>
  );
}

function BatchQueueRow({
  batch,
  onOpenPCR,
  readOnly = false,
}: {
  batch: ProductionBatch;
  onOpenPCR?: () => void;
  readOnly?: boolean;
}) {
  const item = getProductionItem(batch.productionItemId);
  const recipe = item ? getRecipe(item.recipeId) : null;
  const bench = getBench(batch.benchId);
  const isOnDemand = !batch.plannedInstanceId;
  if (!recipe || !bench) return null;

  const isFailed = batch.status === 'failed';

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '12px 14px',
        borderRadius: 'var(--radius-card)',
        border: `1px solid ${isFailed ? 'var(--color-error-border)' : 'var(--color-border-subtle)'}`,
        background: isFailed ? 'var(--color-error-light)' : '#ffffff',
      }}
    >
      <div style={{ minWidth: 180 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--color-text-primary)' }}>{recipe.name}</div>
        <div style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>
          {bench.name} · {batch.startTime}–{batch.endTime}
        </div>
      </div>
      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
        <StatusPill status={batch.status} size="xs" />
        {isOnDemand && <StatusPill tone="info" label="On-demand" size="xs" />}
      </div>
      <div style={{ marginLeft: 'auto', fontSize: 16, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
        {batch.actualQty}
      </div>
      {isFailed && (
        <Link
          href={wasteLogUrlForBatch(batch)}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            padding: '8px 12px',
            borderRadius: 8,
            fontSize: 11,
            fontWeight: 700,
            fontFamily: 'var(--font-primary)',
            background: 'var(--color-error)',
            color: '#ffffff',
            border: '1px solid var(--color-error)',
            cursor: 'pointer',
            whiteSpace: 'nowrap',
            textDecoration: 'none',
          }}
        >
          <Trash2 size={12} /> Log to waste
        </Link>
      )}
      {!readOnly && !isFailed && onOpenPCR && (
        <button
          type="button"
          onClick={onOpenPCR}
          style={{
            padding: '8px 12px',
            borderRadius: 8,
            fontSize: 11,
            fontWeight: 700,
            fontFamily: 'var(--font-primary)',
            background: 'var(--color-accent-active)',
            color: 'var(--color-text-on-active)',
            border: '1px solid var(--color-accent-active)',
            cursor: 'pointer',
            whiteSpace: 'nowrap',
          }}
        >
          Review
        </button>
      )}
    </div>
  );
}
