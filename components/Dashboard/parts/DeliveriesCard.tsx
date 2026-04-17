'use client';

import { Package, CheckCircle2, Clock, CircleDashed } from 'lucide-react';
import type { DeliveryDrop, WtdSupplierSpend } from '@/components/Dashboard/data/managerMockData';

const OK = '#166534';
const WARN = '#B45309';
const ACCENT = 'var(--color-accent-deep)';

function StatusIcon({ status }: { status: DeliveryDrop['status'] }) {
  if (status === 'done') return <CheckCircle2 size={14} color={OK} strokeWidth={2.2} />;
  if (status === 'in-window') return <Clock size={14} color={WARN} strokeWidth={2.2} />;
  return <CircleDashed size={14} color="var(--color-text-muted)" strokeWidth={2.2} />;
}

function statusLabel(status: DeliveryDrop['status']): string {
  if (status === 'done') return 'Received';
  if (status === 'in-window') return 'In window';
  return 'Upcoming';
}

export default function DeliveriesCard({
  drops,
  wtd,
}: {
  drops: DeliveryDrop[];
  wtd: WtdSupplierSpend[];
}) {
  const wtdTotal = wtd.reduce((s, r) => s + r.spend, 0);
  const wtdBudget = wtd.reduce((s, r) => s + r.budget, 0);
  const wtdPct = Math.round((wtdTotal / wtdBudget) * 100);

  return (
    <div
      style={{
        padding: '16px 16px 14px',
        borderRadius: 12,
        border: '1px solid var(--color-border-subtle)',
        background: '#fff',
        boxShadow: '0 2px 12px rgba(58,48,40,0.1), 0 0 0 1px rgba(58,48,40,0.03)',
        display: 'flex',
        flexDirection: 'column',
        gap: 14,
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{
          width: 28, height: 28, borderRadius: 8,
          background: 'var(--color-bg-hover)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Package size={16} color={ACCENT} strokeWidth={2} />
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--color-text-primary)' }}>Deliveries</div>
          <div style={{ fontSize: 11, fontWeight: 500, color: 'var(--color-text-muted)' }}>Today's drops · week-to-date spend</div>
        </div>
      </div>

      {/* Today's drops */}
      <div>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--color-text-muted)', marginBottom: 8 }}>
          Today
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {drops.map((d) => (
            <div
              key={d.id}
              style={{
                display: 'grid',
                gridTemplateColumns: 'auto 1fr auto auto auto',
                alignItems: 'center',
                gap: 10,
                padding: '8px 10px',
                borderRadius: 8,
                background: d.status === 'in-window' ? 'rgba(180,83,9,0.06)' : 'var(--color-bg-canvas)',
                border: d.status === 'in-window' ? '1px solid rgba(180,83,9,0.25)' : '1px solid transparent',
              }}
            >
              <StatusIcon status={d.status} />
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--color-text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {d.supplier}
                </div>
                <div style={{ fontSize: 11, fontWeight: 500, color: 'var(--color-text-muted)' }}>
                  {statusLabel(d.status)}
                </div>
              </div>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-text-secondary)', textAlign: 'right' }}>
                {d.eta}
              </div>
              <div style={{ fontSize: 11, fontWeight: 500, color: 'var(--color-text-muted)', textAlign: 'right' }}>
                {d.lines} lines
              </div>
              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--color-text-primary)', textAlign: 'right', minWidth: 50 }}>
                £{d.spend}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* WTD spend */}
      <div>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 8 }}>
          <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--color-text-muted)' }}>
            Week to date
          </span>
          <span style={{ fontSize: 12, fontWeight: 600, color: wtdTotal > wtdBudget ? WARN : 'var(--color-text-secondary)' }}>
            £{wtdTotal.toLocaleString()} <span style={{ color: 'var(--color-text-muted)', fontWeight: 500 }}>of £{wtdBudget.toLocaleString()} ({wtdPct}%)</span>
          </span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {wtd.map((s) => {
            const pct = Math.min(100, Math.round((s.spend / s.budget) * 100));
            const over = s.spend > s.budget;
            return (
              <div key={s.supplier} style={{ display: 'grid', gridTemplateColumns: '90px 1fr auto', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-text-secondary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {s.supplier}
                </span>
                <div style={{ position: 'relative', height: 8, borderRadius: 4, background: 'var(--color-bg-hover)', overflow: 'hidden' }}>
                  <div style={{
                    position: 'absolute',
                    inset: 0,
                    width: `${pct}%`,
                    background: over ? WARN : ACCENT,
                    borderRadius: 4,
                  }} />
                </div>
                <span style={{ fontSize: 11, fontWeight: 600, color: over ? WARN : 'var(--color-text-primary)', minWidth: 70, textAlign: 'right' }}>
                  £{s.spend} / £{s.budget}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
