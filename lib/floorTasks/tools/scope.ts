import type { z } from 'zod';
import { FLOOR_TASKS } from '../registry';
import { endOfTradingDay } from '../format';
import type { FloorSnapshot, FloorTaskId, PayloadByTask, Proposal } from '../types';

/**
 * The same shape as Main's backend/src/common/ai/tool.ts: a name, a
 * description, a zod shape and a handler that returns JSON text. Tools
 * never write. They stage a proposal through the scope, the way Main's
 * tools call scope.record(), and the person says yes on the card or out
 * loud.
 */

export type ToolResult = { content: { type: 'text'; text: string }[]; isError?: boolean };

export type ToolDefinition = {
  name: string;
  description: string;
  shape: Record<string, z.ZodTypeAny>;
  handler: (args: never) => Promise<ToolResult>;
};

export const asToolResult = (value: unknown): ToolResult => ({
  content: [{ type: 'text', text: JSON.stringify(value) }],
});

export const toolFactory =
  <TName extends string>() =>
  <TShape extends Record<string, z.ZodTypeAny>>(
    name: TName,
    description: string,
    shape: TShape,
    handler: (args: { [K in keyof TShape]: z.infer<TShape[K]> }) => Promise<ToolResult>,
  ): ToolDefinition => ({
    name,
    description,
    shape,
    handler: handler as ToolDefinition['handler'],
  });

/** Main's wording, word for word. */
export const STAGE_WITHOUT_ASKING =
  ' Once you have what it needs, call it: never ask whether to go ahead ' +
  'first. It changes nothing, and the card it opens is where they say yes.';

export interface Scope {
  snap: FloorSnapshot;
  proposals: Proposal[];
  /** Set when the words weren't a floor task. */
  handOff: boolean;
}

export function createScope(snap: FloorSnapshot): Scope {
  return { snap, proposals: [], handOff: false };
}

let counter = 0;

export function record<K extends FloorTaskId>(
  scope: Scope,
  taskId: K,
  payload: PayloadByTask[K],
  label: string,
  readback: string,
  warnings: string[] = [],
): ToolResult {
  counter += 1;
  const now = new Date(scope.snap.nowIso);
  const proposal = {
    id: `pr-${now.getTime().toString(36)}-${counter}-${Math.random().toString(36).slice(2, 6)}`,
    taskId,
    payload,
    label,
    readback,
    warnings,
    siteId: scope.snap.site.id,
    createdAt: now.toISOString(),
    status: 'staged',
    expiresAt: endOfTradingDay(now),
  } as Proposal;
  scope.proposals.push(proposal);
  return asToolResult({
    staged: true,
    proposalId: proposal.id,
    tier: FLOOR_TASKS[taskId].tier,
    label,
    readback,
    warnings,
  });
}

/** Ask the person one thing, then call the tool again with the answer. */
export const ask = (question: string, extra: Record<string, unknown> = {}) =>
  asToolResult({ staged: false, question, ...extra });

/** Edify can't do it. Say so in the first sentence. */
export const refuse = (refused: string, route?: string) => asToolResult({ staged: false, refused, route });

/** Role gate, using the registry's roles and refusal copy. */
export function roleRefusal(scope: Scope, taskId: FloorTaskId): ToolResult | null {
  const spec = FLOOR_TASKS[taskId];
  if (spec.roles.includes(scope.snap.role)) return null;
  return refuse(spec.refusal ?? 'Their role can\'t do that here. A manager can.');
}

export function listNames(names: string[]): string {
  if (names.length <= 1) return names[0] ?? '';
  return `${names.slice(0, -1).join(', ')} or ${names[names.length - 1]}`;
}

export function andNames(names: string[]): string {
  if (names.length <= 1) return names[0] ?? '';
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
}
