'use client';

/**
 * RecipeCompositionSection
 *
 * One unified card for everything that makes up a recipe. Internal dividers
 * separate the sections; the outer shell never changes when you add/remove
 * variants — only the inner content adapts.
 *
 * Standard mode:  Ingredients · Packaging · POS & modifiers
 * Variants mode:  Variants matrix · POS & sellability
 * Always shown:   Allergens · Instructions · Photo
 *
 * Modifier-group POS mappings live on each group itself (catalogue-level),
 * not on the recipe — the in-recipe drawer editor surfaces them directly so
 * you don't have to leave the recipe to set them.
 */

import React, { useState } from 'react';
import {
  Image as ImageIcon, Layers, Plus, X, Pencil,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { IngredientsV2Section } from './IngredientsV2Section';
import { VariantsSection } from './VariantsSection';
import { MethodStepsEditor } from './MethodStepsEditor';
import {
  SectionHeader, FieldLabel, Soft, PillMulti,
  ALLERGENS, SITES,
} from './RecipeFormParts';
import type { RecipeIngredient, RecipeVariant } from './libraryFixtures';
import { useModifierGroups } from '@/components/Modifiers/store';
import type { ModifierGroup } from '@/components/Modifiers/types';
import { GroupEditorDrawer } from '@/components/Modifiers/GroupEditorDrawer';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function newVariantId(): string {
  return `var-${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * A titled sub-section inside the unified card, separated by a hairline.
 * `hint` renders inline (use for conceptually loaded sub-sections where
 * users need context before they can act). `help` renders behind a "?"
 * tooltip next to the title (use for occasional clarification).
 */
function SubSection({
  title, hint, help, children, first = false,
}: {
  title: string;
  hint?: string;
  help?: React.ReactNode;
  children: React.ReactNode;
  first?: boolean;
}) {
  return (
    <div
      style={{
        borderTop: first ? 'none' : '1px solid var(--color-border-subtle)',
        paddingTop: first ? 0 : 18,
        marginTop: first ? 0 : 18,
      }}
    >
      <SectionHeader title={title} hint={hint} help={help} />
      <div style={{ marginTop: 10 }}>{children}</div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function RecipeCompositionSection({
  showModeQuestion = false,
  onModeQuestionDismissed,
  ingredients,
  packaging,
  modifierGroupIds,
  variants,
  basePrices,
  allergens,
  instructions,
  photoName,
  sites,
  onIngredientsChange,
  onPackagingChange,
  onModifierGroupsChange,
  onVariantsChange,
  onAllergensChange,
  onInstructionsChange,
  onPhotoChange,
}: {
  showModeQuestion?: boolean;
  onModeQuestionDismissed?: () => void;
  ingredients: RecipeIngredient[];
  packaging: RecipeIngredient[];
  modifierGroupIds: string[];
  variants: RecipeVariant[];
  basePrices: { dineIn: number; takeaway: number; delivery: number };
  allergens: string[];
  instructions: string;
  photoName: string | null;
  sites: string[];
  // NB: POS link & source-id deliberately not exposed here. POS
  // sellability / source mapping now lives in the POS matching area,
  // not on the recipe form. The underlying fields still exist on the
  // recipe model so the matcher can read/write them; we just stopped
  // surfacing them in the composition UI to keep the recipe focused
  // on what's in the product, not how it's sold at the till.
  onIngredientsChange: (next: RecipeIngredient[]) => void;
  onPackagingChange: (next: RecipeIngredient[]) => void;
  onModifierGroupsChange: (next: string[]) => void;
  onVariantsChange: (next: RecipeVariant[]) => void;
  onAllergensChange: (next: string[]) => void;
  onInstructionsChange: (v: string) => void;
  onPhotoChange: (name: string | null) => void;
}) {
  const allGroups = useModifierGroups();
  const hasVariants = variants.length > 0;
  const isBlank = !hasVariants && ingredients.length === 0 && packaging.length === 0;
  const [confirmRemoveVariants, setConfirmRemoveVariants] = useState(false);

  function handleAddFirstVariant() {
    const first: RecipeVariant = {
      id: newVariantId(),
      name: 'Option 1',
      isDefault: true,
      ingredients: ingredients.map((r) => ({ ...r })),
      packaging: packaging.map((r) => ({ ...r })),
      modifierGroupIds: [...modifierGroupIds],
      priceDineIn: basePrices.dineIn || undefined,
      priceTakeaway: basePrices.takeaway || undefined,
      priceDelivery: basePrices.delivery || undefined,
    };
    onVariantsChange([first]);
    onModeQuestionDismissed?.();
  }

  function handleRemoveVariants() {
    const first = variants[0];
    if (first) {
      onIngredientsChange(first.ingredients);
      onPackagingChange(first.packaging);
      onModifierGroupsChange(first.modifierGroupIds);
    }
    onVariantsChange([]);
    setConfirmRemoveVariants(false);
  }

  // ── Mode question (intake page, fresh recipe) ──────────────────────────────

  if (showModeQuestion && isBlank) {
    return (
      <div style={cardStyle}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ fontSize: 15.5, fontWeight: 700, color: 'var(--color-text-primary)' }}>
            Does this recipe come in different sizes or formats?
          </div>
          <div style={{ fontSize: 13.5, color: 'var(--color-text-muted)', lineHeight: 1.55 }}>
            Variants are size or packaging variations like Small / Medium / Large,
            or Hot / Iced — each one has its own quantities, packaging, and price.
            Customer-facing choices like milk type or extra shots are <strong>modifiers</strong>,
            which you attach to each variant later.
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 4 }}>
            <button type="button" onClick={() => onModeQuestionDismissed?.()} style={modeBtn(false)}>
              No — single version
            </button>
            <button type="button" onClick={handleAddFirstVariant} style={modeBtn(true)}>
              <Layers size={15} strokeWidth={2} />
              Yes — add variants
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Sections always shown below the build area ─────────────────────────────

  const sharedBottom = (
    <>
      <SubSection
        title="Allergens"
        help={
          hasVariants
            ? 'Base allergens present across all variants — the union of what this recipe can contain.'
            : 'Select all allergens present in this recipe.'
        }
      >
        <PillMulti
          options={ALLERGENS}
          selected={allergens}
          onChange={onAllergensChange}
        />
      </SubSection>

      <SubSection
        title="Method & photo"
        help="Numbered steps the kitchen follows. On the production stepper each step shows one at a time and gets ticked off, so keep one action a step: weigh, load, cook, probe, container, label."
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <FieldLabel>Method <Soft>(optional)</Soft></FieldLabel>
            <MethodStepsEditor value={instructions} onChange={onInstructionsChange} />
          </div>
          <div>
            <FieldLabel>Photo <Soft>(optional)</Soft></FieldLabel>
            <label
              style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '14px 16px', borderRadius: 10,
                border: '1.5px dashed var(--color-border)',
                cursor: 'pointer',
                background: photoName ? 'var(--color-success-light)' : 'var(--color-bg-hover)',
              }}
            >
              <ImageIcon
                size={18}
                color={photoName ? 'var(--color-success)' : 'var(--color-text-muted)'}
                strokeWidth={1.8}
              />
              <span style={{
                fontSize: 14,
                color: photoName ? 'var(--color-success)' : 'var(--color-text-secondary)',
                flex: 1,
              }}>
                {photoName ?? 'Drop an image or click to upload'}
              </span>
              <input
                type="file"
                accept="image/*"
                style={{ display: 'none' }}
                onChange={(e) => onPhotoChange(e.target.files?.[0]?.name ?? null)}
              />
            </label>
          </div>
        </div>
      </SubSection>
    </>
  );

  // ── Switch-mode footer ─────────────────────────────────────────────────────

  const switchFooter = (
    <div
      style={{
        borderTop: '1px solid var(--color-border-subtle)',
        marginTop: 18, paddingTop: 14,
        display: 'flex', justifyContent: 'flex-end',
      }}
    >
      {hasVariants ? (
        confirmRemoveVariants ? (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap',
            padding: '11px 15px', borderRadius: 8,
            border: '1px solid var(--color-border-subtle)',
            background: 'var(--color-bg-hover)', fontSize: 13.5,
          }}>
            <span style={{ color: 'var(--color-text-secondary)' }}>
              Remove all variants and revert to a single version?
            </span>
            <button
              type="button"
              onClick={handleRemoveVariants}
              style={{ ...switchBtn, color: '#B01038', borderColor: '#E89AAE' }}
            >
              Yes, remove variants
            </button>
            <button type="button" onClick={() => setConfirmRemoveVariants(false)} style={switchBtn}>
              Cancel
            </button>
          </div>
        ) : (
          <button type="button" onClick={() => setConfirmRemoveVariants(true)} style={switchBtn}>
            Switch to single version
          </button>
        )
      ) : (
        <button type="button" onClick={handleAddFirstVariant} style={switchBtn}>
          <Layers size={12} strokeWidth={2} />
          Add sizes or formats (Small / Medium / Large…)
        </button>
      )}
    </div>
  );

  // ── Render: single card, content adapts by mode ────────────────────────────

  return (
    <div style={cardStyle}>
      <AnimatePresence mode="wait">
        {hasVariants ? (
          <motion.div
            key="variants"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
          >
            <SubSection
              first
              title="Variants"
              hint="Size or format versions of this recipe (Small / Medium / Large, Hot / Iced). Each column has its own quantities, packaging, and price. Modifiers like alt milks attach to each variant — they're not variants themselves. Cells that differ across variants are highlighted."
            >
              <VariantsSection
                variants={variants}
                baseIngredients={ingredients}
                basePackaging={packaging}
                baseModifierGroupIds={modifierGroupIds}
                basePrices={basePrices}
                onChange={onVariantsChange}
              />
            </SubSection>

            {sharedBottom}
          </motion.div>
        ) : (
          <motion.div
            key="standard"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
          >
            <SubSection
              first
              title="Ingredients"
              help={
                <>
                  Search across master products, supplier SKUs, and your own sub-recipes.
                  Build order is top → bottom.
                </>
              }
            >
              <IngredientsV2Section
                rows={ingredients}
                sites={sites.length > 0 ? sites : SITES}
                onChange={onIngredientsChange}
              />
            </SubSection>

            <SubSection
              title="Packaging"
              help={
                <>
                  Cups, lids, bags, labels — anything physical the order consumes.
                  Modifiers can swap packaging (e.g. Large coffee → 12 oz cup).
                </>
              }
            >
              <IngredientsV2Section
                rows={packaging}
                sites={sites.length > 0 ? sites : SITES}
                onChange={onPackagingChange}
                itemLabel="packaging"
              />
            </SubSection>

            <SubSection
              title="Modifiers"
              help={
                <>
                  Customer-facing choices like milk type, size add-ons, or extra
                  shots. Attach modifier groups from the library, or create a
                  new one without leaving this recipe. POS mapping for each
                  group lives on the group itself.
                </>
              }
            >
              <ModifiersSection
                modifierGroupIds={modifierGroupIds}
                allGroups={allGroups}
                onChange={onModifierGroupsChange}
              />
            </SubSection>

            {sharedBottom}
          </motion.div>
        )}
      </AnimatePresence>

      {switchFooter}
    </div>
  );
}

// ─── Modifier groups (standard mode) ─────────────────────────────────────────

type DrawerState =
  | { mode: 'closed' }
  | { mode: 'edit'; group: ModifierGroup }
  | { mode: 'create' };

function ModifiersSection({
  modifierGroupIds, allGroups, onChange,
}: {
  modifierGroupIds: string[];
  allGroups: ModifierGroup[];
  onChange: (next: string[]) => void;
}) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const [drawer, setDrawer] = useState<DrawerState>({ mode: 'closed' });

  const attached = allGroups.filter((g) => modifierGroupIds.includes(g.id));
  const unattached = allGroups.filter((g) => !modifierGroupIds.includes(g.id));

  function detach(id: string) { onChange(modifierGroupIds.filter((g) => g !== id)); }
  function attach(id: string) {
    if (modifierGroupIds.includes(id)) return;
    onChange([...modifierGroupIds, id]);
    setPickerOpen(false);
  }
  function openCreate() {
    setPickerOpen(false);
    setDrawer({ mode: 'create' });
  }
  function openEdit(group: ModifierGroup) {
    setDrawer({ mode: 'edit', group });
  }

  return (
    <div>
      <FieldLabel>
        Modifier groups <Soft>({attached.length} attached · groups are catalogue-level and can be shared across recipes)</Soft>
      </FieldLabel>

      {attached.length === 0 ? (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap',
          padding: '11px 13px', borderRadius: 8,
          background: 'var(--color-bg-hover)',
          fontSize: 13.5, color: 'var(--color-text-muted)',
        }}>
          <span>No modifier groups attached.</span>
          {unattached.length > 0 && (
            <button type="button" onClick={() => setPickerOpen(true)} style={attachChipStyle}>
              <Plus size={13} strokeWidth={2.4} /> Attach existing
            </button>
          )}
          <button type="button" onClick={openCreate} style={attachChipStyle}>
            <Plus size={13} strokeWidth={2.4} /> Create new group
          </button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
          {attached.map((g) => (
            <span
              key={g.id}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 7,
                padding: '9px 14px', borderRadius: 9,
                border: '1px solid var(--color-border-subtle)',
                background: '#fff', fontSize: 13.5, fontWeight: 600,
                color: 'var(--color-text-primary)',
              }}
            >
              {g.name}
              <span style={{ fontSize: 11.5, color: 'var(--color-text-muted)', fontWeight: 500 }}>
                {g.selection === 'one' ? 'pick 1' : 'pick n'} · {g.options.length}
              </span>
              {!g.posSourceId && (
                <span
                  title="No POS mapping set on this group — open to add one"
                  style={{
                    fontSize: 11, fontWeight: 700, letterSpacing: '0.04em',
                    padding: '2px 7px', borderRadius: 100,
                    background: 'rgba(241,180,52,0.18)',
                    color: 'var(--color-warning)',
                    textTransform: 'uppercase',
                  }}
                >
                  No POS
                </span>
              )}
              <button type="button" title="Edit group" onClick={() => openEdit(g)} style={iconBtnStyle}>
                <Pencil size={13} />
              </button>
              <button type="button" title="Detach" onClick={() => detach(g.id)} style={iconBtnStyle}>
                <X size={13} />
              </button>
            </span>
          ))}
          {unattached.length > 0 && (
            <button type="button" onClick={() => setPickerOpen(true)} style={attachChipStyle}>
              <Plus size={13} strokeWidth={2.4} /> Attach existing
            </button>
          )}
          <button type="button" onClick={openCreate} style={attachChipStyle}>
            <Plus size={13} strokeWidth={2.4} /> Create new group
          </button>
        </div>
      )}

      <AnimatePresence>
        {pickerOpen && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            style={{
              marginTop: 8, padding: '10px 12px', borderRadius: 8,
              border: '1px solid var(--color-border-subtle)',
              background: '#fff',
              display: 'flex', flexDirection: 'column', gap: 6,
              maxHeight: 260, overflow: 'auto',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: 2 }}>
              <span style={subLabelStyle}>Attach modifier group</span>
              <span style={{ flex: 1 }} />
              <button
                type="button"
                onClick={() => setPickerOpen(false)}
                style={{ border: 'none', background: 'transparent', cursor: 'pointer', padding: 4, color: 'var(--color-text-muted)' }}
              >
                <X size={13} />
              </button>
            </div>
            {unattached.map((g) => (
              <button
                key={g.id}
                type="button"
                onClick={() => attach(g.id)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '7px 9px', borderRadius: 7,
                  border: '1px solid var(--color-border-subtle)',
                  background: '#fff', cursor: 'pointer',
                  textAlign: 'left', fontFamily: 'var(--font-primary)',
                }}
              >
                <span style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--color-text-primary)', flex: 1 }}>
                  {g.name}
                </span>
                <span style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>
                  {g.selection === 'one' ? 'pick one' : 'pick many'} · {g.options.length}
                </span>
              </button>
            ))}
            <div style={{
              marginTop: 4, paddingTop: 8,
              borderTop: '1px dashed var(--color-border-subtle)',
            }}>
              <button
                type="button"
                onClick={openCreate}
                style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  width: '100%',
                  padding: '7px 9px', borderRadius: 7,
                  border: '1px dashed var(--color-border)',
                  background: '#fff', cursor: 'pointer',
                  textAlign: 'left', fontFamily: 'var(--font-primary)',
                  color: 'var(--color-text-secondary)', fontSize: 13.5, fontWeight: 600,
                }}
              >
                <Plus size={13} strokeWidth={2.4} />
                Create a new modifier group instead
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <GroupEditorDrawer
        open={drawer.mode !== 'closed'}
        mode={drawer.mode === 'edit' ? 'edit' : 'create'}
        initial={drawer.mode === 'edit' ? drawer.group : null}
        onClose={() => setDrawer({ mode: 'closed' })}
        onSaved={(group) => {
          if (drawer.mode === 'create' && !modifierGroupIds.includes(group.id)) {
            onChange([...modifierGroupIds, group.id]);
          }
          setDrawer({ mode: 'closed' });
        }}
        onDeleted={(id) => { setDrawer({ mode: 'closed' }); detach(id); }}
      />
    </div>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const cardStyle: React.CSSProperties = {
  padding: '20px',
  borderRadius: '12px',
  border: '1px solid var(--color-border-subtle)',
  background: '#fff',
};

const switchBtn: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: 5,
  padding: '7px 13px', borderRadius: 8,
  border: '1px solid var(--color-border-subtle)',
  background: '#fff', color: 'var(--color-text-muted)',
  fontSize: 13, fontWeight: 600, cursor: 'pointer',
  fontFamily: 'var(--font-primary)',
};

const attachChipStyle: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: 5,
  padding: '9px 14px', borderRadius: 9,
  border: '1px dashed var(--color-border)',
  background: '#fff', color: 'var(--color-text-secondary)',
  fontSize: 13.5, fontWeight: 600, cursor: 'pointer',
  fontFamily: 'var(--font-primary)',
};

const iconBtnStyle: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
  width: 26, height: 26, borderRadius: 6,
  border: '1px solid var(--color-border-subtle)',
  background: '#fff', color: 'var(--color-text-muted)',
  cursor: 'pointer',
};

const subLabelStyle: React.CSSProperties = {
  fontSize: 11.5, fontWeight: 700, letterSpacing: '0.06em',
  textTransform: 'uppercase', color: 'var(--color-text-muted)',
};

function modeBtn(active: boolean): React.CSSProperties {
  return {
    display: 'inline-flex', alignItems: 'center', gap: 7,
    padding: '11px 17px', borderRadius: 10,
    border: active ? '1px solid transparent' : '1px solid var(--color-border-subtle)',
    background: active ? 'var(--color-accent-active)' : '#fff',
    color: active ? '#fff' : 'var(--color-text-secondary)',
    fontSize: 14, fontWeight: 600, cursor: 'pointer',
    fontFamily: 'var(--font-primary)',
  };
}
