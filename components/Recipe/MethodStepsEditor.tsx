'use client';

/**
 * Method as numbered steps. Stored as one string, one step a line, so the
 * recipe model and everything that already reads `instructions` stay as
 * they are. The Farmer J stepper (Sections board, FjStepper) shows these
 * steps one at a time and ticks them off, so each line should be one
 * action the cook can finish before reading the next.
 *
 * Weights written as "7000 g (half: 3500 g)" or "one kit (7140 g; half
 * 3570 g)" are scaled by the stepper to the batch it is cooking.
 */

import React, { useRef } from 'react';
import { ArrowDown, ArrowUp, ClipboardPaste, Plus, X } from 'lucide-react';

export function splitSteps(value: string): string[] {
  return value.split(/\r?\n/).map(s => s.replace(/^\s*(?:\d+[.)]|[-*•])\s*/, '').trim()).filter(Boolean);
}

export function joinSteps(steps: string[]): string {
  return steps.map(s => s.trim()).filter(Boolean).join('\n');
}

export function MethodStepsEditor({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  const steps = value.trim() ? value.split(/\r?\n/) : [];
  const refs = useRef<Array<HTMLTextAreaElement | null>>([]);

  const commit = (next: string[]) => onChange(next.join('\n'));
  const focus = (i: number) => requestAnimationFrame(() => refs.current[i]?.focus());

  const setStep = (i: number, text: string) => {
    const next = [...steps];
    next[i] = text;
    commit(next);
  };
  const insertAfter = (i: number, text = '') => {
    const next = [...steps];
    next.splice(i + 1, 0, text);
    commit(next);
    focus(i + 1);
  };
  const remove = (i: number) => {
    const next = steps.filter((_, j) => j !== i);
    commit(next);
    focus(Math.max(0, i - 1));
  };
  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= steps.length) return;
    const next = [...steps];
    [next[i], next[j]] = [next[j], next[i]];
    commit(next);
    focus(j);
  };
  /** Pasting a whole method in one go becomes one step a line. */
  const paste = (i: number, e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const text = e.clipboardData.getData('text');
    const lines = splitSteps(text);
    if (lines.length <= 1) return;
    e.preventDefault();
    const next = [...steps];
    const current = next[i]?.trim();
    next.splice(i, 1, ...(current ? [current, ...lines] : lines));
    commit(next);
    focus(i + lines.length - (current ? 0 : 1));
  };
  const key = (i: number, e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      insertAfter(i);
    } else if (e.key === 'Backspace' && steps[i] === '' && steps.length > 1) {
      e.preventDefault();
      remove(i);
    } else if (e.key === 'ArrowUp' && e.altKey) {
      e.preventDefault();
      move(i, -1);
    } else if (e.key === 'ArrowDown' && e.altKey) {
      e.preventDefault();
      move(i, 1);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {steps.length === 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', borderRadius: 10, border: '1.5px dashed var(--color-border)', background: 'var(--color-bg-hover)', fontSize: 13, color: 'var(--color-text-secondary)' }}>
          <ClipboardPaste size={16} color="var(--color-text-muted)" />
          <span style={{ flex: 1 }}>{placeholder ?? 'No method yet. Add the first step, or paste the whole method and each line becomes a step.'}</span>
        </div>
      )}
      <ol style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
        {steps.map((s, i) => (
          <li key={i} style={{ display: 'grid', gridTemplateColumns: '28px 1fr auto', gap: 8, alignItems: 'start' }}>
            <span aria-hidden style={{ width: 28, height: 36, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', borderRadius: 8, background: 'var(--color-bg-hover)', fontSize: 12, fontWeight: 700, color: 'var(--color-text-secondary)', fontVariantNumeric: 'tabular-nums' }}>{i + 1}</span>
            <textarea
              ref={el => { refs.current[i] = el; }}
              aria-label={`Step ${i + 1}`}
              value={s}
              rows={1}
              onChange={e => setStep(i, e.target.value)}
              onKeyDown={e => key(i, e)}
              onPaste={e => paste(i, e)}
              onInput={e => { const t = e.currentTarget; t.style.height = 'auto'; t.style.height = `${t.scrollHeight}px`; }}
              placeholder={i === 0 ? 'e.g. Weigh 7000 g brown rice (half: 3500 g)' : 'Next step'}
              style={{ width: '100%', minHeight: 36, padding: '8px 11px', borderRadius: 8, border: '1px solid var(--color-border)', fontSize: 14, lineHeight: 1.4, fontFamily: 'var(--font-primary)', color: 'var(--color-text-primary)', background: '#fff', resize: 'none', overflow: 'hidden', boxSizing: 'border-box' }}
            />
            <span style={{ display: 'inline-flex', gap: 2 }}>
              <IconBtn label={`Move step ${i + 1} up`} disabled={i === 0} onClick={() => move(i, -1)}><ArrowUp size={13} /></IconBtn>
              <IconBtn label={`Move step ${i + 1} down`} disabled={i === steps.length - 1} onClick={() => move(i, 1)}><ArrowDown size={13} /></IconBtn>
              <IconBtn label={`Remove step ${i + 1}`} onClick={() => remove(i)}><X size={13} /></IconBtn>
            </span>
          </li>
        ))}
      </ol>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 2 }}>
        <button type="button" onClick={() => insertAfter(steps.length - 1)} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '7px 12px', borderRadius: 8, border: '1px solid var(--color-border)', background: '#fff', fontSize: 13, fontWeight: 600, fontFamily: 'var(--font-primary)', color: 'var(--color-text-primary)', cursor: 'pointer' }}>
          <Plus size={13} /> Add step
        </button>
        <span style={{ fontSize: 11.5, color: 'var(--color-text-muted)', lineHeight: 1.4 }}>
          One action a step. Enter adds the next, Alt + arrows reorder. Write weights as &ldquo;7000 g (half: 3500 g)&rdquo; and the stepper scales them to the batch.
        </span>
      </div>
    </div>
  );
}

function IconBtn({ label, disabled, onClick, children }: { label: string; disabled?: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
      style={{ width: 28, height: 36, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', borderRadius: 8, border: 'none', background: 'transparent', color: disabled ? 'var(--color-border)' : 'var(--color-text-muted)', cursor: disabled ? 'default' : 'pointer' }}
    >
      {children}
    </button>
  );
}
