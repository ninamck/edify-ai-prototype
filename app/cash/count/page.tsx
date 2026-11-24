'use client';

import Link from 'next/link';
import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import * as ui from '@/components/Pret/supportCentreUi';
import { useCashShop } from '@/components/Pret/cash/useCashShop';
import { NoShop, Notice, PersonSelect, VarianceText } from '@/components/Pret/cash/CashUi';
import RuleNote from '@/components/Pret/rules/RuleNote';
import {
  DENOMS, TENDER_LABEL, PROFILE_LABEL, money, round2, totalOf, type Coinage, type Tender,
} from '@/components/Pret/cashFixtures';
import {
  COUNT_KIND_LABEL,
  REQUEST_LABEL,
  expectedTills,
  isSafeCount,
  newId,
  nowMinute,
  safeMovementsBefore,
  toleranceOf,
  type CashCount,
  type CashCountKind,
  type Expected,
} from '@/components/Pret/cashStore';
import { useBlindCount, useOperatorCash } from '@/components/Pret/cashOperators';

const KINDS: CashCountKind[] = ['safe-float', 'handover', 'spot-check', 'skim', 'cash-out'];

export default function CashCountPage() {
  return (
    <Suspense>
      <CashCountScreen />
    </Suspense>
  );
}

function CashCountScreen() {
  const cash = useCashShop();
  const params = useSearchParams();
  const router = useRouter();
  const { shop, rules, me } = cash;

  const kindParam = params.get('kind') as CashCountKind | null;
  const kind: CashCountKind = kindParam && KINDS.includes(kindParam) ? kindParam : 'spot-check';
  const requestId = params.get('request') ?? undefined;
  const request = requestId ? cash.requests.find(r => r.id === requestId) : undefined;
  const team = shop?.team ?? [];

  const [tillChoice, setTill] = useState(params.get('till') ?? '');
  const [tender, setTender] = useState<Tender>('GBP');
  const [qty, setQty] = useState<Partial<Record<Coinage, Record<string, string>>>>({});
  const [typed, setTyped] = useState<Partial<Record<Coinage, string>>>({});
  const [group, setGroup] = useState<string[]>([]);
  const [vouchers, setVouchers] = useState('');
  const operators = useOperatorCash();
  const [blindSetting] = useBlindCount();
  const [countedChoice, setCountedBy] = useState('');
  const [checkedBy, setCheckedBy] = useState('');
  const [reason, setReason] = useState('');
  const [tried, setTried] = useState(false);

  if (!shop) return <NoShop />;
  // The persona loads after the first render, so pick defaults from the shop as it is now.
  const till = shop.tills.includes(tillChoice) ? tillChoice : shop.tills[0];
  const countedBy = team.includes(countedChoice) ? countedChoice : team.includes(me.name) ? me.name : team[0] ?? '';

  const now = new Date();
  const safe = isSafeCount(kind);
  const tenders: Tender[] = safe || kind === 'skim' ? ['GBP'] : rules.tenders;
  const parsed = (c: Coinage) => {
    const out: Record<string, number> = {};
    for (const [k, v] of Object.entries(qty[c] ?? {})) {
      const n = Number(v);
      if (Number.isFinite(n) && n > 0) out[k] = Math.floor(n);
    }
    return out;
  };
  const byNote = (c: Coinage) => totalOf(parsed(c), c);
  const counted: Partial<Record<Tender, number>> = {};
  for (const t of tenders) {
    if (t === 'VOUCHER') counted.VOUCHER = round2(Number(vouchers) || 0);
    else counted[t] = byNote(t) > 0 ? byNote(t) : round2(Number(typed[t]) || 0);
  }

  const grouping = operators && kind === 'cash-out';
  const picked = group.filter(t => shop.tills.includes(t));
  const tills = grouping && picked.length ? picked : [till];
  const place = tills.length === 1 ? tills[0] : `${tills.slice(0, -1).join(', ')} and ${tills.at(-1)}`;
  const blind = operators && blindSetting && kind !== 'skim';

  const safeMoves = safe ? safeMovementsBefore(shop.siteId, nowMinute(now) + 1, cash.counts, now) : 0;
  const tillNow: Expected | null = safe ? null : expectedTills(shop, tills, nowMinute(now), cash.counts, rules, now);
  const expected: Expected | null = safe
    ? { amounts: { GBP: round2(rules.safeFloat + safeMoves) }, provisional: false, dataTo: '' }
    : kind === 'skim'
      ? null
      : tillNow;
  const gbpCounted = counted.GBP ?? 0;
  const gbpVariance = expected ? round2(gbpCounted - (expected.amounts.GBP ?? 0)) : 0;
  const tol = expected ? toleranceOf(gbpVariance, rules) : 'ok';
  const provisional = !!expected?.provisional;

  const problems: string[] = [];
  if (gbpCounted <= 0) problems.push(kind === 'skim' ? 'Enter what you are taking out.' : 'Enter the count.');
  if (rules.dualConfirm && !checkedBy) problems.push(`Choose who checked the count. ${PROFILE_LABEL[shop.profile]} shops need a second person.`);
  if (checkedBy && checkedBy === countedBy) problems.push('The checker must be a different person.');
  if (tol === 'reason' && !provisional && !blind && reason.trim().length < 4) problems.push(`Variance is over ${money(rules.reasonAt)}. Add a reason.`);
  if (kind === 'skim' && tillNow && gbpCounted > (tillNow.amounts.GBP ?? 0) - rules.tillFloat) {
    problems.push(`More than the till holds above its float (${money(Math.max(0, (tillNow.amounts.GBP ?? 0) - rules.tillFloat))}). Recount.`);
  }

  const save = () => {
    setTried(true);
    if (problems.length) return;
    const coinages = tenders.filter(t => t !== 'VOUCHER') as Coinage[];
    const typedOnly = coinages.filter(c => byNote(c) === 0 && (counted[c] ?? 0) > 0);
    const record: CashCount = {
      id: newId('count'),
      siteId: shop.siteId,
      when: now.toISOString(),
      kind,
      till: safe || tills.length > 1 ? undefined : tills[0],
      tills: !safe && tills.length > 1 ? tills : undefined,
      qty: Object.fromEntries(coinages.map(c => [c, parsed(c)])) as CashCount['qty'],
      totals: typedOnly.length ? Object.fromEntries(typedOnly.map(c => [c, counted[c]])) : undefined,
      vouchers: counted.VOUCHER || undefined,
      countedBy,
      checkedBy: checkedBy || undefined,
      reason: reason.trim() || undefined,
      requestId,
    };
    cash.setCounts(prev => [...prev, record]);
    router.push(`/cash/today?saved=${record.id}`);
  };

  const setLine = (c: Coinage, id: string, v: string) =>
    setQty(prev => ({ ...prev, [c]: { ...(prev[c] ?? {}), [id]: v.replace(/[^\d]/g, '') } }));
  const toggleTill = (t: string) => {
    const next = tills.includes(t) ? tills.filter(x => x !== t) : [...tills, t];
    if (next.length) setGroup(shop.tills.filter(x => next.includes(x)));
  };
  const activeBtn = { background: 'var(--color-accent-active)', color: 'var(--color-text-on-active)', border: '1px solid var(--color-accent-active)' };
  const noteTotal = tender === 'VOUCHER' ? 0 : byNote(tender as Coinage);

  return (
    <div style={ui.page}>
      <div>
        <Link href="/cash/today" style={{ ...ui.muted, textDecoration: 'none' }}>← Cash today</Link>
        <h1 style={{ ...ui.h1, marginTop: 6 }}>
          {COUNT_KIND_LABEL[kind]}{safe ? '' : `, ${place}`}
        </h1>
      </div>

      {request && (
        <Notice tone="warn">
          <strong>{REQUEST_LABEL[request.kind]}, asked by {request.by}.</strong> {request.note}
        </Notice>
      )}

      {!safe && !grouping && (
        <div role="radiogroup" aria-label="Till" style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {shop.tills.map(t => (
            <button
              key={t}
              type="button"
              role="radio"
              aria-checked={t === till}
              onClick={() => setTill(t)}
              style={{ ...ui.ghostBtn, ...(t === till ? activeBtn : {}) }}
            >
              {t}
            </button>
          ))}
        </div>
      )}
      {grouping && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div role="group" aria-label="Tills counted together" style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {shop.tills.map(t => (
              <button key={t} type="button" aria-pressed={tills.includes(t)} onClick={() => toggleTill(t)} style={{ ...ui.ghostBtn, ...(tills.includes(t) ? activeBtn : {}) }}>
                {t}
              </button>
            ))}
          </div>
          <span style={ui.muted}>
            Select the tills you are counting. A {money(rules.tillFloat)} float stays in each.
          </span>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 16, alignItems: 'start' }}>
        <section style={ui.card} aria-label="Count">
          {tenders.length > 1 && (
            <div role="tablist" aria-label="Tender" style={{ display: 'flex', gap: 4, borderBottom: '1px solid var(--color-border-subtle)', paddingBottom: 8 }}>
              {tenders.map(t => (
                <button
                  key={t}
                  type="button"
                  role="tab"
                  aria-selected={t === tender}
                  onClick={() => setTender(t)}
                  style={{
                    ...ui.ghostBtn,
                    border: undefined,
                    borderTop: 'none',
                    borderLeft: 'none',
                    borderRight: 'none',
                    borderBottom: t === tender ? '2px solid var(--color-accent-active)' : '2px solid transparent',
                    borderRadius: 0,
                    fontWeight: t === tender ? 700 : 500,
                  }}
                >
                  {TENDER_LABEL[t]} {money(counted[t] ?? 0, t)}
                </button>
              ))}
            </div>
          )}
          {tender === 'VOUCHER' ? (
            <label style={ui.field}>
              <span style={ui.fieldLabel}>Vouchers in the till</span>
              <input style={ui.input} inputMode="decimal" value={vouchers} onChange={e => setVouchers(e.target.value.replace(/[^\d.]/g, ''))} />
            </label>
          ) : (
            <>
            <label style={ui.field} htmlFor="count-total">
              <span style={ui.fieldLabel}>
                {kind === 'skim' ? 'Total taken out' : 'Total counted'}{tenders.length > 1 ? `, ${TENDER_LABEL[tender].toLowerCase()}` : ''}
              </span>
              <input
                id="count-total"
                inputMode="decimal"
                placeholder="0.00"
                aria-describedby="count-total-hint"
                readOnly={noteTotal > 0}
                value={noteTotal > 0 ? noteTotal.toFixed(2) : typed[tender as Coinage] ?? ''}
                onChange={e => setTyped(prev => ({ ...prev, [tender]: e.target.value.replace(/[^\d.]/g, '') }))}
                style={{ ...ui.input, fontSize: 20, fontWeight: 700, fontVariantNumeric: 'tabular-nums', minHeight: 44, background: noteTotal > 0 ? 'var(--color-bg-surface)' : '#ffffff' }}
              />
              <span id="count-total-hint" style={ui.muted}>
                {noteTotal > 0 ? 'Totalled from notes and coins.' : 'Or count notes and coins below.'}
              </span>
            </label>
            {noteTotal > 0 && (
              <button type="button" style={{ ...ui.ghostBtn, alignSelf: 'flex-start' }} onClick={() => setQty(prev => ({ ...prev, [tender]: {} }))}>
                Clear notes and coins
              </button>
            )}
            <h2 style={{ ...ui.h2, fontSize: 13, marginTop: 4 }}>Notes and coins (optional)</h2>
            <table style={ui.table}>
              <thead>
                <tr>
                  <th style={ui.th}>Note or coin</th>
                  <th style={ui.th}>How many</th>
                  <th style={ui.thNum}>Value</th>
                </tr>
              </thead>
              <tbody>
                {DENOMS[tender as Coinage].map(d => {
                  const raw = qty[tender as Coinage]?.[d.id] ?? '';
                  return (
                    <tr key={d.id}>
                      <td style={{ ...ui.td, fontWeight: 600 }}>{d.label}</td>
                      <td style={ui.td}>
                        <input
                          aria-label={`How many ${d.label}`}
                          inputMode="numeric"
                          value={raw}
                          onChange={e => setLine(tender as Coinage, d.id, e.target.value)}
                          style={{ ...ui.input, width: 90 }}
                        />
                      </td>
                      <td style={ui.tdNum}>{money((Number(raw) || 0) * d.value, tender)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            </>
          )}
        </section>

        <section style={{ ...ui.card, position: 'sticky', top: 12 }} aria-label="Result">
          <div aria-live="polite" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <Row label={kind === 'skim' ? 'Taking out' : 'Counted'} value={money(gbpCounted)} strong />
            {blind && expected && (
              <p style={ui.muted}>Blind count. Expected cash shows after saving.</p>
            )}
            {expected && !blind && (
              <Row
                label={safe ? (safeMoves ? 'Expected in the safe' : 'Agreed safe float') : tills.length > 1 ? `Expected, ${tills.length} tills` : 'Expected'}
                value={money(expected.amounts.GBP ?? 0)}
              />
            )}
            {expected && !blind && (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                <span style={ui.fieldLabel}>Variance</span>
                {gbpCounted > 0 ? <VarianceText variance={gbpVariance} rules={rules} provisional={provisional} /> : <span style={ui.muted}>–</span>}
              </div>
            )}
            {expected && !blind && gbpCounted > 0 && tenders.filter(t => t !== 'GBP').map(t => (
              <div key={t} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                <span style={ui.fieldLabel}>{TENDER_LABEL[t]}: {money(counted[t] ?? 0, t)} of {money(expected.amounts[t] ?? 0, t)}</span>
                <span style={{ fontVariantNumeric: 'tabular-nums' }}>{money(round2((counted[t] ?? 0) - (expected.amounts[t] ?? 0)), t)}</span>
              </div>
            ))}
            {kind === 'skim' && tillNow && (
              <p style={ui.muted}>
                {till} expected now: {money(tillNow.amounts.GBP ?? 0)}. After skim: {money(round2((tillNow.amounts.GBP ?? 0) - gbpCounted))}.
              </p>
            )}
            {kind === 'cash-out' && (
              <Row label="To bank" value={money(Math.max(0, round2(gbpCounted - rules.tillFloat * tills.length)))} />
            )}
            {provisional && expected && !blind && (
              <Notice tone="warn">
                Till data runs to {expected.dataTo}. Expected cash updates when the rest arrives.
              </Notice>
            )}
          </div>

          <PersonSelect id="counted-by" label="Counted by" value={countedBy} onChange={setCountedBy} people={team} />
          <PersonSelect
            id="checked-by"
            label={rules.dualConfirm ? 'Checked by (required)' : 'Checked by (optional)'}
            value={checkedBy}
            onChange={setCheckedBy}
            people={team.filter(p => p !== countedBy)}
            allowNone
          />
          {rules.dualConfirm && <RuleNote ruleId="cash-second-person" lead="Needs a second person" />}
          {(tol !== 'ok' || reason) && expected && !provisional && !blind && (
            <label style={ui.field}>
              <span style={ui.fieldLabel}>{tol === 'reason' ? 'Reason (required)' : 'Reason (optional)'}</span>
              <textarea style={{ ...ui.input, minHeight: 64 }} value={reason} onChange={e => setReason(e.target.value)} />
            </label>
          )}

          {tried && problems.length > 0 && (
            <div role="alert" style={{ color: 'var(--color-error)', fontSize: 13, lineHeight: 1.5 }}>
              {problems.map(p => <div key={p}>{p}</div>)}
            </div>
          )}
          <button type="button" style={ui.primaryBtn} onClick={save}>
            Save {COUNT_KIND_LABEL[kind].toLowerCase()}
          </button>
        </section>
      </div>
    </div>
  );
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
      <span style={ui.fieldLabel}>{label}</span>
      <span style={{ fontSize: strong ? 22 : 15, fontWeight: 700, fontVariantNumeric: 'tabular-nums', color: 'var(--color-text-primary)' }}>{value}</span>
    </div>
  );
}
