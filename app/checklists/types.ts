export type ResponseType = 'temperature' | 'number' | 'text' | 'checkbox';
export type Frequency = 'daily' | 'weekly' | 'monthly' | 'once';
export type UserRole = 'kitchen' | 'manager' | 'admin';
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

export interface ChecklistQuestion {
  id: string;
  name: string;
  mandatory: boolean;
  allowPhoto: boolean;
  responseType: ResponseType;
  followUpRules: FollowUpRule[];
  /** If set, this question is a follow-up child — shown inline below its parent */
  parentQuestionId?: string;
}

export interface ChecklistTemplate {
  id: string;
  name: string;
  sites: string[];
  notifyUserIds: string[];
  frequency: Frequency;
  timeOfDay: string;
  assignedRoles: UserRole[];
  questions: ChecklistQuestion[];
  active: boolean;
}

export interface ChecklistAnswer {
  questionId: string;
  value: string | number | boolean | null;
  photoDataUrl?: string;
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
}
