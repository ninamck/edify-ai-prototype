'use client';

import type { SVGProps } from 'react';

/**
 * EdifyMark — the brand glyph used as Quinn's / Edify's mark across the
 * product. Drop-in replacement for the lucide-react `Sparkles` icon:
 *   <EdifyMark size={16} color="var(--color-info)" />
 *
 * Accepts the same prop shape as a lucide icon (`size`, `color`,
 * `strokeWidth`, plus pass-through SVG props) so call-sites don't need
 * to change. Mark is a solid shape; `strokeWidth` is accepted but
 * ignored. `color` is applied as the SVG fill (defaults to
 * `currentColor` so it picks up the surrounding text colour).
 *
 * Native aspect ratio is 96:165 (portrait). The SVG is rendered into a
 * square `size × size` box and the path is centred via the default
 * `preserveAspectRatio='xMidYMid meet'`, so the mark sits neatly where
 * a Sparkles icon used to be without throwing alignment off.
 */
export type EdifyMarkProps = Omit<
  SVGProps<SVGSVGElement>,
  'width' | 'height' | 'fill' | 'stroke' | 'color'
> & {
  size?: number | string;
  color?: string;
  /** Accepted for API parity with lucide icons; ignored (this mark is a solid shape). */
  strokeWidth?: number | string;
};

export default function EdifyMark({
  size = 16,
  color,
  strokeWidth: _strokeWidth,
  className,
  style,
  ...rest
}: EdifyMarkProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 96 165"
      width={size}
      height={size}
      aria-hidden="true"
      className={className}
      style={{ flexShrink: 0, ...style }}
      {...rest}
    >
      <path
        d="M94.4445 0.5H0.5V72.493C0.5 148.585 63.8333 165.506 95.5 164.455V129.247C59.6111 129.247 52.0463 98.7678 52.75 83.5284H94.4445V0.5Z"
        fill={color ?? 'currentColor'}
        stroke="none"
      />
    </svg>
  );
}
