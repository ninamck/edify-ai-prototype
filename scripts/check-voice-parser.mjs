// Checks the voice stocktake parser against the rules in the brief.
// Run with: node scripts/check-voice-parser.mjs
// (Node 23+ strips the TypeScript types from engine.ts on import.)

import assert from 'node:assert/strict';
import {
  applyActions,
  areaProgress,
  buildIndex,
  buildVoiceItem,
  describeQty,
  emptySession,
  parseUtterance,
  resolveQuestion,
} from '../components/Stock/voice/engine.ts';

const item = (id, name, stockUnit, alternateUnits = [], unitConversions, extra = {}) => ({
  id,
  name,
  variant: 'Test',
  type: 'product',
  supplierName: 'Bidvest',
  stockUnit,
  alternateUnits,
  unitConversions,
  ...extra,
});

const walkIn = [
  item('ing-oatmilk', 'Oat Milk', 'L', ['mL', 'units'], { units: 1 }),
  item('ing-chicken', 'Chicken Breast', 'kg', ['g', 'units'], { units: 0.2 }),
  item('ing-gruyere', 'Gruyère', 'kg', ['g']),
  item('fe-whole-milk', 'Whole Milk', 'L', ['mL', 'bottles'], { bottles: 2 }),
  item('fe-almond-milk', 'Almond Milk', 'L', ['mL', 'units'], { units: 1 }),
  item('fe-eggs', 'Free-range Eggs', 'units', ['trays'], { trays: 30 }),
  item('rc-chicken-avo', 'Chicken Avo Sandwich', 'units', ['portions'], { portions: 1 }),
  item('ing-avocado', 'Avocados', 'units', ['trays'], { trays: 25 }),
  item('mp-avocado', 'Avocado', 'each', [], undefined, {
    type: 'master-product',
    supplierVariants: [
      { id: 'v-freshearth', label: 'Fresh Earth', units: ['tray', 'each'], conv: { tray: 18 } },
      { id: 'v-barakat', label: 'Barakat', units: ['bag', 'each'], conv: { bag: 12 } },
    ],
  }),
];
const bar = [
  item('fe-coke', 'Coca-Cola Classic', 'cans', ['cases'], { cases: 24 }),
  item('fe-still-water', 'Still Water', 'bottles', ['cases'], { cases: 12 }),
  item('fe-sparkling', 'Sparkling Water', 'bottles', ['cases'], { cases: 12 }),
];
const dry = [
  item('ing-coconut-milk', 'Coconut Milk', 'units', ['cases'], { cases: 24 }),
  item('ing-flour', 'Bread Flour', 'kg', ['g', 'bags'], { bags: 12.5 }),
];
const freezer = [
  item('mp-vanilla-ice-cream', 'Vanilla Ice Cream', 'g', [], undefined, { noCountingUnit: true }),
];

const area = (id, name, items, phrases, walkOrder) => ({
  id,
  name,
  walkOrder,
  phrases,
  items: items.map(i => buildVoiceItem(i, id)),
});

const areas = [
  area('bar-fridge', 'Bar fridge', bar, [['bar', 'fridge'], ['bar']], 1),
  area('walk-in', 'Walk-in', walkIn, [['walk', 'in'], ['walkin']], 2),
  area('freezer', 'Freezer', freezer, [['freezer']], 3),
  area('dry-store', 'Dry store', dry, [['dry', 'store'], ['dry']], 4),
];
const index = buildIndex(areas);
const ctx = { index, currentAreaId: 'walk-in', now: '2026-10-03T10:00:00.000Z' };

function say(session, text, extra = {}) {
  const c = { ...ctx, ...extra };
  const open = session.questions.filter(q => q.areaId === c.currentAreaId).flatMap(q => q.candidates);
  const actions = parseUtterance(text, { ...c, openCandidates: open });
  return applyActions(session, actions, text, c);
}

const qty = (session, id) => session.captures[id]?.baseQty;
let passed = 0;
function check(name, fn) {
  fn();
  passed += 1;
  console.log(`  ok  ${name}`);
}

console.log('Voice parser checks');

check('compound quantity: two trays and six eggs is 66 eggs, 2.2 trays', () => {
  const r = say(emptySession(), 'two trays and six eggs');
  assert.equal(qty(r.session, 'fe-eggs'), 66);
  const v = index.items.get('fe-eggs');
  assert.deepEqual(describeQty(v, 66), { primary: '66 eggs', secondary: '2.2 trays' });
});

check('several items in one breath', () => {
  const r = say(emptySession(), 'fourteen kilos chicken, four kilos gruyère');
  assert.equal(qty(r.session, 'ing-chicken'), 14);
  assert.equal(qty(r.session, 'ing-gruyere'), 4);
});

check('quantity after the item name', () => {
  const r = say(emptySession(), 'chicken fourteen kilos gruyere four kilos');
  assert.equal(qty(r.session, 'ing-chicken'), 14);
  assert.equal(qty(r.session, 'ing-gruyere'), 4);
});

check('digits and decimals', () => {
  const r = say(emptySession(), '2.5 kg of gruyere');
  assert.equal(qty(r.session, 'ing-gruyere'), 2.5);
  const r2 = say(emptySession(), 'two point five kilos of chicken');
  assert.equal(qty(r2.session, 'ing-chicken'), 2.5);
  const r3 = say(emptySession(), 'two and a half kilos of chicken');
  assert.equal(qty(r3.session, 'ing-chicken'), 2.5);
});

check('ambiguity asks which one and blocks nothing', () => {
  const r = say(emptySession(), 'four litres of milk');
  assert.equal(r.heard.tone, 'ask');
  assert.equal(r.session.questions.length, 1);
  const q = r.session.questions[0];
  assert.deepEqual(new Set(q.candidates), new Set(['ing-oatmilk', 'fe-whole-milk', 'fe-almond-milk']));
  assert.equal(Object.keys(r.session.captures).length, 0);
  const resolved = resolveQuestion(r.session, q.id, 'ing-oatmilk', ctx);
  assert.equal(qty(resolved.session, 'ing-oatmilk'), 4);
  assert.equal(resolved.session.questions.length, 0);
});

check('saying a candidate name resolves the open question', () => {
  const r = say(emptySession(), 'four litres of milk');
  const r2 = say(r.session, 'oat milk');
  assert.equal(qty(r2.session, 'ing-oatmilk'), 4);
  assert.equal(r2.session.questions.length, 0);
});

check('unit words narrow the match: kilos means chicken breast, not the sandwich', () => {
  const r = say(emptySession(), 'three kilos of chicken');
  assert.equal(qty(r.session, 'ing-chicken'), 3);
  assert.equal(r.session.questions.length, 0);
});

check('unit word picks the master product variant', () => {
  const r = say(emptySession(), 'two bags of avocado');
  assert.equal(qty(r.session, 'mp-avocado'), 24);
  assert.deepEqual(r.session.captures['mp-avocado'].parts, [{ cell: 'v-barakat::bag', qty: 2 }]);
});

check('silence is not zero: unmentioned items stay uncounted', () => {
  const r = say(emptySession(), 'fourteen kilos chicken');
  assert.equal(r.session.captures['ing-gruyere'], undefined);
  const p = areaProgress(areas[1], r.session);
  assert.equal(p.counted, 1);
  assert.equal(p.uncounted.length, walkIn.length - 1);
});

check('none, no X and zero X write zero', () => {
  for (const line of ['no gruyere', 'none of the gruyere', 'zero gruyere', 'gruyere none', 'we are out of gruyere']) {
    const r = say(emptySession(), line);
    assert.equal(qty(r.session, 'ing-gruyere'), 0, line);
    assert.equal(r.session.captures['ing-gruyere'].status, 'none', line);
  }
});

check('corrections edit the most recent capture', () => {
  let s = say(emptySession(), 'four kilos of gruyere').session;
  s = say(s, 'actually make that three').session;
  assert.equal(qty(s, 'ing-gruyere'), 3);
  s = say(s, 'no, two').session;
  assert.equal(qty(s, 'ing-gruyere'), 2);
  s = say(s, 'scrap that').session;
  assert.equal(s.captures['ing-gruyere'], undefined);
});

check('naming an item again replaces its count; "more" adds', () => {
  let s = say(emptySession(), 'four kilos of gruyere').session;
  s = say(s, 'the gruyere is five kilos').session;
  assert.equal(qty(s, 'ing-gruyere'), 5);
  s = say(s, 'two more kilos of gruyere').session;
  assert.equal(qty(s, 'ing-gruyere'), 7);
});

check('an item in another area is asked about, not written', () => {
  const r = say(emptySession(), 'two cases of coke');
  assert.equal(r.session.captures['fe-coke'], undefined);
  assert.equal(r.session.questions[0].kind, 'otherArea');
  const done = resolveQuestion(r.session, r.session.questions[0].id, 'fe-coke', ctx);
  assert.equal(qty(done.session, 'fe-coke'), 48);
});

check('an unknown unit for the item asks which unit', () => {
  const r = say(emptySession(), 'three boxes of eggs');
  assert.equal(r.session.questions[0].kind, 'unit');
  const done = resolveQuestion(r.session, r.session.questions[0].id, 'trays', ctx);
  assert.equal(qty(done.session, 'fe-eggs'), 90);
});

check('items with no counting unit are never captured', () => {
  const r = say(emptySession(), 'two tubs of ice cream', { currentAreaId: 'freezer' });
  assert.equal(Object.keys(r.session.captures).length, 0);
  assert.equal(r.heard.tone, 'miss');
});

check('area switching and commands', () => {
  const cases = {
    'start dry store': { kind: 'switchArea', areaId: 'dry-store' },
    'back to the walk-in': { kind: 'switchArea', areaId: 'walk-in' },
    'next area': { kind: 'nextArea' },
    pause: { kind: 'pause' },
    skip: { kind: 'skip' },
    repeat: { kind: 'repeat' },
  };
  for (const [line, expected] of Object.entries(cases)) {
    assert.deepEqual(parseUtterance(line, ctx), [expected], line);
  }
});

check('Guide me: a bare quantity counts the prompted item', () => {
  const r = say(emptySession(), 'six bottles', { targetItemId: 'fe-whole-milk' });
  assert.equal(qty(r.session, 'fe-whole-milk'), 12);
  const r2 = say(emptySession(), 'none', { targetItemId: 'fe-whole-milk' });
  assert.equal(r2.session.captures['fe-whole-milk'].status, 'none');
});

check('Guide me: naming a different item still counts it', () => {
  const r = say(emptySession(), 'four kilos gruyere', { targetItemId: 'fe-whole-milk' });
  assert.equal(qty(r.session, 'ing-gruyere'), 4);
  assert.equal(r.session.captures['fe-whole-milk'], undefined);
});

check('a case of coke means one case', () => {
  const r = say(emptySession(), 'a case and six cans of coke', { currentAreaId: 'bar-fridge' });
  assert.equal(qty(r.session, 'fe-coke'), 30);
});

console.log(`\n${passed} checks passed`);
