'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import type { BriefingRole } from '@/components/briefing';

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

type Category = 'act-today' | 'changed' | 'preempted';

interface InsightItem {
  headline: string;
  detail: string;
  actionLabel?: string;
  actionHref?: string;
  actionSecondary?: string;
}

interface InsightGroup {
  category: Category;
  items: InsightItem[];
}

// ── Category config ────────────────────────────────────────────────────────────

const CATEGORY = {
  'act-today': {
    label: 'Act today',
    color: '#B91C1C',
    bg: 'rgba(185,28,28,0.055)',
    borderColor: 'rgba(185,28,28,0.22)',
    dot: '#EF4444',
  },
  'changed': {
    label: 'Something changed',
    color: '#92400E',
    bg: 'rgba(146,64,14,0.055)',
    borderColor: 'rgba(146,64,14,0.22)',
    dot: '#F59E0B',
  },
  'preempted': {
    label: "Quinn's already on it",
    color: '#1a5c3a',
    bg: 'rgba(26,92,58,0.055)',
    borderColor: 'rgba(26,92,58,0.22)',
    dot: '#22C55E',
  },
} as const;

// ── Insight item ──────────────────────────────────────────────────────────────

function InsightCard({
  item,
  accentColor,
}: {
  item: InsightItem;
  accentColor: string;
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
        border: '1px solid var(--color-border-subtle)',
        boxShadow: '0 1px 4px rgba(58,48,40,0.06)',
      }}
    >
      <p
        style={{
          margin: '0 0 4px',
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
}: {
  group: InsightGroup;
  index: number;
}) {
  const cfg = CATEGORY[group.category];

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
      {/* Category label */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '7px',
          marginBottom: '10px',
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
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '7px' }}>
        {group.items.map((item, i) => (
          <InsightCard key={i} item={item} accentColor={cfg.color} />
        ))}
      </div>
    </motion.div>
  );
}

// ── Role content ──────────────────────────────────────────────────────────────

const RAVI_INSIGHTS: InsightGroup[] = [
  {
    category: 'act-today',
    items: [
      {
        headline: 'Bidvest delivery lands 11:10 — pre-check the GRN',
        detail:
          '14 lines, £412 on the drop. WTD spend on Bidvest already £10 over budget — scrutinise short-shipments before you sign so the overage doesn\'t grow.',
        actionLabel: 'Open GRN',
        actionSecondary: 'Log discrepancy',
      },
      {
        headline: '6 blueberry muffins rolled over from yesterday — at risk of waste today',
        detail:
          'Yesterday\'s bake-off left 6 on the shelf this morning. Shelf life ends today — if they don\'t sell by close, they bin. Typical rollover at this store is 2. Worth moving them front-of-counter or tagging for staff to upsell.',
        actionLabel: 'Got it',
      },
      {
        headline: 'Ham & cheese baguette prep running ahead of sales pace',
        detail:
          'Morning batch was 8; 5 sold, 3 still displayed. At this hour you\'d typically be down to 1 or 2 left. If the lunch pickup doesn\'t catch up by 11:30, chill the remainder to extend shelf into tomorrow.',
        actionLabel: 'Got it',
      },
    ],
  },
  {
    category: 'changed',
    items: [
      {
        headline: 'Sales +11% vs forecast at 11am — warm day pulling extra cover',
        detail:
          '£13,770 vs £12,390 forecast. Weather came in 6° warmer than predicted (21° vs 15°). Iced drinks and cold food likely to over-index — keep ice and cold-brew topped up.',
      },
      {
        headline: 'Expected EOD £20,250 vs £18,910 plan — consider holding the 3pm cut',
        detail:
          'Pace suggests you\'re £1.3k ahead at close. Afternoon roster already drops from 4 → 3 at 3pm; that cut may no longer be the right call if customer flow stays high.',
      },
      {
        headline: 'Bidvest WTD £1,210 of £1,200 — £10 over budget',
        detail:
          'Small now, but the 11:10 drop will add £412 on top. Worth a glance at what\'s in today\'s basket before you sign.',
      },
    ],
  },
  {
    category: 'preempted',
    items: [
      {
        headline: 'Cold-drink spec prepped for the afternoon push',
        detail:
          'Given the weather swing, Quinn has drafted a one-line board spec (iced latte + cold-brew citrus) and a 5-min brief for the barista. Approve to push to the floor.',
        actionLabel: 'Approve',
        actionSecondary: 'Edit first',
      },
      {
        headline: 'Tomorrow\'s Fresh Direct basket built — cut-off 2pm',
        detail:
          '£486 est., pastry quantities trimmed 10% to stop the muffin over-pull repeating. Approve as-is or adjust.',
        actionLabel: 'Review & approve',
        actionSecondary: 'Adjust basket',
      },
      {
        headline: 'Muffin batch size tuned down for tomorrow AM',
        detail:
          'Based on today\'s rollover pattern, Quinn has drafted a smaller AM batch (from 12 → 9). Approve to update the standing bake-off.',
        actionLabel: 'Approve',
        actionSecondary: 'Keep as-is',
      },
    ],
  },
];

const GM_INSIGHTS: InsightGroup[] = [
  {
    category: 'act-today',
    items: [
      {
        headline: 'Fresh Direct 11am — one milk case confirmed short before it arrives',
        detail:
          'Don\'t sign the GRN until you\'ve physically checked the drop. Quinn will auto-log the discrepancy so the credit workflow starts immediately.',
        actionLabel: 'Got it',
      },
      {
        headline: 'Matcha runs out Friday — Bidfood order needs your go-ahead today',
        detail:
          'Quinn has already added 1 extra case to the basket. Cut-off is 2pm — approve now and it\'s handled.',
        actionLabel: 'Approve order',
        actionHref: '/assisted-ordering',
        actionSecondary: 'Adjust quantity',
      },
    ],
  },
  {
    category: 'changed',
    items: [
      {
        headline: 'Pastry waste up 40% after 3pm — three days running',
        detail:
          'This isn\'t random. It maps to morning over-pull on the batch — you\'re making more than lunchtime sells. A quick word with the shift lead today could fix it before the weekend.',
      },
      {
        headline: 'Evening labour at 107% of plan — not just last night',
        detail:
          'Third time this week. If deliveries slip again today it\'ll compound. Worth flagging to whoever sets the evening roster.',
      },
    ],
  },
  {
    category: 'preempted',
    items: [
      {
        headline: 'Tomorrow\'s Bidfood basket ready — £1,240 est.',
        detail:
          'Extra matcha included. One screen to review, one tap to send before 2pm.',
        actionLabel: 'Review & send',
      },
      {
        headline: 'Compliance checks queued for today',
        detail:
          'AM temperature log, fire door check, and one outstanding head office policy acknowledgement from Tuesday. All three forms are ready — takes about 2 minutes.',
        actionLabel: 'Start checks',
      },
    ],
  },
];

const CHERYL_INSIGHTS: InsightGroup[] = [
  {
    category: 'act-today',
    items: [
      {
        headline: '3 PO mismatches ready to clear — Bidfood (2) and Metro (1)',
        detail:
          'Quinn has pre-filled queries and write-off tolerances for all three. Approve as-is or send the supplier queries — either way it\'s one pass, not three.',
        actionLabel: 'Approve or send queries',
        actionSecondary: 'Defer to tomorrow',
      },
      {
        headline: 'Metro credit £312 — 18 days open, 4 past SLA',
        detail:
          'It\'s sitting in the queue but it won\'t move without your workflow action. One click to open, one to close.',
        actionLabel: 'Open credit workflow',
      },
    ],
  },
  {
    category: 'changed',
    items: [
      {
        headline: 'Flour SKU came in +12% vs contract — no agreed price change on file',
        detail:
          'It\'s sitting unmatched so it can\'t hit recipe costs yet. But it won\'t wait — you need to accept the variance or raise a formal dispute before the invoice ages.',
      },
      {
        headline: 'Urban Fresh and Lacto invoices past their usual posting window',
        detail:
          'Both suppliers typically post within 3 days. If they batch at month end, it\'ll create a cost spike you\'ll have to explain in the period review. Better to chase now.',
      },
      {
        headline: 'Period cost completeness at 64% — below where it should be',
        detail:
          'Dry goods are the main gap. At this point in the period you\'d normally expect to be at 75%+. The late invoices are the reason.',
      },
    ],
  },
  {
    category: 'preempted',
    items: [
      {
        headline: 'Chase emails drafted for Urban Fresh and Lacto',
        detail:
          'Addressed to the right contacts, referencing the correct PO numbers. One tap sends both — or open to adjust before sending.',
        actionLabel: 'Send both',
        actionSecondary: 'Review first',
      },
      {
        headline: 'Flour variance linked to contract file and ready for dispute',
        detail:
          'Quinn has matched the invoice to the contract and flagged the 12% gap. Your call: accept for this delivery or raise it formally.',
        actionLabel: 'Raise dispute',
        actionSecondary: 'Accept variance',
      },
    ],
  },
];

// ── Role renderers ─────────────────────────────────────────────────────────────

function InsightFeed({ groups, role }: { groups: InsightGroup[]; role: BriefingRole }) {
  return (
    <div style={{ padding: '2px 0 24px' }}>
      <LiveSnapshot role={role} />
      {groups.map((group, i) => (
        <InsightGroup key={group.category} group={group} index={i} />
      ))}
    </div>
  );
}

function BriefingContent({ role }: { role: BriefingRole }) {
  if (role === 'ravi') return <InsightFeed groups={RAVI_INSIGHTS} role={role} />;
  if (role === 'cheryl') return <InsightFeed groups={CHERYL_INSIGHTS} role={role} />;
  if (role === 'gm') return <InsightFeed groups={GM_INSIGHTS} role={role} />;
  return null;
}

export { BriefingContent };
