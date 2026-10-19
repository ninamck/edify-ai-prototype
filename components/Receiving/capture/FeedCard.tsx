'use client';

import { useEffect, useId, useMemo, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { AlertCircle, Check, ChevronDown, ChevronRight, Loader2 } from 'lucide-react';
import { betterOrder, deliverySample, rematch } from './match';
import OrderSheet, { BetterOrder } from './OrderSheet';
import { acceptLabel, gbp, hasNoOrder, hasPrices, ORDER_KEY, orderWords, review, settledLines, setupDone, setupFor, SUPPLIER_KEY, type Answers, type CheckItem, type IssueKind, type LineEdit, type Setups } from './review';
import { KIND_WORD } from './ReadingScreen';
import { CheckCard, LineSheet } from './ReviewScreen';
import { ProductSetupSheet, SupplierSheet } from './SetupSheets';
import type { SampleId } from './samples';
import { C, InlineLink, keepIds, PhotoViewer, photoFor } from './ui';

// The Command Centre's version of checking a delivery: the photo lands in the
// chat, Edify reads it in place, and the whole check happens in the card.
// Answers are tapped here, changes are typed in the composer ("only 3 eggs"),
// and setup sheets, the line editor and the photo open as popups over the feed.

export type DeliveryCardStatus = 'reading' | 'ready' | 'accepted';

export interface DeliveryCardState {
  sampleId: SampleId;
  pages: number;
  status: DeliveryCardStatus;
  grnNumber?: string;
  /** The orders the person picked instead of Edify's match. Null keeps Edify's. */
  orders: string[] | null;
  edits: Record<string, LineEdit>;
  answers: Answers;
  setups: Setups;
}

export type DeliveryFocus = { mode: 'capture' };

type Popup = { kind: 'line'; lineId: string } | { kind: 'product'; lineId: string } | { kind: 'supplier' } | { kind: 'orders' } | { kind: 'photo'; focus?: string } | null;

const STEP_MS = 800;

function cap(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export default function DeliveryFeedCard({
  state,
  isPhone,
  onReadDone,
  onChange,
  onAccept,
  onRetake,
}: {
  state: DeliveryCardState;
  isPhone: boolean;
  onReadDone: () => void;
  onChange: (patch: Partial<DeliveryCardState>) => void;
  onAccept: () => void;
  onRetake: () => void;
}) {
  const sample = deliverySample(state.sampleId, state.orders);
  const [step, setStep] = useState(state.status === 'reading' ? 0 : 3);
  const [popup, setPopup] = useState<Popup>(null);
  const [showMatches, setShowMatches] = useState(false);
  const matchesId = useId();
  const { edits, answers, setups } = state;
  const r = useMemo(() => review(sample, edits, answers, setups), [sample, edits, answers, setups]);
  const better = useMemo(() => betterOrder(sample), [sample]);

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

  const thumbImg = photo && (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={photo.pages[0].src} alt="" style={{ width: 54, height: 72, objectFit: 'cover', borderRadius: 6, border: `1px solid ${C.subtle}`, display: 'block' }} />
  );
  const thumb =
    thumbImg && state.status !== 'reading' && step >= 3 ? (
      <button type="button" aria-label="Open your photo" onClick={() => setPopup({ kind: 'photo' })} style={{ padding: 0, border: 'none', background: 'none', cursor: 'zoom-in', flexShrink: 0, alignSelf: 'flex-start' }}>
        {thumbImg}
      </button>
    ) : (
      thumbImg && <span style={{ flexShrink: 0 }}>{thumbImg}</span>
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

  const total = r.lineCount;
  const allMatch = r.toCheck.length === 0;
  const noOrder = hasNoOrder(sample);
  const title = noOrder && !answers[ORDER_KEY] ? 'No order found' : r.matches.length === total ? `All ${total} match` : `${r.matches.length} of ${total} match`;
  const meta = [`${cap(kind)}${sample.docNumber ? ` ${sample.docNumber}` : ''}`, sample.kind === 'receipt' ? null : sample.poNumbers.join(' + ') || 'No order', hasPrices(sample) ? gbp(sample.lines.reduce((s, l) => s + (l.price ?? 0) * (l.billed ?? l.got) * (1 + (l.vatRate ?? 0) / 100), 0)) : null]
    .filter(Boolean)
    .join(' \u00b7 ');
  const accepted = state.status === 'accepted';

  const answer = (item: CheckItem, choice: string) => {
    onChange({ answers: { ...answers, [item.key]: { kind: item.issue.kind, choice } } });
    if (setupFor(item, choice) === 'product' && !setupDone(item, setups) && item.line) setPopup({ kind: 'product', lineId: item.line.id });
  };
  const edit = (lineId: string, patch: Partial<LineEdit>) => onChange({ edits: { ...edits, [lineId]: { ...edits[lineId], ...patch } } });
  const answerKind = (key: string, kind: IssueKind, choice: string) => ({ ...answers, [key]: { kind, choice } });

  const popupLine =
    popup?.kind === 'line' ? settledLines(sample, answers).find(l => l.id === popup.lineId) : popup?.kind === 'product' ? sample.lines.find(l => l.id === popup.lineId) : undefined;

  return (
    <div style={{ marginTop: 4, whiteSpace: 'normal' }}>
      <div style={{ display: 'flex', gap: 14 }}>
        {thumb}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 15, fontWeight: 600, color: C.ink }}>{sample.supplier}</div>
          <div style={{ fontSize: 13, fontWeight: 500, color: C.muted }}>{meta}</div>
          <div style={{ marginTop: 6, fontSize: 18, fontWeight: 600, color: C.ink }}>{title}</div>
        </div>
      </div>
      {!accepted && sample.kind !== 'receipt' && !noOrder && (
        <p style={{ margin: '10px 0 0', fontSize: 13, color: C.muted, lineHeight: 1.45 }}>
          {keepIds(`Checked against ${orderWords(sample)}.`)} <InlineLink onClick={() => setPopup({ kind: 'orders' })}>Wrong order?</InlineLink>
        </p>
      )}
      {!accepted && better && <BetterOrder po={better} sample={sample} onUse={() => onChange(rematch(state.sampleId, [better.poNumber], { edits, answers }))} />}

      {accepted ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 12, fontSize: 14, fontWeight: 600, color: C.ink }}>
          <Check size={16} aria-hidden /> Accepted on {state.grnNumber}
        </div>
      ) : (
        <>
          {!allMatch && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 14 }}>
              {r.toCheck.map(item => (
                <CheckCard
                  key={item.key}
                  item={item}
                  answers={answers}
                  setups={setups}
                  onAnswer={id => answer(item, id)}
                  onOpen={item.line ? () => setPopup({ kind: 'line', lineId: item.line!.id }) : undefined}
                  onSetup={() => setPopup(item.issue.kind === 'new-supplier' ? { kind: 'supplier' } : { kind: 'product', lineId: item.line!.id })}
                  onPickOrder={() => setPopup({ kind: 'orders' })}
                  onHover={() => {}}
                />
              ))}
            </div>
          )}

          {r.matches.length > 0 && (
            <div style={{ marginTop: 10 }}>
              <button
                type="button"
                aria-expanded={showMatches}
                aria-controls={matchesId}
                onClick={() => setShowMatches(v => !v)}
                style={{ display: 'flex', alignItems: 'center', gap: 6, minHeight: 36, padding: 0, border: 'none', background: 'none', fontSize: 14, fontWeight: 600, color: C.ink, fontFamily: 'var(--font-primary)', cursor: 'pointer' }}
              >
                {showMatches ? <ChevronDown size={18} aria-hidden /> : <ChevronRight size={18} aria-hidden />}
                {allMatch ? `See all ${total} lines` : `${r.matches.length} matched`}
              </button>
              {showMatches && (
                <ul id={matchesId} style={{ listStyle: 'none', margin: '4px 0 0', padding: 0, borderTop: `1px solid ${C.subtle}` }}>
                  {r.matches.map(l => (
                    <li key={l.id} style={{ borderBottom: `1px solid ${C.subtle}` }}>
                      <button
                        type="button"
                        onClick={() => setPopup({ kind: 'line', lineId: l.id })}
                        style={{ display: 'flex', alignItems: 'center', gap: 12, width: '100%', minHeight: 40, padding: '6px 2px', border: 'none', background: 'none', textAlign: 'left', fontSize: 14, color: C.ink, fontFamily: 'var(--font-primary)', cursor: 'pointer' }}
                      >
                        <span style={{ flex: 1, minWidth: 0 }}>{l.name}</span>
                        <span style={{ fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{l.ordered == null ? edits[l.id].got : `${edits[l.id].got} / ${l.ordered}`}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          <p style={{ margin: '10px 0 0', fontSize: 13, color: C.muted, lineHeight: 1.45 }}>
            Something different? Type it below, like &ldquo;only 3 eggs&rdquo; or &ldquo;2 eggs broken&rdquo;.
          </p>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginTop: 12 }}>
            <button type="button" style={{ ...btn(r.open === 0), cursor: r.open > 0 ? 'not-allowed' : 'pointer', opacity: r.open > 0 ? 0.6 : 1 }} disabled={r.open > 0} onClick={onAccept}>
              {r.open > 0 ? (sample.kind === 'receipt' ? 'Accept receipt' : 'Accept delivery') : acceptLabel(sample, r)}
            </button>
            {r.open > 0 && (
              <span role="status" style={{ fontSize: 14, fontWeight: 600, color: C.ink }}>
                {r.open} {r.open === 1 ? 'needs' : 'need'} your answer
              </span>
            )}
          </div>
        </>
      )}

      {popup?.kind === 'line' && popupLine && (
        <LineSheet
          sample={sample}
          line={popupLine}
          edit={edits[popupLine.id]}
          isPhone={isPhone}
          showCrop
          onEdit={patch => edit(popupLine.id, patch)}
          onClose={() => setPopup(null)}
          onOpenPhoto={() => setPopup({ kind: 'photo', focus: popupLine.id })}
        />
      )}
      {popup?.kind === 'product' && popupLine?.setup && (
        <ProductSetupSheet
          sample={sample}
          initial={setups.products[popupLine.id] ?? popupLine.setup}
          isPhone={isPhone}
          onClose={() => setPopup(null)}
          onSave={p => {
            onChange({ setups: { ...setups, products: { ...setups.products, [popupLine.id]: p } } });
            setPopup(null);
          }}
        />
      )}
      {popup?.kind === 'supplier' && sample.supplierSeed && (
        <SupplierSheet
          initial={setups.supplier ?? sample.supplierSeed}
          site={sample.site}
          isPhone={isPhone}
          onClose={() => setPopup(null)}
          onSave={s => {
            onChange({ setups: { ...setups, supplier: s }, answers: answerKind(SUPPLIER_KEY, 'new-supplier', 'add') });
            setPopup(null);
          }}
        />
      )}
      {popup?.kind === 'orders' && (
        <OrderSheet
          sample={sample}
          isPhone={isPhone}
          onClose={() => setPopup(null)}
          onPick={next => {
            onChange(rematch(state.sampleId, next, { edits, answers }));
            setPopup(null);
          }}
        />
      )}
      {popup?.kind === 'photo' && <PhotoViewer sample={sample} focusLineId={popup.focus} onClose={() => setPopup(null)} />}
    </div>
  );
}
