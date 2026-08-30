'use client';

/**
 * Site setup · step 1 — pick the sites.
 *
 * One dropdown per site, sourced from Workday (shops that exist in HR
 * but not yet in Edify), so names always match the HR system and are
 * never typed twice. The list doubles as "what's left to roll out".
 */

import { useState } from 'react';
import { Building2, CalendarDays, ChevronDown, MapPin, Plus, Search, X } from 'lucide-react';
import CardShell, { type CardState } from './CardShell';
import { WORKDAY_NEW_SITES, getWorkdaySite } from '../siteSetupFixtures';

interface SiteSetupPickSitesCardProps {
  state: CardState;
  /** How many slots to open with (from "three new sites"). */
  requestedCount?: number;
  initialSiteIds?: string[];
  onSubmit: (input: { siteIds: string[] }) => void;
  onCancel: () => void;
  /** Reopen for edits after confirm — available until final go-live. */
  onEdit?: () => void;
}

export default function SiteSetupPickSitesCard({
  state,
  requestedCount,
  initialSiteIds,
  onSubmit,
  onCancel,
  onEdit,
}: SiteSetupPickSitesCardProps) {
  const startCount = Math.max(1, initialSiteIds?.length ?? requestedCount ?? 1);
  const [slots, setSlots] = useState<(string | null)[]>(() => {
    const base: (string | null)[] = Array.from({ length: startCount }, () => null);
    (initialSiteIds ?? []).forEach((id, i) => { base[i] = id; });
    return base;
  });
  const [openIdx, setOpenIdx] = useState<number | null>(null);
  const [query, setQuery] = useState('');

  const disabled = state !== 'pending';
  const pickedIds = new Set(slots.filter((s): s is string => s !== null));
  const allFilled = slots.length > 0 && slots.every((s) => s !== null);

  function setSlot(idx: number, id: string) {
    setSlots((prev) => prev.map((s, i) => (i === idx ? id : s)));
    setOpenIdx(null);
    setQuery('');
  }
  function removeSlot(idx: number) {
    setSlots((prev) => prev.filter((_, i) => i !== idx));
    setOpenIdx(null);
  }

  return (
    <CardShell
      icon={Building2}
      title={slots.length === 1 ? 'Which site?' : `Which ${slots.length} sites?`}
      subtitle={`From Workday · ${WORKDAY_NEW_SITES.length} shops not yet in Edify`}
      state={state}
      confirmLabel="Continue"
      confirmDisabled={!allFilled}
      onCancel={onCancel}
      onEdit={onEdit}
      onConfirm={() => {
        if (allFilled) onSubmit({ siteIds: slots as string[] });
      }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {slots.map((siteId, idx) => {
          const site = siteId ? getWorkdaySite(siteId) : undefined;
          const isOpen = openIdx === idx;
          const options = WORKDAY_NEW_SITES.filter(
            (s) =>
              (!pickedIds.has(s.id) || s.id === siteId) &&
              (query.trim() === '' ||
                s.shortName.toLowerCase().includes(query.toLowerCase()) ||
                s.location.toLowerCase().includes(query.toLowerCase())),
          );
          return (
            <div key={idx}>
              <div style={{ display: 'flex', gap: '6px', alignItems: 'stretch' }}>
                <button
                  type="button"
                  disabled={disabled}
                  onClick={() => {
                    setOpenIdx(isOpen ? null : idx);
                    setQuery('');
                  }}
                  style={{
                    flex: 1,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    padding: '10px 12px',
                    borderRadius: '12px',
                    border: isOpen
                      ? '1.5px solid var(--color-accent-active, #001C35)'
                      : '1.5px solid var(--color-border, rgba(0,28,53,0.18))',
                    background: '#fff',
                    textAlign: 'left',
                    cursor: disabled ? 'not-allowed' : 'pointer',
                    fontFamily: 'var(--font-primary)',
                  }}
                >
                  <span
                    style={{
                      fontSize: '10px',
                      fontWeight: 700,
                      letterSpacing: '0.05em',
                      color: 'var(--color-text-muted)',
                      flexShrink: 0,
                    }}
                  >
                    {idx + 1}
                  </span>
                  {site ? (
                    <span style={{ flex: 1, minWidth: 0 }}>
                      <span style={{ display: 'block', fontSize: '13px', fontWeight: 700, color: 'var(--color-text-primary)' }}>
                        {site.shortName}
                      </span>
                      <span
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '10px',
                          fontSize: '11px',
                          color: 'var(--color-text-muted)',
                          marginTop: '2px',
                        }}
                      >
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          <MapPin size={10} style={{ flexShrink: 0 }} /> {site.location}
                        </span>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', flexShrink: 0 }}>
                          <CalendarDays size={10} /> Opens {site.openingDate}
                        </span>
                      </span>
                    </span>
                  ) : (
                    <span style={{ flex: 1, fontSize: '13px', fontWeight: 500, color: 'var(--color-text-muted)' }}>
                      Choose a shop
                    </span>
                  )}
                  <ChevronDown
                    size={14}
                    color="var(--color-text-muted)"
                    style={{ flexShrink: 0, transform: isOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.12s' }}
                  />
                </button>
                {slots.length > 1 && !disabled && (
                  <button
                    type="button"
                    onClick={() => removeSlot(idx)}
                    aria-label="Remove this site"
                    style={{
                      width: '34px',
                      borderRadius: '12px',
                      border: '1.5px solid var(--color-border, rgba(0,28,53,0.18))',
                      background: '#fff',
                      color: 'var(--color-text-muted)',
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                    }}
                  >
                    <X size={13} />
                  </button>
                )}
              </div>

              {isOpen && !disabled && (
                <div
                  style={{
                    marginTop: '4px',
                    background: '#fff',
                    border: '1px solid var(--color-border, rgba(0,28,53,0.18))',
                    borderRadius: '12px',
                    boxShadow: '0 4px 14px rgba(0,28,53,0.10)',
                    overflow: 'hidden',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      padding: '8px 10px',
                      borderBottom: '1px solid var(--color-border-subtle, rgba(0,28,53,0.08))',
                    }}
                  >
                    <Search size={12} color="var(--color-text-muted)" />
                    <input
                      autoFocus
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      placeholder="Search shops"
                      style={{
                        flex: 1,
                        border: 'none',
                        outline: 'none',
                        fontSize: '12px',
                        fontFamily: 'var(--font-primary)',
                        color: 'var(--color-text-primary)',
                        background: 'transparent',
                      }}
                    />
                  </div>
                  <div style={{ maxHeight: '220px', overflowY: 'auto' }}>
                    {options.length === 0 && (
                      <div style={{ padding: '12px', fontSize: '12px', color: 'var(--color-text-muted)' }}>
                        No shops match.
                      </div>
                    )}
                    {options.map((s) => (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => setSlot(idx, s.id)}
                        style={{
                          display: 'block',
                          width: '100%',
                          padding: '9px 12px',
                          border: 'none',
                          borderBottom: '1px solid var(--color-border-subtle, rgba(0,28,53,0.06))',
                          background: s.id === siteId ? 'rgba(40,175,201,0.06)' : '#fff',
                          textAlign: 'left',
                          cursor: 'pointer',
                          fontFamily: 'var(--font-primary)',
                        }}
                      >
                        <span style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: '8px' }}>
                          <span style={{ fontSize: '12.5px', fontWeight: 700, color: 'var(--color-text-primary)' }}>
                            {s.shortName}
                          </span>
                          <span style={{ fontSize: '10.5px', color: 'var(--color-text-muted)', flexShrink: 0 }}>
                            Opens {s.openingDate}
                          </span>
                        </span>
                        <span
                          style={{
                            display: 'block',
                            fontSize: '11px',
                            color: 'var(--color-text-muted)',
                            marginTop: '1px',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {s.location} · {s.roster.length} people in Workday
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })}

        {!disabled && slots.length < WORKDAY_NEW_SITES.length && (
          <button
            type="button"
            onClick={() => setSlots((prev) => [...prev, null])}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '5px',
              alignSelf: 'flex-start',
              padding: '6px 12px',
              borderRadius: '100px',
              border: '1.5px dashed var(--color-border, rgba(0,28,53,0.22))',
              background: '#fff',
              fontSize: '12px',
              fontWeight: 600,
              fontFamily: 'var(--font-primary)',
              color: 'var(--color-text-secondary)',
              cursor: 'pointer',
            }}
          >
            <Plus size={12} /> Add another site
          </button>
        )}
      </div>
    </CardShell>
  );
}
