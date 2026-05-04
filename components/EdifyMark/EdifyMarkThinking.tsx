'use client';

import { useId } from 'react';

/**
 * EdifyMarkThinking — animated variant of the EdifyMark glyph used as the
 * "AI is thinking" indicator. Two considered head-tilts followed by three
 * slower pulses give Quinn a personality while the model works.
 *
 * Drop-in replacement for QuinnOrb's `state="thinking"` slot. Sized via
 * the `size` prop (square box, glyph centred with native 96:165 aspect).
 *
 * The tilt's pivot is the bottom-centre of the glyph so it rocks like a
 * head, not a pendulum from the top.
 */

interface EdifyMarkThinkingProps {
  size?: number;
  color?: string;
}

export default function EdifyMarkThinking({
  size = 28,
  color = 'var(--color-accent-active)',
}: EdifyMarkThinkingProps) {
  // Unique id so multiple instances don't share keyframes/animations.
  const rawId = useId().replace(/:/g, '');
  const animName = `edifyTiltPulse_${rawId}`;
  const className = `edify-thinking-${rawId}`;

  return (
    <span
      style={{
        width: size,
        height: size,
        display: 'inline-flex',
        alignItems: 'flex-end',
        justifyContent: 'center',
        flexShrink: 0,
      }}
      aria-label="Quinn is thinking"
      role="img"
    >
      <style>{`
        @keyframes ${animName} {
          0%   { transform: rotate(0)      scale(1);    opacity: 1; }
          7%   { transform: rotate(8deg)   scale(1);    opacity: 1; }
          17%  { transform: rotate(-6deg)  scale(1);    opacity: 1; }
          24%  { transform: rotate(3deg)   scale(1);    opacity: 1; }
          32%  { transform: rotate(0)      scale(1);    opacity: 1; }
          42%  { transform: rotate(0)      scale(0.95); opacity: 0.65; }
          53%  { transform: rotate(0)      scale(1.04); opacity: 1; }
          63%  { transform: rotate(0)      scale(0.95); opacity: 0.65; }
          74%  { transform: rotate(0)      scale(1.04); opacity: 1; }
          84%  { transform: rotate(0)      scale(0.95); opacity: 0.65; }
          92%  { transform: rotate(0)      scale(1.04); opacity: 1; }
          96%  { transform: rotate(0)      scale(1);    opacity: 1; }
          100% { transform: rotate(0)      scale(1);    opacity: 1; }
        }
        .${className} {
          height: 100%;
          width: auto;
          color: ${color};
          transform-origin: bottom center;
          animation: ${animName} 9s ease-in-out infinite;
          will-change: transform, opacity;
        }
        .${className} path {
          fill: currentColor;
          stroke: currentColor;
        }
        @media (prefers-reduced-motion: reduce) {
          .${className} {
            animation: none;
          }
        }
      `}</style>
      <svg
        className={className}
        viewBox="0 0 96 165"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        <path d="M94.4445 0.5H0.5V72.493C0.5 148.585 63.8333 165.506 95.5 164.455V129.247C59.6111 129.247 52.0463 98.7678 52.75 83.5284H94.4445V0.5Z" />
      </svg>
    </span>
  );
}
