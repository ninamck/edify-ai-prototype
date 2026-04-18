'use client';

import type { BriefingRole, BriefingPhase } from '@/components/briefing';
import { BriefingContent } from '@/components/Feed/MorningBriefingBody';

// Responsive panel width: grows a bit on wider monitors, floors at 380 so the
// insight copy doesn't get cramped. Below 900px the sheet overlay takes over
// (see HomeShell.tsx NARROW_BREAKPOINT), so this only tunes desktop.
const PANEL_W = 'clamp(380px, 30vw, 480px)';

function briefingLabelForPhase(phase: BriefingPhase): { title: string; subtitle: string } {
  switch (phase) {
    case 'morning':
      return { title: 'Morning briefing', subtitle: 'Pre-service priorities and what Quinn\'s queued for the day.' };
    case 'midday':
      return { title: 'Midday update', subtitle: 'Mid-service pacing — sales, stock and floor calls.' };
    case 'afternoon':
      return { title: 'Afternoon briefing', subtitle: 'Wrap decisions and prep for tomorrow.' };
    case 'evening':
      return { title: 'Evening wrap', subtitle: 'Today\'s close + what\'s teed up for tomorrow.' };
  }
}

export default function MorningBriefingTimeline({
  briefingRole,
  phase,
  layout = 'sidebar',
}: {
  briefingRole: BriefingRole;
  phase: BriefingPhase;
  layout?: 'sidebar' | 'sheet';
}) {
  const sidebar = layout === 'sidebar';
  const today = new Intl.DateTimeFormat('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(new Date());

  const { title: briefingTitle, subtitle: briefingSubtitle } = briefingLabelForPhase(phase);

  return (
    <div
      style={{
        width: sidebar ? PANEL_W : '100%',
        minWidth: 0,
        maxWidth: sidebar ? PANEL_W : undefined,
        height: sidebar ? '100%' : 'auto',
        minHeight: 0,
        display: 'flex',
        flexDirection: 'column',
        flexShrink: 0,
        background: '#fff',
        borderRadius: sidebar ? 12 : 0,
        border: sidebar ? '2px solid rgba(217, 215, 212, 1)' : 'none',
        boxShadow: sidebar ? '0 2px 12px rgba(58,48,40,0.1), 0 0 0 1px rgba(58,48,40,0.03)' : undefined,
        overflow: 'hidden',
        fontFamily: 'var(--font-primary)',
        boxSizing: 'border-box',
        padding: sidebar ? '14px' : '16px 0 0',
      }}
    >
      <div
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          minHeight: 0,
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            padding: '0 0 12px',
            borderBottom: '1px solid var(--color-border-subtle)',
            flexShrink: 0,
          }}
        >
          <div
            style={{
              fontSize: '11px',
              fontWeight: 600,
              letterSpacing: '0.04em',
              textTransform: 'uppercase',
              color: 'var(--color-text-muted)',
              lineHeight: 1.3,
            }}
          >
            {today}
          </div>
          <div
            style={{
              fontSize: '17px',
              fontWeight: 700,
              color: 'var(--color-text-primary)',
              lineHeight: 1.25,
              marginTop: '4px',
              fontFamily: 'var(--font-display, var(--font-primary))',
            }}
          >
            {briefingTitle}
          </div>
          <div
            style={{
              fontSize: '12px',
              fontWeight: 500,
              color: 'var(--color-text-secondary)',
              lineHeight: 1.45,
              marginTop: '4px',
            }}
          >
            {briefingSubtitle}
          </div>
        </div>

        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            minHeight: 0,
            padding: '12px 0 4px',
          }}
        >
          <BriefingContent role={briefingRole} phase={phase} />
        </div>
      </div>
    </div>
  );
}
