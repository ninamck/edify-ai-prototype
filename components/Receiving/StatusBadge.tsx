export type BadgeVariant = 'default' | 'success' | 'warning' | 'error' | 'info';

// Outline pills — see `.cursor/rules/status-pills.mdc`. White background,
// coloured text, 1.5px coloured border. The dot is the same colour as the
// border so the indicator reads cleanly at a glance.
const VARIANT_STYLES: Record<BadgeVariant, { color: string; border: string; dot: string }> = {
  default: { color: 'var(--color-text-secondary)', border: 'var(--color-border)',     dot: '#A8A29E' },
  success: { color: 'var(--color-success)',         border: 'var(--color-success)',    dot: 'var(--color-success)' },
  warning: { color: 'var(--color-warning)',         border: 'var(--color-warning)',    dot: 'var(--color-warning)' },
  error:   { color: 'var(--color-error)',           border: 'var(--color-error)',      dot: 'var(--color-error)' },
  info:    { color: 'var(--color-info)',            border: 'var(--color-info)',       dot: 'var(--color-info)' },
};

const STATUS_VARIANT_MAP: Record<string, BadgeVariant> = {
  'Sent': 'info',
  'Partially Received': 'warning',
  'Fully Received': 'success',
  'Closed': 'default',
  'Cancelled': 'error',
  'Pending Invoice': 'warning',
  'Matched': 'success',
  'Variance — Awaiting Resolution': 'error',
  'Created': 'info',
  'OK': 'success',
};

interface StatusBadgeProps {
  status: string;
  variant?: BadgeVariant;
}

export default function StatusBadge({ status, variant }: StatusBadgeProps) {
  const v = variant ?? STATUS_VARIANT_MAP[status] ?? 'default';
  const s = VARIANT_STYLES[v];
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '5px',
        padding: '4px 10px',
        borderRadius: '100px',
        fontSize: '12px',
        fontWeight: 600,
        fontFamily: 'var(--font-primary)',
        background: '#ffffff',
        color: s.color,
        border: `1.5px solid ${s.border}`,
        whiteSpace: 'nowrap',
        lineHeight: 1,
      }}
    >
      <span
        style={{
          width: '6px',
          height: '6px',
          borderRadius: '50%',
          background: s.dot,
          flexShrink: 0,
        }}
      />
      {status}
    </span>
  );
}
