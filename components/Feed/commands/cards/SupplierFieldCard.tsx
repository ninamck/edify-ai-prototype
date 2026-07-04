'use client';

import { useEffect, useMemo, useState } from 'react';
import { Truck, ArrowRight } from 'lucide-react';
import { findSupplier, useSuppliers } from '@/components/Suppliers/store';
import type { Supplier, DayOfWeek } from '@/components/Suppliers/fixtures';
import CardShell, { PillRow, type CardState } from './CardShell';
import type { SupplierArgs, SupplierField } from '../parsers';

/** One field edit inside the card's confirm payload. The card supports
 *  editing several fields at once, so the payload carries an array. */
export interface SupplierFieldChange {
  field: SupplierField;
  valueRaw: string;
  valueNormalised: string | number | DayOfWeek[];
  previousValue: string | number | DayOfWeek[] | undefined;
}

interface SupplierFieldCardProps {
  /** `changes` is present when a task is replayed (revert / edit) —
   *  it re-seeds the multi-field selection. */
  initialArgs: SupplierArgs & { changes?: SupplierFieldChange[] };
  state: CardState;
  onConfirm: (final: {
    supplierId: string;
    supplierName: string;
    changes: SupplierFieldChange[];
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

const FIELD_ORDER = Object.keys(FIELD_LABELS) as SupplierField[];

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

const SECTION_LABEL: React.CSSProperties = {
  fontSize: '11px',
  fontWeight: 700,
  letterSpacing: '0.04em',
  textTransform: 'uppercase',
  color: 'var(--color-text-secondary)',
  marginBottom: '6px',
};

export default function SupplierFieldCard({ initialArgs, state, onConfirm, onCancel }: SupplierFieldCardProps) {
  const suppliers = useSuppliers();

  // Freshly parsed cards (a sentence resolved into prefilled fields)
  // animate in: the card mounts empty, then the supplier pill lights
  // up, field pills toggle on one by one, and values type themselves
  // in. Replays (revert/edit) and restored snapshots render static.
  const animateIn =
    state === 'pending' &&
    !initialArgs.changes?.length &&
    !!initialArgs.supplierId &&
    (initialArgs.fields?.some((f) => f.value) ?? false);

  const [supplierId, setSupplierId] = useState<string | undefined>(
    animateIn ? undefined : initialArgs.supplierId,
  );
  const supplier = useMemo(
    () => (supplierId ? findSupplier(supplierId) : undefined),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [supplierId, suppliers],
  );

  // Multiple fields can be edited in one go. Seed priority: a
  // replayed `changes` array (revert/edit), then the parser's multi-
  // field `fields` array, then a single parsed `field`, else cut-off.
  const [fields, setFields] = useState<Set<SupplierField>>(() => {
    if (animateIn) return new Set();
    if (initialArgs.changes?.length) return new Set(initialArgs.changes.map((c) => c.field));
    if (initialArgs.fields?.length) return new Set(initialArgs.fields.map((f) => f.field));
    return new Set([initialArgs.field ?? 'cutOffTime']);
  });
  const [texts, setTexts] = useState<Partial<Record<SupplierField, string>>>(() => {
    if (animateIn) return {};
    const seed: Partial<Record<SupplierField, string>> = {};
    if (initialArgs.changes?.length) {
      for (const c of initialArgs.changes) {
        if (c.field !== 'deliveryDays') seed[c.field] = c.valueRaw;
      }
    } else if (initialArgs.fields?.length) {
      for (const f of initialArgs.fields) {
        if (f.field !== 'deliveryDays' && f.value) seed[f.field] = f.value;
      }
    } else if (initialArgs.field && initialArgs.field !== 'deliveryDays' && initialArgs.value) {
      seed[initialArgs.field] = initialArgs.value;
    }
    return seed;
  });
  const [days, setDays] = useState<Set<DayOfWeek>>(() => {
    if (animateIn) return new Set();
    const replayed = initialArgs.changes?.find((c) => c.field === 'deliveryDays');
    if (replayed && Array.isArray(replayed.valueNormalised)) {
      return new Set(replayed.valueNormalised as DayOfWeek[]);
    }
    const parsedDays =
      initialArgs.fields?.find((f) => f.field === 'deliveryDays')?.value ??
      (initialArgs.field === 'deliveryDays' ? initialArgs.value : undefined);
    if (parsedDays) {
      return new Set(parsedDays.split(',').map((d) => d.trim() as DayOfWeek).filter((d) => ALL_DAYS.includes(d)));
    }
    return new Set(supplier?.deliveryDays ?? []);
  });

  // The staged fill-in. Timings are deliberately unhurried — this is
  // the visible "Quinn is doing the data entry" moment. All timers
  // are cleared in the effect cleanup, which also makes this safe
  // under Strict Mode's double-mount: the first run's timers are
  // cancelled and the second run reschedules them from scratch. (A
  // "ran once" ref guard here would permanently skip the animation
  // in dev — the ref survives the cleanup, so the re-run bails and
  // the card never fills in.)
  useEffect(() => {
    if (!animateIn) return;
    const timers: number[] = [];
    let t = 600;

    // 1 — supplier pill lights up.
    timers.push(window.setTimeout(() => {
      setSupplierId(initialArgs.supplierId);
      const s = findSupplier(initialArgs.supplierId);
      setDays(new Set(s?.deliveryDays ?? []));
    }, t));
    t += 700;

    // 2 — each field pill toggles on, then its value fills in.
    for (const f of initialArgs.fields ?? []) {
      timers.push(window.setTimeout(() => {
        setFields((prev) => {
          const next = new Set(prev);
          next.add(f.field);
          return next;
        });
      }, t));
      t += 550;
      if (!f.value) continue;
      if (f.field === 'deliveryDays') {
        const parsed = f.value.split(',').map((d) => d.trim() as DayOfWeek).filter((d) => ALL_DAYS.includes(d));
        parsed.forEach((day, i) => {
          timers.push(window.setTimeout(() => {
            setDays((prev) => {
              const next = new Set(prev);
              next.add(day);
              return next;
            });
          }, t + i * 220));
        });
        t += parsed.length * 220 + 300;
      } else {
        const v = f.value;
        for (let i = 1; i <= v.length; i++) {
          timers.push(window.setTimeout(() => {
            setTexts((prev) => ({ ...prev, [f.field]: v.slice(0, i) }));
          }, t + (i - 1) * 110));
        }
        t += v.length * 110 + 350;
      }
    }
    return () => timers.forEach((id) => window.clearTimeout(id));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const selectedFields = FIELD_ORDER.filter((f) => fields.has(f));

  function toggleField(f: SupplierField) {
    setFields((prev) => {
      const next = new Set(prev);
      if (next.has(f)) next.delete(f);
      else next.add(f);
      return next;
    });
  }

  function fieldValid(f: SupplierField): boolean {
    if (f === 'deliveryDays') return days.size > 0;
    const t = (texts[f] ?? '').trim();
    if (t.length === 0) return false;
    if (f === 'leadTimeDays' || f === 'minimumOrderValue') return !Number.isNaN(Number(t));
    return true;
  }

  function commit() {
    if (!supplier) return;
    const changes: SupplierFieldChange[] = selectedFields.map((f) => {
      let valueNormalised: string | number | DayOfWeek[];
      let valueRaw: string;
      if (f === 'deliveryDays') {
        valueNormalised = ALL_DAYS.filter((d) => days.has(d));
        valueRaw = (valueNormalised as DayOfWeek[]).join(', ');
      } else if (f === 'leadTimeDays' || f === 'minimumOrderValue') {
        valueRaw = (texts[f] ?? '').trim();
        valueNormalised = Number(valueRaw);
      } else {
        valueRaw = (texts[f] ?? '').trim();
        valueNormalised = valueRaw;
      }
      return { field: f, valueRaw, valueNormalised, previousValue: previousValueOf(f, supplier) };
    });
    onConfirm({
      supplierId: supplier.id,
      supplierName: supplier.shortCode ?? supplier.name,
      changes,
    });
  }

  const canConfirm = !!supplier && selectedFields.length > 0 && selectedFields.every(fieldValid);

  const subtitle = supplier
    ? `Update ${selectedFields.map((f) => FIELD_LABELS[f].toLowerCase()).join(', ') || '…'}`
    : 'Pick a supplier';

  return (
    <CardShell
      icon={Truck}
      title={`Supplier — ${supplier?.shortCode ?? supplier?.name ?? initialArgs.supplierName ?? '…'}`}
      subtitle={subtitle}
      state={state}
      confirmLabel={selectedFields.length > 1 ? 'Save changes' : 'Save change'}
      confirmDisabled={!canConfirm}
      onConfirm={canConfirm ? commit : undefined}
      onCancel={onCancel}
    >
      <div style={{ marginBottom: '12px' }}>
        <div style={SECTION_LABEL}>Supplier</div>
        <PillRow
          options={suppliers.map((s) => ({ value: s.id, label: s.shortCode ?? s.name }))}
          selected={supplierId}
          onSelect={(id) => {
            setSupplierId(id as string);
            setTexts({});
            const next = findSupplier(id as string);
            setDays(new Set(next?.deliveryDays ?? []));
          }}
          disabled={state !== 'pending'}
          small
        />
      </div>

      <div style={{ marginBottom: '12px' }}>
        <div style={SECTION_LABEL}>Fields — pick one or more</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
          {FIELD_ORDER.map((f) => {
            const active = fields.has(f);
            return (
              <button
                key={f}
                type="button"
                disabled={state !== 'pending'}
                onClick={() => toggleField(f)}
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
                  cursor: state !== 'pending' ? 'not-allowed' : 'pointer',
                }}
              >
                {FIELD_LABELS[f]}
              </button>
            );
          })}
        </div>
      </div>

      {selectedFields.map((f) => (
        <div
          key={f}
          style={{
            marginTop: '10px',
            padding: '10px 12px',
            borderRadius: '10px',
            border: '1px solid var(--color-border-subtle, rgba(0,28,53,0.08))',
            background: 'rgba(0,28,53,0.015)',
          }}
        >
          <div style={{ ...SECTION_LABEL, marginBottom: '8px' }}>{FIELD_LABELS[f]}</div>
          {f === 'deliveryDays' ? (
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
              type={f === 'leadTimeDays' || f === 'minimumOrderValue' ? 'number' : 'text'}
              inputMode={f === 'cutOffTime' ? 'numeric' : undefined}
              value={texts[f] ?? ''}
              disabled={state !== 'pending'}
              onChange={(e) => setTexts((prev) => ({ ...prev, [f]: e.target.value }))}
              placeholder={
                f === 'cutOffTime'
                  ? '14:00'
                  : f === 'leadTimeDays'
                    ? 'days'
                    : f === 'minimumOrderValue'
                      ? '£ amount'
                      : f === 'email'
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
                background: '#fff',
              }}
            />
          )}
          {previousValueOf(f, supplier) !== undefined && (
            <div style={{ marginTop: '8px', fontSize: '12px', fontWeight: 500, color: 'var(--color-text-muted)' }}>
              <ArrowRight size={11} style={{ verticalAlign: '-1px' }} /> was {formatValue(f, supplier)}
            </div>
          )}
        </div>
      ))}
    </CardShell>
  );
}
