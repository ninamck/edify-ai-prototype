'use client';

/**
 * /labour: the labour guide outside chat.
 *
 * Three tabs, one question each.
 *   This week: what the workload says each day part needs, against what
 *              is rostered (the Edify draft once written, the Deputy
 *              draft before that).
 *   Last week: where the site ran under guide, beside what it cost in
 *              waste, stock variance, checklist completion and speed of
 *              service. One sentence of attribution at the top.
 *   Estate:    every site ranked by hours against guide, with the same
 *              outcome columns. The HQ buyer's front door.
 *
 * Deputy stays the system of record for the rota. This page reads.
 */

import { useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { AlertTriangle, ArrowRight, CalendarClock } from 'lucide-react';
import AreaTopBar from '@/components/TopBar/AreaTopBar';
import { ACTIVE_SITES, useActiveSite } from '@/components/ActiveSite/ActiveSiteContext';
import { deputyDraftFor, sitesWithDrafts } from '@/components/Feed/commands/rota/deputy';
import { estateLabourRows, siteLabourFor } from '@/components/Feed/commands/rota/sources';
import { labourGuide } from '@/components/Feed/commands/rota/engine';
import { useWrittenDraft } from '@/components/Feed/commands/rota/rotaStore';
import { DAY_KEYS, type DayKey, type DayPartOutcome } from '@/components/Feed/commands/rota/types';
import { ghostButton, label, primaryButton, small } from '@/components/Feed/commands/rota/ui/tokens';

type Tab = 'this-week' | 'last-week' | 'estate';

const TABS: { id: Tab; label: string }[] = [
  { id: 'this-week', label: 'This week' },
  { id: 'last-week', label: 'Last week' },
  { id: 'estate', label: 'Estate' },
];

const DAY_NAME: Record<DayKey, string> = { Mon: 'Monday', Tue: 'Tuesday', Wed: 'Wednesday', Thu: 'Thursday', Fri: 'Friday', Sat: 'Saturday', Sun: 'Sunday' };

const cell: React.CSSProperties = {
  padding: '8px 10px',
  fontSize: '12.5px',
  color: 'var(--color-text-primary)',
  fontVariantNumeric: 'tabular-nums',
  borderBottom: '1px solid var(--color-border-subtle)',
  verticalAlign: 'top',
  textAlign: 'right',
};

const headCell: React.CSSProperties = {
  ...cell,
  ...label,
  padding: '6px 10px',
  textAlign: 'right',
  borderBottom: '1px solid var(--color-border)',
  whiteSpace: 'nowrap',
};

const card: React.CSSProperties = {
  background: '#fff',
  border: '1px solid var(--color-border-subtle)',
  borderRadius: '12px',
  padding: '16px 18px',
};

function signedHours(n: number): string {
  if (n === 0) return 'on guide';
  return `${n > 0 ? '+' : ''}${n}h`;
}

function tone(hoursVsGuide: number): { bg: string; color: string } {
  if (hoursVsGuide <= -2) return { bg: 'var(--color-error-light)', color: 'var(--color-error)' };
  if (hoursVsGuide < 0) return { bg: 'var(--color-warning-light)', color: 'var(--color-text-primary)' };
  if (hoursVsGuide >= 3) return { bg: 'var(--color-bg-hover)', color: 'var(--color-text-secondary)' };
  return { bg: 'transparent', color: 'var(--color-text-primary)' };
}

function EmptyState({ siteName, alternatives, onSwitch }: { siteName: string; alternatives: { id: string; name: string }[]; onSwitch: (siteId: string) => void }) {
  const router = useRouter();
  return (
    <div style={{ ...card, display: 'flex', flexDirection: 'column', gap: '10px', maxWidth: 560 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', fontWeight: 700, color: 'var(--color-text-primary)' }}>
        <CalendarClock size={16} aria-hidden="true" /> No labour view for {siteName} yet
      </div>
      <div style={{ fontSize: '13px', lineHeight: 1.5, color: 'var(--color-text-primary)' }}>
        Edify builds the labour guide from the site&apos;s forecast and its draft rota in Workforce.com. {siteName} has no Workforce.com draft connected in this build.
        {alternatives.length > 0 ? ` ${alternatives.map((a) => a.name).join(' and ')} ${alternatives.length === 1 ? 'does' : 'do'}.` : ''}
      </div>
      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
        {alternatives.map((a) => (
          <button key={a.id} type="button" style={primaryButton} onClick={() => onSwitch(a.id)}>
            Show {a.name}
          </button>
        ))}
        <button type="button" style={ghostButton} onClick={() => router.push('/')}>
          Ask in the Command Centre
        </button>
      </div>
    </div>
  );
}

// ─── This week ──────────────────────────────────────────────────────────────

function ThisWeek({ siteId }: { siteId: string }) {
  const router = useRouter();
  const site = siteLabourFor(siteId);
  const draft = deputyDraftFor(siteId);
  const written = useWrittenDraft(siteId);
  const guide = useMemo(() => (site ? labourGuide(site, written?.shifts ?? draft?.shifts ?? []) : []), [site, written, draft]);
  if (!site || !draft) return null;

  const dayParts = guide[0]?.byDayPart.map((p) => p.dayPart) ?? [];
  const totalGuide = guide.reduce((s, r) => s + r.guideHours, 0);
  const totalRostered = guide.reduce((s, r) => s + r.rosteredHours, 0);
  const underParts = guide.flatMap((r) => r.byDayPart.filter((p) => p.rosteredHours - p.guideHours <= -1).map((p) => `${r.day} ${p.dayPart.toLowerCase()}`));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
      <div style={{ ...card, display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: '16px', flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontSize: '15px', fontWeight: 700, color: 'var(--color-text-primary)' }}>
            {draft.weekLabel}: guide {totalGuide}h, rostered {totalRostered}h
          </div>
          <div style={{ ...small, marginTop: '3px', fontSize: '12.5px' }}>
            {written
              ? `Edify draft written to ${draft.tool} at ${written.writtenAt}, ${written.accepted.length} changes. Awaiting publish in ${draft.tool}.`
              : `${draft.tool} draft as synced ${draft.lastSynced}. Not yet rebalanced.`}
            {underParts.length > 0 ? ` Under guide: ${underParts.join(', ')}.` : ' Every day part is at or above guide.'}
          </div>
        </div>
        {!written && (
          <button type="button" style={{ ...primaryButton, display: 'inline-flex', alignItems: 'center', gap: '6px' }} onClick={() => router.push('/?flow=rota')}>
            Rebalance in the Command Centre <ArrowRight size={13} aria-hidden="true" />
          </button>
        )}
      </div>

      <div style={{ ...card, padding: 0, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }} aria-label="Labour guide by day part against rostered hours">
          <thead>
            <tr>
              <th style={{ ...headCell, textAlign: 'left' }}>Day</th>
              {dayParts.map((dp) => (
                <th key={dp} style={headCell}>
                  {dp}
                </th>
              ))}
              <th style={headCell}>Day</th>
            </tr>
          </thead>
          <tbody>
            {guide.map((r) => (
              <tr key={r.day}>
                <td style={{ ...cell, textAlign: 'left', fontWeight: 600 }}>{DAY_NAME[r.day]}</td>
                {r.byDayPart.map((p) => {
                  const diff = p.rosteredHours - p.guideHours;
                  const t = tone(diff);
                  const closed = p.guideHours === 0 && p.rosteredHours === 0;
                  return (
                    <td key={p.dayPart} style={{ ...cell, background: t.bg }}>
                      {closed ? (
                        <span style={{ color: 'var(--color-text-secondary)' }}>closed</span>
                      ) : (
                        <>
                          <div>
                            <span style={{ color: 'var(--color-text-secondary)' }}>{p.guideHours}h guide</span> <strong>{p.rosteredHours}h</strong>
                          </div>
                          <div style={{ ...small, color: t.color, fontWeight: 600 }}>{signedHours(Math.round(diff * 2) / 2)}</div>
                        </>
                      )}
                    </td>
                  );
                })}
                <td style={{ ...cell, fontWeight: 600 }}>
                  <div>
                    <span style={{ color: 'var(--color-text-secondary)', fontWeight: 500 }}>{r.guideHours}h guide</span> {r.rosteredHours}h
                  </div>
                  <div style={{ ...small, color: tone(r.rosteredHours - r.guideHours).color, fontWeight: 600 }}>{signedHours(Math.round((r.rosteredHours - r.guideHours) * 2) / 2)}</div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div style={{ ...small, lineHeight: 1.5 }}>
        The guide is the hours the workload needs: forecast sales at the site&apos;s labour standards, plus fixed work (deliveries, prep, stocktake, close-down), never below {site.floorMinimum} on the floor. Rostered is hours on the floor inside trading hours, breaks included, so it reads higher than paid hours. Red: 2h or more under. Amber: under. Grey: 3h or more over.
      </div>
    </div>
  );
}

// ─── Last week ──────────────────────────────────────────────────────────────

function OutcomeCell({ o }: { o: DayPartOutcome }) {
  if (o.speedOfServiceSec === 0) return <td style={{ ...cell, color: 'var(--color-text-secondary)' }}>closed</td>;
  const t = tone(o.hoursVsGuide);
  const bad = o.hoursVsGuide < 0;
  return (
    <td style={{ ...cell, background: t.bg }}>
      <div style={{ fontWeight: 700, color: t.color }}>{signedHours(o.hoursVsGuide)}</div>
      <div style={{ ...small, lineHeight: 1.45, color: bad ? 'var(--color-text-primary)' : 'var(--color-text-secondary)' }}>
        waste {o.wasteVsWeekday.toFixed(1)}x
        <br />
        {o.speedOfServiceSec}s service
        <br />
        checks {Math.round(o.checklistCompletion * 100)}%
      </div>
    </td>
  );
}

function LastWeek({ siteId }: { siteId: string }) {
  const site = siteLabourFor(siteId);
  if (!site) return null;
  const lw = site.lastWeek;
  const dayParts = lw.byDay.Mon.map((p) => p.dayPart);
  const all = DAY_KEYS.flatMap((d) => lw.byDay[d]).filter((p) => p.speedOfServiceSec > 0);
  const under = all.filter((p) => p.hoursVsGuide < 0);
  const onGuide = all.filter((p) => p.hoursVsGuide >= 0);
  const avg = (xs: DayPartOutcome[], f: (p: DayPartOutcome) => number) => (xs.length ? xs.reduce((s, p) => s + f(p), 0) / xs.length : 0);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
      <div style={{ ...card, borderColor: 'var(--color-warning-border)', background: 'var(--color-warning-bg)', display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
        <AlertTriangle size={16} aria-hidden="true" style={{ flexShrink: 0, marginTop: '2px', color: 'var(--color-text-primary)' }} />
        <div>
          <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--color-text-primary)' }}>{lw.weekLabel}</div>
          <div style={{ fontSize: '13px', lineHeight: 1.5, color: 'var(--color-text-primary)', marginTop: '2px' }}>{lw.attribution}</div>
          {under.length > 0 && (
            <div style={{ ...small, marginTop: '6px', fontSize: '12.5px' }}>
              Across the {under.length} day parts under guide: waste {avg(under, (p) => p.wasteVsWeekday).toFixed(1)}x the weekday average, service {Math.round(avg(under, (p) => p.speedOfServiceSec))}s, checklists{' '}
              {Math.round(avg(under, (p) => p.checklistCompletion) * 100)}% complete. On the {onGuide.length} at or above guide: waste {avg(onGuide, (p) => p.wasteVsWeekday).toFixed(1)}x, service{' '}
              {Math.round(avg(onGuide, (p) => p.speedOfServiceSec))}s, checklists {Math.round(avg(onGuide, (p) => p.checklistCompletion) * 100)}%.
            </div>
          )}
        </div>
      </div>

      <div style={{ ...card, padding: 0, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }} aria-label="Last week: hours against guide and what the same day parts cost">
          <thead>
            <tr>
              <th style={{ ...headCell, textAlign: 'left' }}>Day</th>
              {dayParts.map((dp) => (
                <th key={dp} style={headCell}>
                  {dp}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {DAY_KEYS.map((d) => (
              <tr key={d}>
                <td style={{ ...cell, textAlign: 'left', fontWeight: 600 }}>{DAY_NAME[d]}</td>
                {lw.byDay[d].map((o) => (
                  <OutcomeCell key={o.dayPart} o={o} />
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div style={{ ...small, lineHeight: 1.5 }}>
        Hours against the labour guide first, then what the same day part cost: waste as a multiple of the weekday average, average speed of service, checklist steps completed. Red: 2h or more under guide. Amber: under.
      </div>
    </div>
  );
}

// ─── Estate ─────────────────────────────────────────────────────────────────

function Estate({ onOpenSite }: { onOpenSite: (siteId: string) => void }) {
  const sites = ACTIVE_SITES.filter((s) => s.type !== 'ALL');
  const rows = estateLabourRows(sites.map((s) => s.id));
  const missing = sites.filter((s) => !rows.some((r) => r.siteId === s.id));
  const totalUnder = rows.filter((r) => r.hoursVsGuide < 0).reduce((s, r) => s + r.hoursVsGuide, 0);
  const worst = rows[0];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
      <div style={card}>
        <div style={{ fontSize: '15px', fontWeight: 700, color: 'var(--color-text-primary)' }}>
          {rows.length === 1
            ? `Last week, one site: ${Math.abs(totalUnder)}h ${totalUnder < 0 ? 'under' : 'on or over'} guide`
            : `Last week, ${rows.length} sites: ${Math.abs(totalUnder)}h under guide across ${rows.filter((r) => r.hoursVsGuide < 0).length}`}
        </div>
        {worst && worst.hoursVsGuide < 0 && (
          <div style={{ ...small, marginTop: '3px', fontSize: '12.5px' }}>
            {ACTIVE_SITES.find((s) => s.id === worst.siteId)?.name} ran furthest under. {worst.note}. Waste {worst.wasteVsWeekday.toFixed(1)}x the weekday average, checklists {Math.round(worst.checklistCompletion * 100)}% complete.
          </div>
        )}
      </div>

      <div style={{ ...card, padding: 0, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }} aria-label="Sites ranked by hours against the labour guide last week">
          <thead>
            <tr>
              <th style={{ ...headCell, textAlign: 'left' }}>Site</th>
              <th style={headCell}>Hours vs guide</th>
              <th style={headCell}>Waste vs weekday</th>
              <th style={headCell}>Stock variance</th>
              <th style={headCell}>Checklists</th>
              <th style={headCell}>Speed of service</th>
              <th style={{ ...headCell, textAlign: 'left' }}>Where</th>
              <th style={headCell} aria-label="Open" />
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const site = ACTIVE_SITES.find((s) => s.id === r.siteId);
              const t = tone(r.hoursVsGuide);
              const hasView = !!siteLabourFor(r.siteId);
              return (
                <tr key={r.siteId}>
                  <td style={{ ...cell, textAlign: 'left', fontWeight: 600 }}>
                    {site?.name ?? r.siteId}
                    <div style={{ ...small, fontWeight: 500 }}>guide {r.guideHours}h</div>
                  </td>
                  <td style={{ ...cell, background: t.bg, color: t.color, fontWeight: 700 }}>{signedHours(r.hoursVsGuide)}</td>
                  <td style={{ ...cell, color: r.wasteVsWeekday >= 1.4 ? 'var(--color-error)' : undefined }}>{r.wasteVsWeekday.toFixed(1)}x</td>
                  <td style={cell}>{r.stockVariancePct.toFixed(1)}%</td>
                  <td style={{ ...cell, color: r.checklistCompletion < 0.9 ? 'var(--color-error)' : undefined }}>{Math.round(r.checklistCompletion * 100)}%</td>
                  <td style={cell}>{r.speedOfServiceSec > 0 ? `${r.speedOfServiceSec}s` : <span style={{ color: 'var(--color-text-secondary)' }}>no counter</span>}</td>
                  <td style={{ ...cell, textAlign: 'left', fontWeight: 400, color: 'var(--color-text-secondary)' }}>{r.note}</td>
                  <td style={cell}>
                    {hasView ? (
                      <button type="button" style={{ ...ghostButton, padding: '5px 10px' }} onClick={() => onOpenSite(r.siteId)}>
                        Open
                      </button>
                    ) : (
                      <span style={small}>summary only</span>
                    )}
                  </td>
                </tr>
              );
            })}
            {missing.map((s) => (
              <tr key={s.id}>
                <td style={{ ...cell, textAlign: 'left', fontWeight: 600, color: 'var(--color-text-secondary)' }}>{s.name}</td>
                <td colSpan={7} style={{ ...cell, textAlign: 'left', color: 'var(--color-text-secondary)' }}>
                  No data. No labour standards or Workforce.com connection for this site yet.
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div style={{ ...small, lineHeight: 1.5 }}>
        Ranked most under guide first. Waste is the week&apos;s multiple of the weekday average. Checklists in red are under 90% complete. Open shows the day-part view for sites with a full labour connection.
      </div>
    </div>
  );
}

// ─── Page ───────────────────────────────────────────────────────────────────

export default function LabourPage() {
  const { activeSiteId, activeSite, isAllSites, setActiveSiteId } = useActiveSite();
  const params = useSearchParams();
  const [tab, setTab] = useState<Tab>(() => {
    const t = params.get('tab');
    return t === 'last-week' || t === 'estate' ? t : 'this-week';
  });

  // The receipt deep-links here with the site it wrote, so the page
  // opens on that site rather than whichever persona was active.
  const wantedSite = params.get('site');
  useEffect(() => {
    if (wantedSite && wantedSite !== activeSiteId && ACTIVE_SITES.some((s) => s.id === wantedSite)) setActiveSiteId(wantedSite);
  }, [wantedSite, activeSiteId, setActiveSiteId]);

  const effectiveTab: Tab = isAllSites && tab !== 'estate' ? 'estate' : tab;
  const hasView = !!siteLabourFor(activeSiteId) && !!deputyDraftFor(activeSiteId);
  const alternatives = ACTIVE_SITES.filter((s) => s.id !== activeSiteId && sitesWithDrafts().includes(s.id) && !!siteLabourFor(s.id)).map((s) => ({ id: s.id, name: s.name }));

  const openSite = (siteId: string) => {
    setActiveSiteId(siteId);
    setTab('last-week');
  };

  return (
    <>
      <AreaTopBar
        title="Labour"
        stateTabs={{ items: TABS, value: effectiveTab, onChange: (id) => setTab(id as Tab) }}
        ariaLabel="Labour views"
        backTo="/"
      />
      <div style={{ flex: 1, minHeight: 0, overflow: 'auto', padding: '18px 20px 40px' }}>
        <div style={{ maxWidth: 1180, margin: '0 auto' }}>
          {effectiveTab === 'estate' ? (
            <Estate onOpenSite={openSite} />
          ) : !hasView ? (
            <EmptyState siteName={activeSite.name} alternatives={alternatives} onSwitch={setActiveSiteId} />
          ) : effectiveTab === 'this-week' ? (
            <ThisWeek siteId={activeSiteId} />
          ) : (
            <LastWeek siteId={activeSiteId} />
          )}
        </div>
      </div>
    </>
  );
}
