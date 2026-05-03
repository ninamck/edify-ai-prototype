'use client';

import { useMemo } from 'react';
import { Truck, CheckCircle2, Clock, PackageCheck, Calendar } from 'lucide-react';
import {
  DEMO_TODAY,
  PRET_DISPATCH_TRANSFER_SEEDS,
  PRET_SPOKE_SUBMISSIONS,
  dayOfWeek,
  dayOffset,
  getRecipe,
  getSite,
  type DispatchTransfer,
  type SiteId,
  type SpokeSubmission,
} from './fixtures';
import { useDispatchTransfers, formatSentClock } from './dispatchStore';

/**
 * SpokeTodayPanel — read-only "what's coming today" view for a spoke
 * manager. Lives on /production/amounts when the active persona is a
 * spoke. Designed to be lighter than the hub's editor: spokes don't
 * bake, so there's no quantity stepper, no benches, no carry-over —
 * just three short sections so the manager can answer:
 *
 *   1. What's already arrived today? (yesterday's drop)
 *   2. What's on the way / pending today? (today's drop)
 *   3. What did we just send the hub for tomorrow?
 *
 * No edit affordances. The "Hub Order" tab is where the spoke goes to
 * actually change tomorrow's submission.
 */

type Props = {
  /** PRET_SITES id of the spoke (e.g. 'site-spoke-south'). */
  spokeId: SiteId;
  /** PRET_SITES id of the hub feeding the spoke (e.g. 'hub-central'). */
  hubId: SiteId;
};

type ShipmentStatus = 'delivered' | 'on-the-way' | 'pending' | 'draft';

const STATUS_STYLE: Record<ShipmentStatus, { bg: string; color: string; border: string; label: string; icon: React.ReactNode }> = {
  delivered: {
    bg: 'var(--color-success-light)',
    color: 'var(--color-success)',
    border: 'var(--color-success-border)',
    label: 'Delivered',
    icon: <CheckCircle2 size={11} />,
  },
  'on-the-way': {
    bg: 'var(--color-info-light)',
    color: 'var(--color-info)',
    border: 'var(--color-info-light)',
    label: 'On the way',
    icon: <Truck size={11} />,
  },
  pending: {
    bg: 'var(--color-warning-light)',
    color: 'var(--color-warning)',
    border: 'var(--color-warning-border)',
    label: 'Pending hub',
    icon: <Clock size={11} />,
  },
  draft: {
    bg: 'var(--color-bg-surface)',
    color: 'var(--color-text-muted)',
    border: 'var(--color-border)',
    label: 'Draft',
    icon: <Clock size={11} />,
  },
};

function transferStatus(t: DispatchTransfer, forDate: string): ShipmentStatus {
  if (forDate < DEMO_TODAY) return 'delivered';
  // For today's drop, treat anything sent more than 60 min ago as
  // delivered (the demo's spokes are commuter-distance from the hub).
  const sentMs = new Date(t.sentAtISO).getTime();
  const now = Date.now();
  if (Number.isFinite(sentMs) && now - sentMs > 60 * 60 * 1000) return 'delivered';
  return 'on-the-way';
}

function submissionStatus(s: SpokeSubmission): ShipmentStatus {
  if (s.status === 'acknowledged') return 'pending';
  if (s.status === 'submitted') return 'pending';
  return 'draft';
}

export default function SpokeTodayPanel({ spokeId, hubId }: Props) {
  const { transfers } = useDispatchTransfers();

  const spoke = getSite(spokeId);
  const hub = getSite(hubId);

  // Combine seeded + runtime transfers and scope to (hub → spoke).
  const allTransfers = useMemo(() => {
    const seeded = PRET_DISPATCH_TRANSFER_SEEDS;
    const runtime = Object.values(transfers);
    // Runtime transfers win when the same key exists.
    const byKey = new Map<string, DispatchTransfer>();
    for (const t of seeded) byKey.set(`${t.hubId}|${t.spokeId}|${t.forDate}`, t);
    for (const t of runtime) byKey.set(`${t.hubId}|${t.spokeId}|${t.forDate}`, t);
    return Array.from(byKey.values()).filter(t => t.hubId === hubId && t.spokeId === spokeId);
  }, [transfers, hubId, spokeId]);

  const arrivedYesterday = useMemo(
    () => allTransfers.filter(t => t.forDate === dayOffset(-1)),
    [allTransfers],
  );
  const arrivingToday = useMemo(
    () => allTransfers.filter(t => t.forDate === DEMO_TODAY),
    [allTransfers],
  );

  // Today's submission (the order the spoke placed yesterday for today)
  // — used as the "expected from hub today" placeholder when no transfer
  // has been recorded yet.
  const todaySubmission = useMemo(
    () =>
      PRET_SPOKE_SUBMISSIONS.find(
        s => s.fromSiteId === spokeId && s.toHubId === hubId && s.forDate === DEMO_TODAY,
      ),
    [spokeId, hubId],
  );

  // Tomorrow's submission (the order the spoke is currently working on).
  const tomorrowSubmission = useMemo(
    () =>
      PRET_SPOKE_SUBMISSIONS.find(
        s => s.fromSiteId === spokeId && s.toHubId === hubId && s.forDate === dayOffset(1),
      ),
    [spokeId, hubId],
  );

  const todayLines: Array<{ recipeId: string; units: number }> = useMemo(() => {
    // Prefer the actual transfer if it exists; otherwise the
    // confirmed/proposed submission.
    if (arrivingToday.length > 0) {
      return arrivingToday.flatMap(t =>
        t.lines.map(l => ({ recipeId: l.recipeId, units: l.units })),
      );
    }
    if (todaySubmission) {
      return todaySubmission.lines.map(l => ({
        recipeId: l.recipeId,
        units: l.confirmedUnits ?? l.quinnProposedUnits,
      }));
    }
    return [];
  }, [arrivingToday, todaySubmission]);

  const todayStatus: ShipmentStatus = useMemo(() => {
    if (arrivingToday.length > 0) return transferStatus(arrivingToday[0], DEMO_TODAY);
    if (todaySubmission) return submissionStatus(todaySubmission);
    return 'pending';
  }, [arrivingToday, todaySubmission]);

  const todayUnits = todayLines.reduce((s, l) => s + l.units, 0);

  return (
    <div style={{ padding: '12px 16px 4px', display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* Header */}
      <div
        style={{
          background: '#ffffff',
          border: '1px solid var(--color-border-subtle)',
          borderRadius: 'var(--radius-card)',
          padding: 14,
          display: 'flex',
          alignItems: 'center',
          gap: 12,
        }}
      >
        <div
          style={{
            width: 36,
            height: 36,
            borderRadius: 10,
            background: 'var(--color-info-light)',
            color: 'var(--color-info)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          <PackageCheck size={18} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--color-text-primary)' }}>
            Today at {spoke?.name ?? 'the spoke'}
          </div>
          <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 2 }}>
            {DEMO_TODAY} ({dayOfWeek(DEMO_TODAY)}) · Receiving from {hub?.name ?? 'the hub'}
          </div>
        </div>
      </div>

      {/* Arriving today */}
      <Section
        title="Arriving today"
        subtitle={
          arrivingToday.length > 0
            ? `Sent ${arrivingToday.map(t => formatSentClock(t.sentAtISO)).join(', ')} · ${todayUnits} units`
            : todaySubmission
              ? `Hub acknowledged · ${todayUnits} units expected`
              : 'No drop scheduled'
        }
        status={todayStatus}
      >
        {todayLines.length === 0 ? (
          <EmptyRow text="Nothing scheduled to land today." />
        ) : (
          <LineList lines={todayLines} />
        )}
      </Section>

      {/* Recent — yesterday */}
      <Section
        title="Recent"
        subtitle={
          arrivedYesterday.length > 0
            ? `${dayOffset(-1)} · ${arrivedYesterday.reduce((s, t) => s + t.totalUnits, 0)} units`
            : 'No record from yesterday'
        }
        status="delivered"
        muted
      >
        {arrivedYesterday.length === 0 ? (
          <EmptyRow text="No deliveries logged yesterday." />
        ) : (
          <LineList
            lines={arrivedYesterday.flatMap(t =>
              t.lines.map(l => ({ recipeId: l.recipeId, units: l.units })),
            )}
          />
        )}
      </Section>

      {/* Tomorrow — what we just ordered */}
      {tomorrowSubmission && (
        <Section
          title="Sent to hub for tomorrow"
          subtitle={`${dayOffset(1)} · ${tomorrowSubmission.lines.reduce(
            (s, l) => s + (l.confirmedUnits ?? l.quinnProposedUnits),
            0,
          )} units · Cutoff ${tomorrowSubmission.cutoffDateTime.slice(11, 16)}`}
          status={tomorrowSubmission.status === 'draft' ? 'draft' : 'pending'}
          icon={<Calendar size={11} />}
        >
          <LineList
            lines={tomorrowSubmission.lines.map(l => ({
              recipeId: l.recipeId,
              units: l.confirmedUnits ?? l.quinnProposedUnits,
            }))}
            faded={tomorrowSubmission.status === 'draft'}
          />
          {tomorrowSubmission.status === 'draft' && (
            <div
              style={{
                marginTop: 8,
                fontSize: 11,
                color: 'var(--color-warning)',
                fontWeight: 600,
              }}
            >
              Draft only — open the Hub Order tab to confirm before cutoff.
            </div>
          )}
        </Section>
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Subcomponents                                                              */
/* -------------------------------------------------------------------------- */

function Section({
  title,
  subtitle,
  status,
  muted = false,
  icon,
  children,
}: {
  title: string;
  subtitle: string;
  status: ShipmentStatus;
  muted?: boolean;
  icon?: React.ReactNode;
  children: React.ReactNode;
}) {
  const s = STATUS_STYLE[status];
  return (
    <div
      style={{
        background: '#ffffff',
        border: '1px solid var(--color-border-subtle)',
        borderRadius: 'var(--radius-card)',
        overflow: 'hidden',
        opacity: muted ? 0.85 : 1,
      }}
    >
      <div
        style={{
          padding: '10px 14px',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          borderBottom: '1px solid var(--color-border-subtle)',
        }}
      >
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--color-text-primary)' }}>
            {title}
          </div>
          <div style={{ fontSize: 10.5, color: 'var(--color-text-muted)', marginTop: 2 }}>
            {subtitle}
          </div>
        </div>
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4,
            padding: '4px 8px',
            borderRadius: 999,
            background: s.bg,
            color: s.color,
            border: `1px solid ${s.border}`,
            fontSize: 10,
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.04em',
            whiteSpace: 'nowrap',
          }}
        >
          {icon ?? s.icon}
          {s.label}
        </span>
      </div>
      <div style={{ padding: '8px 14px 12px' }}>{children}</div>
    </div>
  );
}

// Display order — bakery first because it's the morning peak, snacks
// last because they're a long-tail.
const CATEGORY_ORDER = ['Bakery', 'Sandwich', 'Salad', 'Beverage', 'Snack'] as const;
type CategoryName = (typeof CATEGORY_ORDER)[number];

function LineList({
  lines,
  faded = false,
}: {
  lines: Array<{ recipeId: string; units: number }>;
  faded?: boolean;
}) {
  // Aggregate by recipe (in case the same SKU lands twice in a day),
  // then group by recipe category so the panel reads like a delivery
  // note rather than a long flat list.
  const groups = useMemo(() => {
    const totals = new Map<string, number>();
    for (const l of lines) {
      totals.set(l.recipeId, (totals.get(l.recipeId) ?? 0) + l.units);
    }
    const byCategory = new Map<CategoryName, Array<{ recipeId: string; name: string; units: number }>>();
    for (const [recipeId, units] of totals) {
      const recipe = getRecipe(recipeId as never);
      const category = (recipe?.category as CategoryName | undefined) ?? 'Snack';
      const arr = byCategory.get(category) ?? [];
      arr.push({ recipeId, name: recipe?.name ?? recipeId, units });
      byCategory.set(category, arr);
    }
    // Stable sort within a category by name so re-renders don't shuffle.
    for (const arr of byCategory.values()) arr.sort((a, b) => a.name.localeCompare(b.name));
    return CATEGORY_ORDER.filter(c => byCategory.has(c)).map(c => ({
      category: c,
      rows: byCategory.get(c)!,
      total: byCategory.get(c)!.reduce((s, r) => s + r.units, 0),
    }));
  }, [lines]);

  if (groups.length === 0) {
    return (
      <div
        style={{
          padding: '10px 8px',
          fontSize: 11,
          color: 'var(--color-text-muted)',
          fontStyle: 'italic',
        }}
      >
        Nothing on this drop.
      </div>
    );
  }

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
        opacity: faded ? 0.7 : 1,
      }}
    >
      {groups.map(g => (
        <div key={g.category} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'baseline',
              gap: 8,
              padding: '0 4px',
            }}
          >
            <span
              style={{
                fontSize: 9.5,
                fontWeight: 700,
                color: 'var(--color-text-muted)',
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
              }}
            >
              {g.category}
            </span>
            <span
              style={{
                flex: 1,
                height: 1,
                background: 'var(--color-border-subtle)',
                alignSelf: 'center',
              }}
            />
            <span
              style={{
                fontSize: 10,
                color: 'var(--color-text-muted)',
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              {g.rows.length} item{g.rows.length === 1 ? '' : 's'} · {g.total} units
            </span>
          </div>
          <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
            {g.rows.map(r => (
              <li
                key={r.recipeId}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '6px 8px',
                  borderRadius: 6,
                  background: 'var(--color-bg-surface)',
                }}
              >
                <span
                  style={{
                    flex: 1,
                    fontSize: 12,
                    color: 'var(--color-text-primary)',
                    fontWeight: 500,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {r.name}
                </span>
                <span
                  style={{
                    fontSize: 12,
                    fontWeight: 700,
                    color: 'var(--color-text-primary)',
                    fontVariantNumeric: 'tabular-nums',
                  }}
                >
                  {r.units}
                </span>
                <span style={{ fontSize: 10, color: 'var(--color-text-muted)' }}>units</span>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

function EmptyRow({ text }: { text: string }) {
  return (
    <div
      style={{
        padding: '10px 8px',
        fontSize: 11,
        color: 'var(--color-text-muted)',
        fontStyle: 'italic',
      }}
    >
      {text}
    </div>
  );
}
