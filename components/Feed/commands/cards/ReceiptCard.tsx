'use client';

import { useEffect, useState } from 'react';
import { Check, ExternalLink, Undo2 } from 'lucide-react';
import Link from 'next/link';
import type { CommandReceipt } from '../types';

interface ReceiptCardProps {
  receipt: CommandReceipt;
  /** Set to true after Undo has been clicked. The chip hides so the
   *  user can't double-undo. */
  undone?: boolean;
  onUndo?: () => void;
}

/**
 * Receipt rendered after a successful command execution. Small,
 * neutral, with an Open-on-page link and a 12s Undo chip. The chip
 * removes itself once the timer elapses so it doesn't stick around
 * looking actionable forever.
 */
export default function ReceiptCard({ receipt, undone, onUndo }: ReceiptCardProps) {
  const [showUndo, setShowUndo] = useState(true);
  useEffect(() => {
    const t = window.setTimeout(() => setShowUndo(false), 12_000);
    return () => window.clearTimeout(t);
  }, []);

  return (
    <div
      style={{
        marginTop: '6px',
        padding: '10px 12px',
        borderRadius: '12px',
        background: '#F1F8F4',
        border: '1px solid #C8E0CD',
        fontFamily: 'var(--font-primary)',
        display: 'flex',
        flexDirection: 'column',
        gap: '6px',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '20px',
            height: '20px',
            borderRadius: '50%',
            background: '#2D6A4F',
            flexShrink: 0,
            marginTop: '1px',
          }}
        >
          <Check size={12} color="#fff" strokeWidth={3} />
        </span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: '13px', fontWeight: 700, color: '#1B4332' }}>{receipt.headline}</div>
          {receipt.detail && (
            <div style={{ fontSize: '12px', fontWeight: 500, color: '#2D6A4F', marginTop: '2px' }}>
              {receipt.detail}
            </div>
          )}
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '8px', marginTop: '2px' }}>
        {showUndo && !undone && receipt.undo && onUndo && (
          <button
            type="button"
            onClick={onUndo}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              padding: '4px 10px',
              borderRadius: '100px',
              border: '1px solid #B6CFBA',
              background: '#fff',
              fontSize: '11px',
              fontWeight: 600,
              fontFamily: 'var(--font-primary)',
              color: '#2D6A4F',
              cursor: 'pointer',
            }}
          >
            <Undo2 size={11} /> Undo
          </button>
        )}
        {undone && (
          <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--color-text-muted)' }}>Reverted</span>
        )}
        {receipt.href && receipt.hrefLabel && (
          <Link
            href={receipt.href}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              padding: '4px 10px',
              borderRadius: '100px',
              background: '#2D6A4F',
              fontSize: '11px',
              fontWeight: 600,
              fontFamily: 'var(--font-primary)',
              color: '#fff',
              textDecoration: 'none',
            }}
          >
            <ExternalLink size={11} /> {receipt.hrefLabel}
          </Link>
        )}
      </div>
    </div>
  );
}
