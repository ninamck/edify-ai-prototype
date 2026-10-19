'use client';

import { useId, useRef, useState, type DragEvent } from 'react';
import { Check, ChevronDown, FileUp, Upload, X } from 'lucide-react';
import { SAMPLES, SAMPLE_ORDER, type Sample, type SampleId } from './samples';
import { C, IconButton, photoFor, PrimaryButton } from './ui';

interface Props {
  sample: Sample;
  /** Set when the flow started from a delivery, so the paper is known. */
  contextPo?: string;
  isPhone: boolean;
  /** Pages already taken, when coming back for a missing page. */
  initialTaken?: number;
  onSampleChange: (id: SampleId) => void;
  onDone: (pagesTaken: number) => void;
  onClose: () => void;
}

export default function CaptureScreen(props: Props) {
  return props.isPhone ? <Camera {...props} /> : <DropZone {...props} />;
}

function DemoPicker({ value, onChange, dark }: { value: SampleId; onChange: (id: SampleId) => void; dark?: boolean }) {
  return (
    <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 600, color: dark ? 'rgba(255,255,255,0.8)' : C.muted }}>
      Demo
      <select
        value={value}
        onChange={e => onChange(e.target.value as SampleId)}
        aria-label="Demo: which paper is in front of the camera"
        style={{
          height: 36,
          maxWidth: 240,
          padding: '0 10px',
          borderRadius: 10,
          border: dark ? '1px solid rgba(255,255,255,0.3)' : `1px solid ${C.border}`,
          background: dark ? 'rgba(255,255,255,0.12)' : '#fff',
          color: dark ? '#fff' : C.ink,
          fontSize: 14,
          fontWeight: 500,
          fontFamily: 'var(--font-primary)',
        }}
      >
        {SAMPLE_ORDER.map(id => (
          <option key={id} value={id} style={{ color: '#001C35' }}>
            {SAMPLES[id].label}
          </option>
        ))}
      </select>
    </label>
  );
}

function Camera({ sample, contextPo, initialTaken = 0, onSampleChange, onDone, onClose }: Props) {
  const photo = photoFor(sample);
  const [taken, setTaken] = useState(initialTaken);
  const [flash, setFlash] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const pages = photo?.pages ?? [];
  const showing = pages[Math.min(taken, pages.length - 1)];
  const allTaken = taken >= pages.length;

  const shoot = () => {
    if (allTaken) return;
    setFlash(true);
    setTimeout(() => setFlash(false), 140);
    setTaken(t => t + 1);
  };

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: '#0b0f14', color: '#fff', minHeight: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px' }}>
        <IconButton label="Close" onClick={onClose} tone="dark">
          <X size={22} />
        </IconButton>
        <div style={{ flex: 1, fontSize: 16, fontWeight: 600 }}>{contextPo ? `Photo for ${contextPo}` : 'Photo a delivery'}</div>
      </div>

      <div style={{ position: 'relative', flex: 1, minHeight: 0, margin: '0 12px', borderRadius: 16, overflow: 'hidden', background: '#000' }}>
        {showing && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={showing.src} alt="" style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block' }} />
        )}
        <div
          role="status"
          style={{ position: 'absolute', left: 0, right: 0, top: 12, display: 'flex', justifyContent: 'center', pointerEvents: 'none' }}
        >
          <span style={{ padding: '6px 14px', borderRadius: 100, background: 'rgba(0,0,0,0.65)', fontSize: 14, fontWeight: 600 }}>
            {allTaken ? 'That\u2019s every page. Tap Done.' : taken > 0 ? `Now page ${taken + 1}` : 'Fit the whole page in the frame'}
          </span>
        </div>
        {flash && <div aria-hidden style={{ position: 'absolute', inset: 0, background: '#fff', opacity: 0.85 }} />}
      </div>

      {!contextPo && (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '10px 16px 0' }}>
          <DemoPicker
            dark
            value={sample.id}
            onChange={id => {
              setTaken(0);
              onSampleChange(id);
            }}
          />
        </div>
      )}

      {taken > 0 && (
        <div style={{ display: 'flex', gap: 8, padding: '12px 16px 0', alignItems: 'center' }}>
          {pages.slice(0, taken).map((p, i) => (
            <div key={p.src} style={{ position: 'relative' }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={p.src} alt={`Page ${i + 1}`} style={{ width: 44, height: 58, objectFit: 'cover', borderRadius: 6, border: '2px solid #fff', display: 'block' }} />
              {i === taken - 1 && (
                <button
                  type="button"
                  aria-label={`Remove page ${i + 1}`}
                  onClick={() => setTaken(t => t - 1)}
                  style={{ position: 'absolute', top: -10, right: -10, width: 28, height: 28, borderRadius: 14, border: 'none', background: '#fff', color: '#001C35', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
                >
                  <X size={16} />
                </button>
              )}
            </div>
          ))}
          <span style={{ fontSize: 14, color: 'rgba(255,255,255,0.8)', marginLeft: 4 }}>
            {taken} {taken === 1 ? 'page' : 'pages'}
          </span>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', alignItems: 'center', padding: '16px 16px calc(20px + env(safe-area-inset-bottom))' }}>
        <div>
          <IconButton label="Upload a photo or PDF instead" onClick={() => fileRef.current?.click()} tone="dark" style={{ width: 52, height: 52 }}>
            <Upload size={22} />
          </IconButton>
          <input ref={fileRef} type="file" accept="image/*,application/pdf" multiple hidden onChange={() => onDone(pages.length)} />
        </div>
        <button
          type="button"
          aria-label={taken > 0 ? 'Take the next page' : 'Take photo'}
          onClick={shoot}
          disabled={allTaken}
          style={{
            width: 76,
            height: 76,
            borderRadius: 38,
            border: '4px solid #fff',
            background: allTaken ? 'rgba(255,255,255,0.25)' : 'rgba(255,255,255,0.92)',
            boxShadow: '0 0 0 3px rgba(0,0,0,0.4) inset',
            cursor: allTaken ? 'default' : 'pointer',
          }}
        />
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          {taken > 0 && (
            <button
              type="button"
              onClick={() => onDone(taken)}
              style={{
                minHeight: 48,
                padding: '0 20px',
                borderRadius: 24,
                border: 'none',
                background: '#fff',
                color: '#001C35',
                fontSize: 16,
                fontWeight: 600,
                fontFamily: 'var(--font-primary)',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                cursor: 'pointer',
              }}
            >
              <Check size={18} /> Done
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function DropZone({ sample, contextPo, onSampleChange, onDone, onClose }: Props) {
  const [over, setOver] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const pagesOf = (s: Sample) => photoFor(s)?.pages.length ?? 1;
  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setOver(false);
    onDone(pagesOf(sample));
  };
  const tiles = contextPo ? [sample.id] : SAMPLE_ORDER;
  const [showSamples, setShowSamples] = useState(false);
  const samplesId = useId();

  return (
    <div>
      <div style={{ padding: '24px 28px 28px' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
          <div style={{ flex: 1 }}>
            <h2 style={{ margin: 0, fontSize: 24, fontWeight: 600, lineHeight: 1.25 }}>{contextPo ? `Photo for ${contextPo}` : 'Photo a delivery'}</h2>
            <p style={{ margin: '8px 0 0', fontSize: 16, color: C.muted, lineHeight: 1.5 }}>
              {contextPo
                ? `Add the delivery note or invoice from ${sample.supplier}. Edify checks every line against ${contextPo}.`
                : 'Add a delivery note, invoice or shop receipt. Edify reads it and checks it against your order.'}
            </p>
          </div>
          <IconButton label="Close" onClick={onClose}>
            <X size={22} />
          </IconButton>
        </div>

        <div
          onDragOver={e => {
            e.preventDefault();
            setOver(true);
          }}
          onDragLeave={() => setOver(false)}
          onDrop={onDrop}
          style={{
            marginTop: 20,
            padding: '32px 20px',
            borderRadius: 14,
            border: `2px dashed ${over ? '#001C35' : C.border}`,
            background: over ? 'rgba(0,28,53,0.03)' : '#fff',
            textAlign: 'center',
          }}
        >
          <FileUp size={28} color="#6B5E55" aria-hidden style={{ display: 'block', margin: '0 auto' }} />
          <div style={{ fontSize: 16, fontWeight: 600, marginTop: 8 }}>Drop photos or a PDF here</div>
          <div style={{ fontSize: 14, color: C.muted, marginTop: 4 }}>Add every page. Two-page invoices are fine.</div>
          <div style={{ width: 200, margin: '16px auto 0' }}>
            <PrimaryButton onClick={() => fileRef.current?.click()}>Choose files</PrimaryButton>
          </div>
          <input ref={fileRef} type="file" accept="image/*,application/pdf" multiple hidden onChange={() => onDone(pagesOf(sample))} />
        </div>

        <div style={{ marginTop: 20, borderTop: `1px solid ${C.subtle}`, paddingTop: 8 }}>
          <button
            type="button"
            aria-expanded={showSamples}
            aria-controls={samplesId}
            onClick={() => setShowSamples(v => !v)}
            style={{
              width: '100%',
              minHeight: 44,
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: 0,
              border: 'none',
              background: 'none',
              cursor: 'pointer',
              fontFamily: 'var(--font-primary)',
              fontSize: 14,
              fontWeight: 600,
              color: C.ink,
              textAlign: 'left',
            }}
          >
            <span style={{ flex: 1 }}>
              {contextPo ? 'The sample for this delivery' : 'Samples in this prototype'}
              <span style={{ fontWeight: 500, color: C.muted }}>{contextPo ? '' : ` \u00b7 ${tiles.length}`}</span>
            </span>
            <ChevronDown size={20} aria-hidden style={{ transform: showSamples ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }} />
          </button>
          <div id={samplesId} hidden={!showSamples} style={{ display: showSamples ? 'grid' : 'none', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 12, marginTop: 8 }}>
            {tiles.map(id => {
              const s = SAMPLES[id];
              const thumb = photoFor(s)?.pages[0];
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => {
                    onSampleChange(id);
                    onDone(pagesOf(s));
                  }}
                  style={{
                    textAlign: 'left',
                    padding: 0,
                    borderRadius: 12,
                    border: `1px solid ${C.subtle}`,
                    background: '#fff',
                    overflow: 'hidden',
                    cursor: 'pointer',
                    fontFamily: 'var(--font-primary)',
                    color: C.ink,
                  }}
                >
                  {thumb && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={thumb.src} alt="" style={{ width: '100%', aspectRatio: '4 / 3', objectFit: 'cover', objectPosition: 'top', display: 'block' }} />
                  )}
                  <div style={{ padding: '10px 12px 12px' }}>
                    <div style={{ fontSize: 14, fontWeight: 600 }}>{s.label}</div>
                    {s.hint && <div style={{ fontSize: 12, fontWeight: 500, color: C.muted, marginTop: 2, lineHeight: 1.4 }}>{s.hint}</div>}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
