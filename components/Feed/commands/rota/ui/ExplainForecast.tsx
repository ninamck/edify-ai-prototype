'use client';

/**
 * Explain the forecast. Opens from any day's forecast figure in the
 * grid and answers the GM's first question: where did that number come
 * from, and how did it become hours?
 *
 * Three parts, read top to bottom: the pounds (day pattern plus named
 * adjustments), the work (sales hours, fixed tasks, floor minimum) and
 * the standards behind the maths with their provenance. Defaults say
 * they are defaults. Trust is the adoption problem, not the arithmetic.
 */

import { X } from 'lucide-react';
import type { ForecastExplanation } from '../types';
import { hhmm, UTILISATION } from '../engine';
import { body, label, small, textButton } from './tokens';

const DAY_NAME: Record<string, string> = {
  Mon: 'Monday',
  Tue: 'Tuesday',
  Wed: 'Wednesday',
  Thu: 'Thursday',
  Fri: 'Friday',
  Sat: 'Saturday',
  Sun: 'Sunday',
};

const SOURCE_LABEL: Record<string, string> = {
  grn: 'Delivery',
  prep: 'Production plan',
  stocktake: 'Stocktake',
  clean: 'Close-down',
  checklist: 'Checklist',
  order: 'Pre-order',
  brew: 'Brew schedule',
};

function gbp(n: number): string {
  return `£${Math.round(n).toLocaleString('en-GB')}`;
}

function signed(n: number): string {
  return `${n > 0 ? '+' : ''}${n}%`;
}

function Row({ left, right, muted }: { left: React.ReactNode; right: React.ReactNode; muted?: boolean }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', alignItems: 'baseline' }}>
      <span style={{ ...body, color: muted ? 'var(--color-text-secondary)' : 'var(--color-text-primary)' }}>{left}</span>
      <span style={{ ...body, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap', color: muted ? 'var(--color-text-secondary)' : 'var(--color-text-primary)' }}>
        {right}
      </span>
    </div>
  );
}

export default function ExplainForecast({ x, onClose }: { x: ForecastExplanation; onClose: () => void }) {
  const dayName = DAY_NAME[x.day] ?? x.day;
  const colStyle: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: '6px', minWidth: 0 };

  return (
    <section
      aria-label={`Why ${gbp(x.salesGBP)} on ${dayName}`}
      style={{
        border: '1px solid var(--color-border-subtle)',
        borderRadius: '10px',
        padding: '12px 14px',
        background: 'rgba(0,28,53,0.015)',
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: '8px' }}>
        <div>
          <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--color-text-primary)' }}>
            Why {gbp(x.salesGBP)} on {dayName}
          </div>
          <div style={small}>
            Open {hhmm(x.open)} to {hhmm(x.close)}. About {x.transactions.toLocaleString('en-GB')} transactions. Busiest hour {hhmm(x.peak.start)} to {hhmm(x.peak.end)}, {x.peak.heads} on.
          </div>
        </div>
        <button type="button" style={{ ...textButton, padding: '4px 6px', display: 'inline-flex', alignItems: 'center', gap: '4px' }} onClick={onClose} aria-label="Close forecast explanation">
          <X size={13} aria-hidden="true" /> Close
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '16px' }}>
        <div style={colStyle}>
          <div style={label}>The pounds</div>
          <Row left={`Day pattern from the last four ${dayName}s`} right={gbp(x.baseGBP)} />
          {x.signals.length === 0 && <Row left="No adjustments this week" right="" muted />}
          {x.signals.map((s) => (
            <div key={s.label}>
              <Row
                left={`${s.label}${s.start !== undefined && s.end !== undefined ? `, ${hhmm(s.start)} to ${hhmm(s.end)}` : ''}`}
                right={signed(s.effectPct)}
              />
              <div style={{ ...small, marginTop: '1px' }}>{s.detail.charAt(0).toUpperCase() + s.detail.slice(1)}</div>
            </div>
          ))}
          <div style={{ borderTop: '1px solid var(--color-border-subtle)', paddingTop: '6px' }}>
            <Row left={<strong>Forecast</strong>} right={<strong>{gbp(x.salesGBP)}{x.adjustPct !== 0 ? ` (${signed(x.adjustPct)})` : ''}</strong>} />
          </div>
        </div>

        <div style={colStyle}>
          <div style={label}>The work</div>
          <Row left={`Sales, ${x.humanSecondsPerTransaction}s of hands-on time each`} right={`${x.salesHours}h`} />
          {x.tasks.length > 0 && <Row left="Fixed work, listed below" right={`${x.taskHours}h`} />}
          {x.tasks.map((t) => (
            <div key={t.id}>
              <Row
                left={`${(SOURCE_LABEL[t.source] ?? t.source).toLowerCase() === t.label.toLowerCase() ? t.label : `${SOURCE_LABEL[t.source] ?? t.source}: ${t.label}`}, ${hhmm(t.start)} to ${hhmm(t.end)}`}
                right={`${t.humanMinutes} min`}
              />
              <div style={{ ...small, marginTop: '1px' }}>{t.evidence}</div>
            </div>
          ))}
          <Row left="Floor minimum while open" right={`${x.floorHours}h`} muted />
          <div style={{ borderTop: '1px solid var(--color-border-subtle)', paddingTop: '6px' }}>
            <Row left={<strong>Labour guide for the day</strong>} right={<strong>{x.guideHours}h</strong>} />
            <div style={{ ...small, marginTop: '2px' }}>
              Sales and task hours assume people are busy {Math.round(UTILISATION * 100)}% of the time. The guide is the higher of the workload and the floor minimum, hour by hour, so it is not a straight sum.
            </div>
          </div>
        </div>

        <div style={colStyle}>
          <div style={label}>The standards</div>
          {x.standards.map((s) => (
            <div key={s.productType}>
              <Row left={`${s.productType}, ${Math.round(s.mix * 100)}% of sales`} right={`${s.humanSeconds}s${s.machineSeconds > 0 ? ` + ${s.machineSeconds}s machine` : ''}`} />
              <div style={{ ...small, marginTop: '1px' }}>{s.provenance}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
