'use client';

import Link from 'next/link';
import { useEffect, type CSSProperties, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowDownRight, ArrowRight, ArrowUpRight, Heart, ShieldAlert } from 'lucide-react';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { ageLabel, fmtDay, fmtTime, LAST_WEEK, STORES, storeById, TEAM_NAMES } from '@/components/Feedback/dunkinData';
import { canDraft, useFeedback, weekSummary, type LiveRipple, type LiveTicket } from '@/components/Feedback/feedbackState';
import { FLAG_LABEL, type Reason, type StoreId } from '@/components/Feedback/model';
import {
  CauseChip, DoneChip, eyebrow, hairline, primaryBtn, quote, ReplyLink, secondaryBtn, sourceLine, spoken, TicketRow, whiteCard,
} from '@/components/Feedback/ui';

const SHOWN = 4;

/** The district manager's page: what explains the week, then who is still waiting. */
export default function DistrictFeedbackPage() {
  const router = useRouter();
  const isPhone = useMediaQuery('(max-width: 640px)');
  const narrow = useMediaQuery('(max-width: 900px)');
  const { tickets, ripples, setRipple } = useFeedback();
  const s = weekSummary(tickets, ripples);
  const yours = s.waiting.filter(t => !canDraft(t));
  const list = s.waiting.filter(canDraft);
  const problems = ripples.filter(r => r.kind !== 'praise' && r.tickets.length > 0);
  const praise = ripples.filter(r => r.kind === 'praise');

  useEffect(() => {
    if (isPhone) router.replace('/feedback/today');
  }, [isPhone, router]);

  return (
    <div style={{ maxWidth: 1120, margin: '0 auto', padding: narrow ? '28px 20px 64px' : '40px 40px 80px', display: 'flex', flexDirection: 'column', gap: 56 }}>
      <section aria-labelledby="week-h" style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
        <div>
          <p style={eyebrow}>This week · Nov 15 to 21</p>
          <h1 id="week-h" style={{ margin: '10px 0 0', fontSize: narrow ? 26 : 32, lineHeight: 1.12, fontWeight: 700, color: 'var(--color-text-primary)', maxWidth: 720 }}>
            {s.headline}
          </h1>
          <p style={{ margin: '12px 0 0', fontSize: 15, lineHeight: 1.55, maxWidth: 640 }}>{s.sub}</p>
        </div>
        <WeekNumbers tickets={tickets} complaints={s.complaints.length} compliments={s.compliments.length} waiting={s.waiting} narrow={narrow} />
      </section>

      {yours.length > 0 && <YoursToHandle tickets={yours} narrow={narrow} />}

      <section aria-label="What guests are saying" style={{ display: 'grid', gridTemplateColumns: narrow ? '1fr' : 'minmax(0, 3fr) minmax(0, 2fr)', gap: 24, alignItems: 'stretch' }}>
        <GoingWrong complaints={s.complaints} />
        <GoingWell tickets={tickets} praise={praise} onTell={id => setRipple(id, { told: true })} />
      </section>

      {problems.length > 0 && (
        <section aria-labelledby="ripples-h">
          <SectionHead id="ripples-h" title="Ripples" sub="Guests saying the same thing, with the likely cause from your stores' data." />
          <div style={{ display: 'grid', gridTemplateColumns: narrow ? '1fr' : 'repeat(auto-fit, minmax(320px, 1fr))', gap: 24 }}>
            {problems.map(r => <RippleCard key={r.id} r={r} tickets={tickets} />)}
          </div>
        </section>
      )}

      <section aria-labelledby="waiting-h">
        <SectionHead id="waiting-h" title="Waiting on a reply" sub="Oldest first. Every one has a draft ready." />
        <div style={{ ...whiteCard, overflow: 'hidden' }}>
          {list.length === 0 ? (
            <p style={{ margin: 0, padding: 22, fontSize: 14 }}>Nobody is waiting on a reply.</p>
          ) : (
            <ul style={{ margin: 0, padding: 0, listStyle: 'none', marginTop: -1 }}>
              {list.slice(0, SHOWN).map(t => <TicketRow key={t.id} t={t} hideStatus action={<ReplyLink t={t} />} />)}
            </ul>
          )}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap', padding: '12px 22px', borderTop: hairline, fontSize: 13, background: 'var(--color-bg-hover)' }}>
            <span style={{ color: 'var(--color-text-secondary)' }}>
              {list.length > SHOWN && `${list.length - SHOWN} more waiting · `}
              {s.repliedOpen.length} replied, still open · {s.resolved.length} resolved this week
            </span>
            <Link href="/feedback/tickets" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, minHeight: 44, fontWeight: 700, color: 'var(--color-text-primary)' }}>
              All tickets <ArrowRight size={14} aria-hidden />
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}

/** Food safety and refunds: never drafted, so they sit together in one list for the district manager. */
function YoursToHandle({ tickets, narrow }: { tickets: LiveTicket[]; narrow: boolean }) {
  return (
    <section aria-labelledby="yours-h" style={{ ...whiteCard, border: '2px solid var(--color-warning-border)', overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '22px 24px', background: 'var(--color-warning-light)' }}>
        <span aria-hidden style={{ width: 44, height: 44, borderRadius: 12, background: '#ffffff', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
          <ShieldAlert size={22} color="var(--color-text-primary)" />
        </span>
        <div>
          <h2 id="yours-h" style={sectionH}>Reply in person</h2>
          <p style={{ margin: '4px 0 0', fontSize: 14, lineHeight: 1.5 }}>
            {tickets.length} food safety {tickets.length === 1 ? 'report or refund request' : 'reports and refund requests'}. Edify doesn&apos;t draft these, so the reply comes from you.
          </p>
        </div>
      </div>
      <ul style={{ margin: 0, padding: 0, listStyle: 'none' }}>
        {tickets.map(t => (
          <li key={t.id} style={{
            display: 'grid', gridTemplateColumns: narrow ? 'minmax(0, 1fr)' : 'minmax(0, 1fr) auto', gap: narrow ? 14 : 28, alignItems: 'center',
            padding: '22px 24px', borderTop: hairline,
          }}>
            <div style={{ minWidth: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
              <p style={{ margin: 0, display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '6px 10px', fontSize: 14 }}>
                <span style={flagTag}>{FLAG_LABEL[t.flag!]}</span>
                <strong>{t.store.name}</strong>
                <span style={muted}>{fmtDay(t.at)}, {fmtTime(t.at)}</span>
              </p>
              <p style={{ ...quote, ...spoken, margin: 0, fontSize: 15, lineHeight: 1.5 }}>“{t.words}”</p>
              <p style={{ margin: 0, fontSize: 13, lineHeight: 1.5, ...muted }}>
                {t.guest} · {t.reason} · {sourceLine(t)}
              </p>
            </div>
            <div style={{ display: 'flex', flexDirection: narrow ? 'row' : 'column', alignItems: narrow ? 'center' : 'flex-end', gap: 8 }}>
              <span style={{ fontSize: 13, fontWeight: 700 }}>Waiting {ageLabel(t.at)}</span>
              <Link href={`/feedback/tickets/${t.id}`} aria-label={`Open ticket from ${t.guest}`} style={primaryBtn}>Open ticket</Link>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

const sectionH: CSSProperties = { margin: 0, fontSize: 20, lineHeight: 1.3, fontWeight: 700 };
const muted: CSSProperties = { color: 'var(--color-text-secondary)' };
const flagTag: CSSProperties = {
  display: 'inline-flex', alignItems: 'center', padding: '3px 10px', borderRadius: 999, fontSize: 12, fontWeight: 700,
  background: 'var(--color-warning-light)', border: '1px solid var(--color-warning-border)', whiteSpace: 'nowrap',
};

function SectionHead({ id, title, sub }: { id: string; title: string; sub: string }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <h2 id={id} style={sectionH}>{title}</h2>
      <p style={{ margin: '4px 0 0', fontSize: 14, lineHeight: 1.5, ...muted }}>{sub}</p>
    </div>
  );
}

/** Summary line, title, cause, quotes and button: shared rows so every card in a row lines up. */
const RIPPLE_CARD_ROWS = 5;

const storesLabel = (ids: StoreId[]) => (ids.length === 1 ? storeById(ids[0]).name : `${ids.length} stores`);

/** One ripple: what guests said, the likely cause, two guests in their own words, and one action. */
function RippleCard({ r, tickets }: { r: LiveRipple; tickets: LiveTicket[] }) {
  const quotes = r.quoteIds.map(id => tickets.find(t => t.id === id)).filter((t): t is LiveTicket => !!t?.words).slice(0, 2);
  const stores = [...new Set(r.tickets.map(t => t.storeId))];
  return (
    <article id={r.id} aria-labelledby={`${r.id}-h`} style={{
      ...whiteCard, scrollMarginTop: 16, padding: '24px 26px 26px',
      display: 'grid', gridTemplateRows: 'subgrid', gridRow: `span ${RIPPLE_CARD_ROWS}`, rowGap: 0,
    }}>
      <p style={{ margin: 0, fontSize: 13, ...muted }}>
        {r.reason} · {r.tickets.length} {r.tickets.length === 1 ? 'complaint' : 'complaints'} · {storesLabel(stores)}
      </p>
      <h3 id={`${r.id}-h`} style={{ margin: '6px 0 0', fontSize: 20, lineHeight: 1.3, fontWeight: 700 }}>{r.title}</h3>
      {r.cause ? (
        <div style={{ marginTop: 18, background: 'var(--color-bg-hover)', borderRadius: 12, padding: '14px 16px' }}>
          <CauseChip>Likely cause</CauseChip>
          <p style={{ margin: '10px 0 0', fontSize: 14.5, lineHeight: 1.55 }}>{r.cause.text}</p>
          <p style={{ margin: '4px 0 0', fontSize: 12.5, ...muted }}>From {r.cause.from}</p>
        </div>
      ) : <div />}
      <div style={{ marginTop: 18, display: 'flex', flexDirection: 'column', gap: 16 }}>
        <p style={{ margin: 0, fontSize: 12, fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase', ...muted }}>What guests said</p>
        {quotes.map(q => (
          <figure key={q.id} style={{ ...spoken, margin: 0 }}>
            <blockquote style={{ ...quote, margin: 0, fontSize: 15, lineHeight: 1.5 }}>“{q.words}”</blockquote>
            <figcaption style={{ fontSize: 12.5, marginTop: 6, ...muted }}>{q.guest} · {sourceLine(q)}</figcaption>
          </figure>
        ))}
      </div>
      <Link href={`/feedback/ripples/${r.id}`} aria-label={`Open ripple: ${r.title}`} style={{ ...primaryBtn, justifySelf: 'start', alignSelf: 'end', marginTop: 18 }}>
        Open ripple <ArrowRight size={16} aria-hidden />
      </Link>
    </article>
  );
}

function versus(now: number, then: number) {
  if (now === then) return 'Same as last week';
  return `${now < then ? 'Down' : 'Up'} from ${then} last week`;
}

const Trend = ({ now, then }: { now: number; then: number }) => (
  <>{now < then ? <ArrowDownRight size={14} aria-hidden /> : now > then ? <ArrowUpRight size={14} aria-hidden /> : null}{versus(now, then)}</>
);

/** The week in four numbers: complaints, who is still waiting, how fast stores reply, and compliments. */
function WeekNumbers({ tickets, complaints, compliments, waiting, narrow }: {
  tickets: LiveTicket[]; complaints: number; compliments: number; waiting: LiveTicket[]; narrow: boolean;
}) {
  const oldest = waiting[0];
  const sent = tickets.filter(t => t.sentBy === 'person' && t.sentAt !== undefined);
  const avgHours = Math.round(sent.reduce((a, t) => a + (t.sentAt! - t.at), 0) / Math.max(1, sent.length) / 60);
  const cells: { label: string; value: ReactNode; note: ReactNode }[] = [
    { label: 'Complaints', value: complaints, note: <Trend now={complaints} then={LAST_WEEK.complaints} /> },
    { label: 'Waiting on a reply', value: waiting.length, note: oldest ? `Oldest ${ageLabel(oldest.at)}, ${oldest.store.name}` : 'Nobody is waiting' },
    { label: 'Average reply time', value: `${avgHours}h`, note: `Across ${sent.length} replies sent by a person` },
    { label: 'Compliments', value: compliments, note: <Trend now={compliments} then={LAST_WEEK.compliments} /> },
  ];
  return (
    <dl style={{
      ...whiteCard, margin: 0, overflow: 'hidden', display: 'grid', gridTemplateColumns: narrow ? '1fr 1fr' : 'repeat(4, minmax(0, 1fr))',
      gap: 1, background: 'var(--color-border-subtle)',
    }}>
      {cells.map(c => (
        <div key={c.label} style={{ background: '#ffffff', padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 4 }}>
          <dt style={{ fontSize: 13, ...muted }}>{c.label}</dt>
          <dd style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 4, fontSize: 32, fontWeight: 700, lineHeight: 1.1, fontVariantNumeric: 'tabular-nums' }}>{c.value}</dd>
          <dd style={{ margin: 0, fontSize: 13, lineHeight: 1.45, display: 'flex', alignItems: 'center', gap: 4, ...muted }}>{c.note}</dd>
        </div>
      ))}
    </dl>
  );
}

/** Every complaint, by the reason Dunkin files it under, biggest first. */
function GoingWrong({ complaints }: { complaints: LiveTicket[] }) {
  const counts = new Map<Reason, number>();
  for (const t of complaints) counts.set(t.reason, (counts.get(t.reason) ?? 0) + 1);
  const rows = [...counts.entries()].sort((a, b) => b[1] - a[1]);
  const max = Math.max(1, ...rows.map(([, n]) => n));
  const linked = complaints.filter(t => t.rippleId).length;
  return (
    <section aria-labelledby="wrong-h" style={{ ...whiteCard, padding: '24px 26px 12px', display: 'flex', flexDirection: 'column', gap: 6 }}>
      <h2 id="wrong-h" style={sectionH}>What&apos;s going wrong</h2>
      <p style={{ margin: 0, fontSize: 13, lineHeight: 1.5, ...muted }}>
        {complaints.length} complaints by reason. {linked} belong to a ripple.
      </p>
      <ul style={{ margin: '6px 0 0', padding: 0, listStyle: 'none' }}>
        {rows.map(([reason, n]) => (
          <li key={reason} style={{ borderTop: hairline }}>
            <Link href={`/feedback/tickets?reason=${encodeURIComponent(reason)}`} aria-label={`${reason}: ${n} complaints`} style={causeRow}>
              <span style={{ fontSize: 14, fontWeight: 600, minWidth: 0 }}>{reason}</span>
              <Bar share={n / max} />
              <span style={countCell}>{n}</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

const causeRow: CSSProperties = {
  display: 'grid', gridTemplateColumns: 'minmax(0, 1.4fr) minmax(60px, 1fr) 28px', alignItems: 'center', gap: 16,
  minHeight: 44, padding: '6px 0', color: 'var(--color-text-primary)', textDecoration: 'none',
};
const countCell: CSSProperties = { fontSize: 15, fontWeight: 700, textAlign: 'right', fontVariantNumeric: 'tabular-nums' };

function Bar({ share }: { share: number }) {
  return (
    <span aria-hidden style={{ display: 'block', height: 8, borderRadius: 999, background: 'var(--color-bg-hover, #F2F0ED)' }}>
      <span style={{ display: 'block', height: '100%', width: `${Math.max(4, share * 100)}%`, borderRadius: 999, background: 'var(--color-text-primary)' }} />
    </span>
  );
}

/** Compliments, and the team members guests name, so the district manager can pass it on. */
function GoingWell({ tickets, praise, onTell }: { tickets: LiveTicket[]; praise: LiveRipple[]; onTell: (rippleId: string) => void }) {
  const compliments = tickets.filter(t => t.reason === 'Compliment');
  const withWords = compliments.filter(t => t.words).length;
  const named = (Object.entries(TEAM_NAMES) as [StoreId, string[]][])
    .flatMap(([storeId, names]) => names.map(name => {
      const said = compliments.filter(t => t.storeId === storeId && t.words?.includes(name));
      return { name, store: storeById(storeId), said, ripple: praise.find(r => r.title.includes(name)) };
    }))
    .filter(x => x.said.length > 0)
    .sort((a, b) => b.said.length - a.said.length);
  const top = STORES
    .map(st => ({ st, n: compliments.filter(t => t.storeId === st.id).length }))
    .sort((a, b) => b.n - a.n)[0];
  return (
    <section aria-labelledby="well-h" style={{ ...whiteCard, padding: '24px 26px 16px', display: 'flex', flexDirection: 'column', gap: 6 }}>
      <h2 id="well-h" style={sectionH}>What&apos;s going well</h2>
      <p style={{ margin: 0, fontSize: 13, lineHeight: 1.5, ...muted }}>
        {compliments.length} compliments, {withWords} with a comment. Most for {top.st.name}, with {top.n}.
      </p>
      <ul style={{ margin: '6px 0 0', padding: 0, listStyle: 'none' }}>
        {named.map(({ name, store, said, ripple }) => {
          const q = ripple ? tickets.find(t => t.id === ripple.quoteIds[0]) : said[0];
          return (
            <li key={name} style={{ borderTop: hairline, padding: '16px 0', display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) auto', alignItems: 'center', gap: 12 }}>
                <span style={{ display: 'flex', alignItems: 'flex-start', gap: 8, minWidth: 0 }}>
                  <Heart size={15} aria-hidden style={{ flexShrink: 0, marginTop: 3 }} />
                  <span>
                    <span style={{ display: 'block', fontSize: 14, fontWeight: 600 }}>{name}, {store.name}</span>
                    <span style={{ display: 'block', fontSize: 12.5, ...muted }}>{said.length} guests named {name}</span>
                  </span>
                </span>
                {ripple?.action && (ripple.told
                  ? <DoneChip>{ripple.action.done}</DoneChip>
                  : <button type="button" onClick={() => onTell(ripple.id)} style={{ ...secondaryBtn, padding: '0 14px', border: '1.5px solid var(--color-border)' }}>{ripple.action.label}</button>)}
              </div>
              {q?.words && <p style={{ ...quote, ...spoken, margin: '4px 0 0 23px', fontSize: 14.5, lineHeight: 1.5 }}>&ldquo;{q.words}&rdquo;</p>}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
