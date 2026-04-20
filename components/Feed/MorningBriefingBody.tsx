'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { Pin, ChevronDown, ShieldCheck, ChevronRight, AlertCircle } from 'lucide-react';
import type { BriefingRole, BriefingPhase } from '@/components/briefing';
import CloseReconciliationCard from '@/components/Waste/CloseReconciliationCard';
import { useApprovals, getUser, RULE_LABELS } from '@/components/Approvals/approvalsStore';
import { useActingUser } from '@/components/DemoControls/demoStore';

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
        background: 'rgba(58,48,40,0.08)',
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
        background: 'rgba(58,48,40,0.08)',
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

function LiveSnapshot({ role }: { role: BriefingRole }) {
  if (role === 'ravi') return null;

  const pnlPct = role === 'cheryl' ? 72 : 78;
  const pnlLabel = role === 'cheryl' ? 'Gross margin confidence' : 'Live P&L confidence';
  const pnlCaption = role === 'cheryl'
    ? 'How complete your cost inputs are for the current period.'
    : 'Based on matched sales, clocked labour, and invoices posted so far today.';
  const labourSubtitle = role === 'gm' ? 'Fitzroy Espresso · yesterday' : 'Chain roll-up · yesterday';

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
        boxShadow: '0 1px 4px rgba(58,48,40,0.06)',
        marginBottom: '12px',
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
      }}
    >
      <ConfidenceMeterBar label={pnlLabel} valuePct={pnlPct} caption={pnlCaption} />
      {role === 'cheryl' && (
        <>
          <div style={{ borderTop: '1px solid var(--color-border-subtle)' }} />
          <ConfidenceMeterBar
            label="Period cost completeness"
            valuePct={64}
            caption="Of this period's costs confirmed vs still pending accrual or invoice."
          />
          <div style={{ borderTop: '1px solid var(--color-border-subtle)' }} />
          <InvoiceMatchBar />
        </>
      )}
      {role === 'gm' && (
        <>
          <div style={{ borderTop: '1px solid var(--color-border-subtle)' }} />
          <LabourMiniCurve subtitle={labourSubtitle} />
        </>
      )}
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
    color: '#B91C1C',
    bg: 'rgba(185,28,28,0.055)',
    borderColor: 'rgba(185,28,28,0.22)',
    dot: '#EF4444',
  },
  'handled': {
    label: "Quinn's handled this",
    color: '#1a5c3a',
    bg: 'rgba(26,92,58,0.055)',
    borderColor: 'rgba(26,92,58,0.22)',
    dot: '#22C55E',
  },
  'worth-knowing': {
    label: 'Worth knowing',
    color: '#92400E',
    bg: 'rgba(146,64,14,0.055)',
    borderColor: 'rgba(146,64,14,0.22)',
    dot: '#F59E0B',
  },
} as const;

// ── Insight item ──────────────────────────────────────────────────────────────

function InsightCard({
  item,
  accentColor,
  isPinned,
  onTogglePin,
}: {
  item: InsightItem;
  accentColor: string;
  isPinned: boolean;
  onTogglePin: (id: string) => void;
}) {
  const [done, setDone] = useState(false);
  const router = useRouter();
  if (done) return null;

  return (
    <div
      style={{
        padding: '10px 12px',
        borderRadius: '8px',
        background: '#fff',
        border: isPinned ? `1px solid ${accentColor}` : '1px solid var(--color-border-subtle)',
        boxShadow: isPinned
          ? `0 1px 4px rgba(58,48,40,0.06), 0 0 0 1px ${accentColor}22`
          : '0 1px 4px rgba(58,48,40,0.06)',
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
          margin: '0 28px 4px 0',
          fontSize: '13px',
          fontWeight: 700,
          color: 'var(--color-text-primary)',
          lineHeight: 1.4,
        }}
      >
        {item.headline}
      </p>
      <ul
        style={{
          margin: item.actionLabel ? '0 0 10px' : 0,
          padding: '0 0 0 16px',
          listStyleType: 'disc',
        }}
      >
        {item.detail.split('. ').map((sentence, i, arr) => (
          <li
            key={i}
            style={{
              fontSize: '13px',
              fontWeight: 400,
              color: 'var(--color-text-secondary)',
              lineHeight: 1.55,
              marginBottom: i < arr.length - 1 ? '3px' : 0,
            }}
          >
            {sentence.endsWith('.') ? sentence : sentence + (i < arr.length - 1 ? '.' : '')}
          </li>
        ))}
      </ul>
      {item.actionLabel && (
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={() => {
              if (item.actionHref) {
                router.push(item.actionHref);
              } else {
                setDone(true);
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
              onClick={() => setDone(true)}
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

const RAVI_INSIGHTS: Record<BriefingPhase, InsightGroup[]> = {
  morning: [
    {
      category: 'needs-call',
      items: [
        {
          id: 'ravi-m-n-1',
          headline: 'Bidvest delivery lands 11:10 — pre-check the GRN',
          detail:
            '14 lines, £412 on the drop. WTD spend on Bidvest already £10 over budget — scrutinise short-shipments before you sign so the overage doesn\'t grow.',
          actionLabel: 'Open GRN',
          actionSecondary: 'Log discrepancy',
        },
        {
          id: 'ravi-m-n-2',
          headline: 'Metro credit £312 — past finance threshold',
          detail:
            'Approve the write-off path or escalate. It can\'t sit in the queue — period margin locks later today.',
          actionLabel: 'Approve write-off',
          actionSecondary: 'Escalate',
        },
        {
          id: 'ravi-m-n-3',
          headline: 'Matcha estate order — two sites will stock out before Friday',
          detail:
            'Authorise the top-up or the Friday stock-out is locked in. Quinn has the basket ready to send.',
          actionLabel: 'Authorise top-up',
          actionSecondary: 'Adjust basket',
        },
        {
          id: 'ravi-m-n-4',
          headline: 'Morning bake adjusted +3 muffins — approve for today',
          detail:
            'Forecast pulled 11% higher than yesterday. Quinn has drafted the revised batch sheet for the AM team — approve before 7am or it locks to the standing plan.',
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
          id: 'ravi-m-h-1',
          headline: 'Overnight invoice match · £1,840 posted, 2 held for variance',
          detail:
            '11 of 13 invoices auto-matched to POs and posted to the ledger. The two exceptions are queued for Cheryl — you don\'t need to touch them.',
        },
        {
          id: 'ravi-m-h-2',
          headline: 'Yesterday\'s Bidfood basket cleared at 2pm · £1,180 confirmed',
          detail:
            'Sent to supplier, confirmation received, Thursday delivery slot held. Full audit trail in the order log if you want to check.',
        },
        {
          id: 'ravi-m-h-3',
          headline: 'Urban Fresh GRN matched overnight — 3 lines auto-signed',
          detail:
            'All within tolerance, no discrepancies. Posted to period margin so the numbers you see above are current.',
        },
        {
          id: 'ravi-m-h-4',
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
          id: 'ravi-m-w-1',
          headline: 'Yesterday\'s warm spell pulled iced-drink cover down 3 days — Bidfood basket already bumped +1 case',
          detail:
            'This is what the sales → stock → orders loop looks like when it runs itself. No action needed — just so you can see the join-up working.',
        },
        {
          id: 'ravi-m-w-2',
          headline: '6 blueberry muffins rolled over from yesterday — at risk of waste today',
          detail:
            'Yesterday\'s bake-off left 6 on the shelf this morning. Shelf life ends today — if they don\'t sell by close, they bin. Typical rollover at this store is 2. Worth moving them front-of-counter or tagging for staff to upsell.',
          actionLabel: 'Got it',
        },
        {
          id: 'ravi-m-w-3',
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
          id: 'ravi-d-n-1',
          headline: 'Bidvest just landed — GRN ready to scan before signing',
          detail:
            '14 lines on the dock. Two short-shipment flags already raised by Quinn. Your sign-off locks period margin — worth the 2-minute walk-through.',
          actionLabel: 'Open GRN',
          actionSecondary: 'Log discrepancy',
        },
        {
          id: 'ravi-d-n-2',
          headline: 'Lunch pace running hot — hold or cut the 3pm shift?',
          detail:
            'Covers 18% above forecast through 11:30. If flow stays, the planned 4 → 3 cut at 3pm will leave the floor short. Quinn can hold it — one tap.',
          actionLabel: 'Hold the cut',
          actionSecondary: 'Keep as planned',
        },
        {
          id: 'ravi-d-n-3',
          headline: 'Matcha top-up cut-off in 90 min — send the basket?',
          detail:
            'Last call before Bidfood closes at 2pm. Without it, two sites stock out by Friday. Basket as drafted is £280.',
          actionLabel: 'Send basket',
          actionSecondary: 'Adjust first',
        },
        {
          id: 'ravi-d-n-4',
          headline: 'Tomorrow\'s muffin batch — 9 or back to 12?',
          detail:
            'Today\'s rollover count is 0 so far. If it stays that way you may want to go back to 12 to catch the warm-weather rush tomorrow.',
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
          id: 'ravi-d-h-1',
          headline: 'Bidvest GRN: 11 of 14 lines matched · £381 posted · 3 flagged',
          detail:
            'Auto-match hit the tolerances on 11 lines. Three are open: 2 short-shipments and 1 price variance — all queued for Cheryl.',
        },
        {
          id: 'ravi-d-h-2',
          headline: 'Reorder point triggered on tomatoes · Bidfood basket updated +2 trays',
          detail:
            'Morning sales pulled tomato cover below the safety threshold. Quinn added 2 trays to tomorrow\'s Bidfood basket. No decision needed.',
        },
        {
          id: 'ravi-d-h-3',
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
          id: 'ravi-d-w-1',
          headline: 'Sales +11% vs forecast at 11am — warm day pulling extra cover',
          detail:
            '£13,770 vs £12,390 forecast. Iced drinks and cold food over-indexing as expected — keep ice and cold-brew topped up.',
        },
        {
          id: 'ravi-d-w-2',
          headline: 'Ham & cheese baguette prep running ahead of sales pace',
          detail:
            'Morning batch was 8; 5 sold, 3 still displayed. If the lunch pickup doesn\'t catch up by 11:30, chill the remainder to extend shelf.',
          actionLabel: 'Got it',
        },
        {
          id: 'ravi-d-w-3',
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
          id: 'ravi-a-n-1',
          headline: 'Bidfood basket cut-off in 30 min — approve tomorrow\'s order',
          detail:
            '£1,240 est., matcha +1 case included. One screen to review, one tap to send before 2pm.',
          actionLabel: 'Review & send',
          actionSecondary: 'Adjust',
        },
        {
          id: 'ravi-a-n-2',
          headline: 'Cold-drink push — send to the floor for the 3pm peak?',
          detail:
            'Quinn\'s board spec (iced latte + cold-brew citrus) and a 5-min barista brief are ready. Approve to push now or hold.',
          actionLabel: 'Push to floor',
          actionSecondary: 'Hold',
        },
        {
          id: 'ravi-a-n-3',
          headline: 'Muffin batch size for tomorrow AM — 12 or 9?',
          detail:
            'Today\'s rollover count held at 0. Forecast warmer again tomorrow. Quinn recommends going back to 12.',
          actionLabel: 'Confirm 12',
          actionSecondary: 'Keep at 9',
        },
        {
          id: 'ravi-a-n-4',
          headline: 'Evening roster: Tom to cover the no-show?',
          detail:
            'One evening slot just opened. Tom is on-site already and willing. Confirm and Quinn will update the roster + send the text.',
          actionLabel: 'Confirm Tom',
          actionSecondary: 'Find someone else',
        },
      ],
    },
    {
      category: 'handled',
      summary: 'Lunch £8,240 · shift change done · GRN reconciled · drink spec pushed',
      items: [
        {
          id: 'ravi-a-h-1',
          headline: 'Lunch service wrapped · £8,240 taken · 12% above yesterday',
          detail:
            'Strongest lunch of the week so far. Ham & cheese sold out by 13:45, coffee volumes flat, iced drinks up 30%.',
        },
        {
          id: 'ravi-a-h-2',
          headline: '3pm shift change confirmed · 4 → 3 as planned',
          detail:
            'Priya off, Tom on for the afternoon. Flow is settling so the cut holds — check back if covers spike.',
        },
        {
          id: 'ravi-a-h-3',
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
          id: 'ravi-a-w-1',
          headline: 'Expected EOD £20,250 vs £18,910 plan — holding the pace',
          detail:
            'Pace suggests +£1.3k at close. That\'ll post through to period margin overnight — no action needed, just for your number.',
        },
        {
          id: 'ravi-a-w-2',
          headline: 'Warm-day loop closed: sales +11% → stock −3 days → Bidfood +1 case',
          detail:
            'Full loop ran without a touch. Worth noting for the conversation with head office — this is the kind of automation payoff we\'ve been pitching.',
        },
        {
          id: 'ravi-a-w-3',
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
          id: 'ravi-e-n-1',
          headline: 'End-of-day cash-up — any waste or markdowns to log?',
          detail:
            'Close workflow ready. Quinn pre-filled waste (6 muffins, 2 baguettes) — review and submit, or adjust if anything\'s off.',
          actionLabel: 'Open close pack',
          actionSecondary: 'Review waste',
        },
        {
          id: 'ravi-e-n-2',
          headline: 'Tomorrow\'s Fresh Direct basket sent 2pm — confirm when it lands',
          detail:
            'Basket is locked and delivery is booked for 11am tomorrow. Quinn will auto-log the GRN — you only need to sign.',
          actionLabel: 'Mark ready',
        },
        {
          id: 'ravi-e-n-3',
          headline: 'Weekend roster gaps — 2 slots still open',
          detail:
            'Saturday 10–14 and Sunday 14–18 unfilled. Quinn has a shortlist of who\'s said yes before — one tap to send the asks.',
          actionLabel: 'Send asks',
          actionSecondary: 'Escalate to HO',
        },
        {
          id: 'ravi-e-n-4',
          headline: 'Tonight\'s compliance sign-off — temperature log + fire door',
          detail:
            'PM temperature log was auto-filled from sensor data. Fire door check took 30 seconds to pre-fill. Both need your signature before you leave.',
          actionLabel: 'Sign both',
        },
      ],
    },
    {
      category: 'handled',
      summary: 'Today closed £20,180 · Bidfood sent · recipes recosted · PM temps logged',
      items: [
        {
          id: 'ravi-e-h-1',
          headline: 'Today\'s close wrapped · EOD £20,180 vs £18,910 plan (+£1,270)',
          detail:
            'Final numbers in. Best Thursday this quarter. Period margin delta posting overnight.',
        },
        {
          id: 'ravi-e-h-2',
          headline: 'Tomorrow\'s Bidfood basket sent at 2pm · £1,240 confirmed',
          detail:
            'Supplier confirmation received, delivery slot held. You\'ll see the basket again tomorrow morning as the GRN pre-check.',
        },
        {
          id: 'ravi-e-h-3',
          headline: 'Tomorrow\'s recipes recosted after flour variance · margins refreshed',
          detail:
            '12 recipes using the affected flour SKU pushed through overnight. Cost pack updated with the new margins — ready for Cheryl.',
        },
        {
          id: 'ravi-e-h-4',
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
          id: 'ravi-e-w-1',
          headline: 'Muffin rollover didn\'t happen today — first time this week',
          detail:
            'The 12 → 9 batch tune-down worked. Worth holding for one more day to confirm the pattern, then it becomes the standing plan.',
        },
        {
          id: 'ravi-e-w-2',
          headline: 'Weekend weather: warm Saturday (22°), cooler Sunday (16°)',
          detail:
            'Quinn has already adjusted Saturday\'s prep forecast up 8%, Sunday down 4%. Basket for Saturday will reflect the lift tomorrow.',
        },
        {
          id: 'ravi-e-w-3',
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
          headline: 'Fresh Direct 11am — confirm short before you sign the docket',
          detail:
            'One milk case flagged short before arrival. Don\'t sign the GRN until you\'ve physically checked the drop — Quinn will auto-log the discrepancy and open the credit.',
          actionLabel: 'Approve sign-off flow',
          actionSecondary: 'Got it',
        },
        {
          id: 'gm-m-n-2',
          headline: 'Matcha runs out Friday — Bidfood order needs your go-ahead today',
          detail:
            'Quinn has already added 1 extra case to the basket. Cut-off is 2pm — approve now and it\'s handled.',
          actionLabel: 'Approve order',
          actionHref: '/assisted-ordering',
          actionSecondary: 'Adjust quantity',
        },
        {
          id: 'gm-m-n-3',
          headline: 'Tomorrow\'s Bidfood basket ready — £1,240 est.',
          detail:
            'Extra matcha included. One screen to review, one tap to send before 2pm.',
          actionLabel: 'Review & send',
        },
        {
          id: 'gm-m-n-4',
          headline: 'Compliance checks queued for today',
          detail:
            'AM temperature log, fire door check, and one outstanding head office policy acknowledgement from Tuesday. All three forms are ready — takes about 2 minutes.',
          actionLabel: 'Start checks',
        },
      ],
    },
    {
      category: 'handled',
      summary: 'Temperatures logged · opening + mid shifts confirmed',
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
            'Priya (opening) and Tom (mid) both confirmed. Evening cover still open — Quinn will nudge at 10am if no one\'s picked up.',
        },
      ],
    },
    {
      category: 'worth-knowing',
      summary: 'Baguette retention · pastry waste trend · evening labour drift',
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
          headline: 'Fresh Direct landed — milk case confirmed short',
          detail:
            'Physical check matches the pre-flag. Sign the GRN with the discrepancy attached and the credit workflow starts automatically.',
          actionLabel: 'Sign with credit',
          actionSecondary: 'Dispute instead',
        },
        {
          id: 'gm-d-n-2',
          headline: 'Table 4 missing order — comp how?',
          detail:
            'Been waiting 14 min. Server flagged it at POS. Quinn suggests a free coffee + priority re-fire — one tap sends to kitchen and comps the bill.',
          actionLabel: 'Apply recovery',
          actionSecondary: 'Handle manually',
        },
        {
          id: 'gm-d-n-3',
          headline: 'Stock check by 1pm for tomorrow\'s basket',
          detail:
            'Quick 10-item floor scan — Quinn has the list pre-filled from overnight counts. Confirm or flag anomalies so the basket reflects reality.',
          actionLabel: 'Start check',
        },
      ],
    },
    {
      category: 'handled',
      summary: 'GRN signed with credit · AM compliance green · evening shift covered',
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
      summary: 'Sales +11% at 11am · ham & cheese low · warm through 3pm',
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
          headline: '3pm shift change: confirm drop from 4 to 3',
          detail:
            'Priya off at 3, Tom in for the afternoon. Flow is settling so the planned cut looks right — confirm to lock it.',
          actionLabel: 'Confirm cut',
          actionSecondary: 'Hold the 4',
        },
        {
          id: 'gm-a-n-2',
          headline: 'Tomorrow\'s Bidfood basket — approve before 2pm cut-off',
          detail:
            'Matcha +1 case, tomatoes +2 trays. 20 min to go. One tap to send or open to adjust.',
          actionLabel: 'Send basket',
          actionSecondary: 'Review first',
        },
        {
          id: 'gm-a-n-3',
          headline: 'Close-time prep list ready',
          detail:
            'Drinks fridge top-up, counter reset, cash prep. 8 items, Quinn has the checklist pre-opened on the floor tablet.',
          actionLabel: 'Open checklist',
        },
        {
          id: 'gm-a-n-4',
          headline: 'Weekend roster — one Saturday slot open',
          detail:
            'Saturday 10–14 unfilled. Quinn has a shortlist: Priya, Jake, Daisy. Send ask or escalate to head office if nobody picks up by 6pm.',
          actionLabel: 'Send ask',
          actionSecondary: 'Escalate',
        },
      ],
    },
    {
      category: 'handled',
      summary: 'Lunch £8,240 · handover done · cold drinks to front',
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
          headline: 'Cold drinks pushed to the front counter as Quinn suggested',
          detail:
            'Board spec is up, barista brief done. Track the 3–4pm uplift on the afternoon dashboard if you want to see the effect.',
        },
      ],
    },
    {
      category: 'worth-knowing',
      summary: 'Pastry check at 4pm · 12 hours of labour budget · ham & cheese sold out',
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
          headline: 'Close cash-up — any waste or markdowns to log?',
          detail:
            'Quinn has pre-filled 2 muffins waste, £0 markdowns. Review and submit the close pack, or adjust if anything\'s off.',
          actionLabel: 'Submit close',
          actionSecondary: 'Adjust first',
        },
        {
          id: 'gm-e-n-2',
          headline: 'Tomorrow\'s opening team — confirm Priya',
          detail:
            'Priya\'s down for 6am open. Quinn already sent the reminder; just confirm she\'s your point of contact in the morning.',
          actionLabel: 'Confirm',
        },
        {
          id: 'gm-e-n-3',
          headline: 'Fire door log sign-off before you leave',
          detail:
            'Pre-filled from the evening walk. 30 seconds to review and sign.',
          actionLabel: 'Sign',
        },
      ],
    },
    {
      category: 'handled',
      summary: 'PM temps logged · EOD £20,180 · basket sent · brief email out',
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
            'Weekend cover notes + cold-drinks push instructions. Quinn will nudge the three pending at 8am tomorrow.',
        },
      ],
    },
    {
      category: 'worth-knowing',
      summary: 'Muffin fix held · weekend weather · close 5 min faster',
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
            'Quinn has pre-filled queries and write-off tolerances for all three. Approve as-is or send the supplier queries — either way it\'s one pass, not three.',
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
            'Quinn has matched the invoice to the contract and flagged the 12% gap. Your call: accept for this delivery or raise it formally before the invoice ages.',
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
            'Driven mostly by the flour variance. Options: absorb within contingency, flag to ops, or prep a re-forecast. Quinn has drafts for each.',
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
            'Quinn has drafted accruals for Urban Fresh, Lacto, and the Metro credit. Scan and approve, or adjust individual lines.',
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
            'Quinn\'s forecast looks clean for Saturday, slightly under-indexed for Sunday (cooler). Worth a 30-second scan before ops teams cut next week\'s plan.',
          actionLabel: 'Scan & approve',
        },
        {
          id: 'cheryl-a-n-4',
          headline: 'Tomorrow\'s cost pack distribution list — confirm',
          detail:
            '7 recipients as standard + 2 new (ops leads). Quinn has the draft ready to send at 7am.',
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
            'Both are small (£42 + £18). Quinn can auto-write-off if you authorise, or escalate to the supplier for one more pass.',
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
            'The three holdouts are low-priority variance checks. Quinn has them queued as your first task tomorrow.',
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
            'Agreed via afternoon reply. Quinn has logged the commitment against the open variance for auto-close on receipt.',
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
  const approvals = useApprovals();
  const actingUserId = useActingUser();
  const actingUser = getUser(actingUserId);
  const isManager = actingUser?.role === 'manager';
  const pendingApprovals = isManager ? approvals.filter(a => a.status === 'pending') : [];

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

  // Close-of-day reconciliation nudge: operators only (ravi + gm), evening phase.
  const showCloseNudge = phase === 'evening' && (role === 'ravi' || role === 'gm');

  const approvalsPreamble = pendingApprovals.length > 0
    ? <ApprovalsSubcard pending={pendingApprovals} />
    : undefined;

  return (
    <div style={{ padding: '2px 0 24px' }}>
      <LiveSnapshot role={role} />
      <PinnedSection items={pinnedList} pinnedIds={pinnedIds} onTogglePin={togglePin} />
      {showCloseNudge && <CloseReconciliationCard phase={phase} />}
      {groups.map((group, i) => (
        <InsightGroup
          key={group.category}
          group={group}
          index={i + (pinnedList.length > 0 ? 1 : 0)}
          collapsible={group.category !== 'needs-call'}
          defaultCollapsed={group.category !== 'needs-call'}
          pinnedIds={pinnedIds}
          onTogglePin={togglePin}
          hiddenIds={pinnedIds}
          preamble={group.category === 'needs-call' ? approvalsPreamble : undefined}
          extraCount={group.category === 'needs-call' ? pendingApprovals.length : 0}
        />
      ))}
    </div>
  );
}

function ApprovalsSubcard({ pending }: { pending: ReturnType<typeof useApprovals> }) {
  const router = useRouter();
  return (
    <div style={{
      padding: '10px 12px',
      borderRadius: '8px',
      background: '#fff',
      border: '1px solid var(--color-border-subtle)',
      boxShadow: '0 1px 4px rgba(58,48,40,0.06)',
    }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        marginBottom: '8px',
      }}>
        <ShieldCheck size={12} color="var(--color-accent-active)" strokeWidth={2.2} />
        <span style={{
          flex: 1,
          fontSize: '11px',
          fontWeight: 700,
          letterSpacing: '0.04em',
          textTransform: 'uppercase',
          color: 'var(--color-text-secondary)',
        }}>
          Orders awaiting approval
        </span>
        <span style={{
          fontSize: '10px',
          fontWeight: 700,
          padding: '2px 7px',
          borderRadius: '100px',
          background: 'var(--color-warning-light)',
          color: 'var(--color-warning)',
        }}>
          {pending.length}
        </span>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
        {pending.map(a => {
          const submitter = getUser(a.submittedById);
          const topRule = a.triggeredRules[0];
          return (
            <button
              key={a.id}
              onClick={() => router.push('/approvals')}
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '3px',
                padding: '8px 10px',
                borderRadius: '6px',
                border: '1px solid var(--color-border-subtle)',
                background: 'var(--color-bg-surface)',
                cursor: 'pointer',
                textAlign: 'left',
                fontFamily: 'var(--font-primary)',
                transition: 'border-color 0.12s',
              }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--color-accent-active)'; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--color-border-subtle)'; }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--color-text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {a.supplier}
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--color-text-muted)', marginTop: '1px' }}>
                    {submitter?.name ?? '—'} · ${a.total.toFixed(0)}
                  </div>
                </div>
                <ChevronRight size={12} color="var(--color-text-muted)" strokeWidth={2.2} />
              </div>
              {topRule && (
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '5px',
                  fontSize: '10px',
                  color: 'var(--color-warning)',
                  fontWeight: 600,
                }}>
                  <AlertCircle size={10} strokeWidth={2.2} />
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {RULE_LABELS[topRule.rule]}
                  </span>
                </div>
              )}
            </button>
          );
        })}
      </div>

      <button
        onClick={() => router.push('/approvals')}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '4px',
          width: '100%',
          marginTop: '8px',
          padding: '6px 10px',
          borderRadius: '6px',
          background: 'none',
          border: 'none',
          fontSize: '11px',
          fontWeight: 700,
          fontFamily: 'var(--font-primary)',
          color: 'var(--color-accent-active)',
          cursor: 'pointer',
        }}
      >
        Review all
        <ChevronRight size={12} strokeWidth={2.4} />
      </button>
    </div>
  );
}

function BriefingContent({ role, phase }: { role: BriefingRole; phase: BriefingPhase }) {
  const byPhase =
    role === 'ravi' ? RAVI_INSIGHTS :
    role === 'cheryl' ? CHERYL_INSIGHTS :
    role === 'gm' ? GM_INSIGHTS :
    null;
  if (!byPhase) return null;
  return <InsightFeed key={`${role}-${phase}`} groups={byPhase[phase]} role={role} phase={phase} />;
}

export { BriefingContent };
