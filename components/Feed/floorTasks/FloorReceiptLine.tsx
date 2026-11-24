'use client';

import Link from 'next/link';
import { useWorld } from '@/lib/floorTasks/world/store';

/** What Edify says after a task that ran without a confirm. */
export default function FloorReceiptLine({ receiptId, onDiscard }: { receiptId: string; onDiscard?: (receiptId: string) => void }) {
  const receipt = useWorld().receipts.find((r) => r.id === receiptId);
  if (!receipt) return null;

  if (receipt.undone) {
    return <div style={{ fontSize: '13.5px', color: 'var(--color-text-secondary)' }}>Count discarded. Nothing was applied.</div>;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      <div style={{ fontSize: '13.5px', color: 'var(--color-text-primary)', fontWeight: 500 }}>{receipt.headline}.</div>
      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
        {receipt.href && (
          <Link href={receipt.href} style={{ ...btn, background: 'var(--color-accent-active, #224444)', color: '#fff', borderColor: 'transparent' }}>
            {receipt.hrefLabel ?? 'Open'}
          </Link>
        )}
        {receipt.undo.kind === 'cancel' && onDiscard && (
          <button type="button" onClick={() => onDiscard(receipt.id)} style={btn}>
            Discard
          </button>
        )}
      </div>
    </div>
  );
}

const btn: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  minHeight: '40px',
  padding: '0 16px',
  borderRadius: '100px',
  border: '1.5px solid var(--color-border, rgba(0,28,53,0.18))',
  background: '#fff',
  color: 'var(--color-text-primary)',
  fontSize: '13px',
  fontWeight: 600,
  fontFamily: 'var(--font-primary)',
  textDecoration: 'none',
  cursor: 'pointer',
  whiteSpace: 'nowrap',
};
