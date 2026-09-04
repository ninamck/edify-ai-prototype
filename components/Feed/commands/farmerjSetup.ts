/**
 * The Setup command's parser needs to know the recipe names and the bench
 * names as they are now (Jana renames things), which live in React stores.
 * `FjSetupContextBridge` in the Feed keeps this module-level copy current
 * so the registry's `parse(text)` signature stays store-free.
 */

import { snapshotRecipes } from '@/components/Recipe/recipeStore';
import { FJ_BENCH_TEMPLATES, isFjLine } from '@/components/Production/farmerj/fjFixtures';
import { parseFjSetup, type ParseContext, type StationName } from '@/components/Production/farmerj/setupCommand';
import type { CommandIntent } from './types';

let CONTEXT: ParseContext | null = null;

export function setFjSetupParseContext(ctx: ParseContext): void {
  CONTEXT = ctx;
}

function defaultStations(): StationName[] {
  return FJ_BENCH_TEMPLATES.map(t => ({ id: t.id, name: t.name, isLine: isFjLine(t) }));
}

export function parseFjSetupWithContext(text: string): CommandIntent | null {
  return parseFjSetup(text, CONTEXT ?? { recipes: snapshotRecipes(), stations: defaultStations() });
}
