'use client';

import { useEffect, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { AlertCircle, Check, Loader2 } from 'lucide-react';
import { withAccepted } from './record';
import { freshEdits, gbp, hasPrices, review } from './review';
import { KIND_WORD } from './ReadingScreen';
import { SAMPLES, type SampleId } from './samples';
import { C, photoFor } from './ui';

// The Command Centre's version of reading a delivery: the photo lands in the
// chat, Edify reads it in place, and the card says what matched and what
// needs a person. The checking itself opens as a focused screen.

export type DeliveryCardStatus = 'reading' | 'ready' | 'accepted';

export interface DeliveryCardState {
  sampleId: SampleId;
  pages: number;
  status: DeliveryCardStatus;
  grnNumber?: string;
}

export type DeliveryFocus = { mode: 'capture' } | { mode: 'review'; msgId: string; sampleId: SampleId; pages: number };

const STEP_MS = 800;

function cap(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export default function DeliveryFeedCard({
  state,
  onReadDone,
  onReview,
  onAcceptNow,
  onRetake,
}: {
  state: DeliveryCardState;
  onReadDone: () => void;
  onReview: () => void;
  onAcceptNow: () => void;
  onRetake: () => void;
}) {
  const sample = withAccepted(SAMPLES[state.sampleId]);
  const [step, setStep] = useState(state.status === 'reading' ? 0 : 3);

  useEffect(() => {
    if (state.status !== 'reading') return;
    if (step >= 3) {
      onReadDone();
      return;
    }
    const t = window.setTimeout(() => setStep(s => s + 1), STEP_MS);
    return () => window.clearTimeout(t);
  }, [step, state.status, onReadDone]);

  const photo = photoFor(sample);
  const kind = KIND_WORD[sample.kind];
  const btn = (primary: boolean) =>
    ({
      minHeight: 44,
      padding: '0 18px',
      borderRadius: 10,
      border: primary ? 'none' : `1.5px solid ${C.border}`,
      background: primary ? C.navy : '#fff',
      color: primary ? '#fff' : C.ink,
      fontSize: 14,
      fontWeight: 600,
      fontFamily: 'var(--font-primary)',
      cursor: 'pointer',
    }) as const;

  const thumb = photo && (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={photo.pages[0].src} alt="Your photo" style={{ width: 54, height: 72, objectFit: 'cover', borderRadius: 6, border: `1px solid ${C.subtle}`, flexShrink: 0 }} />
  );

  if (state.status === 'reading' || step < 3) {
    const steps = ['Reading the photo', sample.poNumbers.length ? 'Finding your order' : 'Checking your products', 'Checking every line'];
    return (
      <div style={{ display: 'flex', gap: 14, marginTop: 4, whiteSpace: 'normal' }}>
        {thumb}
        <ul aria-live="polite" style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
          {steps.map((s, i) => (
            <li key={s} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, color: i <= step ? C.ink : C.muted, fontWeight: i === step ? 600 : 500 }}>
              {i < step ? <Check size={16} aria-hidden /> : i === step ? <Loader2 size={16} aria-hidden style={{ animation: 'spin 1s linear infinite' }} /> : <span style={{ width: 16 }} />}
              {s}
            </li>
          ))}
        </ul>
        <style>{'@keyframes spin { to { transform: rotate(360deg); } }'}</style>
      </div>
    );
  }

  const stop = (title: string, body: string, actions: ReactNode) => (
    <div style={{ display: 'flex', gap: 14, marginTop: 4, whiteSpace: 'normal' }}>
      {thumb}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 15, fontWeight: 600, color: C.ink }}>
          <AlertCircle size={18} aria-hidden style={{ flexShrink: 0 }} />
          {title}
        </div>
        <p style={{ margin: '4px 0 12px', fontSize: 14, color: C.muted, lineHeight: 1.5 }}>{body}</p>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>{actions}</div>
      </div>
    </div>
  );

  if (sample.blocked === 'unreadable') {
    return stop('I can\u2019t read this photo', 'Take it again with the whole page in the frame and less glare.', <button type="button" style={btn(true)} onClick={onRetake}>Take it again</button>);
  }
  if (sample.blocked === 'wrong-document') {
    return stop('This looks like a menu', 'Send a photo of a delivery note, invoice or shop receipt.', <button type="button" style={btn(true)} onClick={onRetake}>Take another</button>);
  }
  if (sample.blocked === 'duplicate' && state.status !== 'accepted') {
    return stop(
      'You\u2019ve already accepted this',
      `${sample.supplier} ${kind} ${sample.docNumber ?? ''} went in at ${sample.duplicateOf?.time} on ${sample.duplicateOf?.grnNumber}. Nothing has been received twice.`,
      <Link href="/receive/accepted" style={{ ...btn(false), display: 'inline-flex', alignItems: 'center', textDecoration: 'none' }}>
        See accepted deliveries
      </Link>,
    );
  }
  if (state.pages < sample.pages) {
    return stop(
      `This is page ${state.pages} of ${sample.pages}`,
      `Add page ${state.pages + 1} so nothing on the ${kind} gets missed.`,
      <button type="button" style={btn(true)} onClick={onRetake}>
        Take page {state.pages + 1}
      </button>,
    );
  }

  const r = review(sample, freshEdits(sample), {});
  const total = sample.lines.length;
  const allMatch = r.toCheck.length === 0;
  const meta = [`${cap(kind)}${sample.docNumber ? ` ${sample.docNumber}` : ''}`, sample.poNumbers.join(' + ') || 'no order', hasPrices(sample) ? gbp(sample.lines.reduce((s, l) => s + (l.price ?? 0) * (l.billed ?? l.got) * (1 + (l.vatRate ?? 0) / 100), 0)) : null]
    .filter(Boolean)
    .join(' \u00b7 ');

  return (
    <div style={{ marginTop: 4, whiteSpace: 'normal' }}>
      <div style={{ display: 'flex', gap: 14 }}>
        {thumb}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 15, fontWeight: 600, color: C.ink }}>{sample.supplier}</div>
          <div style={{ fontSize: 13, fontWeight: 500, color: C.muted }}>{meta}</div>
          <div style={{ marginTop: 6, fontSize: 18, fontWeight: 600, color: C.ink }}>{allMatch ? `All ${total} match` : `${r.matches.length} of ${total} match`}</div>
        </div>
      </div>
      {state.status === 'accepted' ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 12, fontSize: 14, fontWeight: 600, color: C.ink }}>
          <Check size={16} aria-hidden /> Accepted on {state.grnNumber}
        </div>
      ) : (
        <>
          {!allMatch && (
            <ul style={{ listStyle: 'none', margin: '12px 0 0', padding: 0, borderTop: `1px solid ${C.subtle}` }}>
              {r.toCheck.map(i => (
                <li key={i.key} style={{ padding: '8px 0', borderBottom: `1px solid ${C.subtle}`, fontSize: 14, lineHeight: 1.4 }}>
                  <span style={{ fontWeight: 600, color: C.ink }}>{i.issue.title}</span>
                  <span style={{ color: C.muted }}> &middot; {i.issue.detail}</span>
                </li>
              ))}
            </ul>
          )}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 12 }}>
            {allMatch ? (
              <>
                <button type="button" style={btn(true)} onClick={onAcceptNow}>
                  {sample.kind === 'receipt' ? 'Accept receipt' : 'Accept delivery'}
                </button>
                <button type="button" style={btn(false)} onClick={onReview}>
                  Look first
                </button>
              </>
            ) : (
              <button type="button" style={btn(true)} onClick={onReview}>
                Check {r.toCheck.length} and accept
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}
