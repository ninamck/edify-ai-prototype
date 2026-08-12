export type ResponseType = 'temperature' | 'number' | 'text' | 'checkbox' | 'rating' | 'repeating_group';

/** Three-level quality rating used by store-check style questions. */
export type RatingValue = 'great' | 'average' | 'urgent';
export type Frequency = 'daily' | 'weekly' | 'monthly' | 'once';
export type UserRole = 'admin' | 'manager' | 'employee';
export type InstanceStatus = 'pending' | 'in_progress' | 'complete';

export type FollowUpConditionType =
  | 'equals'
  | 'greater_than'
  | 'less_than'
  | 'contains'
  | 'checked'
  | 'unchecked';

export interface FollowUpCondition {
  type: FollowUpConditionType;
  value?: string | number;
}

export interface FollowUpRule {
  id: string;
  condition: FollowUpCondition;
  /** ID of the question to show when the condition is met */
  followUpQuestionId: string;
}

// ── Audit scoring ─────────────────────────────────────────────────────
//
// An audit is a checklist with scoring switched on. Scoreable questions
// carry points (awarded on pass, zero on fail) and a severity that
// drives alert routing. Questions can be grouped into sections with
// subtotals. The result is computed once at submit and stored on the
// instance.

export type Severity = 'critical' | 'medium' | 'low';

/** Template-level weight map: a question's point value comes from its
 *  severity, so the score and the alerts can never disagree. */
export type SeverityWeights = Record<Severity, number>;

export interface AuditSection {
  id: string;
  name: string;
}

export interface SectionScore {
  sectionId: string;
  name: string;
  awarded: number;
  total: number;
}

export interface AuditScoreResult {
  pointsAwarded: number;
  pointsTotal: number;
  /** Rounded percentage, 0–100. */
  pct: number;
  /** Pass threshold the result was judged against (template value at submit). */
  passThresholdPct: number;
  /** Fails the audit outright regardless of percentage. */
  criticalFails: number;
  passed: boolean;
  sectionScores: SectionScore[];
  failedQuestionIds: string[];
}

// ── Corrective actions ────────────────────────────────────────────────
//
// A "No" on a question with `correctiveActionConfig` spawns a
// CorrectiveAction: a separate work item owned by the store, not the
// auditor. The auditor writes the issue summary inline and picks the
// assignee; the checklist then completes independently. The corrective
// action carries its own open → resolved lifecycle and links back to
// the source instance + question.

export type CorrectiveAssigneeType = 'outlet_manager' | 'store_account';
export type CorrectiveActionStatus = 'open' | 'in_progress' | 'resolved';

export interface CorrectiveActionConfig {
  /** Which answer raises the action. Only "No" is supported — a No always
   *  generates a corrective action, there is no "no issue" branch. */
  triggerOnNo: true;
  defaultAssignee: CorrectiveAssigneeType;
  /** Whether the store must attach a photo as evidence when resolving. */
  requirePhotoEvidence: boolean;
}

export interface CorrectiveAction {
  id: string;
  sourceInstanceId: string;
  sourceQuestionId: string;
  templateName: string;
  site: string;
  questionText: string;
  /** Written by the checklist author (the auditor) at completion time. */
  issueSummary: string;
  issuePhotoDataUrl?: string;
  raisedBy: string;
  /** ISO date, e.g. "2026-04-20" */
  raisedDate: string;
  /** Display label, e.g. "9:30am · 20 Apr" */
  raisedAtLabel: string;
  assigneeType: CorrectiveAssigneeType;
  assigneeName: string;
  requirePhotoEvidence: boolean;
  status: CorrectiveActionStatus;
  /** Audit actions only — severity of the failed question, drives alerts. */
  severity?: Severity;
  /** Audit actions only — points forfeited by the fail. */
  pointsLost?: number;
  /** Completed by the store when resolving. */
  resolutionText?: string;
  resolutionPhotoDataUrl?: string;
  resolvedBy?: string;
  resolvedAtLabel?: string;
}

// ── Repeating groups (table-style questions) ─────────────────────────
//
// One question, many entries — e.g. a delivery log where each row is
// supplier / product / condition / temperature. Fields with a
// `maxThreshold` (temperature) or a `followUpPrompt` on a checkbox
// drive per-row conditional prompting.

export type GroupFieldType = 'text' | 'checkbox' | 'temperature';

export interface GroupField {
  id: string;
  name: string;
  type: GroupFieldType;
  /** Temperature fields only — values above this trigger the follow-up prompt. */
  maxThreshold?: number;
  /** Prompt shown when this field breaches its threshold (temperature) or is
   *  answered No (checkbox). */
  followUpPrompt?: string;
}

export interface RepeatingRow {
  id: string;
  values: Record<string, string | number | boolean | null>;
  /** Free-text answer to any triggered per-row follow-up prompt. */
  followUpNote?: string;
  followUpPhotoDataUrl?: string;
}

export interface ChecklistQuestion {
  id: string;
  name: string;
  mandatory: boolean;
  allowPhoto: boolean;
  responseType: ResponseType;
  followUpRules: FollowUpRule[];
  /** If set, this question is a follow-up child — shown inline below its parent */
  parentQuestionId?: string;
  /** Checkbox questions only — a No answer raises an assignable corrective action. */
  correctiveActionConfig?: CorrectiveActionConfig;
  /** repeating_group questions only — the columns each row captures. */
  groupFields?: GroupField[];
  /** Audit templates only — drives alert routing and, via the template's
   *  severity weight map, the question's point value. */
  severity?: Severity;
  /** Audit templates only — section this question belongs to. */
  sectionId?: string;
}

/** How completion notifications are scoped for a template. */
export type NotifyScope =
  /** Only the assigned people at the site the checklist was completed for.
   *  One template covers every site without per-store duplication. */
  | 'site_assignees'
  /** A fixed list of named users, regardless of site. */
  | 'specific_users';

export interface ChecklistTemplate {
  id: string;
  name: string;
  sites: string[];
  notifyUserIds: string[];
  /** Defaults to 'specific_users' when absent (legacy templates). */
  notifyScope?: NotifyScope;
  frequency: Frequency;
  timeOfDay: string;
  assignedRoles: UserRole[];
  questions: ChecklistQuestion[];
  active: boolean;
  /** Audit mode — scoring on questions, pass/fail result, actions on fails. */
  scoringEnabled?: boolean;
  /** Pass mark as a percentage (defaults to 80 when scoring is enabled). */
  passThresholdPct?: number;
  /** Points per severity (defaults: Critical 10 · Medium 5 · Low 2).
   *  Changing a weight re-scores every affected question. */
  severityWeights?: SeverityWeights;
  /** Question groupings shown with subtotal scores. */
  sections?: AuditSection[];
}

export interface ChecklistAnswer {
  questionId: string;
  value: string | number | boolean | null;
  /** Free-text note attached to the answer (used by rating questions). */
  note?: string;
  photoDataUrl?: string;
  /** repeating_group questions — one entry per logged row. */
  rows?: RepeatingRow[];
  /** Captured when a No answer raises a corrective action: the auditor's
   *  issue summary and chosen assignee, turned into a CorrectiveAction
   *  on submit. */
  correctiveActionDraft?: {
    issueSummary: string;
    assigneeType: CorrectiveAssigneeType;
    photoDataUrl?: string;
  };
}

export interface ChecklistInstance {
  id: string;
  templateId: string;
  templateName: string;
  site: string;
  status: InstanceStatus;
  dueLabel: string;
  assignedRole: UserRole;
  questionCount: number;
  answers: ChecklistAnswer[];
  /** Time string e.g. "7:12am" for display */
  completedAt?: string;
  /** ISO date string e.g. "2026-04-03" for grouping in history */
  completedDate?: string;
  /** Name of who completed it */
  completedBy?: string;
  /** Audit instances only — result computed and locked at submit. */
  scoreResult?: AuditScoreResult;
}
