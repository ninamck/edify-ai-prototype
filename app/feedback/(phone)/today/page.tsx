'use client';

import Link from 'next/link';
import { useState, type CSSProperties, type ReactNode } from 'react';
import { ArrowRight, Check, Clock, Heart, Pencil } from 'lucide-react';
import { HUDDLE_TIME, storeById } from '@/components/Feedback/bronxData';
import { huddleNotes, signOff, storeMorning, useFeedback } from '@/components/Feedback/feedbackState';
import type { StoreId } from '@/components/Feedback/model';

const STORE: StoreId = 'fordham';
const rule = '1px solid rgba(255,255,255,0.18)';
const soft = 'rgba(255,255,255,0.82)';

/** Screen 3. Marcus at 9 AM: what came in, what Edify has ready, and what needs him. */
export default function MorningBriefPage() {
  const { tickets, ripples, settings, sendThankYous } = useFeedback();
  const store = storeById(STORE);
  const m = storeMorning(STORE, tickets);
  const notes = huddleNotes(STORE, tickets, ripples);
  const [announce, setAnnounce] = useState('');
  const heldRipple = ripples.find(r => r.id === m.held[0]?.rippleId);
  const drafted = m.words.filter(t => !t.flag).length;

  const sendThanks = () => {
    const n = m.thanksReady.length;
    sendThankYous(m.thanksReady.map(t => t.id));
    setAnnounce(`Sent ${n} thank-yous, signed ${signOff(STORE, settings)}.`);
  };

  return (
    <main style={{ minHeight: '100vh', background: 'var(--color-bg-nav)', color: '#ffffff' }}>
      <div style={{ maxWidth: 430, margin: '0 auto', padding: '28px 22px 40px', display: 'flex', flexDirection: 'column', gap: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/edify-logo-cream.svg" alt="Edify" style={{ height: 24, width: 'auto' }} />
          <span title={store.manager} style={{ width: 48, height: 48, borderRadius: '50%', background: 'rgba(255,255,255,0.14)', display: 'grid', placeItems: 'center', fontSize: 14, fontWeight: 700 }}>
            <span aria-hidden>MB</span>
            <span style={srOnly}>Signed in as Marcus Bell</span>
          </span>
        </div>

        <header>
          <p style={{ margin: 0, fontSize: 14, color: soft }}>Friday, Nov 20 · {store.name}</p>
          <h1 style={{ margin: '8px 0 10px', fontSize: 32, lineHeight: 1.1, fontWeight: 700 }}>Morning, {store.managerFirst}.</h1>
          <p style={{ margin: 0, fontSize: 17, lineHeight: 1.45 }}>
            {m.arrived.length} guests wrote in. {m.thanksReady.length + m.words.length > 0 ? "Here's what needs you." : "You're clear for now."}
          </p>
        </header>

        <p role="status" aria-live="polite" style={announce ? {
          margin: 0, padding: '12px 14px', borderRadius: 12, background: 'var(--color-review-light)', color: 'var(--color-text-primary)', fontSize: 14, fontWeight: 600,
        } : srOnly}>
          {announce}
        </p>

        <ul style={{ margin: 0, padding: 0, listStyle: 'none' }}>
          {m.thankYous.length > 0 && (
            <Row
              icon={m.thanksReady.length ? <Heart size={20} aria-hidden /> : <Check size={20} aria-hidden />}
              tone="blue"
              title={m.thanksReady.length ? `${m.thanksReady.length} thank-yous ready` : `${m.thankYous.length} thank-yous sent`}
              sub={m.thanksReady.length ? 'Five stars, no comment' : m.thanksByEdify.length ? `Edify sent them. ${store.name} sends thank-yous automatically.` : `Signed ${signOff(STORE, settings)}`}
              action={m.thanksReady.length > 0 && (
                <button type="button" onClick={sendThanks} style={{
                  minHeight: 48, padding: '0 16px', borderRadius: 12, border: 0, background: 'var(--color-review-light)', color: 'var(--color-text-primary)',
                  fontFamily: 'var(--font-primary)', fontSize: 14, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap',
                }}>
                  Send all {m.thanksReady.length}
                </button>
              )}
              first
            />
          )}
          {m.wordsAll.length > 0 && (
            <Row
              icon={m.words.length ? <Pencil size={19} aria-hidden /> : <Check size={20} aria-hidden />}
              tone="yellow"
              title={m.words.length ? `${m.words.length} need your words` : `All ${m.wordsAll.length} replies sent`}
              sub={m.words.length
                ? drafted === m.words.length ? 'Drafted. Add your own line.' : `${drafted} drafted. ${m.words.length - drafted} for you to write.`
                : 'They stay open until each cause is fixed.'}
            />
          )}
          {m.held.length > 0 && heldRipple && (
            <Row
              icon={<Clock size={20} aria-hidden />}
              tone="pink"
              title={`${m.held.length} waiting on ${heldRipple.owner}`}
              sub={heldRipple.kind === 'late-delivery' ? 'Open until deliveries are on time. Angela has it.' : heldRipple.ownerSentence}
            />
          )}
        </ul>

        {m.words.length > 0 && (
          <Link href="/feedback/today/reply" style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, minHeight: 56, borderRadius: 18,
            background: 'var(--color-warning-light)', color: 'var(--color-text-primary)', fontSize: 17, fontWeight: 700, textDecoration: 'none',
          }}>
            Start the {m.words.length} {m.words.length === 1 ? 'reply' : 'replies'} <ArrowRight size={20} aria-hidden />
          </Link>
        )}

        {notes.length > 0 && (
          <section aria-labelledby="huddle-h" style={{ background: '#ffffff', color: 'var(--color-text-primary)', borderRadius: 22, padding: '18px 20px' }}>
            <h2 id="huddle-h" style={{ margin: '0 0 12px', fontSize: 13, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
              For tomorrow&apos;s {HUDDLE_TIME} huddle
            </h2>
            <ol style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 10 }}>
              {notes.map((n, i) => (
                <li key={n} style={{ display: 'flex', gap: 12, fontSize: 15, fontWeight: 600, lineHeight: 1.4 }}>
                  <span aria-hidden style={{ fontVariantNumeric: 'tabular-nums' }}>{i + 1}</span>
                  {n}
                </li>
              ))}
            </ol>
          </section>
        )}
      </div>
    </main>
  );
}

const srOnly: CSSProperties = { position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)' };

const TONE: Record<'blue' | 'yellow' | 'pink', string> = {
  blue: 'var(--color-review-light)',
  yellow: 'var(--color-warning-light)',
  pink: 'var(--color-accent-pink)',
};

function Row({ icon, tone, title, sub, action, first }: { icon: ReactNode; tone: keyof typeof TONE; title: string; sub: string; action?: ReactNode; first?: boolean }) {
  return (
    <li style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '16px 0', borderTop: first ? 0 : rule }}>
      <span aria-hidden style={{ flex: '0 0 48px', width: 48, height: 48, borderRadius: '50%', background: TONE[tone], color: 'var(--color-text-primary)', display: 'grid', placeItems: 'center' }}>
        {icon}
      </span>
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{ display: 'block', fontSize: 16, fontWeight: 700, lineHeight: 1.3 }}>{title}</span>
        <span style={{ display: 'block', fontSize: 13.5, lineHeight: 1.4, color: soft, marginTop: 3 }}>{sub}</span>
      </span>
      {action}
    </li>
  );
}
