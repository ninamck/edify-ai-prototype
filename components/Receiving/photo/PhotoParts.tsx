'use client';

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Maximize2, X } from 'lucide-react';
import { SAMPLE_PHOTOS, type PhotoBox } from './samplePhotos';
import type { SampleId } from './fixtures';

const SPOTLIGHT = { boxShadow: '0 0 0 9999px rgba(0, 0, 0, 0.38)', borderRadius: 3 } as const;

function pct(n: number) {
  return `${n * 100}%`;
}

/** The part of the photo a line was read from, with a little context above and below. */
export function LineCrop({
  sampleId, lineId, label, onOpen,
}: {
  sampleId: SampleId;
  lineId: string;
  label: string;
  onOpen: (lineId: string) => void;
}) {
  const photo = SAMPLE_PHOTOS[sampleId];
  const box = photo?.lines[lineId];
  if (!box) return null;
  const pg = photo.pages[box.page - 1];

  const padX = 16;
  const cw = Math.min(box.w + padX * 2, pg.width);
  const ch = Math.min(Math.max(box.h + 16, cw / 5), pg.height);
  const cx = Math.min(Math.max(box.x - padX, 0), pg.width - cw);
  const cy = Math.min(Math.max(box.y + box.h / 2 - ch / 2, 0), pg.height - ch);

  return (
    <button
      type="button"
      onClick={() => onOpen(lineId)}
      aria-label={`${label}. See it on page ${box.page} of the photo`}
      style={{
        position: 'relative', display: 'block', width: '100%', aspectRatio: `${cw} / ${ch}`,
        overflow: 'hidden', padding: 0, border: '1px solid var(--color-border-subtle)',
        borderRadius: 'var(--radius-item)', background: '#000', cursor: 'zoom-in',
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={pg.src}
        alt=""
        style={{ position: 'absolute', maxWidth: 'none', width: pct(pg.width / cw), left: pct(-cx / cw), top: pct(-cy / ch) }}
      />
      <span
        aria-hidden
        style={{
          position: 'absolute', ...SPOTLIGHT,
          left: pct((box.x - cx) / cw), top: pct((box.y - cy) / ch), width: pct(box.w / cw), height: pct(box.h / ch),
        }}
      />
      <span
        aria-hidden
        style={{
          position: 'absolute', right: 6, bottom: 6, width: 26, height: 26, borderRadius: 999,
          background: 'rgba(255,255,255,0.92)', display: 'grid', placeItems: 'center', color: 'var(--color-text-primary)',
        }}
      >
        <Maximize2 size={14} />
      </span>
    </button>
  );
}

/** The whole photo, full screen, with the line it was opened from picked out. */
export function PhotoViewer({
  sampleId, lineId, onClose,
}: {
  sampleId: SampleId;
  lineId?: string;
  onClose: () => void;
}) {
  const photo = SAMPLE_PHOTOS[sampleId];
  const box: PhotoBox | undefined = lineId ? photo.lines[lineId] : undefined;
  const [page, setPage] = useState(box?.page ?? 1);
  const closeRef = useRef<HTMLButtonElement>(null);
  const spotRef = useRef<HTMLSpanElement>(null);
  const pg = photo.pages[page - 1];
  const showBox = box && box.page === page;

  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  useEffect(() => {
    spotRef.current?.scrollIntoView({ block: 'center' });
  }, [page]);

  // Portalled to body: the area layouts wrap pages in their own stacking
  // context, which would pin the viewer underneath the top bar.
  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Photo, page ${page} of ${photo.pages.length}`}
      style={{ position: 'fixed', inset: 0, zIndex: 1400, background: 'rgba(0, 0, 0, 0.88)', display: 'flex', flexDirection: 'column', fontFamily: 'var(--font-primary)' }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, padding: '8px 12px', color: '#fff' }}>
        <div style={{ display: 'flex', gap: 8 }}>
          {photo.pages.length > 1 &&
            photo.pages.map((_, i) => (
              <button
                key={i}
                type="button"
                aria-pressed={page === i + 1}
                onClick={() => setPage(i + 1)}
                style={{
                  minHeight: 40, padding: '0 14px', borderRadius: 999, fontFamily: 'var(--font-primary)', fontSize: 14, fontWeight: 600, cursor: 'pointer',
                  border: '1px solid rgba(255,255,255,0.6)', background: page === i + 1 ? '#fff' : 'transparent', color: page === i + 1 ? '#000' : '#fff',
                }}
              >
                Page {i + 1}
              </button>
            ))}
        </div>
        <button
          ref={closeRef}
          type="button"
          onClick={onClose}
          aria-label="Close photo"
          style={{ width: 44, height: 44, borderRadius: 999, border: 'none', background: 'rgba(255,255,255,0.15)', color: '#fff', display: 'grid', placeItems: 'center', cursor: 'pointer' }}
        >
          <X size={22} aria-hidden />
        </button>
      </div>
      <div style={{ flex: 1, overflow: 'auto', padding: '0 12px 24px' }}>
        <div style={{ position: 'relative', width: '100%', maxWidth: 560, margin: '0 auto' }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={pg.src} alt={`Page ${page} of the photo`} style={{ display: 'block', width: '100%' }} />
          {showBox && (
            <span
              ref={spotRef}
              aria-hidden
              style={{
                position: 'absolute', ...SPOTLIGHT,
                left: pct(box.x / pg.width), top: pct(box.y / pg.height), width: pct(box.w / pg.width), height: pct(box.h / pg.height),
              }}
            />
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}

export function photoPages(sampleId: SampleId) {
  return SAMPLE_PHOTOS[sampleId].pages;
}

export function PhotoThumb({ src, alt, width = 64 }: { src: string; alt: string; width?: number }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      style={{ width, height: Math.round(width * 4 / 3), objectFit: 'cover', borderRadius: 4, boxShadow: '0 1px 3px rgba(0,0,0,0.18)', flexShrink: 0 }}
    />
  );
}
