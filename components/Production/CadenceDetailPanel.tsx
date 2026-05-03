'use client';

import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Minus, Plus } from 'lucide-react';
import EdifyMark from '@/components/EdifyMark/EdifyMark';
import StatusPill from './StatusPill';
import { SelectionTagChip, AvailabilityWindows } from './RangeTierChips';
import {
  PRET_PLAN,
  getProductionItem,
  getRecipe,
  effectiveBatchRules,
  getBench,
} from './fixtures';
import { hhmmToMinutes } from './time';

type Props = {
  productionItemId: string | null;
  date: string;
  onClose: () => void;
};

export default function CadenceDetailPanel({ productionItemId, date, onClose }: Props) {
  useEffect(() => {
    if (!productionItemId) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [productionItemId, onClose]);

  const baseData = useMemo(() => {
    if (!productionItemId) return null;
    const item = getProductionItem(productionItemId);
    if (!item || item.mode !== 'increment' || !item.cadence) return null;
    const recipe = getRecipe(item.recipeId);
    if (!recipe) return null;
    const cadencePIs = PRET_PLAN.plannedInstances.filter(
      pi => pi.productionItemId === item.id && pi.date === date,
    );
    const bench = cadencePIs[0] ? getBench(cadencePIs[0].benchId) : undefined;
    const eff = effectiveBatchRules(recipe.batchRules, bench?.batchRules);
    return { item, recipe, cadencePIs, bench, eff };
  }, [productionItemId, date]);

  // Local ephemeral overrides — demo only, no persistence
  const [overrideInterval, setOverrideInterval] = useState<number | null>(null);

  useEffect(() => {
    setOverrideInterval(null);
  }, [productionItemId]);

  if (typeof document === 'undefined') return null;

  const data = baseData;
  const activeInterval = overrideInterval ?? data?.item.cadence?.intervalMinutes ?? 0;
  const overridden = data && !data.item.cadence!.quinnProposed;
  const locallyOverridden = overrideInterval !== null;

  return createPortal(
    <AnimatePresence>
      {productionItemId && data && (
        <>
          <motion.div
            key="cad-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            onClick={onClose}
            style={{ position: 'fixed', inset: 0, background: 'rgba(12,20,44,0.3)', zIndex: 1200 }}
          />
          <motion.aside
            key="cad-drawer"
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 320 }}
            style={{
              position: 'fixed',
              right: 0,
              top: 0,
              bottom: 0,
              width: 'min(440px, 100vw)',
              zIndex: 1201,
              display: 'flex',
              flexDirection: 'column',
              background: '#ffffff',
              boxShadow: '-8px 0 32px rgba(12,20,44,0.18)',
              fontFamily: 'var(--font-primary)',
            }}
          >
            <Header recipeName={data.recipe.name} overridden={!!overridden} onClose={onClose} />
            <div style={{ flex: 1, overflow: 'auto', padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 18 }}>
              <CadenceHero
                intervalMinutes={activeInterval}
                startTime={data.item.cadence!.startTime}
                endTime={data.item.cadence!.endTime}
                locallyOverridden={locallyOverridden}
                originalInterval={data.item.cadence!.intervalMinutes}
                onAdjust={(delta) => {
                  setOverrideInterval(prev => {
                    const current = prev ?? data.item.cadence!.intervalMinutes;
                    const next = Math.max(5, current + delta);
                    return next === data.item.cadence!.intervalMinutes ? null : next;
                  });
                }}
                onReset={() => setOverrideInterval(null)}
              />

              <QuinnProvenance
                quinnProposed={!!data.item.cadence!.quinnProposed}
                overridden={!!overridden}
              />

              {data.recipe.shelfLifeMinutes != null && (
                <ShelfLifeCard shelfLifeMinutes={data.recipe.shelfLifeMinutes} intervalMinutes={activeInterval} />
              )}

              <BatchSizeLine qty={data.item.batchSize ?? data.eff.min} unit={data.recipe.id === 'prec-brewed-coffee' ? 'urns' : 'units'} eff={data.eff} />

              {/* Availability + tags */}
              <section>
                <SectionHeader title="Sellable window + tags" />
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 8,
                    padding: '10px 12px',
                    border: '1px solid var(--color-border-subtle)',
                    borderRadius: 'var(--radius-card)',
                  }}
                >
                  <AvailabilityWindows skuId={data.item.skuId} siteId={data.item.siteId} date={date} />
                  {data.recipe.selectionTags.length > 0 && (
                    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                      {data.recipe.selectionTags.map(t => (
                        <SelectionTagChip key={t} tag={t} size="xs" />
                      ))}
                    </div>
                  )}
                </div>
              </section>

              {/* Drops so far today */}
              <TodayDrops count={data.cadencePIs.length} totalWindowMinutes={hhmmToMinutes(data.item.cadence!.endTime) - hhmmToMinutes(data.item.cadence!.startTime)} intervalMinutes={activeInterval} />
            </div>
            <Footer
              locallyOverridden={locallyOverridden}
              onKeepQuinn={() => {
                setOverrideInterval(null);
                onClose();
              }}
              onSaveOverride={() => {
                console.log('Override saved (demo)', { productionItemId, intervalMinutes: activeInterval });
                onClose();
              }}
            />
          </motion.aside>
        </>
      )}
    </AnimatePresence>,
    document.body,
  );
}

// ─── Subcomponents ────────────────────────────────────────────────────────────

function Header({ recipeName, overridden, onClose }: { recipeName: string; overridden: boolean; onClose: () => void }) {
  return (
    <header
      style={{
        flexShrink: 0,
        padding: '14px 20px 12px',
        borderBottom: '1px solid var(--color-border-subtle)',
        background: '#ffffff',
        display: 'flex',
        flexDirection: 'column',
        gap: 6,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <StatusPill tone="brand" label="Increment" size="xs" />
          {overridden && <StatusPill tone="warning" label="Hub override" size="xs" />}
        </div>
        <button
          onClick={onClose}
          aria-label="Close"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 32,
            height: 32,
            borderRadius: 8,
            background: 'transparent',
            border: '1px solid var(--color-border-subtle)',
            cursor: 'pointer',
            color: 'var(--color-text-secondary)',
          }}
        >
          <X size={16} />
        </button>
      </div>
      <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: 'var(--color-text-primary)' }}>
        {recipeName} cadence
      </h2>
    </header>
  );
}

function CadenceHero({
  intervalMinutes,
  startTime,
  endTime,
  locallyOverridden,
  originalInterval,
  onAdjust,
  onReset,
}: {
  intervalMinutes: number;
  startTime: string;
  endTime: string;
  locallyOverridden: boolean;
  originalInterval: number;
  onAdjust: (delta: number) => void;
  onReset: () => void;
}) {
  const totalMin = hhmmToMinutes(endTime) - hhmmToMinutes(startTime);
  const drops = Math.floor(totalMin / intervalMinutes) + 1;
  return (
    <div
      style={{
        padding: '14px 16px',
        border: '1px solid var(--color-border-subtle)',
        borderRadius: 'var(--radius-card)',
        background: '#ffffff',
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
        <span style={{ fontSize: 48, fontWeight: 700, fontVariantNumeric: 'tabular-nums', lineHeight: 1 }}>{intervalMinutes}</span>
        <span style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>min between drops</span>
      </div>
      <div style={{ display: 'flex', gap: 12, alignItems: 'center', fontSize: 12, color: 'var(--color-text-secondary)' }}>
        <span style={{ fontVariantNumeric: 'tabular-nums' }}>
          {startTime}–{endTime}
        </span>
        <span>·</span>
        <span style={{ fontVariantNumeric: 'tabular-nums' }}>
          {drops} {drops === 1 ? 'drop' : 'drops'}
        </span>
        {locallyOverridden && (
          <>
            <span>·</span>
            <span style={{ color: 'var(--color-warning)', fontWeight: 600 }}>was {originalInterval}min</span>
          </>
        )}
      </div>
      {/* Stepper */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <button
          type="button"
          onClick={() => onAdjust(-5)}
          style={stepperBtn()}
          aria-label="Decrease interval by 5 minutes"
        >
          <Minus size={14} /> 5
        </button>
        <button
          type="button"
          onClick={() => onAdjust(5)}
          style={stepperBtn()}
          aria-label="Increase interval by 5 minutes"
        >
          <Plus size={14} /> 5
        </button>
        <div style={{ flex: 1 }} />
        {locallyOverridden && (
          <button
            type="button"
            onClick={onReset}
            style={{
              fontSize: 11,
              fontWeight: 600,
              color: 'var(--color-text-secondary)',
              background: 'transparent',
              border: 'none',
              padding: '6px 4px',
              cursor: 'pointer',
              fontFamily: 'var(--font-primary)',
            }}
          >
            Reset to Quinn
          </button>
        )}
      </div>
    </div>
  );
}

function QuinnProvenance({ quinnProposed, overridden }: { quinnProposed: boolean; overridden: boolean }) {
  return (
    <div
      style={{
        padding: '10px 12px',
        borderRadius: 'var(--radius-card)',
        background: overridden ? 'var(--color-warning-light)' : 'var(--color-info-light)',
        border: `1px solid ${overridden ? 'var(--color-warning-border)' : 'var(--color-info)'}`,
        display: 'flex',
        alignItems: 'flex-start',
        gap: 10,
      }}
    >
      <EdifyMark size={16} color={overridden ? 'var(--color-warning)' : 'var(--color-info)'} style={{ flexShrink: 0, marginTop: 1 }} />
      <p style={{ margin: 0, fontSize: 12, color: 'var(--color-text-primary)', lineHeight: 1.5 }}>
        {overridden
          ? 'This cadence was overridden at the hub. Quinn is no longer maintaining it against forecast.'
          : quinnProposed
          ? 'Quinn proposed this cadence based on demand and shelf life. Managers can override.'
          : 'Cadence is fixed (no Quinn proposal on record).'}
      </p>
    </div>
  );
}

function ShelfLifeCard({ shelfLifeMinutes, intervalMinutes }: { shelfLifeMinutes: number; intervalMinutes: number }) {
  const ratio = shelfLifeMinutes / intervalMinutes;
  const safeMargin = ratio >= 2;
  return (
    <section>
      <SectionHeader title="Shelf life margin" />
      <div
        style={{
          padding: '10px 12px',
          borderRadius: 'var(--radius-card)',
          border: `1px solid ${safeMargin ? 'var(--color-success-border)' : 'var(--color-warning-border)'}`,
          background: safeMargin ? 'var(--color-success-light)' : 'var(--color-warning-light)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <div>
          <div style={{ fontSize: 11, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 700 }}>
            Shelf life
          </div>
          <div style={{ fontSize: 16, fontWeight: 700, fontVariantNumeric: 'tabular-nums', color: 'var(--color-text-primary)' }}>
            {shelfLifeMinutes} min
          </div>
        </div>
        <div style={{ fontSize: 11, color: 'var(--color-text-secondary)', textAlign: 'right', maxWidth: 200 }}>
          {safeMargin
            ? `New drop every ${intervalMinutes}min keeps product well inside shelf life (${ratio.toFixed(1)}× margin).`
            : `Cadence is tight against shelf life (${ratio.toFixed(1)}× margin). Waste risk ↑`}
        </div>
      </div>
    </section>
  );
}

function BatchSizeLine({ qty, unit, eff }: { qty: number; unit: string; eff: ReturnType<typeof effectiveBatchRules> }) {
  return (
    <section>
      <SectionHeader title="Drop size" />
      <div
        style={{
          padding: '10px 12px',
          borderRadius: 'var(--radius-card)',
          border: '1px solid var(--color-border-subtle)',
          background: '#ffffff',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <span style={{ fontSize: 20, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
          {qty} {unit}
        </span>
        <span style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>
          per drop · effective {eff.min}–{Number.isFinite(eff.max) ? eff.max : '∞'} · ×{eff.multipleOf}
        </span>
      </div>
    </section>
  );
}

function TodayDrops({ count, totalWindowMinutes, intervalMinutes }: { count: number; totalWindowMinutes: number; intervalMinutes: number }) {
  const expected = Math.max(1, Math.floor(totalWindowMinutes / intervalMinutes) + 1);
  const pct = Math.min(100, (count / expected) * 100);
  return (
    <section>
      <SectionHeader title="Today's drops" />
      <div
        style={{
          padding: '10px 12px',
          border: '1px solid var(--color-border-subtle)',
          borderRadius: 'var(--radius-card)',
          background: '#ffffff',
          display: 'flex',
          flexDirection: 'column',
          gap: 6,
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
          <span style={{ color: 'var(--color-text-secondary)' }}>Scheduled</span>
          <span style={{ fontVariantNumeric: 'tabular-nums', fontWeight: 700 }}>
            {count} / {expected}
          </span>
        </div>
        <div style={{ height: 6, background: 'var(--color-bg-hover)', borderRadius: 3, overflow: 'hidden' }}>
          <div style={{ width: `${pct}%`, height: '100%', background: 'var(--color-info)' }} />
        </div>
      </div>
    </section>
  );
}

function Footer({
  locallyOverridden,
  onKeepQuinn,
  onSaveOverride,
}: {
  locallyOverridden: boolean;
  onKeepQuinn: () => void;
  onSaveOverride: () => void;
}) {
  return (
    <div
      style={{
        flexShrink: 0,
        padding: '10px 16px',
        borderTop: '1px solid var(--color-border-subtle)',
        background: 'var(--color-bg-hover)',
        display: 'flex',
        gap: 8,
      }}
    >
      <button type="button" onClick={onKeepQuinn} style={{ ...actionBtn('secondary'), flex: 1 }}>
        {locallyOverridden ? 'Cancel' : 'Keep Quinn'}
      </button>
      <button
        type="button"
        onClick={onSaveOverride}
        disabled={!locallyOverridden}
        style={{ ...actionBtn('primary'), flex: 1, opacity: locallyOverridden ? 1 : 0.5, cursor: locallyOverridden ? 'pointer' : 'not-allowed' }}
      >
        Save override
      </button>
    </div>
  );
}

function SectionHeader({ title }: { title: string }) {
  return (
    <span
      style={{
        display: 'block',
        fontSize: 11,
        fontWeight: 700,
        color: 'var(--color-text-muted)',
        textTransform: 'uppercase',
        letterSpacing: '0.05em',
        marginBottom: 6,
      }}
    >
      {title}
    </span>
  );
}

function stepperBtn(): React.CSSProperties {
  return {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 4,
    padding: '6px 10px',
    borderRadius: 8,
    background: '#ffffff',
    border: '1px solid var(--color-border)',
    cursor: 'pointer',
    fontSize: 12,
    fontWeight: 600,
    fontFamily: 'var(--font-primary)',
    color: 'var(--color-text-primary)',
  };
}

function actionBtn(kind: 'primary' | 'secondary'): React.CSSProperties {
  return {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '10px 14px',
    borderRadius: 8,
    fontSize: 12,
    fontWeight: 700,
    fontFamily: 'var(--font-primary)',
    background: kind === 'primary' ? 'var(--color-accent-active)' : '#ffffff',
    color: kind === 'primary' ? 'var(--color-text-on-active)' : 'var(--color-text-primary)',
    border: `1px solid ${kind === 'primary' ? 'var(--color-accent-active)' : 'var(--color-border)'}`,
    minHeight: 40,
  };
}
