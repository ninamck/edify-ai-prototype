'use client';

import Link from 'next/link';
import { useState, type ReactNode } from 'react';
import * as ui from '../supportCentreUi';
import { money, signedMoney, type CashRules, type Tender } from '../cashFixtures';
import {
  TOLERANCE_LABEL,
  TOLERANCE_PILL,
  newId,
  timeOf,
  toleranceOf,
  type Correction,
} from '../cashStore';
import { whenLabel } from '../countStore';

export function NoShop() {
  return (
    <div style={ui.page}>
      <div style={ui.card}>
        <h1 style={ui.h1}>Choose a shop</h1>
        <p style={ui.lede}>
          Cash is recorded per shop. For all shops, go to the{' '}
          <Link href="/support-centre/cash" style={{ color: 'var(--color-accent-active)', fontWeight: 700 }}>
            Support Centre cash overview
          </Link>
          .
        </p>
      </div>
    </div>
  );
}

/** Shown on pages the current demo set-up doesn't have. */
export function OperatorOnly({ setUp = 'Pub' }: { setUp?: string }) {
  return (
    <div style={ui.page}>
      <div style={ui.card}>
        <h1 style={ui.h1}>Not available in this set-up</h1>
        <p style={ui.lede}>
          Set Cash features to {setUp} in demo controls on the home page.
        </p>
        <Link href="/cash/today" style={{ color: 'var(--color-accent-active)', fontWeight: 700 }}>Back to cash today</Link>
      </div>
    </div>
  );
}

const TONE: Record<string, { bg: string; fg: string; border: string }> = {
  good: { bg: 'var(--color-success-light)', fg: 'var(--color-success)', border: 'var(--color-success-border)' },
  warn: { bg: 'var(--color-warning-light)', fg: 'var(--color-warning)', border: 'var(--color-warning-border)' },
  bad: { bg: 'var(--color-error-light)', fg: 'var(--color-error)', border: 'var(--color-error-border)' },
  neutral: { bg: '#ffffff', fg: 'var(--color-text-primary)', border: 'var(--color-border-subtle)' },
};

export function Notice({ tone = 'neutral', children }: { tone?: keyof typeof TONE; children: ReactNode }) {
  const t = TONE[tone];
  return (
    <div
      role="status"
      style={{
        padding: '10px 14px', borderRadius: 10, border: `1px solid ${t.border}`, background: t.bg, color: t.fg,
        fontSize: 13, lineHeight: 1.5,
      }}
    >
      {children}
    </div>
  );
}

/** A headline figure. Any tone but neutral fills the card. */
export function Stat({ label, value, sub, tone = 'neutral' }: { label: string; value: ReactNode; sub?: ReactNode; tone?: keyof typeof TONE }) {
  const t = TONE[tone];
  return (
    <div
      style={{
        ...ui.card, gap: 4, flex: '1 1 200px', minWidth: 0,
        ...(tone === 'neutral' ? {} : { background: t.bg, border: `1px solid ${t.border}` }),
      }}
    >
      <span style={ui.fieldLabel}>{label}</span>
      <span style={{ fontSize: 20, fontWeight: 700, color: tone === 'neutral' ? 'var(--color-text-primary)' : t.fg, fontVariantNumeric: 'tabular-nums' }}>{value}</span>
      {sub && <span style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>{sub}</span>}
    </div>
  );
}

/** Variance amount; a pill with a word only when it needs attention, so it never relies on colour alone. */
export function VarianceText({ variance, rules, provisional, tender = 'GBP' }: { variance: number; rules: CashRules; provisional?: boolean; tender?: Tender }) {
  if (provisional) {
    return <span style={{ color: 'var(--color-text-secondary)', fontVariantNumeric: 'tabular-nums' }}>{signedMoney(variance, tender)} provisional</span>;
  }
  const tol = toleranceOf(variance, rules);
  if (tol === 'ok') return <span style={{ fontVariantNumeric: 'tabular-nums' }}>{signedMoney(variance, tender)}</span>;
  return (
    <span style={{ ...ui.pill(TOLERANCE_PILL[tol]), fontVariantNumeric: 'tabular-nums' }}>
      {signedMoney(variance, tender)} {TOLERANCE_LABEL[tol]}
    </span>
  );
}

export function PersonSelect({
  label, value, onChange, people, allowNone, id,
}: { label: string; value: string; onChange: (v: string) => void; people: string[]; allowNone?: boolean; id: string }) {
  return (
    <label style={ui.field} htmlFor={id}>
      <span style={ui.fieldLabel}>{label}</span>
      <select id={id} style={ui.input} value={value} onChange={e => onChange(e.target.value)}>
        {allowNone && <option value="">Choose a person</option>}
        {people.map(p => (
          <option key={p} value={p}>{p}</option>
        ))}
      </select>
    </label>
  );
}

/**
 * Change a saved value without losing it. Keeps the original, the new value,
 * who, when, why and (for money) who approved it.
 */
export function CorrectionControl({
  recordId, field, label, current, kind, people, me, onSave, buttonText = 'Correct',
}: {
  recordId: string;
  field: string;
  label: string;
  current: string | number;
  kind: 'money' | 'text';
  people: string[];
  me: string;
  onSave: (c: Correction) => void;
  /** Visible button text when a row has more than one thing to correct. */
  buttonText?: string;
}) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState(String(current));
  const [reason, setReason] = useState('');
  const [approver, setApprover] = useState('');
  const needsApproval = kind === 'money';
  const approvers = people.filter(p => p !== me);
  const changed = value.trim() !== '' && value.trim() !== String(current);
  const ok = changed && reason.trim().length > 3 && (!needsApproval || !!approver);

  if (!open) {
    return (
      <button type="button" style={ui.ghostBtn} onClick={() => setOpen(true)} aria-label={`Correct ${label.toLowerCase()}`}>
        {buttonText}
      </button>
    );
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: 10, border: '1px solid var(--color-border)', borderRadius: 10, background: 'var(--color-bg-surface)', minWidth: 260 }}>
      <span style={ui.fieldLabel}>Correct {label.toLowerCase()}. The original is kept.</span>
      <label style={ui.field}>
        <span style={ui.fieldLabel}>New value</span>
        <input
          style={ui.input}
          inputMode={kind === 'money' ? 'decimal' : 'text'}
          value={value}
          onChange={e => setValue(e.target.value)}
        />
      </label>
      <label style={ui.field}>
        <span style={ui.fieldLabel}>Reason</span>
        <input style={ui.input} value={reason} onChange={e => setReason(e.target.value)} placeholder="What went wrong" />
      </label>
      {needsApproval && (
        <PersonSelect id={`approve-${recordId}-${field}`} label="Approved by" value={approver} onChange={setApprover} people={approvers} allowNone />
      )}
      <div style={{ display: 'flex', gap: 8 }}>
        <button
          type="button"
          style={{ ...ui.primaryBtn, opacity: ok ? 1 : 0.5, cursor: ok ? 'pointer' : 'not-allowed' }}
          disabled={!ok}
          onClick={() => {
            onSave({
              id: newId('corr'), recordId, field, label,
              from: current, to: kind === 'money' ? Number(value) : value.trim(),
              reason: reason.trim(), by: me, when: new Date().toISOString(),
              approvedBy: needsApproval ? approver : undefined,
            });
            setOpen(false);
            setReason('');
            setApprover('');
          }}
        >
          Save correction
        </button>
        <button type="button" style={ui.ghostBtn} onClick={() => setOpen(false)}>Cancel</button>
      </div>
    </div>
  );
}

export function CorrectionTrail({ recordId, corrections }: { recordId: string; corrections: Correction[] }) {
  const mine = corrections.filter(c => c.recordId === recordId);
  if (!mine.length) return null;
  const show = (c: Correction, v: string | number) => (typeof v === 'number' ? money(v) : v || 'blank');
  return (
    <ul style={{ ...ui.list, gap: 4 }} aria-label="Corrections">
      {mine.map(c => (
        <li key={c.id} style={{ fontSize: 12, color: 'var(--color-text-secondary)', lineHeight: 1.5 }}>
          <strong style={{ color: 'var(--color-text-primary)' }}>{c.label} corrected</strong>{' '}
          from <s>{show(c, c.from)}</s> to {show(c, c.to)} by {c.by}, {whenLabel(c.when)}.
          {c.approvedBy ? ` Approved by ${c.approvedBy}.` : ''} Reason: {c.reason}
        </li>
      ))}
    </ul>
  );
}

export function Corrected({ show, isCorrected }: { show: ReactNode; isCorrected: boolean }) {
  return (
    <span>
      {show}
      {isCorrected && <span style={{ ...ui.pill('neutral'), marginLeft: 6, fontSize: 11 }}>Corrected</span>}
    </span>
  );
}

export function downloadCsv(filename: string, rows: (string | number)[][]) {
  const esc = (v: string | number) => {
    const s = String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const blob = new Blob([rows.map(r => r.map(esc).join(',')).join('\n')], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export { timeOf };
