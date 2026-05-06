'use client';

/**
 * Shared in-memory store for Suppliers, Products, and Master Products.
 *
 * Mirrors the lightweight subscription pattern from
 * components/Recipe/recipeStore.ts so list pages, detail pages, and the Quinn
 * agent sheet all read and mutate through the same source.
 */

import { useSyncExternalStore } from 'react';
import {
  SEED_SUPPLIERS,
  SEED_PRODUCTS,
  SEED_MASTER_PRODUCTS,
  type Supplier,
  type Product,
  type MasterProduct,
} from './fixtures';

type State = {
  suppliers: Supplier[];
  products: Product[];
  masterProducts: MasterProduct[];
};

let state: State = {
  suppliers: SEED_SUPPLIERS,
  products: SEED_PRODUCTS,
  masterProducts: SEED_MASTER_PRODUCTS,
};

const listeners = new Set<() => void>();
function subscribe(l: () => void): () => void {
  listeners.add(l);
  return () => { listeners.delete(l); };
}
function notify() { for (const l of listeners) l(); }

const getSuppliers = () => state.suppliers;
const getProducts = () => state.products;
const getMasterProducts = () => state.masterProducts;

export function useSuppliers(): Supplier[] {
  return useSyncExternalStore(subscribe, getSuppliers, getSuppliers);
}
export function useProducts(): Product[] {
  return useSyncExternalStore(subscribe, getProducts, getProducts);
}
export function useMasterProducts(): MasterProduct[] {
  return useSyncExternalStore(subscribe, getMasterProducts, getMasterProducts);
}

// ── Snapshot helpers (used by Undo) ──────────────────────────────────────────
export function snapshot(): State {
  return { ...state };
}
export function restore(prev: State): void {
  state = prev;
  notify();
}

// ── Supplier mutators ────────────────────────────────────────────────────────
export function setSuppliers(next: Supplier[]): void {
  state = { ...state, suppliers: next };
  notify();
}
export function upsertSupplier(s: Supplier): void {
  const exists = state.suppliers.some((x) => x.id === s.id);
  setSuppliers(exists ? state.suppliers.map((x) => (x.id === s.id ? s : x)) : [...state.suppliers, s]);
}
export function deleteSupplier(id: string): void {
  setSuppliers(state.suppliers.filter((s) => s.id !== id));
}

// ── Product mutators ─────────────────────────────────────────────────────────
export function setProducts(next: Product[]): void {
  state = { ...state, products: next };
  notify();
}
export function upsertProduct(p: Product): void {
  const exists = state.products.some((x) => x.id === p.id);
  setProducts(exists ? state.products.map((x) => (x.id === p.id ? p : x)) : [...state.products, p]);
}
export function deleteProduct(id: string): void {
  setProducts(state.products.filter((p) => p.id !== id));
}
export function bulkUpdateProducts(predicate: (p: Product) => boolean, mutate: (p: Product) => Product): number {
  let touched = 0;
  const next = state.products.map((p) => {
    if (!predicate(p)) return p;
    touched += 1;
    return mutate(p);
  });
  setProducts(next);
  return touched;
}

// ── Master Product mutators ──────────────────────────────────────────────────
export function setMasterProducts(next: MasterProduct[]): void {
  state = { ...state, masterProducts: next };
  notify();
}
export function upsertMasterProduct(mp: MasterProduct): void {
  const exists = state.masterProducts.some((x) => x.id === mp.id);
  setMasterProducts(exists ? state.masterProducts.map((x) => (x.id === mp.id ? mp : x)) : [...state.masterProducts, mp]);
}
export function deleteMasterProduct(id: string): void {
  setMasterProducts(state.masterProducts.filter((m) => m.id !== id));
}

// ── Convenience selectors ────────────────────────────────────────────────────
export function productsBySupplier(supplierId: string): Product[] {
  return state.products.filter((p) => p.supplierId === supplierId);
}
export function productsByMaster(masterId: string): Product[] {
  return state.products.filter((p) => p.masterProductId === masterId);
}
export function findSupplier(id: string | undefined): Supplier | undefined {
  if (!id) return undefined;
  return state.suppliers.find((s) => s.id === id);
}
export function findMasterProduct(id: string | undefined): MasterProduct | undefined {
  if (!id) return undefined;
  return state.masterProducts.find((m) => m.id === id);
}
export function findProduct(id: string | undefined): Product | undefined {
  if (!id) return undefined;
  return state.products.find((p) => p.id === id);
}

export function genId(prefix: string): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 8)}`;
}
