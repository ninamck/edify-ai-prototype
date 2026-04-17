'use client';

import { motion } from 'framer-motion';
import {
  Activity,
  Sparkles,
  ClipboardCheck,
  AlertTriangle,
} from 'lucide-react';

export type CommandCentreVariant = 'store' | 'chain' | 'finance';

interface CommandCentreProps {
  variant: CommandCentreVariant;
  siteLabel?: string;
  /** When true, removes outer margin (e.g. inside a modal). */
  embedded?: boolean;
}

function Hi({ children }: { children: React.ReactNode }) {
  return (
    <span style={{ fontWeight: 700, color: 'var(--color-text-primary)' }}>
      {children}
    </span>
  );
}

/** Simple labour curve: actual (deep) vs forecast (muted) — hours 6–22 */
function LabourCurve({ subtitle }: { subtitle: string }) {
  const w = 280;
  const h = 88;
  const pad = { l: 8, r: 8, t: 8, b: 18 };
  const innerW = w - pad.l - pad.r;
  const innerH = h - pad.t - pad.b;
  // Normalised points 0–1 for y (inverted: high cost = higher on chart)
  const forecast = [0.35, 0.32, 0.38, 0.45, 0.52, 0.68, 0.75, 0.72, 0.55, 0.42, 0.38, 0.32];
  const actual = [0.33, 0.34, 0.4, 0.48, 0.58, 0.82, 0.88, 0.79, 0.62, 0.45, 0.36, 0.3];
  const toPath = (pts: number[]) =>
    pts
      .map((y, i) => {
        const x = pad.l + (i / (pts.length - 1)) * innerW;
        const yy = pad.t + y * innerH;
        return `${i === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${yy.toFixed(1)}`;
      })
      .join(' ');

  return (
    <div>
      <div style={{
        fontSize: '12px', fontWeight: 700, letterSpacing: '0.04em',
        textTransform: 'uppercase', color: 'var(--color-text-secondary)',
        marginBottom: '8px',
      }}>
        Labour cost by hour vs forecast
      </div>
      <div style={{ fontSize: '12px', fontWeight: 500, color: 'var(--color-text-muted)', marginBottom: '6px' }}>
        {subtitle}
      </div>
      <svg width="100%" viewBox={`0 0 ${w} ${h}`} style={{ display: 'block' }}>
        <path
          d={toPath(forecast)}
          fill="none"
          stroke="rgba(107,94,85,0.35)"
          strokeWidth="2"
          strokeDasharray="4 3"
        />
        <path
          d={toPath(actual)}
          fill="none"
          stroke="var(--color-accent-deep)"
          strokeWidth="2.2"
        />
        <text x={pad.l} y={h - 4} fontSize="9" fill="var(--color-text-muted)">
          6am
        </text>
        <text x={w / 2 - 12} y={h - 4} fontSize="9" fill="var(--color-text-muted)">
          midday
        </text>
        <text x={w - 28} y={h - 4} fontSize="9" fill="var(--color-text-muted)">
          10pm
        </text>
      </svg>
      <div style={{ display: 'flex', gap: '12px', marginTop: '4px', fontSize: '12px', fontWeight: 500, color: 'var(--color-text-muted)' }}>
        <span><span style={{ color: 'var(--color-accent-deep)', fontWeight: 700 }}>—</span> Actual</span>
        <span><span style={{ color: 'rgba(107,94,85,0.5)', fontWeight: 700 }}>· ·</span> Forecast</span>
      </div>
    </div>
  );
}

function ConfidenceMeter({ label, valuePct, caption }: { label: string; valuePct: number; caption: string }) {
  return (
    <div>
      <div style={{
        fontSize: '12px', fontWeight: 700, letterSpacing: '0.04em',
        textTransform: 'uppercase', color: 'var(--color-text-secondary)',
        marginBottom: '8px',
      }}>
        {label}
      </div>
      <div style={{
        height: '10px', borderRadius: '100px',
        background: 'rgba(58,48,40,0.08)',
        overflow: 'hidden',
        marginBottom: '8px',
      }}>
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${valuePct}%` }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
          style={{
            height: '100%',
            borderRadius: '100px',
            background: valuePct >= 70
              ? 'linear-gradient(90deg, #2D6A4F, #40916C)'
              : valuePct >= 45
                ? 'linear-gradient(90deg, #FFFFFF, #E8E6E3)'
                : 'linear-gradient(90deg, #9B2226, #E85D04)',
          }}
        />
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <span style={{ fontSize: '20px', fontWeight: 700, color: 'var(--color-text-primary)' }}>{valuePct}%</span>
        <span style={{ fontSize: '12px', fontWeight: 500, color: 'var(--color-text-muted)', textAlign: 'right', maxWidth: '70%' }}>
          {caption}
        </span>
      </div>
    </div>
  );
}

const QUINN_ACTIONS = [
  {
    title: 'Rebalance doughnut / croissant recurring order',
    detail: 'Fitzroy · pattern + margin',
  },
  {
    title: 'Approve Bidfood Thursday basket',
    detail: '£1,240 · 14 lines',
  },
  {
    title: 'Map new spinach SKU before production',
    detail: 'Urban Fresh',
  },
];

export default function CommandCentre({ variant, siteLabel = 'Fitzroy Espresso', embedded = false }: CommandCentreProps) {
  const outerMargin = embedded ? 0 : '0 20px 20px';


  const scope =
    variant === 'store'
      ? siteLabel
      : variant === 'chain'
        ? 'All sites · consolidated'
        : 'Head office · finance view';

  const pnlLabel =
    variant === 'finance' ? 'Gross margin · cost picture confidence' : 'Live P&L confidence';

  const pnlCaption =
    variant === 'finance'
      ? 'How complete your cost inputs are for the current period — not a final margin yet.'
      : 'Based on matched sales, clocked labour, and invoices posted so far today.';

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      style={{
        margin: outerMargin,
        padding: '16px',
        borderRadius: '12px',
        background: '#fff',
        border: '1px solid var(--color-border-subtle)',
        boxShadow: '0 2px 12px rgba(58,48,40,0.1), 0 0 0 1px rgba(58,48,40,0.03)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
        <span style={{
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          width: '28px', height: '28px', borderRadius: '8px',
          background: 'var(--color-quinn-bg)',
        }}>
          <Sparkles size={14} color="var(--color-accent-quinn)" strokeWidth={2} />
        </span>
        <div>
          <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--color-text-primary)' }}>
            The &ldquo;Today&rdquo; Command Centre
          </div>
          <div style={{ fontSize: '12px', fontWeight: 500, color: 'var(--color-text-muted)', marginTop: '2px' }}>
            {scope}
          </div>
        </div>
      </div>

      {/* Proactive alert */}
      <div style={{
        display: 'flex', alignItems: 'flex-start', gap: '10px',
        padding: '10px 12px',
        borderRadius: '8px',
        background: '#FEF9F3',
        border: '1px solid #F5E6D3',
        marginBottom: '16px',
      }}>
        <AlertTriangle size={16} color="#7A3800" style={{ flexShrink: 0, marginTop: '1px' }} />
        <div style={{ fontSize: '13px', color: 'var(--color-text-secondary)', lineHeight: 1.55 }}>
          <strong style={{ color: '#7A3800' }}>Proactive alert · </strong>
          Matcha stock will run out <Hi>Friday</Hi> at {variant === 'store' ? siteLabel : 'two sites'} based on current velocity and no inbound PO before then.
        </div>
      </div>

      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: '16px',
        marginBottom: '16px',
      }}>
        <div style={{ gridColumn: variant === 'finance' ? '1 / -1' : '1 / 2' }}>
          <ConfidenceMeter
            label={pnlLabel}
            valuePct={variant === 'finance' ? 72 : 78}
            caption={pnlCaption}
          />
        </div>
        {variant === 'finance' && (
          <div style={{ gridColumn: '1 / -1' }}>
            <ConfidenceMeter
              label="Period cost completeness"
              valuePct={64}
              caption="Of this period’s costs confirmed vs still pending accrual or invoice."
            />
          </div>
        )}
        {variant !== 'finance' && (
          <div style={{ gridColumn: '2 / 3' }}>
            <LabourCurve
              subtitle={
                variant === 'store'
                  ? `${siteLabel} · yesterday`
                  : 'Chain roll-up · yesterday'
              }
            />
          </div>
        )}
      </div>

      {variant === 'finance' && (
        <div style={{ marginBottom: '16px' }}>
          <div style={{
            fontSize: '12px', fontWeight: 700, letterSpacing: '0.04em',
            textTransform: 'uppercase', color: 'var(--color-text-secondary)',
            marginBottom: '8px',
          }}>
            Invoice &amp; PO match throughput (overnight)
          </div>
          <div style={{
            height: '10px', borderRadius: '100px',
            background: 'rgba(58,48,40,0.08)',
            overflow: 'hidden',
            display: 'flex',
          }}>
            <div style={{ width: '68%', background: '#2D6A4F', height: '100%' }} title="Matched" />
            <div style={{ width: '22%', background: 'var(--color-accent-active)', height: '100%' }} title="In review" />
            <div style={{ width: '10%', background: 'rgba(155,34,38,0.85)', height: '100%' }} title="Exception" />
          </div>
          <div style={{ display: 'flex', gap: '12px', marginTop: '6px', fontSize: '12px', fontWeight: 500, color: 'var(--color-text-muted)' }}>
            <span>68% cleared</span>
            <span>22% in review</span>
            <span>10% exception</span>
          </div>
        </div>
      )}

      {/* Top 3 Quinn approvals */}
      <div style={{
        fontSize: '12px', fontWeight: 700, letterSpacing: '0.04em',
        textTransform: 'uppercase', color: 'var(--color-text-secondary)',
        marginBottom: '10px',
        display: 'flex', alignItems: 'center', gap: '6px',
      }}>
        <ClipboardCheck size={12} color="var(--color-text-secondary)" />
        Top 3 · Quinn needs your approval
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {QUINN_ACTIONS.map((a, i) => (
          <div
            key={i}
            style={{
              padding: '10px 12px',
              borderRadius: '8px',
              background: 'var(--color-bg-nav)',
              border: '1px solid var(--color-border-subtle)',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px',
            }}
          >
            <div>
              <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-text-primary)' }}>
                {i + 1}. {a.title}
              </div>
              <div style={{ fontSize: '12px', fontWeight: 500, color: 'var(--color-text-muted)', marginTop: '2px' }}>
                {a.detail}
              </div>
            </div>
            <button
              type="button"
              style={{
                padding: '5px 10px',
                borderRadius: '6px',
                fontSize: '12px', fontWeight: 600,
                fontFamily: 'var(--font-primary)',
                border: 'none',
                cursor: 'pointer',
                background: 'var(--color-accent-deep)',
                color: '#F4F1EC',
                flexShrink: 0,
              }}
            >
              Review
            </button>
          </div>
        ))}
      </div>

      <div style={{
        marginTop: '14px', paddingTop: '12px',
        borderTop: '1px solid var(--color-border-subtle)',
        fontSize: '12px', fontWeight: 500, color: 'var(--color-text-muted)',
        display: 'flex', alignItems: 'center', gap: '6px',
      }}>
        <Activity size={11} />
        <span>Updates as invoices and labour posts land — role view is adaptive.</span>
      </div>
    </motion.div>
  );
}
