/**
 * Shared types for the in-chat command framework. See
 * `components/Feed/commands/registry.ts` for the registry that wires
 * each command up.
 *
 * The framework is intentionally simple:
 *   1. The user either clicks a chip, types `/cmd …`, or types natural
 *      language. All three resolve to the same `CommandIntent`.
 *   2. The runner asks Quinn to clarify any missing required args
 *      ("which product?", "how much?").
 *   3. When args are complete, a confirmation card renders in the chat.
 *   4. On confirm, `execute(args)` mutates the relevant store and
 *      returns a `CommandReceipt` that becomes the next Quinn message.
 */

import type { LucideIcon } from 'lucide-react';

export type CommandId =
  | 'waste'
  | 'stock'
  | 'recipe-edit'
  | 'production'
  | 'menu'
  | 'supplier'
  /** Add a new product (optionally from a new supplier) and replace
   *  an existing product with it across a selected set of recipes.
   *  Implemented as a multi-step wizard — see useCommandRunner's
   *  startProductSwapWizard for the flow. */
  | 'product-swap';

/** A single resolved invocation of a command. Args are command-specific
 *  — each command exports its own arg shape. We use `unknown` here to
 *  keep this module agnostic; the registry entries narrow the type. */
export interface CommandIntent {
  commandId: CommandId;
  /** Best-effort parsed arguments. Required fields may still be missing
   *  — the runner will prompt for them. */
  args: Record<string, unknown>;
  /** Confidence 0–1. Used to decide whether to fall through to a text
   *  reply (for low-confidence NL matches that don't look like a
   *  command at all). */
  confidence: number;
  /** When the parser returned multiple candidate items (e.g. fuzzy
   *  match returned two products with the same first word), the runner
   *  surfaces a picker before opening the card. */
  ambiguous?: AmbiguityChoice[];
  /** If the parser detected a multi-item payload (e.g.
   *  "waste 3 muffins, 2 croissants"), each entry becomes its own
   *  queued card. */
  queue?: Record<string, unknown>[];
}

export interface AmbiguityChoice {
  id: string;
  label: string;
  sublabel?: string;
  /** The args we'd commit if the user picks this choice. */
  args: Record<string, unknown>;
}

export interface CommandReceipt {
  /** Short headline ("Logged · 3 Blueberry Muffins · Expired"). */
  headline: string;
  /** Secondary line shown below the headline. Optional. */
  detail?: string;
  /** Deep-link to the canonical page for this domain. */
  href?: string;
  /** Label for the deep-link button ("Open log →"). */
  hrefLabel?: string;
  /** Callback that reverses the mutation. Returns nothing — the receipt
   *  card hides the Undo chip after the click. */
  undo?: () => void;
}

export interface ChatCommand {
  id: CommandId;
  slash: string;
  /** Extra slash names that should also trigger this command. Useful
   *  when the same wizard has multiple natural-feeling synonyms
   *  (e.g. `/add-product` and `/swap-product` both fire the product
   *  wizard). The slash menu still surfaces just `slash`. */
  slashAliases?: string[];
  chipLabel: string;
  chipIcon: LucideIcon;
  /** One-line description shown in the slash menu popover. */
  description: string;
  /** Concrete example phrasings — used in the slash menu and the
   *  "Try saying" hint. */
  examples: string[];
  /** Natural-language parser. Returns null when the text doesn't look
   *  like an invocation of this command. */
  parse: (text: string) => CommandIntent | null;
  /** msgType marker for the card render branch in Feed.tsx. */
  cardMsgType: string;
  /** Names of the args that must be present before the card can render.
   *  When any are missing the runner asks Quinn to clarify, in order. */
  requiredArgs: string[];
  /** Render the human-readable clarifying question for a missing arg. */
  promptFor: (argName: string, args: Record<string, unknown>) => string;
}
