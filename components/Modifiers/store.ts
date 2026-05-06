'use client';

/**
 * Shared in-memory store for Modifier Groups.
 *
 * Modifier groups are catalogue-level entities — owned outside any single
 * recipe or menu item. The same group can be attached to many menu items.
 * The store mirrors the lightweight subscription pattern used by
 * `components/Suppliers/store.ts` and `components/Recipe/recipeStore.ts`.
 */

import { useSyncExternalStore } from 'react';
import { SEED_MODIFIER_GROUPS } from './fixtures';
import type { ModifierGroup, ModifierOption } from './types';

type State = {
  groups: ModifierGroup[];
};

let state: State = {
  groups: SEED_MODIFIER_GROUPS,
};

const listeners = new Set<() => void>();
function subscribe(l: () => void): () => void {
  listeners.add(l);
  return () => { listeners.delete(l); };
}
function notify() { for (const l of listeners) l(); }

const getGroups = () => state.groups;

export function useModifierGroups(): ModifierGroup[] {
  return useSyncExternalStore(subscribe, getGroups, getGroups);
}

export function snapshot(): State {
  return { ...state };
}
export function restore(prev: State): void {
  state = prev;
  notify();
}

export function setGroups(next: ModifierGroup[]): void {
  state = { ...state, groups: next };
  notify();
}

export function upsertGroup(g: ModifierGroup): void {
  const exists = state.groups.some((x) => x.id === g.id);
  setGroups(exists ? state.groups.map((x) => (x.id === g.id ? g : x)) : [...state.groups, g]);
}

export function deleteGroup(id: string): void {
  setGroups(state.groups.filter((g) => g.id !== id));
}

export function findGroup(id: string | undefined): ModifierGroup | undefined {
  if (!id) return undefined;
  return state.groups.find((g) => g.id === id);
}

export function findOption(groupId: string, optionId: string): ModifierOption | undefined {
  const g = findGroup(groupId);
  return g?.options.find((o) => o.id === optionId);
}

export function genGroupId(): string {
  return `mg-${Math.random().toString(36).slice(2, 8)}`;
}

export function genOptionId(groupId: string): string {
  return `${groupId}-opt-${Math.random().toString(36).slice(2, 6)}`;
}
