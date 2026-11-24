'use client';

import * as ui from '../supportCentreUi';
import { WEEKDAY, dayLabel, dayPhrase, money, round2, signedMoney, type CashRules, type DayClose } from '../cashFixtures';
import { cancelsOut, shortStreaks } from '../cashStore';

const BAR = 26;
const GAP = 6;
const HEIGHT = 120;

/**
 * Close variances day by day, with the running total. Picks out short streaks
 * and over-then-short pairs that cancel out, which usually mean a sale went
 * through on the wrong day.
 */
export default function VarianceTrend({ closes, rules, now = new Date() }: { closes: DayClose[]; rules: CashRules; now?: Date }) {
  const days = [...closes].sort((a, b) => a.day - b.day);
  if (!days.length) return <p style={ui.muted}>No closed days yet.</p>;

  const running = round2(days.reduce((s, c) => s + c.variance, 0));
  const streaks = shortStreaks(days);
  const inStreak = new Set(streaks.flat().map(c => c.id));
  const pairs = days.flatMap((a, i) => {
    const b = days[i + 1];
    return b && b.day === a.day + 1 && cancelsOut(days, i) && Math.abs(a.variance + b.variance) <= 1 ? [[a, b]] : [];
  });
  const scale = Math.max(rules.reasonAt, ...days.map(c => Math.abs(c.variance))) / (HEIGHT / 2 - 6);
  const width = days.length * (BAR + GAP);
  const weekday = (day: number) => {
    const d = new Date(now);
    d.setDate(d.getDate() + day);
    return `${WEEKDAY[d.getDay()].slice(0, 2)} ${d.getDate()}`;
  };
  const summary = `Close variance over ${days.length} days, running total ${signedMoney(running)}.`;

  return (
    <figure style={{ margin: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
      <figcaption style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', alignItems: 'baseline' }}>
        <span style={ui.fieldLabel}>Daily close variance</span>
        <span style={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
          Running total {signedMoney(running)}
        </span>
      </figcaption>
      <div style={{ overflowX: 'auto' }}>
        <svg role="img" aria-label={summary} width={width} height={HEIGHT + 18} viewBox={`0 0 ${width} ${HEIGHT + 18}`}>
          <line x1={0} x2={width} y1={HEIGHT / 2} y2={HEIGHT / 2} stroke="var(--color-border-subtle)" />
          {days.map((c, i) => {
            const h = Math.max(1, Math.abs(c.variance) / scale);
            const short = c.variance < 0;
            const flagged = Math.abs(c.variance) > rules.flagAt;
            return (
              <g key={c.id}>
                <rect
                  x={i * (BAR + GAP)}
                  y={short ? HEIGHT / 2 : HEIGHT / 2 - h}
                  width={BAR}
                  height={h}
                  rx={3}
                  fill={flagged ? 'var(--color-accent-mid)' : 'var(--color-border-subtle)'}
                  stroke={inStreak.has(c.id) ? 'var(--color-text-primary)' : 'none'}
                  strokeWidth={2}
                />
                <text x={i * (BAR + GAP) + BAR / 2} y={HEIGHT + 14} textAnchor="middle" fontSize={10} fill="var(--color-text-secondary)">
                  {weekday(c.day)}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
      <p style={ui.muted}>Above the line: over. Below: short. Coloured: over {money(rules.flagAt)}. Outlined: short streak.</p>

      {(streaks.length > 0 || pairs.length > 0) && (
        <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13, lineHeight: 1.6, color: 'var(--color-text-primary)' }}>
          {streaks.map(run => (
            <li key={run[0].id}>
              <strong>Short {run.length} days in a row</strong>, {dayLabel(run[0].day, now)} to {dayPhrase(run[run.length - 1].day, now)}:{' '}
              {money(Math.abs(round2(run.reduce((s, c) => s + c.variance, 0))))} in total.
            </li>
          ))}
          {pairs.map(([a, b]) => (
            <li key={a.id}>
              <strong>{dayLabel(a.day, now)} {signedMoney(a.variance)}, {dayPhrase(b.day, now)} {signedMoney(b.variance)}</strong>: cancel out. Possible sale on the wrong day.
            </li>
          ))}
        </ul>
      )}

      <details>
        <summary style={{ fontSize: 13, cursor: 'pointer' }}>Show as a table</summary>
        <table style={{ ...ui.table, marginTop: 8 }}>
          <thead>
            <tr>
              <th style={ui.th}>Day</th>
              <th style={ui.thNum}>Variance</th>
              <th style={ui.thNum}>Running total</th>
            </tr>
          </thead>
          <tbody>
            {days.map((c, i) => (
              <tr key={c.id}>
                <td style={ui.td}>{dayLabel(c.day, now)}</td>
                <td style={ui.tdNum}>{signedMoney(c.variance)}</td>
                <td style={ui.tdNum}>{signedMoney(round2(days.slice(0, i + 1).reduce((s, x) => s + x.variance, 0)))}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </figure>
  );
}
