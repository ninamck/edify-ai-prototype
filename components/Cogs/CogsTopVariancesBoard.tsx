'use client';

import { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import EdifyMark from '@/components/EdifyMark/EdifyMark';
import { getTopVariances, getVarianceReason } from './insights';
import { gbp } from './format';

const TOP = getTopVariances(10);

function varColor(varCost: number): string {
  // Over recipe (more cost than theory) reads unfavourable.
  return varCost > 0 ? 'var(--color-error)' : 'var(--color-success)';
}

export default function CogsTopVariancesBoard({
  onHighlightRows,
  onOpenDetail,
  onAskEdify,
}: {
  onHighlightRows: (ids: string[]) => void;
  onOpenDetail: (rowId: string) => void;
  onAskEdify: () => void;
}) {
  const [open, setOpen] = useState(true);

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
          Top 10 variances
        </span>
        <span style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>
          biggest $ swings — open a line for the breakdown and fix
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
        <div style={{ padding: '12px 16px 16px' }}>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(196px, 1fr))',
              gap: 12,
              alignItems: 'stretch',
            }}
          >
            {TOP.map((row, i) => {
              const openDetail = () => {
                onHighlightRows([row.id]);
                onOpenDetail(row.id);
              };
              return (
                <div
                  key={row.id}
                  role="button"
                  tabIndex={0}
                  onClick={openDetail}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      openDetail();
                    }
                  }}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 8,
                    minHeight: 132,
                    padding: 12,
                    borderRadius: 10,
                    border: '1px solid var(--color-border-subtle)',
                    background: '#fff',
                    cursor: 'pointer',
                    textAlign: 'left',
                    fontFamily: 'var(--font-primary)',
                  }}
                >
                  {/* Rank + name */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span
                      style={{
                        width: 6,
                        height: 6,
                        borderRadius: '50%',
                        background: varColor(row.varCost),
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
                      {`#${i + 1}`}
                    </span>
                  </div>

                  {/* Name */}
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
                    {row.name}
                  </div>

                  {/* Reason */}
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
                    {getVarianceReason(row)}
                  </div>

                  {/* Footer — variance $ + % */}
                  <div
                    style={{
                      marginTop: 'auto',
                      paddingTop: 6,
                      display: 'flex',
                      alignItems: 'baseline',
                      justifyContent: 'space-between',
                      gap: 8,
                    }}
                  >
                    <span style={{ fontSize: 14, fontWeight: 700, color: varColor(row.varCost) }}>
                      {gbp(row.varCost, { sign: true, decimals: 0 })}
                    </span>
                    <span style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>
                      {row.varPct > 0 ? '+' : ''}
                      {row.varPct.toFixed(1)}%
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
