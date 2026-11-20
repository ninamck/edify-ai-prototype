import { generateText, isStepCount, tool, type ModelMessage, type ToolSet } from 'ai';
import { z } from 'zod';
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

  if (!process.env.AI_GATEWAY_API_KEY && !process.env.VERCEL) {
    const res: CommandResponse = { route: 'other', say: '', proposals: [], toolsCalled: [], error: 'no-model' };
    return Response.json(res);
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
    };
    return Response.json(res);
  } catch (err) {
    const res: CommandResponse = {
      route: 'other',
      say: '',
      proposals: [],
      toolsCalled: [],
      error: err instanceof Error ? err.message : 'model-failed',
    };
    return Response.json(res);
  }
}
