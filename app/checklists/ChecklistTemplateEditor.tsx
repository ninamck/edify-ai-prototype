'use client';

import { useState, useId, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import {
  Plus,
  Trash2,
  GripVertical,
  ChevronDown,
  ChevronUp,
  AlertCircle,
  AlertTriangle,
  Bell,
  CheckSquare,
  Thermometer,
  Hash,
  AlignLeft,
  Gauge,
  GitBranch,
  Table,
  UserCheck,
} from 'lucide-react';
import { MOCK_TEMPLATES, MOCK_SITES, MOCK_USERS, getSiteTeam } from './mockData';
import { saveTemplate, findTemplateById } from './templatesStore';
import {
  DEFAULT_PASS_THRESHOLD_PCT,
  SEVERITY_COLORS,
  allowedFails,
  isScoreable,
  severityLabel,
} from './scoring';
import type {
  AuditSection,
  ChecklistTemplate,
  ChecklistQuestion,
  CorrectiveAssigneeType,
  GroupField,
  GroupFieldType,
  NotifyScope,
  ResponseType,
  Frequency,
  Severity,
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
  { value: 'admin', label: 'Admin' },
  { value: 'manager', label: 'Manager' },
  { value: 'employee', label: 'Employee' },
];

const RESPONSE_OPTIONS: { value: ResponseType; label: string; icon: React.ElementType }[] = [
  { value: 'checkbox', label: 'Yes / No', icon: CheckSquare },
  { value: 'rating', label: 'Rating', icon: Gauge },
  { value: 'temperature', label: 'Temperature', icon: Thermometer },
  { value: 'number', label: 'Number', icon: Hash },
  { value: 'text', label: 'Text', icon: AlignLeft },
  { value: 'repeating_group', label: 'Repeated entries', icon: Table },
];

const GROUP_FIELD_TYPE_OPTIONS: { value: GroupFieldType; label: string }[] = [
  { value: 'text', label: 'Text' },
  { value: 'checkbox', label: 'Yes / No' },
  { value: 'temperature', label: 'Temperature' },
];

const CONDITION_OPTIONS: { value: FollowUpConditionType; label: string; forTypes: ResponseType[] }[] = [
  { value: 'checked', label: 'is checked', forTypes: ['checkbox'] },
  { value: 'unchecked', label: 'is unchecked', forTypes: ['checkbox'] },
  { value: 'greater_than', label: 'is greater than', forTypes: ['temperature', 'number'] },
  { value: 'less_than', label: 'is less than', forTypes: ['temperature', 'number'] },
  { value: 'equals', label: 'equals', forTypes: ['temperature', 'number', 'text', 'rating'] },
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
        padding: '6px 12px',
        borderRadius: '100px',
        border: active ? 'none' : '1px solid var(--color-border)',
        background: active ? 'var(--color-accent-active)' : '#fff',
        color: active ? '#F4F1EC' : 'var(--color-text-primary)',
        fontSize: '12px',
        fontWeight: 500,
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
        fontSize: '12px',
        fontWeight: 600,
        letterSpacing: '0.05em',
        textTransform: 'uppercase',
        color: 'var(--color-text-primary)',
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
  parentQuestionId,
  parentResponseType,
  allQuestions,
  onChange,
  onDelete,
}: {
  rule: FollowUpRule;
  parentQuestionId: string;
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
      <span style={{ fontSize: '12px', fontWeight: 500, color: 'var(--color-text-muted)', paddingTop: '6px', flexShrink: 0 }}>If response</span>

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
          type={parentResponseType === 'text' || parentResponseType === 'rating' ? 'text' : 'number'}
          value={rule.condition.value ?? ''}
          placeholder={parentResponseType === 'rating' ? 'great / average / urgent' : 'value'}
          onChange={(e) =>
            onChange({
              ...rule,
              condition: {
                type: rule.condition.type,
                value:
                  parentResponseType === 'text' || parentResponseType === 'rating'
                    ? e.target.value
                    : Number(e.target.value),
              },
            })
          }
          style={{ ...inputStyle, width: '70px' }}
        />
      )}

      <span style={{ fontSize: '12px', fontWeight: 500, color: 'var(--color-text-muted)', paddingTop: '6px', flexShrink: 0 }}>→ show</span>

      <select
        value={rule.followUpQuestionId}
        onChange={(e) => onChange({ ...rule, followUpQuestionId: e.target.value })}
        style={{ ...selectStyle, flex: 1, minWidth: '120px' }}
      >
        <option value="">Select a follow-up question…</option>
        {allQuestions
          // Own follow-up children first, then other root questions.
          .filter((q) => q.id !== parentQuestionId && (q.parentQuestionId === parentQuestionId || !q.parentQuestionId))
          .map((q) => (
            <option key={q.id} value={q.id}>
              {q.parentQuestionId === parentQuestionId ? '↳ ' : ''}{q.name || '(unnamed question)'}
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
        <Trash2 size={13} color="#B01038" />
      </button>
    </div>
  );
}

// ─── Repeated entries fields editor ───────────────────────────────────────────
//
// For "Repeated entries" questions the author defines the fields each
// entry records. Temperature fields can carry a max threshold that
// drives per-entry prompting; Yes/No fields prompt on No when a prompt
// is set.

function GroupFieldsEditor({
  fields,
  onChange,
}: {
  fields: GroupField[];
  onChange: (fields: GroupField[]) => void;
}) {
  function updateField(idx: number, patch: Partial<GroupField>) {
    const next = [...fields];
    next[idx] = { ...next[idx], ...patch };
    onChange(next);
  }

  function addField() {
    onChange([...fields, { id: `gf-${uid()}`, name: '', type: 'text' }]);
  }

  function removeField(idx: number) {
    onChange(fields.filter((_, i) => i !== idx));
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
        <label style={{ ...labelStyle, margin: 0 }}>Fields in each entry</label>
        <button
          type="button"
          onClick={addField}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            padding: '4px 10px',
            borderRadius: '7px',
            border: '1px solid var(--color-border)',
            background: '#fff',
            fontSize: '12px',
            fontWeight: 600,
            color: 'var(--color-text-secondary)',
            cursor: 'pointer',
            fontFamily: 'var(--font-primary)',
          }}
        >
          <Plus size={11} />
          Add field
        </button>
      </div>

      {fields.length === 0 ? (
        <p style={{ fontSize: '12px', fontWeight: 500, color: 'var(--color-text-muted)', margin: 0 }}>
          No fields yet — add what each entry should record (e.g. Supplier, Product, Temperature).
        </p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          {fields.map((f, i) => {
            const promptable = f.type === 'temperature' || f.type === 'checkbox';
            return (
              <div
                key={f.id}
                style={{
                  padding: '10px 12px',
                  borderRadius: '8px',
                  background: 'var(--color-bg-surface)',
                  border: '1px solid var(--color-border-subtle)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                  <input
                    type="text"
                    value={f.name}
                    placeholder="Field name (e.g. Supplier)"
                    onChange={(e) => updateField(i, { name: e.target.value })}
                    style={{ ...inputStyle, flex: 1, minWidth: '120px' }}
                  />
                  <select
                    value={f.type}
                    onChange={(e) => {
                      const type = e.target.value as GroupFieldType;
                      updateField(i, {
                        type,
                        maxThreshold: type === 'temperature' ? f.maxThreshold ?? 5 : undefined,
                        followUpPrompt: type === 'text' ? undefined : f.followUpPrompt,
                      });
                    }}
                    style={selectStyle}
                  >
                    {GROUP_FIELD_TYPE_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                  {f.type === 'temperature' && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <span style={{ fontSize: '12px', fontWeight: 500, color: 'var(--color-text-muted)' }}>max</span>
                      <input
                        type="number"
                        value={f.maxThreshold ?? ''}
                        onChange={(e) => updateField(i, { maxThreshold: e.target.value === '' ? undefined : Number(e.target.value) })}
                        style={{ ...inputStyle, width: '58px' }}
                      />
                      <span style={{ fontSize: '12px', fontWeight: 500, color: 'var(--color-text-muted)' }}>°C</span>
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={() => removeField(i)}
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
                    <Trash2 size={13} color="#B01038" />
                  </button>
                </div>

                {promptable && (
                  <input
                    type="text"
                    value={f.followUpPrompt ?? ''}
                    placeholder={
                      f.type === 'temperature'
                        ? 'Prompt when above max (e.g. record the action taken)…'
                        : 'Prompt on a No (e.g. describe the issue)…'
                    }
                    onChange={(e) => updateField(i, { followUpPrompt: e.target.value || undefined })}
                    style={{ ...inputStyle, width: '100%', boxSizing: 'border-box' }}
                  />
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Corrective action config ─────────────────────────────────────────────────
//
// First-class config on Yes/No questions: a No raises an assignable
// corrective action — no follow-up rule plumbing needed. The assignee
// resolves per site at completion time (outlet manager or store account).

function CorrectiveActionSection({
  question,
  sites,
  onChange,
}: {
  question: ChecklistQuestion;
  sites: string[];
  onChange: (updated: ChecklistQuestion) => void;
}) {
  const config = question.correctiveActionConfig;
  const enabled = Boolean(config);
  const previewSite = sites[0];

  return (
    <div
      style={{
        padding: '12px',
        borderRadius: '9px',
        border: enabled ? '1px solid #E89AAE' : '1px solid var(--color-border-subtle)',
        boxShadow: enabled ? 'inset 3px 0 0 #B01038' : undefined,
        background: enabled ? '#FFF7F8' : 'var(--color-bg-surface)',
        display: 'flex',
        flexDirection: 'column',
        gap: '10px',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
        <AlertTriangle size={14} color={enabled ? '#B01038' : 'var(--color-text-muted)'} style={{ flexShrink: 0, marginTop: '3px' }} />
        <div style={{ flex: 1 }}>
          <Toggle
            checked={enabled}
            onChange={(v) =>
              onChange({
                ...question,
                correctiveActionConfig: v
                  ? { triggerOnNo: true, defaultAssignee: 'outlet_manager', requirePhotoEvidence: true }
                  : undefined,
              })
            }
            label="A “No” answer raises a corrective action"
          />
          <p style={{ margin: '6px 0 0', fontSize: '12px', color: 'var(--color-text-muted)', lineHeight: 1.5 }}>
            The completer writes an issue summary; the fix is assigned to the store and tracked
            until resolved. Every No raises one — there is no “no issue” branch.
          </p>
        </div>
      </div>

      {enabled && config && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', paddingLeft: '22px' }}>
          <div>
            <label style={labelStyle}>Assign to (default)</label>
            <select
              value={config.defaultAssignee}
              onChange={(e) =>
                onChange({
                  ...question,
                  correctiveActionConfig: { ...config, defaultAssignee: e.target.value as CorrectiveAssigneeType },
                })
              }
              style={{ ...selectStyle, width: '100%', boxSizing: 'border-box' }}
            >
              <option value="outlet_manager">Outlet manager of the store being checked</option>
              <option value="store_account">The store&rsquo;s account</option>
            </select>
            {previewSite && (
              <p style={{ margin: '5px 0 0', fontSize: '12px', color: 'var(--color-text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <UserCheck size={11} />
                e.g. at {previewSite}: {config.defaultAssignee === 'outlet_manager'
                  ? `${getSiteTeam(previewSite).outletManager} (Outlet manager)`
                  : getSiteTeam(previewSite).storeAccount}
                {' '}· completer can switch at completion time
              </p>
            )}
          </div>

          <Toggle
            checked={config.requirePhotoEvidence}
            onChange={(v) =>
              onChange({
                ...question,
                correctiveActionConfig: { ...config, requirePhotoEvidence: v },
              })
            }
            label="Require photo evidence to resolve"
          />
        </div>
      )}
    </div>
  );
}

// ─── Per-question scoring (audit templates) ──────────────────────────────────
//
// Shown when template scoring is on. Yes/No questions pass on Yes;
// number/temperature questions pass when in range (defined by a
// greater/less-than follow-up rule). Text, rating and table questions
// are unscored.

const SEVERITY_OPTIONS: Severity[] = ['critical', 'medium', 'low'];

function scoringApplies(q: ChecklistQuestion): boolean {
  return q.responseType === 'checkbox' || q.responseType === 'temperature' || q.responseType === 'number';
}

function ScoringSection({
  question,
  sections,
  onChange,
}: {
  question: ChecklistQuestion;
  sections: AuditSection[];
  onChange: (updated: ChecklistQuestion) => void;
}) {
  if (!scoringApplies(question)) {
    return (
      <div style={{
        padding: '10px 12px',
        borderRadius: '9px',
        background: 'var(--color-bg-surface)',
        border: '1px solid var(--color-border-subtle)',
        fontSize: '12px',
        color: 'var(--color-text-muted)',
      }}>
        Not scored — this response type has no pass/fail, so it doesn&rsquo;t affect the audit score.
      </div>
    );
  }

  const needsThresholdRule =
    (question.responseType === 'temperature' || question.responseType === 'number') &&
    !question.followUpRules.some(
      (r) =>
        (r.condition.type === 'greater_than' || r.condition.type === 'less_than') &&
        typeof r.condition.value === 'number',
    );

  return (
    <div style={{
      padding: '12px',
      borderRadius: '9px',
      background: 'var(--color-review-light)',
      border: '1px solid var(--color-review-border)',
      display: 'flex',
      flexDirection: 'column',
      gap: '10px',
    }}>
      <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--color-text-primary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
        Scoring
      </span>

      <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
        <div>
          <label style={labelStyle}>Severity</label>
          <div style={{ display: 'flex', gap: '5px', alignItems: 'center' }}>
            {SEVERITY_OPTIONS.map((s) => {
              const active = (question.severity ?? 'medium') === s;
              const c = SEVERITY_COLORS[s];
              return (
                <button
                  key={s}
                  type="button"
                  onClick={() => onChange({ ...question, severity: s })}
                  style={{
                    // Match inputStyle so the row lines up with the Section select.
                    padding: '8px 10px',
                    borderRadius: '8px',
                    border: active ? `1px solid ${c.border}` : '1px solid var(--color-border)',
                    background: active ? c.bg : '#fff',
                    color: active ? c.text : 'var(--color-text-secondary)',
                    fontSize: '13px',
                    fontWeight: active ? 700 : 600,
                    cursor: 'pointer',
                    fontFamily: 'var(--font-primary)',
                  }}
                >
                  {severityLabel(s)}
                </button>
              );
            })}
          </div>
        </div>

        <div style={{ flex: 1, minWidth: '140px' }}>
          <label style={labelStyle}>Section</label>
          <select
            value={question.sectionId ?? ''}
            onChange={(e) => onChange({ ...question, sectionId: e.target.value || undefined })}
            style={{ ...selectStyle, width: '100%', boxSizing: 'border-box' }}
          >
            <option value="">No section (General)</option>
            {sections.map((s) => (
              <option key={s.id} value={s.id}>{s.name || 'Untitled section'}</option>
            ))}
          </select>
        </div>
      </div>

      <p style={{ margin: 0, fontSize: '12px', color: 'var(--color-text-muted)', lineHeight: 1.5 }}>
        {question.responseType === 'checkbox'
          ? 'This is one check. Yes passes it; No fails it and raises an action.'
          : needsThresholdRule
          ? 'Add a greater-than / less-than follow-up rule below to define the in-range pass — until then this question isn\u2019t scored.'
          : 'This is one check. In range passes it; a threshold breach fails it and raises an action.'}
        {question.severity === 'critical'
          ? ' Critical: if this check fails, the whole audit fails, whatever the score. It also alerts the escalation list.'
          : ' Severity sets who is alerted when it fails, not how much it scores.'}
      </p>
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
  sites,
  scoringEnabled,
  sections,
  onChange,
  onDelete,
  onMoveUp,
  onMoveDown,
  onAddFollowUp,
}: {
  question: ChecklistQuestion;
  index: number;
  total: number;
  allQuestions: ChecklistQuestion[];
  isFollowUp: boolean;
  sites: string[];
  scoringEnabled: boolean;
  sections: AuditSection[];
  onChange: (updated: ChecklistQuestion) => void;
  onDelete: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onAddFollowUp: () => void;
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
      : question.responseType === 'rating'
      ? { type: 'equals' as FollowUpConditionType, value: 'urgent' }
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
          ? '1px solid #EAD173'
          : '1px solid var(--color-border-subtle)',
        boxShadow: isFollowUp
          ? 'inset 3px 0 0 #F59E0B, 0 1px 4px rgba(0, 28, 53, 0.06)'
          : '0 1px 4px rgba(0, 28, 53, 0.06)',
        overflow: 'hidden',
        marginLeft: isFollowUp ? '20px' : '0',
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
          <GitBranch size={13} color="#001C35" style={{ flexShrink: 0 }} />
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

        {scoringEnabled && !isFollowUp && isScoreable(question) && (
          <span style={{
            fontSize: '11px',
            fontWeight: 700,
            padding: '2px 8px',
            borderRadius: '100px',
            flexShrink: 0,
            background: SEVERITY_COLORS[question.severity ?? 'medium'].bg,
            color: SEVERITY_COLORS[question.severity ?? 'medium'].text,
          }}>
            {severityLabel(question.severity ?? 'medium')}
          </span>
        )}

        {question.mandatory && (
          <span style={{ fontSize: '12px', color: '#B01038', fontWeight: 700, flexShrink: 0 }}>Required</span>
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
          <Trash2 size={13} color="#B01038" />
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
                    onClick={() =>
                      onChange({
                        ...question,
                        responseType: opt.value,
                        followUpRules: [],
                        // Config is type-specific — drop what no longer applies.
                        correctiveActionConfig: opt.value === 'checkbox' ? question.correctiveActionConfig : undefined,
                        groupFields: opt.value === 'repeating_group' ? question.groupFields ?? [] : undefined,
                      })
                    }
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

          {/* Scoring — audit templates only */}
          {scoringEnabled && !isFollowUp && (
            <ScoringSection question={question} sections={sections} onChange={onChange} />
          )}

          {/* Corrective action — Yes/No questions only */}
          {question.responseType === 'checkbox' && !isFollowUp && (
            <CorrectiveActionSection question={question} sites={sites} onChange={onChange} />
          )}

          {/* Entry fields — repeated-entries questions only */}
          {question.responseType === 'repeating_group' && (
            <GroupFieldsEditor
              fields={question.groupFields ?? []}
              onChange={(fields) => onChange({ ...question, groupFields: fields })}
            />
          )}

          {/* Follow-up rules */}
          {!isFollowUp && question.responseType !== 'repeating_group' && (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px', gap: '6px', flexWrap: 'wrap' }}>
                <label style={{ ...labelStyle, margin: 0 }}>Follow-up rules</label>
                <div style={{ display: 'flex', gap: '6px' }}>
                  <button
                    type="button"
                    onClick={onAddFollowUp}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                      padding: '4px 10px',
                      borderRadius: '7px',
                      border: '1px solid var(--color-border)',
                      background: '#fff',
                      fontSize: '12px',
                      fontWeight: 600,
                      color: 'var(--color-text-secondary)',
                      cursor: 'pointer',
                      fontFamily: 'var(--font-primary)',
                    }}
                  >
                    <GitBranch size={11} />
                    Add follow-up question
                  </button>
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
                      fontSize: '12px',
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
              </div>

              {question.followUpRules.length === 0 ? (
                <p style={{ fontSize: '12px', fontWeight: 500, color: 'var(--color-text-muted)', margin: 0 }}>
                  No follow-up rules — this question always appears.
                </p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {question.followUpRules.map((rule, ri) => (
                    <FollowUpRuleRow
                      key={rule.id}
                      rule={rule}
                      parentQuestionId={question.id}
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

// Labels take full ink (web-v2 moved them from muted to foreground so
// helper text underneath can sit a step lighter).
const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: '12px',
  fontWeight: 500,
  color: 'var(--color-text-primary)',
  marginBottom: '6px',
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
  notifyScope: 'site_assignees',
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
  const [scheduledCount, setScheduledCount] = useState(0);
  const [errors, setErrors] = useState<string[]>([]);
  const [editName, setEditName] = useState(existing?.name ?? '');

  // Custom templates (and edited copies of fixtures) live in the
  // client-side store, which isn't readable during server render — load
  // them once on mount, before the user has touched anything.
  const storeLoaded = useRef(false);
  useEffect(() => {
    if (storeLoaded.current) return;
    storeLoaded.current = true;
    if (mode === 'edit' && templateId) {
      const stored = findTemplateById(templateId);
      if (stored) {
        setForm({ ...stored });
        setEditName(stored.name);
      }
    }
  }, [mode, templateId]);

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

  /** Create a child follow-up question under a parent and auto-wire a rule
   *  to it (default condition depends on the parent's response type). */
  function addFollowUpQuestion(parentId: string) {
    setForm((f) => {
      const parent = f.questions.find((q) => q.id === parentId);
      if (!parent) return f;

      const child: ChecklistQuestion = {
        id: `q-${uid()}`,
        name: '',
        mandatory: true,
        allowPhoto: true,
        responseType: 'text',
        followUpRules: [],
        parentQuestionId: parentId,
      };

      const defaultCondition: FollowUpRule['condition'] =
        parent.responseType === 'checkbox'
          ? { type: 'unchecked' }
          : parent.responseType === 'rating'
          ? { type: 'equals', value: 'urgent' }
          : parent.responseType === 'text'
          ? { type: 'contains', value: '' }
          : { type: 'greater_than', value: 0 };

      const updatedParent: ChecklistQuestion = {
        ...parent,
        followUpRules: [
          ...parent.followUpRules,
          { id: uid(), condition: defaultCondition, followUpQuestionId: child.id },
        ],
      };

      // Insert the child directly after the parent's existing children so
      // it renders in place.
      const questions: ChecklistQuestion[] = [];
      f.questions.forEach((q) => {
        questions.push(q.id === parentId ? updatedParent : q);
      });
      const lastRelatedIdx = (() => {
        let idx = questions.findIndex((q) => q.id === parentId);
        for (let i = idx + 1; i < questions.length; i++) {
          if (questions[i].parentQuestionId === parentId) idx = i;
          else break;
        }
        return idx;
      })();
      questions.splice(lastRelatedIdx + 1, 0, child);

      return { ...f, questions };
    });
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
      if (q.responseType === 'repeating_group') {
        const fields = q.groupFields ?? [];
        if (fields.length === 0) errs.push(`Question ${i + 1} uses repeated entries but has no fields.`);
        else if (fields.some((gf) => !gf.name.trim())) errs.push(`Question ${i + 1} has an entry field with no name.`);
      }
    });
    if (form.scoringEnabled) {
      const threshold = form.passThresholdPct ?? DEFAULT_PASS_THRESHOLD_PCT;
      if (threshold < 1 || threshold > 100) errs.push('Pass mark must be between 1 and 100%.');
      const scoredCount = form.questions.filter((q) => !q.parentQuestionId && isScoreable(q)).length;
      if (scoredCount === 0) {
        errs.push('Scoring is on but there are no scored checks — add a Yes/No or threshold-based number question.');
      }
      (form.sections ?? []).forEach((s, i) => {
        if (!s.name.trim()) errs.push(`Section ${i + 1} has no name.`);
      });
    }
    return errs;
  }

  function handleSave() {
    const errs = validate();
    if (errs.length > 0) {
      setErrors(errs);
      return;
    }
    setErrors([]);

    const id = mode === 'edit' && templateId ? templateId : `tpl-custom-${uid()}`;
    const result = saveTemplate({ id, ...form });
    setScheduledCount(result.scheduledCount);
    setSaved(true);
    setTimeout(() => router.push('/checklists'), 1600);
  }

  return (
    <div style={{ padding: '24px', maxWidth: '720px', margin: '0 auto', paddingBottom: '80px' }}>
      <h1 style={{ margin: '0 0 4px', fontSize: '20px', fontWeight: 700, color: 'var(--color-text-primary)' }}>
        {mode === 'new' ? 'Create checklist' : 'Edit checklist'}
      </h1>
      <p style={{ margin: '0 0 24px', fontSize: '12px', fontWeight: 500, color: 'var(--color-text-secondary)' }}>
        {mode === 'new' ? 'Configure your checklist template and add questions.' : `Editing: ${editName}`}
      </p>

      {/* Errors */}
      {errors.length > 0 && (
        <div style={{
          padding: '12px 14px',
          borderRadius: '9px',
          background: '#FCE5EB',
          border: '1px solid #E89AAE',
          marginBottom: '20px',
          display: 'flex',
          gap: '10px',
        }}>
          <AlertCircle size={16} color="#B01038" style={{ flexShrink: 0, marginTop: '1px' }} />
          <div>
            {errors.map((e) => (
              <p key={e} style={{ margin: '0 0 2px', fontSize: '12px', color: '#B01038', fontWeight: 500 }}>{e}</p>
            ))}
          </div>
        </div>
      )}

      {/* Success banner */}
      {saved && (
        <div style={{
          padding: '12px 14px',
          borderRadius: '9px',
          background: '#E3F2E8',
          border: '1px solid #93C8A6',
          marginBottom: '20px',
          fontSize: '13px',
          fontWeight: 600,
          color: '#166534',
        }}>
          ✓ Checklist saved
          {scheduledCount > 0 &&
            ` — ${scheduledCount} ${scheduledCount === 1 ? 'task' : 'tasks'} scheduled in the complete inbox`}
          . Redirecting…
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

          {/* Notification scoping */}
          <div>
            <label style={labelStyle}>Notify on completion</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '8px' }}>
              <PillToggle
                label="Assigned people at that site only"
                active={(form.notifyScope ?? 'specific_users') === 'site_assignees'}
                onClick={() => update('notifyScope', 'site_assignees' as NotifyScope)}
              />
              <PillToggle
                label="Specific users"
                active={(form.notifyScope ?? 'specific_users') === 'specific_users'}
                onClick={() => update('notifyScope', 'specific_users' as NotifyScope)}
              />
            </div>

            {(form.notifyScope ?? 'specific_users') === 'site_assignees' ? (
              <div style={{
                padding: '12px 14px',
                borderRadius: '9px',
                border: '1px solid var(--color-border-subtle)',
                background: 'var(--color-bg-surface)',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
              }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '6px' }}>
                  <Bell size={13} color="var(--color-text-muted)" style={{ flexShrink: 0, marginTop: '2px' }} />
                  <span style={{ fontSize: '12px', color: 'var(--color-text-secondary)', lineHeight: 1.5 }}>
                    One template covers every site. When it&rsquo;s completed for a site, only that
                    site&rsquo;s assigned people are notified — nothing to duplicate per store.
                  </span>
                </div>
                {form.sites.length > 0 ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    {form.sites.map((s) => (
                      <div key={s} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px' }}>
                        <span style={{ fontWeight: 600, color: 'var(--color-text-primary)', minWidth: '120px' }}>{s}</span>
                        <span style={{ color: 'var(--color-text-muted)' }}>→</span>
                        <span style={{ fontWeight: 500, color: 'var(--color-text-secondary)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <UserCheck size={11} />
                          {getSiteTeam(s).outletManager} (Outlet manager)
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <span style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>
                    Select sites above to see who gets notified at each.
                  </span>
                )}
              </div>
            ) : (
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
            )}
          </div>

          {/* Active toggle */}
          <Toggle
            checked={form.active}
            onChange={(v) => update('active', v)}
            label="Active (checklist will be scheduled)"
          />
        </div>
      </div>

      {/* ── Section: Scoring (audit mode) ── */}
      <div style={sectionStyle}>
        <SectionLabel>Scoring</SectionLabel>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div>
            <Toggle
              checked={!!form.scoringEnabled}
              onChange={(v) =>
                setForm((f) => ({
                  ...f,
                  scoringEnabled: v,
                  passThresholdPct: v ? f.passThresholdPct ?? DEFAULT_PASS_THRESHOLD_PCT : f.passThresholdPct,
                  sections: v ? f.sections ?? [] : f.sections,
                }))
              }
              label="Enable scoring — this checklist is an audit"
            />
            <p style={{ margin: '6px 0 0', fontSize: '12px', color: 'var(--color-text-muted)', lineHeight: 1.5 }}>
              Every Yes/No or in-range check counts for one. The score is simply the share of
              checks passed, every fail raises an action, and any Critical fail fails the audit
              on its own. Off = normal checklist behaviour, unchanged.
            </p>
          </div>

          {form.scoringEnabled && (
            <>
              <div>
                <label htmlFor={`${formId}-threshold`} style={labelStyle}>Pass mark (%)</label>
                <input
                  id={`${formId}-threshold`}
                  type="number"
                  min={1}
                  max={100}
                  value={form.passThresholdPct ?? DEFAULT_PASS_THRESHOLD_PCT}
                  onChange={(e) => update('passThresholdPct', Math.max(0, Number(e.target.value) || 0))}
                  style={{ ...inputStyle, width: '90px' }}
                />
              </div>

              {/* The pass mark translated into behaviour — the fail budget */}
              {(() => {
                const scoreableQs = form.questions.filter((q) => !q.parentQuestionId && isScoreable(q));
                const checksTotal = scoreableQs.length;
                const criticalCount = scoreableQs.filter((q) => q.severity === 'critical').length;
                const threshold = form.passThresholdPct ?? DEFAULT_PASS_THRESHOLD_PCT;
                const budget = allowedFails(checksTotal, threshold);
                return (
                  <div style={{
                    padding: '10px 12px',
                    borderRadius: '9px',
                    background: 'var(--color-bg-surface)',
                    border: '1px solid var(--color-border-subtle)',
                    fontSize: '12px',
                    color: 'var(--color-text-secondary)',
                    lineHeight: 1.5,
                  }}>
                    {checksTotal === 0 ? (
                      <>No checks yet — add Yes/No or threshold-based number questions below. Each one counts for one check.</>
                    ) : (
                      <>
                        <strong style={{ color: 'var(--color-text-primary)' }}>
                          {checksTotal} check{checksTotal === 1 ? '' : 's'} · pass mark {threshold}%
                        </strong>
                        {' '}— in plain terms: a site can fail{' '}
                        <strong style={{ color: 'var(--color-text-primary)' }}>
                          up to {budget} of these {checksTotal} checks
                        </strong>
                        {' '}and still pass.
                        {criticalCount > 0 && (
                          <>
                            {' '}The {criticalCount} Critical check{criticalCount === 1 ? ' is' : 's are'} the exception:
                            failing any one of them fails the audit, whatever the score.
                          </>
                        )}
                      </>
                    )}
                  </div>
                );
              })()}

              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <label style={{ ...labelStyle, margin: 0 }}>Sections</label>
                  <button
                    type="button"
                    onClick={() =>
                      update('sections', [...(form.sections ?? []), { id: `sec-${uid()}`, name: '' }])
                    }
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                      padding: '4px 10px',
                      borderRadius: '7px',
                      border: '1px solid var(--color-border)',
                      background: '#fff',
                      fontSize: '12px',
                      fontWeight: 600,
                      color: 'var(--color-text-secondary)',
                      cursor: 'pointer',
                      fontFamily: 'var(--font-primary)',
                    }}
                  >
                    <Plus size={11} />
                    Add section
                  </button>
                </div>

                {(form.sections ?? []).length === 0 ? (
                  <p style={{ fontSize: '12px', fontWeight: 500, color: 'var(--color-text-muted)', margin: 0 }}>
                    No sections — questions score into a single General group. Add sections like
                    &ldquo;Front of house&rdquo; or &ldquo;Food safety&rdquo; to get subtotals.
                  </p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {(form.sections ?? []).map((s) => (
                      <div key={s.id} style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                        <input
                          type="text"
                          value={s.name}
                          onChange={(e) =>
                            update(
                              'sections',
                              (form.sections ?? []).map((x) => (x.id === s.id ? { ...x, name: e.target.value } : x)),
                            )
                          }
                          placeholder="Section name, e.g. Front of house"
                          style={{ ...inputStyle, flex: 1, boxSizing: 'border-box' }}
                        />
                        <button
                          type="button"
                          onClick={() =>
                            setForm((f) => ({
                              ...f,
                              sections: (f.sections ?? []).filter((x) => x.id !== s.id),
                              // Questions in the removed section fall back to General.
                              questions: f.questions.map((q) =>
                                q.sectionId === s.id ? { ...q, sectionId: undefined } : q,
                              ),
                            }))
                          }
                          style={iconBtnStyle}
                        >
                          <Trash2 size={13} color="#B01038" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {/* ── Section 2: Questions ── */}
      <div style={sectionStyle}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
          <SectionLabel>Questions</SectionLabel>
          <span style={{ fontSize: '12px', fontWeight: 500, color: 'var(--color-text-muted)' }}>
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
                  sites={form.sites}
                  scoringEnabled={!!form.scoringEnabled}
                  sections={form.sections ?? []}
                  onChange={(updated) => updateQuestion(q.id, updated)}
                  onDelete={() => deleteQuestion(q.id)}
                  onMoveUp={() => moveQuestion(q.id, 'up')}
                  onMoveDown={() => moveQuestion(q.id, 'down')}
                  onAddFollowUp={() => addFollowUpQuestion(q.id)}
                />
                {followUps.map((fq) => (
                  <QuestionCard
                    key={fq.id}
                    question={fq}
                    index={0}
                    total={1}
                    allQuestions={form.questions}
                    isFollowUp={true}
                    sites={form.sites}
                    scoringEnabled={!!form.scoringEnabled}
                    sections={form.sections ?? []}
                    onChange={(updated) => updateQuestion(fq.id, updated)}
                    onDelete={() => deleteQuestion(fq.id)}
                    onMoveUp={() => {}}
                    onMoveDown={() => {}}
                    onAddFollowUp={() => {}}
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
        background: '#fff',
        borderTop: '1px solid var(--color-border-subtle)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'flex-end',
        gap: '10px',
        zIndex: 100,
        boxShadow: '0 -4px 12px rgba(0, 28, 53,0.08)',
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
  borderRadius: '10px',
  border: '1px solid var(--color-border-subtle)',
  padding: '20px',
  marginBottom: '16px',
};
