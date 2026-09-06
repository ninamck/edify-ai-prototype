/**
 * Natural-language parser for the morning variance sweep.
 *
 * Fires on "sweep", or on yesterday / last night / overnight with a
 * labour, pay, overtime or rota noun, or on a labour-variance question
 * that names yesterday. Stock variance ("variance on oat milk") is a
 * different skill and must not match here.
 *
 *   "/sweep"
 *   "Run the morning variance sweep"
 *   "What did labour cost against plan yesterday?"
 *   "Who went over on hours last night?"
 *   "Why was Gatwick over plan yesterday?"
 */

import type { CommandIntent } from '../types';
import { siteFromText } from './parseRota';

const SWEEP = /\b(variance sweep|morning sweep|labour sweep|sweep)\b/i;
const YESTERDAY = /\b(yesterday|last night|overnight|this morning)\b/i;
const LABOUR = /\b(labour|labor|rota|roster|shifts?|hours|overtime|pay(roll)?|clock(ed|ing)?( in| out)?|breaks?|wage|staff(ing)? cost|(over|under|against|off|on) plan)\b/i;
const QUESTION = /\b(over|under|against|vs|versus|off|variance|cost|went|ran|spent|plan)\b/i;
const STOCK = /\b(stock|count|oat milk|litre|units?|ingredient|waste|gp|margin)\b/i;

export function parseVarianceSweep(text: string): CommandIntent | null {
  const t = text.trim();
  const slash = /^\/sweep\b/i.test(t);
  const args: Record<string, unknown> = {};
  const site = siteFromText(t);
  if (site) {
    args.siteId = site.id;
    args.siteName = site.name;
  }
  if (slash) return { commandId: 'variance-sweep', args, confidence: 1 };
  if (STOCK.test(t) && !SWEEP.test(t)) return null;
  if (SWEEP.test(t)) return { commandId: 'variance-sweep', args, confidence: 0.9 };
  if (YESTERDAY.test(t) && LABOUR.test(t) && QUESTION.test(t)) return { commandId: 'variance-sweep', args, confidence: 0.9 };
  return null;
}
