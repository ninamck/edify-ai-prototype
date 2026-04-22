'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronLeft, ChevronRight, Sparkles } from 'lucide-react';
import {
  useDemandLines,
  useDemandLinesForDate,
  useProductionRuns,
  useSites,
  useProducts,
  addDemandToRun,
} from '@/components/Production/productionStore';
import { TODAY } from '@/components/Production/fixtures/fitzroyCpu';
import { useCurrentSiteId } from '@/components/DemoControls/demoStore';
import StatusPill, { type PillTone } from '@/components/Production/primitives/StatusPill';

const SOURCE_TONE: Record<string, PillTone> = {
  forecast: 'info',
  spoke_order: 'accent',
  catering: 'warning',
  manual: 'neutral',
};

const SOURCE_LABEL: Record<string, string> = {
  forecast: 'Forecast',
  spoke_order: 'Spoke',
  catering: 'Catering',
  manual: 'Manual',
};

function formatTime(iso: string): string {
  // Read hour/min straight from the ISO string so the fixture's Melbourne
  // time displays correctly regardless of the browser's locale zone.
  const m = iso.match(/T(\d{2}):(\d{2})/);
  if (!m) return iso;
  const h24 = parseInt(m[1], 10);
  const mins = m[2];
  const suffix = h24 >= 12 ? 'pm' : 'am';
  const h12 = h24 === 0 ? 12 : h24 > 12 ? h24 - 12 : h24;
  return `${h12}:${mins} ${suffix}`;
}

function addDays(dateISO: string, n: number): string {
  const d = new Date(dateISO);
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

function formatDay(dateISO: string): string {
  const d = new Date(dateISO);
  return d.toLocaleDateString('en-AU', { weekday: 'short', day: 'numeric', month: 'short' });
}

export default function DemandDashboardPage() {
  const [selectedDate, setSelectedDate] = useState(TODAY);
  const currentSiteId = useCurrentSiteId();
  const sites = useSites();
  const products = useProducts();
  const currentSite = sites.find(s => s.id === currentSiteId);
  const allDemand = useDemandLines();
  const demandToday = useDemandLinesForDate(selectedDate);
  const runs = useProductionRuns();
  const runsToday = runs.filter(r => r.scheduledDate === selectedDate);
  const router = useRouter();

  // At the hub, show everything. At a spoke, only that spoke's demand.
  const relevantDemand = useMemo(
    () => (currentSite?.kind === 'hub' ? demandToday : demandToday.filter(d => d.siteId === currentSiteId)),
    [currentSite, demandToday, currentSiteId],
  );

  const linkedIds = useMemo(() => {
    const out = new Map<string, string>(); // demandLineId -> runName
    for (const r of runsToday) {
      for (const id of r.linkedDemandLineIds) out.set(id, r.name);
    }
    return out;
  }, [runsToday]);

  // Sort: unassigned first (newest concern), then by product name, required-by.
  const sorted = useMemo(() => {
    return [...relevantDemand].sort((a, b) => {
      const aLinked = linkedIds.has(a.id) ? 1 : 0;
      const bLinked = linkedIds.has(b.id) ? 1 : 0;
      if (aLinked !== bLinked) return aLinked - bLinked;
      const pa = products.find(p => p.id === a.productId)?.name ?? '';
      const pb = products.find(p => p.id === b.productId)?.name ?? '';
      if (pa !== pb) return pa.localeCompare(pb);
      return a.requiredByDateTime.localeCompare(b.requiredByDateTime);
    });
  }, [relevantDemand, linkedIds, products]);

  const [selected, setSelected] = useState<Set<string>>(new Set());
  function toggle(id: string) {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }
  function selectAll(ids: string[]) {
    setSelected(new Set(ids));
  }
  function clearSelection() {
    setSelected(new Set());
  }

  const unassignedIds = useMemo(
    () => relevantDemand.filter(d => !linkedIds.has(d.id)).map(d => d.id),
    [relevantDemand, linkedIds],
  );

  const selectedLines = useMemo(
    () => relevantDemand.filter(d => selected.has(d.id)),
    [relevantDemand, selected],
  );
  const selectedTotalUnits = selectedLines.reduce((s, d) => s + d.quantity, 0);
  const selectedProducts = new Set(selectedLines.map(d => d.productId)).size;

  function addSelectedToRun(runId: string) {
    const ids = [...selected];
    addDemandToRun(runId, ids);
    clearSelection();
    router.push(`/production/plan/${selectedDate}`);
  }

  // Summary
  const totalUnits = relevantDemand.reduce((s, d) => s + d.quantity, 0);
  const uniqueProducts = new Set(relevantDemand.map(d => d.productId)).size;
  const uniqueSites = new Set(relevantDemand.map(d => d.siteId)).size;

  return (
    <div style={{ fontFamily: 'var(--font-primary)', paddingBottom: selected.size > 0 ? '80px' : '24px' }}>
      {/* Day picker + summary */}
      <div style={{ padding: '20px 24px 0', maxWidth: '1160px', margin: '0 auto' }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '16px',
            flexWrap: 'wrap',
            marginBottom: '14px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              type="button"
              aria-label="Previous day"
              onClick={() => setSelectedDate(d => addDays(d, -1))}
              style={iconBtnStyle}
            >
              <ChevronLeft size={14} strokeWidth={2.2} />
            </button>
            <div
              style={{
                padding: '8px 14px',
                borderRadius: '8px',
                background: 'var(--color-bg-hover)',
                border: '1px solid var(--color-border-subtle)',
                fontSize: '13px',
                fontWeight: 700,
                color: 'var(--color-text-primary)',
              }}
            >
              {selectedDate === TODAY ? 'Today · ' : ''}{formatDay(selectedDate)}
            </div>
            <button
              type="button"
              aria-label="Next day"
              onClick={() => setSelectedDate(d => addDays(d, 1))}
              style={iconBtnStyle}
            >
              <ChevronRight size={14} strokeWidth={2.2} />
            </button>
            {selectedDate !== TODAY && (
              <button
                type="button"
                onClick={() => setSelectedDate(TODAY)}
                style={{
                  padding: '6px 10px',
                  borderRadius: '8px',
                  background: 'transparent',
                  border: '1px solid var(--color-border-subtle)',
                  fontSize: '11px',
                  fontWeight: 600,
                  color: 'var(--color-text-secondary)',
                  cursor: 'pointer',
                  fontFamily: 'var(--font-primary)',
                }}
              >
                Reset to today
              </button>
            )}
          </div>

          <div style={{ display: 'flex', gap: '14px', alignItems: 'baseline' }}>
            <Metric value={relevantDemand.length} label="demand lines" />
            <Metric value={uniqueProducts} label="products" />
            <Metric value={uniqueSites} label="sites ordered" />
            <Metric value={totalUnits} label="units" />
            <Metric value={unassignedIds.length} label="unassigned" tone={unassignedIds.length > 0 ? 'warning' : undefined} />
          </div>
        </div>
      </div>

      {/* Empty state for non-today (no data) */}
      {relevantDemand.length === 0 && (
        <div style={{ padding: '48px 24px', textAlign: 'center', maxWidth: '640px', margin: '0 auto' }}>
          <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--color-text-primary)', marginBottom: '6px' }}>
            No demand yet for this day
          </div>
          <div style={{ fontSize: '12px', color: 'var(--color-text-secondary)' }}>
            Set up spoke orders or let Quinn forecast.
          </div>
        </div>
      )}

      {/* Table */}
      {relevantDemand.length > 0 && (
        <div style={{ padding: '0 24px', maxWidth: '1160px', margin: '0 auto' }}>
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
                gridTemplateColumns: '40px 1.5fr 1.2fr 100px 100px 120px 140px',
                alignItems: 'center',
                padding: '10px 14px',
                background: 'var(--color-bg-hover)',
                borderBottom: '1px solid var(--color-border-subtle)',
                fontSize: '10px',
                fontWeight: 700,
                letterSpacing: '0.05em',
                textTransform: 'uppercase',
                color: 'var(--color-text-muted)',
                gap: '12px',
              }}
            >
              <input
                type="checkbox"
                aria-label="Select all unassigned"
                checked={unassignedIds.length > 0 && unassignedIds.every(id => selected.has(id))}
                onChange={(e) => e.target.checked ? selectAll(unassignedIds) : clearSelection()}
              />
              <div>Product</div>
              <div>Destination</div>
              <div>Source</div>
              <div style={{ textAlign: 'right' }}>Qty</div>
              <div>Required by</div>
              <div>Status</div>
            </div>

            {sorted.map((line, idx) => {
              const product = products.find(p => p.id === line.productId);
              const site = sites.find(s => s.id === line.siteId);
              const linkedTo = linkedIds.get(line.id);
              const isSelected = selected.has(line.id);
              return (
                <div
                  key={line.id}
                  onClick={() => !linkedTo && toggle(line.id)}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '40px 1.5fr 1.2fr 100px 100px 120px 140px',
                    alignItems: 'center',
                    gap: '12px',
                    padding: '12px 14px',
                    borderBottom: idx === sorted.length - 1 ? 'none' : '1px solid var(--color-border-subtle)',
                    background: isSelected ? 'rgba(34,68,68,0.04)' : '#fff',
                    cursor: linkedTo ? 'default' : 'pointer',
                    opacity: linkedTo ? 0.65 : 1,
                  }}
                >
                  <input
                    type="checkbox"
                    aria-label={`Select ${product?.name}`}
                    checked={isSelected}
                    disabled={!!linkedTo}
                    onClick={(e) => e.stopPropagation()}
                    onChange={() => toggle(line.id)}
                  />
                  <div>
                    <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--color-text-primary)' }}>
                      {product?.name ?? line.productId}
                    </div>
                    {line.notes && (
                      <div style={{ fontSize: '11px', color: 'var(--color-text-muted)', marginTop: '2px' }}>
                        {line.notes}
                      </div>
                    )}
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--color-text-secondary)' }}>
                    {site?.name ?? line.siteId}
                  </div>
                  <StatusPill
                    label={SOURCE_LABEL[line.source] ?? line.source}
                    tone={SOURCE_TONE[line.source] ?? 'neutral'}
                  />
                  <div style={{ fontSize: '15px', fontWeight: 700, color: 'var(--color-text-primary)', textAlign: 'right' }}>
                    {line.quantity}
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--color-text-secondary)' }}>
                    {formatTime(line.requiredByDateTime)}
                  </div>
                  <div>
                    {linkedTo ? (
                      <StatusPill label={`In ${linkedTo.split(' · ')[0]}`} tone="success" />
                    ) : (
                      <StatusPill label="Unassigned" tone="warning" />
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Sticky bulk-action bar */}
      {selected.size > 0 && (
        <div
          style={{
            position: 'fixed',
            bottom: 0,
            left: '68px',
            right: 0,
            padding: '12px 24px',
            background: '#fff',
            borderTop: '1px solid var(--color-border-subtle)',
            boxShadow: '0 -4px 14px rgba(58,48,40,0.06)',
            zIndex: 100,
          }}
        >
          <div
            style={{
              maxWidth: '1160px',
              margin: '0 auto',
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              flexWrap: 'wrap',
            }}
          >
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--color-text-primary)' }}>
                {selected.size} {selected.size === 1 ? 'line' : 'lines'} · {selectedProducts} {selectedProducts === 1 ? 'product' : 'products'} · {selectedTotalUnits} units
              </div>
              <div style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>
                Add to an existing draft run — the Planner will assign benches next.
              </div>
            </div>
            <button type="button" onClick={clearSelection} style={secondaryBtnStyle}>
              Clear
            </button>
            {runsToday
              .filter(r => r.status === 'draft')
              .map(r => (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => addSelectedToRun(r.id)}
                  style={primaryBtnStyle}
                >
                  <Sparkles size={12} strokeWidth={2.2} style={{ marginRight: '6px' }} />
                  Add to {r.name.split(' · ')[0]}
                </button>
              ))}
          </div>
        </div>
      )}
    </div>
  );
}

function Metric({ value, label, tone }: { value: number; label: string; tone?: 'warning' }) {
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', gap: '5px' }}>
      <span
        style={{
          fontSize: '18px',
          fontWeight: 700,
          color: tone === 'warning' ? 'var(--color-warning)' : 'var(--color-text-primary)',
          lineHeight: 1,
        }}
      >
        {value}
      </span>
      <span style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>{label}</span>
    </div>
  );
}

const iconBtnStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: '32px',
  height: '32px',
  borderRadius: '8px',
  border: '1px solid var(--color-border-subtle)',
  background: '#fff',
  cursor: 'pointer',
  color: 'var(--color-text-secondary)',
};

const primaryBtnStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  padding: '8px 14px',
  borderRadius: '8px',
  background: 'var(--color-accent-active)',
  border: 'none',
  color: '#fff',
  fontSize: '12px',
  fontWeight: 700,
  fontFamily: 'var(--font-primary)',
  cursor: 'pointer',
};

const secondaryBtnStyle: React.CSSProperties = {
  padding: '8px 12px',
  borderRadius: '8px',
  background: '#fff',
  border: '1px solid var(--color-border-subtle)',
  color: 'var(--color-text-secondary)',
  fontSize: '12px',
  fontWeight: 600,
  fontFamily: 'var(--font-primary)',
  cursor: 'pointer',
};
