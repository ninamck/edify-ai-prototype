'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Package,
  Search,
  Check,
  Truck,
  FileSpreadsheet,
  Mail,
  FileText,
  type LucideIcon,
} from 'lucide-react';
import { useSuppliers } from '@/components/Suppliers/store';
import type { Supplier } from '@/components/Suppliers/fixtures';
import EdifyMark from '@/components/EdifyMark/EdifyMark';
import CardShell, { type CardState } from './CardShell';

interface ProductNewInfoCardProps {
  state: CardState;
  initialName?: string;
  initialSupplierId?: string;
  initialSupplierName?: string;
  onSubmit: (input: {
    newProductName: string;
    supplierMode: 'existing' | 'new';
    supplierId?: string;
    supplierName: string;
    /** Set when the user used the "import from sheet / email /
     *  document" shortcut. Carries forward through the runner so
     *  the pack-details step can be skipped — the source already
     *  gave us pack qty / cost / unit. */
    importedFromSource?: ImportSource;
    importedPackDetails?: ImportedPackDetails;
  }) => void;
  onCancel: () => void;
}

// Import-from-source state machine — used by both the parent card and
// the `ImportShortcut` chip group below. Hoisted to module scope so
// the two declarations share one definition.
type ImportSource = 'sheet' | 'email' | 'document';
type ImportedPackDetails = {
  packType: 'Pack' | 'Single';
  packQty: number;
  packCost: number;
  unitType: 'Each' | 'kg' | 'L' | 'g' | 'ml';
};
type ImportState =
  | { phase: 'idle' }
  | { phase: 'reading'; source: ImportSource }
  | { phase: 'extracted'; source: ImportSource; packDetails: ImportedPackDetails };

/**
 * Step 1 of the Replace-a-product wizard.
 *
 * Two inputs: the new product's name, and its supplier — picked from
 * the existing list or typed in fresh ("+ Add as new supplier"). The
 * supplier typeahead mirrors `RecipeNewIngredientCard`'s pattern so
 * the picker-with-create-new vocabulary stays consistent across the
 * chat wizards.
 *
 * Emits `supplierMode: 'new'` when the typed name doesn't match an
 * existing supplier; the runner then routes the next step into the
 * supplier-details card. Otherwise it skips ahead.
 */
export default function ProductNewInfoCard({
  state,
  initialName,
  initialSupplierId,
  initialSupplierName,
  onSubmit,
  onCancel,
}: ProductNewInfoCardProps) {
  const suppliers = useSuppliers();
  const [productName, setProductName] = useState<string>(initialName ?? '');

  type SupplierSelection =
    | { kind: 'picked'; supplier: Supplier }
    | { kind: 'created'; name: string };
  const initialSelection: SupplierSelection | null = useMemo(() => {
    if (initialSupplierId) {
      const s = suppliers.find((sp) => sp.id === initialSupplierId);
      if (s) return { kind: 'picked', supplier: s };
    }
    if (initialSupplierName) return { kind: 'created', name: initialSupplierName };
    return null;
  }, [initialSupplierId, initialSupplierName, suppliers]);

  const [supplier, setSupplier] = useState<SupplierSelection | null>(initialSelection);
  const [query, setQuery] = useState<string>(
    initialSupplierName ?? (initialSelection?.kind === 'picked' ? initialSelection.supplier.name : ''),
  );
  const inputRef = useRef<HTMLInputElement>(null);

  // ── Import-from-source flow ─────────────────────────────────────────
  // Prototype simulation: the user picks a source (sheet / email / doc),
  // we show a brief "reading…" state, then auto-fill the manual fields
  // and surface an "Imported from X · review and edit" banner. Keeps the
  // happy path identical to the manual flow once the fields are
  // populated — the user can still tweak anything before submitting.
  const [importState, setImportState] = useState<ImportState>({ phase: 'idle' });

  // Cancel any in-flight "reading" timer if the user changes their mind
  // (e.g. switches source) or the card transitions out of pending.
  const importTimerRef = useRef<number | null>(null);
  useEffect(() => () => {
    if (importTimerRef.current != null) window.clearTimeout(importTimerRef.current);
  }, []);

  function startImport(source: ImportSource) {
    if (state !== 'pending') return;
    if (importTimerRef.current != null) window.clearTimeout(importTimerRef.current);
    setImportState({ phase: 'reading', source });
    importTimerRef.current = window.setTimeout(() => {
      // Demo extraction: hard-coded product name + the first available
      // supplier as the "matched" one. In a real build this would come
      // from the parser running on the uploaded artifact.
      const demoSupplier =
        suppliers.find((s) => s.status !== 'Unavailable') ?? suppliers[0] ?? null;
      const demoName =
        source === 'email'
          ? 'Oat Milk Barista 1L'
          : source === 'document'
            ? 'Oat Milk Pro 1L'
            : 'Oat Milk Barista 1L';
      // Plausible pack details for the demo SKU. The runner uses these
      // to skip the pack-details step entirely — the source we read
      // already gave us everything that card was going to ask for.
      const demoPackDetails: ImportedPackDetails = {
        packType: 'Pack',
        packQty: 12,
        packCost: 42,
        unitType: 'L',
      };
      setProductName(demoName);
      if (demoSupplier) {
        setSupplier({ kind: 'picked', supplier: demoSupplier });
        setQuery(demoSupplier.name);
      }
      setImportState({ phase: 'extracted', source, packDetails: demoPackDetails });
    }, 1100);
  }

  function resetImport() {
    if (importTimerRef.current != null) window.clearTimeout(importTimerRef.current);
    setImportState({ phase: 'idle' });
  }

  const matches = useMemo<Supplier[]>(() => {
    const q = query.trim().toLowerCase();
    const list = suppliers.filter((s) => s.status !== 'Unavailable');
    if (!q) return list.slice(0, 6);
    return list
      .filter(
        (s) =>
          s.name.toLowerCase().includes(q) ||
          (s.shortCode ?? '').toLowerCase().includes(q),
      )
      .slice(0, 8);
  }, [suppliers, query]);

  const exactMatch = matches.find(
    (s) =>
      s.name.toLowerCase() === query.trim().toLowerCase() ||
      (s.shortCode ?? '').toLowerCase() === query.trim().toLowerCase(),
  );

  function pickSupplier(s: Supplier) {
    setSupplier({ kind: 'picked', supplier: s });
    setQuery(s.name);
  }
  function createNewSupplier(name: string) {
    const trimmed = name.trim();
    if (!trimmed) return;
    setSupplier({ kind: 'created', name: trimmed });
  }
  function clearSupplier() {
    setSupplier(null);
    setQuery('');
    setTimeout(() => inputRef.current?.focus(), 0);
  }

  const canSubmit = productName.trim().length > 0 && supplier !== null;

  function submit() {
    if (!canSubmit || !supplier) return;
    // Only forward the imported flag when the extraction is still
    // active — if the user hit "Undo" on the banner we treat the form
    // as a manual entry from then on, even if the fields are still
    // populated with the imported values.
    const importPayload =
      importState.phase === 'extracted'
        ? {
            importedFromSource: importState.source,
            importedPackDetails: importState.packDetails,
          }
        : {};
    if (supplier.kind === 'picked') {
      onSubmit({
        newProductName: productName.trim(),
        supplierMode: 'existing',
        supplierId: supplier.supplier.id,
        supplierName: supplier.supplier.name,
        ...importPayload,
      });
    } else {
      onSubmit({
        newProductName: productName.trim(),
        supplierMode: 'new',
        supplierName: supplier.name,
        ...importPayload,
      });
    }
  }

  const supplierName =
    supplier?.kind === 'picked' ? supplier.supplier.name : supplier?.name;

  return (
    <CardShell
      icon={Package}
      title="Add a new product"
      subtitle="Step 1 of 4 — what & who"
      state={state}
      confirmLabel="Next"
      confirmDisabled={!canSubmit}
      onCancel={onCancel}
      onConfirm={submit}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {/* ── Import shortcut ───────────────────────────────────────────
            Surfaces the "do it from a sheet/email/document" path before
            the manual fields so the user knows they don't have to type
            anything in. On click, we simulate an extraction and pre-fill
            the fields below — the manual flow then resumes unchanged. */}
        <ImportShortcut
          state={state}
          importState={importState}
          onStart={startImport}
          onReset={resetImport}
        />

        {/* ── Product name ──────────────────────────────────────────── */}
        <div>
          <Label>Product name</Label>
          <input
            type="text"
            value={productName}
            disabled={state !== 'pending'}
            onChange={(e) => setProductName(e.target.value)}
            placeholder="e.g. Oat Milk Pro 1L"
            autoFocus={!initialName}
            style={{
              width: '100%',
              marginTop: '4px',
              padding: '8px 10px',
              borderRadius: '10px',
              border: '1.5px solid var(--color-border, rgba(0,28,53,0.18))',
              fontSize: '13px',
              fontWeight: 600,
              fontFamily: 'var(--font-primary)',
              color: 'var(--color-text-primary)',
              background: '#fff',
              outline: 'none',
              boxSizing: 'border-box',
            }}
          />
        </div>

        {/* ── Supplier ──────────────────────────────────────────────── */}
        <div>
          <Label>Supplier</Label>
          {supplier ? (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '12px',
                marginTop: '4px',
                padding: '8px 10px',
                borderRadius: '12px',
                border: '1.5px solid var(--color-accent-active, #001C35)',
                background: 'rgba(40,175,201,0.06)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
                {supplier.kind === 'picked' ? (
                  <Check
                    size={14}
                    color="var(--color-text-muted)"
                    strokeWidth={2.2}
                    style={{ flexShrink: 0 }}
                  />
                ) : (
                  <EdifyMark
                    size={14}
                    color="var(--color-text-muted)"
                    style={{ flexShrink: 0 }}
                  />
                )}
                <div style={{ minWidth: 0 }}>
                  <div
                    style={{
                      fontSize: '13px',
                      fontWeight: 700,
                      color: 'var(--color-text-primary)',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {supplierName}
                  </div>
                  <div style={{ fontSize: '11px', fontWeight: 500, color: 'var(--color-text-muted)', marginTop: '1px' }}>
                    {supplier.kind === 'picked'
                      ? `Existing supplier · ${supplier.supplier.categories.slice(0, 2).join(', ')}`
                      : "We'll set this supplier up in the next step"}
                  </div>
                </div>
              </div>
              <button
                type="button"
                disabled={state !== 'pending'}
                onClick={clearSupplier}
                style={{
                  padding: '4px 10px',
                  borderRadius: '100px',
                  border: '1.5px solid var(--color-border, rgba(0,28,53,0.18))',
                  background: '#fff',
                  fontSize: '11px',
                  fontWeight: 600,
                  fontFamily: 'var(--font-primary)',
                  color: 'var(--color-text-secondary)',
                  cursor: state === 'pending' ? 'pointer' : 'not-allowed',
                  flexShrink: 0,
                }}
              >
                Change
              </button>
            </div>
          ) : (
            <>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  marginTop: '4px',
                  padding: '7px 10px',
                  borderRadius: '10px',
                  border: '1.5px solid var(--color-border, rgba(0,28,53,0.18))',
                  background: '#fff',
                }}
              >
                <Search size={14} color="var(--color-text-muted)" />
                <input
                  ref={inputRef}
                  type="text"
                  value={query}
                  disabled={state !== 'pending'}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search suppliers, or type a new name…"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && query.trim() && !exactMatch) {
                      e.preventDefault();
                      createNewSupplier(query);
                    }
                  }}
                  style={{
                    flex: 1,
                    border: 'none',
                    outline: 'none',
                    background: 'transparent',
                    fontSize: '13px',
                    fontWeight: 500,
                    fontFamily: 'var(--font-primary)',
                    color: 'var(--color-text-primary)',
                  }}
                />
              </div>

              <div
                style={{
                  marginTop: '6px',
                  borderRadius: '10px',
                  border: '1px solid var(--color-border-subtle, rgba(0,28,53,0.08))',
                  overflow: 'hidden',
                  maxHeight: '140px',
                  overflowY: 'auto',
                }}
              >
                {matches.length === 0 && (
                  <div style={emptyStyle}>No suppliers match that.</div>
                )}
                {matches.map((s, i) => (
                  <button
                    key={s.id}
                    type="button"
                    disabled={state !== 'pending'}
                    onClick={() => pickSupplier(s)}
                    style={{
                      display: 'flex',
                      width: '100%',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: '10px',
                      padding: '7px 10px',
                      border: 'none',
                      borderBottom:
                        i < matches.length - 1
                          ? '1px solid var(--color-border-subtle, rgba(0,28,53,0.06))'
                          : 'none',
                      background: 'transparent',
                      cursor: state === 'pending' ? 'pointer' : 'not-allowed',
                      textAlign: 'left',
                      fontFamily: 'var(--font-primary)',
                    }}
                    onMouseEnter={(e) => {
                      (e.currentTarget as HTMLElement).style.background = 'rgba(40,175,201,0.06)';
                    }}
                    onMouseLeave={(e) => {
                      (e.currentTarget as HTMLElement).style.background = 'transparent';
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
                      <Truck size={14} color="var(--color-text-muted)" strokeWidth={1.9} />
                      <div style={{ minWidth: 0 }}>
                        <div
                          style={{
                            fontSize: '13px',
                            fontWeight: 600,
                            color: 'var(--color-text-primary)',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {s.name}
                        </div>
                        <div
                          style={{
                            fontSize: '11px',
                            fontWeight: 500,
                            color: 'var(--color-text-muted)',
                            marginTop: '1px',
                          }}
                        >
                          {s.categories.slice(0, 3).join(', ')}
                        </div>
                      </div>
                    </div>
                    <span
                      style={{
                        fontSize: '11px',
                        fontWeight: 600,
                        color: 'var(--color-text-secondary)',
                        flexShrink: 0,
                      }}
                    >
                      Pick
                    </span>
                  </button>
                ))}
              </div>

              {query.trim() && !exactMatch && (
                <button
                  type="button"
                  disabled={state !== 'pending'}
                  onClick={() => createNewSupplier(query)}
                  style={{
                    display: 'flex',
                    width: '100%',
                    alignItems: 'center',
                    gap: '10px',
                    marginTop: '6px',
                    padding: '8px 10px',
                    borderRadius: '10px',
                    border: '1.5px dashed var(--color-accent-mid, #28AFC9)',
                    background: 'rgba(40,175,201,0.04)',
                    cursor: state === 'pending' ? 'pointer' : 'not-allowed',
                    textAlign: 'left',
                    fontFamily: 'var(--font-primary)',
                  }}
                >
                  <EdifyMark size={14} color="var(--color-accent-mid, #28AFC9)" />
                  <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--color-text-primary)' }}>
                    Add &ldquo;{query.trim()}&rdquo; as a new supplier
                  </span>
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </CardShell>
  );
}

const emptyStyle = {
  padding: '12px',
  fontSize: '12px',
  fontWeight: 500,
  color: 'var(--color-text-muted)',
  textAlign: 'center' as const,
};

function Label({ children }: { children: React.ReactNode }) {
  return (
    <span
      style={{
        fontSize: '11px',
        fontWeight: 700,
        letterSpacing: '0.04em',
        textTransform: 'uppercase',
        color: 'var(--color-text-secondary)',
      }}
    >
      {children}
    </span>
  );
}

// ── Import shortcut ────────────────────────────────────────────────────

const SOURCE_META: Record<
  ImportSource,
  { label: string; icon: LucideIcon; reading: string; extracted: string }
> = {
  sheet: {
    label: 'Supplier sheet',
    icon: FileSpreadsheet,
    reading: 'Reading your supplier sheet\u2026',
    extracted: 'Pulled from your supplier sheet',
  },
  email: {
    label: 'Email',
    icon: Mail,
    reading: 'Parsing the supplier email\u2026',
    extracted: 'Pulled from the supplier email',
  },
  document: {
    label: 'Document',
    icon: FileText,
    reading: 'Reading the document\u2026',
    extracted: 'Pulled from your document',
  },
};

function ImportShortcut({
  state,
  importState,
  onStart,
  onReset,
}: {
  state: CardState;
  importState: ImportState;
  onStart: (s: ImportSource) => void;
  onReset: () => void;
}) {
  const disabled = state !== 'pending';

  if (importState.phase === 'reading') {
    const meta = SOURCE_META[importState.source];
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          padding: '9px 10px',
          borderRadius: '10px',
          border: '1px solid var(--color-border-subtle, rgba(0,28,53,0.12))',
          background: 'rgba(40,175,201,0.06)',
        }}
      >
        <span className="quinn-spin" style={{ display: 'inline-flex', flexShrink: 0 }}>
          <meta.icon size={14} color="var(--color-accent-mid, #28AFC9)" strokeWidth={2} />
        </span>
        <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--color-text-secondary)' }}>
          {meta.reading}
        </span>
      </div>
    );
  }

  if (importState.phase === 'extracted') {
    const meta = SOURCE_META[importState.source];
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '10px',
          padding: '8px 10px',
          borderRadius: '10px',
          border: '1px solid rgba(45,106,79,0.30)',
          background: 'rgba(45,106,79,0.08)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
          <Check size={14} color="#2D6A4F" strokeWidth={2.4} style={{ flexShrink: 0 }} />
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: '12px', fontWeight: 700, color: '#2D6A4F' }}>
              {meta.extracted}
            </div>
            <div style={{ fontSize: '11px', fontWeight: 500, color: 'var(--color-text-muted)', marginTop: '1px' }}>
              Review the details below and edit anything that&rsquo;s off.
            </div>
          </div>
        </div>
        <button
          type="button"
          disabled={disabled}
          onClick={onReset}
          style={{
            padding: '3px 8px',
            borderRadius: '100px',
            border: '1px solid var(--color-border, rgba(0,28,53,0.18))',
            background: '#fff',
            fontSize: '11px',
            fontWeight: 600,
            fontFamily: 'var(--font-primary)',
            color: 'var(--color-text-secondary)',
            cursor: disabled ? 'not-allowed' : 'pointer',
            flexShrink: 0,
          }}
        >
          Undo
        </button>
      </div>
    );
  }

  return (
    <div
      style={{
        padding: '8px 10px',
        borderRadius: '10px',
        border: '1px dashed var(--color-border, rgba(0,28,53,0.18))',
        background: 'rgba(40,175,201,0.04)',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          fontSize: '11px',
          fontWeight: 700,
          letterSpacing: '0.04em',
          textTransform: 'uppercase',
          color: 'var(--color-text-secondary)',
        }}
      >
        <EdifyMark size={11} color="var(--color-accent-mid, #28AFC9)" />
        Skip the typing &middot; import from
      </div>
      <div style={{ display: 'flex', gap: '6px', marginTop: '6px', flexWrap: 'wrap' }}>
        {(['sheet', 'email', 'document'] as ImportSource[]).map((src) => {
          const meta = SOURCE_META[src];
          const Icon = meta.icon;
          return (
            <button
              key={src}
              type="button"
              disabled={disabled}
              onClick={() => onStart(src)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '5px 10px',
                borderRadius: '100px',
                border: '1px solid var(--color-border, rgba(0,28,53,0.18))',
                background: '#fff',
                fontSize: '11.5px',
                fontWeight: 600,
                fontFamily: 'var(--font-primary)',
                color: 'var(--color-text-primary)',
                cursor: disabled ? 'not-allowed' : 'pointer',
              }}
              onMouseEnter={(e) => {
                if (disabled) return;
                (e.currentTarget as HTMLElement).style.background = 'rgba(40,175,201,0.08)';
                (e.currentTarget as HTMLElement).style.borderColor =
                  'var(--color-accent-mid, #28AFC9)';
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLElement).style.background = '#fff';
                (e.currentTarget as HTMLElement).style.borderColor =
                  'var(--color-border, rgba(0,28,53,0.18))';
              }}
            >
              <Icon size={13} color="var(--color-text-secondary)" strokeWidth={1.9} />
              {meta.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
