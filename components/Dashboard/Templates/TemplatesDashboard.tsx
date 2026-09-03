'use client';

/**
 * Starter-templates dashboard — one dashboard, calendar-driven default.
 *
 * A new customer gets key information from day one without configuring
 * anything: the view that renders is chosen by what day it is, not by a
 * template menu. Monday opens on the weekly flash; the days straight after
 * a period closes open on period end; every other day opens on daily.
 * The switcher is still there — the calendar only picks the default.
 */

import { useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { CalendarDays, CalendarRange, BookOpenCheck } from 'lucide-react';
import { useActiveSite } from '@/components/ActiveSite/ActiveSiteContext';
import { FJ_ALL_SHOPS_ID, isFarmerJShopId } from '@/components/Production/farmerj/shops';
import DailyTemplate from './DailyTemplate';
import WeeklyFlashTemplate from './WeeklyFlashTemplate';
import PeriodEndTemplate from './PeriodEndTemplate';
import { farmerJDaily, farmerJPeriod, farmerJWeekly } from './farmerJTemplateData';
import { NAVY } from './templateParts';

type TemplateId = 'daily' | 'weekly' | 'period';

/**
 * Calendar-driven default. Period boundaries are mocked as every fourth
 * Sunday; in production this comes from the customer's trading calendar.
 */
export function defaultTemplateForDate(now: Date): TemplateId {
  const day = now.getDay(); // 0 = Sunday, 1 = Monday
  // Mock period end: P7 closed Sunday 19 Jul 2026 — surface the period-end
  // report for the two working days after a close.
  const periodClose = new Date(2026, 6, 19);
  const daysSinceClose = Math.floor((now.getTime() - periodClose.getTime()) / 86_400_000);
  if (daysSinceClose >= 1 && daysSinceClose <= 2) return 'period';
  if (day === 1) return 'weekly';
  return 'daily';
}

const TEMPLATE_META: Record<TemplateId, { label: string; question: string; icon: typeof CalendarDays }> = {
  daily: { label: 'Daily', question: 'What needs my attention today?', icon: CalendarDays },
  weekly: { label: 'Weekly flash', question: 'Which sites are drifting?', icon: CalendarRange },
  period: { label: 'Period end', question: 'What happened to GP, and why?', icon: BookOpenCheck },
};

export default function TemplatesDashboard({
  controls,
}: {
  /** Shared home-tab toolbar (date range, Add insight, Edit view). */
  controls?: ReactNode;
}) {
  const [active, setActive] = useState<TemplateId>(() => defaultTemplateForDate(new Date()));

  // Farmer J renders the same three templates from its own estate. Daily
  // follows the shop picked in the site switcher, like the Sales tab does;
  // weekly and period end are always every shop.
  const { isFarmerJ, productionSiteId } = useActiveSite();
  const fjScope = isFarmerJ
    ? productionSiteId && isFarmerJShopId(productionSiteId) ? productionSiteId : FJ_ALL_SHOPS_ID
    : null;
  const fjDaily = useMemo(() => (fjScope ? farmerJDaily(fjScope) : undefined), [fjScope]);
  const fjWeekly = useMemo(() => (fjScope ? farmerJWeekly() : undefined), [fjScope]);
  const fjPeriod = useMemo(() => (fjScope ? farmerJPeriod() : undefined), [fjScope]);
  const question = (id: TemplateId) =>
    id === 'weekly' && isFarmerJ ? 'Which shops are drifting?' : TEMPLATE_META[id].question;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          flexWrap: 'wrap',
          maxWidth: 1400,
          margin: '0 auto',
          width: '100%',
        }}
      >
        <div style={{ display: 'inline-flex', gap: 4, padding: 4, borderRadius: 10, border: `1px solid ${NAVY}`, background: '#fff' }}>
          {(Object.keys(TEMPLATE_META) as TemplateId[]).map((id) => {
            const meta = TEMPLATE_META[id];
            const Icon = meta.icon;
            const selected = id === active;
            return (
              <button
                key={id}
                onClick={() => setActive(id)}
                aria-pressed={selected}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '7px 12px',
                  borderRadius: 7,
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: 12.5,
                  fontWeight: 700,
                  fontFamily: 'inherit',
                  background: selected ? NAVY : 'transparent',
                  color: selected ? '#fff' : 'var(--color-text-secondary)',
                }}
              >
                <Icon size={13} strokeWidth={2.2} />
                {meta.label}
              </button>
            );
          })}
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          {controls}
        </div>
      </div>

      {/* Question line for the active view, directly under the switcher. */}
      <div
        style={{
          display: 'flex',
          alignItems: 'baseline',
          gap: 12,
          flexWrap: 'wrap',
          maxWidth: 1400,
          margin: '0 auto',
          width: '100%',
        }}
      >
        <span style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--color-text-muted)' }}>
          {question(active)}
        </span>
      </div>

      {active === 'daily' && <DailyTemplate data={fjDaily} />}
      {active === 'weekly' && <WeeklyFlashTemplate invoiceMatchingLive data={fjWeekly} />}
      {active === 'period' && <PeriodEndTemplate invoiceMatchingLive data={fjPeriod} />}
    </div>
  );
}
