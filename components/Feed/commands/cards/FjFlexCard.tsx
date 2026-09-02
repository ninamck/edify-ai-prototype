'use client';

import { useMemo, useState } from 'react';
import { Percent } from 'lucide-react';
import CardShell, { FieldRow, PillRow, type CardState } from './CardShell';
import type { FjFlexArgs } from '../farmerjCommands';
import { useActiveSite } from '@/components/ActiveSite/ActiveSiteContext';
import { computeDayPlan, useFjPlanStoreOptional } from '@/components/Production/farmerj/FjPlanStore';
import { FJ_DAY_STRIP_DATES, FJ_DEMO_TODAY, shortDate, weekdayLabel } from '@/components/Production/farmerj/calendar';
import { batchesToNumber } from '@/components/Production/farmerj/cascade';
import { FJ_ALL_SHOPS_ID, getShop } from '@/components/Production/farmerj/shops';

interface Props {
  initialArgs: FjFlexArgs;
  state: CardState;
  onConfirm: (final: { date: string; pct: number }) => void;
  onCancel: () => void;
}

const PCT_OPTIONS = [5, 10, 15, 20, 25, 30, 40, 50];

/**
 * Flex a whole day. The card shows what the flex does before it is
 * applied: batches before and after, and how many lines the manager set
 * by hand that stay where they are.
 */
export default function FjFlexCard({ initialArgs, state, onConfirm, onCancel }: Props) {
  const { productionSiteId } = useActiveSite();
  const store = useFjPlanStoreOptional();
  const shopId = productionSiteId && productionSiteId !== FJ_ALL_SHOPS_ID ? productionSiteId : 'fj-marylebone';
  const shop = getShop(shopId);

  const [date, setDate] = useState<string | undefined>(initialArgs.date);
  const [direction, setDirection] = useState<'down' | 'up'>((initialArgs.pct ?? -1) < 0 ? 'down' : 'up');
  const [magnitude, setMagnitude] = useState<number | undefined>(initialArgs.pct !== undefined ? Math.abs(initialArgs.pct) : undefined);
  const pct = magnitude !== undefined ? (direction === 'down' ? -magnitude : magnitude) : undefined;

  const livePreview = useMemo(() => {
    if (!store || !date || pct === undefined) return null;
    const record = store.get(shopId, date);
    const before = computeDayPlan(shopId, date, record);
    const after = computeDayPlan(shopId, date, { ...record, flexPct: pct });
    const sum = (p: typeof before) => p.plans.reduce((n, x) => n + batchesToNumber(x.batches), 0);
    return {
      batchesBefore: sum(before),
      batchesAfter: sum(after),
      handSet: before.overriddenCount,
      moved: after.plans.filter((p, i) => batchesToNumber(p.batches) !== batchesToNumber(before.plans[i].batches)).length,
      approved: Boolean(record.approvedAtISO),
    };
  }, [store, shopId, date, pct]);
  // Once applied, the record already carries the flex, so the live
  // preview would read "70.5 → 70.5". Keep the preview as confirmed.
  const [applied, setApplied] = useState<typeof livePreview>(null);
  const preview = state === 'pending' ? livePreview : applied ?? livePreview;

  const dayOptions = FJ_DAY_STRIP_DATES.filter(d => d >= FJ_DEMO_TODAY).slice(0, 8).map(d => ({
    value: d,
    label: d === FJ_DEMO_TODAY ? 'Today' : `${weekdayLabel(d)} ${shortDate(d).split(' ')[0]}`,
  }));

  const canConfirm = !!date && pct !== undefined && pct !== 0;

  return (
    <CardShell
      icon={Percent}
      title="Flex the day"
      subtitle={date ? `${date === FJ_DEMO_TODAY ? 'Today, ' : ''}${shortDate(date)} · ${shop?.name ?? shopId}` : shop?.name ?? shopId}
      state={state}
      confirmLabel={pct !== undefined ? `${pct > 0 ? 'Raise' : 'Drop'} it ${Math.abs(pct)}%` : 'Apply'}
      confirmDisabled={!canConfirm}
      onConfirm={canConfirm ? () => { setApplied(livePreview); onConfirm({ date: date!, pct: pct! }); } : undefined}
      onCancel={onCancel}
    >
      {!date && (
        <FieldRow label="Which day">
          <PillRow options={dayOptions} selected={date} onSelect={setDate} disabled={state !== 'pending'} small />
        </FieldRow>
      )}
      <FieldRow label="Direction">
        <PillRow
          options={[{ value: 'down', label: 'Down' }, { value: 'up', label: 'Up' }]}
          selected={direction}
          onSelect={v => setDirection(v as 'down' | 'up')}
          disabled={state !== 'pending'}
          small
        />
      </FieldRow>
      <FieldRow label="By">
        <PillRow
          options={PCT_OPTIONS.map(p => ({ value: String(p), label: `${p}%` }))}
          selected={magnitude !== undefined ? String(magnitude) : undefined}
          onSelect={v => setMagnitude(Number(v))}
          disabled={state !== 'pending'}
          small
        />
      </FieldRow>

      {preview && (
        <div style={{ marginTop: 12, paddingTop: 10, borderTop: '1px dashed var(--color-border-subtle, rgba(0,28,53,0.12))', display: 'flex', flexDirection: 'column', gap: 6, fontSize: 12.5 }}>
          <Line label="Batches" value={`${fmt(preview.batchesBefore)} → ${fmt(preview.batchesAfter)}`} bold />
          <Line label="Lines that move" value={String(preview.moved)} />
          <Line label="Set by hand, unchanged" value={String(preview.handSet)} />
          {preview.approved && <Line label="Day" value="Approved. Stays approved with the new numbers." />}
        </div>
      )}
    </CardShell>
  );
}

function fmt(n: number): string {
  return n % 1 === 0 ? String(n) : n.toFixed(1);
}

function Line({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
      <span style={{ color: 'var(--color-text-muted)', fontWeight: 500 }}>{label}</span>
      <span style={{ color: 'var(--color-text-primary)', fontWeight: bold ? 700 : 600, fontVariantNumeric: 'tabular-nums', textAlign: 'right' }}>{value}</span>
    </div>
  );
}
