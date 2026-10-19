'use client';

import { useEffect, useId, useRef, useState, useSyncExternalStore, type CSSProperties, type KeyboardEvent as KeyEvent, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Check, ChevronDown, Minus, Plus, X, ZoomIn, ZoomOut } from 'lucide-react';
import { SAMPLE_PHOTOS, type SamplePhoto } from './samplePhotos';
import type { Sample } from './samples';
import type { Choice } from './review';

// Floor-sized versions of the Command Centre's card language: same white
// cards, navy pills and Poppins, at the typography standard's phone sizes
// (16px body, 14px secondary, 44px touch targets).

export const C = {
  ink: 'var(--color-text-primary)',
  muted: 'var(--color-text-secondary)',
  border: 'var(--color-border)',
  subtle: 'var(--color-border-subtle)',
  page: 'var(--color-bg-hover)',
  navy: 'var(--color-accent-active)',
};

export const card: CSSProperties = {
  background: '#fff',
  border: `1px solid ${C.subtle}`,
  borderRadius: 14,
  boxShadow: '0 4px 16px rgba(0,28,53,0.06)',
};

export function photoFor(sample: Sample): SamplePhoto | undefined {
  return SAMPLE_PHOTOS[sample.photoOf ?? sample.id];
}

const noSubscribe = () => () => {};

/** False during server render and hydration, true after. */
export function useMounted() {
  return useSyncExternalStore(noSubscribe, () => true, () => false);
}

/** Stops document numbers like PO-10482 breaking across lines at the hyphen. */
export function keepIds(text: string) {
  return text.replace(/(?<=[A-Z0-9])-(?=[A-Z0-9])/g, '\u2060-\u2060');
}

/** A full-screen layer on document.body, above the app's stacking contexts. */
export function Layer({ children, z = 1000, background = C.page, label }: { children: ReactNode; z?: number; background?: string; label?: string }) {
  const mounted = useMounted();
  if (!mounted) return null;
  return createPortal(
    <div
      aria-label={label}
      style={{ position: 'fixed', inset: 0, zIndex: z, background, fontFamily: 'var(--font-primary)', color: C.ink, display: 'flex', flexDirection: 'column' }}
    >
      {children}
    </div>,
    document.body,
  );
}

export function IconButton({ label, onClick, children, tone = 'light', style }: { label: string; onClick: () => void; children: ReactNode; tone?: 'light' | 'dark'; style?: CSSProperties }) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      style={{
        width: 44,
        height: 44,
        flexShrink: 0,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 12,
        border: 'none',
        background: tone === 'dark' ? 'rgba(255,255,255,0.12)' : 'transparent',
        color: tone === 'dark' ? '#fff' : C.ink,
        cursor: 'pointer',
        ...style,
      }}
    >
      {children}
    </button>
  );
}

export function PrimaryButton({ children, onClick, disabled, type = 'button' }: { children: ReactNode; onClick?: () => void; disabled?: boolean; type?: 'button' | 'submit' }) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      style={{
        width: '100%',
        minHeight: 48,
        padding: '10px 20px',
        borderRadius: 12,
        border: 'none',
        background: disabled ? '#E8E6E3' : C.navy,
        color: disabled ? '#4A413B' : '#fff',
        fontSize: 16,
        fontWeight: 600,
        fontFamily: 'var(--font-primary)',
        cursor: disabled ? 'not-allowed' : 'pointer',
        boxShadow: disabled ? 'none' : '0 2px 8px rgba(0,28,53,0.22)',
      }}
    >
      {children}
    </button>
  );
}

export function SecondaryButton({ children, onClick }: { children: ReactNode; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        width: '100%',
        minHeight: 48,
        padding: '10px 20px',
        borderRadius: 12,
        border: `1.5px solid ${C.border}`,
        background: '#fff',
        color: C.ink,
        fontSize: 16,
        fontWeight: 600,
        fontFamily: 'var(--font-primary)',
        cursor: 'pointer',
      }}
    >
      {children}
    </button>
  );
}

export function TextLink({ children, onClick }: { children: ReactNode; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        minHeight: 44,
        padding: '0 4px',
        border: 'none',
        background: 'transparent',
        color: 'var(--color-link)',
        fontSize: 14,
        fontWeight: 600,
        fontFamily: 'var(--font-primary)',
        textDecoration: 'underline',
        textUnderlineOffset: 3,
        cursor: 'pointer',
        flexShrink: 0,
      }}
    >
      {children}
    </button>
  );
}

/** A link inside a sentence. */
export function InlineLink({ children, onClick }: { children: ReactNode; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        display: 'inline',
        padding: 0,
        border: 'none',
        background: 'transparent',
        color: 'var(--color-link)',
        font: 'inherit',
        fontWeight: 600,
        textDecoration: 'underline',
        textUnderlineOffset: 3,
        cursor: 'pointer',
      }}
    >
      {children}
    </button>
  );
}

/** One answer per item, as full-width radio rows. */
export function ChoiceList({ label, choices, value, onChange }: { label: string; choices: Choice[]; value: string | undefined; onChange: (id: string) => void }) {
  const name = useId();
  return (
    <div role="radiogroup" aria-label={label} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {choices.map(c => {
        const on = c.id === value;
        return (
          <label
            key={c.id}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              minHeight: 40,
              padding: '8px 12px',
              borderRadius: 12,
              border: on ? `2px solid ${C.navy}` : `1.5px solid ${C.border}`,
              background: '#fff',
              cursor: 'pointer',
              fontSize: 14,
              fontWeight: on ? 600 : 500,
              color: C.ink,
              lineHeight: 1.35,
            }}
          >
            <input
              type="radio"
              name={name}
              checked={on}
              onChange={() => onChange(c.id)}
              style={{ width: 18, height: 18, margin: 0, accentColor: '#001C35', flexShrink: 0, cursor: 'pointer' }}
            />
            <span>{keepIds(c.label)}</span>
          </label>
        );
      })}
    </div>
  );
}

const LIST_HEIGHT = 400;
const LIST_ROOM = LIST_HEIGHT + 20;

/** The nearest ancestor that scrolls, which is what clips an open list. */
function scrollBox(el: HTMLElement): HTMLElement | null {
  for (let p = el.parentElement; p; p = p.parentElement) {
    if (/(auto|scroll)/.test(getComputedStyle(p).overflowY)) return p;
  }
  return null;
}

const srOnly: CSSProperties = { position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)', whiteSpace: 'nowrap' };

/**
 * One of a few choices, each with a second line, under group headings.
 * Choices without a group sit last, below a rule. A listbox, so arrow keys,
 * Enter and Escape work and screen readers hear the label and the pick.
 */
export function Picker({
  label,
  context,
  placeholder,
  choices,
  value,
  onChange,
}: {
  label: string;
  /** Said to screen readers after the label, so two pickers on a page don't sound the same. */
  context?: string;
  placeholder: string;
  choices: Choice[];
  value: string | undefined;
  onChange: (id: string) => void;
}) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [keyed, setKeyed] = useState(false);
  const [above, setAbove] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const groups = [...new Set(choices.flatMap(c => (c.group ? [c.group] : [])))];
  const ordered = [...groups.flatMap(g => choices.filter(c => c.group === g)), ...choices.filter(c => !c.group)];
  const chosen = choices.find(c => c.id === value);
  const optionId = (i: number) => `${id}-o${i}`;

  const show = (fromKeys: boolean) => {
    const trigger = triggerRef.current;
    if (trigger) {
      const room = () => {
        const r = trigger.getBoundingClientRect();
        const box = scrollBox(trigger)?.getBoundingClientRect() ?? { top: 0, bottom: window.innerHeight };
        return { below: box.bottom - r.bottom, above: r.top - box.top };
      };
      if (room().below < LIST_ROOM) rootRef.current?.scrollIntoView({ block: 'start' });
      const { below, above: overhead } = room();
      setAbove(below < LIST_ROOM && overhead > below);
    }
    setActive(Math.max(0, ordered.findIndex(c => c.id === value)));
    setKeyed(fromKeys);
    setOpen(true);
  };
  const close = () => {
    setOpen(false);
    triggerRef.current?.focus();
  };
  const pick = (c: Choice) => {
    onChange(c.id);
    close();
  };

  useEffect(() => {
    if (!open) return;
    listRef.current?.focus();
    const onDown = (e: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener('pointerdown', onDown);
    return () => window.removeEventListener('pointerdown', onDown);
  }, [open]);

  useEffect(() => {
    if (open) document.getElementById(optionId(active))?.scrollIntoView({ block: 'nearest' });
  });

  const onListKey = (e: KeyEvent) => {
    const last = ordered.length - 1;
    const move = (i: number) => {
      e.preventDefault();
      setKeyed(true);
      setActive(Math.max(0, Math.min(last, i)));
    };
    if (e.key === 'ArrowDown') move(active + 1);
    else if (e.key === 'ArrowUp') move(active - 1);
    else if (e.key === 'Home') move(0);
    else if (e.key === 'End') move(last);
    else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      pick(ordered[active]);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      close();
    } else if (e.key === 'Tab') setOpen(false);
  };

  const option = (c: Choice) => {
    const i = ordered.indexOf(c);
    const on = c.id === value;
    const hot = i === active;
    return (
      <div
        key={c.id}
        id={optionId(i)}
        role="option"
        aria-selected={on}
        onClick={() => pick(c)}
        onPointerMove={() => {
          setKeyed(false);
          setActive(i);
        }}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          minHeight: 48,
          padding: '8px 10px',
          borderRadius: 8,
          background: hot ? C.page : '#fff',
          boxShadow: hot && keyed ? `inset 0 0 0 2px ${C.navy}` : 'none',
          cursor: 'pointer',
        }}
      >
        <span style={{ flex: 1, minWidth: 0 }}>
          <span style={{ display: 'block', fontSize: 15, fontWeight: on ? 600 : 500, color: C.ink, lineHeight: 1.3 }}>{keepIds(c.label)}</span>
          {c.detail && <span style={{ display: 'block', fontSize: 13, color: C.muted, lineHeight: 1.35, marginTop: 1 }}>{c.detail}</span>}
        </span>
        {on && <Check size={18} aria-hidden style={{ flexShrink: 0, color: C.navy }} />}
      </div>
    );
  };

  return (
    <div ref={rootRef} style={{ position: 'relative', scrollMarginTop: 16 }}>
      <div id={`${id}-label`} style={{ fontSize: 14, fontWeight: 600, marginBottom: 6 }}>
        {label}
        {context && <span style={srOnly}> {context}</span>}
      </div>
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? `${id}-list` : undefined}
        aria-labelledby={`${id}-label ${id}-value`}
        onClick={() => (open ? setOpen(false) : show(false))}
        onKeyDown={e => {
          if (!open && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
            e.preventDefault();
            show(true);
          }
        }}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          width: '100%',
          minHeight: 48,
          padding: '6px 12px 6px 14px',
          borderRadius: 12,
          border: open ? `2px solid ${C.navy}` : `1.5px solid ${C.border}`,
          background: '#fff',
          textAlign: 'left',
          fontFamily: 'var(--font-primary)',
          color: C.ink,
          cursor: 'pointer',
        }}
      >
        <span id={`${id}-value`} style={{ flex: 1, minWidth: 0 }}>
          {chosen ? (
            <>
              <span style={{ display: 'block', fontSize: 15, fontWeight: 600, lineHeight: 1.3 }}>{keepIds(chosen.label)}</span>
              {chosen.detail && <span style={{ display: 'block', fontSize: 13, color: C.muted, lineHeight: 1.35 }}>{chosen.detail}</span>}
            </>
          ) : (
            <span style={{ fontSize: 16, color: C.muted }}>{placeholder}</span>
          )}
        </span>
        <ChevronDown size={20} aria-hidden style={{ flexShrink: 0, color: C.ink, transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 120ms' }} />
      </button>
      {open && (
        <div
          ref={listRef}
          id={`${id}-list`}
          role="listbox"
          tabIndex={-1}
          aria-labelledby={`${id}-label`}
          aria-activedescendant={optionId(active)}
          onKeyDown={onListKey}
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            ...(above ? { bottom: 'calc(100% + 6px)' } : { top: 'calc(100% + 6px)' }),
            zIndex: 30,
            maxHeight: LIST_HEIGHT,
            overflowY: 'auto',
            padding: 6,
            background: '#fff',
            border: `1px solid ${C.border}`,
            borderRadius: 12,
            boxShadow: '0 12px 32px rgba(0,28,53,0.18)',
            outline: 'none',
          }}
        >
          {groups.map(g => (
            <div key={g} role="group" aria-labelledby={`${id}-g-${groups.indexOf(g)}`}>
              <div id={`${id}-g-${groups.indexOf(g)}`} style={{ padding: '8px 10px 4px', fontSize: 12, fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase', color: C.muted }}>
                {keepIds(g)}
              </div>
              {choices.filter(c => c.group === g).map(option)}
            </div>
          ))}
          {choices.some(c => !c.group) && (
            <>
              {groups.length > 0 && <div aria-hidden style={{ height: 1, background: C.subtle, margin: '6px 4px' }} />}
              {choices.filter(c => !c.group).map(option)}
            </>
          )}
        </div>
      )}
    </div>
  );
}

export function Stepper({ value, onChange, min = 0, max = 999, label }: { value: number; onChange: (v: number) => void; min?: number; max?: number; label: string }) {
  const btn: CSSProperties = {
    width: 48,
    height: 48,
    borderRadius: 12,
    border: `1.5px solid ${C.border}`,
    background: '#fff',
    color: C.ink,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
  };
  const set = (v: number) => onChange(Math.max(min, Math.min(max, v)));
  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
      <button type="button" aria-label={`One less, ${label}`} onClick={() => set(value - 1)} disabled={value <= min} style={{ ...btn, opacity: value <= min ? 0.45 : 1 }}>
        <Minus size={20} />
      </button>
      <input
        type="number"
        inputMode="numeric"
        aria-label={label}
        value={value}
        onChange={e => set(Number(e.target.value) || 0)}
        style={{
          width: 72,
          height: 48,
          textAlign: 'center',
          borderRadius: 12,
          border: `1.5px solid ${C.border}`,
          fontSize: 18,
          fontWeight: 600,
          fontFamily: 'var(--font-primary)',
          color: C.ink,
        }}
      />
      <button type="button" aria-label={`One more, ${label}`} onClick={() => set(value + 1)} disabled={value >= max} style={{ ...btn, opacity: value >= max ? 0.45 : 1 }}>
        <Plus size={20} />
      </button>
    </div>
  );
}

export const inputStyle: CSSProperties = {
  width: '100%',
  minWidth: 0,
  height: 48,
  padding: '0 14px',
  borderRadius: 12,
  border: `1.5px solid ${C.border}`,
  fontSize: 16,
  fontFamily: 'var(--font-primary)',
  color: C.ink,
  background: '#fff',
};

/** A labelled form field. The label wraps the control so tapping it focuses the input. */
export function Field({
  label,
  hint,
  required,
  error,
  children,
  style,
}: {
  label: string;
  hint?: ReactNode;
  required?: boolean;
  error?: string;
  children: ReactNode;
  style?: CSSProperties;
}) {
  return (
    <label style={{ display: 'block', ...style }}>
      <span style={{ display: 'block', fontSize: 14, fontWeight: 600, marginBottom: 6 }}>
        {label}
        {required && <span aria-hidden style={{ color: '#B42318' }}> *</span>}
      </span>
      {children}
      {error && <span style={{ display: 'block', fontSize: 14, fontWeight: 600, color: '#B42318', marginTop: 6, lineHeight: 1.4 }}>{error}</span>}
      {hint && <span style={{ display: 'block', fontSize: 14, color: C.muted, marginTop: 6, lineHeight: 1.4 }}>{hint}</span>}
    </label>
  );
}

/** Two or three mutually exclusive options as side-by-side buttons. */
export function Segmented<T extends string>({ label, value, options, onChange }: { label: string; value: T; options: { id: T; label: string }[]; onChange: (v: T) => void }) {
  return (
    <div role="radiogroup" aria-label={label} style={{ display: 'flex', gap: 8 }}>
      {options.map(o => {
        const on = o.id === value;
        return (
          <button
            key={o.id}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => onChange(o.id)}
            style={{
              flex: 1,
              minHeight: 48,
              padding: '8px 12px',
              borderRadius: 12,
              border: on ? `2px solid ${C.navy}` : `1.5px solid ${C.border}`,
              background: on ? C.navy : '#fff',
              color: on ? '#fff' : C.ink,
              fontSize: 15,
              fontWeight: 600,
              fontFamily: 'var(--font-primary)',
              cursor: 'pointer',
            }}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

/** The line, cut out of the actual photo at a readable size. Scrolls sideways when wider than the screen. */
export function LineCrop({ sample, lineId, alt, scale = 0.85 }: { sample: Sample; lineId: string; alt: string; scale?: number }) {
  const photo = photoFor(sample);
  const box = photo?.lines[lineId];
  if (!photo || !box) return null;
  const page = photo.pages[box.page - 1];
  const px = 12;
  const py = 3;
  const w = (box.w + px * 2) * scale;
  const h = (box.h + py * 2) * scale;
  return (
    <div style={{ overflowX: 'auto', borderRadius: 10, border: `1px solid ${C.subtle}`, background: '#ddd' }}>
      <div style={{ position: 'relative', width: w, height: h, overflow: 'hidden' }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={page.src}
          alt={alt}
          style={{
            position: 'absolute',
            width: page.width * scale,
            maxWidth: 'none',
            left: -(box.x - px) * scale,
            top: -(box.y - py) * scale,
          }}
        />
      </div>
    </div>
  );
}

function useEscape(onClose: () => void) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
}

/** A centred dialog over the page it was opened from. */
export function Popup({ label, onClose, children }: { label: string; onClose: () => void; children: ReactNode }) {
  const focused = useRef(false);
  const ref = (el: HTMLDivElement | null) => {
    if (el && !focused.current) {
      focused.current = true;
      el.focus();
    }
  };
  useEscape(onClose);
  return (
    <Layer label={label} background="rgba(0,28,53,0.45)">
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, minHeight: 0 }} onClick={onClose}>
        <div
          ref={ref}
          role="dialog"
          aria-modal="true"
          aria-label={label}
          tabIndex={-1}
          onClick={e => e.stopPropagation()}
          style={{
            width: 'min(640px, 100%)',
            maxHeight: '100%',
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
            background: '#fff',
            borderRadius: 18,
            boxShadow: '0 16px 48px rgba(0,28,53,0.24)',
            outline: 'none',
          }}
        >
          {children}
        </div>
      </div>
    </Layer>
  );
}

/** Bottom sheet on a phone, centred dialog on a bigger screen. */
export function Sheet({
  title,
  subtitle,
  onClose,
  children,
  footer,
  isPhone,
  placement = 'center',
  width = 480,
}: {
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  isPhone: boolean;
  /** 'right' keeps a pinned photo on the left in view. */
  placement?: 'center' | 'right';
  width?: number;
}) {
  const right = !isPhone && placement === 'right';
  const titleId = useId();
  const focused = useRef(false);
  const ref = (el: HTMLDivElement | null) => {
    if (el && !focused.current) {
      focused.current = true;
      el.focus();
    }
  };
  useEscape(onClose);
  return (
    <Layer z={1100} background={right ? 'rgba(0,28,53,0.18)' : 'rgba(0,28,53,0.45)'}>
      <div
        style={{ flex: 1, display: 'flex', alignItems: isPhone ? 'flex-end' : 'center', justifyContent: right ? 'flex-end' : 'center', paddingRight: right ? 48 : 0 }}
        onClick={onClose}
      >
        <div
          ref={ref}
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          tabIndex={-1}
          onClick={e => e.stopPropagation()}
          style={{
            width: isPhone ? '100%' : `min(${width}px, calc(100vw - 48px))`,
            maxHeight: isPhone ? '92vh' : '86vh',
            display: 'flex',
            flexDirection: 'column',
            background: '#fff',
            borderRadius: isPhone ? '20px 20px 0 0' : 18,
            boxShadow: '0 -8px 32px rgba(0,28,53,0.18)',
            outline: 'none',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: '16px 12px 8px 20px' }}>
            <div style={{ flex: 1, minWidth: 0, paddingTop: 8 }}>
              <h2 id={titleId} style={{ margin: 0, fontSize: 20, fontWeight: 600, lineHeight: 1.25 }}>{title}</h2>
              {subtitle && <div style={{ fontSize: 14, color: C.muted, marginTop: 4, lineHeight: 1.4 }}>{keepIds(subtitle)}</div>}
            </div>
            <IconButton label="Close" onClick={onClose}>
              <X size={22} />
            </IconButton>
          </div>
          <div style={{ overflowY: 'auto', padding: '8px 20px 16px' }}>{children}</div>
          {footer && <div style={{ padding: '12px 20px calc(16px + env(safe-area-inset-bottom))', borderTop: `1px solid ${C.subtle}` }}>{footer}</div>}
        </div>
      </div>
    </Layer>
  );
}

/** The whole photo, full screen, with the line you came from outlined. */
export function PhotoViewer({ sample, focusLineId, onClose }: { sample: Sample; focusLineId?: string; onClose: () => void }) {
  const photo = photoFor(sample);
  const [zoom, setZoom] = useState(1);
  const scrolled = useRef(false);
  const focusRef = (el: HTMLDivElement | null) => {
    if (el && !scrolled.current) {
      scrolled.current = true;
      requestAnimationFrame(() => el.scrollIntoView({ block: 'center' }));
    }
  };
  useEscape(onClose);
  if (!photo) return null;
  const box = focusLineId ? photo.lines[focusLineId] : undefined;
  return (
    <Layer z={1200} background="#0b0f14" label="Photo">
      <div role="dialog" aria-modal="true" aria-label="Photo of the paperwork" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '8px 8px', color: '#fff' }}>
          <IconButton label="Close photo" onClick={onClose} tone="dark">
            <X size={22} />
          </IconButton>
          <div style={{ flex: 1, fontSize: 16, fontWeight: 600, paddingLeft: 8 }}>
            {photo.pages.length > 1 ? `${photo.pages.length} pages` : 'Photo'}
          </div>
          <IconButton label="Zoom out" onClick={() => setZoom(z => Math.max(1, z - 0.5))} tone="dark">
            <ZoomOut size={20} />
          </IconButton>
          <IconButton label="Zoom in" onClick={() => setZoom(z => Math.min(3, z + 0.5))} tone="dark">
            <ZoomIn size={20} />
          </IconButton>
        </div>
        <div style={{ flex: 1, overflow: 'auto', padding: '8px 12px 24px' }}>
          {photo.pages.map((p, i) => (
            <div key={p.src} style={{ position: 'relative', width: `min(${100 * zoom}%, ${900 * zoom}px)`, margin: '0 auto 12px' }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={p.src} alt={`Page ${i + 1} of the paperwork`} style={{ width: '100%', aspectRatio: `${p.width} / ${p.height}`, display: 'block', borderRadius: 6 }} />
              {box && box.page === i + 1 && (
                <div
                  ref={focusRef}
                  aria-hidden
                  style={{
                    position: 'absolute',
                    left: `${((box.x - 6) / p.width) * 100}%`,
                    top: `${((box.y - 4) / p.height) * 100}%`,
                    width: `${((box.w + 12) / p.width) * 100}%`,
                    height: `${((box.h + 8) / p.height) * 100}%`,
                    border: '3px solid #001C35',
                    background: 'rgba(255,192,96,0.28)',
                    borderRadius: 4,
                  }}
                />
              )}
            </div>
          ))}
        </div>
      </div>
    </Layer>
  );
}
