import type { ChangeRecord } from '@/components/Feed/taskHistoryStore';
import type { WasteReasonId } from '@/components/Waste/wasteData';

/**
 * Waste isn't a field update on a long-lived entity — it's an event
 * being appended. We still emit a ChangeRecord so the Activity page
 * can render the value (qty + reason + cost) using the same
 * `ChangeDiff` component as field-level edits. `before: null /
 * after: <values>` reads as "this entry was created" in the renderer.
 */
export function diffWaste(args: {
  entryId: string;
  productName: string;
  qty: number;
  uom: string;
  reasonId: WasteReasonId;
  reasonLabel?: string;
  value: number;
}): ChangeRecord[] {
  const { entryId, productName, qty, uom, reasonLabel, value } = args;
  return [
    {
      entityType: 'waste-entry',
      entityId: entryId,
      entityLabel: productName,
      fieldPath: 'qty',
      fieldLabel: 'Quantity wasted',
      before: null,
      after: `${qty} ${uom}`,
      valueKind: 'text',
    },
    {
      entityType: 'waste-entry',
      entityId: entryId,
      entityLabel: productName,
      fieldPath: 'reason',
      fieldLabel: 'Reason',
      before: null,
      after: reasonLabel ?? 'No reason',
      valueKind: 'text',
    },
    {
      entityType: 'waste-entry',
      entityId: entryId,
      entityLabel: productName,
      fieldPath: 'value',
      fieldLabel: 'Value',
      before: null,
      after: value,
      unit: '$',
      valueKind: 'currency',
    },
  ];
}
