'use client';

import { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Check,
  CheckSquare,
  Square,
  XSquare,
  Thermometer,
  AlertCircle,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  GitBranch,
  Plus,
  Trash2,
  UserCheck,
  Bell,
} from 'lucide-react';
import { getInstanceById, getTemplateForInstance, assigneeNameFor, getSiteTeam } from '../../mockData';
import { PhotoCapture } from '../../PhotoCapture';
import { addCorrectiveActions, newCorrectiveActionId } from '../../correctiveActionsStore';
import { useChecklistStore, completeStoreInstance } from '../../templatesStore';
import { computeScore, isScoreable, pointsFor, questionOutcome, severityLabel, severityWeightsOf, SEVERITY_COLORS } from '../../scoring';
import { useAlertRouting, resolveRecipients } from '../../alertsStore';
import type {
  AuditScoreResult,
  ChecklistAnswer,
  ChecklistQuestion,
  ChecklistTemplate,
  CorrectiveAction,
  CorrectiveAssigneeType,
  GroupField,
  RatingValue,
  RepeatingRow,
  ResponseType,
  Severity,
  SeverityWeights,
} from '../../types';

// ─── helpers ──────────────────────────────────────────────────────────────────

function getUnit(responseType: ResponseType) {
  if (responseType === 'temperature') return '°C';
  return '';
}

function isAnswered(answer: ChecklistAnswer | undefined): boolean {
  if (!answer) return false;
  if (answer.value === null || answer.value === '') return false;
  return true;
}

/** Fields in a row whose value triggers the per-row follow-up prompt. */
function triggeredPrompts(fields: GroupField[], row: RepeatingRow): GroupField[] {
  return fields.filter((f) => {
    const v = row.values[f.id];
    if (f.type === 'temperature' && typeof f.maxThreshold === 'number' && typeof v === 'number') {
      return v > f.maxThreshold;
    }
    if (f.type === 'checkbox' && f.followUpPrompt) return v === false;
    return false;
  });
}

function rowComplete(fields: GroupField[], row: RepeatingRow): boolean {
  const fieldsDone = fields.every((f) => {
    const v = row.values[f.id];
    return v !== null && v !== undefined && v !== '';
  });
  if (!fieldsDone) return false;
  if (triggeredPrompts(fields, row).length > 0 && !(row.followUpNote ?? '').trim()) return false;
  return true;
}

/** Answered-check that understands repeating groups. */
function isQuestionAnswered(question: ChecklistQuestion, answer: ChecklistAnswer | undefined): boolean {
  if (question.responseType === 'repeating_group') {
    const rows = answer?.rows ?? [];
    return rows.length > 0 && rows.every((r) => rowComplete(question.groupFields ?? [], r));
  }
  return isAnswered(answer);
}

/** A No on a corrective question needs the auditor's issue summary before submit. */
function correctiveComplete(question: ChecklistQuestion, answer: ChecklistAnswer | undefined): boolean {
  if (!question.correctiveActionConfig) return true;
  if (answer?.value !== false) return true;
  return Boolean(answer.correctiveActionDraft?.issueSummary.trim());
}

function conditionMet(question: ChecklistQuestion, answer: ChecklistAnswer | undefined): string[] {
  if (!answer || answer.value === null) return [];
  const triggered: string[] = [];
  for (const rule of question.followUpRules) {
    const { type, value } = rule.condition;
    const v = answer.value;
    let met = false;
    if (type === 'checked') met = v === true;
    else if (type === 'unchecked') met = v === false;
    else if (type === 'greater_than') met = typeof v === 'number' && typeof value === 'number' && v > value;
    else if (type === 'less_than') met = typeof v === 'number' && typeof value === 'number' && v < value;
    else if (type === 'equals') met = String(v) === String(value);
    else if (type === 'contains') met = typeof v === 'string' && v.includes(String(value));
    if (met) triggered.push(rule.followUpQuestionId);
  }
  return triggered;
}

// ─── response inputs ──────────────────────────────────────────────────────────

/** Square chevron button in the flow toolbar, as in web-v2's NavButton. */
function NavButton({
  children,
  onClick,
  disabled,
  ariaLabel,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled: boolean;
  ariaLabel: string;
}) {
  return (
    <button
      type="button"
      aria-label={ariaLabel}
      aria-disabled={disabled || undefined}
      onClick={() => { if (!disabled) onClick(); }}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: '36px',
        height: '36px',
        flexShrink: 0,
        borderRadius: '8px',
        border: '1px solid var(--color-border)',
        background: '#fff',
        color: 'var(--color-text-primary)',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.5 : 1,
        transition: 'background 0.15s ease',
      }}
    >
      {children}
    </button>
  );
}

// Mirrors web-v2's TickBoxInput: both options start as an empty box,
// the tick / cross only appears on selection, and the chosen option
// takes a navy ring with a 1px offset so it reads as pressed.
const SELECTED_RING = '0 0 0 1px #fff, 0 0 0 3px #001C35';

function CheckboxInput({
  value,
  onChange,
}: {
  value: boolean | null;
  onChange: (v: boolean) => void;
}) {
  const YesIcon = value === true ? CheckSquare : Square;
  const NoIcon = value === false ? XSquare : Square;
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
      <button
        type="button"
        onClick={() => onChange(true)}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '8px',
          height: '56px',
          borderRadius: '10px',
          border: value === true ? 'none' : '1px solid var(--color-border)',
          background: value === true ? '#15803D' : '#fff',
          color: value === true ? '#fff' : 'var(--color-text-primary)',
          boxShadow: value === true ? SELECTED_RING : 'none',
          fontSize: '14px',
          fontWeight: 700,
          cursor: 'pointer',
          fontFamily: 'var(--font-primary)',
          transition: 'all 0.15s ease',
        }}
      >
        <YesIcon size={20} />
        Yes
      </button>
      <button
        type="button"
        onClick={() => onChange(false)}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '8px',
          height: '56px',
          borderRadius: '10px',
          border: value === false ? 'none' : '1px solid var(--color-border)',
          background: value === false ? '#B91C1C' : '#fff',
          color: value === false ? '#fff' : 'var(--color-text-primary)',
          boxShadow: value === false ? SELECTED_RING : 'none',
          fontSize: '14px',
          fontWeight: 700,
          cursor: 'pointer',
          fontFamily: 'var(--font-primary)',
          transition: 'all 0.15s ease',
        }}
      >
        <NoIcon size={20} />
        No
      </button>
    </div>
  );
}

// "Urgent" is a needs-attention escalation, not a broken state — it takes
// the warning yellow field (navy ink), never red.
const RATING_OPTIONS: {
  value: RatingValue;
  label: string;
  activeBg: string;
  activeFg: string;
  activeBorder: string;
}[] = [
  { value: 'great', label: 'Great', activeBg: '#166534', activeFg: '#fff', activeBorder: '#166534' },
  { value: 'average', label: 'Average', activeBg: '#001C35', activeFg: '#fff', activeBorder: '#001C35' },
  { value: 'urgent', label: 'Urgent', activeBg: '#FEF6DA', activeFg: '#001C35', activeBorder: '#EAD173' },
];

function RatingInput({
  value,
  note,
  onChange,
  onNoteChange,
}: {
  value: RatingValue | null;
  note: string;
  onChange: (v: RatingValue) => void;
  onNoteChange: (note: string) => void;
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
      <div style={{ display: 'flex', gap: '10px' }}>
        {RATING_OPTIONS.map((opt) => {
          const active = value === opt.value;
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => onChange(opt.value)}
              style={{
                flex: 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                minHeight: '52px',
                borderRadius: '10px',
                border: active ? `1.5px solid ${opt.activeBorder}` : '1.5px solid var(--color-border)',
                background: active ? opt.activeBg : '#fff',
                color: active ? opt.activeFg : 'var(--color-text-primary)',
                fontSize: '14px',
                fontWeight: 700,
                cursor: 'pointer',
                fontFamily: 'var(--font-primary)',
                transition: 'all 0.15s ease',
              }}
            >
              {opt.label}
            </button>
          );
        })}
      </div>
      <textarea
        value={note}
        onChange={(e) => onNoteChange(e.target.value)}
        placeholder="Add a note (optional)…"
        rows={2}
        style={{
          width: '100%',
          padding: '10px 12px',
          borderRadius: '10px',
          border: '1.5px solid var(--color-border)',
          fontSize: '13px',
          fontFamily: 'var(--font-primary)',
          color: 'var(--color-text-primary)',
          background: '#fff',
          outline: 'none',
          resize: 'vertical',
          boxSizing: 'border-box',
          lineHeight: 1.5,
        }}
      />
    </div>
  );
}

function NumberInput({
  value,
  onChange,
  responseType,
  onConfirm,
}: {
  value: number | null;
  onChange: (v: number | null) => void;
  responseType: ResponseType;
  onConfirm: () => void;
}) {
  const unit = getUnit(responseType);

  return (
    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
      <div style={{
        flex: 1,
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        padding: '0 14px',
        borderRadius: '10px',
        border: '1px solid var(--color-border)',
        background: '#fff',
        minHeight: '48px',
      }}>
        <input
          type="number"
          inputMode="decimal"
          value={value ?? ''}
          onChange={(e) => onChange(e.target.value === '' ? null : Number(e.target.value))}
          onKeyDown={(e) => { if (e.key === 'Enter') onConfirm(); }}
          placeholder={responseType === 'temperature' ? `Temperature in ${unit}` : 'Enter a number'}
          style={{
            flex: 1,
            border: 'none',
            outline: 'none',
            fontSize: '15px',
            fontWeight: 600,
            color: 'var(--color-text-primary)',
            fontFamily: 'var(--font-primary)',
            background: 'transparent',
            minWidth: 0,
          }}
        />
        {unit && (
          <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--color-text-muted)', flexShrink: 0 }}>
            {unit}
          </span>
        )}
      </div>
      <button
        type="button"
        onClick={onConfirm}
        disabled={value === null}
        aria-label="Confirm answer"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: '48px',
          height: '48px',
          borderRadius: '10px',
          border: 'none',
          background: value !== null ? 'var(--color-accent-active)' : 'var(--color-border)',
          cursor: value !== null ? 'pointer' : 'default',
          transition: 'background 0.15s ease',
          flexShrink: 0,
        }}
      >
        <ChevronRight size={20} color="#fff" />
      </button>
    </div>
  );
}

function TextInput({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <textarea
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder="Type your answer…"
      rows={3}
      style={{
        width: '100%',
        padding: '12px 14px',
        borderRadius: '10px',
        border: '1.5px solid var(--color-border)',
        fontSize: '14px',
        fontFamily: 'var(--font-primary)',
        color: 'var(--color-text-primary)',
        background: '#fff',
        outline: 'none',
        resize: 'vertical',
        boxSizing: 'border-box',
        lineHeight: 1.5,
      }}
    />
  );
}

// ─── Corrective action panel ──────────────────────────────────────────────────
//
// Shown when a No lands on a question with `correctiveActionConfig`.
// Two owners, one card: the auditor writes the issue summary here and
// picks the assignee; the fix itself (text + photo evidence) is done
// later by the store via the corrective action work item this creates.

function CorrectiveActionPanel({
  site,
  draft,
  requirePhotoEvidence,
  showRequired,
  onSummaryChange,
  onAssigneeChange,
  onPhotoChange,
}: {
  site: string;
  draft: NonNullable<ChecklistAnswer['correctiveActionDraft']>;
  requirePhotoEvidence: boolean;
  showRequired: boolean;
  onSummaryChange: (v: string) => void;
  onAssigneeChange: (v: CorrectiveAssigneeType) => void;
  onPhotoChange: (url: string | undefined) => void;
}) {
  const team = getSiteTeam(site);
  const summaryMissing = showRequired && !draft.issueSummary.trim();
  const assigneeName = assigneeNameFor(site, draft.assigneeType);

  return (
    <div
      style={{
        marginTop: '12px',
        padding: '14px',
        borderRadius: '10px',
        border: summaryMissing ? '1.5px solid #E89AAE' : '1px solid #E89AAE',
        // Left accent as an inset shadow — mixing the border shorthand with
        // a borderLeft longhand makes React clear the border on re-render.
        boxShadow: 'inset 3px 0 0 #B01038',
        background: '#FFF7F8',
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
        <AlertTriangle size={13} color="#B01038" />
        <span style={{ fontSize: '12px', fontWeight: 700, color: '#B01038', letterSpacing: '0.03em' }}>
          Corrective action required
        </span>
      </div>

      {/* Issue summary — the auditor's half */}
      <div>
        <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--color-text-secondary)', marginBottom: '5px' }}>
          Issue summary · completed by you
        </label>
        <textarea
          value={draft.issueSummary}
          onChange={(e) => onSummaryChange(e.target.value)}
          placeholder="Describe the issue you found…"
          rows={3}
          style={{
            width: '100%',
            padding: '10px 12px',
            borderRadius: '9px',
            border: summaryMissing ? '1.5px solid #E89AAE' : '1.5px solid var(--color-border)',
            fontSize: '13px',
            fontFamily: 'var(--font-primary)',
            color: 'var(--color-text-primary)',
            background: '#fff',
            outline: 'none',
            resize: 'vertical',
            boxSizing: 'border-box',
            lineHeight: 1.5,
          }}
        />
        {summaryMissing && (
          <span style={{ fontSize: '12px', color: '#B01038', fontWeight: 500 }}>An issue summary is required</span>
        )}
        <div style={{ marginTop: '8px' }}>
          <PhotoCapture dataUrl={draft.photoDataUrl} onChange={onPhotoChange} />
        </div>
      </div>

      {/* Assign to — the store's half */}
      <div style={{ paddingTop: '10px', borderTop: '1px dashed #E89AAE' }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '12px', fontWeight: 600, color: 'var(--color-text-secondary)', marginBottom: '5px' }}>
          <UserCheck size={12} />
          Assign corrective action to
        </label>
        <select
          value={draft.assigneeType}
          onChange={(e) => onAssigneeChange(e.target.value as CorrectiveAssigneeType)}
          style={{
            width: '100%',
            padding: '10px 12px',
            borderRadius: '9px',
            border: '1.5px solid var(--color-border)',
            fontSize: '13px',
            fontWeight: 600,
            fontFamily: 'var(--font-primary)',
            color: 'var(--color-text-primary)',
            background: '#fff',
            outline: 'none',
            cursor: 'pointer',
            boxSizing: 'border-box',
          }}
        >
          <option value="outlet_manager">{team.outletManager}</option>
          <option value="store_account">Store account</option>
        </select>
        <p style={{ margin: '7px 0 0', fontSize: '12px', color: 'var(--color-text-muted)', lineHeight: 1.5 }}>
          {assigneeName} will describe the fix{requirePhotoEvidence ? ' and attach a photo as evidence' : ''}.
          Only the {site} team is notified.
        </p>
      </div>
    </div>
  );
}

// ─── Repeating group (table-style) input ──────────────────────────────────────
//
// One question, many rows — e.g. a delivery log. Each row captures the
// configured fields; a temperature over threshold or a condition "No"
// opens the per-row follow-up prompt inline.

function uid() {
  return Math.random().toString(36).slice(2, 9);
}

function emptyRow(fields: GroupField[]): RepeatingRow {
  const values: RepeatingRow['values'] = {};
  fields.forEach((f) => { values[f.id] = null; });
  return { id: `row-${uid()}`, values };
}

function summariseRow(fields: GroupField[], row: RepeatingRow): string {
  return fields
    .map((f) => {
      const v = row.values[f.id];
      if (f.type === 'checkbox') return v === true ? '✓' : v === false ? '✗' : '—';
      if (f.type === 'temperature') return typeof v === 'number' ? `${v}°C` : '—';
      return v ? String(v) : '—';
    })
    .join(' · ');
}

function RowFieldInput({
  field,
  value,
  onChange,
}: {
  field: GroupField;
  value: string | number | boolean | null;
  onChange: (v: string | number | boolean | null) => void;
}) {
  if (field.type === 'checkbox') {
    return (
      <div style={{ display: 'flex', gap: '8px' }}>
        {[true, false].map((option) => {
          const active = value === option;
          return (
            <button
              key={String(option)}
              type="button"
              onClick={() => onChange(option)}
              style={{
                flex: 1,
                minHeight: '40px',
                borderRadius: '8px',
                border: active ? 'none' : '1px solid var(--color-border)',
                background: active ? (option ? '#15803D' : '#B91C1C') : '#fff',
                color: active ? '#fff' : 'var(--color-text-primary)',
                boxShadow: active ? SELECTED_RING : 'none',
                fontSize: '13px',
                fontWeight: 700,
                cursor: 'pointer',
                fontFamily: 'var(--font-primary)',
                transition: 'all 0.15s ease',
              }}
            >
              {option ? 'Yes' : 'No'}
            </button>
          );
        })}
      </div>
    );
  }

  if (field.type === 'temperature') {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        padding: '0 12px',
        borderRadius: '8px',
        border: '1.5px solid var(--color-border)',
        background: '#fff',
        minHeight: '40px',
      }}>
        <Thermometer size={14} color="var(--color-text-muted)" />
        <input
          type="number"
          inputMode="decimal"
          value={typeof value === 'number' ? value : ''}
          onChange={(e) => onChange(e.target.value === '' ? null : Number(e.target.value))}
          placeholder="0.0"
          style={{
            flex: 1,
            border: 'none',
            outline: 'none',
            fontSize: '15px',
            fontWeight: 700,
            color: 'var(--color-text-primary)',
            fontFamily: 'var(--font-primary)',
            background: 'transparent',
            minWidth: 0,
          }}
        />
        <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-text-muted)', flexShrink: 0 }}>°C</span>
      </div>
    );
  }

  return (
    <input
      type="text"
      value={typeof value === 'string' ? value : ''}
      onChange={(e) => onChange(e.target.value)}
      placeholder={field.name}
      style={{
        width: '100%',
        minHeight: '40px',
        padding: '0 12px',
        borderRadius: '8px',
        border: '1.5px solid var(--color-border)',
        fontSize: '13px',
        fontFamily: 'var(--font-primary)',
        color: 'var(--color-text-primary)',
        background: '#fff',
        outline: 'none',
        boxSizing: 'border-box',
      }}
    />
  );
}

function RepeatingGroupInput({
  fields,
  rows,
  showRequired,
  onRowsChange,
}: {
  fields: GroupField[];
  rows: RepeatingRow[];
  showRequired: boolean;
  onRowsChange: (rows: RepeatingRow[]) => void;
}) {
  // Rows collapse to a one-line summary once confirmed; track expansion here.
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  function updateRow(rowId: string, patch: Partial<RepeatingRow>) {
    onRowsChange(rows.map((r) => (r.id === rowId ? { ...r, ...patch } : r)));
  }

  function updateValue(rowId: string, fieldId: string, v: string | number | boolean | null) {
    const row = rows.find((r) => r.id === rowId);
    if (!row) return;
    updateRow(rowId, { values: { ...row.values, [fieldId]: v } });
  }

  function addRow() {
    const row = emptyRow(fields);
    onRowsChange([...rows, row]);
    setExpandedIds((prev) => new Set(prev).add(row.id));
  }

  function removeRow(rowId: string) {
    onRowsChange(rows.filter((r) => r.id !== rowId));
  }

  function setExpanded(rowId: string, expanded: boolean) {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (expanded) next.add(rowId);
      else next.delete(rowId);
      return next;
    });
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
      {rows.length === 0 && (
        <p style={{ margin: 0, fontSize: '13px', color: 'var(--color-text-muted)' }}>
          No entries yet — log the first one below.
        </p>
      )}

      {rows.map((row, i) => {
        const complete = rowComplete(fields, row);
        const prompts = triggeredPrompts(fields, row);
        const expanded = expandedIds.has(row.id) || !complete;
        const incomplete = showRequired && !complete;

        if (!expanded) {
          return (
            <button
              key={row.id}
              type="button"
              onClick={() => setExpanded(row.id, true)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                width: '100%',
                textAlign: 'left',
                padding: '10px 12px',
                borderRadius: '9px',
                border: prompts.length > 0 ? '1px solid #EAD173' : '1px solid var(--color-border-subtle)',
                background: prompts.length > 0 ? '#FEF6DA' : 'var(--color-bg-surface)',
                cursor: 'pointer',
                fontFamily: 'var(--font-primary)',
              }}
            >
              <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--color-text-muted)', flexShrink: 0 }}>
                #{i + 1}
              </span>
              <span style={{
                flex: 1,
                fontSize: '13px',
                fontWeight: 600,
                color: 'var(--color-text-primary)',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}>
                {summariseRow(fields, row)}
              </span>
              {prompts.length > 0 && <AlertTriangle size={13} color="#001C35" style={{ flexShrink: 0 }} />}
              <ChevronDown size={14} color="var(--color-text-muted)" style={{ flexShrink: 0 }} />
            </button>
          );
        }

        return (
          <div
            key={row.id}
            style={{
              padding: '12px',
              borderRadius: '10px',
              border: incomplete ? '1.5px solid #E89AAE' : '1px solid var(--color-border)',
              background: incomplete ? '#FFF5F5' : 'var(--color-bg-surface)',
              display: 'flex',
              flexDirection: 'column',
              gap: '10px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--color-text-muted)', letterSpacing: '0.04em' }}>
                Entry #{i + 1}
              </span>
              <div style={{ display: 'flex', gap: '4px' }}>
                <button
                  type="button"
                  onClick={() => removeRow(row.id)}
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
                  }}
                >
                  <Trash2 size={13} color="#B01038" />
                </button>
                {complete && (
                  <button
                    type="button"
                    onClick={() => setExpanded(row.id, false)}
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
                    }}
                  >
                    <ChevronUp size={14} color="var(--color-text-secondary)" />
                  </button>
                )}
              </div>
            </div>

            {fields.map((f) => (
              <div key={f.id}>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--color-text-secondary)', marginBottom: '4px' }}>
                  {f.name}
                </label>
                <RowFieldInput
                  field={f}
                  value={row.values[f.id] ?? null}
                  onChange={(v) => updateValue(row.id, f.id, v)}
                />
              </div>
            ))}

            {/* Per-row follow-up prompt */}
            <AnimatePresence>
              {prompts.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: -6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.2, ease: 'easeOut' }}
                  style={{
                    padding: '10px 12px',
                    borderRadius: '9px',
                    border: '1px solid #EAD173',
                    boxShadow: 'inset 3px 0 0 #F59E0B',
                    background: '#FEF6DA',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '8px',
                  }}
                >
                  {prompts.map((p) => (
                    <div key={p.id} style={{ display: 'flex', alignItems: 'flex-start', gap: '5px' }}>
                      <GitBranch size={12} color="#001C35" style={{ flexShrink: 0, marginTop: '2px' }} />
                      <span style={{ fontSize: '12px', fontWeight: 600, color: '#001C35', lineHeight: 1.4 }}>
                        {p.followUpPrompt}
                      </span>
                    </div>
                  ))}
                  <textarea
                    value={row.followUpNote ?? ''}
                    onChange={(e) => updateRow(row.id, { followUpNote: e.target.value })}
                    placeholder="What did you do?"
                    rows={2}
                    style={{
                      width: '100%',
                      padding: '8px 10px',
                      borderRadius: '8px',
                      border: '1.5px solid var(--color-border)',
                      fontSize: '13px',
                      fontFamily: 'var(--font-primary)',
                      color: 'var(--color-text-primary)',
                      background: '#fff',
                      outline: 'none',
                      resize: 'vertical',
                      boxSizing: 'border-box',
                      lineHeight: 1.5,
                    }}
                  />
                  <PhotoCapture
                    dataUrl={row.followUpPhotoDataUrl}
                    onChange={(url) => updateRow(row.id, { followUpPhotoDataUrl: url })}
                  />
                </motion.div>
              )}
            </AnimatePresence>

            {complete && (
              <button
                type="button"
                onClick={() => setExpanded(row.id, false)}
                style={{
                  padding: '9px',
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
                Done — collapse entry
              </button>
            )}
          </div>
        );
      })}

      <button
        type="button"
        onClick={addRow}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '6px',
          padding: '11px',
          borderRadius: '9px',
          border: '1.5px dashed var(--color-border)',
          background: 'transparent',
          fontSize: '13px',
          fontWeight: 600,
          color: 'var(--color-text-secondary)',
          cursor: 'pointer',
          fontFamily: 'var(--font-primary)',
        }}
      >
        <Plus size={14} />
        Add delivery
      </button>
    </div>
  );
}

// ─── Question card ────────────────────────────────────────────────────────────

function QuestionCard({
  question,
  answer,
  isFollowUp,
  questionNumber,
  site,
  isAudit,
  weights,
  onAnswer,
  onNoteChange,
  onPhotoChange,
  onConfirm,
  onCorrectiveChange,
  onRowsChange,
  showRequired,
  cardRef,
}: {
  question: ChecklistQuestion;
  answer: ChecklistAnswer | undefined;
  isFollowUp: boolean;
  questionNumber: number;
  site: string;
  isAudit: boolean;
  weights: SeverityWeights;
  onAnswer: (questionId: string, value: string | number | boolean | null) => void;
  onNoteChange: (questionId: string, note: string) => void;
  onPhotoChange: (questionId: string, url: string | undefined) => void;
  onConfirm: (questionId: string) => void;
  onCorrectiveChange: (questionId: string, draft: NonNullable<ChecklistAnswer['correctiveActionDraft']>) => void;
  onRowsChange: (questionId: string, rows: RepeatingRow[]) => void;
  showRequired: boolean;
  cardRef?: React.RefObject<HTMLDivElement | null>;
}) {
  const answered = isQuestionAnswered(question, answer) && correctiveComplete(question, answer);
  const missing = showRequired && question.mandatory && !answered;

  const showCorrectivePanel = Boolean(question.correctiveActionConfig) && answer?.value === false;
  const correctiveDraft = answer?.correctiveActionDraft ?? {
    issueSummary: '',
    assigneeType: question.correctiveActionConfig?.defaultAssignee ?? 'outlet_manager',
  };

  return (
    <div
      ref={cardRef}
      style={{
        padding: isFollowUp ? '14px' : '16px',
        borderRadius: '10px',
        border: missing
          ? '1.5px solid #E89AAE'
          : isFollowUp
          ? '1px solid #EAD173'
          : '1px solid var(--color-border-subtle)',
        background: missing ? '#FFF5F5' : '#fff',
        marginLeft: isFollowUp ? '12px' : '0',
        boxShadow: isFollowUp ? 'inset 3px 0 0 #F59E0B' : undefined,
        transition: 'border-color 0.2s ease',
        position: 'relative',
      }}
    >
      {/* Question number + follow-up label — "Q1 · Required" microlabel,
          the Q number in ink, the rest muted, as in web-v2's task card. */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '2px' }}>
        {isFollowUp ? (
          <span style={{ fontSize: '11px', fontWeight: 700, color: '#001C35', display: 'flex', alignItems: 'center', gap: '3px' }}>
            <GitBranch size={11} />
            Follow-up
            {question.mandatory && (
              <span style={{ fontWeight: 400, color: missing ? '#B01038' : 'var(--color-text-muted)' }}>
                · Required
              </span>
            )}
          </span>
        ) : (
          <span style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>
            <span style={{ fontWeight: 600, color: 'var(--color-text-primary)' }}>Q{questionNumber}</span>
            {' · '}
            <span style={{ color: missing ? '#B01038' : undefined }}>
              {question.mandatory ? 'Required' : 'Optional'}
            </span>
          </span>
        )}
        {/* Audit: what this answer is worth, coloured by severity */}
        {isAudit && isScoreable(question) && (
          <span style={{
            marginLeft: 'auto',
            fontSize: '11px',
            fontWeight: 700,
            padding: '2px 8px',
            borderRadius: '100px',
            background: SEVERITY_COLORS[question.severity ?? 'medium'].bg,
            color: SEVERITY_COLORS[question.severity ?? 'medium'].text,
          }}>
            {severityLabel(question.severity ?? 'medium')} · {weights[question.severity ?? 'medium']} pts
          </span>
        )}
        {/* Answered tick sits in the header row beside the points chip,
            so it never covers it. */}
        {answered && !isFollowUp && (
          <span style={{
            marginLeft: isAudit && isScoreable(question) ? '2px' : 'auto',
            width: '20px',
            height: '20px',
            borderRadius: '50%',
            background: '#166534',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}>
            <Check size={12} color="#fff" strokeWidth={3} />
          </span>
        )}
      </div>

      {/* Question text */}
      <p style={{
        margin: '0 0 12px',
        fontSize: '14px',
        fontWeight: 700,
        color: 'var(--color-text-primary)',
        lineHeight: 1.4,
      }}>
        {question.name}
      </p>

      {/* Response input */}
      {question.responseType === 'checkbox' && (
        <CheckboxInput
          value={typeof answer?.value === 'boolean' ? answer.value : null}
          onChange={(v) => onAnswer(question.id, v)}
        />
      )}

      {/* A No on a corrective question opens the two-owner panel:
          issue summary (auditor) + assign-to (store). */}
      <AnimatePresence>
        {showCorrectivePanel && question.correctiveActionConfig && (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
          >
            <CorrectiveActionPanel
              site={site}
              draft={correctiveDraft}
              requirePhotoEvidence={question.correctiveActionConfig.requirePhotoEvidence}
              showRequired={showRequired}
              onSummaryChange={(v) => onCorrectiveChange(question.id, { ...correctiveDraft, issueSummary: v })}
              onAssigneeChange={(v) => onCorrectiveChange(question.id, { ...correctiveDraft, assigneeType: v })}
              onPhotoChange={(url) => onCorrectiveChange(question.id, { ...correctiveDraft, photoDataUrl: url })}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {question.responseType === 'repeating_group' && (
        <RepeatingGroupInput
          fields={question.groupFields ?? []}
          rows={answer?.rows ?? []}
          showRequired={showRequired}
          onRowsChange={(rows) => onRowsChange(question.id, rows)}
        />
      )}

      {question.responseType === 'rating' && (
        <RatingInput
          value={
            answer?.value === 'great' || answer?.value === 'average' || answer?.value === 'urgent'
              ? answer.value
              : null
          }
          note={answer?.note ?? ''}
          onChange={(v) => onAnswer(question.id, v)}
          onNoteChange={(note) => onNoteChange(question.id, note)}
        />
      )}

      {(question.responseType === 'temperature' || question.responseType === 'number') && (
        <NumberInput
          value={typeof answer?.value === 'number' ? answer.value : null}
          onChange={(v) => onAnswer(question.id, v)}
          responseType={question.responseType}
          onConfirm={() => onConfirm(question.id)}
        />
      )}

      {question.responseType === 'text' && (
        <TextInput
          value={typeof answer?.value === 'string' ? answer.value : ''}
          onChange={(v) => onAnswer(question.id, v)}
        />
      )}

      {/* Photo capture */}
      {question.allowPhoto && (
        <div style={{ marginTop: '12px' }}>
          <PhotoCapture
            dataUrl={answer?.photoDataUrl}
            onChange={(url) => onPhotoChange(question.id, url)}
          />
        </div>
      )}

      {missing && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '5px', marginTop: '10px' }}>
          <AlertCircle size={13} color="#B01038" />
          <span style={{ fontSize: '12px', color: '#B01038', fontWeight: 500 }}>This question is required</span>
        </div>
      )}
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export function CompletionFlowClient({ instanceId }: { instanceId: string }) {
  const router = useRouter();

  // Store-scheduled instances (from checklists built in the editor) and
  // edited templates take precedence over fixtures. Going through the
  // hook keeps SSR/hydration consistent: the server snapshot is empty,
  // so fixtures render first and store data lands right after hydration.
  const checklistStore = useChecklistStore();
  const instance =
    checklistStore.instances.find((i) => i.id === instanceId) ?? getInstanceById(instanceId);
  const baseTemplate = instance
    ? checklistStore.templates.find((t) => t.id === instance.templateId) ??
      getTemplateForInstance(instance)
    : undefined;

  // Audit mode: every scored Yes/No question raises an action on No, so
  // give them the corrective panel behaviour even without an explicit
  // config — the panel captures the required fail comment.
  const template: ChecklistTemplate | undefined = useMemo(() => {
    if (!baseTemplate?.scoringEnabled) return baseTemplate;
    return {
      ...baseTemplate,
      questions: baseTemplate.questions.map((q) =>
        q.responseType === 'checkbox' && !q.parentQuestionId && !q.correctiveActionConfig
          ? {
              ...q,
              correctiveActionConfig: {
                triggerOnNo: true as const,
                defaultAssignee: 'outlet_manager' as const,
                requirePhotoEvidence: false,
              },
            }
          : q,
      ),
    };
  }, [baseTemplate]);

  const alertRouting = useAlertRouting();

  const [answers, setAnswers] = useState<ChecklistAnswer[]>(instance?.answers ?? []);
  const [showRequired, setShowRequired] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [createdActions, setCreatedActions] = useState<CorrectiveAction[]>([]);
  const [finalScore, setFinalScore] = useState<AuditScoreResult | null>(null);

  // Refs for each root question card (for auto-scroll)
  const cardRefs = useRef<Map<string, React.RefObject<HTMLDivElement | null>>>(new Map());

  // Task jumper (matches web-v2's flow toolbar): the active task tracks
  // scroll position; prev/next and the dropdown jump between cards.
  const [activeIndex, setActiveIndex] = useState(0);
  const [jumperOpen, setJumperOpen] = useState(false);
  const isJumping = useRef(false);

  useEffect(() => {
    function onScroll() {
      if (isJumping.current) return;
      const cards = Array.from(document.querySelectorAll<HTMLElement>('[data-q-index]'));
      if (cards.length === 0) return;
      let next = 0;
      for (const el of cards) {
        if (el.getBoundingClientRect().top - 160 <= 0) next = Number(el.dataset.qIndex);
        else break;
      }
      setActiveIndex(next);
    }
    // Capture-phase listener so it fires whichever container scrolls.
    window.addEventListener('scroll', onScroll, true);
    return () => window.removeEventListener('scroll', onScroll, true);
  }, []);

  const jumpToIndex = useCallback((index: number, ids: string[]) => {
    const id = ids[index];
    if (!id) return;
    setActiveIndex(index);
    setJumperOpen(false);
    isJumping.current = true;
    cardRefs.current.get(id)?.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    setTimeout(() => { isJumping.current = false; }, 600);
  }, []);

  function getCardRef(id: string): React.RefObject<HTMLDivElement | null> {
    if (!cardRefs.current.has(id)) {
      cardRefs.current.set(id, { current: null });
    }
    return cardRefs.current.get(id)!;
  }

  function getAnswer(questionId: string): ChecklistAnswer | undefined {
    return answers.find((a) => a.questionId === questionId);
  }

  const scrollToNext = useCallback((currentId: string, allRootIds: string[]) => {
    const idx = allRootIds.indexOf(currentId);
    if (idx === -1) return;
    // Find next unanswered root question
    for (let i = idx + 1; i < allRootIds.length; i++) {
      const nextId = allRootIds[i];
      const nextAnswer = answers.find((a) => a.questionId === nextId);
      if (!isAnswered(nextAnswer)) {
        setTimeout(() => {
          cardRefs.current.get(nextId)?.current?.scrollIntoView({
            behavior: 'smooth',
            block: 'center',
          });
        }, 120);
        return;
      }
    }
  }, [answers]);

  function handleAnswer(questionId: string, value: string | number | boolean | null) {
    setAnswers((prev) => {
      const existing = prev.findIndex((a) => a.questionId === questionId);
      const updated: ChecklistAnswer = {
        questionId,
        value,
        note: prev[existing]?.note,
        photoDataUrl: prev[existing]?.photoDataUrl,
      };
      if (existing >= 0) {
        const next = [...prev];
        next[existing] = updated;
        return next;
      }
      return [...prev, updated];
    });
  }

  function handleNoteChange(questionId: string, note: string) {
    setAnswers((prev) => {
      const existing = prev.findIndex((a) => a.questionId === questionId);
      if (existing >= 0) {
        const next = [...prev];
        next[existing] = { ...next[existing], note };
        return next;
      }
      return [...prev, { questionId, value: null, note }];
    });
  }

  // Auto-scroll after checkbox / number answer
  useEffect(() => {
    // no-op — scroll is triggered in handleAnswerWithScroll
  }, [answers]);

  function handleAnswerWithScroll(questionId: string, value: string | number | boolean | null, rootIds: string[]) {
    handleAnswer(questionId, value);
    // Auto-advance for checkbox; number advances via confirm button
    if (typeof value === 'boolean') {
      setTimeout(() => scrollToNext(questionId, rootIds), 150);
    }
  }

  function handlePhotoChange(questionId: string, url: string | undefined) {
    setAnswers((prev) => {
      const existing = prev.findIndex((a) => a.questionId === questionId);
      if (existing >= 0) {
        const next = [...prev];
        next[existing] = { ...next[existing], photoDataUrl: url };
        return next;
      }
      return [...prev, { questionId, value: null, photoDataUrl: url }];
    });
  }

  function handleCorrectiveChange(
    questionId: string,
    draft: NonNullable<ChecklistAnswer['correctiveActionDraft']>,
  ) {
    setAnswers((prev) => {
      const existing = prev.findIndex((a) => a.questionId === questionId);
      if (existing >= 0) {
        const next = [...prev];
        next[existing] = { ...next[existing], correctiveActionDraft: draft };
        return next;
      }
      return [...prev, { questionId, value: null, correctiveActionDraft: draft }];
    });
  }

  function handleRowsChange(questionId: string, rows: RepeatingRow[]) {
    setAnswers((prev) => {
      const existing = prev.findIndex((a) => a.questionId === questionId);
      if (existing >= 0) {
        const next = [...prev];
        next[existing] = { ...next[existing], rows };
        return next;
      }
      return [...prev, { questionId, value: null, rows }];
    });
  }

  if (!instance || !template) {
    return (
      <div style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--color-text-secondary)' }}>
        Checklist not found.
      </div>
    );
  }

  // Build the ordered list of questions to display (root + triggered follow-ups)
  const rootQuestions = template.questions.filter((q) => !q.parentQuestionId);

  // Audit mode: group questions under their sections (with a General
  // bucket for the unsectioned) and keep a live score running.
  const isAudit = !!template.scoringEnabled;
  const liveScore = isAudit ? computeScore(template, answers) : null;

  const questionGroups: { section: { id: string; name: string } | null; questions: ChecklistQuestion[] }[] =
    isAudit && (template.sections?.length ?? 0) > 0
      ? (() => {
          const sections = template.sections!;
          const groups = sections
            .map((s) => ({ section: s as { id: string; name: string } | null, questions: rootQuestions.filter((q) => q.sectionId === s.id) }))
            .filter((g) => g.questions.length > 0);
          const general = rootQuestions.filter(
            (q) => !q.sectionId || !sections.some((s) => s.id === q.sectionId),
          );
          if (general.length > 0) groups.push({ section: { id: 'general', name: 'General' }, questions: general });
          return groups;
        })()
      : [{ section: null, questions: rootQuestions }];

  const orderedRoots = questionGroups.flatMap((g) => g.questions);
  const rootIds = orderedRoots.map((q) => q.id);

  // Compute which follow-up IDs are currently triggered
  const triggeredFollowUpIds = new Set<string>();
  rootQuestions.forEach((q) => {
    const ans = getAnswer(q.id);
    conditionMet(q, ans).forEach((fid) => triggeredFollowUpIds.add(fid));
  });

  const mandatoryQuestions = [
    ...rootQuestions.filter((q) => q.mandatory),
    ...template.questions.filter((q) => q.parentQuestionId && triggeredFollowUpIds.has(q.id) && q.mandatory),
  ];

  const answeredCount = rootQuestions.filter((q) => isQuestionAnswered(q, getAnswer(q.id))).length;
  const totalCount = rootQuestions.length;
  const progressPct = totalCount > 0 ? Math.round((answeredCount / totalCount) * 100) : 0;

  // A mandatory question is only "done" when it's answered AND, on a
  // corrective No, the auditor's issue summary is written.
  const questionDone = (q: ChecklistQuestion) =>
    isQuestionAnswered(q, getAnswer(q.id)) && correctiveComplete(q, getAnswer(q.id));

  const allMandatoryAnswered = mandatoryQuestions.every(questionDone);
  const missingMandatoryCount = mandatoryQuestions.filter((q) => !questionDone(q)).length;

  /** One CorrectiveAction per corrective question answered No. */
  function buildCorrectiveActions(): CorrectiveAction[] {
    if (!instance || !template) return [];
    const now = new Date();
    const time = now
      .toLocaleTimeString('en-AU', { hour: 'numeric', minute: '2-digit' })
      .replace(/\s/g, '')
      .toLowerCase();
    const date = now.toLocaleDateString('en-AU', { day: 'numeric', month: 'short' });
    const out: CorrectiveAction[] = [];
    for (const q of template.questions) {
      const config = q.correctiveActionConfig;
      if (!config) continue;
      const a = getAnswer(q.id);
      if (a?.value !== false) continue;
      const assigneeType = a.correctiveActionDraft?.assigneeType ?? config.defaultAssignee;
      out.push({
        id: newCorrectiveActionId(),
        sourceInstanceId: instance.id,
        sourceQuestionId: q.id,
        templateName: template.name,
        site: instance.site,
        questionText: q.name,
        issueSummary: a.correctiveActionDraft?.issueSummary.trim() ?? '',
        issuePhotoDataUrl: a.correctiveActionDraft?.photoDataUrl,
        raisedBy: 'Ed Mehta',
        raisedDate: now.toISOString().slice(0, 10),
        raisedAtLabel: `${time} · ${date}`,
        assigneeType,
        assigneeName: assigneeNameFor(instance.site, assigneeType),
        requirePhotoEvidence: config.requirePhotoEvidence,
        status: 'open',
        ...(isAudit && isScoreable(q)
          ? { severity: q.severity ?? ('medium' as Severity), pointsLost: pointsFor(template, q) }
          : {}),
      });
    }

    // Audit threshold fails (number/temperature out of range) also raise
    // an action — the comment comes from the triggered follow-up answer.
    if (isAudit) {
      for (const q of template.questions) {
        if (q.responseType === 'checkbox' || !isScoreable(q)) continue;
        const a = getAnswer(q.id);
        if (questionOutcome(q, a) !== 'fail') continue;
        const followUpNote = conditionMet(q, a)
          .map((fid) => getAnswer(fid))
          .map((fa) => (typeof fa?.value === 'string' ? fa.value.trim() : ''))
          .find((v) => v.length > 0);
        out.push({
          id: newCorrectiveActionId(),
          sourceInstanceId: instance.id,
          sourceQuestionId: q.id,
          templateName: template.name,
          site: instance.site,
          questionText: q.name,
          issueSummary:
            followUpNote ??
            `Reading of ${a?.value}${getUnit(q.responseType)} outside the allowed range.`,
          raisedBy: 'Ed Mehta',
          raisedDate: now.toISOString().slice(0, 10),
          raisedAtLabel: `${time} · ${date}`,
          assigneeType: 'outlet_manager',
          assigneeName: assigneeNameFor(instance.site, 'outlet_manager'),
          requirePhotoEvidence: false,
          status: 'open',
          severity: q.severity ?? 'medium',
          pointsLost: pointsFor(template, q),
        });
      }
    }
    return out;
  }

  function handleSubmit() {
    if (!allMandatoryAnswered) {
      setShowRequired(true);
      // Scroll to first incomplete mandatory
      const first = mandatoryQuestions.find((q) => !questionDone(q));
      if (first) {
        cardRefs.current.get(first.id)?.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
      return;
    }
    const actions = buildCorrectiveActions();
    if (actions.length > 0) addCorrectiveActions(actions);
    // Audits lock in their result at submit.
    const result = isAudit && template ? computeScore(template, answers) : null;
    if (instance) {
      // Record the completion so it moves to "Completed today" and the
      // record (with any linked corrective actions) is viewable in history.
      completeStoreInstance(instance.id, answers, 'Ed Mehta', result ?? undefined);
    }
    setCreatedActions(actions);
    setFinalScore(result);
    setSubmitted(true);
    // Audits and action-raising checklists keep the summary on screen
    // (score + assignment story); plain clean runs auto-return as before.
    if (actions.length === 0 && !isAudit) {
      setTimeout(() => router.push('/checklists/complete'), 2000);
    }
  }

  if (submitted) {
    const auditFailed = finalScore ? !finalScore.passed : false;
    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '70vh',
        padding: '24px',
        textAlign: 'center',
        gap: '16px',
      }}>
        <motion.div
          initial={{ scale: 0.6, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 260, damping: 20 }}
          style={{
            width: '72px',
            height: '72px',
            borderRadius: '50%',
            background: auditFailed ? '#FDE8E8' : '#E3F2E8',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {auditFailed
            ? <AlertTriangle size={36} color="#B91C1C" />
            : <CheckSquare size={36} color="#166534" />}
        </motion.div>
        <div>
          <p style={{ margin: '0 0 4px', fontSize: '18px', fontWeight: 800, color: 'var(--color-text-primary)' }}>
            {finalScore ? `${template.name} submitted` : `${template.name} complete`}
          </p>
          <p style={{ margin: 0, fontSize: '13px', color: 'var(--color-text-secondary)' }}>
            {finalScore ? 'Result locked' : 'Saved'} · {new Date().toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit' })}
          </p>
        </div>

        {/* Audit result */}
        {finalScore && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15, duration: 0.3, ease: 'easeOut' }}
            style={{
              width: '100%',
              maxWidth: '480px',
              textAlign: 'left',
              padding: '16px',
              borderRadius: '12px',
              border: auditFailed ? '1px solid #F5B5B5' : '1px solid #C9DFCE',
              background: auditFailed ? '#FEF5F5' : '#F2F9F4',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
              <div>
                <div style={{ fontSize: '28px', fontWeight: 800, color: 'var(--color-text-primary)', lineHeight: 1 }}>
                  {finalScore.pct}%
                </div>
                <div style={{ fontSize: '12px', fontWeight: 500, color: 'var(--color-text-secondary)', marginTop: '4px' }}>
                  {finalScore.pointsAwarded} / {finalScore.pointsTotal} points · pass mark {finalScore.passThresholdPct}%
                </div>
              </div>
              <span style={{
                padding: '5px 14px',
                borderRadius: '100px',
                fontSize: '13px',
                fontWeight: 800,
                background: auditFailed ? '#FDE8E8' : '#E3F2E8',
                color: auditFailed ? '#B91C1C' : '#166534',
              }}>
                {auditFailed ? 'Failed' : 'Passed'}
              </span>
            </div>

            {finalScore.criticalFails > 0 && (
              <div style={{
                padding: '10px 12px',
                borderRadius: '9px',
                background: '#FDE8E8',
                border: '1px solid #F5B5B5',
                fontSize: '13px',
                fontWeight: 700,
                color: '#B91C1C',
                display: 'flex',
                alignItems: 'center',
                gap: '7px',
              }}>
                <AlertTriangle size={14} />
                Failed: {finalScore.criticalFails} critical issue{finalScore.criticalFails === 1 ? '' : 's'} — overrides the score
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
              {finalScore.sectionScores.map((s) => (
                <div key={s.sectionId} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '12px' }}>
                  <span style={{ fontWeight: 600, color: 'var(--color-text-primary)' }}>{s.name}</span>
                  <span style={{ fontWeight: 500, color: 'var(--color-text-secondary)' }}>
                    {s.awarded} / {s.total}
                  </span>
                </div>
              ))}
            </div>
          </motion.div>
        )}

        {createdActions.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25, duration: 0.3, ease: 'easeOut' }}
            style={{
              width: '100%',
              maxWidth: '480px',
              textAlign: 'left',
              padding: '16px',
              borderRadius: '12px',
              border: '1px solid var(--color-border-subtle)',
              background: 'var(--color-bg-surface)',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
              <AlertTriangle size={15} color="#B01038" />
              <span style={{ fontSize: '13px', fontWeight: 800, color: 'var(--color-text-primary)' }}>
                {createdActions.length} corrective action{createdActions.length === 1 ? '' : 's'} assigned
              </span>
            </div>

            {createdActions.map((ca) => (
              <div
                key={ca.id}
                style={{
                  padding: '10px 12px',
                  borderRadius: '9px',
                  border: '1px solid var(--color-border-subtle)',
                  background: '#fff',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '4px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-text-primary)', lineHeight: 1.4 }}>
                    {ca.questionText}
                  </span>
                  {ca.severity && (
                    <span style={{
                      padding: '2px 8px',
                      borderRadius: '100px',
                      fontSize: '11px',
                      fontWeight: 700,
                      flexShrink: 0,
                      background: SEVERITY_COLORS[ca.severity].bg,
                      color: SEVERITY_COLORS[ca.severity].text,
                    }}>
                      {severityLabel(ca.severity)}
                    </span>
                  )}
                </div>
                <span style={{ fontSize: '12px', fontWeight: 500, color: 'var(--color-text-secondary)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <UserCheck size={12} />
                  {ca.assigneeName}
                  {ca.assigneeType === 'outlet_manager' ? ` · Outlet manager, ${ca.site}` : ''}
                </span>
              </div>
            ))}

            {/* Severity-routed alerts (audits) */}
            {finalScore && (
              <div style={{
                padding: '10px 12px',
                borderRadius: '9px',
                border: '1px solid var(--color-border-subtle)',
                background: '#fff',
                display: 'flex',
                flexDirection: 'column',
                gap: '6px',
              }}>
                <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--color-text-primary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  Alerts sent
                </span>
                {(['critical', 'medium', 'low'] as Severity[])
                  .filter((sev) => createdActions.some((a) => a.severity === sev))
                  .map((sev) => {
                    const recipients = resolveRecipients(alertRouting, sev, instance.site);
                    return (
                      <div key={sev} style={{ display: 'flex', alignItems: 'flex-start', gap: '6px', fontSize: '12px' }}>
                        <span style={{
                          padding: '1px 8px',
                          borderRadius: '100px',
                          fontWeight: 700,
                          fontSize: '11px',
                          flexShrink: 0,
                          background: SEVERITY_COLORS[sev].bg,
                          color: SEVERITY_COLORS[sev].text,
                        }}>
                          {severityLabel(sev)}
                        </span>
                        <span style={{ color: 'var(--color-text-secondary)', fontWeight: 500, lineHeight: 1.5 }}>
                          {recipients.length > 0
                            ? `Email to ${recipients.join(', ')}`
                            : 'No email — appears in the actions list only'}
                        </span>
                      </div>
                    );
                  })}
              </div>
            )}

            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '6px' }}>
              <Bell size={13} color="var(--color-text-muted)" style={{ flexShrink: 0, marginTop: '2px' }} />
              <span style={{ fontSize: '12px', color: 'var(--color-text-muted)', lineHeight: 1.5 }}>
                Only the assigned people at {instance.site} were notified. Other stores can&rsquo;t
                see this checklist or its corrective actions.
              </span>
            </div>

            <button
              type="button"
              onClick={() => router.push('/checklists/complete')}
              style={{
                padding: '12px',
                borderRadius: '10px',
                border: 'none',
                background: 'var(--color-accent-active)',
                fontSize: '14px',
                fontWeight: 700,
                color: '#F4F1EC',
                cursor: 'pointer',
                fontFamily: 'var(--font-primary)',
              }}
            >
              Done
            </button>
          </motion.div>
        )}

        {finalScore && createdActions.length === 0 && (
          <button
            type="button"
            onClick={() => router.push('/checklists/complete')}
            style={{
              width: '100%',
              maxWidth: '480px',
              padding: '12px',
              borderRadius: '10px',
              border: 'none',
              background: 'var(--color-accent-active)',
              fontSize: '14px',
              fontWeight: 700,
              color: '#F4F1EC',
              cursor: 'pointer',
              fontFamily: 'var(--font-primary)',
            }}
          >
            Done
          </button>
        )}
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100%', background: '#fff', paddingBottom: '100px' }}>
      {/* Sticky flow toolbar — title + answered count, task nav row and
          progress bar, matching web-v2's FlowToolbar. */}
      <div style={{
        position: 'sticky',
        top: 0,
        zIndex: 50,
        background: '#fff',
        borderBottom: '1px solid var(--color-border-subtle)',
        padding: '12px 16px',
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
          <h1 style={{
            margin: 0,
            flex: 1,
            minWidth: 0,
            fontSize: '16px',
            fontWeight: 600,
            lineHeight: 1.2,
            color: 'var(--color-text-primary)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}>
            {template.name}
          </h1>
          <span style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
            {liveScore && (
              <span style={{
                padding: '2px 10px',
                borderRadius: '100px',
                fontSize: '12px',
                fontWeight: 700,
                background: liveScore.criticalFails > 0
                  ? '#FDE8E8'
                  : liveScore.pct >= liveScore.passThresholdPct
                  ? '#E3F2E8'
                  : '#FEF6DA',
                color: liveScore.criticalFails > 0
                  ? '#B91C1C'
                  : liveScore.pct >= liveScore.passThresholdPct
                  ? '#166534'
                  : '#B45309',
              }}>
                {liveScore.pointsAwarded} / {liveScore.pointsTotal} · {liveScore.pct}%
              </span>
            )}
            <span style={{ fontSize: '13px', fontWeight: 400, color: 'var(--color-text-secondary)', whiteSpace: 'nowrap' }}>
              {answeredCount} of {totalCount} answered
            </span>
          </span>
        </div>

        {/* Task navigation: chevrons + jumper dropdown */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', position: 'relative' }}>
          <NavButton
            ariaLabel="Previous task"
            disabled={activeIndex <= 0}
            onClick={() => jumpToIndex(activeIndex - 1, rootIds)}
          >
            <ChevronLeft size={16} />
          </NavButton>
          <button
            type="button"
            onClick={() => setJumperOpen((o) => !o)}
            aria-expanded={jumperOpen}
            aria-haspopup="true"
            style={{
              flex: 1,
              minWidth: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '8px',
              padding: '7px 12px',
              borderRadius: '8px',
              border: '1px solid var(--color-border)',
              background: '#fff',
              fontSize: '14px',
              fontWeight: 600,
              color: 'var(--color-text-primary)',
              cursor: 'pointer',
              fontFamily: 'var(--font-primary)',
            }}
          >
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              Task {Math.min(activeIndex, totalCount - 1) + 1} of {totalCount}
            </span>
            <ChevronDown size={14} color="var(--color-text-muted)" style={{ flexShrink: 0 }} />
          </button>
          <NavButton
            ariaLabel="Next task"
            disabled={activeIndex >= totalCount - 1}
            onClick={() => jumpToIndex(activeIndex + 1, rootIds)}
          >
            <ChevronRight size={16} />
          </NavButton>

          {jumperOpen && (
            <>
              <div
                onClick={() => setJumperOpen(false)}
                style={{ position: 'fixed', inset: 0, zIndex: 60 }}
              />
              <div style={{
                position: 'absolute',
                top: 'calc(100% + 6px)',
                left: '44px',
                right: '44px',
                zIndex: 70,
                background: '#fff',
                border: '1px solid var(--color-border)',
                borderRadius: '10px',
                boxShadow: '0 8px 24px rgba(0, 28, 53, 0.12)',
                maxHeight: '60vh',
                overflowY: 'auto',
                padding: '4px 0',
              }}>
                {orderedRoots.map((q, idx) => {
                  const done = isQuestionAnswered(q, getAnswer(q.id));
                  const current = idx === activeIndex;
                  return (
                    <button
                      key={q.id}
                      type="button"
                      onClick={() => jumpToIndex(idx, rootIds)}
                      style={{
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: '8px',
                        width: '100%',
                        textAlign: 'left',
                        padding: '8px 12px',
                        border: 'none',
                        background: current ? 'var(--color-bg-hover)' : 'transparent',
                        cursor: 'pointer',
                        fontFamily: 'var(--font-primary)',
                      }}
                    >
                      <span style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        width: '20px',
                        height: '20px',
                        borderRadius: '50%',
                        flexShrink: 0,
                        marginTop: '1px',
                        fontSize: '11px',
                        fontWeight: 700,
                        background: done ? '#15803D' : current ? 'var(--color-accent-active)' : '#fff',
                        color: done || current ? '#fff' : 'var(--color-text-secondary)',
                        border: done || current ? 'none' : '1px solid var(--color-border)',
                      }}>
                        {done ? <Check size={12} strokeWidth={3} /> : idx + 1}
                      </span>
                      <span style={{ minWidth: 0, flex: 1 }}>
                        <span style={{
                          display: 'block',
                          fontSize: '13px',
                          fontWeight: 500,
                          color: 'var(--color-text-primary)',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}>
                          {q.name}
                        </span>
                        <span style={{ display: 'block', fontSize: '11px', color: 'var(--color-text-muted)' }}>
                          {q.mandatory ? 'required' : 'optional'}
                          {done ? ' · answered' : ''}
                        </span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </>
          )}
        </div>

        <div style={{ height: '6px', borderRadius: '100px', background: 'var(--color-bg-hover)', overflow: 'hidden' }}>
          <motion.div
            style={{ height: '100%', borderRadius: '100px', background: 'var(--color-accent-active)' }}
            animate={{ width: `${progressPct}%` }}
            transition={{ duration: 0.3, ease: 'easeOut' }}
          />
        </div>
      </div>

      {/* Questions */}
      <div style={{ maxWidth: '560px', margin: '0 auto', padding: '16px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {questionGroups.map((group) => (
            <div key={group.section?.id ?? 'all'} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {group.section && (
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '8px',
                  marginTop: '8px',
                  paddingBottom: '6px',
                  borderBottom: '1px solid var(--color-border-subtle)',
                }}>
                  <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--color-text-primary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    {group.section.name}
                  </span>
                  {liveScore && (() => {
                    const sub = liveScore.sectionScores.find((s) => s.sectionId === group.section!.id);
                    return sub ? (
                      <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--color-text-secondary)' }}>
                        {sub.awarded} / {sub.total}
                      </span>
                    ) : null;
                  })()}
                </div>
              )}
              {group.questions.map((q) => {
            const i = rootIds.indexOf(q.id);
            const followUpIds = conditionMet(q, getAnswer(q.id));
            const followUpQuestions = followUpIds
              .map((fid) => template.questions.find((fq) => fq.id === fid))
              .filter(Boolean) as typeof rootQuestions;

            return (
              <div key={q.id} data-q-index={i} style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <QuestionCard
                  question={q}
                  answer={getAnswer(q.id)}
                  isFollowUp={false}
                  questionNumber={i + 1}
                  site={instance.site}
                  isAudit={isAudit}
                  weights={severityWeightsOf(template)}
                  onAnswer={(qid, val) => handleAnswerWithScroll(qid, val, rootIds)}
                  onNoteChange={handleNoteChange}
                  onConfirm={(qid) => scrollToNext(qid, rootIds)}
                  onPhotoChange={handlePhotoChange}
                  onCorrectiveChange={handleCorrectiveChange}
                  onRowsChange={handleRowsChange}
                  showRequired={showRequired}
                  cardRef={getCardRef(q.id)}
                />

                <AnimatePresence>
                  {followUpQuestions.map((fq) => (
                    <motion.div
                      key={fq.id}
                      initial={{ opacity: 0, y: -8, scale: 0.98 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: -8, scale: 0.98 }}
                      transition={{ duration: 0.22, ease: 'easeOut' }}
                    >
                      <QuestionCard
                        question={fq}
                        answer={getAnswer(fq.id)}
                        isFollowUp={true}
                        questionNumber={0}
                        site={instance.site}
                        isAudit={isAudit}
                        weights={severityWeightsOf(template)}
                        onAnswer={handleAnswer}
                        onNoteChange={handleNoteChange}
                        onConfirm={() => scrollToNext(q.id, rootIds)}
                        onPhotoChange={handlePhotoChange}
                        onCorrectiveChange={handleCorrectiveChange}
                        onRowsChange={handleRowsChange}
                        showRequired={showRequired}
                        cardRef={getCardRef(fq.id)}
                      />
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            );
          })}
            </div>
          ))}
        </div>
      </div>

      {/* Fixed bottom action bar — "what's left" hint, then Save progress
          (navy outline) beside Submit, matching web-v2's FlowBottomBar. */}
      <div style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        padding: '12px 16px calc(12px + env(safe-area-inset-bottom))',
        background: 'rgba(255, 255, 255, 0.92)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        borderTop: '1px solid var(--color-border-subtle)',
        zIndex: 100,
      }}>
        <div style={{ maxWidth: '560px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {!allMandatoryAnswered && missingMandatoryCount > 0 && (
            <p
              aria-live="polite"
              style={{
                margin: 0,
                textAlign: 'center',
                fontSize: '12px',
                fontWeight: 600,
                color: showRequired ? '#B01038' : 'var(--color-text-secondary)',
              }}
            >
              {missingMandatoryCount === 1
                ? '1 question left to complete before you can submit'
                : `${missingMandatoryCount} questions left to complete before you can submit`}
            </p>
          )}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px' }}>
            <button
              type="button"
              onClick={() => router.push('/checklists/complete')}
              style={{
                flex: 1,
                height: '48px',
                borderRadius: '10px',
                border: '2px solid var(--color-accent-active)',
                background: 'transparent',
                fontSize: '14px',
                fontWeight: 700,
                color: 'var(--color-accent-active)',
                cursor: 'pointer',
                fontFamily: 'var(--font-primary)',
                transition: 'background 0.15s ease',
              }}
            >
              Save progress
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              style={{
                flex: 1,
                height: '48px',
                borderRadius: '10px',
                border: 'none',
                background: 'var(--color-accent-active)',
                opacity: allMandatoryAnswered ? 1 : 0.5,
                fontSize: '14px',
                fontWeight: 700,
                color: '#F4F1EC',
                cursor: 'pointer',
                fontFamily: 'var(--font-primary)',
                transition: 'opacity 0.3s ease',
                letterSpacing: '0.01em',
              }}
            >
              {isAudit ? 'Submit audit' : 'Submit checklist'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
