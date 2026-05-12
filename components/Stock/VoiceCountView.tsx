'use client';

/**
 * Hands-free voice stocktake — DEMO.
 *
 * Goal of this view: show what a voice-driven count *feels* like
 * without depending on the Web Speech API (which would need mic
 * permission, browser support, and a real ASR back-end — none of
 * which fit a click-through prototype). Every "I heard …" line below
 * is scripted on a timer so the demo plays predictably for any
 * stakeholder.
 *
 * The flow has four states:
 *   • idle      — armed but not yet listening; big mic button to start.
 *                 Useful when the operator walks up to the venue and
 *                 wants to ack they're ready before the system speaks.
 *   • listening — auto-cycles through items. For each item the panel:
 *                   1. shows the item name + variant + par,
 *                   2. animates a "listening" mic indicator,
 *                   3. types out a fake transcript ("I heard 6 bottles"),
 *                   4. commits the heard count after a beat,
 *                   5. moves to the next item.
 *                 The fake count is derived from the item's par/current
 *                 stock so the numbers read as plausible variances
 *                 instead of randomly absurd.
 *   • paused    — same item shown, animation frozen, controls visible
 *                 so the operator can resume / skip / step back.
 *   • done      — summary at the end with how many items were counted
 *                 and how many got skipped. "Submit" closes the flow.
 *
 * What we'd need to know to ship this for real (left as a TODO list
 * for the team — surfaced in the on-screen hint chips so the demo
 * itself communicates the design constraints):
 *   • disambiguation when the spoken unit doesn't match the item's
 *     stockUnit (e.g. "half a kilo" vs item.stockUnit === 'g'),
 *   • how the operator triggers "next / skip / previous / pause /
 *     repeat" without their hands,
 *   • visual feedback for low confidence / no-speech-detected,
 *   • environment-noise handling (mute, push-to-talk),
 *   • a confirmation step (auto-confirm with timeout vs explicit say
 *     "yes"), tunable per operator.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Mic,
  MicOff,
  Pause,
  Play,
  SkipForward,
  X,
} from 'lucide-react';
import type { StockItem, CountTarget } from './status';
import { formatPrice, formatStock, scopeLabel } from './status';

type FlowState = 'idle' | 'listening' | 'paused' | 'done';

interface VoiceCount {
  /** Heard quantity in the item's stockUnit. */
  value: number;
  /** What the system "heard" — surfaced in the per-item history. */
  transcript: string;
  /** Skipped via voice command "skip" or manual Skip control. */
  skipped: boolean;
}

interface Props {
  items: StockItem[];
  siteName: string;
  scope: CountTarget;
  onClose: () => void;
}

// How long each item spends in the listening loop, broken into the
// three things the demo needs to fake:
//   1. mic indicator pulses for `LISTEN_MS` ms → 2. transcript appears
//   → 3. count is committed and we advance.
const LISTEN_MS = 1400;
const COMMIT_MS = 1100;
const ADVANCE_MS = 900;

export default function VoiceCountView({ items, siteName, scope, onClose }: Props) {
  const [state, setState] = useState<FlowState>('idle');
  const [currentIdx, setCurrentIdx] = useState(0);
  const [counts, setCounts] = useState<Record<string, VoiceCount>>({});
  const [transcript, setTranscript] = useState<string>('');
  // Track timer ids so pausing/closing cleans them up.
  const timersRef = useRef<number[]>([]);

  const currentItem = items[currentIdx] ?? null;
  const totalItems = items.length;
  const countedSoFar = Object.values(counts).filter(c => !c.skipped).length;
  const skippedSoFar = Object.values(counts).filter(c => c.skipped).length;

  // £ value of what's been "heard" so far. Mirrors the same rule used
  // in StocktakeView: heard value × unitPrice in the stockUnit.
  const valueSoFar = useMemo(() => {
    let total = 0;
    for (const item of items) {
      const c = counts[item.id];
      if (!c || c.skipped || item.unitPrice == null) continue;
      total += c.value * item.unitPrice;
    }
    return total;
  }, [items, counts]);

  // Cleanup any pending timers on unmount / state transitions.
  function clearTimers() {
    for (const id of timersRef.current) window.clearTimeout(id);
    timersRef.current = [];
  }
  useEffect(() => clearTimers, []);

  // Esc closes; matches the drawer pattern elsewhere.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  // The listening loop. Runs whenever state flips to 'listening' on a
  // valid item. Each pass:
  //   1. Clears the prior transcript.
  //   2. Waits LISTEN_MS, then types out the fake transcript.
  //   3. Waits COMMIT_MS, then commits the heard count to `counts`.
  //   4. Waits ADVANCE_MS, then advances to the next item (or 'done').
  useEffect(() => {
    if (state !== 'listening' || !currentItem) return;

    clearTimers();
    setTranscript('');

    const heard = mockHeardCount(currentItem);
    const line = mockTranscript(currentItem, heard);

    const t1 = window.setTimeout(() => setTranscript(line), LISTEN_MS);
    const t2 = window.setTimeout(() => {
      setCounts(prev => ({
        ...prev,
        [currentItem.id]: { value: heard, transcript: line, skipped: false },
      }));
    }, LISTEN_MS + COMMIT_MS);
    const t3 = window.setTimeout(() => {
      if (currentIdx + 1 >= totalItems) {
        setState('done');
      } else {
        setCurrentIdx(i => i + 1);
        setTranscript('');
      }
    }, LISTEN_MS + COMMIT_MS + ADVANCE_MS);

    timersRef.current = [t1, t2, t3];
    return () => {
      clearTimers();
    };
  }, [state, currentItem?.id, currentIdx, totalItems]);

  // ── Manual controls (these would be voice commands in the real
  // implementation; the buttons exist for the demo + accessibility).
  function start() {
    if (totalItems === 0) return;
    setState('listening');
  }

  function pause() {
    clearTimers();
    setState('paused');
  }

  function resume() {
    setState('listening');
  }

  function skip() {
    if (!currentItem) return;
    clearTimers();
    setCounts(prev => ({
      ...prev,
      [currentItem.id]: {
        value: 0,
        transcript: 'Skipped',
        skipped: true,
      },
    }));
    advanceTo(currentIdx + 1);
  }

  function previous() {
    if (currentIdx === 0) return;
    clearTimers();
    advanceTo(currentIdx - 1);
  }

  function advanceTo(nextIdx: number) {
    if (nextIdx >= totalItems) {
      setState('done');
      return;
    }
    setCurrentIdx(nextIdx);
    setTranscript('');
    setState('listening');
  }

  function submit() {
    // Prototype: nothing persists server-side. The page-level override
    // map only ingests writes from the drawer / table; voice runs are
    // fire-and-forget for the demo so the operator can step through
    // it again. A future build would dispatch a save action here.
    onClose();
  }

  return (
    <motion.section
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.18 }}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 800,
        background:
          'radial-gradient(circle at 50% 30%, #2d2118 0%, #1a1410 60%, #0f0b08 100%)',
        color: '#fff',
        fontFamily: 'var(--font-primary)',
        display: 'flex',
        flexDirection: 'column',
      }}
      role="dialog"
      aria-label="Voice count"
    >
      {/* Top bar — site context + close. Sparse on purpose; the
          listening visual below is the focal point. */}
      <header
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '16px 24px',
          borderBottom: '1px solid rgba(255,255,255,0.08)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close voice count"
            style={topBtnStyle}
          >
            <X size={18} />
          </button>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700 }}>
              {scopeLabel(scope)}
            </div>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.55)' }}>
              {siteName}
            </div>
          </div>
        </div>

        <ProgressPill
          state={state}
          counted={countedSoFar}
          skipped={skippedSoFar}
          total={totalItems}
        />
      </header>

      {/* Main stage. Switches based on flow state. */}
      <div
        style={{
          flex: 1,
          minHeight: 0,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '24px',
          gap: 24,
          textAlign: 'center',
        }}
      >
        {state === 'idle' && (
          <IdleStage onStart={start} disabled={totalItems === 0} />
        )}

        {(state === 'listening' || state === 'paused') && currentItem && (
          <ListeningStage
            item={currentItem}
            transcript={transcript}
            paused={state === 'paused'}
            justCommitted={Boolean(counts[currentItem.id])}
          />
        )}

        {state === 'done' && (
          <DoneStage
            countedSoFar={countedSoFar}
            skippedSoFar={skippedSoFar}
            totalItems={totalItems}
            valueSoFar={valueSoFar}
            onSubmit={submit}
            onReview={onClose}
          />
        )}
      </div>

      {/* Footer controls — only visible during the count loop. Each
          button has a "or say X" hint to teach the voice vocabulary
          the real implementation would honour. */}
      {(state === 'listening' || state === 'paused') && (
        <footer
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 12,
            padding: '20px 24px 28px',
            borderTop: '1px solid rgba(255,255,255,0.08)',
            background: 'rgba(0,0,0,0.18)',
          }}
        >
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: 10,
              justifyContent: 'center',
            }}
          >
            <ControlButton
              icon={<ArrowLeft size={16} />}
              label="Previous"
              voiceCommand="Say 'previous'"
              onClick={previous}
              disabled={currentIdx === 0}
            />
            <ControlButton
              icon={state === 'paused' ? <Play size={16} /> : <Pause size={16} />}
              label={state === 'paused' ? 'Resume' : 'Pause'}
              voiceCommand={state === 'paused' ? "Say 'resume'" : "Say 'pause'"}
              onClick={state === 'paused' ? resume : pause}
              accent
            />
            <ControlButton
              icon={<SkipForward size={16} />}
              label="Skip"
              voiceCommand="Say 'skip'"
              onClick={skip}
            />
            <ControlButton
              icon={<ArrowRight size={16} />}
              label="Confirm & next"
              voiceCommand="Say 'next'"
              onClick={skip /* alias: same advance, but commits 'as heard'. For the demo behaviour is the same. */}
            />
          </div>

          <button
            type="button"
            onClick={() => setState('done')}
            style={{
              alignSelf: 'center',
              padding: '8px 20px',
              minHeight: 36,
              borderRadius: 100,
              background: 'transparent',
              border: '1px solid rgba(255,255,255,0.18)',
              color: 'rgba(255,255,255,0.7)',
              fontFamily: 'var(--font-primary)',
              fontSize: 12,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            End count
          </button>
        </footer>
      )}
    </motion.section>
  );
}

// ─── Stage components ───────────────────────────────────────────────────────

function IdleStage({ onStart, disabled }: { onStart: () => void; disabled: boolean }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 18 }}>
      <button
        type="button"
        onClick={onStart}
        disabled={disabled}
        aria-label="Start voice count"
        style={{
          width: 120,
          height: 120,
          borderRadius: '50%',
          border: 'none',
          background: disabled
            ? 'rgba(255,255,255,0.05)'
            : 'linear-gradient(160deg, #ff8a3d 0%, #f55a00 100%)',
          color: '#fff',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: disabled ? 'not-allowed' : 'pointer',
          boxShadow: disabled
            ? 'none'
            : '0 12px 40px rgba(245,90,0,0.35), inset 0 -8px 24px rgba(0,0,0,0.18)',
        }}
      >
        {disabled ? <MicOff size={44} /> : <Mic size={44} />}
      </button>
      <div style={{ fontSize: 22, fontWeight: 700 }}>
        {disabled ? 'No items to count' : 'Tap to start counting'}
      </div>
      <div
        style={{
          fontSize: 13,
          color: 'rgba(255,255,255,0.65)',
          maxWidth: 360,
          lineHeight: 1.5,
        }}
      >
        {disabled
          ? 'Pick a different scope from the Stocktake list.'
          : 'I’ll read each item aloud. Say the count in your preferred unit, then "next" to move on. Say "skip" to skip, "pause" to pause.'}
      </div>
    </div>
  );
}

function ListeningStage({
  item,
  transcript,
  paused,
  justCommitted,
}: {
  item: StockItem;
  transcript: string;
  paused: boolean;
  justCommitted: boolean;
}) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 22,
        width: '100%',
        maxWidth: 560,
      }}
    >
      {/* Item card — the operator's anchor while listening. The values
          on the right are the system "telling them" what to compare
          against (par + current on-hand) so they don't have to flip
          back to the manual screen. */}
      <div
        style={{
          width: '100%',
          background: 'rgba(255,255,255,0.06)',
          border: '1px solid rgba(255,255,255,0.10)',
          borderRadius: 16,
          padding: '20px 22px',
          display: 'flex',
          flexDirection: 'column',
          gap: 6,
          textAlign: 'left',
        }}
      >
        <div
          style={{
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: '0.06em',
            textTransform: 'uppercase',
            color: 'rgba(255,255,255,0.45)',
          }}
        >
          Now counting
        </div>
        <div style={{ fontSize: 26, fontWeight: 700 }}>
          {item.name}
        </div>
        <div style={{ fontSize: 14, color: 'rgba(255,255,255,0.65)' }}>
          {item.variant} · {item.supplierName}
        </div>
        <div
          style={{
            marginTop: 8,
            display: 'flex',
            gap: 18,
            flexWrap: 'wrap',
            fontSize: 12,
            color: 'rgba(255,255,255,0.70)',
          }}
        >
          <span>
            Par <strong style={{ color: '#fff' }}>
              {item.parLevel !== null ? formatStock(item.parLevel, item.stockUnit) : '—'}
            </strong>
          </span>
          <span>
            On hand <strong style={{ color: '#fff' }}>
              {formatStock(item.currentStock, item.stockUnit)}
            </strong>
          </span>
          {item.unitPrice != null && (
            <span>
              Price <strong style={{ color: '#fff' }}>
                {formatPrice(item.unitPrice, item.stockUnit)}
              </strong>
            </span>
          )}
        </div>
      </div>

      {/* Listening indicator — animated bars when active, frozen when
          paused. Purely visual; the actual "voice" is scripted by the
          loop in the parent. */}
      <MicIndicator active={!paused && !justCommitted} />

      {/* Transcript / status line. Falls back to a "listening…" hint
          while the timer waits. */}
      <div
        style={{
          minHeight: 40,
          fontSize: 16,
          color: 'rgba(255,255,255,0.85)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
        }}
      >
        {paused ? (
          <span style={{ color: 'rgba(255,255,255,0.55)' }}>Paused</span>
        ) : justCommitted ? (
          <>
            <Check size={18} color="var(--color-success)" />
            <span>{transcript}</span>
          </>
        ) : transcript ? (
          <span>“{transcript}”</span>
        ) : (
          <span style={{ color: 'rgba(255,255,255,0.55)' }}>Listening…</span>
        )}
      </div>

      {/* Suggested commands — teaches the voice vocabulary by example
          without making the operator read documentation. */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 6,
          justifyContent: 'center',
        }}
      >
        {['"Six bottles"', '"Next"', '"Skip"', '"Pause"', '"Repeat"'].map(
          cmd => (
            <span
              key={cmd}
              style={{
                padding: '4px 10px',
                borderRadius: 100,
                background: 'rgba(255,255,255,0.06)',
                color: 'rgba(255,255,255,0.55)',
                fontSize: 11,
                fontWeight: 600,
              }}
            >
              {cmd}
            </span>
          ),
        )}
      </div>
    </div>
  );
}

function DoneStage({
  countedSoFar,
  skippedSoFar,
  totalItems,
  valueSoFar,
  onSubmit,
  onReview,
}: {
  countedSoFar: number;
  skippedSoFar: number;
  totalItems: number;
  valueSoFar: number;
  onSubmit: () => void;
  onReview: () => void;
}) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 22,
        maxWidth: 480,
      }}
    >
      <div
        style={{
          width: 72,
          height: 72,
          borderRadius: '50%',
          background: 'rgba(34, 197, 94, 0.18)',
          color: 'var(--color-success)',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Check size={36} />
      </div>
      <div style={{ fontSize: 22, fontWeight: 700, textAlign: 'center' }}>
        Count finished
      </div>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))',
          gap: 10,
          width: '100%',
        }}
      >
        <StatTile label="Counted" value={`${countedSoFar} / ${totalItems}`} />
        <StatTile label="Skipped" value={skippedSoFar.toString()} />
        <StatTile label="Heard value" value={formatPrice(valueSoFar)} />
      </div>
      <div
        style={{
          fontSize: 12,
          color: 'rgba(255,255,255,0.55)',
          textAlign: 'center',
          lineHeight: 1.5,
        }}
      >
        Prototype — nothing is persisted. A production build would
        dispatch these as a stocktake record + per-line edits.
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <button
          type="button"
          onClick={onReview}
          style={{
            padding: '10px 16px',
            minHeight: 40,
            borderRadius: 'var(--radius-item)',
            background: 'transparent',
            border: '1px solid rgba(255,255,255,0.18)',
            color: 'rgba(255,255,255,0.8)',
            fontFamily: 'var(--font-primary)',
            fontSize: 13,
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          Close
        </button>
        <button
          type="button"
          onClick={onSubmit}
          style={{
            padding: '10px 16px',
            minHeight: 40,
            borderRadius: 'var(--radius-item)',
            background: 'linear-gradient(160deg, #ff8a3d 0%, #f55a00 100%)',
            border: 'none',
            color: '#fff',
            fontFamily: 'var(--font-primary)',
            fontSize: 13,
            fontWeight: 700,
            cursor: 'pointer',
          }}
        >
          Submit count
        </button>
      </div>
    </div>
  );
}

// ─── Bits and pieces ─────────────────────────────────────────────────────────

function MicIndicator({ active }: { active: boolean }) {
  // Five vertical bars, each pulsing at slightly different timing.
  // Frozen at uniform short height when not active so paused state
  // reads as a deliberate hold, not a crash.
  const bars = [0, 1, 2, 3, 4];
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        height: 56,
      }}
      aria-hidden
    >
      {bars.map(i => (
        <motion.span
          key={i}
          animate={
            active
              ? {
                  height: ['14px', '46px', '20px', '38px', '14px'],
                }
              : { height: '14px' }
          }
          transition={
            active
              ? {
                  duration: 1.1 + i * 0.08,
                  repeat: Infinity,
                  ease: 'easeInOut',
                  delay: i * 0.07,
                }
              : { duration: 0.2 }
          }
          style={{
            width: 8,
            background: active
              ? 'linear-gradient(180deg, #ffb88a, #ff7d2b)'
              : 'rgba(255,255,255,0.25)',
            borderRadius: 6,
          }}
        />
      ))}
    </div>
  );
}

function ProgressPill({
  state,
  counted,
  skipped,
  total,
}: {
  state: FlowState;
  counted: number;
  skipped: number;
  total: number;
}) {
  const stateLabel =
    state === 'idle' ? 'Ready'
    : state === 'paused' ? 'Paused'
    : state === 'done' ? 'Done'
    : 'Listening';
  return (
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 10,
        padding: '6px 14px',
        borderRadius: 100,
        background: 'rgba(255,255,255,0.08)',
        fontSize: 12,
        fontWeight: 600,
      }}
    >
      <span
        style={{
          width: 8,
          height: 8,
          borderRadius: '50%',
          background:
            state === 'listening' ? 'var(--color-success)'
            : state === 'paused' ? 'var(--color-warning)'
            : state === 'done' ? 'var(--color-info)'
            : 'rgba(255,255,255,0.4)',
        }}
      />
      {stateLabel} · {counted}/{total}
      {skipped > 0 && (
        <span style={{ color: 'rgba(255,255,255,0.55)', fontWeight: 500 }}>
          · {skipped} skipped
        </span>
      )}
    </div>
  );
}

function ControlButton({
  icon,
  label,
  voiceCommand,
  onClick,
  disabled,
  accent,
}: {
  icon: React.ReactNode;
  label: string;
  voiceCommand: string;
  onClick: () => void;
  disabled?: boolean;
  accent?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={voiceCommand}
      style={{
        display: 'inline-flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 4,
        minWidth: 92,
        padding: '10px 14px',
        borderRadius: 12,
        background: accent ? 'rgba(255,138,61,0.18)' : 'rgba(255,255,255,0.06)',
        border: accent
          ? '1px solid rgba(255,138,61,0.45)'
          : '1px solid rgba(255,255,255,0.10)',
        color: '#fff',
        fontFamily: 'var(--font-primary)',
        fontSize: 12,
        fontWeight: 600,
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.4 : 1,
      }}
    >
      <span style={{ display: 'inline-flex' }}>{icon}</span>
      {label}
      <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.55)', fontWeight: 500 }}>
        {voiceCommand}
      </span>
    </button>
  );
}

function StatTile({ label, value }: { label: string; value: string }) {
  return (
    <div
      style={{
        padding: 14,
        background: 'rgba(255,255,255,0.06)',
        border: '1px solid rgba(255,255,255,0.10)',
        borderRadius: 12,
        textAlign: 'center',
      }}
    >
      <div
        style={{
          fontSize: 11,
          color: 'rgba(255,255,255,0.55)',
          textTransform: 'uppercase',
          letterSpacing: '0.04em',
          fontWeight: 700,
        }}
      >
        {label}
      </div>
      <div style={{ marginTop: 4, fontSize: 18, fontWeight: 700 }}>{value}</div>
    </div>
  );
}

const topBtnStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: 36,
  height: 36,
  borderRadius: 10,
  border: '1px solid rgba(255,255,255,0.12)',
  background: 'transparent',
  color: '#fff',
  cursor: 'pointer',
};

// ─── Mock voice synthesis ────────────────────────────────────────────────────

/** Derive a plausible "heard" count from the item's par/current stock
 *  with a stable nudge so the demo plays consistently for the same
 *  item id (no flicker between renders). */
function mockHeardCount(item: StockItem): number {
  const base = item.parLevel ?? item.currentStock;
  if (!Number.isFinite(base) || base <= 0) return 1;
  // Use a hash of the id to pick a multiplier between 0.6 and 1.3 so
  // some items read as under, some as over par — that's the variance
  // the operator is trying to surface.
  let h = 0;
  for (let i = 0; i < item.id.length; i += 1) {
    h = (h * 31 + item.id.charCodeAt(i)) | 0;
  }
  const factor = 0.6 + (Math.abs(h) % 70) / 100; // 0.60..1.29
  const raw = base * factor;
  return Number.isInteger(base) ? Math.round(raw) : Math.round(raw * 10) / 10;
}

function mockTranscript(item: StockItem, heard: number): string {
  // Vary the phrasing slightly so the demo doesn't read as the same
  // line each time. Picks a phrasing from item.id hash.
  const phrasings = [
    `I heard ${heard} ${item.stockUnit}`,
    `Got ${heard} ${item.stockUnit}`,
    `OK — ${heard} ${item.stockUnit}`,
  ];
  let h = 0;
  for (let i = 0; i < item.id.length; i += 1) {
    h = (h * 17 + item.id.charCodeAt(i)) | 0;
  }
  return phrasings[Math.abs(h) % phrasings.length];
}
