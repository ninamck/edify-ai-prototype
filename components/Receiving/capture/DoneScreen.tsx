'use client';

import Link from 'next/link';
import { Check, Undo2 } from 'lucide-react';
import type { Sample } from './samples';
import { C, card, keepIds, PrimaryButton, SecondaryButton } from './ui';

interface Props {
  sample: Sample;
  grnId: string;
  grnNumber: string;
  lines: string[];
  creditRefs: string[];
  onFinish: () => void;
  onAnother: () => void;
  onUndo: () => void;
}

export default function DoneScreen({ sample, grnId, grnNumber, lines, creditRefs, onFinish, onAnother, onUndo }: Props) {
  const receipt = sample.kind === 'receipt';
  const link = { color: 'var(--color-link)', fontWeight: 600, textDecoration: 'underline', textUnderlineOffset: 3 } as const;
  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: '40px 16px 32px' }}>
      <div style={{ maxWidth: 520, margin: '0 auto' }}>
        <div
          aria-hidden
          style={{ width: 56, height: 56, borderRadius: 28, border: `2.5px solid ${C.navy}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        >
          <Check size={30} strokeWidth={2.5} />
        </div>
        <h1 style={{ margin: '20px 0 0', fontSize: 28, fontWeight: 600, lineHeight: 1.2 }}>{receipt ? 'Receipt accepted' : 'Delivery accepted'}</h1>
        <p style={{ margin: '6px 0 0', fontSize: 16, color: C.muted }}>
          <Link href={`/receive/grn/${grnId}`} style={link}>
            {grnNumber}
          </Link>{' '}
          &middot; {sample.supplier}
          {sample.poNumbers.length > 0 ? ` \u00b7 ${sample.poNumbers.join(' + ')}` : ''}
        </p>

        <ul style={{ ...card, listStyle: 'none', margin: '24px 0 0', padding: '4px 0' }}>
          {lines.map((l, i) => (
            <li key={l} style={{ display: 'flex', gap: 12, padding: '12px 16px', borderTop: i === 0 ? 'none' : `1px solid ${C.subtle}`, fontSize: 16, lineHeight: 1.45 }}>
              <Check size={18} aria-hidden style={{ flexShrink: 0, marginTop: 3 }} />
              <span>{keepIds(l)}</span>
            </li>
          ))}
        </ul>
        {creditRefs.length > 0 && (
          <p style={{ margin: '12px 0 0', fontSize: 14, color: C.muted, lineHeight: 1.5 }}>
            Edify emailed {sample.supplier} for the credit. Track it in{' '}
            <Link href="/credit-notes" style={link}>
              credit notes
            </Link>{' '}
            <span style={{ whiteSpace: 'nowrap' }}>({creditRefs.join(', ')}).</span>
          </p>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 24 }}>
          <PrimaryButton onClick={onFinish}>Back to deliveries</PrimaryButton>
          <SecondaryButton onClick={onAnother}>Photo another</SecondaryButton>
          <button
            type="button"
            onClick={onUndo}
            style={{
              alignSelf: 'center',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              minHeight: 44,
              padding: '0 12px',
              border: 'none',
              background: 'none',
              color: C.ink,
              fontSize: 15,
              fontWeight: 600,
              fontFamily: 'var(--font-primary)',
              cursor: 'pointer',
            }}
          >
            <Undo2 size={18} aria-hidden />
            Undo and go back to the check
          </button>
        </div>
      </div>
    </div>
  );
}
