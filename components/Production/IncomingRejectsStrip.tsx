'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import {
  AlertTriangle,
  Check,
  Trash2,
  Package,
  Clock,
  ExternalLink,
} from 'lucide-react';
import {
  dayOfWeek,
  getRecipe,
  getSite,
  SPOKE_REJECT_REASON_LABEL,
  type SiteId,
  type SpokeReject,
  type SpokeRejectLine,
} from './fixtures';
import { useSpokeRejects } from './rejectsStore';
import { wasteLogUrlForRejectLine } from './wasteRouting';

/**
 * IncomingRejectsStrip — PAC141 surface mounted at the top of
 * /production/dispatch. The hub manager sees every spoke's recorded
 * rejects from recent drops, can acknowledge them (which signals "we've
 * seen it" back to the spoke), and can hop to the waste log to record
 * each reject in the hub's waste totals (PAC141 line: "captures
 * recorded information of rejects under Hub waste").
 *
 * Acknowledgement is independent of the roll-forward marker (PAC142):
 * a hub manager may want to acknowledge but not yet roll into the next
 * drop (e.g. waiting on a quality investigation). The dispatch matrix
 * decides separately whether to fold the qty into next-day demand.
 *
 * The strip auto-hides when there are no recent rejects so the page
 * stays clean on quiet days.
 */

export default function IncomingRejectsStrip({ hubId }: { hubId: SiteId }) {
  const { forHub, acknowledge } = useSpokeRejects();
  const rejects = useMemo(() => {
    return [...forHub(hubId)].sort((a, b) => (a.recordedAtISO < b.recordedAtISO ? 1 : -1));
  }, [forHub, hubId]);

  if (rejects.length === 0) return null;

  const unacknowledged = rejects.filter(r => !r.hubAcknowledged).length;
  const totalUnits = rejects.reduce((a, r) => a + r.totalRejectedUnits, 0);

  // Strip stays calm/neutral by default and only adopts a warning tint
  // when there's something to action. Once everything's acknowledged the
  // strip becomes informational — no red, no green wash.
  const needsAction = unacknowledged > 0;

  return (
    <div
      style={{
        margin: '12px 16px 0',
        background: '#ffffff',
        border: '1px solid var(--color-border-subtle)',
        borderRadius: 'var(--radius-card)',
        overflow: 'hidden',
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: '10px 14px',
          background: needsAction ? 'var(--color-warning-bg)' : 'var(--color-bg-surface)',
          borderBottom: '1px solid var(--color-border-subtle)',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          flexWrap: 'wrap',
        }}
      >
        <AlertTriangle
          size={14}
          color={needsAction ? 'var(--color-warning)' : 'var(--color-text-muted)'}
        />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--color-text-primary)' }}>
            Spoke rejects · {totalUnits} unit{totalUnits === 1 ? '' : 's'} across {rejects.length} record{rejects.length === 1 ? '' : 's'}
          </div>
          <div style={{ fontSize: 11, color: 'var(--color-text-secondary)', marginTop: 2 }}>
            {unacknowledged === 0
              ? 'All acknowledged. Rejected qty is rolling into the next drop on the matrix below.'
              : `${unacknowledged} record${unacknowledged === 1 ? '' : 's'} need acknowledging. Each row links to the waste log so the rejects land in hub totals.`}
          </div>
        </div>
      </div>

      {/* List */}
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        {rejects.map((r, i) => (
          <RejectRow
            key={r.id}
            reject={r}
            isLast={i === rejects.length - 1}
            onAcknowledge={() => acknowledge(r.id)}
          />
        ))}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────

function RejectRow({
  reject,
  isLast,
  onAcknowledge,
}: {
  reject: SpokeReject;
  isLast: boolean;
  onAcknowledge: () => void;
}) {
  const spoke = getSite(reject.spokeId);
  const ack = reject.hubAcknowledged;
  const rolled = reject.rolledIntoNext;
  return (
    <div
      style={{
        padding: '10px 14px',
        display: 'flex',
        alignItems: 'flex-start',
        gap: 12,
        borderBottom: isLast ? 'none' : '1px solid var(--color-border-subtle)',
        // Plain white row — colour is carried by the status chip + reason
        // chip + button, not by background washes or edge stripes.
        background: '#ffffff',
      }}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--color-text-primary)' }}>
            {spoke?.name ?? reject.spokeId}
          </span>
          <span
            style={{
              fontSize: 9,
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              padding: '2px 6px',
              borderRadius: 4,
              background: 'var(--color-bg-hover)',
              color: 'var(--color-text-secondary)',
            }}
          >
            From {dayOfWeek(reject.forDate)} drop
          </span>
          {ack ? (
            <span
              style={{
                fontSize: 9,
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                padding: '2px 7px',
                borderRadius: 4,
                background: 'var(--color-success-light)',
                color: 'var(--color-success)',
                border: '1px solid var(--color-success-border)',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 3,
              }}
            >
              <Check size={9} /> Acknowledged
            </span>
          ) : (
            <span
              style={{
                fontSize: 9,
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                padding: '2px 7px',
                borderRadius: 4,
                background: 'var(--color-error-light)',
                color: 'var(--color-error)',
                border: '1px solid var(--color-error-border)',
              }}
            >
              Needs acknowledging
            </span>
          )}
          {rolled && (
            <span
              style={{
                fontSize: 9,
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                padding: '2px 7px',
                borderRadius: 4,
                background: 'var(--color-info-light)',
                color: 'var(--color-info)',
              }}
            >
              Rolled into next drop
            </span>
          )}
          <span style={{ fontSize: 10, color: 'var(--color-text-muted)', display: 'inline-flex', alignItems: 'center', gap: 3 }}>
            <Clock size={9} />
            {formatRelativeTime(reject.recordedAtISO)} · {reject.recordedBy}
          </span>
        </div>

        {/* Per-line breakdown */}
        <div style={{ marginTop: 6, display: 'flex', flexDirection: 'column', gap: 4 }}>
          {reject.lines.map((ln, i) => (
            <RejectLineRow key={`${ln.skuId}-${i}`} line={ln} />
          ))}
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flexShrink: 0, alignItems: 'stretch' }}>
        <button
          onClick={onAcknowledge}
          disabled={ack}
          style={{
            padding: '6px 10px',
            borderRadius: 8,
            border: ack
              ? '1px solid var(--color-success-border)'
              : '1px solid var(--color-error-border)',
            background: ack ? 'var(--color-success-light)' : '#ffffff',
            color: ack ? 'var(--color-success)' : 'var(--color-error)',
            fontSize: 11,
            fontWeight: 700,
            cursor: ack ? 'default' : 'pointer',
            fontFamily: 'var(--font-primary)',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4,
            justifyContent: 'center',
          }}
        >
          {ack ? <><Check size={11} /> Acknowledged</> : 'Acknowledge'}
        </button>
        <Link
          href={wasteLogUrlForRejectLine(reject.lines[0], reject.recordedAtISO)}
          target="_blank"
          rel="noopener"
          style={{
            padding: '6px 10px',
            borderRadius: 8,
            border: '1px solid var(--color-border)',
            background: '#ffffff',
            color: 'var(--color-text-secondary)',
            fontSize: 11,
            fontWeight: 600,
            cursor: 'pointer',
            fontFamily: 'var(--font-primary)',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4,
            textDecoration: 'none',
            justifyContent: 'center',
          }}
        >
          <Trash2 size={11} /> Log to hub waste <ExternalLink size={9} />
        </Link>
      </div>
    </div>
  );
}

function RejectLineRow({ line }: { line: SpokeRejectLine }) {
  const recipe = getRecipe(line.recipeId);
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, fontSize: 11, color: 'var(--color-text-secondary)' }}>
      <Package size={10} color="var(--color-text-muted)" style={{ flexShrink: 0 }} />
      <span style={{ fontWeight: 700, color: 'var(--color-text-primary)', fontVariantNumeric: 'tabular-nums' }}>
        {line.rejectedUnits}
      </span>
      <span>{recipe?.name ?? line.skuId}</span>
      <span
        style={{
          fontSize: 9,
          fontWeight: 700,
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
          padding: '1px 6px',
          borderRadius: 3,
          background: 'var(--color-warning-bg)',
          color: 'var(--color-warning)',
        }}
      >
        {SPOKE_REJECT_REASON_LABEL[line.reason]}
      </span>
      {line.note && (
        <span style={{ fontSize: 10, color: 'var(--color-text-muted)', fontStyle: 'italic' }}>
          · {line.note}
        </span>
      )}
    </div>
  );
}

function formatRelativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return '';
  const diff = Date.now() - then;
  const hrs = Math.round(diff / (1000 * 60 * 60));
  if (hrs < 1) return 'just now';
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.round(hrs / 24);
  return `${days}d ago`;
}
