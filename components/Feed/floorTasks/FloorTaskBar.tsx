'use client';

import { useState, type ReactNode } from 'react';
import { ChevronDown, Headphones, Inbox, Smartphone } from 'lucide-react';
import { FLOOR_TASKS } from '@/lib/floorTasks/registry';
import type { Role, Surface } from '@/lib/floorTasks/types';
import { declineProposal, setRole, setSurface, useWorld, waitingProposals } from '@/lib/floorTasks/world/store';

/**
 * Waiting for you: Show-it tasks raised on a headset that need a screen
 * before they go through. They stay until someone confirms them or the
 * trading day ends. The role and device switches live in Demo controls;
 * `switches` shows them inline for the test page, which has no demo panel.
 */
export default function FloorTaskBar({ onOpen, compact, switches }: { onOpen: (proposalId: string) => void; compact?: boolean; switches?: boolean }) {
  const w = useWorld();
  const waiting = waitingProposals(w);
  const [open, setOpen] = useState(!compact);
  const showChip = compact && waiting.length > 0;

  if (!switches && !showChip && !(waiting.length > 0 && open)) return null;

  return (
    <div style={{ marginTop: compact ? 0 : '14px', marginBottom: compact ? '8px' : 0, fontFamily: 'var(--font-primary)' }}>
      {(switches || showChip) && (
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', justifyContent: compact ? 'flex-start' : 'center' }}>
        {switches && <FloorTaskSwitches />}
        {showChip && (
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            style={{ ...chip, background: 'var(--color-warning-light)', borderColor: 'var(--color-warning-border)', color: 'var(--color-text-primary)' }}
          >
            <Inbox size={14} strokeWidth={2} /> Waiting for you · {waiting.length}
            <ChevronDown size={14} style={{ transform: open ? 'rotate(180deg)' : 'none' }} />
          </button>
        )}
      </div>
      )}

      {waiting.length > 0 && open && (
        <section aria-label="Waiting for you" style={{ marginTop: '10px', border: '1px solid var(--color-border-subtle, rgba(0,28,53,0.12))', borderRadius: '12px', background: '#fff', overflow: 'hidden' }}>
          <div style={{ padding: '10px 14px 6px', fontSize: '12px', fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--color-text-secondary)' }}>
            Waiting for you · {waiting.length}
          </div>
          {waiting.map((p) => (
            <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 14px', borderTop: '1px solid var(--color-border-subtle, rgba(0,28,53,0.06))' }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-text-primary)' }}>{p.label}</div>
                <div style={{ fontSize: '11.5px', color: 'var(--color-text-secondary)' }}>
                  {FLOOR_TASKS[p.taskId].title} · said on a headset at {new Date(p.createdAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })} · goes at close
                </div>
              </div>
              <button type="button" onClick={() => declineProposal(p.id)} style={chip}>Dismiss</button>
              <button type="button" onClick={() => onOpen(p.id)} style={{ ...chip, background: 'var(--color-accent-active, #224444)', color: '#fff', borderColor: 'transparent' }}>
                Review
              </button>
            </div>
          ))}
        </section>
      )}
    </div>
  );
}

const chip: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: '6px',
  minHeight: '40px',
  padding: '0 14px',
  borderRadius: '100px',
  border: '1.5px solid var(--color-border, rgba(0,28,53,0.18))',
  background: '#fff',
  color: 'var(--color-text-primary)',
  fontSize: '12.5px',
  fontWeight: 600,
  fontFamily: 'var(--font-primary)',
  cursor: 'pointer',
};

/** Who's talking and on what. */
export function FloorTaskSwitches({ size = 'regular' }: { size?: 'regular' | 'small' }) {
  const w = useWorld();
  return (
    <>
      <Segmented<Role>
        label="Who's using Edify"
        value={w.role}
        onChange={setRole}
        size={size}
        options={[
          { value: 'team-member', label: 'Team member' },
          { value: 'manager', label: 'Manager' },
        ]}
      />
      <Segmented<Surface>
        label="Device"
        value={w.surface}
        onChange={setSurface}
        size={size}
        options={[
          { value: 'app', label: 'App', icon: <Smartphone size={size === 'small' ? 12 : 14} strokeWidth={2} /> },
          { value: 'headset', label: 'Headset', icon: <Headphones size={size === 'small' ? 12 : 14} strokeWidth={2} /> },
        ]}
      />
    </>
  );
}

function Segmented<T extends string>({
  label,
  value,
  onChange,
  options,
  size = 'regular',
}: {
  label: string;
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string; icon?: ReactNode }[];
  size?: 'regular' | 'small';
}) {
  const small = size === 'small';
  return (
    <div role="group" aria-label={label} style={{ display: 'flex', padding: '3px', borderRadius: '100px', background: 'rgba(0,28,53,0.05)', width: small ? '100%' : 'auto' }}>
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(o.value)}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              flex: small ? 1 : undefined,
              gap: '6px',
              minHeight: small ? '30px' : '36px',
              padding: small ? '0 8px' : '0 14px',
              borderRadius: '100px',
              border: 'none',
              background: active ? '#fff' : 'transparent',
              boxShadow: active ? '0 1px 4px rgba(0,28,53,0.14)' : 'none',
              color: active ? 'var(--color-text-primary)' : 'var(--color-text-secondary)',
              fontSize: small ? '11.5px' : '12.5px',
              fontWeight: 600,
              fontFamily: 'var(--font-primary)',
              cursor: 'pointer',
            }}
          >
            {o.icon}
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
