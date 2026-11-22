'use client';

import Link from 'next/link';
import { Suspense, useId, useMemo, useState, type CSSProperties, type ReactNode } from 'react';
import { useSearchParams } from 'next/navigation';
import { ArrowRight, Lock, ReceiptText, Search, ShieldAlert, Users } from 'lucide-react';
import StyledSelect from '@/components/ui/StyledSelect';
import { useCompanyContext } from '@/components/Settings/companyContextStore';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { DISTRICT, PHONE_STORE, STORES, storeById } from '@/components/Feedback/dunkinData';
import { firstName, signOff, useFeedback, type LiveTicket } from '@/components/Feedback/feedbackState';
import { WHO_SENDS_LABEL, type ReplySettings, type StoreId, type WhoSends } from '@/components/Feedback/model';
import { hairline, quote, whiteCard } from '@/components/Feedback/ui';

const field: CSSProperties = {
  minHeight: 44, padding: '0 12px', borderRadius: 8, border: '1px solid var(--color-border)', background: '#ffffff',
  color: 'var(--color-text-primary)', fontFamily: 'var(--font-primary)', fontSize: 14,
};
const T = { title: 28, section: 17, body: 14, meta: 13 } as const;
const help: CSSProperties = { margin: 0, fontSize: T.meta, lineHeight: 1.5, color: 'var(--color-text-secondary)' };
const WHO_HELP: Record<WhoSends, string> = {
  person: 'Every reply waits for a manager to read it, add their own line and send.',
  'edify-thanks': 'Compliments with no comment get a thank-you signed by the store manager. Everything else is drafted.',
};
const NEVER = [
  { icon: ShieldAlert, text: 'Allergy and food safety reports' },
  { icon: Users, text: 'Complaints about a team member by name' },
  { icon: ReceiptText, text: 'Requests for money back' },
];
const SAMPLE_TICKET = '5105';

type StoreRow = { id: string; name: string; manager: string; avgReplyHours: number };

const PREVIEW_STREETS = [
  'Jerome Ave', 'Webster Ave', 'Boston Rd', 'Gun Hill Rd', 'Allerton Ave', 'Baychester Ave', 'Bruckner Blvd', 'Southern Blvd',
  'Kingsbridge Rd', 'Riverdale Ave', 'Burnside Ave', 'Hunts Point Ave', 'Parkchester', 'Co-op City', 'Throggs Neck', 'City Island Ave',
  'White Plains Rd', 'Morris Park Ave', 'Williamsbridge Rd', 'Eastchester Rd', 'Mosholu Pkwy', 'Bedford Park Blvd', 'University Ave',
  'Sedgwick Ave', 'Cypress Ave', 'E 149th St', 'Willis Ave', "St Ann's Ave", 'Longwood Ave', 'Soundview Ave', 'Fordham Plaza',
  'Van Cortlandt Park', 'Spuyten Duyvil', 'Wakefield', 'Norwood', 'Belmont', 'Arthur Ave', 'Pelham Bay', 'Westchester Ave',
  'Tremont Ave W', 'Mott Haven', 'Port Morris', 'Melrose', 'Highbridge',
];
const PREVIEW_MANAGERS = ['Luis', 'Grace', 'Omar', 'Tanya', 'Rafael', 'Mei', 'Andre', 'Shannon', 'Kofi', 'Lena', 'Hector', 'Bri'];

/** Made-up stores for ?stores=50, so the store list can be seen at a region's size. Never saved. */
function previewRows(total: number): StoreRow[] {
  return PREVIEW_STREETS.slice(0, Math.max(0, total - STORES.length)).map((name, i) => ({
    id: `preview-${i}`,
    name,
    manager: `${PREVIEW_MANAGERS[i % PREVIEW_MANAGERS.length]} ${String.fromCharCode(65 + ((i * 7) % 26))}.`,
    avgReplyHours: 4 + ((i * 11) % 27),
  }));
}

/** The lines under "# Brand voice" in the company context, without list dashes. */
function brandVoiceLines(body: string): string[] {
  const lines = body.split('\n');
  const start = lines.findIndex(l => /^#\s*brand voice/i.test(l.trim()));
  if (start < 0) return [];
  const out: string[] = [];
  for (const l of lines.slice(start + 1)) {
    if (/^#/.test(l.trim())) break;
    const text = l.trim().replace(/^[-*]\s*/, '');
    if (text) out.push(text);
  }
  return out;
}

/** Screen 5. Angela decides how much Edify does; the composer and the phone read it. */
export default function ReplySettingsPage() {
  return (
    <Suspense>
      <ReplySettings />
    </Suspense>
  );
}

function ReplySettings() {
  const { settings, setSettings, tickets } = useFeedback();
  const [saved, setSaved] = useState('');
  const [round, setRound] = useState(0);
  const preview = Number(useSearchParams().get('stores')) || 0;
  const extra = useMemo(() => previewRows(preview), [preview]);
  return (
    <SettingsForm
      key={`${JSON.stringify(settings)}-${round}`}
      initial={settings}
      extra={extra}
      sample={tickets.find(t => t.id === SAMPLE_TICKET)}
      saved={saved}
      onEdit={() => setSaved('')}
      onDiscard={() => setRound(n => n + 1)}
      onSave={next => {
        setSettings(next);
        setRound(n => n + 1);
        setSaved(`Settings saved for ${STORES.length + extra.length} stores.`);
      }}
    />
  );
}

function SettingsForm({ initial, extra, sample, saved, onEdit, onDiscard, onSave }: {
  initial: ReplySettings; extra: StoreRow[]; sample?: LiveTicket; saved: string;
  onEdit: () => void; onDiscard: () => void; onSave: (s: ReplySettings) => void;
}) {
  const wide = useMediaQuery('(min-width: 1100px)');
  const { context } = useCompanyContext();
  const voice = brandVoiceLines(context.body);
  const [s, setS] = useState(initial);
  const [extraStart] = useState(() => Object.fromEntries(extra.map((r, i) => [r.id, i % 7 === 3 ? 'edify-thanks' : initial.district])) as Record<string, WhoSends>);
  const [extraWho, setExtraWho] = useState(extraStart);
  const dirty = JSON.stringify(s) !== JSON.stringify(initial) || JSON.stringify(extraWho) !== JSON.stringify(extraStart);
  const edit = (p: Partial<ReplySettings>) => {
    setS(prev => ({ ...prev, ...p }));
    onEdit();
  };
  const rows: StoreRow[] = [...STORES, ...extra];
  const isReal = (id: string): id is StoreId => id in s.stores;
  const whoAt = (id: string) => (isReal(id) ? s.stores[id] : extraWho[id]);
  const setMany = (ids: string[], w: WhoSends) => {
    const real = ids.filter(isReal);
    if (real.length) edit({ stores: { ...s.stores, ...Object.fromEntries(real.map(id => [id, w])) } });
    const rest = ids.filter(id => !isReal(id));
    if (rest.length) {
      setExtraWho(prev => ({ ...prev, ...Object.fromEntries(rest.map(id => [id, w])) }));
      onEdit();
    }
  };
  const setAll = (w: WhoSends) => {
    edit({ district: w, stores: Object.fromEntries(STORES.map(x => [x.id, w])) as Record<StoreId, WhoSends> });
    setExtraWho(Object.fromEntries(extra.map(r => [r.id, w])));
  };
  const thanksStores = rows.filter(x => whoAt(x.id) === 'edify-thanks');
  const differ = rows.filter(x => whoAt(x.id) !== s.district).length;
  const irmo = storeById(PHONE_STORE);

  return (
    <div style={{ maxWidth: 1040, margin: '0 auto', padding: '32px clamp(20px, 4vw, 48px) 40px', display: 'flex', flexDirection: 'column', gap: 44 }}>
      <header style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <h1 style={{ margin: 0, fontSize: T.title, lineHeight: 1.15, fontWeight: 700 }}>How much Edify does</h1>
        <p style={{ margin: 0, maxWidth: 640, fontSize: T.body, lineHeight: 1.55, color: 'var(--color-text-secondary)' }}>
          Set by {DISTRICT.manager} for the {DISTRICT.name}. Store managers see this on every draft, so they know what Edify will and won&apos;t send.
        </p>
      </header>

      <Group id="who" title="Who sends" description={`Applies to all ${rows.length} stores. You can change single stores at the bottom of the page.`}>
        <div role="radiogroup" aria-labelledby="who" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(300px, 100%), 1fr))', gap: 12 }}>
          {(['person', 'edify-thanks'] as WhoSends[]).map(w => {
            const on = s.district === w;
            return (
              <label key={w} style={{
                ...whiteCard, display: 'flex', gap: 14, padding: on ? '17px 19px' : '18px 20px', borderRadius: 14, cursor: 'pointer',
                border: on ? '2px solid var(--color-text-primary)' : '1px solid var(--color-border-subtle)',
              }}>
                <input type="radio" name="who" checked={on} onChange={() => setAll(w)} style={{ flex: '0 0 20px', width: 20, height: 20, margin: '1px 0 0', accentColor: 'var(--color-text-primary)' }} />
                <span style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <span style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8, fontSize: T.body, fontWeight: 700 }}>
                    {WHO_SENDS_LABEL[w]}
                    {w === 'person' && <span style={{ fontSize: T.meta, fontWeight: 500, color: 'var(--color-text-secondary)' }}>Default</span>}
                  </span>
                  <span style={help}>{WHO_HELP[w]}</span>
                </span>
              </label>
            );
          })}
        </div>
        <p style={{ ...help, display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0 8px' }}>
          <span>
            {differ === 0
              ? `All ${rows.length} stores follow this.`
              : thanksStores.length > 0 && thanksStores.length <= 3 && s.district === 'person'
                ? `${new Intl.ListFormat('en-US').format(thanksStores.map(x => x.name))} send thank-yous.`
                : `${differ} of ${rows.length} stores are set differently.`}
          </span>
          <a href="#stores" style={{ display: 'inline-flex', alignItems: 'center', minHeight: 44, fontWeight: 700, color: 'var(--color-text-primary)' }}>Change single stores</a>
        </p>
      </Group>

      <Group id="sound" title="How replies sound" description="What every drafted reply has in common, whichever store sends it.">
        <div style={{ display: 'grid', gridTemplateColumns: wide ? 'minmax(0, 1fr) 320px' : '1fr', gap: 20, alignItems: 'start' }}>
          <Rows>
            <Row
              label="Brand voice"
              help="From Settings, Context. Every Edify draft uses it, not only replies."
              stacked
            >
              {voice.length ? (
                <ul style={{ margin: 0, paddingLeft: 18, fontSize: T.body, lineHeight: 1.6 }}>
                  {voice.map(v => <li key={v}>{v}</li>)}
                </ul>
              ) : (
                <p style={{ margin: 0, fontSize: T.body }}>Not set yet. Drafts follow the note below until it is.</p>
              )}
              <Link href="/settings/context" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, minHeight: 44, fontSize: T.meta, fontWeight: 700, color: 'var(--color-text-primary)' }}>
                {voice.length ? 'Edit brand voice' : 'Add a brand voice'} <ArrowRight size={14} aria-hidden />
              </Link>
            </Row>
            <Row label="Extra for replies" help="Optional. Only for guest replies, on top of the brand voice." htmlFor="style-note" stacked>
              <textarea
                id="style-note"
                rows={3}
                value={s.style}
                onChange={e => edit({ style: e.target.value })}
                style={{ ...field, width: '100%', boxSizing: 'border-box', padding: '10px 12px', lineHeight: 1.55, resize: 'vertical' }}
              />
            </Row>
            <Row label="Sign replies as" help="The preview shows how it reads." htmlFor="sign-as">
              <StyledSelect id="sign-as" width={200} height={44} value={s.signAs} onChange={e => edit({ signAs: e.target.value as ReplySettings['signAs'] })}>
                <option value="manager">Manager and store</option>
                <option value="team">The store team</option>
              </StyledSelect>
            </Row>
            <Row label="Ask for the manager's own line" help="On replies to complaints, Send stays off until the manager adds a line in their own words.">
              {labelId => <Switch checked={s.ownLine} onChange={v => edit({ ownLine: v })} labelledBy={labelId} />}
            </Row>
          </Rows>
          {sample && <SamplePreview t={sample} s={s} managerFirst={irmo.managerFirst} />}
        </div>
      </Group>

      <Group id="times" title="Reply times" description="How long a guest can wait before Edify nudges someone.">
        <Rows>
          <Row label="Remind the store manager" help="If a guest is still waiting after this long, Edify reminds the store manager." htmlFor="remind">
            <StyledSelect id="remind" width={150} height={44} value={s.remindManagerHours} onChange={e => edit({ remindManagerHours: Number(e.target.value) as ReplySettings['remindManagerHours'] })}>
              {[6, 12, 24].map(h => <option key={h} value={h}>After {h} hours</option>)}
            </StyledSelect>
          </Row>
          <Row label="Tell me" help={`If a guest is still waiting after this long, Edify flags it to you, ${DISTRICT.managerFirst}.`} htmlFor="tell">
            <StyledSelect id="tell" width={150} height={44} value={s.tellDistrictHours} onChange={e => edit({ tellDistrictHours: Number(e.target.value) as ReplySettings['tellDistrictHours'] })}>
              {[12, 24, 48].map(h => <option key={h} value={h}>After {h} hours</option>)}
            </StyledSelect>
          </Row>
        </Rows>
      </Group>

      <Group
        id="never"
        title="Always comes to you"
        description="Edify never drafts these. They come straight to you with what Edify knows attached."
        aside={<span style={{ ...help, display: 'inline-flex', alignItems: 'center', gap: 6 }}><Lock size={13} aria-hidden /> Can&apos;t be turned off</span>}
      >
        <Rows>
          {NEVER.map(({ icon: Icon, text }) => (
            <li key={text} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 20px', borderTop: hairline, fontSize: T.body }}>
              <Icon size={16} aria-hidden style={{ color: 'var(--color-text-secondary)', flexShrink: 0 }} />
              {text}
            </li>
          ))}
        </Rows>
      </Group>

      <Group id="stores" title="Stores" description={`Who sends at each store. Stores you don't change follow "Who sends" at the top.`}>
        <StoreTable rows={rows} whoAt={whoAt} onSet={setMany} preview={extra.length} />
      </Group>

      <div
        style={dirty || saved ? {
          position: 'sticky', bottom: 16, zIndex: 2, display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '4px 12px',
          padding: '6px 8px 6px 20px', borderRadius: 14, background: 'var(--color-text-primary)', color: '#ffffff',
          boxShadow: '0 8px 24px rgba(28, 46, 108, 0.18)',
        } : srOnly}
      >
        <p role="status" aria-live="polite" style={{ margin: '0 auto 0 0', fontSize: T.body, fontWeight: 600 }}>
          {saved || (dirty ? 'Unsaved changes.' : '')}
        </p>
        {dirty && (
          <>
            <button type="button" onClick={onDiscard} style={{ ...quietBtn, color: '#ffffff' }}>Discard</button>
            <button type="button" onClick={() => onSave(s)} style={{ minHeight: 44, padding: '0 20px', borderRadius: 10, border: 0, background: '#ffffff', color: 'var(--color-text-primary)', fontFamily: 'var(--font-primary)', fontSize: T.body, fontWeight: 700, cursor: 'pointer' }}>
              Save settings
            </button>
          </>
        )}
      </div>
    </div>
  );
}

function Group({ id, title, description, aside, children }: { id: string; title: string; description: string; aside?: ReactNode; children: ReactNode }) {
  return (
    <section id={id} aria-labelledby={`${id}-h`} style={{ display: 'flex', flexDirection: 'column', gap: 14, scrollMarginTop: 24 }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-end', justifyContent: 'space-between', gap: '4px 16px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <h2 id={`${id}-h`} style={{ margin: 0, fontSize: T.section, fontWeight: 700 }}>{title}</h2>
          <p style={help}>{description}</p>
        </div>
        {aside}
      </div>
      {children}
    </section>
  );
}

/** A box of setting rows: the only kind of box on this page. */
function Rows({ children }: { children: ReactNode }) {
  return (
    <div style={{ ...whiteCard, borderRadius: 14, overflow: 'hidden' }}>
      <ul style={{ margin: '-1px 0 0', padding: 0, listStyle: 'none' }}>{children}</ul>
    </div>
  );
}

/** One setting: what it is and what it does on the left, the control on the right (or underneath when stacked). */
function Row({ label, help: helpText, htmlFor, stacked, children }: {
  label: string; help: string; htmlFor?: string; stacked?: boolean; children: ReactNode | ((labelId: string) => ReactNode);
}) {
  const labelId = useId();
  const title = htmlFor
    ? <label id={labelId} htmlFor={htmlFor} style={{ fontSize: T.body, fontWeight: 600 }}>{label}</label>
    : <span id={labelId} style={{ fontSize: T.body, fontWeight: 600 }}>{label}</span>;
  const control = typeof children === 'function' ? children(labelId) : children;
  return (
    <li style={{
      display: stacked ? 'flex' : 'grid', flexDirection: 'column', gridTemplateColumns: 'minmax(0, 1fr) auto',
      alignItems: stacked ? 'stretch' : 'center', gap: stacked ? 10 : '8px 24px', padding: '16px 20px', borderTop: hairline,
    }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
        {title}
        <p style={help}>{helpText}</p>
      </div>
      <div style={stacked ? { display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 4 } : undefined}>{control}</div>
    </li>
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

/** How a real reply reads with the settings on screen, so Angela sees the outcome, not just the switches. */
function SamplePreview({ t, s, managerFirst }: { t: LiveTicket; s: ReplySettings; managerFirst: string }) {
  const body = t.drafts?.standard ?? '';
  return (
    <aside aria-labelledby="sample-h" style={{ ...whiteCard, borderRadius: 14, padding: '16px 20px 20px', display: 'flex', flexDirection: 'column', gap: 12, position: 'sticky', top: 24 }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        <h3 id="sample-h" style={{ margin: 0, fontSize: T.body, fontWeight: 700 }}>Preview</h3>
        <p style={help}>Edify&apos;s reply to {firstName(t.guest)}, {t.reason.toLowerCase()} at {t.store.name}.</p>
      </div>
      <p style={{ ...quote, margin: 0, fontSize: T.body, lineHeight: 1.5, color: 'var(--color-text-secondary)' }}>&ldquo;{t.words}&rdquo;</p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, paddingTop: 12, borderTop: hairline, fontSize: T.body, lineHeight: 1.55 }}>
        <p style={{ margin: 0 }}>{body}</p>
        {s.ownLine && (
          <p style={{ margin: 0, padding: '8px 10px', borderRadius: 8, fontSize: T.meta, background: 'var(--color-warning-light)', border: '1px dashed var(--color-warning-border)' }}>
            {managerFirst} adds a line in his own words here before it can send.
          </p>
        )}
        <p style={{ margin: 0, fontWeight: 600 }}>{signOff(t.storeId, s)}</p>
      </div>
    </aside>
  );
}

const PAGE = 10;
type Show = 'all' | WhoSends;
const srOnly: CSSProperties = { position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)' };

const pill = (on: boolean): CSSProperties => ({
  display: 'inline-flex', alignItems: 'center', gap: 6, minHeight: 44, padding: '0 14px', borderRadius: 999, cursor: 'pointer',
  fontFamily: 'var(--font-primary)', fontSize: 13, fontWeight: 600,
  background: on ? 'var(--color-text-primary)' : '#ffffff', color: on ? '#ffffff' : 'var(--color-text-primary)',
  border: on ? '1px solid var(--color-text-primary)' : '1px solid var(--color-border)',
});
const quietBtn: CSSProperties = {
  minHeight: 44, padding: '0 12px', border: 0, background: 'transparent', cursor: 'pointer',
  fontFamily: 'var(--font-primary)', fontSize: 13, fontWeight: 700, color: 'var(--color-text-primary)', textDecoration: 'underline', textUnderlineOffset: 3,
};

/** Every store and who sends there, built for a region's worth of stores at any size: search, a who-sends filter, slowest-first sorting, bulk changes and 10 rows a page. */
function StoreTable({ rows, whoAt, onSet, preview }: {
  rows: StoreRow[]; whoAt: (id: string) => WhoSends; onSet: (ids: string[], w: WhoSends) => void; preview: number;
}) {
  const [q, setQ] = useState('');
  const [show, setShow] = useState<Show>('all');
  const [sort, setSort] = useState<'name' | 'slowest'>('name');
  const [limit, setLimit] = useState(PAGE);
  const [picked, setPicked] = useState<Set<string>>(() => new Set());
  const [note, setNote] = useState('');

  const needle = q.trim().toLowerCase();
  const count = (w: WhoSends) => rows.filter(r => whoAt(r.id) === w).length;
  const matches = rows
      .filter(r => show === 'all' || whoAt(r.id) === show)
      .filter(r => !needle || r.name.toLowerCase().includes(needle) || r.manager.toLowerCase().includes(needle))
      .sort((a, b) => (sort === 'slowest' ? b.avgReplyHours - a.avgReplyHours : a.name.localeCompare(b.name)));
  const shown = matches.slice(0, limit);
  const pickedHere = matches.filter(r => picked.has(r.id)).length;
  const allPicked = matches.length > 0 && pickedHere === matches.length;
  const narrowed = matches.length !== rows.length;

  const resetPage = () => {
    setLimit(PAGE);
    setNote('');
  };
  const toggle = (id: string) => setPicked(prev => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });
  const apply = (w: WhoSends) => {
    onSet([...picked], w);
    setNote(`${picked.size} ${picked.size === 1 ? 'store' : 'stores'} set to “${WHO_SENDS_LABEL[w]}”. Save to keep it.`);
    setPicked(new Set());
  };
  const cell: CSSProperties = { padding: '10px 22px' };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {preview > 0 && (
        <p style={{ margin: 0, padding: '10px 14px', borderRadius: 12, fontSize: 13, background: 'var(--color-warning-light)', border: '1px solid var(--color-warning-border)' }}>
          Preview: {preview}{' '}made-up stores are added to show a region-sized list. Changes to them aren&apos;t saved.
        </p>
      )}

      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <label style={{ position: 'relative', flex: '1 1 240px', maxWidth: 320 }}>
          <span style={srOnly}>Find a store or manager</span>
          <Search size={16} aria-hidden style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-secondary)' }} />
          <input
            type="search"
            value={q}
            onChange={e => { setQ(e.target.value); resetPage(); }}
            placeholder="Find a store or manager"
            style={{ ...field, width: '100%', boxSizing: 'border-box', paddingLeft: 36 }}
          />
        </label>
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
          <div role="group" aria-label="Show stores where" style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {(['all', 'person', 'edify-thanks'] as Show[]).map(v => (
              <button key={v} type="button" aria-pressed={show === v} onClick={() => { setShow(v); resetPage(); }} style={pill(show === v)}>
                {v === 'all' ? 'All' : v === 'person' ? 'A person sends' : 'Thank-yous'}
                <span style={{ fontWeight: 400 }}>{v === 'all' ? rows.length : count(v)}</span>
              </button>
            ))}
          </div>
                      <StyledSelect aria-label="Sort stores" width={210} height={44} value={sort} onChange={e => setSort(e.target.value as 'name' | 'slowest')}>
              <option value="name">A to Z</option>
              <option value="slowest">Slowest replies first</option>
            </StyledSelect>
        </div>
      </div>

      {picked.size > 0 && (
        <div style={{
          position: 'sticky', top: 8, zIndex: 1, display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '6px 12px',
          padding: '6px 8px 6px 18px', borderRadius: 14, background: 'var(--color-text-primary)', color: '#ffffff',
        }}>
          <span style={{ fontSize: 14, fontWeight: 700, marginRight: 'auto' }}>Set {picked.size} {picked.size === 1 ? 'store' : 'stores'} to</span>
          {(['person', 'edify-thanks'] as WhoSends[]).map(w => (
            <button key={w} type="button" onClick={() => apply(w)} style={{ ...pill(false), border: 0 }}>{WHO_SENDS_LABEL[w]}</button>
          ))}
          <button type="button" onClick={() => setPicked(new Set())} style={{ ...quietBtn, color: '#ffffff' }}>Clear</button>
        </div>
      )}

      <div style={{ ...whiteCard, borderRadius: 14, overflowX: 'auto' }}>
        <table style={{ width: '100%', minWidth: 560, borderCollapse: 'collapse', fontSize: 14 }}>
          <thead>
            <tr style={{ textAlign: 'left', fontSize: 13, color: 'var(--color-text-secondary)' }}>
              <th scope="col" style={{ width: 44, padding: '4px 0 4px 14px' }}>
                <label style={{ display: 'grid', placeItems: 'center', width: 44, height: 44, cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={allPicked}
                    ref={el => { if (el) el.indeterminate = pickedHere > 0 && !allPicked; }}
                    onChange={() => setPicked(allPicked ? new Set() : new Set(matches.map(r => r.id)))}
                    aria-label={narrowed ? `Select all ${matches.length} matching stores` : `Select all ${rows.length} stores`}
                    style={{ width: 18, height: 18, margin: 0, accentColor: 'var(--color-text-primary)' }}
                  />
                </label>
              </th>
              <th scope="col" style={{ padding: '14px 22px 14px 8px', fontWeight: 500 }}>Store</th>
              <th scope="col" style={{ padding: '14px 22px', fontWeight: 500 }}>Who sends</th>
              <th scope="col" style={{ padding: '14px 22px', fontWeight: 500, textAlign: 'right' }}>Average reply</th>
            </tr>
          </thead>
          <tbody>
            {shown.map(st => (
              <tr key={st.id} style={{ borderTop: hairline, background: picked.has(st.id) ? 'var(--color-review-light)' : undefined }}>
                <td style={{ padding: '0 0 0 14px' }}>
                  <label style={{ display: 'grid', placeItems: 'center', width: 44, height: 44, cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={picked.has(st.id)}
                      onChange={() => toggle(st.id)}
                      aria-label={`Select ${st.name}`}
                      style={{ width: 18, height: 18, margin: 0, accentColor: 'var(--color-text-primary)' }}
                    />
                  </label>
                </td>
                <th scope="row" style={{ ...cell, paddingLeft: 8, textAlign: 'left' }}>
                  <span style={{ display: 'block', fontWeight: 700 }}>{st.name}</span>
                  <span style={{ display: 'block', fontSize: 13, fontWeight: 400, color: 'var(--color-text-secondary)' }}>{st.manager}</span>
                </th>
                <td style={cell}>
                  <StyledSelect aria-label={`Who sends at ${st.name}`} width={280} height={44} value={whoAt(st.id)} onChange={e => onSet([st.id], e.target.value as WhoSends)}>
                    <option value="person">{WHO_SENDS_LABEL.person}</option>
                    <option value="edify-thanks">{WHO_SENDS_LABEL['edify-thanks']}</option>
                  </StyledSelect>
                </td>
                <td style={{ ...cell, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{st.avgReplyHours}h</td>
              </tr>
            ))}
            {shown.length === 0 && (
              <tr style={{ borderTop: hairline }}>
                <td colSpan={4} style={{ padding: '18px 22px', fontSize: 14 }}>
                  No store matches{needle ? ` “${q.trim()}”` : ''}.{' '}
                  <button type="button" onClick={() => { setQ(''); setShow('all'); resetPage(); }} style={{ ...quietBtn, padding: '0 4px' }}>Show all stores</button>
                </td>
              </tr>
            )}
          </tbody>
        </table>
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 8, padding: '4px 10px 4px 22px', borderTop: hairline, fontSize: 13 }}>
          <span role="status" aria-live="polite" style={{ color: 'var(--color-text-secondary)' }}>
            {note || (narrowed
              ? `Showing ${shown.length} of ${matches.length} matching, ${rows.length} in total`
              : shown.length < rows.length ? `Showing ${shown.length} of ${rows.length} stores` : `${rows.length} stores`)}
          </span>
          <span style={{ display: 'flex', gap: 4 }}>
            {shown.length < matches.length && (
              <>
                <button type="button" onClick={() => setLimit(l => l + PAGE)} style={quietBtn}>Show {Math.min(PAGE, matches.length - shown.length)} more</button>
                <button type="button" onClick={() => setLimit(matches.length)} style={quietBtn}>Show all {matches.length}</button>
              </>
            )}
            {shown.length > PAGE && shown.length >= matches.length && (
              <button type="button" onClick={resetPage} style={quietBtn}>Show fewer</button>
            )}
          </span>
        </div>
      </div>
    </div>
  );
}
