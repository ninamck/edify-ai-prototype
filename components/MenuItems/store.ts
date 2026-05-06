'use client';

/**
 * Shared in-memory store for Menu Items.
 *
 * Mirrors the subscription pattern of the other stores so the list page,
 * the editor, and the recipe drawer ("Used by menu items") all stay in
 * sync.
 */

import { useSyncExternalStore } from 'react';
import { SEED_MENU_ITEMS } from './fixtures';
import type { MenuItem } from './types';

type State = {
  items: MenuItem[];
};

let state: State = {
  items: SEED_MENU_ITEMS,
};

const listeners = new Set<() => void>();
function subscribe(l: () => void): () => void {
  listeners.add(l);
  return () => { listeners.delete(l); };
}
function notify() { for (const l of listeners) l(); }

const getItems = () => state.items;

export function useMenuItems(): MenuItem[] {
  return useSyncExternalStore(subscribe, getItems, getItems);
}

export function snapshot(): State {
  return { ...state };
}
export function restore(prev: State): void {
  state = prev;
  notify();
}

export function setMenuItems(next: MenuItem[]): void {
  state = { ...state, items: next };
  notify();
}

export function upsertMenuItem(m: MenuItem): void {
  const exists = state.items.some((x) => x.id === m.id);
  setMenuItems(exists ? state.items.map((x) => (x.id === m.id ? m : x)) : [...state.items, m]);
}

export function deleteMenuItem(id: string): void {
  setMenuItems(state.items.filter((m) => m.id !== id));
}

export function findMenuItem(id: string | undefined): MenuItem | undefined {
  if (!id) return undefined;
  return state.items.find((m) => m.id === id);
}

/** Menu items that reference a given recipe as their default. */
export function menuItemsUsingRecipe(recipeId: string): MenuItem[] {
  return state.items.filter((m) => m.defaultRecipeId === recipeId);
}

/** Menu items that have a given modifier group attached. */
export function menuItemsUsingGroup(groupId: string): MenuItem[] {
  return state.items.filter((m) => m.modifierGroupIds.includes(groupId));
}

export function genMenuItemId(): string {
  return `mi-${Math.random().toString(36).slice(2, 8)}`;
}
