'use client';

import Link from 'next/link';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useId, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { ArrowLeft, ArrowRight, Clock, Mic, Send, Square } from 'lucide-react';
import EdifyMark from '@/components/EdifyMark/EdifyMark';
import DeliveryChart from '@/components/Feedback/DeliveryChart';
import { ageLabel, fmtDay, fmtTime } from '@/components/Feedback/bronxData';
import {
  firstName, isHeldForFix, isThankYou, needsReply, ticketById, useFeedback, type LiveRipple, type LiveTicket,
} from '@/components/Feedback/feedbackState';
import {
  FLAG_LABEL, FLAG_NEVER, IN_STORE_FIX_LABEL, SOURCE_LABEL, SOURCE_REPLY_NOTE, type InStoreFix, type RippleKind,
} from '@/components/Feedback/model';
import { ContextList, Stars, StatusTag, hairline, primaryBtn, quote, secondaryBtn, whiteCard } from '@/components/Feedback/ui';
import { useReplyDraft, useVoiceLine } from '@/components/Feedback/useReplyDraft';

const KIND_NOUN: Partial<Record<RippleKind, string>> = {
  'late-delivery': 'late-delivery',
  price: 'price',
  'check-skipped': 'missing-item',
};

const sectionLabel: CSSProperties = {
  margin: 0, fontSize: 12.5, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--color-text-primary)',
};
const heading: CSSProperties = { margin: 0, fontSize: 19, fontWeight: 700 };
const asideLabel: CSSProperties = { ...sectionLabel, fontSize: 11.5, color: 'var(--color-text-secondary)' };
const muted: CSSProperties = { margin: 0, fontSize: 13.5, lineHeight: 1.5, color: 'var(--color-text-secondary)' };
const srOnly: CSSProperties = { position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)' };

type Feedback = ReturnType<typeof useFeedback>;

function sentLine(x: LiveTicket) {
  const who = firstName(x.guest);
  if (x.resolveChoice === 'ripple') return `Reply sent to ${who}. It stays open with the ${(x.ripple && KIND_NOUN[x.ripple.kind]) ?? 'same-cause'} ripple.`;
  if (x.resolveChoice === 'in-store') return `Reply sent to ${who}. Resolved as fixed in store: ${IN_STORE_FIX_LABEL[x.fix!].toLowerCase()}.`;
  return `Reply sent to ${who}. Ticket resolved.`;
}

export default function TicketPage() {
  const { id } = useParams<{ id: string }>();
  const fb = useFeedback();
  const t = ticketById(fb.tickets, id);

  if (!t) {
    return (
      <div style={{ maxWidth: 720, margin: '0 auto', padding: '48px 24px' }}>
        <h1 style={{ fontSize: 20, margin: '0 0 12px' }}>No ticket {id}</h1>
        <p style={{ margin: '0 0 20px' }}>It isn&apos;t in the Bronx district this week.</p>
        <Link href="/feedback/tickets" style={secondaryBtn}>All tickets</Link>
      </div>
    );
  }
  return <TicketView key={t.id} t={t} fb={fb} />;
}

function TicketView({ t, fb }: { t: LiveTicket; fb: Feedback }) {
  const d = useReplyDraft(t, fb.settings);
  const ripple = t.ripple && t.ripple.kind !== 'praise' ? fb.ripples.find(r => r.id === t.rippleId) : undefined;
  const [announce, setAnnounce] = useState('');
  const first = firstName(t.guest);
  const composing = t.status === 'open' && !t.reply && (!!t.words || isThankYou(t));
  const noun = ripple ? KIND_NOUN[ripple.kind] ?? 'same-cause' : '';

  const resolve = (
    <Resolve
      t={t}
      ripple={ripple}
      d={d}
      composing={composing}
      onResolveNow={() => {
        if (d.choice === 'ripple') return;
        fb.resolveNow(t.id, d.choice, d.fix ?? undefined, d.fixNote.trim() || undefined);
        setAnnounce('Ticket resolved.');
      }}
    />
  );

  const router = useRouter();
  const from = useSearchParams().get('from');
  const prev = from && from !== t.id ? ticketById(fb.tickets, from) : undefined;
  const waiting = fb.tickets.filter(needsReply);
  const next = waiting.filter(x => x.id !== t.id).sort((a, b) => a.at - b.at)[0];
  const arrived = prev?.reply ? `${sentLine(prev)} Here's the oldest still waiting, ${waiting.length} to go.` : '';
  const banner = useRef<HTMLDivElement>(null);
  const hasArrived = !!arrived;
  useEffect(() => {
    if (hasArrived) banner.current?.focus();
  }, [hasArrived]);

  const send = () => {
    if (!d.canSend) return;
    const input = d.input();
    fb.sendReply(t.id, input);
    if (next) {
      router.push(`/feedback/tickets/${next.id}?from=${t.id}`);
      return;
    }
    setAnnounce(
      (input.choice === 'ripple'
        ? `Reply sent to ${first}. The ticket stays open with the ${noun} ripple until it's fixed.`
        : input.choice === 'in-store'
          ? `Reply sent to ${first}. Resolved as fixed in store: ${IN_STORE_FIX_LABEL[input.fix!].toLowerCase()}.`
          : `Reply sent to ${first}. Ticket resolved.`) + ' Nobody else is waiting on a reply.',
    );
  };

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto', padding: '28px clamp(20px, 4vw, 56px) 72px', display: 'flex', flexDirection: 'column', gap: 22 }}>
      <header style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '4px 24px' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0 16px' }}>
          <Link href="/feedback" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, minHeight: 44, fontSize: 14, fontWeight: 600, color: 'var(--color-text-primary)', textDecoration: 'none' }}>
            <ArrowLeft size={16} aria-hidden /> Bronx district
          </Link>
          <h1 style={{ margin: 0, fontSize: 14, fontWeight: 400, color: 'var(--color-text-secondary)' }}>
            Ticket {t.id} · {t.store.name}
          </h1>
        </div>
        {t.status === 'open' && !t.reply ? (
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 6, padding: '5px 12px', borderRadius: 999, fontSize: 13, fontWeight: 600,
            background: 'var(--color-warning-light)', border: '1px solid var(--color-warning-border)',
          }}>
            <Clock size={14} aria-hidden /> Open, waiting {ageLabel(t.at)}
          </span>
        ) : (
          <StatusTag status={t.status} />
        )}
      </header>

      <div ref={banner} tabIndex={-1} role="status" aria-live="polite" style={announce || arrived ? {
        display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '0 16px',
        padding: '4px 16px', minHeight: 48, borderRadius: 12, fontSize: 14, fontWeight: 600, outline: 'none',
        background: 'var(--color-review-light)', border: '1px solid var(--color-review-border)',
      } : srOnly}>
        <span style={{ padding: '8px 0' }}>{announce || arrived}</span>
        {!announce && arrived && prev && (
          <Link href={`/feedback/tickets/${prev.id}`} style={{ display: 'inline-flex', alignItems: 'center', minHeight: 44, fontSize: 13.5, fontWeight: 700, color: 'var(--color-text-primary)' }}>
            See {firstName(prev.guest)}&apos;s reply
          </Link>
        )}
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-start', gap: '40px 64px' }}>
        <div style={{ flex: '3 1 560px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 36 }}>
          <section aria-label="What the guest said" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <p style={{ margin: 0, fontSize: 14, color: 'var(--color-text-secondary)', display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 6 }}>
              <strong style={{ color: 'var(--color-text-primary)', fontWeight: 700 }}>{t.guest}</strong>
              <span aria-hidden>·</span>
              <Stars value={t.stars} />
              <span>{t.stars} {t.stars === 1 ? 'star' : 'stars'}</span>
              <span aria-hidden>·</span>
              <span>{SOURCE_LABEL[t.source]}</span>
              <span aria-hidden>·</span>
              <span>{fmtDay(t.at)}, {fmtTime(t.at)}</span>
            </p>
            {t.words ? (
              <blockquote style={{ ...quote, margin: 0, fontSize: 'clamp(22px, 2.4vw, 28px)', lineHeight: 1.35, textWrap: 'balance' }}>
                &ldquo;{t.words}&rdquo;
              </blockquote>
            ) : (
              <p style={{ margin: 0, fontSize: 19, fontWeight: 600 }}>
                {t.stars} {t.stars === 1 ? 'star' : 'stars'}, no comment.
              </p>
            )}
            {t.flag && (
              <p style={{ margin: 0, fontSize: 14, fontWeight: 600 }}>{FLAG_LABEL[t.flag]}. Edify doesn&apos;t draft replies to {FLAG_NEVER[t.flag]}.</p>
            )}
          </section>

          {composing ? (
            <Composer t={t} d={d} ripple={ripple} after={next && `When you send, ${next.guest}'s ticket opens next, waiting ${ageLabel(next.at)}.`} settingsLabel={fb.settings.stores[t.storeId] === 'edify-thanks' ? 'Edify drafts, thank-yous send themselves' : 'Edify drafts, you send'} resolve={resolve} onSend={send} />
          ) : (
            <>
              {t.reply ? (
                <SentReply t={t} onSendFollowUp={() => { fb.sendFollowUps([t.id]); setAnnounce(`Follow-up sent to ${first}. Ticket resolved.`); }} />
              ) : isHeldForFix(t) ? (
                <HeldTicket t={t} onSendFollowUp={() => { fb.sendFollowUps([t.id]); setAnnounce(`Follow-up sent to ${first}. Ticket resolved.`); }} />
              ) : null}
              <div style={{ ...whiteCard, padding: '20px 22px' }}>{resolve}</div>
            </>
          )}
        </div>

        <aside style={{ flex: '2 1 300px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 16 }}>
          <section aria-labelledby="knows" style={{ ...whiteCard, padding: '18px 22px 8px', display: 'flex', flexDirection: 'column', gap: 10 }}>
            <h2 id="knows" style={asideLabel}>What Edify knows</h2>
            <ContextList
              lines={t.context}
              extra={ripple ? undefined : <span>No pattern. Nothing else in Edify&apos;s data links this to a cause.</span>}
            />
          </section>
          {ripple && <RipplePanel r={ripple} noun={noun} storeName={t.store.name} />}
        </aside>
      </div>
    </div>
  );
}

type Draft = ReturnType<typeof useReplyDraft>;

function Composer({ t, d, ripple, after, settingsLabel, resolve, onSend }: {
  t: LiveTicket; d: Draft; ripple?: LiveRipple; after?: string; settingsLabel: string; resolve: ReactNode; onSend: () => void;
}) {
  const ids = useId();
  const onVoice = useCallback((text: string) => d.setOwnLine(text, true), [d]);
  const voice = useVoiceLine(onVoice);
  const [focus, setFocus] = useState(false);
  const [showResolve, setShowResolve] = useState(false);
  const resolveOpen = showResolve || d.missingFix;
  const why = d.missingLine
    ? 'Add your line first. Reply settings ask for one on ratings under 4 stars.'
    : d.missingFix
      ? 'Pick what you did in store.'
      : !d.body.trim()
        ? 'Write the reply first.'
        : '';
  const resolveText =
    d.choice === 'ripple' && ripple ? `Stays open until ${ripple.resolveLabel.replace(/^When /, '')}`
      : d.choice === 'in-store' ? (d.fix ? `Resolves as fixed in store: ${IN_STORE_FIX_LABEL[d.fix].toLowerCase()}` : 'Resolves as fixed in store')
        : 'Resolves when you send';

  return (
    <section aria-labelledby={`${ids}-h`} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-end', justifyContent: 'space-between', gap: '4px 12px' }}>
        <div>
          <h2 id={`${ids}-h`} style={{ margin: 0, fontSize: 19, fontWeight: 700 }}>Reply to {firstName(t.guest)}</h2>
          <p style={{ ...muted, display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
            {d.drafted
              ? <><EdifyMark size={14} color="var(--color-accent-pink)" /> Edify drafted this. Change anything.</>
              : <>Write this one yourself. It&apos;s on Angela Ruiz&apos;s district page too.</>}
          </p>
        </div>
        {d.drafted && t.drafts && (
          <div role="group" aria-label="Change the draft" style={{ display: 'flex' }}>
            <button type="button" aria-pressed={d.variant === 'shorter'} onClick={() => d.pickVariant('shorter')} style={variantBtn(d.variant === 'shorter')}>Shorter</button>
            <button type="button" aria-pressed={d.variant === 'warmer'} onClick={() => d.pickVariant('warmer')} style={variantBtn(d.variant === 'warmer')}>Warmer</button>
          </div>
        )}
      </div>

      <div
        onFocus={() => setFocus(true)}
        onBlur={() => setFocus(false)}
        style={{
          padding: focus ? '19px 21px' : '20px 22px', borderRadius: 16, background: '#ffffff',
          border: focus ? '2px solid var(--color-text-primary)' : '1px solid var(--color-border)',
          display: 'flex', flexDirection: 'column', gap: 16,
        }}
      >
        <label htmlFor={`${ids}-body`} style={srOnly}>
          {d.drafted ? "Edify's draft. Edit it however you like." : `Your reply to ${t.guest}`}
        </label>
        <textarea
          id={`${ids}-body`}
          value={d.body}
          onChange={e => d.setBody(e.target.value)}
          placeholder={d.drafted ? '' : `Write to ${firstName(t.guest)} in your own words`}
          rows={d.drafted ? 4 : 6}
          style={{
            ...(d.drafted ? { fontFamily: 'var(--font-primary)', fontSize: 15 } : { ...quote, fontSize: 16 }),
            lineHeight: 1.6, color: 'var(--color-text-primary)', width: '100%', boxSizing: 'border-box', resize: 'none', fieldSizing: 'content', minHeight: d.drafted ? 0 : 150,
            background: 'transparent', padding: 0, margin: 0, border: 0, outline: 'none',
          } as CSSProperties}
        />

        {d.drafted && (
          <div style={{ margin: '0 -12px', padding: '10px 12px 12px', borderRadius: 12, background: 'var(--color-warning-light)', display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 12 }}>
              <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 4 }}>
                <label htmlFor={`${ids}-line`} style={{ fontSize: 12.5, fontWeight: 700 }}>
                  Your line{d.fromVoice ? ', from voice' : ''}
                  {d.needLine && <span style={{ fontWeight: 400 }}> · needed under 4 stars</span>}
                </label>
                <textarea
                  id={`${ids}-line`}
                  value={d.ownLine}
                  onChange={e => d.setOwnLine(e.target.value)}
                  rows={1}
                  placeholder={voice.supported ? 'Type it, or tap the mic and say it' : 'Type something only you would say'}
                  aria-describedby={voice.problem ? `${ids}-voice` : undefined}
                  style={{
                    ...quote, fontSize: 17, lineHeight: 1.45, border: 0, borderBottom: '1.5px solid var(--color-text-primary)', borderRadius: 0,
                    padding: '2px 0 6px', resize: 'none', outline: 'none', width: '100%', background: 'transparent', fieldSizing: 'content',
                  } as CSSProperties}
                />
              </div>
              <button
                type="button"
                onClick={voice.toggle}
                aria-pressed={voice.listening}
                aria-label={voice.listening ? 'Stop listening' : d.fromVoice ? 'Say your line again' : 'Say your line'}
                style={{
                  width: 44, height: 44, borderRadius: '50%', border: `${voice.listening ? 2 : 1.5}px solid var(--color-text-primary)`,
                  background: '#ffffff', color: 'var(--color-text-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0,
                }}
              >
                {voice.listening ? <Square size={16} aria-hidden /> : <Mic size={18} aria-hidden />}
              </button>
            </div>
            {voice.listening && <p style={{ margin: 0, fontSize: 13 }}>Listening. Tap the square when you&apos;re done.</p>}
            {voice.problem && <p id={`${ids}-voice`} style={{ margin: 0, fontSize: 13 }}>{voice.problem}</p>}
          </div>
        )}

        <p style={{ margin: 0, fontSize: 15 }}>{d.sign}</p>
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '8px 20px', marginTop: 4 }}>
        <button
          type="button"
          onClick={onSend}
          disabled={!d.canSend}
          aria-describedby={why ? `${ids}-why` : undefined}
          style={{ ...primaryBtn, padding: '0 24px', fontSize: 15, borderRadius: 12, opacity: d.canSend ? 1 : 0.45, cursor: d.canSend ? 'pointer' : 'not-allowed' }}
        >
          <Send size={18} aria-hidden /> Send reply
        </button>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 13.5 }}>
          <Clock size={15} aria-hidden style={{ flexShrink: 0 }} />
          {resolveText}
          <button
            type="button"
            onClick={() => setShowResolve(v => !v)}
            aria-expanded={resolveOpen}
            aria-controls={`${ids}-resolve`}
            style={{ minHeight: 44, padding: '0 4px', border: 0, background: 'transparent', fontFamily: 'var(--font-primary)', fontSize: 13.5, fontWeight: 700, color: 'var(--color-text-primary)', textDecoration: 'underline', textUnderlineOffset: 3, cursor: 'pointer' }}
          >
            {resolveOpen ? 'Done' : 'Change'}
          </button>
        </span>
      </div>
      {why && <p id={`${ids}-why`} style={{ margin: '-4px 0 0', fontSize: 13.5 }}>{why}</p>}
      {resolveOpen && (
        <div id={`${ids}-resolve`} style={{ padding: '14px 18px 10px', borderRadius: 14, border: '1px solid var(--color-border)' }}>{resolve}</div>
      )}
      {after && <p style={{ ...muted, fontSize: 12.5, display: 'flex', alignItems: 'center', gap: 6 }}><ArrowRight size={13} aria-hidden /> {after}</p>}
      <p style={{ ...muted, fontSize: 12.5 }}>
        {SOURCE_REPLY_NOTE[t.source]} {d.drafted && <>{t.store.name}: {settingsLabel}. <Link href="/feedback/settings" style={{ color: 'var(--color-text-primary)', fontWeight: 600 }}>Reply settings</Link></>}
      </p>
    </section>
  );
}

const variantBtn = (on: boolean): CSSProperties => ({
  minHeight: 44, padding: '0 10px', border: 0, background: 'transparent', cursor: 'pointer',
  fontFamily: 'var(--font-primary)', fontSize: 13.5, fontWeight: on ? 700 : 500,
  color: on ? 'var(--color-text-primary)' : 'var(--color-text-secondary)',
  textDecorationLine: on ? 'underline' : 'none', textUnderlineOffset: 4, textDecorationThickness: 2,
});

function ReplyText({ t }: { t: LiveTicket }) {
  return (
    <div style={{ padding: '18px 20px', borderRadius: 16, background: '#ffffff', border: '1px solid var(--color-border)', display: 'flex', flexDirection: 'column', gap: 12 }}>
      {t.reply!.split('\n\n').map(p => (
        <p key={p} style={p === t.ownLine ? { ...quote, margin: 0, fontSize: 16, lineHeight: 1.5 } : { margin: 0, fontSize: 14.5, lineHeight: 1.6 }}>{p}</p>
      ))}
    </div>
  );
}

function FollowUp({ t, onSend }: { t: LiveTicket; onSend: () => void }) {
  if (t.followUpSent) return <p style={{ margin: 0, fontSize: 14 }}>Follow-up sent to {firstName(t.guest)} when the ripple closed.</p>;
  if (!t.followUp) return null;
  return (
    <div style={{ borderTop: hairline, paddingTop: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
      <h3 style={{ ...sectionLabel, display: 'flex', alignItems: 'center', gap: 8 }}>
        <EdifyMark size={16} color="var(--color-accent-pink)" />Follow-up, drafted when the ripple closed
      </h3>
      <div style={{ padding: '16px 18px', borderRadius: 14, background: '#ffffff', border: '1px solid var(--color-border)', display: 'flex', flexDirection: 'column', gap: 10 }}>
        {t.followUp.split('\n\n').map(p => <p key={p} style={{ margin: 0, fontSize: 14, lineHeight: 1.6 }}>{p}</p>)}
      </div>
      <p style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--color-text-secondary)' }}>
        <Send size={15} aria-hidden /> {SOURCE_REPLY_NOTE[t.source]}
      </p>
      <div>
        <button type="button" onClick={onSend} style={primaryBtn}><Send size={16} aria-hidden /> Send follow-up</button>
      </div>
    </div>
  );
}

function SentReply({ t, onSendFollowUp }: { t: LiveTicket; onSendFollowUp: () => void }) {
  const by = t.sentBy === 'edify' ? 'Edify sent this thank-you, as the store\'s reply settings allow.' : `Sent ${fmtDay(t.sentAt!)}, ${fmtTime(t.sentAt!)}.`;
  return (
    <section aria-labelledby="sent" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'baseline', gap: 10 }}>
        <h2 id="sent" style={heading}>Reply to {firstName(t.guest)}</h2>
        <span style={{ fontSize: 13, color: 'var(--color-text-secondary)' }}>{by}</span>
      </div>
      <ReplyText t={t} />
      {t.ownLineFromVoice && <p style={{ margin: 0, fontSize: 12.5, color: 'var(--color-text-secondary)' }}>The italic line came from voice.</p>}
      <FollowUp t={t} onSend={onSendFollowUp} />
    </section>
  );
}

function HeldTicket({ t, onSendFollowUp }: { t: LiveTicket; onSendFollowUp: () => void }) {
  return (
    <section aria-labelledby="held" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <h2 id="held" style={heading}>Nothing to reply to yet</h2>
      <p style={{ margin: 0, fontSize: 14, lineHeight: 1.55 }}>
        {firstName(t.guest)} left a rating without a comment. Edify linked it to the ripple through the order time. It stays open until the ripple closes, then Edify drafts a follow-up for you to approve.
      </p>
      <FollowUp t={t} onSend={onSendFollowUp} />
    </section>
  );
}

function RadioRow({ name, checked, onChange, title, help, children }: {
  name: string; checked: boolean; onChange: () => void; title: string; help: string; children?: ReactNode;
}) {
  return (
    <div style={{ padding: '8px 0' }}>
      <label style={{ display: 'flex', gap: 12, cursor: 'pointer' }}>
        <input type="radio" name={name} checked={checked} onChange={onChange} style={{ width: 20, height: 20, margin: '1px 0 0', accentColor: 'var(--color-text-primary)', flex: '0 0 20px' }} />
        <span style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <span style={{ fontSize: 14.5, fontWeight: checked ? 700 : 600 }}>{title}</span>
          <span style={muted}>{help}</span>
        </span>
      </label>
      {children}
    </div>
  );
}

function Resolve({ t, ripple, d, composing, onResolveNow }: {
  t: LiveTicket; ripple?: LiveRipple; d: Draft; composing: boolean; onResolveNow: () => void;
}) {
  const ids = useId();
  const first = firstName(t.guest);

  if (t.status === 'resolved') {
    const how =
      t.resolveChoice === 'in-store' ? `Fixed in store: ${IN_STORE_FIX_LABEL[t.fix!].toLowerCase()}.${t.fixNote ? ` ${t.fixNote}` : ''}`
        : t.followUpSent ? 'Closed with the ripple, after the follow-up went.'
          : t.resolveChoice === 'ripple' ? 'Closed with the ripple.'
            : 'Closed when the reply went. The reply was enough.';
    return (
      <section aria-labelledby={`${ids}-h`} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <h2 id={`${ids}-h`} style={heading}>Resolved</h2>
        <p style={{ margin: 0, fontSize: 13.5, lineHeight: 1.5 }}>{how}</p>
        {t.resolvedAt !== undefined && <p style={{ margin: 0, fontSize: 13, color: 'var(--color-text-secondary)' }}>{fmtDay(t.resolvedAt)}, {fmtTime(t.resolvedAt)}</p>}
      </section>
    );
  }

  const rippleOpen = ripple && ripple.status !== 'closed';
  const others = ripple ? ripple.open.filter(x => x.id !== t.id).length : 0;
  const name = `${ids}-resolve`;

  return (
    <section aria-labelledby={`${ids}-h`}>
      <fieldset style={{ border: 0, margin: 0, padding: 0, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <legend style={{ padding: 0, marginBottom: 6 }}>
          <h2 id={`${ids}-h`} style={composing ? sectionLabel : heading}>When is this resolved?</h2>
          {!composing && t.status === 'replied' && (
            <span style={{ ...muted, display: 'block', marginTop: 6 }}>Replied {fmtDay(t.sentAt!)}. Open until you choose otherwise.</span>
          )}
        </legend>
        {rippleOpen && (
          <RadioRow name={name} checked={d.choice === 'ripple'} onChange={() => d.setChoice('ripple')} title={ripple.resolveLabel} help={ripple.resolveHelp(others, first)} />
        )}
        <RadioRow
          name={name}
          checked={d.choice === 'reply'}
          onChange={() => d.setChoice('reply')}
          title={composing ? 'Now, the reply is enough' : 'Now, the reply was enough'}
          help={composing ? 'Closes when you send.' : 'Closes now.'}
        />
        <RadioRow
          name={name}
          checked={d.choice === 'in-store'}
          onChange={() => d.setChoice('in-store')}
          title="Now, we fixed it in store"
          help="Add what you did, like a refund or a remake."
        >
          {d.choice === 'in-store' && (
            <div style={{ marginTop: 14, paddingLeft: 34, display: 'flex', flexDirection: 'column', gap: 12 }}>
              <fieldset style={{ border: 0, margin: 0, padding: 0 }}>
                <legend style={{ fontSize: 13, fontWeight: 700, marginBottom: 8, padding: 0 }}>What did you do?</legend>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {(Object.keys(IN_STORE_FIX_LABEL) as InStoreFix[]).map(f => (
                    <label key={f} style={{
                      display: 'inline-flex', alignItems: 'center', gap: 8, minHeight: 44, padding: '0 14px', borderRadius: 999, cursor: 'pointer', fontSize: 14, fontWeight: 600,
                      border: d.fix === f ? '2px solid var(--color-text-primary)' : '1.5px solid var(--color-border)',
                      background: d.fix === f ? 'var(--color-review-light)' : '#ffffff',
                    }}>
                      <input type="radio" name={`${name}-fix`} checked={d.fix === f} onChange={() => d.setFix(f)} style={{ accentColor: 'var(--color-text-primary)', margin: 0 }} />
                      {IN_STORE_FIX_LABEL[f]}
                    </label>
                  ))}
                </div>
              </fieldset>
              <label style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 13, fontWeight: 700 }}>
                Note, if it helps
                <input
                  value={d.fixNote}
                  onChange={e => d.setFixNote(e.target.value)}
                  placeholder="Refunded the sandwich at the counter"
                  style={{ minHeight: 44, padding: '0 12px', borderRadius: 10, border: '1.5px solid var(--color-border)', fontSize: 14, fontWeight: 400, fontFamily: 'var(--font-primary)' }}
                />
              </label>
            </div>
          )}
        </RadioRow>
        {!composing && (
          <div style={{ marginTop: 10 }}>
            <button
              type="button"
              onClick={onResolveNow}
              disabled={d.choice === 'ripple' || d.missingFix}
              style={{ ...primaryBtn, opacity: d.choice === 'ripple' || d.missingFix ? 0.45 : 1, cursor: d.choice === 'ripple' || d.missingFix ? 'not-allowed' : 'pointer' }}
            >
              Resolve now
            </button>
          </div>
        )}
      </fieldset>
    </section>
  );
}

function RipplePanel({ r, noun, storeName }: { r: LiveRipple; noun: string; storeName: string }) {
  const waiting = r.open.length;
  const title = r.kind === 'late-delivery' ? `Bakery delivery, ${storeName}` : r.title;
  const note = r.kind === 'late-delivery'
    ? `Angela sent the bakery these times on Thursday. ${waiting} ${waiting === 1 ? 'guest is' : 'guests are'} waiting on the fix.`
    : `${r.ownerSentence} ${waiting} ${waiting === 1 ? 'guest is' : 'guests are'} waiting on the fix.`;
  return (
    <section aria-labelledby="ripple-mini" style={{ ...whiteCard, padding: '18px 22px 8px', display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <p style={asideLabel}>The ripple</p>
        <h2 id="ripple-mini" style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>{title}</h2>
        <p style={muted}>One of {r.tickets.length} tickets in the {noun} ripple.</p>
      </div>
      {r.kind === 'late-delivery' && <DeliveryChart tone="light" />}
      {r.kind === 'price' && (
        <p style={{ margin: 0, fontSize: 24, fontWeight: 700 }}>
          <span style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)' }}>Changed from </span>
          <s style={{ color: 'var(--color-accent-pink)', textDecorationThickness: 2 }}>{r.detail.struck}</s>{' '}
          <span aria-hidden>→</span><span style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)' }}> to</span> $3.79
        </p>
      )}
      {r.kind !== 'late-delivery' && <p style={{ margin: 0, fontSize: 13.5, lineHeight: 1.5 }}>{r.support}</p>}
      <p style={{ margin: 0, fontSize: 13.5, lineHeight: 1.5 }}>{note}</p>
      <Link href={`/feedback/ripples/${r.id}`} style={{ alignSelf: 'flex-start', display: 'inline-flex', alignItems: 'center', gap: 6, minHeight: 44, fontSize: 13.5, fontWeight: 700, color: 'var(--color-text-primary)' }}>
        Open ripple <ArrowRight size={15} aria-hidden />
      </Link>
    </section>
  );
}
