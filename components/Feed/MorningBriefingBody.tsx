'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { Pin, ChevronDown, ChevronRight, Mic, Square, CheckCircle2 } from 'lucide-react';
import type { BriefingRole, BriefingPhase } from '@/components/briefing';
import CloseReconciliationCard from '@/components/Waste/CloseReconciliationCard';

// ── Live snapshot widgets (migrated from Command Centre) ───────────────────────

function ConfidenceMeterBar({ label, valuePct, caption }: { label: string; valuePct: number; caption: string }) {
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '5px' }}>
        <span style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.04em', color: 'var(--color-text-secondary)' }}>
          {label}
        </span>
        <span style={{ fontSize: '17px', fontWeight: 700, color: 'var(--color-text-primary)' }}>{valuePct}%</span>
      </div>
      <div style={{
        height: '8px', borderRadius: '100px',
        background: 'rgba(0, 28, 53,0.08)',
        overflow: 'hidden',
        marginBottom: '5px',
      }}>
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${valuePct}%` }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
          style={{
            height: '100%',
            borderRadius: '100px',
            background: valuePct >= 70
              ? 'linear-gradient(90deg, #2D6A4F, #40916C)'
              : valuePct >= 45
                ? 'linear-gradient(90deg, #6B8F71, #91B89A)'
                : 'linear-gradient(90deg, #9B2226, #E85D04)',
          }}
        />
      </div>
      <p style={{ margin: 0, fontSize: '11px', color: 'var(--color-text-muted)', lineHeight: 1.4 }}>{caption}</p>
    </div>
  );
}

function InvoiceMatchBar() {
  return (
    <div>
      <div style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.04em', color: 'var(--color-text-secondary)', marginBottom: '6px' }}>
        Invoice & PO match · overnight
      </div>
      <div style={{
        height: '8px', borderRadius: '100px',
        background: 'rgba(0, 28, 53,0.08)',
        overflow: 'hidden',
        display: 'flex',
        marginBottom: '6px',
      }}>
        <div style={{ width: '68%', background: '#2D6A4F', height: '100%' }} />
        <div style={{ width: '22%', background: 'var(--color-accent-active)', height: '100%' }} />
        <div style={{ width: '10%', background: 'rgba(155,34,38,0.85)', height: '100%' }} />
      </div>
      <div style={{ display: 'flex', gap: '10px', fontSize: '11px', fontWeight: 500, color: 'var(--color-text-muted)' }}>
        <span>68% cleared</span>
        <span>22% in review</span>
        <span>10% exception</span>
      </div>
    </div>
  );
}

const LABOUR_FORECAST = [0.35, 0.32, 0.38, 0.45, 0.52, 0.68, 0.75, 0.72, 0.55, 0.42, 0.38, 0.32];
const LABOUR_ACTUAL   = [0.33, 0.34, 0.40, 0.48, 0.58, 0.82, 0.88, 0.79, 0.62, 0.45, 0.36, 0.30];

function LabourMiniCurve({ subtitle }: { subtitle: string }) {
  const w = 260; const h = 72;
  const pad = { l: 6, r: 6, t: 6, b: 16 };
  const iW = w - pad.l - pad.r; const iH = h - pad.t - pad.b;
  const toPath = (pts: number[]) =>
    pts.map((y, i) => {
      const x = pad.l + (i / (pts.length - 1)) * iW;
      const yy = pad.t + y * iH;
      return `${i === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${yy.toFixed(1)}`;
    }).join(' ');

  return (
    <div>
      <div style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.04em', color: 'var(--color-text-secondary)', marginBottom: '3px' }}>
        Labour cost · actual vs forecast
      </div>
      <div style={{ fontSize: '11px', color: 'var(--color-text-muted)', marginBottom: '4px' }}>{subtitle}</div>
      <svg width="100%" viewBox={`0 0 ${w} ${h}`} style={{ display: 'block' }}>
        <path d={toPath(LABOUR_FORECAST)} fill="none" stroke="rgba(107,94,85,0.35)" strokeWidth="1.8" strokeDasharray="4 3" />
        <path d={toPath(LABOUR_ACTUAL)} fill="none" stroke="var(--color-accent-deep)" strokeWidth="2" />
        <text x={pad.l} y={h - 2} fontSize="8" fill="var(--color-text-muted)">6am</text>
        <text x={w / 2 - 10} y={h - 2} fontSize="8" fill="var(--color-text-muted)">midday</text>
        <text x={w - 26} y={h - 2} fontSize="8" fill="var(--color-text-muted)">10pm</text>
      </svg>
      <div style={{ display: 'flex', gap: '10px', marginTop: '2px', fontSize: '11px', color: 'var(--color-text-muted)' }}>
        <span><span style={{ color: 'var(--color-accent-deep)', fontWeight: 700 }}>—</span> Actual</span>
        <span><span style={{ color: 'rgba(107,94,85,0.5)', fontWeight: 700 }}>· ·</span> Forecast</span>
      </div>
    </div>
  );
}

// ── HeroStrip ──────────────────────────────────────────────────────────────────
// Three phase-shaped answers at the top of the panel. Replaces the old
// always-on LiveSnapshot. Detail (chart, breakdown) lives behind each tile's
// "What does this mean?" chevron — based on Kallie's repeated note that GMs
// want one-line answers first and depth only on tap.

type HeroAnswer = {
  id: string;
  eyebrow: string;
  value: string;
  context?: string;
  detail?: React.ReactNode;
};

function getHeroAnswers(role: BriefingRole, phase: BriefingPhase): HeroAnswer[] {
  if (role === 'gm') {
    if (phase === 'morning') return [
      { id: 'h1', eyebrow: 'On today', value: '4 on the floor', context: '1 short of plan — Priya called out, Tom moved to mid' },
      { id: 'h2', eyebrow: 'Expected sales', value: '£19,200', context: '+6% vs last Thursday · warm day forecast', detail: <LabourMiniCurve subtitle="Yesterday's actual vs forecast" /> },
      { id: 'h3', eyebrow: 'Deliveries today', value: 'Fresh Direct · 11am', context: '1 line pre-flagged short before arrival' },
    ];
    if (phase === 'midday') return [
      { id: 'h1', eyebrow: 'Pace now', value: '+11% vs forecast', context: 'Warm day pulling extra cover · iced drinks under pressure' },
      { id: 'h2', eyebrow: 'Stock at risk', value: 'Ham & cheese · 3 left', context: 'Sell-out likely before 1:30 unless prepped' },
      { id: 'h3', eyebrow: 'Next cut-off', value: 'Bidfood · 2pm', context: "Tomorrow's basket needs send" },
    ];
    if (phase === 'afternoon') return [
      { id: 'h1', eyebrow: 'EOD tracking', value: '£20,250', context: '+£1,340 vs £18,910 plan' },
      { id: 'h2', eyebrow: 'Cut-offs before close', value: '1 left · 30 min', context: 'Bidfood basket — matcha +1, tomatoes +2' },
      { id: 'h3', eyebrow: 'Tomorrow opening', value: 'Priya · 6am', context: 'Reminder sent · confirmed' },
    ];
    if (phase === 'evening') return [
      { id: 'h1', eyebrow: 'Today closed', value: '£20,180', context: '+£1,270 vs plan · waste £28' },
      { id: 'h2', eyebrow: 'Tomorrow ready', value: 'Basket sent · Priya 6am', context: 'Compliance pre-filled — temps + fire door' },
      { id: 'h3', eyebrow: 'Period margin', value: '+0.4 pt today', context: 'Posts overnight after close' },
    ];
  }

  if (role === 'ed') {
    if (phase === 'morning') return [
      { id: 'h1', eyebrow: 'Sites open today', value: '12 of 12', context: 'No openings flagged late' },
      { id: 'h2', eyebrow: 'Chain forecast', value: '£182,400', context: '+4% vs last Thursday', detail: <LabourMiniCurve subtitle="Chain roll-up · yesterday" /> },
      { id: 'h3', eyebrow: 'Decisions for you', value: '4 calls', context: 'Bidvest GRN · Metro credit · matcha · muffins' },
    ];
    if (phase === 'midday') return [
      { id: 'h1', eyebrow: 'Chain pace', value: '+8% vs forecast', context: '5 sites running hot · 1 behind' },
      { id: 'h2', eyebrow: 'Cut-offs today', value: 'Bidfood · 2pm', context: 'Matcha top-up holds Friday stock' },
      { id: 'h3', eyebrow: 'Decisions for you', value: '4 calls', context: 'GRN · lunch staff · basket · muffins' },
    ];
    if (phase === 'afternoon') return [
      { id: 'h1', eyebrow: 'Chain EOD tracking', value: '£196,800', context: '+£14k vs plan' },
      { id: 'h2', eyebrow: 'Cut-offs before close', value: '1 left · 30 min', context: 'Bidfood basket — £1,240 est.' },
      { id: 'h3', eyebrow: 'Loop closed today', value: 'Warm-day → +1 case', context: 'Sales → stock → orders ran itself' },
    ];
    if (phase === 'evening') return [
      { id: 'h1', eyebrow: 'Chain closed', value: '£198,420', context: 'Best Thursday this quarter' },
      { id: 'h2', eyebrow: 'Tomorrow ready', value: '12 of 12 baskets sent', context: 'Compliance + cost pack queued' },
      { id: 'h3', eyebrow: 'Recipes recosted', value: '12 SKUs · flour variance', context: 'Margins refreshed for Cheryl' },
    ];
  }

  if (role === 'cheryl') {
    if (phase === 'morning') return [
      {
        id: 'h1',
        eyebrow: 'Period completeness',
        value: '64%',
        context: 'Below the 75% you\'d normally expect now',
        detail: (
          <ConfidenceMeterBar
            label="Period cost completeness"
            valuePct={64}
            caption="Of this period's costs confirmed vs still pending accrual or invoice."
          />
        ),
      },
      {
        id: 'h2',
        eyebrow: 'Cleared overnight',
        value: '£2,340',
        context: '14 invoices auto-matched · 3 held for tolerance',
        detail: <InvoiceMatchBar />,
      },
      { id: 'h3', eyebrow: 'Mismatches to clear', value: '3 ready', context: 'Bidfood (2) · Metro (1) · one pass' },
    ];
    if (phase === 'midday') return [
      { id: 'h1', eyebrow: 'COGS today', value: '28.4%', context: '+1.2 pts vs 27.2% target · flour driving 0.7' },
      { id: 'h2', eyebrow: 'Posted so far', value: '£3,240', context: '18 invoices · running clean' },
      { id: 'h3', eyebrow: 'Period close in', value: '3 days', context: 'Pace check — projecting 82% on target' },
    ];
    if (phase === 'afternoon') return [
      { id: 'h1', eyebrow: 'Period completeness', value: '78%', context: 'Up from 64% this morning · on target' },
      { id: 'h2', eyebrow: 'Posted today', value: '£6,700', context: '27 cleared · 2 in review' },
      { id: 'h3', eyebrow: 'Accruals to approve', value: 'By 4pm', context: 'Urban Fresh · Lacto · Metro credit' },
    ];
    if (phase === 'evening') return [
      { id: 'h1', eyebrow: 'Period completeness', value: '84%', context: 'Above target' },
      { id: 'h2', eyebrow: 'Posted today', value: '£4,820', context: '3 small holds queued for tomorrow' },
      { id: 'h3', eyebrow: 'Close pack', value: 'Ready for sign-off', context: '7pm distribution drafted' },
    ];
  }

  if (role === 'playtomic') {
    if (phase === 'morning') return [
      { id: 'h1', eyebrow: 'Forward pipeline', value: '−22% Manchester', context: 'Tue/Thu evenings concentrated' },
      { id: 'h2', eyebrow: 'Coaches today', value: '2 swaps queued', context: 'Stockport — Diego off sick' },
      { id: 'h3', eyebrow: 'Cafe basket', value: '£1,860 · weekend', context: 'Cut-off 11am · tournament Saturday' },
    ];
    if (phase === 'midday') return [
      { id: 'h1', eyebrow: 'Off-peak discount', value: 'Live at 6pm', context: 'Needs approval by 2pm' },
      { id: 'h2', eyebrow: 'Occupancy now', value: '74% chain avg', context: 'North Leeds 92% · Manchester 54%' },
      { id: 'h3', eyebrow: 'New members', value: '198 welcomed', context: 'Coach class voucher attached for retention' },
    ];
    if (phase === 'afternoon') return [
      { id: 'h1', eyebrow: 'Tomorrow rain', value: '78 bookings at risk', context: 'Stockport indoor capacity available' },
      { id: 'h2', eyebrow: 'Saturday dry-run', value: '5pm checklist', context: 'Manchester ops sign-off' },
      { id: 'h3', eyebrow: 'Weekend roster', value: '+18% confirmed', context: 'All 7 sites' },
    ];
    if (phase === 'evening') return [
      { id: 'h1', eyebrow: 'EOD revenue', value: '£22,600', context: 'Court £18.4k · cafe £4.2k' },
      { id: 'h2', eyebrow: 'Tomorrow pipeline', value: '84% booked', context: 'Manchester recovered to 71%' },
      { id: 'h3', eyebrow: 'Session ratings', value: '4.7 / 5 avg', context: '2 court-lighting tickets logged' },
    ];
  }

  return [];
}

function HeroTile({ tile, isLast }: { tile: HeroAnswer; isLast: boolean }) {
  const [open, setOpen] = useState(false);
  const expandable = !!tile.detail;
  return (
    <div
      style={{
        padding: '9px 0',
        borderBottom: isLast ? 'none' : '1px solid var(--color-border-subtle)',
      }}
    >
      <button
        type="button"
        onClick={expandable ? () => setOpen((v) => !v) : undefined}
        disabled={!expandable}
        aria-expanded={expandable ? open : undefined}
        style={{
          all: 'unset',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          width: '100%',
          cursor: expandable ? 'pointer' : 'default',
        }}
      >
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontSize: '10px',
              fontWeight: 700,
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
              color: 'var(--color-text-muted)',
              marginBottom: '2px',
            }}
          >
            {tile.eyebrow}
          </div>
          <div
            style={{
              fontSize: '15px',
              fontWeight: 700,
              color: 'var(--color-text-primary)',
              lineHeight: 1.3,
            }}
          >
            {tile.value}
          </div>
          {tile.context && (
            <div
              style={{
                fontSize: '12px',
                color: 'var(--color-text-secondary)',
                lineHeight: 1.4,
                marginTop: '2px',
              }}
            >
              {tile.context}
            </div>
          )}
        </div>
        {expandable && (
          <ChevronDown
            size={14}
            strokeWidth={2.2}
            color="var(--color-text-muted)"
            style={{
              transform: open ? 'rotate(180deg)' : 'rotate(0deg)',
              transition: 'transform 0.2s ease',
              flexShrink: 0,
            }}
          />
        )}
      </button>
      <AnimatePresence initial={false}>
        {open && tile.detail && (
          <motion.div
            key="detail"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.22, ease: 'easeOut' }}
            style={{ overflow: 'hidden' }}
          >
            <div style={{ paddingTop: '10px' }}>{tile.detail}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function HeroStrip({ role, phase }: { role: BriefingRole; phase: BriefingPhase }) {
  const tiles = getHeroAnswers(role, phase);
  if (tiles.length === 0) return null;
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.28 }}
      style={{
        padding: '2px 12px',
        borderRadius: '10px',
        background: '#fff',
        border: '1px solid var(--color-border-subtle)',
        boxShadow: '0 1px 4px rgba(0, 28, 53,0.06)',
        marginBottom: '10px',
      }}
    >
      {tiles.map((t, i) => (
        <HeroTile key={t.id} tile={t} isLast={i === tiles.length - 1} />
      ))}
    </motion.div>
  );
}

// ── NoteForEdify ───────────────────────────────────────────────────────────────
// Daily voice/text capture for things integrations can't see — the shape
// of the moment the operator is in. Mocked recording state for the
// prototype: tap to "record", tap again to "stop" which reveals a
// transcript + Edify's cascade reply.
//
// Phase-aware: the prompt, the canned transcript, and Edify's reply all
// shift between morning / midday / afternoon / evening so the card reads
// as the right ask at the right time. The label stays "Note for Edify"
// across phases so the operator learns one place, not four. The full
// running log of past notes lives at /notebook (sidebar → Performance
// → Notebook), reachable from the link at the foot of this card.

const VOICE_TAGS = ['Equipment', 'Weather', 'Team', 'Customer', 'Supplier'] as const;

interface NoteForEdifyCopy {
  prompt: string;
  transcript: string;
  reply: string;
}

const NOTE_COPY: Record<BriefingPhase, NoteForEdifyCopy> = {
  morning: {
    prompt: "Anything Edify should know going into today?",
    transcript:
      "Tom's on light duties today — back issue from yesterday. Probably can't carry the milk crates or do the bin run.",
    reply:
      "Got it. Logged Tom on light duties for today and held the heavy-lift assignments off his task list. I'll surface it on whoever runs the morning brief next and flag if back-issue call-outs cluster on his shifts.",
  },
  midday: {
    prompt: "Mid-service — anything happened the numbers won't show?",
    transcript:
      "Fridge 2 made the noise again around 11. Stayed cold but this is the third time this month. Engineer's been twice and said it's fine.",
    reply:
      "Logged Fridge 2 anomaly mid-shift. Temps still inside safe range so this is below my auto-escalate threshold — but I've added it to the maintenance pattern (third callout this month) and drafted a query to your account manager. Ready for review.",
  },
  afternoon: {
    prompt: "Wrap-up — anything happened the numbers won't show?",
    transcript:
      "Bidvest driver was 90 mins late again. Lost the ham & cheese through lunch. He said the depot was short on vans.",
    reply:
      "Logged Bidvest delay against today's ham & cheese sell-out at 13:40. Second delay in 30 days — I've drafted a query to your account manager and added Bidvest to the supplier-risk watchlist. Sits in Cheryl's review queue when she's next in.",
  },
  evening: {
    prompt: "End-of-day — how did today actually go?",
    transcript:
      "Fridge 2 was down from about 9:30 to 2. Lost the sandwich display through lunch. Team felt it — Tom was firefighting prep all morning.",
    reply:
      "Got it. Logged fridge 2 down 09:30–14:00 against today's −6% lunch and the ham & cheese sell-out at 13:45. I'll watch call-outs and waste over the next 2 days and flag if it clusters — Kallie's pattern.",
  },
};

export function NoteForEdify({ phase }: { phase: BriefingPhase }) {
  const router = useRouter();
  const [state, setState] = useState<'idle' | 'recording' | 'done'>('idle');
  const [tag, setTag] = useState<string | null>(null);

  const copy = NOTE_COPY[phase];

  function toggle() {
    if (state === 'idle') setState('recording');
    else if (state === 'recording') setState('done');
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.28 }}
      style={{
        padding: '12px',
        borderRadius: '10px',
        background: '#fff',
        border: '1px solid var(--color-border-subtle)',
        boxShadow: '0 1px 4px rgba(0, 28, 53,0.06)',
        marginBottom: '10px',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '7px',
          marginBottom: '8px',
        }}
      >
        <Mic size={12} strokeWidth={2.2} color="var(--color-accent-active)" />
        <span
          style={{
            fontSize: '12px',
            fontWeight: 700,
            letterSpacing: '0.04em',
            color: 'var(--color-accent-active)',
          }}
        >
          Note for Edify
        </span>
      </div>

      <p
        style={{
          margin: '0 0 10px',
          fontSize: '13px',
          fontWeight: 600,
          color: 'var(--color-text-primary)',
          lineHeight: 1.45,
        }}
      >
        {copy.prompt}
      </p>

      {state !== 'done' && (
        <>
          <button
            type="button"
            onClick={toggle}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              width: '100%',
              padding: '10px 12px',
              borderRadius: '8px',
              border: state === 'recording'
                ? '1px solid var(--color-accent-quinn, #FF0058)'
                : '1px solid var(--color-accent-active)',
              background: state === 'recording'
                ? 'rgba(255,0,88,0.08)'
                : 'var(--color-accent-active)',
              color: state === 'recording' ? 'var(--color-accent-quinn, #FF0058)' : '#fff',
              fontSize: '12px',
              fontWeight: 700,
              fontFamily: 'var(--font-primary)',
              cursor: 'pointer',
              marginBottom: '10px',
            }}
          >
            {state === 'recording' ? <Square size={12} strokeWidth={2.4} fill="currentColor" /> : <Mic size={12} strokeWidth={2.2} />}
            {state === 'recording' ? 'Recording · tap to stop' : 'Tap to record'}
          </button>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px' }}>
            {VOICE_TAGS.map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTag((prev) => (prev === t ? null : t))}
                style={{
                  padding: '4px 9px',
                  borderRadius: '100px',
                  border: '1px solid var(--color-border-subtle)',
                  background: tag === t ? 'var(--color-accent-active)' : 'transparent',
                  color: tag === t ? '#fff' : 'var(--color-text-secondary)',
                  fontSize: '11px',
                  fontWeight: 600,
                  fontFamily: 'var(--font-primary)',
                  cursor: 'pointer',
                }}
              >
                {t}
              </button>
            ))}
          </div>
        </>
      )}

      {state === 'done' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div
            style={{
              padding: '8px 10px',
              borderRadius: '8px',
              background: 'var(--color-bg-hover)',
              border: '1px solid var(--color-border-subtle)',
              fontSize: '12px',
              color: 'var(--color-text-primary)',
              lineHeight: 1.5,
            }}
          >
            <div
              style={{
                fontSize: '10px',
                fontWeight: 700,
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
                color: 'var(--color-text-muted)',
                marginBottom: '3px',
              }}
            >
              You · {tag ?? 'Untagged'}
            </div>
            {copy.transcript}
          </div>
          <div
            style={{
              padding: '8px 10px',
              borderRadius: '8px',
              background: 'rgba(0,28,53,0.05)',
              border: '1px solid rgba(0,28,53,0.18)',
              fontSize: '12px',
              color: 'var(--color-text-primary)',
              lineHeight: 1.5,
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
                fontSize: '10px',
                fontWeight: 700,
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
                color: 'var(--color-accent-active)',
                marginBottom: '3px',
              }}
            >
              <CheckCircle2 size={10} strokeWidth={2.4} /> Edify
            </div>
            {copy.reply}
          </div>
          <button
            type="button"
            onClick={() => setState('idle')}
            style={{
              all: 'unset',
              cursor: 'pointer',
              fontSize: '11px',
              fontWeight: 600,
              color: 'var(--color-text-muted)',
              alignSelf: 'flex-start',
            }}
          >
            Add another note
          </button>
        </div>
      )}

      <div
        style={{
          marginTop: '10px',
          paddingTop: '10px',
          borderTop: '1px solid var(--color-border-subtle)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <span style={{ fontSize: '10.5px', color: 'var(--color-text-muted)' }}>
          Threads into your notebook.
        </span>
        <button
          type="button"
          onClick={() => router.push('/notebook')}
          style={{
            all: 'unset',
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '3px',
            fontSize: '11px',
            fontWeight: 700,
            color: 'var(--color-accent-active)',
          }}
        >
          Open notebook
          <ChevronRight size={11} strokeWidth={2.4} />
        </button>
      </div>
    </motion.div>
  );
}

// ── Types ─────────────────────────────────────────────────────────────────────

type Category = 'needs-call' | 'handled' | 'worth-knowing';

interface InsightItem {
  id: string;
  headline: string;
  detail: string;
  actionLabel?: string;
  actionHref?: string;
  actionSecondary?: string;
}

interface InsightGroup {
  category: Category;
  items: InsightItem[];
  /** Shown in collapsed state — one-liner preview of what's hidden. */
  summary?: string;
}

// ── Category config ────────────────────────────────────────────────────────────

const CATEGORY = {
  'needs-call': {
    label: 'Needs your call',
    color: '#001C35',
    // Transparent body keeps the wrapper quiet, but the blue outline
    // still groups the column as the urgent slice. Reads as an
    // outlined chip rather than a tinted block.
    bg: 'transparent',
    borderColor: 'rgba(0, 28, 53, 0.45)',
    dot: '#001C35',
  },
  'handled': {
    label: 'Edify handled this',
    color: '#1a5c3a',
    bg: 'rgba(26,92,58,0.055)',
    borderColor: 'rgba(26,92,58,0.22)',
    dot: '#166534',
  },
  'worth-knowing': {
    // Worth-knowing is reference, not warning. Amber-tinted wrapper reads
    // as alert; this group is the opposite. Calmer neutral keeps it quiet.
    label: 'Worth knowing',
    color: 'var(--color-text-secondary)',
    bg: 'transparent',
    borderColor: 'var(--color-border-subtle)',
    dot: '#9CA3AF',
  },
} as const;

// ── Insight item ──────────────────────────────────────────────────────────────

function InsightCard({
  item,
  accentColor,
  isPinned,
  onTogglePin,
  onComplete,
}: {
  item: InsightItem;
  accentColor: string;
  isPinned: boolean;
  onTogglePin: (id: string) => void;
  /** If provided, action clicks notify parent instead of hiding the card locally. */
  onComplete?: (id: string) => void;
}) {
  const [done, setDone] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const router = useRouter();
  if (done) return null;

  function complete() {
    if (onComplete) onComplete(item.id);
    else setDone(true);
  }

  return (
    <div
      style={{
        padding: '10px 12px',
        borderRadius: '8px',
        background: '#fff',
        border: isPinned ? `1px solid ${accentColor}` : '1px solid var(--color-border-subtle)',
        boxShadow: isPinned
          ? `0 1px 4px rgba(0, 28, 53,0.06), 0 0 0 1px ${accentColor}22`
          : '0 1px 4px rgba(0, 28, 53,0.06)',
        position: 'relative',
      }}
    >
      <button
        type="button"
        aria-pressed={isPinned}
        aria-label={isPinned ? 'Unpin insight' : 'Pin insight'}
        onClick={() => onTogglePin(item.id)}
        style={{
          position: 'absolute',
          top: '8px',
          right: '8px',
          width: '24px',
          height: '24px',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: '6px',
          border: 'none',
          background: isPinned ? `${accentColor}22` : 'transparent',
          color: isPinned ? accentColor : 'var(--color-text-muted)',
          cursor: 'pointer',
          transition: 'background 0.15s ease, color 0.15s ease',
        }}
      >
        <Pin
          size={13}
          strokeWidth={2}
          fill={isPinned ? 'currentColor' : 'none'}
        />
      </button>
      <p
        style={{
          margin: `0 28px ${item.detail ? '6px' : '0'} 0`,
          fontSize: '13px',
          fontWeight: 600,
          color: 'var(--color-text-primary)',
          lineHeight: 1.4,
        }}
      >
        {item.headline}
      </p>
      {item.detail && (
        <button
          type="button"
          onClick={() => setDetailOpen((v) => !v)}
          aria-expanded={detailOpen}
          style={{
            all: 'unset',
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '3px',
            fontSize: '11px',
            fontWeight: 600,
            color: 'var(--color-text-muted)',
            marginBottom: item.actionLabel ? '10px' : 0,
          }}
        >
          What does this mean?
          <ChevronDown
            size={11}
            strokeWidth={2.4}
            style={{
              transform: detailOpen ? 'rotate(180deg)' : 'rotate(0deg)',
              transition: 'transform 0.2s ease',
            }}
          />
        </button>
      )}
      <AnimatePresence initial={false}>
        {detailOpen && item.detail && (
          <motion.p
            key="card-detail"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            style={{
              margin: item.actionLabel ? '4px 0 10px' : '4px 0 0',
              fontSize: '12px',
              fontWeight: 400,
              color: 'var(--color-text-secondary)',
              lineHeight: 1.5,
              overflow: 'hidden',
            }}
          >
            {item.detail}
          </motion.p>
        )}
      </AnimatePresence>
      {item.actionLabel && (
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={() => {
              if (item.actionHref) {
                router.push(item.actionHref);
                complete();
              } else {
                complete();
              }
            }}
            style={{
              padding: '5px 12px',
              borderRadius: '6px',
              fontSize: '12px',
              fontWeight: 600,
              fontFamily: 'var(--font-primary)',
              cursor: 'pointer',
              border: 'none',
              background: accentColor,
              color: '#fff',
            }}
          >
            {item.actionLabel}
          </button>
          {item.actionSecondary && (
            <button
              type="button"
              onClick={complete}
              style={{
                padding: '5px 12px',
                borderRadius: '6px',
                fontSize: '12px',
                fontWeight: 600,
                fontFamily: 'var(--font-primary)',
                cursor: 'pointer',
                border: '1px solid var(--color-border)',
                background: 'transparent',
                color: 'var(--color-text-secondary)',
              }}
            >
              {item.actionSecondary}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ── Insight group ─────────────────────────────────────────────────────────────

function InsightGroup({
  group,
  index,
  collapsible,
  defaultCollapsed,
  pinnedIds,
  onTogglePin,
  hiddenIds,
  preamble,
  extraCount = 0,
}: {
  group: InsightGroup;
  index: number;
  collapsible: boolean;
  defaultCollapsed: boolean;
  pinnedIds: Set<string>;
  onTogglePin: (id: string) => void;
  /** Item ids to hide from this group (e.g. items that are currently pinned and shown above). */
  hiddenIds: Set<string>;
  /** Optional sub-section rendered at the top of the group, before items. */
  preamble?: React.ReactNode;
  /** Count of items rendered inside preamble (added to the group header count). */
  extraCount?: number;
}) {
  const cfg = CATEGORY[group.category];
  const [expanded, setExpanded] = useState(!defaultCollapsed);
  const visibleItems = group.items.filter((it) => !hiddenIds.has(it.id));
  if (visibleItems.length === 0 && !preamble) return null;

  const collapsed = collapsible && !expanded;
  const hiddenCount = visibleItems.length + extraCount;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.06 + index * 0.08, duration: 0.26, ease: 'easeOut' }}
      style={{
        borderRadius: '10px',
        background: cfg.bg,
        border: `1px solid ${cfg.borderColor}`,
        padding: '12px',
        marginBottom: '10px',
      }}
    >
      {/* Category label row — clickable when collapsible */}
      <button
        type="button"
        onClick={collapsible ? () => setExpanded((v) => !v) : undefined}
        disabled={!collapsible}
        aria-expanded={collapsible ? expanded : undefined}
        style={{
          all: 'unset',
          display: 'flex',
          alignItems: 'center',
          gap: '7px',
          width: '100%',
          cursor: collapsible ? 'pointer' : 'default',
          marginBottom: collapsed ? 0 : '10px',
        }}
      >
        <span
          style={{
            width: '7px',
            height: '7px',
            borderRadius: '50%',
            background: cfg.dot,
            flexShrink: 0,
          }}
        />
        <span
          style={{
            fontSize: '12px',
            fontWeight: 700,
            letterSpacing: '0.04em',
            color: cfg.color,
          }}
        >
          {cfg.label}
        </span>
        <span
          style={{
            fontSize: '11px',
            fontWeight: 600,
            color: cfg.color,
            opacity: 0.75,
            marginLeft: '2px',
          }}
        >
          · {hiddenCount}
        </span>
        {collapsible && (
          <ChevronDown
            size={14}
            strokeWidth={2.2}
            color={cfg.color}
            style={{
              marginLeft: 'auto',
              transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)',
              transition: 'transform 0.2s ease',
              opacity: 0.7,
            }}
          />
        )}
      </button>

      {collapsed && group.summary && (
        <p
          style={{
            margin: '8px 0 0',
            fontSize: '12px',
            fontWeight: 500,
            color: 'var(--color-text-secondary)',
            lineHeight: 1.5,
          }}
        >
          {group.summary}
        </p>
      )}

      <AnimatePresence initial={false}>
        {!collapsed && (
          <motion.div
            key="items"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.22, ease: 'easeOut' }}
            style={{ overflow: 'hidden' }}
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: '7px' }}>
              {preamble}
              {visibleItems.map((item) => (
                <InsightCard
                  key={item.id}
                  item={item}
                  accentColor={cfg.color}
                  isPinned={pinnedIds.has(item.id)}
                  onTogglePin={onTogglePin}
                />
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ── Focus mode sequence ───────────────────────────────────────────────────────
// One needs-call card at a time. Progress pips + Next / Skip, completion state
// when all dismissed. Pattern is Kallie's "one thing to focus on at a time" +
// Ed's "swipe-through catch-up thread".

function FocusModeSequence({
  items,
  preamble,
  pinnedIds,
  onTogglePin,
  hiddenIds,
}: {
  items: InsightItem[];
  preamble?: React.ReactNode;
  pinnedIds: Set<string>;
  onTogglePin: (id: string) => void;
  /** Item ids already shown elsewhere (e.g. pinned section). */
  hiddenIds: Set<string>;
}) {
  const cfg = CATEGORY['needs-call'];
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const [cursor, setCursor] = useState(0);

  const visible = items.filter((it) => !dismissed.has(it.id) && !hiddenIds.has(it.id));
  const safeCursor = visible.length === 0 ? 0 : Math.min(cursor, visible.length - 1);
  const current = visible[safeCursor];
  const allDone = visible.length === 0;

  function dismiss(id: string) {
    setDismissed((prev) => {
      const n = new Set(prev);
      n.add(id);
      return n;
    });
  }

  function next() {
    if (visible.length <= 1) return;
    setCursor((c) => (c + 1) % visible.length);
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.26, ease: 'easeOut' }}
      style={{
        borderRadius: '10px',
        background: cfg.bg,
        border: `1px solid ${cfg.borderColor}`,
        padding: '12px',
        marginBottom: '10px',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '7px',
          marginBottom: preamble || !allDone ? '10px' : 0,
        }}
      >
        <span
          style={{
            width: '7px',
            height: '7px',
            borderRadius: '50%',
            background: cfg.dot,
            flexShrink: 0,
          }}
        />
        <span
          style={{
            fontSize: '12px',
            fontWeight: 700,
            letterSpacing: '0.04em',
            color: cfg.color,
          }}
        >
          {cfg.label}
        </span>
        <span
          style={{
            fontSize: '11px',
            fontWeight: 600,
            color: cfg.color,
            opacity: 0.75,
            marginLeft: '2px',
          }}
        >
          · {visible.length}
        </span>
      </div>

      {preamble && (
        <div style={{ marginBottom: allDone ? 0 : '8px' }}>{preamble}</div>
      )}

      {allDone && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '12px',
            borderRadius: '8px',
            background: 'rgba(26,92,58,0.06)',
            border: '1px solid rgba(26,92,58,0.18)',
          }}
        >
          <CheckCircle2 size={16} strokeWidth={2.2} color="#1a5c3a" />
          <span style={{ fontSize: '12px', fontWeight: 600, color: '#1a5c3a' }}>
            All cleared. Edify's got the rest.
          </span>
        </div>
      )}

      <AnimatePresence mode="wait" initial={false}>
        {!allDone && current && (
          <motion.div
            key={current.id}
            initial={{ opacity: 0, x: 12 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -12 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
          >
            <InsightCard
              item={current}
              accentColor={cfg.color}
              isPinned={pinnedIds.has(current.id)}
              onTogglePin={onTogglePin}
              onComplete={dismiss}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {!allDone && visible.length > 1 && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            marginTop: '10px',
          }}
        >
          <div style={{ display: 'flex', gap: '4px', flex: 1 }}>
            {visible.map((_, i) => (
              <span
                key={i}
                style={{
                  width: i === safeCursor ? '14px' : '6px',
                  height: '4px',
                  borderRadius: '100px',
                  background:
                    i === safeCursor
                      ? cfg.color
                      : 'rgba(0,28,53,0.18)',
                  transition: 'width 0.2s ease, background 0.2s ease',
                }}
              />
            ))}
          </div>
          <button
            type="button"
            onClick={() => dismiss(current.id)}
            style={{
              all: 'unset',
              cursor: 'pointer',
              fontSize: '11px',
              fontWeight: 600,
              color: 'var(--color-text-muted)',
              padding: '4px 6px',
            }}
          >
            Skip
          </button>
          <button
            type="button"
            onClick={next}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '3px',
              padding: '4px 10px',
              borderRadius: '6px',
              border: `1px solid ${cfg.borderColor}`,
              background: 'transparent',
              color: cfg.color,
              fontSize: '11px',
              fontWeight: 700,
              fontFamily: 'var(--font-primary)',
              cursor: 'pointer',
            }}
          >
            Next
            <ChevronRight size={12} strokeWidth={2.4} />
          </button>
        </div>
      )}
    </motion.div>
  );
}

// ── Pinned section ────────────────────────────────────────────────────────────

function PinnedSection({
  items,
  pinnedIds,
  onTogglePin,
}: {
  items: { item: InsightItem; accentColor: string }[];
  pinnedIds: Set<string>;
  onTogglePin: (id: string) => void;
}) {
  if (items.length === 0) return null;
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.22, ease: 'easeOut' }}
      style={{
        borderRadius: '10px',
        background: 'rgba(34,68,68,0.04)',
        border: '1px solid rgba(34,68,68,0.18)',
        padding: '12px',
        marginBottom: '10px',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '7px',
          marginBottom: '10px',
        }}
      >
        <Pin size={12} strokeWidth={2} fill="currentColor" color="var(--color-accent-active)" />
        <span
          style={{
            fontSize: '12px',
            fontWeight: 700,
            letterSpacing: '0.04em',
            color: 'var(--color-accent-active)',
          }}
        >
          Pinned
        </span>
        <span
          style={{
            fontSize: '11px',
            fontWeight: 600,
            color: 'var(--color-accent-active)',
            opacity: 0.75,
          }}
        >
          · {items.length}
        </span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '7px' }}>
        {items.map(({ item, accentColor }) => (
          <InsightCard
            key={item.id}
            item={item}
            accentColor={accentColor}
            isPinned={pinnedIds.has(item.id)}
            onTogglePin={onTogglePin}
          />
        ))}
      </div>
    </motion.div>
  );
}

// ── Role content ──────────────────────────────────────────────────────────────

const ED_INSIGHTS: Record<BriefingPhase, InsightGroup[]> = {
  morning: [
    {
      category: 'needs-call',
      items: [
        {
          id: 'ed-m-n-1',
          headline: 'Bidvest 11:10 — Edify will sign the GRN and open credits for any shorts',
          detail:
            'On drop, Edify scans against the PO, signs lines within tolerance, opens credit requests with the driver photo for any shorts, and posts to period margin. WTD spend is already £10 over budget so shorts get extra scrutiny — step in only if the team flags something off at the dock.',
          actionLabel: 'Let it run',
          actionSecondary: "I'll sign myself",
        },
        {
          id: 'ed-m-n-2',
          headline: 'Metro credit £312 — Edify drafted the write-off, needs your approval',
          detail:
            'Reconciled against the original PO and short-shipment log. Approving posts the journal and closes the supplier loop before period margin locks. Escalate if you want Cheryl to push back on Metro instead.',
          actionLabel: 'Approve write-off',
          actionSecondary: 'Escalate to Cheryl',
        },
        {
          id: 'ed-m-n-3',
          headline: 'Matcha — Edify added 1 case to today\'s Bidfood basket',
          detail:
            'Manchester and Lightwater stock out by Friday lunch without it (Bidfood doesn\'t deliver weekends). +£42 on the basket, sends at 1:55pm with the rest of your standing order — hold only if you want to swap suppliers.',
          actionLabel: 'Let it run',
          actionSecondary: 'Adjust basket',
        },
        {
          id: 'ed-m-n-4',
          headline: 'AM bake — Edify drafted +3 muffins for today\'s warm-day pull',
          detail:
            'Forecast 11% above yesterday on weather + last-week pattern. Batch sheet is queued for the 6am team. Locks to the standing plan at 7am if no decision — costs +£4.20 on prep.',
          actionLabel: 'Approve',
          actionSecondary: 'Keep standing plan',
        },
      ],
    },
    {
      category: 'handled',
      summary: '£1,840 invoices posted overnight · yesterday\'s basket cleared · night close filed',
      items: [
        {
          id: 'ed-m-h-1',
          headline: 'Overnight invoice match · £1,840 posted, 2 held for variance',
          detail:
            '11 of 13 invoices auto-matched to POs and posted to the ledger. The two exceptions are queued for Cheryl — you don\'t need to touch them.',
        },
        {
          id: 'ed-m-h-2',
          headline: 'Yesterday\'s Bidfood basket cleared at 2pm · £1,180 confirmed',
          detail:
            'Sent to supplier, confirmation received, Thursday delivery slot held. Full audit trail in the order log if you want to check.',
        },
        {
          id: 'ed-m-h-3',
          headline: 'Urban Fresh GRN matched overnight — 3 lines auto-signed',
          detail:
            'All within tolerance, no discrepancies. Posted to period margin so the numbers you see above are current.',
        },
        {
          id: 'ed-m-h-4',
          headline: 'Night-shift close filed · EOD £19,820 vs plan £18,910',
          detail:
            'Yesterday\'s final close posted. Waste £24, markdowns £0. The £910 over-plan is already baked into today\'s stock forecast.',
        },
      ],
    },
    {
      category: 'worth-knowing',
      summary: 'Sales → stock → orders loop kicking in · muffin rollover risk · today warm again',
      items: [
        {
          id: 'ed-m-w-1',
          headline: 'Yesterday\'s warm spell pulled iced-drink cover down 3 days — Bidfood basket already bumped +1 case',
          detail:
            'This is what the sales → stock → orders loop looks like when it runs itself. No action needed — just so you can see the join-up working.',
        },
        {
          id: 'ed-m-w-2',
          headline: '6 blueberry muffins rolled over from yesterday — at risk of waste today',
          detail:
            'Yesterday\'s bake-off left 6 on the shelf this morning. Shelf life ends today — if they don\'t sell by close, they bin. Typical rollover at this store is 2. Worth moving them front-of-counter or tagging for staff to upsell.',
          actionLabel: 'Got it',
        },
        {
          id: 'ed-m-w-3',
          headline: 'Today\'s weather: 21° vs 15° forecast — pace expected to track yesterday',
          detail:
            'Another 6° warm-day swing. Plan your cold chain and iced-drink mise-en-place for the same lift you saw yesterday afternoon.',
        },
      ],
    },
  ],
  midday: [
    {
      category: 'needs-call',
      items: [
        {
          id: 'ed-d-n-1',
          headline: 'Bidvest landed — Edify signed 11 of 14 lines, 3 need your eyes',
          detail:
            'Auto-matched and posted the 11 within tolerance. Three exceptions: 2 shorts already have credit requests drafted, 1 price variance is queued for Cheryl. Approving locks period margin and closes the delivery.',
          actionLabel: 'Approve the three',
          actionSecondary: 'Open to inspect',
        },
        {
          id: 'ed-d-n-2',
          headline: 'Lunch pace +18% — Edify can hold the 3pm cut',
          detail:
            'Covers running 18% above forecast through 11:30. The planned 4 → 3 cut leaves the floor short if flow holds. On hold, Edify texts the staff staying on and updates the roster. No-op if flow drops back below 5%.',
          actionLabel: 'Hold the cut',
          actionSecondary: 'Keep as planned',
        },
        {
          id: 'ed-d-n-3',
          headline: 'Matcha basket — Edify will send at 1:55pm unless held',
          detail:
            '5 min before the Bidfood cut-off. £280 as drafted; without it two sites stock out Friday. Holds the rest of your standing recurring order automatically if you want to swap.',
          actionLabel: 'Send now',
          actionSecondary: 'Hold and adjust',
        },
        {
          id: 'ed-d-n-4',
          headline: 'Tomorrow\'s muffin batch — Edify recommends going back to 12',
          detail:
            'Zero rollover today, warm-day forecast tomorrow. Edify will draft the AM sheet at 12 unless held. Reverts to 9 if you keep the smaller batch.',
          actionLabel: 'Go to 12',
          actionSecondary: 'Keep at 9',
        },
      ],
    },
    {
      category: 'handled',
      summary: 'Bidvest GRN 11/14 matched · tomatoes basket updated · lunch shift confirmed',
      items: [
        {
          id: 'ed-d-h-1',
          headline: 'Bidvest GRN: 11 of 14 lines matched · £381 posted · 3 flagged',
          detail:
            'Auto-match hit the tolerances on 11 lines. Three are open: 2 short-shipments and 1 price variance — all queued for Cheryl.',
        },
        {
          id: 'ed-d-h-2',
          headline: 'Reorder point triggered on tomatoes · Bidfood basket updated +2 trays',
          detail:
            'Morning sales pulled tomato cover below the safety threshold. Edify added 2 trays to tomorrow\'s Bidfood basket. No decision needed.',
        },
        {
          id: 'ed-d-h-3',
          headline: 'Lunch shift reminders sent · Priya confirmed on time',
          detail:
            'Mid-shift handover nudge went to Priya at 11:30. Confirmed. Tom in for the afternoon from 2pm.',
        },
      ],
    },
    {
      category: 'worth-knowing',
      summary: 'Sales +11% vs forecast · ham & cheese pace · baguette retention',
      items: [
        {
          id: 'ed-d-w-1',
          headline: 'Sales +11% vs forecast at 11am — warm day pulling extra cover',
          detail:
            '£13,770 vs £12,390 forecast. Iced drinks and cold food over-indexing as expected — keep ice and cold-brew topped up.',
        },
        {
          id: 'ed-d-w-2',
          headline: 'Ham & cheese baguette prep running ahead of sales pace',
          detail:
            'Morning batch was 8; 5 sold, 3 still displayed. If the lunch pickup doesn\'t catch up by 11:30, chill the remainder to extend shelf.',
          actionLabel: 'Got it',
        },
        {
          id: 'ed-d-w-3',
          headline: 'Baguette buyers at lunch return 2.3× more often than coffee-only customers',
          detail:
            'A retention pattern, not just a margin line. Something to keep in mind when you\'re thinking about prep volumes for the 12–2pm window.',
        },
      ],
    },
  ],
  afternoon: [
    {
      category: 'needs-call',
      items: [
        {
          id: 'ed-a-n-1',
          headline: 'Tomorrow\'s Bidfood basket — Edify will send in 30 min if no adjust',
          detail:
            '£1,240, 47 lines. Three changes from last Thursday: matcha +1, tomatoes +2 (reorder point hit), cleaning roll −1 (overstock). Sends at 1:55pm and books the 11am Friday slot.',
          actionLabel: 'Let it run',
          actionSecondary: 'Open to adjust',
        },
        {
          id: 'ed-a-n-2',
          headline: '3pm cold-drink push — Edify drafted the board spec + barista brief',
          detail:
            'Iced latte + cold-brew citrus, lifted to the front counter. 5-min team brief queued on the floor tablet. On push, Edify publishes the board and sends the brief — no SKU mix or pricing changes.',
          actionLabel: 'Push to floor',
          actionSecondary: 'Hold',
        },
        {
          id: 'ed-a-n-3',
          headline: 'Tomorrow AM muffins — Edify will draft 12 unless held',
          detail:
            'Zero rollover today, warm-day forecast tomorrow. 12 returns to the standing plan. Sheet drafts at 8pm tonight, you\'ll see it on the morning pre-check.',
          actionLabel: 'Confirm 12',
          actionSecondary: 'Keep at 9',
        },
        {
          id: 'ed-a-n-4',
          headline: 'Evening roster — Edify will swap Tom into the no-show slot',
          detail:
            'Tom is on-site, willing, hits the labour budget. On confirm Edify updates the roster, sends the SMS, and logs the change. Or pick from the standby shortlist.',
          actionLabel: 'Confirm Tom',
          actionSecondary: 'Pick someone else',
        },
      ],
    },
    {
      category: 'handled',
      summary: 'Lunch £8,240 · shift change done · GRN reconciled · drink spec pushed',
      items: [
        {
          id: 'ed-a-h-1',
          headline: 'Lunch service wrapped · £8,240 taken · 12% above yesterday',
          detail:
            'Strongest lunch of the week so far. Ham & cheese sold out by 13:45, coffee volumes flat, iced drinks up 30%.',
        },
        {
          id: 'ed-a-h-2',
          headline: '3pm shift change confirmed · 4 → 3 as planned',
          detail:
            'Priya off, Tom on for the afternoon. Flow is settling so the cut holds — check back if covers spike.',
        },
        {
          id: 'ed-a-h-3',
          headline: 'Bidvest GRN fully reconciled · 3 discrepancies queued for Cheryl',
          detail:
            'All 14 lines closed. Auto-credit workflow started on the two short-shipments. Nothing more for you on this delivery.',
        },
      ],
    },
    {
      category: 'worth-knowing',
      summary: 'EOD tracking £20,250 · warm-day loop closed · ham & cheese sold out early',
      items: [
        {
          id: 'ed-a-w-1',
          headline: 'Expected EOD £20,250 vs £18,910 plan — holding the pace',
          detail:
            'Pace suggests +£1.3k at close. That\'ll post through to period margin overnight — no action needed, just for your number.',
        },
        {
          id: 'ed-a-w-2',
          headline: 'Warm-day loop closed: sales +11% → stock −3 days → Bidfood +1 case',
          detail:
            'Full loop ran without a touch. Worth noting for the conversation with head office — this is the kind of automation payoff we\'ve been pitching.',
        },
        {
          id: 'ed-a-w-3',
          headline: 'Ham & cheese sold out at 13:45 — earliest this week',
          detail:
            'Tuesday was 14:20, Wednesday 14:10. Pattern suggests the lunch pull is accelerating — worth watching prep volumes next week.',
        },
      ],
    },
  ],
  evening: [
    {
      category: 'needs-call',
      items: [
        {
          id: 'ed-e-n-1',
          headline: 'End-of-day close — Edify pre-filled waste, markdowns and cash-up',
          detail:
            'Waste: 6 muffins, 2 baguettes (pace-matched against the display log). Markdowns: £0. Cash variance: −£0.40, within tolerance. Submitting posts to period margin overnight.',
          actionLabel: 'Submit close',
          actionSecondary: 'Adjust first',
        },
        {
          id: 'ed-e-n-2',
          headline: 'Tomorrow\'s Fresh Direct basket — Edify will auto-sign the GRN at 11am',
          detail:
            'Basket locked at 2pm today, 11am Friday slot booked. On delivery Edify scans, signs lines within tolerance, opens credits for any shorts, and posts to period margin. You\'ll only see it again if something breaks the auto-path.',
          actionLabel: 'Got it',
          actionSecondary: "I'll sign myself",
        },
        {
          id: 'ed-e-n-3',
          headline: 'Weekend roster — Edify drafted asks for the 2 open slots',
          detail:
            'Saturday 10–14 and Sunday 14–18. Shortlist drawn from staff who\'ve said yes to similar slots in the last 30 days. On approve, Edify sends the asks and chases non-replies at 8am tomorrow. Escalates to ops if still open by 6pm.',
          actionLabel: 'Send asks',
          actionSecondary: 'Escalate now',
        },
        {
          id: 'ed-e-n-4',
          headline: 'Tonight\'s compliance — Edify pre-filled temps + fire door, signature needed',
          detail:
            'Sensors auto-filled PM temperatures from 5pm to close, all in range. Fire door check pre-filled from the evening walk camera pattern. 30 seconds to sign and lock the night close.',
          actionLabel: 'Sign both',
          actionSecondary: 'Open each',
        },
      ],
    },
    {
      category: 'handled',
      summary: 'Today closed £20,180 · Bidfood sent · recipes recosted · PM temps logged',
      items: [
        {
          id: 'ed-e-h-1',
          headline: 'Today\'s close wrapped · EOD £20,180 vs £18,910 plan (+£1,270)',
          detail:
            'Final numbers in. Best Thursday this quarter. Period margin delta posting overnight.',
        },
        {
          id: 'ed-e-h-2',
          headline: 'Tomorrow\'s Bidfood basket sent at 2pm · £1,240 confirmed',
          detail:
            'Supplier confirmation received, delivery slot held. You\'ll see the basket again tomorrow morning as the GRN pre-check.',
        },
        {
          id: 'ed-e-h-3',
          headline: 'Tomorrow\'s recipes recosted after flour variance · margins refreshed',
          detail:
            '12 recipes using the affected flour SKU pushed through overnight. Cost pack updated with the new margins — ready for Cheryl.',
        },
        {
          id: 'ed-e-h-4',
          headline: 'PM temperature log completed automatically from sensor data',
          detail:
            '15-min reads from 5pm to close, all within range. Ready for your sign-off above.',
        },
      ],
    },
    {
      category: 'worth-knowing',
      summary: 'Muffin rollover fixed · weekend weather split · evening labour cut worked',
      items: [
        {
          id: 'ed-e-w-1',
          headline: 'Muffin rollover didn\'t happen today — first time this week',
          detail:
            'The 12 → 9 batch tune-down worked. Worth holding for one more day to confirm the pattern, then it becomes the standing plan.',
        },
        {
          id: 'ed-e-w-2',
          headline: 'Weekend weather: warm Saturday (22°), cooler Sunday (16°)',
          detail:
            'Edify has already adjusted Saturday\'s prep forecast up 8%, Sunday down 4%. Basket for Saturday will reflect the lift tomorrow.',
        },
        {
          id: 'ed-e-w-3',
          headline: 'Evening labour at 94% of plan — cut worked without hurting service',
          detail:
            'No covers reported missed, no waits over 4 min. The 4 → 3 call was right even with lunch running hot. Good data point for future days.',
        },
      ],
    },
  ],
};

const GM_INSIGHTS: Record<BriefingPhase, InsightGroup[]> = {
  morning: [
    {
      category: 'needs-call',
      items: [
        {
          id: 'gm-m-n-1',
          headline: 'Fresh Direct 11am — Edify will sign the GRN and log the milk short',
          detail:
            'Driver pre-flagged one case short. On drop Edify scans against the PO, signs lines within tolerance, attaches the driver photo, opens the credit to Fresh Direct, and posts to period margin. Step in only if the team flags something else off at the dock.',
          actionLabel: 'Let it run',
          actionSecondary: "I'll sign myself",
        },
        {
          id: 'gm-m-n-2',
          headline: 'Matcha — Edify added 1 case to today\'s Bidfood basket',
          detail:
            'Without it you stock out Friday lunch. +£42 on the basket, sends at 1:55pm with the rest of your standing order. Hold only if you want to swap suppliers.',
          actionLabel: 'Let it run',
          actionHref: '/assisted-ordering',
          actionSecondary: 'Open to adjust',
        },
        {
          id: 'gm-m-n-3',
          headline: 'Tomorrow\'s Bidfood basket — Edify drafted £1,240, sends at 2pm',
          detail:
            'Built from yesterday\'s pace + weather + your standing recurring order. Three changes from last Thursday: matcha +1, tomatoes +2, cleaning roll −1. Books the 11am Friday slot on send.',
          actionLabel: 'Approve',
          actionSecondary: 'Open to review',
        },
        {
          id: 'gm-m-n-4',
          headline: 'AM compliance — Edify pre-filled temps and fire door, signature needed',
          detail:
            'Sensors filled overnight temps (9pm–6am, all in range). Fire door pre-filled from yesterday\'s walk pattern. Tuesday\'s policy ack still needs you — Edify can\'t sign that one. Two taps total.',
          actionLabel: 'Sign all',
          actionSecondary: 'Open each',
        },
      ],
    },
    {
      category: 'handled',
      summary: 'Overnight temps logged · 2 shifts confirmed',
      items: [
        {
          id: 'gm-m-h-1',
          headline: 'Overnight temperature sensors logged · all within range',
          detail:
            'Fridge and freezer reads captured every 15 minutes from 9pm–6am. Log pre-filled for your AM sign-off — just confirm.',
        },
        {
          id: 'gm-m-h-2',
          headline: 'Priya and Tom shift reminders sent 6am',
          detail:
            'Priya (opening) and Tom (mid) both confirmed. Evening cover still open — Edify will nudge at 10am if no one\'s picked up.',
        },
      ],
    },
    {
      category: 'worth-knowing',
      summary: 'Baguette retention 2.3× · pastry waste up after 3pm',
      items: [
        {
          id: 'gm-m-w-1',
          headline: 'Baguette buyers at lunch return 2.3× more often than coffee-only customers',
          detail:
            'Your lunch pull isn\'t just a margin line — it\'s a retention driver. Something to keep in mind when you\'re thinking about prep volumes or cover for the 12–2pm window.',
        },
        {
          id: 'gm-m-w-2',
          headline: 'Pastry waste up 40% after 3pm — three days running',
          detail:
            'This isn\'t random. It maps to morning over-pull on the batch — you\'re making more than lunchtime sells. A quick word with the shift lead today could fix it before the weekend.',
        },
        {
          id: 'gm-m-w-3',
          headline: 'Evening labour at 107% of plan — not just last night',
          detail:
            'Third time this week. If deliveries slip again today it\'ll compound. Worth flagging to whoever sets the evening roster.',
        },
      ],
    },
  ],
  midday: [
    {
      category: 'needs-call',
      items: [
        {
          id: 'gm-d-n-1',
          headline: 'Fresh Direct GRN — Edify ready to sign with the milk short attached',
          detail:
            'Physical check matches the pre-flag. On sign-off Edify logs the discrepancy, opens the £18 credit to Fresh Direct with the photo, and posts to period margin. Dispute if you think the count is wrong.',
          actionLabel: 'Sign with credit',
          actionSecondary: 'Dispute first',
        },
        {
          id: 'gm-d-n-2',
          headline: 'Table 4 — Edify drafted a recovery: free coffee + priority re-fire',
          detail:
            'Waiting 14 min, server flagged at the POS. On apply Edify comps the bill, sends the priority re-fire to the kitchen, and logs the incident against service-recovery cost. Or take it manually.',
          actionLabel: 'Apply recovery',
          actionSecondary: 'Handle manually',
        },
        {
          id: 'gm-d-n-3',
          headline: '1pm stock check — Edify pre-filled 10 items from overnight counts',
          detail:
            'Quick floor scan to confirm. Anything you flag gets fed straight into tomorrow\'s basket recalculation, and you\'ll see the changes on the afternoon brief.',
          actionLabel: 'Start check',
          actionSecondary: 'Skip today',
        },
      ],
    },
    {
      category: 'handled',
      summary: 'GRN signed with credit · evening cover confirmed',
      items: [
        {
          id: 'gm-d-h-1',
          headline: 'Fresh Direct GRN signed with auto-discrepancy · credit queued',
          detail:
            'Milk short logged, photo attached, supplier notified. Cheryl will see the credit note in her afternoon queue.',
        },
        {
          id: 'gm-d-h-2',
          headline: 'AM compliance checks complete · all green',
          detail:
            'Temperature log, fire door, Tuesday policy ack — all in. Nothing pending until the PM round at close.',
        },
        {
          id: 'gm-d-h-3',
          headline: 'Evening cover request answered by Jake · shift confirmed',
          detail:
            'Jake picked up the 5–9 slot. Roster updated, text sent. You\'re covered for tonight.',
        },
      ],
    },
    {
      category: 'worth-knowing',
      summary: 'Sales +11% at 11am · warm through 3pm',
      items: [
        {
          id: 'gm-d-w-1',
          headline: 'Sales tracking +11% at 11am — keep iced drinks stocked',
          detail:
            'Same pattern as yesterday. Cold-brew and iced latte mix is under pressure — check the drinks fridge in 20 min.',
        },
        {
          id: 'gm-d-w-2',
          headline: 'Ham & cheese low — consider moving to prep priority',
          detail:
            'Down to 3 at 11:45. Lunch pickup is 12–1pm. Prepping 4 more now avoids a sell-out before 1:30.',
        },
        {
          id: 'gm-d-w-3',
          headline: 'Today\'s forecast: warm through 3pm, cooling after',
          detail:
            '21° peak at 2pm, drops to 16° by 5pm. Plan the afternoon chill-out drinks push accordingly.',
        },
      ],
    },
  ],
  afternoon: [
    {
      category: 'needs-call',
      items: [
        {
          id: 'gm-a-n-1',
          headline: '3pm shift change — Edify will confirm Priya off, Tom on, drop to 3',
          detail:
            'Flow has settled, the planned 4 → 3 cut looks right. On confirm Edify sends Priya the off-clock nudge, updates the roster, and texts Tom the floor briefing. Holds the 4 if you keep the extra.',
          actionLabel: 'Confirm cut',
          actionSecondary: 'Hold the 4',
        },
        {
          id: 'gm-a-n-2',
          headline: 'Tomorrow\'s Bidfood basket — Edify will send in 20 min unless adjusted',
          detail:
            '£1,240, matcha +1 case, tomatoes +2 trays. Built from your standing recurring order + today\'s pace. Sends at 1:55pm and books the 11am Friday slot.',
          actionLabel: 'Let it run',
          actionSecondary: 'Open to adjust',
        },
        {
          id: 'gm-a-n-3',
          headline: 'Close prep — Edify queued the 8-item checklist on the floor tablet',
          detail:
            'Drinks fridge top-up, counter reset, cash prep. Edify logs completion and surfaces anything skipped in tomorrow\'s morning brief.',
          actionLabel: 'Open checklist',
          actionSecondary: "Skip — I'll brief",
        },
        {
          id: 'gm-a-n-4',
          headline: 'Saturday 10–14 gap — Edify drafted asks for Priya, Jake, Daisy',
          detail:
            'All three said yes to similar slots in the last 30 days. On approve Edify sends the asks and chases non-replies at 8am. Escalates to ops if still open by 6pm.',
          actionLabel: 'Send asks',
          actionSecondary: 'Escalate now',
        },
      ],
    },
    {
      category: 'handled',
      summary: 'Lunch £8,240 · handover done',
      items: [
        {
          id: 'gm-a-h-1',
          headline: 'Lunch service wrapped · £8,240 taken · ahead of yesterday',
          detail:
            'Strongest lunch this week. Ham & cheese cleared by 13:45, coffee flat, iced drinks up 30%.',
        },
        {
          id: 'gm-a-h-2',
          headline: 'AM-to-PM handover complete',
          detail:
            'Priya → Tom handover at 2pm, all open tickets and floor notes passed. No issues flagged.',
        },
        {
          id: 'gm-a-h-3',
          headline: 'Cold drinks pushed to the front counter as Edify suggested',
          detail:
            'Board spec is up, barista brief done. Track the 3–4pm uplift on the afternoon dashboard if you want to see the effect.',
        },
      ],
    },
    {
      category: 'worth-knowing',
      summary: '12 hours labour left · ham & cheese sold out',
      items: [
        {
          id: 'gm-a-w-1',
          headline: 'Pastry waste after 3pm — check the display at 4pm',
          detail:
            'Same pattern as the last three days. Pull what looks tired or mark down for the 4–5pm commuter push — avoids the close-time bin.',
        },
        {
          id: 'gm-a-w-2',
          headline: 'Evening labour budget: 12 hours remaining',
          detail:
            'Against a 16-hour plan. You\'re under, so you have room for a second closer if service stays busy — or bank the saving.',
        },
        {
          id: 'gm-a-w-3',
          headline: 'Ham & cheese sold out at 13:45',
          detail:
            'Earliest this week. Worth flagging to the AM team for tomorrow\'s prep — might need +2 on the batch.',
        },
      ],
    },
  ],
  evening: [
    {
      category: 'needs-call',
      items: [
        {
          id: 'gm-e-n-1',
          headline: 'Close cash-up — Edify pre-filled the close pack',
          detail:
            'Waste: 2 muffins (pace-matched). Markdowns: £0. Cash variance: within tolerance. Submitting posts to period margin overnight and closes today\'s pack.',
          actionLabel: 'Submit',
          actionSecondary: 'Adjust waste',
        },
        {
          id: 'gm-e-n-2',
          headline: 'Tomorrow opening — Edify already sent Priya the 6am reminder',
          detail:
            'Confirmed at 7pm. Edify will text again at 5:30am if she\'s not on-site by 5:50, and the standby list auto-kicks in if she doesn\'t make it.',
          actionLabel: 'Got it',
          actionSecondary: 'Change opener',
        },
        {
          id: 'gm-e-n-3',
          headline: 'Fire door log — Edify pre-filled from the evening walk, signature needed',
          detail:
            'Camera pattern shows the walk completed at 19:42, all stations checked. 30 seconds to sign and lock the night close.',
          actionLabel: 'Sign',
          actionSecondary: 'Open log',
        },
      ],
    },
    {
      category: 'handled',
      summary: 'EOD £20,180 · basket sent for tomorrow',
      items: [
        {
          id: 'gm-e-h-1',
          headline: 'PM temperature checks logged from sensors',
          detail:
            'All fridges and freezers within range from 5pm to close. Log ready for the sign-off above.',
        },
        {
          id: 'gm-e-h-2',
          headline: 'Close-of-day summary · £20,180 EOD · waste £28',
          detail:
            'Best Thursday this quarter. Waste held low. Numbers post overnight to period margin.',
        },
        {
          id: 'gm-e-h-3',
          headline: 'Tomorrow\'s basket sent · confirmation received from Bidfood',
          detail:
            '£1,240 confirmed, delivery booked for 11am. You\'ll see it again tomorrow morning as the pre-check.',
        },
        {
          id: 'gm-e-h-4',
          headline: 'Staff briefing email sent · 6 of 9 acknowledged so far',
          detail:
            'Weekend cover notes + cold-drinks push instructions. Edify will nudge the three pending at 8am tomorrow.',
        },
      ],
    },
    {
      category: 'worth-knowing',
      summary: 'Muffin fix held · weekend warm-then-cool',
      items: [
        {
          id: 'gm-e-w-1',
          headline: 'Muffin rollover didn\'t repeat tonight — batch adjustment worked',
          detail:
            'First day all week with zero rollover. If tomorrow holds, the smaller batch becomes the standing plan.',
        },
        {
          id: 'gm-e-w-2',
          headline: 'Weekend warm spell: Saturday same, Sunday cooler',
          detail:
            '22° Saturday, 16° Sunday. Prep forecasts already tuned — just a heads-up so the Saturday opening team knows to expect the lift.',
        },
        {
          id: 'gm-e-w-3',
          headline: 'Close time tonight: 5 min faster than last Thursday',
          detail:
            'Automations trimmed the compliance + cash-up time. Worth noting for the pattern — small wins compound.',
        },
      ],
    },
  ],
};

const CHERYL_INSIGHTS: Record<BriefingPhase, InsightGroup[]> = {
  morning: [
    {
      category: 'needs-call',
      items: [
        {
          id: 'cheryl-m-n-1',
          headline: '3 PO mismatches ready to clear — Bidfood (2) and Metro (1)',
          detail:
            'Edify has pre-filled queries and write-off tolerances for all three. Approve as-is or send the supplier queries — either way it\'s one pass, not three.',
          actionLabel: 'Approve or send queries',
          actionSecondary: 'Defer to tomorrow',
        },
        {
          id: 'cheryl-m-n-2',
          headline: 'Metro credit £312 — 18 days open, 4 past SLA',
          detail:
            'It\'s sitting in the queue but it won\'t move without your workflow action. One click to open, one to close.',
          actionLabel: 'Open credit workflow',
        },
        {
          id: 'cheryl-m-n-3',
          headline: 'Flour variance linked to contract — dispute or accept',
          detail:
            'Edify has matched the invoice to the contract and flagged the 12% gap. Your call: accept for this delivery or raise it formally before the invoice ages.',
          actionLabel: 'Raise dispute',
          actionSecondary: 'Accept variance',
        },
        {
          id: 'cheryl-m-n-4',
          headline: 'Chase emails drafted for Urban Fresh and Lacto',
          detail:
            'Addressed to the right contacts, referencing the correct PO numbers. One tap sends both — or open to adjust before sending.',
          actionLabel: 'Send both',
          actionSecondary: 'Review first',
        },
      ],
    },
    {
      category: 'handled',
      summary: '£2,340 invoices cleared · recipes recosted · period accruals drafted',
      items: [
        {
          id: 'cheryl-m-h-1',
          headline: 'Overnight invoice match · 14 cleared · £2,340 posted · 3 held for tolerance',
          detail:
            '14 invoices auto-matched to POs and posted to the ledger. The three held items are queued in the mismatch workflow above — no other action needed.',
        },
        {
          id: 'cheryl-m-h-2',
          headline: 'Weekend brunch recipes recosted after flour variance · margins refreshed',
          detail:
            'All 12 recipes using the affected flour SKU recalculated and pushed to the cost pack. Margin deltas surfaced inline if you want to scan.',
        },
        {
          id: 'cheryl-m-h-3',
          headline: 'Period accruals drafted for the three late suppliers',
          detail:
            'If the invoices still haven\'t landed by close of play, these will post automatically so the period cost picture isn\'t skewed.',
        },
      ],
    },
    {
      category: 'worth-knowing',
      summary: 'Two suppliers past posting window · period at 64% · flour contract context',
      items: [
        {
          id: 'cheryl-m-w-1',
          headline: 'Urban Fresh and Lacto invoices past their usual posting window',
          detail:
            'Both suppliers typically post within 3 days. If they batch at month end, it\'ll create a cost spike you\'ll have to explain in the period review. Chase emails drafted (above).',
        },
        {
          id: 'cheryl-m-w-2',
          headline: 'Period cost completeness at 64% — below where it should be',
          detail:
            'Dry goods are the main gap. At this point in the period you\'d normally expect to be at 75%+. The late invoices are the reason.',
        },
        {
          id: 'cheryl-m-w-3',
          headline: 'Flour SKU came in +12% vs contract — no agreed price change on file',
          detail:
            'Context on the dispute decision above: this supplier has been within contract for six months. Single-delivery blip or early sign of a renegotiation? Worth watching the next two drops.',
        },
      ],
    },
  ],
  midday: [
    {
      category: 'needs-call',
      items: [
        {
          id: 'cheryl-d-n-1',
          headline: 'Urban Fresh batch just landed — match and post 5 invoices?',
          detail:
            'Chase email paid off. All 5 match their POs within tolerance. One tap posts them all; or open to review line-by-line.',
          actionLabel: 'Post all 5',
          actionSecondary: 'Review first',
        },
        {
          id: 'cheryl-d-n-2',
          headline: 'Bidfood credit note £218 — approve payout?',
          detail:
            'Raised last week for a short-shipment. Supplier confirmed, refund ready to apply to the open invoice. Approve to net off.',
          actionLabel: 'Approve net-off',
          actionSecondary: 'Keep open',
        },
        {
          id: 'cheryl-d-n-3',
          headline: 'Flour supplier replied — accept new price or escalate?',
          detail:
            '+12% confirmed as a permanent change. Supplier offered a forward-contract lock at +8%. Your call before the next delivery ships.',
          actionLabel: 'Accept +8% forward',
          actionSecondary: 'Escalate',
        },
        {
          id: 'cheryl-d-n-4',
          headline: 'Period forecast 2% above plan — action?',
          detail:
            'Driven mostly by the flour variance. Options: absorb within contingency, flag to ops, or prep a re-forecast. Edify has drafts for each.',
          actionLabel: 'Open options',
          actionSecondary: 'Defer to close',
        },
      ],
    },
    {
      category: 'handled',
      summary: 'Chase worked · match run £3,240 · cost pack drafting',
      items: [
        {
          id: 'cheryl-d-h-1',
          headline: 'Chase emails worked — Urban Fresh posted · Lacto in progress',
          detail:
            'Urban Fresh delivered within 4 hours (above). Lacto replied: posting by 4pm today. You\'ll see their batch in the afternoon queue.',
        },
        {
          id: 'cheryl-d-h-2',
          headline: 'Invoice match run continuing · 18 cleared · £3,240 posted',
          detail:
            '4 more cleared since 11am. Running clean — no new holds this window.',
        },
        {
          id: 'cheryl-d-h-3',
          headline: 'Cost pack draft generated · queued for 3pm distribution',
          detail:
            'Numbers current as of 11am post. Will auto-refresh once the Urban Fresh batch lands and posts.',
        },
      ],
    },
    {
      category: 'worth-knowing',
      summary: 'COGS 28.4% vs 27.2% target · new supplier pending · close in 3 days',
      items: [
        {
          id: 'cheryl-d-w-1',
          headline: 'COGS tracking 28.4% vs 27.2% target — 1.2 points over',
          detail:
            'Flour is driving 0.7 of that. Rest is mix-shift from the warm-day sales bump. Worth watching — it may normalise by close if weather breaks.',
        },
        {
          id: 'cheryl-d-w-2',
          headline: 'New supplier awaiting onboarding in procurement queue',
          detail:
            'Lacto alternative — two sites have flagged interest. Procurement needs a cost-comparison pack from you before greenlight.',
        },
        {
          id: 'cheryl-d-w-3',
          headline: 'Period close is 3 days away — pace check looks good',
          detail:
            'At 64% now, projecting 82% by close. On target if the late-supplier chase lands by Friday.',
        },
      ],
    },
  ],
  afternoon: [
    {
      category: 'needs-call',
      items: [
        {
          id: 'cheryl-a-n-1',
          headline: 'Period close prep — approve today\'s accruals by 4pm',
          detail:
            'Edify has drafted accruals for Urban Fresh, Lacto, and the Metro credit. Scan and approve, or adjust individual lines.',
          actionLabel: 'Approve all',
          actionSecondary: 'Review each',
        },
        {
          id: 'cheryl-a-n-2',
          headline: 'Lacto invoices arrived — match and post?',
          detail:
            'Batch of 8 from Lacto, all within tolerance. Post all to close the chase loop.',
          actionLabel: 'Post all 8',
          actionSecondary: 'Review first',
        },
        {
          id: 'cheryl-a-n-3',
          headline: 'Weekend cost forecast — any anomalies to flag?',
          detail:
            'Edify\'s forecast looks clean for Saturday, slightly under-indexed for Sunday (cooler). Worth a 30-second scan before ops teams cut next week\'s plan.',
          actionLabel: 'Scan & approve',
        },
        {
          id: 'cheryl-a-n-4',
          headline: 'Tomorrow\'s cost pack distribution list — confirm',
          detail:
            '7 recipients as standard + 2 new (ops leads). Edify has the draft ready to send at 7am.',
          actionLabel: 'Confirm',
          actionSecondary: 'Edit list',
        },
      ],
    },
    {
      category: 'handled',
      summary: '5 more invoices matched · accruals committed · flour escalated',
      items: [
        {
          id: 'cheryl-a-h-1',
          headline: 'Afternoon match run · 5 more cleared · £1,120 posted',
          detail:
            'Total for the day: 27 cleared, £6,700 posted. 2 remain in review — both small-value, will roll to tomorrow.',
        },
        {
          id: 'cheryl-a-h-2',
          headline: 'Period accruals committed · close pack queued',
          detail:
            'Accruals posted, close pack locked for tomorrow AM review. Final refresh happens at 6am.',
        },
        {
          id: 'cheryl-a-h-3',
          headline: 'Flour contract escalated to procurement',
          detail:
            'Forward-contract +8% offer forwarded with your notes. Procurement will weigh in by Monday.',
        },
      ],
    },
    {
      category: 'worth-knowing',
      summary: 'Period at 78% on target · Bidfood 3% above trend · chase worked fast',
      items: [
        {
          id: 'cheryl-a-w-1',
          headline: 'Period cost completeness now 78% — on target',
          detail:
            'Up from 64% this morning. Chase emails + late-supplier accruals did the work.',
        },
        {
          id: 'cheryl-a-w-2',
          headline: 'Bidfood running 3% above trend',
          detail:
            'Not huge yet, but consistent across 4 of the last 5 weeks. Worth a supplier conversation before it compounds.',
        },
        {
          id: 'cheryl-a-w-3',
          headline: 'Urban Fresh chase worked — they posted within 4 hours',
          detail:
            'Chase email sent 9am, batch landed 12:50pm. Process works. Good data point for the next time someone drags.',
        },
      ],
    },
  ],
  evening: [
    {
      category: 'needs-call',
      items: [
        {
          id: 'cheryl-e-n-1',
          headline: 'End-of-day cost pack review — send to leadership?',
          detail:
            'Pack is ready: period at 84%, COGS 28.0%, two notes on flour + Bidfood trend. Approve to send on the 7pm distribution.',
          actionLabel: 'Send pack',
          actionSecondary: 'Review first',
        },
        {
          id: 'cheryl-e-n-2',
          headline: 'Tomorrow\'s audit checklist — approve',
          detail:
            '6-item checklist, all pre-populated. Takes 30 seconds unless anything\'s off.',
          actionLabel: 'Approve',
        },
        {
          id: 'cheryl-e-n-3',
          headline: 'Pending variance queue — 2 unresolved, defer or escalate?',
          detail:
            'Both are small (£42 + £18). Edify can auto-write-off if you authorise, or escalate to the supplier for one more pass.',
          actionLabel: 'Auto write-off',
          actionSecondary: 'Escalate both',
        },
      ],
    },
    {
      category: 'handled',
      summary: 'Close pack ready · £4,820 posted today · accruals teed up',
      items: [
        {
          id: 'cheryl-e-h-1',
          headline: 'Period close pack ready · awaiting sign-off tomorrow',
          detail:
            'Final numbers refreshed at close. Pack is locked and routed to your morning queue.',
        },
        {
          id: 'cheryl-e-h-2',
          headline: 'Today\'s invoices posted · £4,820 total · 3 flagged for tomorrow',
          detail:
            'The three holdouts are low-priority variance checks. Edify has them queued as your first task tomorrow.',
        },
        {
          id: 'cheryl-e-h-3',
          headline: 'Automatic accruals for late-arrivers teed up',
          detail:
            'If anything lands overnight, it posts clean. If not, accruals fire automatically at 6am so the period picture stays complete.',
        },
      ],
    },
    {
      category: 'worth-knowing',
      summary: 'Period at 84% above target · flour credit agreed · chase emails faster',
      items: [
        {
          id: 'cheryl-e-w-1',
          headline: 'Period at 84% completeness — above target',
          detail:
            'Above the 82% you\'d normally want at this point. Chase emails + same-day posting accelerated the pace.',
        },
        {
          id: 'cheryl-e-w-2',
          headline: 'Flour supplier will credit the 12% variance on next delivery',
          detail:
            'Agreed via afternoon reply. Edify has logged the commitment against the open variance for auto-close on receipt.',
        },
        {
          id: 'cheryl-e-w-3',
          headline: 'Trend: suppliers responding faster to chase emails this month',
          detail:
            'Average response 6.2h this month vs 18.4h last. Worth noting — the chase loop is compounding trust, not just getting invoices in.',
        },
      ],
    },
  ],
};

// ── Role renderers ─────────────────────────────────────────────────────────────

function InsightFeed({ groups, role, phase }: { groups: InsightGroup[]; role: BriefingRole; phase: BriefingPhase }) {
  const [pinnedIds, setPinnedIds] = useState<Set<string>>(new Set());

  function togglePin(id: string) {
    setPinnedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  // Flatten pinned items, preserving the accent colour of their original category.
  const pinnedList: { item: InsightItem; accentColor: string }[] = [];
  for (const group of groups) {
    const cfg = CATEGORY[group.category];
    for (const item of group.items) {
      if (pinnedIds.has(item.id)) pinnedList.push({ item, accentColor: cfg.color });
    }
  }

  // Close-of-day reconciliation nudge: operators only (ed + gm), evening phase.
  const showCloseNudge = phase === 'evening' && (role === 'ed' || role === 'gm');
  // Note for Edify: operators only (ed + gm) across every phase. The
  // card was previously gated to the evening as "End-of-day sync", but
  // capturing things integrations can't see is a need that arrives any
  // time of day — the prompt/transcript/reply just reshape themselves
  // for the moment. The full running log lives at /notebook (Sidebar
  // → Performance → Notebook).
  const showNoteForEdify = role === 'ed' || role === 'gm';

  // Split out needs-call so it renders through FocusModeSequence;
  // remaining groups (handled, worth-knowing) keep the existing collapsed shell.
  const needsCallGroup = groups.find((g) => g.category === 'needs-call');
  const otherGroups = groups.filter((g) => g.category !== 'needs-call');

  return (
    <div style={{ padding: '2px 0 24px' }}>
      <HeroStrip role={role} phase={phase} />
      {showNoteForEdify && <NoteForEdify phase={phase} />}
      <PinnedSection items={pinnedList} pinnedIds={pinnedIds} onTogglePin={togglePin} />
      {showCloseNudge && <CloseReconciliationCard phase={phase} />}
      {needsCallGroup && (
        <FocusModeSequence
          items={needsCallGroup.items}
          pinnedIds={pinnedIds}
          onTogglePin={togglePin}
          hiddenIds={pinnedIds}
        />
      )}
      {otherGroups.map((group, i) => (
        <InsightGroup
          key={group.category}
          group={group}
          index={i + (pinnedList.length > 0 ? 1 : 0)}
          collapsible
          defaultCollapsed
          pinnedIds={pinnedIds}
          onTogglePin={togglePin}
          hiddenIds={pinnedIds}
        />
      ))}
    </div>
  );
}

// ── Playtomic (padel demo) ────────────────────────────────────────────────────
// Insights tailored to a multi-club padel chain that also runs on-site cafes.

const PLAYTOMIC_INSIGHTS: Record<BriefingPhase, InsightGroup[]> = {
  morning: [
    {
      category: 'needs-call',
      items: [
        {
          id: 'play-m-n-1',
          headline: 'Manchester occupancy fell 9 pts week-on-week — biggest drop in the chain',
          detail:
            'Drop concentrated in Tue, Wed, Thu evening slots. Forward 14d pipeline is tracking 22% under typical at this lead time. Edify has drafted an off-peak weeknight discount and a recall to the 312 Manchester lapsed players — needs your sign-off before it goes out.',
          actionLabel: 'Review campaign',
          actionSecondary: 'Hold for now',
        },
        {
          id: 'play-m-n-2',
          headline: 'Stockport coach Diego off sick today — 3 classes affected',
          detail:
            'Beginners 10am, Junior 4pm, Adult drill 6pm. 28 players impacted. Edify has Marco free for two of the three slots and a partner coach for the third. Approve the swap and Edify will message all 28 players with the new line-up.',
          actionLabel: 'Approve swaps',
          actionSecondary: 'Cancel and refund',
        },
        {
          id: 'play-m-n-3',
          headline: 'Cafe basket for the weekend needs your go-ahead — £1,860',
          detail:
            'Weekend forecast is sun + tournament at North Leeds, so Edify has bumped soft drinks +18% and pastries +12% across the 7 sites. Cut-off with the supplier is 11am.',
          actionLabel: 'Review and send',
          actionSecondary: 'Adjust quantities',
        },
      ],
    },
    {
      category: 'handled',
      summary: '54 court bookings auto-rebooked overnight · tournament fixture published · cafe restock confirmed',
      items: [
        {
          id: 'play-m-h-1',
          headline: '54 cancelled court slots auto-rebooked overnight from the waitlist',
          detail:
            '£1,212 of revenue saved versus letting them go empty. North Leeds and Alderley Park accounted for 42 of the 54. The full audit trail is in the bookings log if you want to spot-check.',
        },
        {
          id: 'play-m-h-2',
          headline: 'Saturday tournament fixture published to 1,420 members',
          detail:
            '32-team draw with court allocations across Manchester, Stockport and North Leeds. Confirmation rate already at 78%. Edify will send a chase to the unconfirmed 22% at 10am.',
        },
        {
          id: 'play-m-h-3',
          headline: 'iOS push to lapsed players sent — open rate 41% in the first hour',
          detail:
            '312 lapsed Manchester players targeted with a 2-for-1 weeknight slot. 27 already rebooked overnight. Edify will roll the same playbook to Lightwater on Friday if it converts.',
        },
      ],
    },
    {
      category: 'worth-knowing',
      summary: 'Forward pipeline · weather signal · retention split',
      items: [
        {
          id: 'play-m-w-1',
          headline: 'Forward 14d pipeline tracking 22% under typical at Manchester',
          detail:
            'Mostly Tue/Thu evenings. Same pattern as last quarter — that recovered after a £/hr cut. Edify has the pricing test ready if you want to run it again.',
        },
        {
          id: 'play-m-w-2',
          headline: 'Rain forecast Thu and Fri — chain bookings expected ~15% below baseline',
          detail:
            'Indoor courts at Stockport and Alderley Park usually pick up some of the spillover. Cafe spend on rainy days runs 8% higher per booking.',
        },
        {
          id: 'play-m-w-3',
          headline: 'Coached members retain 84% over 90 days · new players retain 38%',
          detail:
            'The single biggest retention lever in the chain is getting a new player into a coach-led class within 14 days. Manchester onboarding is currently at 11% — Stockport runs at 34%.',
        },
      ],
    },
  ],
  midday: [
    {
      category: 'needs-call',
      items: [
        {
          id: 'play-d-n-1',
          headline: 'Off-peak weeknight discount needs final approval before 2pm',
          detail:
            'Manchester Tue/Wed/Thu 5–7pm at £18/hr instead of £24/hr. Edify projects 38% additional fill, +£2,840 weekly net of the discount. Goes live at 6pm if approved.',
          actionLabel: 'Approve discount',
          actionSecondary: 'Skip this week',
        },
        {
          id: 'play-d-n-2',
          headline: 'North Leeds running 84% occupancy — price test ready',
          detail:
            'You are leaving money on the table. Edify proposes lifting peak £/hr from £31 to £34 (+10%) at North Leeds and watching for two weeks. Conservative model says +£1,210/week, no expected fill drop.',
          actionLabel: 'Run the test',
          actionSecondary: 'Hold',
        },
      ],
    },
    {
      category: 'handled',
      summary: 'Coach reassignments confirmed · welcome emails sent to 198 new members',
      items: [
        {
          id: 'play-d-h-1',
          headline: 'Coach swaps confirmed — all 28 affected Stockport players notified',
          detail:
            'Marco picked up the 4pm and 6pm sessions. Partner coach covering 10am. No refunds needed.',
        },
        {
          id: 'play-d-h-2',
          headline: 'Welcome sequence sent to this week\'s 198 new members',
          detail:
            'Includes a free coached class voucher to lift 90-day retention. Edify will track conversion vs the control cohort and report next Wednesday.',
        },
      ],
    },
    {
      category: 'worth-knowing',
      summary: 'Channel mix · corporate slots',
      items: [
        {
          id: 'play-d-w-1',
          headline: 'iOS app drives 58% of bookings, Android 22%, web 12%',
          detail:
            'Worth weighting your push and in-app placements accordingly. Manchester recall campaign was iOS-only and converted 41% — the Android version goes out tomorrow.',
        },
        {
          id: 'play-d-w-2',
          headline: 'Lunchtime corporate slots up 14% week-on-week',
          detail:
            '12–2pm midweek bookings from corporate accounts (3+ players, single payer) are running ahead of forecast. Stockport and Alderley Park leading. Worth adding a corporate landing page if it keeps growing.',
        },
      ],
    },
  ],
  afternoon: [
    {
      category: 'needs-call',
      items: [
        {
          id: 'play-a-n-1',
          headline: 'Saturday tournament dry-run at 5pm — Manchester ops sign-off',
          detail:
            'Court allocations, scoreboards and cafe staffing tested. Edify will compile the checklist into a single sign-off — usually takes 90 seconds.',
          actionLabel: 'Open checklist',
          actionSecondary: 'Defer 30 min',
        },
        {
          id: 'play-a-n-2',
          headline: 'Tomorrow\'s rain — pre-empt cancellations with proactive rebook?',
          detail:
            '78 outdoor-court bookings tomorrow at 6am–10am could be impacted. Edify can offer 1-tap rebook to Stockport / Alderley Park indoor courts at the same time. Saves an estimated £1,420.',
          actionLabel: 'Send rebook offer',
          actionSecondary: 'Wait and see',
        },
      ],
    },
    {
      category: 'handled',
      summary: 'Weekend roster +18% confirmed · cafe shipment landed at North Leeds',
      items: [
        {
          id: 'play-a-h-1',
          headline: 'Weekend roster lift +18% confirmed across all 7 sites',
          detail:
            'Sunday looks busy: tournament + sun + warm. Coaches and cafe staff confirmed for the lift. No further action needed.',
        },
        {
          id: 'play-a-h-2',
          headline: 'North Leeds cafe restock arrived — full match, signed off',
          detail:
            'All 32 lines matched. Soft drinks and pastries already on shelf for the Sunday rush.',
        },
      ],
    },
    {
      category: 'worth-knowing',
      summary: 'Pipeline · cross-site player movement',
      items: [
        {
          id: 'play-a-w-1',
          headline: 'Manchester forward pipeline still 22% under typical for next week',
          detail:
            'The off-peak discount lands tonight — Edify will measure the lift in the morning briefing. If it works, the same play rolls out to Lightwater.',
        },
        {
          id: 'play-a-w-2',
          headline: '9 of 312 lapsed Manchester players also play at Stockport (12 min away)',
          detail:
            'Cross-site retention is a strong signal. Edify can offer them a free guest pass at Manchester to pull them back — say the word and it goes out as a personalised email.',
        },
      ],
    },
  ],
  evening: [
    {
      category: 'needs-call',
      items: [
        {
          id: 'play-e-n-1',
          headline: 'Tomorrow\'s 7am opening — Manchester roof leak check',
          detail:
            'Maintenance flagged a slow leak above court 3 yesterday. Edify has booked the contractor for the 6:30am slot before opening. Confirm or reschedule.',
          actionLabel: 'Confirm visit',
          actionSecondary: 'Reschedule',
        },
      ],
    },
    {
      category: 'handled',
      summary: 'EOD revenue posted · staff ratings collected · close-checks logged',
      items: [
        {
          id: 'play-e-h-1',
          headline: 'EOD revenue posted · £18,420 court · £4,180 cafe',
          detail:
            'Court revenue +6% on yesterday, cafe -2% (rain affected the after-work crowd). All 7 sites closed cleanly. Tomorrow\'s opening checklists are pre-filled.',
        },
        {
          id: 'play-e-h-2',
          headline: 'Player ratings collected from today\'s 218 sessions',
          detail:
            'Average 4.7 / 5. Two flagged sessions (one at Manchester, one at Lightwater) — both about court lighting. Edify has logged a maintenance ticket.',
        },
      ],
    },
    {
      category: 'worth-knowing',
      summary: 'Tomorrow\'s pipeline · weather · top-spend players',
      items: [
        {
          id: 'play-e-w-1',
          headline: 'Tomorrow\'s pipeline: 84% booked across the chain',
          detail:
            'Strong day. Manchester at 71% (up from 54% today after the discount went live), North Leeds at 92%. Cafe attach should follow.',
        },
        {
          id: 'play-e-w-2',
          headline: '5 top-spend players visited today — one is at risk of lapsing',
          detail:
            'Sofia Almeida (£312, 14 bookings · 90d) hasn\'t booked in the last 12 days. Worth a personal note from a coach. Edify has drafted one if you want it.',
        },
      ],
    },
  ],
};

function BriefingContent({ role, phase }: { role: BriefingRole; phase: BriefingPhase }) {
  const byPhase =
    role === 'ed' ? ED_INSIGHTS :
    role === 'cheryl' ? CHERYL_INSIGHTS :
    role === 'gm' ? GM_INSIGHTS :
    role === 'playtomic' ? PLAYTOMIC_INSIGHTS :
    null;
  if (!byPhase) return null;
  return <InsightFeed key={`${role}-${phase}`} groups={byPhase[phase]} role={role} phase={phase} />;
}

export { BriefingContent };
