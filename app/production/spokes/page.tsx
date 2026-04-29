'use client';

import { useMemo, useState, useEffect } from 'react';
import { Sparkles, Clock, Send, AlertCircle, CheckCircle2 } from 'lucide-react';
import StatusPill from '@/components/Production/StatusPill';
import { useRole, StaffLockBanner } from '@/components/Production/RoleContext';
import {
  PRET_SPOKE_SUBMISSION,
  PRET_SITES,
  getRecipe,
  getSite,
  dayOfWeek,
  DEMO_TODAY,
  type SkuId,
} from '@/components/Production/fixtures';

type LineState = Record<SkuId, { confirmed: number }>;

export default function SpokeSubmissionsPage() {
  const { can } = useRole();
  const canAdjust = can('spoke.adjust');
  const canSubmit = can('spoke.submit');
  const submission = PRET_SPOKE_SUBMISSION;
  const spoke = getSite(submission.fromSiteId);
  const hub = getSite(submission.toHubId);

  // Hardcoded "now" to match the board's demo time (Thursday, 10:30)
  const nowISO = `${DEMO_TODAY}T10:30:00Z`;

  const [lines, setLines] = useState<LineState>(() =>
    Object.fromEntries(
      submission.lines.map(l => [l.skuId, { confirmed: l.quinnProposedUnits }]),
    ) as LineState,
  );
  const [status, setStatus] = useState<'draft' | 'submitted' | 'acknowledged'>('draft');

  const cutoff = new Date(submission.cutoffDateTime);
  const now = new Date(nowISO);
  const minutesToCutoff = Math.round((cutoff.getTime() - now.getTime()) / 60000);
  const past = minutesToCutoff < 0;

  const totalProposed = submission.lines.reduce((a, b) => a + b.quinnProposedUnits, 0);
  const totalConfirmed = Object.values(lines).reduce((a, b) => a + b.confirmed, 0);
  const delta = totalConfirmed - totalProposed;

  useEffect(() => {
    if (status === 'submitted') {
      const t = setTimeout(() => setStatus('acknowledged'), 1500);
      return () => clearTimeout(t);
    }
  }, [status]);

  function adjust(sku: SkuId, delta: number) {
    setLines(prev => {
      const entry = submission.lines.find(l => l.skuId === sku);
      const recipe = entry ? getRecipe(entry.recipeId) : null;
      const step = recipe?.batchRules?.multipleOf ?? 1;
      const current = prev[sku].confirmed;
      const next = Math.max(0, current + delta * step);
      return { ...prev, [sku]: { confirmed: next } };
    });
  }

  function resetToQuinn() {
    setLines(
      Object.fromEntries(
        submission.lines.map(l => [l.skuId, { confirmed: l.quinnProposedUnits }]),
      ) as LineState,
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Header */}
      <div
        style={{
          padding: '12px 16px',
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          borderBottom: '1px solid var(--color-border-subtle)',
          background: '#ffffff',
          flexWrap: 'wrap',
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
          <div style={{ fontSize: 11, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 700 }}>
            {spoke?.name} → {hub?.name}
          </div>
          <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--color-text-primary)' }}>
            Order for {dayOfWeek(submission.forDate)}
          </div>
        </div>
        <div style={{ flex: 1 }} />
        <CutoffMarker cutoffISO={submission.cutoffDateTime} minutesLeft={minutesToCutoff} past={past} />
      </div>

      <div style={{ flex: 1, minHeight: 0, overflow: 'auto', padding: '16px 16px 32px' }}>
        <div style={{ maxWidth: 820, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 14 }}>
          <StaffLockBanner reason="Spoke orders are confirmed by the Manager before cutoff." />
          {/* Quinn proposal banner */}
          <div
            style={{
              padding: '14px 16px',
              borderRadius: 'var(--radius-card)',
              border: '1px solid var(--color-info)',
              background: 'var(--color-info-light)',
              display: 'flex',
              gap: 12,
              alignItems: 'flex-start',
            }}
          >
            <Sparkles size={18} color="var(--color-info)" style={{ flexShrink: 0, marginTop: 1 }} />
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 2 }}>Quinn drafted your order</div>
              <div style={{ fontSize: 12, color: 'var(--color-text-secondary)', lineHeight: 1.5 }}>
                Based on forecast for {dayOfWeek(submission.forDate)}, carry-over, and recent consumption. Adjust if you&rsquo;re expecting something unusual, then submit.
              </div>
            </div>
          </div>

          {/* Totals card */}
          <div
            style={{
              display: 'flex',
              gap: 16,
              padding: '14px 16px',
              borderRadius: 'var(--radius-card)',
              border: '1px solid var(--color-border-subtle)',
              background: '#ffffff',
              alignItems: 'center',
            }}
          >
            <Metric label="Quinn proposed" value={totalProposed} />
            <Metric label="You confirmed" value={totalConfirmed} bold />
            <Metric label="Delta" value={delta} signed />
            <div style={{ flex: 1 }} />
            {delta !== 0 && (
              <button
                type="button"
                onClick={resetToQuinn}
                disabled={status !== 'draft'}
                style={{
                  padding: '8px 12px',
                  borderRadius: 8,
                  fontSize: 11,
                  fontWeight: 600,
                  fontFamily: 'var(--font-primary)',
                  background: '#ffffff',
                  border: '1px solid var(--color-border)',
                  color: 'var(--color-text-secondary)',
                  cursor: status === 'draft' ? 'pointer' : 'not-allowed',
                  opacity: status === 'draft' ? 1 : 0.5,
                }}
              >
                Reset to Quinn
              </button>
            )}
          </div>

          {/* Line items */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {submission.lines.map(line => {
              const recipe = getRecipe(line.recipeId);
              if (!recipe) return null;
              const confirmed = lines[line.skuId].confirmed;
              const lineDelta = confirmed - line.quinnProposedUnits;
              return (
                <div
                  key={line.skuId}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'minmax(200px, 1.4fr) 100px 160px 100px',
                    alignItems: 'center',
                    gap: 12,
                    padding: '12px 14px',
                    borderRadius: 'var(--radius-card)',
                    border: '1px solid var(--color-border-subtle)',
                    background: '#ffffff',
                  }}
                >
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700 }}>{recipe.name}</div>
                    <div style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>
                      Quinn proposed <strong>{line.quinnProposedUnits}</strong>
                      {recipe.batchRules?.multipleOf && recipe.batchRules.multipleOf > 1 && (
                        <> · steps of {recipe.batchRules.multipleOf}</>
                      )}
                    </div>
                  </div>

                  <div style={{ justifySelf: 'start' }}>
                    <StatusPill
                      tone={lineDelta === 0 ? 'neutral' : lineDelta > 0 ? 'warning' : 'info'}
                      label={lineDelta === 0 ? 'As drafted' : lineDelta > 0 ? `+${lineDelta}` : `${lineDelta}`}
                      size="xs"
                    />
                  </div>

                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                      padding: '4px 6px',
                      borderRadius: 8,
                      background: 'var(--color-bg-hover)',
                      border: '1px solid var(--color-border-subtle)',
                      justifySelf: 'center',
                    }}
                  >
                    <button
                      type="button"
                      onClick={() => adjust(line.skuId, -1)}
                      disabled={status !== 'draft' || !canAdjust}
                      style={stepBtn(status !== 'draft' || !canAdjust)}
                    >
                      −
                    </button>
                    <span
                      style={{
                        minWidth: 40,
                        textAlign: 'center',
                        fontSize: 14,
                        fontWeight: 700,
                        fontVariantNumeric: 'tabular-nums',
                      }}
                    >
                      {confirmed}
                    </span>
                    <button
                      type="button"
                      onClick={() => adjust(line.skuId, 1)}
                      disabled={status !== 'draft' || !canAdjust}
                      style={stepBtn(status !== 'draft' || !canAdjust)}
                    >
                      +
                    </button>
                  </div>

                  <div
                    style={{
                      fontSize: 18,
                      fontWeight: 700,
                      fontVariantNumeric: 'tabular-nums',
                      justifySelf: 'end',
                    }}
                  >
                    {confirmed}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Submit row */}
          <div
            style={{
              marginTop: 4,
              padding: '14px 16px',
              borderRadius: 'var(--radius-card)',
              background: status === 'acknowledged' ? 'var(--color-success-light)' : '#ffffff',
              border: `1px solid ${status === 'acknowledged' ? 'var(--color-success-border)' : 'var(--color-border-subtle)'}`,
              display: 'flex',
              alignItems: 'center',
              gap: 12,
            }}
          >
            {status === 'draft' && (
              <>
                <span style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>
                  Submit before <strong>{formatCutoff(submission.cutoffDateTime)}</strong> so the hub can plan
                  tonight&rsquo;s ferments.
                </span>
                <div style={{ flex: 1 }} />
                <button
                  type="button"
                  onClick={() => setStatus('submitted')}
                  disabled={past || !canSubmit}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    padding: '10px 16px',
                    borderRadius: 8,
                    fontSize: 13,
                    fontWeight: 700,
                    fontFamily: 'var(--font-primary)',
                    background: past || !canSubmit ? 'var(--color-bg-hover)' : 'var(--color-accent-active)',
                    color: past || !canSubmit ? 'var(--color-text-muted)' : 'var(--color-text-on-active)',
                    border: `1px solid ${past || !canSubmit ? 'var(--color-border)' : 'var(--color-accent-active)'}`,
                    cursor: past || !canSubmit ? 'not-allowed' : 'pointer',
                    minHeight: 42,
                  }}
                >
                  <Send size={14} /> {canSubmit ? 'Submit to hub' : 'Manager submits'}
                </button>
              </>
            )}
            {status === 'submitted' && (
              <span style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>
                Sending to hub…
              </span>
            )}
            {status === 'acknowledged' && (
              <>
                <CheckCircle2 size={18} color="var(--color-success)" />
                <span style={{ fontSize: 13, color: 'var(--color-text-primary)', fontWeight: 600 }}>
                  Acknowledged by {hub?.name}. Scheduled for {dayOfWeek(submission.forDate)} dispatch.
                </span>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Subcomponents ────────────────────────────────────────────────────────────

function CutoffMarker({
  cutoffISO,
  minutesLeft,
  past,
}: {
  cutoffISO: string;
  minutesLeft: number;
  past: boolean;
}) {
  const urgent = minutesLeft <= 60 && minutesLeft >= 0;
  return (
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 10,
        padding: '10px 14px',
        borderRadius: 'var(--radius-card)',
        border: `1px solid ${past ? 'var(--color-error-border)' : urgent ? 'var(--color-warning-border)' : 'var(--color-border-subtle)'}`,
        background: past ? 'var(--color-error-light)' : urgent ? 'var(--color-warning-light)' : '#ffffff',
      }}
    >
      {past ? (
        <AlertCircle size={14} color="var(--color-error)" />
      ) : (
        <Clock size={14} color={urgent ? 'var(--color-warning)' : 'var(--color-text-muted)'} />
      )}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        <span style={{ fontSize: 10, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 700 }}>
          Cutoff
        </span>
        <span style={{ fontSize: 13, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
          {formatCutoff(cutoffISO)}
        </span>
        <span
          style={{
            fontSize: 10,
            color: past ? 'var(--color-error)' : urgent ? 'var(--color-warning)' : 'var(--color-text-muted)',
            fontWeight: 600,
          }}
        >
          {past
            ? `${Math.abs(minutesLeft)} min overdue`
            : `${minutesLeft} min remaining`}
        </span>
      </div>
    </div>
  );
}

function Metric({ label, value, signed = false, bold = false }: { label: string; value: number; signed?: boolean; bold?: boolean }) {
  const sign = signed && value !== 0 ? (value > 0 ? '+' : '') : '';
  const color = signed ? (value > 0 ? 'var(--color-warning)' : value < 0 ? 'var(--color-info)' : 'var(--color-text-primary)') : 'var(--color-text-primary)';
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <span style={{ fontSize: 10, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 700 }}>
        {label}
      </span>
      <span style={{ fontSize: bold ? 22 : 18, fontWeight: 700, fontVariantNumeric: 'tabular-nums', color, lineHeight: 1 }}>
        {sign}{value}
      </span>
    </div>
  );
}

function formatCutoff(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString('en-GB', { weekday: 'short', hour: '2-digit', minute: '2-digit' });
}

function stepBtn(disabled = false): React.CSSProperties {
  return {
    width: 28,
    height: 28,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 6,
    background: '#ffffff',
    border: '1px solid var(--color-border)',
    fontSize: 14,
    fontWeight: 700,
    cursor: disabled ? 'not-allowed' : 'pointer',
    color: disabled ? 'var(--color-text-muted)' : 'var(--color-text-primary)',
    fontFamily: 'var(--font-primary)',
    opacity: disabled ? 0.5 : 1,
  };
}
