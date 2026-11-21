'use client';

import { useState } from 'react';
import { IdCard, Package, Receipt } from 'lucide-react';
import * as ui from '@/components/Pret/supportCentreUi';
import { useCashShop } from '@/components/Pret/cash/useCashShop';
import { NoShop, Notice, PersonSelect } from '@/components/Pret/cash/CashUi';
import {
  COLLECTION_COMPANY, TENDER_LABEL, WEEKDAY, dayLabel, money, round2, type Collection, type Tender,
} from '@/components/Pret/cashFixtures';
import { COLLECTION_WINDOW, allBags, allCollections, bagGbp, exposureFor, newId } from '@/components/Pret/cashStore';
import { whenLabel } from '@/components/Pret/countStore';
import { asDeposit, coveredDays, useDunkinCash, useOperatorCash } from '@/components/Pret/cashOperators';
import SlipField, { SlipCell } from '@/components/Pret/cash/SlipField';

export default function CashCollectionPage() {
  const cash = useCashShop();
  const { shop, rules, me } = cash;
  const [unticked, setUnticked] = useState<Set<string>>(new Set());
  const [outerBag, setOuterBag] = useState('');
  const [collector, setCollector] = useState('');
  const [handedChoice, setHanded] = useState('');
  const [witness, setWitness] = useState('');
  const [tried, setTried] = useState(false);
  const [savedId, setSavedId] = useState<string | null>(null);
  const [methodChoice, setMethod] = useState<'collector' | 'bank-run'>('collector');
  const [reference, setReference] = useState('');
  const [bankName, setBankName] = useState('');
  const [comment, setComment] = useState('');
  const [slip, setSlip] = useState('');
  const pub = useOperatorCash();
  const dunkin = useDunkinCash();
  const operators = pub || dunkin;

  if (!shop) return <NoShop />;
  const method = dunkin ? 'bank-run' : pub ? methodChoice : 'collector';
  const bankRun = method === 'bank-run';
  const now = new Date();
  const team = shop.team;
  const handedOverBy = team.includes(handedChoice) ? handedChoice : team.includes(me.name) ? me.name : team[0];
  const exposure = exposureFor(shop.siteId, { ...cash, rules }, now);
  const bags = exposure.bags.filter(b => !dunkin || b.kind === 'takings').sort((a, b) => a.day - b.day || a.banking - b.banking);
  const picked = bags.filter(b => !unticked.has(b.bagNo));
  const pickedValue = round2(picked.reduce((s, b) => s + bagGbp(b), 0));
  const over = pickedValue > rules.maxOuterBag;
  const history = allCollections(shop.siteId, cash.collections).slice().reverse().map(c => (dunkin ? asDeposit(c) : c));
  const allShopBags = allBags(shop.siteId, cash.closes, cash.collections, cash.corrections, now);
  const saved = savedId ? cash.collections.find(c => c.id === savedId) : undefined;

  const problems: string[] = [];
  if (!picked.length) problems.push('Select at least one bag.');
  if (over && !bankRun) problems.push(`Over the ${money(rules.maxOuterBag)} outer bag limit.`);
  if (!bankRun && !/^OB-?\d{4,}$/i.test(outerBag.trim())) problems.push('Enter the outer bag number, for example OB-7731.');
  if (!bankRun && collector.trim().length < 2) problems.push("Enter the collector's name.");
  if (bankRun && bankName.trim().length < 3) problems.push('Enter the bank and branch.');
  if (bankRun && reference.trim().length < 4) problems.push('Enter the paying-in reference.');
  if (dunkin && !slip) problems.push('Add a photo of the paying-in slip.');
  if (rules.dualConfirm && !witness) problems.push(bankRun ? 'Choose who checked the bags.' : 'Choose a witness.');

  const save = () => {
    setTried(true);
    if (problems.length) return;
    const record: Collection = {
      id: newId('coll'),
      siteId: shop.siteId,
      when: now.toISOString(),
      company: bankRun ? bankName.trim() : COLLECTION_COMPANY,
      collector: bankRun ? handedOverBy : collector.trim(),
      outerBag: bankRun ? '' : outerBag.trim().toUpperCase(),
      bagNos: picked.map(b => b.bagNo),
      value: pickedValue,
      handedOverBy,
      witnessedBy: witness || undefined,
      ...(operators
        ? { method, reference: reference.trim() || undefined, bankName: bankRun ? bankName.trim() : undefined, comment: comment.trim() || undefined }
        : {}),
      ...(slip ? { slip } : {}),
    };
    cash.setCollections(prev => [...prev, record]);
    setSavedId(record.id);
    setTried(false);
    setOuterBag('');
    setCollector('');
    setReference('');
    setComment('');
    setSlip('');
    setUnticked(new Set());
  };
  const activeBtn = { background: 'var(--color-accent-active)', color: 'var(--color-text-on-active)', border: '1px solid var(--color-accent-active)' };

  return (
    <div style={ui.page}>
      <div>
        <h1 style={ui.h1}>{dunkin ? 'Bank deposit' : 'Collection'}</h1>
      </div>

      {saved && (
        <Notice tone="good">
          {saved.method === 'bank-run'
            ? `${dunkin ? 'Deposit' : 'Bank run'} saved: ${saved.bagNos.length} ${saved.bagNos.length === 1 ? 'bag' : 'bags'}, ${money(saved.value)}, ${saved.bankName}, ref ${saved.reference}.`
            : `Collection saved: ${saved.bagNos.length} bags, ${money(saved.value)}, outer bag ${saved.outerBag}.`}
        </Notice>
      )}

      {pub && (
        <div role="radiogroup" aria-label="Method" style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {([['collector', 'Cash collector'], ['bank-run', 'Bank run']] as const).map(([id, label]) => (
            <button key={id} type="button" role="radio" aria-checked={method === id} onClick={() => setMethod(id)} style={{ ...ui.ghostBtn, ...(method === id ? activeBtn : {}) }}>
              {label}
            </button>
          ))}
        </div>
      )}

      {!bankRun && <section aria-labelledby="instr-h" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', alignItems: 'baseline' }}>
          <h2 id="instr-h" style={ui.h2}>Handover checks</h2>
          <span style={ui.muted}>Collected {rules.collectionDays.map(d => WEEKDAY[d]).join(' and ')}, {COLLECTION_WINDOW}</span>
        </div>
        <ol style={{
          ...ui.card, padding: 0, margin: 0, listStyle: 'none', overflow: 'hidden', display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 1, background: 'var(--color-border-subtle)',
        }}>
          {[
            { Icon: IdCard, title: 'Check their ID', detail: `Their ${COLLECTION_COMPANY} badge.` },
            { Icon: Package, title: 'Seal in front of them', detail: <>All inner bags, charity too, in one outer bag. <strong>Max {money(rules.maxOuterBag)}.</strong></> },
            { Icon: Receipt, title: 'Get a receipt', detail: 'It must show the outer bag number.' },
          ].map(({ Icon, title, detail }, i) => (
            <li key={title} style={{ background: '#ffffff', padding: '14px 18px', display: 'flex', gap: 12, alignItems: 'flex-start' }}>
              <span aria-hidden style={{ width: 36, height: 36, borderRadius: 999, background: 'var(--color-bg-hover)', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
                <Icon size={18} />
              </span>
              <span style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <span style={{ fontSize: 14, fontWeight: 700 }}>{i + 1}. {title}</span>
                <span style={{ fontSize: 13, lineHeight: 1.45, color: 'var(--color-text-secondary)' }}>{detail}</span>
              </span>
            </li>
          ))}
        </ol>
      </section>}

      <section style={ui.card} aria-labelledby="bags-h">
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', alignItems: 'baseline' }}>
          <h2 id="bags-h" style={ui.h2}>{dunkin ? 'Waiting to be banked' : 'Bags in the safe'}</h2>
          <span style={ui.muted}>{picked.length} of {bags.length} selected, {money(pickedValue)}</span>
        </div>
        {bags.length === 0 ? (
          <p style={ui.muted}>{dunkin ? 'Nothing waiting. End of day records the deposit when you bank the same day.' : 'No bags in the safe.'}</p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={ui.table}>
              <thead>
                <tr>
                  <th style={ui.th}><span className="sr-only">Going with the collector</span></th>
                  <th style={ui.th}>{dunkin ? 'End of day' : 'Banked'}</th>
                  {!dunkin && <th style={ui.th}>Banking</th>}
                  <th style={ui.th}>{dunkin ? 'Bag number' : 'Inner bag'}</th>
                  <th style={ui.thNum}>Value</th>
                </tr>
              </thead>
              <tbody>
                {bags.map(b => {
                  const on = !unticked.has(b.bagNo);
                  const age = -b.day;
                  return (
                    <tr key={b.bagNo}>
                      <td style={ui.td}>
                        <input
                          type="checkbox"
                          checked={on}
                          aria-label={`Bag ${b.shownBagNo} goes ${bankRun ? 'in this deposit' : 'with the collector'}`}
                          style={{ width: 18, height: 18 }}
                          onChange={() => setUnticked(prev => {
                            const next = new Set(prev);
                            if (next.has(b.bagNo)) next.delete(b.bagNo); else next.add(b.bagNo);
                            return next;
                          })}
                        />
                      </td>
                      <td style={ui.td}>
                        {dayLabel(b.day, now)}
                        {age >= 3 && !dunkin && <span style={{ ...ui.pill('warn'), marginLeft: 6 }}>{age} days</span>}
                      </td>
                      {!dunkin && <td style={ui.td}>{b.kind === 'charity' ? 'Charity' : b.banking === 1 ? 'First' : 'Second'}</td>}
                      <td style={ui.td}>{b.shownBagNo}</td>
                      <td style={ui.tdNum}>
                        {money(b.value)}
                        {b.foreign && (Object.keys(b.foreign) as Tender[]).map(t => (
                          <div key={t} style={ui.muted}>{TENDER_LABEL[t]} {money(b.foreign?.[t] ?? 0, t)}</div>
                        ))}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        {over && !bankRun && (
          <Notice tone="warn">
            {money(pickedValue)} is over the {money(rules.maxOuterBag)} outer bag limit. Deselect the newest bags for the next collection.
          </Notice>
        )}

        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          {bankRun ? (
            <label style={{ ...ui.field, flex: '1 1 180px' }}>
              <span style={ui.fieldLabel}>Bank and branch</span>
              <input style={ui.input} value={bankName} placeholder={dunkin ? 'Barclays, Camden' : 'Barclays, Bury St Edmunds'} onChange={e => setBankName(e.target.value)} />
            </label>
          ) : (
            <>
              <label style={{ ...ui.field, flex: '1 1 180px' }}>
                <span style={ui.fieldLabel}>Outer bag number</span>
                <input style={ui.input} value={outerBag} placeholder="OB-7731" onChange={e => setOuterBag(e.target.value)} />
              </label>
              <label style={{ ...ui.field, flex: '1 1 180px' }}>
                <span style={ui.fieldLabel}>Collector&apos;s name</span>
                <input style={ui.input} value={collector} onChange={e => setCollector(e.target.value)} />
              </label>
            </>
          )}
          {operators && (
            <label style={{ ...ui.field, flex: '1 1 180px' }}>
              <span style={ui.fieldLabel}>{bankRun ? 'Paying-in reference' : 'Receipt reference (optional)'}</span>
              <input style={ui.input} value={reference} placeholder={dunkin ? 'From the slip' : 'HCS 16.11.26 - 4798664'} onChange={e => setReference(e.target.value)} />
            </label>
          )}
          <div style={{ flex: '1 1 180px' }}>
            <PersonSelect id="handed" label={dunkin ? 'Deposited by' : bankRun ? 'Taken by' : 'Handed over by'} value={handedOverBy} onChange={setHanded} people={team} />
          </div>
          <div style={{ flex: '1 1 180px' }}>
            <PersonSelect
              id="witness"
              label={`${dunkin ? 'Checked by' : bankRun ? 'Bags checked by' : 'Witnessed by'} ${rules.dualConfirm ? '(required)' : '(optional)'}`}
              value={witness}
              onChange={setWitness}
              people={team.filter(p => p !== handedOverBy)}
              allowNone
            />
          </div>
        </div>
        {dunkin && bags.length > 0 && (
          <SlipField id="deposit-slip" value={slip} onChange={setSlip} amount={pickedValue} reference={reference} shop={shop.name} required />
        )}
        {operators && (
          <label style={ui.field}>
            <span style={ui.fieldLabel}>Comment (optional)</span>
            <input style={ui.input} value={comment} onChange={e => setComment(e.target.value)} />
          </label>
        )}
        {tried && problems.length > 0 && (
          <div role="alert" style={{ color: 'var(--color-error)', fontSize: 13, lineHeight: 1.5 }}>
            {problems.map(p => <div key={p}>{p}</div>)}
          </div>
        )}
        <button type="button" style={{ ...ui.primaryBtn, alignSelf: 'flex-start' }} onClick={save} disabled={!bags.length}>
          {dunkin ? 'Record deposit' : bankRun ? 'Record bank run' : 'Record collection'}
        </button>
      </section>

      <section style={ui.card} aria-labelledby="past-h">
        <h2 id="past-h" style={ui.h2}>{dunkin ? 'Past deposits' : 'Past collections'}</h2>
        <div style={{ overflowX: 'auto' }}>
          <table style={ui.table}>
            <thead>
              <tr>
                <th style={ui.th}>When</th>
                <th style={ui.th}>{dunkin ? 'Reference' : 'Outer bag'}</th>
                {dunkin ? <th style={ui.th}>Covers</th> : <th style={ui.thNum}>Inner bags</th>}
                <th style={ui.thNum}>Value</th>
                <th style={ui.th}>{dunkin ? 'Bank' : 'Collector'}</th>
                <th style={ui.th}>{dunkin ? 'Deposited by' : 'Handed over by'}</th>
                {dunkin && <th style={ui.th}>Slip</th>}
              </tr>
            </thead>
            <tbody>
              {history.map(c => (
                <tr key={c.id}>
                  <td style={ui.td}>{whenLabel(c.when)}</td>
                  <td style={ui.td}>
                    {dunkin ? c.reference ?? <span style={ui.muted}>None</span> : (
                      <>
                        {c.method === 'bank-run' ? 'Bank run' : c.outerBag}
                        {c.reference && <div style={ui.muted}>Ref {c.reference}</div>}
                      </>
                    )}
                  </td>
                  {dunkin ? <td style={ui.td}>{coveredDays(c, allShopBags, now)}</td> : <td style={ui.tdNum}>{c.bagNos.length}</td>}
                  <td style={ui.tdNum}>{money(c.value)}</td>
                  <td style={ui.td}>
                    {c.method === 'bank-run' ? c.company : `${c.collector}, ${c.company}`}
                    {c.comment && <div style={ui.muted}>{c.comment}</div>}
                  </td>
                  <td style={ui.td}>
                    {c.handedOverBy}
                    {c.witnessedBy && <div style={ui.muted}>{dunkin ? 'Checked by' : 'Witness:'} {c.witnessedBy}</div>}
                  </td>
                  {dunkin && <td style={ui.td}><SlipCell c={c} /></td>}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
