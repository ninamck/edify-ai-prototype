'use client';

import { useState, useId } from 'react';
import { useRouter } from 'next/navigation';
import {
  Plus,
  Trash2,
  GripVertical,
  ChevronDown,
  ChevronUp,
  Camera,
  AlertCircle,
  CheckSquare,
  Thermometer,
  Hash,
  AlignLeft,
  GitBranch,
} from 'lucide-react';
import { MOCK_TEMPLATES, MOCK_SITES, MOCK_USERS } from './mockData';
import type {
  ChecklistTemplate,
  ChecklistQuestion,
  ResponseType,
  Frequency,
  UserRole,
  FollowUpRule,
  FollowUpConditionType,
} from './types';

// ─── helpers ────────────────────────────────────────────────────────────────

const FREQ_OPTIONS: { value: Frequency; label: string }[] = [
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'once', label: 'One-off' },
];

const ROLE_OPTIONS: { value: UserRole; label: string }[] = [
  { value: 'kitchen', label: 'Kitchen' },
  { value: 'manager', label: 'Manager' },
  { value: 'admin', label: 'Admin' },
];

const RESPONSE_OPTIONS: { value: ResponseType; label: string; icon: React.ElementType }[] = [
  { value: 'checkbox', label: 'Checkbox', icon: CheckSquare },
  { value: 'temperature', label: 'Temperature', icon: Thermometer },
  { value: 'number', label: 'Number', icon: Hash },
  { value: 'text', label: 'Text', icon: AlignLeft },
];

const CONDITION_OPTIONS: { value: FollowUpConditionType; label: string; forTypes: ResponseType[] }[] = [
  { value: 'checked', label: 'is checked', forTypes: ['checkbox'] },
  { value: 'unchecked', label: 'is unchecked', forTypes: ['checkbox'] },
  { value: 'greater_than', label: 'is greater than', forTypes: ['temperature', 'number'] },
  { value: 'less_than', label: 'is less than', forTypes: ['temperature', 'number'] },
  { value: 'equals', label: 'equals', forTypes: ['temperature', 'number', 'text'] },
  { value: 'contains', label: 'contains', forTypes: ['text'] },
];

function uid() {
  return Math.random().toString(36).slice(2, 9);
}

function newQuestion(): ChecklistQuestion {
  return {
    id: `q-${uid()}`,
    name: '',
    mandatory: true,
    allowPhoto: false,
    responseType: 'checkbox',
    followUpRules: [],
  };
}

// ─── small reusables ─────────────────────────────────────────────────────────

function PillToggle({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        padding: '5px 12px',
        borderRadius: '100px',
        border: active ? 'none' : '1px solid var(--color-border)',
        background: active ? 'var(--color-accent-active)' : '#fff',
        color: active ? '#F4F1EC' : 'var(--color-text-secondary)',
        fontSize: '12px',
        fontWeight: 600,
        cursor: 'pointer',
        fontFamily: 'var(--font-primary)',
        transition: 'all 0.15s ease',
      }}
    >
      {label}
    </button>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        fontSize: '10px',
        fontWeight: 700,
        letterSpacing: '0.08em',
        textTransform: 'uppercase',
        color: 'var(--color-text-muted)',
        marginBottom: '10px',
      }}
    >
      {children}
    </div>
  );
}

function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
      <div
        onClick={() => onChange(!checked)}
        style={{
          width: '36px',
          height: '20px',
          borderRadius: '100px',
          background: checked ? 'var(--color-accent-active)' : 'var(--color-border)',
          position: 'relative',
          transition: 'background 0.2s ease',
          flexShrink: 0,
        }}
      >
        <div
          style={{
            position: 'absolute',
            top: '2px',
            left: checked ? '18px' : '2px',
            width: '16px',
            height: '16px',
            borderRadius: '50%',
            background: '#fff',
            transition: 'left 0.2s ease',
            boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
          }}
        />
      </div>
      <span style={{ fontSize: '12px', color: 'var(--color-text-secondary)', fontWeight: 500 }}>{label}</span>
    </label>
  );
}

// ─── Follow-up rule row ───────────────────────────────────────────────────────

function FollowUpRuleRow({
  rule,
  parentResponseType,
  allQuestions,
  onChange,
  onDelete,
}: {
  rule: FollowUpRule;
  parentResponseType: ResponseType;
  allQuestions: ChecklistQuestion[];
  onChange: (updated: FollowUpRule) => void;
  onDelete: () => void;
}) {
  const availableConditions = CONDITION_OPTIONS.filter((c) => c.forTypes.includes(parentResponseType));
  const needsValue = rule.condition.type !== 'checked' && rule.condition.type !== 'unchecked';

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: '6px',
        padding: '10px 12px',
        borderRadius: '8px',
        background: 'var(--color-bg-surface)',
        border: '1px solid var(--color-border-subtle)',
        flexWrap: 'wrap',
      }}
    >
      <span style={{ fontSize: '11px', color: 'var(--color-text-muted)', paddingTop: '6px', flexShrink: 0 }}>If response</span>

      <select
        value={rule.condition.type}
        onChange={(e) =>
          onChange({
            ...rule,
            condition: { type: e.target.value as FollowUpConditionType, value: rule.condition.value },
          })
        }
        style={selectStyle}
      >
        {availableConditions.map((c) => (
          <option key={c.value} value={c.value}>{c.label}</option>
        ))}
      </select>

      {needsValue && (
        <input
          type={parentResponseType === 'text' ? 'text' : 'number'}
          value={rule.condition.value ?? ''}
          placeholder="value"
          onChange={(e) =>
            onChange({
              ...rule,
              condition: {
                type: rule.condition.type,
                value: parentResponseType === 'text' ? e.target.value : Number(e.target.value),
              },
            })
          }
          style={{ ...inputStyle, width: '70px' }}
        />
      )}

      <span style={{ fontSize: '11px', color: 'var(--color-text-muted)', paddingTop: '6px', flexShrink: 0 }}>→ show</span>

      <select
        value={rule.followUpQuestionId}
        onChange={(e) => onChange({ ...rule, followUpQuestionId: e.target.value })}
        style={{ ...selectStyle, flex: 1, minWidth: '120px' }}
      >
        <option value="">Select a follow-up question…</option>
        {allQuestions
          .filter((q) => !q.parentQuestionId)
          .map((q) => (
            <option key={q.id} value={q.id}>
              {q.name || '(unnamed question)'}
            </option>
          ))}
      </select>

      <button
        type="button"
        onClick={onDelete}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: '28px',
          height: '28px',
          borderRadius: '6px',
          border: 'none',
          background: 'transparent',
          cursor: 'pointer',
          flexShrink: 0,
        }}
      >
        <Trash2 size={13} color="#B91C1C" />
      </button>
    </div>
  );
}

// ─── Question card ────────────────────────────────────────────────────────────

function QuestionCard({
  question,
  index,
  total,
  allQuestions,
  isFollowUp,
  onChange,
  onDelete,
  onMoveUp,
  onMoveDown,
}: {
  question: ChecklistQuestion;
  index: number;
  total: number;
  allQuestions: ChecklistQuestion[];
  isFollowUp: boolean;
  onChange: (updated: ChecklistQuestion) => void;
  onDelete: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
}) {
  const [expanded, setExpanded] = useState(true);

  function updateRule(ruleIndex: number, updated: FollowUpRule) {
    const rules = [...question.followUpRules];
    rules[ruleIndex] = updated;
    onChange({ ...question, followUpRules: rules });
  }

  function deleteRule(ruleIndex: number) {
    onChange({ ...question, followUpRules: question.followUpRules.filter((_, i) => i !== ruleIndex) });
  }

  function addRule() {
    const defaultCondition = question.responseType === 'checkbox'
      ? { type: 'unchecked' as FollowUpConditionType }
      : { type: 'greater_than' as FollowUpConditionType, value: 0 };
    onChange({
      ...question,
      followUpRules: [
        ...question.followUpRules,
        { id: uid(), condition: defaultCondition, followUpQuestionId: '' },
      ],
    });
  }

  const ResponseIcon = RESPONSE_OPTIONS.find((r) => r.value === question.responseType)?.icon ?? CheckSquare;

  return (
    <div
      style={{
        background: '#fff',
        borderRadius: '10px',
        border: isFollowUp
          ? '1px solid #FDE68A'
          : '1px solid var(--color-border-subtle)',
        boxShadow: '0 1px 4px rgba(58,48,40,0.06)',
        overflow: 'hidden',
        marginLeft: isFollowUp ? '20px' : '0',
        borderLeft: isFollowUp ? '3px solid #F59E0B' : undefined,
      }}
    >
      {/* Card header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          padding: '12px 14px',
          cursor: 'pointer',
          background: expanded ? '#fff' : 'var(--color-bg-surface)',
        }}
        onClick={() => setExpanded((e) => !e)}
      >
        {!isFollowUp && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1px', cursor: 'grab', flexShrink: 0 }}>
            <GripVertical size={14} color="var(--color-text-muted)" />
          </div>
        )}

        {isFollowUp && (
          <GitBranch size={13} color="#D97706" style={{ flexShrink: 0 }} />
        )}

        <ResponseIcon size={13} color="var(--color-text-secondary)" style={{ flexShrink: 0 }} />

        <span style={{
          flex: 1,
          fontSize: '13px',
          fontWeight: 600,
          color: question.name ? 'var(--color-text-primary)' : 'var(--color-text-muted)',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}>
          {question.name || `Question ${index + 1}`}
        </span>

        {question.mandatory && (
          <span style={{ fontSize: '10px', color: '#B91C1C', fontWeight: 700, flexShrink: 0 }}>Required</span>
        )}

        {!isFollowUp && (
          <div style={{ display: 'flex', gap: '2px', flexShrink: 0 }} onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              disabled={index === 0}
              onClick={onMoveUp}
              style={{ ...iconBtnStyle, opacity: index === 0 ? 0.3 : 1 }}
            >
              <ChevronUp size={13} />
            </button>
            <button
              type="button"
              disabled={index === total - 1}
              onClick={onMoveDown}
              style={{ ...iconBtnStyle, opacity: index === total - 1 ? 0.3 : 1 }}
            >
              <ChevronDown size={13} />
            </button>
          </div>
        )}

        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onDelete(); }}
          style={iconBtnStyle}
        >
          <Trash2 size={13} color="#B91C1C" />
        </button>

        {expanded ? <ChevronUp size={14} color="var(--color-text-muted)" /> : <ChevronDown size={14} color="var(--color-text-muted)" />}
      </div>

      {/* Card body */}
      {expanded && (
        <div style={{ padding: '0 14px 14px', display: 'flex', flexDirection: 'column', gap: '14px', borderTop: '1px solid var(--color-border-subtle)' }}>

          {/* Question name */}
          <div style={{ marginTop: '12px' }}>
            <label style={labelStyle}>Question text</label>
            <input
              type="text"
              value={question.name}
              onChange={(e) => onChange({ ...question, name: e.target.value })}
              placeholder="e.g. Is the fridge at correct temperature?"
              style={{ ...inputStyle, width: '100%', boxSizing: 'border-box' }}
            />
          </div>

          {/* Response type */}
          <div>
            <label style={labelStyle}>Response type</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
              {RESPONSE_OPTIONS.map((opt) => {
                const Icon = opt.icon;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => onChange({ ...question, responseType: opt.value, followUpRules: [] })}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '5px',
                      padding: '6px 12px',
                      borderRadius: '8px',
                      border: question.responseType === opt.value ? 'none' : '1px solid var(--color-border)',
                      background: question.responseType === opt.value ? 'var(--color-accent-active)' : '#fff',
                      color: question.responseType === opt.value ? '#F4F1EC' : 'var(--color-text-secondary)',
                      fontSize: '12px',
                      fontWeight: 600,
                      cursor: 'pointer',
                      fontFamily: 'var(--font-primary)',
                    }}
                  >
                    <Icon size={12} />
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Toggles row */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px' }}>
            <Toggle
              checked={question.mandatory}
              onChange={(v) => onChange({ ...question, mandatory: v })}
              label="Required"
            />
            <Toggle
              checked={question.allowPhoto}
              onChange={(v) => onChange({ ...question, allowPhoto: v })}
              label="Allow photo"
            />
          </div>

          {/* Follow-up rules */}
          {!isFollowUp && (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                <label style={{ ...labelStyle, margin: 0 }}>Follow-up rules</label>
                <button
                  type="button"
                  onClick={addRule}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    padding: '4px 10px',
                    borderRadius: '7px',
                    border: '1px solid var(--color-border)',
                    background: '#fff',
                    fontSize: '11px',
                    fontWeight: 600,
                    color: 'var(--color-text-secondary)',
                    cursor: 'pointer',
                    fontFamily: 'var(--font-primary)',
                  }}
                >
                  <Plus size={11} />
                  Add rule
                </button>
              </div>

              {question.followUpRules.length === 0 ? (
                <p style={{ fontSize: '11px', color: 'var(--color-text-muted)', margin: 0 }}>
                  No follow-up rules — this question always appears.
                </p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {question.followUpRules.map((rule, ri) => (
                    <FollowUpRuleRow
                      key={rule.id}
                      rule={rule}
                      parentResponseType={question.responseType}
                      allQuestions={allQuestions}
                      onChange={(updated) => updateRule(ri, updated)}
                      onDelete={() => deleteRule(ri)}
                    />
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Main editor ──────────────────────────────────────────────────────────────

const inputStyle: React.CSSProperties = {
  padding: '8px 10px',
  borderRadius: '8px',
  border: '1px solid var(--color-border)',
  fontSize: '13px',
  fontFamily: 'var(--font-primary)',
  color: 'var(--color-text-primary)',
  background: '#fff',
  outline: 'none',
};

const selectStyle: React.CSSProperties = {
  ...inputStyle,
  cursor: 'pointer',
};

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: '11px',
  fontWeight: 600,
  color: 'var(--color-text-secondary)',
  marginBottom: '6px',
  textTransform: 'uppercase',
  letterSpacing: '0.04em',
};

const iconBtnStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: '28px',
  height: '28px',
  borderRadius: '6px',
  border: 'none',
  background: 'transparent',
  cursor: 'pointer',
  color: 'var(--color-text-secondary)',
};

interface EditorProps {
  mode: 'new' | 'edit';
  templateId?: string;
}

const BLANK_TEMPLATE: Omit<ChecklistTemplate, 'id'> = {
  name: '',
  sites: [],
  notifyUserIds: [],
  frequency: 'daily',
  timeOfDay: '09:00',
  assignedRoles: [],
  questions: [],
  active: true,
};

export default function ChecklistTemplateEditor({ mode, templateId }: EditorProps) {
  const router = useRouter();
  const formId = useId();

  const existing = templateId ? MOCK_TEMPLATES.find((t) => t.id === templateId) : undefined;
  const [form, setForm] = useState<Omit<ChecklistTemplate, 'id'>>(
    existing ? { ...existing } : { ...BLANK_TEMPLATE }
  );
  const [saved, setSaved] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);

  function update<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function toggleArrayItem<T>(arr: T[], item: T): T[] {
    return arr.includes(item) ? arr.filter((x) => x !== item) : [...arr, item];
  }

  // Separate root questions from follow-up children for display
  const rootQuestions = form.questions.filter((q) => !q.parentQuestionId);

  function updateQuestion(id: string, updated: ChecklistQuestion) {
    setForm((f) => ({ ...f, questions: f.questions.map((q) => (q.id === id ? updated : q)) }));
  }

  function deleteQuestion(id: string) {
    // Remove question and any follow-ups that reference it
    setForm((f) => ({
      ...f,
      questions: f.questions
        .filter((q) => q.id !== id && q.parentQuestionId !== id)
        .map((q) => ({
          ...q,
          followUpRules: q.followUpRules.filter((r) => r.followUpQuestionId !== id),
        })),
    }));
  }

  function addQuestion() {
    setForm((f) => ({ ...f, questions: [...f.questions, newQuestion()] }));
  }

  function moveQuestion(id: string, dir: 'up' | 'down') {
    const rootIds = rootQuestions.map((q) => q.id);
    const idx = rootIds.indexOf(id);
    if (idx === -1) return;
    const newIdx = dir === 'up' ? idx - 1 : idx + 1;
    if (newIdx < 0 || newIdx >= rootIds.length) return;
    const newRootIds = [...rootIds];
    [newRootIds[idx], newRootIds[newIdx]] = [newRootIds[newIdx], newRootIds[idx]];
    // Rebuild questions in new order (interleave follow-ups after their parent)
    const reordered: ChecklistQuestion[] = [];
    newRootIds.forEach((qId) => {
      const root = form.questions.find((q) => q.id === qId);
      if (root) {
        reordered.push(root);
        form.questions.filter((q) => q.parentQuestionId === qId).forEach((child) => reordered.push(child));
      }
    });
    setForm((f) => ({ ...f, questions: reordered }));
  }

  function validate(): string[] {
    const errs: string[] = [];
    if (!form.name.trim()) errs.push('Checklist name is required.');
    if (form.sites.length === 0) errs.push('Assign at least one site.');
    if (form.assignedRoles.length === 0) errs.push('Assign at least one role.');
    if (form.questions.filter((q) => !q.parentQuestionId).length === 0) errs.push('Add at least one question.');
    form.questions.forEach((q, i) => {
      if (!q.name.trim()) errs.push(`Question ${i + 1} has no text.`);
    });
    return errs;
  }

  function handleSave() {
    const errs = validate();
    if (errs.length > 0) {
      setErrors(errs);
      return;
    }
    setErrors([]);
    setSaved(true);
    setTimeout(() => router.push('/checklists'), 1400);
  }

  return (
    <div style={{ padding: '24px', maxWidth: '720px', margin: '0 auto', paddingBottom: '80px' }}>
      <h1 style={{ margin: '0 0 4px', fontSize: '20px', fontWeight: 700, color: 'var(--color-text-primary)' }}>
        {mode === 'new' ? 'Create checklist' : 'Edit checklist'}
      </h1>
      <p style={{ margin: '0 0 24px', fontSize: '12px', color: 'var(--color-text-secondary)' }}>
        {mode === 'new' ? 'Configure your checklist template and add questions.' : `Editing: ${existing?.name ?? ''}`}
      </p>

      {/* Errors */}
      {errors.length > 0 && (
        <div style={{
          padding: '12px 14px',
          borderRadius: '9px',
          background: '#FEF2F2',
          border: '1px solid #FECACA',
          marginBottom: '20px',
          display: 'flex',
          gap: '10px',
        }}>
          <AlertCircle size={16} color="#B91C1C" style={{ flexShrink: 0, marginTop: '1px' }} />
          <div>
            {errors.map((e) => (
              <p key={e} style={{ margin: '0 0 2px', fontSize: '12px', color: '#B91C1C', fontWeight: 500 }}>{e}</p>
            ))}
          </div>
        </div>
      )}

      {/* Success banner */}
      {saved && (
        <div style={{
          padding: '12px 14px',
          borderRadius: '9px',
          background: '#F0FDF4',
          border: '1px solid #BBF7D0',
          marginBottom: '20px',
          fontSize: '13px',
          fontWeight: 600,
          color: '#15803D',
        }}>
          ✓ Checklist saved — redirecting…
        </div>
      )}

      {/* ── Section 1: Details ── */}
      <div style={sectionStyle}>
        <SectionLabel>Details</SectionLabel>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Name */}
          <div>
            <label htmlFor={`${formId}-name`} style={labelStyle}>Checklist name *</label>
            <input
              id={`${formId}-name`}
              type="text"
              value={form.name}
              onChange={(e) => update('name', e.target.value)}
              placeholder="e.g. Opening checks"
              style={{ ...inputStyle, width: '100%', boxSizing: 'border-box' }}
            />
          </div>

          {/* Sites */}
          <div>
            <label style={labelStyle}>Assign to sites *</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
              {MOCK_SITES.map((s) => (
                <PillToggle
                  key={s}
                  label={s}
                  active={form.sites.includes(s)}
                  onClick={() => update('sites', toggleArrayItem(form.sites, s))}
                />
              ))}
            </div>
          </div>

          {/* Roles */}
          <div>
            <label style={labelStyle}>Assign to role *</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
              {ROLE_OPTIONS.map((r) => (
                <PillToggle
                  key={r.value}
                  label={r.label}
                  active={form.assignedRoles.includes(r.value)}
                  onClick={() => update('assignedRoles', toggleArrayItem(form.assignedRoles, r.value))}
                />
              ))}
            </div>
          </div>

          {/* Frequency + Time */}
          <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: '140px' }}>
              <label style={labelStyle}>Frequency</label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                {FREQ_OPTIONS.map((f) => (
                  <PillToggle
                    key={f.value}
                    label={f.label}
                    active={form.frequency === f.value}
                    onClick={() => update('frequency', f.value)}
                  />
                ))}
              </div>
            </div>

            <div>
              <label htmlFor={`${formId}-time`} style={labelStyle}>Time of day</label>
              <input
                id={`${formId}-time`}
                type="time"
                value={form.timeOfDay}
                onChange={(e) => update('timeOfDay', e.target.value)}
                style={{ ...inputStyle, width: '130px' }}
              />
            </div>
          </div>

          {/* Notify users */}
          <div>
            <label style={labelStyle}>Notify users on completion</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
              {MOCK_USERS.map((u) => (
                <PillToggle
                  key={u.id}
                  label={u.name}
                  active={form.notifyUserIds.includes(u.id)}
                  onClick={() => update('notifyUserIds', toggleArrayItem(form.notifyUserIds, u.id))}
                />
              ))}
            </div>
          </div>

          {/* Active toggle */}
          <Toggle
            checked={form.active}
            onChange={(v) => update('active', v)}
            label="Active (checklist will be scheduled)"
          />
        </div>
      </div>

      {/* ── Section 2: Questions ── */}
      <div style={sectionStyle}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
          <SectionLabel>Questions</SectionLabel>
          <span style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>
            {rootQuestions.length} question{rootQuestions.length !== 1 ? 's' : ''}
          </span>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {rootQuestions.map((q, i) => {
            // Follow-up children immediately after this question
            const followUps = form.questions.filter((fq) => fq.parentQuestionId === q.id);
            return (
              <div key={q.id} style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <QuestionCard
                  question={q}
                  index={i}
                  total={rootQuestions.length}
                  allQuestions={form.questions}
                  isFollowUp={false}
                  onChange={(updated) => updateQuestion(q.id, updated)}
                  onDelete={() => deleteQuestion(q.id)}
                  onMoveUp={() => moveQuestion(q.id, 'up')}
                  onMoveDown={() => moveQuestion(q.id, 'down')}
                />
                {followUps.map((fq) => (
                  <QuestionCard
                    key={fq.id}
                    question={fq}
                    index={0}
                    total={1}
                    allQuestions={form.questions}
                    isFollowUp={true}
                    onChange={(updated) => updateQuestion(fq.id, updated)}
                    onDelete={() => deleteQuestion(fq.id)}
                    onMoveUp={() => {}}
                    onMoveDown={() => {}}
                  />
                ))}
              </div>
            );
          })}
        </div>

        <button
          type="button"
          onClick={addQuestion}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            width: '100%',
            marginTop: '12px',
            padding: '12px',
            borderRadius: '9px',
            border: '1.5px dashed var(--color-border)',
            background: 'transparent',
            fontSize: '12px',
            fontWeight: 600,
            color: 'var(--color-text-secondary)',
            cursor: 'pointer',
            fontFamily: 'var(--font-primary)',
            justifyContent: 'center',
            transition: 'border-color 0.15s, background 0.15s',
          }}
        >
          <Plus size={14} />
          Add question
        </button>
      </div>

      {/* Save bar */}
      <div style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        padding: '12px 24px',
        background: 'var(--color-bg-nav)',
        borderTop: '1px solid var(--color-border-subtle)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'flex-end',
        gap: '10px',
        zIndex: 100,
        boxShadow: '0 -4px 12px rgba(58,48,40,0.08)',
      }}>
        <button
          type="button"
          onClick={() => router.push('/checklists')}
          style={{
            padding: '9px 18px',
            borderRadius: '8px',
            border: '1px solid var(--color-border)',
            background: '#fff',
            fontSize: '13px',
            fontWeight: 600,
            color: 'var(--color-text-secondary)',
            cursor: 'pointer',
            fontFamily: 'var(--font-primary)',
          }}
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={handleSave}
          style={{
            padding: '9px 20px',
            borderRadius: '8px',
            border: 'none',
            background: 'var(--color-accent-active)',
            fontSize: '13px',
            fontWeight: 700,
            color: '#F4F1EC',
            cursor: 'pointer',
            fontFamily: 'var(--font-primary)',
          }}
        >
          {mode === 'new' ? 'Create checklist' : 'Save changes'}
        </button>
      </div>
    </div>
  );
}

const sectionStyle: React.CSSProperties = {
  background: '#fff',
  borderRadius: '12px',
  border: '1px solid var(--color-border-subtle)',
  padding: '20px',
  marginBottom: '16px',
  boxShadow: '0 1px 4px rgba(58,48,40,0.06)',
};
