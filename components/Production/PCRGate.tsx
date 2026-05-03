'use client';

import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, X, ClipboardCheck, Thermometer, Tag, AlertCircle } from 'lucide-react';
import StatusPill from './StatusPill';
import { useRole } from './RoleContext';
import {
  PRET_PLAN,
  getBench,
  getProductionItem,
  getRecipe,
  type PCRType,
} from './fixtures';

export type PCRSubmission = {
  batchId: string;
  type: PCRType;
  qualityCheck: boolean;
  labelCheck: boolean | null;
  temperatureCheck: boolean | null;
  notes?: string;
  signedBy: string;
  signedAt: string;
};

type Props = {
  batchId: string | null;
  /** Suggested type — inferred from the batch if not provided. */
  type?: PCRType;
  /** Signed-in user's display name (would come from session). */
  currentUser?: string;
  onClose: () => void;
  onSubmit: (pcr: PCRSubmission) => void;
};

export default function PCRGate({
  batchId,
  type: typeOverride,
  currentUser,
  onClose,
  onSubmit,
}: Props) {
  const { user, can } = useRole();
  const canSign = can('pcr.sign');
  const signerName = currentUser ?? `${user.name.split('—')[0].trim()} (${user.role})`;
  const [qualityCheck, setQualityCheck] = useState<boolean | null>(null);
  const [labelCheck, setLabelCheck] = useState<boolean | null>(null);
  const [temperatureCheck, setTemperatureCheck] = useState<boolean | null>(null);
  const [notes, setNotes] = useState('');

  useEffect(() => {
    setQualityCheck(null);
    setLabelCheck(null);
    setTemperatureCheck(null);
    setNotes('');
  }, [batchId]);

  useEffect(() => {
    if (!batchId) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [batchId, onClose]);

  const batch = useMemo(
    () => (batchId ? PRET_PLAN.batches.find(b => b.id === batchId) : null),
    [batchId],
  );
  const item = batch ? getProductionItem(batch.productionItemId) : null;
  const recipe = item ? getRecipe(item.recipeId) : null;
  const bench = batch ? getBench(batch.benchId) : null;

  const inferredType: PCRType =
    typeOverride ??
    (batch && !batch.plannedInstanceId
      ? 'on-demand'
      : bench?.capabilities.includes('prep') && !bench?.capabilities.includes('oven')
      ? 'preparation'
      : 'batch');

  const requiresLabel = inferredType === 'batch' || inferredType === 'on-demand';
  const requiresTemp =
    inferredType === 'preparation' ||
    recipe?.category === 'Sandwich' ||
    recipe?.category === 'Salad';

  const allAnswered =
    qualityCheck !== null &&
    (!requiresLabel || labelCheck !== null) &&
    (!requiresTemp || temperatureCheck !== null);

  if (typeof document === 'undefined') return null;

  return createPortal(
    <AnimatePresence>
      {batchId && batch && recipe && (
        <>
          <motion.div
            key="pcr-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            onClick={onClose}
            style={{ position: 'fixed', inset: 0, background: 'rgba(12,20,44,0.45)', zIndex: 1300 }}
          />
          <motion.div
            key="pcr-card"
            initial={{ y: 24, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 24, opacity: 0 }}
            transition={{ type: 'spring', damping: 24, stiffness: 300 }}
            style={{
              position: 'fixed',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              width: 'min(520px, calc(100vw - 32px))',
              maxHeight: 'calc(100vh - 48px)',
              overflow: 'hidden',
              borderRadius: 'var(--radius-card)',
              background: '#ffffff',
              boxShadow: '0 24px 64px rgba(12,20,44,0.28)',
              zIndex: 1301,
              fontFamily: 'var(--font-primary)',
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            {/* Header */}
            <div
              style={{
                padding: '16px 20px 12px',
                borderBottom: '1px solid var(--color-border-subtle)',
                display: 'flex',
                flexDirection: 'column',
                gap: 6,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <ClipboardCheck size={18} color="var(--color-accent-active)" />
                  <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                    PCR · {pcrTypeLabel(inferredType)}
                  </span>
                </div>
                <button
                  onClick={onClose}
                  aria-label="Close"
                  style={{
                    width: 32,
                    height: 32,
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderRadius: 8,
                    border: '1px solid var(--color-border-subtle)',
                    background: 'transparent',
                    cursor: 'pointer',
                    color: 'var(--color-text-secondary)',
                  }}
                >
                  <X size={16} />
                </button>
              </div>
              <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: 'var(--color-text-primary)' }}>{recipe.name}</h2>
              <div style={{ display: 'flex', gap: 12, fontSize: 11, color: 'var(--color-text-muted)' }}>
                <span>
                  {bench?.name} · {batch.startTime}–{batch.endTime}
                </span>
                <span style={{ fontVariantNumeric: 'tabular-nums' }}>qty {batch.actualQty}</span>
              </div>
            </div>

            {/* Body */}
            <div style={{ flex: 1, overflow: 'auto', padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 12 }}>
              <CheckRow
                icon={<Check size={14} />}
                title="Quality check"
                subtitle="Colour, texture, appearance."
                value={qualityCheck}
                onChange={setQualityCheck}
              />
              {requiresLabel && (
                <CheckRow
                  icon={<Tag size={14} />}
                  title="Label check"
                  subtitle="Best-before, allergen, SKU label printed and affixed."
                  value={labelCheck}
                  onChange={setLabelCheck}
                />
              )}
              {requiresTemp && (
                <CheckRow
                  icon={<Thermometer size={14} />}
                  title="Temperature check"
                  subtitle="Core/surface within range for this recipe."
                  value={temperatureCheck}
                  onChange={setTemperatureCheck}
                />
              )}

              <label
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 6,
                  padding: '10px 12px',
                  borderRadius: 'var(--radius-card)',
                  border: '1px solid var(--color-border-subtle)',
                }}
              >
                <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Notes (optional)
                </span>
                <textarea
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  placeholder={
                    qualityCheck === false
                      ? 'Describe the defect so Quinn can suggest a remake…'
                      : 'Anything worth flagging?'
                  }
                  rows={2}
                  style={{
                    resize: 'vertical',
                    border: 'none',
                    outline: 'none',
                    background: 'transparent',
                    fontFamily: 'var(--font-primary)',
                    fontSize: 13,
                    color: 'var(--color-text-primary)',
                    padding: 0,
                  }}
                />
              </label>

              {qualityCheck === false && (
                <div
                  style={{
                    padding: '10px 12px',
                    border: '1px solid var(--color-error-border)',
                    borderRadius: 'var(--radius-card)',
                    background: 'var(--color-error-light)',
                    display: 'flex',
                    gap: 8,
                    alignItems: 'flex-start',
                  }}
                >
                  <AlertCircle size={14} color="var(--color-error)" style={{ marginTop: 2, flexShrink: 0 }} />
                  <p style={{ margin: 0, fontSize: 12, color: 'var(--color-text-primary)', lineHeight: 1.4 }}>
                    Failing quality routes the batch to <strong>waste</strong> and queues a remake for Quinn&rsquo;s review.
                  </p>
                </div>
              )}
            </div>

            {/* Footer */}
            <div
              style={{
                flexShrink: 0,
                padding: '12px 20px',
                borderTop: '1px solid var(--color-border-subtle)',
                background: 'var(--color-bg-hover)',
                display: 'flex',
                alignItems: 'center',
                gap: 10,
              }}
            >
              <StatusPill
                tone={canSign ? 'neutral' : 'warning'}
                label={canSign ? `Signing as ${signerName.split(' ')[0]}` : 'Manager sign-off required'}
                size="xs"
              />
              <div style={{ flex: 1 }} />
              <button type="button" onClick={onClose} style={btn('secondary')}>
                Cancel
              </button>
              <button
                type="button"
                disabled={!allAnswered || !canSign}
                onClick={() =>
                  onSubmit({
                    batchId,
                    type: inferredType,
                    qualityCheck: qualityCheck!,
                    labelCheck: requiresLabel ? labelCheck : null,
                    temperatureCheck: requiresTemp ? temperatureCheck : null,
                    notes: notes.trim() || undefined,
                    signedBy: signerName,
                    signedAt: new Date().toISOString(),
                  })
                }
                style={{
                  ...btn('primary'),
                  opacity: allAnswered && canSign ? 1 : 0.5,
                  cursor: allAnswered && canSign ? 'pointer' : 'not-allowed',
                }}
              >
                Sign &amp; release
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>,
    document.body,
  );
}

// ─── Subcomponents ────────────────────────────────────────────────────────────

function CheckRow({
  icon,
  title,
  subtitle,
  value,
  onChange,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  value: boolean | null;
  onChange: (v: boolean) => void;
}) {
  return (
    <div
      style={{
        padding: '10px 12px',
        borderRadius: 'var(--radius-card)',
        border: `1px solid ${value === null ? 'var(--color-border-subtle)' : value ? 'var(--color-success-border)' : 'var(--color-error-border)'}`,
        background: value === null ? '#ffffff' : value ? 'var(--color-success-light)' : 'var(--color-error-light)',
        display: 'flex',
        alignItems: 'center',
        gap: 12,
      }}
    >
      <span
        style={{
          width: 28,
          height: 28,
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: '50%',
          background: value === null ? 'var(--color-bg-hover)' : value ? 'var(--color-success)' : 'var(--color-error)',
          color: value === null ? 'var(--color-text-muted)' : '#ffffff',
          flexShrink: 0,
        }}
      >
        {icon}
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text-primary)' }}>{title}</div>
        <div style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>{subtitle}</div>
      </div>
      <div style={{ display: 'flex', gap: 4 }}>
        <ToggleBtn
          active={value === true}
          tone="success"
          onClick={() => onChange(true)}
          label="Pass"
        />
        <ToggleBtn
          active={value === false}
          tone="error"
          onClick={() => onChange(false)}
          label="Fail"
        />
      </div>
    </div>
  );
}

function ToggleBtn({
  active,
  tone,
  onClick,
  label,
}: {
  active: boolean;
  tone: 'success' | 'error';
  onClick: () => void;
  label: string;
}) {
  const toneColor = tone === 'success' ? 'var(--color-success)' : 'var(--color-error)';
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        minWidth: 48,
        padding: '6px 10px',
        borderRadius: 8,
        fontSize: 11,
        fontWeight: 700,
        fontFamily: 'var(--font-primary)',
        cursor: 'pointer',
        background: active ? toneColor : '#ffffff',
        color: active ? '#ffffff' : toneColor,
        border: `1px solid ${toneColor}`,
      }}
    >
      {label}
    </button>
  );
}

function pcrTypeLabel(t: PCRType): string {
  switch (t) {
    case 'batch':
      return 'Batch review';
    case 'on-demand':
      return 'On-demand';
    case 'preparation':
      return 'Prep stage';
    case 'repackaging':
      return 'Repack';
  }
}

function btn(kind: 'primary' | 'secondary'): React.CSSProperties {
  return {
    padding: '10px 14px',
    borderRadius: 8,
    fontSize: 12,
    fontWeight: 700,
    fontFamily: 'var(--font-primary)',
    background: kind === 'primary' ? 'var(--color-accent-active)' : '#ffffff',
    color: kind === 'primary' ? 'var(--color-text-on-active)' : 'var(--color-text-primary)',
    border: `1px solid ${kind === 'primary' ? 'var(--color-accent-active)' : 'var(--color-border)'}`,
    cursor: 'pointer',
    minHeight: 40,
  };
}
