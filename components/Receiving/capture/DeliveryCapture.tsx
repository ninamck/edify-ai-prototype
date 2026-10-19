'use client';

import { useCallback, useRef, useState, type ReactNode } from 'react';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import CaptureScreen from './CaptureScreen';
import DoneScreen from './DoneScreen';
import ReadingScreen from './ReadingScreen';
import ReviewScreen from './ReviewScreen';
import { deliverySample, rematch } from './match';
import { recordCapture, type Recorded } from './record';
import { freshEdits, NO_SETUPS, type Answers, type IssueKind, type LineEdit, type Setups } from './review';
import { DEFAULT_SAMPLE, poIdFor, sampleForPo, type Sample, type SampleId } from './samples';
import { C, Layer, Popup, useMounted } from './ui';

type Stage = 'capture' | 'reading' | 'review' | 'done';

interface Props {
  initialSample?: SampleId;
  /** Started from one delivery: the paper is known. */
  poId?: string;
  /** 'review' skips the camera because the photo was already read in the feed. */
  startAt?: 'capture' | 'review';
  initialPages?: number;
  /** 'panel' is the Command Centre's focused screen: full screen on a phone, a wide panel on desktop. */
  presentation?: 'screen' | 'panel';
  onClose: () => void;
  onViewAccepted?: () => void;
  /** Hand the photo back instead of reading it here. The feed reads it. */
  onCaptured?: (sampleId: SampleId, pages: number) => void;
  /** Hand the result back instead of showing the done screen. The feed posts it. */
  onAccepted?: (sample: Sample, rec: Recorded) => void;
}

/** Photo a delivery note, invoice or receipt, check it, accept it. */
export default function DeliveryCapture({
  initialSample,
  poId,
  startAt = 'capture',
  initialPages = 0,
  presentation = 'screen',
  onClose,
  onViewAccepted,
  onCaptured,
  onAccepted,
}: Props) {
  const mounted = useMounted();
  const isPhone = useMediaQuery('(max-width: 640px)');
  const isWide = useMediaQuery('(min-width: 1100px)');
  const contextSample = poId ? sampleForPo(poId) : null;
  const [sampleId, setSampleId] = useState<SampleId>(contextSample ?? initialSample ?? DEFAULT_SAMPLE);
  /** The orders the person picked instead of Edify's match. Null keeps Edify's. */
  const [orders, setOrders] = useState<string[] | null>(null);
  const matched = deliverySample(sampleId, orders);
  const contextPo = contextSample ? matched.poNumbers.find(p => poIdFor(p) === poId) : undefined;
  const sample: Sample = contextPo && orders == null ? { ...matched, matchedBy: 'start' } : matched;

  const [stage, setStage] = useState<Stage>(startAt);
  const [pagesTaken, setPagesTaken] = useState(initialPages);
  const [captureKey, setCaptureKey] = useState(0);
  const [edits, setEdits] = useState<Record<string, LineEdit>>(() => freshEdits(deliverySample(sampleId)));
  const [answers, setAnswers] = useState<Answers>({});
  const [setups, setSetups] = useState<Setups>(NO_SETUPS);
  const [done, setDone] = useState<Recorded | null>(null);

  // A sample tile picks and finishes in one tap, before state catches up.
  const pickedRef = useRef(sampleId);

  const restart = (id: SampleId = sampleId, keepPages = 0) => {
    pickedRef.current = id;
    setSampleId(id);
    setOrders(null);
    setEdits(freshEdits(deliverySample(id)));
    setAnswers({});
    setSetups(NO_SETUPS);
    setPagesTaken(keepPages);
    setCaptureKey(k => k + 1);
    setStage('capture');
  };

  const onReady = useCallback(() => setStage('review'), []);

  const onEdit = (lineId: string, patch: Partial<LineEdit>) => setEdits(prev => ({ ...prev, [lineId]: { ...prev[lineId], ...patch } }));
  const onAnswer = (key: string, kind: IssueKind, choice: string) => setAnswers(prev => ({ ...prev, [key]: { kind, choice } }));

  const accept = () => {
    const rec = recordCapture(sample, edits, answers, setups);
    if (onAccepted) {
      onAccepted(sample, rec);
      return;
    }
    setDone(rec);
    setStage('done');
  };

  if (!mounted) return null;

  const content = (
    <>
      {stage === 'capture' && (
        <CaptureScreen
          key={captureKey}
          sample={sample}
          contextPo={contextPo}
          isPhone={isPhone}
          initialTaken={pagesTaken}
          onSampleChange={id => restart(id)}
          onDone={n => {
            if (onCaptured) {
              onCaptured(pickedRef.current, n);
              return;
            }
            setPagesTaken(n);
            setStage('reading');
          }}
          onClose={onClose}
        />
      )}
      {stage === 'reading' && (
        <ReadingScreen
          sample={sample}
          pagesTaken={pagesTaken}
          contextPo={contextPo}
          onReady={onReady}
          onRetake={() => restart(sampleId, pagesTaken < sample.pages ? pagesTaken : 0)}
          onClose={onClose}
          onViewAccepted={onViewAccepted ?? onClose}
        />
      )}
      {stage === 'review' && (
        <ReviewScreen
          sample={sample}
          edits={edits}
          answers={answers}
          setups={setups}
          isPhone={isPhone}
          isWide={isWide}
          backLabel={startAt === 'review' ? 'Close' : undefined}
          onEdit={onEdit}
          onAnswer={onAnswer}
          onSetupProduct={(lineId, p) => setSetups(prev => ({ ...prev, products: { ...prev.products, [lineId]: p } }))}
          onSetupSupplier={s => setSetups(prev => ({ ...prev, supplier: s }))}
          onPickOrders={next => {
            const r = rematch(sampleId, next, { edits, answers });
            setOrders(r.orders);
            setEdits(r.edits);
            setAnswers(r.answers);
          }}
          onBack={startAt === 'review' ? onClose : () => restart()}
          onAccept={accept}
        />
      )}
      {stage === 'done' && done && (
        <DoneScreen
          sample={sample}
          grnId={done.grn.id}
          grnNumber={done.grn.grnNumber}
          lines={done.outcomes}
          creditRefs={done.creditNotes.map(n => n.ref)}
          onFinish={onClose}
          onAnother={() => restart()}
          onUndo={() => {
            done.undo();
            setDone(null);
            setStage('review');
          }}
        />
      )}
    </>
  );

  if (!isPhone && (stage === 'capture' || stage === 'reading')) {
    return (
      <Popup label={contextPo ? `Photo for ${contextPo}` : 'Photo a delivery'} onClose={onClose}>
        {content}
      </Popup>
    );
  }
  if (presentation === 'panel' && !isPhone) {
    return (
      <Layer label="Photo a delivery" background="rgba(0,28,53,0.45)">
        <Panel>{content}</Panel>
      </Layer>
    );
  }
  return <Layer label="Photo a delivery">{content}</Layer>;
}

function Panel({ children }: { children: ReactNode }) {
  return (
    <div style={{ flex: 1, display: 'flex', justifyContent: 'flex-end', minHeight: 0 }}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Photo a delivery"
        style={{
          width: 'min(1320px, 96vw)',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          background: C.page,
          boxShadow: '-12px 0 40px rgba(0,28,53,0.22)',
        }}
      >
        {children}
      </div>
    </div>
  );
}
