'use client';

import Link from 'next/link';
import { useCallback, useId, useRef, useState, type CSSProperties } from 'react';
import { ArrowLeft, Clock, Mic, Send, Square } from 'lucide-react';
import EdifyMark from '@/components/EdifyMark/EdifyMark';
import { Sheet } from '@/components/Receiving/capture/ui';
import { ageLabel, PHONE_STORE } from '@/components/Feedback/dunkinData';
import { firstName, storeMorning, useFeedback, type LiveRipple, type LiveTicket } from '@/components/Feedback/feedbackState';
import { FLAG_NEVER, IN_STORE_FIX_LABEL, SOURCE_REPLY_NOTE, type InStoreFix, type ResolveChoice } from '@/components/Feedback/model';
import { quote, sourceLine, spoken } from '@/components/Feedback/ui';
import { useReplyDraft, useVoiceLine } from '@/components/Feedback/useReplyDraft';

const STORE = PHONE_STORE;
const srOnly: CSSProperties = { position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)' };
const label: CSSProperties = { margin: 0, fontSize: 12.5, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase' };

type Feedback = ReturnType<typeof useFeedback>;

/** Screen 4. The replies that need Marcus's words, one at a time, oldest first. */
export default function PhoneReplyPage() {
  const fb = useFeedback();
  const [sent, setSent] = useState<string[]>([]);
  const [skipped, setSkipped] = useState<string[]>([]);
  const [announce, setAnnounce] = useState('');

  const pending = storeMorning(STORE, fb.tickets).words;
  const ahead = pending.filter(t => !skipped.includes(t.id));
  const current = ahead[0];
  const total = sent.length + pending.length;
  const position = sent.length + skipped.filter(id => pending.some(t => t.id === id)).length + 1;

  return (
    <main style={{ minHeight: '100vh', background: '#ffffff', color: 'var(--color-text-primary)' }}>
      <div style={{ maxWidth: 430, margin: '0 auto', padding: '20px 18px 0', minHeight: '100vh', boxSizing: 'border-box', display: 'flex', flexDirection: 'column' }}>
        <p role="status" aria-live="polite" style={srOnly}>{announce}</p>
        {current ? (
          <Reply
            key={current.id}
            t={current}
            fb={fb}
            position={position}
            total={total}
            ripple={fb.ripples.find(r => r.id === current.rippleId && r.kind !== 'praise')}
            onSkip={() => {
              setSkipped(s => [...s, current.id]);
              setAnnounce(`Skipped ${firstName(current.guest)}. It stays on the list.`);
            }}
            onSent={() => {
              setSent(s => [...s, current.id]);
              setAnnounce(`Sent to ${firstName(current.guest)}.`);
            }}
          />
        ) : (
          <Done sent={sent.length} skipped={ahead.length === 0 ? pending.length : 0} />
        )}
      </div>
    </main>
  );
}

function Done({ sent, skipped }: { sent: number; skipped: number }) {
  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 16, paddingBottom: 60 }}>
      <h1 style={{ margin: 0, fontSize: 26, fontWeight: 700, lineHeight: 1.15 }}>
        {sent > 0 ? `${sent} ${sent === 1 ? 'reply' : 'replies'} sent.` : 'Nothing waiting on you.'}
      </h1>
      <p style={{ margin: 0, fontSize: 15, lineHeight: 1.5 }}>
        {skipped > 0
          ? `You skipped ${skipped}. ${skipped === 1 ? "It's" : "They're"} still waiting, and Angela can see ${skipped === 1 ? 'it' : 'them'} on the district page.`
          : 'Each ticket stays open until its cause is fixed. Edify drafts the follow-ups for you to approve.'}
      </p>
      <Link href="/feedback/today" style={{ ...bigBtn, background: 'var(--color-text-primary)', color: '#ffffff', textDecoration: 'none', marginTop: 8 }}>
        Back to today
      </Link>
    </div>
  );
}

const bigBtn: CSSProperties = {
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 10, minHeight: 52, borderRadius: 18, padding: '0 20px',
  fontFamily: 'var(--font-primary)', fontSize: 16, fontWeight: 700, cursor: 'pointer',
};

const initials = (name: string) => name.split(/\s+/).map(p => p[0]).join('').replace(/[^A-Z]/gi, '').slice(0, 2).toUpperCase();

function Reply({ t, fb, position, total, ripple, onSkip, onSent }: {
  t: LiveTicket; fb: Feedback; position: number; total: number; ripple?: LiveRipple; onSkip: () => void; onSent: () => void;
}) {
  const ids = useId();
  const d = useReplyDraft(t, fb.settings, 'shorter');
  const lineRef = useRef<HTMLTextAreaElement>(null);
  const onVoice = useCallback((text: string) => d.setOwnLine(text, true), [d]);
  const voice = useVoiceLine(onVoice);
  const [sheet, setSheet] = useState(false);
  const others = ripple ? ripple.tickets.length - 1 : 0;

  const redo = () => {
    if (!voice.supported) {
      d.setOwnLine('');
      lineRef.current?.focus();
      return;
    }
    voice.toggle();
  };

  const send = () => {
    if (!d.canSend) return;
    fb.sendReply(t.id, d.input());
    onSent();
  };

  const resolveText: Record<ResolveChoice, string> = {
    ripple: ripple ? `Stays open until ${ripple.resolveLabel.replace(/^When /, '')}` : '',
    reply: 'Resolves when you send',
    'in-store': d.fix ? `Resolves as fixed in store: ${IN_STORE_FIX_LABEL[d.fix].toLowerCase()}` : 'Fixed in store. Pick what you did.',
  };
  const why = d.missingLine ? 'Add your line to send. Every reply to a complaint gets a line of your own.' : d.missingFix ? 'Pick what you did in store.' : '';

  return (
    <>
      <div style={{ display: 'grid', gridTemplateColumns: '56px 1fr 56px', alignItems: 'center', marginBottom: 14 }}>
        <Link href="/feedback/today" aria-label="Back to today" style={{
          width: 52, height: 52, borderRadius: '50%', border: '1.5px solid var(--color-text-primary)', display: 'grid', placeItems: 'center', color: 'var(--color-text-primary)',
        }}>
          <ArrowLeft size={22} aria-hidden />
        </Link>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 14, fontWeight: 700 }}>{position} of {total}</span>
          <span aria-hidden style={{ display: 'flex', gap: 5 }}>
            {Array.from({ length: total }, (_, i) => (
              <span key={i} style={{ width: 36, height: 5, borderRadius: 3, background: i < position ? 'var(--color-text-primary)' : 'var(--color-border)' }} />
            ))}
          </span>
        </div>
        <button type="button" onClick={onSkip} style={{
          minHeight: 48, minWidth: 48, border: 0, background: 'transparent', fontFamily: 'var(--font-primary)', fontSize: 15, fontWeight: 700, color: 'var(--color-text-primary)', cursor: 'pointer', justifySelf: 'end',
        }}>
          Skip
        </button>
      </div>

      <article aria-labelledby={`${ids}-who`} style={{ background: '#ffffff', borderRadius: 24, padding: '20px 20px 18px', border: '1px solid var(--color-border-subtle)', display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
          <span aria-hidden style={{ flex: '0 0 40px', width: 40, height: 40, borderRadius: '50%', background: 'var(--color-review-light)', display: 'grid', placeItems: 'center', fontSize: 13.5, fontWeight: 700 }}>
            {initials(t.guest)}
          </span>
          <span style={{ flex: 1, minWidth: 0 }}>
            <h1 id={`${ids}-who`} style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>{t.guest}</h1>
            <span style={{ fontSize: 13.5, color: 'var(--color-text-secondary)' }}>{t.reason} · {ageLabel(t.at)} ago</span>
          </span>
          <span style={{ padding: '3px 10px', borderRadius: 999, border: '1.5px solid var(--color-text-primary)', fontSize: 12, fontWeight: 500, whiteSpace: 'nowrap' }}>{sourceLine(t)}</span>
        </div>

        <blockquote style={{ ...quote, ...spoken, margin: 0, fontSize: 18, fontWeight: 500, lineHeight: 1.45 }}>&ldquo;{t.words}&rdquo;</blockquote>

        {t.phoneLine && (
          <div style={{ padding: '12px 14px', borderRadius: 14, background: 'var(--color-warning-light)', border: '1px solid var(--color-warning-border)' }}>
            <p style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, fontWeight: 700 }}>
              <span aria-hidden style={{ width: 9, height: 9, transform: 'rotate(45deg)', flexShrink: 0, background: 'var(--color-text-primary)' }} />
              {t.phoneLine}
            </p>
            <p style={{ margin: '3px 0 0', fontSize: 13.5, lineHeight: 1.45 }}>
              {ripple ? `${others} other ${others === 1 ? 'guest' : 'guests'} this week. ${ripple.ownerSentence}` : 'No pattern. Just this guest.'}
            </p>
          </div>
        )}

        {d.drafted ? (
          <>
            <h2 style={{ ...label, display: 'flex', alignItems: 'center', gap: 8 }}>
              <EdifyMark size={16} color="var(--color-accent-pink)" />{' '}Edify&apos;s draft
            </h2>
            <label htmlFor={`${ids}-body`} style={srOnly}>Edify&apos;s draft. Edit it however you like.</label>
            <textarea
              id={`${ids}-body`}
              value={d.body}
              onChange={e => d.setBody(e.target.value)}
              style={{
                fontFamily: 'var(--font-primary)', fontSize: 15, lineHeight: 1.6, color: 'var(--color-text-primary)', border: '1.5px solid transparent', borderRadius: 10,
                padding: 6, margin: -6, resize: 'none', width: 'calc(100% + 12px)', boxSizing: 'border-box', background: 'transparent', fieldSizing: 'content',
              } as CSSProperties}
            />
            <div style={{ padding: '12px 14px', borderRadius: 14, border: '1.5px solid var(--color-text-primary)', display: 'flex', flexDirection: 'column', gap: 4 }}>
              <label htmlFor={`${ids}-line`} style={{ fontSize: 12.5, fontWeight: 700 }}>
                Your line{d.fromVoice ? ', from voice' : ''}
              </label>
              <textarea
                ref={lineRef}
                id={`${ids}-line`}
                value={d.ownLine}
                onChange={e => d.setOwnLine(e.target.value)}
                rows={1}
                placeholder={voice.supported ? 'Tap Say your line, or type it' : 'Type something only you would say'}
                style={{ ...quote, fontSize: 16, lineHeight: 1.45, border: 0, padding: 0, resize: 'none', outline: 'none', width: '100%', background: 'transparent', fieldSizing: 'content' } as CSSProperties}
              />
              {voice.listening && <p style={{ margin: 0, fontSize: 13 }}>Listening. Tap Stop when you&apos;re done.</p>}
              {voice.problem && <p style={{ margin: 0, fontSize: 13 }}>{voice.problem}</p>}
            </div>
          </>
        ) : (
          <>
            <p style={{ margin: 0, fontSize: 13.5, lineHeight: 1.5 }}>Edify doesn&apos;t draft replies to {FLAG_NEVER[t.flag!]}. Write this one yourself.</p>
            <label htmlFor={`${ids}-body`} style={srOnly}>Your reply to {t.guest}</label>
            <textarea id={`${ids}-body`} value={d.body} onChange={e => d.setBody(e.target.value)} rows={5}
              style={{ ...quote, fontSize: 15, lineHeight: 1.5, padding: 10, borderRadius: 12, border: '1.5px solid var(--color-border)', resize: 'vertical' }} />
          </>
        )}
        <p style={{ margin: 0, fontSize: 15 }}>{d.sign}</p>
      </article>

      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 4px 0' }}>
        <Clock size={18} aria-hidden style={{ flexShrink: 0 }} />
        <span style={{ flex: 1, fontSize: 14, lineHeight: 1.4 }}>{resolveText[d.choice]}</span>
        <button type="button" onClick={() => setSheet(true)} aria-haspopup="dialog" style={{
          minHeight: 44, border: 0, background: 'transparent', fontFamily: 'var(--font-primary)', fontSize: 15, fontWeight: 700, color: 'var(--color-text-primary)', textDecoration: 'underline', textUnderlineOffset: 3, cursor: 'pointer',
        }}>
          Change
        </button>
      </div>
      <p style={{ margin: '6px 4px 0', display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--color-text-secondary)' }}>
        <Send size={14} aria-hidden style={{ flexShrink: 0 }} /> {SOURCE_REPLY_NOTE[t.source]}
      </p>

      <div style={{ flex: 1 }} />
      <div style={{ position: 'sticky', bottom: 0, background: '#ffffff', padding: '14px 0 calc(18px + env(safe-area-inset-bottom))', display: 'flex', flexDirection: 'column', gap: 8 }}>
        {why && <p id={`${ids}-why`} style={{ margin: 0, fontSize: 14, textAlign: 'center' }}>{why}</p>}
        <div style={{ display: 'flex', gap: 12 }}>
          {d.drafted && (
            <button type="button" onClick={redo} aria-pressed={voice.listening} style={{ ...bigBtn, flex: '0 0 auto', background: '#ffffff', color: 'var(--color-text-primary)', border: '1.5px solid var(--color-text-primary)', fontSize: 15 }}>
              {voice.listening ? <Square size={18} aria-hidden /> : <Mic size={20} aria-hidden />}
              {voice.listening ? 'Stop' : d.ownLine ? 'Redo line' : voice.supported ? 'Say your line' : 'Type your line'}
            </button>
          )}
          <button type="button" onClick={send} disabled={!d.canSend} aria-describedby={why ? `${ids}-why` : undefined} style={{
            ...bigBtn, flex: 1, border: 0, background: 'var(--color-text-primary)', color: '#ffffff', opacity: d.canSend ? 1 : 0.45, cursor: d.canSend ? 'pointer' : 'not-allowed',
          }}>
            <Send size={20} aria-hidden /> Send
          </button>
        </div>
      </div>

      {sheet && (
        <Sheet title="When is this resolved?" isPhone onClose={() => setSheet(false)} footer={
          <button type="button" onClick={() => setSheet(false)} disabled={d.missingFix} style={{ ...bigBtn, width: '100%', border: 0, background: 'var(--color-text-primary)', color: '#ffffff', opacity: d.missingFix ? 0.45 : 1 }}>
            Done
          </button>
        }>
          <fieldset style={{ border: 0, margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
            <legend style={srOnly}>When is this resolved?</legend>
            {ripple && ripple.status !== 'closed' && (
              <Option name={`${ids}-r`} on={d.choice === 'ripple'} pick={() => d.setChoice('ripple')} title={ripple.resolveLabel} help={ripple.resolveHelp(others, firstName(t.guest))} />
            )}
            <Option name={`${ids}-r`} on={d.choice === 'reply'} pick={() => d.setChoice('reply')} title="Now, the reply is enough" help="Closes when you send." />
            <Option name={`${ids}-r`} on={d.choice === 'in-store'} pick={() => d.setChoice('in-store')} title="Now, we fixed it in store" help="Add what you did, like a refund or a remake." />
            {d.choice === 'in-store' && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, paddingLeft: 4 }} role="radiogroup" aria-label="What did you do?">
                {(Object.keys(IN_STORE_FIX_LABEL) as InStoreFix[]).map(f => (
                  <label key={f} style={{
                    display: 'inline-flex', alignItems: 'center', gap: 8, minHeight: 48, padding: '0 16px', borderRadius: 999, fontSize: 14, fontWeight: 600, cursor: 'pointer',
                    border: d.fix === f ? '2px solid var(--color-text-primary)' : '1.5px solid var(--color-border)', background: d.fix === f ? 'var(--color-review-light)' : '#ffffff',
                  }}>
                    <input type="radio" name={`${ids}-fix`} checked={d.fix === f} onChange={() => d.setFix(f)} style={{ margin: 0, accentColor: 'var(--color-text-primary)' }} />
                    {IN_STORE_FIX_LABEL[f]}
                  </label>
                ))}
              </div>
            )}
          </fieldset>
        </Sheet>
      )}
    </>
  );
}

function Option({ name, on, pick, title, help }: { name: string; on: boolean; pick: () => void; title: string; help: string }) {
  return (
    <label style={{ display: 'flex', gap: 12, padding: on ? 13.5 : 14, borderRadius: 14, cursor: 'pointer', border: on ? '2px solid var(--color-text-primary)' : '1.5px solid var(--color-border)' }}>
      <input type="radio" name={name} checked={on} onChange={pick} style={{ width: 20, height: 20, margin: '2px 0 0', flex: '0 0 20px', accentColor: 'var(--color-text-primary)' }} />
      <span style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
        <span style={{ fontSize: 14.5, fontWeight: 700 }}>{title}</span>
        <span style={{ fontSize: 14, lineHeight: 1.45 }}>{help}</span>
      </span>
    </label>
  );
}
