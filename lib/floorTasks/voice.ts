import { FLOOR_TASKS } from './registry';
import type { ConfirmMode, Proposal, Receipt, Surface } from './types';

/** How a task is confirmed on this device. Say-it tasks take a spoken
 *  yes on a headset and a card on the app. Show-it tasks always need a
 *  screen, so on a headset they wait. Starting a quick count changes
 *  nothing until the count is submitted, so on the app it starts straight
 *  away when it's the only task; counting needs a screen, so a headset
 *  parks it. */
export function confirmMode(p: Proposal, surface: Surface, batchSize = 1): ConfirmMode {
  const tier = FLOOR_TASKS[p.taskId].tier;
  if (tier === 'ask') return 'none';
  if (p.taskId === 'quick-count-start') {
    if (surface === 'headset') return 'waiting';
    return batchSize === 1 ? 'direct' : 'card';
  }
  if (tier === 'say') return surface === 'headset' ? 'spoken' : 'card';
  return surface === 'headset' ? 'waiting' : 'card';
}

const YES = /^(yes|yeah|yep|yup|ya|confirm|confirmed|correct|ok|okay|sure|do it|go ahead|save|save it|save both|save all|that's right|thats right|right)\b/i;
const NO = /^(no|nope|nah|cancel|stop|don't|dont|leave it|wrong)\b/i;
const UNDO = /^(undo|undo that|undo it|undo the last one|take that back|scrap that|reverse that)[.!? ]*$/i;

function words(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

export function isYes(text: string): boolean {
  return YES.test(text.trim()) && words(text) <= 4;
}

/** "No" on its own declines. "No, 4 croissants" declines and carries on
 *  with the correction. */
export function parseNo(text: string): { no: false } | { no: true; rest: string } {
  const t = text.trim();
  const m = NO.exec(t);
  if (!m) return { no: false };
  const rest = t.slice(m[0].length).replace(/^[\s,.:;-]+/, '').trim();
  if (!rest || words(rest) < 2) return { no: true, rest: '' };
  return { no: true, rest };
}

export function isBareUndo(text: string): boolean {
  return UNDO.test(text.trim());
}

const COUNT_WORDS = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six'];

/** What Edify says after staging, given how each will be confirmed. */
export function composeReadback(items: { p: Proposal; mode: ConfirmMode }[], surface: Surface): string {
  const say = items.filter((i) => i.mode === 'spoken' || (i.mode === 'card' && FLOOR_TASKS[i.p.taskId].tier === 'say'));  const show = items.filter((i) => FLOOR_TASKS[i.p.taskId].tier === 'show' || i.mode === 'waiting');
  const parts: string[] = [];
  if (say.length === 1) {
    parts.push(say[0].p.readback + (say[0].p.warnings.length ? ` ${say[0].p.warnings[0]}` : ''));
    if (surface === 'headset') parts.push('Say yes or no.');
  } else if (say.length > 1) {
    parts.push(`${COUNT_WORDS[say.length] ?? say.length} things: ${say.map((i) => i.p.label).join('; ')}.`);
    parts.push(surface === 'headset' ? `Say yes to save all ${say.length}, or no.` : `Save all ${say.length}?`);
  }
  for (const s of show) {
    parts.push(s.mode === 'waiting' ? `${s.p.label}. That needs a screen, so it's in Waiting for you.` : s.p.readback);
  }
  return parts.join(' ');
}

/** Done: what changed and the new number. */
export function speakReceipt(r: Receipt): string {
  return r.detail ? `${r.headline}. ${r.detail}` : r.headline;
}
