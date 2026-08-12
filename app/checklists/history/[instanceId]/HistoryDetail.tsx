'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import {
  CheckCircle2,
  XCircle,
  Clock,
  MapPin,
  User,
  UserCheck,
  Thermometer,
  Hash,
  AlignLeft,
  AlertTriangle,
  ChevronRight,
  FileText,
  Gauge,
  GitBranch,
  Table,
  Wrench,
} from 'lucide-react';
import { getInstanceById, getTemplateForInstance } from '../../mockData';
import { useCorrectiveActions } from '../../correctiveActionsStore';
import { useChecklistStore } from '../../templatesStore';
import type { ChecklistAnswer, ChecklistQuestion, GroupField, ResponseType } from '../../types';

// ─── helpers ──────────────────────────────────────────────────────────────────

function formatAnswer(answer: ChecklistAnswer, responseType: ResponseType): string {
  if (responseType === 'repeating_group') {
    const n = answer.rows?.length ?? 0;
    return `${n} ${n === 1 ? 'entry' : 'entries'}`;
  }
  if (answer.value === null || answer.value === '') return '—';
  if (responseType === 'checkbox') return answer.value ? 'Yes' : 'No';
  if (responseType === 'temperature') return `${answer.value}°C`;
  if (responseType === 'rating') {
    const v = String(answer.value);
    return v.charAt(0).toUpperCase() + v.slice(1);
  }
  return String(answer.value);
}

function wasFollowUpTriggered(question: ChecklistQuestion, answer: ChecklistAnswer | undefined): boolean {
  if (!answer || !question.followUpRules.length) return false;
  return question.followUpRules.some((r) => {
    const v = answer.value;
    const { type, value } = r.condition;
    if (type === 'unchecked') return v === false;
    if (type === 'checked') return v === true;
    if (type === 'greater_than') return typeof v === 'number' && typeof value === 'number' && v > value;
    if (type === 'less_than') return typeof v === 'number' && typeof value === 'number' && v < value;
    if (type === 'equals') return String(v) === String(value);
    if (type === 'contains') return typeof v === 'string' && v.includes(String(value));
    return false;
  });
}

function answerColor(answer: ChecklistAnswer, responseType: ResponseType): { bg: string; text: string; border: string } {
  if (responseType === 'checkbox') {
    return answer.value === true
      ? { bg: '#E3F2E8', text: '#166534', border: '#93C8A6' }
      : { bg: '#FCE5EB', text: '#B01038', border: '#E89AAE' };
  }
  if (responseType === 'temperature' || responseType === 'number') {
    return { bg: '#E4EDFB', text: '#3D5CA6', border: '#BFDBFE' };
  }
  if (responseType === 'rating') {
    if (answer.value === 'great') return { bg: '#E3F2E8', text: '#166534', border: '#93C8A6' };
    if (answer.value === 'average') return { bg: '#FEF6DA', text: '#001C35', border: '#EAD173' };
    // 'urgent' is an escalation, not an error — warning field, navy ink.
    return { bg: '#FEF6DA', text: '#001C35', border: '#EAD173' };
  }
  return { bg: 'var(--color-bg-surface)', text: 'var(--color-text-primary)', border: 'var(--color-border-subtle)' };
}

const RESPONSE_ICON: Record<ResponseType, React.ElementType> = {
  checkbox: CheckCircle2,
  temperature: Thermometer,
  number: Hash,
  text: AlignLeft,
  rating: Gauge,
  repeating_group: Table,
};

// ─── Repeating rows table ─────────────────────────────────────────────────────

function formatRowValue(field: GroupField, v: string | number | boolean | null | undefined): string {
  if (v === null || v === undefined || v === '') return '—';
  if (field.type === 'checkbox') return v === true ? 'Yes' : 'No';
  if (field.type === 'temperature') return `${v}°C`;
  return String(v);
}

function rowValueFlagged(field: GroupField, v: string | number | boolean | null | undefined): boolean {
  if (field.type === 'temperature' && typeof field.maxThreshold === 'number' && typeof v === 'number') {
    return v > field.maxThreshold;
  }
  if (field.type === 'checkbox') return v === false;
  return false;
}

function RowsTable({ fields, answer }: { fields: GroupField[]; answer: ChecklistAnswer }) {
  const rows = answer.rows ?? [];
  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
        <thead>
          <tr>
            {fields.map((f) => (
              <th
                key={f.id}
                style={{
                  textAlign: 'left',
                  padding: '7px 10px',
                  fontWeight: 700,
                  color: 'var(--color-text-muted)',
                  letterSpacing: '0.03em',
                  borderBottom: '1px solid var(--color-border-subtle)',
                  whiteSpace: 'nowrap',
                }}
              >
                {f.name}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const flagged = fields.some((f) => rowValueFlagged(f, row.values[f.id]));
            return (
              <React.Fragment key={row.id}>
                <tr style={{ background: flagged ? '#FEF6DA' : undefined }}>
                  {fields.map((f) => {
                    const v = row.values[f.id];
                    const cellFlagged = rowValueFlagged(f, v);
                    return (
                      <td
                        key={f.id}
                        style={{
                          padding: '8px 10px',
                          borderBottom: '1px solid var(--color-border-subtle)',
                          color: cellFlagged ? '#001C35' : 'var(--color-text-primary)',
                          fontWeight: cellFlagged ? 700 : 500,
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {formatRowValue(f, v)}
                      </td>
                    );
                  })}
                </tr>
                {row.followUpNote && (
                  <tr style={{ background: '#FEF6DA' }}>
                    <td
                      colSpan={fields.length}
                      style={{
                        padding: '6px 10px 9px',
                        borderBottom: '1px solid var(--color-border-subtle)',
                        color: '#001C35',
                        fontStyle: 'italic',
                        lineHeight: 1.45,
                      }}
                    >
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                        <GitBranch size={11} />
                        &ldquo;{row.followUpNote}&rdquo;
                      </span>
                    </td>
                  </tr>
                )}
              </React.Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ─── Answer row ───────────────────────────────────────────────────────────────

function AnswerRow({
  question,
  answer,
  isFollowUp,
  allAnswers,
}: {
  question: ChecklistQuestion;
  answer: ChecklistAnswer | undefined;
  isFollowUp: boolean;
  allAnswers: ChecklistAnswer[];
}) {
  const hasAnswer = Boolean(
    answer && ((answer.value !== null && answer.value !== '') || (answer.rows?.length ?? 0) > 0),
  );
  const triggered = wasFollowUpTriggered(question, answer);
  const correctiveDraft = answer?.correctiveActionDraft;
  const colors = hasAnswer ? answerColor(answer!, question.responseType) : null;
  const ResponseIcon = RESPONSE_ICON[question.responseType];
  const isCheckboxNo = question.responseType === 'checkbox' && answer?.value === false;

  return (
    <div
      style={{
        padding: '14px 16px',
        borderRadius: '10px',
        border: isFollowUp ? '1px solid #EAD173' : '1px solid var(--color-border-subtle)',
        background: isFollowUp ? '#FEF6DA' : '#fff',
        marginLeft: isFollowUp ? '16px' : '0',
        boxShadow: isFollowUp ? 'inset 3px 0 0 #F59E0B' : undefined,
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
      }}
    >
      {/* Question header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '7px', flex: 1, minWidth: 0 }}>
          {isFollowUp && (
            <GitBranch size={12} color="#001C35" style={{ flexShrink: 0, marginTop: '2px' }} />
          )}
          <ResponseIcon size={13} color="var(--color-text-muted)" style={{ flexShrink: 0, marginTop: '2px' }} />
          <span style={{
            fontSize: '13px',
            fontWeight: 600,
            color: 'var(--color-text-primary)',
            lineHeight: 1.4,
          }}>
            {question.name}
          </span>
        </div>

        {/* Answer badge */}
        {hasAnswer && colors && (
          <div style={{
            flexShrink: 0,
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            padding: '4px 10px',
            borderRadius: '8px',
            background: colors.bg,
            border: `1px solid ${colors.border}`,
          }}>
            {question.responseType === 'checkbox' ? (
              isCheckboxNo
                ? <XCircle size={13} color="#B01038" />
                : <CheckCircle2 size={13} color="#166534" />
            ) : null}
            <span style={{ fontSize: '12px', fontWeight: 700, color: colors.text }}>
              {formatAnswer(answer!, question.responseType)}
            </span>
          </div>
        )}

        {!hasAnswer && (
          <span style={{ fontSize: '12px', fontWeight: 500, color: 'var(--color-text-muted)', flexShrink: 0 }}>Not answered</span>
        )}
      </div>

      {/* Text answer (shown inline below the question if long) */}
      {hasAnswer && question.responseType === 'text' && answer!.value && (
        <div style={{
          padding: '10px 12px',
          borderRadius: '8px',
          background: 'var(--color-bg-surface)',
          fontSize: '13px',
          color: 'var(--color-text-primary)',
          lineHeight: 1.5,
          fontStyle: 'italic',
        }}>
          &ldquo;{String(answer!.value)}&rdquo;
        </div>
      )}

      {/* Attached note (rating questions) */}
      {answer?.note && (
        <div style={{
          padding: '10px 12px',
          borderRadius: '8px',
          background: 'var(--color-bg-surface)',
          fontSize: '13px',
          color: 'var(--color-text-primary)',
          lineHeight: 1.5,
          fontStyle: 'italic',
        }}>
          &ldquo;{answer.note}&rdquo;
        </div>
      )}

      {/* Repeating rows — rendered as a table */}
      {question.responseType === 'repeating_group' && hasAnswer && (
        <RowsTable fields={question.groupFields ?? []} answer={answer!} />
      )}

      {/* Corrective action issue summary (auditor's half, captured on a No) */}
      {correctiveDraft && (
        <div style={{
          padding: '10px 12px',
          borderRadius: '8px',
          border: '1px solid #E89AAE',
          boxShadow: 'inset 3px 0 0 #B01038',
          background: '#FFF7F8',
          display: 'flex',
          flexDirection: 'column',
          gap: '5px',
        }}>
          <span style={{ fontSize: '12px', fontWeight: 700, color: '#B01038' }}>Issue summary</span>
          <span style={{ fontSize: '13px', color: 'var(--color-text-primary)', lineHeight: 1.5, fontStyle: 'italic' }}>
            &ldquo;{correctiveDraft.issueSummary}&rdquo;
          </span>
        </div>
      )}

      {/* Follow-up triggered indicator */}
      {triggered && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
          <AlertTriangle size={11} color="#001C35" />
          <span style={{ fontSize: '12px', color: '#001C35', fontWeight: 600 }}>Follow-up triggered</span>
        </div>
      )}
    </div>
  );
}

// ─── Main client component ────────────────────────────────────────────────────

export function HistoryDetailClient({ instanceId }: { instanceId: string }) {
  const router = useRouter();
  // Live completions and custom templates live in the client store; the
  // hook's empty server snapshot keeps SSR consistent with fixtures.
  const checklistStore = useChecklistStore();
  const instance =
    checklistStore.instances.find((i) => i.id === instanceId) ?? getInstanceById(instanceId);
  const template = instance
    ? checklistStore.templates.find((t) => t.id === instance.templateId) ??
      getTemplateForInstance(instance)
    : undefined;
  const allActions = useCorrectiveActions();
  const linkedActions = allActions.filter((a) => a.sourceInstanceId === instanceId);

  if (!instance || !template) {
    return (
      <div style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--color-text-secondary)' }}>
        Record not found.
      </div>
    );
  }

  function getAnswer(questionId: string): ChecklistAnswer | undefined {
    return instance!.answers.find((a) => a.questionId === questionId);
  }

  const rootQuestions = template.questions.filter((q) => !q.parentQuestionId);
  const score = instance.scoreResult;
  const openLinked = linkedActions.filter((a) => a.status !== 'resolved').length;
  const closedOut = linkedActions.length > 0 && openLinked === 0;
  const allAnsweredCount = instance.answers.filter(
    (a) => (a.value !== null && a.value !== '') || (a.rows?.length ?? 0) > 0,
  ).length;
  const passedCount = instance.answers.filter((a) => a.value === true || (typeof a.value === 'number') || (typeof a.value === 'string' && a.value.length > 0)).length;
  const failedCount = instance.answers.filter((a) => a.value === false).length;

  return (
    <div style={{ minHeight: '100%', background: '#fff' }}>
      <div style={{ maxWidth: '560px', margin: '0 auto', padding: '20px 16px 48px' }}>

        {/* Summary card */}
        <div style={{
          padding: '16px',
          borderRadius: '12px',
          border: '1px solid var(--color-border-subtle)',
          background: 'var(--color-bg-surface)',
          marginBottom: '20px',
          display: 'flex',
          flexDirection: 'column',
          gap: '10px',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{
              width: '44px',
              height: '44px',
              borderRadius: '10px',
              background: score && !score.passed ? '#FDE8E8' : '#E3F2E8',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}>
              {score && !score.passed
                ? <AlertTriangle size={20} color="#B91C1C" />
                : <CheckCircle2 size={22} color="#166534" />}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: '15px', fontWeight: 800, color: 'var(--color-text-primary)' }}>
                {template.name}
              </div>
              <div style={{ fontSize: '12px', fontWeight: 500, color: 'var(--color-text-secondary)', marginTop: '1px', display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                {score ? (
                  <>
                    <span style={{ fontWeight: 800, color: 'var(--color-text-primary)' }}>
                      {score.pct}% · {score.pointsAwarded}/{score.pointsTotal} points
                    </span>
                    <span style={{
                      padding: '1px 9px',
                      borderRadius: '100px',
                      fontWeight: 800,
                      background: score.passed ? '#E3F2E8' : '#FDE8E8',
                      color: score.passed ? '#166534' : '#B91C1C',
                    }}>
                      {score.passed ? 'Passed' : 'Failed'}
                    </span>
                  </>
                ) : (
                  'Completed'
                )}
                {linkedActions.length > 0 && (
                  <span style={{
                    padding: '1px 9px',
                    borderRadius: '100px',
                    fontWeight: 700,
                    background: closedOut ? '#E3F2E8' : '#FEF6DA',
                    color: closedOut ? '#166534' : '#B45309',
                  }}>
                    {closedOut
                      ? 'Closed out'
                      : `Not closed out — ${openLinked} open action${openLinked === 1 ? '' : 's'}`}
                  </span>
                )}
              </div>
            </div>
          </div>

          {score && score.criticalFails > 0 && (
            <div style={{
              padding: '9px 12px',
              borderRadius: '9px',
              background: '#FDE8E8',
              border: '1px solid #F5B5B5',
              fontSize: '12px',
              fontWeight: 700,
              color: '#B91C1C',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}>
              <AlertTriangle size={13} />
              Failed: {score.criticalFails} critical issue{score.criticalFails === 1 ? '' : 's'} — overrides the {score.pct}% score
            </div>
          )}

          {score && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
              {score.sectionScores.map((s) => (
                <span key={s.sectionId} style={{
                  padding: '3px 10px',
                  borderRadius: '100px',
                  fontSize: '12px',
                  fontWeight: 600,
                  background: '#fff',
                  border: '1px solid var(--color-border-subtle)',
                  color: 'var(--color-text-secondary)',
                }}>
                  {s.name} {s.awarded}/{s.total}
                </span>
              ))}
            </div>
          )}

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px' }}>
            {instance.completedBy && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <User size={12} color="var(--color-text-muted)" />
                <span style={{ fontSize: '12px', fontWeight: 500, color: 'var(--color-text-secondary)' }}>{instance.completedBy}</span>
              </div>
            )}
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <Clock size={12} color="var(--color-text-muted)" />
              <span style={{ fontSize: '12px', fontWeight: 500, color: 'var(--color-text-secondary)' }}>
                {instance.completedAt}
                {instance.completedDate && ` · ${formatDateHeading(instance.completedDate)}`}
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <MapPin size={12} color="var(--color-text-muted)" />
              <span style={{ fontSize: '12px', fontWeight: 500, color: 'var(--color-text-secondary)' }}>{instance.site}</span>
            </div>
          </div>

          {/* Stats row */}
          <div style={{ display: 'flex', gap: '8px' }}>
            <StatChip label="Answered" value={allAnsweredCount} color="var(--color-text-primary)" />
            <StatChip label="Pass" value={passedCount} color="#166534" />
            {failedCount > 0 && (
              // Needs-attention counts take the warning yellow field with
              // navy ink — never red (overdue/attention ≠ broken).
              <StatChip label="Needs attention" value={failedCount} color="#001C35" bg="#FEF6DA" border="#EAD173" />
            )}
          </div>

          {/* Printable report — audits only */}
          {score && (
            <button
              type="button"
              onClick={() => router.push(`/checklists/report/${instance.id}`)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '10px 14px',
                borderRadius: '9px',
                border: '1px solid var(--color-border)',
                background: '#fff',
                fontSize: '13px',
                fontWeight: 600,
                color: 'var(--color-text-primary)',
                cursor: 'pointer',
                fontFamily: 'var(--font-primary)',
                alignSelf: 'flex-start',
              }}
            >
              <FileText size={14} />
              View audit report (PDF)
            </button>
          )}
        </div>

        {/* Linked corrective actions — has the store closed the loop? */}
        {linkedActions.length > 0 && (
          <div style={{ marginBottom: '20px' }}>
            <div style={{
              fontSize: '12px',
              fontWeight: 700,
              letterSpacing: '0.04em',
              color: 'var(--color-text-muted)',
              marginBottom: '8px',
            }}>
              Corrective actions raised
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {linkedActions.map((ca) => {
                const isOpen = ca.status !== 'resolved';
                return (
                  <button
                    key={ca.id}
                    type="button"
                    onClick={() => router.push(`/checklists/actions/${ca.id}`)}
                    style={{
                      width: '100%',
                      textAlign: 'left',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '10px',
                      padding: '12px 14px',
                      borderRadius: '10px',
                      border: isOpen ? '1px solid #E89AAE' : '1px solid var(--color-border-subtle)',
                      boxShadow: isOpen ? 'inset 3px 0 0 #B01038' : 'inset 3px 0 0 #166534',
                      background: '#fff',
                      cursor: 'pointer',
                      fontFamily: 'var(--font-primary)',
                    }}
                  >
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{
                        fontSize: '13px',
                        fontWeight: 600,
                        color: 'var(--color-text-primary)',
                        lineHeight: 1.4,
                        marginBottom: '3px',
                      }}>
                        {ca.questionText}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                        <span style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                          padding: '2px 8px',
                          borderRadius: '100px',
                          fontSize: '12px',
                          fontWeight: 700,
                          background: ca.status === 'open' ? '#FCE5EB' : ca.status === 'in_progress' ? '#E4EDFB' : '#E3F2E8',
                          color: ca.status === 'open' ? '#B01038' : ca.status === 'in_progress' ? '#3D5CA6' : '#166534',
                        }}>
                          {ca.status === 'in_progress' && <Wrench size={10} />}
                          {ca.status === 'open' ? 'Open' : ca.status === 'in_progress' ? 'In progress' : 'Resolved'}
                        </span>
                        {ca.severity && (
                          <span style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            padding: '2px 8px',
                            borderRadius: '100px',
                            fontSize: '12px',
                            fontWeight: 700,
                            background: ca.severity === 'critical' ? '#FDE8E8' : ca.severity === 'medium' ? '#FEF6DA' : '#EFF5E1',
                            color: ca.severity === 'critical' ? '#B91C1C' : ca.severity === 'medium' ? '#B45309' : '#4D7C0F',
                          }}>
                            {ca.severity === 'critical' ? 'Critical' : ca.severity === 'medium' ? 'Medium' : 'Low'}
                          </span>
                        )}
                        <span style={{ fontSize: '12px', fontWeight: 500, color: 'var(--color-text-secondary)', display: 'flex', alignItems: 'center', gap: '3px' }}>
                          <UserCheck size={11} />
                          {ca.assigneeName}
                        </span>
                        {!isOpen && ca.resolvedAtLabel && (
                          <span style={{ fontSize: '12px', fontWeight: 500, color: 'var(--color-text-muted)' }}>
                            Resolved {ca.resolvedAtLabel}
                          </span>
                        )}
                      </div>
                    </div>
                    <ChevronRight size={15} color="var(--color-text-muted)" style={{ flexShrink: 0 }} />
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Answers */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {rootQuestions.map((q, i) => {
            const ans = getAnswer(q.id);
            const triggered = wasFollowUpTriggered(q, ans);
            const followUpQuestions = triggered
              ? q.followUpRules
                  .filter((r) => {
                    const a = getAnswer(q.id);
                    if (!a) return false;
                    const { type, value } = r.condition;
                    if (type === 'unchecked') return a.value === false;
                    if (type === 'checked') return a.value === true;
                    if (type === 'greater_than') return typeof a.value === 'number' && typeof value === 'number' && a.value > value;
                    if (type === 'less_than') return typeof a.value === 'number' && typeof value === 'number' && a.value < value;
                    return false;
                  })
                  .map((r) => template.questions.find((fq) => fq.id === r.followUpQuestionId))
                  .filter(Boolean) as typeof rootQuestions
              : [];

            return (
              <div key={q.id} style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '5px', marginTop: i > 0 ? '2px' : '0' }}>
                  <span style={{
                    fontSize: '12px',
                    fontWeight: 700,
                    letterSpacing: '0.04em',
                    color: 'var(--color-text-muted)',
                  }}>
                    Q{i + 1}
                  </span>
                </div>
                <AnswerRow
                  question={q}
                  answer={ans}
                  isFollowUp={false}
                  allAnswers={instance.answers}
                />
                {followUpQuestions.map((fq) => (
                  <AnswerRow
                    key={fq.id}
                    question={fq}
                    answer={getAnswer(fq.id)}
                    isFollowUp={true}
                    allAnswers={instance.answers}
                  />
                ))}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function StatChip({ label, value, color, bg, border }: { label: string; value: number; color: string; bg?: string; border?: string }) {
  return (
    <div style={{
      flex: 1,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      padding: '8px 6px',
      borderRadius: '8px',
      background: bg ?? '#fff',
      border: `1px solid ${border ?? 'var(--color-border-subtle)'}`,
      gap: '1px',
    }}>
      <span style={{ fontSize: '17px', fontWeight: 800, color }}>{value}</span>
      <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</span>
    </div>
  );
}

function formatDateHeading(dateStr: string): string {
  const today = '2026-04-04';
  const yesterday = '2026-04-03';
  if (dateStr === today) return 'Today';
  if (dateStr === yesterday) return 'Yesterday';
  const [, month, day] = dateStr.split('-');
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${parseInt(day)} ${months[parseInt(month) - 1]}`;
}
