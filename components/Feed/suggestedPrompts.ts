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

import { ChefHat, Truck, ClipboardList, ShieldCheck, CalendarClock, type LucideIcon } from 'lucide-react';
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
};

/** Internal / default build (Fitzroy Espresso café scenario). */
const DEFAULT_CHIPS: PromptChip[] = [
  {
    label: 'Rebalance the rota',
    icon: CalendarClock,
    text: '',
    commandId: 'rota-rebalance',
  },
  {
    label: 'New recipe',
    icon: ChefHat,
    text: "I'm releasing avocado toast on the new menu — target 25% food cost.",
    action: 'recipe',
  },
  {
    label: 'Update recipe',
    icon: ChefHat,
    text: 'Sure — what kind of recipe would you like to update? Type the dish and I’ll pull it up.',
    action: 'recipe-ask',
  },
  {
    label: 'Update suppliers',
    icon: Truck,
    text: '',
    commandId: 'supplier',
  },
  {
    label: 'Update stock takes',
    icon: ClipboardList,
    text: "Can you update my stock takes? Review all the products that aren't in a stock area.",
  },
  {
    label: 'Check data integrity',
    icon: ShieldCheck,
    text: '',
    action: 'integrity',
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
