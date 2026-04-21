'use client';

import { useState } from 'react';
import {
  Rule,
  RuleScope,
  PriceVarianceRule,
  QtyVarianceRule,
  DiscountRule,
  VatOverrideRule,
  DiscountMode,
  INITIAL_RULES,
  KNOWN_SUPPLIERS,
  humanReadableRule,
  scopeLabel,
} from './mockData';

interface Props {
  onBack: () => void;
}

export default function RulesView({ onBack }: Props) {
  const [rules, setRules] = useState<Rule[]>(INITIAL_RULES);
  const [editing, setEditing] = useState<string | 'new-price' | 'new-qty' | 'new-discount' | 'new-vat' | null>(null);

  const priceRules = rules.filter((r): r is PriceVarianceRule => r.type === 'price-variance');
  const qtyRules = rules.filter((r): r is QtyVarianceRule => r.type === 'qty-variance');
  const discountRules = rules.filter((r): r is DiscountRule => r.type === 'discount-handling');
  const vatRules = rules.filter((r): r is VatOverrideRule => r.type === 'vat-override');

  const sortRules = <T extends Rule>(list: T[]): T[] => {
    const order: Record<RuleScope, number> = { global: 0, supplier: 1, invoice: 2 };
    return [...list].sort((a, b) => order[a.scope] - order[b.scope]);
  };

  const updateRule = (id: string, patch: Partial<Rule>) => {
    setRules(prev => prev.map(r => r.id === id ? ({ ...r, ...patch } as Rule) : r));
  };
  const deleteRule = (id: string) => {
    setRules(prev => prev.filter(r => r.id !== id));
    setEditing(null);
  };
  const addRule = (rule: Rule) => {
    setRules(prev => [...prev, rule]);
    setEditing(null);
  };

  return (
    <div style={{ fontFamily: 'var(--font-primary)' }}>
      <button
        onClick={onBack}
        style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '13px', fontWeight: 600, color: 'var(--color-accent-deep)', fontFamily: 'var(--font-primary)', marginBottom: '4px' }}
      >
        ← Back to Invoices
      </button>

      <h1 style={{ fontSize: '22px', fontWeight: 700, color: 'var(--color-text-primary)', margin: '0 0 8px' }}>
        Invoicing rules
      </h1>
      <p style={{ fontSize: '13px', color: 'var(--color-text-secondary)', margin: '0 0 20px' }}>
        Cut the click-load on small variances. Rules apply silently — any auto-resolved line is marked with ✨ on the match view.
      </p>

      {/* Precedence card */}
      <div style={{
        padding: '14px 18px',
        borderRadius: '12px',
        background: 'var(--color-info-light)',
        border: '1px solid rgba(3, 105, 161, 0.18)',
        marginBottom: '20px',
        display: 'flex',
        alignItems: 'flex-start',
        gap: '12px',
      }}>
        <span style={{ fontSize: '18px', lineHeight: 1 }}>🧭</span>
        <div style={{ fontSize: '13px', color: 'var(--color-text-primary)', lineHeight: 1.5 }}>
          <div style={{ fontWeight: 700, color: 'var(--color-info)' }}>Precedence</div>
          <div style={{ marginTop: '2px' }}>
            <strong>Invoice-level</strong> &gt; <strong>Supplier-level</strong> &gt; <strong>Global</strong>. When multiple rules match, the most specific wins.
          </div>
        </div>
      </div>

      <RuleSection
        title="Price variance tolerance"
        blurb="Auto-accept small invoice price changes without prompting."
        addLabel="+ Add price rule"
        onAdd={() => setEditing('new-price')}
      >
        {sortRules(priceRules).map(rule => (
          <RuleRow
            key={rule.id}
            rule={rule}
            isEditing={editing === rule.id}
            onStartEdit={() => setEditing(rule.id)}
            onCancelEdit={() => setEditing(null)}
            onUpdate={(patch) => { updateRule(rule.id, patch); setEditing(null); }}
            onToggle={() => updateRule(rule.id, { enabled: !rule.enabled })}
            onDelete={() => deleteRule(rule.id)}
          />
        ))}
        {priceRules.length === 0 && <EmptyState msg="No price rules yet." />}
        {editing === 'new-price' && (
          <EditPriceRule
            rule={null}
            onCancel={() => setEditing(null)}
            onSave={(partial) => addRule({
              id: `r-${Date.now()}`,
              type: 'price-variance',
              enabled: true,
              ...partial,
            } as PriceVarianceRule)}
          />
        )}
      </RuleSection>

      <RuleSection
        title="Quantity variance tolerance"
        blurb="Auto-accept small short-deliveries. Off by default — qty shorts usually need a credit note."
        addLabel="+ Add quantity rule"
        onAdd={() => setEditing('new-qty')}
      >
        {sortRules(qtyRules).map(rule => (
          <RuleRow
            key={rule.id}
            rule={rule}
            isEditing={editing === rule.id}
            onStartEdit={() => setEditing(rule.id)}
            onCancelEdit={() => setEditing(null)}
            onUpdate={(patch) => { updateRule(rule.id, patch); setEditing(null); }}
            onToggle={() => updateRule(rule.id, { enabled: !rule.enabled })}
            onDelete={() => deleteRule(rule.id)}
          />
        ))}
        {qtyRules.length === 0 && <EmptyState msg="No quantity rules yet." />}
        {editing === 'new-qty' && (
          <EditQtyRule
            rule={null}
            onCancel={() => setEditing(null)}
            onSave={(partial) => addRule({
              id: `r-${Date.now()}`,
              type: 'qty-variance',
              enabled: true,
              ...partial,
            } as QtyVarianceRule)}
          />
        )}
      </RuleSection>

      <RuleSection
        title="Discount handling"
        blurb="When a supplier invoices at a discount, default to updating the catalogue or treating as one-off."
        addLabel="+ Add discount default"
        onAdd={() => setEditing('new-discount')}
      >
        {sortRules(discountRules).map(rule => (
          <RuleRow
            key={rule.id}
            rule={rule}
            isEditing={editing === rule.id}
            onStartEdit={() => setEditing(rule.id)}
            onCancelEdit={() => setEditing(null)}
            onUpdate={(patch) => { updateRule(rule.id, patch); setEditing(null); }}
            onToggle={() => updateRule(rule.id, { enabled: !rule.enabled })}
            onDelete={() => deleteRule(rule.id)}
          />
        ))}
        {discountRules.length === 0 && <EmptyState msg="No discount defaults yet." />}
        {editing === 'new-discount' && (
          <EditDiscountRule
            rule={null}
            onCancel={() => setEditing(null)}
            onSave={(partial) => addRule({
              id: `r-${Date.now()}`,
              type: 'discount-handling',
              enabled: true,
              ...partial,
            } as DiscountRule)}
          />
        )}
      </RuleSection>

      <RuleSection
        title="VAT default overrides"
        blurb="Override SKU-based VAT defaults when a supplier's entire invoice uses a different rate."
        addLabel="+ Add VAT override"
        onAdd={() => setEditing('new-vat')}
      >
        {sortRules(vatRules).map(rule => (
          <RuleRow
            key={rule.id}
            rule={rule}
            isEditing={editing === rule.id}
            onStartEdit={() => setEditing(rule.id)}
            onCancelEdit={() => setEditing(null)}
            onUpdate={(patch) => { updateRule(rule.id, patch); setEditing(null); }}
            onToggle={() => updateRule(rule.id, { enabled: !rule.enabled })}
            onDelete={() => deleteRule(rule.id)}
          />
        ))}
        {vatRules.length === 0 && <EmptyState msg="No VAT overrides yet." />}
        {editing === 'new-vat' && (
          <EditVatRule
            rule={null}
            onCancel={() => setEditing(null)}
            onSave={(partial) => addRule({
              id: `r-${Date.now()}`,
              type: 'vat-override',
              enabled: true,
              ...partial,
            } as VatOverrideRule)}
          />
        )}
      </RuleSection>
    </div>
  );
}

function RuleSection({ title, blurb, addLabel, onAdd, children }: {
  title: string; blurb: string; addLabel: string; onAdd: () => void; children: React.ReactNode;
}) {
  return (
    <section style={{
      border: '1px solid var(--color-border-subtle)',
      borderRadius: '12px',
      padding: '18px',
      background: '#fff',
      marginBottom: '16px',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px', marginBottom: '12px', flexWrap: 'wrap' }}>
        <div>
          <h2 style={{ fontSize: '15px', fontWeight: 700, margin: 0, color: 'var(--color-text-primary)' }}>{title}</h2>
          <p style={{ fontSize: '12px', fontWeight: 500, color: 'var(--color-text-secondary)', margin: '4px 0 0' }}>{blurb}</p>
        </div>
        <button
          onClick={onAdd}
          style={{
            padding: '6px 14px', borderRadius: '6px',
            background: 'transparent', border: '1px solid var(--color-border)',
            fontSize: '12px', fontWeight: 600, fontFamily: 'var(--font-primary)',
            color: 'var(--color-text-primary)', cursor: 'pointer', whiteSpace: 'nowrap',
          }}
        >
          {addLabel}
        </button>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {children}
      </div>
    </section>
  );
}

function RuleRow({
  rule, isEditing, onStartEdit, onCancelEdit, onUpdate, onToggle, onDelete,
}: {
  rule: Rule;
  isEditing: boolean;
  onStartEdit: () => void;
  onCancelEdit: () => void;
  onUpdate: (patch: Partial<Rule>) => void;
  onToggle: () => void;
  onDelete: () => void;
}) {
  if (isEditing) {
    if (rule.type === 'price-variance') {
      return <EditPriceRule rule={rule} onCancel={onCancelEdit} onSave={patch => onUpdate(patch)} onDelete={onDelete} />;
    }
    if (rule.type === 'qty-variance') {
      return <EditQtyRule rule={rule} onCancel={onCancelEdit} onSave={patch => onUpdate(patch)} onDelete={onDelete} />;
    }
    if (rule.type === 'discount-handling') {
      return <EditDiscountRule rule={rule} onCancel={onCancelEdit} onSave={patch => onUpdate(patch)} onDelete={onDelete} />;
    }
    return <EditVatRule rule={rule} onCancel={onCancelEdit} onSave={patch => onUpdate(patch)} onDelete={onDelete} />;
  }

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        padding: '10px 12px',
        borderRadius: '8px',
        background: rule.enabled ? 'var(--color-bg-hover)' : '#fff',
        border: '1px solid var(--color-border-subtle)',
        opacity: rule.enabled ? 1 : 0.65,
      }}
    >
      <ScopeChip scope={rule.scope} value={rule.scopeValue} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-text-primary)' }}>
          {humanReadableRule(rule)}
        </div>
        {rule.note && (
          <div style={{ fontSize: '12px', color: 'var(--color-text-secondary)', fontWeight: 500, marginTop: '2px' }}>
            {rule.note}
          </div>
        )}
      </div>
      <button
        onClick={onToggle}
        aria-label={rule.enabled ? 'Disable rule' : 'Enable rule'}
        style={{
          padding: '4px 10px', borderRadius: '100px',
          background: rule.enabled ? 'var(--color-success-light)' : 'var(--color-bg-hover)',
          color: rule.enabled ? 'var(--color-success)' : 'var(--color-text-secondary)',
          border: `1px solid ${rule.enabled ? 'var(--color-success-border)' : 'var(--color-border)'}`,
          fontSize: '11px', fontWeight: 700, fontFamily: 'var(--font-primary)',
          cursor: 'pointer',
        }}
      >
        {rule.enabled ? 'ON' : 'OFF'}
      </button>
      <button
        onClick={onStartEdit}
        style={{
          padding: '4px 10px', borderRadius: '6px',
          background: 'transparent', border: '1px solid var(--color-border)',
          fontSize: '12px', fontWeight: 600, fontFamily: 'var(--font-primary)',
          color: 'var(--color-text-primary)', cursor: 'pointer',
        }}
      >
        Edit
      </button>
    </div>
  );
}

function ScopeChip({ scope, value }: { scope: RuleScope; value?: string }) {
  const styles: Record<RuleScope, { bg: string; color: string; border: string }> = {
    global: { bg: 'var(--color-bg-hover)', color: 'var(--color-text-secondary)', border: 'var(--color-border)' },
    supplier: { bg: 'rgba(3, 105, 161, 0.08)', color: 'var(--color-info)', border: 'rgba(3, 105, 161, 0.22)' },
    invoice: { bg: 'rgba(34, 68, 68, 0.1)', color: 'var(--color-accent-active)', border: 'rgba(34, 68, 68, 0.25)' },
  };
  const s = styles[scope];
  const label = scope === 'global' ? 'Global' : scope === 'supplier' ? value ?? 'Supplier' : value ?? 'Invoice';
  return (
    <span style={{
      padding: '3px 10px',
      borderRadius: '100px',
      background: s.bg,
      color: s.color,
      border: `1px solid ${s.border}`,
      fontSize: '11px',
      fontWeight: 700,
      whiteSpace: 'nowrap',
      flexShrink: 0,
    }}>
      {label}
    </span>
  );
}

function EmptyState({ msg }: { msg: string }) {
  return (
    <div style={{ padding: '14px', fontSize: '12px', color: 'var(--color-text-secondary)', textAlign: 'center' }}>
      {msg}
    </div>
  );
}

/* ──────────── Edit forms ──────────── */

function ScopePicker({ scope, scopeValue, onChange }: {
  scope: RuleScope; scopeValue?: string; onChange: (s: RuleScope, v?: string) => void;
}) {
  return (
    <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
      <select
        value={scope}
        onChange={e => onChange(e.target.value as RuleScope, scope === e.target.value ? scopeValue : undefined)}
        style={inputStyle}
      >
        <option value="global">Global</option>
        <option value="supplier">Supplier</option>
        <option value="invoice">Invoice</option>
      </select>
      {scope === 'supplier' && (
        <select
          value={scopeValue ?? ''}
          onChange={e => onChange(scope, e.target.value || undefined)}
          style={{ ...inputStyle, minWidth: '160px' }}
        >
          <option value="">— pick supplier —</option>
          {KNOWN_SUPPLIERS.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
      )}
      {scope === 'invoice' && (
        <input
          type="text"
          placeholder="Invoice # (e.g. INV-4421)"
          value={scopeValue ?? ''}
          onChange={e => onChange(scope, e.target.value || undefined)}
          style={{ ...inputStyle, minWidth: '180px' }}
        />
      )}
    </div>
  );
}

function EditPriceRule({ rule, onCancel, onSave, onDelete }: {
  rule: PriceVarianceRule | null;
  onCancel: () => void;
  onSave: (patch: Partial<PriceVarianceRule>) => void;
  onDelete?: () => void;
}) {
  const [scope, setScope] = useState<RuleScope>(rule?.scope ?? 'global');
  const [scopeValue, setScopeValue] = useState<string | undefined>(rule?.scopeValue);
  const [percent, setPercent] = useState<string>(rule?.percent?.toString() ?? '');
  const [amount, setAmount] = useState<string>(rule?.amount?.toString() ?? '');
  const [note, setNote] = useState<string>(rule?.note ?? '');

  const save = () => {
    const p = percent === '' ? undefined : parseFloat(percent);
    const a = amount === '' ? undefined : parseFloat(amount);
    onSave({ scope, scopeValue, percent: p, amount: a, note: note || undefined });
  };

  return (
    <EditShell label="Price rule" onCancel={onCancel} onSave={save} onDelete={onDelete}>
      <LabelledRow label="Scope">
        <ScopePicker scope={scope} scopeValue={scopeValue} onChange={(s, v) => { setScope(s); setScopeValue(v); }} />
      </LabelledRow>
      <LabelledRow label="Accept when">
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '12px' }}>&lt;</span>
          <input type="number" value={percent} onChange={e => setPercent(e.target.value)} placeholder="5" style={{ ...inputStyle, width: '64px' }} />
          <span style={{ fontSize: '12px' }}>%</span>
          <span style={{ fontSize: '12px', color: 'var(--color-text-secondary)' }}>OR</span>
          <span style={{ fontSize: '12px' }}>&lt; £</span>
          <input type="number" value={amount} onChange={e => setAmount(e.target.value)} placeholder="2.00" style={{ ...inputStyle, width: '80px' }} />
        </div>
      </LabelledRow>
      <LabelledRow label="Note">
        <input type="text" value={note} onChange={e => setNote(e.target.value)} placeholder="Optional reason" style={{ ...inputStyle, width: '100%' }} />
      </LabelledRow>
    </EditShell>
  );
}

function EditQtyRule({ rule, onCancel, onSave, onDelete }: {
  rule: QtyVarianceRule | null;
  onCancel: () => void;
  onSave: (patch: Partial<QtyVarianceRule>) => void;
  onDelete?: () => void;
}) {
  const [scope, setScope] = useState<RuleScope>(rule?.scope ?? 'global');
  const [scopeValue, setScopeValue] = useState<string | undefined>(rule?.scopeValue);
  const [units, setUnits] = useState<string>(rule?.units?.toString() ?? '');
  const [percent, setPercent] = useState<string>(rule?.percent?.toString() ?? '');
  const [note, setNote] = useState<string>(rule?.note ?? '');

  const save = () => {
    const u = units === '' ? undefined : parseFloat(units);
    const p = percent === '' ? undefined : parseFloat(percent);
    onSave({ scope, scopeValue, units: u, percent: p, note: note || undefined });
  };

  return (
    <EditShell label="Quantity rule" onCancel={onCancel} onSave={save} onDelete={onDelete}>
      <LabelledRow label="Scope">
        <ScopePicker scope={scope} scopeValue={scopeValue} onChange={(s, v) => { setScope(s); setScopeValue(v); }} />
      </LabelledRow>
      <LabelledRow label="Accept short by">
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '12px' }}>≤</span>
          <input type="number" value={units} onChange={e => setUnits(e.target.value)} placeholder="1" style={{ ...inputStyle, width: '64px' }} />
          <span style={{ fontSize: '12px' }}>units</span>
          <span style={{ fontSize: '12px', color: 'var(--color-text-secondary)' }}>OR</span>
          <span style={{ fontSize: '12px' }}>≤</span>
          <input type="number" value={percent} onChange={e => setPercent(e.target.value)} placeholder="5" style={{ ...inputStyle, width: '64px' }} />
          <span style={{ fontSize: '12px' }}>%</span>
        </div>
      </LabelledRow>
      <LabelledRow label="Note">
        <input type="text" value={note} onChange={e => setNote(e.target.value)} placeholder="Optional reason" style={{ ...inputStyle, width: '100%' }} />
      </LabelledRow>
    </EditShell>
  );
}

function EditDiscountRule({ rule, onCancel, onSave, onDelete }: {
  rule: DiscountRule | null;
  onCancel: () => void;
  onSave: (patch: Partial<DiscountRule>) => void;
  onDelete?: () => void;
}) {
  const [scope, setScope] = useState<RuleScope>(rule?.scope ?? 'supplier');
  const [scopeValue, setScopeValue] = useState<string | undefined>(rule?.scopeValue);
  const [mode, setMode] = useState<DiscountMode>(rule?.mode ?? 'prompt');

  const save = () => onSave({ scope, scopeValue, mode });

  return (
    <EditShell label="Discount default" onCancel={onCancel} onSave={save} onDelete={onDelete}>
      <LabelledRow label="Scope">
        <ScopePicker scope={scope} scopeValue={scopeValue} onChange={(s, v) => { setScope(s); setScopeValue(v); }} />
      </LabelledRow>
      <LabelledRow label="When a discount arrives">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          {([
            ['delivery-only', 'Accept for this delivery only (catalogue unchanged)'],
            ['update-catalogue', 'Accept and update catalogue cost'],
            ['prompt', 'Prompt per variance (default)'],
          ] as const).map(([value, label]) => (
            <label key={value} style={{ display: 'flex', gap: '8px', alignItems: 'center', fontSize: '12px', cursor: 'pointer' }}>
              <input type="radio" name="discount-mode" checked={mode === value} onChange={() => setMode(value)} />
              {label}
            </label>
          ))}
        </div>
      </LabelledRow>
    </EditShell>
  );
}

function EditVatRule({ rule, onCancel, onSave, onDelete }: {
  rule: VatOverrideRule | null;
  onCancel: () => void;
  onSave: (patch: Partial<VatOverrideRule>) => void;
  onDelete?: () => void;
}) {
  const [scope, setScope] = useState<RuleScope>(rule?.scope ?? 'supplier');
  const [scopeValue, setScopeValue] = useState<string | undefined>(rule?.scopeValue);
  const [rate, setRate] = useState<number>(rule?.rate ?? 0);
  const [note, setNote] = useState<string>(rule?.note ?? '');

  const save = () => onSave({ scope, scopeValue, rate, note: note || undefined });

  return (
    <EditShell label="VAT override" onCancel={onCancel} onSave={save} onDelete={onDelete}>
      <LabelledRow label="Scope">
        <ScopePicker scope={scope} scopeValue={scopeValue} onChange={(s, v) => { setScope(s); setScopeValue(v); }} />
      </LabelledRow>
      <LabelledRow label="Force VAT rate">
        <select value={rate} onChange={e => setRate(Number(e.target.value))} style={inputStyle}>
          <option value={0}>0%</option>
          <option value={5}>5%</option>
          <option value={20}>20%</option>
        </select>
      </LabelledRow>
      <LabelledRow label="Note">
        <input type="text" value={note} onChange={e => setNote(e.target.value)} placeholder="Optional reason" style={{ ...inputStyle, width: '100%' }} />
      </LabelledRow>
    </EditShell>
  );
}

function EditShell({ label, children, onCancel, onSave, onDelete }: {
  label: string;
  children: React.ReactNode;
  onCancel: () => void;
  onSave: () => void;
  onDelete?: () => void;
}) {
  return (
    <div style={{
      border: '1.5px solid var(--color-accent-active)',
      background: '#fff',
      borderRadius: '10px',
      padding: '14px',
      display: 'flex',
      flexDirection: 'column',
      gap: '10px',
    }}>
      <div style={{ fontSize: '12px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--color-accent-active)' }}>
        {label}
      </div>
      {children}
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '4px', flexWrap: 'wrap' }}>
        {onDelete && (
          <button
            onClick={onDelete}
            style={{
              padding: '8px 12px', borderRadius: '6px',
              background: 'transparent', border: '1px solid var(--color-error-border)',
              fontSize: '12px', fontWeight: 600, fontFamily: 'var(--font-primary)',
              color: 'var(--color-error)', cursor: 'pointer',
            }}
          >
            Delete
          </button>
        )}
        <div style={{ flex: 1 }} />
        <button
          onClick={onCancel}
          style={{
            padding: '8px 14px', borderRadius: '6px',
            background: '#fff', border: '1px solid var(--color-border)',
            fontSize: '12px', fontWeight: 600, fontFamily: 'var(--font-primary)',
            color: 'var(--color-text-primary)', cursor: 'pointer',
          }}
        >
          Cancel
        </button>
        <button
          onClick={onSave}
          style={{
            padding: '8px 16px', borderRadius: '6px',
            background: 'var(--color-accent-active)', border: 'none',
            fontSize: '12px', fontWeight: 700, fontFamily: 'var(--font-primary)',
            color: '#fff', cursor: 'pointer',
          }}
        >
          Save
        </button>
      </div>
    </div>
  );
}

function LabelledRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '130px 1fr', alignItems: 'center', gap: '10px' }}>
      <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--color-text-secondary)' }}>{label}</span>
      <div>{children}</div>
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  padding: '6px 8px',
  borderRadius: '6px',
  border: '1px solid var(--color-border)',
  fontSize: '12px',
  fontFamily: 'var(--font-primary)',
  background: '#fff',
  color: 'var(--color-text-primary)',
  outline: 'none',
};
