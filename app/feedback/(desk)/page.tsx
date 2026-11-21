'use client';

import Link from 'next/link';
import { useEffect, type CSSProperties, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowDownRight, ArrowRight, ArrowUpRight, Heart, ShieldAlert, Star } from 'lucide-react';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { ageLabel, fmtDay, fmtTime, LAST_WEEK, STORES, storeById, TEAM_NAMES } from '@/components/Feedback/bronxData';
import { canDraft, isSafety, rippleStatusText, useFeedback, weekSummary, type LiveRipple, type LiveTicket } from '@/components/Feedback/feedbackState';
import { FLAG_LABEL, FLAG_NEVER, SOURCE_LABEL, type StoreId } from '@/components/Feedback/model';
import {
  CauseChip, DoneChip, eyebrow, hairline, OutlineChip, primaryBtn, quote, ReplyLink, secondaryBtn, TicketRow, whiteCard,
} from '@/components/Feedback/ui';

const SHOWN = 4;

/** The district manager's page: what explains the week, then who is still waiting. */
export default function DistrictFeedbackPage() {
  const router = useRouter();
  const isPhone = useMediaQuery('(max-width: 640px)');
  const narrow = useMediaQuery('(max-width: 900px)');
  const { tickets, ripples, setRipple } = useFeedback();
  const s = weekSummary(tickets, ripples);
  const safety = tickets.filter(t => isSafety(t) && t.status !== 'resolved' && !t.reply);
  const list = s.waiting.filter(t => !isSafety(t));
  const drafted = s.waiting.filter(canDraft).length;
  const biggest = ripples.find(r => r.kind !== 'praise' && r.status !== 'closed');
  const others = ripples.filter(r => r.kind !== 'praise' && r.id !== biggest?.id);
  const praise = ripples.filter(r => r.kind === 'praise');

  useEffect(() => {
    if (isPhone) router.replace('/feedback/today');
  }, [isPhone, router]);

  return (
    <div style={{ maxWidth: 1120, margin: '0 auto', padding: narrow ? '24px 20px 56px' : '32px 40px 64px', display: 'flex', flexDirection: 'column', gap: 40 }}>
      <section aria-labelledby="week-h" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        <div>
          <p style={eyebrow}>This week · Nov 16 to 20</p>
          <h1 id="week-h" style={{ margin: '10px 0 0', fontSize: narrow ? 26 : 32, lineHeight: 1.12, fontWeight: 700, color: 'var(--color-text-primary)', maxWidth: 720 }}>
            {s.headline}
          </h1>
          <p style={{ margin: '12px 0 0', fontSize: 15, lineHeight: 1.55, maxWidth: 640 }}>{s.sub}</p>
        </div>
        <WeekNumbers tickets={tickets} low={s.low.length} waiting={s.waiting} narrow={narrow} />
      </section>

      {safety.map(t => <SafetyBanner key={t.id} t={t} />)}

      <section aria-label="What guests are saying" style={{ display: 'grid', gridTemplateColumns: narrow ? '1fr' : 'minmax(0, 3fr) minmax(0, 2fr)', gap: 20, alignItems: 'stretch' }}>
        <GoingWrong ripples={ripples.filter(r => r.kind !== 'praise')} low={s.low} />
        <GoingWell tickets={tickets} praise={praise} onTell={id => setRipple(id, { told: true })} />
      </section>

      <section aria-labelledby="ripples-h">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 16, flexWrap: 'wrap', marginBottom: 12 }}>
          <h2 id="ripples-h" style={sectionH}>The ripples in detail</h2>
          <p style={{ margin: 0, fontSize: 13, color: 'var(--color-text-secondary)' }}>Tickets with the same cause. Fix the cause and they close together.</p>
        </div>
        {biggest && <LeadRipple r={biggest} tickets={tickets} narrow={narrow} />}
        {others.length > 0 && (
          <>
            <h3 style={subLabel}>Also this week</h3>
            <div style={{ ...whiteCard, overflow: 'hidden' }}>
              <ul style={{ margin: '-1px 0 0', padding: 0, listStyle: 'none' }}>
                {others.map(r => <CompactRipple key={r.id} r={r} tickets={tickets} narrow={narrow} />)}
              </ul>
            </div>
          </>
        )}
      </section>

      <section aria-labelledby="waiting-h">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 16, flexWrap: 'wrap', marginBottom: 12 }}>
          <h2 id="waiting-h" style={sectionH}>Waiting on a reply</h2>
          <p style={{ margin: 0, fontSize: 13, color: 'var(--color-text-secondary)' }}>
            {drafted === s.waiting.length
              ? 'Oldest first. Every one has a draft ready.'
              : `Oldest first. Edify drafted ${drafted}. The other ${s.waiting.length - drafted} are yours to write.`}
          </p>
        </div>
        <div style={{ ...whiteCard, overflow: 'hidden' }}>
          {list.length === 0 ? (
            <p style={{ margin: 0, padding: 18, fontSize: 14 }}>Nobody is waiting on a reply.</p>
          ) : (
            <ul style={{ margin: 0, padding: 0, listStyle: 'none', marginTop: -1 }}>
              {list.slice(0, SHOWN).map(t => (
                <TicketRow key={t.id} t={t} action={<ReplyLink t={t} label={canDraft(t) ? 'Reply' : 'Write reply'} />} />
              ))}
            </ul>
          )}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap', padding: '12px 18px', borderTop: hairline, fontSize: 13 }}>
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

function SafetyBanner({ t }: { t: LiveTicket }) {
  return (
    <section
      aria-label={FLAG_LABEL[t.flag!]}
      style={{
        ...whiteCard, border: '2px solid var(--color-warning-border)', padding: '18px 20px', display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap',
      }}
    >
      <span aria-hidden style={{ width: 44, height: 44, borderRadius: 12, background: 'var(--color-warning-light)', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
        <ShieldAlert size={22} color="var(--color-text-primary)" />
      </span>
      <div style={{ flex: '1 1 380px', minWidth: 0 }}>
        <p style={{ margin: 0, fontSize: 14, fontWeight: 700 }}>
          {FLAG_LABEL[t.flag!]} at {t.store.name}, {fmtDay(t.at).split(',')[0]} {fmtTime(t.at)}
        </p>
        <p style={{ ...quote, margin: '4px 0 0', fontSize: 14, lineHeight: 1.45 }}>“{t.words}”</p>
        <p style={{ margin: '4px 0 0', fontSize: 13.5, lineHeight: 1.5 }}>
          {t.guest} · {SOURCE_LABEL[t.source]}. This one is yours. Edify doesn&apos;t draft replies to {FLAG_NEVER[t.flag!]}.
        </p>
      </div>
      <Link href={`/feedback/tickets/${t.id}`} style={primaryBtn}>Open ticket</Link>
    </section>
  );
}

const sectionH: CSSProperties = { margin: 0, fontSize: 18, fontWeight: 700 };
const subLabel: CSSProperties = {
  margin: '28px 0 0', paddingBottom: 10, fontSize: 12, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--color-text-secondary)',
};
const muted: CSSProperties = { color: 'var(--color-text-secondary)' };
const srOnly: CSSProperties = { position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)' };

/** The compact label beside a ripple's number. */
const SHORT_LABEL: Partial<Record<LiveRipple['kind'], string>> = {
  'late-delivery': 'open tickets',
  price: 'guests mentioned it',
  'check-skipped': 'orders missing an item',
  praise: 'guests named her',
};

function Detail({ r }: { r: LiveRipple }) {
  return (
    <>
      {r.detail.struck && (
        <>
          <span style={srOnly}>Changed from </span>
          <s style={{ color: 'var(--color-text-primary)', textDecorationColor: 'var(--color-accent-pink)', textDecorationThickness: 2 }}>{r.detail.struck}</s>
        </>
      )}
      {r.detail.text}
    </>
  );
}

function Status({ r }: { r: LiveRipple }) {
  return r.status === 'with' && r.done ? <DoneChip>{r.done}</DoneChip> : <OutlineChip>{rippleStatusText(r)}</OutlineChip>;
}

/** The ripple behind the headline: the most room, both quotes, the only primary button. */
function LeadRipple({ r, tickets, narrow }: { r: LiveRipple; tickets: LiveTicket[]; narrow: boolean }) {
  const quotes = r.quoteIds.map(id => tickets.find(t => t.id === id)!).filter(Boolean);
  const moreSaid = r.tickets.filter(t => t.words).length - quotes.length;
  const stores = new Set(r.open.map(t => t.storeId)).size;
  return (
    <article
      id={r.id}
      aria-labelledby={`${r.id}-h`}
      style={{ scrollMarginTop: 16, display: 'grid', gridTemplateColumns: narrow ? 'minmax(0, 1fr) 190px' : 'minmax(0, 1fr) 220px', gap: narrow ? 24 : 40, ...whiteCard, padding: narrow ? '22px 22px 26px' : '26px 28px 30px' }}
    >
      <div style={{ minWidth: 0 }}>
        <CauseChip marker="pink">{r.chip}</CauseChip>
        <h3 id={`${r.id}-h`} style={{ margin: '10px 0 6px', fontSize: 24, lineHeight: 1.2, fontWeight: 700 }}>{r.title}</h3>
        <p style={{ margin: 0, fontSize: 14, lineHeight: 1.5, ...muted }}><Detail r={r} /></p>
        <div style={{ display: 'grid', gridTemplateColumns: narrow ? '1fr' : '1fr 1fr', gap: '14px 28px', marginTop: 20 }}>
          {quotes.map(q => (
            <figure key={q.id} style={{ margin: 0 }}>
              <blockquote style={{ ...quote, margin: 0, fontSize: 16, lineHeight: 1.45 }}>“{q.words}”</blockquote>
              <figcaption style={{ fontSize: 12, marginTop: 4, ...muted }}>
                {q.guest} · {SOURCE_LABEL[q.source]} · {q.stars} {q.stars === 1 ? 'star' : 'stars'}{r.storeIds.length > 1 && ` · ${q.store.name}`}
              </figcaption>
            </figure>
          ))}
        </div>
        {moreSaid > 0 && (
          <Link href={`/feedback/ripples/${r.id}`} style={{ display: 'inline-block', marginTop: 12, fontSize: 13, fontWeight: 700, color: 'var(--color-text-primary)' }}>
            +{moreSaid} more said the same
          </Link>
        )}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 10 }}>
        <span style={{ fontSize: 56, fontWeight: 700, lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>{r.number}</span>
        <span style={{ fontSize: 13, lineHeight: 1.45 }}>
          {r.numberLabel(stores)}
          {r.numberKind === 'open' && r.support && <span style={{ display: 'block', marginTop: 4, ...muted }}>{r.support}</span>}
        </span>
        <Status r={r} />
        <Link href={`/feedback/ripples/${r.id}`} style={{ ...primaryBtn, marginTop: 4 }}>
          Open ripple <ArrowRight size={16} aria-hidden />
        </Link>
      </div>
    </article>
  );
}

/** The other causes: one line of cause, one guest, the count and the status. */
function CompactRipple({ r, tickets, narrow }: { r: LiveRipple; tickets: LiveTicket[]; narrow: boolean }) {
  const q = tickets.find(t => t.id === r.quoteIds[0]);
  return (
    <li id={r.id} style={{
      scrollMarginTop: 16, display: 'grid', gridTemplateColumns: narrow ? 'auto minmax(0, 1fr)' : 'minmax(0, 1fr) 190px 300px', gap: narrow ? '12px 16px' : 24,
      alignItems: 'center', padding: '16px 20px', borderTop: hairline,
    }}>
      <div style={{ minWidth: 0, gridColumn: narrow ? '1 / -1' : undefined }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '6px 10px' }}>
          <h4 style={{ margin: 0, fontSize: 16, fontWeight: 700, lineHeight: 1.3 }}>{r.title}</h4>
          <CauseChip>{r.chip}</CauseChip>
        </div>
        <p style={{ margin: '4px 0 0', fontSize: 13, lineHeight: 1.45, ...muted }}><Detail r={r} /></p>
        {q?.words && (
          <p style={{ margin: '6px 0 0', fontSize: 13, lineHeight: 1.45 }}>
            <span style={{ ...quote, fontSize: 14 }}>“{q.words}”</span>
            <span style={muted}> {q.guest}</span>
          </p>
        )}
      </div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
        <span style={{ fontSize: 28, fontWeight: 700, lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>{r.number}</span>
        <span style={{ fontSize: 12, lineHeight: 1.3, ...muted, whiteSpace: 'nowrap' }}>{SHORT_LABEL[r.kind] ?? 'guests'}</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 10, flexWrap: 'wrap' }}>
        <Status r={r} />
        <Link href={`/feedback/ripples/${r.id}`} aria-label={`Open ripple: ${r.title}`} style={{ ...secondaryBtn, padding: '0 14px', border: '1.5px solid var(--color-border)' }}>Open</Link>
      </div>
    </li>
  );
}

const pct = (n: number, of: number) => Math.round((n / Math.max(1, of)) * 100);

function versus(now: number, then: number, fmt: (n: number) => string = String) {
  if (now === then) return 'same as last week';
  return `${now < then ? 'down' : 'up'} from ${fmt(then)} last week`;
}

/** The week in four numbers: how guests rated you, the split, and who is still waiting. */
function WeekNumbers({ tickets, low, waiting, narrow }: { tickets: LiveTicket[]; low: number; waiting: LiveTicket[]; narrow: boolean }) {
  const total = tickets.length;
  const avg = Math.round((tickets.reduce((a, t) => a + t.stars, 0) / Math.max(1, total)) * 10) / 10;
  const positive = tickets.filter(t => t.stars >= 4).length;
  const oldest = waiting[0];
  const cells: { label: string; value: ReactNode; note: ReactNode }[] = [
    {
      label: 'Average rating',
      value: <>{avg.toFixed(1)}<Star size={20} aria-label="stars" fill="currentColor" /></>,
      note: <>{avg < LAST_WEEK.avgStars ? <ArrowDownRight size={14} aria-hidden /> : avg > LAST_WEEK.avgStars ? <ArrowUpRight size={14} aria-hidden /> : null}{capitalise(versus(avg, LAST_WEEK.avgStars, n => n.toFixed(1)))}</>,
    },
    { label: 'Positive', value: positive, note: `4 and 5 stars, ${pct(positive, total)}% of ${total}` },
    { label: 'Low ratings', value: low, note: `1 to 3 stars, ${versus(low, LAST_WEEK.low)}` },
    { label: 'Waiting on a reply', value: waiting.length, note: oldest ? `Oldest ${ageLabel(oldest.at)}, ${oldest.store.name}` : 'Nobody is waiting' },
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

const capitalise = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** Every low rating, by cause: the ripples ranked by size, then what Edify couldn't link to a cause. */
function GoingWrong({ ripples, low }: { ripples: LiveRipple[]; low: LiveTicket[] }) {
  const rows = ripples
    .map(r => ({ r, n: low.filter(t => t.rippleId === r.id).length }))
    .filter(x => x.n > 0)
    .sort((a, b) => b.n - a.n);
  const linked = rows.reduce((a, x) => a + x.n, 0);
  const none = low.length - linked;
  const max = Math.max(1, none, ...rows.map(x => x.n));
  return (
    <section aria-labelledby="wrong-h" style={{ ...whiteCard, padding: '18px 22px 8px', display: 'flex', flexDirection: 'column', gap: 6 }}>
      <h2 id="wrong-h" style={sectionH}>What&apos;s going wrong</h2>
      <p style={{ margin: 0, fontSize: 13, lineHeight: 1.5, ...muted }}>
        {low.length} low ratings. {linked} trace back to {rows.length} {rows.length === 1 ? 'ripple' : 'ripples'}, causes Edify found in your stores&apos; data.
      </p>
      <ul style={{ margin: '6px 0 0', padding: 0, listStyle: 'none' }}>
        {rows.map(({ r, n }, i) => (
          <li key={r.id} style={{ borderTop: hairline }}>
            <a href={`#${r.id}`} style={causeRow}>
              <span style={{ minWidth: 0 }}>
                <span style={{ display: 'block', fontSize: 14, fontWeight: 600 }}>{r.title}</span>
                <span style={{ display: 'block', fontSize: 12.5, ...muted }}>{r.status === 'with' && r.done ? r.done : rippleStatusText(r)}</span>
              </span>
              <Bar share={n / max} tone={i === 0 ? 'var(--color-accent-pink)' : 'var(--color-text-primary)'} />
              <span style={countCell}>{n}</span>
            </a>
          </li>
        ))}
        {none > 0 && (
          <li style={{ borderTop: hairline }}>
            <Link href="/feedback/tickets" style={causeRow}>
              <span style={{ minWidth: 0 }}>
                <span style={{ display: 'block', fontSize: 14, fontWeight: 600 }}>No pattern</span>
                <span style={{ display: 'block', fontSize: 12.5, ...muted }}>One-offs, nothing in the data links them</span>
              </span>
              <Bar share={none / max} tone="var(--color-border)" />
              <span style={countCell}>{none}</span>
            </Link>
          </li>
        )}
      </ul>
    </section>
  );
}

const causeRow: CSSProperties = {
  display: 'grid', gridTemplateColumns: 'minmax(0, 1.4fr) minmax(60px, 1fr) 28px', alignItems: 'center', gap: 16,
  minHeight: 44, padding: '10px 0', color: 'var(--color-text-primary)', textDecoration: 'none',
};
const countCell: CSSProperties = { fontSize: 15, fontWeight: 700, textAlign: 'right', fontVariantNumeric: 'tabular-nums' };

function Bar({ share, tone }: { share: number; tone: string }) {
  return (
    <span aria-hidden style={{ display: 'block', height: 8, borderRadius: 999, background: 'var(--color-bg-hover, #F2F0ED)' }}>
      <span style={{ display: 'block', height: '100%', width: `${Math.max(4, share * 100)}%`, borderRadius: 999, background: tone }} />
    </span>
  );
}

/** Praise that names someone, so the district manager can pass it on. */
function GoingWell({ tickets, praise, onTell }: { tickets: LiveTicket[]; praise: LiveRipple[]; onTell: (rippleId: string) => void }) {
  const positive = tickets.filter(t => t.stars >= 4);
  const fiveStar = tickets.filter(t => t.stars === 5).length;
  const named = (Object.entries(TEAM_NAMES) as [StoreId, string[]][])
    .flatMap(([storeId, names]) => names.map(name => {
      const said = positive.filter(t => t.storeId === storeId && t.words?.includes(name));
      return { name, store: storeById(storeId), said, ripple: praise.find(r => r.title.includes(name)) };
    }))
    .filter(x => x.said.length > 0)
    .sort((a, b) => b.said.length - a.said.length);
  const byStore = STORES.map(st => {
    const own = tickets.filter(t => t.storeId === st.id);
    return { st, avg: own.reduce((a, t) => a + t.stars, 0) / Math.max(1, own.length) };
  }).sort((a, b) => b.avg - a.avg);
  return (
    <section aria-labelledby="well-h" style={{ ...whiteCard, padding: '18px 22px 16px', display: 'flex', flexDirection: 'column', gap: 6 }}>
      <h2 id="well-h" style={sectionH}>What&apos;s going well</h2>
      <p style={{ margin: 0, fontSize: 13, lineHeight: 1.5, ...muted }}>
        {positive.length} positive ratings, {fiveStar} of them five stars. Highest rated: {byStore[0].st.name}, {byStore[0].avg.toFixed(1)} stars.
      </p>
      <ul style={{ margin: '6px 0 0', padding: 0, listStyle: 'none' }}>
        {named.map(({ name, store, said, ripple }) => {
          const q = ripple ? tickets.find(t => t.id === ripple.quoteIds[0]) : said[0];
          return (
            <li key={name} style={{ borderTop: hairline, padding: '12px 0', display: 'flex', flexDirection: 'column', gap: 6 }}>
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
              {q?.words && <p style={{ ...quote, margin: 0, fontSize: 14, lineHeight: 1.45 }}>&ldquo;{q.words}&rdquo;</p>}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
