'use client';

import { useMemo, useState } from 'react';
import { CheckCircle2, Trash2, ArrowDown } from 'lucide-react';
import EdifyMark from '@/components/EdifyMark/EdifyMark';
import StatusPill from '@/components/Production/StatusPill';
import { useRole, StaffLockBanner } from '@/components/Production/RoleContext';
import { useProductionSite } from '@/components/Production/ProductionSiteContext';
import {
  PRET_CARRY_OVER,
  getRecipe,
  getSite,
  type CarryOverEntry,
} from '@/components/Production/fixtures';

type DisplayStatus = 'draft' | 'confirmed' | 'adjusted';

export default function CarryOverPage() {
  const { can } = useRole();
  const canAdjust = can('carry-over.adjust');
  const canConfirm = can('carry-over.confirm');
  // Site comes from the shared ProductionSiteContext — picker lives in
  // the production layout above the nav.
  const { siteId } = useProductionSite();
  // Local ephemeral adjustments (carriedUnits overrides + status changes)
  const [overrides, setOverrides] = useState<
    Record<string, { carriedUnits?: number; status?: DisplayStatus }>
  >({});

  const siteEntries = useMemo(
    () => PRET_CARRY_OVER.filter(e => e.siteId === siteId),
    [siteId],
  );

  const enriched = siteEntries.map(e => {
    const ov = overrides[e.id] ?? {};
    const carried = ov.carriedUnits ?? e.carriedUnits;
    const adjustment = e.carriedUnits === 0 ? 0 : -carried;
    const status: DisplayStatus =
      ov.status ?? (e.status === 'confirmed' ? 'confirmed' : 'draft');
    return { entry: e, carried, adjustment, status };
  });

  const draftCount = enriched.filter(x => x.status === 'draft').length;
  const totalCarried = enriched.reduce((a, b) => a + b.carried, 0);
  const totalAdjustment = enriched.reduce((a, b) => a + b.adjustment, 0);

  function adjust(id: string, delta: number) {
    setOverrides(prev => {
      const entry = PRET_CARRY_OVER.find(e => e.id === id);
      if (!entry) return prev;
      const current = prev[id]?.carriedUnits ?? entry.carriedUnits;
      const next = Math.max(0, current + delta);
      const draftAtQuinnValue = next === entry.carriedUnits;
      return {
        ...prev,
        [id]: {
          ...prev[id],
          carriedUnits: next,
          status: draftAtQuinnValue ? 'draft' : 'adjusted',
        },
      };
    });
  }

  function confirm(id: string) {
    setOverrides(prev => ({
      ...prev,
      [id]: { ...prev[id], status: 'confirmed' },
    }));
  }

  function confirmAll() {
    const next: typeof overrides = { ...overrides };
    for (const e of siteEntries) {
      if (e.status !== 'confirmed' && overrides[e.id]?.status !== 'confirmed') {
        next[e.id] = { ...next[e.id], status: 'confirmed' };
      }
    }
    setOverrides(next);
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ flex: 1, minHeight: 0, overflow: 'auto', padding: '16px 16px 32px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          <StaffLockBanner reason="Managers confirm carry-over before the first run." />
          {/* Quinn intro + totals */}
          <div
            style={{
              padding: '16px 18px',
              borderRadius: 'var(--radius-card)',
              border: '1px solid var(--color-info)',
              background: 'var(--color-info-light)',
              display: 'flex',
              gap: 12,
              alignItems: 'flex-start',
            }}
          >
            <EdifyMark size={20} color="var(--color-info)" style={{ flexShrink: 0, marginTop: 2 }} />
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
              <h2 style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>Quinn's carry-over draft</h2>
              <p style={{ margin: 0, fontSize: 12, color: 'var(--color-text-secondary)', lineHeight: 1.5 }}>
                Yesterday&rsquo;s unsold counter items within shelf life reduce today&rsquo;s plan. Review each line, adjust if needed, and confirm. Expired items are logged to waste automatically.
                {getSite(siteId)?.type === 'HUB' && (
                  <>
                    {' '}<span style={{ color: 'var(--color-text-muted)' }}>
                      Units dispatched to spokes yesterday left the building, so they don&rsquo;t appear here — only counter unsold accumulates as carry-over.
                    </span>
                  </>
                )}
              </p>
            </div>
            <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
              <KPI label="Carried" value={totalCarried} />
              <KPI label="Plan Δ" value={totalAdjustment} signed />
              <button
                type="button"
                onClick={confirmAll}
                disabled={draftCount === 0 || !canConfirm}
                style={{
                  padding: '10px 14px',
                  borderRadius: 8,
                  fontSize: 12,
                  fontWeight: 700,
                  fontFamily: 'var(--font-primary)',
                  background: draftCount === 0 || !canConfirm ? 'var(--color-bg-hover)' : 'var(--color-accent-active)',
                  color: draftCount === 0 || !canConfirm ? 'var(--color-text-muted)' : 'var(--color-text-on-active)',
                  border: `1px solid ${draftCount === 0 || !canConfirm ? 'var(--color-border)' : 'var(--color-accent-active)'}`,
                  cursor: draftCount === 0 || !canConfirm ? 'not-allowed' : 'pointer',
                  whiteSpace: 'nowrap',
                }}
              >
                Confirm all {draftCount > 0 ? `(${draftCount})` : ''}
              </button>
            </div>
          </div>

          {/* Carry-over rows */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {enriched.map(({ entry, carried, adjustment, status }) => (
              <CarryOverRow
                key={entry.id}
                entry={entry}
                carried={carried}
                adjustment={adjustment}
                status={status}
                canAdjust={canAdjust}
                canConfirm={canConfirm}
                onAdjust={delta => adjust(entry.id, delta)}
                onConfirm={() => confirm(entry.id)}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Subcomponents ────────────────────────────────────────────────────────────

function KPI({ label, value, signed = false }: { label: string; value: number; signed?: boolean }) {
  const sign = signed && value !== 0 ? (value > 0 ? '+' : '') : '';
  const valueColor = signed && value < 0 ? 'var(--color-warning)' : 'var(--color-text-primary)';
  return (
    <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', gap: 2 }}>
      <span style={{ fontSize: 10, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 700 }}>
        {label}
      </span>
      <span style={{ fontSize: 18, fontWeight: 700, fontVariantNumeric: 'tabular-nums', color: valueColor, lineHeight: 1 }}>
        {sign}{value}
      </span>
    </div>
  );
}

function CarryOverRow({
  entry,
  carried,
  adjustment,
  status,
  canAdjust,
  canConfirm,
  onAdjust,
  onConfirm,
}: {
  entry: CarryOverEntry;
  carried: number;
  adjustment: number;
  status: DisplayStatus;
  canAdjust: boolean;
  canConfirm: boolean;
  onAdjust: (delta: number) => void;
  onConfirm: () => void;
}) {
  const recipe = getRecipe(entry.recipeId);
  if (!recipe) return null;

  const isExpired = entry.carriedUnits === 0; // Quinn drafted zero → expired
  const tone =
    status === 'confirmed' ? 'success' :
    status === 'adjusted' ? 'warning' :
    'neutral';
  const statusLabel =
    status === 'confirmed' ? 'Confirmed' :
    status === 'adjusted' ? 'Manager adjusted' :
    'Quinn draft';

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'minmax(200px, 1.4fr) auto 120px 180px auto',
        alignItems: 'center',
        gap: 14,
        padding: '14px 16px',
        borderRadius: 'var(--radius-card)',
        border: `1px solid ${status === 'confirmed' ? 'var(--color-success-border)' : 'var(--color-border-subtle)'}`,
        background: status === 'confirmed' ? 'var(--color-success-light)' : '#ffffff',
      }}
    >
      {/* Recipe + reason */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 3, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--color-text-primary)' }}>
          {recipe.name}
        </div>
        <div style={{ fontSize: 11, color: 'var(--color-text-muted)', lineHeight: 1.4 }}>
          {entry.reason}
        </div>
      </div>

      {/* Status pill */}
      <div>
        <StatusPill tone={tone} label={statusLabel} size="xs" />
      </div>

      {/* Qty stepper */}
      {isExpired ? (
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            padding: '6px 8px',
            borderRadius: 8,
            background: 'var(--color-error-light)',
            color: 'var(--color-error)',
            fontSize: 11,
            fontWeight: 700,
            justifySelf: 'center',
          }}
        >
          <Trash2 size={12} /> To waste
        </div>
      ) : (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            padding: '4px 6px',
            borderRadius: 8,
            background: '#ffffff',
            border: '1px solid var(--color-border-subtle)',
            justifySelf: 'center',
          }}
        >
          <button type="button" onClick={() => onAdjust(-1)} disabled={!canAdjust} style={stepBtn(!canAdjust)}>−</button>
          <span
            style={{
              minWidth: 28,
              textAlign: 'center',
              fontSize: 14,
              fontWeight: 700,
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {carried}
          </span>
          <button type="button" onClick={() => onAdjust(1)} disabled={!canAdjust} style={stepBtn(!canAdjust)}>+</button>
        </div>
      )}

      {/* Plan adjustment arrow */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, justifySelf: 'center' }}>
        {isExpired ? (
          <span style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>No plan change</span>
        ) : (
          <>
            <ArrowDown size={14} color="var(--color-warning)" />
            <span style={{ fontSize: 13, fontWeight: 700, fontVariantNumeric: 'tabular-nums', color: 'var(--color-warning)' }}>
              {adjustment} units
            </span>
          </>
        )}
      </div>

      {/* Confirm */}
      <button
        type="button"
        onClick={onConfirm}
        disabled={status === 'confirmed' || !canConfirm}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          padding: '8px 14px',
          borderRadius: 8,
          fontSize: 11,
          fontWeight: 700,
          fontFamily: 'var(--font-primary)',
          cursor: status === 'confirmed' || !canConfirm ? 'not-allowed' : 'pointer',
          background: status === 'confirmed' || !canConfirm ? 'var(--color-bg-hover)' : 'var(--color-accent-active)',
          color: status === 'confirmed' || !canConfirm ? 'var(--color-text-muted)' : 'var(--color-text-on-active)',
          border: `1px solid ${status === 'confirmed' || !canConfirm ? 'var(--color-border)' : 'var(--color-accent-active)'}`,
          whiteSpace: 'nowrap',
          opacity: status === 'confirmed' || !canConfirm ? 0.7 : 1,
        }}
      >
        <CheckCircle2 size={12} /> {status === 'confirmed' ? 'Confirmed' : 'Confirm'}
      </button>
    </div>
  );
}

function stepBtn(disabled = false): React.CSSProperties {
  return {
    width: 26,
    height: 26,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 6,
    background: 'var(--color-bg-hover)',
    border: '1px solid var(--color-border)',
    fontSize: 14,
    fontWeight: 700,
    cursor: disabled ? 'not-allowed' : 'pointer',
    color: disabled ? 'var(--color-text-muted)' : 'var(--color-text-primary)',
    fontFamily: 'var(--font-primary)',
    opacity: disabled ? 0.5 : 1,
  };
}
