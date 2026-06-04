'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronDown, ChevronUp } from 'lucide-react';
import EdifyMark from '@/components/EdifyMark/EdifyMark';
import { COGS_INSIGHT_CARDS, type CogsInsightCard } from './insights';
import { COGS_SUMMARY } from './fixtures';
import { gbp, gbpApprox } from './format';

type GroupKey = CogsInsightCard['kind'];

const GROUP_LABEL: Record<GroupKey, string> = {
  'Data fix': 'Data fixes',
  Operations: 'Operations',
  Setup: 'Setup',
};

function dotColor(sev: CogsInsightCard['severity']): string {
  if (sev === 'high') return 'var(--color-warning)';
  return 'var(--color-text-muted)';
}

function sumImpact(kinds: GroupKey[]): number {
  return COGS_INSIGHT_CARDS.filter((c) => kinds.includes(c.kind)).reduce(
    (acc, c) => acc + (c.impactDh ?? 0),
    0,
  );
}

export default function CogsInsightsBoard({
  onHighlightRows,
  onViewVariance,
  onAskEdify,
}: {
  onHighlightRows: (ids: string[]) => void;
  onViewVariance: () => void;
  onAskEdify: () => void;
}) {
  const [open, setOpen] = useState(true);
  const router = useRouter();
  const unfavourable = COGS_SUMMARY.varianceCost > 0;

  const recoverable = sumImpact(['Data fix', 'Setup']);
  const operational = sumImpact(['Operations']);

  // Show every insight as a card, highest-impact first.
  const topCards = [...COGS_INSIGHT_CARDS].sort(
    (a, b) => (b.impactDh ?? 0) - (a.impactDh ?? 0),
  );

  function reviewCard(card: CogsInsightCard) {
    if (card.link) {
      router.push(card.link.href);
      return;
    }
    if (card.rowIds && card.rowIds.length > 0) {
      onHighlightRows(card.rowIds);
      onViewVariance();
    }
  }

  function Stat({ label, value }: { label: string; value: string }) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        <span
          style={{
            fontSize: 10.5,
            fontWeight: 700,
            letterSpacing: '0.05em',
            textTransform: 'uppercase',
            color: 'var(--color-text-muted)',
          }}
        >
          {label}
        </span>
        <span style={{ fontSize: 16, fontWeight: 700, color: 'var(--color-text-primary)' }}>
          {value}
        </span>
      </div>
    );
  }

  return (
    <div
      style={{
        borderRadius: 'var(--radius-card)',
        border: '1px solid var(--color-border-subtle)',
        background: '#fff',
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '12px 16px',
          borderBottom: open ? '1px solid var(--color-border-subtle)' : 'none',
        }}
      >
        <EdifyMark size={14} color="var(--color-accent-deep)" />
        <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--color-text-primary)' }}>
          Edify insights
        </span>

        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 4 }}>
          <button
            type="button"
            onClick={onAskEdify}
            style={{
              padding: '5px 10px',
              borderRadius: 7,
              border: 'none',
              background: 'transparent',
              color: 'var(--color-accent-deep)',
              fontSize: 12,
              fontWeight: 600,
              fontFamily: 'var(--font-primary)',
              cursor: 'pointer',
            }}
          >
            Ask Edify
          </button>
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-label={open ? 'Collapse' : 'Expand'}
            style={{
              width: 26,
              height: 26,
              borderRadius: 6,
              border: 'none',
              background: 'transparent',
              color: 'var(--color-text-muted)',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {open ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
          </button>
        </div>
      </div>

      {open && (
        <>
          {/* Mini-stat row */}
          <div
            style={{
              display: 'flex',
              gap: 32,
              flexWrap: 'wrap',
              padding: '12px 16px',
              borderBottom: '1px solid var(--color-border-subtle)',
            }}
          >
            <Stat
              label="COGS variance"
              value={`${unfavourable ? '+' : ''}${COGS_SUMMARY.variancePp.toFixed(1)}pp / ${gbp(COGS_SUMMARY.varianceCost, { decimals: 0 })}`}
            />
            <Stat label="Recoverable (data & setup)" value={gbpApprox(recoverable)} />
            <Stat label="Operational" value={gbpApprox(operational)} />
          </div>

          {/* Insight cards — uniform small cards in a wrapping grid so
              they align both horizontally (equal column widths via
              auto-fill minmax) and               vertically (equal heights via a
              shared min-height + bottom-anchored footer), ordered
              highest-impact first. */}
          <div style={{ padding: '12px 16px 16px' }}>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(196px, 1fr))',
                gap: 12,
                alignItems: 'stretch',
              }}
            >
              {topCards.map((card) => {
                const hasAction =
                  card.link || (card.rowIds && card.rowIds.length > 0);
                return (
                  <div
                    key={card.id}
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 8,
                      minHeight: 158,
                      padding: 12,
                      borderRadius: 10,
                      border: '1px solid var(--color-border-subtle)',
                      background: '#fff',
                    }}
                  >
                    {/* Kind + severity */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span
                        style={{
                          width: 6,
                          height: 6,
                          borderRadius: '50%',
                          background: dotColor(card.severity),
                        }}
                      />
                      <span
                        style={{
                          fontSize: 10,
                          fontWeight: 700,
                          letterSpacing: '0.05em',
                          textTransform: 'uppercase',
                          color: 'var(--color-text-muted)',
                        }}
                      >
                        {GROUP_LABEL[card.kind]}
                      </span>
                    </div>

                    {/* Title */}
                    <div
                      style={{
                        fontSize: 13,
                        fontWeight: 700,
                        lineHeight: 1.3,
                        color: 'var(--color-text-primary)',
                        display: '-webkit-box',
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: 'vertical',
                        overflow: 'hidden',
                      }}
                    >
                      {card.title}
                    </div>

                    {/* Action description */}
                    <div
                      style={{
                        fontSize: 12,
                        lineHeight: 1.4,
                        color: 'var(--color-text-secondary)',
                        display: '-webkit-box',
                        WebkitLineClamp: 3,
                        WebkitBoxOrient: 'vertical',
                        overflow: 'hidden',
                      }}
                    >
                      {card.action}
                    </div>

                    {/* Footer — price + action, anchored to the bottom so
                        every card's footer sits on the same baseline. */}
                    <div
                      style={{
                        marginTop: 'auto',
                        paddingTop: 6,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: 8,
                      }}
                    >
                      <span
                        style={{
                          fontSize: 14,
                          fontWeight: 700,
                          color: 'var(--color-text-primary)',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {card.impactDh !== null
                          ? gbp(card.impactDh, { decimals: 0 })
                          : ''}
                      </span>
                      {hasAction && (
                        <button
                          type="button"
                          onClick={() => reviewCard(card)}
                          style={{
                            padding: '6px 12px',
                            borderRadius: 8,
                            border: '1px solid var(--color-border)',
                            background: '#fff',
                            color: 'var(--color-accent-deep)',
                            fontSize: 12,
                            fontWeight: 600,
                            fontFamily: 'var(--font-primary)',
                            cursor: 'pointer',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {card.link ? card.link.label : 'Review'}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
