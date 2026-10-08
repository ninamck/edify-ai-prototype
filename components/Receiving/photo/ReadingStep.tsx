'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { motion, useReducedMotion } from 'framer-motion';
import { AlertTriangle, Camera, Check, Copy, Loader2 } from 'lucide-react';
import PaperDocument from './PaperDocument';
import { PARSE_STAGE_MS, WRONG_DOC_MESSAGE, type Fingerprint, type SampleDocument } from './fixtures';
import type { CapturedPage } from './types';
import { PrimaryButton, SecondaryButton, StepHeading, cardStyle } from './ui';

function PhotoPreview({ doc, page }: { doc: SampleDocument; page?: CapturedPage }) {
  if (page?.imageUrl) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={page.imageUrl} alt="Your photo" style={{ display: 'block', maxWidth: '100%', maxHeight: 360, margin: '0 auto', borderRadius: 4 }} />;
  }
  return <PaperDocument doc={doc} />;
}

/**
 * Plays the scripted read. `stopAfter` cuts it short once Edify knows enough
 * to stop, e.g. it has seen the invoice number of a document already received.
 */
export default function ReadingStep({
  doc, pages, stopAfter, onComplete,
}: {
  doc: SampleDocument;
  pages: CapturedPage[];
  stopAfter?: number;
  onComplete: () => void;
}) {
  const reduceMotion = useReducedMotion();
  const lastStage = stopAfter ?? doc.stages.length - 1;
  const [stageIdx, setStageIdx] = useState(0);

  useEffect(() => {
    const t = setTimeout(() => {
      if (stageIdx >= lastStage) onComplete();
      else setStageIdx(i => i + 1);
    }, PARSE_STAGE_MS);
    return () => clearTimeout(t);
  }, [stageIdx, lastStage, onComplete]);

  return (
    <div>
      <StepHeading title="Reading your photo" sub={`${pages.length} page${pages.length === 1 ? '' : 's'}. This takes a few seconds.`} />
      <div style={{ ...cardStyle, position: 'relative', overflow: 'hidden', padding: 20, background: 'var(--color-bg-hover)' }}>
        <PhotoPreview doc={doc} page={pages[0]} />
        {!reduceMotion && (
          <motion.div
            aria-hidden
            initial={{ top: '0%' }}
            animate={{ top: ['0%', '96%', '0%'] }}
            transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut' }}
            style={{ position: 'absolute', left: 0, right: 0, height: 3, background: 'var(--color-accent-active)', opacity: 0.6 }}
          />
        )}
      </div>
      <ol aria-live="polite" style={{ listStyle: 'none', margin: '16px 0 0', padding: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
        {doc.stages.slice(0, stageIdx + 1).map((s, i) => {
          const done = i < stageIdx;
          return (
            <li key={s} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 15, color: 'var(--color-text-primary)', fontWeight: done ? 500 : 700 }}>
              {done ? (
                <Check size={18} aria-hidden style={{ color: 'var(--color-success)', flexShrink: 0 }} />
              ) : (
                <Loader2 size={18} aria-hidden style={{ flexShrink: 0, animation: reduceMotion ? undefined : 'spin 1s linear infinite' }} />
              )}
              {s}
            </li>
          );
        })}
      </ol>
      <style>{'@keyframes spin { to { transform: rotate(360deg); } }'}</style>
    </div>
  );
}

export function WrongDocState({ doc, onRetake }: { doc: SampleDocument; onRetake: () => void }) {
  return (
    <div>
      <StepHeading title="That's not a delivery document" />
      <div role="alert" style={{ ...cardStyle, background: 'var(--color-warning-light)', borderColor: 'var(--color-warning-border)', display: 'flex', gap: 10, marginBottom: 16 }}>
        <AlertTriangle size={20} aria-hidden style={{ color: 'var(--color-warning)', flexShrink: 0, marginTop: 1 }} />
        <p style={{ margin: 0, fontSize: 15, lineHeight: 1.45, color: 'var(--color-text-primary)' }}>{WRONG_DOC_MESSAGE}</p>
      </div>
      <div style={{ ...cardStyle, padding: 20, background: 'var(--color-bg-hover)', marginBottom: 16 }}>
        <PaperDocument doc={doc} />
      </div>
      <PrimaryButton icon={<Camera size={20} aria-hidden />} onClick={onRetake} testId="retake">
        Retake photo
      </PrimaryButton>
    </div>
  );
}

export function DuplicateState({
  doc, fingerprint, onRetake,
}: {
  doc: SampleDocument;
  fingerprint: Fingerprint;
  onRetake: () => void;
}) {
  const what = doc.kind === 'invoice' ? `This ${doc.supplierName} invoice, ${doc.docNumber},` : `This ${doc.supplierName} receipt`;
  return (
    <div>
      <StepHeading title="Already received" />
      <div role="alert" style={{ ...cardStyle, background: 'var(--color-warning-light)', borderColor: 'var(--color-warning-border)', display: 'flex', gap: 10, marginBottom: 16 }}>
        <Copy size={20} aria-hidden style={{ color: 'var(--color-warning)', flexShrink: 0, marginTop: 1 }} />
        <p style={{ margin: 0, fontSize: 15, lineHeight: 1.45, color: 'var(--color-text-primary)' }}>
          {what} was booked in as <strong>{fingerprint.grnNumber}</strong>
          {` at ${fingerprint.time} today. Edify stopped so the stock isn't counted twice. Nothing has changed.`}
        </p>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <Link
          href={`/receive/grn/${fingerprint.grnId}`}
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 48, borderRadius: 'var(--radius-item)',
            background: 'var(--color-accent-active)', color: 'var(--color-text-on-active)', fontWeight: 700, fontSize: 15, textDecoration: 'none',
          }}
        >
          View {fingerprint.grnNumber}
        </Link>
        <SecondaryButton full icon={<Camera size={18} aria-hidden />} onClick={onRetake}>
          Photo a different document
        </SecondaryButton>
      </div>
    </div>
  );
}
