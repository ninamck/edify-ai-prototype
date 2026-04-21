/**
 * Photo intake fixture — the result of an OCR pass on a handwritten recipe card.
 *
 * Single-recipe flow (different from POS/sheet batches).
 * Each field carries a confidence tier — high (trust) / medium (review if odd) /
 * low (probably wrong, nudge user to double-check).
 */

export type Confidence = 'high' | 'medium' | 'low';

export type OcrField<T> = { value: T; confidence: Confidence };

export type OcrIngredient = {
  id: string;
  name: OcrField<string>;
  qty: OcrField<number>;
  uom: OcrField<string>;
  supplier?: OcrField<string>;
};

export type OcrRecipe = {
  photoLabel: string;           // "Handwritten card · 1 page"
  photoThumbnailHue: number;    // used to tint the placeholder "photo"
  name: OcrField<string>;
  category: OcrField<string>;
  yieldQty: OcrField<number>;
  yieldUom: OcrField<string>;
  ingredients: OcrIngredient[];
  notes?: OcrField<string>;
};

export const PHOTO_INTAKE_FIXTURE: OcrRecipe = {
  photoLabel: 'Handwritten card · 1 page',
  photoThumbnailHue: 38, // warm amber tint
  name:      { value: 'House banana bread',   confidence: 'high' },
  category:  { value: 'Pastry',               confidence: 'medium' },
  yieldQty:  { value: 10,                     confidence: 'high' },
  yieldUom:  { value: 'slice',                confidence: 'high' },
  notes:     { value: 'Rest 10 min before slicing', confidence: 'medium' },
  ingredients: [
    { id: 'i1', name: { value: 'Ripe banana',     confidence: 'high' }, qty: { value: 3,   confidence: 'high' },   uom: { value: 'unit', confidence: 'high' }, supplier: { value: 'Fresh Earth Produce', confidence: 'medium' } },
    { id: 'i2', name: { value: 'Plain flour',     confidence: 'high' }, qty: { value: 200, confidence: 'high' },   uom: { value: 'g',    confidence: 'high' }, supplier: { value: 'Bidvest',             confidence: 'high' } },
    { id: 'i3', name: { value: 'Brown sugar',     confidence: 'high' }, qty: { value: 120, confidence: 'medium' }, uom: { value: 'g',    confidence: 'high' }, supplier: { value: 'Bidvest',             confidence: 'high' } },
    { id: 'i4', name: { value: 'Butter',          confidence: 'high' }, qty: { value: 80,  confidence: 'high' },   uom: { value: 'g',    confidence: 'high' }, supplier: { value: 'Fresh Earth Produce', confidence: 'high' } },
    { id: 'i5', name: { value: 'Egg',             confidence: 'high' }, qty: { value: 2,   confidence: 'high' },   uom: { value: 'unit', confidence: 'high' }, supplier: { value: 'Fresh Earth Produce', confidence: 'high' } },
    { id: 'i6', name: { value: 'Baking soda',     confidence: 'medium' }, qty: { value: 5, confidence: 'low' },    uom: { value: 'g',    confidence: 'low' },  supplier: { value: 'Bidvest',             confidence: 'medium' } },
    { id: 'i7', name: { value: 'Vanilla extract', confidence: 'high' }, qty: { value: 5,   confidence: 'medium' }, uom: { value: 'ml',   confidence: 'high' }, supplier: { value: 'Bidvest',             confidence: 'high' } },
    { id: 'i8', name: { value: 'Salt',            confidence: 'high' }, qty: { value: 2,   confidence: 'medium' }, uom: { value: 'g',    confidence: 'high' }, supplier: { value: 'Bidvest',             confidence: 'high' } },
  ],
};

export function confidenceColor(c: Confidence): { bg: string; fg: string; label: string } {
  switch (c) {
    case 'high':   return { bg: 'var(--color-success-light)', fg: 'var(--color-success)', label: 'confident' };
    case 'medium': return { bg: 'var(--color-bg-hover)',      fg: 'var(--color-text-secondary)', label: 'check' };
    case 'low':    return { bg: 'var(--color-warning-light)', fg: 'var(--color-warning)', label: 'review' };
  }
}
