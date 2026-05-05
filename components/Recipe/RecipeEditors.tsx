'use client';

import React, { useEffect, useState } from 'react';
import {
  Plus, Check, Trash2, ArrowUp, ArrowDown,
} from 'lucide-react';
import {
  type Recipe,
  type RecipeCategory,
  type RecipeKind,
  type RecipeSubRecipe,
} from '@/components/Recipe/libraryFixtures';
import {
  type ProductionWorkflow,
  type WorkflowStage,
  type BenchCapability,
  type WorkflowId,
  type WorkType,
  type Equipment,
  WORK_TYPE_ORDER,
  WORK_TYPE_LABELS,
  EQUIPMENT_ORDER,
  EQUIPMENT_LABELS,
  workTypeFromCapability,
  stageWorkType,
} from '@/components/Production/fixtures';
import WorkTypeChip from '@/components/Production/WorkTypeChip';

// ──────────────────────────────────────────────────────────────────────────────
// Shared option lists used by editors and pickers.

export const MODIFIER_GROUPS = [
  { id: 'mg-alt-milks', name: 'Alt milks',   optionsCount: 3, attachedCount: 14 },
  { id: 'mg-cup-sizes', name: 'Cup sizes',   optionsCount: 3, attachedCount: 22 },
  { id: 'mg-pour-size', name: 'Pour size',   optionsCount: 2, attachedCount: 37 },
  { id: 'mg-mixers',    name: 'Mixers',      optionsCount: 6, attachedCount: 37 },
  { id: 'mg-syrups',    name: 'Syrup shots', optionsCount: 5, attachedCount: 18 },
  { id: 'mg-extras',    name: 'Extras',      optionsCount: 4, attachedCount: 9 },
];

export const ALL_RECIPE_CATEGORIES: RecipeCategory[] = [
  'Coffee', 'Tea', 'Pastry', 'Food', 'Wine', 'Spirits', 'Kids',
  'Bakery', 'Sandwich', 'Salad', 'Snack', 'Beverage',
];

export const ALL_KINDS: RecipeKind[] = ['standalone', 'component', 'assembly'];
export const ALL_VISIBILITY: ('Bar' | 'Kitchen' | 'Both')[] = ['Bar', 'Kitchen', 'Both'];
export const ALL_STATUS: ('Active' | 'Draft' | 'Archived')[] = ['Active', 'Draft', 'Archived'];
export const ALL_CAPABILITIES: BenchCapability[] = [
  'oven', 'prep', 'pack', 'proofing', 'cold-prep', 'front-of-house', 'assemble',
];
export const COMMON_UNITS = ['unit', 'g', 'ml', 'kg'];

// ──────────────────────────────────────────────────────────────────────────────
// Shared formatting helpers.

export function formatShelfLife(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const hours = minutes / 60;
  if (hours < 24) {
    return Number.isInteger(hours) ? `${hours}h` : `${hours.toFixed(1)}h`;
  }
  const days = hours / 24;
  return Number.isInteger(days) ? `${days}d` : `${days.toFixed(1)}d`;
}

export function formatStageDuration(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const hours = minutes / 60;
  return Number.isInteger(hours) ? `${hours}h` : `${hours.toFixed(1)}h`;
}

export function kindToModeLabel(recipe: Recipe): string {
  if (recipe.kind === 'assembly') return 'Assembly · variable';
  if (recipe.kind === 'component') return recipe.isPrep ? 'Component · day-end prep' : 'Component · run';
  return 'Stand-alone';
}

// ──────────────────────────────────────────────────────────────────────────────
// Shared pills + small visuals.

export function KindPill({ kind, isPrep }: { kind: RecipeKind; isPrep?: boolean }) {
  const cfg: Record<RecipeKind, { label: string; bg: string; color: string }> = {
    standalone: { label: 'Stand-alone', bg: 'var(--color-bg-hover)',  color: 'var(--color-text-secondary)' },
    component:  { label: 'Component',   bg: 'rgba(241,180,52,0.16)',  color: 'var(--color-warning)' },
    assembly:   { label: 'Assembly',    bg: 'rgba(3,28,89,0.07)',     color: 'var(--color-accent-active)' },
  };
  const { label, bg, color } = cfg[kind];
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        alignSelf: 'flex-start',
        padding: '3px 9px',
        borderRadius: '100px',
        background: bg,
        color,
        fontSize: '11px',
        fontWeight: 700,
        letterSpacing: '0.02em',
      }}
    >
      {isPrep ? 'Prep' : label}
    </span>
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// Workflow DAG view — D-2 / D-1 / D0 lanes, one row per contributing workflow.

type LaneOffset = -2 | -1 | 0;
const LANE_ORDER: LaneOffset[] = [-2, -1, 0];
const LANE_LABEL: Record<LaneOffset, string> = { [-2]: 'D-2', [-1]: 'D-1', [0]: 'D0 (today)' };

type FlowRow = {
  recipeId: string;
  recipeName: string;
  isSelf: boolean;
  stages: {
    id: string;
    label: string;
    capability: string;
    leadOffset: LaneOffset;
    durationMinutes: number;
    workType: WorkType;
    requiresEquipment?: Equipment[];
  }[];
};

function buildFlowRows(
  recipe: Recipe,
  recipesById: Map<string, Recipe>,
  workflows: Record<WorkflowId, ProductionWorkflow>,
): FlowRow[] {
  const rows: FlowRow[] = [];
  for (const sub of recipe.subRecipes ?? []) {
    const subRec = recipesById.get(sub.recipeId);
    if (!subRec || !subRec.workflowId) continue;
    const wf = workflows[subRec.workflowId];
    if (!wf) continue;
    rows.push({
      recipeId: subRec.id,
      recipeName: subRec.name,
      isSelf: false,
      stages: wf.stages.map((s) => ({
        id: s.id,
        label: s.label,
        capability: s.capability,
        leadOffset: s.leadOffset,
        durationMinutes: s.durationMinutes,
        workType: stageWorkType(s),
        requiresEquipment: s.requiresEquipment,
      })),
    });
  }
  if (recipe.workflowId) {
    const wf = workflows[recipe.workflowId];
    if (wf) {
      rows.push({
        recipeId: recipe.id,
        recipeName: recipe.name,
        isSelf: true,
        stages: wf.stages.map((s) => ({
          id: s.id,
          label: s.label,
          capability: s.capability,
          leadOffset: s.leadOffset,
          durationMinutes: s.durationMinutes,
          workType: stageWorkType(s),
          requiresEquipment: s.requiresEquipment,
        })),
      });
    }
  }
  return rows;
}

export function WorkflowDiagram({
  recipe, recipesById, workflows,
}: {
  recipe: Recipe;
  recipesById: Map<string, Recipe>;
  workflows: Record<WorkflowId, ProductionWorkflow>;
}) {
  const rows = buildFlowRows(recipe, recipesById, workflows);

  if (rows.length === 0) {
    return (
      <div style={{ fontSize: '12.5px', color: 'var(--color-text-muted)' }}>
        No production workflow attached to this recipe.
      </div>
    );
  }

  return (
    <div
      style={{
        border: '1px solid var(--color-border-subtle)',
        borderRadius: '10px',
        padding: '10px 12px 14px',
        background: '#FBFAF8',
        overflowX: 'auto',
      }}
    >
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '160px repeat(3, minmax(140px, 1fr))',
          gap: '8px',
          fontSize: '10.5px',
          fontWeight: 700,
          textTransform: 'uppercase',
          letterSpacing: '0.06em',
          color: 'var(--color-text-muted)',
          paddingBottom: '8px',
          borderBottom: '1px solid var(--color-border-subtle)',
          marginBottom: '8px',
        }}
      >
        <span />
        {LANE_ORDER.map((lane) => (
          <span key={lane} style={{ textAlign: 'center' }}>{LANE_LABEL[lane]}</span>
        ))}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {rows.map((row) => (
          <FlowRowView key={row.recipeId} row={row} />
        ))}
      </div>

      <div style={{ fontSize: '11px', color: 'var(--color-text-muted)', marginTop: '10px', lineHeight: 1.5 }}>
        Lanes show when each stage runs relative to today. Components &amp; prep on earlier lanes feed into the final assembly on D0.
      </div>
    </div>
  );
}

function FlowRowView({ row }: { row: FlowRow }) {
  const grouped: Record<string, FlowRow['stages']> = { '-2': [], '-1': [], '0': [] };
  for (const s of row.stages) grouped[String(s.leadOffset)].push(s);

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '160px repeat(3, minmax(140px, 1fr))',
        gap: '8px',
        alignItems: 'center',
      }}
    >
      <div
        style={{
          fontSize: '12px',
          fontWeight: row.isSelf ? 700 : 600,
          color: row.isSelf ? 'var(--color-accent-active)' : 'var(--color-text-primary)',
          paddingRight: '6px',
          lineHeight: 1.3,
          minWidth: 0,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }}
      >
        {row.recipeName}
      </div>
      {LANE_ORDER.map((lane) => {
        const stages = grouped[String(lane)];
        return (
          <div
            key={lane}
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: '4px',
              alignItems: 'center',
              minHeight: '34px',
              padding: '4px',
              borderRadius: '8px',
              background: stages.length ? '#fff' : 'transparent',
              border: stages.length ? '1px dashed var(--color-border-subtle)' : '1px dashed transparent',
            }}
          >
            {stages.map((s, i) => (
              <span key={s.id} style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                <StageChip stage={s} accent={row.isSelf} />
                {i < stages.length - 1 && (
                  <span style={{ color: 'var(--color-border)', fontSize: '12px' }}>→</span>
                )}
              </span>
            ))}
          </div>
        );
      })}
    </div>
  );
}

function StageChip({
  stage, accent,
}: {
  stage: FlowRow['stages'][number];
  accent: boolean;
}) {
  return (
    <span
      style={{
        display: 'inline-flex', flexDirection: 'column',
        padding: '5px 9px 6px',
        borderRadius: '6px',
        background: accent ? 'rgba(3,28,89,0.08)' : 'var(--color-bg-hover)',
        border: '1px solid ' + (accent ? 'rgba(3,28,89,0.18)' : 'var(--color-border-subtle)'),
        fontSize: '11.5px',
        lineHeight: 1.25,
        minWidth: 0,
        gap: 3,
      }}
    >
      <span style={{ fontWeight: 700, color: accent ? 'var(--color-accent-active)' : 'var(--color-text-primary)' }}>
        {stage.label}
      </span>
      <span
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 4,
          flexWrap: 'wrap',
        }}
      >
        <WorkTypeChip workType={stage.workType} size="xs" />
        {stage.requiresEquipment?.map((eq) => (
          <span
            key={eq}
            title={`${EQUIPMENT_LABELS[eq]} — equipment required`}
            style={{
              display: 'inline-flex', alignItems: 'center',
              padding: '2px 7px',
              borderRadius: 100,
              background: '#fff',
              border: '1px solid var(--color-border)',
              color: 'var(--color-text-secondary)',
              fontSize: 10,
              fontWeight: 600,
              fontFamily: 'var(--font-primary)',
              whiteSpace: 'nowrap',
              lineHeight: 1.1,
            }}
          >
            {EQUIPMENT_LABELS[eq]}
          </span>
        ))}
      </span>
      <span style={{ fontSize: '10.5px', color: 'var(--color-text-muted)', fontWeight: 500 }}>
        {stage.capability} · {formatStageDuration(stage.durationMinutes)}
      </span>
    </span>
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// Editor styles (shared between editors).

export const editInputStyle: React.CSSProperties = {
  width: '100%',
  padding: '8px 11px',
  borderRadius: '8px',
  border: '1px solid var(--color-border-subtle)',
  background: '#fff',
  fontSize: '13px',
  fontFamily: 'var(--font-primary)',
  color: 'var(--color-text-primary)',
  outline: 'none',
  boxSizing: 'border-box',
};

export const editLabelStyle: React.CSSProperties = {
  fontSize: '10.5px',
  fontWeight: 700,
  letterSpacing: '0.04em',
  textTransform: 'uppercase',
  color: 'var(--color-text-muted)',
  marginBottom: '4px',
  display: 'block',
};

export const editChipBase: React.CSSProperties = {
  padding: '6px 13px',
  borderRadius: '100px',
  fontSize: '12px',
  fontWeight: 600,
  cursor: 'pointer',
  fontFamily: 'var(--font-primary)',
  border: '1px solid var(--color-border-subtle)',
  background: '#fff',
  color: 'var(--color-text-secondary)',
};

export const editChipActive: React.CSSProperties = {
  background: 'var(--color-accent-active)',
  border: '1px solid transparent',
  color: '#fff',
};

export const editIconBtnStyle: React.CSSProperties = {
  width: '30px', height: '30px',
  borderRadius: '7px',
  border: '1px solid var(--color-border-subtle)',
  background: '#fff',
  color: 'var(--color-text-muted)',
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
  cursor: 'pointer',
  flexShrink: 0,
};

export const editHintStyle: React.CSSProperties = {
  marginTop: '4px',
  fontSize: '10.5px',
  color: 'var(--color-text-muted)',
  fontFamily: 'var(--font-primary)',
  lineHeight: 1.3,
};

/** Multi-select picker for stage equipment requirements. Renders a row of
 *  small chips for each piece of equipment in `EQUIPMENT_ORDER`; clicking
 *  toggles inclusion. Most stages won't require any equipment so the
 *  empty state collapses cleanly. */
function EquipmentMultiPicker({
  value, onChange,
}: {
  value: Equipment[];
  onChange: (next: Equipment[]) => void;
}) {
  function toggle(eq: Equipment) {
    if (value.includes(eq)) onChange(value.filter((e) => e !== eq));
    else onChange([...value, eq]);
  }
  return (
    <div
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: 4,
        padding: '4px 6px',
        border: '1px solid var(--color-border-subtle)',
        borderRadius: '8px',
        background: '#fff',
        minHeight: 32,
        alignItems: 'center',
      }}
    >
      {EQUIPMENT_ORDER.map((eq) => {
        const on = value.includes(eq);
        return (
          <button
            key={eq}
            type="button"
            onClick={() => toggle(eq)}
            title={EQUIPMENT_LABELS[eq]}
            style={{
              padding: '3px 8px',
              borderRadius: 100,
              fontSize: 10.5,
              fontWeight: 600,
              cursor: 'pointer',
              fontFamily: 'var(--font-primary)',
              border: '1px solid ' + (on ? 'transparent' : 'var(--color-border-subtle)'),
              background: on ? 'var(--color-accent-active)' : 'transparent',
              color: on ? '#fff' : 'var(--color-text-secondary)',
              whiteSpace: 'nowrap',
            }}
          >
            {EQUIPMENT_LABELS[eq]}
          </button>
        );
      })}
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// Editor components.

export function BasicsEditor({
  draft, onChange, onProductionChange,
}: {
  draft: Recipe;
  onChange: (patch: Partial<Recipe>) => void;
  onProductionChange: (patch: Partial<Recipe['production']>) => void;
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
      <div>
        <label style={editLabelStyle}>Name</label>
        <input
          value={draft.name}
          onChange={(e) => onChange({ name: e.target.value })}
          style={editInputStyle}
          placeholder="Recipe name"
        />
      </div>

      <div>
        <label style={editLabelStyle}>Category</label>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
          {ALL_RECIPE_CATEGORIES.map((c) => {
            const on = draft.category === c;
            return (
              <button
                key={c}
                onClick={() => onChange({ category: c })}
                style={{ ...editChipBase, ...(on ? editChipActive : {}) }}
              >
                {c}
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <label style={editLabelStyle}>Kind</label>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
          {ALL_KINDS.map((k) => {
            const on = draft.kind === k;
            const disabled = k === 'assembly' && (!draft.subRecipes || draft.subRecipes.length === 0);
            const label = k === 'standalone' ? 'Stand-alone' : k === 'component' ? 'Component' : 'Assembly';
            return (
              <button
                key={k}
                onClick={() => !disabled && onChange({ kind: k })}
                disabled={disabled}
                title={disabled ? 'Add a sub-recipe first to make this an assembly' : undefined}
                style={{
                  ...editChipBase,
                  ...(on ? editChipActive : {}),
                  opacity: disabled ? 0.45 : 1,
                  cursor: disabled ? 'not-allowed' : 'pointer',
                }}
              >
                {label}
              </button>
            );
          })}
        </div>
        <label style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', marginTop: '10px', fontSize: '12.5px', color: 'var(--color-text-secondary)', cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={draft.isPrep ?? false}
            onChange={(e) => onChange({ isPrep: e.target.checked })}
          />
          Day-end prep (orphan component, surfaced under Components &amp; prep)
        </label>
      </div>

      <div>
        <label style={editLabelStyle}>Status</label>
        <div style={{ display: 'flex', gap: '6px' }}>
          {ALL_STATUS.map((s) => {
            const on = draft.status === s;
            return (
              <button
                key={s}
                onClick={() => onChange({ status: s })}
                style={{ ...editChipBase, ...(on ? editChipActive : {}) }}
              >
                {s}
              </button>
            );
          })}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
        <div>
          <label style={editLabelStyle}>Shelf life (minutes)</label>
          <input
            type="number"
            min={0}
            value={draft.production.shelfLifeMinutes ?? ''}
            onChange={(e) => {
              const v = e.target.value === '' ? null : Number(e.target.value);
              onProductionChange({ shelfLifeMinutes: Number.isFinite(v as number) ? (v as number) : null });
            }}
            style={editInputStyle}
            placeholder="—"
          />
        </div>
        <div>
          <label style={editLabelStyle}>Prep time (seconds)</label>
          <input
            type="number"
            min={0}
            value={draft.production.prepTimeSeconds ?? ''}
            onChange={(e) => {
              const v = e.target.value === '' ? null : Number(e.target.value);
              onProductionChange({ prepTimeSeconds: Number.isFinite(v as number) ? (v as number) : null });
            }}
            style={editInputStyle}
            placeholder="—"
          />
        </div>
      </div>

      <div>
        <label style={editLabelStyle}>Visibility</label>
        <div style={{ display: 'flex', gap: '6px' }}>
          {(['—', ...ALL_VISIBILITY] as const).map((v) => {
            const on = (draft.production.visibility ?? '—') === v;
            return (
              <button
                key={v}
                onClick={() => onProductionChange({ visibility: v === '—' ? null : v })}
                style={{ ...editChipBase, ...(on ? editChipActive : {}) }}
              >
                {v}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export function PriceEditor({
  draft, onChange,
}: {
  draft: Recipe;
  onChange: (patch: Partial<Recipe>) => void;
}) {
  function recompute(patch: Partial<Recipe>) {
    const merged = { ...draft, ...patch };
    const dineIn = merged.priceDineIn || 0;
    const cost = merged.ingredientCost || 0;
    const margin = dineIn > 0 ? Math.round(((dineIn - cost) / dineIn) * 100) : 0;
    onChange({ ...patch, marginPct: margin });
  }
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '14px' }}>
      <div>
        <label style={editLabelStyle}>Ingredient cost (£)</label>
        <input
          type="number" min={0} step="0.01"
          value={draft.ingredientCost}
          onChange={(e) => recompute({ ingredientCost: Number(e.target.value) || 0 })}
          style={editInputStyle}
        />
      </div>
      <div>
        <label style={editLabelStyle}>Dine-in price (£)</label>
        <input
          type="number" min={0} step="0.01"
          value={draft.priceDineIn}
          onChange={(e) => recompute({ priceDineIn: Number(e.target.value) || 0 })}
          style={editInputStyle}
        />
      </div>
      <div>
        <label style={editLabelStyle}>Takeaway price (£)</label>
        <input
          type="number" min={0} step="0.01"
          value={draft.priceTakeaway}
          onChange={(e) => onChange({ priceTakeaway: Number(e.target.value) || 0 })}
          style={editInputStyle}
        />
      </div>
      <div>
        <label style={editLabelStyle}>Delivery price (£)</label>
        <input
          type="number" min={0} step="0.01"
          value={draft.priceDelivery}
          onChange={(e) => onChange({ priceDelivery: Number(e.target.value) || 0 })}
          style={editInputStyle}
        />
      </div>
      <div style={{ gridColumn: '1 / -1', fontSize: '12px', color: 'var(--color-text-muted)' }}>
        Dine-in margin recomputed automatically: <strong style={{ color: 'var(--color-text-primary)' }}>{draft.marginPct}%</strong>
      </div>
    </div>
  );
}

export function IngredientsEditor({
  ingredients, onChange,
}: {
  ingredients: Recipe['ingredients'];
  onChange: (next: Recipe['ingredients']) => void;
}) {
  function update(i: number, patch: Partial<Recipe['ingredients'][number]>) {
    onChange(ingredients.map((ing, idx) => (idx === i ? { ...ing, ...patch } : ing)));
  }
  function remove(i: number) {
    onChange(ingredients.filter((_, idx) => idx !== i));
  }
  function add() {
    onChange([...ingredients, { name: '', qty: '', supplier: '' }]);
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      {ingredients.length === 0 && (
        <div style={{ fontSize: '12.5px', color: 'var(--color-text-muted)' }}>No ingredients yet.</div>
      )}
      {ingredients.map((ing, i) => (
        <div
          key={i}
          style={{
            display: 'grid',
            gridTemplateColumns: '1.4fr 0.7fr 1fr 30px',
            gap: '8px',
            alignItems: 'center',
          }}
        >
          <input
            value={ing.name}
            placeholder="Name"
            onChange={(e) => update(i, { name: e.target.value })}
            style={editInputStyle}
          />
          <input
            value={ing.qty}
            placeholder="Qty"
            onChange={(e) => update(i, { qty: e.target.value })}
            style={editInputStyle}
          />
          <input
            value={ing.supplier}
            placeholder="Supplier"
            onChange={(e) => update(i, { supplier: e.target.value })}
            style={editInputStyle}
          />
          <button
            onClick={() => remove(i)}
            aria-label="Remove ingredient"
            style={editIconBtnStyle}
          >
            <Trash2 size={14} />
          </button>
        </div>
      ))}
      <button
        onClick={add}
        style={{
          marginTop: '4px',
          alignSelf: 'flex-start',
          padding: '7px 14px',
          borderRadius: '8px',
          border: '1px dashed var(--color-border)',
          background: '#fff',
          fontSize: '12.5px',
          fontWeight: 600,
          color: 'var(--color-text-secondary)',
          cursor: 'pointer',
          display: 'inline-flex', alignItems: 'center', gap: '6px',
          fontFamily: 'var(--font-primary)',
        }}
      >
        <Plus size={13} /> Add ingredient
      </button>
    </div>
  );
}

export function ModifierGroupsEditor({
  selected, onChange,
}: {
  selected: string[];
  onChange: (next: string[]) => void;
}) {
  function toggle(name: string) {
    if (selected.includes(name)) onChange(selected.filter((g) => g !== name));
    else onChange([...selected, name]);
  }
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
      {MODIFIER_GROUPS.map((g) => {
        const on = selected.includes(g.name);
        return (
          <button
            key={g.id}
            onClick={() => toggle(g.name)}
            style={{ ...editChipBase, ...(on ? editChipActive : {}) }}
          >
            {on && <Check size={12} strokeWidth={2.6} style={{ marginRight: '5px' }} />}
            {g.name}
          </button>
        );
      })}
    </div>
  );
}

export function SubRecipesEditor({
  subRecipes, recipesById, selfId, onChange,
}: {
  subRecipes: RecipeSubRecipe[];
  recipesById: Map<string, Recipe>;
  selfId: string;
  onChange: (next: RecipeSubRecipe[]) => void;
}) {
  const [pickerOpen, setPickerOpen] = useState(false);

  function update(i: number, patch: Partial<RecipeSubRecipe>) {
    onChange(subRecipes.map((s, idx) => (idx === i ? { ...s, ...patch } : s)));
  }
  function remove(i: number) {
    onChange(subRecipes.filter((_, idx) => idx !== i));
  }
  function move(i: number, dir: -1 | 1) {
    const next = [...subRecipes];
    const target = i + dir;
    if (target < 0 || target >= next.length) return;
    [next[i], next[target]] = [next[target], next[i]];
    onChange(next);
  }
  function add(recipeId: string) {
    if (subRecipes.some((s) => s.recipeId === recipeId)) {
      setPickerOpen(false);
      return;
    }
    onChange([...subRecipes, { recipeId, quantityPerUnit: 1, unit: 'unit' }]);
    setPickerOpen(false);
  }

  const candidates = Array.from(recipesById.values())
    .filter((r) => r.id !== selfId && !subRecipes.some((s) => s.recipeId === r.id))
    .sort((a, b) => {
      const order = { component: 0, standalone: 1, assembly: 2 } as Record<RecipeKind, number>;
      const oa = order[a.kind];
      const ob = order[b.kind];
      if (oa !== ob) return oa - ob;
      return a.name.localeCompare(b.name);
    });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      {subRecipes.length === 0 && (
        <div style={{ fontSize: '12.5px', color: 'var(--color-text-muted)' }}>
          No sub-recipes. Add one to make this an assembly that depends on other recipes.
        </div>
      )}
      {subRecipes.map((sub, i) => {
        const subRec = recipesById.get(sub.recipeId);
        return (
          <div
            key={sub.recipeId}
            style={{
              display: 'grid',
              gridTemplateColumns: '24px 1.6fr 90px 110px 30px 30px 30px',
              gap: '8px',
              alignItems: 'center',
              padding: '8px',
              borderRadius: '10px',
              border: '1px solid var(--color-border-subtle)',
              background: '#fff',
            }}
          >
            <span style={{ textAlign: 'center', fontSize: '11.5px', fontWeight: 700, color: 'var(--color-text-muted)' }}>
              {i + 1}
            </span>
            <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-text-primary)', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {subRec ? subRec.name : sub.recipeId}
            </span>
            <input
              type="number" min={0} step="any"
              value={sub.quantityPerUnit}
              onChange={(e) => update(i, { quantityPerUnit: Number(e.target.value) || 0 })}
              style={editInputStyle}
              aria-label="Quantity per unit"
            />
            <select
              value={sub.unit}
              onChange={(e) => update(i, { unit: e.target.value })}
              style={{ ...editInputStyle, padding: '7px 10px' }}
              aria-label="Unit"
            >
              {COMMON_UNITS.map((u) => (
                <option key={u} value={u}>{u}</option>
              ))}
              {!COMMON_UNITS.includes(sub.unit) && <option value={sub.unit}>{sub.unit}</option>}
            </select>
            <button
              onClick={() => move(i, -1)}
              disabled={i === 0}
              aria-label="Move up"
              style={{ ...editIconBtnStyle, opacity: i === 0 ? 0.4 : 1, cursor: i === 0 ? 'not-allowed' : 'pointer' }}
            >
              <ArrowUp size={14} />
            </button>
            <button
              onClick={() => move(i, 1)}
              disabled={i === subRecipes.length - 1}
              aria-label="Move down"
              style={{ ...editIconBtnStyle, opacity: i === subRecipes.length - 1 ? 0.4 : 1, cursor: i === subRecipes.length - 1 ? 'not-allowed' : 'pointer' }}
            >
              <ArrowDown size={14} />
            </button>
            <button
              onClick={() => remove(i)}
              aria-label="Remove sub-recipe"
              style={editIconBtnStyle}
            >
              <Trash2 size={14} />
            </button>
          </div>
        );
      })}

      <div style={{ position: 'relative', alignSelf: 'flex-start' }}>
        <button
          onClick={() => setPickerOpen((v) => !v)}
          style={{
            marginTop: '4px',
            padding: '7px 14px',
            borderRadius: '8px',
            border: '1px dashed var(--color-border)',
            background: '#fff',
            fontSize: '12.5px', fontWeight: 600,
            color: 'var(--color-text-secondary)',
            cursor: 'pointer',
            display: 'inline-flex', alignItems: 'center', gap: '6px',
            fontFamily: 'var(--font-primary)',
          }}
        >
          <Plus size={13} /> Add sub-recipe
        </button>
        {pickerOpen && (
          <SubRecipePicker candidates={candidates} onPick={add} onClose={() => setPickerOpen(false)} />
        )}
      </div>
    </div>
  );
}

function SubRecipePicker({
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
      if (!t.closest('[data-sub-picker]')) onClose();
    };
    const t = setTimeout(() => document.addEventListener('mousedown', h), 0);
    return () => { clearTimeout(t); document.removeEventListener('mousedown', h); };
  }, [onClose]);
  const filtered = candidates.filter((r) => r.name.toLowerCase().includes(q.toLowerCase())).slice(0, 80);
  return (
    <div
      data-sub-picker
      style={{
        position: 'absolute',
        top: 'calc(100% + 6px)',
        left: 0,
        zIndex: 50,
        width: '360px',
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
          style={editInputStyle}
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
              width: '100%',
              padding: '8px 12px',
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
            <KindPill kind={r.kind} isPrep={r.isPrep} />
          </button>
        ))}
      </div>
    </div>
  );
}

export function WorkflowEditor({
  workflow, onChange,
}: {
  workflow: ProductionWorkflow;
  onChange: (updater: (wf: ProductionWorkflow) => ProductionWorkflow) => void;
}) {
  function updateStage(i: number, patch: Partial<WorkflowStage>) {
    onChange((wf) => ({
      ...wf,
      stages: wf.stages.map((s, idx) => (idx === i ? { ...s, ...patch } : s)),
    }));
  }
  function removeStage(i: number) {
    onChange((wf) => {
      const removedId = wf.stages[i]?.id;
      return {
        ...wf,
        stages: wf.stages.filter((_, idx) => idx !== i),
        edges: wf.edges.filter((e) => e.from !== removedId && e.to !== removedId),
      };
    });
  }
  function moveStage(i: number, dir: -1 | 1) {
    onChange((wf) => {
      const next = [...wf.stages];
      const target = i + dir;
      if (target < 0 || target >= next.length) return wf;
      [next[i], next[target]] = [next[target], next[i]];
      return { ...wf, stages: next };
    });
  }
  function addStage() {
    onChange((wf) => {
      const newId = `stage-${Date.now().toString(36)}`;
      const prevId = wf.stages[wf.stages.length - 1]?.id;
      return {
        ...wf,
        stages: [
          ...wf.stages,
          { id: newId, label: 'New stage', capability: 'prep', leadOffset: 0, durationMinutes: 10 },
        ],
        edges: prevId ? [...wf.edges, { from: prevId, to: newId }] : wf.edges,
      };
    });
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
      <div style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>
        Workflow <strong style={{ color: 'var(--color-text-primary)' }}>{workflow.id}</strong> · {workflow.stages.length} stage{workflow.stages.length === 1 ? '' : 's'}.
        Edits apply to every recipe sharing this workflow.
      </div>
      {workflow.stages.length === 0 && (
        <div style={{ fontSize: '12.5px', color: 'var(--color-text-muted)' }}>No stages yet.</div>
      )}
      {workflow.stages.map((stage, i) => (
        <div
          key={stage.id}
          style={{
            border: '1px solid var(--color-border-subtle)',
            borderRadius: '12px',
            padding: '10px 12px',
            background: '#fff',
            display: 'flex',
            flexDirection: 'column',
            gap: '10px',
          }}
        >
          <div style={{ display: 'grid', gridTemplateColumns: '24px 1fr 30px 30px 30px', gap: '8px', alignItems: 'center' }}>
            <span style={{ textAlign: 'center', fontSize: '11.5px', fontWeight: 700, color: 'var(--color-text-muted)' }}>
              {i + 1}
            </span>
            <input
              value={stage.label}
              onChange={(e) => updateStage(i, { label: e.target.value })}
              placeholder="Stage label"
              style={editInputStyle}
              aria-label="Stage label"
            />
            <button
              onClick={() => moveStage(i, -1)}
              disabled={i === 0}
              aria-label="Move up"
              style={{ ...editIconBtnStyle, opacity: i === 0 ? 0.4 : 1, cursor: i === 0 ? 'not-allowed' : 'pointer' }}
            >
              <ArrowUp size={14} />
            </button>
            <button
              onClick={() => moveStage(i, 1)}
              disabled={i === workflow.stages.length - 1}
              aria-label="Move down"
              style={{ ...editIconBtnStyle, opacity: i === workflow.stages.length - 1 ? 0.4 : 1, cursor: i === workflow.stages.length - 1 ? 'not-allowed' : 'pointer' }}
            >
              <ArrowDown size={14} />
            </button>
            <button
              onClick={() => removeStage(i)}
              aria-label="Remove stage"
              style={editIconBtnStyle}
            >
              <Trash2 size={14} />
            </button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1.1fr 1.1fr 1fr', gap: '10px', alignItems: 'flex-end' }}>
            <div>
              <label style={editLabelStyle}>Work type</label>
              <select
                value={stageWorkType(stage)}
                onChange={(e) => updateStage(i, { workType: e.target.value as WorkType })}
                style={{ ...editInputStyle, padding: '7px 10px' }}
              >
                {WORK_TYPE_ORDER.map((w) => (
                  <option key={w} value={w}>{WORK_TYPE_LABELS[w]}</option>
                ))}
              </select>
              {stage.workType == null && (
                <div style={editHintStyle}>
                  Default from {stage.capability} capability
                </div>
              )}
            </div>
            <div>
              <label style={editLabelStyle}>Bench (capability)</label>
              <select
                value={stage.capability}
                onChange={(e) => {
                  const nextCap = e.target.value as BenchCapability;
                  // If workType is currently the implicit default for the
                  // PREVIOUS capability, snap it to the new capability's
                  // default. If the user explicitly chose a workType
                  // (different from the previous capability default), keep
                  // their choice.
                  const wasImplicit = stage.workType == null
                    || stage.workType === workTypeFromCapability(stage.capability);
                  updateStage(i, {
                    capability: nextCap,
                    workType: wasImplicit ? undefined : stage.workType,
                  });
                }}
                style={{ ...editInputStyle, padding: '7px 10px' }}
              >
                {ALL_CAPABILITIES.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
            <div>
              <label style={editLabelStyle}>Lane</label>
              <div style={{ display: 'flex', gap: '5px' }}>
                {([-2, -1, 0] as const).map((lo) => {
                  const on = stage.leadOffset === lo;
                  return (
                    <button
                      key={lo}
                      onClick={() => updateStage(i, { leadOffset: lo })}
                      style={{ ...editChipBase, ...(on ? editChipActive : {}), padding: '6px 11px' }}
                    >
                      {lo === 0 ? 'D0' : `D${lo}`}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '10px', alignItems: 'flex-end' }}>
            <div>
              <label style={editLabelStyle}>Equipment required</label>
              <EquipmentMultiPicker
                value={stage.requiresEquipment ?? []}
                onChange={(next) => updateStage(i, { requiresEquipment: next.length > 0 ? next : undefined })}
              />
            </div>
            <div>
              <label style={editLabelStyle}>Duration (min)</label>
              <input
                type="number" min={1}
                value={stage.durationMinutes}
                onChange={(e) => updateStage(i, { durationMinutes: Math.max(1, Number(e.target.value) || 1) })}
                style={editInputStyle}
              />
            </div>
          </div>
        </div>
      ))}
      <button
        onClick={addStage}
        style={{
          marginTop: '4px',
          alignSelf: 'flex-start',
          padding: '7px 14px',
          borderRadius: '8px',
          border: '1px dashed var(--color-border)',
          background: '#fff',
          fontSize: '12.5px', fontWeight: 600,
          color: 'var(--color-text-secondary)',
          cursor: 'pointer',
          display: 'inline-flex', alignItems: 'center', gap: '6px',
          fontFamily: 'var(--font-primary)',
        }}
      >
        <Plus size={13} /> Add stage
      </button>
    </div>
  );
}
