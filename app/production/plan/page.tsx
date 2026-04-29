'use client';

import { useState } from 'react';
import PlanStrip from '@/components/Production/PlanStrip';
import PlanSummaryStrip from '@/components/Production/PlanSummaryStrip';
import { PRET_SITES, getSite, DEMO_TODAY } from '@/components/Production/fixtures';

export default function ProductionPlanPage() {
  const [siteId, setSiteId] = useState('hub-central');
  const site = getSite(siteId) ?? PRET_SITES[0];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Site selector — mirrors /production/board */}
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
        <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
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
      </div>

      <PlanSummaryStrip siteId={site.id} date={DEMO_TODAY} />

      <div style={{ flex: 1, minHeight: 0, overflow: 'auto' }}>
        <PlanStrip site={site} />
      </div>
    </div>
  );
}
