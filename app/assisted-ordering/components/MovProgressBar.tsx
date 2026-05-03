'use client';

interface Props {
  current: number;
  minimum: number;
}

export default function MovProgressBar({ current, minimum }: Props) {
  if (minimum === 0) return null;

  const pct = Math.min(100, (current / minimum) * 100);
  const met = current >= minimum;
  const close = pct >= 70;

  const barColor = met ? '#15803D' : close ? '#EA580C' : '#B91C1C';
  const bgColor = met ? 'rgba(21,128,61,0.10)' : close ? 'rgba(234,88,12,0.10)' : 'rgba(185,28,28,0.10)';

  return (
    <div style={{ marginTop: '12px' }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '6px',
        }}
      >
        <span
          style={{
            fontSize: '12px',
            fontWeight: 600,
            color: met ? '#15803D' : 'var(--color-text-secondary)',
            fontFamily: 'var(--font-primary)',
          }}
        >
          {met
            ? 'Minimum order met'
            : `£${(minimum - current).toFixed(0)} to reach minimum`}
        </span>
        <span
          style={{
            fontSize: '12px',
            fontWeight: 600,
            color: 'var(--color-text-secondary)',
            fontFamily: 'var(--font-primary)',
          }}
        >
          £{current.toFixed(0)} / £{minimum.toFixed(0)}
        </span>
      </div>
      <div
        style={{
          height: '6px',
          borderRadius: '999px',
          background: bgColor,
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            height: '100%',
            width: `${pct}%`,
            borderRadius: '999px',
            background: barColor,
            transition: 'width 0.3s ease',
          }}
        />
      </div>
    </div>
  );
}
