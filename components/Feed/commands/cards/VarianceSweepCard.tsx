'use client';

/**
 * Morning variance sweep: the brief.
 *
 * Yesterday's shifts and pay from the workforce tool against the rota
 * and the day's sales, one site per row, ranked by what matters rather
 * than by size. Each row opens to the causes with the pounds each one
 * moved. Below, where the estate's money went by cause. Confirm opens
 * next week's draft for the site that mattered most and has one; Done
 * closes the brief. Nothing here writes to the workforce tool.
 */

import { useState } from 'react';
import Link from 'next/link';
import { AlertTriangle, ArrowRight, ChevronDown, ChevronRight, Sunrise } from 'lucide-react';
import CardShell, { type CardState } from './CardShell';
import type { Materiality, SweepResult, SweptSite, VarianceCause } from '@/components/Feed/commands/rota/types';
import { CAUSE_LABEL, MATERIALITY_LABEL, gbp, salesLine, signedGBP, sweepVerdict } from '@/components/Feed/commands/rota/sweep';
import { body, label, small } from '@/components/Feed/commands/rota/ui/tokens';

const BAND: Record<Materiality, { color: string; bg: string; border: string }> = {
  matters: { color: 'var(--color-error)', bg: 'var(--color-error-light)', border: 'var(--color-error)' },
  watch: { color: 'var(--color-text-primary)', bg: 'var(--color-warning-light)', border: 'var(--color-warning-border)' },
  explained: { color: 'var(--color-text-secondary)', bg: 'var(--color-bg-hover)', border: 'var(--color-border)' },
};

function BandPill({ m }: { m: Materiality }) {
  const t = BAND[m];
  return (
    <span
      style={{
        display: 'inline-block',
        padding: '2px 8px',
        borderRadius: '100px',
        fontSize: '10.5px',
        fontWeight: 700,
        letterSpacing: '0.04em',
        textTransform: 'uppercase',
        color: t.color,
        background: t.bg,
        whiteSpace: 'nowrap',
      }}
    >
      {MATERIALITY_LABEL[m]}
    </span>
  );
}

/** "+14%", "-4%", "on forecast": the short form for a tight column. */
function salesDelta(pct: number): string {
  const p = Math.round(pct);
  if (Math.abs(p) < 1) return 'on forecast';
  return `${p > 0 ? '+' : '-'}${Math.abs(p)}% vs forecast`;
}

function Tile({ heading, value, note, tone }: { heading: string; value: string; note?: string; tone?: 'bad' | 'ok' }) {
  return (
    <div style={{ flex: 1, minWidth: 0, padding: '10px 12px', borderRadius: '10px', border: '1px solid var(--color-border-subtle)', background: '#fff' }}>
      <div style={label}>{heading}</div>
      <div
        style={{
          fontSize: '20px',
          fontWeight: 700,
          marginTop: '4px',
          lineHeight: 1.1,
          fontVariantNumeric: 'tabular-nums',
          color: tone === 'bad' ? 'var(--color-error)' : tone === 'ok' ? 'var(--color-success)' : 'var(--color-text-primary)',
        }}
      >
        {value}
      </div>
      {note && <div style={{ ...small, marginTop: '3px' }}>{note}</div>}
    </div>
  );
}

function KindTag({ c }: { c: VarianceCause }) {
  const breach = !!c.compliance;
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '4px',
        padding: '2px 7px',
        borderRadius: '5px',
        fontSize: '10px',
        fontWeight: 700,
        letterSpacing: '0.04em',
        textTransform: 'uppercase',
        whiteSpace: 'nowrap',
        color: breach ? 'var(--color-error)' : 'var(--color-text-secondary)',
        background: breach ? 'var(--color-error-light)' : 'var(--color-bg-hover)',
        border: `1px solid ${breach ? 'var(--color-error-border)' : 'var(--color-border-subtle)'}`,
      }}
    >
      {breach && <AlertTriangle size={10} aria-hidden="true" />}
      {CAUSE_LABEL[c.kind]}
    </span>
  );
}

/** One cause: who (or what) in bold, the fact underneath, the pounds
 *  on the right. A repeat is the one thing worth colour on the line. */
function CauseRow({ c }: { c: VarianceCause }) {
  const subject = c.personName ?? c.who;
  const headline = subject ?? c.detail;
  const sub = subject ? c.detail : undefined;
  return (
    <li style={{ listStyle: 'none', display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) auto', columnGap: '12px', alignItems: 'start', padding: '7px 0', borderTop: '1px solid var(--color-border-subtle)' }}>
      <div style={{ minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <KindTag c={c} />
          <span style={{ ...body, fontWeight: 700 }}>{headline}</span>
          {c.repeat && <span style={{ ...small, fontWeight: 700, color: 'var(--color-error)' }}>{c.repeat}</span>}
        </div>
        {sub && <div style={{ ...small, marginTop: '3px', lineHeight: 1.4 }}>{sub}</div>}
      </div>
      <span style={{ ...body, fontWeight: 700, fontVariantNumeric: 'tabular-nums', color: c.gbp < 0 ? 'var(--color-success)' : 'var(--color-text-primary)', paddingTop: '1px' }}>{signedGBP(c.gbp)}</span>
    </li>
  );
}

function Stat({ value, note }: { value: string; note: string }) {
  return (
    <div style={{ minWidth: 0 }}>
      <div style={{ fontSize: '14px', fontWeight: 700, lineHeight: 1.1, fontVariantNumeric: 'tabular-nums', color: 'var(--color-text-primary)' }}>{value}</div>
      <div style={{ ...small, marginTop: '2px', whiteSpace: 'nowrap' }}>{note}</div>
    </div>
  );
}

function SiteRow({ s, open, onToggle }: { s: SweptSite; open: boolean; onToggle: () => void }) {
  const Chevron = open ? ChevronDown : ChevronRight;
  const varianceTone = s.materiality === 'matters' ? 'var(--color-error)' : s.varianceGBP < 0 ? 'var(--color-success)' : 'var(--color-text-primary)';
  const hasSales = s.salesGBP > 0;
  return (
    <li style={{ listStyle: 'none', borderTop: '1px solid var(--color-border-subtle)' }}>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        aria-controls={`sweep-${s.siteId}-causes`}
        style={{
          width: '100%',
          display: 'grid',
          gridTemplateColumns: '14px minmax(0, 1fr) auto',
          columnGap: '10px',
          alignItems: 'center',
          padding: '10px 4px 10px 10px',
          background: 'transparent',
          border: 'none',
          textAlign: 'left',
          cursor: 'pointer',
          fontFamily: 'var(--font-primary)',
          borderLeft: `3px solid ${BAND[s.materiality].border}`,
        }}
      >
        <Chevron size={14} aria-hidden="true" style={{ color: 'var(--color-text-secondary)' }} />
        <span style={{ minWidth: 0 }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <span style={{ ...body, fontWeight: 700, fontSize: '13px' }}>{s.siteName}</span>
            <BandPill m={s.materiality} />
          </span>
          <span style={{ ...body, display: 'block', fontWeight: 500, lineHeight: 1.4, marginTop: '2px', color: 'var(--color-text-secondary)' }}>{s.lead}</span>
        </span>
        <span style={{ fontSize: '16px', fontWeight: 700, fontVariantNumeric: 'tabular-nums', color: varianceTone, whiteSpace: 'nowrap' }}>{signedGBP(s.varianceGBP)}</span>
      </button>
      {open && (
        <div id={`sweep-${s.siteId}-causes`} style={{ padding: '0 4px 12px 37px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <div
            role="group"
            aria-label={`${s.siteName}: the day in numbers`}
            style={{ display: 'grid', gridTemplateColumns: `repeat(${hasSales ? 4 : 2}, minmax(0, 1fr))`, gap: '10px', padding: '8px 10px', borderRadius: '8px', background: 'var(--color-bg-hover)' }}
          >
            <Stat value={gbp(s.plannedCostGBP)} note={`rota, ${s.plannedHours}h`} />
            <Stat value={gbp(s.actualCostGBP)} note={`worked, ${s.actualHours}h`} />
            {hasSales && <Stat value={`${s.actualLabourPct}%`} note={`labour, planned ${s.plannedLabourPct}%`} />}
            {hasSales && <Stat value={gbp(s.salesGBP)} note={`sales, ${salesDelta(s.salesVsForecastPct)}`} />}
          </div>
          <ul aria-label={`${s.siteName}: where the variance came from`} style={{ margin: 0, padding: 0 }}>
            {s.causes.map((c, i) => (
              <CauseRow key={`${c.kind}-${i}`} c={c} />
            ))}
            {Math.abs(s.unattributedGBP) >= 1 && (
              <li style={{ listStyle: 'none', display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) auto', columnGap: '12px', padding: '7px 0', borderTop: '1px solid var(--color-border-subtle)' }}>
                <span style={small}>Not attributed to a shift; pay rounding on the run</span>
                <span style={{ ...small, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{signedGBP(s.unattributedGBP)}</span>
              </li>
            )}
          </ul>
          {(s.context || s.dataNote) && <div style={{ ...small, lineHeight: 1.4 }}>{[s.context, s.dataNote].filter(Boolean).join(' ')}</div>}
        </div>
      )}
    </li>
  );
}

function WhereTheMoneyWent({ r }: { r: SweepResult }) {
  const max = Math.max(...r.byCause.map((c) => Math.abs(c.gbp)), 1);
  return (
    <div>
      <div style={{ ...label, marginBottom: '6px' }}>Where the money went</div>
      <div role="table" aria-label="Variance by cause across the swept sites" style={{ display: 'grid', gridTemplateColumns: 'auto minmax(0, 1fr) auto', gap: '5px 12px', alignItems: 'center' }}>
        {r.byCause.map((c) => {
          const saved = c.gbp < 0;
          return (
            <div key={c.kind} role="row" style={{ display: 'contents' }}>
              <span role="cell" style={{ ...small, fontWeight: 700, whiteSpace: 'nowrap' }}>
                {CAUSE_LABEL[c.kind]}
                <span style={{ fontWeight: 500 }}> x{c.count}</span>
              </span>
              <span role="cell" aria-hidden="true" style={{ height: '8px', borderRadius: '4px', background: 'var(--color-bg-hover)', overflow: 'hidden' }}>
                <span
                  style={{
                    display: 'block',
                    height: '100%',
                    width: `${Math.max(3, Math.round((Math.abs(c.gbp) / max) * 100))}%`,
                    borderRadius: '4px',
                    background: saved ? 'var(--color-success)' : c.kind === 'missed-break' ? 'var(--color-error)' : 'var(--color-text-secondary)',
                  }}
                />
              </span>
              <span role="cell" style={{ ...body, fontWeight: 700, textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: saved ? 'var(--color-success)' : undefined }}>
                {signedGBP(c.gbp)}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function VarianceSweepCard({
  result,
  state,
  onRebalance,
  onDone,
}: {
  result: SweepResult;
  state: CardState;
  /** Open next week's draft for a site. */
  onRebalance: (siteId: string) => void;
  onDone: (summary: { title: string; subtitle: string }) => void;
}) {
  const [open, setOpen] = useState<Set<string>>(() => new Set(result.sites.filter((s) => s.materiality === 'matters').map((s) => s.siteId)));
  const toggle = (id: string) =>
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const t = result.totals;
  const verdict = sweepVerdict(result);
  const openable = result.sites.find((s) => s.materiality !== 'explained' && s.hasDraft);
  const variancePct = t.plannedCostGBP > 0 ? Math.round((t.varianceGBP / t.plannedCostGBP) * 1000) / 10 : 0;
  const matters = result.sites.filter((s) => s.materiality === 'matters').length;
  const summary = {
    title: `Sweep ${result.dateLabel}: ${signedGBP(t.varianceGBP)} against plan`,
    subtitle: matters === 0 ? 'Nothing needed a call.' : `${matters} site${matters === 1 ? '' : 's'} needed a call: ${result.sites.filter((s) => s.materiality === 'matters').map((s) => s.siteName).join(', ')}.`,
  };

  return (
    <CardShell
      icon={Sunrise}
      title={`Morning sweep: ${result.dateLabel}`}
      subtitle={`${result.tool} at ${result.pulledAt}, against the rota and the day's sales. Reads only.`}
      state={state}
      confirmLabel={openable ? `Check next week's draft for ${openable.siteName}` : 'Done'}
      cancelLabel="Done"
      onConfirm={() => (openable ? onRebalance(openable.siteId) : onDone(summary))}
      onCancel={openable ? () => onDone(summary) : undefined}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <div style={{ ...body, fontSize: '13.5px', fontWeight: 600, lineHeight: 1.45 }}>{verdict}</div>

        {result.sites.length > 0 && (
          <div style={{ display: 'flex', gap: '8px' }}>
            <Tile heading="Rota" value={gbp(t.plannedCostGBP)} note={t.forecastGBP > 0 ? `${t.plannedLabourPct}% of forecast` : undefined} />
            <Tile
              heading="Worked"
              value={gbp(t.actualCostGBP)}
              note={`${signedGBP(t.varianceGBP)}, ${variancePct > 0 ? '+' : ''}${variancePct}%`}
              tone={matters > 0 ? 'bad' : undefined}
            />
            {t.salesGBP > 0 && (
              <Tile
                heading="Labour"
                value={`${t.actualLabourPct}%`}
                note={`planned ${t.plannedLabourPct}%, ${salesLine(Math.round(((t.salesGBP - t.forecastGBP) / t.forecastGBP) * 1000) / 10)}`}
                tone={t.actualLabourPct > t.plannedLabourPct + 0.5 ? 'bad' : 'ok'}
              />
            )}
          </div>
        )}

        {result.sites.length > 0 && (
          <div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', marginBottom: '4px' }}>
              <div style={label}>{result.sites.length === 1 ? 'The site' : `${result.sites.length} sites, what matters first`}</div>
              <div style={{ ...small, display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                <span>
                  <span style={{ color: BAND.matters.color, fontWeight: 700 }}>Matters</span> fix today
                </span>
                <span>
                  <span style={{ fontWeight: 700 }}>Watch</span> one to mention
                </span>
                <span>
                  <span style={{ fontWeight: 700 }}>Explained</span> the trade covered it
                </span>
              </div>
            </div>
            <ul style={{ margin: 0, padding: 0 }}>
              {result.sites.map((s) => (
                <SiteRow key={s.siteId} s={s} open={open.has(s.siteId)} onToggle={() => toggle(s.siteId)} />
              ))}
            </ul>
          </div>
        )}

        {result.byCause.length > 0 && <WhereTheMoneyWent r={result} />}

        <Link
          href="/labour?tab=estate"
          style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '12px', fontWeight: 600, color: 'var(--color-accent-active)', textDecoration: 'none', width: 'fit-content' }}
        >
          Open the estate view <ArrowRight size={12} aria-hidden="true" />
        </Link>
      </div>
    </CardShell>
  );
}
