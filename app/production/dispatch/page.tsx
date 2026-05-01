'use client';

import { useState, useMemo } from 'react';
import HubSpokeBreakdown from '@/components/Production/HubSpokeBreakdown';
import { PRET_SITES, dayOffset, dayOfWeek, type SiteId } from '@/components/Production/fixtures';

/**
 * Dispatch — hub-side aggregated view of what each spoke has ordered for
 * the next dispatch day. Pairs with the spoke-side `/production/spokes`
 * page where individual spoke managers confirm or edit Quinn's draft.
 */
export default function DispatchPage() {
  const hubs = useMemo(() => PRET_SITES.filter(s => s.type === 'HUB'), []);
  const [hubId, setHubId] = useState<SiteId>(hubs[0]?.id ?? 'hub-central');
  const forDate = dayOffset(1);

  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      {/* Page header — hub picker + dispatch date caption */}
      <div
        style={{
          padding: '12px 16px',
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
                onClick={() => setHubId(s.id)}
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

      <HubSpokeBreakdown hubId={hubId} forDate={forDate} />
    </div>
  );
}
