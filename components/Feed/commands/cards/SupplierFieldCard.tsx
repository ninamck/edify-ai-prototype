'use client';

import { useMemo, useState } from 'react';
import { Truck, ArrowRight } from 'lucide-react';
import { findSupplier, useSuppliers } from '@/components/Suppliers/store';
import type { Supplier, DayOfWeek } from '@/components/Suppliers/fixtures';
import CardShell, { FieldRow, PillRow, type CardState } from './CardShell';
import type { SupplierArgs, SupplierField } from '../parsers';

interface SupplierFieldCardProps {
  initialArgs: SupplierArgs;
  state: CardState;
  onConfirm: (final: {
    supplierId: string;
    supplierName: string;
    field: SupplierField;
    valueRaw: string;
    valueNormalised: string | number | DayOfWeek[];
    previousValue: string | number | DayOfWeek[] | undefined;
  }) => void;
  onCancel: () => void;
}

const FIELD_LABELS: Record<SupplierField, string> = {
  cutOffTime: 'Order cut-off',
  leadTimeDays: 'Lead time',
  minimumOrderValue: 'Minimum order',
  deliveryDays: 'Delivery days',
  email: 'Email',
  phone: 'Phone',
};

const ALL_DAYS: DayOfWeek[] = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

function formatValue(field: SupplierField, supplier: Supplier | undefined): string {
  if (!supplier) return '—';
  switch (field) {
    case 'cutOffTime':         return supplier.cutOffTime ?? '—';
    case 'leadTimeDays':       return supplier.leadTimeDays !== undefined ? `${supplier.leadTimeDays} day${supplier.leadTimeDays === 1 ? '' : 's'}` : '—';
    case 'minimumOrderValue':  return supplier.minimumOrderValue !== undefined ? `£${supplier.minimumOrderValue}` : '—';
    case 'deliveryDays':       return supplier.deliveryDays?.join(', ') ?? '—';
    case 'email':              return supplier.email ?? '—';
    case 'phone':              return supplier.phone ?? '—';
  }
}

function previousValueOf(field: SupplierField, supplier: Supplier | undefined): string | number | DayOfWeek[] | undefined {
  if (!supplier) return undefined;
  switch (field) {
    case 'cutOffTime':         return supplier.cutOffTime;
    case 'leadTimeDays':       return supplier.leadTimeDays;
    case 'minimumOrderValue':  return supplier.minimumOrderValue;
    case 'deliveryDays':       return supplier.deliveryDays;
    case 'email':              return supplier.email;
    case 'phone':              return supplier.phone;
  }
}

export default function SupplierFieldCard({ initialArgs, state, onConfirm, onCancel }: SupplierFieldCardProps) {
  useSuppliers();
  const supplier = useMemo(
    () => (initialArgs.supplierId ? findSupplier(initialArgs.supplierId) : undefined),
    [initialArgs.supplierId],
  );

  const [field, setField] = useState<SupplierField>(initialArgs.field ?? 'cutOffTime');
  const [text, setText] = useState<string>(initialArgs.value ?? '');
  const [days, setDays] = useState<Set<DayOfWeek>>(() => {
    if (initialArgs.field === 'deliveryDays' && initialArgs.value) {
      return new Set(initialArgs.value.split(',').map((d) => d.trim() as DayOfWeek).filter((d) => ALL_DAYS.includes(d)));
    }
    return new Set(supplier?.deliveryDays ?? []);
  });

  const previousValue = previousValueOf(field, supplier);

  function commit() {
    if (!supplier) return;
    let valueNormalised: string | number | DayOfWeek[];
    if (field === 'deliveryDays') {
      valueNormalised = ALL_DAYS.filter((d) => days.has(d));
    } else if (field === 'leadTimeDays' || field === 'minimumOrderValue') {
      const n = Number(text);
      if (Number.isNaN(n)) return;
      valueNormalised = n;
    } else {
      valueNormalised = text.trim();
    }
    onConfirm({
      supplierId: supplier.id,
      supplierName: supplier.shortCode ?? supplier.name,
      field,
      valueRaw: text || (Array.from(days).join(', ')),
      valueNormalised,
      previousValue,
    });
  }

  const canConfirm = !!supplier && (
    (field === 'deliveryDays' && days.size > 0) ||
    (field !== 'deliveryDays' && text.trim().length > 0)
  );

  return (
    <CardShell
      icon={Truck}
      title={`Supplier — ${supplier?.shortCode ?? supplier?.name ?? initialArgs.supplierName ?? '…'}`}
      subtitle={supplier ? `Update ${FIELD_LABELS[field].toLowerCase()}` : 'Pick a supplier'}
      state={state}
      confirmLabel="Save change"
      confirmDisabled={!canConfirm}
      onConfirm={canConfirm ? commit : undefined}
      onCancel={onCancel}
    >
      <div style={{ marginBottom: '12px' }}>
        <div
          style={{
            fontSize: '11px',
            fontWeight: 700,
            letterSpacing: '0.04em',
            textTransform: 'uppercase',
            color: 'var(--color-text-secondary)',
            marginBottom: '6px',
          }}
        >
          Field
        </div>
        <PillRow
          options={(Object.keys(FIELD_LABELS) as SupplierField[]).map((f) => ({ value: f, label: FIELD_LABELS[f] }))}
          selected={field}
          onSelect={(f) => {
            setField(f as SupplierField);
            setText('');
          }}
          disabled={state !== 'pending'}
          small
        />
      </div>

      <FieldRow label="Current">{formatValue(field, supplier)}</FieldRow>

      <div style={{ marginTop: '10px' }}>
        <div
          style={{
            fontSize: '11px',
            fontWeight: 700,
            letterSpacing: '0.04em',
            textTransform: 'uppercase',
            color: 'var(--color-text-secondary)',
            marginBottom: '6px',
          }}
        >
          New value
        </div>
        {field === 'deliveryDays' ? (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
            {ALL_DAYS.map((d) => {
              const active = days.has(d);
              return (
                <button
                  key={d}
                  type="button"
                  disabled={state !== 'pending'}
                  onClick={() => {
                    setDays((prev) => {
                      const next = new Set(prev);
                      if (next.has(d)) next.delete(d);
                      else next.add(d);
                      return next;
                    });
                  }}
                  style={{
                    padding: '4px 10px',
                    borderRadius: '100px',
                    border: active
                      ? '1.5px solid var(--color-accent-active, #001C35)'
                      : '1.5px solid var(--color-border, rgba(0,28,53,0.18))',
                    background: active ? 'var(--color-accent-active, #001C35)' : '#fff',
                    color: active ? '#fff' : 'var(--color-text-secondary)',
                    fontSize: '11px',
                    fontWeight: 600,
                    fontFamily: 'var(--font-primary)',
                    cursor: 'pointer',
                  }}
                >
                  {d}
                </button>
              );
            })}
          </div>
        ) : (
          <input
            type={field === 'leadTimeDays' || field === 'minimumOrderValue' ? 'number' : 'text'}
            inputMode={field === 'cutOffTime' ? 'numeric' : undefined}
            value={text}
            disabled={state !== 'pending'}
            onChange={(e) => setText(e.target.value)}
            placeholder={
              field === 'cutOffTime'
                ? '14:00'
                : field === 'leadTimeDays'
                  ? 'days'
                  : field === 'minimumOrderValue'
                    ? '£ amount'
                    : field === 'email'
                      ? 'orders@…'
                      : '+44…'
            }
            style={{
              padding: '8px 12px',
              borderRadius: '10px',
              border: '1.5px solid var(--color-border, rgba(0,28,53,0.18))',
              fontSize: '13px',
              fontWeight: 600,
              fontFamily: 'var(--font-primary)',
              width: '160px',
            }}
          />
        )}
        {previousValue !== undefined && (
          <div style={{ marginTop: '8px', fontSize: '12px', fontWeight: 500, color: 'var(--color-text-muted)' }}>
            <ArrowRight size={11} style={{ verticalAlign: '-1px' }} /> was {formatValue(field, supplier)}
          </div>
        )}
      </div>
    </CardShell>
  );
}
