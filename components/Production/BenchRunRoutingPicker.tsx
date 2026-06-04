'use client';

/**
 * BenchRunRoutingPicker — shared control for routing accepted incoming work
 * (urgent remakes, ad-hoc requests) onto a specific bench + run.
 *
 * Shape per the design:
 *   • The whole thing lives in a collapsible "drop down area" so it stays
 *     tucked away until the manager wants it.
 *   • A switch turns the manual override on/off. Off = Edify auto-routes to
 *     the most logical bench (the default). On = the manager picks.
 *   • Bench and run are *separate* selectors — choose the bench first, then
 *     the run within that bench.
 *
 * The component owns its own UI state and reports the current routing up via
 * `onChange` so the host (remake banner / ad-hoc modal) can fold it into the
 * accept decision.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, ChevronRight, Factory } from 'lucide-react';
import {
  getBench,
  mostLogicalBenchForSkus,
  productionBenchesAt,
  type SiteId,
  type SkuId,
} from './fixtures';

export type BenchRunRouting = {
  /** Whether the manual override is on. Off = let Edify auto-route. */
  enabled: boolean;
  benchId: string;
  benchName: string;
  /** Selected run within the bench, or null for "any run". */
  runId: string | null;
  runLabel: string | null;
};

/**
 * Human-readable routing label for notes / summaries. Returns null when the
 * override is off (Edify auto-routes) so callers can omit it.
 */
export function describeRouting(r: BenchRunRouting | null | undefined): string | null {
  if (!r || !r.enabled || !r.benchName) return null;
  return r.runLabel ? `${r.benchName} · ${r.runLabel}` : r.benchName;
}

export default function BenchRunRoutingPicker({
  siteId,
  skuIds,
  onChange,
}: {
  siteId: SiteId;
  skuIds: SkuId[];
  onChange: (routing: BenchRunRouting) => void;
}) {
  const benchOptions = useMemo(() => productionBenchesAt(siteId), [siteId]);

  // Reconstruct the sku list from a stable string key so the default-bench
  // memo doesn't re-run on every parent render (arrays are new each time).
  const skuKey = skuIds.join('|');
  const defaultBenchId = useMemo(() => {
    const skus = skuKey ? skuKey.split('|') : [];
    return mostLogicalBenchForSkus(siteId, skus)?.id ?? benchOptions[0]?.id ?? '';
  }, [siteId, skuKey, benchOptions]);

  const [open, setOpen] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const [benchId, setBenchId] = useState(defaultBenchId);
  const [runId, setRunId] = useState<string | null>(null);

  const selectedBench = benchOptions.find(b => b.id === benchId);
  const runs = selectedBench?.runs ?? [];

  // When the default bench changes (e.g. navigating between incidents in the
  // remake modal), snap the picker back to that default.
  useEffect(() => {
    setBenchId(defaultBenchId);
  }, [defaultBenchId]);

  // Keep the run valid for the selected bench — default to its first run.
  useEffect(() => {
    const bench = getBench(benchId);
    const benchRuns = bench?.runs ?? [];
    setRunId(prev =>
      prev && benchRuns.some(r => r.id === prev) ? prev : benchRuns[0]?.id ?? null,
    );
  }, [benchId]);

  // Report the current routing up. Use a ref for onChange so an inline
  // parent callback doesn't retrigger the effect every render.
  const onChangeRef = useRef(onChange);
  useEffect(() => {
    onChangeRef.current = onChange;
  });
  useEffect(() => {
    const bench = getBench(enabled ? benchId : defaultBenchId);
    const run = bench?.runs?.find(r => r.id === runId) ?? null;
    onChangeRef.current({
      enabled,
      benchId: bench?.id ?? '',
      benchName: bench?.name ?? '',
      runId: enabled ? run?.id ?? null : null,
      runLabel: enabled ? run?.label ?? null : null,
    });
  }, [enabled, benchId, runId, defaultBenchId]);

  const defaultBenchName = getBench(defaultBenchId)?.name ?? '—';
  const summary = enabled
    ? `${selectedBench?.name ?? defaultBenchName}${
        runId ? ` · ${runs.find(r => r.id === runId)?.label ?? ''}` : ''
      }`
    : `Auto · ${defaultBenchName}`;

  return (
    <div
      style={{
        border: '1px solid var(--color-border-subtle)',
        borderRadius: 8,
        background: '#ffffff',
        overflow: 'hidden',
      }}
    >
      {/* Disclosure header */}
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '9px 12px',
          background: 'transparent',
          border: 'none',
          cursor: 'pointer',
          textAlign: 'left',
          fontFamily: 'var(--font-primary)',
        }}
      >
        {open ? (
          <ChevronDown size={14} color="var(--color-text-muted)" />
        ) : (
          <ChevronRight size={14} color="var(--color-text-muted)" />
        )}
        <Factory size={13} color="var(--color-text-secondary)" />
        <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--color-text-primary)' }}>
          Production routing
        </span>
        <span
          style={{
            marginLeft: 'auto',
            fontSize: 11,
            fontWeight: 600,
            color: enabled ? 'var(--color-info)' : 'var(--color-text-muted)',
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          {summary}
        </span>
      </button>

      {open && (
        <div
          style={{
            padding: '10px 12px 12px',
            borderTop: '1px solid var(--color-border-subtle)',
            display: 'flex',
            flexDirection: 'column',
            gap: 10,
            background: 'var(--color-bg-surface)',
          }}
        >
          {/* On/off switch */}
          <label
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              cursor: 'pointer',
            }}
          >
            <Toggle checked={enabled} onChange={setEnabled} />
            <span style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--color-text-primary)' }}>
                Override bench &amp; run
              </span>
              <span style={{ fontSize: 10.5, color: 'var(--color-text-muted)' }}>
                {enabled
                  ? 'You choose where this is produced.'
                  : `Off — Edify routes to the most logical bench (${defaultBenchName}).`}
              </span>
            </span>
          </label>

          {/* Bench + run — separate selectors, only when override is on */}
          {enabled && (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: 8,
              }}
            >
              <Field label="Bench">
                <select
                  value={benchId}
                  onChange={e => setBenchId(e.target.value)}
                  style={selectStyle}
                >
                  {benchOptions.map(b => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                      {b.id === defaultBenchId ? ' — Edify default' : ''}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Run">
                <select
                  value={runId ?? ''}
                  onChange={e => setRunId(e.target.value || null)}
                  disabled={runs.length === 0}
                  style={selectStyle}
                >
                  {runs.length === 0 ? (
                    <option value="">No scheduled runs</option>
                  ) : (
                    <>
                      <option value="">Any run</option>
                      {runs.map(r => (
                        <option key={r.id} value={r.id}>
                          {r.label} · {r.startTime}
                        </option>
                      ))}
                    </>
                  )}
                </select>
              </Field>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Bits ─────────────────────────────────────────────────────────────────────

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      <span style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--color-text-secondary)' }}>
        {label}
      </span>
      {children}
    </label>
  );
}

function Toggle({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      style={{
        flexShrink: 0,
        width: 38,
        height: 22,
        borderRadius: 999,
        border: '1px solid',
        borderColor: checked ? 'var(--color-info)' : 'var(--color-border)',
        background: checked ? 'var(--color-info)' : 'var(--color-bg-hover)',
        position: 'relative',
        cursor: 'pointer',
        transition: 'background 0.15s, border-color 0.15s',
        padding: 0,
      }}
    >
      <span
        style={{
          position: 'absolute',
          top: 2,
          left: checked ? 18 : 2,
          width: 16,
          height: 16,
          borderRadius: '50%',
          background: '#ffffff',
          boxShadow: '0 1px 2px rgba(0,0,0,0.2)',
          transition: 'left 0.15s',
        }}
      />
    </button>
  );
}

const selectStyle: React.CSSProperties = {
  width: '100%',
  padding: 8,
  borderRadius: 6,
  border: '1px solid var(--color-border)',
  fontFamily: 'var(--font-primary)',
  fontSize: 12,
  background: '#ffffff',
  color: 'var(--color-text-primary)',
};
