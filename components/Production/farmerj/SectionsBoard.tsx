'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties, DragEvent, ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { ArrowRightLeft, Check, ChevronRight, Clock, Flame, GripVertical, Pause, Play, PlaySquare, Printer, RotateCcw, Thermometer, Timer, User, X, Zap } from 'lucide-react';
import { useActiveSite } from '@/components/ActiveSite/ActiveSiteContext';
import StatusPill from '@/components/Production/StatusPill';
import { FJ_DAY_STRIP_DATES, FJ_DEMO_TODAY, longDate, weekdayLabel } from './calendar';
import { FjDayStrip, Notice } from './DayPlan';
import { useFjPlanStore } from './FjPlanStore';
import { clearTimer, clockNudge, clockPlay, clockReset, clockSet, dismissNudge, hhmm, startTimer, timerRemaining, useFjClock, type FjTimer } from './fjClock';
import { computeSectionsDay, listKey, plural, stepsForTask, type Nudge, type SectionCard, type SectionTask, type SectionsDay } from './sections';
import { COMPONENTS, CONTAINERS, SHELF_LIFE_GROUPS } from './recipes';
import { FJ_ALL_SHOPS_ID, getShop } from './shops';
import FjStepper, { type StepperTarget } from './FjStepper';
import { EQUIPMENT_CAPACITY_UNIT, EQUIPMENT_LABELS } from '../fixtures';

/**
 * Sections, on the Pret Benches board. One card per section with the
 * person on it, task rows the manager can drag into order or move to
 * another section, hands-on totals and the start/end window. AM and PM
 * take the place of Pret's runs. "Open stepper" walks the person on the
 * floor through their list one task at a time.
 */

type SlotFilter = 'all' | 'am' | 'pm';

export default function SectionsBoard() {
  const { isFarmerJ, productionSiteId } = useActiveSite();
  const [date, setDate] = useState(FJ_DEMO_TODAY);
  const shopId = productionSiteId ?? FJ_ALL_SHOPS_ID;

  if (!isFarmerJ) return <Notice>Switch the Brand pill in demo controls to Farmer J to see this screen.</Notice>;
  if (shopId === FJ_ALL_SHOPS_ID) return <Notice>Pick a shop in the site switcher to see its sections.</Notice>;
  return <SectionsForShop shopId={shopId} date={date} onDateChange={setDate} />;
}

function useSectionsDay(shopId: string, date: string) {
  const store = useFjPlanStore();
  const isToday = date === FJ_DEMO_TODAY;
  const day = useMemo(() => computeSectionsDay(shopId, date, store.get, isToday), [shopId, date, store, isToday]);
  const record = store.get(shopId, date);
  // Ticking a task also records what was made: the planned batches unless
  // the person typed a different figure on the method card.
  const tick = useCallback(
    (taskId: string, done: boolean, madeBatches?: number) =>
      store.update(shopId, date, r => {
        const ticks = { ...(r.ticks ?? {}) };
        const made = { ...(r.made ?? {}) };
        const task = day.tasks.find(t => t.id === taskId);
        const card = task ? day.cards.find(c => c.section.id === task.sectionId) : undefined;
        if (done) {
          const at = new Date().toISOString();
          ticks[taskId] = at;
          made[taskId] = { batches: madeBatches ?? task?.batches ?? 0, by: card?.section.person ?? '', atISO: at };
        } else {
          delete ticks[taskId];
          delete made[taskId];
        }
        return { ...r, ticks, made };
      }),
    [store, shopId, date, day],
  );
  const setMade = useCallback(
    (taskId: string, batches: number) =>
      store.update(shopId, date, r => {
        const cur = r.made?.[taskId];
        if (!cur) return r;
        return { ...r, made: { ...(r.made ?? {}), [taskId]: { ...cur, batches } } };
      }),
    [store, shopId, date],
  );
  const move = useCallback(
    (taskId: string, sectionId: string) => store.update(shopId, date, r => ({ ...r, reassigned: { ...(r.reassigned ?? {}), [taskId]: sectionId } })),
    [store, shopId, date],
  );
  const reorder = useCallback(
    (key: string, ids: string[]) => store.update(shopId, date, r => ({ ...r, taskOrder: { ...(r.taskOrder ?? {}), [key]: ids } })),
    [store, shopId, date],
  );
  const setPerson = useCallback(
    (sectionId: string, name: string) => store.update(shopId, date, r => ({ ...r, people: { ...(r.people ?? {}), [sectionId]: name } })),
    [store, shopId, date],
  );
  return { day, ticks: record.ticks ?? {}, made: record.made ?? {}, tick, setMade, move, reorder, setPerson };
}

function SectionsForShop({ shopId, date, onDateChange }: { shopId: string; date: string; onDateChange: (d: string) => void }) {
  const shop = getShop(shopId);
  const { day, ticks, made, tick, setMade, move, reorder, setPerson } = useSectionsDay(shopId, date);
  const clock = useFjClock();
  const [slot, setSlot] = useState<SlotFilter>('all');
  const [focused, setFocused] = useState<string | null>(null);
  const [stepper, setStepper] = useState<{ open: boolean; target: StepperTarget | null }>({ open: false, target: null });
  const isToday = date === FJ_DEMO_TODAY;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setFocused(null); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => () => clockPlay(false), []);

  const focusedTask = focused ? day.tasks.find(t => t.id === focused) : undefined;
  const liveNudges = isToday
    ? day.nudges.filter(n => clock.mins >= n.atMins && !clock.dismissed.includes(n.id) && !clock.started.includes(n.taskId) && !ticks[n.taskId])
    : [];

  const startTask = (task: SectionTask) => startTimer(task.id, task.cookMins ?? task.durationMins, task.title);
  const openStepper = (target: StepperTarget | null = null) => { setFocused(null); setStepper({ open: true, target }); };
  const ticked = Object.keys(ticks).filter(id => day.tasks.some(t => t.id === id)).length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', fontFamily: 'var(--font-primary)' }}>
      <FjDayStrip shopId={shopId} dates={FJ_DAY_STRIP_DATES} selectedDate={date} onSelect={d => { onDateChange(d); setFocused(null); }} />

      <div style={captionStrip}>
        <span style={{ fontWeight: 700, color: 'var(--color-text-secondary)' }}>{isToday ? 'Sections today' : `Sections ${weekdayLabel(date)} ${date}`}</span>
        <span>· opens {shop?.opensAt}, closes {shop?.closesAt}</span>
        <span>· {ticked} of {day.tasks.length} ticked</span>
        {isToday && <div style={{ marginLeft: 'auto' }}><ClockControl mins={clock.mins} playing={clock.playing} /></div>}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 8, padding: '12px 30px 0' }}>
        <button type="button" onClick={() => openStepper()} style={ghostButton} aria-label="Open stepper"><PlaySquare size={14} /> Open stepper</button>
        <button type="button" onClick={() => printSections(day, shop?.name ?? shopId, date)} style={ghostButton}><Printer size={14} /> Print</button>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 30px 12px', borderBottom: '1px solid var(--color-border-subtle)' }}>
        <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', color: 'var(--color-text-muted)' }}>Slots</span>
        {(['all', 'am', 'pm'] as SlotFilter[]).map(s => (
          <RunPill key={s} label={s === 'all' ? 'All' : s.toUpperCase()} active={slot === s} onClick={() => setSlot(s)} />
        ))}
      </div>

      <div style={{ padding: '16px 30px 48px', display: 'flex', flexDirection: 'column', gap: 16 }}>
        {liveNudges.map(n => (
          <NudgeBanner key={n.id} nudge={n} onStart={() => { const t = day.tasks.find(x => x.id === n.taskId); if (t) { startTask(t); openStepper({ sectionId: t.sectionId, slot: t.slot, taskId: t.id }); } }} onLater={() => dismissNudge(n.id)} />
        ))}

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(520px, 1fr))', gap: 16, alignItems: 'start' }}>
          {day.cards.map(card => (
            <SectionCardView
              key={card.section.id}
              card={card}
              slot={slot}
              nowMins={isToday ? clock.mins : undefined}
              ticks={ticks}
              timers={clock.timers}
              team={day.team}
              sections={day.cards.map(c => c.section)}
              onMove={move}
              onReorder={reorder}
              onPerson={setPerson}
              onOpen={setFocused}
              onPrint={() => printSections({ ...day, cards: [card] }, shop?.name ?? shopId, date)}
            />
          ))}
        </div>
      </div>

      {focusedTask && (
        <MethodPanel
          key={focusedTask.id}
          task={focusedTask}
          nowMins={isToday ? clock.mins : undefined}
          timer={clock.timers[focusedTask.id]}
          done={Boolean(ticks[focusedTask.id])}
          made={made[focusedTask.id]?.batches}
          onStart={() => startTask(focusedTask)}
          onTick={(done, batches) => tick(focusedTask.id, done, batches)}
          onMade={b => setMade(focusedTask.id, b)}
          onStepper={() => openStepper({ sectionId: focusedTask.sectionId, slot: focusedTask.slot, taskId: focusedTask.id })}
          onClose={() => setFocused(null)}
        />
      )}

      <FjStepper
        open={stepper.open}
        onClose={() => setStepper({ open: false, target: null })}
        day={day}
        date={date}
        ticks={ticks}
        onTick={tick}
        initial={stepper.target}
        live={isToday}
      />
    </div>
  );
}

// ─── Clock ────────────────────────────────────────────────────────────────────

function ClockControl({ mins, playing }: { mins: number; playing: boolean }) {
  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
      <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', color: 'var(--color-text-muted)' }}>Demo clock</span>
      <button type="button" onClick={() => clockNudge(-15)} style={iconButton} aria-label="Back 15 minutes" title="Back 15 minutes">−15</button>
      <span style={{ fontSize: 14, fontWeight: 700, fontVariantNumeric: 'tabular-nums', color: 'var(--color-text-primary)', minWidth: 44, textAlign: 'center' }}>{hhmm(mins)}</span>
      <button type="button" onClick={() => clockNudge(15)} style={iconButton} aria-label="Forward 15 minutes" title="Forward 15 minutes">+15</button>
      <button type="button" onClick={() => clockPlay(!playing)} style={{ ...iconButton, background: playing ? 'var(--color-accent-active)' : '#ffffff', color: playing ? '#fff' : 'var(--color-text-secondary)', borderColor: playing ? 'var(--color-accent-active)' : 'var(--color-border)' }} aria-label={playing ? 'Pause the clock' : 'Run the clock'} title={playing ? 'Pause' : 'Run'}>
        {playing ? <Pause size={12} /> : <Play size={12} />}
      </button>
      <button type="button" onClick={() => clockSet(11 * 60 + 35)} style={iconButton} aria-label="Jump to 11:35" title="Jump to 11:35">11:35</button>
      <button type="button" onClick={clockReset} style={iconButton} aria-label="Reset the clock" title="Reset"><RotateCcw size={12} /></button>
    </div>
  );
}

// ─── Nudge ────────────────────────────────────────────────────────────────────

function NudgeBanner({ nudge, onStart, onLater }: { nudge: Nudge; onStart: () => void; onLater: () => void }) {
  return (
    <div role="status" style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '12px 16px', background: 'var(--color-warning-light)', border: '1px solid var(--color-warning-border)', borderRadius: 'var(--radius-card)' }}>
      <span style={{ width: 32, height: 32, borderRadius: 9, background: '#ffffff', color: 'var(--color-warning)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><Zap size={16} /></span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--color-text-primary)' }}>{nudge.title}</div>
        <div style={{ fontSize: 11.5, color: 'var(--color-text-secondary)' }}>{nudge.body}</div>
      </div>
      <button type="button" onClick={onLater} style={secondaryButton}>Not now</button>
      <button type="button" onClick={onStart} style={primaryButton}><Play size={13} /> Start</button>
    </div>
  );
}

// ─── Section card (Bench card chassis) ────────────────────────────────────────

function SectionCardView({ card, slot, nowMins, ticks, timers, team, sections, onMove, onReorder, onPerson, onOpen, onPrint }: {
  card: SectionCard;
  slot: SlotFilter;
  nowMins?: number;
  ticks: Record<string, string>;
  timers: Record<string, FjTimer>;
  team: string[];
  sections: SectionCard['section'][];
  onMove: (id: string, to: string) => void;
  onReorder: (key: string, ids: string[]) => void;
  onPerson: (sectionId: string, name: string) => void;
  onOpen: (id: string) => void;
  onPrint: () => void;
}) {
  const groups: { slot: 'am' | 'pm'; rows: SectionTask[] }[] = [];
  if (slot !== 'pm') groups.push({ slot: 'am', rows: card.am });
  if (slot !== 'am') groups.push({ slot: 'pm', rows: card.pm });
  const all = [...card.am, ...card.pm];
  const done = all.filter(t => ticks[t.id]).length;
  const remaining = all.filter(t => !ticks[t.id]).reduce((n, t) => n + t.durationMins, 0);
  const amEnd = card.am.length ? Math.max(...card.am.map(t => t.startMins + t.durationMins)) : undefined;
  const pmStart = card.pm.length ? Math.min(...card.pm.map(t => t.startMins)) : undefined;

  return (
    <section style={{ background: '#ffffff', border: '1.5px solid var(--color-accent-active)', borderRadius: 'var(--radius-card)', display: 'flex', flexDirection: 'column', minWidth: 0 }}>
      <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 22px', borderBottom: '1px solid var(--color-border-subtle)', gap: 16 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 0 }}>
          <h3 style={{ fontSize: 20, fontWeight: 700, margin: 0, color: 'var(--color-text-primary)', letterSpacing: '-0.005em' }}>{card.section.name}</h3>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <SlotChip nowMins={nowMins} amEnd={amEnd} pmStart={pmStart} done={done === all.length && all.length > 0} />
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, color: 'var(--color-text-secondary)', fontVariantNumeric: 'tabular-nums' }}>
              <Clock size={12} /> {hhmm(card.startMins)} → {hhmm(card.endMins)}
            </span>
            <span style={{ fontSize: 11, color: 'var(--color-text-muted)', fontVariantNumeric: 'tabular-nums' }}>{done} of {all.length} ticked</span>
            {card.section.kit && card.section.kit.length > 0 && (
              <span style={{ fontSize: 11, color: 'var(--color-text-muted)' }} title="Kit on this bench, from the shop's settings">
                · {card.section.kit.map(k => `${k.count} ${plural(k.count, EQUIPMENT_LABELS[k.equipment].toLowerCase())}${EQUIPMENT_CAPACITY_UNIT[k.equipment] && k.capacity ? ` of ${k.capacity}` : ''}`).join(', ')}
              </span>
            )}
          </div>
          {card.section.unassigned && (
            <div style={{ fontSize: 11, color: 'var(--color-error)', fontWeight: 600 }}>No bench takes this work at this shop. Tick it on a bench under Setup, Benches.</div>
          )}
        </div>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
          <PersonChip name={card.section.person} team={team} onPick={n => onPerson(card.section.id, n)} />
          <button type="button" onClick={onPrint} aria-label={`Print ${card.section.name}`} title="Print this section" style={{ width: 32, height: 32, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', borderRadius: 8, background: '#ffffff', border: '1px solid var(--color-border-subtle)', color: 'var(--color-text-secondary)', cursor: 'pointer', flexShrink: 0 }}>
            <Printer size={15} />
          </button>
        </div>
      </header>

      {all.length === 0 && <div style={{ padding: '18px 22px', fontSize: 12, color: 'var(--color-text-muted)' }}>Nothing on this section today.</div>}

      {groups.map((g, gi) => (
        <div key={g.slot} style={{ borderTop: gi === 0 ? 'none' : '1px dashed var(--color-border-subtle)' }}>
          {g.slot === 'pm' && slot === 'all' && <SlotDivider label="PM · after 12:00" />}
          {g.rows.length > 0 && <ColumnHeader />}
          {g.rows.length === 0 && all.length > 0 && <div style={{ padding: '14px 22px', fontSize: 12, color: 'var(--color-text-muted)' }}>Nothing in the {g.slot.toUpperCase()}.</div>}
          <ReorderableRows
            rows={g.rows}
            listKey={listKey(card.section.id, g.slot)}
            onReorder={onReorder}
            rowProps={t => ({
              done: Boolean(ticks[t.id]),
              timer: timers[t.id],
              nowMins,
              sections,
              onMove: to => onMove(t.id, to),
              onOpen: () => onOpen(t.id),
            })}
          />
        </div>
      ))}

      {all.length > 0 && (
        <div style={{ padding: '16px 22px', borderTop: '1px solid var(--color-border-subtle)', background: 'var(--color-bg-hover)', display: 'flex', flexDirection: 'column', gap: 6, fontSize: 12, color: 'var(--color-text-secondary)', fontVariantNumeric: 'tabular-nums' }}>
          <TotalRow label="Hands-on time" value={fmtMins(card.totalMins)} />
          <TotalRow label="Cooker and oven time" value={fmtMins(card.passiveMins)} />
          <TotalRow label="Remaining hands-on" value={fmtMins(remaining)} />
          <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid var(--color-border-subtle)', paddingTop: 10, marginTop: 4, fontWeight: 700, color: 'var(--color-text-primary)', fontSize: 13 }}>
            <span>Total time</span><span>{fmtMins(card.totalMins + card.passiveMins)}</span>
          </div>
        </div>
      )}

      <footer style={{ padding: '14px 22px', borderTop: '1px solid var(--color-border-subtle)', display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14, fontSize: 11, color: 'var(--color-text-muted)' }}>
        <Stopwatch label="Start" value={hhmm(card.startMins)} />
        <Stopwatch label="End" value={hhmm(card.endMins)} />
        <Stopwatch label="Remaining" value={fmtMins(remaining)} muted />
      </footer>
      {nowMins !== undefined && nowMins >= card.startMins && (
        <div style={{ padding: '8px 22px', fontSize: 10, color: 'var(--color-text-muted)', borderTop: '1px dashed var(--color-border-subtle)' }}>Started · {hhmm(card.startMins)}</div>
      )}
    </section>
  );
}

function SlotChip({ nowMins, amEnd, pmStart, done }: { nowMins?: number; amEnd?: number; pmStart?: number; done: boolean }) {
  let copy: string;
  let tone: 'active' | 'upcoming' | 'done' = 'upcoming';
  if (done) { copy = 'All ticked'; tone = 'done'; }
  else if (nowMins === undefined) copy = amEnd !== undefined ? `AM · ends ${hhmm(amEnd)}` : pmStart !== undefined ? `PM · ${hhmm(pmStart)}` : 'No tasks';
  else if (amEnd !== undefined && nowMins < amEnd) { copy = `In AM · ends ${hhmm(amEnd)}`; tone = 'active'; }
  else if (pmStart !== undefined && nowMins < pmStart) copy = `Next: PM · ${hhmm(pmStart)}`;
  else if (pmStart !== undefined) { copy = 'In PM'; tone = 'active'; }
  else { copy = 'AM done'; tone = 'done'; }
  const s = tone === 'active' ? { fg: 'var(--color-success)', border: 'var(--color-success)' } : tone === 'upcoming' ? { fg: 'var(--color-text-secondary)', border: 'var(--color-border)' } : { fg: 'var(--color-text-muted)', border: 'var(--color-border-subtle)' };
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 9px', borderRadius: 999, background: '#ffffff', color: s.fg, fontSize: 10.5, fontWeight: 700, letterSpacing: '0.02em', whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums', border: `1.5px solid ${s.border}` }}>
      <Clock size={10} /> {copy}
    </span>
  );
}

function SlotDivider({ label }: { label: string }) {
  return (
    <div style={{ padding: '6px 14px', background: 'var(--color-bg-hover)', borderBottom: '1px dashed var(--color-border-subtle)', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--color-text-muted)', display: 'flex', alignItems: 'center', gap: 6 }}>
      <Clock size={11} /> {label}
    </div>
  );
}

const ROW_GRID: CSSProperties = { display: 'grid', gridTemplateColumns: 'auto 1fr auto auto auto auto', gap: 14 };

function ColumnHeader() {
  return (
    <div style={{ ...ROW_GRID, padding: '10px 22px', fontSize: 10, fontWeight: 600, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid var(--color-border-subtle)' }}>
      <span style={{ width: 16 }} />
      <span>Task</span>
      <span style={{ textAlign: 'right', minWidth: 36 }}>Qty</span>
      <span style={{ textAlign: 'right', minWidth: 56 }}>Time</span>
      <span style={{ width: 22 }} />
      <span style={{ width: 14 }} />
    </div>
  );
}

type DragProps = {
  reorderable: boolean;
  dragging: boolean;
  dragOver: boolean;
  onHandlePress: () => void;
  onHandleRelease: () => void;
  onRowDragStart: (e: DragEvent) => void;
  onRowDragEnd: () => void;
  onRowDragOver: (e: DragEvent) => void;
  onRowDrop: (e: DragEvent) => void;
};

/** Drag by the grip to reorder. Arms only from the handle so clicks and
 *  the move picker keep working. */
function ReorderableRows({ rows, listKey: key, onReorder, rowProps }: {
  rows: SectionTask[];
  listKey: string;
  onReorder: (key: string, ids: string[]) => void;
  rowProps: (task: SectionTask) => TaskRowOwnProps;
}) {
  const armed = useRef(false);
  const [dragId, setDragId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);
  const ids = rows.map(r => r.id);
  const reorderable = rows.length > 1;

  const drop = (targetId: string) => {
    const from = dragId;
    setDragId(null); setOverId(null); armed.current = false;
    if (!from || from === targetId) return;
    const fromIdx = ids.indexOf(from);
    const toIdx = ids.indexOf(targetId);
    if (fromIdx < 0 || toIdx < 0) return;
    const next = ids.filter(id => id !== from);
    next.splice(fromIdx < toIdx ? next.indexOf(targetId) + 1 : next.indexOf(targetId), 0, from);
    onReorder(key, next);
  };

  return (
    <>
      {rows.map(t => (
        <TaskRow
          key={t.id}
          task={t}
          {...rowProps(t)}
          reorderable={reorderable}
          dragging={dragId === t.id}
          dragOver={overId === t.id && dragId !== null && dragId !== t.id}
          onHandlePress={() => { armed.current = true; }}
          onHandleRelease={() => { armed.current = false; }}
          onRowDragStart={e => {
            if (!armed.current) { e.preventDefault(); return; }
            setDragId(t.id);
            e.dataTransfer.effectAllowed = 'move';
            try { e.dataTransfer.setData('text/plain', t.id); } catch { /* jsdom */ }
          }}
          onRowDragEnd={() => { setDragId(null); setOverId(null); armed.current = false; }}
          onRowDragOver={e => { if (dragId) { e.preventDefault(); setOverId(t.id); } }}
          onRowDrop={e => { e.preventDefault(); drop(t.id); }}
        />
      ))}
    </>
  );
}

type TaskRowOwnProps = {
  done: boolean;
  timer?: FjTimer;
  nowMins?: number;
  sections: SectionCard['section'][];
  onMove: (to: string) => void;
  onOpen: () => void;
};

function TaskRow({ task, done, timer, nowMins, sections, onMove, onOpen, reorderable, dragging, dragOver, onHandlePress, onHandleRelease, onRowDragStart, onRowDragEnd, onRowDragOver, onRowDrop }: { task: SectionTask } & TaskRowOwnProps & DragProps) {
  const late = nowMins !== undefined && !done && !timer && nowMins > task.startMins + 10;
  const remaining = timer && nowMins !== undefined ? timerRemaining(timer, nowMins) : undefined;
  const cooking = remaining !== undefined && remaining > 0;
  const ready = remaining !== undefined && remaining === 0 && !done;
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpen(); } }}
      draggable={reorderable}
      onDragStart={onRowDragStart}
      onDragEnd={onRowDragEnd}
      onDragOver={onRowDragOver}
      onDrop={onRowDrop}
      style={{
        ...ROW_GRID, alignItems: 'center', padding: '14px 22px', fontSize: 13, color: 'var(--color-text-primary)',
        background: dragOver ? 'var(--color-bg-hover)' : ready ? 'var(--color-success-light, #eef8f1)' : '#ffffff',
        borderBottom: '1px solid var(--color-border-subtle)',
        borderTop: dragOver ? '2px solid var(--color-accent-active)' : '2px solid transparent',
        borderLeft: `3px solid ${cooking ? 'var(--color-info)' : late ? 'var(--color-warning)' : 'transparent'}`,
        cursor: 'pointer', opacity: dragging ? 0.4 : done ? 0.5 : 1, transition: 'opacity 120ms ease, background 120ms ease',
      }}
    >
      {done ? (
        <span aria-label="Ticked" style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 16, color: 'var(--color-success)' }}><Check size={14} /></span>
      ) : (
        <span aria-hidden title={reorderable ? 'Drag to reorder' : undefined} onMouseDown={reorderable ? onHandlePress : undefined} onMouseUp={reorderable ? onHandleRelease : undefined} onClick={e => e.stopPropagation()}
          style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 16, color: 'var(--color-text-muted)', cursor: reorderable ? 'grab' : 'default', opacity: reorderable ? 0.6 : 0, touchAction: 'none' }}>
          <GripVertical size={14} />
        </span>
      )}
      <span style={{ minWidth: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontWeight: 500, fontSize: 13.5, textDecoration: done ? 'line-through' : 'none' }}>
        {task.title}
        {task.load && <span style={{ color: 'var(--color-text-muted)', fontWeight: 500, marginLeft: 8, fontSize: 12 }}>load {task.load.n} of {task.load.of}</span>}
      </span>
      <span style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'flex-end', fontVariantNumeric: 'tabular-nums', lineHeight: 1.1, whiteSpace: 'nowrap' }}>
        <span style={{ fontWeight: 700 }}>{task.qty}</span>
        {task.containers && <span style={{ fontSize: 9.5, fontWeight: 600, color: 'var(--color-text-muted)', marginTop: 2 }}>{task.containers}</span>}
      </span>
      <span style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'flex-end', minWidth: 56, fontVariantNumeric: 'tabular-nums', lineHeight: 1.1 }}>
        <span style={{ color: late ? 'var(--color-warning)' : 'var(--color-text-secondary)', fontWeight: task.timed ? 700 : 500 }}>{hhmm(task.startMins)}</span>
        {cooking ? (
          <span style={{ fontSize: 9.5, fontWeight: 700, color: 'var(--color-info)', display: 'inline-flex', alignItems: 'center', gap: 3, marginTop: 2 }}><Timer size={9} /> {remaining} min</span>
        ) : ready ? (
          <span style={{ fontSize: 9.5, fontWeight: 700, color: 'var(--color-success)', marginTop: 2 }}>ready</span>
        ) : task.readyMins ? (
          <span style={{ fontSize: 9.5, color: 'var(--color-text-muted)', marginTop: 2 }}>ready {hhmm(task.readyMins)}</span>
        ) : (
          <span style={{ fontSize: 9.5, color: 'var(--color-text-muted)', marginTop: 2 }}>{task.durationMins} min</span>
        )}
      </span>
      <MoveButton current={task.sectionId} sections={sections} onMove={onMove} />
      <ChevronRight size={14} color="var(--color-text-muted)" style={{ opacity: 0.4 }} />
    </div>
  );
}

// ─── Pickers ──────────────────────────────────────────────────────────────────

function usePopover() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDoc); document.removeEventListener('keydown', onKey); };
  }, [open]);
  return { open, setOpen, ref };
}

function PersonChip({ name, team, onPick }: { name: string; team: string[]; onPick: (n: string) => void }) {
  const { open, setOpen, ref } = usePopover();
  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button type="button" onClick={() => setOpen(o => !o)} aria-haspopup="listbox" aria-expanded={open} title={`${name} · click to change`} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '5px 10px', borderRadius: 999, background: '#ffffff', color: 'var(--color-info)', fontSize: 11.5, fontWeight: 600, whiteSpace: 'nowrap', border: '1.5px solid var(--color-info)', cursor: 'pointer', fontFamily: 'var(--font-primary)' }}>
        <User size={12} /> {name}
      </button>
      {open && (
        <div role="listbox" aria-label="Who is on this section" style={{ ...popover, right: 0, left: 'auto' }}>
          {team.map(n => (
            <button key={n} type="button" role="option" aria-selected={n === name} onClick={() => { onPick(n); setOpen(false); }} style={{ ...popoverItem, fontWeight: n === name ? 700 : 500 }}>{n}</button>
          ))}
        </div>
      )}
    </div>
  );
}

function MoveButton({ current, sections, onMove }: { current: string; sections: SectionCard['section'][]; onMove: (to: string) => void }) {
  const { open, setOpen, ref } = usePopover();
  return (
    <div ref={ref} style={{ position: 'relative', display: 'inline-flex' }} onClick={e => e.stopPropagation()}>
      <button type="button" onClick={() => setOpen(o => !o)} aria-label="Move to another section" title="Move to another section" style={{ width: 22, height: 22, borderRadius: 6, border: '1px solid var(--color-border-subtle)', background: '#ffffff', color: 'var(--color-text-muted)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', padding: 0 }}>
        <ArrowRightLeft size={11} />
      </button>
      {open && (
        <div role="menu" style={{ ...popover, right: 0, left: 'auto' }}>
          {sections.filter(s => s.id !== current).map(s => (
            <button key={s.id} type="button" role="menuitem" onClick={() => { onMove(s.id); setOpen(false); }} style={popoverItem}>
              {s.name} <span style={{ color: 'var(--color-text-muted)', fontWeight: 500 }}>· {s.person}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Method card (manager's quick look from the board) ────────────────────────

function MethodPanel({ task, nowMins, timer, done, made, onStart, onTick, onMade, onStepper, onClose }: {
  task: SectionTask;
  nowMins?: number;
  timer?: FjTimer;
  done: boolean;
  /** Batches recorded as made, once ticked. */
  made?: number;
  onStart: () => void;
  onTick: (done: boolean, madeBatches?: number) => void;
  onMade: (batches: number) => void;
  onStepper: () => void;
  onClose: () => void;
}) {
  const [draftMade, setDraftMade] = useState<number | undefined>(undefined);
  if (typeof window === 'undefined') return null;
  const comp = task.componentId ? COMPONENTS[task.componentId] : undefined;
  const batches = task.batches ?? 1;
  // What goes on the record: the saved figure when ticked, else the draft, else the plan.
  const madeNow = done ? (made ?? task.batches ?? 0) : (draftMade ?? task.batches ?? 0);
  const step = comp?.batch.halfG ? 0.5 : 1;
  const setMadeNow = (n: number) => { const v = Math.max(0, Math.round(n * 2) / 2); if (done) onMade(v); else setDraftMade(v); };
  const remaining = timer && nowMins !== undefined ? timerRemaining(timer, nowMins) : undefined;
  const steps = stepsForTask(task);
  const group = comp ? SHELF_LIFE_GROUPS[comp.shelfLife] : undefined;
  const batchLabel = batches === 0.5 ? 'Half batch' : batches === 1 ? 'One batch' : `${batches % 1 === 0 ? batches : batches.toFixed(1)} batches`;

  return createPortal(
    <div style={{ position: 'fixed', inset: 0, zIndex: 200, display: 'flex', justifyContent: 'flex-end', background: 'rgba(15, 23, 32, 0.18)' }} onClick={onClose}>
      <aside role="dialog" aria-label={`${task.title} method`} onClick={e => e.stopPropagation()} style={{ width: 'min(520px, 100vw)', height: '100%', background: '#ffffff', borderLeft: '1px solid var(--color-border)', boxShadow: '-12px 0 36px rgba(10, 20, 25, 0.18)', display: 'flex', flexDirection: 'column', fontFamily: 'var(--font-primary)', overflow: 'hidden' }}>
        <div style={{ flexShrink: 0, padding: '14px 18px', borderBottom: '1px solid var(--color-border-subtle)', display: 'flex', alignItems: 'flex-start', gap: 12, background: 'var(--color-bg-surface)' }}>
          <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
            <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--color-text-muted)' }}>{task.slot.toUpperCase()} · {hhmm(task.startMins)}{comp?.htcCode ? ` · ${comp.htcCode}` : ''}</span>
            <h2 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: 'var(--color-text-primary)' }}>{task.title}{task.load ? ` · load ${task.load.n} of ${task.load.of}` : ''}</h2>
            <div style={{ display: 'flex', gap: 6, marginTop: 4, alignItems: 'center', flexWrap: 'wrap' }}>
              <StatusPill tone="info" size="xs" label={task.qty} />
              {comp && !/batch/.test(task.qty) && <StatusPill tone="neutral" size="xs" label={batchLabel} />}
              {group && <StatusPill tone="neutral" size="xs" label={group.label} />}
              {comp?.holdMinutes && <StatusPill tone="neutral" size="xs" label={`${comp.holdMinutes / 60}h hold`} />}
              {done && <StatusPill tone="success" size="xs" label="Done" />}
            </div>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" style={closeButton}><X size={14} /></button>
        </div>

        <div style={{ flex: 1, minHeight: 0, overflow: 'auto', padding: '16px 18px 32px', display: 'flex', flexDirection: 'column', gap: 18 }}>
          {task.detail && <div style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>{task.detail}</div>}

          {comp?.cook && (
            <Block icon={<Flame size={13} />} title="Cook">
              <Pair label="Programme" value={comp.cook.programme} />
              <Pair label="Time" value={Array.isArray(comp.cook.minutes) ? `${comp.cook.minutes[0]} to ${comp.cook.minutes[1]} min` : `${comp.cook.minutes} min`} />
              {comp.cook.coreTempC && <Pair label="Core temperature" value={`${comp.cook.coreTempC}°C minimum`} />}
              {comp.restMinutes && <Pair label="Rest" value={`${comp.restMinutes} min`} />}
              {task.readyMins && <Pair label="Ready for the line" value={hhmm(task.readyMins)} bold />}
            </Block>
          )}

          {comp && comp.equipment && comp.equipment.length > 0 && (
            <Block icon={<Thermometer size={13} />} title="Equipment">
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {comp.equipment.map(e => <StatusPill key={e} tone="neutral" size="xs" label={e} />)}
              </div>
            </Block>
          )}

          {steps.length > 0 && (
            <Block icon={<Check size={13} />} title="Method">
              <ol style={{ margin: 0, paddingLeft: 22, display: 'flex', flexDirection: 'column', gap: 8 }}>
                {steps.map((s, i) => <li key={i} style={{ fontSize: 13, color: 'var(--color-text-primary)', lineHeight: 1.45 }}>{s}</li>)}
              </ol>
            </Block>
          )}

          {comp?.container && comp.containersPerBatch && (
            <Block icon={<Clock size={13} />} title="Container and label">
              <Pair label="Into" value={`${Math.ceil(batches * comp.containersPerBatch)} ${plural(Math.ceil(batches * comp.containersPerBatch), CONTAINERS[comp.container].name.toLowerCase())}`} />
              {group && <Pair label="Use by" value={group.days === 1 ? 'Today' : `${group.days - 1} days from today`} />}
            </Block>
          )}
        </div>

        <div style={{ flexShrink: 0, padding: '12px 18px', borderTop: '1px solid var(--color-border-subtle)', display: 'flex', gap: 8, alignItems: 'center', background: 'var(--color-bg-surface)' }}>
          {timer && remaining !== undefined ? (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 700, color: remaining > 0 ? 'var(--color-info)' : 'var(--color-success)', fontVariantNumeric: 'tabular-nums' }}>
              <Timer size={14} /> {remaining > 0 ? `${remaining} min left` : 'Ready'}
              <button type="button" onClick={() => clearTimer(task.id)} style={{ ...linkButton, marginLeft: 6 }}>clear</button>
            </span>
          ) : (
            <button type="button" onClick={onStart} style={secondaryButton} disabled={done || nowMins === undefined}>
              <Play size={13} /> Start{task.cookMins ? ` · ${task.cookMins} min` : ''}
            </button>
          )}
          <button type="button" onClick={onStepper} style={secondaryButton}><PlaySquare size={13} /> Stepper</button>
          <div style={{ flex: 1 }} />
          {task.batches !== undefined && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }} aria-label="Batches made">
              <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', color: 'var(--color-text-muted)' }}>Made</span>
              <button type="button" aria-label="Fewer batches made" onClick={() => setMadeNow(madeNow - step)} disabled={madeNow <= 0} style={stepButton}>−</button>
              <span style={{ minWidth: 30, textAlign: 'center', fontSize: 13, fontWeight: 700, fontVariantNumeric: 'tabular-nums', color: madeNow !== (task.batches ?? 0) ? 'var(--color-warning)' : 'var(--color-text-primary)' }}>{madeNow % 1 === 0 ? madeNow : madeNow.toFixed(1).replace('.5', '½')}</span>
              <button type="button" aria-label="More batches made" onClick={() => setMadeNow(madeNow + step)} style={stepButton}>+</button>
            </div>
          )}
          <button type="button" onClick={() => onTick(!done, done ? undefined : madeNow)} style={done ? secondaryButton : primaryButton}>
            <Check size={13} /> {done ? 'Untick' : 'Tick done'}
          </button>
        </div>
      </aside>
    </div>,
    document.body,
  );
}

// ─── Print ────────────────────────────────────────────────────────────────────

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function printSections(day: SectionsDay, shopName: string, date: string) {
  const w = window.open('', '_blank', 'width=900,height=1000');
  if (!w) return;
  const rows = (tasks: SectionTask[]) => tasks.map(t => `
    <tr><td class="tick">☐</td><td>${esc(t.title)}${t.load ? ` <span class="sub">load ${t.load.n} of ${t.load.of}</span>` : ''}${t.detail ? `<div class="sub">${esc(t.detail)}</div>` : ''}</td><td class="r"><strong>${esc(t.qty)}</strong></td><td class="r">${hhmm(t.startMins)}${t.readyMins ? `<div class="sub">ready ${hhmm(t.readyMins)}</div>` : ''}</td></tr>`).join('');
  const body = day.cards.map(c => `
    <section class="page">
      <h2>${esc(c.section.name)} <span class="meta">${esc(c.section.person)} · ${hhmm(c.startMins)} to ${hhmm(c.endMins)} · ${fmtMins(c.totalMins)} hands-on</span></h2>
      <h3>AM</h3><table><tbody>${rows(c.am) || '<tr><td colspan="4" class="sub">Nothing in the AM.</td></tr>'}</tbody></table>
      <h3>PM</h3><table><tbody>${rows(c.pm) || '<tr><td colspan="4" class="sub">Nothing in the PM.</td></tr>'}</tbody></table>
    </section>`).join('');
  w.document.write(`<!doctype html><html><head><title>Sections · ${esc(shopName)} · ${esc(longDate(date))}</title>
    <style>
      body{font-family:-apple-system,Helvetica,Arial,sans-serif;color:#111;margin:24px;font-size:12px}
      h1{font-size:18px;margin:0 0 2px} .top{color:#666;margin-bottom:18px}
      .page{break-after:page;margin-bottom:24px} h2{font-size:15px;margin:0 0 8px;border-bottom:2px solid #111;padding-bottom:4px}
      h3{font-size:10px;text-transform:uppercase;letter-spacing:.05em;color:#666;margin:14px 0 4px}
      .meta{font-weight:400;color:#666;font-size:11px;margin-left:8px}
      table{width:100%;border-collapse:collapse} td{padding:6px;border-bottom:1px solid #e5e5e5;vertical-align:top} .r{text-align:right;white-space:nowrap} .sub{font-size:10px;color:#666} .tick{width:18px;font-size:14px}
      @media print{body{margin:12mm}}
    </style></head><body>
    <h1>Sections · ${esc(shopName)}</h1><div class="top">${esc(longDate(date))}</div>${body}
    <script>window.onload=function(){window.print();}</script></body></html>`);
  w.document.close();
}

// ─── Small bits ───────────────────────────────────────────────────────────────

function RunPill({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button type="button" role="tab" aria-selected={active} onClick={onClick} style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', minWidth: 32, height: 26, padding: '0 10px', borderRadius: 999, fontSize: 11, fontWeight: 700, fontFamily: 'var(--font-primary)', cursor: 'pointer', background: active ? 'var(--color-accent-active)' : '#ffffff', color: active ? '#ffffff' : 'var(--color-text-secondary)', border: `1px solid ${active ? 'var(--color-accent-active)' : 'var(--color-border)'}` }}>
      {label}
    </button>
  );
}

function TotalRow({ label, value }: { label: string; value: string }) {
  return <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>{label}</span><span>{value}</span></div>;
}

function Stopwatch({ label, value, muted }: { label: string; value: string; muted?: boolean }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      <span style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--color-text-muted)' }}>{label}</span>
      <span style={{ fontSize: 13, fontWeight: 600, color: muted ? 'var(--color-text-muted)' : 'var(--color-text-primary)', fontVariantNumeric: 'tabular-nums' }}>{value}</span>
    </div>
  );
}

function Block({ icon, title, children }: { icon: ReactNode; title: string; children: ReactNode }) {
  return (
    <section style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 6, fontSize: 10, fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', color: 'var(--color-text-muted)' }}>{icon} {title}</h3>
      {children}
    </section>
  );
}

function Pair({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, fontSize: 12.5 }}>
      <span style={{ color: 'var(--color-text-secondary)' }}>{label}</span>
      <span style={{ fontWeight: bold ? 700 : 600, color: 'var(--color-text-primary)', fontVariantNumeric: 'tabular-nums', textAlign: 'right' }}>{value}</span>
    </div>
  );
}

export function fmtMins(m: number): string {
  const h = Math.floor(m / 60);
  const r = Math.round(m % 60);
  return h ? `${h}h ${String(r).padStart(2, '0')}m` : `${r} min`;
}

const captionStrip: CSSProperties = { padding: '8px 30px', background: 'var(--color-bg-surface)', borderBottom: '1px solid var(--color-border-subtle)', display: 'flex', alignItems: 'center', gap: 8, fontSize: 11, color: 'var(--color-text-muted)', flexWrap: 'wrap' };
const iconButton: CSSProperties = { height: 26, minWidth: 26, padding: '0 7px', borderRadius: 7, border: '1px solid var(--color-border)', background: '#ffffff', color: 'var(--color-text-secondary)', fontSize: 10.5, fontWeight: 700, fontFamily: 'var(--font-primary)', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontVariantNumeric: 'tabular-nums' };
const ghostButton: CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 8, fontSize: 12, fontWeight: 600, fontFamily: 'var(--font-primary)', background: '#ffffff', color: 'var(--color-text-secondary)', border: '1px solid var(--color-border)', cursor: 'pointer', whiteSpace: 'nowrap' };
const secondaryButton: CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: 6, flexShrink: 0, minHeight: 36, padding: '8px 14px', borderRadius: 8, fontSize: 12, fontWeight: 600, fontFamily: 'var(--font-primary)', background: '#ffffff', color: 'var(--color-text-primary)', border: '1px solid var(--color-border)', cursor: 'pointer', whiteSpace: 'nowrap' };
const primaryButton: CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: 6, flexShrink: 0, minHeight: 36, padding: '8px 14px', borderRadius: 8, fontSize: 12, fontWeight: 700, fontFamily: 'var(--font-primary)', background: 'var(--color-accent-active)', color: 'var(--color-text-on-active, #fff)', border: '1px solid var(--color-accent-active)', cursor: 'pointer', whiteSpace: 'nowrap' };
const closeButton: CSSProperties = { width: 32, height: 32, borderRadius: 8, border: '1px solid var(--color-border-subtle)', background: '#ffffff', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-text-secondary)', flexShrink: 0 };
const linkButton: CSSProperties = { background: 'none', border: 'none', padding: 0, color: 'var(--color-link)', fontWeight: 700, fontSize: 11, cursor: 'pointer', fontFamily: 'var(--font-primary)', textDecoration: 'underline' };
const stepButton: CSSProperties = { width: 28, height: 28, borderRadius: 6, border: '1px solid var(--color-border)', background: '#ffffff', cursor: 'pointer', fontSize: 14, fontWeight: 700, color: 'var(--color-text-primary)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--font-primary)' };
const popover: CSSProperties = { position: 'absolute', top: 'calc(100% + 6px)', left: 0, zIndex: 60, minWidth: 200, background: '#ffffff', border: '1px solid var(--color-border)', borderRadius: 10, boxShadow: '0 12px 32px rgba(10, 20, 25, 0.18)', padding: 4, display: 'flex', flexDirection: 'column', gap: 2 };
const popoverItem: CSSProperties = { display: 'flex', alignItems: 'center', gap: 6, padding: '8px 10px', background: 'transparent', border: 'none', borderRadius: 6, textAlign: 'left', cursor: 'pointer', fontFamily: 'var(--font-primary)', color: 'var(--color-text-primary)', fontSize: 12.5, whiteSpace: 'nowrap' };
