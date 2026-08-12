'use client';

import { useRef } from 'react';
import { Camera, X } from 'lucide-react';

/** Photo attachment input — camera on mobile, file picker on desktop.
 *  Stores the image as a data URL (prototype only, no upload). */
export function PhotoCapture({
  dataUrl,
  onChange,
  label = 'Attach photo',
}: {
  dataUrl?: string;
  onChange: (url: string | undefined) => void;
  label?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      if (typeof ev.target?.result === 'string') onChange(ev.target.result);
    };
    reader.readAsDataURL(file);
  }

  return (
    <div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        style={{ display: 'none' }}
        onChange={handleFile}
      />
      {dataUrl ? (
        <div style={{ position: 'relative', display: 'inline-block' }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={dataUrl}
            alt="Attached photo"
            style={{ width: '80px', height: '80px', borderRadius: '9px', objectFit: 'cover', display: 'block' }}
          />
          <button
            type="button"
            onClick={() => onChange(undefined)}
            style={{
              position: 'absolute',
              top: '-6px',
              right: '-6px',
              width: '20px',
              height: '20px',
              borderRadius: '50%',
              border: 'none',
              background: '#B01038',
              color: '#fff',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <X size={11} />
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            padding: '8px 14px',
            borderRadius: '8px',
            border: '1.5px dashed var(--color-border)',
            background: 'var(--color-bg-surface)',
            fontSize: '12px',
            fontWeight: 600,
            color: 'var(--color-text-secondary)',
            cursor: 'pointer',
            fontFamily: 'var(--font-primary)',
          }}
        >
          <Camera size={14} />
          {label}
        </button>
      )}
    </div>
  );
}
