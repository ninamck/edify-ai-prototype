import { BAKERY_DELIVERIES, fmtClock, STORE_OPENS } from './bronxData';

const FROM = 3 * 60 + 50;
const TO = 7 * 60 + 15;
const TICKS = [4, 5, 6, 7];

/**
 * This week's bakery delivery times against store opening. A delivery after
 * opening is a filled pink dot, an on-time one a hollow dot, so shape carries
 * the meaning as well as colour.
 */
export default function DeliveryChart({ tone = 'navy' }: { tone?: 'navy' | 'light' }) {
  const ink = tone === 'navy' ? '#ffffff' : 'var(--color-text-primary)';
  const rule = tone === 'navy' ? 'rgba(255,255,255,0.28)' : 'var(--color-border-subtle)';
  const W = 320;
  const L = 44;
  const R = 266;
  const x = (m: number) => L + ((m - FROM) / (TO - FROM)) * (R - L);
  const top = 26;
  const gap = 30;
  const H = top + gap * BAKERY_DELIVERIES.length + 22;
  const late = BAKERY_DELIVERIES.filter(d => d.at > STORE_OPENS).length;

  return (
    <figure style={{ margin: 0 }}>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" aria-hidden style={{ display: 'block', maxWidth: 420, fontFamily: 'var(--font-primary)' }}>
        {TICKS.map(h => (
          <text key={h} x={x(h * 60)} y={12} fill={ink} fontSize={10} textAnchor="middle" opacity={0.85}>
            {h} AM
          </text>
        ))}
        <line x1={x(STORE_OPENS)} x2={x(STORE_OPENS)} y1={18} y2={H - 18} stroke={ink} strokeDasharray="3 3" strokeWidth={1} />
        <text x={x(STORE_OPENS)} y={H - 4} fill={ink} fontSize={10} textAnchor="middle" opacity={0.85}>
          Store opens 5 AM
        </text>
        {BAKERY_DELIVERIES.map((d, i) => {
          const y = top + gap * i + 8;
          const isLate = d.at > STORE_OPENS;
          return (
            <g key={d.day}>
              <text x={0} y={y + 4} fill={ink} fontSize={11.5}>{d.day}</text>
              <line x1={L} x2={R} y1={y} y2={y} stroke={rule} strokeWidth={1} />
              {isLate ? (
                <circle cx={x(d.at)} cy={y} r={6.5} fill="var(--color-accent-pink)" />
              ) : (
                <circle cx={x(d.at)} cy={y} r={5.5} fill="none" stroke={ink} strokeWidth={1.6} />
              )}
              <text x={W} y={y + 4} fill={ink} fontSize={11.5} textAnchor="end" fontWeight={isLate ? 700 : 400}>
                {fmtClock(d.at).replace(' AM', '')}
              </text>
            </g>
          );
        })}
      </svg>
      <figcaption style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)' }}>
        Bakery delivery times this week. The store opens at 5 AM. {late} of 5 deliveries came after opening:{' '}
        {BAKERY_DELIVERIES.map(d => `${d.day} ${fmtClock(d.at)}${d.at > STORE_OPENS ? ', after opening' : ''}`).join('; ')}.
      </figcaption>
    </figure>
  );
}
