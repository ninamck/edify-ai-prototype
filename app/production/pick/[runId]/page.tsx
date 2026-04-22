'use client';

import { use, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowRightCircle, PackageCheck, AlertTriangle } from 'lucide-react';
import TaskCard from '@/components/Production/primitives/TaskCard';
import StatusPill from '@/components/Production/primitives/StatusPill';
import {
  usePickListLines,
  useProductionRuns,
  useSupplierProducts,
  useProducts,
  useSites,
  reservePickLine,
} from '@/components/Production/productionStore';
import {
  setCurrentRole,
} from '@/components/DemoControls/demoStore';
import { defaultRouteForRole } from '@/components/Production/roleFilter';

export default function PickListPage({
  params,
}: {
  params: Promise<{ runId: string }>;
}) {
  const { runId } = use(params);
  const pickLines = usePickListLines().filter(p => p.runId === runId);
  const run = useProductionRuns().find(r => r.id === runId);
  const supplierProducts = useSupplierProducts();
  const products = useProducts();
  const sites = useSites();
  const router = useRouter();

  const sorted = useMemo(() => {
    return [...pickLines].sort((a, b) => {
      // Open first, then short, then reserved/picked.
      const order: Record<string, number> = { open: 0, short: 1, reserved: 2, picked: 3 };
      return (order[a.status] ?? 99) - (order[b.status] ?? 99);
    });
  }, [pickLines]);

  const open = sorted.filter(p => p.status === 'open' || p.status === 'short');
  const done = sorted.filter(p => p.status === 'reserved' || p.status === 'picked');

  const allReserved = open.length === 0 && done.length > 0;

  if (!run) {
    return (
      <div style={{ padding: '32px 20px', maxWidth: '480px', margin: '0 auto', textAlign: 'center' }}>
        <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--color-text-primary)', marginBottom: '4px' }}>
          Run not found
        </div>
        <div style={{ fontSize: '12px', color: 'var(--color-text-secondary)' }}>
          The pick list links to a run that doesn&rsquo;t exist or hasn&rsquo;t been locked.
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        maxWidth: '560px',
        margin: '0 auto',
        padding: '20px 16px 80px',
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
          Pick list
        </div>
        <h1 style={{ fontSize: '24px', fontWeight: 700, color: 'var(--color-text-primary)', margin: '0 0 6px' }}>
          {run.name}
        </h1>
        <div style={{ display: 'flex', gap: '10px', fontSize: '13px', color: 'var(--color-text-secondary)' }}>
          <span>
            <strong style={{ color: 'var(--color-text-primary)' }}>{open.length}</strong> to reserve
          </span>
          <span>·</span>
          <span>
            <strong style={{ color: 'var(--color-text-primary)' }}>{done.length}</strong> reserved
          </span>
        </div>
      </div>

      {pickLines.length === 0 && (
        <div
          style={{
            padding: '32px 20px',
            textAlign: 'center',
            background: 'var(--color-bg-hover)',
            border: '1px dashed var(--color-border-subtle)',
            borderRadius: 'var(--radius-card)',
          }}
        >
          <PackageCheck size={24} strokeWidth={1.8} color="var(--color-text-muted)" style={{ marginBottom: '8px' }} />
          <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--color-text-primary)', marginBottom: '4px' }}>
            No stocked items for this run
          </div>
          <div style={{ fontSize: '12px', color: 'var(--color-text-secondary)', lineHeight: 1.5 }}>
            Pick lines appear here when the Planner locks a run that includes stocked products.
          </div>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {open.map(line => {
          const p = products.find(x => x.id === line.productId);
          const sp = p?.supplierProductId ? supplierProducts.find(x => x.id === p.supplierProductId) : undefined;
          const dest = sites.find(s => s.id === line.destinationSiteId);
          const isShort = line.status === 'short';
          const onHand = sp?.onHand ?? 0;

          return (
            <TaskCard
              key={line.id}
              title={p?.name ?? line.productId}
              headline={line.quantityRequested}
              headlineLabel="requested"
              tone={isShort ? 'warning' : 'pending'}
              statusLabel={isShort ? 'Short' : 'To reserve'}
              subtitle={dest ? `For ${dest.name}` : undefined}
              metaRows={[
                { label: 'On hand', value: onHand },
                sp ? { label: 'Pack', value: sp.pack } : null,
                line.status === 'short' ? { label: 'Reserved', value: `${line.quantityReserved} (short ${line.quantityRequested - line.quantityReserved})` } : null,
              ].filter((x): x is { label: string; value: React.ReactNode } => x !== null)}
              primaryAction={{
                label: onHand === 0 ? 'Flag shortage' : isShort ? `Reserve ${Math.min(onHand, line.quantityRequested - line.quantityReserved)} more` : `Reserve ${line.quantityRequested}`,
                onClick: () => reservePickLine(line.id, line.quantityRequested),
                disabled: onHand === 0 && line.status === 'short',
              }}
            />
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
            Reserved
          </div>
          <div
            style={{
              background: '#fff',
              border: '1px solid var(--color-border-subtle)',
              borderRadius: 'var(--radius-card)',
              overflow: 'hidden',
            }}
          >
            {done.map((line, idx) => {
              const p = products.find(x => x.id === line.productId);
              const dest = sites.find(s => s.id === line.destinationSiteId);
              return (
                <div
                  key={line.id}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr auto auto',
                    alignItems: 'center',
                    gap: '12px',
                    padding: '12px 14px',
                    borderBottom: idx === done.length - 1 ? 'none' : '1px solid var(--color-border-subtle)',
                  }}
                >
                  <div>
                    <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--color-text-primary)' }}>
                      {p?.name ?? line.productId}
                    </div>
                    {dest && (
                      <div style={{ fontSize: '11px', color: 'var(--color-text-muted)', marginTop: '2px' }}>
                        → {dest.name}
                      </div>
                    )}
                  </div>
                  <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--color-text-primary)' }}>
                    {line.quantityReserved}
                  </div>
                  <StatusPill
                    label="Reserved"
                    tone="success"
                    size="xs"
                    icon={<PackageCheck size={10} strokeWidth={2.4} />}
                  />
                </div>
              );
            })}
          </div>
        </>
      )}

      {allReserved && (
        <div style={{ marginTop: '22px', textAlign: 'center' }}>
          <button
            type="button"
            onClick={() => router.push('/production/dispatch')}
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
            Go to Dispatch Queue
          </button>
        </div>
      )}
    </div>
  );
}
