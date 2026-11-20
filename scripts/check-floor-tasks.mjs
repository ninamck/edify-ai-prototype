// Checks the floor-task tools and the site store against Edify Main's rules,
// without a model: each case calls a tool the way the model would.
// Run with: node scripts/check-floor-tasks.mjs

import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { createJiti } from 'jiti';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const jiti = createJiti(import.meta.url, { alias: { '@/': `${root}/` } });

const store = await jiti.import('../lib/floorTasks/world/store.ts');
const { createScope } = await jiti.import('../lib/floorTasks/tools/scope.ts');
const { floorTools } = await jiti.import('../lib/floorTasks/tools/index.ts');

let passed = 0;

async function call(name, args, patch = {}) {
  const snap = { ...store.buildSnapshot(), ...patch };
  const scope = createScope(snap);
  const def = floorTools(scope).find((t) => t.name === name);
  const out = JSON.parse((await def.handler(args)).content[0].text);
  return { out, proposals: scope.proposals };
}

function check(label, fn) {
  return Promise.resolve(fn()).then(() => {
    passed += 1;
    console.log(`  ok  ${label}`);
  });
}

function stock(id) {
  return store.getWorld().stock[store.getWorld().siteId].find((r) => r.id === id);
}

async function stageAndConfirm(name, args, patch) {
  const { out, proposals } = await call(name, args, patch);
  assert.equal(out.staged, true, `${name} should stage: ${JSON.stringify(out)}`);
  store.addProposals(proposals);
  const res = store.confirmProposal(proposals[0].id);
  assert.equal(res.ok, true, JSON.stringify(res));
  return { out, proposal: proposals[0], receipt: res.receipt };
}

console.log('Waste');
await check('3 croissants out of date converts to boxes and lowers stock', async () => {
  const before = stock('ing-croissants').onHand;
  const { proposal, receipt } = await stageAndConfirm('stage_waste', { lines: [{ item: 'croissants', quantity: 3, reason: 'Beyond expiry date' }] });
  assert.equal(proposal.payload.lines[0].unit, 'units');
  assert.ok(Math.abs(proposal.payload.lines[0].qtyInStockUnit - 0.25) < 1e-9);
  assert.ok(Math.abs(stock('ing-croissants').onHand - (before - 0.25)) < 1e-9);
  assert.equal(receipt.undo.kind, 'delete-with-reason');
});
await check('30 croissants is flagged as unusually large', async () => {
  const { out } = await call('stage_waste', { lines: [{ item: 'croissants', quantity: 30 }] });
  assert.ok(out.warnings.some((w) => w.includes('far more than usual')));
});
await check('three days ago is refused', async () => {
  const { out } = await call('stage_waste', { lines: [{ item: 'croissants', quantity: 1 }], date: '2020-01-01' });
  assert.ok(out.refused);
});
await check('missing quantity asks', async () => {
  const { out } = await call('stage_waste', { lines: [{ item: 'oat milk' }] });
  assert.match(out.question, /How many Oat Milk/);
});
await check('undo needs a reason, then puts stock back', async () => {
  const before = stock('ing-chicken').onHand;
  await stageAndConfirm('stage_waste', { lines: [{ item: 'chicken breast', quantity: 2, unit: 'breasts', reason: 'Damaged' }] });
  assert.ok(Math.abs(stock('ing-chicken').onHand - (before - 0.4)) < 1e-9);
  const noReason = await call('undo_last', {});
  assert.equal(noReason.out.question, 'Why are you deleting this?');
  await stageAndConfirm('undo_last', { reason: 'wrong item' });
  assert.ok(Math.abs(stock('ing-chicken').onHand - before) < 1e-9);
});

console.log('On hand');
await check('manager: 5 chicken breasts sets 1 kg', async () => {
  store.setRole('manager');
  const { proposal } = await stageAndConfirm('set_on_hand', { item: 'chicken breasts', quantity: 5 });
  assert.equal(proposal.payload.route, 'set-on-hand');
  assert.equal(stock('ing-chicken').onHand, 1);
});
await check('team member goes in as a quick count on the walk-in list', async () => {
  store.setRole('team-member');
  const { proposal } = await stageAndConfirm('set_on_hand', { item: 'chicken', quantity: 2, unit: 'kg' });
  assert.equal(proposal.payload.route, 'quick-count');
  assert.equal(proposal.payload.countListName, 'Walk-in fridge');
  assert.equal(stock('ing-chicken').onHand, 2);
});
await check('team member, item on no count list, is refused', async () => {
  const { out } = await call('set_on_hand', { item: 'surface sanitiser', quantity: 3 });
  assert.match(out.refused, /isn't on a count list/);
});
await check('team member during a stocktake is refused with Main copy', async () => {
  const { out } = await call('set_on_hand', { item: 'chicken', quantity: 2, unit: 'kg' }, { stocktakeInProgress: true });
  assert.match(out.refused, /stocktake is being counted/);
});
await check('restage undo sets it back', async () => {
  store.setRole('manager');
  await stageAndConfirm('undo_last', {});
  assert.equal(stock('ing-chicken').onHand, 1);
});

console.log('Hot production');
await check('add 6 toasties to the batch on now, cumulative', async () => {
  const current = store.getWorld().hot.batches.find((b) => b.when === 'current');
  const before = current.lines.find((l) => l.recipeId === 'hot-toastie').made ?? 0;
  const { proposal } = await stageAndConfirm('add_to_hot_batch', { lines: [{ recipe: 'toasties', quantity: 6 }] });
  assert.equal(proposal.payload.lines[0].newMade, before + 6);
  const after = store.getWorld().hot.batches.find((b) => b.id === current.id).lines.find((l) => l.recipeId === 'hot-toastie').made;
  assert.equal(after, before + 6);
});
await check('a recipe not on the batch is refused', async () => {
  const { out } = await call('add_to_hot_batch', { lines: [{ recipe: 'banana bread', quantity: 2 }] });
  assert.ok(out.refused);
});
await check('a cold-bench recipe is refused with the bench reason', async () => {
  const { out } = await call('add_to_hot_batch', { lines: [{ recipe: 'caesar wraps', quantity: 10 }] });
  assert.match(out.refused, /bench runs can't be added to/);
});
await check('PCR on is refused', async () => {
  const snap = store.buildSnapshot();
  const { out } = await call('add_to_hot_batch', { lines: [{ recipe: 'toastie', quantity: 1 }] }, { hot: { ...snap.hot, pcrOn: true } });
  assert.match(out.refused, /PCR/);
});

console.log('Bench');
await check('egg mayo cannot start before the hummus wrap', async () => {
  const { out } = await call('mark_production', { recipe: 'egg mayo', action: 'start' });
  assert.match(out.refused, /Finish/);
});
await check('caesar wraps done completes the started run', async () => {
  const { proposal } = await stageAndConfirm('mark_production', { recipe: 'caesar wraps', action: 'done' });
  assert.equal(proposal.payload.action, 'complete');
});
await check('done on an unstarted run starts and completes it', async () => {
  const { proposal } = await stageAndConfirm('mark_production', { recipe: 'hummus wrap', action: 'done' });
  assert.equal(proposal.payload.action, 'start-and-complete');
});

console.log('Par, request, quick count');
await check('team member cannot set par', async () => {
  store.setRole('team-member');
  const { out } = await call('set_par_level', { item: 'oat milk', par: 12 });
  assert.ok(out.refused);
  store.setRole('manager');
});
await check('manager sets par', async () => {
  await stageAndConfirm('set_par_level', { item: 'oat milk', par: 12 });
  assert.equal(stock('ing-oatmilk').par, 12);
});
await check('request oat milk from Kings Cross', async () => {
  const { proposal } = await stageAndConfirm('request_stock', { fromSite: 'kings cross', lines: [{ item: 'oat milk', quantity: 6, unit: 'litres' }] });
  assert.equal(proposal.payload.fulfillingSiteId, 'fitzroy-kings-cross');
});
await check('start a count of the walk in, then resume it', async () => {
  await stageAndConfirm('start_quick_count', { countList: 'the walk in' });
  const again = await call('start_quick_count', { countList: 'walk-in fridge' });
  assert.equal(again.proposals[0].payload.resume, true);
});

console.log('Checklist');
await check('sandwich fridge 3 degrees', async () => {
  const { proposal } = await stageAndConfirm('answer_checklist', { question: 'sandwich fridge', answer: '3 degrees' });
  assert.equal(proposal.payload.answer, '3');
});
await check('walk-in at 6 opens the mandatory follow-up', async () => {
  const { out } = await call('answer_checklist', { question: 'walk-in cool room', answer: '6' });
  assert.match(out.question, /follow-up/);
  const withFollow = await call('answer_checklist', { question: 'walk-in cool room', answer: '6', followUpAnswer: 'Moved stock to fridge 2, told Ed' });
  assert.equal(withFollow.out.staged, true);
});
await check('labels not checked opens the follow-up', async () => {
  const { out } = await call('answer_checklist', { question: 'labels checked for use-by dates', answer: 'no' });
  assert.match(out.question, /expired or missing use-by/);
});
await check('1200 degrees is out of range', async () => {
  const { out } = await call('answer_checklist', { question: 'drinks fridge', answer: '1200' });
  assert.match(out.question, /-100 and 1000/);
});

console.log('Basket');
await check('oat milk is already on Bidvest: Main error', async () => {
  const { out } = await call('add_to_basket', { product: 'oat milk', quantity: 2 });
  assert.match(out.refused, /already on this order, change its quantity instead/);
});
await check('smoked salmon was removed: comes back', async () => {
  const { proposal } = await stageAndConfirm('add_to_basket', { product: 'smoked salmon', quantity: 1 });
  assert.equal(proposal.payload.restoresRemoved, true);
});
await check('butter named against Bidvest: not supplied', async () => {
  const { out } = await call('add_to_basket', { product: 'butter', supplier: 'bidvest' });
  assert.match(out.refused, /not supplied by this order's supplier/);
});
await check('10 kg of chicken rounds up to 2 bags', async () => {
  const lines = store.getWorld().basket.orders.find((o) => o.supplierId === 'sup-bidvest').lines;
  const chicken = lines.find((l) => l.productId === 'chicken');
  chicken.removed = true;
  const { out } = await call('add_to_basket', { product: 'chicken breast', quantity: 10, unit: 'kg' });
  assert.equal(out.staged, true);
  chicken.removed = false;
});
await check('team member cannot add to the basket', async () => {
  store.setRole('team-member');
  const { out } = await call('add_to_basket', { product: 'lemons', quantity: 1 });
  assert.ok(out.refused);
  store.setRole('manager');
});

console.log('Delivery');
await check('Notora, 12 items, none missing: matches the Natoora PO', async () => {
  const { out, proposals } = await call('accept_delivery', { supplier: 'Notora', itemCount: 12, noneMissing: true });
  assert.equal(out.staged, true);
  assert.equal(proposals[0].payload.supplierName, 'Natoora');
  assert.equal(proposals[0].payload.lines.length, 12);
});
await check('11 items stops and lists the lines', async () => {
  const { out } = await call('accept_delivery', { supplier: 'natoora', itemCount: 11 });
  assert.equal(out.mismatch, true);
});
await check('short line stays pending, stock goes up for the rest', async () => {
  const before = stock('ing-avocado').onHand;
  const { proposal } = await stageAndConfirm('accept_delivery', { supplier: 'natoora', short: [{ item: 'burrata', received: 6 }] });
  assert.ok(proposal.warnings.includes('Any remaining quantity stays pending.'));
  assert.equal(stock('ing-avocado').onHand, before + 24);
});
await check('reference required blocks the write', async () => {
  store.setReferenceRequired(true);
  const { proposals } = await call('accept_delivery', { supplier: 'bidfood' });
  store.addProposals(proposals);
  const res = store.confirmProposal(proposals[0].id);
  assert.equal(res.ok, false);
  assert.equal(res.error, 'Delivery must include a Supplier Reference');
  store.setReferenceRequired(false);
});

console.log('Transfers');
await check('send 4 kilos of chicken to Islington takes stock now, cancel puts it back', async () => {
  const before = stock('ing-chicken').onHand;
  const { out } = await stageAndConfirm('send_transfer', { toSite: 'islington', lines: [{ item: 'chicken', quantity: 4, unit: 'kilos' }] });
  assert.ok(out.warnings.some((w) => w.includes('More Chicken Breast than you have')));
  assert.equal(stock('ing-chicken').onHand, before - 4);
  await stageAndConfirm('undo_last', {});
  assert.equal(stock('ing-chicken').onHand, before);
});
await check('accept Kings Cross with damaged oat milk', async () => {
  const before = stock('ing-oatmilk').onHand;
  const { proposal } = await stageAndConfirm('accept_transfer', { fromSite: 'kings cross', rejections: [{ item: 'oat milk', quantity: 2, reason: 'Damaged' }] });
  assert.equal(proposal.payload.lines[0].received, 4);
  assert.equal(stock('ing-oatmilk').onHand, before + 4);
});
await check('the Heathrow transfer is dated tomorrow: refused', async () => {
  const { out } = await call('accept_transfer', { fromSite: 'heathrow' });
  assert.match(out.refused, /can't be accepted before then/);
});

console.log('One-off day');
await check('today is refused, 150% Saturday market stages', async () => {
  const today = store.getWorld().today;
  const { out: refused } = await call('plan_one_off_day', { startDate: today, percentOfUsual: 150, reason: 'market' });
  assert.match(refused.refused, /tomorrow at the earliest/);
  const d = new Date();
  d.setDate(d.getDate() + 3);
  const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const { out } = await call('plan_one_off_day', { startDate: iso, percentOfUsual: 150, reason: 'Charlotte Street market' });
  assert.equal(out.staged, true);
  assert.equal(out.tier, 'show');
});

console.log('Ask');
await check('allergens for the caesar wrap', async () => {
  const { out } = await call('recipe_allergens', { recipe: 'caesar wrap' });
  assert.ok(out.contains.includes('Fish'));
});
await check('on hand of oat milk', async () => {
  const { out } = await call('look_up_stock', { items: ['oat milk'] });
  assert.equal(out.items[0].name, 'Oat Milk');
});

console.log(`\n${passed} checks passed`);
