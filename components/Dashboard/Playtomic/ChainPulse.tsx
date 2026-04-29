'use client';

import KpiCardRow from '@/components/Dashboard/Playtomic/parts/KpiCardRow';
import VenueTable from '@/components/Dashboard/Playtomic/parts/VenueTable';
import {
  CHAIN_KPIS,
  VENUES,
} from '@/components/Dashboard/data/playtomicMockData';

export default function ChainPulse({
  onVenueClick,
}: {
  onVenueClick?: (venueName: string) => void;
}) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 16,
        fontFamily: 'var(--font-primary)',
      }}
    >
      <header>
        <div
          style={{
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: 0.6,
            textTransform: 'uppercase',
            color: 'var(--color-text-muted)',
            marginBottom: 6,
          }}
        >
          Chain pulse
        </div>
        <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--color-text-primary)' }}>
          Chain pulse · this week
        </div>
        <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--color-text-muted)', marginTop: 4 }}>
          All 7 open clubs. Click any club to drill into hourly utilisation, pipeline and members.
        </div>
      </header>

      <KpiCardRow kpis={CHAIN_KPIS} />

      <VenueTable venues={VENUES} onVenueClick={onVenueClick} />
    </div>
  );
}
