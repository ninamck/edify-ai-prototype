'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { recordPhotoDelivery, undoPhotoDelivery, type GRN, type POSnapshot } from '@/components/Receiving/mockData';
import CaptureStep from './CaptureStep';
import ReadingStep, { DuplicateState, WrongDocState } from './ReadingStep';
import WhichOrdersStep from './WhichOrdersStep';
import ReviewStep from './ReviewStep';
import ConfirmStep from './ConfirmStep';
import DoneStep from './DoneStep';
import {
  INVOICE_CANDIDATE_PO_IDS,
  RECEIVED_BY,
  RETAIL_SUPPLIERS,
  SAMPLE_DOCUMENTS,
  clearFingerprint,
  findFingerprint,
  fingerprintFor,
  saveFingerprint,
  type SampleId,
} from './fixtures';
import { buildInvoicePlan, buildReceiptPlan, initialReceiptDecisions, type WritePlan } from './resolve';
import type { CapturedPage, Decisions, Step } from './types';

export interface CommitResult {
  grn: GRN;
  snapshot: POSnapshot[];
  plan: WritePlan;
  time: string;
}

const STEP_LABELS = { photo: 'Photo', orders: 'Orders', review: 'Review', confirm: 'Confirm' } as const;

function stepTrack(isInvoice: boolean): (keyof typeof STEP_LABELS)[] {
  return isInvoice ? ['photo', 'orders', 'review', 'confirm'] : ['photo', 'review', 'confirm'];
}

function trackKey(step: Step): keyof typeof STEP_LABELS {
  if (step === 'whichOrders') return 'orders';
  if (step === 'review') return 'review';
  if (step === 'confirm' || step === 'done') return 'confirm';
  return 'photo';
}

let pageSeq = 0;

export default function PhotoCaptureFlow() {
  const [step, setStep] = useState<Step>('capture');
  const [pages, setPages] = useState<CapturedPage[]>([]);
  const [notice, setNotice] = useState<string | null>(null);
  const [selectedPoIds, setSelectedPoIds] = useState<string[]>(INVOICE_CANDIDATE_PO_IDS);
  const [decisions, setDecisions] = useState<Decisions>({});
  const [offContract, setOffContract] = useState(true);
  const [result, setResult] = useState<CommitResult | null>(null);

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
  const doc = SAMPLE_DOCUMENTS[sampleId ?? 'sainsburys'];
  const isInvoice = doc.kind === 'invoice';
  const fpKey = fingerprintFor(sampleId);
  const duplicate = findFingerprint(fpKey);

  const resetToCapture = (message: string | null) => {
    setPages([]);
    setDecisions({});
    setSelectedPoIds(INVOICE_CANDIDATE_PO_IDS);
    setResult(null);
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
    if (duplicate) { setStep('duplicate'); return; }
    if (doc.kind === 'invoice') {
      setSelectedPoIds(INVOICE_CANDIDATE_PO_IDS);
      setDecisions({});
      setStep('whichOrders');
      return;
    }
    const supplier = RETAIL_SUPPLIERS.find(s => s.name === doc.supplierName);
    setDecisions(initialReceiptDecisions());
    setOffContract(!supplier?.allowOrdering);
    setStep('review');
  }, [doc, duplicate]);

  const plan = (): WritePlan =>
    isInvoice ? buildInvoicePlan(selectedPoIds, decisions) : buildReceiptPlan(decisions, offContract);

  const commit = () => {
    const p = plan();
    const { grn, snapshot } = recordPhotoDelivery({
      supplier: p.supplier,
      site: 'Fitzroy Espresso',
      source: isInvoice ? 'photo-invoice' : 'photo-receipt',
      offContract: !isInvoice && offContract,
      invoiceNumber: doc.docNumber,
      receivedBy: RECEIVED_BY,
      photo: { sampleId: sampleId ?? undefined, imageUrl: pages[0]?.imageUrl, pages: pages.length },
      lines: p.grnLines,
      poUpdate: isInvoice ? { pos: p.pos, lines: p.commitLines, alternatives: p.alternatives } : undefined,
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
      case 'duplicate':
      case 'whichOrders':
        return () => setStep('capture');
      case 'review':
        return () => setStep(isInvoice ? 'whichOrders' : 'capture');
      case 'confirm':
        return () => setStep('review');
      default:
        return null;
    }
  };
  const goBack = back();

  const track = stepTrack(isInvoice);
  const current = track.indexOf(trackKey(step));

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
          stopAfter={doc.kind === 'menu' ? 0 : duplicate ? 1 : undefined}
          onComplete={finishReading}
        />
      )}
      {step === 'wrongDoc' && <WrongDocState doc={doc} onRetake={() => resetToCapture(null)} />}
      {step === 'duplicate' && duplicate && <DuplicateState doc={doc} fingerprint={duplicate} onRetake={() => resetToCapture(null)} />}
      {step === 'whichOrders' && (
        <WhichOrdersStep
          doc={doc}
          selected={selectedPoIds}
          onChange={setSelectedPoIds}
          onContinue={() => setStep('review')}
        />
      )}
      {step === 'review' && (
        <ReviewStep
          doc={doc}
          isInvoice={isInvoice}
          selectedPoIds={selectedPoIds}
          decisions={decisions}
          onDecide={(lineId, patch) => setDecisions(prev => ({ ...prev, [lineId]: { ...prev[lineId], ...patch } }))}
          onContinue={() => setStep('confirm')}
        />
      )}
      {step === 'confirm' && (
        <ConfirmStep doc={doc} isInvoice={isInvoice} plan={plan()} onConfirm={commit} onEdit={() => setStep('review')} />
      )}
      {step === 'done' && result && (
        <DoneStep result={result} onUndo={undo} onAnother={() => resetToCapture(null)} />
      )}
    </div>
  );
}
