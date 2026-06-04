'use client';

/**
 * CSV import for the Suppliers area. Two CSV shapes are supported \u2014 Suppliers
 * and Products \u2014 picked at the top of the flow.
 *
 * The staged pattern (Drop \u2192 Map columns \u2192 Preview \u2192 Confirm) is borrowed
 * from app/recipes/intake/sheet/page.tsx so the cognitive model stays the
 * same for users who have already used the recipe importer.
 */

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft, FileSpreadsheet, Upload, ChevronRight, Check, AlertTriangle,
} from 'lucide-react';
import EdifyMark from '@/components/EdifyMark/EdifyMark';
import { parseCsv } from '@/lib/csv';
import {
  useSuppliers, useMasterProducts, upsertProduct, upsertSupplier, genId,
} from '@/components/Suppliers/store';
import {
  type Product, type Supplier, type ProductCategory, type ProductClass,
  ALL_CATEGORIES, ALL_CLASSES, ALL_SITES,
} from '@/components/Suppliers/fixtures';

type Stage = 'kind' | 'drop' | 'map' | 'preview' | 'done';
type Kind = 'products' | 'suppliers';

// Demo CSVs Quinn can preview without the user having to construct one. The
// shapes match the column names mentioned in the screenshots.
const DEMO_PRODUCTS_CSV = `name,supplier,supplier_code,class,category,pack_qty,pack_cost,uom,status
Cucumber 500g,Barakat Quality Plus,BQ-CUC-500,Food,Produce,12,42.00,500g,Available
Tomatoes Cherry 250g,Barakat Quality Plus,BQ-TOM-250,Food,Produce,16,55.00,250g,Available
Sourdough Loaf,Bakemart LLC,BM-SD-001,Food,Bakery,1,18.50,each,Available
Pain au Chocolat,Bakemart LLC,BM-PAC-001,Food,Bakery,12,72.00,each,Available
Sparkling Water 330ml,Agility,AG-SP-330,Beverage,Beverage,24,68.00,L,Available`;

const DEMO_SUPPLIERS_CSV = `name,short_code,categories,email,cutoff,lead_time_days
Frosa Foods FZ LLC,Frosa,Pantry|Bakery,orders@frosafoods.ae,15:00,2
Bin Ablan Food,Bin Ablan,Meat|Seafood,sales@binablan.com,10:00,1
Spinneys Food Service,Spinneys,Pantry|Cleaning,b2b@spinneys.com,16:00,1`;

export default function ImportCsvPage() {
  const router = useRouter();
  const suppliers = useSuppliers();
  const masterProducts = useMasterProducts();

  const [stage, setStage] = useState<Stage>('kind');
  const [kind, setKind] = useState<Kind | null>(null);
  const [csvText, setCsvText] = useState('');
  const [importedCount, setImportedCount] = useState(0);

  const rows = useMemo(() => csvText ? parseCsv(csvText) : [], [csvText]);
  const headers = rows[0] ? Object.keys(rows[0]) : [];

  const mappedProducts: Product[] = useMemo(() => {
    if (kind !== 'products') return [];
    return rows.map((r) => mapRowToProduct(r, suppliers));
  }, [rows, kind, suppliers]);

  const mappedSuppliers: Supplier[] = useMemo(() => {
    if (kind !== 'suppliers') return [];
    return rows.map((r) => mapRowToSupplier(r));
  }, [rows, kind]);

  function commitImport() {
    if (kind === 'products') {
      mappedProducts.forEach(upsertProduct);
      setImportedCount(mappedProducts.length);
    } else if (kind === 'suppliers') {
      mappedSuppliers.forEach(upsertSupplier);
      setImportedCount(mappedSuppliers.length);
    }
    setStage('done');
  }

  return (
    <div style={{ padding: '20px clamp(20px, 3vw, 40px) 80px', maxWidth: 880, margin: '0 auto', fontFamily: 'var(--font-primary)' }}>
      <button onClick={() => router.push('/suppliers')} style={backBtnStyle}>
        <ArrowLeft size={14} /> Back to suppliers
      </button>

      {/* Quinn intro */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14, marginTop: 8 }}>
        <div style={{
          width: 36, height: 36, borderRadius: '50%',
          background: 'var(--color-quinn-bg)',
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0,
        }}>
          <EdifyMark size={15} color="var(--color-accent-quinn)" strokeWidth={2.2} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', color: 'var(--color-accent-active)' }}>QUINN</div>
          <h1 style={{ fontSize: 22, fontWeight: 700, margin: '2px 0 4px', color: 'var(--color-text-primary)' }}>
            Import from a CSV
          </h1>
          <p style={{ fontSize: 13, color: 'var(--color-text-muted)', margin: 0, lineHeight: 1.5 }}>
            {stage === 'kind' && 'Pick what shape your file is in.'}
            {stage === 'drop' && 'Drop a file or paste rows. I\u2019ll auto-detect the columns.'}
            {stage === 'map' && 'Confirm I read your columns correctly. I\u2019ve mapped what I could see.'}
            {stage === 'preview' && 'Here\u2019s what I\u2019ll create. Review the first few before I commit.'}
            {stage === 'done' && 'All imported. You can close this page or import another batch.'}
          </p>
        </div>
      </div>

      {/* Stepper */}
      <Stepper stage={stage} />

      {/* Stage body */}
      <div style={{ marginTop: 16 }}>
        {stage === 'kind' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <KindOption
              title="Supplier products"
              description="Bulk add or update SKUs (the rows you see on the Products tab)."
              meta="Columns: name, supplier, supplier_code, class, category, pack_qty, pack_cost, uom, status"
              onClick={() => { setKind('products'); setStage('drop'); }}
            />
            <KindOption
              title="Suppliers"
              description="Bulk add new vendors and their basics."
              meta="Columns: name, short_code, categories, email, cutoff, lead_time_days"
              onClick={() => { setKind('suppliers'); setStage('drop'); }}
            />
          </div>
        )}

        {stage === 'drop' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <DropZone
              onFile={async (file) => {
                const text = await file.text();
                setCsvText(text);
                setStage('map');
              }}
              onPaste={(text) => { setCsvText(text); setStage('map'); }}
            />
            <button
              onClick={() => {
                setCsvText(kind === 'products' ? DEMO_PRODUCTS_CSV : DEMO_SUPPLIERS_CSV);
                setStage('map');
              }}
              style={ghostBtnStyle}
            >
              <FileSpreadsheet size={14} /> Use demo CSV
            </button>
          </div>
        )}

        {stage === 'map' && (
          <MappingTable
            headers={headers}
            kind={kind!}
            onConfirm={() => setStage('preview')}
            onBack={() => setStage('drop')}
            previewRows={rows.slice(0, 3)}
          />
        )}

        {stage === 'preview' && (
          <PreviewTable
            kind={kind!}
            products={mappedProducts}
            suppliers={mappedSuppliers}
            existingSuppliers={suppliers}
            onConfirm={commitImport}
            onBack={() => setStage('map')}
          />
        )}

        {stage === 'done' && (
          <SuccessBlock count={importedCount} kind={kind!} onDone={() => router.push('/suppliers')} onAnother={() => { setStage('kind'); setKind(null); setCsvText(''); }} />
        )}
      </div>

      <span style={{ display: 'none' }}>{masterProducts.length}</span>
    </div>
  );
}

// ─── Mapping helpers ────────────────────────────────────────────────────────

function mapRowToProduct(row: Record<string, string>, suppliers: Supplier[]): Product {
  const supplierName = (row.supplier ?? '').trim();
  const matched = suppliers.find((s) => s.name.toLowerCase() === supplierName.toLowerCase());
  const cls = (ALL_CLASSES as string[]).includes(row.class) ? (row.class as ProductClass) : 'General';
  const cat = (ALL_CATEGORIES as string[]).includes(row.category) ? (row.category as ProductCategory) : 'Other';
  return {
    id: genId('prd'),
    name: row.name ?? 'Unnamed product',
    supplierId: matched?.id ?? suppliers[0]?.id ?? 'sup-agility',
    supplierCode: row.supplier_code ?? '',
    productClass: cls,
    category: cat,
    tags: [],
    packType: 'Pack',
    packQty: Number(row.pack_qty) || 1,
    packCost: Number(row.pack_cost) || 0,
    taxRatePct: 5,
    singleUnitType: 'Each',
    unitOfMeasure: row.uom || undefined,
    altUoms: [],
    allergensContains: [],
    allergensTraces: [],
    nutrition: {},
    sites: [...ALL_SITES],
    status: row.status === 'Unavailable' ? 'Unavailable' : 'Available',
  };
}

function mapRowToSupplier(row: Record<string, string>): Supplier {
  const cats = (row.categories ?? '')
    .split('|')
    .map((s) => s.trim())
    .filter((s): s is ProductCategory => (ALL_CATEGORIES as string[]).includes(s));
  return {
    id: genId('sup'),
    name: row.name ?? 'Unnamed supplier',
    shortCode: row.short_code || undefined,
    categories: cats,
    sites: [],
    status: 'Pending',
    email: row.email || undefined,
    cutOffTime: row.cutoff || undefined,
    leadTimeDays: row.lead_time_days ? Number(row.lead_time_days) : undefined,
  };
}

// ─── UI bits ────────────────────────────────────────────────────────────────

function Stepper({ stage }: { stage: Stage }) {
  const steps: { id: Stage; label: string }[] = [
    { id: 'kind', label: 'Pick' },
    { id: 'drop', label: 'Upload' },
    { id: 'map', label: 'Map columns' },
    { id: 'preview', label: 'Preview' },
    { id: 'done', label: 'Done' },
  ];
  const idx = steps.findIndex((s) => s.id === stage);
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, margin: '16px 0 0' }}>
      {steps.map((s, i) => {
        const done = i < idx;
        const active = i === idx;
        return (
          <span key={s.id} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <span style={{
              width: 22, height: 22, borderRadius: '50%',
              background: done ? 'var(--color-success-light)' : active ? 'var(--color-accent-active)' : 'var(--color-bg-hover)',
              color: done ? 'var(--color-success)' : active ? '#fff' : 'var(--color-text-muted)',
              fontSize: 11, fontWeight: 700,
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            }}>
              {done ? <Check size={12} strokeWidth={3} /> : i + 1}
            </span>
            <span style={{
              fontSize: 12, fontWeight: 600,
              color: active ? 'var(--color-text-primary)' : 'var(--color-text-muted)',
            }}>
              {s.label}
            </span>
            {i < steps.length - 1 && <ChevronRight size={12} color="var(--color-text-muted)" />}
          </span>
        );
      })}
    </div>
  );
}

function KindOption({ title, description, meta, onClick }: {
  title: string; description: string; meta: string; onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        display: 'flex', alignItems: 'center', gap: 14,
        padding: 16,
        borderRadius: 12,
        border: '1px solid var(--color-border-subtle)',
        background: '#fff',
        cursor: 'pointer',
        fontFamily: 'var(--font-primary)',
        textAlign: 'left',
      }}
      onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--color-bg-hover)'; }}
      onMouseLeave={(e) => { e.currentTarget.style.background = '#fff'; }}
    >
      <div style={{
        width: 42, height: 42, borderRadius: 10,
        background: 'rgba(34,68,68,0.08)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexShrink: 0,
      }}>
        <FileSpreadsheet size={20} color="var(--color-accent-active)" />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--color-text-primary)' }}>{title}</div>
        <div style={{ fontSize: 12.5, color: 'var(--color-text-muted)', marginTop: 2 }}>{description}</div>
        <div style={{ fontSize: 11.5, color: 'var(--color-accent-active)', marginTop: 6, fontWeight: 600 }}>{meta}</div>
      </div>
      <ChevronRight size={16} color="var(--color-text-muted)" />
    </button>
  );
}

function DropZone({ onFile, onPaste }: { onFile: (f: File) => void; onPaste: (t: string) => void }) {
  const [hover, setHover] = useState(false);
  const [pasteText, setPasteText] = useState('');
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <label
        onDragOver={(e) => { e.preventDefault(); setHover(true); }}
        onDragLeave={() => setHover(false)}
        onDrop={(e) => {
          e.preventDefault(); setHover(false);
          const file = e.dataTransfer.files[0];
          if (file) onFile(file);
        }}
        style={{
          border: '2px dashed ' + (hover ? 'var(--color-accent-active)' : 'var(--color-border)'),
          borderRadius: 14,
          padding: '40px 20px',
          textAlign: 'center',
          cursor: 'pointer',
          background: hover ? 'rgba(34,68,68,0.04)' : '#fff',
          transition: 'all 0.15s',
        }}
      >
        <input
          type="file"
          accept=".csv,text/csv"
          style={{ display: 'none' }}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) onFile(file);
          }}
        />
        <Upload size={28} color="var(--color-accent-active)" />
        <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--color-text-primary)', marginTop: 8 }}>
          Drop CSV here or click to browse
        </div>
        <div style={{ fontSize: 12, color: 'var(--color-text-muted)', marginTop: 2 }}>
          .csv up to 5 MB
        </div>
      </label>
      <details style={{ fontSize: 12.5, color: 'var(--color-text-secondary)' }}>
        <summary style={{ cursor: 'pointer', fontWeight: 600 }}>Or paste rows</summary>
        <textarea
          value={pasteText}
          onChange={(e) => setPasteText(e.target.value)}
          placeholder={'name,supplier,supplier_code,...\nCucumber 500g,Barakat Quality Plus,...'}
          style={{
            width: '100%', minHeight: 120, marginTop: 8,
            padding: 10,
            borderRadius: 10,
            border: '1px solid var(--color-border)',
            fontFamily: 'monospace', fontSize: 12,
            background: '#fff',
            outline: 'none',
          }}
        />
        <button
          onClick={() => onPaste(pasteText)}
          disabled={!pasteText.trim()}
          style={{
            marginTop: 8, padding: '6px 12px', borderRadius: 8,
            background: pasteText.trim() ? 'var(--color-accent-active)' : 'var(--color-border)',
            color: '#fff', border: 'none',
            fontSize: 12, fontWeight: 700,
            cursor: pasteText.trim() ? 'pointer' : 'not-allowed',
          }}
        >
          Use these rows
        </button>
      </details>
    </div>
  );
}

function MappingTable({ headers, kind, onConfirm, onBack, previewRows }: {
  headers: string[]; kind: Kind; onConfirm: () => void; onBack: () => void;
  previewRows: Record<string, string>[];
}) {
  const expected = kind === 'products'
    ? ['name', 'supplier', 'supplier_code', 'class', 'category', 'pack_qty', 'pack_cost', 'uom', 'status']
    : ['name', 'short_code', 'categories', 'email', 'cutoff', 'lead_time_days'];
  const matched = expected.filter((c) => headers.includes(c));
  const missing = expected.filter((c) => !headers.includes(c));
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{
        padding: 14, borderRadius: 10,
        background: missing.length === 0 ? 'var(--color-success-light)' : 'var(--color-warning-light)',
        border: '1px solid ' + (missing.length === 0 ? 'var(--color-success-border)' : 'var(--color-warning-border)'),
        color: missing.length === 0 ? 'var(--color-success)' : 'var(--color-warning)',
        fontSize: 12.5, fontWeight: 600,
        display: 'flex', alignItems: 'center', gap: 8,
      }}>
        {missing.length === 0
          ? <><Check size={14} /> All required columns matched ({matched.length} of {expected.length}).</>
          : <><AlertTriangle size={14} /> Missing optional columns: {missing.join(', ')}. I\u2019ll fill in defaults.</>}
      </div>
      <div style={{
        border: '1px solid var(--color-border-subtle)',
        borderRadius: 12, overflow: 'auto', background: '#fff',
      }}>
        <table style={{ width: '100%', fontSize: 12, borderCollapse: 'collapse', fontFamily: 'monospace' }}>
          <thead>
            <tr>
              {headers.map((h) => (
                <th key={h} style={{
                  padding: '8px 10px', textAlign: 'left',
                  background: '#FBFAF8',
                  borderBottom: '1px solid var(--color-border-subtle)',
                  color: 'var(--color-text-primary)',
                  fontWeight: 700,
                  whiteSpace: 'nowrap',
                }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {previewRows.map((r, i) => (
              <tr key={i}>
                {headers.map((h) => (
                  <td key={h} style={{ padding: '6px 10px', borderBottom: '1px solid var(--color-border-subtle)', color: 'var(--color-text-secondary)' }}>
                    {r[h]}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
        <button onClick={onBack} style={ghostBtnStyle}>Back</button>
        <button onClick={onConfirm} style={primaryBtnStyle}>Looks right \u2014 preview</button>
      </div>
    </div>
  );
}

function PreviewTable({
  kind, products, suppliers, existingSuppliers, onConfirm, onBack,
}: {
  kind: Kind;
  products: Product[];
  suppliers: Supplier[];
  existingSuppliers: Supplier[];
  onConfirm: () => void; onBack: () => void;
}) {
  const total = kind === 'products' ? products.length : suppliers.length;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{
        padding: 14, borderRadius: 10,
        background: 'var(--color-bg-hover)', border: '1px solid var(--color-border-subtle)',
        fontSize: 12.5, color: 'var(--color-text-secondary)',
      }}>
        <strong style={{ color: 'var(--color-text-primary)' }}>{total}</strong>{' '}
        {kind === 'products' ? 'product' : 'supplier'}{total === 1 ? '' : 's'} ready to import.
      </div>
      <div style={{
        border: '1px solid var(--color-border-subtle)',
        borderRadius: 12, overflow: 'hidden', background: '#fff',
      }}>
        {kind === 'products'
          ? products.slice(0, 5).map((p) => (
              <div key={p.id} style={previewRowStyle}>
                <span style={{ flex: 1, fontWeight: 600, fontSize: 13, color: 'var(--color-text-primary)' }}>{p.name}</span>
                <span style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>{existingSuppliers.find((s) => s.id === p.supplierId)?.name ?? 'New supplier'}</span>
                <span style={{ fontSize: 12, color: 'var(--color-text-secondary)', fontWeight: 600 }}>{p.packQty} \u00d7 £{p.packCost.toFixed(2)}</span>
              </div>
            ))
          : suppliers.slice(0, 5).map((s) => (
              <div key={s.id} style={previewRowStyle}>
                <span style={{ flex: 1, fontWeight: 600, fontSize: 13, color: 'var(--color-text-primary)' }}>{s.name}</span>
                <span style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>{s.categories.join(', ') || 'Uncategorised'}</span>
                <span style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>cut-off {s.cutOffTime ?? '—'}</span>
              </div>
            ))
        }
        {total > 5 && (
          <div style={{ padding: 10, fontSize: 12, color: 'var(--color-text-muted)', textAlign: 'center' }}>
            \u2026and {total - 5} more
          </div>
        )}
      </div>
      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
        <button onClick={onBack} style={ghostBtnStyle}>Back</button>
        <button onClick={onConfirm} style={primaryBtnStyle}>Import {total}</button>
      </div>
    </div>
  );
}

function SuccessBlock({ count, kind, onDone, onAnother }: {
  count: number; kind: Kind; onDone: () => void; onAnother: () => void;
}) {
  return (
    <div style={{
      padding: 24, borderRadius: 14,
      background: 'var(--color-success-light)',
      border: '1px solid var(--color-success-border)',
      textAlign: 'center',
      display: 'flex', flexDirection: 'column', gap: 12, alignItems: 'center',
    }}>
      <div style={{
        width: 48, height: 48, borderRadius: '50%',
        background: 'var(--color-success)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <Check size={24} color="#fff" strokeWidth={3} />
      </div>
      <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--color-success)' }}>
        Imported {count} {kind === 'products' ? 'product' : 'supplier'}{count === 1 ? '' : 's'}
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <button onClick={onAnother} style={ghostBtnStyle}>Import another batch</button>
        <button onClick={onDone} style={primaryBtnStyle}>Back to suppliers</button>
      </div>
    </div>
  );
}

const previewRowStyle: React.CSSProperties = {
  display: 'flex', gap: 12, padding: '10px 14px',
  borderBottom: '1px solid var(--color-border-subtle)', alignItems: 'center',
};
const backBtnStyle: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: 6,
  background: 'transparent', border: 'none',
  color: 'var(--color-text-muted)',
  fontSize: 13, fontWeight: 600,
  fontFamily: 'var(--font-primary)',
  cursor: 'pointer', padding: '6px 0',
};
const primaryBtnStyle: React.CSSProperties = {
  padding: '9px 16px', borderRadius: 10, border: 'none',
  background: 'var(--color-accent-active)',
  color: '#fff', fontSize: 13, fontWeight: 700,
  cursor: 'pointer', fontFamily: 'var(--font-primary)',
};
const ghostBtnStyle: React.CSSProperties = {
  padding: '9px 14px', borderRadius: 10,
  border: '1px solid var(--color-border)',
  background: '#fff',
  color: 'var(--color-text-primary)',
  fontSize: 13, fontWeight: 600,
  cursor: 'pointer', fontFamily: 'var(--font-primary)',
  display: 'inline-flex', alignItems: 'center', gap: 6,
};
