import type { Allergen } from '@/components/Suppliers/fixtures';
import type { SampleId } from './fixtures';

export type Step =
  | 'capture'
  | 'reading'
  | 'wrongDoc'
  | 'duplicate'
  | 'whichOrders'
  | 'review'
  | 'confirm'
  | 'done';

export interface CapturedPage {
  id: string;
  sampleId: SampleId | null;
  /** Object URL for a real camera photo. */
  imageUrl?: string;
}

/** One decision per document line, keyed by line id. */
export interface LineDecision {
  choice?: string;
  packId?: string;
  name?: string;
  allergens?: Allergen[];
  noAllergens?: boolean;
}

export type Decisions = Record<string, LineDecision>;
