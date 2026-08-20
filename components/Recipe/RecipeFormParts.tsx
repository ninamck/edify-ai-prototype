'use client';

// Shared form primitives, tables, and the right-column Price card used by
// both the "Build recipe manually" intake page and the [id]/edit page.
//
// Keeping these in one place keeps the two pages visually identical and lets
// us extend the form once.

import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Plus, X, Check, ChevronDown, ChevronLeft, ChevronRight, AlertTriangle,
  ArrowUp, ArrowDown, HelpCircle, PoundSterling,
} from 'lucide-react';
import type {
  ComponentRow,
  ItemComponent,
  RecipeComponent,
  Recipe,
} from '@/components/Recipe/libraryFixtures';
import {
  type WorkType,
  type PrepWorkEntry,
  type Ingredient,
  WORK_TYPE_ORDER,
  WORK_TYPE_LABELS,
  WORK_TYPE_COLORS,
  PRET_INGREDIENTS,
  componentPrepWork,
} from '@/components/Production/fixtures';

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
        <span style={{ fontSize: '15px', fontWeight: 600, color: 'var(--color-text-primary)' }}>{label}</span>
        {hint && <span style={{ flex: 1, fontSize: '13px', color: 'var(--color-text-muted)' }}>{hint}</span>}
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

/**
 * HelpTip — a small "?" icon button that opens a click-to-show popover with
 * help text. Use for occasional-clarification fields where the label is
 * self-evident but a power user might still want one-tap detail. Not for
 * conceptually loaded content — that should stay inline next to the field
 * so users discover it without hunting.
 *
 * Click (not hover) keeps it accessible to keyboard + touch users and
 * avoids the classic "tooltip vanishes when you mouse over it" bug.
 *
 * Positioning: rendered into a portal at `document.body` with `fixed`
 * coords measured from the icon's bounding rect. The tooltip is centered
 * horizontally on the icon, clamped to the viewport (with 8px padding),
 * and flipped above the icon if there isn't room below. Closes on any
 * scroll / resize / outside click / ESC so it never desyncs from its
 * anchor.
 */
const HELP_TIP_WIDTH = 280;
const HELP_TIP_PADDING = 8;
const HELP_TIP_GAP = 6;

export function HelpTip({
  children, label,
}: {
  children: React.ReactNode;
  label?: string;
}) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ left: number; top: number; placement: 'below' | 'above' } | null>(null);
  const iconRef = useRef<HTMLButtonElement | null>(null);
  const tipRef = useRef<HTMLDivElement | null>(null);

  const computePosition = useCallback(() => {
    if (!iconRef.current) return;
    const icon = iconRef.current.getBoundingClientRect();
    const tipWidth = tipRef.current?.offsetWidth ?? HELP_TIP_WIDTH;
    const tipHeight = tipRef.current?.offsetHeight ?? 60;

    let left = icon.left + icon.width / 2 - tipWidth / 2;
    left = Math.max(
      HELP_TIP_PADDING,
      Math.min(left, window.innerWidth - HELP_TIP_PADDING - tipWidth),
    );

    let top = icon.bottom + HELP_TIP_GAP;
    let placement: 'below' | 'above' = 'below';
    if (top + tipHeight > window.innerHeight - HELP_TIP_PADDING) {
      const aboveTop = icon.top - HELP_TIP_GAP - tipHeight;
      if (aboveTop >= HELP_TIP_PADDING) {
        top = aboveTop;
        placement = 'above';
      }
    }

    setPos({ left, top, placement });
  }, []);

  // First measurement uses the icon rect only (tooltip isn't in the DOM
  // yet). The follow-up effect re-measures once the tooltip mounts so
  // the actual rendered width/height drives the final placement.
  useLayoutEffect(() => {
    if (!open) return;
    computePosition();
  }, [open, computePosition]);

  useEffect(() => {
    if (!open || !tipRef.current) return;
    computePosition();
  }, [open, computePosition]);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: MouseEvent) {
      if (iconRef.current?.contains(e.target as Node)) return;
      if (tipRef.current?.contains(e.target as Node)) return;
      setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    function onScrollOrResize() {
      setOpen(false);
    }
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKey);
    window.addEventListener('scroll', onScrollOrResize, true);
    window.addEventListener('resize', onScrollOrResize);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKey);
      window.removeEventListener('scroll', onScrollOrResize, true);
      window.removeEventListener('resize', onScrollOrResize);
    };
  }, [open]);

  const tooltip = open && typeof document !== 'undefined' ? createPortal(
    <AnimatePresence>
      <motion.div
        ref={tipRef}
        key="helptip"
        initial={{ opacity: 0, y: pos?.placement === 'above' ? 3 : -3 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.12 }}
        role="tooltip"
        style={{
          position: 'fixed',
          // Off-screen on first paint until we measure; the layout effect
          // sets real coords synchronously before paint anyway.
          left: pos?.left ?? -9999,
          top: pos?.top ?? -9999,
          zIndex: 1000,
          width: HELP_TIP_WIDTH,
          padding: '10px 12px', borderRadius: 8,
          background: 'var(--color-text-primary, #0F172A)',
          color: '#fff',
          fontSize: 13, lineHeight: 1.5,
          fontWeight: 400, textTransform: 'none', letterSpacing: 0,
          boxShadow: '0 6px 22px rgba(15,23,42,0.2)',
          fontFamily: 'var(--font-primary)',
          pointerEvents: 'auto',
        }}
      >
        {children}
      </motion.div>
    </AnimatePresence>,
    document.body,
  ) : null;

  return (
    <>
      <button
        ref={iconRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={label ?? 'More info'}
        aria-expanded={open}
        title={label ?? 'More info'}
        style={{
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          width: 14, height: 14, padding: 0, marginLeft: 4,
          border: 'none', background: 'transparent',
          color: 'var(--color-text-muted)', cursor: 'pointer',
          borderRadius: '50%',
          verticalAlign: 'middle',
        }}
        onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--color-text-secondary)'; }}
        onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--color-text-muted)'; }}
      >
        <HelpCircle size={13} strokeWidth={1.8} />
      </button>
      {tooltip}
    </>
  );
}

export function SectionHeader({
  title, hint, help,
}: {
  title: string;
  /** Always-visible muted hint text below the title. Use for conceptually
   *  loaded sections (variants, modifiers) where users need the context
   *  before they can act correctly. */
  hint?: string;
  /** Click-to-open help text via a small "?" icon next to the title. Use
   *  for occasional clarification where the title alone is enough most of
   *  the time. */
  help?: React.ReactNode;
}) {
  return (
    <div style={{ marginBottom: '10px' }}>
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: '2px' }}>
        <span style={{ fontSize: '15px', fontWeight: 700, color: 'var(--color-text-primary)' }}>
          {title}
        </span>
        {help && <HelpTip label={`About ${title.toLowerCase()}`}>{help}</HelpTip>}
      </div>
      {hint && <div style={{ fontSize: '13px', color: 'var(--color-text-muted)', lineHeight: 1.45 }}>{hint}</div>}
    </div>
  );
}

export function FieldLabel({
  children, required, help,
}: {
  children: React.ReactNode;
  required?: boolean;
  /** Click-to-open help text via a small "?" icon next to the label. */
  help?: React.ReactNode;
}) {
  return (
    <div
      style={{
        fontSize: '12px', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase',
        color: 'var(--color-text-muted)', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '4px',
      }}
    >
      {children}
      {required && <span style={{ color: 'var(--color-error)' }}>*</span>}
      {help && <HelpTip>{help}</HelpTip>}
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
  options, selected, onChange, size = 'md', selectAll,
}: {
  options: readonly string[]; selected: string[]; onChange: (sel: string[]) => void;
  /** Pill visual density. `sm` is for lists of many options (e.g. site
   *  multi-selects) where the default size eats too much width. */
  size?: 'sm' | 'md';
  /** When provided, prepends a single Select-all / Clear-all toggle
   *  pill. Toggles between selecting every option and clearing the
   *  selection. */
  selectAll?: { allLabel: string; clearLabel: string };
}) {
  const isSmall = size === 'sm';
  const padding = isSmall ? '5px 11px' : '7px 13px';
  const fontSize = isSmall ? '12.5px' : '13px';
  const gap = isSmall ? '5px' : '6px';
  const iconSize = isSmall ? 11 : 12;

  const allOn = options.length > 0 && options.every((o) => selected.includes(o));

  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap }}>
      {selectAll && (
        <button
          key="__select_all__"
          type="button"
          onClick={() => onChange(allOn ? [] : [...options])}
          style={{
            padding,
            borderRadius: '100px',
            border: '1px dashed var(--color-border)',
            background: '#fff',
            color: 'var(--color-text-secondary)',
            fontSize, fontWeight: 600,
            cursor: 'pointer', fontFamily: 'var(--font-primary)',
            display: 'inline-flex', alignItems: 'center', gap: '5px',
          }}
        >
          {allOn ? selectAll.clearLabel : selectAll.allLabel}
        </button>
      )}
      {options.map((opt) => {
        const on = selected.includes(opt);
        return (
          <button
            key={opt}
            type="button"
            onClick={() => onChange(on ? selected.filter((s) => s !== opt) : [...selected, opt])}
            style={{
              padding,
              borderRadius: '100px',
              border: on ? '1px solid transparent' : '1px solid var(--color-border-subtle)',
              background: on ? 'var(--color-accent-active)' : '#fff',
              color: on ? '#fff' : 'var(--color-text-secondary)',
              fontSize, fontWeight: 600,
              cursor: 'pointer', fontFamily: 'var(--font-primary)',
              display: 'inline-flex', alignItems: 'center', gap: '5px',
            }}
          >
            {on && <Check size={iconSize} strokeWidth={2.6} />}
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
              padding: '7px 13px',
              borderRadius: '100px',
              border: on ? '1px solid transparent' : '1px solid var(--color-border-subtle)',
              background: on ? 'var(--color-accent-active)' : '#fff',
              color: on ? '#fff' : 'var(--color-text-secondary)',
              fontSize: '13px', fontWeight: 600,
              cursor: 'pointer', fontFamily: 'var(--font-primary)',
              display: 'inline-flex', alignItems: 'center', gap: '5px',
            }}
          >
            {on && <Check size={12} strokeWidth={2.6} />}
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
            padding: '4px 9px 4px 11px',
            borderRadius: '100px',
            background: 'var(--color-bg-hover)',
            color: 'var(--color-text-primary)',
            fontSize: '13px', fontWeight: 600,
            display: 'inline-flex', alignItems: 'center', gap: '6px',
          }}
        >
          {t}
          <button
            onClick={() => onChange(value.filter((v) => v !== t))}
            aria-label={`Remove ${t}`}
            style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: 0, lineHeight: 0, color: 'var(--color-text-muted)' }}
          >
            <X size={12} />
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
          flex: 1, minWidth: '120px', fontSize: '14px',
          fontFamily: 'var(--font-primary)', color: 'var(--color-text-primary)',
          padding: '4px 4px',
        }}
      />
    </div>
  );
}

export function CheckRow({
  label, checked, onChange, help,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  /** Click-to-open help text via a small "?" icon rendered as a sibling
   *  to the row (kept outside the button to avoid nested-button HTML). */
  help?: React.ReactNode;
}) {
  const button = (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: '8px',
        padding: '8px 13px', borderRadius: '8px',
        border: '1px solid ' + (checked ? 'transparent' : 'var(--color-border-subtle)'),
        background: checked ? 'var(--color-accent-active)' : '#fff',
        color: checked ? '#fff' : 'var(--color-text-secondary)',
        fontSize: '13.5px', fontWeight: 600, cursor: 'pointer',
        fontFamily: 'var(--font-primary)',
      }}
    >
      <span
        style={{
          width: '15px', height: '15px', borderRadius: '4px',
          border: '1.5px solid ' + (checked ? '#fff' : 'var(--color-border)'),
          background: checked ? 'transparent' : '#fff',
          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
        }}
      >
        {checked && <Check size={11} color="#fff" strokeWidth={3} />}
      </span>
      {label}
    </button>
  );

  if (!help) return button;
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center' }}>
      {button}
      <HelpTip label={`About ${label.toLowerCase()}`}>{help}</HelpTip>
    </span>
  );
}

// ── Unified component table (items + sub-recipes) ────────────────────────────

const COMPONENT_COLS = ['28px', '2fr', '1.4fr', '70px', '70px', '80px', '76px'];

/**
 * Find the master ingredient for an `ItemComponent` row.
 *
 * Phase 1 strategy: prefer an explicit `ingredientId` link, fall back to
 * a case-insensitive name match against `PRET_INGREDIENTS`. The name
 * match is intentionally lenient so the demo's free-text "Tomato" /
 * "Roast chicken" rows pick up master defaults without authors having
 * to back-fill every link first. Future phases will tighten this with
 * a proper ingredient picker.
 */
export function findMasterIngredient(row: ItemComponent): Ingredient | undefined {
  if (row.ingredientId) {
    const byId = PRET_INGREDIENTS.find((i) => i.id === row.ingredientId);
    if (byId) return byId;
  }
  if (!row.name.trim()) return undefined;
  const needle = row.name.trim().toLowerCase();
  return PRET_INGREDIENTS.find((i) => i.name.toLowerCase() === needle);
}

export function ComponentTable({
  rows, recipesById, selfId, onChange, onPromoteToStage,
}: {
  rows: ComponentRow[];
  recipesById: Map<string, Recipe>;
  /** Recipe id of the currently-edited recipe (excluded from the picker). */
  selfId?: string;
  onChange: (next: ComponentRow[]) => void;
  /**
   * Called when the author "promotes" an implicit prep tag to an explicit
   * stage on this recipe's workflow. The host is expected to push a new
   * stage onto the workflow's stage list. When omitted the promote
   * action is hidden — useful on the manual-intake page where there is
   * no workflow yet.
   */
  onPromoteToStage?: (workType: WorkType, leadOffset: -2 | -1 | 0, label: string) => void;
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
  function addMasterIngredient(ing: Ingredient) {
    onChange([
      ...rows,
      {
        id: newId(),
        kind: 'item',
        ingredientId: ing.id,
        name: ing.name,
        supplier: '',
        qty: '',
        uom: ing.canonicalUnit,
        unitCostP: 0,
      },
    ]);
  }

  const [pickerOpen, setPickerOpen] = useState(false);
  const [masterPickerOpen, setMasterPickerOpen] = useState(false);
  const candidates = Array.from(recipesById.values())
    .filter((r) => r.id !== selfId && !rows.some((row) => row.kind === 'recipe' && row.recipeId === r.id))
    .sort((a, b) => a.name.localeCompare(b.name));
  // Master-ingredient candidates: hide ingredients already linked on this
  // recipe so authors don't double-add the same master row by mistake.
  const masterCandidates = PRET_INGREDIENTS
    .filter((ing) => !rows.some((row) => row.kind === 'item' && (row as ItemComponent).ingredientId === ing.id))
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
          onPromoteToStage={onPromoteToStage}
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
          onClick={() => { setPickerOpen((v) => !v); setMasterPickerOpen(false); }}
          style={addButtonStyle}
        >
          <Plus size={13} strokeWidth={2.2} /> Add sub-recipe
        </button>
        <button
          onClick={() => { setMasterPickerOpen((v) => !v); setPickerOpen(false); }}
          style={addButtonStyle}
          title="Pull in an ingredient from the master ingredient list — links the row so prep-work and cost stay in sync."
        >
          <Plus size={13} strokeWidth={2.2} /> Add master ingredient
        </button>
        {pickerOpen && (
          <ComponentRecipePicker
            candidates={candidates}
            onPick={(id) => { addRecipe(id); setPickerOpen(false); }}
            onClose={() => setPickerOpen(false)}
          />
        )}
        {masterPickerOpen && (
          <MasterIngredientPicker
            candidates={masterCandidates}
            onPick={(ing) => { addMasterIngredient(ing); setMasterPickerOpen(false); }}
            onClose={() => setMasterPickerOpen(false)}
          />
        )}
      </div>
    </>
  );
}

function ComponentRowEdit({
  row, index, total, recipesById,
  onPatch, onRemove, onMoveUp, onMoveDown, onEnter,
  onPromoteToStage,
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
  onPromoteToStage?: (workType: WorkType, leadOffset: -2 | -1 | 0, label: string) => void;
}) {
  const isRecipe = row.kind === 'recipe';
  const subRec = isRecipe ? recipesById.get(row.recipeId) : null;
  const qtyNum = typeof row.qty === 'number' ? row.qty : 0;
  const cost = isRecipe
    ? qtyNum * (subRec?.ingredientCost ?? 0)
    : (qtyNum * (row as ItemComponent).unitCostP) / 100;
  const itemRow = !isRecipe ? (row as ItemComponent) : null;
  const masterIngredient = itemRow ? findMasterIngredient(itemRow) : undefined;
  const showPrepStrip = !isRecipe && itemRow != null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
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
            background: 'rgba(0, 28, 53,0.07)',
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
        ${cost.toFixed(2)}
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
    {showPrepStrip && itemRow && (
      <IngredientPrepStrip
        row={itemRow}
        master={masterIngredient}
        onPatch={(patch) => onPatch(patch as Partial<ComponentRow>)}
        onPromoteToStage={onPromoteToStage}
      />
    )}
    </div>
  );
}

// ── Ingredient prep-work strip ───────────────────────────────────────────────
//
// Renders below an ingredient row in the component table. Shows the
// effective set of `WorkType` chips (master defaults + per-recipe override
// resolved via `componentPrepWork`) plus an "Add tag" button. Each chip
// can be edited via a popover: change leadOffset, remove, or promote to
// an explicit workflow stage.
//
// The "promote" affordance is the user-decided escape hatch from the
// implicit aggregation: by default ingredient prep work is implicit and
// gets aggregated across recipes on the Run sheet; promoting moves the
// tag onto this recipe's workflow as a real stage so it can be sequenced
// and routed independently.

function IngredientPrepStrip({
  row, master, onPatch, onPromoteToStage,
}: {
  row: ItemComponent;
  master: Ingredient | undefined;
  onPatch: (patch: Partial<ItemComponent>) => void;
  onPromoteToStage?: (workType: WorkType, leadOffset: -2 | -1 | 0, label: string) => void;
}) {
  const [openIdx, setOpenIdx] = useState<number | 'add' | null>(null);
  // Effective prep — override wins, otherwise master defaults. We render
  // them in a single strip; the source (override vs inherited) drives
  // chip styling so authors can see what's authored vs inherited at a
  // glance.
  const override = row.prepWorkOverride;
  const inherited = override == null;
  const effective: PrepWorkEntry[] = componentPrepWork(override, master);
  const usedTypes = new Set(effective.map((e) => e.workType));

  function startOverrideFromInherited(): PrepWorkEntry[] {
    // First edit on an inherited row materialises the override as a copy
    // of the master defaults so the user's tweak doesn't touch other
    // recipes that still inherit.
    return inherited ? effective.map((e) => ({ ...e })) : effective.map((e) => ({ ...e }));
  }

  function addEntry(workType: WorkType, leadOffset: -2 | -1 | 0) {
    const next = [...startOverrideFromInherited(), { workType, leadOffset: leadOffset === 0 ? undefined : leadOffset }];
    onPatch({ prepWorkOverride: next });
    setOpenIdx(null);
  }
  function patchEntry(i: number, patch: Partial<PrepWorkEntry>) {
    const next = startOverrideFromInherited().map((e, idx) => (idx === i ? { ...e, ...patch } : e));
    // Treat leadOffset === 0 as undefined to keep stored data tidy.
    if (patch.leadOffset === 0) {
      next[i] = { ...next[i], leadOffset: undefined };
    }
    onPatch({ prepWorkOverride: next });
  }
  function removeEntry(i: number) {
    const next = startOverrideFromInherited().filter((_, idx) => idx !== i);
    onPatch({ prepWorkOverride: next });
    setOpenIdx(null);
  }
  function resetToInherited() {
    onPatch({ prepWorkOverride: undefined });
    setOpenIdx(null);
  }

  // Hide the strip entirely on rows with no name yet — no signal value.
  if (!row.name.trim() && effective.length === 0) return null;

  return (
    <div
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        gap: 6,
        padding: '4px 12px 8px 36px', // align under name column
        fontFamily: 'var(--font-primary)',
      }}
    >
      <span
        style={{
          fontSize: 9,
          fontWeight: 700,
          letterSpacing: '0.06em',
          textTransform: 'uppercase',
          color: 'var(--color-text-muted)',
        }}
        title={
          inherited && master
            ? `Inherited from master ingredient "${master.name}". Edits here become a per-recipe override.`
            : 'Per-recipe prep work for this ingredient.'
        }
      >
        Prep
      </span>
      {effective.map((entry, i) => (
        <PrepChipWithPopover
          key={`${entry.workType}-${i}`}
          entry={entry}
          inherited={inherited}
          ingredientName={row.name || master?.name || ''}
          isOpen={openIdx === i}
          onOpen={() => setOpenIdx(i)}
          onClose={() => setOpenIdx((curr) => (curr === i ? null : curr))}
          onPatch={(p) => patchEntry(i, p)}
          onRemove={() => removeEntry(i)}
          onPromoteToStage={onPromoteToStage}
        />
      ))}
      <PrepAddButton
        isOpen={openIdx === 'add'}
        usedTypes={usedTypes}
        onOpen={() => setOpenIdx('add')}
        onClose={() => setOpenIdx((curr) => (curr === 'add' ? null : curr))}
        onAdd={addEntry}
      />
      {!inherited && master && (
        <button
          onClick={resetToInherited}
          style={{
            border: 'none',
            background: 'transparent',
            color: 'var(--color-text-muted)',
            cursor: 'pointer',
            fontSize: 10.5,
            fontWeight: 600,
            padding: '2px 4px',
            fontFamily: 'var(--font-primary)',
          }}
          title={`Reset to "${master.name}" master defaults`}
        >
          Reset to default
        </button>
      )}
      {effective.length === 0 && (
        <span style={{ fontSize: 10.5, color: 'var(--color-text-muted)', fontStyle: 'italic' }}>
          No prep tagged
        </span>
      )}
    </div>
  );
}

function PrepChipWithPopover({
  entry, inherited, ingredientName,
  isOpen, onOpen, onClose,
  onPatch, onRemove, onPromoteToStage,
}: {
  entry: PrepWorkEntry;
  inherited: boolean;
  ingredientName: string;
  isOpen: boolean;
  onOpen: () => void;
  onClose: () => void;
  onPatch: (patch: Partial<PrepWorkEntry>) => void;
  onRemove: () => void;
  onPromoteToStage?: (workType: WorkType, leadOffset: -2 | -1 | 0, label: string) => void;
}) {
  const tone = WORK_TYPE_COLORS[entry.workType];
  const lo = entry.leadOffset ?? 0;
  const loLabel = lo === 0 ? '' : ` · ${lo === -1 ? 'D-1' : 'D-2'}`;

  // Close popover on outside click.
  useEffect(() => {
    if (!isOpen) return;
    const onDown = (e: MouseEvent) => {
      const t = e.target as HTMLElement;
      if (!t.closest('[data-prep-popover]')) onClose();
    };
    const tid = setTimeout(() => document.addEventListener('mousedown', onDown), 0);
    return () => { clearTimeout(tid); document.removeEventListener('mousedown', onDown); };
  }, [isOpen, onClose]);

  return (
    <span data-prep-popover style={{ position: 'relative', display: 'inline-flex' }}>
      <button
        type="button"
        onClick={onOpen}
        title={inherited ? `${WORK_TYPE_LABELS[entry.workType]} (inherited)` : WORK_TYPE_LABELS[entry.workType]}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 5,
          padding: '3px 9px',
          borderRadius: 100,
          background: tone.bg,
          color: tone.color,
          fontSize: 10.5,
          fontWeight: 700,
          letterSpacing: '0.02em',
          fontFamily: 'var(--font-primary)',
          whiteSpace: 'nowrap',
          lineHeight: 1.1,
          // Inherited chips render with a dashed outline so authors can
          // tell at a glance which tags are masters vs per-recipe edits.
          border: '1px ' + (inherited ? 'dashed' : 'solid') + ' ' + tone.color + (inherited ? '66' : '00'),
          cursor: 'pointer',
        }}
      >
        {WORK_TYPE_LABELS[entry.workType]}
        {loLabel && (
          <span style={{ fontSize: 9, opacity: 0.85 }}>{loLabel}</span>
        )}
      </button>
      {isOpen && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% + 6px)',
            left: 0,
            zIndex: 60,
            minWidth: 200,
            padding: 10,
            background: '#fff',
            border: '1px solid var(--color-border-subtle)',
            borderRadius: 10,
            boxShadow: '0 12px 32px rgba(3,15,58,0.16)',
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
            fontFamily: 'var(--font-primary)',
          }}
        >
          <div style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            When
          </div>
          <div style={{ display: 'flex', gap: 4 }}>
            {([0, -1, -2] as const).map((opt) => {
              const on = lo === opt;
              return (
                <button
                  key={opt}
                  type="button"
                  onClick={() => onPatch({ leadOffset: opt })}
                  style={{
                    flex: 1,
                    padding: '5px 7px',
                    borderRadius: 6,
                    fontSize: 10.5,
                    fontWeight: 700,
                    cursor: 'pointer',
                    border: '1px solid ' + (on ? 'transparent' : 'var(--color-border-subtle)'),
                    background: on ? 'var(--color-accent-active)' : '#fff',
                    color: on ? '#fff' : 'var(--color-text-secondary)',
                  }}
                >
                  {opt === 0 ? 'Same day' : opt === -1 ? 'Day before' : '2 days before'}
                </button>
              );
            })}
          </div>
          {onPromoteToStage && (
            <button
              type="button"
              onClick={() => {
                onPromoteToStage(
                  entry.workType,
                  (entry.leadOffset ?? 0) as -2 | -1 | 0,
                  `${WORK_TYPE_LABELS[entry.workType]} ${ingredientName}`.trim(),
                );
                onRemove();
              }}
              style={{
                padding: '6px 10px',
                borderRadius: 7,
                fontSize: 11,
                fontWeight: 700,
                cursor: 'pointer',
                border: '1px solid var(--color-border-subtle)',
                background: '#fff',
                color: 'var(--color-text-primary)',
                fontFamily: 'var(--font-primary)',
                textAlign: 'left',
              }}
              title="Move this prep into the workflow as a dedicated stage on this recipe (skips the implicit Run-sheet aggregation)"
            >
              Promote to stage →
            </button>
          )}
          <button
            type="button"
            onClick={onRemove}
            style={{
              padding: '6px 10px',
              borderRadius: 7,
              fontSize: 11,
              fontWeight: 700,
              cursor: 'pointer',
              border: '1px solid var(--color-border-subtle)',
              background: '#fff',
              color: 'var(--color-error)',
              fontFamily: 'var(--font-primary)',
              textAlign: 'left',
            }}
          >
            Remove tag
          </button>
        </div>
      )}
    </span>
  );
}

function PrepAddButton({
  isOpen, usedTypes, onOpen, onClose, onAdd,
}: {
  isOpen: boolean;
  usedTypes: Set<WorkType>;
  onOpen: () => void;
  onClose: () => void;
  onAdd: (workType: WorkType, leadOffset: -2 | -1 | 0) => void;
}) {
  return (
    <span data-prep-add style={{ position: 'relative', display: 'inline-flex' }}>
      <button
        type="button"
        onClick={onOpen}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 3,
          padding: '3px 8px',
          borderRadius: 100,
          background: 'transparent',
          color: 'var(--color-text-muted)',
          fontSize: 10.5,
          fontWeight: 700,
          fontFamily: 'var(--font-primary)',
          border: '1px dashed var(--color-border)',
          cursor: 'pointer',
          whiteSpace: 'nowrap',
        }}
        title="Add an ingredient prep tag (Sanitise / Slice / Weigh-up etc.)"
      >
        <Plus size={11} strokeWidth={2.4} /> Tag
      </button>
      {isOpen && (
        <PrepAddPopover usedTypes={usedTypes} onClose={onClose} onAdd={onAdd} />
      )}
    </span>
  );
}

/**
 * The popover body — split out so it remounts every time the parent
 * toggles `isOpen`. That gives us "fresh state on each open" without
 * needing a useEffect-driven reset (which trips the lint rule against
 * synchronous setState inside effects).
 */
function PrepAddPopover({
  usedTypes, onClose, onAdd,
}: {
  usedTypes: Set<WorkType>;
  onClose: () => void;
  onAdd: (workType: WorkType, leadOffset: -2 | -1 | 0) => void;
}) {
  const [picked, setPicked] = useState<WorkType | null>(null);
  const [lo, setLo] = useState<-2 | -1 | 0>(0);

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      const t = e.target as HTMLElement;
      if (!t.closest('[data-prep-add]')) onClose();
    };
    const tid = setTimeout(() => document.addEventListener('mousedown', onDown), 0);
    return () => { clearTimeout(tid); document.removeEventListener('mousedown', onDown); };
  }, [onClose]);

  return (
    <div
      style={{
        position: 'absolute',
        top: 'calc(100% + 6px)',
        left: 0,
        zIndex: 60,
        minWidth: 240,
        padding: 10,
        background: '#fff',
        border: '1px solid var(--color-border-subtle)',
        borderRadius: 10,
        boxShadow: '0 12px 32px rgba(3,15,58,0.16)',
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        fontFamily: 'var(--font-primary)',
      }}
    >
      <div style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
        Tag
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
        {WORK_TYPE_ORDER.map((wt) => {
          const used = usedTypes.has(wt);
          const on = picked === wt;
          return (
            <button
              key={wt}
              type="button"
              disabled={used}
              onClick={() => setPicked(wt)}
              style={{
                padding: '3px 8px',
                borderRadius: 100,
                fontSize: 10.5,
                fontWeight: 700,
                cursor: used ? 'not-allowed' : 'pointer',
                opacity: used ? 0.4 : 1,
                border: '1px solid ' + (on ? 'transparent' : 'var(--color-border-subtle)'),
                background: on ? 'var(--color-accent-active)' : '#fff',
                color: on ? '#fff' : 'var(--color-text-secondary)',
                whiteSpace: 'nowrap',
              }}
            >
              {WORK_TYPE_LABELS[wt]}
            </button>
          );
        })}
      </div>
      <div style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
        When
      </div>
      <div style={{ display: 'flex', gap: 4 }}>
        {([0, -1, -2] as const).map((opt) => {
          const on = lo === opt;
          return (
            <button
              key={opt}
              type="button"
              onClick={() => setLo(opt)}
              style={{
                flex: 1,
                padding: '5px 7px',
                borderRadius: 6,
                fontSize: 10.5,
                fontWeight: 700,
                cursor: 'pointer',
                border: '1px solid ' + (on ? 'transparent' : 'var(--color-border-subtle)'),
                background: on ? 'var(--color-accent-active)' : '#fff',
                color: on ? '#fff' : 'var(--color-text-secondary)',
              }}
            >
              {opt === 0 ? 'Same day' : opt === -1 ? 'Day before' : '2 days before'}
            </button>
          );
        })}
      </div>
      <button
        type="button"
        disabled={!picked}
        onClick={() => picked && onAdd(picked, lo)}
        style={{
          padding: '7px 10px',
          borderRadius: 8,
          fontSize: 11.5,
          fontWeight: 700,
          cursor: picked ? 'pointer' : 'not-allowed',
          opacity: picked ? 1 : 0.5,
          background: 'var(--color-accent-active)',
          color: '#fff',
          border: '1px solid transparent',
          fontFamily: 'var(--font-primary)',
        }}
      >
        Add tag
      </button>
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

function MasterIngredientPicker({
  candidates, onPick, onClose,
}: {
  candidates: Ingredient[];
  onPick: (ing: Ingredient) => void;
  onClose: () => void;
}) {
  const [q, setQ] = useState('');
  useEffect(() => {
    const h = (e: MouseEvent) => {
      const t = e.target as HTMLElement;
      if (!t.closest('[data-master-picker]')) onClose();
    };
    const t = setTimeout(() => document.addEventListener('mousedown', h), 0);
    return () => { clearTimeout(t); document.removeEventListener('mousedown', h); };
  }, [onClose]);
  const filtered = candidates
    .filter((i) => i.name.toLowerCase().includes(q.toLowerCase()) || i.category.includes(q.toLowerCase()))
    .slice(0, 80);
  return (
    <div
      data-master-picker
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
          placeholder="Search master ingredients…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          style={inputStyle}
        />
      </div>
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {filtered.length === 0 && (
          <div style={{ padding: '14px', fontSize: '12.5px', color: 'var(--color-text-muted)' }}>
            {candidates.length === 0
              ? 'All master ingredients are already linked.'
              : 'No matches.'}
          </div>
        )}
        {filtered.map((ing) => (
          <button
            key={ing.id}
            onClick={() => onPick(ing)}
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
              {ing.name}
            </span>
            <span style={{ fontSize: '11.5px', color: 'var(--color-text-muted)', textTransform: 'capitalize' }}>
              {ing.category}
            </span>
            <span style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>
              {ing.canonicalUnit}
            </span>
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
              ${cost.toFixed(2)}
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

// ── Collapsible right-column sidebar ────────────────────────────────────────
//
// Wraps the right column on the recipe edit & manual-intake pages so the
// user can collapse it into a thin rail and give the form back ~300px of
// horizontal real estate. The parent page is responsible for animating its
// grid-template-columns; this component only renders one of two states.

/** localStorage-backed boolean used by the sidebar collapse state. */
export function usePersistedBoolean(key: string, defaultValue: boolean) {
  const [value, setValue] = useState<boolean>(defaultValue);
  const hydrated = useRef(false);

  // Hydrate on first mount only. We don't read localStorage during the
  // initial useState so the server-rendered markup stays deterministic;
  // any persisted value is applied on the client after hydration.
  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(key);
      if (stored != null) setValue(stored === 'true');
    } catch { /* localStorage unavailable — fall back to defaultValue */ }
    hydrated.current = true;
  }, [key]);

  useEffect(() => {
    if (!hydrated.current) return;
    try { window.localStorage.setItem(key, String(value)); } catch { /* ignore */ }
  }, [key, value]);

  return [value, setValue] as const;
}

export function CollapsibleSidebar({
  collapsed,
  onToggle,
  label = 'Pricing',
  top = 80,
  icon,
  children,
}: {
  collapsed: boolean;
  onToggle: () => void;
  /** Vertical label shown on the rail when collapsed. Keep it short. */
  label?: string;
  /** Sticky top offset, in px. */
  top?: number;
  /** Optional decorative icon shown in the collapsed rail. Defaults to
   *  a $ glyph since the only current consumer is the pricing
   *  sidebar; pass any lucide icon (16–18px) for other panels. */
  icon?: React.ReactNode;
  children: React.ReactNode;
}) {
  if (collapsed) {
    // The whole rail is a single button — bigger tap target than a
    // tiny chevron, and clearly reads as "click to expand". Inside,
    // the chevron / icon / label are decorative and stacked top-down
    // for vertical hierarchy.
    return (
      <button
        type="button"
        onClick={onToggle}
        aria-label={`Expand ${label}`}
        title={`Expand ${label}`}
        style={{
          position: 'sticky', top,
          width: 44,
          padding: '14px 0 18px',
          borderRadius: 12,
          border: '1px solid var(--color-border-subtle)',
          background: '#fff',
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          gap: 12,
          boxShadow: '0 1px 2px rgba(15,23,42,0.04)',
          cursor: 'pointer',
          fontFamily: 'var(--font-primary)',
          transition: 'background 0.15s ease, border-color 0.15s ease, box-shadow 0.15s ease',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = 'var(--color-bg-hover)';
          e.currentTarget.style.borderColor = 'var(--color-border)';
          e.currentTarget.style.boxShadow = '0 2px 6px rgba(15,23,42,0.06)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = '#fff';
          e.currentTarget.style.borderColor = 'var(--color-border-subtle)';
          e.currentTarget.style.boxShadow = '0 1px 2px rgba(15,23,42,0.04)';
        }}
      >
        <ChevronLeft
          size={14}
          strokeWidth={2.2}
          color="var(--color-text-muted)"
        />
        <span
          style={{
            width: 28, height: 28, borderRadius: '50%',
            background: 'rgba(0, 28, 53,0.08)',
            color: 'var(--color-accent-active)',
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          {icon ?? <PoundSterling size={14} strokeWidth={2.4} />}
        </span>
        <span
          style={{
            writingMode: 'vertical-rl',
            transform: 'rotate(180deg)',
            fontSize: 12.5, fontWeight: 800,
            letterSpacing: '0.16em', textTransform: 'uppercase',
            color: 'var(--color-text-secondary)',
            userSelect: 'none',
          }}
        >
          {label}
        </span>
      </button>
    );
  }

  return (
    <div
      style={{
        position: 'sticky', top,
        display: 'flex', flexDirection: 'column', gap: 16,
      }}
    >
      <button
        type="button"
        onClick={onToggle}
        aria-label={`Collapse ${label}`}
        title={`Collapse ${label}`}
        style={{
          position: 'absolute',
          top: 8, right: 8,
          zIndex: 2,
          width: 26, height: 26,
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          border: '1px solid var(--color-border-subtle)', borderRadius: 6,
          background: '#fff', cursor: 'pointer',
          color: 'var(--color-text-secondary)',
          fontFamily: 'var(--font-primary)',
        }}
        onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--color-bg-hover)'; }}
        onMouseLeave={(e) => { e.currentTarget.style.background = '#fff'; }}
      >
        <ChevronRight size={14} strokeWidth={2.2} />
      </button>
      {children}
    </div>
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
          fontSize: '12px', fontWeight: 700, letterSpacing: '0.08em',
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

      <div style={{ marginTop: '10px', paddingTop: '10px', borderTop: '1px solid var(--color-border-subtle)', fontSize: '13px', color: 'var(--color-text-muted)', lineHeight: 1.45 }}>
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
      <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--color-text-primary)' }}>{label}</div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', color: 'var(--color-text-secondary)' }}>
        <span>Ingredient cost</span>
        <strong style={{ color: 'var(--color-text-primary)', fontWeight: 600 }}>${ingCost.toFixed(2)}</strong>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', color: 'var(--color-text-secondary)' }}>
        <span>Packaging cost</span>
        <strong style={{ color: 'var(--color-text-primary)', fontWeight: 600 }}>${pkgCost.toFixed(2)}</strong>
      </div>
      {onCommission && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '2px' }}>
          <span style={{ fontSize: '13px', color: 'var(--color-text-secondary)', flex: 1 }}>Commission</span>
          <div style={{ ...inputSuffixWrap, width: '88px' }}>
            <input
              type="number"
              value={commission}
              onChange={(e) => onCommission(e.target.value === '' ? '' : Number(e.target.value))}
              style={{ ...inputStyle, paddingRight: '24px', padding: '6px 24px 6px 9px', fontSize: '13px' }}
              placeholder="0"
            />
            <span style={{ ...inputSuffix, right: '8px', fontSize: '12px' }}>%</span>
          </div>
        </div>
      )}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <span style={{ fontSize: '13px', color: 'var(--color-text-secondary)', flex: 1 }}>SRP ex VAT</span>
        <div style={{ ...inputSuffixWrap, width: '104px' }}>
          <span style={{ ...inputSuffix, left: '8px', right: 'auto', fontSize: '12px' }}>$</span>
          <input
            type="number"
            min={0}
            step="0.01"
            value={srpEx}
            onChange={(e) => onSrp(e.target.value === '' ? '' : Number(e.target.value))}
            style={{ ...inputStyle, padding: '6px 8px 6px 24px', fontSize: '13px' }}
          />
        </div>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
        <span style={{ color: 'var(--color-text-secondary)' }}>SRP inc VAT</span>
        <strong style={{ color: 'var(--color-text-primary)', fontWeight: 600 }}>
          {srpInc == null ? '—' : `$${srpInc.toFixed(2)}`}
        </strong>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
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

// Type scale notes:
//   The recipe forms use a coordinated scale that's about 1pt larger
//   than what we used to ship. Real users found the old scale too
//   dense — bumping by ~1pt across body / inputs / buttons / pills /
//   labels makes the form noticeably more readable without breaking
//   any of the dense matrix layouts.
export const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '9px 11px',
  borderRadius: '8px',
  border: '1px solid var(--color-border)',
  fontSize: '14px',
  fontFamily: 'var(--font-primary)',
  color: 'var(--color-text-primary)',
  background: '#fff',
  outline: 'none',
  boxSizing: 'border-box',
};

export const nameInputStyle: React.CSSProperties = {
  ...inputStyle,
  fontSize: '17px',
  fontWeight: 600,
  padding: '12px 13px',
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
  fontSize: '13px',
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
  fontSize: '14px',
  fontWeight: 600,
  color: '#fff',
  fontFamily: 'var(--font-primary)',
  cursor: 'pointer',
};

export const primaryBtnStyleSm: React.CSSProperties = {
  padding: '7px 13px',
  borderRadius: '8px',
  border: 'none',
  background: 'var(--color-accent-active)',
  fontSize: '13px',
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
  fontSize: '14px',
  fontWeight: 600,
  color: 'var(--color-text-primary)',
  fontFamily: 'var(--font-primary)',
  cursor: 'pointer',
};

export const dismissBtnStyle: React.CSSProperties = {
  padding: '7px 11px',
  borderRadius: '8px',
  border: '1px solid var(--color-border-subtle)',
  background: 'transparent',
  fontSize: '13px',
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
    padding: '8px 11px',
    borderRadius: '8px',
    border: active ? '1px solid transparent' : '1px solid var(--color-border-subtle)',
    background: active ? 'var(--color-accent-active)' : '#fff',
    color: active ? '#fff' : 'var(--color-text-secondary)',
    fontSize: '13px',
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
