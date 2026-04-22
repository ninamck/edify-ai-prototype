'use client';

import { useMemo, useState } from 'react';
import { Truck, CheckCircle2, X } from 'lucide-react';
import StatusPill from '@/components/Production/primitives/StatusPill';
import {
  useDispatchManifests,
  useMadeOutputs,
  usePcrChecks,
  usePickListLines,
  useProducts,
  useProductionRuns,
  useSpokes,
  useDemandLines,
  confirmDispatch,
  type MadeOutput,
  type PickListLine,
} from '@/components/Production/productionStore';

type DestinationSummary = {
  siteId: string;
  siteName: string;
  manifestId: string | null;
  manifestStatus: string;
  madeUnits: number;
  madeProductIds: string[];
  pickedReserved: number;
  pickLines: PickListLine[];
  madeOutputsForSite: MadeOutput[];
  ready: boolean;
};

export default function DispatchQueuePage() {
  const spokes = useSpokes();
  const products = useProducts();
  const demandLines = useDemandLines();
  const runs = useProductionRuns();
  const madeOutputs = useMadeOutputs();
  const pcrChecks = usePcrChecks();
  const pickLines = usePickListLines();
  const manifests = useDispatchManifests();

  // Made outputs that passed PCR — eligible for dispatch.
  const readyMadeOutputs = useMemo(() => {
    return madeOutputs.filter(m => {
      const c = pcrChecks.find(c2 => c2.madeOutputId === m.id);
      return c && c.qualityCheck === 'pass' && c.labelCheck === 'pass';
    });
  }, [madeOutputs, pcrChecks]);

  // Map a made output to its demand-destination split by looking at the run's
  // linked demand. Ratio from demand line quantities within the product.
  function splitForMadeOutput(mo: MadeOutput): { destinationSiteId: string; qty: number }[] {
    const run = runs.find(r => r.id === mo.productionRunId);
    if (!run) return [];
    const relatedDemand = demandLines.filter(
      d => run.linkedDemandLineIds.includes(d.id) && d.productId === mo.productId,
    );
    const totalDemand = relatedDemand.reduce((s, d) => s + d.quantity, 0);
    if (totalDemand === 0) return [];
    return relatedDemand.map(d => ({
      destinationSiteId: d.siteId,
      qty: Math.round((d.quantity / totalDemand) * mo.quantityProduced),
    }));
  }

  const summaries: DestinationSummary[] = useMemo(() => {
    return spokes.map(site => {
      const manifest = manifests.find(
        m => m.destinationSiteId === site.id && m.status !== 'delivered',
      );

      // Made units destined for this spoke (proportional split).
      let madeUnits = 0;
      const madeProductIds = new Set<string>();
      const madeOutputsForSite: MadeOutput[] = [];
      for (const mo of readyMadeOutputs) {
        for (const split of splitForMadeOutput(mo)) {
          if (split.destinationSiteId === site.id) {
            madeUnits += split.qty;
            madeProductIds.add(mo.productId);
            if (!madeOutputsForSite.includes(mo)) madeOutputsForSite.push(mo);
          }
        }
      }

      const linesForSite = pickLines.filter(p => p.destinationSiteId === site.id);
      const pickedReserved = linesForSite
        .filter(p => p.status === 'reserved' || p.status === 'picked')
        .reduce((s, p) => s + p.quantityReserved, 0);

      return {
        siteId: site.id,
        siteName: site.name,
        manifestId: manifest?.id ?? null,
        manifestStatus: manifest?.status ?? 'none',
        madeUnits,
        madeProductIds: [...madeProductIds],
        pickedReserved,
        pickLines: linesForSite,
        madeOutputsForSite,
        ready: (madeUnits > 0 || pickedReserved > 0) && manifest?.status === 'draft',
      };
    });
  }, [spokes, readyMadeOutputs, pickLines, manifests, demandLines, runs]);

  const [openManifestFor, setOpenManifestFor] = useState<string | null>(null);
  const activeSummary = summaries.find(s => s.siteId === openManifestFor);

  return (
    <div style={{ fontFamily: 'var(--font-primary)', padding: '20px 24px 60px', maxWidth: '1160px', margin: '0 auto' }}>
      {/* Summary strip */}
      <div
        style={{
          display: 'flex',
          gap: '20px',
          flexWrap: 'wrap',
          marginBottom: '18px',
          padding: '14px 16px',
          borderRadius: 'var(--radius-card)',
          background: '#fff',
          border: '1px solid var(--color-border-subtle)',
        }}
      >
        <Metric value={spokes.length} label="Destinations" />
        <Metric value={readyMadeOutputs.length} label="Made batches ready" />
        <Metric
          value={manifests.filter(m => m.status === 'loaded').length}
          label="Loaded manifests"
        />
        <Metric
          value={manifests.filter(m => m.status === 'delivered').length}
          label="Delivered"
        />
      </div>

      {/* Destination list */}
      <div
        style={{
          background: '#fff',
          border: '1px solid var(--color-border-subtle)',
          borderRadius: 'var(--radius-card)',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1.4fr 100px 100px 120px 140px',
            gap: '12px',
            padding: '10px 16px',
            background: 'var(--color-bg-hover)',
            borderBottom: '1px solid var(--color-border-subtle)',
            fontSize: '10px',
            fontWeight: 700,
            letterSpacing: '0.05em',
            textTransform: 'uppercase',
            color: 'var(--color-text-muted)',
          }}
        >
          <div>Destination</div>
          <div style={{ textAlign: 'right' }}>Made</div>
          <div style={{ textAlign: 'right' }}>Picked</div>
          <div>Status</div>
          <div></div>
        </div>
        {summaries.map((s, idx) => (
          <div
            key={s.siteId}
            style={{
              display: 'grid',
              gridTemplateColumns: '1.4fr 100px 100px 120px 140px',
              alignItems: 'center',
              gap: '12px',
              padding: '14px 16px',
              borderBottom: idx === summaries.length - 1 ? 'none' : '1px solid var(--color-border-subtle)',
            }}
          >
            <div>
              <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--color-text-primary)' }}>
                {s.siteName}
              </div>
              <div style={{ fontSize: '11px', color: 'var(--color-text-muted)', marginTop: '2px' }}>
                {s.madeProductIds.length} made products · {s.pickLines.length} stocked lines
              </div>
            </div>
            <div style={{ fontSize: '15px', fontWeight: 700, color: 'var(--color-text-primary)', textAlign: 'right' }}>
              {s.madeUnits || '—'}
            </div>
            <div style={{ fontSize: '15px', fontWeight: 700, color: 'var(--color-text-primary)', textAlign: 'right' }}>
              {s.pickedReserved || '—'}
            </div>
            <div>
              {s.manifestStatus === 'loaded' ? (
                <StatusPill label="Loaded" tone="success" icon={<Truck size={10} strokeWidth={2.4} />} />
              ) : s.manifestStatus === 'delivered' ? (
                <StatusPill label="Delivered" tone="success" />
              ) : s.ready ? (
                <StatusPill label="Ready" tone="accent" />
              ) : s.manifestStatus === 'draft' ? (
                <StatusPill label="Waiting" tone="neutral" />
              ) : (
                <StatusPill label="No demand" tone="neutral" />
              )}
            </div>
            <div style={{ textAlign: 'right' }}>
              {s.manifestId && s.manifestStatus === 'draft' && s.ready && (
                <button
                  type="button"
                  onClick={() => setOpenManifestFor(s.siteId)}
                  style={{
                    padding: '8px 12px',
                    borderRadius: '8px',
                    background: 'var(--color-accent-active)',
                    border: 'none',
                    color: '#fff',
                    fontSize: '12px',
                    fontWeight: 700,
                    fontFamily: 'var(--font-primary)',
                    cursor: 'pointer',
                  }}
                >
                  Build manifest
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Manifest drawer */}
      {activeSummary && (
        <ManifestDrawer
          summary={activeSummary}
          products={products}
          onClose={() => setOpenManifestFor(null)}
          onConfirm={() => {
            if (activeSummary.manifestId) {
              confirmDispatch(activeSummary.manifestId);
            }
            setOpenManifestFor(null);
          }}
        />
      )}
    </div>
  );
}

function ManifestDrawer({
  summary,
  products,
  onClose,
  onConfirm,
}: {
  summary: DestinationSummary;
  products: ReturnType<typeof useProducts>;
  onClose: () => void;
  onConfirm: () => void;
}) {
  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(58,48,40,0.35)',
          zIndex: 400,
        }}
      />
      {/* Right-side drawer */}
      <aside
        style={{
          position: 'fixed',
          top: 0,
          right: 0,
          bottom: 0,
          width: '480px',
          maxWidth: '100vw',
          background: '#fff',
          zIndex: 401,
          display: 'flex',
          flexDirection: 'column',
          fontFamily: 'var(--font-primary)',
          borderLeft: '1px solid var(--color-border-subtle)',
          boxShadow: '-12px 0 32px rgba(58,48,40,0.12)',
        }}
      >
        <header
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '16px 20px',
            borderBottom: '1px solid var(--color-border-subtle)',
          }}
        >
          <div>
            <div
              style={{
                fontSize: '10px',
                fontWeight: 700,
                letterSpacing: '0.05em',
                textTransform: 'uppercase',
                color: 'var(--color-text-muted)',
                marginBottom: '2px',
              }}
            >
              Manifest for
            </div>
            <div style={{ fontSize: '18px', fontWeight: 700, color: 'var(--color-text-primary)' }}>
              {summary.siteName}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close manifest"
            style={{
              width: '32px',
              height: '32px',
              borderRadius: '8px',
              border: 'none',
              background: 'var(--color-bg-hover)',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--color-text-secondary)',
            }}
          >
            <X size={14} strokeWidth={2.4} />
          </button>
        </header>

        <div style={{ flex: 1, overflowY: 'auto', padding: '18px 20px' }}>
          {summary.madeOutputsForSite.length > 0 && (
            <>
              <SectionTitle>Made outputs</SectionTitle>
              <div
                style={{
                  background: '#fff',
                  border: '1px solid var(--color-border-subtle)',
                  borderRadius: 'var(--radius-item)',
                  overflow: 'hidden',
                  marginBottom: '18px',
                }}
              >
                {summary.madeOutputsForSite.map((mo, idx) => {
                  const p = products.find(x => x.id === mo.productId);
                  return (
                    <div
                      key={mo.id}
                      style={{
                        display: 'grid',
                        gridTemplateColumns: '1fr auto',
                        alignItems: 'center',
                        gap: '8px',
                        padding: '10px 12px',
                        borderBottom: idx === summary.madeOutputsForSite.length - 1 ? 'none' : '1px solid var(--color-border-subtle)',
                      }}
                    >
                      <div>
                        <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--color-text-primary)' }}>
                          {p?.name ?? mo.productId}
                        </div>
                        <div style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>
                          Batch B-{mo.id.toUpperCase()}
                        </div>
                      </div>
                      <div style={{ fontSize: '14px', fontWeight: 700 }}>{mo.quantityProduced}</div>
                    </div>
                  );
                })}
              </div>
            </>
          )}

          {summary.pickLines.filter(p => p.status === 'reserved' || p.status === 'picked').length > 0 && (
            <>
              <SectionTitle>Stocked (picked)</SectionTitle>
              <div
                style={{
                  background: '#fff',
                  border: '1px solid var(--color-border-subtle)',
                  borderRadius: 'var(--radius-item)',
                  overflow: 'hidden',
                  marginBottom: '18px',
                }}
              >
                {summary.pickLines
                  .filter(p => p.status === 'reserved' || p.status === 'picked')
                  .map((line, idx, arr) => {
                    const p = products.find(x => x.id === line.productId);
                    return (
                      <div
                        key={line.id}
                        style={{
                          display: 'grid',
                          gridTemplateColumns: '1fr auto',
                          alignItems: 'center',
                          gap: '8px',
                          padding: '10px 12px',
                          borderBottom: idx === arr.length - 1 ? 'none' : '1px solid var(--color-border-subtle)',
                        }}
                      >
                        <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--color-text-primary)' }}>
                          {p?.name ?? line.productId}
                        </div>
                        <div style={{ fontSize: '14px', fontWeight: 700 }}>{line.quantityReserved}</div>
                      </div>
                    );
                  })}
              </div>
            </>
          )}

          {summary.pickLines.filter(p => p.status === 'short').length > 0 && (
            <div
              style={{
                padding: '10px 12px',
                borderRadius: 'var(--radius-item)',
                background: 'rgba(146,64,14,0.06)',
                border: '1px solid var(--color-warning)',
                color: 'var(--color-warning)',
                fontSize: '12px',
                marginBottom: '18px',
              }}
            >
              {summary.pickLines.filter(p => p.status === 'short').length} short line(s) — the dispatcher should flag a PO before the next cycle.
            </div>
          )}
        </div>

        <footer
          style={{
            padding: '14px 20px',
            borderTop: '1px solid var(--color-border-subtle)',
            display: 'flex',
            gap: '10px',
          }}
        >
          <button
            type="button"
            onClick={onClose}
            style={{
              flex: 1,
              padding: '12px',
              borderRadius: '10px',
              background: '#fff',
              border: '1px solid var(--color-border-subtle)',
              color: 'var(--color-text-secondary)',
              fontSize: '13px',
              fontWeight: 600,
              fontFamily: 'var(--font-primary)',
              cursor: 'pointer',
            }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            style={{
              flex: 2,
              padding: '12px',
              borderRadius: '10px',
              background: 'var(--color-accent-active)',
              border: 'none',
              color: '#fff',
              fontSize: '13px',
              fontWeight: 700,
              fontFamily: 'var(--font-primary)',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
            }}
          >
            <CheckCircle2 size={15} strokeWidth={2.4} />
            Confirm dispatch
          </button>
        </footer>
      </aside>
    </>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        fontSize: '10px',
        fontWeight: 700,
        letterSpacing: '0.05em',
        textTransform: 'uppercase',
        color: 'var(--color-text-muted)',
        marginBottom: '8px',
      }}
    >
      {children}
    </div>
  );
}

function Metric({ value, label }: { value: number | string; label: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      <span style={{ fontSize: '22px', fontWeight: 700, color: 'var(--color-text-primary)', lineHeight: 1.1 }}>
        {value}
      </span>
      <span style={{ fontSize: '11px', fontWeight: 500, color: 'var(--color-text-muted)', marginTop: '2px' }}>
        {label}
      </span>
    </div>
  );
}
