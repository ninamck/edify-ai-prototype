'use client';

import { useEffect, useRef, useState } from 'react';
import { Check, ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react';
import { gbp } from './format';
import {
  QUICK_COUNT_SESSIONS,
  countLabel,
  longDayLabel,
  sessionVarPrevCost,
  weekLabel,
  type CountKind,
  type CountSession,
} from './quickCounts';

export const LATEST = 'latest';

/** Show the Quick / Group filter once the list gets long. */
const FILTER_FROM = 10;

const NEWEST_FIRST = QUICK_COUNT_SESSIONS.slice().reverse();
const ORDER = [LATEST, ...NEWEST_FIRST.map((s) => s.id)];

function varColor(n: number): string {
  if (Math.round(n) === 0) return 'var(--color-text-muted)';
  return n > 0 ? 'var(--color-error)' : 'var(--color-success)';
}

function money(n: number): string {
  return Math.round(n) === 0 ? '\u00a30' : gbp(n, { sign: true, decimals: 0 });
}

function labelFor(value: string): string {
  if (value === LATEST) return 'Latest count for each product';
  const s = QUICK_COUNT_SESSIONS.find((x) => x.id === value);
  return s ? `${longDayLabel(s.day)} \u00b7 ${countLabel(s)}` : '';
}

const ARROW: React.CSSProperties = {
  width: 40,
  height: 40,
  borderRadius: 8,
  border: '1px solid var(--color-border)',
  background: '#fff',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  color: 'var(--color-text-primary)',
  cursor: 'pointer',
  flexShrink: 0,
};

export default function CountPicker({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const [open, setOpen] = useState(false);
  const [kindFilter, setKindFilter] = useState<'all' | CountKind>('all');
  const wrapRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const selectedRef = useRef<HTMLButtonElement>(null);

  const idx = ORDER.indexOf(value);
  const older = idx < ORDER.length - 1 ? ORDER[idx + 1] : null;
  const newer = idx > 0 ? ORDER[idx - 1] : null;

  useEffect(() => {
    if (!open) return;
    selectedRef.current?.focus();
    function onDown(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  function choose(v: string) {
    onChange(v);
    setOpen(false);
    triggerRef.current?.focus();
  }

  const showFilter = NEWEST_FIRST.length > FILTER_FROM;
  const listed = NEWEST_FIRST.filter((s) => kindFilter === 'all' || s.kind === kindFilter);
  const weeks: { label: string; sessions: CountSession[] }[] = [];
  for (const s of listed) {
    const label = weekLabel(s.day);
    const last = weeks[weeks.length - 1];
    if (last && last.label === label) last.sessions.push(s);
    else weeks.push({ label, sessions: [s] });
  }

  return (
    <div ref={wrapRef} style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 6 }}>
      <button
        type="button"
        aria-label="Older count"
        disabled={!older}
        onClick={() => older && onChange(older)}
        style={{ ...ARROW, opacity: older ? 1 : 0.4, cursor: older ? 'pointer' : 'default' }}
      >
        <ChevronLeft size={16} aria-hidden />
      </button>

      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="true"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        style={{
          minHeight: 40,
          minWidth: 300,
          padding: '0 12px',
          borderRadius: 8,
          border: '1px solid var(--color-border)',
          background: '#fff',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 10,
          fontSize: 13,
          fontWeight: 600,
          fontFamily: 'var(--font-primary)',
          color: 'var(--color-text-primary)',
          cursor: 'pointer',
        }}
      >
        {labelFor(value)}
        <ChevronDown size={15} color="var(--color-text-muted)" aria-hidden />
      </button>

      <button
        type="button"
        aria-label="Newer count"
        disabled={!newer}
        onClick={() => newer && onChange(newer)}
        style={{ ...ARROW, opacity: newer ? 1 : 0.4, cursor: newer ? 'pointer' : 'default' }}
      >
        <ChevronRight size={16} aria-hidden />
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="Choose a count"
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              setOpen(false);
              triggerRef.current?.focus();
            }
          }}
          style={{
            position: 'absolute',
            top: 'calc(100% + 6px)',
            left: 46,
            zIndex: 30,
            width: 380,
            maxHeight: 420,
            overflowY: 'auto',
            padding: 6,
            borderRadius: 'var(--radius-card)',
            border: '1px solid var(--color-border-subtle)',
            background: '#fff',
            boxShadow: '0 8px 28px rgba(0, 28, 53, 0.16)',
          }}
        >
          <Option
            refProp={value === LATEST ? selectedRef : undefined}
            selected={value === LATEST}
            title="Latest count for each product"
            sub="Each product's most recent quick or group count"
            onClick={() => choose(LATEST)}
          />

          {showFilter && (
            <div role="group" aria-label="Count type" style={{ display: 'flex', gap: 6, padding: '8px 8px 2px' }}>
              {(
                [
                  ['all', 'All'],
                  ['quick', 'Quick counts'],
                  ['group', 'Group counts'],
                ] as ['all' | CountKind, string][]
              ).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  aria-pressed={kindFilter === id}
                  onClick={() => setKindFilter(id)}
                  style={{
                    minHeight: 32,
                    padding: '0 10px',
                    borderRadius: 999,
                    border: `1px solid ${kindFilter === id ? 'var(--color-accent-deep)' : 'var(--color-border)'}`,
                    background: kindFilter === id ? 'var(--color-accent-deep)' : '#fff',
                    color: kindFilter === id ? '#fff' : 'var(--color-text-secondary)',
                    fontSize: 12,
                    fontWeight: 600,
                    fontFamily: 'var(--font-primary)',
                    cursor: 'pointer',
                  }}
                >
                  {label}
                </button>
              ))}
            </div>
          )}

          {weeks.map((w) => (
            <div key={w.label} role="group" aria-label={w.label}>
              <div
                style={{
                  padding: '10px 8px 4px',
                  fontSize: 10.5,
                  fontWeight: 700,
                  letterSpacing: '0.05em',
                  textTransform: 'uppercase',
                  color: 'var(--color-text-muted)',
                }}
              >
                {w.label}
              </div>
              {w.sessions.map((s) => {
                const v = sessionVarPrevCost(s.id);
                return (
                  <Option
                    key={s.id}
                    refProp={value === s.id ? selectedRef : undefined}
                    selected={value === s.id}
                    title={`${longDayLabel(s.day)} \u00b7 ${countLabel(s)}`}
                    sub={`${s.counter} \u00b7 ${s.itemIds.length} products`}
                    right={
                      <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                        <span style={{ fontSize: 13, fontWeight: 700, color: varColor(v) }}>{money(v)}</span>
                        <span style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>vs previous</span>
                      </span>
                    }
                    onClick={() => choose(s.id)}
                  />
                );
              })}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Option({
  title,
  sub,
  right,
  selected,
  onClick,
  refProp,
}: {
  title: string;
  sub: string;
  right?: React.ReactNode;
  selected: boolean;
  onClick: () => void;
  refProp?: React.Ref<HTMLButtonElement>;
}) {
  return (
    <button
      ref={refProp}
      type="button"
      aria-current={selected ? 'true' : undefined}
      onClick={onClick}
      style={{
        width: '100%',
        minHeight: 48,
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '8px 10px',
        borderRadius: 8,
        border: 'none',
        background: selected ? 'var(--color-bg-hover)' : 'transparent',
        cursor: 'pointer',
        textAlign: 'left',
        fontFamily: 'var(--font-primary)',
      }}
    >
      <span style={{ width: 16, flexShrink: 0, display: 'inline-flex' }}>
        {selected && <Check size={15} color="var(--color-accent-deep)" aria-hidden />}
      </span>
      <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text-primary)' }}>{title}</span>
        <span style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>{sub}</span>
      </span>
      {right}
    </button>
  );
}
