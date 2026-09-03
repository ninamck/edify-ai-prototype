'use client';

// /forecast — the operator-facing forecasting surface.
//
// Information architecture (post-Michael feedback):
//
//   1. Scope tabs  — "Forecast" (forward) vs "Result" (backward). Mirrors
//                    the two questions operators actually ask:
//                      • "This is what is forecasted and why."
//                      • "This is what was forecasted and why it was wrong."
//   2. Day pills   — three options per scope:
//                      • Forecast: Today / Tomorrow / Day after
//                      • Result:   Today (live) / Yesterday / Day before
//   3. Hero card   — three operator-language KPIs (revenue £, items,
//                    transactions), a one-line explanation, the phase
//                    split (morning / midday / afternoon) and the
//                    channel mix (takeaway / eat-in / delivery).
//                    All three are surfaced as units operators read in
//                    every other tool, so the page can be carried into
//                    a standup without a translation step.
//   4. Item drill  — the SKU-level grid + adjuster + WhyPanel +
//                    BacktestStrip, collapsed behind a disclosure.
//                    Power-user surface for the rare case where the
//                    operator wants to nudge one specific item.

import { useCallback, useMemo, useState } from 'react';
import { Calendar, ChevronDown, ChevronRight } from 'lucide-react';
import { useActiveSite } from '@/components/ActiveSite/ActiveSiteContext';
import FjForecastScreen from '@/components/Production/farmerj/ForecastScreen';
import { DEMO_TODAY, dayOffset } from '@/components/Production/fixtures';
import DatePickerPopover from '@/components/Forecast/DatePickerPopover';
import { useProductionSite } from '@/components/Production/ProductionSiteContext';
import ForwardForecastCard from '@/components/Forecast/ForwardForecastCard';
import ResultCard from '@/components/Forecast/ResultCard';
import AccuracyStrip from '@/components/Forecast/AccuracyStrip';
import HorizonGrid from '@/components/Forecast/HorizonGrid';
import WhyPanel from '@/components/Forecast/WhyPanel';
import BacktestStrip from '@/components/Forecast/BacktestStrip';
import ForecastTrendChart from '@/components/Forecast/ForecastTrendChart';
import HourlyBreakdownDrawer from '@/components/Forecast/HourlyBreakdownDrawer';
import { multiplierFor, type TotalMultipliers } from '@/components/Forecast/TotalEditor';
import { buildForecastRows, type ForecastRow } from '@/components/Forecast/accuracy';

const HORIZON_DAYS = 5;
const BACKTEST_WINDOW_DAYS = 7;

type Selection = { skuId: string; date: string };
type Scope = 'forecast' | 'result';

// Quick-pill offsets for each scope. Anything outside this set opens
// through the date picker pill and is rendered with the date itself
// (e.g. "Mon 27 Apr") rather than a relative label.
const FORECAST_QUICK = [
  { id: 'today', label: 'Today', offset: 0 },
  { id: 'tomorrow', label: 'Tomorrow', offset: 1 },
] as const;

const RESULT_QUICK = [
  { id: 'today', label: 'Today (live)', offset: 0 },
  { id: 'yesterday', label: 'Yesterday', offset: -1 },
] as const;

// Range the date picker offers. Forecast looks ahead a fortnight; result
// looks back a month. The forecast horizon goes wider than the demo
// fixtures so the operator can experiment — empty days simply read as
// zeros rather than throwing.
const FORECAST_MAX_OFFSET = 14;
const RESULT_MIN_OFFSET = -30;

/**
 * Farmer J reads its forecast from the Day plan's own model (reference-day
 * average × flex), so the brand gets its own screen with the same shape.
 * Branching here, above the hub page's hooks, keeps hook order stable.
 */
export default function ForecastPage() {
  const { isFarmerJ } = useActiveSite();
  if (isFarmerJ) return <FjForecastScreen />;
  return <HubForecastPage />;
}

function HubForecastPage() {
  const { siteId } = useProductionSite();

  const [scope, setScope] = useState<Scope>('forecast');
  // Each scope holds its own selected offset (in days vs DEMO_TODAY) so
  // flipping between tabs doesn't forget where the operator was. Using
  // a number rather than a string id means the date picker and the
  // quick pills share a single source of truth — picking "tomorrow"
  // from the calendar automatically lights up the Tomorrow pill.
  const [forecastOffset, setForecastOffset] = useState(0);
  const [resultOffset, setResultOffset] = useState(-1);

  const activeOffset = scope === 'forecast' ? forecastOffset : resultOffset;
  const setActiveOffset = scope === 'forecast' ? setForecastOffset : setResultOffset;
  const activeDate = useMemo(() => dayOffset(activeOffset), [activeOffset]);
  const activeDateLabel = useMemo(
    () => labelForOffset(scope, activeOffset, activeDate),
    [scope, activeOffset, activeDate],
  );

  // ───── Item drill state ────────────────────────────────────────────────
  // Collapsed by default — Michael's bar is "don't make me scroll 100 items".
  const [drillOpen, setDrillOpen] = useState(false);

  const horizonDates = useMemo(
    () => Array.from({ length: HORIZON_DAYS }, (_, i) => dayOffset(i, DEMO_TODAY)),
    [],
  );
  const backtestDates = useMemo(
    () =>
      Array.from({ length: BACKTEST_WINDOW_DAYS }, (_, i) =>
        dayOffset(-(BACKTEST_WINDOW_DAYS - 1 - i), DEMO_TODAY),
      ),
    [],
  );

  const rows: ForecastRow[] = useMemo(
    () => (drillOpen ? buildForecastRows(siteId, horizonDates) : []),
    [siteId, horizonDates, drillOpen],
  );

  const [overrides, setOverrides] = useState<Record<string, number>>({});
  // Per-date total multipliers. The KPI tiles on either hero card let
  // the operator nudge the whole-day forecast at the headline level;
  // the same multiplier cascades into HorizonGrid so SKU rows reflect
  // the updated baseline. Per-SKU overrides (above) still win on top.
  const [totalMultipliers, setTotalMultipliers] = useState<TotalMultipliers>({});
  const setMultiplierForActiveDate = useCallback(
    (m: number | null) => {
      setTotalMultipliers(prev => {
        if (m == null) {
          const { [activeDate]: _, ...rest } = prev;
          return rest;
        }
        return { ...prev, [activeDate]: m };
      });
    },
    [activeDate],
  );
  const activeMultiplier = multiplierFor(totalMultipliers, activeDate);
  const [selection, setSelection] = useState<Selection | null>(null);
  const [whyTarget, setWhyTarget] = useState<Selection | null>(null);
  // SKU currently shown in the hourly-breakdown drawer. The drawer follows
  // the page's activeDate so changing the day picker re-renders the chart
  // for the same SKU on the new date — no need to remember a date here.
  const [hourlySku, setHourlySku] = useState<string | null>(null);

  const overrideKey = useCallback(
    (skuId: string, date: string) => `${skuId}|${date}`,
    [],
  );
  const setOverride = useCallback(
    (skuId: string, date: string, qty: number | null) => {
      const key = `${skuId}|${date}`;
      setOverrides(prev => {
        if (qty == null) {
          const { [key]: _, ...rest } = prev;
          return rest;
        }
        return { ...prev, [key]: qty };
      });
    },
    [],
  );
  const handleSelect = useCallback((skuId: string, date: string) => {
    setSelection(prev =>
      prev?.skuId === skuId && prev?.date === date ? null : { skuId, date },
    );
  }, []);
  const handleToggleRow = useCallback((skuId: string) => {
    setSelection(prev => (prev?.skuId === skuId ? null : { skuId, date: DEMO_TODAY }));
  }, []);
  const handleOpenWhy = useCallback((skuId: string, date: string) => {
    setWhyTarget({ skuId, date });
  }, []);
  const handleCloseWhy = useCallback(() => setWhyTarget(null), []);
  const handleOpenHourly = useCallback((skuId: string) => setHourlySku(skuId), []);
  const handleCloseHourly = useCallback(() => setHourlySku(null), []);
  const whyRow = useMemo(
    () => (whyTarget ? rows.find(r => r.skuId === whyTarget.skuId) ?? null : null),
    [whyTarget, rows],
  );

  return (
    <div
      style={{
        padding: '20px 28px 48px',
        maxWidth: '1280px',
        margin: '0 auto',
        display: 'flex',
        flexDirection: 'column',
        gap: 16,
      }}
    >
      {/* Scope tabs + day picker share one row — the page title lives
          in the area top bar, so the controls lead the content. */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          flexWrap: 'wrap',
        }}
      >
        <Tabs
          options={[
            { id: 'forecast', label: 'Forecast' },
            { id: 'result', label: 'Result' },
          ]}
          value={scope}
          onChange={v => setScope(v as Scope)}
        />
        <DayPickerRow
          scope={scope}
          offset={activeOffset}
          activeDate={activeDate}
          onSelectOffset={setActiveOffset}
        />
      </div>

      {/* Hero card */}
      {scope === 'forecast' ? (
        <ForwardForecastCard
          siteId={siteId}
          date={activeDate}
          dateLabel={activeDateLabel}
          multiplier={activeMultiplier}
          onMultiplierChange={setMultiplierForActiveDate}
        />
      ) : (
        <ResultCard
          siteId={siteId}
          date={activeDate}
          dateLabel={activeDateLabel}
          multiplier={activeMultiplier}
          onMultiplierChange={setMultiplierForActiveDate}
        />
      )}

      {/* Trend chart — 7-day forecast vs actual, with future region on
          the Forecast tab so the operator sees where the model expects
          the next few days to land. */}
      <ForecastTrendChart
        siteId={siteId}
        highlightDate={activeDate}
        multipliers={totalMultipliers}
        pastDays={7}
        futureDays={scope === 'forecast' ? 3 : 0}
      />

      {/* Item drill-down — collapsed by default */}
      <section
        style={{
          background: '#ffffff',
          border: '1px solid var(--color-border-subtle)',
          borderRadius: 14,
          overflow: 'hidden',
          fontFamily: 'var(--font-primary)',
        }}
      >
        <button
          type="button"
          onClick={() => setDrillOpen(o => !o)}
          aria-expanded={drillOpen}
          style={{
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: '14px 18px',
            background: 'transparent',
            border: 'none',
            cursor: 'pointer',
            textAlign: 'left',
            fontFamily: 'inherit',
          }}
        >
          {drillOpen ? (
            <ChevronDown size={16} color="var(--color-text-secondary)" />
          ) : (
            <ChevronRight size={16} color="var(--color-text-secondary)" />
          )}
          <span
            style={{
              fontSize: 14.5,
              fontWeight: 700,
              color: 'var(--color-text-primary)',
            }}
          >
            View by menu item
          </span>
          <span style={{ fontSize: 12.5, color: 'var(--color-text-muted)' }}>
            Adjust an individual SKU on top of any total-level edit · cascades
            through ingredients, spokes, and the bench.
          </span>
        </button>

        {drillOpen && (
          <div
            style={{
              padding: '0 18px 18px',
              display: 'flex',
              flexDirection: 'column',
              gap: 16,
              borderTop: '1px solid var(--color-border-subtle)',
              paddingTop: 16,
            }}
          >
            <AccuracyStrip siteId={siteId} backtestDates={backtestDates} />

            <HorizonGrid
              siteId={siteId}
              rows={rows}
              dates={horizonDates}
              overrides={overrides}
              overrideKey={overrideKey}
              totalMultipliers={totalMultipliers}
              selection={selection}
              onSelect={handleSelect}
              onToggleRow={handleToggleRow}
              onOpenHourly={handleOpenHourly}
              onOpenWhy={handleOpenWhy}
              onOverride={setOverride}
            />

            <BacktestStrip
              siteId={siteId}
              dates={backtestDates}
              onPick={skuId => handleOpenWhy(skuId, DEMO_TODAY)}
            />
          </div>
        )}
      </section>

      <WhyPanel
        siteId={siteId}
        row={whyRow}
        date={whyTarget?.date ?? null}
        onClose={handleCloseWhy}
      />

      <HourlyBreakdownDrawer
        siteId={siteId}
        skuId={hourlySku}
        date={activeDate}
        dateLabel={activeDateLabel}
        multiplier={activeMultiplier}
        mode={scope}
        onClose={handleCloseHourly}
      />
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Local pills + tab primitives
// ────────────────────────────────────────────────────────────────────────────

// Pill/capsule switcher matching the platform-wide tab pattern used in
// Plan view, Sales filter, BacktestStrip sort, etc.: rounded-pill track
// with the active tab filled in the accent colour. Consistency with the
// rest of the product matters more than this one component being
// visually unique.
function Tabs({
  options,
  value,
  onChange,
}: {
  options: Array<{ id: string; label: string }>;
  value: string;
  onChange: (id: string) => void;
}) {
  return (
    <div
      role="tablist"
      style={{
        display: 'flex',
        background: 'var(--color-bg-hover)',
        borderRadius: 100,
        padding: 3,
        width: 'fit-content',
      }}
    >
      {options.map(o => {
        const active = o.id === value;
        return (
          <button
            key={o.id}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(o.id)}
            style={{
              padding: '7px 16px',
              border: 'none',
              borderRadius: 100,
              fontSize: 13,
              fontWeight: 600,
              cursor: 'pointer',
              fontFamily: 'var(--font-primary)',
              background: active ? 'var(--color-accent-active)' : 'transparent',
              color: active ? '#ffffff' : 'var(--color-text-secondary)',
              transition: 'background 0.15s, color 0.15s',
              whiteSpace: 'nowrap',
            }}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Day picker — two quick pills + an arbitrary date pill.
//
// The third option in the old pill row was always the same relative day
// ("Day after" / "Day before"). Replacing it with a date picker means
// operators can sanity-check any horizon date without us having to
// invent a longer list of pills. Picking a date that happens to match
// today / tomorrow / yesterday simply re-highlights the corresponding
// quick pill, since state is just an offset.
// ────────────────────────────────────────────────────────────────────────────

function DayPickerRow({
  scope,
  offset,
  activeDate,
  onSelectOffset,
}: {
  scope: Scope;
  offset: number;
  activeDate: string;
  onSelectOffset: (offset: number) => void;
}) {
  const quick = scope === 'forecast' ? FORECAST_QUICK : RESULT_QUICK;
  const quickOffsets = quick.map(q => q.offset);
  const isCustom = !quickOffsets.includes(offset as 0 | 1 | -1);

  const min =
    scope === 'forecast' ? dayOffset(0) : dayOffset(RESULT_MIN_OFFSET);
  const max =
    scope === 'forecast' ? dayOffset(FORECAST_MAX_OFFSET) : dayOffset(0);

  return (
    // marginLeft auto pins the day pills to the right edge of the
    // shared controls row, opposite the Forecast/Result switcher.
    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center', marginLeft: 'auto' }}>
      {quick.map(q => (
        <Pill
          key={q.id}
          active={offset === q.offset}
          onClick={() => onSelectOffset(q.offset)}
          label={q.label}
        />
      ))}
      <DatePickerPill
        value={activeDate}
        min={min}
        max={max}
        active={isCustom}
        fallbackLabel="Pick a date"
        activeLabel={formatNiceDate(activeDate)}
        onChange={date => onSelectOffset(offsetFromDate(date))}
      />
    </div>
  );
}

function Pill({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={pillStyle(active)}
    >
      {label}
    </button>
  );
}

function DatePickerPill({
  value,
  min,
  max,
  active,
  fallbackLabel,
  activeLabel,
  onChange,
}: {
  value: string;
  min: string;
  max: string;
  active: boolean;
  fallbackLabel: string;
  activeLabel: string;
  onChange: (date: string) => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <span style={{ position: 'relative', display: 'inline-flex' }}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        aria-expanded={open}
        aria-haspopup="dialog"
        style={{
          ...pillStyle(active),
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
        }}
        aria-label={
          active ? `Selected date: ${activeLabel}. Click to change.` : 'Pick a date'
        }
      >
        <Calendar size={12} />
        {active ? activeLabel : fallbackLabel}
      </button>
      {open && (
        // `key` forces the popover to re-mount whenever the externally
        // selected date moves (e.g. via the quick pills), so it opens
        // on the month of the new selection rather than the old one.
        <DatePickerPopover
          key={value}
          selectedDate={value}
          min={min}
          max={max}
          onSelect={date => {
            onChange(date);
            setOpen(false);
          }}
          onClose={() => setOpen(false)}
        />
      )}
    </span>
  );
}

function pillStyle(active: boolean): React.CSSProperties {
  return {
    padding: '6px 12px',
    border: `1px solid ${
      active ? 'var(--color-accent-active)' : 'var(--color-border-subtle)'
    }`,
    background: active
      ? 'color-mix(in srgb, var(--color-accent-active) 8%, white)'
      : '#ffffff',
    color: active
      ? 'var(--color-accent-active)'
      : 'var(--color-text-secondary)',
    borderRadius: 999,
    fontSize: 12.5,
    fontWeight: 600,
    cursor: 'pointer',
    fontFamily: 'var(--font-primary)',
  };
}

// ────────────────────────────────────────────────────────────────────────────
// Offset ↔ date helpers
// ────────────────────────────────────────────────────────────────────────────

/** Convert an ISO date back into an offset (in days) vs DEMO_TODAY. */
function offsetFromDate(date: string): number {
  const ms = 24 * 60 * 60 * 1000;
  const anchor = new Date(`${DEMO_TODAY}T00:00:00Z`).getTime();
  const target = new Date(`${date}T00:00:00Z`).getTime();
  return Math.round((target - anchor) / ms);
}

/** Short, human-friendly date label like "Mon 27 Apr". */
function formatNiceDate(date: string): string {
  const d = new Date(`${date}T00:00:00Z`);
  const dow = d.toLocaleDateString('en-GB', { weekday: 'short', timeZone: 'UTC' });
  const day = d.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  });
  return `${dow} ${day}`;
}

/**
 * Label rendered above the hero KPIs. Quick offsets get their relative
 * label ("Today", "Yesterday"); anything else falls back to the
 * formatted date so the hero header still reads naturally.
 */
function labelForOffset(scope: Scope, offset: number, date: string): string {
  if (scope === 'forecast') {
    if (offset === 0) return 'Today';
    if (offset === 1) return 'Tomorrow';
  } else {
    if (offset === 0) return 'Today (live)';
    if (offset === -1) return 'Yesterday';
  }
  return formatNiceDate(date);
}
