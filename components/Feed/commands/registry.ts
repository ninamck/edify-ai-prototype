'use client';

/**
 * The chat command registry.
 *
 * One entry per command. The registry is the only thing the slash menu
 * and prompt chips need to import; the runner (useCommandRunner)
 * reads from it to drive the state machine.
 *
 * Execute callbacks aren't on the registry itself — they live on the
 * runner because they need access to React state (setMessages,
 * setCmdStates). The registry is purely descriptive.
 */

import { Trash2, Boxes, ChefHat, Settings2, Utensils, Truck, ArrowLeftRight } from 'lucide-react';
import type { ChatCommand } from './types';
import { parseWaste, parseStock, parseRecipeEdit, parseProduction, parseMenu, parseSupplier, parseProductSwap } from './parsers';

export const COMMAND_REGISTRY: ChatCommand[] = [
  {
    id: 'waste',
    slash: '/waste',
    chipLabel: 'Log waste',
    chipIcon: Trash2,
    description: 'Record items being binned, with reason.',
    examples: [
      'waste 3 blueberry muffins expired',
      'bin 2 croissants damaged',
      'waste 1 litre oat milk past date',
    ],
    parse: parseWaste,
    cardMsgType: 'cmd-waste-card',
    requiredArgs: ['productId', 'qty', 'reasonId'],
    promptFor: (arg) => {
      if (arg === 'productId') return 'Which product am I logging?';
      if (arg === 'qty')       return 'How many?';
      if (arg === 'reasonId')  return 'And the reason — expired, damaged, not fresh…?';
      return 'I need a bit more info.';
    },
  },
  {
    id: 'stock',
    slash: '/count',
    chipLabel: 'Count stock',
    chipIcon: Boxes,
    description: 'Enter a stock count, with variance vs expected.',
    examples: [
      'count 12 croissants in pastry',
      'stock 8 litres oat milk',
      'count 4 blueberry muffins',
    ],
    parse: parseStock,
    cardMsgType: 'cmd-stock-card',
    requiredArgs: ['itemId', 'qty'],
    promptFor: (arg) => {
      if (arg === 'itemId') return 'Which item are we counting?';
      if (arg === 'qty')    return 'And how many did you count?';
      return 'I need a bit more info.';
    },
  },
  {
    id: 'recipe-edit',
    slash: '/recipe',
    chipLabel: 'Update recipe',
    chipIcon: ChefHat,
    description: 'Swap, add, or remove an ingredient on a recipe.',
    examples: [
      'swap mayo for aioli in chicken sandwich',
      'remove tomato from veggie wrap',
      'add 20g spinach to flat white avo toast',
    ],
    parse: parseRecipeEdit,
    // Recipe edit is a multi-step wizard — the runner emits step-
    // specific msgTypes (`cmd-recipe-pick-recipe`, `…-pick-action`,
    // `…-pick-ingredient`, `…-new-ingredient`, `…-summary`) rather
    // than this single placeholder. We keep this field set to the
    // final-step type for any downstream code that inspects it.
    cardMsgType: 'cmd-recipe-summary',
    requiredArgs: ['recipeId', 'kind'],
    promptFor: (arg) => {
      if (arg === 'recipeId') return 'Which recipe are we changing?';
      if (arg === 'kind')     return 'Do you want to swap, add, or remove an ingredient?';
      return 'I need a bit more info.';
    },
  },
  {
    id: 'production',
    slash: '/production',
    chipLabel: 'Production settings',
    chipIcon: Settings2,
    description: 'Tweak shelf life, batch size, prep time, carry-over, cutoff.',
    examples: [
      'set shelf life of croissant to 4 hours',
      'change batch min for blueberry muffin to 8',
      'carry-over off for almond croissant',
    ],
    parse: parseProduction,
    cardMsgType: 'cmd-prod-card',
    requiredArgs: ['recipeId', 'field'],
    promptFor: (arg) => {
      if (arg === 'recipeId') return 'Which recipe are we updating?';
      if (arg === 'field')    return 'Which setting — shelf life, batch size, prep time, carry-over, or closing cutoff?';
      return 'I need a bit more info.';
    },
  },
  {
    id: 'menu',
    slash: '/menu',
    chipLabel: 'Update menu',
    chipIcon: Utensils,
    description: '84 an item, change its price, or put it back on.',
    examples: [
      '84 the almond croissant today',
      'raise flat white by 20p',
      'set price of latte to $4.20',
    ],
    parse: parseMenu,
    cardMsgType: 'cmd-menu-card',
    requiredArgs: ['recipeId', 'action'],
    promptFor: (arg) => {
      if (arg === 'recipeId') return 'Which menu item?';
      if (arg === 'action')   return 'What do you want to do — 84 it, put it back on, or change the price?';
      return 'I need a bit more info.';
    },
  },
  {
    id: 'product-swap',
    // Primary slash is /add-product — the wizard's most common job
    // is "bring in a new product and put it into recipes". Replace
    // is one of the paths within, not the headline action.
    slash: '/add-product',
    slashAliases: ['/swap-product', '/replace-product'],
    chipLabel: 'Add a product',
    chipIcon: ArrowLeftRight,
    description: 'Bring in a new product and add or replace it across recipes.',
    examples: [
      'add oat milk to all coffees',
      'replace whole milk with oat milk across drinks',
      'switch coffee bean from house blend to fair-trade',
    ],
    parse: parseProductSwap,
    // Multi-step wizard. The runner emits step-specific msgTypes
    // (`cmd-product-purpose`, `cmd-product-new-info`, `…-new-supplier`,
    // `…-pick-replaced`, `…-pack-details`, `…-pick-recipes`,
    // `…-swap-summary`) rather than this single placeholder; this
    // field is set to the final summary step for downstream code
    // that inspects it.
    cardMsgType: 'cmd-product-swap-summary',
    // The wizard launches even with no args — it walks the user
    // through everything — so we don't gate on required args here.
    requiredArgs: [],
    promptFor: (arg) => {
      if (arg === 'mode')           return 'Adding it to recipes, or replacing another product?';
      if (arg === 'newProductName') return "What's the new product called?";
      if (arg === 'supplier')       return 'Which supplier — existing or new?';
      if (arg === 'oldProductId')   return "Which product is this replacing?";
      return 'I need a bit more info.';
    },
  },
  {
    id: 'supplier',
    slash: '/supplier',
    chipLabel: 'Update supplier',
    chipIcon: Truck,
    description: 'Change cut-off, lead time, MOV, delivery days, or contact.',
    examples: [
      'set Bidvest cut-off to 2pm',
      'change Almarai lead time to 1 day',
      'update Agility MOV to $300',
    ],
    parse: parseSupplier,
    cardMsgType: 'cmd-supplier-card',
    requiredArgs: ['supplierId', 'field', 'value'],
    promptFor: (arg) => {
      if (arg === 'supplierId') return 'Which supplier?';
      if (arg === 'field')      return 'What are we changing — cut-off, lead time, MOV, delivery days, email, or phone?';
      if (arg === 'value')      return 'And the new value?';
      return 'I need a bit more info.';
    },
  },
];

export function getCommand(id: string): ChatCommand | undefined {
  return COMMAND_REGISTRY.find((c) => c.id === id);
}
