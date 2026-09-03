'use client';

import { useEffect, useMemo, useState } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { Boxes, Calendar, Check, CheckCircle2, ChevronLeft, ChevronRight, Clock, Flame, Play, Thermometer, Timer, User, X, Zap } from 'lucide-react';
import { longDate } from './calendar';
import { clearTimer, hhmm, startTimer, timerRemaining, useFjClock, type FjTimer } from './fjClock';
import { inputsForTask, plural, stepsForTask, type Nudge, type SectionCard, type SectionTask, type SectionsDay } from './sections';
import { COMPONENTS, CONTAINERS, SHELF_LIFE_GROUPS } from './recipes';

/**
 * The stepper for the person on the section. Same frame as the Pret
 * stepper (pick where you are working, then walk the list one task at a
 * time), with the method card on the right in place of the recipe PDF so
 * the steps scale to the batches and can be ticked off as you go.
 */

type Slot = 'am' | 'pm';

export type StepperTarget = { sectionId: string; slot: Slot; taskId?: string };

export default function FjStepper({ open, onClose, day, date, ticks, onTick, initial, live }: {
  open: boolean;
  onClose: () => void;
  day: SectionsDay;
  date: string;
  ticks: Record<string, string>;
  onTick: (taskId: string, done: boolean) => void;
  initial?: StepperTarget | null;
  /** True on the demo day: the clock, timers and prompts are live. */
  live: boolean;
}) {
  const clock = useFjClock();
  const [target, setTarget] = useState<StepperTarget | null>(null);
  const [index, setIndex] = useState(0);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [stepTicks, setStepTicks] = useState<Set<string>>(new Set());
  const [sidebarWidth, setSidebarWidth] = useState(240);

  useEffect(() => {
    if (!open) return;
    const el = document.querySelector('aside');
    if (!el) return;
    const update = () => setSidebarWidth(el.getBoundingClientRect().width);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [open]);

  useEffect(() => {
    if (!open) { setTarget(null); setIndex(0); setStartedAt(null); setStepTicks(new Set()); return; }
    if (initial) enter(initial);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- runs on open only; `initial` is read once
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { window.removeEventListener('keydown', onKey); document.body.style.overflow = prev; };
  }, [open, onClose]);

  const card = target ? day.cards.find(c => c.section.id === target.sectionId) : undefined;
  const tasks = useMemo(() => (card && target ? (target.slot === 'am' ? card.am : card.pm) : []), [card, target]);

  function enter(t: StepperTarget) {
    const c = day.cards.find(x => x.section.id === t.sectionId);
    const list = c ? (t.slot === 'am' ? c.am : c.pm) : [];
    let i = t.taskId ? list.findIndex(x => x.id === t.taskId) : -1;
    if (i < 0) i = Math.max(0, list.findIndex(x => !ticks[x.id]));
    setTarget(t);
    setIndex(i);
    setStartedAt(clock.mins);
  }

  if (!open || typeof document === 'undefined') return null;

  const task = tasks[index];
  const completed = tasks.filter(t => ticks[t.id]).length;
  const subtitle = target && card ? `${card.section.name} | ${target.slot.toUpperCase()} | ${longDate(date)}` : 'Open stepper';
  const liveNudge = live && task ? day.nudges.find(n => n.taskId === task.id && clock.mins >= n.atMins && !clock.dismissed.includes(n.id) && !clock.started.includes(n.taskId)) : undefined;

  const complete = () => {
    if (!task) return;
    onTick(task.id, true);
    const nextIdx = tasks.findIndex((t, i) => i > index && !ticks[t.id]);
    if (nextIdx >= 0) setIndex(nextIdx);
    else if (index < tasks.length - 1) setIndex(index + 1);
  };

  return createPortal(
    <AnimatePresence>
      <motion.div key="fj-stepper" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.18 }}
        style={{ position: 'fixed', top: 0, right: 0, bottom: 0, left: sidebarWidth, zIndex: 1000, background: '#ffffff', display: 'flex', flexDirection: 'column', fontFamily: 'var(--font-primary)' }}
        onClick={onClose}
      >
        <motion.div initial={{ y: 24, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 12, opacity: 0 }} transition={{ duration: 0.22, ease: 'easeOut' }} onClick={e => e.stopPropagation()}
          role="dialog" aria-label="Section stepper"
          style={{ marginLeft: 12, flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: 'var(--color-bg-nav)', boxShadow: '0 24px 64px rgba(0,0,0,0.35)', minHeight: 0 }}
        >
          <TopBar subtitle={subtitle} date={date} nowMins={live ? clock.mins : undefined} onClose={onClose} onChange={target ? () => { setTarget(null); setIndex(0); } : null} />

          <div style={{ flex: 1, minHeight: 0, padding: '12px 16px 16px', display: 'flex' }}>
            {!target || !card ? (
              <Picker day={day} ticks={ticks} onPick={enter} />
            ) : tasks.length === 0 || !task ? (
              <Empty card={card} slot={target.slot} onBack={() => setTarget(null)} />
            ) : (
              <Body
                task={task}
                index={index}
                total={tasks.length}
                completed={completed}
                startedAt={startedAt}
                done={Boolean(ticks[task.id])}
                timer={clock.timers[task.id]}
                nowMins={live ? clock.mins : undefined}
                nudge={liveNudge}
                stepTicks={stepTicks}
                onStepTick={(i, on) => setStepTicks(prev => { const n = new Set(prev); const k = `${task.id}:${i}`; if (on) n.add(k); else n.delete(k); return n; })}
                onBack={() => setIndex(i => Math.max(0, i - 1))}
                onNext={() => setIndex(i => Math.min(tasks.length - 1, i + 1))}
                onStart={() => startTimer(task.id, task.cookMins ?? task.durationMins, task.title)}
                onClear={() => clearTimer(task.id)}
                onComplete={complete}
                onUndo={() => onTick(task.id, false)}
              />
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>,
    document.body,
  );
}

// ─── Top bar ──────────────────────────────────────────────────────────────────

function TopBar({ subtitle, date, nowMins, onClose, onChange }: { subtitle: string; date: string; nowMins?: number; onClose: () => void; onChange: (() => void) | null }) {
  const [y, m, d] = date.split('-');
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '16px 24px', color: '#ffffff', background: 'var(--color-bg-nav)' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
        <span style={{ fontSize: 15, fontWeight: 700, letterSpacing: '-0.01em' }}>{subtitle}</span>
        {onChange && (
          <button type="button" onClick={onChange} style={{ alignSelf: 'flex-start', border: 'none', background: 'transparent', color: 'rgba(255,255,255,0.72)', cursor: 'pointer', fontSize: 11, fontWeight: 600, padding: 0, fontFamily: 'var(--font-primary)', textDecoration: 'underline' }}>
            Change section or slot
          </button>
        )}
      </div>
      <div style={{ flex: 1 }} />
      {nowMins !== undefined && (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 12px', borderRadius: 10, background: 'rgba(255,255,255,0.12)', fontSize: 12, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
          <Clock size={13} /> {hhmm(nowMins)}
        </span>
      )}
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 12px', borderRadius: 10, background: '#ffffff', color: 'var(--color-bg-nav)', fontSize: 12, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
        {d}.{m}.{y} <Calendar size={13} />
      </span>
      <button type="button" aria-label="Close stepper" onClick={onClose} style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 38, height: 38, borderRadius: 10, background: 'transparent', color: '#ffffff', border: '1px solid rgba(255,255,255,0.25)', cursor: 'pointer', marginLeft: 4 }}>
        <X size={16} />
      </button>
    </div>
  );
}

// ─── Picker ───────────────────────────────────────────────────────────────────

function Picker({ day, ticks, onPick }: { day: SectionsDay; ticks: Record<string, string>; onPick: (t: StepperTarget) => void }) {
  const [sectionId, setSectionId] = useState<string | null>(null);
  const card = sectionId ? day.cards.find(c => c.section.id === sectionId) : undefined;
  return (
    <div style={{ flex: 1, background: '#ffffff', borderRadius: 14, padding: '20px 24px 24px', overflow: 'auto', minHeight: 0 }}>
      <h2 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: 'var(--color-text-primary)', letterSpacing: '-0.01em' }}>Pick a section and slot</h2>

      <div style={{ marginTop: 22 }}>
        <Label>1. Section</Label>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 10, marginTop: 10 }}>
          {day.cards.map(c => {
            const all = [...c.am, ...c.pm];
            const left = all.filter(t => !ticks[t.id]).length;
            const active = c.section.id === sectionId;
            return (
              <button key={c.section.id} type="button" onClick={() => setSectionId(c.section.id)}
                style={{ textAlign: 'left', border: `1.5px solid ${active ? 'var(--color-bg-nav)' : 'var(--color-border)'}`, background: active ? 'var(--color-bg-hover)' : '#ffffff', borderRadius: 12, padding: '12px 14px', cursor: 'pointer', fontFamily: 'var(--font-primary)', display: 'flex', flexDirection: 'column', gap: 4 }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--color-text-primary)' }}>{c.section.name}</span>
                <span style={{ fontSize: 11, color: 'var(--color-text-secondary)', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                  <User size={11} /> {c.section.person}
                  <span style={{ color: 'var(--color-text-muted)' }}>· {all.length} {plural(all.length, 'task')}{left < all.length ? `, ${left} left` : ''}</span>
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div style={{ marginTop: 24 }}>
        <Label>2. Slot</Label>
        {!card && <div style={{ marginTop: 10, fontSize: 12, color: 'var(--color-text-muted)' }}>Pick a section.</div>}
        {card && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginTop: 10 }}>
            {(['am', 'pm'] as Slot[]).map((slot, i) => {
              const list = slot === 'am' ? card.am : card.pm;
              const first = list[0];
              return (
                <button key={slot} type="button" onClick={() => onPick({ sectionId: card.section.id, slot })} disabled={list.length === 0}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 10, padding: '12px 16px', borderRadius: 12, border: '1.5px solid var(--color-border)', background: '#ffffff', color: 'var(--color-text-primary)', fontFamily: 'var(--font-primary)', fontSize: 13, fontWeight: 700, cursor: list.length ? 'pointer' : 'not-allowed', opacity: list.length ? 1 : 0.5 }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 28, height: 28, borderRadius: 8, background: 'var(--color-bg-nav)', color: '#ffffff', fontSize: 12, fontWeight: 800 }}>{i + 1}</span>
                  <span style={{ display: 'flex', flexDirection: 'column', gap: 2, textAlign: 'left' }}>
                    <span>{slot.toUpperCase()}</span>
                    <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-text-secondary)' }}>
                      {first ? `Starts ${hhmm(first.startMins)} · ` : ''}{list.length} {plural(list.length, 'task')}
                    </span>
                  </span>
                  <ChevronRight size={14} color="var(--color-text-secondary)" />
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function Empty({ card, slot, onBack }: { card: SectionCard; slot: Slot; onBack: () => void }) {
  return (
    <div style={{ flex: 1, background: '#ffffff', borderRadius: 14, padding: 24, display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 12 }}>
      <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800 }}>Nothing in the {slot.toUpperCase()} for {card.section.name}</h2>
      <button type="button" onClick={onBack} style={ghostButton}>Pick another</button>
    </div>
  );
}

// ─── Body ─────────────────────────────────────────────────────────────────────

function Body({ task, index, total, completed, startedAt, done, timer, nowMins, nudge, stepTicks, onStepTick, onBack, onNext, onStart, onClear, onComplete, onUndo }: {
  task: SectionTask;
  index: number;
  total: number;
  completed: number;
  startedAt: number | null;
  done: boolean;
  timer?: FjTimer;
  nowMins?: number;
  nudge?: Nudge;
  stepTicks: Set<string>;
  onStepTick: (i: number, on: boolean) => void;
  onBack: () => void;
  onNext: () => void;
  onStart: () => void;
  onClear: () => void;
  onComplete: () => void;
  onUndo: () => void;
}) {
  const comp = task.componentId ? COMPONENTS[task.componentId] : undefined;
  const inputs = inputsForTask(task);
  const remaining = timer && nowMins !== undefined ? timerRemaining(timer, nowMins) : undefined;
  const cooking = remaining !== undefined && remaining > 0;
  const ready = remaining !== undefined && remaining === 0;
  const outputs = inputs.length === 0 ? outputLines(task) : [];

  return (
    <div style={{ flex: 1, minHeight: 0, display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1.05fr)', gap: 16 }}>
      <div style={{ background: '#ffffff', borderRadius: 14, padding: '18px 20px 20px', display: 'flex', flexDirection: 'column', minHeight: 0, overflow: 'hidden' }}>
        <Progress percent={total ? (completed / total) * 100 : 0} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 18, marginTop: 10, fontSize: 12, color: 'var(--color-text-secondary)' }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><CheckCircle2 size={13} /> {completed} of {total} tasks completed</span>
          {startedAt !== null && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><Clock size={13} /> Started at {hhmm(startedAt)}</span>}
        </div>

        {nudge && (
          <div role="status" style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', background: 'var(--color-warning-light)', border: '1px solid var(--color-warning-border)', borderRadius: 12 }}>
            <span style={{ width: 28, height: 28, borderRadius: 8, background: '#ffffff', color: 'var(--color-warning)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><Zap size={14} /></span>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--color-text-primary)' }}>{nudge.title}</div>
              <div style={{ fontSize: 11, color: 'var(--color-text-secondary)' }}>{nudge.body}</div>
            </div>
          </div>
        )}

        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginTop: 14 }}>
          <h1 style={{ margin: 0, flex: 1, fontSize: 26, fontWeight: 800, letterSpacing: '-0.015em', color: 'var(--color-text-primary)', lineHeight: 1.15 }}>
            {task.title}
            {task.load && <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--color-text-muted)', marginLeft: 10 }}>load {task.load.n} of {task.load.of}</span>}
          </h1>
          <Arrows onBack={onBack} onNext={onNext} backDisabled={index === 0} nextDisabled={index >= total - 1} />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 14 }}>
          <Stat tone="info" label="Quantity" icon={<Boxes size={13} />} value={task.qty} sub={task.containers} />
          {task.readyMins ? (
            <Stat tone="warning" label="Ready at" icon={<Clock size={13} />} value={hhmm(task.readyMins)} sub={`Start ${hhmm(task.startMins)} · ${task.durationMins} min hands-on`} />
          ) : (
            <Stat tone="warning" label="Time" icon={<Clock size={13} />} value={`${task.durationMins} min`} sub={`Start ${hhmm(task.startMins)}`} />
          )}
        </div>

        <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', border: '1px solid var(--color-border-subtle)', borderRadius: 12, overflow: 'hidden', flex: 1, minHeight: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', padding: '12px 14px', borderBottom: '1px solid var(--color-border-subtle)' }}>
            <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--color-text-primary)' }}>{inputs.length ? 'Weigh up' : 'Goes out as'}</span>
            <span style={{ flex: 1 }} />
            <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--color-text-primary)' }}>{inputs.length ? `${inputs.length} ${plural(inputs.length, 'line')}` : `${outputs.length} ${plural(outputs.length, 'line')}`}</span>
          </div>
          <div style={{ padding: '6px 8px', display: 'flex', flexDirection: 'column', overflowY: 'auto', minHeight: 0 }}>
            {inputs.map(l => <PillRow key={l.name} pill={l.label} text={l.name} />)}
            {outputs.map((l, i) => <PillRow key={i} pill={l.pill} text={l.text} />)}
            {inputs.length === 0 && outputs.length === 0 && <div style={{ padding: '14px 8px', fontSize: 12, color: 'var(--color-text-muted)' }}>{task.detail ?? task.qty}</div>}
          </div>
        </div>

        <div style={{ marginTop: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, padding: '14px 18px', border: '1px solid var(--color-border-subtle)', borderRadius: 12, background: ready ? 'var(--color-success-light, #eef8f1)' : '#ffffff', fontVariantNumeric: 'tabular-nums', fontSize: 22, fontWeight: 800, color: ready ? 'var(--color-success)' : cooking ? 'var(--color-info)' : 'var(--color-text-primary)' }}>
          <Timer size={16} />
          {cooking ? `${remaining} min` : ready ? 'Ready' : `${task.cookMins ?? task.durationMins} min`}
          <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.06em', color: 'var(--color-text-secondary)', textTransform: 'uppercase', marginLeft: 6 }}>
            {cooking ? 'left' : ready ? '' : task.cookMins ? comp?.cook?.programme ?? 'cook' : 'hands-on'}
          </span>
        </div>

        <div style={{ marginTop: 12, display: 'grid', gridTemplateColumns: '1fr 1.4fr', gap: 10 }}>
          {timer ? (
            <button type="button" onClick={onClear} style={bigGhost}><X size={15} /> Clear timer</button>
          ) : (
            <button type="button" onClick={onStart} disabled={done || nowMins === undefined} style={{ ...bigGhost, opacity: done || nowMins === undefined ? 0.5 : 1 }}><Play size={15} /> Start</button>
          )}
          {done ? (
            <button type="button" onClick={onUndo} style={bigGhost}><Check size={16} /> Done · undo</button>
          ) : (
            <button type="button" onClick={onComplete} style={bigPrimary}><CheckCircle2 size={16} /> Complete</button>
          )}
        </div>
      </div>

      <MethodCard task={task} stepTicks={stepTicks} onStepTick={onStepTick} />
    </div>
  );
}

/** Lines for tasks that plate or pack rather than make: "12 Farmers' Rice". */
function outputLines(task: SectionTask): { pill: string; text: string }[] {
  if (task.kind === 'plate' && task.detail) {
    return task.detail.split(', ').map(s => {
      const m = s.match(/^(\d+)\s+(.*)$/);
      return m ? { pill: m[1], text: m[2] } : { pill: '', text: s };
    });
  }
  if (task.kind === 'dress') return [{ pill: task.qty.split(' ')[0], text: task.qty.split(' ').slice(1).join(' ') }];
  if (task.kind === 'pack') return [{ pill: task.qty.split(' ')[0], text: task.qty.split(' ').slice(1).join(' ') }];
  return [];
}

// ─── Method card ──────────────────────────────────────────────────────────────

function MethodCard({ task, stepTicks, onStepTick }: { task: SectionTask; stepTicks: Set<string>; onStepTick: (i: number, on: boolean) => void }) {
  const comp = task.componentId ? COMPONENTS[task.componentId] : undefined;
  const batches = task.batches ?? 1;
  const steps = stepsForTask(task);
  const group = comp ? SHELF_LIFE_GROUPS[comp.shelfLife] : undefined;
  const doneSteps = steps.filter((_, i) => stepTicks.has(`${task.id}:${i}`)).length;
  const current = steps.findIndex((_, i) => !stepTicks.has(`${task.id}:${i}`));

  return (
    <div style={{ background: '#ffffff', borderRadius: 14, padding: '18px 20px 20px', display: 'flex', flexDirection: 'column', minHeight: 0, overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
          <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--color-text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {comp?.name ?? task.title}
          </span>
          <span style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>
            {comp?.htcCode ? `${comp.htcCode} · ` : ''}{steps.length ? `${doneSteps} of ${steps.length} steps` : task.detail ?? ''}
          </span>
        </div>
        <span style={{ flex: 1 }} />
        {comp?.cook && <Chip icon={<Flame size={11} />} text={`${comp.cook.programme} · ${Array.isArray(comp.cook.minutes) ? `${comp.cook.minutes[0]} to ${comp.cook.minutes[1]}` : comp.cook.minutes} min`} />}
        {comp?.cook?.coreTempC && <Chip icon={<Thermometer size={11} />} text={`${comp.cook.coreTempC}°C core`} />}
      </div>

      <div style={{ flex: 1, minHeight: 0, marginTop: 14, border: '1px solid var(--color-border-subtle)', borderRadius: 10, overflow: 'auto', padding: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
        {steps.map((s, i) => {
          const on = stepTicks.has(`${task.id}:${i}`);
          const isCurrent = i === current;
          return (
            <button key={i} type="button" onClick={() => onStepTick(i, !on)} aria-pressed={on}
              style={{ display: 'grid', gridTemplateColumns: '32px 1fr 24px', alignItems: 'center', gap: 12, padding: '12px 14px', borderRadius: 10, textAlign: 'left', cursor: 'pointer', fontFamily: 'var(--font-primary)', border: `1.5px solid ${isCurrent ? 'var(--color-bg-nav)' : 'var(--color-border-subtle)'}`, background: on ? 'var(--color-bg-hover)' : '#ffffff', opacity: on ? 0.7 : 1 }}>
              <span style={{ width: 32, height: 32, borderRadius: 10, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 800, background: on ? 'var(--color-success)' : isCurrent ? 'var(--color-bg-nav)' : 'var(--color-bg-hover)', color: on || isCurrent ? '#ffffff' : 'var(--color-text-secondary)' }}>
                {on ? <Check size={15} /> : i + 1}
              </span>
              <span style={{ fontSize: isCurrent ? 16 : 14, fontWeight: isCurrent ? 700 : 500, color: 'var(--color-text-primary)', lineHeight: 1.4, textDecoration: on ? 'line-through' : 'none' }}>{s}</span>
              <span />
            </button>
          );
        })}
        {steps.length === 0 && <div style={{ padding: 14, fontSize: 14, color: 'var(--color-text-primary)', lineHeight: 1.5 }}>{task.detail ?? task.qty}</div>}
      </div>

      <div style={{ marginTop: 12, display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
        {comp?.equipment?.map(e => <Chip key={e} text={e} />)}
        {comp?.container && comp.containersPerBatch && (
          <Chip icon={<Boxes size={11} />} text={`Into ${Math.ceil(batches * comp.containersPerBatch)} ${plural(Math.ceil(batches * comp.containersPerBatch), CONTAINERS[comp.container].name.toLowerCase())}`} />
        )}
        {comp?.restMinutes && <Chip text={`Rest ${comp.restMinutes} min`} />}
        {comp?.holdMinutes && <Chip text={`${comp.holdMinutes / 60}h hold`} />}
        {group && <Chip text={group.days === 1 ? 'Use today' : `Use by ${group.days - 1} days`} />}
        {!comp && task.detail && <Chip text={task.detail} />}
      </div>
    </div>
  );
}

// ─── Small bits ───────────────────────────────────────────────────────────────

function Progress({ percent }: { percent: number }) {
  return (
    <div style={{ height: 6, borderRadius: 999, background: 'var(--color-bg-hover)', overflow: 'hidden' }}>
      <div style={{ width: `${Math.min(100, Math.max(0, percent))}%`, height: '100%', background: 'var(--color-success)', transition: 'width 0.3s ease' }} />
    </div>
  );
}

function Arrows({ onBack, onNext, backDisabled, nextDisabled }: { onBack: () => void; onNext: () => void; backDisabled: boolean; nextDisabled: boolean }) {
  return (
    <div style={{ display: 'inline-flex', gap: 6 }}>
      <button type="button" onClick={onBack} disabled={backDisabled} aria-label="Previous task" style={{ width: 36, height: 36, borderRadius: 10, background: backDisabled ? 'var(--color-bg-hover)' : '#ffffff', color: 'var(--color-text-primary)', border: '1px solid var(--color-border)', cursor: backDisabled ? 'not-allowed' : 'pointer', opacity: backDisabled ? 0.5 : 1, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
        <ChevronLeft size={16} />
      </button>
      <button type="button" onClick={onNext} disabled={nextDisabled} aria-label="Next task" style={{ width: 36, height: 36, borderRadius: 10, background: nextDisabled ? 'var(--color-bg-hover)' : 'var(--color-bg-nav)', color: nextDisabled ? 'var(--color-text-muted)' : '#ffffff', border: 'none', cursor: nextDisabled ? 'not-allowed' : 'pointer', opacity: nextDisabled ? 0.6 : 1, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
        <ChevronRight size={16} />
      </button>
    </div>
  );
}

function Stat({ tone, label, icon, value, sub }: { tone: 'info' | 'warning'; label: string; icon: ReactNode; value: string; sub?: string }) {
  const p = tone === 'info' ? { bg: '#eef5fa', label: '#0f5e8a' } : { bg: '#fdeadc', label: '#9a3a0a' };
  return (
    <div style={{ background: p.bg, borderRadius: 12, padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 4 }}>
      <span style={{ fontSize: 11, fontWeight: 700, color: p.label }}>{label}</span>
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 17, fontWeight: 800, color: 'var(--color-text-primary)' }}>{icon}{value}</span>
      {sub && <span style={{ fontSize: 11, color: 'var(--color-text-secondary)', fontVariantNumeric: 'tabular-nums' }}>{sub}</span>}
    </div>
  );
}

function PillRow({ pill, text }: { pill: string; text: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 8px' }}>
      {pill && <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: '6px 12px', minWidth: 60, borderRadius: 999, background: '#fde6cf', color: '#7a3800', fontSize: 12, fontWeight: 800, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>{pill}</span>}
      <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text-primary)' }}>{text}</span>
    </div>
  );
}

function Chip({ icon, text }: { icon?: ReactNode; text: string }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '4px 10px', borderRadius: 999, background: '#ffffff', border: '1px solid var(--color-border)', fontSize: 11, fontWeight: 600, color: 'var(--color-text-secondary)', whiteSpace: 'nowrap' }}>
      {icon}{text}
    </span>
  );
}

function Label({ children }: { children: ReactNode }) {
  return <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--color-text-muted)' }}>{children}</span>;
}

const bigGhost: CSSProperties = { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '14px 18px', borderRadius: 12, background: '#ffffff', color: 'var(--color-text-primary)', border: '1.5px solid var(--color-border)', fontSize: 14, fontWeight: 700, fontFamily: 'var(--font-primary)', cursor: 'pointer' };
const bigPrimary: CSSProperties = { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '14px 18px', borderRadius: 12, background: 'var(--color-success)', color: '#ffffff', border: 'none', fontSize: 14, fontWeight: 800, fontFamily: 'var(--font-primary)', cursor: 'pointer' };
const ghostButton: CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 8, fontSize: 12, fontWeight: 600, fontFamily: 'var(--font-primary)', background: '#ffffff', color: 'var(--color-text-secondary)', border: '1px solid var(--color-border)', cursor: 'pointer' };
