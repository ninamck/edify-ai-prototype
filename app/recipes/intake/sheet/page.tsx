'use client';

/**
 * Costing-sheet upload intake (Flow B).
 *
 * Single scrollable page with three internal steps:
 *   B1. Drop / upload a file
 *   B2. Confirm column mapping (Quinn pre-fills)
 *   B3. Preview the first 3 parsed recipes
 *
 * On confirm, navigates to `/recipes/intake/pos/run?source=sheet&n=10` which
 * reuses the existing batch Quinn UI, then to /recipes/intake/pos/done for the
 * summary. No patterns are created from a costing sheet (no POS modifier
 * signal), so the summary hides the "Shared groups" section when groups=0.
 */

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft,
  ArrowRight,
  Check,
  FileSpreadsheet,
  Upload,
  ChevronRight,
} from 'lucide-react';
import EdifyMark from '@/components/EdifyMark/EdifyMark';
import QuinnOrb from '@/components/Sidebar/QuinnOrb';
import { FITZROY_SHEET_INTAKE } from '@/components/Recipe/sheetIntakeFixtures';

type Stage = 'drop' | 'map' | 'preview';

export default function SheetIntakePage() {
  const router = useRouter();
  const data = FITZROY_SHEET_INTAKE;
  const [stage, setStage] = useState<Stage>('drop');
  const [dropHover, setDropHover] = useState(false);

  return (
    <div style={{ padding: '20px 24px 80px', maxWidth: '880px', margin: '0 auto', fontFamily: 'var(--font-primary)' }}>
      {/* Back */}
      <button
        onClick={() => router.push('/recipes/intake')}
        style={backBtnStyle}
      >
        <ArrowLeft size={14} strokeWidth={2} /> Back to Add recipes
      </button>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '14px', marginBottom: '16px' }}>
        <QuinnOrb state={stage === 'drop' ? 'idle' : 'ready'} size={38} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontSize: '11px', fontWeight: 700, letterSpacing: '0.1em',
              textTransform: 'uppercase', color: 'var(--color-accent-active)', marginBottom: '3px',
            }}
          >
            Quinn · Sheet intake
          </div>
          <h1 style={{ fontSize: '22px', fontWeight: 700, margin: '0 0 4px', color: 'var(--color-text-primary)' }}>
            Upload a costing sheet
          </h1>
          <p style={{ fontSize: '13px', color: 'var(--color-text-muted)', margin: 0, lineHeight: 1.5 }}>
            {stage === 'drop' && 'CSV or Excel. Group rows by a recipe-name column — one row per ingredient.'}
            {stage === 'map' && 'I guessed your columns. Confirm and I\u2019ll parse the sheet.'}
            {stage === 'preview' && 'Here are the first 3 recipes I parsed. The rest follow the same shape.'}
          </p>
        </div>
      </div>

      {/* Stepper */}
      <Stepper stage={stage} />

      {/* Stages */}
      <AnimatePresence mode="wait">
        {stage === 'drop' && (
          <motion.div
            key="drop"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.18 }}
          >
            <DropStage
              hover={dropHover}
              onHover={setDropHover}
              onDrop={() => setStage('map')}
              onTemplateClick={() => alert('Template download — not wired')}
            />
          </motion.div>
        )}

        {stage === 'map' && (
          <motion.div
            key="map"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.18 }}
          >
            <MapStage
              data={data}
              onBack={() => setStage('drop')}
              onConfirm={() => setStage('preview')}
            />
          </motion.div>
        )}

        {stage === 'preview' && (
          <motion.div
            key="preview"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.18 }}
          >
            <PreviewStage
              data={data}
              onBack={() => setStage('map')}
              onDraftAll={() => router.push(`/recipes/intake/pos/run?source=sheet&n=${data.totalRecipes}&groups=0`)}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Stepper ──────────────────────────────────────────────────────────────────

function Stepper({ stage }: { stage: Stage }) {
  const steps: { id: Stage; label: string }[] = [
    { id: 'drop',    label: 'Upload' },
    { id: 'map',     label: 'Map columns' },
    { id: 'preview', label: 'Preview' },
  ];
  const idx = steps.findIndex((s) => s.id === stage);
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
      {steps.map((s, i) => {
        const done = i < idx;
        const active = i === idx;
        return (
          <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div
              style={{
                display: 'inline-flex', alignItems: 'center', gap: '8px',
                padding: '6px 12px', borderRadius: '100px',
                border: active ? '1px solid transparent' : '1px solid var(--color-border-subtle)',
                background: active ? 'var(--color-accent-active)' : done ? 'var(--color-success-light)' : '#fff',
                color: active ? '#fff' : done ? 'var(--color-success)' : 'var(--color-text-muted)',
                fontSize: '12px', fontWeight: 600,
              }}
            >
              {done
                ? <Check size={12} strokeWidth={2.6} />
                : <span style={{ width: '16px', height: '16px', borderRadius: '50%', background: active ? 'rgba(255,255,255,0.25)' : 'var(--color-bg-hover)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', fontWeight: 700 }}>{i + 1}</span>
              }
              {s.label}
            </div>
            {i < steps.length - 1 && <ChevronRight size={14} color="var(--color-text-muted)" />}
          </div>
        );
      })}
    </div>
  );
}

// ── B1 — Drop ────────────────────────────────────────────────────────────────

function DropStage({
  hover, onHover, onDrop, onTemplateClick,
}: {
  hover: boolean;
  onHover: (v: boolean) => void;
  onDrop: () => void;
  onTemplateClick: () => void;
}) {
  return (
    <div style={cardStyle}>
      <label
        onMouseEnter={() => onHover(true)}
        onMouseLeave={() => onHover(false)}
        style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          gap: '10px', padding: '36px 24px',
          borderRadius: '12px',
          border: `1.5px dashed ${hover ? 'var(--color-accent-active)' : 'var(--color-border)'}`,
          background: hover ? 'var(--color-bg-hover)' : '#fff',
          cursor: 'pointer',
          transition: 'all 0.15s',
          textAlign: 'center',
        }}
      >
        <Upload size={30} color={hover ? 'var(--color-accent-active)' : 'var(--color-text-muted)'} strokeWidth={1.6} />
        <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--color-text-primary)' }}>
          Drop a CSV or Excel file here
        </div>
        <div style={{ fontSize: '12.5px', color: 'var(--color-text-muted)' }}>
          — or click to browse —
        </div>
        <input
          type="file"
          accept=".csv,.xlsx,.xls"
          onChange={() => onDrop()}
          style={{ display: 'none' }}
        />
      </label>

      <div
        style={{
          marginTop: '14px', padding: '12px 14px',
          borderRadius: '10px', background: 'var(--color-bg-hover)',
          display: 'flex', alignItems: 'flex-start', gap: '10px',
        }}
      >
        <FileSpreadsheet size={16} color="var(--color-text-muted)" strokeWidth={1.8} style={{ flexShrink: 0, marginTop: '2px' }} />
        <div style={{ flex: 1, fontSize: '12.5px', color: 'var(--color-text-secondary)', lineHeight: 1.5 }}>
          <strong style={{ color: 'var(--color-text-primary)' }}>How to shape your sheet:</strong>
          <ul style={{ margin: '4px 0 0', paddingLeft: '18px' }}>
            <li>One row per ingredient</li>
            <li>Group rows by a Recipe-name column (I&apos;ll detect it)</li>
            <li>Unit cost and yield are optional but help costing accuracy</li>
          </ul>
        </div>
      </div>

      <div style={{ marginTop: '14px', textAlign: 'center' }}>
        <button
          onClick={onTemplateClick}
          style={{
            padding: '8px 14px',
            borderRadius: '10px',
            border: '1px solid var(--color-border)',
            background: '#fff',
            fontSize: '12.5px', fontWeight: 600,
            color: 'var(--color-text-primary)',
            fontFamily: 'var(--font-primary)',
            cursor: 'pointer',
          }}
        >
          Download example template
        </button>
      </div>

      {/* Demo helper */}
      <div
        style={{
          marginTop: '14px',
          padding: '10px 12px',
          borderRadius: '10px',
          border: '1px dashed var(--color-border-subtle)',
          background: 'linear-gradient(180deg, #FEFCF9 0%, #fff 100%)',
          display: 'flex', alignItems: 'center', gap: '10px',
        }}
      >
        <EdifyMark size={14} color="var(--color-accent-active)" strokeWidth={2} />
        <span style={{ fontSize: '12px', color: 'var(--color-text-muted)', flex: 1 }}>
          Demo tip: click to jump straight to the mapped preview with fitzroy-brunch-costing.xlsx.
        </span>
        <button
          onClick={onDrop}
          style={primaryBtnSm}
        >
          Use demo sheet
        </button>
      </div>
    </div>
  );
}

// ── B2 — Column mapping ──────────────────────────────────────────────────────

function MapStage({
  data, onBack, onConfirm,
}: {
  data: typeof FITZROY_SHEET_INTAKE;
  onBack: () => void;
  onConfirm: () => void;
}) {
  return (
    <div style={cardStyle}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px' }}>
        <FileSpreadsheet size={16} color="var(--color-text-muted)" strokeWidth={1.8} />
        <div style={{ fontSize: '13.5px', fontWeight: 600, color: 'var(--color-text-primary)' }}>{data.filename}</div>
        <div style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>· {data.totalRows} rows · {data.totalRecipes} recipes</div>
      </div>

      {/* Mapping list */}
      <div
        style={{
          border: '1px solid var(--color-border-subtle)',
          borderRadius: '10px',
          background: '#fff',
          overflow: 'hidden',
          marginBottom: '14px',
        }}
      >
        {data.columnMapping.map((col, i) => (
          <div
            key={col.key}
            style={{
              display: 'grid',
              gridTemplateColumns: '140px 1fr 28px',
              gap: '12px',
              padding: '10px 12px',
              alignItems: 'center',
              borderBottom: i < data.columnMapping.length - 1 ? '1px solid var(--color-border-subtle)' : 'none',
            }}
          >
            <span style={{ fontSize: '12.5px', fontWeight: 600, color: 'var(--color-text-primary)' }}>{col.label}</span>
            <select
              defaultValue={col.guessed}
              style={{
                padding: '7px 10px',
                borderRadius: '8px',
                border: '1px solid var(--color-border)',
                fontSize: '12.5px',
                fontFamily: 'var(--font-primary)',
                color: 'var(--color-text-primary)',
                background: '#fff',
                outline: 'none',
              }}
            >
              <option>{col.guessed}</option>
              <option>— none —</option>
            </select>
            <Check size={14} color="var(--color-success)" strokeWidth={2.5} />
          </div>
        ))}
      </div>

      {/* Raw sheet preview */}
      <div style={{ marginBottom: '14px' }}>
        <div style={sectionLabelStyle}>Preview (first 8 rows of your sheet)</div>
        <div
          style={{
            border: '1px solid var(--color-border-subtle)',
            borderRadius: '10px',
            overflowX: 'auto',
          }}
        >
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11.5px' }}>
            <thead>
              <tr style={{ background: '#FBFAF8' }}>
                {data.samplePreview.cols.map((c) => (
                  <th
                    key={c}
                    style={{
                      padding: '8px 10px', textAlign: 'left',
                      fontSize: '10.5px', fontWeight: 700,
                      textTransform: 'uppercase', letterSpacing: '0.06em',
                      color: 'var(--color-text-muted)',
                      borderBottom: '1px solid var(--color-border-subtle)',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {c}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.samplePreview.rows.map((row, i) => (
                <tr key={i} style={{ borderBottom: i < data.samplePreview.rows.length - 1 ? '1px solid var(--color-border-subtle)' : 'none' }}>
                  {row.map((v, j) => (
                    <td
                      key={j}
                      style={{
                        padding: '7px 10px',
                        color: j === 1 || j === 3 ? 'var(--color-text-primary)' : 'var(--color-text-secondary)',
                        fontWeight: j === 1 || j === 3 ? 600 : 400,
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {v}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
        <button onClick={onBack} style={secondaryBtn}>Back</button>
        <button onClick={onConfirm} style={primaryBtn}>
          Next: preview 3 recipes <ArrowRight size={13} strokeWidth={2} />
        </button>
      </div>
    </div>
  );
}

// ── B3 — 3-recipe preview ────────────────────────────────────────────────────

function PreviewStage({
  data, onBack, onDraftAll,
}: {
  data: typeof FITZROY_SHEET_INTAKE;
  onBack: () => void;
  onDraftAll: () => void;
}) {
  const sample = data.recipes.slice(0, 3);
  return (
    <div style={cardStyle}>
      <div style={{ fontSize: '12.5px', color: 'var(--color-text-muted)', marginBottom: '14px' }}>
        First 3 of {data.totalRecipes} parsed. The rest follow the same shape — I&apos;ll draft them all in the next step.
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {sample.map((r) => (
          <RecipePreviewCard key={r.id} recipe={r} />
        ))}
      </div>

      <div style={{ marginTop: '18px', display: 'flex', justifyContent: 'space-between', gap: '8px' }}>
        <button onClick={onBack} style={secondaryBtn}>Back to mapping</button>
        <button onClick={onDraftAll} style={primaryBtn}>
          <EdifyMark size={13} strokeWidth={2} />
          Draft all {data.totalRecipes} with Quinn
        </button>
      </div>
    </div>
  );
}

function RecipePreviewCard({ recipe }: { recipe: typeof FITZROY_SHEET_INTAKE.recipes[number] }) {
  return (
    <div
      style={{
        border: '1px solid var(--color-border-subtle)',
        borderRadius: '12px',
        background: '#fff',
      }}
    >
      <div
        style={{
          display: 'flex', alignItems: 'center', gap: '8px',
          padding: '10px 14px',
          borderBottom: '1px solid var(--color-border-subtle)',
          background: '#FBFAF8',
          borderTopLeftRadius: '12px', borderTopRightRadius: '12px',
        }}
      >
        <span style={{ fontSize: '13.5px', fontWeight: 700, color: 'var(--color-text-primary)' }}>{recipe.name}</span>
        <span style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>
          · {recipe.category} · yields {recipe.yieldQty} {recipe.yieldUom}
        </span>
      </div>
      <div>
        {recipe.ingredients.map((ing, i) => (
          <div
            key={i}
            style={{
              display: 'grid',
              gridTemplateColumns: '1.6fr 70px 70px 1fr 110px',
              gap: '10px',
              padding: '8px 14px',
              alignItems: 'center',
              borderBottom: i < recipe.ingredients.length - 1 ? '1px solid var(--color-border-subtle)' : 'none',
              fontSize: '12.5px',
            }}
          >
            <span style={{ color: 'var(--color-text-primary)', fontWeight: 600 }}>{ing.name}</span>
            <span style={{ color: 'var(--color-text-secondary)' }}>{ing.qty}</span>
            <span style={{ color: 'var(--color-text-secondary)' }}>{ing.uom}</span>
            <span style={{ color: 'var(--color-text-muted)' }}>{ing.supplier}</span>
            <span style={{ textAlign: 'right' }}>
              {ing.matched ? (
                <span
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: '4px',
                    padding: '2px 8px', borderRadius: '100px',
                    background: 'var(--color-success-light)', color: 'var(--color-success)',
                    fontSize: '11px', fontWeight: 600,
                  }}
                >
                  <Check size={10} strokeWidth={2.6} />
                  matched
                </span>
              ) : (
                <span
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: '4px',
                    padding: '2px 8px', borderRadius: '100px',
                    background: 'var(--color-warning-light)', color: 'var(--color-warning)',
                    fontSize: '11px', fontWeight: 600,
                  }}
                  title={ing.note}
                >
                  new
                </span>
              )}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Styles ───────────────────────────────────────────────────────────────────

const cardStyle: React.CSSProperties = {
  padding: '18px',
  borderRadius: '12px',
  border: '1px solid var(--color-border-subtle)',
  background: '#fff',
};

const backBtnStyle: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: '6px',
  background: 'transparent', border: 'none',
  color: 'var(--color-text-muted)', fontSize: '13px', fontWeight: 600,
  cursor: 'pointer', padding: '6px 0', marginBottom: '14px',
  fontFamily: 'var(--font-primary)',
};

const sectionLabelStyle: React.CSSProperties = {
  fontSize: '11px', fontWeight: 700, letterSpacing: '0.08em',
  textTransform: 'uppercase', color: 'var(--color-text-muted)',
  marginBottom: '8px',
};

const primaryBtn: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: '7px',
  padding: '10px 16px', borderRadius: '10px', border: 'none',
  background: 'var(--color-accent-active)', color: '#fff',
  fontSize: '13px', fontWeight: 600, fontFamily: 'var(--font-primary)',
  cursor: 'pointer',
};

const primaryBtnSm: React.CSSProperties = {
  ...primaryBtn,
  padding: '7px 12px', fontSize: '12px',
};

const secondaryBtn: React.CSSProperties = {
  padding: '10px 16px', borderRadius: '10px',
  border: '1px solid var(--color-border)', background: '#fff',
  fontSize: '13px', fontWeight: 600, fontFamily: 'var(--font-primary)',
  color: 'var(--color-text-primary)',
  cursor: 'pointer',
};
