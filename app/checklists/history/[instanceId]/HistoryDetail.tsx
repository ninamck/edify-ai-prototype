'use client';

import { useRouter } from 'next/navigation';
import {
  CheckCircle2,
  XCircle,
  Clock,
  MapPin,
  User,
  Thermometer,
  Hash,
  AlignLeft,
  AlertTriangle,
  GitBranch,
} from 'lucide-react';
import { getInstanceById, getTemplateForInstance } from '../../mockData';
import type { ChecklistAnswer, ChecklistQuestion, ResponseType } from '../../types';

// ─── helpers ──────────────────────────────────────────────────────────────────

function formatAnswer(answer: ChecklistAnswer, responseType: ResponseType): string {
  if (answer.value === null || answer.value === '') return '—';
  if (responseType === 'checkbox') return answer.value ? 'Yes' : 'No';
  if (responseType === 'temperature') return `${answer.value}°C`;
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
      ? { bg: '#F0FDF4', text: '#15803D', border: '#BBF7D0' }
      : { bg: '#FEF2F2', text: '#B91C1C', border: '#FECACA' };
  }
  if (responseType === 'temperature' || responseType === 'number') {
    return { bg: '#EFF6FF', text: '#1D4ED8', border: '#BFDBFE' };
  }
  return { bg: 'var(--color-bg-surface)', text: 'var(--color-text-primary)', border: 'var(--color-border-subtle)' };
}

const RESPONSE_ICON: Record<ResponseType, React.ElementType> = {
  checkbox: CheckCircle2,
  temperature: Thermometer,
  number: Hash,
  text: AlignLeft,
};

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
  const hasAnswer = answer && (answer.value !== null && answer.value !== '');
  const triggered = wasFollowUpTriggered(question, answer);
  const colors = hasAnswer ? answerColor(answer!, question.responseType) : null;
  const ResponseIcon = RESPONSE_ICON[question.responseType];
  const isCheckboxNo = question.responseType === 'checkbox' && answer?.value === false;

  return (
    <div
      style={{
        padding: '14px 16px',
        borderRadius: '10px',
        border: isFollowUp ? '1px solid #FDE68A' : '1px solid var(--color-border-subtle)',
        background: isFollowUp ? '#FFFBEB' : '#fff',
        marginLeft: isFollowUp ? '16px' : '0',
        borderLeft: isFollowUp ? '3px solid #F59E0B' : undefined,
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
      }}
    >
      {/* Question header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '7px', flex: 1, minWidth: 0 }}>
          {isFollowUp && (
            <GitBranch size={12} color="#D97706" style={{ flexShrink: 0, marginTop: '2px' }} />
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
                ? <XCircle size={13} color="#B91C1C" />
                : <CheckCircle2 size={13} color="#15803D" />
            ) : null}
            <span style={{ fontSize: '12px', fontWeight: 700, color: colors.text }}>
              {formatAnswer(answer!, question.responseType)}
            </span>
          </div>
        )}

        {!hasAnswer && (
          <span style={{ fontSize: '11px', color: 'var(--color-text-muted)', flexShrink: 0 }}>Not answered</span>
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

      {/* Follow-up triggered indicator */}
      {triggered && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
          <AlertTriangle size={11} color="#D97706" />
          <span style={{ fontSize: '10px', color: '#D97706', fontWeight: 600 }}>Follow-up triggered</span>
        </div>
      )}
    </div>
  );
}

// ─── Main client component ────────────────────────────────────────────────────

export function HistoryDetailClient({ instanceId }: { instanceId: string }) {
  const router = useRouter();
  const instance = getInstanceById(instanceId);
  const template = instance ? getTemplateForInstance(instance) : undefined;

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
  const allAnsweredCount = instance.answers.filter((a) => a.value !== null && a.value !== '').length;
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
              background: '#F0FDF4',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}>
              <CheckCircle2 size={22} color="#15803D" />
            </div>
            <div>
              <div style={{ fontSize: '15px', fontWeight: 800, color: 'var(--color-text-primary)' }}>
                {template.name}
              </div>
              <div style={{ fontSize: '11px', color: 'var(--color-text-secondary)', marginTop: '1px' }}>
                Completed
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px' }}>
            {instance.completedBy && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <User size={12} color="var(--color-text-muted)" />
                <span style={{ fontSize: '12px', color: 'var(--color-text-secondary)' }}>{instance.completedBy}</span>
              </div>
            )}
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <Clock size={12} color="var(--color-text-muted)" />
              <span style={{ fontSize: '12px', color: 'var(--color-text-secondary)' }}>
                {instance.completedAt}
                {instance.completedDate && ` · ${formatDateHeading(instance.completedDate)}`}
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <MapPin size={12} color="var(--color-text-muted)" />
              <span style={{ fontSize: '12px', color: 'var(--color-text-secondary)' }}>{instance.site}</span>
            </div>
          </div>

          {/* Stats row */}
          <div style={{ display: 'flex', gap: '8px' }}>
            <StatChip label="Answered" value={allAnsweredCount} color="var(--color-text-primary)" />
            <StatChip label="Pass" value={passedCount} color="#15803D" />
            {failedCount > 0 && <StatChip label="Needs attention" value={failedCount} color="#B91C1C" />}
          </div>
        </div>

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
                    fontSize: '9px',
                    fontWeight: 700,
                    letterSpacing: '0.06em',
                    textTransform: 'uppercase',
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

function StatChip({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div style={{
      flex: 1,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      padding: '8px 6px',
      borderRadius: '8px',
      background: '#fff',
      border: '1px solid var(--color-border-subtle)',
      gap: '1px',
    }}>
      <span style={{ fontSize: '17px', fontWeight: 800, color }}>{value}</span>
      <span style={{ fontSize: '9px', fontWeight: 600, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</span>
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
