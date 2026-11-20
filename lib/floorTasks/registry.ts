import type { FloorTaskId, Role, TaskTier } from './types';

/**
 * One entry per floor task. Every rule here comes from Edify Main
 * (../edify). `main` lists the files the behaviour was read from, so
 * Stefan and Gio can check the prototype against the real thing, and
 * `differs` says where the prototype stops short.
 */
export interface FloorTaskSpec {
  id: FloorTaskId;
  /** What the person on the floor would call it. */
  title: string;
  tier: TaskTier;
  /** What Edify needs to stage the task. Anything with a default can be
   *  left unsaid. */
  slots: { name: string; required: boolean; default?: string }[];
  endpoint: string;
  /** Main's permission, and who holds it in the prototype. */
  permission: string;
  roles: Role[];
  /** What happens when Edify can't do it for this role. */
  refusal?: string;
  /** Main's confirm copy, used on cards. */
  confirm: { title: string; body: string; button: string; flaggedTitle?: string; flaggedButton?: string };
  toast: string;
  undo: string;
  rules: string[];
  main: string[];
  differs?: string[];
}

export const FLOOR_TASKS: Record<FloorTaskId, FloorTaskSpec> = {
  waste: {
    id: 'waste',
    title: 'Log waste',
    tier: 'say',
    slots: [
      { name: 'item', required: true },
      { name: 'quantity', required: true },
      { name: 'unit', required: false, default: "the item's stock unit" },
      { name: 'reason', required: false, default: 'No Reason' },
      { name: 'date', required: false, default: 'today' },
    ],
    endpoint: 'POST /waste',
    permission: 'CreateWaste',
    roles: ['team-member', 'manager'],
    confirm: {
      title: 'Are you sure you want to waste these items?',
      body: 'Once confirmed, this will automatically reduce your stock levels. Make any final adjustments before confirming.',
      button: 'Waste items',
      flaggedTitle: 'Record waste anyway?',
      flaggedButton: 'Record anyway',
    },
    toast: 'Waste recorded',
    undo: 'Delete the waste line. Main asks "Why are you deleting this?" and needs 3 to 500 characters. Toast "Waste deleted".',
    rules: [
      'Lines can be products, master products, recipes or sub-recipes, each in one of its own units.',
      'Reasons are the site\'s waste reasons. The seven built-ins: Beyond expiry date, Damaged, No longer fresh, R&D, Third Party food waste app, Used by Staff, No Reason.',
      'Without EditWasteDate the date can only be today or yesterday.',
      'A line is flagged as unusually large when it is worth at least £5, the item has at least 3 lines in the last 90 days, and it is more than 5 times their median. Flagged lines still save after "Record anyway".',
      'Stock goes down by the wasted quantity. Wasting more than is on hand takes it below zero.',
    ],
    main: [
      'backend/src/modules/waste/waste.controller.ts',
      'backend/src/modules/waste/waste.service.ts',
      'backend/src/modules/waste/waste-line.service.ts',
      'backend/src/modules/waste/helpers/waste-line-editability.helper.ts',
      'web/src/features/waste/USER-STORIES.md',
    ],
    differs: [
      'The unusually-large check uses a fixed history per item instead of 90 days of real lines.',
      'Waste goes to the floor-task log, not the /log-waste page, which runs on its own stand-in products.',
    ],
  },

  'on-hand': {
    id: 'on-hand',
    title: 'Update what\'s on hand',
    tier: 'say',
    slots: [
      { name: 'item', required: true },
      { name: 'quantity', required: true },
      { name: 'unit', required: false, default: "the item's stock unit" },
    ],
    endpoint: 'PUT /live-stock-levels/:id/quantity (managers) or POST /count-lists/:id/quick-counts then submit (team members)',
    permission: 'SetLiveStockLevelQuantity (Admin and Manager). Quick counts need ManageStockTake.',
    roles: ['team-member', 'manager'],
    confirm: {
      title: 'Update on hand stock',
      body: 'Update the on hand stock of {item} from {from} {unit} to {to} {unit}?',
      button: 'Update',
    },
    toast: 'On hand updated for {item}',
    undo: 'None in Main. Edify offers to set it back to the old figure, which is a new update.',
    rules: [
      'A manager\'s figure sets on hand outright, the same as the Update on hand dialog.',
      'A team member can\'t set on hand. Their figure goes in as a quick count on a count list that holds the item, with only that item counted. Main applies counted items only, so nothing else moves.',
      'If no count list at the site holds the item, a team member can\'t record it. Edify says so and names the two ways forward.',
      'A quick count can\'t start while a full stocktake is being counted.',
    ],
    main: [
      'backend/src/modules/live-stock-levels/live-stock-level.controller.ts',
      'backend/src/modules/live-stock-levels/live-stock-level.service.ts',
      'backend/src/modules/quick-count/quick-count.controller.ts',
      'backend/src/modules/quick-count/quick-count.service.ts',
      'web/src/features/stocktake/USER-STORIES.md',
    ],
  },

  'hot-add': {
    id: 'hot-add',
    title: 'Add to hot production',
    tier: 'say',
    slots: [
      { name: 'recipe', required: true },
      { name: 'quantity', required: true },
      { name: 'batch', required: false, default: 'the batch on now' },
    ],
    endpoint: 'PATCH /production/:siteId/batch-daily-productions with made = existing + added',
    permission: 'ViewBatchDailyProductions',
    roles: ['team-member', 'manager'],
    confirm: {
      title: 'Add to the line',
      body: 'Set how many extra of each to drop onto the line now.',
      button: 'Add',
    },
    toast: 'Added to the line.',
    undo: 'None in Main. A wrong figure is fixed in the availability modal ("Set how many of each batch are actually left.").',
    rules: [
      'Only recipes already on the batch can be added to. Main\'s Add dialog offers the current and next batch.',
      'The add is cumulative: the new made figure is what was made plus what was added. A line not made yet is recorded as made.',
      'Up to 1000 per line.',
      'Hidden when PCR is on for the site.',
    ],
    main: [
      'backend/src/modules/production/production.controller.ts',
      'backend/src/modules/production/dto/inbound.batch-daily-production.dto.ts',
      'web/src/features/production/hot-production/USER-STORIES.md',
      'web/src/features/production/stepper/USER-STORIES.md',
    ],
    differs: ['Cold-bench runs have no add in Main. Saying "add 10 to the wraps" on a cold bench is refused.'],
  },

  'production-step': {
    id: 'production-step',
    title: 'Start or finish production',
    tier: 'say',
    slots: [
      { name: 'recipe', required: true },
      { name: 'action', required: false, default: 'start if not started, otherwise complete' },
    ],
    endpoint: 'POST /production/daily-production/:id/start-production and /complete-production',
    permission: 'ViewProductions',
    roles: ['team-member', 'manager'],
    confirm: { title: 'Mark production', body: '{recipe}: {action}.', button: 'Confirm' },
    toast: '{recipe} done',
    undo: 'None in Main.',
    rules: [
      'A run can\'t be completed before it is started (409 "Daily production has to be started before being completed"). Saying "done" on an unstarted run does both, in order.',
      'The bench screen runs recipes in sequence. A run can\'t start until earlier runs are finished.',
    ],
    main: [
      'backend/src/modules/production/production.controller.ts',
      'web/src/features/production/bench/USER-STORIES.md',
    ],
  },

  'par-level': {
    id: 'par-level',
    title: 'Set a par level',
    tier: 'say',
    slots: [
      { name: 'item', required: true },
      { name: 'par', required: true },
    ],
    endpoint: 'PUT /live-stock-levels/:id/par-level',
    permission: 'SetParLevel (Admin and Manager)',
    roles: ['manager'],
    refusal: 'Team members can\'t change par levels. A manager can.',
    confirm: { title: 'Set par level', body: 'Par for {item}: {from} to {to} {unit}.', button: 'Set par' },
    toast: 'Par level updated for {item}',
    undo: 'None in Main. Edify offers to set it back.',
    rules: ['Main saves par without a confirm. Edify still reads it back, because a misheard number changes every order after it.'],
    main: [
      'backend/src/modules/live-stock-levels/live-stock-level.controller.ts',
      'backend/src/modules/live-stock-levels/dto/inbound-set-par-level.dto.ts',
      'backend/src/modules/access/handlers/set-lsl-par-level-permission.handler.ts',
    ],
  },

  'transfer-request': {
    id: 'transfer-request',
    title: 'Ask another site for stock',
    tier: 'say',
    slots: [
      { name: 'items', required: true },
      { name: 'from site', required: true },
      { name: 'note', required: false },
    ],
    endpoint: 'POST /transfer-requests',
    permission: 'CreateTransferRequest (grant to employees to confirm with Gio)',
    roles: ['team-member', 'manager'],
    confirm: { title: 'Request stock', body: 'Ask {site} for these items. Nothing moves until they send it.', button: 'Request' },
    toast: 'Transfer requested',
    undo: 'Cancel while it is still Requested ("Cancel this request?").',
    rules: ['A request moves no stock. The other site sends it as a transfer.'],
    main: [
      'backend/src/modules/transfer/controllers/transfer-request.controller.ts',
      'backend/src/modules/transfer/services/transfer-request.service.ts',
      'backend/src/modules/transfer/services/transfer-request-validation.service.ts',
      'web/src/features/transfer-requests/USER-STORIES.md',
    ],
  },

  'quick-count-start': {
    id: 'quick-count-start',
    title: 'Start a quick count',
    tier: 'say',
    slots: [{ name: 'count list', required: true }],
    endpoint: 'POST /count-lists/:id/quick-counts',
    permission: 'ManageStockTake',
    roles: ['team-member', 'manager'],
    confirm: { title: 'Start a quick count', body: '{list}: {n} items to count.', button: 'Start count' },
    toast: 'Quick count started',
    undo: 'Discard the open count ("Discard this quick count?").',
    rules: [
      'A quick count needs a count list.',
      'Starting when one is open on that list carries on with it.',
      'Blocked while a full stocktake is being counted: "A stocktake is being counted at this site. Submit it first, then come back to this quick count."',
      'Submitting updates on hand for counted items only, and does not change COGS.',
    ],
    main: [
      'backend/src/modules/quick-count/count-list.controller.ts',
      'backend/src/modules/quick-count/quick-count.controller.ts',
      'backend/src/modules/quick-count/quick-count.service.ts',
      'web/src/features/quick-count/counting/use-quick-count-controller.ts',
    ],
  },

  'checklist-answer': {
    id: 'checklist-answer',
    title: 'Answer a checklist question',
    tier: 'say',
    slots: [
      { name: 'checklist', required: false, default: 'the open checklist that has the question' },
      { name: 'question', required: true },
      { name: 'answer', required: true },
    ],
    endpoint: 'POST /checklists/:id/response/:logId',
    permission: 'AnswerChecklist',
    roles: ['team-member', 'manager'],
    confirm: { title: 'Save answer', body: '{question}: {answer}.', button: 'Save' },
    toast: 'Progress saved',
    undo: 'Answer again. Main lets a checklist be edited the same day.',
    rules: [
      'A tick is stored as yes or no. Temperatures must be between -100 and 1000 °C.',
      'Follow-up questions open when their rule fires, for example above 5 °C. A mandatory follow-up has to be answered before the checklist can be completed.',
      'Mandatory questions are only enforced on screen in Main.',
      'Saving one answer saves progress. It doesn\'t complete the checklist.',
    ],
    main: [
      'backend/src/modules/checklist/checklist.controller.ts',
      'backend/src/modules/checklist/checklistLog.service.ts',
      'backend/src/modules/access/handlers/checklist-response-permission.handler.ts',
      'web/src/features/checklists/USER-STORIES.md',
    ],
  },

  'basket-add': {
    id: 'basket-add',
    title: 'Add to the basket',
    tier: 'say',
    slots: [
      { name: 'product', required: true },
      { name: 'quantity', required: false, default: '1 pack' },
      { name: 'supplier', required: false, default: "the product's supplier" },
    ],
    endpoint: 'POST /predictive-orders/:id/items',
    permission: 'ManagePredictiveOrder',
    roles: ['manager'],
    refusal: 'Team members can\'t change orders. A manager can.',
    confirm: { title: 'Add to the order', body: 'Add {qty} to the {supplier} order.', button: 'Add' },
    toast: 'Added {product} to {supplier}.',
    undo: 'Take the line back off the order.',
    rules: [
      'Products already on the order are refused: "{name} is already on this order — change its quantity instead". Edify reads it without the dash.',
      'Products the order\'s supplier doesn\'t supply are refused.',
      'A line that was removed comes back instead of being added twice.',
      'Adding never sends. Sending is its own on-screen step: "Place these orders?" / "Once placed, an order can\'t be adjusted."',
    ],
    main: [
      'backend/src/modules/predictive-order/predictive-order.controller.ts',
      'backend/src/modules/predictive-order/ai/predictive-order-tools.ts',
      'web/src/features/predictive-ordering/USER-STORIES.md',
    ],
  },

  'delivery-accept': {
    id: 'delivery-accept',
    title: 'Accept a delivery',
    tier: 'show',
    slots: [
      { name: 'supplier', required: true },
      { name: 'item count', required: false },
      { name: 'missing or short lines', required: false, default: 'everything arrived' },
      { name: 'supplier reference', required: false },
    ],
    endpoint: 'PUT /deliveries/:id/accept',
    permission: 'UpdateDelivery',
    roles: ['team-member', 'manager'],
    confirm: {
      title: 'Confirm delivery receipt',
      body: 'Once confirmed, this updates your stock levels. Make any final adjustments before confirming.',
      button: 'Accept delivery',
    },
    toast: 'Delivery accepted',
    undo: 'None. An accepted delivery can\'t be un-accepted.',
    rules: [
      'Only orders that have gone to the supplier can be accepted.',
      'If the site needs a supplier reference, the delivery can\'t be accepted without one: "Delivery must include a Supplier Reference".',
      'The delivered date can\'t be before yesterday.',
      'Short lines: any remaining quantity stays pending.',
      'Request credit emails the supplier\'s accounts address, so it is always an on-screen choice.',
      'Edify checks the spoken item count against the PO. If they don\'t match, it stops and lists the lines.',
    ],
    main: [
      'backend/src/modules/delivery/delivery.controller.ts',
      'backend/src/modules/delivery/services/accept-delivery.service.ts',
      'backend/src/modules/delivery/dto/inbound.accept-delivery.dto.ts',
      'backend/src/modules/delivery/services/credit-note.service.ts',
    ],
    differs: ['Main can\'t close a short line without raising a credit request. The prototype lets it stay pending.'],
  },

  'transfer-send': {
    id: 'transfer-send',
    title: 'Send a transfer',
    tier: 'show',
    slots: [
      { name: 'items', required: true },
      { name: 'to site', required: true },
    ],
    endpoint: 'POST /transfers',
    permission: 'CreateTransfer',
    roles: ['team-member', 'manager'],
    confirm: {
      title: 'Are you sure you want to transfer these items?',
      body: 'Confirming sends this transfer and reduces your stock for these items. It doesn\'t wait for the receiving site to accept.',
      button: 'Send transfer',
      flaggedTitle: 'Send anyway?',
      flaggedButton: 'Send anyway',
    },
    toast: 'Transfer sent',
    undo: 'Cancel while pending ("Cancel this transfer?"). Stock comes back.',
    rules: [
      'Creating a transfer sends it. There is no draft in Main.',
      'Sending more than is on hand is allowed after "Send anyway?".',
    ],
    main: [
      'backend/src/modules/transfer/transfer.controller.ts',
      'backend/src/modules/transfer/transfer.service.ts',
      'backend/src/modules/transfer/services/transfer-validation.service.ts',
      'web/src/features/transfers/USER-STORIES.md',
    ],
    differs: ['"Start a transfer" in Nina\'s list implies a draft. Main has none, so Edify stages the whole transfer and sends on confirm.'],
  },

  'transfer-accept': {
    id: 'transfer-accept',
    title: 'Accept an incoming transfer',
    tier: 'show',
    slots: [
      { name: 'from site', required: false, default: 'the only pending transfer' },
      { name: 'rejections', required: false, default: 'everything arrived' },
    ],
    endpoint: 'PUT /transfers/:id/accept',
    permission: 'UpdateTransfer',
    roles: ['team-member', 'manager'],
    confirm: {
      title: 'Accept this transfer?',
      body: 'Accepting will increase your stock levels for the items received.',
      button: 'Accept transfer',
    },
    toast: 'Transfer accepted',
    undo: 'None.',
    rules: [
      'Damaged, Temperature out of range and Quality issue are written off at the sending site.',
      'Incorrect item, Missing and Other go back to the sending site.',
      'A transfer can\'t be accepted before its sent date.',
      'Only the receiving site accepts.',
    ],
    main: [
      'backend/src/modules/transfer/transfer.controller.ts',
      'backend/src/modules/transfer/services/transfer-correction.service.ts',
      'web/src/features/transfers/USER-STORIES.md',
    ],
    differs: ['Main\'s server lets either site accept. The prototype only lets the receiving site.'],
  },

  'demand-adjustment': {
    id: 'demand-adjustment',
    title: 'Plan a busy or quiet day',
    tier: 'show',
    slots: [
      { name: 'dates', required: true },
      { name: 'percent of usual', required: true },
      { name: 'reason', required: true },
    ],
    endpoint: 'propose_demand_adjustment, then /approve',
    permission: 'ManagePredictiveOrder',
    roles: ['manager'],
    refusal: 'Their role cannot change predictive orders.',
    confirm: {
      title: 'One-off change',
      body: 'A one-off for those days only. Nothing changes until you confirm.',
      button: 'Confirm',
    },
    toast: 'One-off change saved',
    undo: 'Stage a new one at 100%, which cancels it.',
    rules: [
      'Starts from tomorrow at the earliest, covers 14 days at most, and starts no more than 28 days ahead.',
      '0 to 300% of usual. 100% cancels.',
      'People hear "one-off change", never "demand adjustment".',
    ],
    main: [
      'backend/src/modules/predictive-order/ai/propose-demand-adjustment.tool.ts',
      'backend/src/modules/predictive-order/demand-adjustments/demand-adjustment-proposals.service.ts',
      'backend/src/modules/predictive-order/demand-adjustments/demand-adjustments.controller.ts',
    ],
  },

  undo: {
    id: 'undo',
    title: 'Undo',
    tier: 'say',
    slots: [
      { name: 'which', required: false, default: 'the last thing Edify did' },
      { name: 'reason', required: false },
    ],
    endpoint: 'Depends on the task: DELETE /waste/:id, cancel transfer, remove basket line, discard quick count',
    permission: 'Same as the task being undone',
    roles: ['team-member', 'manager'],
    confirm: { title: 'Undo', body: '{headline}', button: 'Undo' },
    toast: 'Undone',
    undo: 'None.',
    rules: [
      'Undo follows what Main allows for each task. Where Main has no undo, Edify says so and offers the manual fix.',
      'Undoing waste needs a reason.',
    ],
    main: ['backend/src/common/ai/staged.ts'],
  },
};

/** Read-only questions. They stage nothing. */
export const ASK_TOPICS = [
  'What\'s on hand of an item, and against par',
  'What\'s arriving today',
  'What\'s left to make on the bench and hot station',
  'What allergens a recipe has',
] as const;

export function taskTitle(id: FloorTaskId): string {
  return FLOOR_TASKS[id].title;
}
