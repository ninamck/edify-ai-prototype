'use client';

import { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  Lock,
  Tag,
  Trash2,
} from 'lucide-react';
import Link from 'next/link';
import StatusPill from './StatusPill';
import QtyStepper from './QtyStepper';
import { useRole } from './RoleContext';
import { wasteLogUrlForBatch } from './wasteRouting';
import { defaultOperatorForSite, operatorsForSite } from './pcrFixtures';
import {
  getBench,
  getProductionItem,
  getRecipe,
  type ProductionBatch,
  type ProductionMode,
} from './fixtures';

export type PCRDraft = {
  batchId: string;
  made: number;
  rejected: number;
  madeBy: string;
  qualityCheck: 'pass' | 'fail';
  labelCheck: 'pass' | 'fail' | null;
  signedBy: string;
  /** ISO datetime stamped when the card was completed. */
  signedAt: string;
};

type Props = {
  batch: ProductionBatch;
  /** Existing signed draft for this batch (if any). When present, the card renders in collapsed signed-state. */
  signed?: PCRDraft;
  /** Existing failed-state draft (quality or label fail). */
  failed?: PCRDraft;
  canSign: boolean;
  /** Fired when the manager finishes filling the card (all required checks pass). */
  onComplete?: (draft: PCRDraft) => void;
  /** Fired when a failure is recorded. */
  onFail?: (draft: PCRDraft) => void;
  /** Force expanded state (e.g. inside the timeline popover). */
  forceExpanded?: boolean;
  /** Compact horizontal padding when used inside a popover. */
  dense?: boolean;
};

/**
 * Inline PCR card — one per batch. Replaces the modal PCRGate flow on the
 * PCR queue page. Modelled on the Edify staging "production-control" card:
 *
 *   ┌─────────────────────────────────────────────────────────────────┐
 *   │ Bag Egg & Avo · Planned 6 · RUN R1   Bakery oven · 07:00–07:25 ▼│
 *   │ Made by [Priya ▾]  Made [- 32 +]  Rejected [- 0 +]              │
 *   │ Quality [Pass | Fail]   Label [Pass | Fail]                     │
 *   └─────────────────────────────────────────────────────────────────┘
 *
 * Auto-submits the moment all required fields are answered.
 */
export default function PCRBatchCard({
  batch,
  signed,
  failed,
  canSign,
  onComplete,
  onFail,
  forceExpanded,
  dense = false,
}: Props) {
  const { user } = useRole();
  const item = getProductionItem(batch.productionItemId);
  const recipe = item ? getRecipe(item.recipeId) : null;
  const bench = getBench(batch.benchId);

  const isOnDemand = !batch.plannedInstanceId;
  const requiresLabel = !bench?.capabilities.includes('prep') || isOnDemand;

  const initialSigner = `${user.name.split('—')[0].trim()} (${user.role})`;
  const initialMadeBy = signed?.madeBy ?? failed?.madeBy ?? defaultOperatorForSite(item?.siteId ?? '', user.name);

  const [expanded, setExpanded] = useState<boolean>(forceExpanded ?? !signed);
  const [made, setMade] = useState<number>(signed?.made ?? failed?.made ?? batch.actualQty);
  const [rejected, setRejected] = useState<number>(signed?.rejected ?? failed?.rejected ?? 0);
  const [madeBy, setMadeBy] = useState<string>(initialMadeBy);
  const [qualityCheck, setQualityCheck] = useState<'pass' | 'fail' | null>(
    signed ? signed.qualityCheck : failed ? failed.qualityCheck : null,
  );
  const [labelCheck, setLabelCheck] = useState<'pass' | 'fail' | null>(
    signed ? signed.labelCheck : failed ? failed.labelCheck : null,
  );

  // Keep expanded in sync with parent override (e.g. popover always-expanded).
  useEffect(() => {
    if (forceExpanded != null) setExpanded(forceExpanded);
  }, [forceExpanded]);

  const operators = useMemo(() => operatorsForSite(item?.siteId ?? ''), [item?.siteId]);
  const isDone = !!signed || !!failed;
  const lockedReadOnly = !canSign || isDone;

  // Auto-complete: when all required answers are provided AND the manager
  // is signing fresh (not already-done), fire the appropriate callback.
  useEffect(() => {
    if (lockedReadOnly) return;
    if (made <= 0) return;
    if (!madeBy) return;
    if (qualityCheck == null) return;
    if (requiresLabel && labelCheck == null) return;

    const draft: PCRDraft = {
      batchId: batch.id,
      made,
      rejected,
      madeBy,
      qualityCheck,
      labelCheck: requiresLabel ? labelCheck : null,
      signedBy: initialSigner,
      signedAt: new Date().toISOString(),
    };
    const isFailure = qualityCheck === 'fail' || (requiresLabel && labelCheck === 'fail');
    if (isFailure) {
      onFail?.(draft);
    } else {
      onComplete?.(draft);
    }
    // We deliberately depend only on the answers — once fired, parent flips
    // signed/failed state which short-circuits the guard above.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [made, rejected, madeBy, qualityCheck, labelCheck]);

  if (!recipe || !bench) return null;

  const mode: ProductionMode = item?.mode ?? 'variable';
  const runLabel = bench.runs?.find(r => r.startTime === batch.startTime)?.label;

  // ── Collapsed state (signed today / failed today) ─────────────────────────
  if (isDone && !expanded) {
    const draft = signed ?? failed!;
    const time = formatTime(draft.signedAt);
    const signerShort = draft.signedBy.split(' ')[0];
    return (
      <div
        style={{
          ...cardShell(dense),
          // Signed cards stay neutral (no green wash) so the queue doesn't
          // turn into a wall of green; the small tick icon and the "Signed
          // by" line carry the meaning. Failed stays red because it's a
          // meaningful alert.
          background: failed ? 'var(--color-error-light)' : '#ffffff',
          borderColor: failed ? 'var(--color-error-border)' : 'var(--color-border-subtle)',
          padding: '10px 14px',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
        }}
      >
        {signed ? (
          <CheckCircle2 size={16} color="var(--color-text-muted)" />
        ) : (
          <Trash2 size={16} color="var(--color-error)" />
        )}
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--color-text-primary)' }}>
              {recipe.name}
            </span>
            <ModeChip mode={mode} runLabel={runLabel} startTime={batch.startTime} />
            <span style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>
              {bench.name} · {batch.startTime}
            </span>
          </div>
          <div style={{ fontSize: 11, color: 'var(--color-text-secondary)', marginTop: 2 }}>
            {signed ? 'Signed' : 'Failed'} by <strong>{signerShort}</strong> at {time} · made{' '}
            <strong style={{ fontVariantNumeric: 'tabular-nums' }}>{draft.made}</strong>
            {draft.rejected > 0 && (
              <>
                {' '}
                · rej{' '}
                <strong style={{ fontVariantNumeric: 'tabular-nums' }}>{draft.rejected}</strong>
              </>
            )}
          </div>
        </div>
        {failed && (
          <Link
            href={wasteLogUrlForBatch(batch)}
            style={btn('error')}
          >
            <Trash2 size={12} /> Log to waste
          </Link>
        )}
        <button
          type="button"
          onClick={() => setExpanded(true)}
          aria-label="Expand"
          style={chevronBtn()}
        >
          <ChevronDown size={16} />
        </button>
      </div>
    );
  }

  // ── Expanded card (awaiting review or expanded signed/failed) ─────────────
  return (
    <div style={{ ...cardShell(dense), padding: '14px 16px' }}>
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          gap: 10,
          flexWrap: 'wrap',
          marginBottom: 12,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0, flex: 1 }}>
          <h3
            style={{
              margin: 0,
              fontSize: 15,
              fontWeight: 700,
              color: 'var(--color-text-primary)',
              fontFamily: 'var(--font-primary)',
            }}
          >
            {recipe.name}
          </h3>
          <Chip>Planned {batch.actualQty}</Chip>
          <ModeChip mode={mode} runLabel={runLabel} startTime={batch.startTime} />
          {isOnDemand && (
            <StatusPill tone="info" label="On-demand" size="xs" />
          )}
          {signed && <StatusPill tone="success" label="Signed" size="xs" />}
          {failed && <StatusPill tone="error" label="Failed" size="xs" />}
        </div>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            fontSize: 11,
            color: 'var(--color-text-muted)',
            fontWeight: 600,
            fontFamily: 'var(--font-primary)',
          }}
        >
          <span>
            {bench.name} · {batch.startTime}–{batch.endTime}
          </span>
          {forceExpanded == null && isDone && (
            <button
              type="button"
              onClick={() => setExpanded(false)}
              aria-label="Collapse"
              style={chevronBtn()}
            >
              <ChevronUp size={16} />
            </button>
          )}
        </div>
      </div>

      {/* Body — inline form */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: requiresLabel
            ? 'minmax(180px, 1.4fr) 130px 130px minmax(150px, 1fr) minmax(150px, 1fr)'
            : 'minmax(180px, 1.4fr) 130px 130px minmax(180px, 1fr)',
          gap: 14,
          alignItems: 'flex-end',
        }}
      >
        <FormField label="Made by">
          <select
            value={madeBy}
            onChange={e => setMadeBy(e.target.value)}
            disabled={lockedReadOnly}
            style={selectStyle(lockedReadOnly)}
          >
            {operators.map(name => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
            {!operators.includes(madeBy) && <option value={madeBy}>{madeBy}</option>}
          </select>
        </FormField>

        <FormField label="Made">
          <Stepper value={made} onChange={setMade} disabled={lockedReadOnly} min={0} />
        </FormField>

        <FormField label="Rejected">
          <Stepper value={rejected} onChange={setRejected} disabled={lockedReadOnly} min={0} />
        </FormField>

        <FormField label="Quality check">
          <CheckPill
            value={qualityCheck}
            onChange={setQualityCheck}
            disabled={lockedReadOnly}
          />
        </FormField>

        {requiresLabel && (
          <FormField label="Label check" icon={<Tag size={12} />}>
            <CheckPill
              value={labelCheck}
              onChange={setLabelCheck}
              disabled={lockedReadOnly}
            />
          </FormField>
        )}
      </div>

      {/* Footer hint when not yet complete */}
      {!isDone && canSign && (
        <div
          style={{
            marginTop: 10,
            fontSize: 11,
            color: 'var(--color-text-muted)',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
          }}
        >
          <Lock size={11} />
          Card auto-signs and moves to Signed today as soon as both checks pass.
        </div>
      )}
      {!canSign && (
        <div
          style={{
            marginTop: 10,
            fontSize: 11,
            color: 'var(--color-warning)',
            fontWeight: 600,
          }}
        >
          Manager sign-off required to complete this PCR.
        </div>
      )}
    </div>
  );
}

// ─── Sub-bits ────────────────────────────────────────────────────────────────

function FormField({
  label,
  icon,
  children,
}: {
  label: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
      <span
        style={{
          fontSize: 9,
          fontWeight: 700,
          color: 'var(--color-text-muted)',
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
          display: 'inline-flex',
          alignItems: 'center',
          gap: 4,
        }}
      >
        {icon}
        {label}
      </span>
      {children}
    </label>
  );
}

function Stepper({
  value,
  onChange,
  disabled,
  min = 0,
}: {
  value: number;
  onChange: (v: number) => void;
  disabled?: boolean;
  min?: number;
}) {
  return (
    <QtyStepper
      size="default"
      disabled={disabled}
      canDecrement={value > min}
      onDecrement={() => onChange(Math.max(min, value - 1))}
      onIncrement={() => onChange(value + 1)}
      style={{ display: 'flex', height: 38 }}
    >
      <input
        type="number"
        value={value}
        disabled={disabled}
        onChange={e => onChange(Math.max(min, Number(e.target.value) || 0))}
        style={{
          flex: 1,
          minWidth: 0,
          textAlign: 'center',
          fontSize: 16,
          fontWeight: 700,
          fontVariantNumeric: 'tabular-nums',
          fontFamily: 'var(--font-primary)',
          border: 'none',
          background: 'transparent',
          outline: 'none',
          color: 'var(--color-text-primary)',
          padding: 0,
          margin: 0,
          appearance: 'textfield',
          MozAppearance: 'textfield',
        }}
      />
    </QtyStepper>
  );
}

function CheckPill({
  value,
  onChange,
  disabled,
}: {
  value: 'pass' | 'fail' | null;
  onChange: (v: 'pass' | 'fail') => void;
  disabled?: boolean;
}) {
  return (
    <div
      style={{
        display: 'inline-flex',
        gap: 4,
        background: value === null ? 'var(--color-bg-hover)' : 'transparent',
        borderRadius: 100,
        padding: 3,
        border: '1px solid var(--color-border-subtle)',
        height: 38,
        alignItems: 'center',
      }}
    >
      <CheckPillBtn
        active={value === 'pass'}
        tone="success"
        onClick={() => !disabled && onChange('pass')}
        label="Pass"
        disabled={disabled}
      />
      <CheckPillBtn
        active={value === 'fail'}
        tone="error"
        onClick={() => !disabled && onChange('fail')}
        label="Fail"
        disabled={disabled}
      />
    </div>
  );
}

function CheckPillBtn({
  active,
  tone,
  onClick,
  label,
  disabled,
}: {
  active: boolean;
  tone: 'success' | 'error';
  onClick: () => void;
  label: string;
  disabled?: boolean;
}) {
  const color = tone === 'success' ? 'var(--color-success)' : 'var(--color-error)';
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      style={{
        flex: 1,
        minWidth: 56,
        padding: '6px 10px',
        borderRadius: 100,
        fontSize: 11,
        fontWeight: 700,
        fontFamily: 'var(--font-primary)',
        cursor: disabled ? 'not-allowed' : 'pointer',
        background: active ? color : 'transparent',
        color: active ? '#ffffff' : color,
        border: 'none',
        opacity: disabled && !active ? 0.5 : 1,
        transition: 'background 0.15s, color 0.15s',
      }}
    >
      {label}
    </button>
  );
}

function ModeChip({
  mode,
  runLabel,
  startTime,
}: {
  mode: ProductionMode;
  runLabel?: string;
  startTime: string;
}) {
  let label: string;
  switch (mode) {
    case 'run':
      label = runLabel ? `RUN · ${runLabel}` : 'RUN';
      break;
    case 'variable':
      label = 'VAR';
      break;
    case 'increment':
      label = `SEG · ${startTime}`;
      break;
  }
  return (
    <span
      title={`${mode} mode${runLabel ? ` · ${runLabel}` : ''}`}
      style={{
        padding: '3px 8px',
        borderRadius: 5,
        background: 'var(--color-bg-hover)',
        color: 'var(--color-text-secondary)',
        fontSize: 9,
        fontWeight: 700,
        letterSpacing: '0.04em',
        textTransform: 'uppercase',
        fontFamily: 'var(--font-primary)',
        whiteSpace: 'nowrap',
      }}
    >
      {label}
    </span>
  );
}

function Chip({ children }: { children: React.ReactNode }) {
  return (
    <span
      style={{
        padding: '3px 8px',
        borderRadius: 5,
        background: 'var(--color-badge-active-bg)',
        color: 'var(--color-text-secondary)',
        fontSize: 10,
        fontWeight: 700,
        fontFamily: 'var(--font-primary)',
        whiteSpace: 'nowrap',
      }}
    >
      {children}
    </span>
  );
}

// ─── Style helpers ──────────────────────────────────────────────────────────

function cardShell(dense: boolean): React.CSSProperties {
  return {
    borderRadius: 'var(--radius-card)',
    border: '1px solid var(--color-border-subtle)',
    background: '#ffffff',
    fontFamily: 'var(--font-primary)',
    boxShadow: dense ? 'none' : '0 1px 2px rgba(12,20,44,0.04)',
  };
}

function selectStyle(disabled: boolean): React.CSSProperties {
  return {
    height: 38,
    padding: '0 10px',
    borderRadius: 8,
    border: '1px solid var(--color-border)',
    background: disabled ? 'var(--color-bg-hover)' : '#ffffff',
    color: 'var(--color-text-primary)',
    fontFamily: 'var(--font-primary)',
    fontSize: 13,
    fontWeight: 600,
    cursor: disabled ? 'not-allowed' : 'pointer',
  };
}

function chevronBtn(): React.CSSProperties {
  return {
    width: 28,
    height: 28,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 6,
    border: '1px solid var(--color-border-subtle)',
    background: '#ffffff',
    cursor: 'pointer',
    color: 'var(--color-text-muted)',
  };
}

function btn(tone: 'error'): React.CSSProperties {
  return {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    padding: '8px 12px',
    borderRadius: 8,
    fontSize: 11,
    fontWeight: 700,
    fontFamily: 'var(--font-primary)',
    background: tone === 'error' ? 'var(--color-error)' : 'var(--color-accent-active)',
    color: '#ffffff',
    border: `1px solid ${tone === 'error' ? 'var(--color-error)' : 'var(--color-accent-active)'}`,
    cursor: 'pointer',
    whiteSpace: 'nowrap',
    textDecoration: 'none',
  };
}

function formatTime(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  } catch {
    return iso;
  }
}

// Re-export of motion helpers for the page wrapper to wrap cards in
// AnimatePresence transitions when they move between sections.
export { motion as PCRMotion, AnimatePresence as PCRAnimatePresence };
