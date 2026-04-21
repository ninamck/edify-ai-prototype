'use client';

/**
 * Photo intake — Flow C. Single-recipe path (mobile-first, usable on desktop).
 *
 * State machine in one page:
 *   C1 capture — drop/upload area + "Use demo photo" shortcut
 *   C2 review  — edit-in-place OCR result with confidence tags
 *
 * On "Send to Quinn" → /recipes/intake/photo/process which runs a single
 * RecipeChatWorking pass and shows a save confirmation.
 */

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft, ArrowRight, Camera, Check, Image as ImageIcon, Plus,
  Sparkles, X, ChevronRight,
} from 'lucide-react';
import QuinnOrb from '@/components/Sidebar/QuinnOrb';
import {
  PHOTO_INTAKE_FIXTURE, OcrRecipe, OcrIngredient, Confidence, confidenceColor,
} from '@/components/Recipe/photoIntakeFixtures';

type Stage = 'capture' | 'review';

const UOMS = ['g', 'kg', 'ml', 'L', 'unit', 'slice', 'tsp', 'tbsp'];
const CATEGORIES = ['Coffee', 'Tea', 'Pastry', 'Food', 'Wine', 'Spirits', 'Kids'];

export default function PhotoIntakePage() {
  const router = useRouter();
  const [stage, setStage] = useState<Stage>('capture');
  const [hover, setHover] = useState(false);
  const [recipe, setRecipe] = useState<OcrRecipe>(() => JSON.parse(JSON.stringify(PHOTO_INTAKE_FIXTURE)));

  function startReview() {
    setRecipe(JSON.parse(JSON.stringify(PHOTO_INTAKE_FIXTURE)));
    setStage('review');
  }

  return (
    <div style={{ padding: '20px 24px 80px', maxWidth: '880px', margin: '0 auto', fontFamily: 'var(--font-primary)' }}>
      <button onClick={() => router.push('/recipes/intake')} style={backBtnStyle}>
        <ArrowLeft size={14} strokeWidth={2} /> Back to Add recipes
      </button>

      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '14px', marginBottom: '16px' }}>
        <QuinnOrb state={stage === 'capture' ? 'idle' : 'ready'} size={38} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={quinnLabelStyle}>Quinn · Photo intake</div>
          <h1 style={{ fontSize: '22px', fontWeight: 700, margin: '0 0 4px', color: 'var(--color-text-primary)' }}>
            Photo of a recipe sheet
          </h1>
          <p style={{ fontSize: '13px', color: 'var(--color-text-muted)', margin: 0, lineHeight: 1.5 }}>
            {stage === 'capture' && 'Snap a handwritten card or printed page. Works on mobile too.'}
            {stage === 'review' && 'Here\u2019s what I read off the page. Tweak anything that looks off, then send it to me.'}
          </p>
        </div>
      </div>

      {/* Stepper */}
      <Stepper stage={stage} />

      <AnimatePresence mode="wait">
        {stage === 'capture' && (
          <motion.div
            key="capture"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.18 }}
          >
            <CaptureStage
              hover={hover}
              onHover={setHover}
              onUpload={startReview}
            />
          </motion.div>
        )}

        {stage === 'review' && (
          <motion.div
            key="review"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.18 }}
          >
            <ReviewStage
              recipe={recipe}
              onChange={setRecipe}
              onBack={() => setStage('capture')}
              onSubmit={() => router.push('/recipes/intake/photo/process')}
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
    { id: 'capture', label: 'Photo' },
    { id: 'review',  label: 'Review OCR' },
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

// ── C1 capture ───────────────────────────────────────────────────────────────

function CaptureStage({
  hover, onHover, onUpload,
}: {
  hover: boolean; onHover: (v: boolean) => void; onUpload: () => void;
}) {
  return (
    <div style={cardStyle}>
      <label
        onMouseEnter={() => onHover(true)}
        onMouseLeave={() => onHover(false)}
        style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          gap: '12px', padding: '40px 24px',
          borderRadius: '12px',
          border: `1.5px dashed ${hover ? 'var(--color-accent-active)' : 'var(--color-border)'}`,
          background: hover ? 'var(--color-bg-hover)' : '#fff',
          cursor: 'pointer',
          transition: 'all 0.15s',
          textAlign: 'center',
        }}
      >
        <Camera size={34} color={hover ? 'var(--color-accent-active)' : 'var(--color-text-muted)'} strokeWidth={1.6} />
        <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--color-text-primary)' }}>
          Take a photo or drop an image
        </div>
        <div style={{ fontSize: '12.5px', color: 'var(--color-text-muted)', maxWidth: '360px' }}>
          On mobile this opens the camera. On desktop drop a PNG / JPEG of a recipe card, menu page, or spec sheet.
        </div>
        <input
          type="file"
          accept="image/*"
          capture="environment"
          onChange={() => onUpload()}
          style={{ display: 'none' }}
        />
      </label>

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
        <Sparkles size={14} color="var(--color-accent-active)" strokeWidth={2} />
        <span style={{ fontSize: '12px', color: 'var(--color-text-muted)', flex: 1 }}>
          Demo tip: jump straight to a parsed handwritten card (House banana bread).
        </span>
        <button onClick={onUpload} style={primaryBtnSm}>Use demo photo</button>
      </div>
    </div>
  );
}

// ── C2 review ────────────────────────────────────────────────────────────────

function ReviewStage({
  recipe, onChange, onBack, onSubmit,
}: {
  recipe: OcrRecipe;
  onChange: (r: OcrRecipe) => void;
  onBack: () => void;
  onSubmit: () => void;
}) {
  const lowCount = [
    recipe.name, recipe.category, recipe.yieldQty, recipe.yieldUom,
    ...recipe.ingredients.flatMap((i) => [i.name, i.qty, i.uom, ...(i.supplier ? [i.supplier] : [])]),
  ].filter((f) => f.confidence === 'low').length;

  const mediumCount = [
    recipe.name, recipe.category, recipe.yieldQty, recipe.yieldUom,
    ...recipe.ingredients.flatMap((i) => [i.name, i.qty, i.uom, ...(i.supplier ? [i.supplier] : [])]),
  ].filter((f) => f.confidence === 'medium').length;

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '220px 1fr', gap: '16px', alignItems: 'start' }}>
      {/* Photo thumbnail (placeholder) */}
      <div
        style={{
          aspectRatio: '3 / 4',
          borderRadius: '12px',
          border: '1px solid var(--color-border-subtle)',
          background: `linear-gradient(140deg, hsl(${recipe.photoThumbnailHue}, 40%, 92%) 0%, hsl(${recipe.photoThumbnailHue}, 30%, 96%) 100%)`,
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* Fake "handwritten lines" */}
        <div style={{ padding: '18px 16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <div style={{ height: '12px', background: 'rgba(58,48,40,0.18)', borderRadius: '2px', width: '70%' }} />
          <div style={{ height: '2px', background: 'rgba(58,48,40,0.1)', width: '100%' }} />
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} style={{ height: '2px', background: 'rgba(58,48,40,0.1)', width: `${60 + (i * 4) % 30}%` }} />
          ))}
          <div style={{ marginTop: '12px', height: '2px', background: 'rgba(58,48,40,0.1)', width: '100%' }} />
        </div>
        <div
          style={{
            position: 'absolute', bottom: '10px', left: '10px', right: '10px',
            padding: '6px 10px', borderRadius: '8px',
            background: 'rgba(255,255,255,0.9)',
            fontSize: '11px', color: 'var(--color-text-muted)',
            display: 'flex', alignItems: 'center', gap: '6px',
          }}
        >
          <ImageIcon size={12} /> {recipe.photoLabel}
        </div>
      </div>

      {/* OCR form */}
      <div style={cardStyle}>
        {/* Summary badge */}
        <div
          style={{
            padding: '10px 12px',
            borderRadius: '10px',
            background: 'var(--color-bg-hover)',
            marginBottom: '14px',
            display: 'flex', alignItems: 'center', gap: '8px',
            fontSize: '12.5px', color: 'var(--color-text-secondary)',
          }}
        >
          <Sparkles size={13} color="var(--color-accent-active)" strokeWidth={2} />
          <span style={{ flex: 1 }}>
            I&apos;m confident on most of it.
            {mediumCount > 0 && <> <strong>{mediumCount} field{mediumCount === 1 ? '' : 's'}</strong> worth a glance</>}
            {lowCount > 0 && <>, <strong style={{ color: 'var(--color-warning)' }}>{lowCount} needs review</strong></>}.
          </span>
        </div>

        {/* Name */}
        <FieldLabel>Recipe name</FieldLabel>
        <OcrRow field={recipe.name}>
          <input
            value={recipe.name.value}
            onChange={(e) => onChange({ ...recipe, name: { ...recipe.name, value: e.target.value, confidence: 'high' } })}
            style={nameInputStyle}
          />
        </OcrRow>

        {/* Category + Yield */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginTop: '14px' }}>
          <div>
            <FieldLabel>Category</FieldLabel>
            <OcrRow field={recipe.category}>
              <select
                value={recipe.category.value}
                onChange={(e) => onChange({ ...recipe, category: { ...recipe.category, value: e.target.value, confidence: 'high' } })}
                style={inputStyle}
              >
                {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </OcrRow>
          </div>
          <div>
            <FieldLabel>Yield</FieldLabel>
            <div style={{ display: 'flex', gap: '6px' }}>
              <OcrRow field={recipe.yieldQty} compact>
                <input
                  type="number"
                  value={recipe.yieldQty.value}
                  onChange={(e) => onChange({ ...recipe, yieldQty: { ...recipe.yieldQty, value: Number(e.target.value), confidence: 'high' } })}
                  style={{ ...inputStyle, width: '80px', flexShrink: 0 }}
                />
              </OcrRow>
              <OcrRow field={recipe.yieldUom} compact>
                <select
                  value={recipe.yieldUom.value}
                  onChange={(e) => onChange({ ...recipe, yieldUom: { ...recipe.yieldUom, value: e.target.value, confidence: 'high' } })}
                  style={{ ...inputStyle, flex: 1 }}
                >
                  {['slice', 'serving', 'portion', 'unit', 'kg', 'L'].map((u) => <option key={u} value={u}>{u}</option>)}
                </select>
              </OcrRow>
            </div>
          </div>
        </div>

        {/* Ingredients */}
        <div style={{ marginTop: '18px' }}>
          <FieldLabel>Ingredients</FieldLabel>
          <div style={{ border: '1px solid var(--color-border-subtle)', borderRadius: '10px', overflow: 'hidden' }}>
            {recipe.ingredients.map((ing, i) => (
              <IngredientRow
                key={ing.id}
                ing={ing}
                isLast={i === recipe.ingredients.length - 1}
                onChange={(patch) => {
                  const next = { ...recipe, ingredients: recipe.ingredients.map((r, idx) => idx === i ? { ...r, ...patch } : r) };
                  onChange(next);
                }}
                onRemove={() => {
                  onChange({ ...recipe, ingredients: recipe.ingredients.filter((_, idx) => idx !== i) });
                }}
              />
            ))}
          </div>
          <button
            onClick={() => {
              const newIng: OcrIngredient = {
                id: `i${Math.random().toString(36).slice(2, 8)}`,
                name: { value: '', confidence: 'high' },
                qty: { value: 0, confidence: 'high' },
                uom: { value: 'g', confidence: 'high' },
              };
              onChange({ ...recipe, ingredients: [...recipe.ingredients, newIng] });
            }}
            style={{
              marginTop: '10px',
              padding: '8px 12px', borderRadius: '8px',
              border: '1px dashed var(--color-border)', background: 'var(--color-bg-hover)',
              color: 'var(--color-text-primary)', fontSize: '12.5px', fontWeight: 600,
              cursor: 'pointer', fontFamily: 'var(--font-primary)',
              display: 'inline-flex', alignItems: 'center', gap: '6px',
            }}
          >
            <Plus size={13} strokeWidth={2.2} /> Add ingredient
          </button>
        </div>

        {/* Notes */}
        {recipe.notes && (
          <div style={{ marginTop: '18px' }}>
            <FieldLabel>Notes from the card</FieldLabel>
            <OcrRow field={recipe.notes}>
              <textarea
                value={recipe.notes.value}
                onChange={(e) => onChange({ ...recipe, notes: { ...recipe.notes!, value: e.target.value, confidence: 'high' } })}
                rows={2}
                style={textareaStyle}
              />
            </OcrRow>
          </div>
        )}

        {/* Actions */}
        <div style={{ marginTop: '18px', display: 'flex', justifyContent: 'space-between', gap: '8px' }}>
          <button onClick={onBack} style={secondaryBtn}>Retake</button>
          <button onClick={onSubmit} style={primaryBtn}>
            <Sparkles size={13} strokeWidth={2} /> Send to Quinn <ArrowRight size={13} strokeWidth={2} />
          </button>
        </div>
      </div>
    </div>
  );
}

function IngredientRow({
  ing, isLast, onChange, onRemove,
}: {
  ing: OcrIngredient; isLast: boolean;
  onChange: (patch: Partial<OcrIngredient>) => void;
  onRemove: () => void;
}) {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '1.8fr 70px 80px 1fr 24px',
        gap: '8px',
        padding: '8px 10px',
        alignItems: 'center',
        borderBottom: isLast ? 'none' : '1px solid var(--color-border-subtle)',
      }}
    >
      <OcrRow field={ing.name} compact>
        <input
          value={ing.name.value}
          onChange={(e) => onChange({ name: { ...ing.name, value: e.target.value, confidence: 'high' } })}
          style={cellInput}
        />
      </OcrRow>
      <OcrRow field={ing.qty} compact>
        <input
          type="number"
          value={ing.qty.value}
          onChange={(e) => onChange({ qty: { ...ing.qty, value: Number(e.target.value), confidence: 'high' } })}
          style={cellInput}
        />
      </OcrRow>
      <OcrRow field={ing.uom} compact>
        <select
          value={ing.uom.value}
          onChange={(e) => onChange({ uom: { ...ing.uom, value: e.target.value, confidence: 'high' } })}
          style={cellInput}
        >
          {UOMS.map((u) => <option key={u} value={u}>{u}</option>)}
        </select>
      </OcrRow>
      {ing.supplier ? (
        <OcrRow field={ing.supplier} compact>
          <input
            value={ing.supplier.value}
            onChange={(e) => onChange({ supplier: { ...ing.supplier!, value: e.target.value, confidence: 'high' } })}
            style={cellInput}
          />
        </OcrRow>
      ) : <span />}
      <button onClick={onRemove} aria-label="Remove" style={rowRemoveStyle}>
        <X size={13} />
      </button>
    </div>
  );
}

function OcrRow({
  field, children, compact,
}: {
  field: { confidence: Confidence };
  children: React.ReactNode;
  compact?: boolean;
}) {
  const c = confidenceColor(field.confidence);
  if (field.confidence === 'high') {
    // High-confidence fields render cleanly without a tag
    return <div style={{ position: 'relative' }}>{children}</div>;
  }
  return (
    <div style={{ position: 'relative' }}>
      {children}
      {!compact && (
        <span
          style={{
            position: 'absolute',
            right: '6px', top: '50%', transform: 'translateY(-50%)',
            padding: '2px 7px', borderRadius: '100px',
            background: c.bg, color: c.fg,
            fontSize: '10.5px', fontWeight: 600,
            pointerEvents: 'none',
          }}
        >
          {c.label}
        </span>
      )}
      {compact && field.confidence === 'low' && (
        <span
          style={{
            position: 'absolute',
            right: '4px', top: '-6px',
            width: '8px', height: '8px', borderRadius: '50%',
            background: 'var(--color-warning)',
            border: '2px solid #fff',
          }}
        />
      )}
    </div>
  );
}

// ── Styles (shared with sheet page pattern) ───────────────────────────────────

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

const quinnLabelStyle: React.CSSProperties = {
  fontSize: '11px', fontWeight: 700, letterSpacing: '0.1em',
  textTransform: 'uppercase', color: 'var(--color-accent-active)',
  marginBottom: '3px',
};

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        fontSize: '11px', fontWeight: 700, letterSpacing: '0.06em',
        textTransform: 'uppercase', color: 'var(--color-text-muted)',
        marginBottom: '6px',
      }}
    >
      {children}
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '8px 10px',
  borderRadius: '8px',
  border: '1px solid var(--color-border)',
  fontSize: '13px',
  fontFamily: 'var(--font-primary)',
  color: 'var(--color-text-primary)',
  background: '#fff',
  outline: 'none',
  boxSizing: 'border-box',
};

const nameInputStyle: React.CSSProperties = {
  ...inputStyle,
  fontSize: '15px',
  fontWeight: 600,
  paddingRight: '80px',
};

const textareaStyle: React.CSSProperties = {
  ...inputStyle,
  resize: 'vertical',
  minHeight: '60px',
  fontFamily: 'var(--font-primary)',
};

const cellInput: React.CSSProperties = {
  width: '100%',
  padding: '6px 8px',
  borderRadius: '6px',
  border: '1px solid var(--color-border-subtle)',
  fontSize: '12.5px',
  fontFamily: 'var(--font-primary)',
  color: 'var(--color-text-primary)',
  background: '#fff',
  outline: 'none',
  boxSizing: 'border-box',
};

const rowRemoveStyle: React.CSSProperties = {
  width: '24px', height: '24px',
  border: 'none', background: 'transparent',
  cursor: 'pointer', color: 'var(--color-text-muted)',
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
  borderRadius: '6px',
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
