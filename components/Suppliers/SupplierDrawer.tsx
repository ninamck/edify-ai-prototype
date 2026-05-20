'use client';

/**
 * Right-anchored supplier editor. Inline-editable fields with the same
 * progressive-disclosure pattern as the product editor page. Suppliers
 * have a much smaller field set (~6 fields) so a drawer is still the right
 * fit \u2014 only the product editor was promoted to a full page.
 */

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'framer-motion';
import { X, Check, Trash2, ChevronDown, ChevronRight } from 'lucide-react';
import EdifyMark from '@/components/EdifyMark/EdifyMark';
import {
  ALL_CATEGORIES, ALL_SITES,
  type Supplier, type ProductCategory, type SupplierStatus, type DayOfWeek,
} from './fixtures';
import { upsertSupplier, deleteSupplier } from './store';
import { StatusPill } from './Primitives';

const ALL_DAYS: DayOfWeek[] = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export default function SupplierDrawer({
  supplier,
  onClose,
  onAskQuinn,
}: {
  supplier: Supplier;
  onClose: () => void;
  onAskQuinn?: () => void;
}) {
  const [draft, setDraft] = useState<Supplier>(supplier);
  const [openSchedule, setOpenSchedule] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { setDraft(supplier); }, [supplier.id]);

  if (!mounted) return null;

  const dirty = JSON.stringify(draft) !== JSON.stringify(supplier);

  function update<K extends keyof Supplier>(key: K, value: Supplier[K]) {
    setDraft((d) => ({ ...d, [key]: value }));
  }

  function save() {
    if (!dirty) { onClose(); return; }
    upsertSupplier(draft);
    setSavedAt(Date.now());
    setTimeout(onClose, 600);
  }

  function archive() {
    if (!confirm('Archive this supplier? Their products stay in the catalogue but become unavailable.')) return;
    deleteSupplier(draft.id);
    onClose();
  }

  return createPortal(
    <>
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        transition={{ duration: 0.15 }}
        onClick={onClose}
        style={{ position: 'fixed', inset: 0, background: 'rgba(58,48,40,0.18)', zIndex: 700 }}
      />
      <motion.aside
        initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
        transition={{ duration: 0.22, ease: [0.25, 0.1, 0.25, 1] }}
        role="dialog"
        aria-label={`${supplier.name} editor`}
        style={{
          position: 'fixed', top: 0, right: 0, bottom: 0,
          width: 'min(540px, 100vw)',
          background: '#fff',
          boxShadow: '-20px 0 60px rgba(58,48,40,0.16)',
          zIndex: 701,
          display: 'flex', flexDirection: 'column',
          fontFamily: 'var(--font-primary)',
        }}
      >
        <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--color-border-subtle)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <button onClick={onClose} aria-label="Close" style={iconBtnStyle}>
              <X size={16} />
            </button>
            <div style={{ flex: 1, minWidth: 0 }}>
              <input
                value={draft.name}
                onChange={(e) => update('name', e.target.value)}
                style={{
                  width: '100%',
                  border: 'none', outline: 'none',
                  fontSize: 17, fontWeight: 700,
                  color: 'var(--color-text-primary)',
                  fontFamily: 'var(--font-primary)',
                  padding: 0, background: 'transparent',
                }}
              />
              <div style={{ fontSize: 12, color: 'var(--color-text-muted)', marginTop: 2 }}>
                {draft.shortCode ? `Short code: ${draft.shortCode}` : 'No short code'} \u00b7 {draft.email ?? 'No email'}
              </div>
            </div>
            <StatusPill status={draft.status} />
          </div>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 18 }}>
          <Section label="Basics">
            <Field label="Short code"><TextInput value={draft.shortCode ?? ''} onChange={(v) => update('shortCode', v)} /></Field>
            <Field label="Email"><TextInput value={draft.email ?? ''} onChange={(v) => update('email', v)} /></Field>
            <Field label="Phone"><TextInput value={draft.phone ?? ''} onChange={(v) => update('phone', v)} /></Field>
            <Field label="Status">
              <PillRadio
                options={[
                  { value: 'Available', label: 'Available' },
                  { value: 'Unavailable', label: 'Unavailable' },
                  { value: 'Pending', label: 'Pending' },
                ]}
                value={draft.status}
                onChange={(v) => update('status', v as SupplierStatus)}
              />
            </Field>
            <Field label={`Categories (${draft.categories.length})`}>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                {ALL_CATEGORIES.map((c) => {
                  const on = draft.categories.includes(c);
                  return (
                    <button
                      key={c}
                      onClick={() => update('categories', on
                        ? draft.categories.filter((x) => x !== c)
                        : [...draft.categories, c as ProductCategory]
                      )}
                      style={{
                        padding: '5px 11px',
                        borderRadius: 100,
                        border: on ? '1px solid var(--color-accent-active)' : '1px solid var(--color-border-subtle)',
                        background: on ? 'rgba(34,68,68,0.06)' : '#fff',
                        color: on ? 'var(--color-accent-active)' : 'var(--color-text-secondary)',
                        fontSize: 12, fontWeight: 600,
                        cursor: 'pointer',
                        fontFamily: 'var(--font-primary)',
                      }}
                    >
                      {c}
                    </button>
                  );
                })}
              </div>
            </Field>
            <Field label={`Sites (${draft.sites.length})`}>
              <SitesPicker value={draft.sites} onChange={(v) => update('sites', v)} />
            </Field>
          </Section>

          <Collapsible
            label="Order schedule"
            count={draft.cutOffTime ? `Cut-off ${draft.cutOffTime}` : 'Not set'}
            open={openSchedule}
            onToggle={() => setOpenSchedule((v) => !v)}
          >
            <Field label="Cut-off time"><TextInput value={draft.cutOffTime ?? ''} onChange={(v) => update('cutOffTime', v)} /></Field>
            <Field label="Lead time (days)">
              <NumberInput value={draft.leadTimeDays ?? 0} onChange={(v) => update('leadTimeDays', v)} />
            </Field>
            <Field label="Minimum order value (DH)">
              <NumberInput value={draft.minimumOrderValue ?? 0} onChange={(v) => update('minimumOrderValue', v)} />
            </Field>
            <Field label="Delivery days">
              <div style={{ display: 'flex', gap: 4 }}>
                {ALL_DAYS.map((d) => {
                  const on = draft.deliveryDays?.includes(d) ?? false;
                  return (
                    <button
                      key={d}
                      onClick={() => {
                        const next = on
                          ? (draft.deliveryDays ?? []).filter((x) => x !== d)
                          : [...(draft.deliveryDays ?? []), d];
                        update('deliveryDays', next);
                      }}
                      style={{
                        width: 36, height: 30, borderRadius: 8,
                        border: on ? '1px solid transparent' : '1px solid var(--color-border-subtle)',
                        background: on ? 'var(--color-accent-active)' : '#fff',
                        color: on ? '#fff' : 'var(--color-text-secondary)',
                        fontSize: 11.5, fontWeight: 700,
                        cursor: 'pointer',
                        fontFamily: 'var(--font-primary)',
                      }}
                    >
                      {d}
                    </button>
                  );
                })}
              </div>
            </Field>
          </Collapsible>
        </div>

        <div style={{
          borderTop: '1px solid var(--color-border-subtle)',
          padding: '12px 18px', display: 'flex', gap: 8, alignItems: 'center',
        }}>
          {onAskQuinn && (
            <button onClick={onAskQuinn} style={quinnBtnStyle}>
              <EdifyMark size={12} color="var(--color-accent-active)" strokeWidth={2.4} />
              Ask Edify
            </button>
          )}
          <button onClick={archive} style={dangerBtnStyle}>
            <Trash2 size={13} /> Archive
          </button>
          <div style={{ flex: 1 }} />
          {savedAt && (
            <span style={{ fontSize: 12, color: 'var(--color-success)', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              <Check size={13} /> Saved
            </span>
          )}
          <button onClick={onClose} style={secondaryBtnStyle}>Cancel</button>
          <button onClick={save} disabled={!dirty} style={{
            ...primaryBtnStyle,
            background: dirty ? 'var(--color-accent-active)' : 'var(--color-border)',
            cursor: dirty ? 'pointer' : 'not-allowed',
          }}>
            Save changes
          </button>
        </div>
      </motion.aside>
    </>,
    document.body,
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Sub-components — kept local so the file stays portable

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <section style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={sectionLabelStyle}>{label}</div>
      {children}
    </section>
  );
}

function Collapsible({
  label, count, open, onToggle, children,
}: {
  label: string; count?: string; open: boolean; onToggle: () => void; children: React.ReactNode;
}) {
  return (
    <section style={{ borderTop: '1px solid var(--color-border-subtle)', paddingTop: 12 }}>
      <button onClick={onToggle} style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        width: '100%', padding: '4px 0', border: 'none', background: 'transparent',
        cursor: 'pointer', fontFamily: 'var(--font-primary)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--color-text-primary)' }}>
          {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          <span style={{ fontSize: 12.5, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase' }}>{label}</span>
          {count && <span style={{ fontSize: 11.5, color: 'var(--color-text-muted)', textTransform: 'none', letterSpacing: 0, fontWeight: 500 }}>{count}</span>}
        </div>
      </button>
      {open && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 10 }}>
          {children}
        </div>
      )}
    </section>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div style={fieldLabelStyle}>{label}</div>
      {children}
    </div>
  );
}

function TextInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return <input value={value} onChange={(e) => onChange(e.target.value)} style={inputStyle} />;
}

function NumberInput({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return <input type="number" value={value} onChange={(e) => onChange(Number(e.target.value))} style={inputStyle} />;
}

function PillRadio({ value, onChange, options }: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
      {options.map((o) => {
        const on = value === o.value;
        return (
          <button
            key={o.value}
            onClick={() => onChange(o.value)}
            style={{
              padding: '5px 11px',
              borderRadius: 100,
              border: on ? '1px solid transparent' : '1px solid var(--color-border-subtle)',
              background: on ? 'var(--color-accent-active)' : '#fff',
              color: on ? '#fff' : 'var(--color-text-secondary)',
              fontSize: 12, fontWeight: 600,
              cursor: 'pointer',
              fontFamily: 'var(--font-primary)',
            }}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

function SitesPicker({ value, onChange }: { value: string[]; onChange: (v: string[]) => void }) {
  const has = (s: string) => value.includes(s);
  function toggle(s: string) {
    onChange(has(s) ? value.filter((x) => x !== s) : [...value, s]);
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ display: 'flex', gap: 6 }}>
        <button onClick={() => onChange([...ALL_SITES])} style={miniBtnStyle}>All</button>
        <button onClick={() => onChange([])} style={miniBtnStyle}>None</button>
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
        {ALL_SITES.map((s) => {
          const on = has(s);
          return (
            <button
              key={s}
              onClick={() => toggle(s)}
              style={{
                padding: '4px 10px',
                borderRadius: 100,
                border: on ? '1px solid var(--color-accent-active)' : '1px solid var(--color-border-subtle)',
                background: on ? 'rgba(34,68,68,0.06)' : '#fff',
                color: on ? 'var(--color-accent-active)' : 'var(--color-text-secondary)',
                fontSize: 11, fontWeight: 600,
                cursor: 'pointer',
                fontFamily: 'var(--font-primary)',
              }}
            >
              {s}
            </button>
          );
        })}
      </div>
    </div>
  );
}

const sectionLabelStyle: React.CSSProperties = {
  fontSize: 11, fontWeight: 700, letterSpacing: '0.08em',
  textTransform: 'uppercase', color: 'var(--color-text-muted)',
};
const fieldLabelStyle: React.CSSProperties = {
  fontSize: 11.5, fontWeight: 600, color: 'var(--color-text-secondary)',
  marginBottom: 4,
};
const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '8px 10px',
  borderRadius: 8,
  border: '1px solid var(--color-border)',
  background: '#fff',
  fontSize: 13, fontFamily: 'var(--font-primary)',
  color: 'var(--color-text-primary)',
  outline: 'none',
};
const iconBtnStyle: React.CSSProperties = {
  width: 28, height: 28, border: 'none', background: 'transparent',
  cursor: 'pointer', borderRadius: 6,
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
  color: 'var(--color-text-muted)',
};
const primaryBtnStyle: React.CSSProperties = {
  padding: '9px 16px', borderRadius: 10, border: 'none',
  color: '#fff', fontSize: 13, fontWeight: 700,
  fontFamily: 'var(--font-primary)',
};
const secondaryBtnStyle: React.CSSProperties = {
  padding: '9px 14px', borderRadius: 10,
  border: '1px solid var(--color-border)', background: '#fff',
  color: 'var(--color-text-primary)',
  fontSize: 13, fontWeight: 600,
  cursor: 'pointer', fontFamily: 'var(--font-primary)',
};
const dangerBtnStyle: React.CSSProperties = {
  padding: '9px 12px', borderRadius: 10,
  border: '1px solid var(--color-error-border)',
  background: '#fff',
  color: 'var(--color-error)',
  fontSize: 12, fontWeight: 600,
  cursor: 'pointer', fontFamily: 'var(--font-primary)',
  display: 'inline-flex', alignItems: 'center', gap: 5,
};
const quinnBtnStyle: React.CSSProperties = {
  padding: '9px 12px', borderRadius: 10,
  border: '1px solid var(--color-border-subtle)',
  background: '#fff',
  color: 'var(--color-accent-active)',
  fontSize: 12, fontWeight: 700,
  cursor: 'pointer', fontFamily: 'var(--font-primary)',
  display: 'inline-flex', alignItems: 'center', gap: 6,
};
const miniBtnStyle: React.CSSProperties = {
  padding: '4px 10px', borderRadius: 6,
  border: '1px solid var(--color-border-subtle)',
  background: '#fff',
  color: 'var(--color-text-secondary)',
  fontSize: 11, fontWeight: 600,
  cursor: 'pointer', fontFamily: 'var(--font-primary)',
};
