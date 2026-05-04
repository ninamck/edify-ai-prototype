'use client';

// Shared form primitives, tables, and the right-column Price card used by
// both the "Build recipe manually" intake page and the [id]/edit page.
//
// Keeping these in one place keeps the two pages visually identical and lets
// us extend the form once.

import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Plus, X, Check, ChevronDown, ChevronRight, AlertTriangle,
  ArrowUp, ArrowDown,
} from 'lucide-react';
import type {
  ComponentRow,
  ItemComponent,
  RecipeComponent,
  Recipe,
} from '@/components/Recipe/libraryFixtures';

// ── Types & constants ────────────────────────────────────────────────────────

export type FormCategory =
  | 'Coffee' | 'Tea' | 'Pastry' | 'Food' | 'Wine' | 'Spirits' | 'Kids'
  | 'Bakery' | 'Sandwich' | 'Salad' | 'Snack' | 'Beverage';

export const FORM_CATEGORIES: FormCategory[] = [
  'Coffee', 'Tea', 'Pastry', 'Food', 'Wine', 'Spirits', 'Kids',
  'Bakery', 'Sandwich', 'Salad', 'Snack', 'Beverage',
];

export const SITES = ['Fitzroy Espresso', 'Brixton Outpost', 'Shoreditch Roast', 'Soho Annex'];

export const SUPPLIERS = [
  'Bidvest', 'Fresh Earth Produce', 'Rise Bakery', 'The Cheese Board',
  'CPU — Central Kitchen', 'In-house',
];

export const UOMS = ['g', 'kg', 'ml', 'L', 'unit', 'slice', 'tsp', 'tbsp', 'cup'];

export const ALLERGENS = [
  'Dairy', 'Eggs', 'Cereals containing gluten', 'Nuts', 'Peanuts',
  'Soya', 'Sesame Seeds', 'Mustard', 'Celery', 'Lupin',
  'Crustaceans', 'Fish', 'Molluscs', 'Sulphites',
];

export const PRODUCT_CLASSES = ['Beverage', 'Food', 'Retail', 'Other'];
export const STATUSES = ['Draft', 'Active', 'Archived'];
export const YIELD_UOMS = ['serving', 'portion', 'kg', 'L', 'unit'];
export const SHELF_LIFE_UNITS = ['minutes', 'hours', 'days'] as const;
export type ShelfLifeUnit = typeof SHELF_LIFE_UNITS[number];
export const BAKERY_HOT_PRODUCTION = ['None', 'Bakery', 'Hot production', 'Both'];
export const PRODUCTION_VIS = ['Bar', 'Kitchen', 'Pastry', 'Variable'];

export const CATEGORY_DEFAULTS: Record<FormCategory, {
  hotCold: 'hot' | 'cold' | null;
  production: string[];
  shelfLifeMin: number | null;
  prepSec: number;
  desiredMargin: number;
}> = {
  Coffee:   { hotCold: 'hot',  production: ['Bar'],     shelfLifeMin: null, prepSec: 90,  desiredMargin: 75 },
  Tea:      { hotCold: 'hot',  production: ['Bar'],     shelfLifeMin: null, prepSec: 60,  desiredMargin: 85 },
  Pastry:   { hotCold: 'cold', production: ['Pastry'],  shelfLifeMin: 480,  prepSec: 30,  desiredMargin: 65 },
  Food:     { hotCold: 'hot',  production: ['Kitchen'], shelfLifeMin: 30,   prepSec: 240, desiredMargin: 70 },
  Wine:     { hotCold: 'cold', production: ['Bar'],     shelfLifeMin: null, prepSec: 30,  desiredMargin: 60 },
  Spirits:  { hotCold: 'cold', production: ['Bar'],     shelfLifeMin: null, prepSec: 30,  desiredMargin: 78 },
  Kids:     { hotCold: 'hot',  production: ['Bar'],     shelfLifeMin: null, prepSec: 45,  desiredMargin: 80 },
  Bakery:   { hotCold: 'cold', production: ['Pastry'],  shelfLifeMin: 1440, prepSec: 30,  desiredMargin: 65 },
  Sandwich: { hotCold: 'cold', production: ['Kitchen'], shelfLifeMin: 720,  prepSec: 60,  desiredMargin: 65 },
  Salad:    { hotCold: 'cold', production: ['Kitchen'], shelfLifeMin: 480,  prepSec: 60,  desiredMargin: 65 },
  Snack:    { hotCold: 'cold', production: ['Kitchen'], shelfLifeMin: 1440, prepSec: 20,  desiredMargin: 70 },
  Beverage: { hotCold: 'cold', production: ['Bar'],     shelfLifeMin: null, prepSec: 30,  desiredMargin: 70 },
};

export type IngredientRow = {
  id: string;
  name: string;
  supplier: string;
  qty: number | '';
  uom: string;
  unitCostP: number;
};

export type VariableRow = IngredientRow & { type: string };
export type PackagingRow = IngredientRow;

export function newId(): string {
  return Math.random().toString(36).slice(2, 10);
}

export function emptyIngredient(): IngredientRow {
  return { id: newId(), name: '', supplier: '', qty: '', uom: 'g', unitCostP: 0 };
}

export function emptyVariable(): VariableRow {
  return { id: newId(), name: '', supplier: '', qty: '', uom: 'g', unitCostP: 0, type: 'Alternative' };
}

export function emptyPackaging(): PackagingRow {
  return { id: newId(), name: '', supplier: '', qty: '', uom: 'unit', unitCostP: 0 };
}

export function emptyItemComponent(): ItemComponent {
  return { id: newId(), kind: 'item', name: '', supplier: '', qty: '', uom: 'g', unitCostP: 0 };
}

export function newRecipeComponent(recipeId: string): RecipeComponent {
  return { id: newId(), kind: 'recipe', recipeId, qty: 1, uom: 'unit' };
}

// ── Cards / shells ────────────────────────────────────────────────────────────

export function Card({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        padding: '16px',
        borderRadius: '12px',
        border: '1px solid var(--color-border-subtle)',
        background: '#fff',
      }}
    >
      {children}
    </div>
  );
}

export function CollapsibleCard({
  label, hint, open, onToggle, children,
}: {
  label: string; hint?: string; open: boolean; onToggle: () => void; children: React.ReactNode;
}) {
  return (
    <div
      style={{
        borderRadius: '12px',
        border: '1px solid var(--color-border-subtle)',
        background: '#fff',
        overflow: 'hidden',
      }}
    >
      <button
        onClick={onToggle}
        style={{
          width: '100%',
          display: 'flex', alignItems: 'center', gap: '10px',
          padding: '14px 16px', border: 'none', background: '#fff',
          cursor: 'pointer', textAlign: 'left', fontFamily: 'var(--font-primary)',
        }}
      >
        {open ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
        <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--color-text-primary)' }}>{label}</span>
        {hint && <span style={{ flex: 1, fontSize: '12.5px', color: 'var(--color-text-muted)' }}>{hint}</span>}
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.18 }}
            style={{ overflow: 'hidden', borderTop: '1px solid var(--color-border-subtle)' }}
          >
            <div style={{ padding: '14px 16px' }}>{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export function SectionHeader({ title, hint }: { title: string; hint?: string }) {
  return (
    <div style={{ marginBottom: '10px' }}>
      <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--color-text-primary)', marginBottom: '2px' }}>
        {title}
      </div>
      {hint && <div style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>{hint}</div>}
    </div>
  );
}

export function FieldLabel({ children, required }: { children: React.ReactNode; required?: boolean }) {
  return (
    <div
      style={{
        fontSize: '11px', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase',
        color: 'var(--color-text-muted)', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '4px',
      }}
    >
      {children}
      {required && <span style={{ color: 'var(--color-error)' }}>*</span>}
    </div>
  );
}

export function Soft({ children }: { children: React.ReactNode }) {
  return (
    <span style={{ color: 'var(--color-text-muted)', fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>
      {children}
    </span>
  );
}

// ── Pills, tag input, check row ───────────────────────────────────────────────

export function PillMulti({
  options, selected, onChange,
}: {
  options: readonly string[]; selected: string[]; onChange: (sel: string[]) => void;
}) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
      {options.map((opt) => {
        const on = selected.includes(opt);
        return (
          <button
            key={opt}
            onClick={() => onChange(on ? selected.filter((s) => s !== opt) : [...selected, opt])}
            style={{
              padding: '6px 12px',
              borderRadius: '100px',
              border: on ? '1px solid transparent' : '1px solid var(--color-border-subtle)',
              background: on ? 'var(--color-accent-active)' : '#fff',
              color: on ? '#fff' : 'var(--color-text-secondary)',
              fontSize: '12px', fontWeight: 600,
              cursor: 'pointer', fontFamily: 'var(--font-primary)',
              display: 'inline-flex', alignItems: 'center', gap: '5px',
            }}
          >
            {on && <Check size={11} strokeWidth={2.6} />}
            {opt}
          </button>
        );
      })}
    </div>
  );
}

export function PillSingle({
  options, selected, onChange, allowClear,
}: {
  options: readonly string[];
  selected: string;
  onChange: (v: string) => void;
  allowClear?: boolean;
}) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
      {options.map((opt) => {
        const on = selected === opt;
        return (
          <button
            key={opt}
            onClick={() => onChange(allowClear && on ? '' : opt)}
            style={{
              padding: '6px 12px',
              borderRadius: '100px',
              border: on ? '1px solid transparent' : '1px solid var(--color-border-subtle)',
              background: on ? 'var(--color-accent-active)' : '#fff',
              color: on ? '#fff' : 'var(--color-text-secondary)',
              fontSize: '12px', fontWeight: 600,
              cursor: 'pointer', fontFamily: 'var(--font-primary)',
              display: 'inline-flex', alignItems: 'center', gap: '5px',
            }}
          >
            {on && <Check size={11} strokeWidth={2.6} />}
            {opt}
          </button>
        );
      })}
    </div>
  );
}

export function TagInput({
  value, onChange, placeholder,
}: {
  value: string[]; onChange: (v: string[]) => void; placeholder?: string;
}) {
  const [draft, setDraft] = useState('');
  function addDraft() {
    const t = draft.trim();
    if (t && !value.includes(t)) onChange([...value, t]);
    setDraft('');
  }
  return (
    <div
      style={{
        display: 'flex', flexWrap: 'wrap', gap: '6px', alignItems: 'center',
        padding: '6px 8px', borderRadius: '8px', border: '1px solid var(--color-border)',
      }}
    >
      {value.map((t) => (
        <span
          key={t}
          style={{
            padding: '3px 8px 3px 10px',
            borderRadius: '100px',
            background: 'var(--color-bg-hover)',
            color: 'var(--color-text-primary)',
            fontSize: '12px', fontWeight: 600,
            display: 'inline-flex', alignItems: 'center', gap: '6px',
          }}
        >
          {t}
          <button
            onClick={() => onChange(value.filter((v) => v !== t))}
            aria-label={`Remove ${t}`}
            style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: 0, lineHeight: 0, color: 'var(--color-text-muted)' }}
          >
            <X size={11} />
          </button>
        </span>
      ))}
      <input
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addDraft(); } }}
        onBlur={addDraft}
        placeholder={placeholder}
        style={{
          border: 'none', outline: 'none', background: 'transparent',
          flex: 1, minWidth: '120px', fontSize: '13px',
          fontFamily: 'var(--font-primary)', color: 'var(--color-text-primary)',
          padding: '4px 4px',
        }}
      />
    </div>
  );
}

export function CheckRow({
  label, checked, onChange,
}: {
  label: string; checked: boolean; onChange: (v: boolean) => void;
}) {
  return (
    <button
      onClick={() => onChange(!checked)}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: '7px',
        padding: '7px 12px', borderRadius: '8px',
        border: '1px solid ' + (checked ? 'transparent' : 'var(--color-border-subtle)'),
        background: checked ? 'var(--color-accent-active)' : '#fff',
        color: checked ? '#fff' : 'var(--color-text-secondary)',
        fontSize: '12.5px', fontWeight: 600, cursor: 'pointer',
        fontFamily: 'var(--font-primary)',
      }}
    >
      <span
        style={{
          width: '14px', height: '14px', borderRadius: '4px',
          border: '1.5px solid ' + (checked ? '#fff' : 'var(--color-border)'),
          background: checked ? 'transparent' : '#fff',
          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
        }}
      >
        {checked && <Check size={10} color="#fff" strokeWidth={3} />}
      </span>
      {label}
    </button>
  );
}

// ── Unified component table (items + sub-recipes) ────────────────────────────

const COMPONENT_COLS = ['28px', '2fr', '1.4fr', '70px', '70px', '80px', '76px'];

export function ComponentTable({
  rows, recipesById, selfId, onChange,
}: {
  rows: ComponentRow[];
  recipesById: Map<string, Recipe>;
  /** Recipe id of the currently-edited recipe (excluded from the picker). */
  selfId?: string;
  onChange: (next: ComponentRow[]) => void;
}) {
  function update(id: string, patch: Partial<ComponentRow>) {
    onChange(
      rows.map((r) => (r.id === id ? ({ ...r, ...patch } as ComponentRow) : r)),
    );
  }
  function remove(id: string) {
    onChange(rows.filter((r) => r.id !== id));
  }
  function move(id: string, dir: -1 | 1) {
    const idx = rows.findIndex((r) => r.id === id);
    const target = idx + dir;
    if (idx < 0 || target < 0 || target >= rows.length) return;
    const next = [...rows];
    [next[idx], next[target]] = [next[target], next[idx]];
    onChange(next);
  }
  function addItem() {
    onChange([...rows, emptyItemComponent()]);
  }
  function addRecipe(recipeId: string) {
    if (rows.some((r) => r.kind === 'recipe' && r.recipeId === recipeId)) return;
    onChange([...rows, newRecipeComponent(recipeId)]);
  }

  const [pickerOpen, setPickerOpen] = useState(false);
  const candidates = Array.from(recipesById.values())
    .filter((r) => r.id !== selfId && !rows.some((row) => row.kind === 'recipe' && row.recipeId === r.id))
    .sort((a, b) => a.name.localeCompare(b.name));

  return (
    <>
      <div style={tableHeaderStyle(COMPONENT_COLS)}>
        <span />
        <span>Name</span>
        <span>Supplier / type</span>
        <span>Qty</span>
        <span>UoM</span>
        <span style={{ textAlign: 'right' }}>Cost</span>
        <span />
      </div>

      {rows.length === 0 && (
        <div style={{ padding: '16px 8px', textAlign: 'center', fontSize: '12.5px', color: 'var(--color-text-muted)' }}>
          No components yet. Add an ingredient or pick a sub-recipe to start.
        </div>
      )}

      {rows.map((row, i) => (
        <ComponentRowEdit
          key={row.id}
          row={row}
          index={i}
          total={rows.length}
          recipesById={recipesById}
          onPatch={(patch) => update(row.id, patch)}
          onRemove={() => remove(row.id)}
          onMoveUp={() => move(row.id, -1)}
          onMoveDown={() => move(row.id, 1)}
          onEnter={() => { if (i === rows.length - 1) addItem(); }}
        />
      ))}

      <div style={{ display: 'flex', gap: '8px', marginTop: '10px', flexWrap: 'wrap', position: 'relative' }}>
        <button
          onClick={addItem}
          style={addButtonStyle}
        >
          <Plus size={13} strokeWidth={2.2} /> Add ingredient
        </button>
        <button
          onClick={() => setPickerOpen((v) => !v)}
          style={addButtonStyle}
        >
          <Plus size={13} strokeWidth={2.2} /> Add sub-recipe
        </button>
        {pickerOpen && (
          <ComponentRecipePicker
            candidates={candidates}
            onPick={(id) => { addRecipe(id); setPickerOpen(false); }}
            onClose={() => setPickerOpen(false)}
          />
        )}
      </div>
    </>
  );
}

function ComponentRowEdit({
  row, index, total, recipesById,
  onPatch, onRemove, onMoveUp, onMoveDown, onEnter,
}: {
  row: ComponentRow;
  index: number;
  total: number;
  recipesById: Map<string, Recipe>;
  onPatch: (patch: Partial<ComponentRow>) => void;
  onRemove: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onEnter: () => void;
}) {
  const isRecipe = row.kind === 'recipe';
  const subRec = isRecipe ? recipesById.get(row.recipeId) : null;
  const qtyNum = typeof row.qty === 'number' ? row.qty : 0;
  const cost = isRecipe
    ? qtyNum * (subRec?.ingredientCost ?? 0)
    : (qtyNum * (row as ItemComponent).unitCostP) / 100;

  return (
    <div style={tableRowStyle(COMPONENT_COLS)}>
      <span
        style={{
          fontSize: '11px', fontWeight: 700,
          color: 'var(--color-text-muted)', textAlign: 'center',
        }}
      >
        {index + 1}
      </span>

      {isRecipe ? (
        <span
          style={{
            display: 'inline-flex', alignItems: 'center', gap: '6px',
            fontSize: '12.5px', fontWeight: 600,
            color: subRec ? 'var(--color-text-primary)' : 'var(--color-error)',
            minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}
        >
          {subRec ? subRec.name : `(missing recipe ${row.recipeId})`}
        </span>
      ) : (
        <input
          value={(row as ItemComponent).name}
          onChange={(e) => onPatch({ name: e.target.value } as Partial<ItemComponent>)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); onEnter(); } }}
          placeholder="Start typing…"
          style={cellInput}
        />
      )}

      {isRecipe ? (
        <span
          style={{
            display: 'inline-flex', alignItems: 'center',
            padding: '3px 9px', borderRadius: '100px',
            background: 'rgba(3,28,89,0.07)',
            color: 'var(--color-accent-active)',
            fontSize: '11px', fontWeight: 700, letterSpacing: '0.02em',
            alignSelf: 'flex-start',
          }}
        >
          Sub-recipe
        </span>
      ) : (
        <select
          value={(row as ItemComponent).supplier}
          onChange={(e) => onPatch({ supplier: e.target.value } as Partial<ItemComponent>)}
          style={cellSelect}
        >
          <option value="">—</option>
          {SUPPLIERS.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      )}

      <input
        type="number"
        min={0}
        step="any"
        value={row.qty}
        onChange={(e) => onPatch({ qty: e.target.value === '' ? '' : Number(e.target.value) })}
        onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); onEnter(); } }}
        style={cellInput}
      />

      <select value={row.uom} onChange={(e) => onPatch({ uom: e.target.value })} style={cellSelect}>
        {UOMS.map((u) => <option key={u} value={u}>{u}</option>)}
        {!UOMS.includes(row.uom) && <option value={row.uom}>{row.uom}</option>}
      </select>

      <span style={{ textAlign: 'right', fontSize: '12.5px', color: 'var(--color-text-secondary)', fontWeight: 600 }}>
        £{cost.toFixed(2)}
      </span>

      <span style={{ display: 'inline-flex', gap: '2px', justifyContent: 'flex-end' }}>
        <button onClick={onMoveUp} disabled={index === 0} aria-label="Move up" style={miniIconBtnStyle(index === 0)}>
          <ArrowUp size={12} />
        </button>
        <button onClick={onMoveDown} disabled={index === total - 1} aria-label="Move down" style={miniIconBtnStyle(index === total - 1)}>
          <ArrowDown size={12} />
        </button>
        <button onClick={onRemove} aria-label="Remove" style={miniIconBtnStyle(false)}>
          <X size={12} />
        </button>
      </span>
    </div>
  );
}

function ComponentRecipePicker({
  candidates, onPick, onClose,
}: {
  candidates: Recipe[];
  onPick: (id: string) => void;
  onClose: () => void;
}) {
  const [q, setQ] = useState('');
  useEffect(() => {
    const h = (e: MouseEvent) => {
      const t = e.target as HTMLElement;
      if (!t.closest('[data-comp-picker]')) onClose();
    };
    const t = setTimeout(() => document.addEventListener('mousedown', h), 0);
    return () => { clearTimeout(t); document.removeEventListener('mousedown', h); };
  }, [onClose]);
  const filtered = candidates.filter((r) => r.name.toLowerCase().includes(q.toLowerCase())).slice(0, 80);
  return (
    <div
      data-comp-picker
      style={{
        position: 'absolute',
        top: 'calc(100% + 6px)',
        left: 0,
        zIndex: 50,
        width: '380px',
        maxHeight: '360px',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        background: '#fff',
        border: '1px solid var(--color-border-subtle)',
        borderRadius: '12px',
        boxShadow: '0 12px 32px rgba(3,15,58,0.16)',
        fontFamily: 'var(--font-primary)',
      }}
    >
      <div style={{ padding: '10px', borderBottom: '1px solid var(--color-border-subtle)' }}>
        <input
          autoFocus
          placeholder="Search recipes…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          style={inputStyle}
        />
      </div>
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {filtered.length === 0 && (
          <div style={{ padding: '14px', fontSize: '12.5px', color: 'var(--color-text-muted)' }}>
            No matches.
          </div>
        )}
        {filtered.map((r) => (
          <button
            key={r.id}
            onClick={() => onPick(r.id)}
            style={{
              display: 'flex', alignItems: 'center', gap: '10px',
              width: '100%', padding: '8px 12px',
              border: 'none', background: 'transparent',
              textAlign: 'left', cursor: 'pointer',
              fontFamily: 'var(--font-primary)',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--color-bg-hover)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
          >
            <span style={{ flex: 1, fontSize: '13px', fontWeight: 600, color: 'var(--color-text-primary)' }}>
              {r.name}
            </span>
            <span style={{ fontSize: '11.5px', color: 'var(--color-text-muted)' }}>{r.category}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

const addButtonStyle: React.CSSProperties = {
  padding: '9px 12px',
  borderRadius: '8px',
  border: '1px dashed var(--color-border)',
  background: 'var(--color-bg-hover)',
  color: 'var(--color-text-primary)',
  fontSize: '12.5px', fontWeight: 600,
  cursor: 'pointer', fontFamily: 'var(--font-primary)',
  display: 'inline-flex', alignItems: 'center', gap: '6px',
};

function miniIconBtnStyle(disabled: boolean): React.CSSProperties {
  return {
    width: '24px', height: '24px',
    border: '1px solid var(--color-border-subtle)',
    background: '#fff',
    color: 'var(--color-text-muted)',
    borderRadius: '6px',
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.4 : 1,
    fontFamily: 'var(--font-primary)',
  };
}

export function VariableTable({
  rows, onChange, onRemove, onAdd,
}: {
  rows: VariableRow[];
  onChange: (id: string, patch: Partial<VariableRow>) => void;
  onRemove: (id: string) => void;
  onAdd: () => void;
}) {
  return (
    <>
      <div style={tableHeaderStyle(['26px', '2fr', '1fr', '1.5fr', '70px', '80px', '28px'])}>
        <span />
        <span>Name</span>
        <span>Type</span>
        <span>Supplier</span>
        <span>Qty</span>
        <span>UoM</span>
        <span />
      </div>
      {rows.length === 0 && (
        <div style={{ padding: '14px 8px', fontSize: '12.5px', color: 'var(--color-text-muted)' }}>
          Nothing yet. Add if this recipe has variations that sit inside it (e.g. milk alternatives for one coffee).
        </div>
      )}
      {rows.map((row) => (
        <div key={row.id} style={tableRowStyle(['26px', '2fr', '1fr', '1.5fr', '70px', '80px', '28px'])}>
          <span style={{ color: 'var(--color-text-muted)', fontSize: '11px' }}>•</span>
          <input
            value={row.name}
            onChange={(e) => onChange(row.id, { name: e.target.value })}
            placeholder="e.g. Oat milk"
            style={cellInput}
          />
          <select value={row.type} onChange={(e) => onChange(row.id, { type: e.target.value })} style={cellSelect}>
            <option>Alternative</option>
            <option>Add-on</option>
            <option>Upgrade</option>
          </select>
          <select value={row.supplier} onChange={(e) => onChange(row.id, { supplier: e.target.value })} style={cellSelect}>
            <option value="">—</option>
            {SUPPLIERS.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
          <input
            type="number"
            min={0}
            step="any"
            value={row.qty}
            onChange={(e) => onChange(row.id, { qty: e.target.value === '' ? '' : Number(e.target.value) })}
            style={cellInput}
          />
          <select value={row.uom} onChange={(e) => onChange(row.id, { uom: e.target.value })} style={cellSelect}>
            {UOMS.map((u) => <option key={u} value={u}>{u}</option>)}
          </select>
          <button onClick={() => onRemove(row.id)} style={rowRemoveStyle} aria-label="Remove">
            <X size={14} />
          </button>
        </div>
      ))}
      <button
        onClick={onAdd}
        style={{
          marginTop: '10px',
          padding: '9px 12px', borderRadius: '8px',
          border: '1px dashed var(--color-border)', background: 'var(--color-bg-hover)',
          color: 'var(--color-text-primary)', fontSize: '12.5px', fontWeight: 600,
          cursor: 'pointer', fontFamily: 'var(--font-primary)',
          display: 'inline-flex', alignItems: 'center', gap: '6px',
        }}
      >
        <Plus size={13} strokeWidth={2.2} /> Add variable ingredient
      </button>
      <div
        style={{
          marginTop: '10px',
          padding: '10px 12px',
          borderRadius: '8px',
          background: 'var(--color-bg-hover)',
          fontSize: '12px', color: 'var(--color-text-muted)',
          display: 'flex', alignItems: 'flex-start', gap: '8px',
        }}
      >
        <AlertTriangle size={13} strokeWidth={2} color="var(--color-warning)" style={{ flexShrink: 0, marginTop: '2px' }} />
        <span>Variations that apply across many recipes (e.g. alt milks, cup sizes) are usually cleaner as a shared modifier group.</span>
      </div>
    </>
  );
}

export function PackagingTable({
  rows, onChange, onRemove, onAdd,
}: {
  rows: PackagingRow[];
  onChange: (id: string, patch: Partial<PackagingRow>) => void;
  onRemove: (id: string) => void;
  onAdd: () => void;
}) {
  return (
    <>
      <div style={tableHeaderStyle(['26px', '2fr', '1.5fr', '70px', '80px', '80px', '28px'])}>
        <span />
        <span>Name</span>
        <span>Supplier</span>
        <span>Qty</span>
        <span>UoM</span>
        <span style={{ textAlign: 'right' }}>Cost</span>
        <span />
      </div>
      {rows.length === 0 && (
        <div style={{ padding: '14px 8px', fontSize: '12.5px', color: 'var(--color-text-muted)' }}>
          Nothing yet. Add for takeaway / delivery-specific packaging.
        </div>
      )}
      {rows.map((row) => {
        const cost = (typeof row.qty === 'number' ? row.qty : 0) * row.unitCostP / 100;
        return (
          <div key={row.id} style={tableRowStyle(['26px', '2fr', '1.5fr', '70px', '80px', '80px', '28px'])}>
            <span style={{ color: 'var(--color-text-muted)', fontSize: '11px' }}>•</span>
            <input value={row.name} onChange={(e) => onChange(row.id, { name: e.target.value })} placeholder="e.g. 8oz cup" style={cellInput} />
            <select value={row.supplier} onChange={(e) => onChange(row.id, { supplier: e.target.value })} style={cellSelect}>
              <option value="">—</option>
              {SUPPLIERS.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
            <input
              type="number"
              min={0}
              step="any"
              value={row.qty}
              onChange={(e) => onChange(row.id, { qty: e.target.value === '' ? '' : Number(e.target.value) })}
              style={cellInput}
            />
            <select value={row.uom} onChange={(e) => onChange(row.id, { uom: e.target.value })} style={cellSelect}>
              {UOMS.map((u) => <option key={u} value={u}>{u}</option>)}
            </select>
            <span style={{ textAlign: 'right', fontSize: '12.5px', color: 'var(--color-text-secondary)', fontWeight: 600 }}>
              £{cost.toFixed(2)}
            </span>
            <button onClick={() => onRemove(row.id)} style={rowRemoveStyle} aria-label="Remove">
              <X size={14} />
            </button>
          </div>
        );
      })}
      <button
        onClick={onAdd}
        style={{
          marginTop: '10px',
          padding: '9px 12px', borderRadius: '8px',
          border: '1px dashed var(--color-border)', background: 'var(--color-bg-hover)',
          color: 'var(--color-text-primary)', fontSize: '12.5px', fontWeight: 600,
          cursor: 'pointer', fontFamily: 'var(--font-primary)',
          display: 'inline-flex', alignItems: 'center', gap: '6px',
        }}
      >
        <Plus size={13} strokeWidth={2.2} /> Add packaging
      </button>
    </>
  );
}

// ── Price card (right column) ────────────────────────────────────────────────

export function PriceCard({
  totalCost, ingredientCost, packagingCost,
  desiredMargin, onDesiredMargin, vatPct, onVat,
  hotCold, onHotCold,
  srpDineInEx, onSrpDineIn, marginDineIn, srpIncDineIn,
  srpTakeawayEx, onSrpTakeaway, marginTakeaway, srpIncTakeaway,
  srpDeliveryEx, onSrpDelivery, deliveryCommission, onDeliveryCommission, marginDelivery, srpIncDelivery,
}: {
  totalCost: number; ingredientCost: number; packagingCost: number;
  desiredMargin: number | ''; onDesiredMargin: (v: number | '') => void;
  vatPct: number | ''; onVat: (v: number | '') => void;
  hotCold: 'hot' | 'cold' | null; onHotCold: (v: 'hot' | 'cold' | null) => void;
  srpDineInEx: number | ''; onSrpDineIn: (v: number | '') => void;
  marginDineIn: number | null; srpIncDineIn: number | null;
  srpTakeawayEx: number | ''; onSrpTakeaway: (v: number | '') => void;
  marginTakeaway: number | null; srpIncTakeaway: number | null;
  srpDeliveryEx: number | ''; onSrpDelivery: (v: number | '') => void;
  deliveryCommission: number | ''; onDeliveryCommission: (v: number | '') => void;
  marginDelivery: number | null; srpIncDelivery: number | null;
}) {
  void totalCost;
  return (
    <div
      style={{
        borderRadius: '12px', border: '1px solid var(--color-border-subtle)',
        background: '#fff', padding: '16px',
      }}
    >
      <div
        style={{
          fontSize: '11px', fontWeight: 700, letterSpacing: '0.08em',
          textTransform: 'uppercase', color: 'var(--color-text-muted)', marginBottom: '12px',
        }}
      >
        Price breakdown
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '10px' }}>
        <div>
          <FieldLabel>Desired margin</FieldLabel>
          <div style={inputSuffixWrap}>
            <input
              type="number"
              value={desiredMargin}
              onChange={(e) => onDesiredMargin(e.target.value === '' ? '' : Number(e.target.value))}
              style={{ ...inputStyle, paddingRight: '28px' }}
            />
            <span style={inputSuffix}>%</span>
          </div>
        </div>
        <div>
          <FieldLabel>VAT</FieldLabel>
          <div style={inputSuffixWrap}>
            <input
              type="number"
              value={vatPct}
              onChange={(e) => onVat(e.target.value === '' ? '' : Number(e.target.value))}
              style={{ ...inputStyle, paddingRight: '28px' }}
            />
            <span style={inputSuffix}>%</span>
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '6px', marginBottom: '14px' }}>
        <button
          onClick={() => onHotCold(hotCold === 'hot' ? null : 'hot')}
          style={smallToggleStyle(hotCold === 'hot')}
        >
          {hotCold === 'hot' && <Check size={11} strokeWidth={2.6} />} Hot
        </button>
        <button
          onClick={() => onHotCold(hotCold === 'cold' ? null : 'cold')}
          style={smallToggleStyle(hotCold === 'cold')}
        >
          {hotCold === 'cold' && <Check size={11} strokeWidth={2.6} />} Cold
        </button>
      </div>

      <PriceChannel
        label="Dine in"
        ingCost={ingredientCost} pkgCost={packagingCost}
        srpEx={srpDineInEx} onSrp={onSrpDineIn}
        srpInc={srpIncDineIn} margin={marginDineIn}
      />
      <PriceChannel
        label="Takeaway"
        ingCost={ingredientCost} pkgCost={packagingCost}
        srpEx={srpTakeawayEx} onSrp={onSrpTakeaway}
        srpInc={srpIncTakeaway} margin={marginTakeaway}
      />
      <PriceChannel
        label="Delivery"
        ingCost={ingredientCost} pkgCost={packagingCost}
        srpEx={srpDeliveryEx} onSrp={onSrpDelivery}
        srpInc={srpIncDelivery} margin={marginDelivery}
        commission={deliveryCommission} onCommission={onDeliveryCommission}
      />

      <div style={{ marginTop: '10px', paddingTop: '10px', borderTop: '1px solid var(--color-border-subtle)', fontSize: '12px', color: 'var(--color-text-muted)' }}>
        Totals auto-compute from ingredients + packaging. Enter an SRP, or leave blank to set from desired margin.
      </div>
    </div>
  );
}

function PriceChannel({
  label, ingCost, pkgCost, srpEx, onSrp, srpInc, margin, commission, onCommission,
}: {
  label: string; ingCost: number; pkgCost: number;
  srpEx: number | ''; onSrp: (v: number | '') => void;
  srpInc: number | null; margin: number | null;
  commission?: number | ''; onCommission?: (v: number | '') => void;
}) {
  return (
    <div
      style={{
        padding: '12px 10px',
        borderTop: '1px solid var(--color-border-subtle)',
        display: 'flex', flexDirection: 'column', gap: '8px',
      }}
    >
      <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--color-text-primary)' }}>{label}</div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: 'var(--color-text-secondary)' }}>
        <span>Ingredient cost</span>
        <strong style={{ color: 'var(--color-text-primary)', fontWeight: 600 }}>£{ingCost.toFixed(2)}</strong>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: 'var(--color-text-secondary)' }}>
        <span>Packaging cost</span>
        <strong style={{ color: 'var(--color-text-primary)', fontWeight: 600 }}>£{pkgCost.toFixed(2)}</strong>
      </div>
      {onCommission && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '2px' }}>
          <span style={{ fontSize: '12px', color: 'var(--color-text-secondary)', flex: 1 }}>Commission</span>
          <div style={{ ...inputSuffixWrap, width: '80px' }}>
            <input
              type="number"
              value={commission}
              onChange={(e) => onCommission(e.target.value === '' ? '' : Number(e.target.value))}
              style={{ ...inputStyle, paddingRight: '24px', padding: '5px 24px 5px 8px', fontSize: '12px' }}
              placeholder="0"
            />
            <span style={{ ...inputSuffix, right: '8px', fontSize: '11px' }}>%</span>
          </div>
        </div>
      )}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <span style={{ fontSize: '12px', color: 'var(--color-text-secondary)', flex: 1 }}>SRP ex VAT</span>
        <div style={{ ...inputSuffixWrap, width: '96px' }}>
          <span style={{ ...inputSuffix, left: '8px', right: 'auto', fontSize: '11px' }}>£</span>
          <input
            type="number"
            min={0}
            step="0.01"
            value={srpEx}
            onChange={(e) => onSrp(e.target.value === '' ? '' : Number(e.target.value))}
            style={{ ...inputStyle, padding: '5px 8px 5px 22px', fontSize: '12px' }}
          />
        </div>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
        <span style={{ color: 'var(--color-text-secondary)' }}>SRP inc VAT</span>
        <strong style={{ color: 'var(--color-text-primary)', fontWeight: 600 }}>
          {srpInc == null ? '—' : `£${srpInc.toFixed(2)}`}
        </strong>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
        <span style={{ color: 'var(--color-text-secondary)' }}>Margin</span>
        <strong
          style={{
            color: margin == null ? 'var(--color-text-muted)' :
                   margin >= 60 ? 'var(--color-success)' :
                   margin >= 40 ? 'var(--color-warning)' : 'var(--color-error)',
            fontWeight: 700,
          }}
        >
          {margin == null ? '—' : `${margin}%`}
        </strong>
      </div>
    </div>
  );
}

// ── Shared inline styles ─────────────────────────────────────────────────────

export const inputStyle: React.CSSProperties = {
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

export const nameInputStyle: React.CSSProperties = {
  ...inputStyle,
  fontSize: '16px',
  fontWeight: 600,
  padding: '11px 12px',
};

export const selectStyle: React.CSSProperties = { ...inputStyle };

export const textareaStyle: React.CSSProperties = {
  ...inputStyle,
  resize: 'vertical',
  minHeight: '70px',
  fontFamily: 'var(--font-primary)',
};

export const cellInput: React.CSSProperties = {
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

export const cellSelect: React.CSSProperties = { ...cellInput };

export const primaryBtnStyle: React.CSSProperties = {
  padding: '10px 16px',
  borderRadius: '10px',
  border: 'none',
  background: 'var(--color-accent-active)',
  fontSize: '13px',
  fontWeight: 600,
  color: '#fff',
  fontFamily: 'var(--font-primary)',
  cursor: 'pointer',
};

export const primaryBtnStyleSm: React.CSSProperties = {
  padding: '6px 12px',
  borderRadius: '8px',
  border: 'none',
  background: 'var(--color-accent-active)',
  fontSize: '12px',
  fontWeight: 600,
  color: '#fff',
  fontFamily: 'var(--font-primary)',
  cursor: 'pointer',
  display: 'inline-flex', alignItems: 'center', gap: '5px',
};

export const secondaryBtnStyle: React.CSSProperties = {
  padding: '10px 16px',
  borderRadius: '10px',
  border: '1px solid var(--color-border)',
  background: '#fff',
  fontSize: '13px',
  fontWeight: 600,
  color: 'var(--color-text-primary)',
  fontFamily: 'var(--font-primary)',
  cursor: 'pointer',
};

export const dismissBtnStyle: React.CSSProperties = {
  padding: '6px 10px',
  borderRadius: '8px',
  border: '1px solid var(--color-border-subtle)',
  background: 'transparent',
  fontSize: '12px',
  fontWeight: 600,
  color: 'var(--color-text-secondary)',
  fontFamily: 'var(--font-primary)',
  cursor: 'pointer',
};

export const rowRemoveStyle: React.CSSProperties = {
  width: '26px', height: '26px',
  border: 'none', background: 'transparent',
  cursor: 'pointer', color: 'var(--color-text-muted)',
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
  borderRadius: '6px',
};

export const inputSuffixWrap: React.CSSProperties = {
  position: 'relative',
  display: 'inline-flex',
  width: '100%',
};

export const inputSuffix: React.CSSProperties = {
  position: 'absolute',
  right: '10px',
  top: '50%',
  transform: 'translateY(-50%)',
  fontSize: '12px',
  color: 'var(--color-text-muted)',
  pointerEvents: 'none',
};

export function smallToggleStyle(active: boolean): React.CSSProperties {
  return {
    flex: 1,
    padding: '7px 10px',
    borderRadius: '8px',
    border: active ? '1px solid transparent' : '1px solid var(--color-border-subtle)',
    background: active ? 'var(--color-accent-active)' : '#fff',
    color: active ? '#fff' : 'var(--color-text-secondary)',
    fontSize: '12px',
    fontWeight: 600,
    cursor: 'pointer',
    fontFamily: 'var(--font-primary)',
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '5px',
  };
}

export function tableHeaderStyle(cols: string[]): React.CSSProperties {
  return {
    display: 'grid',
    gridTemplateColumns: cols.join(' '),
    gap: '8px',
    padding: '8px 0',
    borderBottom: '1px solid var(--color-border-subtle)',
    fontSize: '11px', fontWeight: 700, letterSpacing: '0.05em',
    textTransform: 'uppercase', color: 'var(--color-text-muted)',
  };
}

export function tableRowStyle(cols: string[]): React.CSSProperties {
  return {
    display: 'grid',
    gridTemplateColumns: cols.join(' '),
    gap: '8px',
    padding: '8px 0',
    alignItems: 'center',
    borderBottom: '1px solid var(--color-border-subtle)',
  };
}
