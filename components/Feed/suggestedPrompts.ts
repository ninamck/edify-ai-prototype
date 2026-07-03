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

import { ChefHat, Truck, BarChart3, ShieldCheck, type LucideIcon } from 'lucide-react';
import { demoCustomer } from '@/lib/demoConfig';

export type PromptChip = {
  label: string;
  icon: LucideIcon;
  /** Text sent to the chat when the chip has no bespoke flow. */
  text: string;
  /** Bespoke flows that don't route through the chat-command runner —
   *  the recipe builder wizard and the data-integrity audit each have
   *  their own dedicated start function. */
  action?: 'recipe' | 'integrity';
  /** Chat-command id (see `components/Feed/commands/registry.ts`).
   *  When set, the chip launches that command's wizard via the runner,
   *  same path as the slash menu and `+` popover. */
  commandId?: string;
};

/** Internal / default build (Fitzroy Espresso café scenario). */
const DEFAULT_CHIPS: PromptChip[] = [
  {
    label: 'New recipe',
    icon: ChefHat,
    text: "I'm releasing avocado toast on the new menu — target 25% food cost.",
    action: 'recipe',
  },
  {
    label: 'Update recipe',
    icon: ChefHat,
    text: '',
    commandId: 'recipe-edit',
  },
  {
    label: 'Update suppliers',
    icon: Truck,
    text: '',
    commandId: 'supplier',
  },
  {
    label: 'Food cost',
    icon: BarChart3,
    text: 'Help me understand our food cost % vs target for this week.',
  },
  {
    label: 'Check data integrity',
    icon: ShieldCheck,
    text: '',
    action: 'integrity',
  },
];

/** CHAGEE tea-house scenario. Same flows, tea-house phrasing. */
const CHAGEE_CHIPS: PromptChip[] = [
  {
    label: 'New drink',
    icon: ChefHat,
    text: "I'm adding a Brown Sugar Boba Milk Tea to the menu — target 22% drink cost.",
    action: 'recipe',
  },
  {
    label: 'Update recipe',
    icon: ChefHat,
    text: '',
    commandId: 'recipe-edit',
  },
  {
    label: 'Update suppliers',
    icon: Truck,
    text: '',
    commandId: 'supplier',
  },
  {
    label: 'Drink cost',
    icon: BarChart3,
    text: 'Help me understand our drink cost % vs target for this week.',
  },
  {
    label: 'Check data integrity',
    icon: ShieldCheck,
    text: '',
    action: 'integrity',
  },
];

const CHIPS_BY_CUSTOMER: Record<string, PromptChip[]> = {
  chagee: CHAGEE_CHIPS,
};

/** The suggested chips for the active build. Falls back to the default set. */
export const PROMPT_CHIPS: PromptChip[] =
  CHIPS_BY_CUSTOMER[demoCustomer.id] ?? DEFAULT_CHIPS;
