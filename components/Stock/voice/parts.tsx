'use client';

/**
 * Presentational pieces of the voice stocktake. State lives in
 * VoiceStocktake; everything here renders props and reports taps.
 */

import { forwardRef, useCallback, useEffect, useRef, useSyncExternalStore, type Ref } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import {
  Check,
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  CircleHelp,
  Keyboard,
  LayoutGrid,
  List,
  Mic,
  MicOff,
  Pause,
  Pencil,
  Play,
  RotateCcw,
  Volume2,
  X,
} from 'lucide-react';
import {
  describeQty,
  questionPrompt,
  type AreaProgress,
  type Capture,
  type Heard,
  type Question,
  type VoiceArea,
  type VoiceIndex,
  type VoiceItem,
} from './engine';

// Scoped to the voice stocktake; the rest of /stock keeps the app palette.
export const T = {
  navy: '#08205E',
  dark: '#0C318D',
  bright: '#4374EF',
  lighter: '#C7D5FA',
  surface: '#F1F4FB',
  yellow: '#F9EDD2',
  pink: '#FF315D',
  lightPink: '#FFCCD7',
  lightestPink: '#FFFAFB',
  caption: '#4A5578',
  hair: '#E6EAF5',
  white: '#FFFFFF',
} as const;

export const visuallyHidden: React.CSSProperties = {
  position: 'absolute',
  width: 1,
  height: 1,
  padding: 0,
  margin: -1,
  overflow: 'hidden',
  clip: 'rect(0 0 0 0)',
  whiteSpace: 'nowrap',
  border: 0,
};

const pill = 999;

export const buttonReset: React.CSSProperties = {
  fontFamily: 'var(--font-primary)',
  cursor: 'pointer',
  border: 'none',
  background: 'none',
  color: 'inherit',
};

/** Landscape iPads and laptops get the two-pane layout. */
export const WIDE_QUERY = '(min-width: 1024px)';

export function useMediaQuery(query: string): boolean {
  const subscribe = useCallback(
    (onChange: () => void) => {
      const m = window.matchMedia(query);
      m.addEventListener('change', onChange);
      return () => m.removeEventListener('change', onChange);
    },
    [query],
  );
  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(query).matches,
    () => false,
  );
}

export function formatTime(iso: string): string {
  const d = new Date(iso);
  return `${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`;
}

// ─── Header bits ──────────────────────────────────────────────────────────────

export type PillMode = 'listening' | 'paused' | 'recording' | 'micOff' | 'done';

export function StatusPill({ mode, label }: { mode: PillMode; label: string }) {
  const styles: Record<PillMode, { bg: string; dot: string }> = {
    listening: { bg: T.lighter, dot: T.bright },
    paused: { bg: T.hair, dot: T.caption },
    recording: { bg: T.lightPink, dot: T.pink },
    micOff: { bg: T.hair, dot: T.caption },
    done: { bg: T.yellow, dot: T.dark },
  };
  const s = styles[mode];
  return (
    <span
      role="status"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        height: 28,
        padding: '0 12px',
        borderRadius: pill,
        background: s.bg,
        color: T.navy,
        fontSize: 12,
        fontWeight: 600,
        whiteSpace: 'nowrap',
        fontVariantNumeric: 'tabular-nums',
      }}
    >
      <span aria-hidden style={{ width: 8, height: 8, borderRadius: '50%', background: s.dot }} />
      {label}
    </span>
  );
}

export function Waveform({ active, color = T.white }: { active: boolean; color?: string }) {
  const reduce = useReducedMotion();
  const bars = [0, 1, 2, 3, 4];
  return (
    <span aria-hidden style={{ display: 'inline-flex', alignItems: 'center', gap: 3, height: 28 }}>
      {bars.map(i => {
        const rest = [10, 18, 26, 18, 10][i];
        return (
          <motion.span
            key={i}
            animate={active && !reduce ? { height: [rest * 0.5, rest, rest * 0.4, rest * 0.85, rest * 0.5] } : { height: rest * 0.6 }}
            transition={active && !reduce ? { duration: 1 + i * 0.09, repeat: Infinity, ease: 'easeInOut' } : { duration: 0.2 }}
            style={{ width: 4, borderRadius: 2, background: color, display: 'block' }}
          />
        );
      })}
    </span>
  );
}

// ─── Area strip ───────────────────────────────────────────────────────────────

interface AreaStripProps {
  areas: VoiceArea[];
  progress: Record<string, AreaProgress>;
  currentId: string;
  onSelect: (id: string) => void;
  onOpenAll: () => void;
}

export const AreaStrip = forwardRef<HTMLButtonElement, AreaStripProps>(function AreaStrip(
  { areas, progress, currentId, onSelect, onOpenAll },
  allRef,
) {
  const chipRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const reduce = useReducedMotion();
  useEffect(() => {
    chipRefs.current[currentId]?.scrollIntoView({
      inline: 'center',
      block: 'nearest',
      behavior: reduce ? 'auto' : 'smooth',
    });
  }, [currentId, reduce]);

  return (
    <nav aria-label="Storage areas" style={{ display: 'flex', gap: 8, overflowX: 'auto', padding: '2px 16px 4px', scrollbarWidth: 'none' }}>
      <button
        ref={allRef}
        type="button"
        onClick={onOpenAll}
        aria-label="All areas"
        style={{
          ...buttonReset,
          flex: '0 0 auto',
          width: 44,
          height: 44,
          borderRadius: pill,
          border: `1px solid ${T.hair}`,
          background: T.white,
          color: T.navy,
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <LayoutGrid size={18} />
      </button>
      {areas.map(area => {
        const p = progress[area.id];
        const current = area.id === currentId;
        let bg: string = T.white;
        let border: string = T.hair;
        let color: string = T.navy;
        let lead: React.ReactNode = null;
        let tail: React.ReactNode = null;
        let described = '';
        if (current) {
          bg = T.navy;
          border = T.navy;
          color = T.white;
          tail = <span style={{ fontWeight: 500 }}>{p.counted}/{p.total}</span>;
          described = `current, ${p.counted} of ${p.total} counted`;
        } else if (p.state === 'done') {
          bg = T.yellow;
          border = T.yellow;
          lead = <Check size={16} strokeWidth={2.6} color={T.dark} aria-hidden />;
          described = 'done';
        } else if (p.state === 'finishedMissing') {
          bg = T.lightestPink;
          border = T.lightPink;
          lead = <span aria-hidden style={{ width: 8, height: 8, borderRadius: '50%', background: T.pink }} />;
          described = `finished, ${p.uncounted.length} uncounted`;
        } else if (p.state === 'inProgress') {
          tail = <span style={{ color: T.caption, fontWeight: 500 }}>{p.counted}/{p.total}</span>;
          described = p.queued ? 'recording queued' : `${p.counted} of ${p.total} counted`;
        } else {
          tail = <span style={{ color: T.caption, fontWeight: 500 }}>{p.total}</span>;
          described = `not started, ${p.total} items`;
        }
        return (
          <button
            key={area.id}
            ref={el => {
              chipRefs.current[area.id] = el;
            }}
            type="button"
            onClick={() => onSelect(area.id)}
            aria-current={current ? 'location' : undefined}
            aria-label={`${area.name}, ${described}`}
            style={{
              ...buttonReset,
              flex: '0 0 auto',
              height: 44,
              padding: '0 16px',
              borderRadius: pill,
              border: `1px solid ${border}`,
              background: bg,
              color,
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              fontSize: 13,
              fontWeight: 600,
              whiteSpace: 'nowrap',
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {lead}
            {area.name}
            {tail}
          </button>
        );
      })}
    </nav>
  );
});

export function ProgressLine({ name, right, fraction }: { name: string; right: string; fraction: number }) {
  return (
    <div style={{ padding: '0 16px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12 }}>
        <h2 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: T.navy }}>{name}</h2>
        <span style={{ fontSize: 13, color: T.caption, fontVariantNumeric: 'tabular-nums' }}>{right}</span>
      </div>
      <div
        role="progressbar"
        aria-label={`${name} progress`}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(fraction * 100)}
        style={{ marginTop: 8, height: 6, borderRadius: 3, background: T.lighter, overflow: 'hidden' }}
      >
        <div style={{ width: `${Math.min(fraction, 1) * 100}%`, height: '100%', background: T.bright, transition: 'width 300ms ease' }} />
      </div>
    </div>
  );
}

export function TabSwitch({
  tab,
  onChange,
  missed,
}: {
  tab: 'count' | 'review';
  onChange: (t: 'count' | 'review') => void;
  missed: number;
}) {
  const side = (id: 'count' | 'review', label: React.ReactNode) => {
    const on = tab === id;
    return (
      <button
        type="button"
        aria-pressed={on}
        onClick={() => onChange(id)}
        style={{
          ...buttonReset,
          flex: 1,
          height: 40,
          borderRadius: pill,
          background: on ? T.navy : 'transparent',
          color: on ? T.white : T.navy,
          fontSize: 14,
          fontWeight: 600,
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
        }}
      >
        {label}
      </button>
    );
  };
  return (
    <div role="group" aria-label="Count or review" style={{ margin: '0 16px', padding: 2, borderRadius: pill, background: T.surface, display: 'flex', minHeight: 44 }}>
      {side('count', 'Count')}
      {side(
        'review',
        <>
          Review
          {missed > 0 && (
            <span style={{ padding: '2px 8px', borderRadius: pill, background: T.lightPink, color: T.navy, fontSize: 11, fontWeight: 700 }}>
              {missed} missed
            </span>
          )}
        </>,
      )}
    </div>
  );
}

// ─── Heard strip ──────────────────────────────────────────────────────────────

export function HeardStrip({
  heard,
  interim,
  hint,
  focusName,
  onCancelFocus,
  micOn = true,
}: {
  heard: Heard | null;
  interim: string;
  hint: string;
  focusName?: string;
  onCancelFocus: () => void;
  /** Idle label reads "Ready" rather than "Listening" when nothing is listening. */
  micOn?: boolean;
}) {
  const label = focusName ? 'Count it' : interim ? 'Hearing' : heard ? 'Heard' : micOn ? 'Listening' : 'Ready';
  const Icon = heard?.tone === 'ask' ? CircleHelp : heard?.tone === 'miss' ? CircleAlert : Check;
  return (
    <section aria-label="What Edify heard" style={{ margin: '0 16px', padding: '12px 14px', borderRadius: 14, background: T.surface }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
        <SectionLabel as="span">{label}</SectionLabel>
        {focusName && (
          <button type="button" onClick={onCancelFocus} style={{ ...buttonReset, minHeight: 44, padding: '0 4px', fontSize: 13, fontWeight: 600, color: T.dark }}>
            Cancel
          </button>
        )}
      </div>
      {focusName ? (
        <p style={{ margin: '2px 0 0', fontSize: 15, fontWeight: 600, color: T.navy }}>Say how many {focusName}.</p>
      ) : interim ? (
        <p style={{ margin: '4px 0 0', fontSize: 14, fontStyle: 'italic', color: T.navy }}>&ldquo;{interim}&rdquo;</p>
      ) : heard ? (
        <>
          <p style={{ margin: '4px 0 0', fontSize: 14, fontStyle: 'italic', color: T.navy }}>&ldquo;{heard.utterance}&rdquo;</p>
          <p style={{ margin: '6px 0 0', display: 'flex', gap: 6, alignItems: 'flex-start', fontSize: 14, fontWeight: 600, color: T.navy }}>
            <Icon size={16} strokeWidth={2.4} color={heard.tone === 'ok' ? T.dark : T.caption} aria-hidden style={{ flex: '0 0 auto', marginTop: 2 }} />
            <span>{heard.result}</span>
          </p>
        </>
      ) : (
        <p style={{ margin: '4px 0 0', fontSize: 14, color: T.caption }}>{hint}</p>
      )}
    </section>
  );
}

export function SectionLabel({ children, as = 'h3' }: { children: React.ReactNode; as?: 'h3' | 'span' }) {
  const El = as;
  return (
    <El style={{ margin: 0, fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: T.caption }}>
      {children}
    </El>
  );
}

// ─── Rows ─────────────────────────────────────────────────────────────────────

export function ItemRow({
  item,
  right,
  focused,
}: {
  item: VoiceItem;
  right: React.ReactNode;
  focused?: boolean;
}) {
  return (
    <li
      id={`vs-row-${item.id}`}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 12,
        minHeight: 56,
        padding: '10px 12px',
        borderRadius: 12,
        borderBottom: focused ? undefined : `1px solid ${T.hair}`,
        outline: focused ? `2px solid ${T.bright}` : undefined,
        outlineOffset: -2,
        background: focused ? T.surface : T.white,
      }}
    >
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: T.navy }}>{item.name}</div>
        <div style={{ fontSize: 12, color: T.caption, marginTop: 2 }}>
          {item.countable ? item.packLine : 'Set a counting unit first'}
        </div>
      </div>
      <div style={{ flex: '0 0 auto', fontSize: 13, color: T.caption, textAlign: 'right' }}>{right}</div>
    </li>
  );
}

export function CountedRow({
  item,
  capture,
  onEdit,
}: {
  item: VoiceItem;
  capture: Capture;
  onEdit?: () => void;
}) {
  const reduce = useReducedMotion();
  const q = describeQty(item, capture.baseQty);
  const said = capture.source === 'grid' ? capture.utterance : `“${capture.utterance}”`;
  return (
    <motion.li
      layout={!reduce}
      initial={reduce ? false : { opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      id={`vs-row-${item.id}`}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        minHeight: 56,
        padding: '10px 12px',
        borderRadius: 12,
        background: T.yellow,
        listStyle: 'none',
      }}
    >
      <Check size={16} strokeWidth={2.6} color={T.dark} aria-hidden style={{ flex: '0 0 auto' }} />
      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: T.navy }}>{item.name}</div>
        <div style={{ fontSize: 12, fontStyle: capture.source === 'grid' ? 'normal' : 'italic', color: T.caption, marginTop: 2 }}>{said}</div>
      </div>
      <div style={{ flex: '0 0 auto', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: T.navy }}>{q.primary}</div>
        {q.secondary && <div style={{ fontSize: 12, color: T.caption }}>{q.secondary}</div>}
      </div>
      {onEdit && (
        <button
          type="button"
          onClick={onEdit}
          aria-label={`Edit ${item.name}`}
          style={{ ...buttonReset, width: 44, height: 44, borderRadius: pill, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: T.dark }}
        >
          <Pencil size={16} />
        </button>
      )}
    </motion.li>
  );
}

// ─── Questions ────────────────────────────────────────────────────────────────

export function QuestionCard({
  question,
  index,
  onChoose,
  onDismiss,
}: {
  question: Question;
  index: VoiceIndex;
  onChoose: (choice: string) => void;
  onDismiss: () => void;
}) {
  const item = question.itemId ? index.items.get(question.itemId) : undefined;
  const options =
    question.kind === 'unit' && item
      ? question.candidates.map(cell => {
          const u = item.units.find(x => x.cell === cell);
          return { id: cell, label: u ? u.many : cell };
        })
      : question.kind === 'otherArea'
        ? [{ id: question.candidates[0], label: 'Count it there' }]
        : question.candidates.map(id => ({ id, label: index.items.get(id)?.name ?? id }));
  return (
    <li
      style={{
        listStyle: 'none',
        padding: 14,
        borderRadius: 14,
        background: T.lightestPink,
        border: `1px solid ${T.lightPink}`,
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'flex-start' }}>
        <p style={{ margin: 0, fontSize: 14, color: T.navy }}>
          <span style={{ fontStyle: 'italic' }}>&ldquo;{question.utterance}&rdquo;</span>{' '}
          <strong>{questionPrompt(question, index)}</strong>
        </p>
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Dismiss question, leave uncounted"
          style={{ ...buttonReset, flex: '0 0 auto', width: 44, height: 44, marginTop: -10, marginRight: -10, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: T.caption }}
        >
          <X size={16} />
        </button>
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 10 }}>
        {options.map(o => (
          <button
            key={o.id}
            type="button"
            onClick={() => onChoose(o.id)}
            style={{
              ...buttonReset,
              minHeight: 44,
              padding: '0 18px',
              borderRadius: pill,
              border: `1px solid ${T.navy}`,
              background: T.white,
              color: T.navy,
              fontSize: 13,
              fontWeight: 600,
            }}
          >
            {o.label}
          </button>
        ))}
      </div>
    </li>
  );
}

// ─── Guide me ─────────────────────────────────────────────────────────────────

export function GuideCard({
  item,
  chips,
  onChip,
}: {
  item: VoiceItem;
  chips: string[];
  onChip: (text: string) => void;
}) {
  return (
    <section aria-live="polite" style={{ margin: '0 16px', padding: 16, borderRadius: 14, background: T.dark, color: T.white }}>
      <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase' }}>Next</span>
      <h3 style={{ margin: '4px 0 0', fontSize: 22, fontWeight: 700, lineHeight: 1.2 }}>How many {item.name}?</h3>
      <p style={{ margin: '4px 0 0', fontSize: 13 }}>{item.packLine}</p>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 12 }}>
        {chips.map(c => (
          <button
            key={c}
            type="button"
            onClick={() => onChip(c)}
            style={{
              ...buttonReset,
              minHeight: 44,
              padding: '0 14px',
              borderRadius: pill,
              border: `1px solid ${T.white}`,
              color: T.white,
              fontSize: 13,
              fontWeight: 600,
            }}
          >
            &ldquo;{c}&rdquo;
          </button>
        ))}
      </div>
    </section>
  );
}

// ─── Control bar ──────────────────────────────────────────────────────────────

const sideButton = (on: boolean): React.CSSProperties => ({
  ...buttonReset,
  width: 92,
  height: 56,
  borderRadius: pill,
  border: `1px solid ${on ? T.navy : T.lighter}`,
  background: on ? T.navy : T.white,
  color: on ? T.white : T.navy,
  display: 'inline-flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 2,
  fontSize: 12,
  fontWeight: 600,
});

export function ControlBar({
  listening,
  recording,
  guide,
  showType,
  onTogglePause,
  onToggleGuide,
  onDoneArea,
  onToggleType,
  onUseGrid,
  typeSlot,
}: {
  listening: boolean;
  recording: boolean;
  guide: boolean;
  showType: boolean;
  onTogglePause: () => void;
  onToggleGuide: () => void;
  onDoneArea: () => void;
  onToggleType: () => void;
  onUseGrid: () => void;
  typeSlot: React.ReactNode;
}) {
  const centreLabel = recording
    ? listening
      ? 'Recording. Tap to pause recording'
      : 'Recording paused. Tap to keep recording'
    : listening
      ? 'Listening. Tap to stop listening'
      : 'Paused. Tap to start listening';
  return (
    <div style={{ background: T.white, boxShadow: '0 -6px 20px rgba(8, 32, 94, 0.08)', padding: '12px 16px max(8px, env(safe-area-inset-bottom))' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', maxWidth: 420, margin: '0 auto' }}>
        <button type="button" onClick={onTogglePause} style={sideButton(false)}>
          {listening ? <Pause size={18} aria-hidden /> : <Play size={18} aria-hidden />}
          {listening ? 'Pause' : 'Resume'}
        </button>
        <button
          type="button"
          onClick={onTogglePause}
          aria-label={centreLabel}
          style={{
            ...buttonReset,
            width: 72,
            height: 72,
            borderRadius: '50%',
            background: recording ? T.navy : listening ? T.bright : T.dark,
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 8px 20px rgba(67, 116, 239, 0.35)',
          }}
        >
          {recording ? (
            <span aria-hidden style={{ width: 26, height: 26, borderRadius: '50%', background: T.pink, opacity: listening ? 1 : 0.6 }} />
          ) : (
            <Waveform active={listening} />
          )}
        </button>
        {recording ? (
          <button type="button" onClick={onDoneArea} style={sideButton(true)}>
            Done
            <span style={{ fontSize: 11, fontWeight: 500 }}>this area</span>
          </button>
        ) : (
          <button type="button" onClick={onToggleGuide} aria-pressed={guide} style={sideButton(guide)}>
            <Volume2 size={18} aria-hidden />
            Guide me
          </button>
        )}
      </div>
      {typeSlot}
      <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', columnGap: 4, marginTop: 4 }}>
        <button
          type="button"
          onClick={onToggleType}
          aria-expanded={showType}
          style={{ ...buttonReset, minHeight: 44, padding: '0 6px', display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 600, color: T.dark, whiteSpace: 'nowrap' }}
        >
          <Keyboard size={16} aria-hidden /> {showType ? 'Hide typing' : "Type what you'd say"}
        </button>
        <button
          type="button"
          onClick={onUseGrid}
          style={{ ...buttonReset, minHeight: 44, padding: '0 6px', display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 600, color: T.dark, whiteSpace: 'nowrap' }}
        >
          <List size={16} aria-hidden /> Count on a list
        </button>
      </div>
    </div>
  );
}

// ─── Demo controller ──────────────────────────────────────────────────────────

/** Only on `?demo=1`. Steps the scripted lines; dashed so it never reads
 *  as part of the product. */
export function DemoController({
  index,
  total,
  nextLabel,
  playing,
  micOn,
  onRestart,
  onBack,
  onNext,
  onTogglePlay,
  onToggleMic,
}: {
  index: number;
  total: number;
  nextLabel?: string;
  playing: boolean;
  micOn: boolean;
  onRestart: () => void;
  onBack: () => void;
  onNext: () => void;
  onTogglePlay: () => void;
  onToggleMic: () => void;
}) {
  const done = index >= total;
  const icon = (filled = false, disabled = false): React.CSSProperties => ({
    ...buttonReset,
    width: 44,
    height: 44,
    flex: '0 0 auto',
    borderRadius: '50%',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: filled ? T.navy : T.white,
    color: filled ? T.white : T.navy,
    border: `1px solid ${filled ? T.navy : T.lighter}`,
    opacity: disabled ? 0.45 : 1,
    cursor: disabled ? 'not-allowed' : 'pointer',
  });
  return (
    <div
      role="group"
      aria-label="Demo controls"
      style={{ margin: '0 16px 10px', padding: '6px 8px 6px 14px', borderRadius: 14, border: `1px dashed ${T.bright}`, background: T.surface, display: 'flex', flexWrap: 'wrap', alignItems: 'center', columnGap: 12, rowGap: 6 }}
    >
      <div style={{ flex: '1 1 200px', minWidth: 0 }}>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: T.dark }}>
          Demo · step {index} of {total}
        </div>
        <div aria-live="polite" style={{ fontSize: 13, color: T.navy, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {done ? 'End of the script. Restart, or try the mic.' : `Next: ${nextLabel}`}
        </div>
      </div>
      <div style={{ display: 'flex', gap: 6 }}>
        <button type="button" onClick={onRestart} disabled={index === 0} aria-label="Restart demo" title="Restart" style={icon(false, index === 0)}>
          <RotateCcw size={18} aria-hidden />
        </button>
        <button type="button" onClick={onBack} disabled={index === 0} aria-label="Previous step" title="Previous step (left arrow)" style={icon(false, index === 0)}>
          <ChevronLeft size={20} aria-hidden />
        </button>
        <button type="button" onClick={onTogglePlay} disabled={done} aria-label={playing ? 'Pause demo' : 'Play demo'} title={playing ? 'Pause' : 'Play through'} style={icon(false, done)}>
          {playing ? <Pause size={18} aria-hidden /> : <Play size={18} aria-hidden />}
        </button>
        <button type="button" onClick={onNext} disabled={done} aria-label="Next step" title="Next step (right arrow)" style={icon(true, done)}>
          <ChevronRight size={20} aria-hidden />
        </button>
        <button type="button" onClick={onToggleMic} aria-pressed={micOn} aria-label="Use my microphone" title={micOn ? 'Mic on' : 'Mic off'} style={icon(micOn)}>
          {micOn ? <Mic size={18} aria-hidden /> : <MicOff size={18} aria-hidden />}
        </button>
      </div>
    </div>
  );
}

// ─── All areas sheet ──────────────────────────────────────────────────────────

export function AllAreasSheet({
  areas,
  progress,
  currentId,
  highlightId,
  summaryLine,
  submitLabel,
  onPick,
  onClose,
  onSubmit,
  onUseGrid,
}: {
  areas: VoiceArea[];
  progress: Record<string, AreaProgress>;
  currentId: string;
  highlightId?: string;
  summaryLine: string;
  submitLabel?: string;
  onPick: (id: string) => void;
  onClose: () => void;
  onSubmit?: () => void;
  onUseGrid?: () => void;
}) {
  const closeRef = useRef<HTMLButtonElement>(null);
  const highlightRef = useRef<HTMLButtonElement>(null);
  const sheetRef = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();

  useEffect(() => {
    (highlightRef.current ?? closeRef.current)?.focus();
  }, []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
        return;
      }
      if (e.key !== 'Tab' || !sheetRef.current) return;
      const focusables = Array.from(sheetRef.current.querySelectorAll<HTMLElement>('button'));
      if (!focusables.length) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [onClose]);

  return (
    <div style={{ position: 'absolute', inset: 0, zIndex: 5, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
      <motion.div
        aria-hidden
        onClick={onClose}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        style={{ position: 'absolute', inset: 0, background: 'rgba(8, 32, 94, 0.45)' }}
      />
      <motion.div
        ref={sheetRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="vs-sheet-title"
        initial={reduce ? false : { y: 40, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.2 }}
        style={{
          position: 'relative',
          alignSelf: 'center',
          width: '100%',
          maxWidth: 600,
          background: T.white,
          borderRadius: '20px 20px 0 0',
          padding: '20px 16px max(16px, env(safe-area-inset-bottom))',
          maxHeight: '85%',
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
        }}
      >
        <AreasPanel
          headingId="vs-sheet-title"
          areas={areas}
          progress={progress}
          currentId={currentId}
          highlightId={highlightId}
          highlightRef={highlightRef}
          summaryLine={summaryLine}
          submitLabel={submitLabel}
          onPick={onPick}
          onSubmit={onSubmit}
          onUseGrid={onUseGrid}
          headerAction={
            <button
              ref={closeRef}
              type="button"
              onClick={onClose}
              aria-label="Close all areas"
              style={{ ...buttonReset, width: 44, height: 44, borderRadius: '50%', background: T.surface, color: T.navy, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flex: '0 0 auto' }}
            >
              <X size={18} />
            </button>
          }
        />
      </motion.div>
    </div>
  );
}

/** The area list with progress, plus Submit. A bottom sheet on phones
 *  and portrait tablets; a permanent rail on wide screens. */
export function AreasPanel({
  headingId,
  areas,
  progress,
  currentId,
  highlightId,
  highlightRef,
  summaryLine,
  submitLabel,
  onPick,
  onSubmit,
  onUseGrid,
  headerAction,
}: {
  headingId: string;
  areas: VoiceArea[];
  progress: Record<string, AreaProgress>;
  currentId: string;
  highlightId?: string;
  highlightRef?: Ref<HTMLButtonElement>;
  summaryLine: string;
  /** Leave out Submit and the grid link for a completed, read-only count. */
  submitLabel?: string;
  onPick: (id: string) => void;
  onSubmit?: () => void;
  onUseGrid?: () => void;
  headerAction?: React.ReactNode;
}) {
  return (
    <>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
          <div>
            <h2 id={headingId} style={{ margin: 0, fontSize: 20, fontWeight: 700, color: T.navy }}>
              All areas
            </h2>
            <p style={{ margin: '4px 0 0', fontSize: 13, color: T.caption }}>{summaryLine}</p>
          </div>
          {headerAction}
        </div>
        <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 8, overflowY: 'auto', minHeight: 0 }}>
          {areas.map(area => {
            const p = progress[area.id];
            const current = area.id === currentId;
            const highlighted = area.id === highlightId;
            let bg: string = T.white;
            let border = `1px solid ${T.hair}`;
            let lead: React.ReactNode = <span aria-hidden style={{ width: 16 }} />;
            let right: React.ReactNode = `${p.total} items`;
            if (p.state === 'done') {
              bg = T.yellow;
              border = `1px solid ${T.yellow}`;
              lead = <Check size={16} strokeWidth={2.6} color={T.dark} aria-hidden />;
              right = `${p.counted}/${p.total}${p.finishedAt ? ` · ${formatTime(p.finishedAt)}` : ''}`;
            } else if (p.state === 'finishedMissing') {
              bg = T.lightestPink;
              border = `1px solid ${T.lightPink}`;
              lead = <span aria-hidden style={{ width: 8, height: 8, margin: '0 4px', borderRadius: '50%', background: T.pink }} />;
              right = `Finished · ${p.uncounted.length} uncounted`;
            } else if (p.state === 'inProgress') {
              right = p.queued ? `${p.counted}/${p.total} · recording queued` : `${p.counted}/${p.total}`;
            }
            if (current) {
              const missed = p.counted > 0 || p.finishedAt ? p.uncounted.length : 0;
              bg = T.surface;
              border = `2px solid ${T.bright}`;
              right = (
                <>
                  {p.counted}/{p.total}
                  {missed > 0 && (
                    <span style={{ marginLeft: 8, padding: '2px 8px', borderRadius: pill, background: T.lightPink, color: T.navy, fontSize: 11, fontWeight: 700 }}>
                      {missed} {onSubmit ? 'missed' : 'not counted'}
                    </span>
                  )}
                </>
              );
            }
            if (highlighted && !current) border = `2px solid ${T.bright}`;
            return (
              <li key={area.id}>
                <button
                  ref={highlighted ? highlightRef : undefined}
                  type="button"
                  onClick={() => onPick(area.id)}
                  aria-current={current ? 'location' : undefined}
                  style={{
                    ...buttonReset,
                    width: '100%',
                    minHeight: 56,
                    padding: '0 16px',
                    borderRadius: 14,
                    border,
                    background: bg,
                    color: T.navy,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    textAlign: 'left',
                  }}
                >
                  {lead}
                  <span style={{ flex: 1, fontSize: 15, fontWeight: 600 }}>
                    {area.name}
                    {highlighted && !current && (
                      <span style={{ display: 'block', fontSize: 12, fontWeight: 500, color: T.caption }}>Up next</span>
                    )}
                  </span>
                  <span style={{ fontSize: 13, color: T.caption, fontVariantNumeric: 'tabular-nums', display: 'inline-flex', alignItems: 'center' }}>{right}</span>
                </button>
              </li>
            );
          })}
        </ul>
        {onSubmit && (
          <button
            type="button"
            onClick={onSubmit}
            style={{ ...buttonReset, minHeight: 56, borderRadius: pill, border: `1px solid ${T.navy}`, background: T.white, color: T.navy, fontSize: 15, fontWeight: 700 }}
          >
            {submitLabel}
          </button>
        )}
        {onUseGrid && (
          <button
            type="button"
            onClick={onUseGrid}
            style={{ ...buttonReset, minHeight: 44, fontSize: 13, fontWeight: 600, color: T.dark }}
          >
            Count on a list instead
          </button>
        )}
    </>
  );
}
