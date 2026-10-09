'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { recordPhotoDelivery, undoPhotoDelivery, type GRN, type POSnapshot, type PhotoSource } from '@/components/Receiving/mockData';
import CaptureStep from './CaptureStep';
import CleanStep, { type MatchedPlan } from './CleanStep';
import ConfirmStep from './ConfirmStep';
import DoneStep from './DoneStep';
import type { CardContext } from './ExceptionCards';
import { PhotoViewer } from './PhotoParts';
import ReadingStep, { DuplicateState, UnreadableState, WrongDocState } from './ReadingStep';
import { PoReview, ReceiptReview } from './ReviewStep';
import WhichOrdersStep from './WhichOrdersStep';
import {
  PO_DOCUMENTS,
  RECEIVED_BY,
  RETAIL_SUPPLIERS,
  SAMPLE_DOCUMENTS,
  SITE,
  clearFingerprint,
  findFingerprint,
  fingerprintFor,
  isPoDocument,
  saveFingerprint,
  type SampleId,
} from './fixtures';
import { buildPoPlan, buildReceiptPlan, effectivePoPlans, initialReceiptDecisions, type WritePlan } from './resolve';
import type { AddedLine, CapturedPage, Decisions, Step } from './types';

export interface CommitResult {
  grn: GRN;
  snapshot: POSnapshot[];
  plan: WritePlan;
  time: string;
}

const STEP_LABELS = { photo: 'Photo', orders: 'Orders', review: 'Review', confirm: 'Confirm' } as const;
type TrackKey = keyof typeof STEP_LABELS;

function trackKey(step: Step): TrackKey {
  if (step === 'whichOrders') return 'orders';
  if (step === 'review') return 'review';
  if (step === 'clean' || step === 'confirm' || step === 'done') return 'confirm';
  return 'photo';
}

const SOURCE_BY_KIND: Record<string, PhotoSource> = {
  'delivery-note': 'photo-delivery-note',
  invoice: 'photo-invoice',
  receipt: 'photo-receipt',
};

let pageSeq = 0;
let addedSeq = 0;

export default function PhotoCaptureFlow() {
  const [step, setStep] = useState<Step>('capture');
  const [pages, setPages] = useState<CapturedPage[]>([]);
  const [notice, setNotice] = useState<string | null>(null);
  const [selectedPoIds, setSelectedPoIds] = useState<string[]>([]);
  const [decisions, setDecisions] = useState<Decisions>({});
  const [added, setAdded] = useState<AddedLine[]>([]);
  const [offContract, setOffContract] = useState(true);
  const [result, setResult] = useState<CommitResult | null>(null);
  const [viewer, setViewer] = useState<{ lineId?: string } | null>(null);

  const rootRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    rootRef.current?.scrollIntoView({ block: 'start' });
  }, [step]);

  const createdUrls = useRef(new Set<string>());
  const keptUrls = useRef(new Set<string>());
  useEffect(() => {
    const created = createdUrls.current;
    const kept = keptUrls.current;
    return () => {
      created.forEach(u => { if (!kept.has(u)) URL.revokeObjectURL(u); });
    };
  }, []);

  // A real photo has no fixture of its own, so it reads as the receipt.
  const sampleId: SampleId | null = pages[0]?.sampleId ?? null;
  const docId: SampleId = sampleId ?? 'sainsburys';
  const doc = SAMPLE_DOCUMENTS[docId];
  const poDocId = isPoDocument(docId) ? docId : null;
  const poDoc = poDocId ? PO_DOCUMENTS[poDocId] : null;
  const fpKey = fingerprintFor(sampleId);
  const duplicate = findFingerprint(fpKey);

  /** True when the paper matches its orders line for line before anyone reports a problem. */
  const allClean = !!poDocId && !!poDoc && effectivePoPlans(poDocId, poDoc.candidatePoIds).every(p => p.kind === 'clean');

  const resetToCapture = (message: string | null) => {
    setPages([]);
    setDecisions({});
    setAdded([]);
    setSelectedPoIds([]);
    setResult(null);
    setViewer(null);
    setNotice(message);
    setStep('capture');
  };

  const pickSample = (id: SampleId) => {
    const n = SAMPLE_DOCUMENTS[id].pages;
    setPages(Array.from({ length: n }, () => ({ id: `page-${++pageSeq}`, sampleId: id })));
    setNotice(null);
  };

  const addPhoto = (file: File) => {
    const url = URL.createObjectURL(file);
    createdUrls.current.add(url);
    const page: CapturedPage = { id: `page-${++pageSeq}`, sampleId: null, imageUrl: url };
    setPages(prev => (prev.some(p => p.sampleId) ? [page] : [...prev, page]));
    setNotice(null);
  };

  const removePage = (id: string) => setPages(prev => prev.filter(p => p.id !== id));

  const finishReading = useCallback(() => {
    if (doc.kind === 'menu') { setStep('wrongDoc'); return; }
    if (doc.kind === 'unreadable') { setStep('unreadable'); return; }
    if (duplicate) { setStep('duplicate'); return; }
    if (poDoc) {
      setSelectedPoIds(poDoc.candidatePoIds);
      setDecisions({});
      setAdded([]);
      setStep(poDoc.askWhichOrders ? 'whichOrders' : allClean ? 'clean' : 'review');
      return;
    }
    const supplier = RETAIL_SUPPLIERS.find(s => s.name === doc.supplierName);
    setDecisions(initialReceiptDecisions());
    setOffContract(!supplier?.allowOrdering);
    setStep('review');
  }, [doc, duplicate, poDoc, allClean]);

  const plan = (): WritePlan =>
    poDocId ? buildPoPlan(poDocId, selectedPoIds, decisions, added) : buildReceiptPlan(decisions, offContract);

  const decide = (lineId: string, patch: Decisions[string]) =>
    setDecisions(prev => ({ ...prev, [lineId]: { ...prev[lineId], ...patch } }));

  const addLine = (line: Omit<AddedLine, 'id'>) => setAdded(prev => [...prev, { ...line, id: `a${++addedSeq}` }]);
  const removeLine = (id: string) => setAdded(prev => prev.filter(a => a.id !== id));

  /** Back out of review to the one-tap screen: drop reported problems, keep any price corrections. */
  const backToClean = () => {
    setDecisions(prev => Object.fromEntries(Object.entries(prev).map(([k, v]) => [k, { price: v.price }])));
    setSelectedPoIds(poDoc!.candidatePoIds);
    setStep('clean');
  };

  /** After the GM picks orders: straight to one-tap accept if every line still matches, else review. */
  const afterOrders = () => {
    const stillClean = !!poDocId && effectivePoPlans(poDocId, selectedPoIds, decisions).every(p => p.kind === 'clean');
    setStep(stillClean ? 'clean' : 'review');
  };

  const commit = () => {
    const p = plan();
    const source = SOURCE_BY_KIND[doc.kind] ?? 'photo-receipt';
    const { grn, snapshot } = recordPhotoDelivery({
      supplier: p.supplier,
      site: SITE,
      source,
      offContract: doc.kind === 'receipt' && offContract,
      invoiceNumber: doc.kind === 'invoice' ? doc.docNumber : undefined,
      deliveryNoteNumber: doc.kind === 'delivery-note' ? doc.docNumber : undefined,
      receivedBy: RECEIVED_BY,
      photo: { sampleId: sampleId ?? undefined, imageUrl: pages[0]?.imageUrl, pages: pages.length },
      lines: p.grnLines,
      poUpdate: poDocId ? { pos: p.pos, lines: p.commitLines, alternatives: p.alternatives } : undefined,
    });
    pages.forEach(pg => { if (pg.imageUrl) keptUrls.current.add(pg.imageUrl); });
    const time = new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
    saveFingerprint(fpKey, { grnId: grn.id, grnNumber: grn.grnNumber, time });
    setResult({ grn, snapshot, plan: p, time });
    setStep('done');
  };

  const undo = () => {
    if (!result) return;
    undoPhotoDelivery(result.grn.id, result.snapshot);
    clearFingerprint(fpKey);
    resetToCapture(`Undone. ${result.grn.grnNumber} is removed, the orders are back as they were and any new products are gone. Nothing else changed.`);
  };

  const back = (): (() => void) | null => {
    switch (step) {
      case 'reading':
      case 'wrongDoc':
      case 'unreadable':
      case 'duplicate':
      case 'whichOrders':
      case 'clean':
        return () => setStep('capture');
      case 'review':
        if (poDoc?.askWhichOrders) return () => setStep('whichOrders');
        if (allClean) return backToClean;
        return () => setStep('capture');
      case 'confirm':
        return () => setStep('review');
      default:
        return null;
    }
  };
  const goBack = back();

  const track: TrackKey[] =
    poDoc?.askWhichOrders || step === 'whichOrders' ? ['photo', 'orders', 'review', 'confirm']
      : step === 'clean' ? ['photo', 'confirm']
        : ['photo', 'review', 'confirm'];
  const current = track.indexOf(trackKey(step));

  const ctx: CardContext = {
    doc,
    photoId: sampleId,
    openPhoto: lineId => setViewer({ lineId }),
  };

  // A line whose price the GM pushed past the tolerance stays on this screen: its quantity still matches.
  const cleanPlans = poDocId
    ? effectivePoPlans(poDocId, selectedPoIds, decisions).filter((p): p is MatchedPlan => p.kind === 'clean' || p.kind === 'price-held')
    : [];

  return (
    <div ref={rootRef} style={{ maxWidth: 520, margin: '0 auto', padding: '16px 16px 48px', fontFamily: 'var(--font-primary)', scrollMarginTop: 80 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 14, minHeight: 40 }}>
        {step === 'capture' ? (
          <Link href="/receive" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, minHeight: 40, fontSize: 14, fontWeight: 600, color: 'var(--color-accent-deep)', textDecoration: 'none' }}>
            <ArrowLeft size={18} aria-hidden /> Deliveries
          </Link>
        ) : goBack ? (
          <button type="button" onClick={goBack} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, minHeight: 40, padding: 0, background: 'none', border: 'none', fontSize: 14, fontWeight: 600, color: 'var(--color-accent-deep)', fontFamily: 'var(--font-primary)', cursor: 'pointer' }}>
            <ArrowLeft size={18} aria-hidden /> Back
          </button>
        ) : <span />}
        <p aria-live="polite" style={{ margin: 0, fontSize: 13, fontWeight: 600, color: 'var(--color-text-secondary)' }}>
          {step === 'done' ? 'Done' : `Step ${current + 1} of ${track.length}: ${STEP_LABELS[track[current]]}`}
        </p>
      </div>
      <div aria-hidden style={{ display: 'flex', gap: 4, marginBottom: 20 }}>
        {track.map((k, i) => (
          <div key={k} style={{ flex: 1, height: 4, borderRadius: 2, background: i <= current || step === 'done' ? 'var(--color-accent-active)' : 'var(--color-border)' }} />
        ))}
      </div>

      {step === 'capture' && (
        <CaptureStep
          pages={pages}
          notice={notice}
          onAddPhoto={addPhoto}
          onPickSample={pickSample}
          onRemovePage={removePage}
          onDone={() => setStep('reading')}
        />
      )}
      {step === 'reading' && (
        <ReadingStep
          doc={doc}
          pages={pages}
          stopAfter={doc.kind === 'menu' || doc.kind === 'unreadable' ? 0 : duplicate ? 1 : undefined}
          onComplete={finishReading}
        />
      )}
      {step === 'wrongDoc' && <WrongDocState page={pages[0]} onRetake={() => resetToCapture(null)} />}
      {step === 'unreadable' && <UnreadableState page={pages[0]} onRetake={() => resetToCapture(null)} />}
      {step === 'duplicate' && duplicate && <DuplicateState doc={doc} fingerprint={duplicate} onRetake={() => resetToCapture(null)} />}
      {step === 'whichOrders' && poDocId && (
        <WhichOrdersStep
          docId={poDocId}
          selected={selectedPoIds}
          onChange={setSelectedPoIds}
          onContinue={afterOrders}
        />
      )}
      {step === 'clean' && poDocId && (
        <CleanStep
          doc={doc}
          plans={cleanPlans}
          plan={plan()}
          decisions={decisions}
          added={added}
          onOpenPhoto={() => setViewer({})}
          onReport={(lineId, problem, affected) => { decide(lineId, { problem, affected }); setStep('review'); }}
          onPrice={(lineId, price) => decide(lineId, { price })}
          onAdd={addLine}
          onRemoveAdded={removeLine}
          onAccept={commit}
          onChangeOrders={() => setStep('whichOrders')}
        />
      )}
      {step === 'review' && poDocId && (
        <PoReview
          ctx={ctx}
          docId={poDocId}
          selectedPoIds={selectedPoIds}
          decisions={decisions}
          onDecide={decide}
          onContinue={() => setStep('confirm')}
          onChangeOrders={() => setStep('whichOrders')}
        />
      )}
      {step === 'review' && !poDocId && (
        <ReceiptReview
          ctx={ctx}
          offContract={offContract}
          decisions={decisions}
          onDecide={decide}
          onContinue={() => setStep('confirm')}
        />
      )}
      {step === 'confirm' && (
        <ConfirmStep doc={doc} plan={plan()} onConfirm={commit} onEdit={() => setStep('review')} />
      )}
      {step === 'done' && result && (
        <DoneStep result={result} onUndo={undo} onAnother={() => resetToCapture(null)} />
      )}

      {viewer && sampleId && <PhotoViewer sampleId={sampleId} lineId={viewer.lineId} onClose={() => setViewer(null)} />}
    </div>
  );
}
