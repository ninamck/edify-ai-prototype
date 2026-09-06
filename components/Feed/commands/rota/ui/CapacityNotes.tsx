'use client';

/**
 * Where the kit, not the rota, is the limit. One line per window a
 * machine runs over capacity, with what is driving it and what to do
 * instead of adding a head. Rendered only when the engine found one.
 */

import { Gauge } from 'lucide-react';
import type { CapacityNote } from '../types';
import { hhmm } from '../engine';
import { body, label, small } from './tokens';

function joinNames(names: string[]): string {
  if (names.length === 0) return 'The machine';
  if (names.length === 1) return names[0];
  // "Machine 1 and Machine 2" reads as "both machines" when that is all there is.
  return names.every((n) => /^machine\b/i.test(n)) ? `${names.length === 2 ? 'Both' : 'All'} machines` : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
}

export default function CapacityNotes({ notes }: { notes: CapacityNote[] }) {
  if (notes.length === 0) return null;
  return (
    <section
      aria-label="Capacity: where the machine is the limit"
      style={{
        padding: '10px 12px',
        borderRadius: '10px',
        border: '1px solid var(--color-border-subtle)',
        background: 'var(--color-bg-hover)',
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
        <Gauge size={13} aria-hidden="true" style={{ color: 'var(--color-text-secondary)' }} />
        <span style={label}>Capacity, not cover</span>
      </div>
      {notes.map((n) => (
        <div key={`${n.day}-${n.start}`} style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
          <div style={{ ...body, lineHeight: 1.45 }}>
            <span style={{ fontWeight: 700 }}>
              {n.day} {hhmm(n.start)} to {hhmm(n.end)}:
            </span>{' '}
            {joinNames(n.stationNames)} at {Math.round(n.peakLoad * 100)}%{n.driver ? `. ${n.driver.replace(/\.$/, '')}` : ''}.
          </div>
          <div style={{ ...small, lineHeight: 1.45 }}>{n.advice}</div>
        </div>
      ))}
    </section>
  );
}
