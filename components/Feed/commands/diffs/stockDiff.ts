import type { ChangeRecord } from '@/components/Feed/taskHistoryStore';

export function diffStock(args: {
  entryId: string;
  itemName: string;
  qty: number;
  uom: string;
  expectedQty: number | null;
  location?: string;
}): ChangeRecord[] {
  const { entryId, itemName, qty, uom, expectedQty, location } = args;
  const changes: ChangeRecord[] = [
    {
      entityType: 'stock-count',
      entityId: entryId,
      entityLabel: itemName,
      fieldPath: 'qty',
      fieldLabel: 'Counted',
      before: expectedQty,
      after: qty,
      unit: uom,
      valueKind: 'number',
    },
  ];
  if (location) {
    changes.push({
      entityType: 'stock-count',
      entityId: entryId,
      entityLabel: itemName,
      fieldPath: 'location',
      fieldLabel: 'Location',
      before: null,
      after: location,
      valueKind: 'text',
    });
  }
  return changes;
}
