'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Sparkles,
  Clock,
  Send,
  AlertCircle,
  CheckCircle2,
  Lock,
  FastForward,
  Search,
  X,
  ChevronDown,
  ChevronRight,
  RotateCcw,
  Plus,
  Minus,
} from 'lucide-react';
import StatusPill from '@/components/Production/StatusPill';
import { useRole, StaffLockBanner } from '@/components/Production/RoleContext';
import {
  PRET_SITES,
  getSite,
  hubSettingsFor,
  spokeOrderForDate,
  dayOfWeek,
  dayOffset,
  DEMO_TODAY,
  type SiteId,
  type SkuId,
  type SpokeOrderSummary,
  type SpokeSubmission,
  type ProductionRecipe,
} from '@/components/Production/fixtures';

type DisplayStatus = SpokeSubmission['status'] | 'derived';

/**
 * Per-day, per-spoke editor state. Keyed by `${spokeId}|${date}` so the
 * page can hold a few days in flight at once and switch between them
 * without losing edits.
 */
type DayState = {
  lines: Record<SkuId, number>;
  status: DisplayStatus;
};

// 7-day window: yesterday + today + next 5 days. Spokes can plan a few
// days ahead and revise before each day's cutoff.
const DAY_RANGE = [-1, 0, 1, 2, 3, 4, 5];

export default function SpokeSubmissionsPage() {
  const { can } = useRole();
  const canAdjust = can('spoke.adjust');
  const canSubmit = can('spoke.submit');

  const spokes = useMemo(() => PRET_SITES.filter(s => s.type === 'SPOKE'), []);
  const [spokeId, setSpokeId] = useState<SiteId>(spokes[0]?.id ?? 'site-spoke-south');
  const spoke = getSite(spokeId);
  const hubId = spoke?.hubId ?? 'hub-central';
  const hub = getSite(hubId);
  const hubSettings = hubSettingsFor(hubId);
  const cutoffPolicy = hubSettings?.spokeCutoffPolicy ?? 'lock';

  const [date, setDate] = useState<string>(dayOffset(1));
  const [query, setQuery] = useState('');
  const [expanded, setExpanded] = useState<Set<SkuId>>(new Set());

  // Synthetic "now" — the demo defaults to 10:30 today and can be skipped
  // forward past a cutoff via the Demo button.
  const defaultNowISO = `${DEMO_TODAY}T10:30:00Z`;
  const [nowISO, setNowISO] = useState(defaultNowISO);

  // Per-day editor state, lazily populated from `spokeOrderForDate`.
  const [dayStates, setDayStates] = useState<Record<string, DayState>>({});

  function dayKey(s: SiteId, d: string) {
    return `${s}|${d}`;
  }

  // Build (and cache) the editor state for the active (spoke, date). If
  // we already have edits for this key we keep them; otherwise we hydrate
  // from the seeded submission / Quinn defaults.
  const order: SpokeOrderSummary = useMemo(
    () => spokeOrderForDate(spokeId, hubId, date),
    [spokeId, hubId, date],
  );
  const key = dayKey(spokeId, date);
  useEffect(() => {
    setDayStates(prev => {
      if (prev[key]) return prev;
      const lines: Record<SkuId, number> = {};
      for (const ln of order.lines) lines[ln.skuId] = ln.confirmed;
      return { ...prev, [key]: { lines, status: order.status } };
    });
  }, [key, order]);

  const dayState = dayStates[key];

  // Auto-finalise effect: once cutoff has passed and the hub is on the
  // 'lock' policy, any still-draft day gets locked at Quinn's numbers.
  const cutoff = new Date(order.cutoffDateTime);
  const now = new Date(nowISO);
  const minutesToCutoff = Math.round((cutoff.getTime() - now.getTime()) / 60000);
  const past = minutesToCutoff < 0;
  useEffect(() => {
    if (!dayState) return;
    if (!past) return;
    if (cutoffPolicy !== 'lock') return;
    if (dayState.status !== 'draft' && dayState.status !== 'derived') return;
    setDayStates(prev => {
      const cur = prev[key];
      if (!cur) return prev;
      const lines = { ...cur.lines };
      // Snap any untouched derived lines back to their Quinn proposal so
      // the auto-locked total is exactly what the hub will plan against.
      for (const ln of order.lines) {
        if (lines[ln.skuId] === undefined) lines[ln.skuId] = ln.quinnProposed;
      }
      return { ...prev, [key]: { lines, status: 'auto-finalised' } };
    });
  }, [past, cutoffPolicy, dayState, key, order.lines]);

  // Submitted → acknowledged after a beat (mirrors the original demo).
  useEffect(() => {
    if (!dayState) return;
    if (dayState.status !== 'submitted') return;
    const t = setTimeout(() => {
      setDayStates(prev => ({ ...prev, [key]: { ...prev[key], status: 'acknowledged' } }));
    }, 1500);
    return () => clearTimeout(t);
  }, [dayState, key]);

  const status: DisplayStatus = dayState?.status ?? order.status;
  const locked = status === 'submitted' || status === 'acknowledged' || status === 'auto-finalised';
  const autoFinalised = status === 'auto-finalised';

  function setLineUnits(sku: SkuId, units: number) {
    setDayStates(prev => {
      const cur = prev[key] ?? { lines: {}, status: order.status };
      return {
        ...prev,
        [key]: {
          ...cur,
          lines: { ...cur.lines, [sku]: Math.max(0, units) },
          // Touching anything promotes a derived state to a real draft.
          status: cur.status === 'derived' ? 'draft' : cur.status,
        },
      };
    });
  }

  function adjust(sku: SkuId, delta: number) {
    if (!dayState) return;
    const recipe = order.lines.find(l => l.skuId === sku)?.recipe;
    const step = recipe?.batchRules?.multipleOf ?? 1;
    setLineUnits(sku, (dayState.lines[sku] ?? 0) + delta * step);
  }

  function resetToQuinn() {
    setDayStates(prev => {
      const lines: Record<SkuId, number> = {};
      for (const ln of order.lines) lines[ln.skuId] = ln.quinnProposed;
      return { ...prev, [key]: { lines, status: 'draft' } };
    });
  }

  function submitDay() {
    setDayStates(prev => ({ ...prev, [key]: { ...prev[key], status: 'submitted' } }));
  }

  function skipToCutoff() {
    setNowISO(new Date(cutoff.getTime() + 60_000).toISOString());
  }
  function rewindToOpen() {
    setNowISO(defaultNowISO);
    if (autoFinalised) {
      setDayStates(prev => ({ ...prev, [key]: { ...prev[key], status: 'draft' } }));
    }
  }

  function toggleExpand(sku: SkuId) {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(sku)) next.delete(sku);
      else next.add(sku);
      return next;
    });
  }

  // Build the rows for the current (spoke, date), filtered by query, and
  // grouped by category for the section headers.
  const viewLines = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = q
      ? order.lines.filter(l => l.recipe.name.toLowerCase().includes(q))
      : order.lines;
    return filtered;
  }, [order.lines, query]);

  const grouped = useMemo(() => {
    const map = new Map<ProductionRecipe['category'], typeof viewLines>();
    for (const l of viewLines) {
      const arr = map.get(l.recipe.category) ?? [];
      arr.push(l);
      map.set(l.recipe.category, arr);
    }
    const order: ProductionRecipe['category'][] = ['Bakery', 'Sandwich', 'Salad', 'Snack', 'Beverage'];
    return order
      .filter(c => map.has(c))
      .map(c => ({ category: c, rows: map.get(c)! }));
  }, [viewLines]);

  const totalQuinn = useMemo(() => order.lines.reduce((a, l) => a + l.quinnProposed, 0), [order.lines]);
  const totalConfirmed = useMemo(
    () => Object.values(dayState?.lines ?? {}).reduce((a, b) => a + b, 0),
    [dayState],
  );
  const delta = totalConfirmed - totalQuinn;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Header — spoke selector + ordering-from caption */}
      <div
        style={{
          padding: '12px 16px',
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          borderBottom: '1px solid var(--color-border-subtle)',
          background: '#ffffff',
          flexWrap: 'wrap',
        }}
      >
        <span
          style={{
            fontSize: 10,
            fontWeight: 700,
            color: 'var(--color-text-muted)',
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
          }}
        >
          Spoke
        </span>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {spokes.map(s => {
            const active = s.id === spokeId;
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => setSpokeId(s.id)}
                style={{
                  padding: '8px 12px',
                  borderRadius: 8,
                  fontSize: 11,
                  fontWeight: 600,
                  fontFamily: 'var(--font-primary)',
                  background: active ? 'var(--color-accent-active)' : '#ffffff',
                  color: active ? 'var(--color-text-on-active)' : 'var(--color-text-secondary)',
                  border: `1px solid ${active ? 'var(--color-accent-active)' : 'var(--color-border)'}`,
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                }}
              >
                {s.name}
              </button>
            );
          })}
        </div>
        <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--color-text-muted)' }}>
          Ordering from <strong style={{ color: 'var(--color-text-secondary)' }}>{hub?.name}</strong>
        </span>
      </div>

      {/* Day strip — one tile per day, status badge + total order units */}
      <DayStrip
        spokeId={spokeId}
        hubId={hubId}
        selectedDate={date}
        nowISO={nowISO}
        cutoffPolicy={cutoffPolicy}
        dayStates={dayStates}
        onSelect={setDate}
      />

      <div style={{ flex: 1, minHeight: 0, overflow: 'auto', padding: '14px 16px 32px' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 12 }}>
          <StaffLockBanner reason="Spoke orders are confirmed by the Manager before cutoff." />

          {/* Day header — day caption + cutoff marker + submit action all
              in one bar so the "what am I doing / when is it due / send it"
              loop sits at the top of the editor. */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              padding: '12px 14px',
              borderRadius: 'var(--radius-card)',
              background: status === 'auto-finalised' ? 'var(--color-bg-hover)' : '#ffffff',
              // Keep the surface neutral — the confirmed state shows up as a
              // green border around the bar, with the ✓ icon and copy carrying
              // the rest of the semantic.
              border: `1px solid ${
                status === 'acknowledged' ? 'var(--color-success)' : 'var(--color-border-subtle)'
              }`,
              flexWrap: 'wrap',
            }}
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
              <div
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  color: 'var(--color-text-muted)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                }}
              >
                {spoke?.name} → {hub?.name}
              </div>
              <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--color-text-primary)' }}>
                Order for {dayOfWeek(date)} {date}
                {date === DEMO_TODAY && (
                  <span style={{ marginLeft: 8, fontSize: 11, fontWeight: 600, color: 'var(--color-text-muted)' }}>
                    (today)
                  </span>
                )}
              </div>
              {(status === 'draft' || status === 'derived') && (
                <span style={{ fontSize: 10, color: 'var(--color-text-muted)', marginTop: 2 }}>
                  Submit before <strong>{formatCutoff(order.cutoffDateTime)}</strong> so {hub?.name} can plan.
                </span>
              )}
            </div>
            <div style={{ flex: 1 }} />
            <CutoffMarker
              cutoffISO={order.cutoffDateTime}
              minutesLeft={minutesToCutoff}
              past={past}
              locked={autoFinalised || status === 'submitted' || status === 'acknowledged'}
            />

            {/* Action area — varies by status. Submit/demo controls when
                editable, soft confirmations otherwise. */}
            {(status === 'draft' || status === 'derived') && (
              <>
                {!past && (
                  <button
                    type="button"
                    onClick={skipToCutoff}
                    style={demoBtn('dashed')}
                    title="Demo: jump synthetic 'now' past the cutoff to trigger auto-finalisation"
                  >
                    <FastForward size={11} /> Demo: skip to cutoff
                  </button>
                )}
                <button
                  type="button"
                  onClick={submitDay}
                  disabled={past || !canSubmit}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    padding: '10px 16px',
                    borderRadius: 8,
                    fontSize: 13,
                    fontWeight: 700,
                    fontFamily: 'var(--font-primary)',
                    background: past || !canSubmit ? 'var(--color-bg-hover)' : 'var(--color-accent-active)',
                    color: past || !canSubmit ? 'var(--color-text-muted)' : 'var(--color-text-on-active)',
                    border: `1px solid ${past || !canSubmit ? 'var(--color-border)' : 'var(--color-accent-active)'}`,
                    cursor: past || !canSubmit ? 'not-allowed' : 'pointer',
                    minHeight: 38,
                  }}
                >
                  <Send size={14} /> {canSubmit ? 'Submit to hub' : 'Manager submits'}
                </button>
              </>
            )}
            {status === 'submitted' && (
              <span style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>Sending to hub…</span>
            )}
            {status === 'acknowledged' && (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--color-text-primary)', fontWeight: 600 }}>
                <CheckCircle2 size={16} color="var(--color-success)" />
                Acknowledged · scheduled for {dayOfWeek(date)} dispatch
              </span>
            )}
            {status === 'auto-finalised' && (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--color-text-secondary)', fontWeight: 600 }}>
                <Lock size={14} color="var(--color-text-secondary)" />
                Locked at cutoff · {totalConfirmed} units on {hub?.name}&rsquo;s plan
              </span>
            )}
          </div>

          {/* Quinn intro (only on draft / derived) */}
          {(status === 'draft' || status === 'derived') && (
            <div
              style={{
                padding: '12px 14px',
                borderRadius: 'var(--radius-card)',
                border: '1px solid var(--color-info)',
                background: 'var(--color-info-light)',
                display: 'flex',
                gap: 10,
                alignItems: 'flex-start',
              }}
            >
              <Sparkles size={16} color="var(--color-info)" style={{ flexShrink: 0, marginTop: 1 }} />
              <div style={{ flex: 1, fontSize: 12, color: 'var(--color-text-secondary)', lineHeight: 1.5 }}>
                <strong style={{ color: 'var(--color-text-primary)' }}>
                  Quinn has drafted your full {dayOfWeek(date)} order.
                </strong>{' '}
                Each row uses your forecast for {dayOfWeek(date)}, nets out anything you carried over from yesterday,
                and lands on the proposed quantity. Adjust whatever feels off, then submit before cutoff.
                {cutoffPolicy === 'lock' && (
                  <> If you don&rsquo;t submit by cutoff, Quinn&rsquo;s draft is sent through automatically.</>
                )}
              </div>
            </div>
          )}

          {/* Auto-finalised banner */}
          {autoFinalised && (
            <div
              style={{
                padding: '14px 16px',
                borderRadius: 'var(--radius-card)',
                border: '1px solid var(--color-warning-border)',
                background: 'var(--color-warning-light)',
                display: 'flex',
                alignItems: 'flex-start',
                gap: 12,
              }}
            >
              <Lock size={18} color="var(--color-warning)" style={{ flexShrink: 0, marginTop: 1 }} />
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--color-text-primary)' }}>
                  Auto-finalised at cutoff
                </div>
                <div style={{ fontSize: 12, color: 'var(--color-text-secondary)', lineHeight: 1.5 }}>
                  The {formatCutoff(order.cutoffDateTime)} cutoff passed before you submitted, so {hub?.name} is on
                  the hook for Quinn&rsquo;s draft as-is ({totalConfirmed} units). The order is locked and
                  acknowledged on the hub side.
                </div>
              </div>
              <button
                type="button"
                onClick={rewindToOpen}
                style={demoBtn()}
                title="Demo: jump back to before the cutoff to see the editable state again"
              >
                Demo: rewind
              </button>
            </div>
          )}

          {/* Totals + actions */}
          <div
            style={{
              display: 'flex',
              gap: 16,
              padding: '12px 14px',
              borderRadius: 'var(--radius-card)',
              border: '1px solid var(--color-border-subtle)',
              background: '#ffffff',
              alignItems: 'center',
              flexWrap: 'wrap',
            }}
          >
            <Metric label="Quinn proposed" value={totalQuinn} />
            <Metric label="You confirmed" value={totalConfirmed} bold />
            <Metric label="Delta" value={delta} signed />
            <div style={{ flex: 1 }} />
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                padding: '6px 10px',
                background: 'var(--color-bg-hover)',
                borderRadius: 6,
                border: '1px solid var(--color-border-subtle)',
              }}
            >
              <Search size={12} color="var(--color-text-muted)" />
              <input
                type="text"
                placeholder="Filter recipes…"
                value={query}
                onChange={e => setQuery(e.target.value)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  outline: 'none',
                  fontFamily: 'var(--font-primary)',
                  fontSize: 11,
                  color: 'var(--color-text-primary)',
                  width: 140,
                }}
              />
              {query && (
                <button
                  type="button"
                  onClick={() => setQuery('')}
                  aria-label="Clear filter"
                  style={{
                    background: 'transparent',
                    border: 'none',
                    cursor: 'pointer',
                    color: 'var(--color-text-muted)',
                    display: 'inline-flex',
                  }}
                >
                  <X size={12} />
                </button>
              )}
            </div>
            {delta !== 0 && (
              <button
                type="button"
                onClick={resetToQuinn}
                disabled={locked}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 5,
                  padding: '8px 12px',
                  borderRadius: 8,
                  fontSize: 11,
                  fontWeight: 600,
                  fontFamily: 'var(--font-primary)',
                  background: '#ffffff',
                  border: '1px solid var(--color-border)',
                  color: 'var(--color-text-secondary)',
                  cursor: locked ? 'not-allowed' : 'pointer',
                  opacity: locked ? 0.5 : 1,
                }}
              >
                <RotateCcw size={11} /> Reset to Quinn
              </button>
            )}
          </div>

          {/* Ledger table */}
          <div
            style={{
              background: '#ffffff',
              borderRadius: 'var(--radius-card)',
              border: '1px solid var(--color-border-subtle)',
              overflow: 'hidden',
            }}
          >
            {/* Column header */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'minmax(220px, 1.6fr) 90px 90px 90px 180px 80px',
                padding: '12px 16px',
                gap: 12,
                background: 'var(--color-bg-hover)',
                borderBottom: '1px solid var(--color-border-subtle)',
                fontSize: 10,
                fontWeight: 700,
                color: 'var(--color-text-muted)',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                position: 'sticky',
                top: 0,
                zIndex: 4,
              }}
            >
              <span>Recipe</span>
              <span style={{ textAlign: 'right' }}>Forecast</span>
              <span style={{ textAlign: 'right' }}>Carry-over</span>
              <span style={{ textAlign: 'right' }}>Quinn</span>
              <span style={{ textAlign: 'center' }}>You order</span>
              <span style={{ textAlign: 'right' }}>Total</span>
            </div>

            {grouped.length === 0 && (
              <div style={{ padding: '32px 20px', textAlign: 'center', color: 'var(--color-text-muted)', fontSize: 12 }}>
                {query ? `No recipes match “${query}”.` : 'Hub has no recipes set up yet.'}
              </div>
            )}

            {grouped.map(group => {
              const groupTotal = group.rows.reduce(
                (a, r) => a + (dayState?.lines[r.skuId] ?? r.confirmed),
                0,
              );
              return (
                <div key={group.category}>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                      padding: '10px 16px',
                      background: 'var(--color-bg-surface)',
                      borderBottom: '1px solid var(--color-border-subtle)',
                      borderTop: '1px solid var(--color-border-subtle)',
                    }}
                  >
                    <StatusPill tone="neutral" label={group.category} size="xs" />
                    <span style={{ fontSize: 10, color: 'var(--color-text-muted)', fontWeight: 600 }}>
                      {group.rows.length} SKU{group.rows.length === 1 ? '' : 's'} · {groupTotal} units ordered
                    </span>
                  </div>
                  {group.rows.map(row => (
                    <SpokeOrderRow
                      key={row.skuId}
                      row={row}
                      units={dayState?.lines[row.skuId] ?? row.confirmed}
                      isExpanded={expanded.has(row.skuId)}
                      onToggle={() => toggleExpand(row.skuId)}
                      onSet={v => setLineUnits(row.skuId, v)}
                      onBump={d => adjust(row.skuId, d)}
                      onResetLine={() => setLineUnits(row.skuId, row.quinnProposed)}
                      locked={locked}
                      canAdjust={canAdjust}
                    />
                  ))}
                </div>
              );
            })}
          </div>

        </div>
      </div>
    </div>
  );
}

// ─── Day strip ─────────────────────────────────────────────────────────────

function DayStrip({
  spokeId,
  hubId,
  selectedDate,
  nowISO,
  cutoffPolicy,
  dayStates,
  onSelect,
}: {
  spokeId: SiteId;
  hubId: SiteId;
  selectedDate: string;
  nowISO: string;
  cutoffPolicy: 'lock' | 'soft';
  dayStates: Record<string, DayState>;
  onSelect: (date: string) => void;
}) {
  return (
    <div
      role="tablist"
      aria-label="Select day"
      style={{
        display: 'flex',
        gap: 8,
        padding: '12px 16px',
        background: '#ffffff',
        borderBottom: '1px solid var(--color-border-subtle)',
        overflowX: 'auto',
      }}
    >
      {DAY_RANGE.map(offset => {
        const d = dayOffset(offset);
        return (
          <DayCard
            key={d}
            spokeId={spokeId}
            hubId={hubId}
            date={d}
            selected={d === selectedDate}
            nowISO={nowISO}
            cutoffPolicy={cutoffPolicy}
            dayState={dayStates[`${spokeId}|${d}`]}
            onSelect={() => onSelect(d)}
          />
        );
      })}
    </div>
  );
}

function DayCard({
  spokeId,
  hubId,
  date,
  selected,
  nowISO,
  cutoffPolicy,
  dayState,
  onSelect,
}: {
  spokeId: SiteId;
  hubId: SiteId;
  date: string;
  selected: boolean;
  nowISO: string;
  cutoffPolicy: 'lock' | 'soft';
  dayState?: DayState;
  onSelect: () => void;
}) {
  // Re-derive the day's snapshot so the strip is accurate even if the day
  // hasn't been visited yet (we want totals for unloaded days too).
  const order = useMemo(() => spokeOrderForDate(spokeId, hubId, date), [spokeId, hubId, date]);
  const cutoff = new Date(order.cutoffDateTime);
  const now = new Date(nowISO);
  const past = cutoff.getTime() < now.getTime();

  const status: DisplayStatus = dayState?.status ?? order.status;
  const total = dayState
    ? Object.values(dayState.lines).reduce((a, b) => a + b, 0)
    : order.lines.reduce((a, l) => a + l.confirmed, 0);

  // What the user sees on the badge — promote derived-and-overdue to
  // "auto" because that's what will happen the moment they open it.
  const effectiveStatus: DisplayStatus =
    status === 'derived' && past && cutoffPolicy === 'lock' ? 'auto-finalised' : status;

  const isToday = date === DEMO_TODAY;
  const isPast = date < DEMO_TODAY;
  const dow = dayOfWeek(date);
  const dayNum = date.slice(8, 10);

  const borderColor = selected ? 'var(--color-accent-active)' : 'var(--color-border-subtle)';
  const background = selected ? 'var(--color-accent-active)' : '#ffffff';
  const labelColor = selected ? '#ffffff' : isPast ? 'var(--color-text-muted)' : 'var(--color-text-secondary)';
  const dayColor = selected ? '#ffffff' : 'var(--color-text-primary)';

  return (
    <button
      role="tab"
      aria-selected={selected}
      type="button"
      onClick={onSelect}
      style={{
        flex: '0 0 auto',
        minWidth: 110,
        padding: '10px 12px',
        borderRadius: 10,
        border: `1px solid ${borderColor}`,
        background,
        cursor: 'pointer',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-start',
        gap: 4,
        fontFamily: 'var(--font-primary)',
        textAlign: 'left',
        opacity: isPast && !selected ? 0.85 : 1,
        transition: 'background 0.15s, border-color 0.15s',
      }}
      title={`${dow} ${date}${isToday ? ' (today)' : ''} · ${total} units · ${displayStatusLabel(effectiveStatus)}`}
    >
      <span
        style={{
          fontSize: 9,
          fontWeight: 700,
          letterSpacing: '0.05em',
          textTransform: 'uppercase',
          color: labelColor,
        }}
      >
        {isToday ? 'Today' : dow}
      </span>
      <span
        style={{
          fontSize: 18,
          fontWeight: 700,
          color: dayColor,
          fontVariantNumeric: 'tabular-nums',
          lineHeight: 1,
        }}
      >
        {dayNum}
      </span>
      <span
        style={{
          fontSize: 10,
          fontWeight: 600,
          color: selected ? 'rgba(255,255,255,0.85)' : 'var(--color-text-muted)',
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        {total} units
      </span>
      <DayStatusBadge status={effectiveStatus} selected={selected} />
    </button>
  );
}

function DayStatusBadge({ status, selected }: { status: DisplayStatus; selected: boolean }) {
  const treatment = displayStatusTreatment(status);
  const fg = selected ? '#ffffff' : treatment.fg;
  const bg = selected ? 'rgba(255,255,255,0.18)' : treatment.bg;
  const border = selected ? 'rgba(255,255,255,0.35)' : treatment.border;
  return (
    <span
      style={{
        marginTop: 2,
        display: 'inline-flex',
        alignItems: 'center',
        padding: '2px 6px',
        borderRadius: 4,
        fontSize: 9,
        fontWeight: 700,
        textTransform: 'uppercase',
        letterSpacing: '0.04em',
        color: fg,
        background: bg,
        border: `1px solid ${border}`,
      }}
    >
      {treatment.label}
    </span>
  );
}

function displayStatusLabel(status: DisplayStatus): string {
  return displayStatusTreatment(status).label;
}

function displayStatusTreatment(status: DisplayStatus): {
  label: string;
  fg: string;
  bg: string;
  border: string;
} {
  switch (status) {
    case 'draft':           return { label: 'Draft',        fg: 'var(--color-warning)',          bg: 'var(--color-warning-light)', border: 'var(--color-warning-border)' };
    case 'submitted':       return { label: 'Submitted',    fg: 'var(--color-info)',             bg: 'var(--color-info-light)',    border: 'var(--color-info)' };
    case 'acknowledged':    return { label: 'Acknowledged', fg: 'var(--color-text-secondary)',   bg: 'var(--color-bg-hover)',      border: 'var(--color-border-subtle)' };
    case 'modified-by-hub': return { label: 'Modified',     fg: 'var(--color-text-secondary)',   bg: 'var(--color-bg-hover)',      border: 'var(--color-border-subtle)' };
    case 'auto-finalised':  return { label: 'Auto-locked',  fg: 'var(--color-text-secondary)',   bg: 'var(--color-bg-hover)',      border: 'var(--color-border-subtle)' };
    case 'derived':         return { label: 'Quinn draft',  fg: 'var(--color-text-muted)',       bg: '#ffffff',                    border: 'var(--color-border-subtle)' };
  }
}

// ─── Row ───────────────────────────────────────────────────────────────────

function SpokeOrderRow({
  row,
  units,
  isExpanded,
  onToggle,
  onSet,
  onBump,
  onResetLine,
  locked,
  canAdjust,
}: {
  row: ReturnType<typeof spokeOrderForDate>['lines'][number];
  units: number;
  isExpanded: boolean;
  onToggle: () => void;
  onSet: (v: number) => void;
  onBump: (d: number) => void;
  onResetLine: () => void;
  locked: boolean;
  canAdjust: boolean;
}) {
  const { recipe, forecast, carryOver, quinnProposed } = row;
  const carriedUnits = carryOver?.carriedUnits ?? 0;
  const lineDelta = units - quinnProposed;
  const editable = !locked && canAdjust;

  return (
    <>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(220px, 1.6fr) 90px 90px 90px 180px 80px',
          padding: '8px 16px 8px 13px',
          gap: 12,
          alignItems: 'center',
          borderBottom: '1px solid var(--color-border-subtle)',
          borderLeft: '3px solid transparent',
          background: '#ffffff',
          cursor: 'pointer',
          fontSize: 11,
        }}
        onClick={onToggle}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
          <button
            type="button"
            aria-label={isExpanded ? 'Collapse' : 'Expand'}
            onClick={e => {
              e.stopPropagation();
              onToggle();
            }}
            style={{
              width: 28,
              height: 28,
              border: '1px solid var(--color-border-subtle)',
              borderRadius: 6,
              background: '#ffffff',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              color: 'var(--color-text-muted)',
              flexShrink: 0,
            }}
          >
            {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          </button>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--color-text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {recipe.name}
            </div>
            <div style={{ display: 'flex', gap: 6, marginTop: 3, alignItems: 'center', fontSize: 9, color: 'var(--color-text-muted)' }}>
              {row.hasSeeded ? (
                <StatusPill tone="info" label="You started" size="xs" />
              ) : (
                <StatusPill tone="neutral" label="Quinn default" size="xs" />
              )}
              {recipe.batchRules?.multipleOf && recipe.batchRules.multipleOf > 1 && (
                <span>steps of {recipe.batchRules.multipleOf}</span>
              )}
            </div>
          </div>
        </div>

        <div style={{ textAlign: 'right', fontSize: 13, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
          {forecast ? forecast.projectedUnits : <span style={{ color: 'var(--color-text-muted)', fontWeight: 500 }}>—</span>}
        </div>

        <div style={{ textAlign: 'right', fontSize: 13, fontVariantNumeric: 'tabular-nums' }}>
          {carriedUnits > 0 ? (
            <span style={{ fontWeight: 700, color: 'var(--color-text-secondary)' }}>−{carriedUnits}</span>
          ) : (
            <span style={{ color: 'var(--color-text-muted)' }}>0</span>
          )}
        </div>

        <div style={{ textAlign: 'right', fontSize: 13, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            <Sparkles size={11} color="var(--color-text-muted)" />
            {quinnProposed}
          </span>
        </div>

        {/* Stepper */}
        <div
          style={{ display: 'flex', justifyContent: 'center' }}
          onClick={e => e.stopPropagation()}
        >
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '4px 6px',
              borderRadius: 8,
              background: 'var(--color-bg-hover)',
              border: '1px solid var(--color-border-subtle)',
            }}
          >
            <button type="button" onClick={() => onBump(-1)} disabled={!editable || units === 0} style={stepBtn(!editable || units === 0)} aria-label="Decrease">
              <Minus size={13} />
            </button>
            <input
              type="number"
              value={units}
              disabled={!editable}
              onChange={e => onSet(Number(e.target.value) || 0)}
              style={{
                width: 44,
                textAlign: 'center',
                fontSize: 14,
                fontWeight: 700,
                fontVariantNumeric: 'tabular-nums',
                border: 'none',
                background: 'transparent',
                outline: 'none',
                color: 'var(--color-text-primary)',
                fontFamily: 'var(--font-primary)',
                appearance: 'textfield',
                MozAppearance: 'textfield',
              }}
            />
            <button type="button" onClick={() => onBump(1)} disabled={!editable} style={stepBtn(!editable)} aria-label="Increase">
              <Plus size={13} />
            </button>
          </div>
        </div>

        <div style={{ textAlign: 'right', fontSize: 14, fontWeight: 800, fontVariantNumeric: 'tabular-nums' }}>
          {units}
          {lineDelta !== 0 && (
            <div style={{ fontSize: 9, fontWeight: 700, color: lineDelta > 0 ? 'var(--color-warning)' : 'var(--color-info)' }}>
              {lineDelta > 0 ? `+${lineDelta}` : lineDelta} vs Quinn
            </div>
          )}
        </div>
      </div>

      {/* Expanded panel */}
      {isExpanded && (
        <div
          style={{
            padding: '14px 20px 14px 56px',
            background: 'var(--color-bg-surface)',
            borderBottom: '1px solid var(--color-border-subtle)',
            display: 'grid',
            gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)',
            gap: 24,
          }}
          onClick={e => e.stopPropagation()}
        >
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--color-text-muted)', marginBottom: 8 }}>
              Forecast signals
            </div>
            {forecast ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {forecast.signals.map((s, i) => (
                  <div key={i} style={{ fontSize: 11, color: 'var(--color-text-secondary)' }}>
                    <strong style={{ color: 'var(--color-text-primary)' }}>{s.signal}</strong>
                    {s.note && <> · {s.note}</>}
                  </div>
                ))}
                {forecast.byPhase && (
                  <div style={{ marginTop: 6, display: 'flex', gap: 8, fontSize: 10 }}>
                    <PhaseChip label="AM" value={forecast.byPhase.morning} />
                    <PhaseChip label="MID" value={forecast.byPhase.midday} />
                    <PhaseChip label="PM" value={forecast.byPhase.afternoon} />
                  </div>
                )}
              </div>
            ) : (
              <div style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>
                No forecast signal — recipe isn&rsquo;t historically sold here yet.
              </div>
            )}
          </div>
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--color-text-muted)', marginBottom: 8 }}>
              How Quinn got to {quinnProposed}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 3, fontVariantNumeric: 'tabular-nums', fontSize: 11, color: 'var(--color-text-secondary)' }}>
              <LedgerLine label="Forecast" value={forecast?.projectedUnits ?? 0} />
              <LedgerLine label="Carry-over" value={-(carriedUnits)} />
              <div style={{ borderTop: '1px dashed var(--color-border-subtle)', paddingTop: 4, marginTop: 2, display: 'flex', gap: 6 }}>
                <Sparkles size={11} color="var(--color-text-muted)" />
                <span style={{ fontWeight: 700, color: 'var(--color-text-primary)' }}>Quinn proposes</span>
                <span style={{ marginLeft: 'auto', fontWeight: 700, color: 'var(--color-text-primary)' }}>{quinnProposed}</span>
              </div>
              {lineDelta !== 0 && (
                <div style={{ marginTop: 6, display: 'flex', gap: 6, alignItems: 'center' }}>
                  <span style={{ fontWeight: 700, color: 'var(--color-text-primary)' }}>You order</span>
                  <span style={{ marginLeft: 'auto', fontWeight: 800, color: 'var(--color-text-primary)' }}>{units}</span>
                  <button
                    type="button"
                    onClick={onResetLine}
                    disabled={locked}
                    style={{
                      padding: '4px 8px',
                      fontSize: 10,
                      fontWeight: 600,
                      borderRadius: 4,
                      background: '#ffffff',
                      border: '1px solid var(--color-border)',
                      cursor: locked ? 'not-allowed' : 'pointer',
                      color: 'var(--color-text-secondary)',
                      opacity: locked ? 0.5 : 1,
                    }}
                  >
                    Reset to Quinn
                  </button>
                </div>
              )}
              {carryOver?.reason && (
                <div style={{ marginTop: 6, fontSize: 10, color: 'var(--color-text-muted)' }}>
                  {carryOver.reason}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ─── Subcomponents ─────────────────────────────────────────────────────────

function CutoffMarker({
  cutoffISO,
  minutesLeft,
  past,
  locked,
}: {
  cutoffISO: string;
  minutesLeft: number;
  past: boolean;
  locked: boolean;
}) {
  const urgent = minutesLeft <= 60 && minutesLeft >= 0;
  const borderColor = locked
    ? 'var(--color-border-subtle)'
    : past
      ? 'var(--color-error-border)'
      : urgent
        ? 'var(--color-warning-border)'
        : 'var(--color-border-subtle)';
  const bg = locked
    ? 'var(--color-bg-hover)'
    : past
      ? 'var(--color-error-light)'
      : urgent
        ? 'var(--color-warning-light)'
        : '#ffffff';
  return (
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 10,
        padding: '8px 12px',
        borderRadius: 8,
        border: `1px solid ${borderColor}`,
        background: bg,
      }}
    >
      {locked ? (
        <Lock size={14} color="var(--color-text-secondary)" />
      ) : past ? (
        <AlertCircle size={14} color="var(--color-error)" />
      ) : (
        <Clock size={14} color={urgent ? 'var(--color-warning)' : 'var(--color-text-muted)'} />
      )}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
        <span style={{ fontSize: 9, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 700 }}>
          Cutoff
        </span>
        <span style={{ fontSize: 12, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
          {formatCutoff(cutoffISO)}
        </span>
        <span
          style={{
            fontSize: 9,
            color: locked
              ? 'var(--color-text-secondary)'
              : past
                ? 'var(--color-error)'
                : urgent
                  ? 'var(--color-warning)'
                  : 'var(--color-text-muted)',
            fontWeight: 600,
          }}
        >
          {locked
            ? 'Auto-locked'
            : past
              ? `${Math.abs(minutesLeft)}m overdue`
              : `${minutesLeft}m left`}
        </span>
      </div>
    </div>
  );
}

function Metric({ label, value, signed = false, bold = false }: { label: string; value: number; signed?: boolean; bold?: boolean }) {
  const sign = signed && value !== 0 ? (value > 0 ? '+' : '') : '';
  const color = signed ? (value > 0 ? 'var(--color-warning)' : value < 0 ? 'var(--color-info)' : 'var(--color-text-primary)') : 'var(--color-text-primary)';
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <span style={{ fontSize: 10, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 700 }}>
        {label}
      </span>
      <span style={{ fontSize: bold ? 22 : 18, fontWeight: 700, fontVariantNumeric: 'tabular-nums', color, lineHeight: 1 }}>
        {sign}{value}
      </span>
    </div>
  );
}

function PhaseChip({ label, value }: { label: string; value: number }) {
  return (
    <span
      style={{
        padding: '3px 8px',
        borderRadius: 4,
        background: '#ffffff',
        border: '1px solid var(--color-border-subtle)',
        fontSize: 9,
        fontWeight: 700,
        color: 'var(--color-text-secondary)',
        fontVariantNumeric: 'tabular-nums',
      }}
    >
      {label} {value}
    </span>
  );
}

function LedgerLine({ label, value }: { label: string; value: number }) {
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
      <span style={{ fontWeight: 600, color: 'var(--color-text-primary)' }}>{label}</span>
      <span style={{ marginLeft: 'auto', fontWeight: 700 }}>
        {value > 0 ? `+${value}` : value}
      </span>
    </div>
  );
}

function formatCutoff(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString('en-GB', { weekday: 'short', hour: '2-digit', minute: '2-digit' });
}

function stepBtn(disabled = false): React.CSSProperties {
  return {
    width: 26,
    height: 26,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 6,
    background: '#ffffff',
    border: '1px solid var(--color-border)',
    cursor: disabled ? 'not-allowed' : 'pointer',
    color: disabled ? 'var(--color-text-muted)' : 'var(--color-text-primary)',
    opacity: disabled ? 0.5 : 1,
  };
}

function demoBtn(variant: 'solid' | 'dashed' = 'solid'): React.CSSProperties {
  return {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 4,
    padding: '6px 10px',
    borderRadius: 6,
    fontSize: 11,
    fontWeight: 600,
    fontFamily: 'var(--font-primary)',
    background: '#ffffff',
    color: 'var(--color-text-muted)',
    border: variant === 'dashed' ? '1px dashed var(--color-border)' : '1px solid var(--color-border)',
    cursor: 'pointer',
  };
}
