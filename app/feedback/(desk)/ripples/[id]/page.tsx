'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useState, type CSSProperties } from 'react';
import { ArrowLeft, Heart, Send } from 'lucide-react';
import DeliveryChart from '@/components/Feedback/DeliveryChart';
import { storeById } from '@/components/Feedback/bronxData';
import { needsReply, rippleStatusText, useFeedback, type LiveRipple, type LiveTicket } from '@/components/Feedback/feedbackState';
import { SOURCE_LABEL, type RippleStatus } from '@/components/Feedback/model';
import { CauseChip, DoneChip, eyebrow, hairline, OutlineChip, primaryBtn, quote, ReplyLink, secondaryBtn, TicketRow, whiteCard } from '@/components/Feedback/ui';

const srOnly: CSSProperties = { position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)' };
const STEPS: RippleStatus[] = ['with', 'watching', 'closed'];

export default function RipplePage() {
  const { id } = useParams<{ id: string }>();
  const fb = useFeedback();
  const r = fb.ripples.find(x => x.id === id);
  const [announce, setAnnounce] = useState('');

  if (!r) {
    return (
      <div style={{ maxWidth: 720, margin: '0 auto', padding: '48px 24px' }}>
        <h1 style={{ fontSize: 20, margin: '0 0 12px' }}>No ripple here</h1>
        <Link href="/feedback" style={secondaryBtn}>Bronx district</Link>
      </div>
    );
  }

  const praise = r.kind === 'praise';
  const biggest = fb.ripples.find(x => x.kind !== 'praise' && x.status !== 'closed')?.id === r.id;
  const said = r.tickets.filter(t => t.words);
  const followUps = r.tickets.filter(t => t.followUp && !t.followUpSent);
  const byStore = r.storeIds.map(s => ({ store: storeById(s), open: r.open.filter(t => t.storeId === s).length, all: r.tickets.filter(t => t.storeId === s).length }));
  const openStores = new Set(r.open.map(t => t.storeId)).size;

  const markFixed = () => {
    fb.setRipple(r.id, { status: 'watching' });
    setAnnounce(`Marked fixed. Edify is watching for: ${r.fixRule.charAt(0).toLowerCase()}${r.fixRule.slice(1)}`);
  };
  const close = () => {
    const n = r.tickets.filter(t => t.status === 'replied' || (t.status === 'open' && !t.words && t.stars < 5)).length;
    fb.closeRipple(r.id);
    setAnnounce(`Ripple closed. Edify drafted ${n} follow-ups. Nothing goes out until you send them.`);
  };
  const sendAll = () => {
    fb.sendFollowUps(followUps.map(t => t.id));
    setAnnounce(`Sent ${followUps.length} follow-ups. Those tickets are resolved.`);
  };

  return (
    <div style={{ maxWidth: 1120, margin: '0 auto', padding: '28px clamp(20px, 4vw, 40px) 64px', display: 'flex', flexDirection: 'column', gap: 28 }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 16 }}>
        <Link href="/feedback" style={{ ...secondaryBtn, padding: '0 14px 0 10px', fontWeight: 600 }}>
          <ArrowLeft size={18} aria-hidden /> Bronx district
        </Link>
        {!praise && <RippleSteps status={r.status} owner={r.owner} />}
      </div>

      <p role="status" aria-live="polite" style={announce ? {
        margin: 0, padding: '12px 16px', borderRadius: 12, fontSize: 14, fontWeight: 600, background: 'var(--color-review-light)', border: '1px solid var(--color-review-border)',
      } : srOnly}>
        {announce}
      </p>

      <section aria-labelledby="ripple-h" style={{ display: 'flex', flexWrap: 'wrap', gap: 32, alignItems: 'flex-start' }}>
        <div style={{ flex: '3 1 480px', minWidth: 0 }}>
          <CauseChip marker={praise ? 'heart' : biggest ? 'pink' : 'dot'}>{r.chip}</CauseChip>
          <h1 id="ripple-h" style={{ margin: '12px 0 8px', fontSize: 28, lineHeight: 1.15, fontWeight: 700 }}>{r.title}</h1>
          <p style={{ margin: 0, fontSize: 14, lineHeight: 1.5 }}>
            {r.detail.struck && (
              <>
                <span style={srOnly}>Changed from </span>
                <s style={{ textDecorationColor: 'var(--color-accent-pink)', textDecorationThickness: 2 }}>{r.detail.struck}</s>
              </>
            )}
            {r.detail.text}
          </p>
          {!praise && (
            <dl style={{ margin: '24px 0 0', display: 'grid', gridTemplateColumns: 'max-content 1fr', gap: '10px 20px', fontSize: 13.5, lineHeight: 1.5 }}>
              <dt style={{ fontWeight: 700 }}>Status</dt>
              <dd style={{ margin: 0, display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
                <OutlineChip>{rippleStatusText(r)}</OutlineChip>
                {r.done && <DoneChip>{r.done}</DoneChip>}
              </dd>
              <dt style={{ fontWeight: 700 }}>Owner</dt>
              <dd style={{ margin: 0 }}>{r.ownerSentence}</dd>
              <dt style={{ fontWeight: 700 }}>Closes when</dt>
              <dd style={{ margin: 0 }}>{r.fixRule}</dd>
              <dt style={{ fontWeight: 700 }}>Stores</dt>
              <dd style={{ margin: 0 }}>
                {byStore.map((s, i) => (
                  <span key={s.store.id}>{i > 0 && ', '}{s.store.name} ({s.all} {s.all === 1 ? 'ticket' : 'tickets'}{s.open !== s.all ? `, ${s.open} open` : ''})</span>
                ))}
              </dd>
            </dl>
          )}
        </div>

        <div style={{ flex: '2 1 300px', minWidth: 0, ...whiteCard, padding: 24, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <span style={{ fontSize: 48, fontWeight: 700, lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>{r.number}</span>
          <span style={{ fontSize: 14, lineHeight: 1.5 }}>{r.numberLabel(openStores)}</span>
          {r.support && r.numberKind === 'open' && <span style={{ fontSize: 14, lineHeight: 1.5 }}>{r.support}</span>}
          <div style={{ borderTop: hairline, paddingTop: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
            <Actions r={r} followUps={followUps} onMarkFixed={markFixed} onClose={close} onSendAll={sendAll} onTell={() => {
              fb.setRipple(r.id, { told: true });
              setAnnounce("Marked as told. It's in the Pelham Pkwy huddle notes.");
            }} />
          </div>
        </div>
      </section>

      {r.kind === 'late-delivery' && (
        <section aria-labelledby="evidence-h" style={{ ...whiteCard, padding: 24 }}>
          <h2 id="evidence-h" style={{ ...eyebrow, marginBottom: 14 }}>Bakery deliveries this week, from receiving in Ordering and Stock</h2>
          <DeliveryChart tone="light" />
        </section>
      )}

      {followUps.length > 0 && (
        <section aria-labelledby="fu-h" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <h2 id="fu-h" style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>Follow-ups to approve</h2>
          <p style={{ margin: 0, fontSize: 14 }}>Edify drafted one for every guest still open in this ripple. Nothing goes out until you send.</p>
          <ul style={{ ...whiteCard, margin: 0, padding: 0, listStyle: 'none', overflow: 'hidden' }}>
            {followUps.map((t, i) => (
              <li key={t.id} style={{ padding: '14px 18px', borderTop: i ? hairline : 0 }}>
                <p style={{ margin: '0 0 6px', fontSize: 13, fontWeight: 700 }}>
                  To {t.guest} · {SOURCE_LABEL[t.source]} · {t.store.name}
                </p>
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
                <blockquote style={{ ...quote, margin: 0, fontSize: 16, lineHeight: 1.4 }}>&ldquo;{t.words}&rdquo;</blockquote>
                <p style={{ margin: '4px 0 0', fontSize: 12.5, color: 'var(--color-text-secondary)' }}>{t.guest} · {SOURCE_LABEL[t.source]} · {t.stars} stars</p>
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

function RippleSteps({ status, owner }: { status: RippleStatus; owner: string }) {
  const at = status === 'decision' ? 0 : STEPS.indexOf(status);
  const label = (s: RippleStatus) => (s === 'with' ? (status === 'decision' ? 'Needs a decision' : `With ${owner}`) : s === 'watching' ? 'Fixed and watching' : 'Closed');
  return (
    <ol aria-label="Ripple status" style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 10, fontSize: 14 }}>
      {STEPS.map((s, i) => (
        <li key={s} aria-current={i === at ? 'step' : undefined} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {i > 0 && <span aria-hidden style={{ width: 24, height: 2, background: 'var(--color-border)' }} />}
          <span style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: i === at ? 700 : 400, color: i <= at ? 'var(--color-text-primary)' : 'var(--color-text-secondary)' }}>
            <span aria-hidden style={i <= at
              ? { width: 14, height: 14, borderRadius: '50%', background: 'var(--color-text-primary)' }
              : { width: 10, height: 10, borderRadius: '50%', border: '2px solid var(--color-text-secondary)' }} />
            {label(s)}
          </span>
        </li>
      ))}
    </ol>
  );
}

function Actions({ r, followUps, onMarkFixed, onClose, onSendAll, onTell }: {
  r: LiveRipple; followUps: LiveTicket[]; onMarkFixed: () => void; onClose: () => void; onSendAll: () => void; onTell: () => void;
}) {
  if (r.kind === 'praise') {
    return r.told ? <DoneChip>{r.action!.done}</DoneChip> : (
      <>
        <p style={{ margin: 0, fontSize: 14, lineHeight: 1.5 }}>Adds her name and what guests said to the Pelham Pkwy huddle notes.</p>
        <div><button type="button" onClick={onTell} style={primaryBtn}><Heart size={16} aria-hidden /> {r.action!.label}</button></div>
      </>
    );
  }
  if (r.status === 'decision' || r.status === 'with') {
    return (
      <>
        <p style={{ margin: 0, fontSize: 14, lineHeight: 1.5 }}>When {r.owner} has fixed it, mark it fixed. Edify then checks the data until: {r.fixRule.charAt(0).toLowerCase()}{r.fixRule.slice(1)}</p>
        <div><button type="button" onClick={onMarkFixed} style={primaryBtn}>Mark fixed</button></div>
      </>
    );
  }
  if (r.status === 'watching') {
    return (
      <>
        <p style={{ margin: 0, fontSize: 14, lineHeight: 1.5 }}>Fixed and watching. Close it when the data holds. Edify drafts a follow-up to each guest still open, for you to approve.</p>
        <div><button type="button" onClick={onClose} style={primaryBtn}>Close ripple</button></div>
      </>
    );
  }
  return followUps.length > 0 ? (
    <>
      <p style={{ margin: 0, fontSize: 14, lineHeight: 1.5 }}>Closed. {followUps.length} follow-ups are drafted below and waiting for you.</p>
      <div><button type="button" onClick={onSendAll} style={primaryBtn}><Send size={16} aria-hidden /> Send {followUps.length} follow-ups</button></div>
    </>
  ) : (
    <p style={{ margin: 0, fontSize: 14, lineHeight: 1.5 }}>Closed. Every guest in it has heard back.</p>
  );
}
