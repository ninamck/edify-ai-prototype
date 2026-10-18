'use client';

import { useEffect, useMemo, useState } from 'react';
import { AlertCircle, Check, Loader2, X } from 'lucide-react';
import { freshEdits, review } from './review';
import type { Sample } from './samples';
import { C, IconButton, keepIds, photoFor, PrimaryButton, SecondaryButton } from './ui';

const STEP_MS = 850;

export const KIND_WORD: Record<Sample['kind'], string> = {
  'delivery-note': 'delivery note',
  invoice: 'invoice',
  receipt: 'receipt',
  menu: 'menu',
};

function cap(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

interface Step {
  doing: string;
  done: string;
}

type Stop = 'unreadable' | 'wrong-document' | 'duplicate' | 'missing-page';

interface Props {
  sample: Sample;
  pagesTaken: number;
  contextPo?: string;
  onReady: () => void;
  onRetake: () => void;
  onClose: () => void;
  onViewAccepted: () => void;
}

export default function ReadingScreen({ sample, pagesTaken, contextPo, onReady, onRetake, onClose, onViewAccepted }: Props) {
  const photo = photoFor(sample);
  const kind = KIND_WORD[sample.kind];

  const { steps, stop } = useMemo(() => {
    const lines = sample.lines.length;
    const read: Step = {
      doing: 'Reading the photo',
      done:
        sample.kind === 'receipt'
          ? `Receipt from ${sample.supplier}, ${lines} items`
          : `${cap(kind)} from ${sample.supplier}, ${lines} lines`,
    };
    if (sample.blocked === 'unreadable') return { steps: [read], stop: 'unreadable' as Stop };
    if (sample.blocked === 'wrong-document') return { steps: [read], stop: 'wrong-document' as Stop };
    if (pagesTaken < sample.pages) return { steps: [read], stop: 'missing-page' as Stop };
    if (sample.blocked === 'duplicate') return { steps: [read], stop: 'duplicate' as Stop };
    const order: Step =
      sample.kind === 'receipt'
        ? { doing: 'Looking for an order', done: 'No order behind it: it\u2019s a shop receipt' }
        : contextPo
          ? { doing: `Checking against ${contextPo}`, done: `Checked against ${contextPo}` }
          : { doing: 'Finding your order', done: `Matched to ${sample.poNumbers.join(' and ')}` };
    const r = review(sample, freshEdits(sample), {});
    const check: Step = {
      doing: 'Checking every line',
      done: r.toCheck.length === 0 ? `All ${lines} match` : `${r.toCheck.length} to check`,
    };
    return { steps: [read, order, check], stop: null };
  }, [sample, pagesTaken, contextPo, kind]);

  const [doneCount, setDoneCount] = useState(0);
  const finished = doneCount >= steps.length;

  useEffect(() => {
    if (finished) {
      if (stop) return;
      const t = setTimeout(onReady, 450);
      return () => clearTimeout(t);
    }
    const t = setTimeout(() => setDoneCount(n => n + 1), STEP_MS);
    return () => clearTimeout(t);
  }, [doneCount, finished, stop, onReady]);

  const thumb = photo?.pages[0];

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', padding: '8px 8px' }}>
        <IconButton label="Close" onClick={onClose}>
          <X size={22} />
        </IconButton>
      </div>
      <div style={{ flex: 1, overflowY: 'auto', padding: '8px 24px 32px' }}>
        <div style={{ maxWidth: 420, margin: '0 auto' }}>
          {thumb && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={thumb.src}
              alt="Your photo"
              style={{ width: 150, aspectRatio: '3 / 4', objectFit: 'cover', borderRadius: 12, display: 'block', margin: '8px auto 28px', boxShadow: '0 6px 20px rgba(0,28,53,0.18)' }}
            />
          )}

          <ol aria-live="polite" style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 14 }}>
            {steps.slice(0, Math.min(doneCount + 1, steps.length)).map((s, i) => {
              const done = i < doneCount;
              return (
                <li key={s.doing} style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 16, fontWeight: done ? 500 : 600, color: done ? C.muted : C.ink }}>
                  {done ? (
                    <Check size={20} aria-hidden style={{ flexShrink: 0 }} />
                  ) : (
                    <Loader2 size={20} aria-hidden style={{ flexShrink: 0, animation: 'spin 1s linear infinite' }} />
                  )}
                  <span>{done ? s.done : s.doing}</span>
                </li>
              );
            })}
          </ol>

          {finished && stop && (
            <StopPanel
              stop={stop}
              sample={sample}
              kind={kind}
              pagesTaken={pagesTaken}
              onRetake={onRetake}
              onClose={onClose}
              onViewAccepted={onViewAccepted}
            />
          )}
        </div>
      </div>
      <style>{'@keyframes spin { to { transform: rotate(360deg); } }'}</style>
    </div>
  );
}

function StopPanel({
  stop,
  sample,
  kind,
  pagesTaken,
  onRetake,
  onClose,
  onViewAccepted,
}: {
  stop: Stop;
  sample: Sample;
  kind: string;
  pagesTaken: number;
  onRetake: () => void;
  onClose: () => void;
  onViewAccepted: () => void;
}) {
  const copy: Record<Stop, { title: string; body: string }> = {
    unreadable: { title: 'We can\u2019t read this photo', body: 'Try again with the whole page in the frame and less glare.' },
    'wrong-document': { title: 'This looks like a menu', body: 'Take a photo of a delivery note, invoice or shop receipt.' },
    'missing-page': {
      title: `This is page ${pagesTaken} of ${sample.pages}`,
      body: `Add page ${pagesTaken + 1} so nothing on the ${kind} gets missed.`,
    },
    duplicate: {
      title: 'You\u2019ve already accepted this',
      body: `${sample.supplier} ${kind} ${sample.docNumber} was accepted at ${sample.duplicateOf?.time} on ${sample.duplicateOf?.grnNumber}. Nothing has been received twice.`,
    },
  };
  const { title, body } = copy[stop];
  return (
    <div role="alert" style={{ marginTop: 28, padding: 20, borderRadius: 14, background: '#fff', border: `1px solid ${C.subtle}` }}>
      <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
        <AlertCircle size={22} aria-hidden style={{ flexShrink: 0, marginTop: 2 }} />
        <div>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 600, lineHeight: 1.3 }}>{title}</h2>
          <p style={{ margin: '6px 0 0', fontSize: 16, color: C.muted, lineHeight: 1.5 }}>{keepIds(body)}</p>
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 18 }}>
        {stop === 'duplicate' ? (
          <>
            <PrimaryButton onClick={onViewAccepted}>See accepted deliveries</PrimaryButton>
            <SecondaryButton onClick={onClose}>Back to deliveries</SecondaryButton>
          </>
        ) : (
          <>
            <PrimaryButton onClick={onRetake}>{stop === 'missing-page' ? `Take page ${pagesTaken + 1}` : 'Take it again'}</PrimaryButton>
            <SecondaryButton onClick={onClose}>Cancel</SecondaryButton>
          </>
        )}
      </div>
    </div>
  );
}
