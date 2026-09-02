'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { ArrowRightLeft, Check, ChevronRight, Clock, Flame, Pause, Play, Printer, RotateCcw, Thermometer, Timer, User, X, Zap } from 'lucide-react';
import { useActiveSite } from '@/components/ActiveSite/ActiveSiteContext';
import StatusPill from '@/components/Production/StatusPill';
import { FJ_DAY_STRIP_DATES, FJ_DEMO_TODAY, longDate, weekdayLabel } from './calendar';
import { FjDayStrip, Notice } from './DayPlan';
import { useFjPlanStore } from './FjPlanStore';
import { clearTimer, clockNudge, clockPlay, clockReset, clockSet, dismissNudge, hhmm, startTimer, timerRemaining, useFjClock } from './fjClock';
import { computeSectionsDay, plural, scaleStep, type Nudge, type SectionCard, type SectionTask, type SectionsDay } from './sections';
import { COMPONENTS, CONTAINERS, SHELF_LIFE_GROUPS, type Section as SectionId } from './recipes';
import { FJ_ALL_SHOPS_ID, getShop } from './shops';

/**
 * Sections. Built on the Pret Benches board: one card per section with the
 * person on it, task rows with quantity and time, hands-on totals and the
 * start/end window in the footer. Farmer J differences: AM and PM instead
 * of runs, a tick on every row, cook loads timed off the sales curve, and
 * a simulated clock so timing prompts can be shown landing.
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
  const tick = useCallback(
    (taskId: string, done: boolean) =>
      store.update(shopId, date, r => {
        const ticks = { ...(r.ticks ?? {}) };
        if (done) ticks[taskId] = new Date().toISOString(); else delete ticks[taskId];
        return { ...r, ticks };
      }),
    [store, shopId, date],
  );
  const move = useCallback(
    (taskId: string, sectionId: SectionId) => store.update(shopId, date, r => ({ ...r, reassigned: { ...(r.reassigned ?? {}), [taskId]: sectionId } })),
    [store, shopId, date],
  );
  const setPerson = useCallback(
    (sectionId: SectionId, name: string) => store.update(shopId, date, r => ({ ...r, people: { ...(r.people ?? {}), [sectionId]: name } })),
    [store, shopId, date],
  );
  return { day, ticks: record.ticks ?? {}, tick, move, setPerson };
}

function SectionsForShop({ shopId, date, onDateChange }: { shopId: string; date: string; onDateChange: (d: string) => void }) {
  const shop = getShop(shopId);
  const { day, ticks, tick, move, setPerson } = useSectionsDay(shopId, date);
  const clock = useFjClock();
  const [slot, setSlot] = useState<SlotFilter>('all');
  const [focused, setFocused] = useState<string | null>(null);
  const isToday = date === FJ_DEMO_TODAY;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setFocused(null); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // Stop the clock when leaving the screen so it is not still running on
  // the way back.
  useEffect(() => () => clockPlay(false), []);

  const focusedTask = focused ? day.tasks.find(t => t.id === focused) : undefined;
  const liveNudges = isToday
    ? day.nudges.filter(n => clock.mins >= n.atMins && !clock.dismissed.includes(n.id) && !clock.started.includes(n.taskId) && !ticks[n.taskId])
    : [];

  const startTask = (task: SectionTask) => {
    if (task.cookMins) startTimer(task.id, task.cookMins + 0, `${task.title}`);
    else startTimer(task.id, task.durationMins, task.title);
  };

  const printAll = () => printSections(day, shop?.name ?? shopId, date);
  const tasksShown = day.cards.reduce((n, c) => n + (slot === 'pm' ? 0 : c.am.length) + (slot === 'am' ? 0 : c.pm.length), 0);
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

      <div style={{ padding: '14px 30px 48px', display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', color: 'var(--color-text-muted)' }}>Slots</span>
          {(['all', 'am', 'pm'] as SlotFilter[]).map(s => (
            <RunPill key={s} label={s === 'all' ? 'All' : s.toUpperCase()} active={slot === s} onClick={() => setSlot(s)} count={s === 'all' ? day.tasks.length : day.tasks.filter(t => t.slot === s).length} />
          ))}
          <span style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>{tasksShown} tasks</span>
          <div style={{ marginLeft: 'auto' }}>
            <button type="button" onClick={printAll} style={secondaryButton} title="Print every section, one per page">
              <Printer size={14} /> Print sections
            </button>
          </div>
        </div>

        {liveNudges.map(n => (
          <NudgeBanner key={n.id} nudge={n} onStart={() => { const t = day.tasks.find(x => x.id === n.taskId); if (t) { startTask(t); setFocused(t.id); } }} onLater={() => dismissNudge(n.id)} />
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
              onTick={tick}
              onMove={move}
              onPerson={setPerson}
              onOpen={setFocused}
            />
          ))}
        </div>
      </div>

      {focusedTask && (
        <MethodPanel
          task={focusedTask}
          nowMins={isToday ? clock.mins : undefined}
          timer={clock.timers[focusedTask.id]}
          done={Boolean(ticks[focusedTask.id])}
          onStart={() => startTask(focusedTask)}
          onTick={done => tick(focusedTask.id, done)}
          onClose={() => setFocused(null)}
        />
      )}
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

function SectionCardView({ card, slot, nowMins, ticks, timers, team, sections, onTick, onMove, onPerson, onOpen }: {
  card: SectionCard;
  slot: SlotFilter;
  nowMins?: number;
  ticks: Record<string, string>;
  timers: ReturnType<typeof useFjClock>['timers'];
  team: string[];
  sections: SectionCard['section'][];
  onTick: (id: string, done: boolean) => void;
  onMove: (id: string, to: SectionId) => void;
  onPerson: (sectionId: SectionId, name: string) => void;
  onOpen: (id: string) => void;
}) {
  const groups: { label: 'AM' | 'PM'; rows: SectionTask[] }[] = [];
  if (slot !== 'pm') groups.push({ label: 'AM', rows: card.am });
  if (slot !== 'am') groups.push({ label: 'PM', rows: card.pm });
  const all = [...card.am, ...card.pm];
  const done = all.filter(t => ticks[t.id]).length;
  const remaining = all.filter(t => !ticks[t.id]).reduce((n, t) => n + t.durationMins, 0);
  const next = nowMins !== undefined ? all.find(t => !ticks[t.id] && t.startMins >= nowMins - 5) : undefined;

  return (
    <section style={{ background: '#ffffff', border: '1.5px solid var(--color-accent-active)', borderRadius: 'var(--radius-card)', display: 'flex', flexDirection: 'column', minWidth: 0 }}>
      <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px 22px', borderBottom: '1px solid var(--color-border-subtle)', gap: 16 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 0 }}>
          <h3 style={{ fontSize: 20, fontWeight: 700, margin: 0, color: 'var(--color-text-primary)', letterSpacing: '-0.005em' }}>{card.section.name}</h3>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <StatusPill tone="neutral" size="xs" label={`${done} of ${all.length} ticked`} />
            {next && (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, color: 'var(--color-text-secondary)', fontVariantNumeric: 'tabular-nums' }}>
                <Clock size={12} /> next {hhmm(next.startMins)} · {next.title}
              </span>
            )}
          </div>
        </div>
        <PersonChip name={card.section.person} team={team} onPick={n => onPerson(card.section.id, n)} />
      </header>

      <div style={{ display: 'grid', gridTemplateColumns: '22px 1fr auto auto 22px 14px', gap: 12, padding: '8px 22px', fontSize: 10, fontWeight: 600, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid var(--color-border-subtle)' }}>
        <span />
        <span>Task</span>
        <span style={{ textAlign: 'right', minWidth: 90 }}>Qty</span>
        <span style={{ textAlign: 'right', minWidth: 56 }}>Time</span>
        <span />
        <span />
      </div>

      {groups.map(g => (
        <div key={g.label}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 22px', background: 'var(--color-bg-hover)', borderBottom: '1px solid var(--color-border-subtle)' }}>
            <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.05em', color: 'var(--color-text-secondary)' }}>{g.label}</span>
            <span style={{ fontSize: 10, color: 'var(--color-text-muted)' }}>{g.rows.length} {g.rows.length === 1 ? 'task' : 'tasks'}</span>
          </div>
          {g.rows.length === 0 && <div style={{ padding: '12px 22px', fontSize: 12, color: 'var(--color-text-muted)' }}>Nothing in the {g.label}.</div>}
          {g.rows.map(t => (
            <TaskRow
              key={t.id}
              task={t}
              done={Boolean(ticks[t.id])}
              timer={timers[t.id]}
              nowMins={nowMins}
              sections={sections}
              onTick={d => onTick(t.id, d)}
              onMove={to => onMove(t.id, to)}
              onOpen={() => onOpen(t.id)}
            />
          ))}
        </div>
      ))}

      <div style={{ padding: '14px 22px', borderTop: '1px solid var(--color-border-subtle)', background: 'var(--color-bg-hover)', display: 'flex', flexDirection: 'column', gap: 6, fontSize: 12, color: 'var(--color-text-secondary)', fontVariantNumeric: 'tabular-nums' }}>
        <TotalRow label="Hands-on time" value={fmtMins(card.totalMins)} />
        <TotalRow label="Remaining" value={fmtMins(remaining)} />
      </div>
      <footer style={{ padding: '12px 22px', borderTop: '1px solid var(--color-border-subtle)', display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14, fontSize: 11, color: 'var(--color-text-muted)' }}>
        <Stopwatch label="Start" value={hhmm(card.startMins)} />
        <Stopwatch label="End" value={hhmm(card.endMins)} />
        <Stopwatch label="Now" value={nowMins !== undefined ? hhmm(nowMins) : '—'} muted />
      </footer>
    </section>
  );
}

function TaskRow({ task, done, timer, nowMins, sections, onTick, onMove, onOpen }: {
  task: SectionTask;
  done: boolean;
  timer?: ReturnType<typeof useFjClock>['timers'][string];
  nowMins?: number;
  sections: SectionCard['section'][];
  onTick: (done: boolean) => void;
  onMove: (to: SectionId) => void;
  onOpen: () => void;
}) {
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
      style={{ display: 'grid', gridTemplateColumns: '22px 1fr auto auto 22px 14px', gap: 12, alignItems: 'center', padding: '11px 22px', fontSize: 13, color: 'var(--color-text-primary)', background: ready ? 'var(--color-success-light, #eef8f1)' : '#ffffff', borderBottom: '1px solid var(--color-border-subtle)', borderLeft: `3px solid ${cooking ? 'var(--color-info)' : late ? 'var(--color-warning)' : 'transparent'}`, cursor: 'pointer', opacity: done ? 0.55 : 1 }}
    >
      <button
        type="button"
        onClick={e => { e.stopPropagation(); onTick(!done); }}
        aria-label={done ? `Untick ${task.title}` : `Tick ${task.title}`}
        aria-pressed={done}
        style={{ width: 20, height: 20, borderRadius: 6, border: `1.5px solid ${done ? 'var(--color-success)' : 'var(--color-border)'}`, background: done ? 'var(--color-success)' : '#ffffff', color: '#fff', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', padding: 0 }}
      >
        {done && <Check size={12} />}
      </button>
      <span style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
        <span style={{ fontWeight: 500, fontSize: 13.5, textDecoration: done ? 'line-through' : 'none', lineHeight: 1.25 }}>{task.title}</span>
        {task.detail && <span style={{ fontSize: 10.5, color: 'var(--color-text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{task.detail}</span>}
      </span>
      <span style={{ textAlign: 'right', fontWeight: 700, fontVariantNumeric: 'tabular-nums', minWidth: 90, whiteSpace: 'nowrap' }}>{task.qty}</span>
      <span style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'flex-end', minWidth: 56, fontVariantNumeric: 'tabular-nums', lineHeight: 1.15 }}>
        <span style={{ color: late ? 'var(--color-warning)' : 'var(--color-text-secondary)', fontWeight: task.timed ? 700 : 500 }}>{hhmm(task.startMins)}</span>
        {cooking ? (
          <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--color-info)', display: 'inline-flex', alignItems: 'center', gap: 3 }}><Timer size={9} /> {remaining} min</span>
        ) : ready ? (
          <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--color-success)' }}>ready</span>
        ) : task.readyMins ? (
          <span style={{ fontSize: 10, color: 'var(--color-text-muted)' }}>ready {hhmm(task.readyMins)}</span>
        ) : (
          <span style={{ fontSize: 10, color: 'var(--color-text-muted)' }}>{task.durationMins} min</span>
        )}
      </span>
      <MoveButton current={task.sectionId} sections={sections} onMove={onMove} />
      <ChevronRight size={14} color="var(--color-text-muted)" style={{ opacity: 0.5 }} />
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
      <button type="button" onClick={() => setOpen(o => !o)} aria-haspopup="listbox" aria-expanded={open} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '5px 10px', borderRadius: 999, background: '#ffffff', color: 'var(--color-info)', fontSize: 11.5, fontWeight: 600, whiteSpace: 'nowrap', border: '1.5px solid var(--color-info)', cursor: 'pointer', fontFamily: 'var(--font-primary)' }}>
        <User size={12} /> {name}
      </button>
      {open && (
        <div role="listbox" aria-label="Who is on this section" style={popover}>
          {team.map(n => (
            <button key={n} type="button" role="option" aria-selected={n === name} onClick={() => { onPick(n); setOpen(false); }} style={{ ...popoverItem, fontWeight: n === name ? 700 : 500 }}>{n}</button>
          ))}
        </div>
      )}
    </div>
  );
}

function MoveButton({ current, sections, onMove }: { current: SectionId; sections: SectionCard['section'][]; onMove: (to: SectionId) => void }) {
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

// ─── Method card ──────────────────────────────────────────────────────────────

function MethodPanel({ task, nowMins, timer, done, onStart, onTick, onClose }: {
  task: SectionTask;
  nowMins?: number;
  timer?: ReturnType<typeof useFjClock>['timers'][string];
  done: boolean;
  onStart: () => void;
  onTick: (done: boolean) => void;
  onClose: () => void;
}) {
  if (typeof window === 'undefined') return null;
  const comp = task.componentId ? COMPONENTS[task.componentId] : undefined;
  const batches = task.batches ?? 1;
  const remaining = timer && nowMins !== undefined ? timerRemaining(timer, nowMins) : undefined;
  const steps = comp?.steps?.map(s => scaleStep(s, batches)) ?? [];
  const group = comp ? SHELF_LIFE_GROUPS[comp.shelfLife] : undefined;
  const batchLabel = batches === 0.5 ? 'Half batch' : batches === 1 ? 'One batch' : `${batches % 1 === 0 ? batches : batches.toFixed(1)} batches`;

  return createPortal(
    <div style={{ position: 'fixed', inset: 0, zIndex: 200, display: 'flex', justifyContent: 'flex-end', background: 'rgba(15, 23, 32, 0.18)' }} onClick={onClose}>
      <aside role="dialog" aria-label={`${task.title} method`} onClick={e => e.stopPropagation()} style={{ width: 'min(520px, 100vw)', height: '100%', background: '#ffffff', borderLeft: '1px solid var(--color-border)', boxShadow: '-12px 0 36px rgba(10, 20, 25, 0.18)', display: 'flex', flexDirection: 'column', fontFamily: 'var(--font-primary)', overflow: 'hidden' }}>
        <div style={{ flexShrink: 0, padding: '14px 18px', borderBottom: '1px solid var(--color-border-subtle)', display: 'flex', alignItems: 'flex-start', gap: 12, background: 'var(--color-bg-surface)' }}>
          <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
            <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--color-text-muted)' }}>{task.slot.toUpperCase()} · {hhmm(task.startMins)}{comp?.htcCode ? ` · ${comp.htcCode}` : ''}</span>
            <h2 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: 'var(--color-text-primary)' }}>{task.title}</h2>
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

          {comp && !comp.steps && (
            <Block icon={<Check size={13} />} title="Inputs">
              {comp.inputs.map(l => {
                const sub = COMPONENTS[l.ref];
                const grams = l.grams * batches;
                return <Pair key={l.ref} label={sub?.name ?? l.ref.replace(/-/g, ' ')} value={grams >= 1000 ? `${(grams / 1000).toFixed(1)} kg` : `${Math.round(grams)} g`} />;
              })}
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
            <button type="button" onClick={onStart} style={secondaryButton} disabled={done}>
              <Play size={13} /> Start{task.cookMins ? ` · ${task.cookMins} min timer` : ''}
            </button>
          )}
          <div style={{ flex: 1 }} />
          <button type="button" onClick={() => onTick(!done)} style={done ? secondaryButton : primaryButton}>
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
    <tr><td class="tick">☐</td><td>${esc(t.title)}${t.detail ? `<div class="sub">${esc(t.detail)}</div>` : ''}</td><td class="r"><strong>${esc(t.qty)}</strong></td><td class="r">${hhmm(t.startMins)}${t.readyMins ? `<div class="sub">ready ${hhmm(t.readyMins)}</div>` : ''}</td></tr>`).join('');
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

function RunPill({ label, count, active, onClick }: { label: string; count?: number; active: boolean; onClick: () => void }) {
  return (
    <button type="button" role="tab" aria-selected={active} onClick={onClick} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '5px 11px', borderRadius: 999, fontSize: 12, fontWeight: 600, fontFamily: 'var(--font-primary)', cursor: 'pointer', background: active ? 'var(--color-accent-active)' : '#ffffff', color: active ? '#ffffff' : 'var(--color-text-secondary)', border: `1px solid ${active ? 'var(--color-accent-active)' : 'var(--color-border)'}`, fontVariantNumeric: 'tabular-nums' }}>
      {label}
      {count !== undefined && <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', minWidth: 16, height: 16, padding: '0 4px', borderRadius: 100, fontSize: 10, fontWeight: 700, background: active ? 'rgba(255,255,255,0.25)' : 'var(--color-border-subtle)', color: active ? '#fff' : 'var(--color-text-secondary)' }}>{count}</span>}
    </button>
  );
}

function TotalRow({ label, value }: { label: string; value: string }) {
  return <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>{label}</span><span>{value}</span></div>;
}

function Stopwatch({ label, value, muted }: { label: string; value: string; muted?: boolean }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase' }}>{label}</span>
      <span style={{ fontSize: 14, fontWeight: 700, color: muted ? 'var(--color-text-muted)' : 'var(--color-text-primary)', fontVariantNumeric: 'tabular-nums' }}>{value}</span>
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
const secondaryButton: CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: 6, flexShrink: 0, minHeight: 36, padding: '8px 14px', borderRadius: 8, fontSize: 12, fontWeight: 600, fontFamily: 'var(--font-primary)', background: '#ffffff', color: 'var(--color-text-primary)', border: '1px solid var(--color-border)', cursor: 'pointer', whiteSpace: 'nowrap' };
const primaryButton: CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: 6, flexShrink: 0, minHeight: 36, padding: '8px 14px', borderRadius: 8, fontSize: 12, fontWeight: 700, fontFamily: 'var(--font-primary)', background: 'var(--color-accent-active)', color: 'var(--color-text-on-active, #fff)', border: '1px solid var(--color-accent-active)', cursor: 'pointer', whiteSpace: 'nowrap' };
const closeButton: CSSProperties = { width: 32, height: 32, borderRadius: 8, border: '1px solid var(--color-border-subtle)', background: '#ffffff', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-text-secondary)', flexShrink: 0 };
const linkButton: CSSProperties = { background: 'none', border: 'none', padding: 0, color: 'var(--color-link)', fontWeight: 700, fontSize: 11, cursor: 'pointer', fontFamily: 'var(--font-primary)', textDecoration: 'underline' };
const popover: CSSProperties = { position: 'absolute', top: 'calc(100% + 6px)', left: 0, zIndex: 60, minWidth: 200, background: '#ffffff', border: '1px solid var(--color-border)', borderRadius: 10, boxShadow: '0 12px 32px rgba(10, 20, 25, 0.18)', padding: 4, display: 'flex', flexDirection: 'column', gap: 2 };
const popoverItem: CSSProperties = { display: 'flex', alignItems: 'center', gap: 6, padding: '8px 10px', background: 'transparent', border: 'none', borderRadius: 6, textAlign: 'left', cursor: 'pointer', fontFamily: 'var(--font-primary)', color: 'var(--color-text-primary)', fontSize: 12.5, whiteSpace: 'nowrap' };
