'use client';

// In-memory shared store for recipes + workflows. Both the list page and
// the [id]/edit page read and mutate through this store so changes made
// on the edit page are reflected in the list when you return.

import { useSyncExternalStore } from 'react';
import { ALL_LIBRARY_RECIPES, type Recipe } from '@/components/Recipe/libraryFixtures';
import {
  PRET_WORKFLOWS,
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

export function updateWorkflow(wf: ProductionWorkflow): void {
  state = {
    ...state,
    workflows: { ...state.workflows, [wf.id]: cloneWorkflow(wf) },
  };
  notify();
}

export { cloneWorkflow };
