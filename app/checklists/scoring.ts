/**
 * Audit scoring engine — shared by the completion flow (fail budget),
 * history (stored result display) and the printable report.
 *
 * The model, in plain English: every check counts for one. The score is
 * the share of checks passed. The pass mark translates into a number of
 * checks a site can fail and still pass (the "fail budget"). Severity
 * decides consequences, not arithmetic: it routes alerts, rides on the
 * actions raised, and any failed Critical check fails the audit
 * outright, whatever the percentage.
 *
 * Rules:
 * - Yes/No questions: yes = pass, no = fail.
 * - Number/temperature questions with a threshold follow-up rule
 *   (greater_than / less_than): within range = pass, breach = fail.
 * - Text, rating and table questions are unscored — excluded from the
 *   denominator so the score only reflects pass/fail-able checks.
 */

import type {
  AuditScoreResult,
  ChecklistAnswer,
  ChecklistQuestion,
  ChecklistTemplate,
  SectionScore,
} from './types';

export const DEFAULT_PASS_THRESHOLD_PCT = 80;

/**
 * The pass mark, translated into behaviour: how many checks can fail
 * before the audit does. E.g. 24 checks at 80% = up to 4 fails.
 * Critical checks sit outside this budget — one critical fail fails
 * the audit regardless.
 */
export function allowedFails(checksTotal: number, passThresholdPct: number): number {
  if (checksTotal <= 0) return 0;
  return checksTotal - Math.ceil((checksTotal * passThresholdPct) / 100);
}

/** Threshold rules are the numeric conditions that define "in range". */
function thresholdRules(q: ChecklistQuestion) {
  return q.followUpRules.filter(
    (r) =>
      (r.condition.type === 'greater_than' || r.condition.type === 'less_than') &&
      typeof r.condition.value === 'number',
  );
}

/** Whether a question participates in the score at all. */
export function isScoreable(q: ChecklistQuestion): boolean {
  if (q.parentQuestionId) return false;
  if (q.responseType === 'checkbox') return true;
  if (q.responseType === 'temperature' || q.responseType === 'number') {
    return thresholdRules(q).length > 0;
  }
  return false;
}

export type QuestionOutcome = 'pass' | 'fail' | 'unanswered' | 'unscored';

export function questionOutcome(
  q: ChecklistQuestion,
  answer: ChecklistAnswer | undefined,
): QuestionOutcome {
  if (!isScoreable(q)) return 'unscored';

  if (q.responseType === 'checkbox') {
    if (answer?.value === true) return 'pass';
    if (answer?.value === false) return 'fail';
    return 'unanswered';
  }

  // Number / temperature with threshold rules.
  if (typeof answer?.value !== 'number') return 'unanswered';
  const breached = thresholdRules(q).some((r) => {
    const limit = r.condition.value as number;
    return r.condition.type === 'greater_than'
      ? (answer.value as number) > limit
      : (answer.value as number) < limit;
  });
  return breached ? 'fail' : 'pass';
}

/**
 * Compute the audit result from a template + answer set. Used live
 * while completing (unanswered questions simply haven't passed yet)
 * and as the final locked result at submit.
 */
export function computeScore(
  template: ChecklistTemplate,
  answers: ChecklistAnswer[],
): AuditScoreResult {
  const byId = new Map(answers.map((a) => [a.questionId, a]));
  const scoreable = template.questions.filter(isScoreable);

  let checksPassed = 0;
  let criticalFails = 0;
  const failedQuestionIds: string[] = [];

  // Section subtotals: declared sections in order, plus a catch-all for
  // scoreable questions without a (valid) section.
  const sections = template.sections ?? [];
  const subtotals = new Map<string, SectionScore>(
    sections.map((s) => [s.id, { sectionId: s.id, name: s.name, passed: 0, total: 0 }]),
  );
  const GENERAL: SectionScore = { sectionId: 'general', name: 'General', passed: 0, total: 0 };

  for (const q of scoreable) {
    const bucket = (q.sectionId && subtotals.get(q.sectionId)) || GENERAL;
    bucket.total += 1;

    const outcome = questionOutcome(q, byId.get(q.id));
    if (outcome === 'pass') {
      checksPassed += 1;
      bucket.passed += 1;
    } else if (outcome === 'fail') {
      failedQuestionIds.push(q.id);
      if (q.severity === 'critical') criticalFails += 1;
    }
    // 'unanswered' hasn't passed yet but stays in the denominator.
  }

  const checksTotal = scoreable.length;
  const pct = checksTotal > 0 ? Math.round((checksPassed / checksTotal) * 100) : 0;
  const passThresholdPct = template.passThresholdPct ?? DEFAULT_PASS_THRESHOLD_PCT;

  const sectionScores = [
    ...sections.map((s) => subtotals.get(s.id)!).filter((s) => s.total > 0),
    ...(GENERAL.total > 0 ? [GENERAL] : []),
  ];

  // Pass/fail is decided on raw counts, never the rounded display:
  // 159/200 = 79.5% renders as 80% but must still fail an 80% mark.
  const checksNeeded = checksTotal - allowedFails(checksTotal, passThresholdPct);

  return {
    checksPassed,
    checksTotal,
    pct,
    passThresholdPct,
    criticalFails,
    passed: checksTotal > 0 && criticalFails === 0 && checksPassed >= checksNeeded,
    sectionScores,
    failedQuestionIds,
  };
}

export function severityLabel(s: 'critical' | 'medium' | 'low'): string {
  return s === 'critical' ? 'Critical' : s === 'medium' ? 'Medium' : 'Low';
}

export const SEVERITY_COLORS: Record<
  'critical' | 'medium' | 'low',
  { bg: string; text: string; border: string }
> = {
  critical: { bg: '#FDE8E8', text: '#B91C1C', border: '#F5B5B5' },
  medium: { bg: '#FEF6DA', text: '#B45309', border: '#EAD173' },
  low: { bg: '#EFF5E1', text: '#4D7C0F', border: '#D3E3AE' },
};
