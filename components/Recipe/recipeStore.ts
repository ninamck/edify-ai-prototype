'use client';

// In-memory shared store for recipes + workflows. Both the list page and
// the [id]/edit page read and mutate through this store so changes made
// on the edit page are reflected in the list when you return.

import { useSyncExternalStore } from 'react';
import { ALL_LIBRARY_RECIPES, type Recipe } from '@/components/Recipe/libraryFixtures';
import {
  PRET_WORKFLOWS,
  setWorkflowResolver,
  type ProductionWorkflow,
  type WorkflowId,
} from '@/components/Production/fixtures';

function cloneWorkflow(wf: ProductionWorkflow): ProductionWorkflow {
  return {
    id: wf.id,
    stages: wf.stages.map((s) => ({ ...s })),
    edges: wf.edges.map((e) => ({ ...e })),
  };
}

function cloneAllWorkflows(
  src: Record<WorkflowId, ProductionWorkflow>,
): Record<WorkflowId, ProductionWorkflow> {
  const out: Record<WorkflowId, ProductionWorkflow> = {};
  for (const id of Object.keys(src)) out[id] = cloneWorkflow(src[id]);
  return out;
}

type State = {
  recipes: Recipe[];
  workflows: Record<WorkflowId, ProductionWorkflow>;
};

let state: State = {
  recipes: ALL_LIBRARY_RECIPES,
  workflows: cloneAllWorkflows(PRET_WORKFLOWS),
};

// Make production-side `recipeWorkTypes` / `workTypesFromWorkflows` read
// from this store so chips on /production/* reflect in-memory workflow
// edits made in the recipe editor. The closure reads `state.workflows`
// fresh each call (state is reassigned on update, not mutated), so the
// resolver is always up to date without further wiring.
setWorkflowResolver((id) => state.workflows[id]);

const listeners = new Set<() => void>();

function subscribe(l: () => void): () => void {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
}

function notify() {
  for (const l of listeners) l();
}

const getRecipes = () => state.recipes;
const getWorkflows = () => state.workflows;

export function useRecipes(): Recipe[] {
  return useSyncExternalStore(subscribe, getRecipes, getRecipes);
}

export function useWorkflows(): Record<WorkflowId, ProductionWorkflow> {
  return useSyncExternalStore(subscribe, getWorkflows, getWorkflows);
}

export function setRecipes(next: Recipe[]): void {
  state = { ...state, recipes: next };
  notify();
}

export function updateRecipe(updated: Recipe): void {
  state = {
    ...state,
    recipes: state.recipes.map((r) => (r.id === updated.id ? updated : r)),
  };
  notify();
}

/** Add a brand-new recipe to the library. Used by the Command Centre
 *  create-recipe flow so a chat-built recipe lands in the same store
 *  the recipes list and editor read from. Prepended so the newest
 *  recipe is immediately visible at the top of the list. */
export function addRecipe(recipe: Recipe): void {
  state = { ...state, recipes: [recipe, ...state.recipes] };
  notify();
}

export function updateWorkflow(wf: ProductionWorkflow): void {
  state = {
    ...state,
    workflows: { ...state.workflows, [wf.id]: cloneWorkflow(wf) },
  };
  notify();
}

export { cloneWorkflow };

/** Recipes that have a given modifier group attached. Used by the
 *  modifier-groups list + editor to surface "Used by recipes". */
export function recipesUsingGroup(groupId: string): Recipe[] {
  return state.recipes.filter((r) => (r.modifierGroupIds ?? []).includes(groupId));
}

/** Non-React snapshot getter — used by the unified ingredient catalogue
 *  to include component / sub-recipes in search results. */
export function snapshotRecipes(): Recipe[] {
  return state.recipes;
}

/** Non-React lookup. Mirrors `findMasterProduct` / `findProduct` in the
 *  Suppliers store. Used by `resolveIngredientRef` for subrecipe refs. */
export function findRecipe(id: string): Recipe | undefined {
  return state.recipes.find((r) => r.id === id);
}
