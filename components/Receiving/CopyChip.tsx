'use client';

import { useState } from 'react';

/** Small copy-to-clipboard affordance shown beside document numbers. */
export default function CopyChip({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      title={copied ? 'Copied' : `Copy ${text}`}
      onClick={e => {
        e.stopPropagation();
        navigator.clipboard?.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 1200);
      }}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        padding: '2px 4px',
        marginLeft: '6px',
        borderRadius: '4px',
        border: 'none',
        background: 'transparent',
        cursor: 'pointer',
        color: copied ? 'var(--color-success)' : 'var(--color-text-secondary)',
        fontSize: '11px',
        lineHeight: 1,
      }}
    >
      {copied ? '✓' : '⧉'}
    </button>
  );
}
