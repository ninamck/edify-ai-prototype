'use client';

import * as ui from '../supportCentreUi';
import { bagLabel, cashShop, money, round2, TENDER_LABEL, type CashRules, type DayClose, type Tender } from '../cashFixtures';
import { corrected, type Correction } from '../cashStore';
import { declarationsFor, openTabsFor, tabsTotal, useCashAudience, useOperatorCash } from '../cashOperators';
import { whenLabel } from '../countStore';
import { Corrected, CorrectionControl, CorrectionTrail, VarianceText } from './CashUi';

/** One closed day: takings, tills, banking and charity, with corrections that keep the original. */
export default function CloseSummary({
  close, corrections, onCorrect, team, me, rules,
}: {
  close: DayClose;
  corrections: Correction[];
  /** Leave out to show the day read-only. */
  onCorrect?: (c: Correction) => void;
  team: string[];
  me: string;
  rules: CashRules;
}) {
  const operators = useOperatorCash();
  const pret = useCashAudience()[0] === 'pret';
  const shop = cashShop(close.siteId);
  const declared = operators && shop ? declarationsFor(shop, close) : [];
  const carried = shop ? close.tabsCarried ?? tabsTotal(openTabsFor(shop, close.day)) : 0;
  const val = <T extends string | number>(field: string, original: T) => corrected(close.id, field, original, corrections);
  const fix = (field: string, label: string, current: string | number, kind: 'money' | 'text', buttonText: string) =>
    onCorrect ? (
      <CorrectionControl recordId={close.id} field={field} label={label} current={current} kind={kind} people={team} me={me} onSave={onCorrect} buttonText={buttonText} />
    ) : null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <p style={ui.muted}>
        Closed {whenLabel(close.when)} by {close.by}{close.checkedBy ? `, checked by ${close.checkedBy}` : ''}.
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 10 }}>
        <Figure label="Cash takings" value={money(close.takingsCash)} />
        <Figure label="Card takings" value={money(close.takingsCard)} />
        <Figure label={pret ? 'Joy of Pret' : 'Promotions and giveaways'} value={`${close.joyItems} items, ${money(close.joyValue)}`} />
        <Figure label="Waste" value={money(close.waste)} />
        <Figure label="Voids" value={money(close.voids)} />
        <Figure label="Discounts" value={money(close.discounts)} />
      </div>

      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <span style={ui.fieldLabel}>Day variance</span>
        <VarianceText variance={close.variance} rules={rules} />
      </div>
      {close.varianceReason && <p style={{ ...ui.muted, color: 'var(--color-text-primary)' }}>Reason: {close.varianceReason}</p>}
      {close.missing.length > 0 && (
        <p style={{ margin: 0, fontSize: 13 }}>
          <span style={ui.pill('warn')}>Tasks left open</span> {close.missing.join(', ')}. {close.missingReason}
        </p>
      )}

      <div style={{ overflowX: 'auto' }}>
        <table style={ui.table}>
          <caption style={{ ...ui.fieldLabel, textAlign: 'left', paddingBottom: 6 }}>Tills</caption>
          <thead>
            <tr>
              <th style={ui.th}>Till</th>
              <th style={ui.thNum}>Expected</th>
              <th style={ui.thNum}>Counted</th>
              <th style={ui.th}>Variance</th>
              <th style={ui.th}>Counted by</th>
            </tr>
          </thead>
          <tbody>
            {close.tills.map(t => (
              <tr key={t.till}>
                <td style={ui.td}>{t.till}</td>
                <td style={ui.tdNum}>{money(t.expected)}</td>
                <td style={ui.tdNum}>{money(t.counted)}</td>
                <td style={ui.td}><VarianceText variance={round2(t.counted - t.expected)} rules={rules} /></td>
                <td style={ui.td}>{t.countedBy}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {declared.length > 0 && (
        <div style={{ overflowX: 'auto' }}>
          <table style={ui.table}>
            <caption style={{ ...ui.fieldLabel, textAlign: 'left', paddingBottom: 6 }}>Declarations</caption>
            <thead>
              <tr>
                <th style={ui.th}>Payment type</th>
                <th style={ui.thNum}>Expected</th>
                <th style={ui.thNum}>Declared</th>
                <th style={ui.th}>Difference</th>
              </tr>
            </thead>
            <tbody>
              {declared.map(d => (
                <tr key={d.id}>
                  <td style={ui.td}>{d.label}</td>
                  <td style={ui.tdNum}>{money(d.expected)}</td>
                  <td style={ui.tdNum}>{money(d.declared)}</td>
                  <td style={ui.td}><VarianceText variance={round2(d.declared - d.expected)} rules={rules} /></td>
                </tr>
              ))}
            </tbody>
          </table>
          <p style={{ ...ui.muted, marginTop: 6 }}>Open tabs carried forward: {money(carried)}.</p>
        </div>
      )}

      <div style={{ overflowX: 'auto' }}>
        <table style={ui.table}>
          <caption style={{ ...ui.fieldLabel, textAlign: 'left', paddingBottom: 6 }}>Banking</caption>
          <thead>
            <tr>
              <th style={ui.th}>Bag</th>
              <th style={ui.th}>Inner bag number</th>
              <th style={ui.thNum}>Value</th>
              <th style={ui.th}><span className="sr-only">Corrections</span></th>
            </tr>
          </thead>
          <tbody>
            {close.banking.map((b, i) => {
              const bagNo = val(`bagNo-${i}`, b.bagNo);
              const value = val(`bankValue-${i}`, b.value);
              return (
                <tr key={b.bagNo}>
                  <td style={ui.td}>{i === 0 ? 'Bag 1' : 'Bag 2'}</td>
                  <td style={ui.td}><Corrected show={bagLabel(bagNo)} isCorrected={bagNo !== b.bagNo} /></td>
                  <td style={ui.tdNum}>
                    <Corrected show={money(value)} isCorrected={value !== b.value} />
                    {b.foreign && (Object.keys(b.foreign) as Tender[]).map(t => (
                      <div key={t} style={ui.muted}>{TENDER_LABEL[t]} {money(b.foreign?.[t] ?? 0, t)}</div>
                    ))}
                  </td>
                  <td style={{ ...ui.td, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {fix(`bagNo-${i}`, 'Inner bag number', bagNo, 'text', 'Correct bag number')}
                    {fix(`bankValue-${i}`, 'Banking value', value, 'money', 'Correct value')}
                  </td>
                </tr>
              );
            })}
            {close.charity && (() => {
              const c = close.charity;
              const bagNo = val('charityBagNo', c.bagNo);
              const value = val('charityValue', c.value);
              const slip = val('charitySlip', c.slipNo);
              return (
                <tr>
                  <td style={ui.td}>Charity, slip <Corrected show={slip} isCorrected={slip !== c.slipNo} /></td>
                  <td style={ui.td}><Corrected show={bagNo} isCorrected={bagNo !== c.bagNo} /></td>
                  <td style={ui.tdNum}><Corrected show={money(value)} isCorrected={value !== c.value} /></td>
                  <td style={{ ...ui.td, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {fix('charityBagNo', 'Charity bag number', bagNo, 'text', 'Correct bag number')}
                    {fix('charityValue', 'Charity value', value, 'money', 'Correct value')}
                    {fix('charitySlip', 'Charity slip number', slip, 'text', 'Correct slip')}
                  </td>
                </tr>
              );
            })()}
          </tbody>
        </table>
      </div>
      <CorrectionTrail recordId={close.id} corrections={corrections} />
    </div>
  );
}

function Figure({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2, padding: '8px 10px', border: '1px solid var(--color-border-subtle)', borderRadius: 8 }}>
      <span style={ui.fieldLabel}>{label}</span>
      <span style={{ fontSize: 15, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{value}</span>
    </div>
  );
}
