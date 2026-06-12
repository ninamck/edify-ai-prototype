'use client';

import { useState } from 'react';
import { Calendar, ChevronDown } from 'lucide-react';
import DatePickerPopover from '@/components/Forecast/DatePickerPopover';

function formatShowingDate(iso: string): string {
  const d = new Date(`${iso}T00:00:00Z`);
  return d.toLocaleDateString('en-GB', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

/** "Showing <date>" pill + calendar popover for the Flow · Met Recipe data. */
export default function FlowDaySelector({
  date,
  onChange,
}: {
  date: string;
  onChange: (iso: string) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <span style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', gap: 8 }}>
      <span style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--color-text-muted)', whiteSpace: 'nowrap' }}>
        Showing
      </span>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="dialog"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          padding: '7px 12px',
          borderRadius: 8,
          border: `1px solid ${open ? 'var(--color-accent-active)' : 'var(--color-border-subtle)'}`,
          background: open ? 'color-mix(in srgb, var(--color-accent-active) 6%, white)' : '#fff',
          cursor: 'pointer',
          fontFamily: 'var(--font-primary)',
          fontSize: 12,
          fontWeight: 600,
          color: 'var(--color-text-primary)',
          whiteSpace: 'nowrap',
        }}
      >
        <Calendar size={13} strokeWidth={2.2} color="var(--color-text-muted)" />
        <span>{formatShowingDate(date)}</span>
        <ChevronDown size={13} strokeWidth={2.2} color="var(--color-text-muted)" />
      </button>
      {open && (
        <DatePickerPopover
          key={date}
          selectedDate={date}
          min="2026-01-01"
          max="2026-06-12"
          onSelect={(d) => {
            onChange(d);
            setOpen(false);
          }}
          onClose={() => setOpen(false)}
        />
      )}
    </span>
  );
}
