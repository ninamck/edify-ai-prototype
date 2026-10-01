'use client';

/**
 * OrderTimeline — the event trail for one order, oldest first. Edify's
 * steps carry the EdifyMark; the operator's carry their initials. This
 * is the audit record: every action in the store appends an event here,
 * so what the GM reads is exactly what happened.
 */

import EdifyMark from '@/components/EdifyMark/EdifyMark';
import type { OrderEvent } from './types';
import { formatClock } from './store';

const TONE: Partial<Record<OrderEvent['type'], string>> = {
  held: 'var(--color-warning)',
  'send-failed': 'var(--color-error)',
  queued: 'var(--color-warning)',
  cancelled: 'var(--color-error)',
  sent: 'var(--color-success)',
  'operator-sent': 'var(--color-success)',
  scheduled: 'var(--color-info)',
  'operator-scheduled': 'var(--color-info)',
  amended: 'var(--color-info)',
};

/** Event types whose text stays primary-coloured; only the actor dot takes the tone. */
const QUIET_TEXT = new Set<OrderEvent['type']>(['sent', 'operator-sent', 'scheduled', 'operator-scheduled', 'amended']);

export default function OrderTimeline({ events }: { events: OrderEvent[] }) {
  return (
    <ol
      aria-label="What happened to this order"
      style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column' }}
    >
      {events.map((e, i) => {
        const last = i === events.length - 1;
        const tone = TONE[e.type];
        return (
          <li
            key={e.id}
            style={{
              display: 'grid',
              gridTemplateColumns: '70px 24px minmax(0, 1fr)',
              columnGap: 10,
              alignItems: 'flex-start',
              position: 'relative',
              paddingBottom: last ? 0 : 12,
            }}
          >
            <span
              style={{
                fontSize: 12, fontWeight: 600, fontVariantNumeric: 'tabular-nums',
                color: 'var(--color-text-muted)', lineHeight: '24px',
              }}
            >
              {dayPrefix(e.at, events[i - 1]?.at)}{formatClock(e.at)}
            </span>
            <span style={{ position: 'relative', width: 24, height: 24 }}>
              {!last && (
                <span
                  aria-hidden
                  style={{
                    position: 'absolute', left: 11, top: 24, bottom: -12, width: 2,
                    background: 'var(--color-border)',
                  }}
                />
              )}
              <Actor actor={e.actor} tone={tone} />
            </span>
            <span
              style={{
                fontSize: 13, lineHeight: '24px',
                color: tone && !QUIET_TEXT.has(e.type) ? tone : 'var(--color-text-primary)',
                fontWeight: last ? 600 : 400,
              }}
            >
              {e.text}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

function Actor({ actor, tone }: { actor: OrderEvent['actor']; tone?: string }) {
  if (actor.kind === 'edify') {
    return (
      <span
        title="Edify"
        style={{
          width: 24, height: 24, borderRadius: '50%',
          background: tone ? '#fff' : 'var(--color-accent-active)',
          border: tone ? `1.5px solid ${tone}` : '1.5px solid var(--color-accent-active)',
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          position: 'relative', zIndex: 1,
        }}
      >
        <EdifyMark size={12} color={tone ?? '#fff'} />
      </span>
    );
  }
  return (
    <span
      title={actor.name}
      style={{
        width: 24, height: 24, borderRadius: '50%',
        background: 'var(--color-bg-hover)',
        border: '1.5px solid var(--color-border)',
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 9.5, fontWeight: 700, letterSpacing: '0.02em',
        color: 'var(--color-text-primary)', fontFamily: 'var(--font-primary)',
        position: 'relative', zIndex: 1,
      }}
    >
      {actor.initials}
    </span>
  );
}

/** Show the day only when it changes from the previous event. */
function dayPrefix(at: string, prevAt?: string): string {
  const day = at.slice(0, 10);
  if (prevAt && prevAt.slice(0, 10) === day) return '';
  const d = new Date(`${day}T12:00:00`);
  return `${d.toLocaleDateString('en-GB', { weekday: 'short' })} `;
}
