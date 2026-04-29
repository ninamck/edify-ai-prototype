'use client';

import {
  HEATMAP_DAYS,
  HEATMAP_HOURS,
  MANCHESTER_HEATMAP,
} from '@/components/Dashboard/data/playtomicMockData';

const COOL = '#21a87a';   // green / full
const MID = '#7fc5a3';    // light green
const WARM = '#f1c98a';   // amber
const HOT = '#e88c6a';    // coral / empty

/** Bucket fill % into a colour. Mirrors the green→amber→coral scale in image 2. */
function bucketColour(v: number): string {
  if (v >= 75) return COOL;
  if (v >= 60) return MID;
  if (v >= 45) return WARM;
  return HOT;
}

function textColour(v: number): string {
  return v >= 60 ? '#0d2a3a' : '#5a3825';
}

export default function CourtHeatmap() {
  const cellW = 86;
  const cellH = 50;
  const labelLeft = 56;
  const labelTop = 24;
  const width = labelLeft + HEATMAP_DAYS.length * cellW + 12;
  const height = labelTop + HEATMAP_HOURS.length * cellH + 28;

  return (
    <div
      style={{
        padding: '16px 16px 14px',
        borderRadius: 12,
        border: '1px solid var(--color-border-subtle)',
        background: '#fff',
        boxShadow: '0 2px 12px rgba(58,48,40,0.06)',
        fontFamily: 'var(--font-primary)',
      }}
    >
      <div style={{ marginBottom: 10 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--color-text-primary)' }}>
          Manchester · last 4 weeks
        </div>
        <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--color-text-muted)', marginTop: 2 }}>
          Court utilisation by hour and day. Lapsed card is the click target.
        </div>
      </div>
      <div style={{ width: '100%', overflowX: 'auto' }}>
        <svg
          viewBox={`0 0 ${width} ${height}`}
          width="100%"
          style={{ maxWidth: width, fontFamily: 'var(--font-primary)' }}
        >
          {HEATMAP_DAYS.map((d, col) => (
            <text
              key={d}
              x={labelLeft + col * cellW + cellW / 2}
              y={labelTop - 8}
              fontSize={11}
              fill="var(--color-text-muted)"
              textAnchor="middle"
              fontWeight={600}
            >
              {d}
            </text>
          ))}
          {HEATMAP_HOURS.map((h, row) => (
            <text
              key={h}
              x={labelLeft - 12}
              y={labelTop + row * cellH + cellH / 2 + 4}
              fontSize={11}
              fill="var(--color-text-secondary)"
              textAnchor="end"
              fontWeight={600}
            >
              {h}
            </text>
          ))}
          {MANCHESTER_HEATMAP.map((row, r) =>
            row.map((v, c) => {
              const x = labelLeft + c * cellW + 3;
              const y = labelTop + r * cellH + 3;
              const w = cellW - 6;
              const ht = cellH - 6;
              return (
                <g key={`${r}-${c}`}>
                  <rect x={x} y={y} width={w} height={ht} rx={6} fill={bucketColour(v)} />
                  <text
                    x={x + w / 2}
                    y={y + ht / 2 + 4}
                    fontSize={11}
                    textAnchor="middle"
                    fill={textColour(v)}
                    fontWeight={600}
                  >
                    {v}
                  </text>
                </g>
              );
            }),
          )}
          <g>
            <text
              x={width - 132}
              y={height - 8}
              fontSize={10}
              fill="var(--color-text-muted)"
              fontWeight={600}
            >
              Empty
            </text>
            {[HOT, WARM, MID, COOL].map((c, i) => (
              <rect
                key={i}
                x={width - 100 + i * 18}
                y={height - 18}
                width={16}
                height={10}
                rx={3}
                fill={c}
              />
            ))}
            <text
              x={width - 4}
              y={height - 8}
              fontSize={10}
              fill="var(--color-text-muted)"
              fontWeight={600}
              textAnchor="end"
            >
              Full
            </text>
          </g>
        </svg>
      </div>
    </div>
  );
}
