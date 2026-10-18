'use client';

import { useEffect, useRef, useState } from 'react';
import { Maximize2, ZoomIn, ZoomOut } from 'lucide-react';
import type { Sample } from './samples';
import { IconButton, photoFor } from './ui';

const FLAG = '#B45309';

/** The photo pinned beside the review on a wide screen. The line you're on is outlined; lines to check are marked. */
export default function PhotoPane({
  sample,
  activeLineId,
  flaggedLineIds,
  onOpenFull,
}: {
  sample: Sample;
  activeLineId: string | null;
  flaggedLineIds: Set<string>;
  onOpenFull: () => void;
}) {
  const photo = photoFor(sample);
  const [zoom, setZoom] = useState(1);
  const boxes = useRef<Record<string, HTMLDivElement | null>>({});

  useEffect(() => {
    if (!activeLineId) return;
    boxes.current[activeLineId]?.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'smooth' });
  }, [activeLineId, zoom]);

  if (!photo) return null;
  const pages = photo.pages.length;

  return (
    <aside aria-label="Photo of the paperwork" style={{ display: 'flex', flexDirection: 'column', minHeight: 0, height: '100%', background: '#23272e', color: '#fff' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '6px 8px 6px 16px', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
        <div style={{ flex: 1, fontSize: 14, fontWeight: 600 }}>
          Your photo{pages > 1 ? `, ${pages} pages` : ''}
          <span style={{ fontWeight: 500, color: 'rgba(255,255,255,0.75)' }}> &middot; point at a line to find it</span>
        </div>
        <IconButton label="Zoom out" tone="dark" onClick={() => setZoom(z => Math.max(1, z - 0.25))} style={{ background: 'transparent' }}>
          <ZoomOut size={20} />
        </IconButton>
        <IconButton label="Zoom in" tone="dark" onClick={() => setZoom(z => Math.min(2.5, z + 0.25))} style={{ background: 'transparent' }}>
          <ZoomIn size={20} />
        </IconButton>
        <IconButton label="Open the photo full screen" tone="dark" onClick={onOpenFull} style={{ background: 'transparent' }}>
          <Maximize2 size={18} />
        </IconButton>
      </div>
      <div style={{ flex: 1, overflow: 'auto', padding: 16 }}>
        {photo.pages.map((p, i) => (
          <div key={p.src} style={{ position: 'relative', width: `${zoom * 100}%`, margin: '0 auto 16px' }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={p.src} alt={`Page ${i + 1} of the paperwork`} style={{ width: '100%', aspectRatio: `${p.width} / ${p.height}`, display: 'block', borderRadius: 6 }} />
            {Object.entries(photo.lines)
              .filter(([id, b]) => b.page === i + 1 && (id === activeLineId || flaggedLineIds.has(id)))
              .map(([id, b]) => {
                const active = id === activeLineId;
                return (
                  <div
                    key={id}
                    ref={el => {
                      boxes.current[id] = el;
                    }}
                    aria-hidden
                    style={{
                      position: 'absolute',
                      left: `${((b.x - 8) / p.width) * 100}%`,
                      top: `${((b.y - 3) / p.height) * 100}%`,
                      width: `${((b.w + 16) / p.width) * 100}%`,
                      height: `${((b.h + 6) / p.height) * 100}%`,
                      borderRadius: 4,
                      border: active ? '3px solid #001C35' : 'none',
                      borderLeft: active ? '3px solid #001C35' : `5px solid ${FLAG}`,
                      background: active ? 'rgba(255,192,96,0.32)' : 'rgba(255,192,96,0.16)',
                      transition: 'background 120ms ease',
                    }}
                  />
                );
              })}
          </div>
        ))}
      </div>
    </aside>
  );
}
