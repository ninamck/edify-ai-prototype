'use client';

import { Fragment, useState } from 'react';
import * as ui from '@/components/Pret/supportCentreUi';
import StyledSelect from '@/components/ui/StyledSelect';
import DayRangePicker, { control, type DayRange } from '@/components/Pret/cash/DayRangePicker';
import { useCashShop } from '@/components/Pret/cash/useCashShop';
import { NoShop, downloadCsv } from '@/components/Pret/cash/CashUi';
import {
  HISTORY_DAYS, TILL_EVENT_LABEL, dayDate, dayLabel, hm, hmLabel, money, round2, type TillEventType,
} from '@/components/Pret/cashFixtures';
import { activityFor, nowMinute, tillDataTo } from '@/components/Pret/cashStore';

const GROUPS: { label: string; types: TillEventType[] }[] = [
  { label: 'At the till', types: ['no-sale', 'void', 'refund'] },
  { label: 'Discounts', types: ['discount-staff', 'discount-customer', 'joy'] },
  { label: 'Cash', types: ['paid-out', 'skim', 'cash-out'] },
];
const timeInput = { ...ui.input, minHeight: 44, width: 120 };
const TODAY: DayRange = { lo: 0, hi: 0 };

export default function CashActivityPage() {
  const cash = useCashShop();
  const { shop } = cash;
  const [range, setRange] = useState<DayRange>(TODAY);
  const [till, setTill] = useState('all');
  const [type, setType] = useState<'all' | TillEventType>('all');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

  if (!shop) return <NoShop />;
  const now = new Date();
  const days = Array.from({ length: range.hi - range.lo + 1 }, (_, i) => range.hi - i);
  const multi = days.length > 1;
  const all = days.flatMap(d => activityFor(shop, d, cash.counts, now));
  const inWindow = all.filter(
    e => (till === 'all' || e.till === till) && (!from || e.minute >= hm(from)) && (!to || e.minute <= hm(to)),
  );
  const shown = inWindow.filter(e => type === 'all' || e.type === type);
  const dataTo = Math.max(0, tillDataTo(shop, now));

  const isoDay = (d: number) => dayDate(d, now).toISOString().slice(0, 10);
  const exportCsv = () =>
    downloadCsv(`till-activity-${shop.siteId}-${isoDay(range.lo)}${multi ? `-to-${isoDay(range.hi)}` : ''}.csv`, [
      ['Shop', 'Date', 'Time', 'Till', 'What', 'Item', 'Value', 'Till login'],
      ...shown.map(e => [shop.name, dayDate(e.day, now).toLocaleDateString('en-GB'), hmLabel(e.minute), e.till, TILL_EVENT_LABEL[e.type], e.item ?? '', e.value.toFixed(2), e.login]),
    ]);

  return (
    <div style={ui.page}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <h1 style={ui.h1}>Till activity</h1>
        {range.hi === 0 && <p style={ui.muted}>Till data to {hmLabel(dataTo)}, {nowMinute(now) - dataTo} minutes behind.</p>}
      </div>

      <div role="group" aria-label="Filters" style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
        <DayRangePicker
          value={range}
          onChange={setRange}
          min={-(HISTORY_DAYS - 1)}
          now={now}
          presets={[{ label: 'Today', range: TODAY }, { label: 'Yesterday', range: { lo: -1, hi: -1 } }, { label: 'Last 7 days', range: { lo: -6, hi: 0 } }]}
        />
        <StyledSelect aria-label="Till" width={130} height={44} value={till} onChange={e => setTill(e.target.value)}>
          <option value="all">All tills</option>
          {shop.tills.map(t => <option key={t} value={t}>{t}</option>)}
        </StyledSelect>
        <input type="time" aria-label="From" style={timeInput} value={from} onChange={e => setFrom(e.target.value)} />
        <span style={ui.muted}>to</span>
        <input type="time" aria-label="To" style={timeInput} value={to} onChange={e => setTo(e.target.value)} />
        <button type="button" style={{ ...control, marginLeft: 'auto' }} onClick={exportCsv}>Export CSV</button>
      </div>

      <div role="group" aria-label="Show one type" style={{
        ...ui.card, padding: 0, overflow: 'hidden', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
        gap: 1, background: 'var(--color-border-subtle)',
      }}>
        {GROUPS.map(g => (
          <div key={g.label} style={{ background: '#ffffff', padding: '12px 10px', display: 'flex', flexDirection: 'column' }}>
            <span style={{ ...ui.fieldLabel, padding: '0 8px 4px' }}>{g.label}</span>
            {g.types.map(t => {
              const es = inWindow.filter(e => e.type === t);
              const on = type === t;
              return (
                <button
                  key={t}
                  type="button"
                  aria-pressed={on}
                  onClick={() => setType(on ? 'all' : t)}
                  style={{
                    display: 'grid', gridTemplateColumns: '1fr auto 80px', alignItems: 'center', gap: 12, minHeight: 44, padding: '0 8px',
                    border: 'none', borderRadius: 8, cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit', fontSize: 13,
                    color: es.length ? 'var(--color-text-primary)' : 'var(--color-text-secondary)',
                    background: on ? 'var(--color-accent-active)' : 'transparent',
                    ...(on ? { color: 'var(--color-text-on-active)' } : {}),
                  }}
                >
                  <span style={{ fontWeight: on ? 700 : 500 }}>{TILL_EVENT_LABEL[t]}</span>
                  <span style={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{es.length}</span>
                  <span style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                    {t === 'no-sale' ? '' : money(round2(es.reduce((s, e) => s + e.value, 0)))}
                  </span>
                </button>
              );
            })}
          </div>
        ))}
      </div>

      {type !== 'all' && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 13 }}>Showing <strong>{TILL_EVENT_LABEL[type]}</strong> only</span>
          <button type="button" style={control} onClick={() => setType('all')}>Show all</button>
        </div>
      )}

      <section style={ui.card}>
        {shown.length === 0 ? (
          <p style={ui.muted}>No results.</p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={ui.table}>
              <thead>
                <tr>
                  <th style={ui.th}>Time</th>
                  <th style={ui.th}>Till</th>
                  <th style={ui.th}>Type</th>
                  <th style={ui.th}>Item</th>
                  <th style={ui.thNum}>Value</th>
                  <th style={ui.th}>Till login</th>
                </tr>
              </thead>
              <tbody>
                {shown.map((e, i) => (
                  <Fragment key={`${e.day}-${e.id}`}>
                    {multi && e.day !== shown[i - 1]?.day && (
                      <tr>
                        <th colSpan={6} scope="colgroup" style={{ ...ui.td, textAlign: 'left', fontWeight: 700, background: 'var(--color-bg-hover)' }}>
                          {dayLabel(e.day, now)}
                          <span style={{ ...ui.muted, fontWeight: 400, marginLeft: 8 }}>{shown.filter(x => x.day === e.day).length}</span>
                        </th>
                      </tr>
                    )}
                    <tr>
                      <td style={ui.td}>{hmLabel(e.minute)}</td>
                      <td style={ui.td}>{e.till}</td>
                      <td style={ui.td}>{TILL_EVENT_LABEL[e.type]}</td>
                      <td style={ui.td}>{e.item ?? ''}</td>
                      <td style={ui.tdNum}>{e.type === 'no-sale' ? '' : money(e.value)}</td>
                      <td style={ui.td}>{e.login}</td>
                    </tr>
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
