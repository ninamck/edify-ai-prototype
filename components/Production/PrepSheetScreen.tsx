'use client';

/**
 * PrepSheetScreen — the Burger King cold-prep sheet.
 *
 * Styled to match the Pret run sheet (RunSheetView): a sticky toolbar with a
 * Print action, recipe-style cards with a tinted header + colour-coded
 * work-type tags ("Sanitise", "Slice", "Portion"), and quantities on the
 * right. The veg that dresses every burger is prepped by station:
 *
 *   • Sanitise — tomatoes, lettuce (wash + sanitise soak)
 *   • Chop     — tomatoes, lettuce, onions, gherkins (cut to spec)
 *   • Prep     — tomatoes, lettuce, onions, gherkins (portion + fill the line)
 *
 * Each row shows the raw amount to prep (e.g. 340 slices / 9 kg) plus the
 * container target, and how many of today's menu items that amount dresses —
 * all derived from the live forecast (BK_FORECAST) so the prep is sized to the
 * day. Tasks tick off; per-station + overall progress track.
 */

import { useState } from 'react';
import { Printer, RotateCcw, Check, Droplets, Scissors, Layers } from 'lucide-react';
import { BK_FORECAST, BK_PRODUCTION_ITEMS } from './bkFixtures';
import { WORK_TYPE_COLORS, WORK_TYPE_LABELS, type WorkType } from './fixtures';

// ── Forecast-driven coverage ─────────────────────────────────────────────────
// How many of today's burgers each veg dresses, from the live component
// forecast × a per-build attach rate. Tomato/lettuce ride the Whopper, chicken
// & premium builds (and Whopper Jr); onion is near-universal; gherkin skips the
// Royale. If the forecast moves, the coverage moves with it.

const DAY_UNITS: Record<string, number> = (() => {
  const m: Record<string, number> = {};
  for (const it of BK_PRODUCTION_ITEMS) {
    const f = BK_FORECAST.find(x => x.skuId === it.skuId);
    m[it.recipeId] = f?.projectedUnits ?? 0;
  }
  return m;
})();

type VegKey = 'tomato' | 'lettuce' | 'onion' | 'gherkin';

const VEG_ATTACH: Record<VegKey, Partial<Record<string, number>>> = {
  tomato: { 'bk-whopper-patty': 1, 'bk-chicken-fillet': 1, 'bk-angus-patty': 1, 'bk-plant-patty': 1, 'bk-junior-patty': 0.35 },
  lettuce: { 'bk-whopper-patty': 1, 'bk-chicken-fillet': 1, 'bk-angus-patty': 1, 'bk-plant-patty': 1, 'bk-junior-patty': 0.35 },
  onion: { 'bk-whopper-patty': 1, 'bk-junior-patty': 1, 'bk-chicken-fillet': 0.9, 'bk-angus-patty': 1, 'bk-plant-patty': 1 },
  gherkin: { 'bk-whopper-patty': 1, 'bk-junior-patty': 1, 'bk-angus-patty': 0.5, 'bk-plant-patty': 1 },
};

const LINE_LABEL: Record<string, string> = {
  'bk-whopper-patty': 'Whopper line',
  'bk-junior-patty': 'Cheeseburger / Jr line',
  'bk-chicken-fillet': 'Chicken Royale',
  'bk-angus-patty': 'Angus Kings',
  'bk-plant-patty': 'Plant range',
};

function coverageFor(veg: VegKey): number {
  const attach = VEG_ATTACH[veg];
  let n = 0;
  for (const rid of Object.keys(attach)) n += (DAY_UNITS[rid] ?? 0) * (attach[rid] ?? 0);
  return Math.round(n / 5) * 5;
}

// Raw quantity to actually prep, derived from the forecast coverage × a
// per-burger yield. This is "how much of the thing to do" (e.g. slice 340
// tomatoes), as opposed to the container target ("8 pans"). Moves with the
// forecast like the coverage does.
const VEG_AMOUNT: Record<VegKey, { perBurger: number; unit: 'slices' | 'kg'; round: number }> = {
  tomato: { perBurger: 1.4, unit: 'slices', round: 10 }, // ~1.4 slices per build
  lettuce: { perBurger: 0.013, unit: 'kg', round: 0.5 }, // ~13 g shredded per build
  onion: { perBurger: 0.009, unit: 'kg', round: 0.5 }, // ~9 g diced per build
  gherkin: { perBurger: 2, unit: 'slices', round: 20 }, // ~2 slices per build
};

const SLICES_PER_TOMATO = 16;

// Amount to prep for a given task. Most stations measure in the veg's base
// unit (slices / kg), but the sanitise station handles produce whole —
// tomatoes aren't sliced until Chop — so a task can opt into a whole-unit
// readout via `amountAs: 'whole'`.
function amountFor(task: PrepTask): string {
  if (task.veg === 'tomato' && task.amountAs === 'whole') {
    const slices = coverageFor('tomato') * VEG_AMOUNT.tomato.perBurger;
    const whole = Math.max(10, Math.round(slices / SLICES_PER_TOMATO / 10) * 10);
    return `${whole.toLocaleString('en-GB')} whole`;
  }
  const cfg = VEG_AMOUNT[task.veg];
  const raw = coverageFor(task.veg) * cfg.perBurger;
  const rounded = Math.max(cfg.round, Math.round(raw / cfg.round) * cfg.round);
  if (cfg.unit === 'kg') {
    return `${rounded.toLocaleString('en-GB', { maximumFractionDigits: 1 })} kg`;
  }
  return `${rounded.toLocaleString('en-GB')} ${cfg.unit}`;
}

function linesFor(veg: VegKey): string {
  return Object.keys(VEG_ATTACH[veg])
    .filter(rid => (DAY_UNITS[rid] ?? 0) > 0)
    .map(rid => `${LINE_LABEL[rid] ?? rid} (${DAY_UNITS[rid]})`)
    .join(' · ');
}

// ── Prep plan ────────────────────────────────────────────────────────────────

type PrepTag = { label: string; workType: WorkType };
type PrepTask = { id: string; item: string; veg: VegKey; step: string; target: string; tags: PrepTag[]; amountAs?: 'whole' };
type PrepStation = { id: string; name: string; caption: string; icon: React.ComponentType<{ size?: number }>; accent: string; tasks: PrepTask[] };

const PREP_PLAN: PrepStation[] = [
  {
    id: 'sanitise',
    name: 'Sanitise',
    caption: 'Wash & sanitise produce before the line',
    icon: Droplets,
    accent: '#1f9d57',
    tasks: [
      {
        id: 'san-tom',
        item: 'Tomatoes',
        veg: 'tomato',
        step: 'Wash, sanitise (90s soak), drain',
        target: '8 pans',
        amountAs: 'whole',
        tags: [
          { label: 'Wash', workType: 'wash' },
          { label: 'Sanitise', workType: 'sanitise' },
        ],
      },
      {
        id: 'san-let',
        item: 'Lettuce',
        veg: 'lettuce',
        step: 'Rinse leaves, sanitise (90s soak), spin dry',
        target: '6 pans',
        tags: [
          { label: 'Wash', workType: 'wash' },
          { label: 'Sanitise', workType: 'sanitise' },
        ],
      },
    ],
  },
  {
    id: 'chop',
    name: 'Chop',
    caption: 'Cut to spec',
    icon: Scissors,
    accent: '#2f6df6',
    tasks: [
      { id: 'chop-tom', item: 'Tomatoes', veg: 'tomato', step: 'Sliced 5mm', target: '8 pans', tags: [{ label: 'Slice', workType: 'slice' }] },
      { id: 'chop-let', item: 'Lettuce', veg: 'lettuce', step: 'Shredded 4mm', target: '6 pans', tags: [{ label: 'Shred', workType: 'slice' }] },
      { id: 'chop-oni', item: 'Onions', veg: 'onion', step: 'Diced 6mm', target: '4 pans', tags: [{ label: 'Dice', workType: 'slice' }] },
      { id: 'chop-ghe', item: 'Gherkins', veg: 'gherkin', step: 'Sliced 3mm', target: '5 tubs', tags: [{ label: 'Slice', workType: 'slice' }] },
    ],
  },
  {
    id: 'prep',
    name: 'Prep',
    caption: 'Portion & fill the line dispensers',
    icon: Layers,
    accent: '#7a5af5',
    tasks: [
      { id: 'prep-tom', item: 'Tomatoes', veg: 'tomato', step: 'Fill line trays + 1 backup', target: '3 + 1', tags: [{ label: 'Portion', workType: 'portion' }] },
      { id: 'prep-let', item: 'Lettuce', veg: 'lettuce', step: 'Fill line dispensers + 2 backups', target: '2 + 2', tags: [{ label: 'Portion', workType: 'portion' }] },
      { id: 'prep-oni', item: 'Onions', veg: 'onion', step: 'Portion into line tubs', target: '4 tubs', tags: [{ label: 'Portion', workType: 'portion' }] },
      { id: 'prep-ghe', item: 'Gherkins', veg: 'gherkin', step: 'Top up line caddy', target: '1 caddy', tags: [{ label: 'Fill', workType: 'portion' }] },
    ],
  },
];

const ALL_TASK_IDS = PREP_PLAN.flatMap(s => s.tasks.map(t => t.id));
const DONE_GREEN = '#1f9d57';

export default function PrepSheetScreen() {
  const [done, setDone] = useState<Set<string>>(new Set());

  const toggle = (id: string) =>
    setDone(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const totalDone = ALL_TASK_IDS.filter(id => done.has(id)).length;
  const total = ALL_TASK_IDS.length;
  const pct = total > 0 ? (totalDone / total) * 100 : 0;

  return (
    <div style={{ padding: '16px 24px 48px', display: 'flex', flexDirection: 'column', gap: 14, fontFamily: 'var(--font-primary)' }}>
      {/* Sticky toolbar — summary left, actions right (matches the run sheet) */}
      <div
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 5,
          display: 'flex',
          alignItems: 'center',
          gap: 14,
          flexWrap: 'wrap',
          padding: '10px 14px',
          background: 'var(--color-bg-surface)',
          border: '1px solid var(--color-border-subtle)',
          borderRadius: 'var(--radius-card)',
        }}
      >
        <span style={{ fontSize: 14, fontWeight: 800, color: 'var(--color-text-primary)' }}>Prep sheet</span>
        <span style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>
          {PREP_PLAN.length} stations · {total} tasks · cold prep, sized to today&rsquo;s forecast
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 9, minWidth: 200, flex: '1 1 200px', maxWidth: 360 }}>
          <span style={{ fontSize: 12, fontWeight: 800, color: 'var(--color-text-secondary)', whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>
            {totalDone}/{total}
          </span>
          <div style={{ flex: 1, height: 7, borderRadius: 4, background: 'var(--color-bg-hover)', overflow: 'hidden' }}>
            <div style={{ width: `${pct}%`, height: '100%', background: DONE_GREEN, transition: 'width 0.25s ease' }} />
          </div>
          {totalDone === total && (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12, fontWeight: 800, color: DONE_GREEN, whiteSpace: 'nowrap' }}>
              <Check size={14} /> Ready
            </span>
          )}
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
          <button type="button" onClick={() => setDone(new Set())} disabled={totalDone === 0} style={toolbarBtn}>
            <RotateCcw size={14} /> Reset
          </button>
          <button type="button" onClick={() => window.print()} style={toolbarBtn} title="Print this prep sheet">
            <Printer size={15} /> Print
          </button>
        </div>
      </div>

      {/* Station cards — tile into columns on wide screens, like the run sheet */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(440px, 1fr))', gap: 12, alignItems: 'start' }}>
        {PREP_PLAN.map(station => (
          <StationCard key={station.id} station={station} done={done} onToggle={toggle} />
        ))}
      </div>
    </div>
  );
}

function StationCard({ station, done, onToggle }: { station: PrepStation; done: Set<string>; onToggle: (id: string) => void }) {
  const Icon = station.icon;
  const doneCount = station.tasks.filter(t => done.has(t.id)).length;
  const allDone = doneCount === station.tasks.length;
  return (
    <section
      style={{
        background: '#ffffff',
        border: '1px solid var(--color-border-subtle)',
        borderRadius: 'var(--radius-card)',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* Header — tinted bar like the run sheet recipe card */}
      <header
        style={{
          padding: '9px 14px',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          flexWrap: 'wrap',
          borderBottom: '1px solid var(--color-border-subtle)',
          background: 'var(--color-bg-hover)',
          borderTopLeftRadius: 'var(--radius-card)',
          borderTopRightRadius: 'var(--radius-card)',
        }}
      >
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 26,
            height: 26,
            borderRadius: 7,
            background: hexA(station.accent, 0.12),
            color: station.accent,
            flexShrink: 0,
          }}
        >
          <Icon size={15} />
        </span>
        <h2 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: 'var(--color-text-primary)' }}>{station.name}</h2>
        <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          {station.caption}
        </span>
        <span
          style={{
            marginLeft: 'auto',
            fontSize: 12,
            fontWeight: 700,
            color: allDone ? DONE_GREEN : 'var(--color-text-secondary)',
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          {doneCount}/{station.tasks.length}
        </span>
      </header>

      {/* Column header */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 1fr) 150px',
          gap: 12,
          padding: '4px 14px',
          borderBottom: '1px solid var(--color-border-subtle)',
        }}
      >
        {['Item & prep', 'Amount · covers'].map((h, i) => (
          <span
            key={h}
            style={{
              fontSize: 9,
              fontWeight: 700,
              color: 'var(--color-text-muted)',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              textAlign: i === 1 ? 'right' : 'left',
            }}
          >
            {h}
          </span>
        ))}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column' }}>
        {station.tasks.map((task, i) => (
          <TaskRow
            key={task.id}
            task={task}
            checked={done.has(task.id)}
            onToggle={() => onToggle(task.id)}
            isLast={i === station.tasks.length - 1}
          />
        ))}
      </div>
    </section>
  );
}

function TaskRow({ task, checked, onToggle, isLast }: { task: PrepTask; checked: boolean; onToggle: () => void; isLast: boolean }) {
  const coverage = coverageFor(task.veg);
  return (
    <button
      type="button"
      onClick={onToggle}
      style={{
        display: 'grid',
        gridTemplateColumns: 'minmax(0, 1fr) 150px',
        gap: 12,
        alignItems: 'center',
        width: '100%',
        textAlign: 'left',
        padding: '10px 14px',
        borderBottom: isLast ? 'none' : '1px solid var(--color-border-subtle)',
        borderLeft: `3px solid ${checked ? DONE_GREEN : 'transparent'}`,
        background: checked ? hexA(DONE_GREEN, 0.05) : '#fff',
        border: 'none',
        cursor: 'pointer',
        fontFamily: 'var(--font-primary)',
      }}
    >
      {/* Left: checkbox + name + tags + step */}
      <span style={{ display: 'flex', alignItems: 'center', gap: 11, minWidth: 0 }}>
        <Checkbox checked={checked} />
        <span style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0 }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span
              style={{
                fontSize: 14,
                fontWeight: 700,
                color: 'var(--color-text-primary)',
                textDecoration: checked ? 'line-through' : 'none',
                opacity: checked ? 0.6 : 1,
              }}
            >
              {task.item}
            </span>
            {task.tags.map(tag => (
              <WorkTag key={tag.label} label={tag.label} workType={tag.workType} />
            ))}
          </span>
          <span style={{ fontSize: 12, color: 'var(--color-text-muted)', opacity: checked ? 0.6 : 1 }}>{task.step}</span>
        </span>
      </span>

      {/* Right: raw amount to do → container target → forecast coverage */}
      <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 2 }}>
        <span style={{ fontSize: 15, fontWeight: 800, color: 'var(--color-text-primary)', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
          {amountFor(task)}
        </span>
        <span
          title={`Dresses today's forecast: ${linesFor(task.veg)}`}
          style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-text-muted)', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}
        >
          for ~{coverage.toLocaleString('en-GB')} burgers
        </span>
      </span>
    </button>
  );
}

function WorkTag({ label, workType }: { label: string; workType: WorkType }) {
  const tone = WORK_TYPE_COLORS[workType];
  return (
    <span
      title={`${WORK_TYPE_LABELS[workType]} — what to do to this item`}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        padding: '2px 8px',
        borderRadius: 100,
        background: tone.bg,
        color: tone.color,
        fontSize: 10,
        fontWeight: 700,
        letterSpacing: '0.02em',
        whiteSpace: 'nowrap',
        lineHeight: 1.3,
      }}
    >
      {label}
    </span>
  );
}

function Checkbox({ checked }: { checked: boolean }) {
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: 22,
        height: 22,
        borderRadius: 6,
        border: `2px solid ${checked ? DONE_GREEN : 'var(--color-border)'}`,
        background: checked ? DONE_GREEN : '#fff',
        color: '#fff',
        flexShrink: 0,
      }}
    >
      {checked && <Check size={14} strokeWidth={3} />}
    </span>
  );
}

const toolbarBtn: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 7,
  padding: '8px 14px',
  borderRadius: 8,
  border: '1px solid var(--color-border-subtle)',
  background: 'var(--color-bg-surface)',
  color: 'var(--color-text-primary)',
  fontSize: 13,
  fontWeight: 700,
  fontFamily: 'var(--font-primary)',
  cursor: 'pointer',
};

function hexA(hex: string, alpha: number): string {
  const h = hex.replace('#', '');
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
