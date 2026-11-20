/**
 * Shared shapes for floor tasks: the things a team member says or types
 * in Command Centre ("binned 3 croissants", "Natoora's here, 12 items,
 * none missing") that Edify stages as a proposal, confirms the right way
 * for the task and the device, then writes.
 *
 * These types travel between the browser (which owns the prototype's
 * stores) and the /api/command route (which runs the model and the
 * tools), so they stay plain JSON.
 */

/** How a task is confirmed. Ask: read-only, no proposal. Say: a spoken
 *  "yes" or one tap. Show: always an on-screen confirm. */
export type TaskTier = 'ask' | 'say' | 'show';

/** What the person is holding. A headset can't show a card, so Show-it
 *  tasks go to Waiting for you. */
export type Surface = 'app' | 'headset';

/** The two roles the prototype demos. Main has more; these are the two
 *  that change what a floor task can do. */
export type Role = 'team-member' | 'manager';

export type FloorTaskId =
  | 'waste'
  | 'on-hand'
  | 'hot-add'
  | 'production-step'
  | 'par-level'
  | 'transfer-request'
  | 'quick-count-start'
  | 'checklist-answer'
  | 'basket-add'
  | 'delivery-accept'
  | 'transfer-send'
  | 'transfer-accept'
  | 'demand-adjustment'
  | 'undo';

export type ConfirmMode = 'none' | 'spoken' | 'card' | 'waiting';

export type ProposalStatus = 'staged' | 'waiting' | 'applied' | 'declined' | 'expired';

// ─── Payloads, one per task ────────────────────────────────────────────────

export type StockKind = 'product' | 'master-product' | 'recipe' | 'sub-recipe';

export interface WasteLine {
  itemId: string;
  itemName: string;
  kind: StockKind;
  qty: number;
  unit: string;
  /** Quantity converted to the item's stock unit. */
  qtyInStockUnit: number;
  stockUnit: string;
  /** Main's reason name, as sent on the wire. */
  reason: string;
  value: number;
  onHand: number;
}

export interface WastePayload {
  lines: WasteLine[];
  /** YYYY-MM-DD. Main allows today or yesterday without EditWasteDate. */
  wasteDate: string;
}

export interface OnHandPayload {
  itemId: string;
  itemName: string;
  unit: string;
  from: number;
  to: number;
  /** Managers set on hand directly. A team member's figure goes in as a
   *  quick count on a count list that holds the item, counting only it. */
  route: 'set-on-hand' | 'quick-count';
  countListId?: string;
  countListName?: string;
}

export interface HotAddLine {
  recipeId: string;
  recipeName: string;
  /** Null when the line hasn't been made yet: adding records it as made. */
  existingMade: number | null;
  add: number;
  newMade: number;
}

export interface HotAddPayload {
  stationName: string;
  batchId: string;
  batchLabel: string;
  lines: HotAddLine[];
}

export interface ProductionStepPayload {
  benchName: string;
  rowId: string;
  recipeName: string;
  planned: number;
  action: 'start' | 'complete' | 'start-and-complete';
}

export interface ParLevelPayload {
  itemId: string;
  itemName: string;
  unit: string;
  from: number | null;
  to: number;
}

export interface RequestLine {
  itemId: string;
  itemName: string;
  qty: number;
  unit: string;
}

export interface TransferRequestPayload {
  fulfillingSiteId: string;
  fulfillingSiteName: string;
  lines: RequestLine[];
  note?: string;
}

export interface QuickCountStartPayload {
  countListId: string;
  countListName: string;
  itemCount: number;
  resume: boolean;
}

export interface ChecklistAnswerPayload {
  instanceId: string;
  checklistName: string;
  questionId: string;
  questionName: string;
  responseType: string;
  /** Stored the way Main stores it: 'yes'/'no' for ticks, the number as
   *  a string for temperatures and numbers. */
  answer: string;
  followUp?: { questionId: string; questionName: string; answer: string };
  answeredAfter: number;
  totalQuestions: number;
}

export interface BasketAddPayload {
  orderId: string;
  supplierId: string;
  supplierName: string;
  productId: string;
  productName: string;
  packs: number;
  orderUnit: string;
  orderUnitPlural: string;
  packSize: number;
  stockUnit: string;
  unitPrice: number;
  /** The product was on the order and removed: it comes back instead of
   *  being added twice. */
  restoresRemoved: boolean;
}

export interface DeliveryLineDraft {
  id: string;
  name: string;
  unit: string;
  price: number;
  ordered: number;
  received: number;
}

export interface DeliveryAcceptPayload {
  deliveryId: string;
  poNumber: string;
  supplierName: string;
  lines: DeliveryLineDraft[];
  /** What the person said about the delivery, checked against the PO. */
  saidItemCount?: number;
  saidNoneMissing?: boolean;
  lineCountMatches: boolean;
  requiresReference: boolean;
  supplierReference?: string;
  /** Request credit for the missing quantities. Emails the supplier, so
   *  it's always an on-screen choice. */
  requestCredit: boolean;
}

export interface TransferSendLine {
  itemId: string;
  itemName: string;
  qty: number;
  unit: string;
  onHand: number;
}

export interface TransferSendPayload {
  toSiteId: string;
  toSiteName: string;
  lines: TransferSendLine[];
  sentAt: string;
}

/** Main's rejection reasons. The reason decides the outcome; the user
 *  never picks it. */
export type RejectionReason =
  | 'Damaged'
  | 'Temperature out of range'
  | 'Quality issue'
  | 'Incorrect item'
  | 'Missing'
  | 'Other';

export interface TransferAcceptLine {
  id: string;
  itemName: string;
  unit: string;
  sent: number;
  received: number;
  reason?: RejectionReason;
  note?: string;
}

export interface TransferAcceptPayload {
  transferId: string;
  transferNumber: string;
  fromSiteName: string;
  lines: TransferAcceptLine[];
}

export interface DemandAdjustmentPayload {
  siteName: string;
  startDate: string;
  endDate: string;
  percentOfDemand: number;
  reason: string;
}

export interface UndoPayload {
  receiptId: string;
  receiptHeadline: string;
  targetTaskId: FloorTaskId;
  /** Waste deletes need a reason in Main (3 to 500 characters). */
  reason?: string;
}

export interface PayloadByTask {
  waste: WastePayload;
  'on-hand': OnHandPayload;
  'hot-add': HotAddPayload;
  'production-step': ProductionStepPayload;
  'par-level': ParLevelPayload;
  'transfer-request': TransferRequestPayload;
  'quick-count-start': QuickCountStartPayload;
  'checklist-answer': ChecklistAnswerPayload;
  'basket-add': BasketAddPayload;
  'delivery-accept': DeliveryAcceptPayload;
  'transfer-send': TransferSendPayload;
  'transfer-accept': TransferAcceptPayload;
  'demand-adjustment': DemandAdjustmentPayload;
  undo: UndoPayload;
}

export type Proposal = {
  [K in FloorTaskId]: {
    id: string;
    taskId: K;
    payload: PayloadByTask[K];
    /** One line for lists: "3 croissants, Beyond expiry date". */
    label: string;
    /** What Edify says before the yes: "Waste 3 croissants, out of date?" */
    readback: string;
    /** Things the person should see before confirming. */
    warnings: string[];
    siteId: string;
    createdAt: string;
    status: ProposalStatus;
    /** End of the trading day. Waiting items expire then. */
    expiresAt: string;
  };
}[FloorTaskId];

export type ProposalOf<K extends FloorTaskId> = Extract<Proposal, { taskId: K }>;

/** What undo means for a receipt, following what Main allows. */
export type UndoSpec =
  | { kind: 'delete-with-reason' }
  | { kind: 'cancel'; prompt: string }
  | { kind: 'direct'; prompt: string }
  | { kind: 'restage'; prompt: string }
  | { kind: 'none'; why: string };

export interface Receipt {
  id: string;
  proposalId: string;
  taskId: FloorTaskId;
  headline: string;
  detail?: string;
  href?: string;
  hrefLabel?: string;
  undo: UndoSpec;
  createdAt: string;
  undone?: boolean;
}

// ─── The snapshot the browser sends with each request ──────────────────────

export interface SnapStockRow {
  id: string;
  name: string;
  variant: string;
  kind: StockKind;
  unit: string;
  /** Other units the item can be counted or wasted in, with how many
   *  stock units one of them is. */
  units: { unit: string; inStockUnits: number }[];
  onHand: number;
  par: number | null;
  unitPrice: number;
  supplierName: string;
}

export interface SnapCountList {
  id: string;
  name: string;
  itemIds: string[];
  openCountId?: string;
}

export interface SnapHotBatch {
  id: string;
  label: string;
  /** 'current' or 'next' are the only batches the hot stepper's Add
   *  dialog offers. */
  when: 'earlier' | 'current' | 'next' | 'later';
  lines: { recipeId: string; recipeName: string; planned: number; made: number | null }[];
}

export interface SnapBenchRow {
  id: string;
  recipeName: string;
  planned: number;
  startedAt: string | null;
  completedAt: string | null;
}

export interface SnapChecklistQuestion {
  id: string;
  name: string;
  type: string;
  mandatory: boolean;
  answer: string | null;
  parentQuestionId?: string;
  /** Follow-up rules: show the child question when the trigger fires. */
  followUps: { condition: string; value?: number; questionId: string }[];
}

export interface SnapChecklist {
  instanceId: string;
  name: string;
  status: string;
  due: string;
  questions: SnapChecklistQuestion[];
}

export interface SnapBasketOrder {
  id: string;
  supplierId: string;
  supplierName: string;
  deliveryDate: string | null;
  lines: { productId: string; name: string; packs: number; removed: boolean; addedByYou: boolean }[];
}

export interface SnapCatalogueProduct {
  productId: string;
  supplierId: string;
  supplierName: string;
  name: string;
  orderUnit: string;
  orderUnitPlural: string;
  packSize: number;
  stockUnit: string;
  unitPrice: number;
}

export interface SnapDelivery {
  id: string;
  poNumber: string;
  supplierName: string;
  due: 'today' | 'overdue' | 'future';
  dueLabel: string;
  requiresReference: boolean;
  lines: { id: string; name: string; unit: string; price: number; ordered: number; status: 'pending' | 'accepted' }[];
}

export interface SnapTransfer {
  id: string;
  number: string;
  fromSiteId: string;
  fromSiteName: string;
  toSiteId: string;
  toSiteName: string;
  sentAt: string;
  status: string;
  lines: { id: string; itemName: string; qty: number; unit: string }[];
}

export interface SnapRecipe {
  id: string;
  name: string;
  allergens: string[];
  mayContain: string[];
}

export interface FloorSnapshot {
  today: string;
  nowIso: string;
  nowLabel: string;
  site: { id: string; name: string };
  role: Role;
  surface: Surface;
  sites: { id: string; name: string }[];
  stock: SnapStockRow[];
  wasteReasons: string[];
  countLists: SnapCountList[];
  stocktakeInProgress: boolean;
  hot: { stationName: string; pcrOn: boolean; batches: SnapHotBatch[] } | null;
  bench: { name: string; rows: SnapBenchRow[] } | null;
  checklists: SnapChecklist[];
  basket: { orders: SnapBasketOrder[]; catalogue: SnapCatalogueProduct[] };
  deliveries: SnapDelivery[];
  transfers: SnapTransfer[];
  recipes: SnapRecipe[];
  recentReceipts: { id: string; taskId: FloorTaskId; headline: string; undo: UndoSpec }[];
}

/** One turn of the conversation, sent back so follow-ups make sense. */
export interface FloorTurn {
  role: 'user' | 'edify';
  text: string;
}

export interface CommandRequest {
  text: string;
  history: FloorTurn[];
  snapshot: FloorSnapshot;
}

export interface CommandResponse {
  /** 'other' means the words weren't a floor task: the chat carries on
   *  with its existing flows. */
  route: 'floor' | 'other';
  say: string;
  proposals: Proposal[];
  /** Which tools ran, for the test page. */
  toolsCalled: string[];
  /** 'demo' when no model is connected and patterns read the words. */
  engine?: 'model' | 'demo';
  error?: string;
}
