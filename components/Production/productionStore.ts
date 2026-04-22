'use client';

import { useSyncExternalStore } from 'react';
import {
  initialProductionState,
  type ProductionState,
} from './fixtures/fitzroyCpu';

// ---------- Entity types (from spec §4) ----------

export type SiteClassificationLevel = 'very_low' | 'low' | 'medium' | 'high';
export type SiteKind = 'hub' | 'spoke';
export type RoleId = 'planner' | 'maker' | 'manager' | 'dispatcher' | 'store_gm';

export interface Site {
  id: string;
  name: string;
  address: string;
  kind: SiteKind;
  classification: SiteClassificationLevel;
  tierAssignments: {
    monday?: string;
    tuesday?: string;
    wednesday?: string;
    thursday?: string;
    friday?: string;
    saturday?: string;
    sunday?: string;
  };
}

export interface CapabilityTag {
  id: string;
  name: string;
  description: string;
}

export interface Bench {
  id: string;
  name: string;
  siteId: string;
  capabilityTagIds: string[];
  capacityPerHour: number;
  activeHours: { start: string; end: string };
}

export interface Supplier {
  id: string;
  name: string;
  leadTimeDays: number;
}

export interface SupplierProduct {
  id: string;
  supplierId: string;
  name: string;
  pack: string;
  unitCost: number;
  onHand: number;
  parLevel: number;
  temperatureZone: 'ambient' | 'chilled' | 'frozen';
}

export type ProductType = 'made' | 'stocked';

export interface Product {
  id: string;
  name: string;
  type: ProductType;
  recipeId?: string;
  supplierProductId?: string;
  price: number;
  image?: string;
  priorityFlag: boolean;
  allergens: string[];
  category: string;
}

export interface Range {
  id: string;
  name: string;
  description: string;
}

export interface Tier {
  id: string;
  rangeId: string;
  name: string;
  productIds: string[];
}

export interface SelectionWindow {
  coreCount: number;
  byTime: string;
}

export interface SiteClassificationRule {
  level: SiteClassificationLevel;
  closingRangeSize: number;
  selectionWindows: {
    opening: SelectionWindow;
    morning: SelectionWindow;
    full: SelectionWindow;
    closing: SelectionWindow;
  };
}

export type DemandSource = 'forecast' | 'spoke_order' | 'manual' | 'catering';

export interface DemandLine {
  id: string;
  productId: string;
  source: DemandSource;
  siteId: string;
  quantity: number;
  requiredByDateTime: string;
  notes?: string;
  suggestedQty?: number;
  quinnJustification?: string;
}

export type RunType = 'fixed' | 'variable' | 'on_demand';
export type RunTimeHorizon = 'advance' | 'planned' | 'on_demand';
export type RunStatus = 'draft' | 'locked' | 'in_progress' | 'complete';

export interface BenchAssignment {
  id: string;
  benchId: string;
  productId: string;
  recipeStepId?: string;
  quantity: number;
  estimatedMinutes: number;
  assignedMakerName?: string;
  status: 'pending' | 'in_progress' | 'complete';
  actualQuantity?: number;
  rejectCount?: number;
}

export interface ProductionRun {
  id: string;
  name: string;
  runType: RunType;
  timeHorizon: RunTimeHorizon;
  scheduledDate: string;
  scheduledStart: string;
  scheduledEnd: string;
  siteId: string;
  status: RunStatus;
  benchAssignments: BenchAssignment[];
  linkedDemandLineIds: string[];
}

export interface PickListLine {
  id: string;
  runId: string;
  productId: string;
  quantityRequested: number;
  quantityReserved: number;
  destinationSiteId: string;
  status: 'open' | 'reserved' | 'short' | 'picked';
}

export interface MadeOutput {
  id: string;
  productionRunId: string;
  benchAssignmentId: string;
  productId: string;
  quantityProduced: number;
  destination: 'dispatch' | 'sub_recipe' | 'split';
  parentRunId?: string;
  shelfLifeExpiresAt: string | null;
}

export interface PcrCheck {
  id: string;
  madeOutputId: string;
  qualityCheck: 'pass' | 'fail' | 'pending';
  labelCheck: 'pass' | 'fail' | 'pending';
  haccpData: {
    temperature?: number;
    checkedAt: string;
    batchCode: string;
  };
  checkerName: string;
  rejectQuantity?: number;
  replacementRunId?: string;
}

export type TemperatureZone = 'ambient' | 'chilled' | 'frozen';
export type ManifestStatus = 'draft' | 'loaded' | 'en_route' | 'delivered';

export interface DispatchManifest {
  id: string;
  destinationSiteId: string;
  scheduledDispatchTime: string;
  madeOutputIds: string[];
  pickListLineIds: string[];
  temperatureZone: TemperatureZone;
  status: ManifestStatus;
}

export interface GrnLine {
  productId: string;
  expectedQuantity: number;
  receivedQuantity: number;
  discrepancyType?: 'short' | 'damaged' | 'wrong_item' | 'quality_fail';
  resolution?: string;
}

export interface Grn {
  id: string;
  dispatchManifestId: string;
  receivedAtSiteId: string;
  lines: GrnLine[];
  receivedAt: string;
}

export interface SalesTick {
  id: string;
  siteId: string;
  productId: string;
  soldAt: string;
  quantity: number;
}

// ---------- Store shape ----------

// Re-export from the fixture module so consumers have one import path.
export type { ProductionState };

// ---------- Store ----------

let state: ProductionState = initialProductionState();

const listeners = new Set<() => void>();

function emit() {
  for (const l of listeners) l();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getSnapshot(): ProductionState {
  return state;
}

export function useProductionState(): ProductionState {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

// Per-entity hooks (a selector is just `state.<key>` — React rerenders
// when any store mutation happens, but each consumer reads the slice it
// needs, which keeps components readable).

export function useSites(): readonly Site[] {
  return useProductionState().sites;
}
export function useCapabilityTags(): readonly CapabilityTag[] {
  return useProductionState().capabilityTags;
}
export function useBenches(): readonly Bench[] {
  return useProductionState().benches;
}
export function useSuppliers(): readonly Supplier[] {
  return useProductionState().suppliers;
}
export function useSupplierProducts(): readonly SupplierProduct[] {
  return useProductionState().supplierProducts;
}
export function useProducts(): readonly Product[] {
  return useProductionState().products;
}
export function useRanges(): readonly Range[] {
  return useProductionState().ranges;
}
export function useTiers(): readonly Tier[] {
  return useProductionState().tiers;
}
export function useClassificationRules(): readonly SiteClassificationRule[] {
  return useProductionState().classificationRules;
}
export function useDemandLines(): readonly DemandLine[] {
  return useProductionState().demandLines;
}
export function useProductionRuns(): readonly ProductionRun[] {
  return useProductionState().productionRuns;
}
export function usePickListLines(): readonly PickListLine[] {
  return useProductionState().pickListLines;
}
export function useMadeOutputs(): readonly MadeOutput[] {
  return useProductionState().madeOutputs;
}
export function usePcrChecks(): readonly PcrCheck[] {
  return useProductionState().pcrChecks;
}
export function useDispatchManifests(): readonly DispatchManifest[] {
  return useProductionState().dispatchManifests;
}
export function useGrns(): readonly Grn[] {
  return useProductionState().grns;
}
export function useSalesActuals(): readonly SalesTick[] {
  return useProductionState().salesActuals;
}

// ---------- Narrowed selectors ----------

export function useSiteById(siteId: string | null | undefined): Site | undefined {
  const sites = useSites();
  return siteId ? sites.find(s => s.id === siteId) : undefined;
}

export function useSpokes(): readonly Site[] {
  return useSites().filter(s => s.kind === 'spoke');
}

export function useHub(): Site | undefined {
  return useSites().find(s => s.kind === 'hub');
}

export function useBenchesForSite(siteId: string): readonly Bench[] {
  return useBenches().filter(b => b.siteId === siteId);
}

export function useDemandLinesForDate(date: string): readonly DemandLine[] {
  return useDemandLines().filter(d => d.requiredByDateTime.startsWith(date));
}

export function useDemandLinesForSite(siteId: string): readonly DemandLine[] {
  return useDemandLines().filter(d => d.siteId === siteId);
}

export function useTierForSiteOnDay(
  siteId: string,
  day: keyof Site['tierAssignments'],
): Tier | undefined {
  const sites = useSites();
  const tiers = useTiers();
  const site = sites.find(s => s.id === siteId);
  const tierId = site?.tierAssignments[day];
  return tierId ? tiers.find(t => t.id === tierId) : undefined;
}

export function useProductById(productId: string | null | undefined): Product | undefined {
  const products = useProducts();
  return productId ? products.find(p => p.id === productId) : undefined;
}

// ---------- Non-hook accessors (for mutators and helpers) ----------

export function getState(): ProductionState {
  return state;
}

export function getSiteById(siteId: string): Site | undefined {
  return state.sites.find(s => s.id === siteId);
}

// ---------- Mutators (Slice 1 only has reset; later slices add write ops) ----------

export function resetProductionState(): void {
  state = initialProductionState();
  emit();
}

function mutate(updater: (s: ProductionState) => ProductionState) {
  state = updater(state);
  emit();
}

let idCounter = 1000;
function nextId(prefix: string): string {
  idCounter += 1;
  return `${prefix}-${idCounter}`;
}

export function addDemandLines(lines: Omit<DemandLine, 'id'>[]): DemandLine[] {
  const withIds: DemandLine[] = lines.map(l => ({ ...l, id: nextId('dem') }));
  mutate(s => ({ ...s, demandLines: [...s.demandLines, ...withIds] }));
  return withIds;
}

// Create a new run (or ingest into an existing draft run). Returns the run id.
export interface CreateRunParams {
  name: string;
  runType: RunType;
  timeHorizon: RunTimeHorizon;
  scheduledDate: string;
  scheduledStart: string;
  scheduledEnd: string;
  siteId: string;
  linkedDemandLineIds: string[];
}

export function createRun(params: CreateRunParams): string {
  const id = nextId('run');
  const run: ProductionRun = {
    id,
    ...params,
    status: 'draft',
    benchAssignments: [],
  };
  mutate(s => ({ ...s, productionRuns: [...s.productionRuns, run] }));
  return id;
}

export function addDemandToRun(runId: string, demandLineIds: string[]): void {
  mutate(s => ({
    ...s,
    productionRuns: s.productionRuns.map(r =>
      r.id === runId
        ? { ...r, linkedDemandLineIds: [...new Set([...r.linkedDemandLineIds, ...demandLineIds])] }
        : r,
    ),
  }));
}

// Assign a product batch to a bench in a run. Returns the assignment id.
export interface AssignToBenchParams {
  runId: string;
  benchId: string;
  productId: string;
  quantity: number;
  estimatedMinutes: number;
  recipeStepId?: string;
}

export function assignToBench(params: AssignToBenchParams): string {
  const assignmentId = nextId('asn');
  mutate(s => ({
    ...s,
    productionRuns: s.productionRuns.map(r => {
      if (r.id !== params.runId) return r;
      // If an assignment for this product already exists on *any* bench in
      // the run, replace it (a product belongs to one bench at a time).
      const filtered = r.benchAssignments.filter(a => a.productId !== params.productId);
      return {
        ...r,
        benchAssignments: [
          ...filtered,
          {
            id: assignmentId,
            benchId: params.benchId,
            productId: params.productId,
            recipeStepId: params.recipeStepId,
            quantity: params.quantity,
            estimatedMinutes: params.estimatedMinutes,
            status: 'pending',
          },
        ],
      };
    }),
  }));
  return assignmentId;
}

export function removeBenchAssignment(runId: string, productId: string): void {
  mutate(s => ({
    ...s,
    productionRuns: s.productionRuns.map(r =>
      r.id === runId
        ? { ...r, benchAssignments: r.benchAssignments.filter(a => a.productId !== productId) }
        : r,
    ),
  }));
}

// ---------- Slice 3 execute-flow mutators ----------

export function startTask(runId: string, assignmentId: string): void {
  mutate(s => ({
    ...s,
    productionRuns: s.productionRuns.map(r => {
      if (r.id !== runId) return r;
      return {
        ...r,
        status: r.status === 'locked' ? 'in_progress' : r.status,
        benchAssignments: r.benchAssignments.map(a =>
          a.id === assignmentId ? { ...a, status: 'in_progress' } : a,
        ),
      };
    }),
  }));
}

export interface CompleteTaskParams {
  runId: string;
  assignmentId: string;
  actualQuantity: number;
  rejectCount?: number;
}

// Complete a task → writes a MadeOutput ready for PCR.
export function completeTask(params: CompleteTaskParams): string | null {
  const madeOutputId = nextId('mo');
  let createdId: string | null = null;
  mutate(s => {
    const run = s.productionRuns.find(r => r.id === params.runId);
    const assignment = run?.benchAssignments.find(a => a.id === params.assignmentId);
    if (!run || !assignment) return s;

    const produced = Math.max(0, params.actualQuantity - (params.rejectCount ?? 0));
    createdId = madeOutputId;
    const madeOutput: MadeOutput = {
      id: madeOutputId,
      productionRunId: params.runId,
      benchAssignmentId: params.assignmentId,
      productId: assignment.productId,
      quantityProduced: produced,
      destination: 'dispatch',
      shelfLifeExpiresAt: null, // starts at PCR pass
    };

    return {
      ...s,
      productionRuns: s.productionRuns.map(r => {
        if (r.id !== params.runId) return r;
        return {
          ...r,
          benchAssignments: r.benchAssignments.map(a =>
            a.id === params.assignmentId
              ? {
                  ...a,
                  status: 'complete',
                  actualQuantity: params.actualQuantity,
                  rejectCount: params.rejectCount ?? 0,
                }
              : a,
          ),
        };
      }),
      madeOutputs: [...s.madeOutputs, madeOutput],
    };
  });
  return createdId;
}

export interface SubmitPcrParams {
  madeOutputId: string;
  qualityCheck: 'pass' | 'fail';
  labelCheck: 'pass' | 'fail';
  temperature?: number;
  checkerName: string;
  batchCode: string;
  rejectQuantity?: number;
  triggerReplacement?: boolean;
}

// Pass sets shelf-life from recipe.shelfLifeHours (or 24h default).
// Fail can optionally spawn an on-demand replacement run.
export function submitPcr(params: SubmitPcrParams): string {
  const pcrId = nextId('pcr');
  const checkedAt = new Date().toISOString();

  mutate(s => {
    const madeOutput = s.madeOutputs.find(m => m.id === params.madeOutputId);
    if (!madeOutput) return s;

    const parentRun = s.productionRuns.find(r => r.id === madeOutput.productionRunId);
    const product = s.products.find(p => p.id === madeOutput.productId);
    const pass = params.qualityCheck === 'pass' && params.labelCheck === 'pass';

    let shelfLifeExpiresAt: string | null = madeOutput.shelfLifeExpiresAt;
    if (pass) {
      const hours = 24; // Default — recipe-step shelfLifeHours seeding in later slice
      shelfLifeExpiresAt = new Date(Date.now() + hours * 3600 * 1000).toISOString();
    }

    let replacementRunId: string | undefined;
    let newRun: ProductionRun | null = null;
    if (!pass && params.triggerReplacement && product) {
      replacementRunId = nextId('run');
      newRun = {
        id: replacementRunId,
        name: `On-demand · ${product.name} replacement`,
        runType: 'on_demand',
        timeHorizon: 'on_demand',
        scheduledDate: parentRun?.scheduledDate ?? new Date().toISOString().slice(0, 10),
        scheduledStart: '',
        scheduledEnd: '',
        siteId: parentRun?.siteId ?? 'site-cpu',
        status: 'draft',
        benchAssignments: [],
        linkedDemandLineIds: [],
      };
    }

    const pcr: PcrCheck = {
      id: pcrId,
      madeOutputId: params.madeOutputId,
      qualityCheck: params.qualityCheck,
      labelCheck: params.labelCheck,
      haccpData: {
        temperature: params.temperature,
        checkedAt,
        batchCode: params.batchCode,
      },
      checkerName: params.checkerName,
      rejectQuantity: params.rejectQuantity,
      replacementRunId,
    };

    return {
      ...s,
      pcrChecks: [...s.pcrChecks, pcr],
      madeOutputs: s.madeOutputs.map(m =>
        m.id === params.madeOutputId ? { ...m, shelfLifeExpiresAt } : m,
      ),
      productionRuns: newRun ? [...s.productionRuns, newRun] : s.productionRuns,
    };
  });

  return pcrId;
}

// Reserve stock for a pick-line. Caps at on-hand and flags shortage.
export function reservePickLine(pickLineId: string, quantity: number): void {
  mutate(s => {
    const line = s.pickListLines.find(p => p.id === pickLineId);
    if (!line) return s;
    const product = s.products.find(p => p.id === line.productId);
    if (!product?.supplierProductId) return s;
    const sp = s.supplierProducts.find(x => x.id === product.supplierProductId);
    if (!sp) return s;

    const canReserve = Math.min(quantity, sp.onHand);
    const isShort = canReserve < quantity;

    return {
      ...s,
      supplierProducts: s.supplierProducts.map(x =>
        x.id === sp.id ? { ...x, onHand: Math.max(0, x.onHand - canReserve) } : x,
      ),
      pickListLines: s.pickListLines.map(p =>
        p.id === pickLineId
          ? {
              ...p,
              quantityReserved: canReserve,
              status: canReserve === 0 ? 'short' : isShort ? 'short' : 'reserved',
            }
          : p,
      ),
    };
  });
}

// Attach a made output to the existing draft manifest for its destination.
// Assumes the manifest was pre-linked at lockRun time.
export function attachMadeOutputToManifest(madeOutputId: string, destinationSiteId: string): void {
  mutate(s => {
    const target = s.dispatchManifests.find(
      m => m.destinationSiteId === destinationSiteId && m.status === 'draft',
    );
    if (!target) return s;
    if (target.madeOutputIds.includes(madeOutputId)) return s;
    return {
      ...s,
      dispatchManifests: s.dispatchManifests.map(m =>
        m.id === target.id ? { ...m, madeOutputIds: [...m.madeOutputIds, madeOutputId] } : m,
      ),
    };
  });
}

// Flip a manifest to 'loaded' — ready to leave the hub.
export function confirmDispatch(manifestId: string): void {
  mutate(s => ({
    ...s,
    dispatchManifests: s.dispatchManifests.map(m =>
      m.id === manifestId ? { ...m, status: 'loaded' } : m,
    ),
  }));
}

// Locking a run cascades: creates PickListLines for stocked products linked
// to the run, and pre-links a draft DispatchManifest per destination spoke.
export function lockRun(runId: string): void {
  mutate(s => {
    const run = s.productionRuns.find(r => r.id === runId);
    if (!run) return s;

    // Spec §5.11: can't lock if any linked demand line has no bench assignment
    // (for made products) or isn't a stocked product. The UI should already
    // block this, but we noop on violation as a safety net.
    const assignedProductIds = new Set(run.benchAssignments.map(a => a.productId));
    const linkedDemand = s.demandLines.filter(d => run.linkedDemandLineIds.includes(d.id));
    const missing = linkedDemand.find(d => {
      const product = s.products.find(p => p.id === d.productId);
      return product?.type === 'made' && !assignedProductIds.has(d.productId);
    });
    if (missing) return s;

    // Pick-list lines for every stocked demand line.
    const pickLines: PickListLine[] = linkedDemand
      .map(d => {
        const product = s.products.find(p => p.id === d.productId);
        if (!product || product.type !== 'stocked') return null;
        return {
          id: nextId('pick'),
          runId,
          productId: d.productId,
          quantityRequested: d.quantity,
          quantityReserved: 0,
          destinationSiteId: d.siteId,
          status: 'open',
        };
      })
      .filter((p): p is PickListLine => p !== null);

    // Draft manifest per destination spoke.
    const destinations = new Set(linkedDemand.map(d => d.siteId));
    const manifests: DispatchManifest[] = [...destinations].map(destId => ({
      id: nextId('mf'),
      destinationSiteId: destId,
      scheduledDispatchTime: `${run.scheduledDate}T${run.scheduledEnd}:00+11:00`,
      madeOutputIds: [],
      pickListLineIds: pickLines.filter(p => p.destinationSiteId === destId).map(p => p.id),
      temperatureZone: 'ambient',
      status: 'draft',
    }));

    return {
      ...s,
      productionRuns: s.productionRuns.map(r =>
        r.id === runId ? { ...r, status: 'locked' } : r,
      ),
      pickListLines: [...s.pickListLines, ...pickLines],
      dispatchManifests: [...s.dispatchManifests, ...manifests],
    };
  });
}
