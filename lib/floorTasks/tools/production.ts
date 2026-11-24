import { z } from 'zod';
import { resolve } from '../resolve';
import type { HotAddLine, SnapHotBatch } from '../types';
import { andNames, ask, listNames, record, refuse, roleRefusal, STAGE_WITHOUT_ASKING, toolFactory, type Scope, type ToolDefinition } from './scope';

const tool = toolFactory<string>();

function hhmmOf(label: string): string {
  return label.replace(/\s*batch$/i, '');
}

/** "12", "12 o'clock", "midday", "next", "the 1pm" to a batch. */
function pickBatch(batches: SnapHotBatch[], said?: string | null): SnapHotBatch | undefined {
  const current = batches.find((b) => b.when === 'current');
  if (!said) return current;
  const s = said.toLowerCase();
  if (/\b(now|current|this)\b/.test(s)) return current;
  if (/\bnext\b/.test(s)) return batches.find((b) => b.when === 'next');
  if (/midday|noon/.test(s)) return batches.find((b) => b.label.startsWith('12:'));
  const m = s.match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/);
  if (!m) return undefined;
  let h = Number(m[1]);
  if (m[3] === 'pm' && h < 12) h += 12;
  if (!m[3] && h < 7) h += 12;
  return batches.find((b) => b.label.startsWith(`${String(h).padStart(2, '0')}:`));
}

export const addToHotBatch = (scope: Scope): ToolDefinition =>
  tool(
    'add_to_hot_batch',
    'Add more of a hot recipe to a batch that has started, e.g. "add 6 toasties to the 12 o\'clock batch" or "drop 4 more sausage rolls". ' +
      'Defaults to the batch on now. Only for the hot station.' +
      STAGE_WITHOUT_ASKING,
    {
      lines: z.array(z.object({ recipe: z.string(), quantity: z.number().nullable().optional() })).min(1),
      batch: z.string().optional().describe('The batch they named, e.g. "12", "1pm", "next". Leave out for the batch on now.'),
    },
    async ({ lines, batch }) => {
      const refusal = roleRefusal(scope, 'hot-add');
      if (refusal) return refusal;
      const hot = scope.snap.hot;
      if (!hot) return refuse(`${scope.snap.site.name} has no hot station.`);
      if (hot.pcrOn) return refuse('Hot production runs on PCR at this site, so adds happen there.');
      const target = pickBatch(hot.batches, batch);
      const open = hot.batches.filter((b) => b.when === 'current' || b.when === 'next');
      if (!target) return ask(`Which batch: ${listNames(open.map((b) => hhmmOf(b.label)))}?`);
      if (target.when !== 'current' && target.when !== 'next') {
        return refuse(
          `You can only add to the batch on now or the next one, not the ${target.label}.`,
          `Those are the ${listNames(open.map((b) => hhmmOf(b.label)))}.`,
        );
      }
      const out: HotAddLine[] = [];
      for (const line of lines) {
        const found = resolve(line.recipe, target.lines, (l) => [l.recipeName]);
        if (found.kind !== 'one') {
          const onBench = scope.snap.bench && resolve(line.recipe, scope.snap.bench.rows, (r) => [r.recipeName]);
          if (onBench && onBench.kind === 'one') {
            return refuse(
              `${onBench.item.recipeName} is made on the ${scope.snap.bench!.name}, and bench runs can't be added to.`,
              'Mark it done, then a manager can add another run on the bench.',
            );
          }
          if (found.kind === 'many') return ask(`Which one: ${listNames(found.options.map((o) => o.recipeName))}?`);
          return refuse(
            `${line.recipe} isn't on the ${target.label}, and only recipes already on a batch can be added to.`,
            `On it: ${andNames(target.lines.map((l) => l.recipeName))}.`,
          );
        }
        const recipe = found.item;
        if (line.quantity === undefined || line.quantity === null) return ask(`How many more ${recipe.recipeName}?`);
        const add = Math.round(line.quantity);
        if (add < 1) return ask(`How many more ${recipe.recipeName}? It needs to be at least 1.`);
        const newMade = (recipe.made ?? 0) + add;
        if (newMade > 1000) return refuse('That\'s over 1000 on one line, which the hot station won\'t take.');
        out.push({ recipeId: recipe.recipeId, recipeName: recipe.recipeName, existingMade: recipe.made, add, newMade });
      }
      const what = andNames(out.map((l) => `${l.add} to ${l.recipeName}`));
      const warnings = out
        .filter((l) => l.existingMade === null)
        .map((l) => `${l.recipeName} isn't marked as made on this batch yet, so this records ${l.newMade} made.`);
      return record(
        scope,
        'hot-add',
        { stationName: hot.stationName, batchId: target.id, batchLabel: target.label, lines: out },
        `Add ${what} on the ${target.label}`,
        `Add ${what} on the ${hhmmOf(target.label)} batch?`,
        warnings,
      );
    },
  );

export const markProduction = (scope: Scope): ToolDefinition =>
  tool(
    'mark_production',
    'Start or finish a run on the production bench, e.g. "caesar wraps are done" or "starting the egg mayo".' + STAGE_WITHOUT_ASKING,
    { recipe: z.string(), action: z.enum(['start', 'done']).optional().describe('Default: done if it has started, otherwise start.') },
    async ({ recipe, action }) => {
      const refusal = roleRefusal(scope, 'production-step');
      if (refusal) return refusal;
      const bench = scope.snap.bench;
      if (!bench) return refuse(`${scope.snap.site.name} has no production bench.`);
      const found = resolve(recipe, bench.rows, (r) => [r.recipeName]);
      if (found.kind === 'many') return ask(`Which one: ${listNames(found.options.map((o) => o.recipeName))}?`);
      if (found.kind === 'none') {
        return refuse(`${recipe} isn't on today's ${bench.name}.`, `On it: ${andNames(bench.rows.map((r) => r.recipeName))}.`);
      }
      const row = found.item;
      if (row.completedAt) {
        const at = new Date(row.completedAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
        return refuse(`${row.recipeName} was already marked done at ${at}.`);
      }
      const wanted = action ?? (row.startedAt ? 'done' : 'start');
      if (wanted === 'start' && row.startedAt) return refuse(`${row.recipeName} has already started.`);
      if (!row.startedAt) {
        const idx = bench.rows.indexOf(row);
        const blocking = bench.rows.slice(0, idx).find((r) => !r.completedAt);
        if (blocking) return refuse(`Finish ${blocking.recipeName} first. The bench runs in order.`);
      }
      const step = wanted === 'start' ? 'start' : row.startedAt ? 'complete' : 'start-and-complete';
      const verb = step === 'start' ? 'Start' : 'Mark done:';
      return record(
        scope,
        'production-step',
        { benchName: bench.name, rowId: row.id, recipeName: row.recipeName, planned: row.planned, action: step },
        `${verb} ${row.recipeName}, ${row.planned} planned`,
        step === 'start' ? `Start ${row.recipeName}? ${row.planned} planned.` : `Mark ${row.recipeName} done? ${row.planned} planned.`,
        step === 'start-and-complete' ? [`${row.recipeName} wasn't started, so this starts and finishes it now.`] : [],
      );
    },
  );
