import type { ChangeRecord } from '@/components/Feed/taskHistoryStore';
import type { DayOfWeek } from '@/components/Suppliers/fixtures';
import type { SupplierField } from '@/components/Feed/commands/parsers';

const FIELD_LABELS: Record<SupplierField, string> = {
  cutOffTime: 'Cut-off time',
  leadTimeDays: 'Lead time',
  minimumOrderValue: 'MOV',
  deliveryDays: 'Delivery days',
  email: 'Email',
  phone: 'Phone',
};

const FIELD_UNITS: Partial<Record<SupplierField, string>> = {
  leadTimeDays: 'days',
  minimumOrderValue: '£',
};

const FIELD_KIND: Record<SupplierField, 'number' | 'currency' | 'text' | 'array'> = {
  cutOffTime: 'text',
  leadTimeDays: 'number',
  minimumOrderValue: 'currency',
  deliveryDays: 'array',
  email: 'text',
  phone: 'text',
};

export function diffSupplier(args: {
  final: {
    supplierId: string;
    supplierName: string;
    changes: {
      field: SupplierField;
      valueRaw: string;
      valueNormalised: string | number | DayOfWeek[];
      previousValue: string | number | DayOfWeek[] | undefined;
    }[];
  };
}): ChangeRecord[] {
  const { final } = args;
  return final.changes.map((c) => ({
    entityType: 'supplier',
    entityId: final.supplierId,
    entityLabel: final.supplierName,
    fieldPath: c.field,
    fieldLabel: FIELD_LABELS[c.field],
    before: c.previousValue ?? null,
    after: c.valueNormalised,
    unit: FIELD_UNITS[c.field],
    valueKind: FIELD_KIND[c.field],
  }));
}
