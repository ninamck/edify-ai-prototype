/**
 * suggestedPrompts — the "Suggested" chips shown in the command centre, and
 * (implicitly) the phrasing that seeds what Edify returns in chat.
 *
 * This module is deliberately brand-aware and identical on every branch: the
 * chip set is chosen at runtime from `demoCustomer.id`, so a single edit here
 * flows to both the internal build (`edify`) and any customer demo build
 * (e.g. `chagee`) without the file ever diverging between branches. Add a new
 * brand by adding a case to `CHIPS_BY_CUSTOMER`.
 */

import { ChefHat, Truck, ClipboardList, ShieldCheck, Building2, CalendarClock, type LucideIcon } from 'lucide-react';
import { demoCustomer } from '@/lib/demoConfig';

export type PromptChip = {
  label: string;
  icon: LucideIcon;
  /** Text sent to the chat when the chip has no bespoke flow. */
  text: string;
  /** Bespoke flows that don't route through the chat-command runner —
   *  the recipe builder wizard and the data-integrity audit each have
   *  their own dedicated start function.
   *    • 'recipe'     — jump straight into the builder, seeded from `text`.
   *    • 'recipe-ask' — ask "what kind of recipe?" first (using `text` as
   *                     the question), then seed the builder from the reply. */
  action?: 'recipe' | 'recipe-ask' | 'integrity';
  /** Chat-command id (see `components/Feed/commands/registry.ts`).
   *  When set, the chip launches that command's wizard via the runner,
   *  same path as the slash menu and `+` popover. */
  commandId?: string;
  /** Items waiting on the operator behind this chip. When set, the chip
   *  renders a notification-style count pill so it reads as "there is
   *  work here", not just a shortcut. Only chips whose flow has real
   *  pending data carry a count — creative actions (new recipe) don't.
   *  Counts mirror the scripted demo data in Feed.tsx: 6 = the audit's
   *  findings list (INTEGRITY_FINDINGS) — findings, not individual lines,
   *  so the job reads as achievable; 8 = STOCK_TAKE_REVIEW's products
   *  missing a storage area. */
  count?: number;
};

/** Internal / default build (Fitzroy Espresso café scenario).
 *  Labels follow one wording pattern — verb + object — so the list reads
 *  as a to-do list. Chips with pending data carry a count. */
const DEFAULT_CHIPS: PromptChip[] = [
  {
    label: 'Rebalance the rota',
    icon: CalendarClock,
    text: '',
    commandId: 'rota-rebalance',
  },
  {
    label: 'Set up new sites',
    icon: Building2,
    text: '',
    commandId: 'site-setup',
  },
  {
    label: 'Create a recipe',
    icon: ChefHat,
    text: "I'm releasing avocado toast on the new menu — target 25% food cost.",
    action: 'recipe',
  },
  {
    label: 'Update a recipe',
    icon: ChefHat,
    text: 'Sure — what kind of recipe would you like to update? Type the dish and I’ll pull it up.',
    action: 'recipe-ask',
  },
  {
    label: 'Update a supplier',
    icon: Truck,
    text: '',
    commandId: 'supplier',
  },
  {
    label: 'Add products to stock takes',
    icon: ClipboardList,
    text: "Can you update my stock takes? Review all the products that aren't in a stock area.",
    count: 8,
  },
  {
    // Product Voice: "data issues" is config-speak — the glossary
    // translation is "something in your data making a number wrong".
    label: 'Fix wrong recipe costs',
    icon: ShieldCheck,
    text: '',
    action: 'integrity',
    count: 6,
  },
];

// Per-brand chip overrides. Currently empty on purpose — every build
// (internal and the Chagee demo) uses the default recipe/food-cost
// wording. To brand the chips for a customer again, add an entry, e.g.
// `chagee: CHAGEE_CHIPS`, and PROMPT_CHIPS will pick it up at runtime.
const CHIPS_BY_CUSTOMER: Record<string, PromptChip[]> = {};

/** The suggested chips for the active build. Falls back to the default set. */
export const PROMPT_CHIPS: PromptChip[] =
  CHIPS_BY_CUSTOMER[demoCustomer.id] ?? DEFAULT_CHIPS;
