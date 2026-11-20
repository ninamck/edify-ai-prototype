import { z } from 'zod';
import { fmtQty } from '../format';
import { resolve, resolveStock } from '../resolve';
import { asToolResult, ask, listNames, record, refuse, toolFactory, type Scope, type ToolDefinition } from './scope';

const tool = toolFactory<string>();

/** Ask-it tools: read only, nothing staged. The model answers from the
 *  result in one or two sentences. */

export const lookUpStock = (scope: Scope): ToolDefinition =>
  tool(
    'look_up_stock',
    'What is on hand of one or more items, and how that compares with par. Read only.',
    { items: z.array(z.string()).min(1) },
    async ({ items }) => {
      const out = items.map((said) => {
        const found = resolveStock(said, scope.snap.stock);
        if (found.kind === 'none') return { said, found: false };
        if (found.kind === 'many') return { said, options: found.options.map((o) => o.name) };
        const r = found.item;
        const status = r.onHand <= 0 ? 'Empty' : r.par !== null && r.par > r.onHand ? 'Below par' : 'Above par';
        return { said, name: r.name, onHand: `${fmtQty(r.onHand)} ${r.unit}`, par: r.par === null ? 'not set' : `${fmtQty(r.par)} ${r.unit}`, status };
      });
      return asToolResult({ site: scope.snap.site.name, items: out });
    },
  );

export const whatsArriving = (scope: Scope): ToolDefinition =>
  tool(
    'whats_arriving',
    'Deliveries and transfers due in today or overdue, with their lines. Read only.',
    {},
    async () => {
      const deliveries = scope.snap.deliveries
        .filter((d) => d.due !== 'future')
        .map((d) => ({ supplier: d.supplierName, po: d.poNumber, due: d.dueLabel, lines: d.lines.filter((l) => l.status === 'pending').length }));
      const transfers = scope.snap.transfers
        .filter((t) => t.toSiteId === scope.snap.site.id)
        .map((t) => ({ number: t.number, from: t.fromSiteName, sentAt: t.sentAt, lines: t.lines.map((l) => `${fmtQty(l.qty)} ${l.unit} ${l.itemName}`) }));
      return asToolResult({ deliveries, transfers });
    },
  );

export const whatsLeftToMake = (scope: Scope): ToolDefinition =>
  tool(
    'whats_left_to_make',
    'What is still to make today: bench runs not finished, and the hot batch on now. Read only.',
    {},
    async () => {
      const bench = scope.snap.bench?.rows.filter((r) => !r.completedAt).map((r) => ({ recipe: r.recipeName, planned: r.planned, started: !!r.startedAt })) ?? [];
      const current = scope.snap.hot?.batches.find((b) => b.when === 'current');
      const hot = current
        ? { batch: current.label, lines: current.lines.map((l) => ({ recipe: l.recipeName, planned: l.planned, made: l.made ?? 0 })) }
        : null;
      return asToolResult({ bench: scope.snap.bench?.name, toMake: bench, hot });
    },
  );

export const recipeAllergens = (scope: Scope): ToolDefinition =>
  tool(
    'recipe_allergens',
    'Which of the 14 allergens a recipe contains, and which it may contain. Read only. Read the list exactly; never guess or summarise allergens.',
    { recipe: z.string() },
    async ({ recipe }) => {
      const found = resolve(recipe, scope.snap.recipes, (r) => [r.name]);
      if (found.kind === 'many') return ask(`Which one: ${listNames(found.options.map((o) => o.name))}?`);
      if (found.kind === 'none') return refuse(`Edify has no allergen record for ${recipe}.`, 'Check the recipe card before serving.');
      const r = found.item;
      return asToolResult({ recipe: r.name, contains: r.allergens, mayContain: r.mayContain });
    },
  );

export const undoLast = (scope: Scope): ToolDefinition =>
  tool(
    'undo_last',
    'Undo something Edify did in this session: "undo that", "scrap the croissant waste", "cancel that transfer". ' +
      'Deleting waste needs a reason: if they gave none, the tool asks for one.',
    {
      which: z.string().optional().describe('What they named. Leave out for the last thing.'),
      reason: z.string().optional().describe('Why, for waste deletes: "wrong item", "counted twice".'),
    },
    async ({ which, reason }) => {
      const recent = scope.snap.recentReceipts;
      if (!recent.length) return refuse('There\'s nothing to undo yet.');
      let target = recent[recent.length - 1];
      if (which) {
        const found = resolve(which, recent, (r) => [r.headline], 0.4);
        if (found.kind === 'many') return ask(`Which one: ${listNames(found.options.map((o) => o.headline))}?`);
        if (found.kind === 'one') target = found.item;
      }
      const u = target.undo;
      if (u.kind === 'none') return refuse(u.why);
      if (u.kind === 'delete-with-reason' && (!reason || reason.trim().length < 3)) {
        return ask('Why are you deleting this?');
      }
      const readback = u.kind === 'delete-with-reason' ? `Delete "${target.headline}" because ${reason!.trim()}?` : u.prompt;
      return record(
        scope,
        'undo',
        { receiptId: target.id, receiptHeadline: target.headline, targetTaskId: target.taskId, reason: reason?.trim() },
        `Undo: ${target.headline}`,
        readback,
      );
    },
  );

export const notAFloorTask = (scope: Scope): ToolDefinition =>
  tool(
    'not_a_floor_task',
    'Call this when the words are not a floor task or one of the read-only questions: reports, charts, GP, recipes to build, supplier or product setup, sending orders, anything else. Say nothing after it.',
    {},
    async () => {
      scope.handOff = true;
      return asToolResult({ handedOff: true });
    },
  );
