'use client';

/**
 * /settings/company — recreates the "Company Info" surface of Edify's
 * Settings area (staging.edifysystems.io/company-info). Stacked card
 * structure mirroring the live system: company profile → postal address
 * → registration → supplier price-update policy.
 *
 * Edify staging puts Integrations as an inner tab here, but we promoted
 * it to a top-level Configure-settings tab so every surface has a
 * single, focused purpose. See `/settings/integrations`.
 *
 * Edits stage locally and commit on "Save Changes" — same idea as the
 * structured site editor at /production/settings. We don't persist
 * across reloads here because this is just the UI replica; if the
 * prototype starts driving AI from these values too, lift to a small
 * companyProfileStore (mirroring `companyContextStore`).
 */

import { useMemo, useState } from 'react';
import { CheckCircle2, ChevronDown, HelpCircle, X } from 'lucide-react';
import { DIRECTORY_COMPANY } from '@/components/Settings/companyDirectory';

type SupplierPolicy = 'manual' | 'auto' | 'per-supplier';

type FormState = {
  name: string;
  franchiseOf: string;
  contactName: string;
  contactEmail: string;
  jobTitle: string;
  accountsEmail: string;
  invoiceEmail: string;
  statementEmail: string;
  phoneDial: string;
  phoneNumber: string;
  mobileDial: string;
  mobileNumber: string;
  website: string;
  addressLine1: string;
  addressLine2: string;
  city: string;
  postCode: string;
  country: string;
  vatNumber: string;
  companyRegistrationNumber: string;
  supplierPriceUpdatePolicy: SupplierPolicy;
};

function seedState(): FormState {
  return {
    name: DIRECTORY_COMPANY.name,
    franchiseOf: DIRECTORY_COMPANY.franchiseOf,
    contactName: DIRECTORY_COMPANY.contactName,
    contactEmail: DIRECTORY_COMPANY.contactEmail,
    jobTitle: DIRECTORY_COMPANY.jobTitle,
    accountsEmail: DIRECTORY_COMPANY.accountsEmail,
    invoiceEmail: DIRECTORY_COMPANY.invoiceEmail,
    statementEmail: DIRECTORY_COMPANY.statementEmail,
    phoneDial: DIRECTORY_COMPANY.phoneDial,
    phoneNumber: DIRECTORY_COMPANY.phoneNumber,
    mobileDial: DIRECTORY_COMPANY.mobileDial,
    mobileNumber: DIRECTORY_COMPANY.mobileNumber,
    website: DIRECTORY_COMPANY.website,
    addressLine1: DIRECTORY_COMPANY.addressLine1,
    addressLine2: DIRECTORY_COMPANY.addressLine2,
    city: DIRECTORY_COMPANY.city,
    postCode: DIRECTORY_COMPANY.postCode,
    country: DIRECTORY_COMPANY.country,
    vatNumber: DIRECTORY_COMPANY.vatNumber,
    companyRegistrationNumber: DIRECTORY_COMPANY.companyRegistrationNumber,
    supplierPriceUpdatePolicy: DIRECTORY_COMPANY.supplierPriceUpdatePolicy,
  };
}

export default function CompanyInfoPage() {
  const [committed, setCommitted] = useState<FormState>(() => seedState());
  const [draft, setDraft] = useState<FormState>(() => seedState());
  const [savedAt, setSavedAt] = useState<string | null>(null);

  const dirty = useMemo(
    () => JSON.stringify(committed) !== JSON.stringify(draft),
    [committed, draft],
  );

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setDraft(prev => ({ ...prev, [key]: value }));
    setSavedAt(null);
  }

  function commit() {
    setCommitted(draft);
    setSavedAt(new Date().toISOString());
  }

  function discard() {
    setDraft(committed);
    setSavedAt(null);
  }

  return (
    <div style={{ padding: '20px 24px 120px' }}>
      <div style={{ maxWidth: 880, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div>
          <h1
            style={{
              margin: 0,
              fontSize: 22,
              fontWeight: 700,
              color: 'var(--color-text-primary)',
              fontFamily: 'var(--font-primary)',
            }}
          >
            Company Info
          </h1>
          <div style={{ marginTop: 2, fontSize: 12, color: 'var(--color-text-muted)' }}>
            The company-level profile every site inherits from.
          </div>
        </div>

        {savedAt && (
          <SaveBanner
            updatedLabel={formatUpdated(savedAt)}
            onDismiss={() => setSavedAt(null)}
          />
        )}

        <BasicInformationForm draft={draft} set={set} />

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            justifyContent: 'flex-end',
            paddingTop: 4,
          }}
        >
          <button type="button" onClick={discard} disabled={!dirty} style={cancelBtn(!dirty)}>
            Cancel
          </button>
          <button type="button" onClick={commit} disabled={!dirty} style={primaryBtn(!dirty)}>
            <CheckCircle2 size={12} /> Save Changes
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Basic Information form ──────────────────────────────────────────────────

function BasicInformationForm({
  draft,
  set,
}: {
  draft: FormState;
  set: <K extends keyof FormState>(key: K, value: FormState[K]) => void;
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <Section>
        <Field label="Company name" required>
          <TextInput value={draft.name} onChange={v => set('name', v)} />
        </Field>
        <Field label="Franchise Of:">
          <SelectInput
            value={draft.franchiseOf}
            onChange={v => set('franchiseOf', v)}
            options={[
              { value: '', label: '' },
              { value: 'pret-uk', label: 'Pret A Manger UK' },
              { value: 'pret-international', label: 'Pret A Manger International' },
            ]}
          />
        </Field>
        <Field label="Contact name" required>
          <TextInput value={draft.contactName} onChange={v => set('contactName', v)} />
        </Field>
        <Field label="Contact Email" required>
          <TextInput value={draft.contactEmail} onChange={v => set('contactEmail', v)} type="email" />
        </Field>
        <Field label="Job Title">
          <TextInput value={draft.jobTitle} onChange={v => set('jobTitle', v)} />
        </Field>
        <Field label="Accounts Email" required addable>
          <TextInput value={draft.accountsEmail} onChange={v => set('accountsEmail', v)} type="email" />
        </Field>
        <Field label="Invoice Email" addable>
          <TextInput value={draft.invoiceEmail} onChange={v => set('invoiceEmail', v)} type="email" />
        </Field>
        <Field label="Statement Email" addable>
          <TextInput value={draft.statementEmail} onChange={v => set('statementEmail', v)} type="email" />
        </Field>
        <Field label="Phone" addable>
          <DialNumberInput
            dial={draft.phoneDial}
            onDialChange={v => set('phoneDial', v)}
            number={draft.phoneNumber}
            onNumberChange={v => set('phoneNumber', v)}
          />
        </Field>
        <Field label="Mobile number" addable>
          <DialNumberInput
            dial={draft.mobileDial}
            onDialChange={v => set('mobileDial', v)}
            number={draft.mobileNumber}
            onNumberChange={v => set('mobileNumber', v)}
          />
        </Field>
        <Field label="Website">
          <TextInput value={draft.website} onChange={v => set('website', v)} />
        </Field>
      </Section>

      <Section>
        <Field label="Head Office Postal Address">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <TextInput value={draft.addressLine1} onChange={v => set('addressLine1', v)} />
            <TextInput value={draft.addressLine2} onChange={v => set('addressLine2', v)} />
          </div>
        </Field>
        <Field label="City">
          <TextInput value={draft.city} onChange={v => set('city', v)} />
        </Field>
        <Field label="Post Code">
          <TextInput value={draft.postCode} onChange={v => set('postCode', v)} />
        </Field>
        <Field label="Country">
          <SelectInput
            value={draft.country}
            onChange={v => set('country', v)}
            options={[
              { value: '', label: '' },
              { value: 'United Arab Emirates', label: 'United Arab Emirates' },
              { value: 'United Kingdom',       label: 'United Kingdom' },
              { value: 'Saudi Arabia',         label: 'Saudi Arabia' },
              { value: 'France',               label: 'France' },
            ]}
          />
        </Field>
      </Section>

      <Section>
        <Field label="VAT Number">
          <TextInput value={draft.vatNumber} onChange={v => set('vatNumber', v)} />
        </Field>
        <Field label="Company Registration Number">
          <TextInput
            value={draft.companyRegistrationNumber}
            onChange={v => set('companyRegistrationNumber', v)}
          />
        </Field>
      </Section>

      <Section title="Supplier Settings">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <div
            style={{
              fontSize: 12.5,
              color: 'var(--color-text-primary)',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              marginBottom: 8,
            }}
          >
            Should products be automatically updated when an updated price is seen in a delivery?
            <HelpCircle size={13} style={{ color: 'var(--color-text-muted)' }} />
          </div>
          <Radio
            label="Require manual approval for price updates"
            checked={draft.supplierPriceUpdatePolicy === 'manual'}
            onChange={() => set('supplierPriceUpdatePolicy', 'manual')}
          />
          <Radio
            label="Automatically update product prices"
            checked={draft.supplierPriceUpdatePolicy === 'auto'}
            onChange={() => set('supplierPriceUpdatePolicy', 'auto')}
          />
          <Radio
            label="Configure setting per-supplier"
            checked={draft.supplierPriceUpdatePolicy === 'per-supplier'}
            onChange={() => set('supplierPriceUpdatePolicy', 'per-supplier')}
          />
        </div>
      </Section>
    </div>
  );
}

// ─── Section + Field primitives ──────────────────────────────────────────────

function Section({ children, title }: { children: React.ReactNode; title?: string }) {
  return (
    <div
      style={{
        background: '#ffffff',
        border: '1px solid var(--color-border-subtle)',
        borderRadius: 'var(--radius-card)',
        padding: 20,
        display: 'flex',
        flexDirection: 'column',
        gap: 14,
      }}
    >
      {title && (
        <div
          style={{
            fontSize: 14,
            fontWeight: 700,
            color: 'var(--color-text-primary)',
            fontFamily: 'var(--font-primary)',
          }}
        >
          {title}
        </div>
      )}
      {children}
    </div>
  );
}

function Field({
  label,
  required,
  addable,
  children,
}: {
  label: string;
  required?: boolean;
  addable?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <label
        style={{
          fontSize: 11.5,
          fontWeight: 600,
          color: 'var(--color-text-secondary)',
          fontFamily: 'var(--font-primary)',
        }}
      >
        {required && <span style={{ color: 'var(--color-error)', marginRight: 2 }}>*</span>}
        {label}
      </label>
      {children}
      {addable && (
        <button
          type="button"
          style={{
            alignSelf: 'flex-start',
            background: 'transparent',
            border: 'none',
            padding: '2px 0',
            fontSize: 11,
            fontWeight: 600,
            color: 'var(--color-accent-active)',
            cursor: 'pointer',
            fontFamily: 'var(--font-primary)',
          }}
        >
          + Add {label.split(' ')[0]}
        </button>
      )}
    </div>
  );
}

function TextInput({
  value,
  onChange,
  type = 'text',
}: {
  value: string;
  onChange: (v: string) => void;
  type?: 'text' | 'email';
}) {
  return (
    <input
      value={value}
      onChange={e => onChange(e.target.value)}
      type={type}
      style={{
        width: '100%',
        padding: '10px 12px',
        borderRadius: 8,
        border: '1px solid var(--color-border)',
        background: '#ffffff',
        fontSize: 13,
        fontFamily: 'var(--font-primary)',
        color: 'var(--color-text-primary)',
        outline: 'none',
      }}
    />
  );
}

function SelectInput({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  options: Array<{ value: string; label: string }>;
}) {
  return (
    <div style={{ position: 'relative' }}>
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        style={{
          appearance: 'none',
          width: '100%',
          padding: '10px 32px 10px 12px',
          borderRadius: 8,
          border: '1px solid var(--color-border)',
          background: '#ffffff',
          fontSize: 13,
          fontFamily: 'var(--font-primary)',
          color: value ? 'var(--color-text-primary)' : 'var(--color-text-muted)',
          outline: 'none',
          cursor: 'pointer',
        }}
      >
        {options.map(o => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <ChevronDown
        size={14}
        style={{
          position: 'absolute',
          right: 10,
          top: '50%',
          transform: 'translateY(-50%)',
          color: 'var(--color-text-muted)',
          pointerEvents: 'none',
        }}
      />
    </div>
  );
}

function DialNumberInput({
  dial,
  onDialChange,
  number,
  onNumberChange,
}: {
  dial: string;
  onDialChange: (v: string) => void;
  number: string;
  onNumberChange: (v: string) => void;
}) {
  return (
    <div style={{ display: 'flex', gap: 8 }}>
      <div style={{ position: 'relative', flexShrink: 0 }}>
        <select
          value={dial}
          onChange={e => onDialChange(e.target.value)}
          style={{
            appearance: 'none',
            padding: '10px 28px 10px 12px',
            borderRadius: 8,
            border: '1px solid var(--color-border)',
            background: '#ffffff',
            fontSize: 13,
            fontFamily: 'var(--font-primary)',
            color: 'var(--color-text-primary)',
            outline: 'none',
            cursor: 'pointer',
            minWidth: 90,
          }}
        >
          <option value="+44">+44</option>
          <option value="+971">+971</option>
          <option value="+1">+1</option>
          <option value="+33">+33</option>
        </select>
        <ChevronDown
          size={12}
          style={{
            position: 'absolute',
            right: 8,
            top: '50%',
            transform: 'translateY(-50%)',
            color: 'var(--color-text-muted)',
            pointerEvents: 'none',
          }}
        />
      </div>
      <input
        value={number}
        onChange={e => onNumberChange(e.target.value)}
        type="tel"
        style={{
          flex: 1,
          padding: '10px 12px',
          borderRadius: 8,
          border: '1px solid var(--color-border)',
          background: '#ffffff',
          fontSize: 13,
          fontFamily: 'var(--font-primary)',
          color: 'var(--color-text-primary)',
          outline: 'none',
        }}
      />
    </div>
  );
}

function Radio({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: () => void;
}) {
  return (
    <label
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 10,
        padding: '6px 0',
        fontSize: 12.5,
        color: 'var(--color-text-primary)',
        fontFamily: 'var(--font-primary)',
        cursor: 'pointer',
      }}
    >
      <span
        style={{
          width: 16,
          height: 16,
          borderRadius: 999,
          border: '1.5px solid var(--color-border)',
          background: '#ffffff',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          position: 'relative',
        }}
      >
        {checked && (
          <span
            style={{
              width: 8,
              height: 8,
              borderRadius: 999,
              background: 'var(--color-accent-active)',
              display: 'block',
            }}
          />
        )}
      </span>
      <input
        type="radio"
        checked={checked}
        onChange={onChange}
        style={{ position: 'absolute', opacity: 0, width: 0, height: 0 }}
      />
      {label}
    </label>
  );
}

// ─── Save banner ─────────────────────────────────────────────────────────────

function SaveBanner({
  updatedLabel,
  onDismiss,
}: {
  updatedLabel: string;
  onDismiss: () => void;
}) {
  return (
    <div
      role="status"
      style={{
        padding: '12px 14px',
        borderRadius: 'var(--radius-card)',
        background: 'var(--color-success-light)',
        border: '1px solid var(--color-success-border)',
        color: 'var(--color-success)',
        display: 'flex',
        alignItems: 'flex-start',
        gap: 12,
      }}
    >
      <CheckCircle2 size={16} style={{ marginTop: 1, flexShrink: 0 }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 12, fontWeight: 700 }}>Company info saved</div>
        <div style={{ marginTop: 2, fontSize: 11, color: 'var(--color-text-primary)' }}>
          Updated {updatedLabel}.
        </div>
      </div>
      <button
        type="button"
        onClick={onDismiss}
        aria-label="Dismiss"
        style={{
          width: 24,
          height: 24,
          borderRadius: 6,
          border: '1px solid transparent',
          background: 'transparent',
          color: 'var(--color-success)',
          cursor: 'pointer',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <X size={14} />
      </button>
    </div>
  );
}

// ─── Helpers + buttons ───────────────────────────────────────────────────────

function formatUpdated(iso: string): string {
  try {
    return new Date(iso).toLocaleString(undefined, {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return 'just now';
  }
}

function cancelBtn(disabled: boolean): React.CSSProperties {
  return {
    padding: '10px 22px',
    borderRadius: 8,
    fontSize: 12,
    fontWeight: 700,
    fontFamily: 'var(--font-primary)',
    background: '#ffffff',
    color: disabled ? 'var(--color-text-muted)' : 'var(--color-text-secondary)',
    border: '1px solid var(--color-border)',
    cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.6 : 1,
  };
}

function primaryBtn(disabled: boolean): React.CSSProperties {
  return {
    padding: '10px 22px',
    borderRadius: 8,
    fontSize: 12,
    fontWeight: 700,
    fontFamily: 'var(--font-primary)',
    background: 'var(--color-accent-active)',
    color: 'var(--color-text-on-active)',
    border: '1px solid var(--color-accent-active)',
    cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.55 : 1,
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
  };
}
