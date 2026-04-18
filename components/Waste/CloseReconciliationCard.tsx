'use client';

import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { ClipboardCheck } from 'lucide-react';
import { unaccountedAtPhase } from '@/components/Waste/wasteData';
import type { BriefingPhase } from '@/components/briefing';

export default function CloseReconciliationCard({ phase }: { phase: BriefingPhase }) {
  const router = useRouter();
  const items = unaccountedAtPhase(phase);
  if (items.length === 0) return null;

  const title =
    phase === 'evening'
      ? 'End of day · reconcile waste'
      : phase === 'afternoon'
      ? 'Afternoon check · items tracking short'
      : 'Items tracking short';

  const subtitle =
    phase === 'evening'
      ? 'Made vs sold — one tap to log the rest as waste.'
      : 'Sell-through slower than expected. Check or log now.';

  function goWaste(productId: string, qty: number, reason: 'expired' | 'no-reason') {
    router.push(
      `/log-waste?itemId=${encodeURIComponent(productId)}&qty=${qty}&reason=${reason}`,
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.26, ease: 'easeOut' }}
      style={{
        borderRadius: '10px',
        background: 'rgba(185,28,28,0.055)',
        border: '1px solid rgba(185,28,28,0.22)',
        padding: '12px',
        marginBottom: '10px',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '7px', marginBottom: '8px' }}>
        <ClipboardCheck size={13} color="#B91C1C" strokeWidth={2.2} />
        <span
          style={{
            fontSize: '12px',
            fontWeight: 700,
            letterSpacing: '0.04em',
            color: '#B91C1C',
          }}
        >
          {title}
        </span>
        <span
          style={{
            fontSize: '11px',
            fontWeight: 600,
            color: '#B91C1C',
            opacity: 0.75,
            marginLeft: '2px',
          }}
        >
          · {items.length}
        </span>
      </div>
      <p
        style={{
          margin: '0 0 12px',
          fontSize: '12px',
          fontWeight: 500,
          color: 'var(--color-text-secondary)',
          lineHeight: 1.45,
        }}
      >
        {subtitle}
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {items.map(({ productId, product, made, sold, short }) => (
          <div
            key={productId}
            style={{
              padding: '10px 12px',
              borderRadius: '8px',
              background: '#fff',
              border: '1px solid var(--color-border-subtle)',
              boxShadow: '0 1px 3px rgba(58,48,40,0.06)',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'baseline',
                justifyContent: 'space-between',
                gap: '10px',
                marginBottom: '6px',
              }}
            >
              <div
                style={{
                  fontSize: '13px',
                  fontWeight: 700,
                  color: 'var(--color-text-primary)',
                  lineHeight: 1.3,
                }}
              >
                {product.name}
              </div>
              <div style={{ fontSize: '12px', fontWeight: 500, color: 'var(--color-text-muted)', whiteSpace: 'nowrap' }}>
                made {made}, sold {sold}
              </div>
            </div>
            <div
              style={{
                fontSize: '12px',
                fontWeight: 500,
                color: 'var(--color-text-secondary)',
                marginBottom: '10px',
              }}
            >
              <strong style={{ color: '#B91C1C' }}>{short} short</strong>
              {' · £'}
              {(short * product.unitCost).toFixed(2)} at stake
            </div>
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={() => goWaste(productId, short, 'expired')}
                style={{
                  padding: '6px 12px',
                  borderRadius: '6px',
                  fontSize: '12px',
                  fontWeight: 600,
                  fontFamily: 'var(--font-primary)',
                  cursor: 'pointer',
                  border: 'none',
                  background: '#B91C1C',
                  color: '#fff',
                }}
              >
                Waste {short}
              </button>
              <button
                type="button"
                onClick={() => goWaste(productId, short, 'no-reason')}
                style={{
                  padding: '6px 12px',
                  borderRadius: '6px',
                  fontSize: '12px',
                  fontWeight: 600,
                  fontFamily: 'var(--font-primary)',
                  cursor: 'pointer',
                  border: '1px solid var(--color-border)',
                  background: 'transparent',
                  color: 'var(--color-text-secondary)',
                }}
              >
                Not waste
              </button>
            </div>
          </div>
        ))}
      </div>
    </motion.div>
  );
}
