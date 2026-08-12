/**
 * Audit scoring engine — shared by the completion flow (running score),
 * history (stored result display) and the printable report.
 *
 * Rules:
 * - Yes/No questions: yes = full points, no = 0.
 * - Number/temperature questions with a threshold follow-up rule
 *   (greater_than / less_than): within range = full points, breach = 0.
 * - Text, rating and table questions are unscored — excluded from the
 *   denominator so the score only reflects pass/fail-able checks.
 * - Any failed Critical question fails the audit outright, regardless
 *   of the percentage.
 */

import type {
  AuditScoreResult,
  ChecklistAnswer,
  ChecklistQuestion,
  ChecklistTemplate,
  SectionScore,
  SeverityWeights,
} from './types';

export const DEFAULT_PASS_THRESHOLD_PCT = 80;

/** Default severity weight map. Point values come from severity via
 *  the template's map (editable per template), so the score and the
 *  alerts can never disagree. */
export const DEFAULT_SEVERITY_WEIGHTS: SeverityWeights = {
  critical: 10,
  medium: 5,
  low: 2,
};

export function severityWeightsOf(template: ChecklistTemplate): SeverityWeights {
  return template.severityWeights ?? DEFAULT_SEVERITY_WEIGHTS;
}

/** A question's point value: its severity looked up in the template's
 *  weight map. Changing a weight re-scores every affected question. */
export function pointsFor(template: ChecklistTemplate, q: ChecklistQuestion): number {
  return severityWeightsOf(template)[q.severity ?? 'medium'];
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
 * while completing (unanswered questions simply haven't earned their
 * points yet) and as the final locked result at submit.
 */
export function computeScore(
  template: ChecklistTemplate,
  answers: ChecklistAnswer[],
): AuditScoreResult {
  const byId = new Map(answers.map((a) => [a.questionId, a]));
  const scoreable = template.questions.filter(isScoreable);

  let pointsAwarded = 0;
  let pointsTotal = 0;
  let criticalFails = 0;
  const failedQuestionIds: string[] = [];

  // Section subtotals: declared sections in order, plus a catch-all for
  // scoreable questions without a (valid) section.
  const sections = template.sections ?? [];
  const subtotals = new Map<string, SectionScore>(
    sections.map((s) => [s.id, { sectionId: s.id, name: s.name, awarded: 0, total: 0 }]),
  );
  const GENERAL: SectionScore = { sectionId: 'general', name: 'General', awarded: 0, total: 0 };

  for (const q of scoreable) {
    const pts = pointsFor(template, q);
    pointsTotal += pts;
    const bucket = (q.sectionId && subtotals.get(q.sectionId)) || GENERAL;
    bucket.total += pts;

    const outcome = questionOutcome(q, byId.get(q.id));
    if (outcome === 'pass') {
      pointsAwarded += pts;
      bucket.awarded += pts;
    } else if (outcome === 'fail') {
      failedQuestionIds.push(q.id);
      if (q.severity === 'critical') criticalFails += 1;
    }
    // 'unanswered' earns nothing yet but stays in the denominator.
  }

  const pct = pointsTotal > 0 ? Math.round((pointsAwarded / pointsTotal) * 100) : 0;
  const passThresholdPct = template.passThresholdPct ?? DEFAULT_PASS_THRESHOLD_PCT;

  const sectionScores = [
    ...sections.map((s) => subtotals.get(s.id)!).filter((s) => s.total > 0),
    ...(GENERAL.total > 0 ? [GENERAL] : []),
  ];

  return {
    pointsAwarded,
    pointsTotal,
    pct,
    passThresholdPct,
    criticalFails,
    passed: criticalFails === 0 && pct >= passThresholdPct,
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
