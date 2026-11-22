'use client';

import Link from 'next/link';
import { useId, useState, type CSSProperties, type ReactNode } from 'react';
import { ArrowRight, Check, Lock } from 'lucide-react';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { usePretState } from '@/components/Pret/pretStore';
import { useCashAudience, type CashAudience } from '@/components/Pret/cashOperators';
import {
  ALL_STEPS, BACKBONE, SETUP, SETUP_ORDER, STAGES, useShopBanking, type ChoiceStep, type Step, type SwitchStep,
} from '@/components/Pret/cashSetup';
import { CASH_SHOPS } from '@/components/Pret/cashFixtures';
import { useShopName } from '@/components/Pret/shopNames';

const T = { title: 28, section: 17, body: 14, meta: 13 } as const;
const hairline = '1px solid var(--color-border-subtle)';
const whiteCard: CSSProperties = { background: '#ffffff', borderRadius: 14, border: hairline };
const help: CSSProperties = { margin: 0, fontSize: T.meta, lineHeight: 1.5, color: 'var(--color-text-secondary)' };

type Overrides = Partial<Record<CashAudience, Record<string, string>>>;

const TAG: Record<CashAudience, CSSProperties> = {
  pret: { background: 'var(--color-bg-hover)', borderColor: 'var(--color-border-subtle)' },
  pub: { background: 'var(--color-warning-light)', borderColor: 'var(--color-warning-border)' },
  dunkin: { background: 'var(--color-review-light)', borderColor: 'var(--color-review-border)' },
};

/** Who runs which cash steps: one engine, a set-up per type of operator. */
export default function CashSetupPage() {
  const [audience, setAudience] = useCashAudience();
  const [overrides, setOverrides] = usePretState<Overrides>('cash-setup-overrides', {});
  const [view, setView] = useState<'settings' | 'compare'>('settings');
  const narrow = useMediaQuery('(max-width: 900px)');

  const valueOf = (a: CashAudience, s: Step): string => overrides[a]?.[s.id] ?? (s.kind === 'switch' ? s.use[a] : s.value[a]);
  const setValue = (s: Step, v: string) =>
    setOverrides(prev => {
      const base = s.kind === 'switch' ? s.use[audience] : s.value[audience];
      const mine = { ...(prev[audience] ?? {}) };
      if (v === base) delete mine[s.id];
      else mine[s.id] = v;
      return { ...prev, [audience]: mine };
    });
  const changed = Object.keys(overrides[audience] ?? {}).length;
  const counts = (a: CashAudience) => {
    const switches = ALL_STEPS.filter((s): s is SwitchStep => s.kind === 'switch');
    return { on: switches.filter(s => valueOf(a, s) === 'on').length, ask: switches.filter(s => valueOf(a, s) === 'ask').length, total: switches.length };
  };

  return (
    <div style={{ padding: narrow ? '24px 20px 64px' : '32px 32px 80px', maxWidth: 1040, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 36, fontFamily: 'var(--font-primary)', color: 'var(--color-text-primary)' }}>
      <header style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <h1 style={{ margin: 0, fontSize: T.title, fontWeight: 700, lineHeight: 1.2 }}>Cash set-up</h1>
        <p style={{ ...help, fontSize: T.body, maxWidth: 680 }}>
          Every customer runs the same four steps, in the same order. What changes is which extra steps are switched on. Pick a starting set-up, then adjust it.
        </p>
      </header>

      <section aria-labelledby="setup-h" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <h2 id="setup-h" style={{ margin: 0, fontSize: T.section, fontWeight: 700 }}>Starting set-up</h2>
        <div role="radiogroup" aria-labelledby="setup-h" style={{ display: 'grid', gridTemplateColumns: narrow ? '1fr' : 'repeat(3, minmax(0, 1fr))', gap: 12 }}>
          {SETUP_ORDER.map(a => {
            const selected = a === audience;
            const c = counts(a);
            return (
              <button
                key={a}
                type="button"
                role="radio"
                aria-checked={selected}
                onClick={() => setAudience(a)}
                style={{
                  ...whiteCard, textAlign: 'left', cursor: 'pointer', fontFamily: 'inherit', color: 'inherit',
                  padding: selected ? '15px 17px' : '16px 18px', border: selected ? '2px solid var(--color-text-primary)' : hairline,
                  display: 'flex', flexDirection: 'column', gap: 6,
                }}
              >
                <span style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                  <Tag a={a} />
                  {selected && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12.5, fontWeight: 700 }}><Check size={14} aria-hidden /> Selected</span>}
                </span>
                <span style={{ fontSize: T.body, fontWeight: 700 }}>{SETUP[a].who}</span>
                <span style={help}>{SETUP[a].summary}</span>
                <span style={{ fontSize: T.meta, fontWeight: 600, marginTop: 4 }}>
                  {c.on} of {c.total} extra steps on{c.ask ? `, ${c.ask} to confirm` : ''}
                </span>
              </button>
            );
          })}
        </div>
        <p style={help}>
          The shop Cash pages follow the set-up you pick.{' '}
          <Link href="/cash/today" style={{ display: 'inline-flex', alignItems: 'center', gap: 3, color: 'var(--color-text-primary)', fontWeight: 600, whiteSpace: 'nowrap' }}>
            Open Cash as {SETUP[audience].name}<ArrowRight size={13} aria-hidden />
          </Link>
        </p>
      </section>

      <section aria-labelledby="spine-h" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-end', justifyContent: 'space-between', gap: '4px 16px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <h2 id="spine-h" style={{ margin: 0, fontSize: T.section, fontWeight: 700 }}>Every customer</h2>
            <p style={help}>These can&apos;t be switched off or reordered, so every set-up still reconciles.</p>
          </div>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: T.meta, color: 'var(--color-text-secondary)' }}><Lock size={14} aria-hidden /> Always on</span>
        </div>
        <ol style={{ ...whiteCard, margin: 0, padding: 0, listStyle: 'none', display: 'grid', gridTemplateColumns: narrow ? '1fr 1fr' : 'repeat(4, minmax(0, 1fr))', overflow: 'hidden', gap: 1, background: 'var(--color-border-subtle)' }}>
          {BACKBONE.map((b, i) => (
            <li key={b.title} style={{ background: '#ffffff', padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 4 }}>
              <span style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--color-text-secondary)' }}>Step {i + 1}</span>
              <span style={{ fontSize: T.body, fontWeight: 700 }}>{b.title}</span>
              <span style={help}>{b.help}</span>
            </li>
          ))}
        </ol>
      </section>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <div role="tablist" aria-label="View" style={{ display: 'flex', background: 'var(--color-bg-hover)', borderRadius: 100, padding: 3, width: 'fit-content' }}>
            {([['settings', `Extra steps for ${SETUP[audience].name}`], ['compare', 'Compare customers']] as const).map(([id, label]) => {
              const active = view === id;
              return (
                <button
                  key={id}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => setView(id)}
                  style={{
                    minHeight: 44, padding: '0 16px', borderRadius: 100, border: 'none', fontSize: T.meta, fontWeight: 600, fontFamily: 'inherit', cursor: 'pointer',
                    background: active ? 'var(--color-accent-active)' : 'transparent', color: active ? '#fff' : 'var(--color-text-secondary)',
                  }}
                >
                  {label}
                </button>
              );
            })}
          </div>
          <Legend />
        </div>

        {view === 'settings' ? (
          <>
            {changed > 0 && (
              <div role="status" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', padding: '10px 16px', borderRadius: 12, background: 'var(--color-bg-hover)', fontSize: T.meta }}>
                <span>
                  {changed} {changed === 1 ? 'setting differs' : 'settings differ'} from the {SETUP[audience].name} set-up.
                </span>
                <button type="button" onClick={() => setOverrides(prev => ({ ...prev, [audience]: {} }))} style={{ minHeight: 44, padding: '0 14px', border: 'none', background: 'transparent', fontFamily: 'inherit', fontSize: T.meta, fontWeight: 700, textDecorationLine: 'underline', cursor: 'pointer', color: 'var(--color-text-primary)' }}>
                  Reset to {SETUP[audience].name}
                </button>
              </div>
            )}
            {audience === 'dunkin' && <ShopBanking narrow={narrow} />}
            {STAGES.map(stage => (
              <section key={stage.id} aria-labelledby={`${stage.id}-h`} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <h2 id={`${stage.id}-h`} style={{ margin: 0, fontSize: T.section, fontWeight: 700 }}>{stage.title}</h2>
                  <p style={help}>{stage.description}</p>
                </div>
                <ul style={{ ...whiteCard, margin: 0, padding: 0, listStyle: 'none', overflow: 'hidden' }}>
                  {stage.steps.map((s, i) => (
                    <StepRow key={s.id} step={s} first={i === 0} audience={audience} value={valueOf(audience, s)} changed={overrides[audience]?.[s.id] !== undefined} onChange={v => setValue(s, v)} narrow={narrow} />
                  ))}
                </ul>
              </section>
            ))}
          </>
        ) : (
          <Compare valueOf={valueOf} selected={audience} counts={counts} />
        )}
      </div>
    </div>
  );
}

function Tag({ a, suffix, dashed }: { a: CashAudience; suffix?: string; dashed?: boolean }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', padding: '2px 9px', borderRadius: 999, border: '1px solid', fontSize: 12, fontWeight: 600, lineHeight: 1.5, whiteSpace: 'nowrap',
      ...(dashed ? { background: '#ffffff', borderColor: 'var(--color-border)', borderStyle: 'dashed' } : TAG[a]),
    }}>
      {SETUP[a].name}{suffix && <span style={{ fontWeight: 400 }}>{suffix}</span>}
    </span>
  );
}

function Legend() {
  return (
    <p style={{ ...help, display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
      <span>Tags show who needs a step:</span>
      {SETUP_ORDER.map(a => <Tag key={a} a={a} />)}
      <Tag a="pret" suffix=", to confirm" dashed />
    </p>
  );
}

function WhoNeeds({ step }: { step: Step }) {
  if (step.kind === 'choice') {
    return <>{SETUP_ORDER.map(a => <Tag key={a} a={a} suffix={`: ${step.value[a]}`} />)}</>;
  }
  const using = SETUP_ORDER.filter(a => step.use[a] === 'on');
  const asking = SETUP_ORDER.filter(a => step.use[a] === 'ask');
  if (!using.length && !asking.length) return <span style={help}>No customer needs this yet</span>;
  return (
    <>
      {using.map(a => <Tag key={a} a={a} />)}
      {asking.map(a => <Tag key={a} a={a} suffix=", to confirm" dashed />)}
    </>
  );
}

function pretLine(step: Step): string | undefined {
  if (!step.pretRef) return undefined;
  if (step.kind === 'switch' && step.use.pret === 'off') return `Pret said no, ${step.pretRef}`;
  return `Pret requirement ${step.pretRef}`;
}

function StepRow({ step, first, audience, value, changed, onChange, narrow }: {
  step: Step; first: boolean; audience: CashAudience; value: string; changed: boolean; onChange: (v: string) => void; narrow: boolean;
}) {
  const labelId = useId();
  const question = step.ask?.[audience];
  const ref = pretLine(step);
  const stack = narrow && step.kind === 'choice';
  return (
    <li style={{
      display: 'grid', gridTemplateColumns: stack ? '1fr' : 'minmax(0, 1fr) auto', alignItems: 'center', gap: stack ? 12 : '8px 16px',
      padding: '16px 20px', borderTop: first ? 'none' : hairline,
    }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 0 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <span id={labelId} style={{ fontSize: T.body, fontWeight: 600 }}>
            {step.label}
            {changed && <span style={{ marginLeft: 8, fontSize: 12, fontWeight: 600, color: 'var(--color-text-secondary)' }}>Changed</span>}
          </span>
          <p style={help}>{step.help}</p>
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 6 }}>
          <WhoNeeds step={step} />
          {ref && <span style={{ ...help, fontSize: 12, marginLeft: 4 }}>{ref}</span>}
        </div>
        {question && value === 'ask' && <p style={{ ...help, color: 'var(--color-text-primary)' }}><strong>To confirm:</strong> {question}</p>}
      </div>
      {step.kind === 'switch'
        ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, justifySelf: 'end' }}>
            {value === 'ask' && <span style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--color-text-secondary)' }}>To confirm</span>}
            <Switch checked={value === 'on'} onChange={v => onChange(v ? 'on' : 'off')} labelledBy={labelId} />
          </div>
        )
        : <Choice step={step} value={value} onChange={onChange} labelledBy={labelId} />}
    </li>
  );
}

/** Dunkin managers take the cash to the bank themselves, so each shop has its own branch and bag rule. */
function ShopBanking({ narrow }: { narrow: boolean }) {
  const { bankingFor, setBanking } = useShopBanking();
  const nameOf = useShopName();
  const ids = useId();
  return (
    <section aria-labelledby={`${ids}-h`} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <h2 id={`${ids}-h`} style={{ margin: 0, fontSize: T.section, fontWeight: 700 }}>Where each shop banks</h2>
        <p style={help}>The close fills these in, so managers never type them. Some branches need deposits in a numbered bag, such as overnight drops in South Carolina.</p>
      </div>
      <ul style={{ ...whiteCard, margin: 0, padding: 0, listStyle: 'none', overflow: 'hidden' }}>
        {CASH_SHOPS.map((shop, i) => {
          const b = bankingFor(shop.siteId);
          const name = nameOf(shop.siteId, shop.name);
          const bagLabel = `${ids}-${shop.siteId}-bag`;
          return (
            <li key={shop.siteId} style={{
              display: 'grid', gridTemplateColumns: narrow ? '1fr' : 'minmax(0, 1fr) minmax(0, 1.4fr) auto', alignItems: 'center', gap: narrow ? 10 : 16,
              padding: '14px 20px', borderTop: i === 0 ? 'none' : hairline,
            }}>
              <span style={{ fontSize: T.body, fontWeight: 600 }}>{name}</span>
              <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12.5, fontWeight: 600 }}>
                Bank and branch
                <input
                  value={b.bank}
                  onChange={e => setBanking(shop.siteId, { bank: e.target.value })}
                  style={{ minHeight: 44, padding: '0 12px', borderRadius: 10, border: '1px solid var(--color-border)', fontFamily: 'inherit', fontSize: T.body, color: 'inherit' }}
                />
              </label>
              <span style={{ display: 'flex', alignItems: 'center', gap: 4, justifySelf: narrow ? 'start' : 'end' }}>
                <span id={bagLabel} style={{ fontSize: T.meta, fontWeight: 600 }}>Deposit bag needed<span style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)' }}>, {name}</span></span>
                <Switch checked={b.bagNeeded} onChange={v => setBanking(shop.siteId, { bagNeeded: v })} labelledBy={bagLabel} />
              </span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function Switch({ checked, onChange, labelledBy }: { checked: boolean; onChange: (v: boolean) => void; labelledBy: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-labelledby={labelledBy}
      onClick={() => onChange(!checked)}
      style={{ display: 'grid', placeItems: 'center', width: 56, height: 44, padding: 0, border: 0, background: 'transparent', cursor: 'pointer' }}
    >
      <span aria-hidden style={{
        position: 'relative', width: 44, height: 26, borderRadius: 999, transition: 'background 120ms ease',
        background: checked ? 'var(--color-text-primary)' : '#ffffff',
        border: `1.5px solid ${checked ? 'var(--color-text-primary)' : 'var(--color-border)'}`,
      }}>
        <span style={{
          position: 'absolute', top: 2.5, left: checked ? 20.5 : 2.5, width: 18, height: 18, borderRadius: '50%', transition: 'left 120ms ease',
          background: checked ? '#ffffff' : 'var(--color-border)',
        }} />
      </span>
    </button>
  );
}

function Choice({ step, value, onChange, labelledBy }: { step: ChoiceStep; value: string; onChange: (v: string) => void; labelledBy: string }) {
  return (
    <div role="radiogroup" aria-labelledby={labelledBy} style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
      {step.options.map(o => {
        const selected = o === value;
        return (
          <button
            key={o}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(o)}
            style={{
              minHeight: 44, padding: '0 14px', borderRadius: 10, fontFamily: 'inherit', fontSize: T.meta, fontWeight: 600, cursor: 'pointer',
              background: selected ? 'var(--color-text-primary)' : '#ffffff', color: selected ? '#ffffff' : 'var(--color-text-primary)',
              border: `1px solid ${selected ? 'var(--color-text-primary)' : 'var(--color-border)'}`,
            }}
          >
            {o}
          </button>
        );
      })}
    </div>
  );
}

function Compare({ valueOf, selected, counts }: {
  valueOf: (a: CashAudience, s: Step) => string;
  selected: CashAudience;
  counts: (a: CashAudience) => { on: number; ask: number; total: number };
}) {
  const cell: CSSProperties = { padding: '12px 16px', borderTop: hairline, fontSize: T.meta, verticalAlign: 'top' };
  const col = (a: CashAudience): CSSProperties => (a === selected ? { background: 'var(--color-bg-hover)' } : {});
  const show = (a: CashAudience, s: Step): ReactNode => {
    const v = valueOf(a, s);
    if (s.kind === 'choice') return <span style={{ fontWeight: 600 }}>{v}</span>;
    if (v === 'on') return <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontWeight: 600 }}><Check size={15} aria-hidden /> On</span>;
    if (v === 'ask') return <span style={{ fontWeight: 600 }}>To confirm</span>;
    return <span style={{ color: 'var(--color-text-secondary)' }}>Off</span>;
  };
  return (
    <div style={{ ...whiteCard, overflowX: 'auto' }}>
      <table style={{ width: '100%', minWidth: 720, borderCollapse: 'collapse' }}>
        <caption style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)' }}>Which extra steps each customer uses</caption>
        <thead>
          <tr>
            <th scope="col" style={{ ...cell, borderTop: 'none', textAlign: 'left', fontWeight: 700 }}>Step</th>
            {SETUP_ORDER.map(a => (
              <th key={a} scope="col" style={{ ...cell, ...col(a), borderTop: 'none', textAlign: 'left', width: 150 }}>
                <span style={{ display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'flex-start' }}>
                  <Tag a={a} />
                  <span style={{ fontWeight: 400, fontSize: 12, color: 'var(--color-text-secondary)' }}>{counts(a).on} of {counts(a).total} on</span>
                </span>
              </th>
            ))}
            <th scope="col" style={{ ...cell, borderTop: 'none', textAlign: 'left', fontWeight: 700, width: 170 }}>Pret requirement</th>
          </tr>
        </thead>
        {STAGES.map(stage => (
          <tbody key={stage.id}>
            <tr>
              <th colSpan={5} scope="colgroup" style={{ ...cell, textAlign: 'left', fontSize: 12, fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase', background: '#ffffff', paddingTop: 18 }}>{stage.title}</th>
            </tr>
            {stage.steps.map(s => (
              <tr key={s.id}>
                <th scope="row" style={{ ...cell, textAlign: 'left', fontWeight: 600 }}>{s.label}</th>
                {SETUP_ORDER.map(a => <td key={a} style={{ ...cell, ...col(a) }}>{show(a, s)}</td>)}
                <td style={{ ...cell, color: 'var(--color-text-secondary)' }}>{pretLine(s)?.replace('Pret requirement ', '') ?? 'Not in Pret\u2019s list'}</td>
              </tr>
            ))}
          </tbody>
        ))}
      </table>
    </div>
  );
}
