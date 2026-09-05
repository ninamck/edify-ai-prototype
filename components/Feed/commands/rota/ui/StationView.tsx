'use client';

/**
 * Week by station: where the work lands, hour by hour. One row per
 * station, one strip per day. Strip intensity is the human workload on
 * that station as a share of one person's slot. Stations with a
 * machine show a second, thinner strip for machine load; it turns red
 * where the machine is the constraint (load over capacity) and no
 * extra head would help.
 *
 * This is the view that stops a GM adding a body to a queue the
 * machine created.
 */

import { Fragment } from 'react';
import { DAY_KEYS, type DayAnalysis, type DeputyDraft, type Shift, type SiteLabourData } from '../types';
import { hhmm } from '../engine';
import { label, small } from './tokens';

function Strip({ values, kind, dayLabel, stationName, firstMin }: { values: number[]; kind: 'human' | 'machine'; dayLabel: string; stationName: string; firstMin: number }) {
  const peak = Math.max(...values, 0);
  const peakIdx = values.indexOf(peak);
  const peakLabel = `${stationName}, ${dayLabel}: peak ${kind === 'machine' ? `${Math.round(peak * 100)}% of machine capacity` : `${peak.toFixed(1)} heads of work`} at ${hhmm(firstMin + peakIdx * 60)}`;
  return (
    <div aria-label={peakLabel} title={peakLabel} style={{ display: 'flex', gap: '1px', height: kind === 'human' ? '14px' : '5px', alignItems: 'flex-end' }}>
      {values.map((v, i) => {
        let color: string;
        if (kind === 'machine') {
          color = v > 1 ? 'var(--color-error)' : v > 0.8 ? 'var(--color-warning-border)' : 'var(--color-accent-mid)';
        } else {
          color = v > 1.5 ? 'var(--color-accent-deep)' : v > 0.75 ? 'var(--color-accent-mid)' : 'var(--color-border)';
        }
        const h = kind === 'human' ? `${Math.max(15, Math.min(100, (v / 2) * 100))}%` : '100%';
        return <div key={i} style={{ flex: 1, height: h, background: color, borderRadius: '1px', opacity: kind === 'machine' ? Math.max(0.35, Math.min(1, v)) : 1 }} />;
      })}
    </div>
  );
}

function hourly(points: { min: number; v: number }[]): { first: number; values: number[] } {
  const byHour = new Map<number, number[]>();
  for (const p of points) {
    const h = Math.floor(p.min / 60);
    byHour.set(h, [...(byHour.get(h) ?? []), p.v]);
  }
  const hours = [...byHour.keys()].sort((a, b) => a - b);
  return { first: (hours[0] ?? 0) * 60, values: hours.map((h) => Math.max(...byHour.get(h)!)) };
}

export default function StationView({ site, analysis, shifts, draft }: { site: SiteLabourData; analysis: DayAnalysis[]; shifts: Shift[]; draft: DeputyDraft }) {
  const cols = `120px repeat(7, minmax(0, 1fr))`;
  const machineMax = Math.max(
    0,
    ...analysis.flatMap((a) => a.stations.flatMap((s) => s.points.map((p) => p.machineLoad ?? 0))),
  );
  return (
    <div>
      <div role="table" aria-label={`Workload by station, ${draft.weekLabel}`} style={{ display: 'grid', gridTemplateColumns: cols, gap: '6px', alignItems: 'end' }}>
        <div />
        {DAY_KEYS.map((d) => (
          <div key={d} role="columnheader" style={{ fontSize: '12px', fontWeight: 700, color: 'var(--color-text-primary)' }}>
            {d}
          </div>
        ))}
        {site.stations.map((st) => (
          <Fragment key={st.id}>
            <div role="rowheader" style={{ paddingBottom: '2px' }}>
              <div style={{ ...label, lineHeight: 1.3 }}>{st.name}</div>
              <div style={{ ...small, fontSize: '10.5px' }}>
                {st.hasMachine ? `machine, ${st.machineUnitsPerHour}/h` : `${Math.round(st.demandShare * 100)}% of sales work`}
              </div>
            </div>
            {DAY_KEYS.map((d) => {
              const a = analysis.find((x) => x.day === d)!;
              const curve = a.stations.find((s) => s.stationId === st.id)!;
              const human = hourly(curve.points.map((p) => ({ min: p.min, v: p.required })));
              const heads = shifts.filter((s) => s.day === d && s.stationId === st.id).length;
              return (
                <div key={d} role="cell" style={{ display: 'flex', flexDirection: 'column', gap: '3px', minWidth: 0 }}>
                  <Strip values={human.values} kind="human" dayLabel={d} stationName={st.name} firstMin={human.first} />
                  {st.hasMachine && (
                    <Strip
                      values={hourly(curve.points.map((p) => ({ min: p.min, v: p.machineLoad ?? 0 }))).values}
                      kind="machine"
                      dayLabel={d}
                      stationName={`${st.name} machine`}
                      firstMin={human.first}
                    />
                  )}
                  <div style={{ ...small, fontSize: '10px' }}>{heads > 0 ? `${heads} on` : ''}</div>
                </div>
              );
            })}
          </Fragment>
        ))}
      </div>
      <div style={{ ...small, marginTop: '8px', lineHeight: 1.45 }}>
        Bar height is the work on the station as heads per slot. Navy over 1.5 heads, blue over 0.75, grey below.
        {machineMax > 0 && (
          <>
            {' '}
            Thin strip is machine load; red means the machine is the constraint and another head will not help.
            {machineMax <= 1 ? ` Peak machine load this week is ${Math.round(machineMax * 100)}% of capacity.` : ''}
          </>
        )}{' '}
        &quot;On&quot; counts shifts tagged to the station in {draft.tool}.
      </div>
    </div>
  );
}
