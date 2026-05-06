import type { CSSProperties, ReactNode } from 'react';

/**
 * Outline-style status pill — the platform-wide standard for inline
 * status indicators. White background, coloured text, 1.5px coloured
 * border. See `.cursor/rules/status-pills.mdc` for the convention.
 *
 * Solid semantic fills (`--color-success-light`, etc.) MUST NOT be used
 * for pills; they are reserved for banners and callout cards.
 */
export type StatusPillTone =
  | 'success'
  | 'warning'
  | 'error'
  | 'info'
  | 'neutral';

const TONE_BY_NAME: Record<StatusPillTone, { fg: string; border: string }> = {
  success: { fg: 'var(--color-success)',         border: 'var(--color-success)' },
  warning: { fg: 'var(--color-warning)',         border: 'var(--color-warning)' },
  error:   { fg: 'var(--color-error)',           border: 'var(--color-error)' },
  info:    { fg: 'var(--color-info)',            border: 'var(--color-info)' },
  neutral: { fg: 'var(--color-text-secondary)', border: 'var(--color-border)' },
};

export type StatusPillSize = 'xs' | 'sm';

const SIZE_BY_NAME: Record<StatusPillSize, { padding: string; fontSize: number }> = {
  xs: { padding: '2px 7px', fontSize: 9.5 },
  sm: { padding: '3px 9px', fontSize: 10.5 },
};

export type StatusPillProps = {
  tone: StatusPillTone;
  /** Defaults to `sm`. Use `xs` inside dense rows. */
  size?: StatusPillSize;
  /** Optional leading icon — usually a 10–12px lucide-react icon. */
  icon?: ReactNode;
  /** When true, label is rendered as-is (no upper-case transform). */
  preserveCase?: boolean;
  children: ReactNode;
  /** Additional inline styles that override the defaults. Use sparingly. */
  style?: CSSProperties;
  title?: string;
};

export function StatusPill({
  tone,
  size = 'sm',
  icon,
  preserveCase = false,
  children,
  style,
  title,
}: StatusPillProps) {
  const t = TONE_BY_NAME[tone];
  const s = SIZE_BY_NAME[size];
  return (
    <span
      title={title}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 5,
        padding: s.padding,
        borderRadius: 999,
        background: '#ffffff',
        color: t.fg,
        border: `1.5px solid ${t.border}`,
        fontSize: s.fontSize,
        fontWeight: 700,
        letterSpacing: '0.05em',
        textTransform: preserveCase ? 'none' : 'uppercase',
        whiteSpace: 'nowrap',
        lineHeight: 1,
        fontFamily: 'var(--font-primary)',
        ...style,
      }}
    >
      {icon}
      {children}
    </span>
  );
}

export default StatusPill;
