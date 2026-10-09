import type { SampleId } from './fixtures';

export type Step =
  | 'capture'
  | 'reading'
  | 'wrongDoc'
  | 'unreadable'
  | 'duplicate'
  | 'whichOrders'
  | 'clean'
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
  /** Substitute: which product the delivered line becomes. */
  subOption?: string;
  /** A matched line the GM flagged at the door. */
  problem?: 'damaged' | 'short';
  /** How many units the reported problem affects. */
  affected?: number;
  /** The GM corrected the unit price at the door. Replaces what the paper
   *  shows (or, on a delivery note, the order price). */
  price?: number;
}

export type Decisions = Record<string, LineDecision>;

/** Something that came off the van but isn't on the paper or any order. */
export interface AddedLine {
  id: string;
  name: string;
  qty: number;
  unitPrice: number;
}
