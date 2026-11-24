'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useState, type CSSProperties } from 'react';
import { ArrowLeft, Heart, Send } from 'lucide-react';
import { DISTRICT, storeById } from '@/components/Feedback/dunkinData';
import { isHeldForFix, needsReply, useFeedback, type LiveRipple, type LiveTicket } from '@/components/Feedback/feedbackState';
import { CauseChip, DoneChip, hairline, primaryBtn, quote, ReplyLink, secondaryBtn, sourceLine, spoken, TicketRow, whiteCard } from '@/components/Feedback/ui';

const srOnly: CSSProperties = { position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)' };

export default function RipplePage() {
  const { id } = useParams<{ id: string }>();
  const fb = useFeedback();
  const r = fb.ripples.find(x => x.id === id);
  const [announce, setAnnounce] = useState('');

  if (!r) {
    return (
      <div style={{ maxWidth: 720, margin: '0 auto', padding: '48px 24px' }}>
        <h1 style={{ fontSize: 20, margin: '0 0 12px' }}>No ripple here</h1>
        <Link href="/feedback" style={secondaryBtn}>{DISTRICT.short}</Link>
      </div>
    );
  }

  const praise = r.kind === 'praise';
  const said = r.tickets.filter(t => t.words);
  const followUps = r.tickets.filter(t => t.followUp && !t.followUpSent);
  const stores = [...new Set(r.tickets.map(t => t.storeId))].map(storeById);
  const store = storeById(r.storeIds[0]);

  const markFixed = () => {
    const n = r.tickets.filter(t => t.status === 'replied' || isHeldForFix(t)).length;
    fb.closeRipple(r.id);
    setAnnounce(`Marked fixed. Edify drafted ${n} follow-ups. Nothing goes out until you send them.`);
  };
  const sendAll = () => {
    fb.sendFollowUps(followUps.map(t => t.id));
    setAnnounce(`Sent ${followUps.length} follow-ups. Those tickets are resolved.`);
  };

  return (
    <div style={{ maxWidth: 1120, margin: '0 auto', padding: '28px clamp(20px, 4vw, 40px) 64px', display: 'flex', flexDirection: 'column', gap: 28 }}>
      <div>
        <Link href="/feedback" style={{ ...secondaryBtn, padding: '0 14px 0 10px', fontWeight: 600 }}>
          <ArrowLeft size={18} aria-hidden /> {DISTRICT.short}
        </Link>
      </div>

      <p role="status" aria-live="polite" style={announce ? {
        margin: 0, padding: '12px 16px', borderRadius: 12, fontSize: 14, fontWeight: 600, background: 'var(--color-review-light)', border: '1px solid var(--color-review-border)',
      } : srOnly}>
        {announce}
      </p>

      <section aria-labelledby="ripple-h" style={{ display: 'flex', flexWrap: 'wrap', gap: 32, alignItems: 'flex-start' }}>
        <div style={{ flex: '3 1 480px', minWidth: 0 }}>
          <p style={{ margin: 0, fontSize: 13.5, fontWeight: 600 }}>
            {r.reason} · {r.tickets.length} {praise ? 'compliments' : r.tickets.length === 1 ? 'complaint' : 'complaints'} · {stores.map(s => s.name).join(', ')}
          </p>
          <h1 id="ripple-h" style={{ margin: '10px 0 0', fontSize: 28, lineHeight: 1.15, fontWeight: 700 }}>{r.title}</h1>
          {r.cause && (
            <div style={{ marginTop: 18 }}>
              <CauseChip>Likely cause</CauseChip>
              <p style={{ margin: '8px 0 0', fontSize: 15, lineHeight: 1.5 }}>{r.cause.text}</p>
              <p style={{ margin: '2px 0 0', fontSize: 12.5, color: 'var(--color-text-secondary)' }}>From {r.cause.from}</p>
            </div>
          )}
          {r.ownerSentence && <p style={{ margin: '16px 0 0', fontSize: 14, lineHeight: 1.5 }}>{r.ownerSentence}</p>}
        </div>

        <div style={{ flex: '2 1 300px', minWidth: 0, ...whiteCard, padding: 24, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <Actions r={r} store={store.town} followUps={followUps} onMarkFixed={markFixed} onSendAll={sendAll} onTell={() => {
            fb.setRipple(r.id, { told: true });
            setAnnounce(`Marked as told. It's in the ${store.town} huddle notes.`);
          }} />
        </div>
      </section>

      {followUps.length > 0 && (
        <section aria-labelledby="fu-h" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <h2 id="fu-h" style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>Follow-ups to approve</h2>
          <p style={{ margin: 0, fontSize: 14 }}>Edify drafted one for every guest still open in this ripple. Nothing goes out until you send.</p>
          <ul style={{ ...whiteCard, margin: 0, padding: 0, listStyle: 'none', overflow: 'hidden' }}>
            {followUps.map((t, i) => (
              <li key={t.id} style={{ padding: '14px 18px', borderTop: i ? hairline : 0 }}>
                <p style={{ margin: '0 0 6px', fontSize: 13, fontWeight: 700 }}>To {t.guest} · {sourceLine(t)} · {t.store.name}</p>
                <p style={{ margin: 0, fontSize: 13.5, lineHeight: 1.55 }}>{t.followUp!.split('\n\n')[0]}</p>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section aria-labelledby="said-h" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <h2 id="said-h" style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>
          {praise ? 'What guests said' : `${r.tickets.length} tickets`}
        </h2>
        {praise ? (
          <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 16 }}>
            {said.map(t => (
              <li key={t.id}>
                <blockquote style={{ ...quote, ...spoken, margin: 0, fontSize: 15.5, lineHeight: 1.5 }}>&ldquo;{t.words}&rdquo;</blockquote>
                <p style={{ margin: '4px 0 0', fontSize: 12.5, color: 'var(--color-text-secondary)' }}>{t.guest} · {sourceLine(t)}</p>
              </li>
            ))}
          </ul>
        ) : (
          <div style={{ ...whiteCard, overflow: 'hidden' }}>
            <ul style={{ margin: 0, padding: 0, listStyle: 'none', marginTop: -1 }}>
              {[...r.tickets].sort((a, b) => order(a) - order(b) || a.at - b.at).map(t => (
                <TicketRow key={t.id} t={t} action={needsReply(t) ? <ReplyLink t={t} /> : (
                  <Link href={`/feedback/tickets/${t.id}`} aria-label={`Open ticket from ${t.guest}`} style={{ ...secondaryBtn, padding: '0 16px', border: '1.5px solid var(--color-border)' }}>Open</Link>
                )} />
              ))}
            </ul>
          </div>
        )}
      </section>
    </div>
  );
}

const order = (t: LiveTicket) => (t.status === 'open' ? 0 : t.status === 'replied' ? 1 : 2);

const p: CSSProperties = { margin: 0, fontSize: 14, lineHeight: 1.5 };

/** One action at a time: mark it fixed, then send the follow-ups Edify drafted. */
function Actions({ r, store, followUps, onMarkFixed, onSendAll, onTell }: {
  r: LiveRipple; store: string; followUps: LiveTicket[]; onMarkFixed: () => void; onSendAll: () => void; onTell: () => void;
}) {
  if (r.kind === 'praise') {
    return r.told ? <DoneChip>{r.action!.done}</DoneChip> : (
      <>
        <p style={p}>Adds her name and what guests said to the {store} huddle notes.</p>
        <div><button type="button" onClick={onTell} style={primaryBtn}><Heart size={16} aria-hidden /> {r.action!.label}</button></div>
      </>
    );
  }
  if (r.status === 'open') {
    return (
      <>
        <p style={p}>{r.resolveLabel}, mark it fixed. Edify drafts a follow-up to every guest still open, for you to approve.</p>
        <div><button type="button" onClick={onMarkFixed} style={primaryBtn}>Mark fixed</button></div>
      </>
    );
  }
  return followUps.length > 0 ? (
    <>
      <p style={p}>Fixed. {followUps.length} follow-ups are drafted below and waiting for you.</p>
      <div><button type="button" onClick={onSendAll} style={primaryBtn}><Send size={16} aria-hidden /> Send {followUps.length} follow-ups</button></div>
    </>
  ) : (
    <p style={p}>Fixed. Every guest in it has heard back.</p>
  );
}
