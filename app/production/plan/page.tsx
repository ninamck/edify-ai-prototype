'use client';

import { useState } from 'react';
import { LayoutGrid, ListChecks } from 'lucide-react';
import PlanStrip from '@/components/Production/PlanStrip';
import AmountsView from '@/components/Production/AmountsView';
import DaySelectorStrip from '@/components/Production/DaySelectorStrip';
import { useRole } from '@/components/Production/RoleContext';
import {
  PRET_SITES,
  getSite,
  DEMO_TODAY,
  dayOfWeek,
} from '@/components/Production/fixtures';

type PlanView = 'overview' | 'detailed';

const VIEW_TABS: Array<{ id: PlanView; label: string; icon: React.ReactNode; hint: string }> = [
  { id: 'detailed', label: 'Detailed', icon: <ListChecks size={13} />, hint: 'Full Amounts editor for the selected day' },
  { id: 'overview', label: 'Overview', icon: <LayoutGrid size={13} />, hint: '5-day outlook, recipe trace, hub dispatch' },
];

/**
 * 14-day window for the day strip: yesterday on the far left, today as the
 * second card, and the next 12 days drafting forward. Matches the manager's
 * mental model of "look back one, plan forward two weeks".
 */
const DAY_STRIP_RANGE = [-1, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

/**
 * Multi-day production planner. Combines the legacy 5-day outlook
 * (`PlanStrip`) with the same row-level editor used on the Today tab
 * (`AmountsView`) so managers can plan tomorrow / later in the week
 * without leaving the Plan view.
 */
export default function ProductionPlanPage() {
  const { can } = useRole();
  const canEdit = can('plan.editQuantity');
  const [siteId, setSiteId] = useState('hub-central');
  const [selectedDate, setSelectedDate] = useState(DEMO_TODAY);
  const [view, setView] = useState<PlanView>('detailed');
  const site = getSite(siteId) ?? PRET_SITES[0];

  const isPastDay = selectedDate < DEMO_TODAY;
  const dow = dayOfWeek(selectedDate);
  const isToday = selectedDate === DEMO_TODAY;

  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      {/* Header: site selector + view toggle */}
      <div
        style={{
          padding: '10px 16px',
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          borderBottom: '1px solid var(--color-border-subtle)',
          background: '#ffffff',
          flexWrap: 'wrap',
        }}
      >
        <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          Site
        </span>
        <div style={{ display: 'flex', gap: 4 }}>
          {PRET_SITES.map(s => {
            const active = s.id === siteId;
            return (
              <button
                key={s.id}
                onClick={() => setSiteId(s.id)}
                style={{
                  padding: '6px 10px',
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
                {s.name} · {s.type}
              </button>
            );
          })}
        </div>

        <div style={{ flex: 1 }} />

        <div
          role="tablist"
          aria-label="Plan view"
          style={{
            display: 'flex',
            background: 'var(--color-bg-hover)',
            borderRadius: 100,
            padding: 3,
            width: 'fit-content',
          }}
        >
          {VIEW_TABS.map(t => {
            const active = t.id === view;
            return (
              <button
                key={t.id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setView(t.id)}
                title={t.hint}
                style={{
                  padding: '7px 14px',
                  borderRadius: 100,
                  border: 'none',
                  fontSize: 12,
                  fontWeight: 600,
                  fontFamily: 'var(--font-primary)',
                  cursor: 'pointer',
                  background: active ? 'var(--color-accent-active)' : 'transparent',
                  color: active ? '#ffffff' : 'var(--color-text-secondary)',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  transition: 'background 0.15s, color 0.15s',
                }}
              >
                {t.icon}
                {t.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Day strip — D-1..D+12 (today sits in second slot) */}
      <DaySelectorStrip
        siteId={site.id}
        selectedDate={selectedDate}
        onSelect={setSelectedDate}
        range={DAY_STRIP_RANGE}
      />

      {/* Selected day caption */}
      <div
        style={{
          padding: '8px 16px',
          background: 'var(--color-bg-surface)',
          borderBottom: '1px solid var(--color-border-subtle)',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          fontSize: 11,
          color: 'var(--color-text-muted)',
        }}
      >
        <span style={{ fontWeight: 700, color: 'var(--color-text-secondary)' }}>
          {isToday ? 'Planning today' : `Planning ${dow} ${selectedDate}`}
        </span>
        {!isToday && (
          <span>
            ·{' '}
            {isPastDay
              ? 'historical view — runs are locked'
              : 'drafting ahead — edits flow into Benches and Sales'}
          </span>
        )}
      </div>

      {/* Body */}
      {view === 'overview' ? (
        <div style={{ padding: 0 }}>
          <PlanStrip site={site} />
        </div>
      ) : (
        <AmountsView
          siteId={site.id}
          date={selectedDate}
          canEdit={canEdit}
          topBanner={
            isPastDay ? (
              <div
                style={{
                  padding: '10px 16px',
                  background: 'var(--color-bg-surface)',
                  borderBottom: '1px solid var(--color-border-subtle)',
                  fontSize: 11,
                  fontWeight: 600,
                  color: 'var(--color-text-secondary)',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                Showing past plan — locked for review
              </div>
            ) : null
          }
        />
      )}
    </div>
  );
}
