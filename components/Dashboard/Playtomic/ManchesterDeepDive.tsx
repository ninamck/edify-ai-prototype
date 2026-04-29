'use client';

import { ChevronLeft } from 'lucide-react';
import CourtHeatmap from '@/components/Dashboard/Playtomic/parts/CourtHeatmap';
import BookingOriginDonut from '@/components/Dashboard/Playtomic/parts/BookingOriginDonut';
import ForwardPipelineBar from '@/components/Dashboard/Playtomic/parts/ForwardPipelineBar';
import SimpleListCard from '@/components/Dashboard/Playtomic/parts/SimpleListCard';
import LapsedPlayersCard from '@/components/Dashboard/Playtomic/parts/LapsedPlayersCard';
import {
  COACH_ACTIVITY,
  TOP_PLAYERS,
} from '@/components/Dashboard/data/playtomicMockData';

export default function ManchesterDeepDive({
  onBack,
}: {
  onBack?: () => void;
}) {
  const topPlayerItems = TOP_PLAYERS.map((p) => ({
    label: p.name,
    trailing: `${p.bookings} · £${p.spend}`,
  }));
  const coachItems = COACH_ACTIVITY.map((c) => ({
    label: c.name,
    trailing: `${c.classes} cls · ${c.attendees}`,
  }));

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 16,
        fontFamily: 'var(--font-primary)',
      }}
    >
      {onBack && (
        <button
          type="button"
          onClick={onBack}
          style={{
            alignSelf: 'flex-start',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            padding: '6px 10px',
            borderRadius: 8,
            border: '1px solid var(--color-border-subtle)',
            background: '#fff',
            cursor: 'pointer',
            fontFamily: 'var(--font-primary)',
            fontSize: 12,
            fontWeight: 600,
            color: 'var(--color-text-secondary)',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--color-bg-hover)')}
          onMouseLeave={(e) => (e.currentTarget.style.background = '#fff')}
        >
          <ChevronLeft size={14} strokeWidth={2.4} />
          Back to chain pulse
        </button>
      )}

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
          Venue · drill-down
        </div>
        <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--color-text-primary)' }}>
          Manchester
        </div>
        <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--color-text-muted)', marginTop: 4 }}>
          Court utilisation, forward pipeline and player activity for the last 4 weeks.
        </div>
      </header>

      <CourtHeatmap />

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)',
          gap: 12,
        }}
      >
        <ForwardPipelineBar />
        <BookingOriginDonut />
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr) minmax(0, 1fr)',
          gap: 12,
        }}
      >
        <SimpleListCard title="Top players · 30d" items={topPlayerItems} />
        <SimpleListCard title="Coach activity" items={coachItems} />
        <LapsedPlayersCard />
      </div>
    </div>
  );
}
