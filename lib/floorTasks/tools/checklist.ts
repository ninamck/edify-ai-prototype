import { z } from 'zod';
import { resolve } from '../resolve';
import type { SnapChecklist, SnapChecklistQuestion } from '../types';
import { ask, listNames, record, refuse, roleRefusal, STAGE_WITHOUT_ASKING, toolFactory, type Scope, type ToolDefinition } from './scope';

const tool = toolFactory<string>();

type Parsed = { ok: true; value: string; shown: string } | { ok: false; question: string };

const YES = /^(y|yes|yeah|yep|done|ticked|tick|checked|ok|okay|true|all good|fine|complete|completed)\b/i;
const NO = /^(n|no|nope|not|false|unticked|failed|fail)\b/i;

/** Store answers the way Main does: 'yes'/'no' for ticks, numbers as text. */
function parseAnswer(q: SnapChecklistQuestion, raw: string): Parsed {
  const s = raw.trim();
  if (q.type === 'checkbox') {
    if (YES.test(s)) return { ok: true, value: 'yes', shown: 'Yes' };
    if (NO.test(s)) return { ok: true, value: 'no', shown: 'No' };
    return { ok: false, question: `${q.name} Yes or no?` };
  }
  if (q.type === 'temperature' || q.type === 'number') {
    const m = s.replace(/minus\s*/i, '-').match(/-?\d+(?:\.\d+)?/);
    if (!m) return { ok: false, question: `What's the reading for ${q.name.replace(/\s*\(.*\)$/, '')}?` };
    const n = Number(m[0]);
    if (q.type === 'temperature' && (n < -100 || n > 1000)) return { ok: false, question: 'Temperatures need to be between -100 and 1000 °C. What was the reading?' };
    return { ok: true, value: String(n), shown: q.type === 'temperature' ? `${n} °C` : String(n) };
  }
  if (!s) return { ok: false, question: `What should go in ${q.name}?` };
  return { ok: true, value: s, shown: s };
}

function firedFollowUp(list: SnapChecklist, q: SnapChecklistQuestion, value: string): SnapChecklistQuestion | undefined {
  for (const rule of q.followUps) {
    const n = Number(value);
    const fires =
      (rule.condition === 'greater_than' && rule.value !== undefined && n > rule.value) ||
      (rule.condition === 'less_than' && rule.value !== undefined && n < rule.value) ||
      (rule.condition === 'unchecked' && value === 'no') ||
      (rule.condition === 'checked' && value === 'yes');
    if (fires) return list.questions.find((x) => x.id === rule.questionId);
  }
  return undefined;
}

export const answerChecklist = (scope: Scope): ToolDefinition =>
  tool(
    'answer_checklist',
    'Answer one question on an open checklist, e.g. "sandwich fridge is 3 degrees", "labels are all checked". ' +
      'If the answer opens a follow-up question, the tool returns it: ask it, then call again with followUpAnswer.' +
      STAGE_WITHOUT_ASKING,
    {
      question: z.string().describe('The question or the thing checked, as they said it.'),
      answer: z.string().describe('Their answer as said: "3 degrees", "yes", "done", free text.'),
      checklist: z.string().optional(),
      followUpAnswer: z.string().optional(),
      skipFollowUp: z.boolean().optional().describe('True only if they said they will answer the follow-up later.'),
    },
    async ({ question, answer, checklist, followUpAnswer, skipFollowUp }) => {
      const refusal = roleRefusal(scope, 'checklist-answer');
      if (refusal) return refusal;
      let lists = scope.snap.checklists;
      if (!lists.length) return refuse(`There are no open checklists at ${scope.snap.site.name} right now.`);
      if (checklist) {
        const found = resolve(checklist, lists, (l) => [l.name]);
        if (found.kind === 'one') lists = [found.item];
        else return ask(`Which checklist: ${listNames(lists.map((l) => l.name))}?`);
      }
      const candidates = lists.flatMap((l) => l.questions.filter((q) => !q.parentQuestionId).map((q) => ({ list: l, q })));
      const found = resolve(question, candidates, (c) => [c.q.name, c.q.name.replace(/\s*\(.*\)$/, '')], 0.5);
      if (found.kind === 'none') return refuse(`"${question}" isn't a question on ${listNames(lists.map((l) => l.name))}.`);
      if (found.kind === 'many') return ask(`Which one: ${listNames(found.options.map((o) => `${o.q.name} on ${o.list.name}`))}?`);
      const { list, q } = found.item;
      const parsed = parseAnswer(q, answer);
      if (!parsed.ok) return ask(parsed.question);

      const warnings: string[] = [];
      const child = firedFollowUp(list, q, parsed.value);
      let followUp: { questionId: string; questionName: string; answer: string } | undefined;
      if (child) {
        if (followUpAnswer?.trim()) {
          followUp = { questionId: child.id, questionName: child.name, answer: followUpAnswer.trim() };
        } else if (!skipFollowUp && child.mandatory) {
          return ask(`${parsed.shown} opens a follow-up: ${child.name}. What happened?`, { followUp: child.name });
        } else {
          warnings.push(`${child.name} still needs an answer before ${list.name} can be completed.`);
        }
      }
      if (q.answer !== null && q.answer !== parsed.value) warnings.push(`This replaces the earlier answer: ${q.answer}.`);

      const top = list.questions.filter((x) => !x.parentQuestionId);
      const answeredAfter = top.filter((x) => x.id === q.id || x.answer !== null).length;
      return record(
        scope,
        'checklist-answer',
        {
          instanceId: list.instanceId,
          checklistName: list.name,
          questionId: q.id,
          questionName: q.name,
          responseType: q.type,
          answer: parsed.value,
          followUp,
          answeredAfter,
          totalQuestions: top.length,
        },
        `${list.name}: ${q.name} ${parsed.shown}`,
        `${q.name.replace(/\?$/, '')}: ${parsed.shown}. Save it?`,
        warnings,
      );
    },
  );
