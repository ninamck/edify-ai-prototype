'use client';

import { Fragment, useState } from 'react';
import * as ui from '@/components/Pret/supportCentreUi';
import { useCashShop } from '@/components/Pret/cash/useCashShop';
import { NoShop, OperatorOnly, downloadCsv } from '@/components/Pret/cash/CashUi';
import DayRangePicker, { control, type DayRange } from '@/components/Pret/cash/DayRangePicker';
import { dayLabel, dayPhrase, HISTORY_DAYS, money, round2, signedMoney } from '@/components/Pret/cashFixtures';
import { allCloses, toleranceOf, TOLERANCE_PILL } from '@/components/Pret/cashStore';
import { CATEGORIES, DECLARE_LABEL, safeLedger, statementDay, useOperatorCash, type StatementDay } from '@/components/Pret/cashOperators';

type Row = { label: string; value: (s: StatementDay) => number; style?: 'total' | 'grand' | 'sub' };
type Section = { title: string; rows: Row[] };

const DECLARE_ORDER = ['cash', 'card', 'paid-out', 'gift', 'bacs'];
const LAST_7: DayRange = { lo: -6, hi: 0 };

export default function CashStatementPage() {
  const cash = useCashShop();
  const operators = useOperatorCash();
  const { shop, rules } = cash;
  const [range, setRange] = useState<DayRange>(LAST_7);

  if (!operators) return <OperatorOnly />;
  if (!shop) return <NoShop />;

  const now = new Date();
  const { lo, hi } = range;
  const days = allCloses(shop.siteId, cash.closes, now)
    .filter(c => c.day >= lo && c.day <= hi)
    .map(c => statementDay(shop, c));
  const ledger = safeLedger(shop.siteId, { ...cash, rules }, days.map(d => d.day), now);
  const declaredIds = DECLARE_ORDER.filter(id => days.some(d => d.declared.some(x => x.id === id)));
  const declared = (s: StatementDay, id: string) => s.declared.find(x => x.id === id)?.declared ?? 0;

  const sections: Section[] = [
    {
      title: 'Sales',
      rows: [
        ...CATEGORIES.map(c => ({ label: c, value: (s: StatementDay) => s.sales[c], style: 'sub' as const })),
        { label: 'Total sales', value: s => s.totalSales, style: 'total' },
        { label: 'Less promotions and giveaways', value: s => -s.promotions },
        { label: 'Less discounts', value: s => -s.discounts },
        { label: 'Sales after discounts', value: s => s.afterDiscounts, style: 'total' },
        { label: 'Tips', value: s => s.tips },
        { label: 'Gross income', value: s => s.grossIncome, style: 'total' },
      ],
    },
    {
      title: 'What the till expects to have been paid',
      rows: [
        { label: 'Plus open tabs brought forward and paid', value: s => s.broughtForward },
        { label: 'Less open tabs carried forward', value: s => -s.carriedForward },
        { label: 'Plus gift cards sold', value: s => s.giftSold },
        { label: 'Expected income', value: s => s.expectedIncome, style: 'grand' },
      ],
    },
    {
      title: 'Declared',
      rows: [
        ...declaredIds.map(id => ({ label: DECLARE_LABEL[id] ?? id, value: (s: StatementDay) => declared(s, id), style: 'sub' as const })),
        { label: 'Total declared', value: s => s.totalDeclared, style: 'grand' },
      ],
    },
  ];
  const total = (r: Row) => round2(days.reduce((s, d) => s + r.value(d), 0));
  const variance = (s: StatementDay) => s.variance;
  const weekVariance = round2(days.reduce((s, d) => s + d.variance, 0));
  const periodLabel = `${dayLabel(lo, now)} to ${dayPhrase(hi, now)}`;

  const exportCsv = () => {
    const header = ['', ...days.map(d => dayLabel(d.day, now)), 'Total'];
    const out: (string | number)[][] = [['Statement of trade', shop.name, periodLabel], header];
    for (const sec of sections) {
      out.push([sec.title]);
      for (const r of sec.rows) out.push([r.label, ...days.map(d => r.value(d).toFixed(2)), total(r).toFixed(2)]);
    }
    out.push(['Variance', ...days.map(d => d.variance.toFixed(2)), weekVariance.toFixed(2)]);
    out.push(['Cash on site at close', ...ledger.map(l => l.closing.toFixed(2)), '']);
    downloadCsv(`statement-of-trade-${shop.siteId}.csv`, out);
  };

  const cellStyle = (r: Row) => ({
    ...ui.tdNum,
    fontWeight: r.style === 'total' || r.style === 'grand' ? 700 : 400,
    borderTop: r.style === 'grand' ? '2px solid var(--color-text-primary)' : undefined,
  });

  return (
    <div style={ui.page} className="cash-print-root">
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <h1 style={ui.h1}>Statement of trade</h1>
        <div role="group" aria-label="Dates and export" style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
          <DayRangePicker
            value={range}
            onChange={setRange}
            min={-(HISTORY_DAYS - 1)}
            now={now}
            presets={[{ label: 'Last 7 days', range: LAST_7 }, { label: 'Previous 7 days', range: { lo: -13, hi: -7 } }]}
          />
          <button type="button" className="no-print" style={control} onClick={exportCsv}>Export CSV</button>
          <button type="button" className="no-print" style={control} onClick={() => window.print()}>Print</button>
        </div>
      </div>

      <section style={ui.card}>
        {days.length === 0 ? (
          <p style={ui.muted}>No days closed in this period.</p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={ui.table}>
              <thead>
                <tr>
                  <th style={ui.th}><span className="sr-only">Line</span></th>
                  {days.map(d => <th key={d.day} style={ui.thNum}>{dayLabel(d.day, now)}</th>)}
                  <th style={ui.thNum}>Total</th>
                </tr>
              </thead>
              <tbody>
                {sections.map(sec => (
                  <Fragment key={sec.title}>
                    <tr>
                      <th scope="rowgroup" colSpan={days.length + 2} style={{ ...ui.th, paddingTop: 14, color: 'var(--color-text-primary)' }}>{sec.title}</th>
                    </tr>
                    {sec.rows.map(r => (
                      <tr key={r.label}>
                        <th scope="row" style={{ ...ui.td, textAlign: 'left', fontWeight: r.style === 'total' || r.style === 'grand' ? 700 : 400, paddingLeft: r.style === 'sub' ? 20 : undefined }}>
                          {r.label}
                        </th>
                        {days.map(d => <td key={d.day} style={cellStyle(r)}>{money(r.value(d))}</td>)}
                        <td style={cellStyle(r)}>{money(total(r))}</td>
                      </tr>
                    ))}
                  </Fragment>
                ))}
                <tr>
                  <th scope="row" style={{ ...ui.td, textAlign: 'left', fontWeight: 700 }}>Variance</th>
                  {days.map(d => {
                    const tol = toleranceOf(variance(d), rules);
                    return (
                      <td key={d.day} style={ui.tdNum}>
                        {tol === 'ok' ? signedMoney(variance(d)) : <span style={ui.pill(TOLERANCE_PILL[tol])}>{signedMoney(variance(d))}</span>}
                      </td>
                    );
                  })}
                  <td style={{ ...ui.tdNum, fontWeight: 700 }}>{signedMoney(weekVariance)}</td>
                </tr>
                <tr>
                  <th scope="row" style={{ ...ui.td, textAlign: 'left' }}>Cash on site at close</th>
                  {ledger.map(l => <td key={l.day} style={ui.tdNum}>{money(l.closing)}</td>)}
                  <td style={ui.tdNum}><span className="sr-only">Not totalled</span></td>
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </section>
      <p style={ui.muted}>
        Variances over {money(rules.flagAt)} are highlighted. Cash on site is the safe float plus bags awaiting collection.
      </p>
    </div>
  );
}
