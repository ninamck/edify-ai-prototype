// Runs every test phrase through demo mode (no model) and shows what it
// read, so the patterns can be checked against the phrases the model gets.
// Run with: node scripts/check-demo-reader.mjs        (misses only)
//           node scripts/check-demo-reader.mjs --all  (every phrase)

import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { createJiti } from 'jiti';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const jiti = createJiti(import.meta.url, { alias: { '@/': `${root}/` } });

const store = await jiti.import('../lib/floorTasks/world/store.ts');
const { createScope } = await jiti.import('../lib/floorTasks/tools/scope.ts');
const { floorTools } = await jiti.import('../lib/floorTasks/tools/index.ts');
const { readFloorTask, sayFor } = await jiti.import('../lib/floorTasks/demoReader.ts');
const { EVAL_SETS } = await jiti.import('../lib/floorTasks/evalPhrases.ts');

const all = process.argv.includes('--all');
let pass = 0;
let total = 0;

for (const set of EVAL_SETS) {
  const lines = [];
  for (const c of set.cases) {
    total += 1;
    store.setRole(c.role ?? 'manager');
    const snap = store.buildSnapshot();
    const call = readFloorTask(c.phrase, snap, []);
    let got = 'chat';
    let said = '';
    if (call && 'say' in call) {
      got = `asks (${set.cases[0].tool})`;
      said = call.say;
    } else if (call) {
      got = call.tool;
      const scope = createScope(snap);
      const def = floorTools(scope).find((t) => t.name === call.tool);
      const out = JSON.parse((await def.handler(call.args)).content[0].text);
      said = scope.proposals.length ? scope.proposals.map((p) => p.readback).join(' ') : sayFor(call.tool, out);
    }
    const ok = c.tool === 'not_a_floor_task' ? got === 'chat' : got === c.tool || (call && 'say' in call);
    if (ok) pass += 1;
    if (!ok || all) lines.push(`  ${ok ? 'ok  ' : 'MISS'} "${c.phrase}" -> ${got}${said ? `: ${said}` : ''}`);
  }
  if (lines.length) console.log(`${set.title}\n${lines.join('\n')}`);
}
console.log(`\nDemo mode read ${pass} of ${total} phrases as the right task.`);
