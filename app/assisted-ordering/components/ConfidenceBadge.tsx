'use client';

import { useState } from 'react';
import type { ConfidenceScore, ConfidenceFactors } from '../types';

const CONFIG: Record<
  ConfidenceScore,
  { label: string; bg: string; text: string; border: string }
> = {
  high: {
    label: 'HIGH',
    bg: 'rgba(21, 128, 61, 0.10)',
    text: '#15803D',
    border: 'rgba(21, 128, 61, 0.25)',
  },
  medium: {
    label: 'MED',
    bg: 'rgba(146, 64, 14, 0.10)',
    text: '#92400E',
    border: 'rgba(146, 64, 14, 0.25)',
  },
  low: {
    label: 'LOW',
    bg: 'rgba(185, 28, 28, 0.10)',
    text: '#B91C1C',
    border: 'rgba(185, 28, 28, 0.25)',
  },
};

function factorLabel(key: string, value: string): { text: string; ok: boolean } {
  const map: Record<string, Record<string, { text: string; ok: boolean }>> = {
    stocktake: {
      fresh: { text: 'Stocktake: fresh (within 3 days)', ok: true },
      aging: { text: 'Stocktake: 3–7 days old', ok: false },
      stale: { text: 'Stocktake: over 7 days old', ok: false },
      none: { text: 'Stocktake: no data', ok: false },
    },
    pos: {
      active: { text: 'POS data: active', ok: true },
      lagged: { text: 'POS data: lagged', ok: false },
      unavailable: { text: 'POS data: unavailable', ok: false },
    },
    par: {
      confirmed: { text: 'Par level: confirmed by you', ok: true },
      suggested: { text: 'Par level: system-suggested', ok: false },
      not_set: { text: 'Par level: not set', ok: false },
    },
    variance: {
      stable: { text: 'Sales variance: stable (±5%)', ok: true },
      moderate: { text: 'Sales variance: moderate (5–20%)', ok: false },
      high: { text: 'Sales variance: high (>20%)', ok: false },
    },
  };
  return map[key]?.[value] ?? { text: `${key}: ${value}`, ok: false };
}

interface Props {
  score: ConfidenceScore;
  factors: ConfidenceFactors;
}

export default function ConfidenceBadge({ score, factors }: Props) {
  const [expanded, setExpanded] = useState(false);
  const cfg = CONFIG[score];

  return (
    <div style={{ position: 'relative', display: 'inline-block' }}>
      <button
        type="button"
        aria-expanded={expanded}
        onClick={() => setExpanded((v) => !v)}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          padding: '2px 7px',
          borderRadius: 'var(--radius-badge)',
          background: cfg.bg,
          color: cfg.text,
          border: `1px solid ${cfg.border}`,
          fontSize: '12px',
          fontWeight: 700,
          letterSpacing: '0.04em',
          cursor: 'pointer',
          fontFamily: 'var(--font-primary)',
          lineHeight: 1.6,
          whiteSpace: 'nowrap',
        }}
      >
        {cfg.label}
      </button>

      {expanded && (
        <div
          style={{
            position: 'absolute',
            top: '100%',
            left: 0,
            marginTop: '6px',
            zIndex: 100,
            background: 'var(--color-bg-surface)',
            border: '1px solid var(--color-border-subtle)',
            borderRadius: 'var(--radius-card)',
            boxShadow: '0 4px 20px rgba(58,48,40,0.14)',
            padding: '10px 14px',
            minWidth: '220px',
            display: 'flex',
            flexDirection: 'column',
            gap: '6px',
          }}
        >
          {(Object.entries(factors) as [string, string][]).map(([key, val]) => {
            const { text, ok } = factorLabel(key, val);
            return (
              <div
                key={key}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  fontSize: '12px', fontWeight: 500,
                  color: 'var(--color-text-primary)',
                  fontFamily: 'var(--font-primary)',
                }}
              >
                <span
                  style={{
                    fontSize: '12px', fontWeight: 500,
                    color: ok ? '#15803D' : '#B91C1C',
                    flexShrink: 0,
                  }}
                >
                  {ok ? '✓' : '✗'}
                </span>
                <span style={{ color: ok ? 'var(--color-text-primary)' : 'var(--color-text-secondary)' }}>
                  {text}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
