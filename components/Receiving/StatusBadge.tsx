export type BadgeVariant = 'default' | 'success' | 'warning' | 'error' | 'info';

const VARIANT_STYLES: Record<BadgeVariant, { bg: string; color: string; dot: string }> = {
  default: { bg: '#F0EFED', color: 'var(--color-text-secondary)', dot: '#A8A29E' },
  success: { bg: '#DCFCE7', color: '#15803D', dot: '#22C55E' },
  warning: { bg: 'var(--color-warning-light)', color: 'var(--color-warning)', dot: '#F59E0B' },
  error:   { bg: '#FEE2E2', color: '#B91C1C', dot: '#EF4444' },
  info:    { bg: '#DBEAFE', color: '#1D4ED8', dot: '#3B82F6' },
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
        background: s.bg,
        color: s.color,
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
