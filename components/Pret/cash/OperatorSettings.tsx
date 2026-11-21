'use client';

import Link from 'next/link';
import { useState } from 'react';
import * as ui from '../supportCentreUi';
import { CASH_SHOPS, dayLabel, dayPhrase, money, round2, signedMoney, type CashRules, type DayClose } from '../cashFixtures';
import { allCloses, toleranceOf } from '../cashStore';
import {
  DEFAULT_COST_CENTRES, DEFAULT_MAPPING, exportRows, regionOf, siteCodeOf, statementDay, useAccountsMapping, useBlindCount,
  useCostCentres, type ExportRow,
} from '../cashOperators';
import { downloadCsv } from './CashUi';
import { useShopName } from '../shopNames';

/** Estate-wide: shops count without seeing what the till expects. */
export function BlindCountSetting() {
  const [blind, setBlind] = useBlindCount();
  return (
    <section style={ui.card} aria-labelledby="blind-h">
      <h2 id="blind-h" style={ui.h2}>Counting</h2>
      <label style={{ display: 'flex', gap: 10, alignItems: 'flex-start', fontSize: 13, lineHeight: 1.5 }}>
        <input type="checkbox" checked={blind} onChange={e => setBlind(e.target.checked)} style={{ width: 18, height: 18, marginTop: 1 }} />
        <span>
          <strong>Blind counts.</strong> Hide expected cash until the count is saved. Does not apply to skims.
        </span>
      </label>
    </section>
  );
}

const dateOf = (day: number, now: Date) => {
  const d = new Date(now);
  d.setDate(d.getDate() + day);
  return d.toLocaleDateString('en-GB');
};

/**
 * Posts each site-day to the accounts: sales by category, discounts, tips,
 * gift cards, tabs, every payment type and the variance, each to its nominal
 * code. Card goes to a control account per site; cost centres follow region.
 */
export function AccountsExport({
  closes, rulesOf, now = new Date(),
}: {
  closes: DayClose[];
  rulesOf: (siteId: string) => CashRules;
  now?: Date;
}) {
  const [mapping, setMapping] = useAccountsMapping();
  const [centres, setCentres] = useCostCentres();
  const nameOf = useShopName();
  const [week, setWeek] = useState(0);
  const [editing, setEditing] = useState(false);

  const [lo, hi] = [-6 - week * 7, -week * 7];
  const siteDays = CASH_SHOPS.flatMap(shop =>
    allCloses(shop.siteId, closes, now)
      .filter(c => c.day >= lo && c.day <= hi)
      .map(c => ({ shop, close: c, statement: statementDay(shop, c) })),
  );
  const rows: ExportRow[] = siteDays.flatMap(d => exportRows(d.shop, d.statement, mapping, centres));
  const debits = round2(rows.filter(r => r.side === 'Debit').reduce((s, r) => s + r.amount, 0));
  const credits = round2(rows.filter(r => r.side === 'Credit').reduce((s, r) => s + r.amount, 0));
  const balanced = Math.abs(debits - credits) < 0.01;
  const toCheck = siteDays.filter(d => toleranceOf(d.close.variance, rulesOf(d.shop.siteId)) === 'reason');
  const regions = [...new Set(CASH_SHOPS.map(s => regionOf(s.siteId)))];

  const download = () =>
    downloadCsv(`journal-${dateOf(lo, now).replace(/\//g, '-')}-to-${dateOf(hi, now).replace(/\//g, '-')}.csv`, [
      ['Date', 'Nominal', 'Cost centre', 'Site', 'Narrative', 'Debit', 'Credit'],
      ...rows.map(r => [dateOf(r.day, now), r.nominal, r.costCentre, r.site, r.narrative, r.side === 'Debit' ? r.amount.toFixed(2) : '', r.side === 'Credit' ? r.amount.toFixed(2) : '']),
    ]);

  const preview = rows.slice(0, 14);

  return (
    <section style={ui.card} aria-labelledby="accounts-h">
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', alignItems: 'baseline' }}>
        <h2 id="accounts-h" style={ui.h2}>Accounts export</h2>
        {balanced
          ? <span style={ui.muted}>Balanced</span>
          : <span style={ui.pill('bad')}>Out by {money(Math.abs(round2(debits - credits)))}</span>}
      </div>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <label style={ui.field} htmlFor="accounts-week">
          <span style={ui.fieldLabel}>Period</span>
          <select id="accounts-week" style={ui.input} value={week} onChange={e => setWeek(Number(e.target.value))}>
            <option value={0}>Last 7 days</option>
            <option value={1}>Previous 7 days</option>
          </select>
        </label>
        <button type="button" style={ui.primaryBtn} onClick={download} disabled={!rows.length}>Download journal (CSV)</button>
        <button type="button" style={ui.ghostBtn} aria-expanded={editing} onClick={() => setEditing(v => !v)}>
          {editing ? 'Hide codes' : 'Edit codes'}
        </button>
      </div>

      {toCheck.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <h3 style={{ ...ui.h2, fontSize: 14 }}>Needs review</h3>
          <ul className="row-list" style={ui.rowList}>
            {toCheck.map(d => (
              <li key={d.close.id} style={ui.listRow}>
                <span>
                  <strong>{d.shop.name}</strong>, {dayPhrase(d.close.day, now)}: cash {signedMoney(d.close.variance)}
                  {d.close.varianceReason ? <span style={ui.muted}>. {d.close.varianceReason}</span> : <span style={ui.muted}>. No reason given</span>}
                </span>
                <Link href={`/support-centre/cash?shop=${d.shop.siteId}&day=${d.close.day}#day-h`} style={{ color: 'var(--color-accent-active)', fontWeight: 700, whiteSpace: 'nowrap' }}>
                  View day
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}

      {editing && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 16 }}>
          <table style={ui.table}>
            <caption style={{ ...ui.fieldLabel, textAlign: 'left', paddingBottom: 6 }}>Nominal codes</caption>
            <thead>
              <tr>
                <th style={ui.th}>Line</th>
                <th style={ui.th}>Nominal</th>
              </tr>
            </thead>
            <tbody>
              {mapping.map(m => (
                <tr key={m.id}>
                  <td style={ui.td}>
                    {m.label}
                    {m.perSite && <div style={ui.muted}>One per site: {CASH_SHOPS.map(s => `${m.nominal}-${siteCodeOf(s.siteId)}`).join(', ')}</div>}
                  </td>
                  <td style={ui.td}>
                    <input
                      aria-label={`Nominal code for ${m.label.toLowerCase()}`}
                      style={{ ...ui.input, width: 90 }}
                      value={m.nominal}
                      onChange={e => setMapping(prev => prev.map(x => (x.id === m.id ? { ...x, nominal: e.target.value.replace(/[^\w-]/g, '') } : x)))}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <table style={ui.table}>
              <caption style={{ ...ui.fieldLabel, textAlign: 'left', paddingBottom: 6 }}>Cost centres by region</caption>
              <thead>
                <tr>
                  <th style={ui.th}>Region</th>
                  <th style={ui.th}>Cost centre</th>
                </tr>
              </thead>
              <tbody>
                {regions.map(r => (
                  <tr key={r}>
                    <td style={ui.td}>
                      {r}
                      <div style={ui.muted}>{CASH_SHOPS.filter(s => regionOf(s.siteId) === r).map(s => nameOf(s.siteId, s.name)).join(', ')}</div>
                    </td>
                    <td style={ui.td}>
                      <input
                        aria-label={`Cost centre for ${r}`}
                        style={{ ...ui.input, width: 90 }}
                        value={centres[r] ?? ''}
                        onChange={e => setCentres(prev => ({ ...prev, [r]: e.target.value.replace(/[^\w-]/g, '') }))}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <button
              type="button"
              style={{ ...ui.ghostBtn, alignSelf: 'flex-start' }}
              onClick={() => { setMapping(DEFAULT_MAPPING); setCentres(DEFAULT_COST_CENTRES); }}
            >
              Reset to defaults
            </button>
          </div>
        </div>
      )}

      {rows.length === 0 ? (
        <p style={ui.muted}>No days closed in this period.</p>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={ui.table}>
            <caption style={{ ...ui.fieldLabel, textAlign: 'left', paddingBottom: 6 }}>
              Preview, {preview.length} of {rows.length} lines, {dayLabel(lo, now)} to {dayPhrase(hi, now)}
            </caption>
            <thead>
              <tr>
                <th style={ui.th}>Date</th>
                <th style={ui.th}>Nominal</th>
                <th style={ui.th}>Cost centre</th>
                <th style={ui.th}>Narrative</th>
                <th style={ui.thNum}>Debit</th>
                <th style={ui.thNum}>Credit</th>
              </tr>
            </thead>
            <tbody>
              {preview.map((r, i) => (
                <tr key={`${r.siteId}-${r.day}-${i}`}>
                  <td style={ui.td}>{dateOf(r.day, now)}</td>
                  <td style={ui.td}>{r.nominal}</td>
                  <td style={ui.td}>{r.costCentre}</td>
                  <td style={ui.td}>{r.site}: {r.narrative}</td>
                  <td style={ui.tdNum}>{r.side === 'Debit' ? money(r.amount) : ''}</td>
                  <td style={ui.tdNum}>{r.side === 'Credit' ? money(r.amount) : ''}</td>
                </tr>
              ))}
              <tr>
                <th scope="row" colSpan={4} style={{ ...ui.td, textAlign: 'left', fontWeight: 700 }}>Journal total</th>
                <td style={{ ...ui.tdNum, fontWeight: 700 }}>{money(debits)}</td>
                <td style={{ ...ui.tdNum, fontWeight: 700 }}>{money(credits)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
