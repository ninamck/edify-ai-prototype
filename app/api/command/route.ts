import { generateText, isStepCount, tool, type ModelMessage, type ToolSet } from 'ai';
import { z } from 'zod';
import { readFloorTask, sayFor } from '@/lib/floorTasks/demoReader';
import { instructions } from '@/lib/floorTasks/prompt';
import { floorTools } from '@/lib/floorTasks/tools';
import { createScope } from '@/lib/floorTasks/tools/scope';
import type { CommandRequest, CommandResponse } from '@/lib/floorTasks/types';

const MODEL = process.env.FLOOR_TASKS_MODEL ?? 'anthropic/claude-sonnet-5.5';

/** Words to staged floor tasks. The browser sends the site as it stands;
 *  tools stage proposals against it and the browser applies them on yes. */
export async function POST(req: Request) {
  let body: CommandRequest;
  try {
    body = (await req.json()) as CommandRequest;
  } catch {
    return Response.json({ error: 'bad-request' }, { status: 400 });
  }
  if (!body?.text?.trim() || !body.snapshot) return Response.json({ error: 'bad-request' }, { status: 400 });

  if (process.env.FLOOR_TASKS_ENGINE === 'demo' || (!process.env.AI_GATEWAY_API_KEY && !process.env.VERCEL)) {
    return Response.json(await demo(body));
  }

  const scope = createScope(body.snapshot);
  const tools: ToolSet = {};
  for (const def of floorTools(scope)) {
    tools[def.name] = tool({
      description: def.description,
      inputSchema: z.object(def.shape),
      execute: async (args: unknown) => {
        const result = await def.handler(args as never);
        return JSON.parse(result.content[0].text) as unknown;
      },
    });
  }

  const messages: ModelMessage[] = [
    ...(body.history ?? []).slice(-8).map((t): ModelMessage => ({
      role: t.role === 'user' ? 'user' : 'assistant',
      content: t.text,
    })),
    { role: 'user', content: body.text },
  ];

  try {
    const result = await generateText({
      model: MODEL,
      instructions: instructions(body.snapshot),
      messages,
      tools,
      stopWhen: isStepCount(6),
    });
    const toolsCalled = result.steps.flatMap((s) => s.toolCalls.map((c) => c.toolName));
    const handedOff = scope.handOff && scope.proposals.length === 0;
    const res: CommandResponse = {
      route: handedOff ? 'other' : 'floor',
      say: handedOff ? '' : result.text.trim(),
      proposals: scope.proposals,
      toolsCalled,
      engine: 'model',
    };
    return Response.json(res);
  } catch (err) {
    const res = await demo(body);
    return Response.json({ ...res, error: err instanceof Error ? err.message : 'model-failed' });
  }
}

/** No model: patterns read the words and call the same tools. */
async function demo(body: CommandRequest): Promise<CommandResponse> {
  const call = readFloorTask(body.text, body.snapshot, body.history ?? []);
  const none: CommandResponse = { route: 'other', say: '', proposals: [], toolsCalled: [], engine: 'demo' };
  if (!call) return none;
  if ('say' in call) return { ...none, route: 'floor', say: call.say };
  const scope = createScope(body.snapshot);
  const def = floorTools(scope).find((t) => t.name === call.tool);
  if (!def) return none;
  const out = JSON.parse((await def.handler(call.args as never)).content[0].text) as Record<string, unknown>;
  if (scope.handOff) return none;
  return {
    route: 'floor',
    say: scope.proposals.length ? '' : sayFor(call.tool, out),
    proposals: scope.proposals,
    toolsCalled: [call.tool],
    engine: 'demo',
  };
}
