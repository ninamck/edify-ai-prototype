import { addDaysIso } from './format';
import type { FloorTaskId, Role } from './types';

/**
 * Test phrases for /dev/floor-tasks. Each says which tool the model
 * should call. Where a case has args, the page can also stage that call
 * directly, without the model, to check the card and the rules.
 */
export interface EvalCase {
  phrase: string;
  tool: string;
  args?: Record<string, unknown> | ((today: string) => Record<string, unknown>);
  role?: Role;
  /** What should happen, when it isn't simply "stages". */
  expect?: string;
}

export interface EvalSet {
  id: FloorTaskId | 'ask' | 'other';
  title: string;
  cases: EvalCase[];
}

export const EVAL_SETS: EvalSet[] = [
  {
    id: 'waste',
    title: 'Log waste',
    cases: [
      { phrase: '3 croissants out of date', tool: 'stage_waste', args: { lines: [{ item: 'croissants', quantity: 3, reason: 'Beyond expiry date' }] } },
      { phrase: 'I dropped 2 chicken breasts', tool: 'stage_waste', args: { lines: [{ item: 'chicken breast', quantity: 2, unit: 'breasts', reason: 'Damaged' }] } },
      { phrase: 'bin 30 croissants, stale', tool: 'stage_waste', args: { lines: [{ item: 'croissants', quantity: 30, reason: 'No longer fresh' }] }, expect: 'Flagged as far more than usual' },
      { phrase: 'half a litre of oat milk went off', tool: 'stage_waste', args: { lines: [{ item: 'oat milk', quantity: 0.5, unit: 'L', reason: 'No longer fresh' }] } },
      { phrase: '2 blueberry muffins and a sourdough loaf for staff lunch', tool: 'stage_waste', args: { lines: [{ item: 'blueberry muffins', quantity: 2, reason: 'Used by Staff' }, { item: 'sourdough loaf', quantity: 1, reason: 'Used by Staff' }] } },
      { phrase: 'waste some oat milk', tool: 'stage_waste', args: { lines: [{ item: 'oat milk' }] }, expect: 'Asks how many' },
      { phrase: '4 bananas to Too Good To Go', tool: 'stage_waste', args: { lines: [{ item: 'bananas', quantity: 4, reason: 'Third Party food waste app' }] } },
      { phrase: 'yesterday we threw out 6 bagels', tool: 'stage_waste', args: { lines: [{ item: 'plain bagels', quantity: 6 }], date: 'yesterday' } },
      { phrase: 'log 5 eggs as waste from last Monday', tool: 'stage_waste', role: 'team-member', args: { lines: [{ item: 'eggs', quantity: 5 }], date: '2020-01-01' }, expect: 'Team member: refused unless Monday was today or yesterday' },
      { phrase: 'binned 4 croissants 3 days ago, out of date', tool: 'stage_waste', role: 'manager', expect: 'Manager: card dated 3 days ago' },
      { phrase: 'we threw out 2 sourdough loaves on the day before yesterday', tool: 'stage_waste', role: 'manager', expect: 'Manager: card dated 2 days ago' },
      { phrase: 'spilt a carton of whole milk', tool: 'stage_waste' },
      { phrase: 'chuck the mixed berries, about 300 grams, mouldy', tool: 'stage_waste' },
      { phrase: '1 chicken avo sandwich past its date', tool: 'stage_waste' },
    ],
  },
  {
    id: 'on-hand',
    title: 'Update on hand',
    cases: [
      { phrase: 'I have 5 chicken breasts on hand', tool: 'set_on_hand', role: 'manager', args: { item: 'chicken breast', quantity: 5, unit: 'breasts' } },
      { phrase: 'we\'ve got 2 kilos of chicken', tool: 'set_on_hand', role: 'manager', args: { item: 'chicken', quantity: 2, unit: 'kg' } },
      { phrase: 'oat milk is at 4 litres', tool: 'set_on_hand', role: 'manager', args: { item: 'oat milk', quantity: 4, unit: 'L' } },
      { phrase: 'there are 5 chicken breasts left', tool: 'set_on_hand', role: 'team-member', args: { item: 'chicken breast', quantity: 5, unit: 'breasts' }, expect: 'Team member: becomes a quick count on Walk-in fridge' },
      { phrase: 'we\'re out of spinach', tool: 'set_on_hand', role: 'manager', args: { item: 'baby spinach', quantity: 0 } },
      { phrase: 'set croissants to 2 boxes', tool: 'set_on_hand', role: 'manager', args: { item: 'croissants', quantity: 2, unit: 'boxes' } },
      { phrase: 'chicken on hand is wrong', tool: 'set_on_hand', role: 'manager', args: { item: 'chicken breast' }, expect: 'Asks how many' },
      { phrase: 'just counted 12 cokes', tool: 'set_on_hand' },
      { phrase: 'only 3 avocados in the fridge', tool: 'set_on_hand' },
      { phrase: 'update butter to 1.5 kg', tool: 'set_on_hand' },
      { phrase: 'we have 8 sourdough loaves', tool: 'set_on_hand' },
    ],
  },
  {
    id: 'hot-add',
    title: 'Add to a hot batch',
    cases: [
      { phrase: 'add 6 toasties', tool: 'add_to_hot_batch', args: { lines: [{ recipe: 'toastie', quantity: 6 }] } },
      { phrase: '4 more sausage rolls to the current batch', tool: 'add_to_hot_batch', args: { lines: [{ recipe: 'sausage roll', quantity: 4 }] } },
      { phrase: 'put 3 hot chicken wraps and 2 soups on', tool: 'add_to_hot_batch', args: { lines: [{ recipe: 'hot chicken wrap', quantity: 3 }, { recipe: 'tomato soup', quantity: 2 }] } },
      { phrase: 'add 5 toasties to the 9 o\'clock', tool: 'add_to_hot_batch', args: { lines: [{ recipe: 'toastie', quantity: 5 }], batch: '9' }, expect: 'Refused: only the current or next batch' },
      { phrase: 'add 2000 sausage rolls', tool: 'add_to_hot_batch', args: { lines: [{ recipe: 'sausage roll', quantity: 2000 }] }, expect: 'Refused: 1000 at most' },
      { phrase: 'add a pesto pasta to the hot counter', tool: 'add_to_hot_batch', args: { lines: [{ recipe: 'pesto pasta', quantity: 1 }] }, expect: 'Refused: not on the batch' },
      { phrase: 'more toasties', tool: 'add_to_hot_batch', args: { lines: [{ recipe: 'toastie' }] }, expect: 'Asks how many' },
      { phrase: 'we made 4 extra soups', tool: 'add_to_hot_batch' },
      { phrase: 'throw on another 6 ham and cheese', tool: 'add_to_hot_batch' },
      { phrase: 'next batch, 3 sausage rolls', tool: 'add_to_hot_batch' },
    ],
  },
  {
    id: 'production-step',
    title: 'Mark production started or done',
    cases: [
      { phrase: 'Caesar wraps are done', tool: 'mark_production', args: { recipe: 'chicken caesar wrap', action: 'done' } },
      { phrase: 'starting the hummus wraps', tool: 'mark_production', args: { recipe: 'hummus wrap', action: 'start' } },
      { phrase: 'egg mayo done', tool: 'mark_production', args: { recipe: 'egg mayo', action: 'done' }, expect: 'Earlier run not done: refused in sequence' },
      { phrase: 'chicken avo is finished', tool: 'mark_production', args: { recipe: 'chicken avo sandwich', action: 'done' }, expect: 'Already done' },
      { phrase: 'finished the wraps', tool: 'mark_production', expect: 'Asks which wrap' },
      { phrase: 'we\'ve started on the egg mayo', tool: 'mark_production' },
      { phrase: 'Caesar wraps all made', tool: 'mark_production' },
      { phrase: 'kick off the hummus and roast veg', tool: 'mark_production' },
      { phrase: 'sandwich bench, wraps done', tool: 'mark_production' },
      { phrase: 'mark the caesar wrap complete', tool: 'mark_production' },
    ],
  },
  {
    id: 'par-level',
    title: 'Set a par',
    cases: [
      { phrase: 'set par for oat milk to 12 litres', tool: 'set_par_level', role: 'manager', args: { item: 'oat milk', par: 12, unit: 'L' } },
      { phrase: 'croissant par 4 boxes', tool: 'set_par_level', role: 'manager', args: { item: 'croissants', par: 4, unit: 'boxes' } },
      { phrase: 'par for chicken should be 5 kg', tool: 'set_par_level', role: 'team-member', args: { item: 'chicken breast', par: 5, unit: 'kg' }, expect: 'Refused: managers only' },
      { phrase: 'we never need spinach, par zero', tool: 'set_par_level', role: 'manager', args: { item: 'baby spinach', par: 0 } },
      { phrase: 'raise the par on lids', tool: 'set_par_level', role: 'manager', args: { item: 'coffee cup lids' }, expect: 'Asks what to' },
      { phrase: 'keep 20 cokes as par', tool: 'set_par_level' },
      { phrase: 'par level for bagels, 3 bags', tool: 'set_par_level' },
      { phrase: 'drop whole milk par to 10 litres', tool: 'set_par_level' },
      { phrase: 'make the par for eggs 60', tool: 'set_par_level' },
      { phrase: 'butter par 2 kilos', tool: 'set_par_level' },
    ],
  },
  {
    id: 'transfer-request',
    title: 'Request stock from another site',
    cases: [
      { phrase: 'ask King\'s Cross for 6 litres of oat milk', tool: 'request_stock', args: { fromSite: 'King\'s Cross', lines: [{ item: 'oat milk', quantity: 6, unit: 'L' }] } },
      { phrase: 'can Islington send us 2 boxes of croissants', tool: 'request_stock', args: { fromSite: 'Islington', lines: [{ item: 'croissants', quantity: 2, unit: 'boxes' }] } },
      { phrase: 'request 10 avocados', tool: 'request_stock', args: { lines: [{ item: 'avocados', quantity: 10 }] }, expect: 'Asks which site' },
      { phrase: 'we need some coconut milk from Heathrow', tool: 'request_stock' },
      { phrase: 'borrow 3 kilos of chicken from King\'s Cross', tool: 'request_stock' },
      { phrase: 'get 2 bags of bagels off Islington', tool: 'request_stock' },
      { phrase: 'ask Heathrow for butter and eggs', tool: 'request_stock', expect: 'Asks how many' },
      { phrase: 'request stock from King\'s Cross: 12 cokes', tool: 'request_stock' },
      { phrase: 'could Islington spare some lids', tool: 'request_stock' },
      { phrase: 'put in a request to Heathrow for 4 litres whole milk', tool: 'request_stock' },
    ],
  },
  {
    id: 'quick-count-start',
    title: 'Start a quick count',
    cases: [
      { phrase: 'start a quick count on the walk-in', tool: 'start_quick_count', args: { countList: 'walk-in fridge' } },
      { phrase: 'count the dry store', tool: 'start_quick_count', args: { countList: 'dry store' } },
      { phrase: 'quick count please', tool: 'start_quick_count', args: {}, expect: 'Asks which list' },
      { phrase: 'let\'s count the bakery shelf', tool: 'start_quick_count' },
      { phrase: 'open a count for the drinks fridge', tool: 'start_quick_count' },
      { phrase: 'I want to count the fridge', tool: 'start_quick_count', expect: 'Asks which fridge' },
      { phrase: 'begin the walk-in count', tool: 'start_quick_count' },
      { phrase: 'spot check the drinks', tool: 'start_quick_count' },
      { phrase: 'quick count of the bakery', tool: 'start_quick_count' },
      { phrase: 'start counting dry store now', tool: 'start_quick_count' },
    ],
  },
  {
    id: 'checklist-answer',
    title: 'Answer a checklist item',
    cases: [
      { phrase: 'walk-in is 3 degrees', tool: 'answer_checklist', args: { question: 'walk-in cool room temperature', answer: '3' } },
      { phrase: 'sandwich fridge reading 6 degrees', tool: 'answer_checklist', args: { question: 'sandwich fridge temperature', answer: '6' }, expect: 'Asks the follow-up' },
      { phrase: 'labels all checked', tool: 'answer_checklist', args: { question: 'labels checked for use-by dates', answer: 'yes' } },
      { phrase: 'food is stored and labelled', tool: 'answer_checklist', args: { question: 'all food stored correctly and labelled', answer: 'yes', checklist: 'closing checks' } },
      { phrase: 'drinks fridge 4', tool: 'answer_checklist' },
      { phrase: 'cleaning\'s done for closing', tool: 'answer_checklist' },
      { phrase: 'no incidents today', tool: 'answer_checklist' },
      { phrase: 'display fridge is at 7, moved the yoghurts to the walk-in', tool: 'answer_checklist' },
      { phrase: 'handwash stations are stocked', tool: 'answer_checklist' },
      { phrase: 'seating area tidy, yes', tool: 'answer_checklist' },
      { phrase: 'fridge temp is fine', tool: 'answer_checklist', expect: 'Asks which fridge and the reading' },
    ],
  },
  {
    id: 'basket-add',
    title: 'Add to the basket',
    cases: [
      { phrase: 'add 2 cases of oat milk to the Bidvest order', tool: 'add_to_basket', args: { product: 'oat milk', quantity: 2, unit: 'cases', supplier: 'Bidvest' } },
      { phrase: 'order 3 kilos of chicken breast', tool: 'add_to_basket', args: { product: 'chicken breast', quantity: 3, unit: 'kg' } },
      { phrase: 'put whipping cream in the basket', tool: 'add_to_basket', args: { product: 'whipping cream' }, expect: 'Asks how many' },
      { phrase: 'add gruyère to the Bidvest order', tool: 'add_to_basket', args: { product: 'gruyère', quantity: 1, supplier: 'Bidvest' }, expect: 'Refused: not supplied by this order\'s supplier' },
      { phrase: 'we need 2 more bags of bread flour', tool: 'add_to_basket' },
      { phrase: 'chuck some avocados on the next order', tool: 'add_to_basket' },
      { phrase: 'add 4 smoked salmon to Bidvest', tool: 'add_to_basket' },
      { phrase: 'basket: butter, 2 blocks', tool: 'add_to_basket' },
      { phrase: 'one more case of coconut milk please', tool: 'add_to_basket' },
      { phrase: 'mature cheddar for the cheese board order, 2', tool: 'add_to_basket' },
    ],
  },
  {
    id: 'delivery-accept',
    title: 'Accept a delivery',
    cases: [
      { phrase: 'Natoora delivery is here, 12 items, none missing', tool: 'accept_delivery', args: { supplier: 'Natoora', itemCount: 12, noneMissing: true } },
      { phrase: 'Natoora\'s arrived, 11 items', tool: 'accept_delivery', args: { supplier: 'Natoora', itemCount: 11 }, expect: 'Stops: count doesn\'t match, lists the lines' },
      { phrase: 'Bidfood delivery in, all there, invoice INV-55821', tool: 'accept_delivery', args: { supplier: 'Bidfood', noneMissing: true, supplierReference: 'INV-55821' } },
      { phrase: 'just got a delivery for 4 from Notora, it has 12 items and none are missing', tool: 'accept_delivery' },
      { phrase: 'Natoora is here but the basil didn\'t come', tool: 'accept_delivery' },
      { phrase: 'accept the Metro order', tool: 'accept_delivery' },
      { phrase: 'Bidfood came, short 2 on the milk', tool: 'accept_delivery' },
      { phrase: 'receive the Fresh Direct delivery', tool: 'accept_delivery', expect: 'Due tomorrow: asks' },
      { phrase: 'delivery from Natoora, everything\'s fine', tool: 'accept_delivery' },
      { phrase: 'the veg delivery is here', tool: 'accept_delivery', expect: 'Asks which supplier' },
    ],
  },
  {
    id: 'transfer-send',
    title: 'Start a transfer',
    cases: [
      { phrase: 'send 4 litres of oat milk to King\'s Cross', tool: 'send_transfer', args: { toSite: 'King\'s Cross', lines: [{ item: 'oat milk', quantity: 4, unit: 'L' }] } },
      { phrase: 'transfer 2 boxes of croissants to Islington', tool: 'send_transfer', args: { toSite: 'Islington', lines: [{ item: 'croissants', quantity: 2, unit: 'boxes' }] } },
      { phrase: 'send 500 croissants to Heathrow', tool: 'send_transfer', args: { toSite: 'Heathrow', lines: [{ item: 'croissants', quantity: 500 }] }, expect: 'Over on hand: Send anyway?' },
      { phrase: 'move some chicken to King\'s Cross', tool: 'send_transfer', expect: 'Asks how much' },
      { phrase: 'Islington needs 6 cokes, send them', tool: 'send_transfer' },
      { phrase: 'transfer 3 kilos of butter to Heathrow', tool: 'send_transfer' },
      { phrase: 'send King\'s Cross 10 bagels and 2 litres of milk', tool: 'send_transfer' },
      { phrase: 'start a transfer to Islington', tool: 'send_transfer', expect: 'Asks what' },
      { phrase: 'give Heathrow 1 case of coconut milk', tool: 'send_transfer' },
      { phrase: 'send the spare avocados over to King\'s Cross', tool: 'send_transfer' },
    ],
  },
  {
    id: 'transfer-accept',
    title: 'Accept an incoming transfer',
    cases: [
      { phrase: 'accept the transfer from King\'s Cross', tool: 'accept_transfer', args: { fromSite: 'King\'s Cross' } },
      { phrase: 'King\'s Cross transfer is in, 2 coconut milk were damaged', tool: 'accept_transfer', args: { fromSite: 'King\'s Cross', rejections: [{ item: 'coconut milk', quantity: 2, reason: 'Damaged' }] } },
      { phrase: 'accept the Heathrow transfer', tool: 'accept_transfer', args: { fromSite: 'Heathrow' }, expect: 'Refused: not sent until tomorrow' },
      { phrase: 'the oat milk from King\'s Cross arrived warm', tool: 'accept_transfer' },
      { phrase: 'take in TR-1042', tool: 'accept_transfer' },
      { phrase: 'transfer\'s arrived, all fine', tool: 'accept_transfer' },
      { phrase: 'accept King\'s Cross but send back the coconut milk, we didn\'t ask for it', tool: 'accept_transfer' },
      { phrase: 'receive the stock from King\'s Cross', tool: 'accept_transfer' },
      { phrase: 'King\'s Cross sent too much oat milk, return 2 litres', tool: 'accept_transfer' },
      { phrase: 'got the transfer, one coconut milk was leaking', tool: 'accept_transfer' },
    ],
  },
  {
    id: 'demand-adjustment',
    title: 'One-off busy or quiet day',
    cases: [
      { phrase: 'Saturday will be twice as busy, there\'s a market', tool: 'plan_one_off_day', args: (today) => ({ startDate: addDaysIso(today, ((6 - new Date(`${today}T12:00:00`).getDay() + 7) % 7) || 7), percentOfUsual: 200, reason: 'Market' }) },
      { phrase: 'tomorrow will be quiet, half as busy', tool: 'plan_one_off_day', args: (today) => ({ startDate: addDaysIso(today, 1), percentOfUsual: 50 }) },
      { phrase: 'today will be busy', tool: 'plan_one_off_day', args: (today) => ({ startDate: today, percentOfUsual: 150 }), expect: 'Refused: tomorrow at the earliest' },
      { phrase: 'we\'re closed for a refit in two months', tool: 'plan_one_off_day', args: (today) => ({ startDate: addDaysIso(today, 60), percentOfUsual: 0 }), expect: 'Refused: 28 days ahead at most' },
      { phrase: 'next Friday expect 50% more', tool: 'plan_one_off_day' },
      { phrase: 'quiet week next week, about 70%', tool: 'plan_one_off_day' },
      { phrase: 'bank holiday Monday will be dead', tool: 'plan_one_off_day', expect: 'Asks how busy' },
      { phrase: 'big event on Thursday, triple it', tool: 'plan_one_off_day' },
      { phrase: 'roadworks outside tomorrow, plan for 80%', tool: 'plan_one_off_day' },
      { phrase: 'Sunday will be a normal day after all', tool: 'plan_one_off_day' },
    ],
  },
  {
    id: 'undo',
    title: 'Undo by voice',
    cases: [
      { phrase: 'undo that, wrong item', tool: 'undo_last', args: { reason: 'wrong item' }, expect: 'Needs something to undo first' },
      { phrase: 'scrap the last waste, counted twice', tool: 'undo_last', args: { which: 'waste', reason: 'counted twice' } },
      { phrase: 'cancel the transfer to King\'s Cross', tool: 'undo_last' },
      { phrase: 'take that back', tool: 'undo_last' },
      { phrase: 'undo the croissants', tool: 'undo_last' },
      { phrase: 'reverse the par change', tool: 'undo_last' },
      { phrase: 'forget the oat milk request', tool: 'undo_last' },
      { phrase: 'remove the oat milk from the basket', tool: 'undo_last' },
      { phrase: 'I didn\'t mean that', tool: 'undo_last' },
      { phrase: 'put the hot batch back to how it was', tool: 'undo_last' },
    ],
  },
  {
    id: 'ask',
    title: 'Ask it',
    cases: [
      { phrase: 'how much oat milk do we have', tool: 'look_up_stock', args: { items: ['oat milk'] } },
      { phrase: 'what\'s arriving today', tool: 'whats_arriving', args: {} },
      { phrase: 'what\'s left to make on the bench', tool: 'whats_left_to_make', args: {} },
      { phrase: 'does the caesar wrap have nuts', tool: 'recipe_allergens', args: { recipe: 'chicken caesar wrap' } },
      { phrase: 'how many croissants and bagels are left', tool: 'look_up_stock' },
      { phrase: 'when\'s the Natoora delivery', tool: 'whats_arriving' },
      { phrase: 'allergens in the toastie', tool: 'recipe_allergens' },
      { phrase: 'is the chicken avo sandwich gluten free', tool: 'recipe_allergens' },
      { phrase: 'what have I still got to do on the sandwich bench', tool: 'whats_left_to_make' },
      { phrase: 'are we low on spinach', tool: 'look_up_stock' },
    ],
  },
  {
    id: 'other',
    title: 'Not a floor task (hands to the chat)',
    cases: [
      { phrase: 'what was GP last week by site', tool: 'not_a_floor_task' },
      { phrase: 'chart waste by reason this month', tool: 'not_a_floor_task' },
      { phrase: 'add a new supplier with their catalogue', tool: 'not_a_floor_task' },
      { phrase: 'create a new recipe for avocado toast', tool: 'not_a_floor_task' },
      { phrase: 'how many covers did we do yesterday', tool: 'not_a_floor_task' },
      { phrase: 'set up the new shops', tool: 'not_a_floor_task' },
      { phrase: 'compare oat milk usage across sites', tool: 'not_a_floor_task' },
      { phrase: 'make me a production plan for next week', tool: 'not_a_floor_task' },
      { phrase: 'which supplier is cheapest for butter', tool: 'not_a_floor_task' },
      { phrase: 'show me the stocktake variance', tool: 'not_a_floor_task' },
    ],
  },
];
