'use client';

import { useId } from 'react';
import { motion } from 'framer-motion';

export type OrbState = 'idle' | 'thinking' | 'ready';

interface QuinnOrbProps {
  state: OrbState;
  size?: number;
}

// ── Per-state config ──────────────────────────────────────────────────────────
const CONFIG = {
  idle:     { duration: 7.0, r: 5.2 },
  thinking: { duration: 3.0, r: 5.5 },
  ready:    { duration: 1.4, r: 5.0 },
};

// ── Three keyframe positions each circle travels through ──────────────────────
// Circles move through distinct clusters: spread → merge → side-pair → spread
// The goo filter does the visual merging automatically.
const PATHS = [
  // Circle 0
  { cx: [14, 11, 18, 14], cy: [5.5, 14, 13, 5.5] },
  // Circle 1
  { cx: [20.5, 16, 9,  20.5], cy: [18, 13, 14, 18] },
  // Circle 2
  { cx: [7.5,  13, 17, 7.5], cy: [18, 15, 9,  18] },
];

const DELAYS = [0, 0.18, 0.36]; // small offset so movement feels organic, not robotic

export default function QuinnOrb({ state, size = 28 }: QuinnOrbProps) {
  const { duration, r } = CONFIG[state];
  const gooId = useId().replace(/:/g, '');

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 28 28"
      style={{ display: 'block', overflow: 'visible' }}
    >
      <defs>
        {/* Metaball / goo filter — makes circles actually merge when close */}
        <filter id={`quinn-goo-${gooId}`} x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur in="SourceGraphic" stdDeviation="2.2" result="blur" />
          <feColorMatrix
            in="blur"
            mode="matrix"
            values="1 0 0 0 0   0 1 0 0 0   0 0 1 0 0   0 0 0 22 -9"
            result="goo"
          />
          {/* Composite restores original sharp color over the thresholded alpha */}
          <feComposite in="SourceGraphic" in2="goo" operator="atop" />
        </filter>
      </defs>

      {/* Goo group — all 3 circles interact with each other through the filter */}
      <g filter={`url(#quinn-goo-${gooId})`}>
        {PATHS.map((path, i) => (
          <motion.circle
            key={i}
            r={r}
            fill="var(--color-accent-quinn)"
            animate={{
              cx: path.cx,
              cy: path.cy,
              r: [r, r * 1.06, r * 0.97, r],
            }}
            transition={{
              duration,
              delay: DELAYS[i],
              repeat: Infinity,
              ease: [0.45, 0, 0.55, 1],
              times: [0, 0.38, 0.72, 1],
            }}
          />
        ))}
      </g>

      {/* Ready burst — flash ring outside the goo group so it stays crisp */}
      {state === 'ready' && (
        <motion.circle
          cx={14}
          cy={14}
          r={8}
          fill="none"
          stroke="var(--color-accent-quinn)"
          strokeWidth={1.2}
          initial={{ scale: 0.5, opacity: 0.8 }}
          animate={{ scale: 2.0, opacity: 0 }}
          transition={{ duration: 0.7, ease: 'easeOut' }}
          style={{ transformOrigin: '14px 14px' }}
        />
      )}
    </svg>
  );
}
