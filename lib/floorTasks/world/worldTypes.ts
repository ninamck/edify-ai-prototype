import type {
  DemandAdjustmentPayload, Proposal, Receipt, RejectionReason, Role, SnapBasketOrder, SnapCatalogueProduct,
  SnapBenchRow, SnapChecklistQuestion, SnapCountList, SnapHotBatch, SnapRecipe, SnapStockRow, Surface, WasteLine,
} from '../types';

export interface WorldWasteEntry extends WasteLine {
  id: string;
  proposalId: string;
  wasteDate: string;
  recordedAt: string;
  deletedReason?: string;
}

export type WorldCountList = SnapCountList;

export interface WorldQuickCount {
  id: string;
  countListId: string;
  status: 'open' | 'submitted' | 'discarded';
  counted: Record<string, number>;
  startedAt: string;
}

export interface WorldHot {
  stationName: string;
  pcrOn: boolean;
  batches: SnapHotBatch[];
}

export interface WorldBench {
  name: string;
  rows: SnapBenchRow[];
}

export interface WorldChecklist {
  instanceId: string;
  name: string;
  status: string;
  due: string;
  questions: Omit<SnapChecklistQuestion, 'answer'>[];
  answers: Record<string, string>;
}

export interface WorldDeliveryLine {
  id: string;
  name: string;
  unit: string;
  price: number;
  ordered: number;
  status: 'pending' | 'accepted';
  received?: number;
  /** Lines that map to a stock item add to on hand when accepted. */
  stockItemId?: string;
  stockPerUnit?: number;
}

export interface WorldDelivery {
  id: string;
  poNumber: string;
  supplierName: string;
  due: 'today' | 'overdue' | 'future';
  dueLabel: string;
  requiresReference: boolean;
  status: 'pending' | 'partially-received' | 'received';
  supplierReference?: string;
  creditRequested?: boolean;
  lines: WorldDeliveryLine[];
}

export interface WorldTransferLine {
  id: string;
  itemId?: string;
  itemName: string;
  qty: number;
  unit: string;
  received?: number;
  reason?: RejectionReason;
}

export interface WorldTransfer {
  id: string;
  number: string;
  fromSiteId: string;
  fromSiteName: string;
  toSiteId: string;
  toSiteName: string;
  sentAt: string;
  status: 'pending' | 'accepted' | 'cancelled';
  lines: WorldTransferLine[];
}

export interface WorldTransferRequest {
  id: string;
  requestingSiteId: string;
  fulfillingSiteId: string;
  fulfillingSiteName: string;
  status: 'REQUESTED' | 'CANCELLED';
  lines: { itemId: string; itemName: string; qty: number; unit: string }[];
  note?: string;
  createdAt: string;
}

export interface WorldDemandAdjustment extends DemandAdjustmentPayload {
  id: string;
  createdAt: string;
}

export interface WorldState {
  siteId: string;
  sites: { id: string; name: string }[];
  role: Role;
  surface: Surface;
  today: string;
  stock: Record<string, SnapStockRow[]>;
  wasteLog: WorldWasteEntry[];
  countLists: WorldCountList[];
  quickCounts: WorldQuickCount[];
  stocktakeInProgress: boolean;
  hot: WorldHot | null;
  bench: WorldBench | null;
  checklists: WorldChecklist[];
  basket: { orders: SnapBasketOrder[]; catalogue: SnapCatalogueProduct[] };
  deliveries: WorldDelivery[];
  transfers: WorldTransfer[];
  transferRequests: WorldTransferRequest[];
  demandAdjustments: WorldDemandAdjustment[];
  recipes: SnapRecipe[];
  proposals: Proposal[];
  receipts: (Receipt & { revert?: Proposal })[];
}
