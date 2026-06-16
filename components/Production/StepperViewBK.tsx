'use client';

/**
 * StepperViewBK — Burger King's "cook this batch" focus mode.
 *
 * The Pret stepper walks a bench → run → list of recipes. Burger King's
 * line is different: the crew tap a single component on the NOW block and
 * get a glanceable, step-by-step cook card for *that* component — the
 * patties / chicken / cheese-melt that go through the screen — with a
 * per-step timer and the build list. Deliberately one component at a time,
 * big type, readable from the line.
 */

import { useEffect, useMemo, useState } from 'react';
import { X, Check, Timer, ChevronRight } from 'lucide-react';
import {
  BK_CREW_STEPS,
  BK_INGREDIENT_USAGE,
  bkStationForRecipe,
  type BkCrewStep,
} from './bkFixtures';
import { getIngredient, getRecipe } from './fixtures';
import { WORK_TYPE_COLORS, WORK_TYPE_LABELS } from './fixtures';
import type { RecipeId } from './fixtures';
import {
  useCookTimer,
  startCookTimer,
  pauseCookTimer,
  resumeCookTimer,
  clearCookTimer,
  remainingSeconds,
  getCookTimers,
  type CookTimer,
} from './cookTimerStore';

/** Only the cook (Flame-broil/fry/grill/melt) and Hold steps carry a timer. */
function stepHasTimer(step: BkCrewStep): boolean {
  return step.workType === 'grill' || step.workType === 'pack';
}

export default function StepperViewBK({
  recipeId,
  onClose,
}: {
  recipeId: RecipeId | null;
  onClose: () => void;
}) {
  const open = recipeId !== null;
  const steps: BkCrewStep[] = recipeId ? BK_CREW_STEPS[recipeId] ?? [] : [];
  const recipe = recipeId ? getRecipe(recipeId) : undefined;
  const station = recipeId ? bkStationForRecipe(recipeId) : undefined;

  const [stepIdx, setStepIdx] = useState(0);
  const [done, setDone] = useState<boolean[]>([]);

  // Reset step progress when a new component is opened, but DON'T touch the
  // timers — a running broil keeps running. If this component already has a
  // live timer, jump straight to that step so reopening lands where the cook
  // left off.
  useEffect(() => {
    setDone(steps.map(() => false));
    const t = recipeId ? getCookTimers()[recipeId] : undefined;
    const idx = t ? steps.findIndex(s => s.label === t.stepId) : 0;
    setStepIdx(idx >= 0 ? idx : 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recipeId]);

  const ingredients = useMemo(() => {
    if (!recipeId) return [];
    return BK_INGREDIENT_USAGE.filter(u => u.recipeId === recipeId).map(u => ({
      name: getIngredient(u.ingredientId)?.name ?? u.ingredientId,
      qty: u.quantityPerUnit,
      unit: u.unit,
    }));
  }, [recipeId]);

  // Live timer for this component (persists across closing the card).
  const activeTimer = useCookTimer(recipeId);

  if (!open || !recipe) return null;

  const step = steps[stepIdx];
  if (!step) return null;
  const hasTimer = stepHasTimer(step);
  // The stored timer only applies to the step it was started on.
  const stepTimer = activeTimer && activeTimer.stepId === step.label ? activeTimer : null;
  const secondsLeft = stepTimer ? remainingSeconds(stepTimer) : step.seconds;
  const running = stepTimer?.status === 'running';
  const paused = stepTimer?.status === 'paused';
  const timerDone = stepTimer?.status === 'done';
  const mins = Math.floor(secondsLeft / 60);
  const secs = secondsLeft % 60;

  const toggleTimer = () => {
    if (!recipeId) return;
    if (running) {
      pauseCookTimer(recipeId);
    } else if (paused) {
      resumeCookTimer(recipeId);
    } else {
      // Fresh start (or restart after done) for this step.
      startCookTimer(recipeId, step.label, step.label, step.seconds);
    }
  };

  const goToStep = (idx: number) => {
    if (idx < 0 || idx >= steps.length) return;
    setStepIdx(idx);
  };

  const completeStep = () => {
    setDone(prev => {
      const next = [...prev];
      next[stepIdx] = true;
      return next;
    });
    if (stepIdx < steps.length - 1) {
      goToStep(stepIdx + 1);
    } else if (recipeId) {
      // Batch finished — into the cabinet, so the cook timer is cleared.
      clearCookTimer(recipeId);
      onClose();
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1000,
        background: 'rgba(8,9,11,0.7)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
        fontFamily: 'var(--font-primary)',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: 'min(720px, 100%)',
          maxHeight: '90vh',
          overflow: 'auto',
          background: '#15171c',
          color: '#fff',
          borderRadius: 16,
          border: '1px solid rgba(255,255,255,0.1)',
          boxShadow: '0 24px 60px rgba(0,0,0,0.5)',
        }}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            padding: '16px 20px',
            borderBottom: `2px solid ${station?.accent ?? '#d62300'}`,
          }}
        >
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.5)' }}>
              {station?.name ?? 'Cook'} · {recipe.shelfLifeMinutes ?? 20} min hold
            </div>
            <div style={{ fontSize: 22, fontWeight: 800 }}>{recipe.name}</div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            style={{
              marginLeft: 'auto',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 34,
              height: 34,
              borderRadius: 8,
              border: '1px solid rgba(255,255,255,0.2)',
              background: 'transparent',
              color: '#fff',
              cursor: 'pointer',
            }}
          >
            <X size={16} />
          </button>
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap' }}>
          {/* Current step + timer */}
          <div style={{ flex: '1 1 380px', padding: 20, minWidth: 0 }}>
            <StepPills steps={steps} done={done} current={stepIdx} onPick={goToStep} timer={activeTimer} />

            <div style={{ marginTop: 16 }}>
              <WorkChip workType={step.workType} />
              <div style={{ fontSize: 26, fontWeight: 800, marginTop: 10 }}>{step.label}</div>
              <div style={{ fontSize: 15, color: 'rgba(255,255,255,0.7)', marginTop: 6, lineHeight: 1.4 }}>
                {step.detail}
              </div>
            </div>

            {/* Timer — only on the cook (Flame-broil) and Hold steps. */}
            {hasTimer ? (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 14,
                  marginTop: 20,
                  padding: 16,
                  borderRadius: 12,
                  background: timerDone ? 'rgba(62,192,122,0.15)' : 'rgba(255,255,255,0.05)',
                  border: running
                    ? `1px solid ${station?.accent ?? '#d62300'}`
                    : '1px solid transparent',
                }}
              >
                <Timer size={20} color={timerDone ? '#7ddaa3' : 'rgba(255,255,255,0.6)'} />
                <div style={{ display: 'flex', flexDirection: 'column', minWidth: 120 }}>
                  <span
                    style={{
                      fontSize: 11,
                      fontWeight: 700,
                      letterSpacing: '0.06em',
                      textTransform: 'uppercase',
                      color: timerDone ? '#7ddaa3' : 'rgba(255,255,255,0.5)',
                    }}
                  >
                    {timerDone ? 'Done' : running ? `${step.label}…` : paused ? 'Paused' : step.label}
                  </span>
                  <span style={{ fontSize: 36, fontWeight: 900, fontVariantNumeric: 'tabular-nums' }}>
                    {timerDone ? 'Ready' : `${mins}:${secs.toString().padStart(2, '0')}`}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={toggleTimer}
                  style={primaryBtn(station?.accent ?? '#d62300')}
                >
                  {running ? 'Pause' : paused ? 'Resume' : timerDone ? 'Restart' : 'Start timer'}
                </button>
              </div>
            ) : (
              <div style={{ marginTop: 20, fontSize: 13, color: 'rgba(255,255,255,0.4)' }}>
                No timer — mark done when the {step.label.toLowerCase()} is complete.
              </div>
            )}

            <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
              <button type="button" onClick={() => goToStep(stepIdx - 1)} disabled={stepIdx === 0} style={ghostBtn(stepIdx === 0)}>
                Back
              </button>
              <button type="button" onClick={completeStep} style={{ ...primaryBtn(station?.accent ?? '#d62300'), flex: 1 }}>
                {stepIdx === steps.length - 1 ? (
                  <>
                    <Check size={16} /> Batch done — into the cabinet
                  </>
                ) : (
                  <>
                    Mark done <ChevronRight size={16} />
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Build list */}
          <div
            style={{
              flex: '1 1 220px',
              padding: 20,
              borderLeft: '1px solid rgba(255,255,255,0.08)',
              minWidth: 0,
            }}
          >
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.45)', marginBottom: 10 }}>
              Per unit
            </div>
            {ingredients.length === 0 ? (
              <div style={{ fontSize: 14, color: 'rgba(255,255,255,0.4)' }}>No build list</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {ingredients.map(ing => (
                  <div key={ing.name} style={{ display: 'flex', justifyContent: 'space-between', gap: 10, fontSize: 14 }}>
                    <span style={{ color: 'rgba(255,255,255,0.85)' }}>{ing.name}</span>
                    <span style={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
                      {ing.qty} {ing.unit === 'unit' ? '' : ing.unit}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function StepPills({
  steps,
  done,
  current,
  onPick,
  timer,
}: {
  steps: BkCrewStep[];
  done: boolean[];
  current: number;
  onPick: (idx: number) => void;
  timer: CookTimer | null;
}) {
  return (
    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
      {steps.map((s, i) => {
        const active = i === current;
        const complete = done[i];
        const onThis = timer && timer.stepId === s.label;
        const left = onThis ? remainingSeconds(timer) : 0;
        return (
          <button
            key={s.label}
            type="button"
            onClick={() => onPick(i)}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '6px 12px',
              borderRadius: 100,
              border: active ? '1.5px solid #fff' : '1.5px solid rgba(255,255,255,0.2)',
              background: complete ? 'rgba(62,192,122,0.2)' : active ? 'rgba(255,255,255,0.1)' : 'transparent',
              color: '#fff',
              cursor: 'pointer',
              fontSize: 12,
              fontWeight: 600,
              fontFamily: 'var(--font-primary)',
            }}
          >
            {complete && <Check size={12} color="#7ddaa3" />}
            {s.label}
            {onThis && timer && (
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 800,
                  fontVariantNumeric: 'tabular-nums',
                  color:
                    timer.status === 'done'
                      ? '#7ddaa3'
                      : timer.status === 'running'
                        ? '#f7c46c'
                        : 'rgba(255,255,255,0.6)',
                }}
              >
                {timer.status === 'done'
                  ? '✓'
                  : `${Math.floor(left / 60)}:${(left % 60).toString().padStart(2, '0')}`}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

function WorkChip({ workType }: { workType: BkCrewStep['workType'] }) {
  const c = WORK_TYPE_COLORS[workType];
  return (
    <span
      style={{
        display: 'inline-block',
        padding: '3px 10px',
        borderRadius: 100,
        fontSize: 11,
        fontWeight: 700,
        letterSpacing: '0.04em',
        textTransform: 'uppercase',
        background: c.bg,
        color: c.color,
      }}
    >
      {WORK_TYPE_LABELS[workType]}
    </span>
  );
}

function primaryBtn(accent: string): React.CSSProperties {
  return {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: '12px 18px',
    borderRadius: 10,
    border: 'none',
    background: accent,
    color: '#fff',
    fontSize: 14,
    fontWeight: 700,
    fontFamily: 'var(--font-primary)',
    cursor: 'pointer',
  };
}

function ghostBtn(disabled: boolean): React.CSSProperties {
  return {
    padding: '12px 18px',
    borderRadius: 10,
    border: '1px solid rgba(255,255,255,0.2)',
    background: 'transparent',
    color: disabled ? 'rgba(255,255,255,0.3)' : '#fff',
    fontSize: 14,
    fontWeight: 600,
    fontFamily: 'var(--font-primary)',
    cursor: disabled ? 'default' : 'pointer',
  };
}
