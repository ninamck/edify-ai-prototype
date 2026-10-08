'use client';

import { useRef } from 'react';
import { Camera, ImagePlus, Plus, X } from 'lucide-react';
import PaperDocument from './PaperDocument';
import { SAMPLE_DOCUMENTS, type SampleId } from './fixtures';
import type { CapturedPage } from './types';
import { PrimaryButton, SecondaryButton, StepHeading, cardStyle, sectionLabel } from './ui';

const SAMPLE_ORDER: SampleId[] = ['sainsburys', 'fresh-direct', 'menu'];

export default function CaptureStep({
  pages, notice, onAddPhoto, onPickSample, onRemovePage, onDone,
}: {
  pages: CapturedPage[];
  notice?: string | null;
  onAddPhoto: (file: File) => void;
  onPickSample: (id: SampleId) => void;
  onRemovePage: (id: string) => void;
  onDone: () => void;
}) {
  const cameraRef = useRef<HTMLInputElement>(null);
  const libraryRef = useRef<HTMLInputElement>(null);

  const takeFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) onAddPhoto(file);
    e.target.value = '';
  };

  const hasPages = pages.length > 0;

  return (
    <div>
      <StepHeading
        title="Photo a delivery"
        sub="Take a photo of the receipt, delivery note or invoice. Edify reads it, matches it to your orders and asks you about anything that doesn't line up."
      />

      {notice && (
        <div role="status" style={{ ...cardStyle, background: 'var(--color-bg-hover)', marginBottom: 12, fontSize: 14, color: 'var(--color-text-primary)' }}>
          {notice}
        </div>
      )}

      <input ref={cameraRef} type="file" accept="image/*" capture="environment" onChange={takeFile} hidden aria-hidden />
      <input ref={libraryRef} type="file" accept="image/*" onChange={takeFile} hidden aria-hidden />

      {!hasPages ? (
        <div style={{ ...cardStyle, padding: 20, display: 'flex', flexDirection: 'column', gap: 10, alignItems: 'stretch' }}>
          <PrimaryButton icon={<Camera size={20} aria-hidden />} onClick={() => cameraRef.current?.click()} testId="take-photo">
            Take a photo
          </PrimaryButton>
          <SecondaryButton full icon={<ImagePlus size={18} aria-hidden />} onClick={() => libraryRef.current?.click()}>
            Choose from your photos
          </SecondaryButton>
          <p style={{ fontSize: 13, color: 'var(--color-text-secondary)', margin: '4px 0 0', lineHeight: 1.45 }}>
            Long invoice? Photo each page. You can add more pages before Edify reads it.
          </p>
        </div>
      ) : (
        <div style={{ ...cardStyle, padding: 16 }}>
          <p style={sectionLabel}>{pages.length} page{pages.length === 1 ? '' : 's'} ready</p>
          <ul aria-label="Pages" style={{ listStyle: 'none', margin: '0 0 14px', padding: 0, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            {pages.map((p, i) => {
              const doc = p.sampleId ? SAMPLE_DOCUMENTS[p.sampleId] : null;
              return (
                <li key={p.id} style={{ position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                  {p.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={p.imageUrl} alt={`Page ${i + 1}`} style={{ width: 64, height: 84, objectFit: 'cover', borderRadius: 2, boxShadow: '0 1px 3px rgba(0,0,0,0.18)' }} />
                  ) : doc ? (
                    <PaperDocument doc={doc} size="thumb" />
                  ) : null}
                  <span style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>Page {i + 1}</span>
                  <button
                    type="button"
                    onClick={() => onRemovePage(p.id)}
                    aria-label={`Remove page ${i + 1}`}
                    style={{ position: 'absolute', top: -10, right: -10, width: 28, height: 28, borderRadius: 999, border: '1px solid var(--color-border)', background: '#fff', display: 'grid', placeItems: 'center', cursor: 'pointer', color: 'var(--color-text-primary)' }}
                  >
                    <X size={14} aria-hidden />
                  </button>
                </li>
              );
            })}
          </ul>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <SecondaryButton full icon={<Plus size={18} aria-hidden />} onClick={() => cameraRef.current?.click()}>
              Add another page
            </SecondaryButton>
            <PrimaryButton onClick={onDone} testId="read-it">
              Done, read {pages.length === 1 ? 'it' : `all ${pages.length} pages`}
            </PrimaryButton>
          </div>
        </div>
      )}

      <section aria-labelledby="sample-tray" style={{ marginTop: 24 }}>
        <h2 id="sample-tray" style={sectionLabel}>No paper to hand? Try a sample</h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {SAMPLE_ORDER.map(id => {
            const doc = SAMPLE_DOCUMENTS[id];
            return (
              <button
                key={id}
                type="button"
                onClick={() => onPickSample(id)}
                style={{
                  ...cardStyle, padding: '10px 12px', display: 'flex', alignItems: 'center', gap: 12,
                  textAlign: 'left', cursor: 'pointer', fontFamily: 'var(--font-primary)', minHeight: 56,
                }}
              >
                <PaperDocument doc={doc} size="thumb" />
                <span>
                  <span style={{ display: 'block', fontSize: 15, fontWeight: 700, color: 'var(--color-text-primary)' }}>{doc.trayLabel}</span>
                  <span style={{ display: 'block', fontSize: 13, color: 'var(--color-text-secondary)' }}>
                    {doc.trayDetail}{doc.pages > 1 ? ` · ${doc.pages} pages` : ''}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
        <p style={{ fontSize: 12, color: 'var(--color-text-secondary)', margin: '10px 0 0', lineHeight: 1.45 }}>
          Prototype: a real photo is read as the Sainsbury&apos;s receipt so the rest of the flow works.
        </p>
      </section>
    </div>
  );
}
