import type { SnapStockRow } from './types';
import { isCountUnit } from './format';

/**
 * Matching what someone said to the thing they meant. Speech gets names
 * slightly wrong ("Notora", "chicken breasts", "the walk in"), so matching
 * is forgiving, and when two things fit equally Edify asks rather than
 * guesses.
 */

function normalise(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9 ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const STOP = new Set(['the', 'a', 'an', 'of', 'some', 'my', 'our', 'and', 'from', 'for', 'to', 'order', 'list', 'batch', 'fitzroy']);

function singular(t: string): string {
  if (t.length > 4 && t.endsWith('ies')) return `${t.slice(0, -3)}y`;
  if (t.length > 4 && /(ches|shes|xes|sses|oes)$/.test(t)) return t.slice(0, -2);
  if (t.length > 3 && t.endsWith('s') && !t.endsWith('ss')) return t.slice(0, -1);
  return t;
}

export function tokens(s: string): string[] {
  return normalise(s)
    .split(' ')
    .filter((t) => t && !STOP.has(t))
    .map(singular);
}

function editDistance(a: string, b: string): number {
  const dp = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j += 1) dp[0][j] = j;
  for (let i = 1; i <= a.length; i += 1) {
    for (let j = 1; j <= b.length; j += 1) {
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
  }
  return dp[a.length][b.length];
}

export function tokenMatch(q: string, c: string): number {
  if (q === c) return 1;
  if (q.length >= 4 && c.length >= 4 && (c.startsWith(q) || q.startsWith(c))) return 0.85;
  if (q.length >= 4 && c.length >= 4) {
    const sim = 1 - editDistance(q, c) / Math.max(q.length, c.length);
    if (sim >= 0.7) return sim * 0.9;
  }
  return 0;
}

/** 0 to 1: how well the words someone said fit a name. */
export function matchScore(query: string, name: string): number {
  const nq = normalise(query);
  const nn = normalise(name);
  if (!nq || !nn) return 0;
  if (nq === nn) return 1;
  const q = tokens(query);
  const c = tokens(name);
  if (!q.length || !c.length) return 0;
  let total = 0;
  for (const qt of q) total += Math.max(0, ...c.map((ct) => tokenMatch(qt, ct)));
  const coverage = total / q.length;
  const covered = c.filter((ct) => q.some((qt) => tokenMatch(qt, ct) > 0)).length / c.length;
  return Math.min(0.99, coverage * 0.75 + covered * 0.25);
}

export type Resolved<T> =
  | { kind: 'one'; item: T; score: number }
  | { kind: 'many'; options: T[] }
  | { kind: 'none' };

/** Pick the best match. Two close matches are "many", so the caller can
 *  ask which one. */
export function resolve<T>(query: string, items: T[], names: (t: T) => string[], threshold = 0.55): Resolved<T> {
  const scored = items
    .map((item) => ({ item, score: Math.max(...names(item).map((n) => matchScore(query, n))) }))
    .filter((s) => s.score >= threshold)
    .sort((a, b) => b.score - a.score);
  if (!scored.length) return { kind: 'none' };
  const [top, second] = scored;
  if (top.score >= 0.98 || !second || top.score - second.score >= 0.12) return { kind: 'one', item: top.item, score: top.score };
  return { kind: 'many', options: scored.filter((s) => top.score - s.score < 0.12).slice(0, 4).map((s) => s.item) };
}

export function resolveStock(query: string, rows: SnapStockRow[]): Resolved<SnapStockRow> {
  return resolve(query, rows, (r) => [r.name, `${r.name} ${r.variant}`]);
}

// ─── Units ─────────────────────────────────────────────────────────────────

const UNIT_ALIASES: Record<string, string> = {
  kilo: 'kg', kilos: 'kg', kilogram: 'kg', kilograms: 'kg', kgs: 'kg', kg: 'kg',
  gram: 'g', grams: 'g', gr: 'g', g: 'g',
  litre: 'L', litres: 'L', liter: 'L', liters: 'L', l: 'L', ltr: 'L',
  ml: 'mL', millilitre: 'mL', millilitres: 'mL', milliliter: 'mL', milliliters: 'mL',
};

function unitKey(u: string): string {
  const n = normalise(u).replace(/\s+/g, '');
  if (UNIT_ALIASES[n]) return UNIT_ALIASES[n].toLowerCase();
  return singular(n);
}

export type UnitResult =
  | { ok: true; unit: string; inStockUnits: number }
  | { ok: false; question: string };

/** Turn the spoken unit into one of the item's own units. No unit means
 *  "one of them" when the item can be counted that way, otherwise its
 *  stock unit. */
export function resolveUnit(row: SnapStockRow, spoken?: string | null): UnitResult {
  const countUnit = row.units.find((u) => isCountUnit(u.unit));
  if (!spoken || !spoken.trim()) {
    const u = countUnit ?? row.units[0];
    return { ok: true, unit: u.unit, inStockUnits: u.inStockUnits };
  }
  const key = unitKey(spoken);
  const exact = row.units.find((u) => unitKey(u.unit) === key);
  if (exact) return { ok: true, unit: exact.unit, inStockUnits: exact.inStockUnits };
  const nameWords = tokens(row.name);
  if (isCountUnit(key) || isCountUnit(spoken) || nameWords.includes(key)) {
    if (countUnit) return { ok: true, unit: countUnit.unit, inStockUnits: countUnit.inStockUnits };
  }
  const names = row.units.map((u) => u.unit).join(', ');
  return { ok: false, question: `${row.name} is counted in ${names}. Which one?` };
}
