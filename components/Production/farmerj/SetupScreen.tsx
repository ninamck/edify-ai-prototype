'use client';

import { useEffect, useMemo, useState } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { CheckCircle2, ChevronRight, ExternalLink, RotateCcw, X } from 'lucide-react';
import { useActiveSite } from '@/components/ActiveSite/ActiveSiteContext';
import type { Recipe } from '@/components/Recipe/libraryFixtures';
import { updateRecipe } from '@/components/Recipe/recipeStore';
import QtyStepper from '@/components/Production/QtyStepper';
import StatusPill from '@/components/Production/StatusPill';
import { Section, TextInput } from '@/components/Settings/tabs/_shared';
import { MAX_BENCHES, useSiteSettingsStore, type BenchOverlay, type EffectiveBench, type SiteSettingsOverlay, type WindowsOverlay } from '@/components/Settings/siteSettingsStore';
import { DeepCleanPicker, MakeOnGrid, sameDays } from '@/components/Settings/tabs/MakeOnDaysTab';
import { GROUP_IDS, scheduleFromWindows, type MakeOnSchedule } from './makeOn';
import { addDays, demoNowISO, FJ_DEMO_TODAY, planningWindowFor } from './calendar';
import { describeImpact, snapshotImpact, type ImpactSnapshot } from './publishImpact';
import { kg } from './cascade';
import { Notice } from './DayPlan';
import { computeDayPlan, useFjPlanStore, type LineOverride } from './FjPlanStore';
import { BASELINE, diffSettings, methodFieldText, shopsTouched, type PublishEntry, type PublishSnapshot, type SettingsChange, type SettingsValues } from './fjSettings';
import { AUTHORED_FIELDS, bookRef, methodOf, productionFieldsOf, sameFields, withProductionFields, type FjProductionFields } from './recipeBridge';
import {
  CONTAINERS,
  PORTION_GRAMS,
  PRODUCT_GROUP_LABELS,
  SHELF_LIFE_GROUPS,
  WEEKDAY_LABELS,
  type ContainerId,
  type ShelfLifeGroupId,
  type Weekday,
} from './recipes';
import { CHANNEL_LABELS } from './sales';
import type { SalesChannel } from './salesDay';
import type { Section as WorkRole } from './recipes';
import { FJ_ALL_SHOPS_ID, FJ_SHOPS, getShop } from './shops';
import { FJ_BENCH_TEMPLATES, FJ_DAYS_OF_WEEK, FJ_DEFAULT_WINDOWS, FJ_KITCHEN_TEMPLATES, FJ_LINE_TEMPLATES, FJ_WORK_ROLES, FJ_WORK_ROLE_BY_ID, dayToWeekday, isFjLine } from './fjFixtures';
import { ALL_CHANNELS } from './lines';
import { EQUIPMENT_CAPACITY_UNIT, EQUIPMENT_LABELS, type BenchKitItem, type Equipment } from '../fixtures';
import { KitEditor } from '@/components/Settings/tabs/BenchesTab';
import { describeMethod, METHOD_FIELDS, RECIPE_CLASSES, RECIPE_CLASS_BY_ID, resolveEquipment, type RecipeClassId, type RecipeMethod } from '@/components/Recipe/recipeClasses';

/**
 * Setup: the rules Jana owns, set once and published to every shop.
 * Built on the settings chassis (Section cards, pill pickers, sticky save
 * bar, success banner) with a publish preview in front of the save.
 */

type Tab = 'recipes' | 'days' | 'lines' | 'benches' | 'containers' | 'log';
const TABS: { id: Tab; label: string }[] = [
  { id: 'recipes', label: 'Recipes' },
  { id: 'days', label: 'Make-on days' },
  { id: 'lines', label: 'Lines' },
  { id: 'benches', label: 'Benches' },
  { id: 'containers', label: 'Containers' },
  { id: 'log', label: 'Publish log' },
];

const LONG_DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const CLASS_ORDER: RecipeClassId[] = ['cooked', 'kit', 'prep', 'dressing', 'mix'];
const CLASS_GROUP_LABELS: Record<RecipeClassId, string> = { cooked: 'Cooked', kit: 'Kits', prep: 'Prep', dressing: 'Dressings', mix: 'Mixes', finished: 'Finished products' };
/** Kit a recipe can be pinned to here. The recipe page takes any combination. */
const KIT_OPTIONS: Equipment[] = ['oven', 'combi-oven', 'rice-cooker', 'hob', 'griddle', 'food-processor', 'blender', 'mixer-planetary', 'prep-table'];
const GROUPS = Object.values(SHELF_LIFE_GROUPS);

export default function SetupScreen() {
  const { isFarmerJ } = useActiveSite();
  const store = useFjPlanStore();
  const [tab, setTab] = useState<Tab>('recipes');
  const [preview, setPreview] = useState(false);
  const [banner, setBanner] = useState<string | null>(null);

  const { draft, published, log } = store.settings;
  const [recipeDraft, setRecipeDraft] = useState<RecipeDraft>({});
  const fjRecipes = useMemo(() => store.recipes.filter(r => r.brand === 'farmerj'), [store.recipes]);
  const recipeChanges = useMemo(() => diffRecipes(fjRecipes, recipeDraft), [fjRecipes, recipeDraft]);

  // Lines and kitchen kit are the company's benches in the site settings
  // store. Drafts are held here until publish, like recipe edits.
  const siteStore = useSiteSettingsStore();
  const companyBenches = useMemo(() => siteStore.effectiveFor(FJ_ALL_SHOPS_ID).benches, [siteStore]);
  const companyLines = useMemo(() => companyBenches.filter(isFjLine).map(toLineDraft), [companyBenches]);
  const companyKitchen = useMemo(() => companyBenches.filter(b => !isFjLine(b)), [companyBenches]);
  const companyBenchDrafts = useMemo(() => companyKitchen.map(toBenchDraft), [companyKitchen]);
  const [linesDraft, setLinesDraft] = useState<LineDraft[] | null>(null);
  const [benchDraft, setBenchDraft] = useState<BenchDraft[] | null>(null);
  const lines = linesDraft ?? companyLines;
  const benches = benchDraft ?? companyBenchDrafts;
  const shopsWithOwnLines = useMemo(
    () => FJ_SHOPS.filter(s => {
      const o = siteStore.overlayFor(s.id);
      const lineIds = new Set(siteStore.effectiveFor(s.id).benches.filter(isFjLine).map(b => b.id));
      return Boolean(o?.benchOrder || o?.addedBenches || Object.keys(o?.benches ?? {}).some(id => lineIds.has(id)));
    }).map(s => s.id),
    [siteStore],
  );
  // A shop has its own benches when it renamed, re-kitted or re-roled a
  // kitchen bench, or added one of its own.
  const shopsWithOwnBenches = useMemo(
    () => FJ_SHOPS.filter(s => {
      const o = siteStore.overlayFor(s.id);
      const kitchenIds = new Set(siteStore.effectiveFor(s.id).benches.filter(b => !isFjLine(b)).map(b => b.id));
      return Object.entries(o?.benches ?? {}).some(([id, b]) => kitchenIds.has(id) && (b.kit !== undefined || b.name !== undefined || b.sections !== undefined))
        || Object.values(o?.addedBenches ?? {}).some(b => !isFjLine(b));
    }).map(s => s.id),
    [siteStore],
  );
  // Make-on days are the company's production windows, and a shop's own
  // days are its windows overlay. Same draft-until-publish pattern.
  const companySchedule = useMemo(() => scheduleFromWindows(siteStore.effectiveFor(FJ_ALL_SHOPS_ID).windows), [siteStore]);
  const shopDays = useMemo<ShopDays>(() => {
    const out: ShopDays = {};
    for (const s of FJ_SHOPS) {
      const sched = scheduleFromWindows(siteStore.effectiveFor(s.id).windows);
      const own: Partial<Record<ShelfLifeGroupId, Weekday[]>> = {};
      for (const g of GROUP_IDS) if (!sameDays(sched.days[g], companySchedule.days[g])) own[g] = sched.days[g];
      if (Object.keys(own).length) out[s.id] = own;
    }
    return out;
  }, [siteStore, companySchedule]);
  const [daysDraft, setDaysDraft] = useState<DaysDraft | null>(null);
  const days: DaysDraft = daysDraft ?? { company: companySchedule, shops: shopDays };
  const dayChanges = useMemo(() => (daysDraft ? diffDays({ company: companySchedule, shops: shopDays }, daysDraft) : []), [companySchedule, shopDays, daysDraft]);

  const lineChanges = useMemo(() => (linesDraft ? diffLines(companyLines, linesDraft, FJ_SHOPS.map(s => s.id).filter(id => !shopsWithOwnLines.includes(id))) : []), [companyLines, linesDraft, shopsWithOwnLines]);
  const benchChanges = useMemo(() => (benchDraft ? diffBenches(companyBenchDrafts, benchDraft, FJ_SHOPS.map(s => s.id).filter(id => !shopsWithOwnBenches.includes(id))) : []), [companyBenchDrafts, benchDraft, shopsWithOwnBenches]);

  const changes = useMemo(() => [...recipeChanges, ...dayChanges, ...lineChanges, ...benchChanges, ...diffSettings(published, draft)], [recipeChanges, dayChanges, lineChanges, benchChanges, published, draft]);

  const setDraft = (fn: (d: SettingsValues) => SettingsValues) =>
    store.updateSettings(s => ({ ...s, draft: fn(s.draft) }));
  const setRecipeField = (id: string, patch: Partial<FjProductionFields>) =>
    setRecipeDraft(d => ({ ...d, [id]: { ...(d[id] ?? {}), ...patch } }));
  const resetRecipe = (id: string) =>
    setRecipeDraft(d => ({ ...d, [id]: { ...AUTHORED_FIELDS[id] } }));

  // The downstream line for a log entry needs the engines to have settled
  // on the new rules, which happens a render after publish. `pendingImpact`
  // carries the pre-publish snapshot until then.
  const [pendingImpact, setPendingImpact] = useState<{ id: string; before: ImpactSnapshot } | null>(null);
  const linesKey = store.linesKey;
  useEffect(() => {
    if (!pendingImpact) return;
    const after = snapshotImpact(Object.keys(pendingImpact.before.byShop), FJ_DEMO_TODAY, store.get);
    const downstream = describeImpact(pendingImpact.before, after);
    store.updateSettings(s => ({ ...s, log: s.log.map(e => (e.id === pendingImpact.id ? { ...e, downstream } : e)) }));
    setPendingImpact(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- linesKey, recipes and published are what the snapshot depends on
  }, [pendingImpact, linesKey, store.recipes, published]);

  if (!isFarmerJ) return <Notice>Switch the Brand pill in demo controls to Farmer J to see this screen.</Notice>;

  const publish = () => {
    const shops = shopsTouched(changes);
    const at = demoNowISO();
    const id = `pub-${at}-${Math.random().toString(36).slice(2, 7)}`;

    // Shops that keep something of their own through this publish.
    const kept: PublishEntry['kept'] = [];
    if (dayChanges.length) {
      for (const [shop, o] of Object.entries(days.shops)) {
        if (!Object.keys(o).length) continue;
        const parts = (Object.entries(o) as [ShelfLifeGroupId, Weekday[]][]).map(([g, d]) => `${d.map(x => LONG_DAYS[x]).join(' and ')} for ${SHELF_LIFE_GROUPS[g].label.toLowerCase()}`);
        kept.push({ shopId: shop, what: parts.join('; ') });
      }
    }
    if (lineChanges.length) for (const shop of shopsWithOwnLines) kept.push({ shopId: shop, what: 'its own lines' });
    if (benchChanges.length) for (const shop of shopsWithOwnBenches) kept.push({ shopId: shop, what: 'its own benches' });

    // Snapshot everything the publish will touch, for revert.
    const touchedSites = new Set<string>([FJ_ALL_SHOPS_ID]);
    if (daysDraft) for (const s of FJ_SHOPS) if (JSON.stringify(shopDays[s.id] ?? {}) !== JSON.stringify(daysDraft.shops[s.id] ?? {})) touchedSites.add(s.id);
    const before: PublishSnapshot = {
      recipes: Object.fromEntries(fjRecipes.filter(r => recipeDraft[r.id]).map(r => [r.id, productionFieldsOf(r)])),
      overlays: Object.fromEntries(Array.from(touchedSites).map(id => [id, siteStore.overlayFor(id) ?? null])),
      containers: JSON.parse(JSON.stringify(published.containers)),
      methodDefaults: JSON.parse(JSON.stringify(published.methodDefaults)),
    };

    // Approved days in the current window at the shops receiving the change
    // keep running, but get flagged with the units the GM approved.
    const flagged: PublishEntry['flagged'] = [];
    const window = planningWindowFor(FJ_DEMO_TODAY);
    for (const shopId of shops) {
      for (const date of window.days) {
        if (date < FJ_DEMO_TODAY) continue;
        const record = store.get(shopId, date);
        if (!record.approvedAtISO) continue;
        const plan = computeDayPlan(shopId, date, record, store.get(shopId, addDays(date, -1)).close);
        const pinned: Record<string, LineOverride> = Object.fromEntries(
          plan.plans.map(p => [p.productId, Object.fromEntries(p.lines.map(l => [l.lineId, l.plannedUnits]))]),
        );
        const fields = changes.filter(c => c.shops.includes(shopId)).map(c => c.field);
        store.update(shopId, date, r => ({ ...r, settingsChanged: { publishId: id, atISO: at, by: 'Jana', fields, pinned } }));
        flagged.push({ shopId, date });
      }
    }

    // Engines still run on the old rules here: take the "before" for the downstream line.
    const impactBefore = snapshotImpact(shops, FJ_DEMO_TODAY, store.get);

    for (const r of fjRecipes) {
      const patch = recipeDraft[r.id];
      if (patch && !sameFields({ ...productionFieldsOf(r), ...patch }, productionFieldsOf(r))) updateRecipe(withProductionFields(r, patch));
    }
    setRecipeDraft({});
    if (linesDraft || benchDraft || daysDraft) {
      let company = siteStore.overlayFor(FJ_ALL_SHOPS_ID);
      if (linesDraft || benchDraft) company = benchesToOverlay(lines, benches, company);
      if (daysDraft) {
        company = withCompanyDays(company, daysDraft.company);
        for (const s of FJ_SHOPS) {
          if (JSON.stringify(shopDays[s.id] ?? {}) === JSON.stringify(daysDraft.shops[s.id] ?? {})) continue;
          siteStore.replace(s.id, withShopDays(siteStore.overlayFor(s.id), daysDraft.shops[s.id] ?? {}));
        }
      }
      siteStore.replace(FJ_ALL_SHOPS_ID, company);
      setLinesDraft(null);
      setBenchDraft(null);
      setDaysDraft(null);
    }
    const entry: PublishEntry = { id, atISO: at, by: 'Jana', effectiveFrom: FJ_DEMO_TODAY, shops, kept, changes, downstream: [], flagged, before };
    store.updateSettings(s => ({
      draft: s.draft,
      published: JSON.parse(JSON.stringify(s.draft)),
      log: [entry, ...s.log],
    }));
    setPendingImpact({ id, before: impactBefore });
    setPreview(false);
    const keptText = kept.map(k => `${getShop(k.shopId)?.name ?? k.shopId} keeps ${k.what}`);
    setBanner(`Published to ${shops.length} ${shops.length === 1 ? 'shop' : 'shops'}.${keptText.length ? ` ${keptText.join('. ')}.` : ''}${flagged.length ? ` ${flagged.length} approved ${flagged.length === 1 ? 'day' : 'days'} flagged for the GM to re-approve.` : ''}`);
    setTab('log');
  };

  /** Put back what a publish changed. Only the latest live entry can be reverted. */
  const revert = (entry: PublishEntry) => {
    const snap = entry.before;
    if (!snap) return;
    for (const [recipeId, fields] of Object.entries(snap.recipes)) {
      const r = store.recipes.find(x => x.id === recipeId);
      if (r) updateRecipe(withProductionFields(r, fields));
    }
    for (const [siteId, overlay] of Object.entries(snap.overlays)) siteStore.replace(siteId, overlay ?? undefined);
    for (const f of entry.flagged) store.update(f.shopId, f.date, r => (r.settingsChanged?.publishId === entry.id ? { ...r, settingsChanged: undefined } : r));
    const at = demoNowISO();
    const reversed: SettingsChange[] = entry.changes.map(c => ({ ...c, from: c.to, to: c.from }));
    const revertEntry: PublishEntry = { id: `rev-${at}`, atISO: at, by: 'Jana', effectiveFrom: FJ_DEMO_TODAY, shops: entry.shops, kept: [], changes: reversed, downstream: [], flagged: [], revertOf: entry.id };
    const restored = (v: SettingsValues): SettingsValues => ({
      ...v,
      containers: JSON.parse(JSON.stringify(snap.containers)),
      methodDefaults: JSON.parse(JSON.stringify(snap.methodDefaults ?? v.methodDefaults)),
    });
    store.updateSettings(s => ({
      draft: restored(s.draft),
      published: restored(s.published),
      log: [revertEntry, ...s.log.map(e => (e.id === entry.id ? { ...e, revertedAtISO: at } : e))],
    }));
    setBanner(`Reverted the publish from ${new Date(entry.atISO).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}. ${entry.shops.length} ${entry.shops.length === 1 ? 'shop is' : 'shops are'} back on the rules before it.`);
  };

  const discard = () => {
    setRecipeDraft({});
    setLinesDraft(null);
    setBenchDraft(null);
    setDaysDraft(null);
    store.updateSettings(s => ({ ...s, draft: JSON.parse(JSON.stringify(s.published)) }));
  };

  const last = log[0];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '16px 24px 24px' }}>
        <div style={{ maxWidth: 1180, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--color-text-primary)' }}>Setup</div>
              <div style={{ fontSize: 12, color: 'var(--color-text-muted)', marginTop: 2 }}>
                {last ? `Last published ${new Date(last.atISO).toLocaleString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })} by ${last.by} to ${last.shops.length} ${last.shops.length === 1 ? 'shop' : 'shops'}` : `${FJ_SHOPS.length} shops on the recipe book's defaults`}
              </div>
            </div>
            {changes.length > 0 && <StatusPill tone="warning" size="sm" label={`${changes.length} unpublished`} />}
          </div>

          {banner && (
            <div role="status" style={{ padding: '12px 14px', borderRadius: 'var(--radius-card)', background: 'var(--color-success-light)', border: '1px solid var(--color-success-border)', color: 'var(--color-success)', display: 'flex', alignItems: 'flex-start', gap: 12 }}>
              <CheckCircle2 size={16} style={{ marginTop: 1, flexShrink: 0 }} />
              <div style={{ flex: 1, fontSize: 12, fontWeight: 700 }}>{banner}</div>
              <button type="button" onClick={() => setBanner(null)} aria-label="Dismiss" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'inherit', padding: 2 }}><X size={14} /></button>
            </div>
          )}

          <div role="tablist" aria-label="Setup sections" style={{ display: 'flex', gap: 4, padding: 4, borderRadius: 999, background: 'var(--color-bg-hover)', border: '1px solid var(--color-border-subtle)', alignSelf: 'flex-start' }}>
            {TABS.map(t => (
              <button key={t.id} type="button" role="tab" aria-selected={tab === t.id} onClick={() => setTab(t.id)} style={tabStyle(tab === t.id)}>
                {t.label}
                {t.id === 'log' && log.length > 0 && <span style={{ marginLeft: 6, opacity: 0.7 }}>{log.length}</span>}
              </button>
            ))}
          </div>

          {tab === 'recipes' && <RecipesTab recipes={fjRecipes} draft={recipeDraft} setField={setRecipeField} reset={resetRecipe} settings={draft} setSettings={setDraft} />}
          {tab === 'days' && <DaysTab days={days} setDays={next => setDaysDraft(next)} recipes={fjRecipes} />}
          {tab === 'lines' && <LinesTab lines={lines} setLines={next => setLinesDraft(next)} shopsWithOwnLines={shopsWithOwnLines} />}
          {tab === 'benches' && <BenchesTab benches={benches} setBenches={next => setBenchDraft(next)} lines={lines} setLines={next => setLinesDraft(next)} shopsWithOwnBenches={shopsWithOwnBenches} />}
          {tab === 'containers' && <ContainersTab draft={draft} setDraft={setDraft} />}
          {tab === 'log' && <LogTab log={log} onRevert={revert} />}
        </div>
      </div>

      {changes.length > 0 && (
        <div role="region" aria-label="Unpublished changes" style={{ position: 'sticky', bottom: 0, zIndex: 40, padding: '12px 24px', background: '#fff', borderTop: '1px solid var(--color-border)', boxShadow: '0 -8px 24px rgba(0,28,53,0.08)', display: 'flex', alignItems: 'center', gap: 10 }}>
          <ChevronRight size={14} color="var(--color-info)" />
          <span style={{ fontSize: 12, fontWeight: 700 }}>{changes.length} change{changes.length === 1 ? '' : 's'} ready to publish</span>
          <span style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>{shopsTouched(changes).length} of {FJ_SHOPS.length} shops</span>
          <div style={{ flex: 1 }} />
          <button type="button" onClick={discard} style={ghostBtn}>Discard</button>
          <button type="button" onClick={() => setPreview(true)} style={primaryBtn}><CheckCircle2 size={12} /> Publish to all shops</button>
        </div>
      )}

      {preview && <PublishPreview changes={changes} onClose={() => setPreview(false)} onConfirm={publish} />}
    </div>
  );
}

// ─── Recipes ─────────────────────────────────────────────────────────────────

type TabProps = { draft: SettingsValues; setDraft: (fn: (d: SettingsValues) => SettingsValues) => void };

/** Unpublished recipe edits, by library id. Publishing writes them to the recipe. */
type RecipeDraft = Record<string, Partial<FjProductionFields>>;

function fieldsWithDraft(r: Recipe, draft: RecipeDraft): FjProductionFields {
  return { ...productionFieldsOf(r), ...(draft[r.id] ?? {}) };
}

function diffRecipes(recipes: Recipe[], draft: RecipeDraft): SettingsChange[] {
  const all = FJ_SHOPS.map(s => s.id);
  const out: SettingsChange[] = [];
  for (const r of recipes) {
    if (!draft[r.id]) continue;
    const a = productionFieldsOf(r);
    const b = fieldsWithDraft(r, draft);
    if (a.yieldLossPct !== b.yieldLossPct) out.push({ field: `${r.name} yield loss`, from: `${a.yieldLossPct}%`, to: `${b.yieldLossPct}%`, shops: all });
    if (a.shelfLifeGroup !== b.shelfLifeGroup) out.push({ field: `${r.name} shelf life`, from: groupLabel(a.shelfLifeGroup), to: groupLabel(b.shelfLifeGroup), shops: all });
    if (a.halfBatch !== b.halfBatch) out.push({ field: `${r.name} half batches`, from: a.halfBatch ? 'allowed' : 'not allowed', to: b.halfBatch ? 'allowed' : 'not allowed', shops: all });
    if (a.outputContainer !== b.outputContainer) out.push({ field: `${r.name} container`, from: containerLabel(a.outputContainer), to: containerLabel(b.outputContainer), shops: all });
    if (a.containersPerBatch !== b.containersPerBatch) out.push({ field: `${r.name} containers per batch`, from: String(a.containersPerBatch || '—'), to: String(b.containersPerBatch || '—'), shops: all });
    if (a.recipeClass !== b.recipeClass) out.push({ field: `${r.name} class`, from: classLabel(a.recipeClass), to: classLabel(b.recipeClass), shops: all });
    const ka = kitText(a);
    const kb = kitText(b);
    if (ka !== kb) out.push({ field: `${r.name} kit`, from: ka, to: kb, shops: all });
    if (a.steps.join('\n') !== b.steps.join('\n')) out.push({ field: `${r.name} method`, from: `${a.steps.length} steps`, to: `${b.steps.length} steps`, shops: all });
    const ma = describeMethod(methodOf(a));
    const mb = describeMethod(methodOf(b));
    if (ma !== mb) out.push({ field: `${r.name} method settings`, from: ma, to: mb, shops: all });
  }
  return out;
}

const classLabel = (c: RecipeClassId | '') => (c ? RECIPE_CLASS_BY_ID[c].label : '—');
const kitText = (f: FjProductionFields) => {
  const kit = resolveEquipment(f.recipeClass, f.equipment).map(e => EQUIPMENT_LABELS[e].toLowerCase()).join(', ') || 'none';
  return f.equipment === null ? `${kit} (class default)` : kit;
};

const groupLabel = (g: ShelfLifeGroupId | '') => (g ? SHELF_LIFE_GROUPS[g].label : '—');
const containerLabel = (c: ContainerId | '') => (c ? CONTAINERS[c].name : '—');

function RecipesTab({ recipes, draft, setField, reset, settings, setSettings }: { recipes: Recipe[]; draft: RecipeDraft; setField: (id: string, patch: Partial<FjProductionFields>) => void; reset: (id: string) => void; settings: SettingsValues; setSettings: TabProps['setDraft'] }) {
  const components = recipes.filter(r => r.id.startsWith('fj:c:'));
  const products = recipes.filter(r => r.id.startsWith('fj:p:'));
  const containerIds = Object.keys(CONTAINERS) as ContainerId[];
  return (
    <>
      <Section
        title="Components"
        description="Grouped by recipe class. A class carries the kit its recipes normally need; a recipe inherits it unless its kit is set. Cook loads are sized from that kit against what each shop's kitchen owns."
      >
        <table style={tableStyle}>
          <thead>
            <tr>
              <th style={th}>Component</th>
              <th style={th}>Class</th>
              <th style={th}>Kit</th>
              <th style={th}>Shelf life</th>
              <th style={{ ...th, textAlign: 'center' }}>Yield loss</th>
              <th style={{ ...th, textAlign: 'center' }}>Half batches</th>
              <th style={th}>Container</th>
              <th style={th} />
            </tr>
          </thead>
          <tbody>
            {CLASS_ORDER.map(cls => {
              const rows = components
                .map(r => ({ r, ref: bookRef(r.id), f: fieldsWithDraft(r, draft) }))
                .filter(x => x.ref?.kind === 'component' && x.f.recipeClass === cls)
                .sort((a, b) => a.r.name.localeCompare(b.r.name));
              if (!rows.length) return null;
              return [
                <tr key={`h-${cls}`}><td colSpan={8} style={groupTd}>{CLASS_GROUP_LABELS[cls]}</td></tr>,
                ...rows.map(({ r, ref, f }) => {
                  const c = ref!.kind === 'component' ? ref!.component : null;
                  if (!c) return null;
                  const authored = AUTHORED_FIELDS[r.id];
                  const changed = authored ? !sameFields(f, authored) : false;
                  const inherited = RECIPE_CLASS_BY_ID[cls].defaultEquipment;
                  const kitValue = f.equipment === null ? '' : f.equipment.length === 0 ? 'none' : f.equipment[0];
                  return (
                    <tr key={r.id}>
                      <td style={td}>
                        <div style={{ fontWeight: 600, color: 'var(--color-text-primary)' }}>{r.name}</div>
                        <div style={{ fontSize: 10.5, color: 'var(--color-text-muted)', marginTop: 2, maxWidth: 320 }}>
                          {kg(c.batch.fullG)}{c.batch.label ? `, ${c.batch.label}` : ''}{f.halfBatch ? ` · half ${kg(c.batch.halfG ?? c.batch.fullG / 2)}` : ''}
                          {c.yieldNote ? ` · ${c.yieldNote}` : ''}
                        </div>
                      </td>
                      <td style={td}>
                        <select
                          value={f.recipeClass}
                          onChange={e => setField(r.id, { recipeClass: e.target.value as RecipeClassId })}
                          aria-label={`${r.name} recipe class`}
                          style={selectStyle}
                        >
                          {RECIPE_CLASSES.filter(k => k.id !== 'finished').map(k => <option key={k.id} value={k.id}>{k.label}</option>)}
                        </select>
                      </td>
                      <td style={td}>
                        <select
                          value={kitValue}
                          onChange={e => {
                            const v = e.target.value;
                            setField(r.id, { equipment: v === '' ? null : v === 'none' ? [] : [v as Equipment] });
                          }}
                          aria-label={`${r.name} kit`}
                          style={{ ...selectStyle, fontStyle: kitValue === '' ? 'italic' : 'normal' }}
                          title={f.equipment === null ? 'Inherited from the class' : 'Set on this recipe'}
                        >
                          <option value="">Class default{inherited.length ? ` (${inherited.map(e => EQUIPMENT_LABELS[e].toLowerCase()).join(', ')})` : ' (none)'}</option>
                          <option value="none">None</option>
                          {KIT_OPTIONS.map(e => <option key={e} value={e}>{EQUIPMENT_LABELS[e]}</option>)}
                        </select>
                      </td>
                      <td style={td}>
                        <select
                          value={f.shelfLifeGroup}
                          onChange={e => setField(r.id, { shelfLifeGroup: e.target.value as ShelfLifeGroupId })}
                          aria-label={`${r.name} shelf life`}
                          style={selectStyle}
                        >
                          {GROUPS.map(g => <option key={g.id} value={g.id}>{g.label}</option>)}
                        </select>
                      </td>
                      <td style={{ ...td, textAlign: 'center' }}>
                        <QtyStepper
                          size="compact"
                          canDecrement={f.yieldLossPct > 0}
                          canIncrement={f.yieldLossPct < 90}
                          onDecrement={() => setField(r.id, { yieldLossPct: Math.max(0, f.yieldLossPct - 1) })}
                          onIncrement={() => setField(r.id, { yieldLossPct: Math.min(90, f.yieldLossPct + 1) })}
                          decrementLabel={`${r.name} yield loss down`}
                          incrementLabel={`${r.name} yield loss up`}
                        >
                          <span style={{ minWidth: 34, textAlign: 'center', fontSize: 12, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{f.yieldLossPct}%</span>
                        </QtyStepper>
                      </td>
                      <td style={{ ...td, textAlign: 'center' }}>
                        <Switch checked={f.halfBatch} onChange={v => setField(r.id, { halfBatch: v })} label={`${r.name} half batches`} />
                      </td>
                      <td style={td}>
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                          <select value={f.outputContainer} onChange={e => setField(r.id, { outputContainer: e.target.value as ContainerId | '' })} aria-label={`${r.name} container`} style={selectStyle}>
                            <option value="">None</option>
                            {containerIds.map(id => <option key={id} value={id}>{CONTAINERS[id].name}</option>)}
                          </select>
                          {f.outputContainer && (
                            <QtyStepper
                              size="compact"
                              canDecrement={Number(f.containersPerBatch || 0) > 1}
                              onDecrement={() => setField(r.id, { containersPerBatch: Math.max(1, Number(f.containersPerBatch || 1) - 1) })}
                              onIncrement={() => setField(r.id, { containersPerBatch: Number(f.containersPerBatch || 0) + 1 })}
                              decrementLabel={`${r.name} containers per batch down`}
                              incrementLabel={`${r.name} containers per batch up`}
                            >
                              <span style={{ minWidth: 26, textAlign: 'center', fontSize: 12, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>× {f.containersPerBatch || 1}</span>
                            </QtyStepper>
                          )}
                        </div>
                      </td>
                      <td style={{ ...td, textAlign: 'right', whiteSpace: 'nowrap' }}>
                        {changed && <button type="button" onClick={() => reset(r.id)} title="Back to the recipe book" aria-label={`${r.name} back to the recipe book`} style={iconBtn}><RotateCcw size={12} /></button>}
                        <Link href={`/recipes/${encodeURIComponent(r.id)}/edit`} title="Open recipe" aria-label={`Open ${r.name}`} style={iconBtn}><ExternalLink size={12} /></Link>
                      </td>
                    </tr>
                  );
                }),
              ];
            })}
          </tbody>
        </table>
      </Section>

      <MethodDefaultsSection recipes={components} draft={draft} settings={settings} setSettings={setSettings} />

      <Section title="Finished products">
        <table style={tableStyle}>
          <thead>
            <tr>
              <th style={th}>Product</th>
              <th style={th}>Group</th>
              <th style={th}>Main-line unit</th>
              <th style={{ ...th, textAlign: 'right' }}>Per unit</th>
              <th style={{ ...th, textAlign: 'right' }}>Units per batch</th>
              <th style={{ ...th, textAlign: 'right' }}>Batch</th>
              <th style={{ ...th, textAlign: 'center' }}>Half batches</th>
              <th style={th} />
            </tr>
          </thead>
          <tbody>
            {products.map(r => {
              const ref = bookRef(r.id);
              if (ref?.kind !== 'product') return null;
              const p = ref.product;
              const f = fieldsWithDraft(r, draft);
              const authored = AUTHORED_FIELDS[r.id];
              const changed = authored ? !sameFields(f, authored) : false;
              const unitsPerBatch = Number(f.containersPerBatch || p.unitsPerBatch);
              return (
                <tr key={r.id}>
                  <td style={{ ...td, fontWeight: 600, color: 'var(--color-text-primary)' }}>{r.name}</td>
                  <td style={td}>{PRODUCT_GROUP_LABELS[p.group]}</td>
                  <td style={td}>
                    <select value={f.outputContainer} onChange={e => setField(r.id, { outputContainer: e.target.value as ContainerId })} aria-label={`${r.name} main-line unit`} style={selectStyle}>
                      {containerIds.map(id => <option key={id} value={id}>{CONTAINERS[id].name}</option>)}
                    </select>
                  </td>
                  <td style={{ ...td, textAlign: 'right' }}>{kg(Math.round((p.batch.fullG * (1 - f.yieldLossPct / 100)) / unitsPerBatch))}</td>
                  <td style={{ ...td, textAlign: 'right' }}>
                    <QtyStepper
                      size="compact"
                      canDecrement={unitsPerBatch > 1}
                      onDecrement={() => setField(r.id, { containersPerBatch: Math.max(1, unitsPerBatch - 1) })}
                      onIncrement={() => setField(r.id, { containersPerBatch: unitsPerBatch + 1 })}
                      decrementLabel={`${r.name} units per batch down`}
                      incrementLabel={`${r.name} units per batch up`}
                    >
                      <span style={{ minWidth: 26, textAlign: 'center', fontSize: 12, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{unitsPerBatch}</span>
                    </QtyStepper>
                  </td>
                  <td style={{ ...td, textAlign: 'right' }}>{kg(p.batch.fullG)}</td>
                  <td style={{ ...td, textAlign: 'center' }}>
                    <Switch checked={f.halfBatch} onChange={v => setField(r.id, { halfBatch: v })} label={`${r.name} half batches`} />
                  </td>
                  <td style={{ ...td, textAlign: 'right', whiteSpace: 'nowrap' }}>
                    {changed && <button type="button" onClick={() => reset(r.id)} title="Back to the recipe book" aria-label={`${r.name} back to the recipe book`} style={iconBtn}><RotateCcw size={12} /></button>}
                    <Link href={`/recipes/${encodeURIComponent(r.id)}/edit`} title="Open recipe" aria-label={`Open ${r.name}`} style={iconBtn}><ExternalLink size={12} /></Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Section>

      <Section title="Portion sizes">
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {Object.entries(PORTION_GRAMS).map(([k, g]) => (
            <span key={k} style={chip}>{PORTION_LABELS[k as keyof typeof PORTION_GRAMS]} <strong style={{ marginLeft: 4 }}>{g} g</strong></span>
          ))}
        </div>
      </Section>
    </>
  );
}

const PORTION_LABELS: Record<keyof typeof PORTION_GRAMS, string> = {
  trayProtein: 'Tray protein',
  bowlProtein: 'Bowl protein',
  trayBase: 'Tray base',
  bowlBase: 'Bowl base',
  side: 'Side',
  extraMain: 'Extra main',
  extraSide: 'Extra side',
  hotSideAsMain: 'Hot side as main',
  familyBase: 'Family base',
  familySide: 'Family side',
  sauce: 'Sauce',
  topping: 'Topping',
};

// ─── Make-on days ────────────────────────────────────────────────────────────

/** A shop's own days, by group. Groups not listed follow the company. */
type ShopDays = Record<string, Partial<Record<ShelfLifeGroupId, Weekday[]>>>;
type DaysDraft = { company: MakeOnSchedule; shops: ShopDays };

const daysLabel = (d: Weekday[]) => (d.length === 7 ? 'Every day' : d.map(x => WEEKDAY_LABELS[x]).join(', ')) || 'None';

/**
 * Class defaults for the method behind the stepper chips. A recipe of the
 * class starts from these; it overrides a field on its own record
 * (Production settings, Method). Published like everything else here.
 */
function MethodDefaultsSection({ recipes, draft, settings, setSettings }: { recipes: Recipe[]; draft: RecipeDraft; settings: SettingsValues; setSettings: TabProps['setDraft'] }) {
  const set = (cls: RecipeClassId, patch: Partial<RecipeMethod>) =>
    setSettings(d => ({ ...d, methodDefaults: { ...d.methodDefaults, [cls]: { ...d.methodDefaults[cls], ...patch } } }));
  const num = (v: string): number | '' => (v.trim() === '' ? '' : Math.max(0, Number(v)));
  return (
    <Section
      title="Method defaults"
      description="What the stepper's chips say for a recipe of each class unless the recipe sets its own: the programme, cook time, core temperature to probe to, rest, how long it may hold on the line, and the hand tools to get out. Change a default here and every recipe still inheriting it follows. Rest, hold and core temperature set to 0 mean none."
    >
      <table style={tableStyle}>
        <thead>
          <tr>
            <th style={th}>Class</th>
            <th style={th}>Programme</th>
            <th style={th}>Time (min)</th>
            <th style={th}>Core °C</th>
            <th style={th}>Rest (min)</th>
            <th style={th}>Hold (min)</th>
            <th style={th}>Hand tools</th>
          </tr>
        </thead>
        <tbody>
          {CLASS_ORDER.map(cls => {
            const m = settings.methodDefaults[cls];
            const base = BASELINE.methodDefaults[cls];
            const inClass = recipes.map(r => fieldsWithDraft(r, draft)).filter(f => f.recipeClass === cls);
            const setFields = METHOD_FIELDS.filter(f => (Array.isArray(m[f.key]) ? (m[f.key] as string[]).length > 0 : m[f.key] !== ''));
            const inheriting = setFields.map(f => `${f.label.toLowerCase()} ${inClass.filter(x => x.method[f.key] === undefined).length}`);
            const changed = METHOD_FIELDS.filter(f => JSON.stringify(m[f.key]) !== JSON.stringify(base[f.key]));
            return (
              <tr key={cls}>
                <td style={td}>
                  <div style={{ fontWeight: 600, color: 'var(--color-text-primary)' }}>{RECIPE_CLASS_BY_ID[cls].label}</div>
                  <div style={{ fontSize: 10.5, color: 'var(--color-text-muted)', marginTop: 2 }}>
                    {inClass.length} {inClass.length === 1 ? 'recipe' : 'recipes'}{inheriting.length ? ` · inheriting ${inheriting.join(', ')}` : ''}
                    {changed.length > 0 && <> · was {changed.map(f => `${f.label.toLowerCase()} ${methodFieldText(f.key, base[f.key])}`).join(', ')}</>}
                  </div>
                </td>
                <td style={td}><TextInput value={m.programme} onChange={v => set(cls, { programme: v })} placeholder="none" width={150} /></td>
                <td style={td}>
                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                    <NumInput value={m.minutesFrom} onChange={v => set(cls, { minutesFrom: num(v) })} label={`${RECIPE_CLASS_BY_ID[cls].label} cook time`} />
                    <span style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>to</span>
                    <NumInput value={m.minutesTo} onChange={v => set(cls, { minutesTo: num(v) })} label={`${RECIPE_CLASS_BY_ID[cls].label} cook time, up to`} />
                  </div>
                </td>
                <td style={td}><NumInput value={m.coreTempC} onChange={v => set(cls, { coreTempC: num(v) })} label={`${RECIPE_CLASS_BY_ID[cls].label} core temperature`} /></td>
                <td style={td}><NumInput value={m.restMinutes} onChange={v => set(cls, { restMinutes: num(v) })} label={`${RECIPE_CLASS_BY_ID[cls].label} rest`} /></td>
                <td style={td}><NumInput value={m.holdMinutes} onChange={v => set(cls, { holdMinutes: num(v) })} label={`${RECIPE_CLASS_BY_ID[cls].label} hold`} /></td>
                <td style={td}>
                  <TextInput value={m.handTools.join(', ')} onChange={v => set(cls, { handTools: v.split(',').map(x => x.trimStart()).filter((x, i, arr) => x.length > 0 || i === arr.length - 1) })} placeholder="Comma separated" width={240} />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </Section>
  );
}

function NumInput({ value, onChange, label }: { value: number | ''; onChange: (v: string) => void; label: string }) {
  return (
    <input
      type="number"
      min={0}
      value={value}
      onChange={e => onChange(e.target.value)}
      aria-label={label}
      placeholder="—"
      style={{ ...selectStyle, width: 64, textAlign: 'center', fontVariantNumeric: 'tabular-nums' }}
    />
  );
}

function diffDays(from: DaysDraft, to: DaysDraft): SettingsChange[] {
  const all = FJ_SHOPS.map(s => s.id);
  const out: SettingsChange[] = [];
  for (const g of GROUP_IDS) {
    if (sameDays(from.company.days[g], to.company.days[g])) continue;
    const overridden = Object.entries(to.shops).filter(([, o]) => o[g]).map(([s]) => s);
    out.push({ field: `${SHELF_LIFE_GROUPS[g].label} make-on days`, from: daysLabel(from.company.days[g]), to: daysLabel(to.company.days[g]), shops: all.filter(s => !overridden.includes(s)) });
  }
  if (!sameDays(from.company.deepClean, to.company.deepClean)) {
    out.push({ field: 'Deep clean day', from: daysLabel(from.company.deepClean), to: daysLabel(to.company.deepClean), shops: all });
  }
  const shopIds = new Set([...Object.keys(from.shops), ...Object.keys(to.shops)]);
  for (const shop of shopIds) {
    for (const g of GROUP_IDS) {
      const a = from.shops[shop]?.[g];
      const b = to.shops[shop]?.[g];
      const la = a ? daysLabel(a) : 'default';
      const lb = b ? daysLabel(b) : 'default';
      if (la !== lb) out.push({ field: `${SHELF_LIFE_GROUPS[g].label} make-on days`, from: la, to: lb, shops: [shop] });
    }
  }
  return out;
}

/** Company windows: only what differs from the recipe book's defaults is stored. */
function withCompanyDays(current: SiteSettingsOverlay | undefined, schedule: MakeOnSchedule): SiteSettingsOverlay {
  const windows: WindowsOverlay = {};
  for (const d of FJ_DAYS_OF_WEEK) {
    const w = dayToWeekday(d);
    const base = FJ_DEFAULT_WINDOWS[d];
    const makeOn: Record<string, boolean> = {};
    for (const g of GROUP_IDS) {
      const on = schedule.days[g].includes(w);
      if (on !== Boolean(base.makeOn[g])) makeOn[g] = on;
    }
    const deep = schedule.deepClean.includes(w);
    const day: WindowsOverlay[typeof d] = {};
    if (Object.keys(makeOn).length) day.makeOn = makeOn;
    if (deep !== Boolean(base.deepClean)) day.deepClean = deep;
    if (Object.keys(day).length) windows[d] = day;
  }
  const next = { ...(current ?? {}) };
  if (Object.keys(windows).length) next.windows = windows; else delete next.windows;
  return next;
}

/** A shop's windows: its overridden groups written for all seven days, the rest inherit. */
function withShopDays(current: SiteSettingsOverlay | undefined, own: Partial<Record<ShelfLifeGroupId, Weekday[]>>): SiteSettingsOverlay {
  const windows: WindowsOverlay = {};
  for (const d of FJ_DAYS_OF_WEEK) {
    const w = dayToWeekday(d);
    const existing = current?.windows?.[d] ?? {};
    const makeOn: Record<string, boolean> = {};
    for (const [g, list] of Object.entries(own) as [ShelfLifeGroupId, Weekday[]][]) makeOn[g] = list.includes(w);
    const day = { ...existing };
    if (Object.keys(makeOn).length) day.makeOn = makeOn; else delete day.makeOn;
    if (Object.keys(day).length) windows[d] = day;
  }
  const next = { ...(current ?? {}) };
  if (Object.keys(windows).length) next.windows = windows; else delete next.windows;
  return next;
}

function DaysTab({ days, setDays, recipes }: { days: DaysDraft; setDays: (next: DaysDraft) => void; recipes: Recipe[] }) {
  const [shop, setShop] = useState<string>(FJ_SHOPS[0].id);
  const own = days.shops[shop] ?? {};
  const shopSchedule: MakeOnSchedule = {
    days: Object.fromEntries(GROUP_IDS.map(g => [g, own[g] ?? days.company.days[g]])) as Record<ShelfLifeGroupId, Weekday[]>,
    deepClean: days.company.deepClean,
  };
  const inherited = Object.fromEntries(GROUP_IDS.map(g => [g, !own[g]])) as Record<ShelfLifeGroupId, boolean>;
  const flip = (cur: Weekday[], day: Weekday) => (cur.includes(day) ? cur.filter(x => x !== day) : [...cur, day].sort((a, b) => a - b));

  const toggleCompany = (g: ShelfLifeGroupId, day: Weekday) =>
    setDays({ ...days, company: { ...days.company, days: { ...days.company.days, [g]: flip(days.company.days[g], day) } } });

  const setDeepClean = (next: Weekday[]) => setDays({ ...days, company: { ...days.company, deepClean: next } });

  const toggleShop = (g: ShelfLifeGroupId, day: Weekday) =>
    setDays({ ...days, shops: { ...days.shops, [shop]: { ...own, [g]: flip(own[g] ?? days.company.days[g], day) } } });

  const resetShop = (g: ShelfLifeGroupId) => {
    const o = { ...own };
    delete o[g];
    const shops = { ...days.shops };
    if (Object.keys(o).length) shops[shop] = o; else delete shops[shop];
    setDays({ ...days, shops });
  };

  const recipeCount = (g: ShelfLifeGroupId) => recipes.filter(r => productionFieldsOf(r).shelfLifeGroup === g).length;

  return (
    <>
      <Section
        title="Shelf-life groups"
        description="Company-wide. A group says how many days a batch covers; a recipe picks its group on its recipe page under Production settings."
      >
        <table style={tableStyle}>
          <thead>
            <tr>
              <th style={th}>Group</th>
              <th style={th}>Covers</th>
              <th style={th}>What goes in it</th>
              <th style={{ ...th, textAlign: 'right' }}>Recipes</th>
            </tr>
          </thead>
          <tbody>
            {GROUPS.map(g => (
              <tr key={g.id}>
                <td style={td}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                    <span aria-hidden style={{ width: 9, height: 9, borderRadius: 999, background: g.colour, flexShrink: 0 }} />
                    <span style={{ fontWeight: 600, color: 'var(--color-text-primary)' }}>{g.label}</span>
                  </span>
                </td>
                <td style={td}>{g.days === 1 ? 'Same day' : `${g.days} days, make-on day included`}</td>
                <td style={td}>{g.description}</td>
                <td style={{ ...td, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{recipeCount(g.id)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Section>
      <Section
        title="Every shop"
        description="The days each group is made, and the deep clean day when nothing is made ahead. A shop keeps its own days where it has set them."
      >
        <MakeOnGrid schedule={days.company} deepClean={days.company.deepClean} onToggle={toggleCompany} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 12, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-text-primary)' }}>Deep clean day</span>
          <DeepCleanPicker value={days.company.deepClean} onChange={setDeepClean} />
        </div>
      </Section>
      <Section
        title="One shop"
        description="Faded rows follow the company default. The shop's GM can change these on the shop's Settings too."
        rightSlot={
          <select value={shop} onChange={e => setShop(e.target.value)} aria-label="Shop" style={selectStyle}>
            {FJ_SHOPS.map(s => <option key={s.id} value={s.id}>{s.name}{days.shops[s.id] && Object.keys(days.shops[s.id]).length ? ' · own days' : ''}</option>)}
          </select>
        }
      >
        <MakeOnGrid schedule={shopSchedule} inherited={inherited} deepClean={days.company.deepClean} onToggle={toggleShop} onReset={resetShop} />
      </Section>
    </>
  );
}

// ─── Lines ───────────────────────────────────────────────────────────────────

/** A service line as edited on this screen: the bench fields the planner reads. */
type LineDraft = { id: string; name: string; halfBatches: boolean; channels: SalesChannel[]; roles: WorkRole[] };

const isChannel = (c: string): c is SalesChannel => (ALL_CHANNELS as string[]).includes(c);
const isRole = (r: string): r is WorkRole => r in FJ_WORK_ROLE_BY_ID;

function toLineDraft(b: EffectiveBench): LineDraft {
  return { id: b.id, name: b.name, halfBatches: Boolean(b.halfBatches), channels: (b.channels ?? []).filter(isChannel), roles: (b.sections ?? []).filter(isRole) };
}

/** A kitchen bench as edited on this screen: its name, the work it takes, and the kit it owns. */
type BenchDraft = { id: string; name: string; roles: WorkRole[]; kit: BenchKitItem[] };

function toBenchDraft(b: EffectiveBench): BenchDraft {
  return { id: b.id, name: b.name, roles: (b.sections ?? []).filter(isRole), kit: (b.kit ?? []).map(k => ({ ...k })) };
}

const sameKit = (a: BenchKitItem[] | undefined, b: BenchKitItem[] | undefined) => JSON.stringify(a ?? []) === JSON.stringify(b ?? []);
const sameRoles = (a: string[] | undefined, b: string[] | undefined) => [...(a ?? [])].sort().join() === [...(b ?? [])].sort().join();

/**
 * Write the drafted lines and kitchen benches back as the company
 * (`fj-all-shops`) overlay, keeping its other settings. Everything is
 * diffed against its template so a shop's own overlay still wins where it
 * differs; a bench without a template is stored whole as an added bench.
 */
function benchesToOverlay(lines: LineDraft[], kitchen: BenchDraft[], current: SiteSettingsOverlay | undefined): SiteSettingsOverlay {
  const benches: NonNullable<SiteSettingsOverlay['benches']> = {};
  const addedBenches: NonNullable<SiteSettingsOverlay['addedBenches']> = {};
  for (const l of lines) {
    const template = FJ_LINE_TEMPLATES.find(t => t.id === l.id);
    if (template) {
      const patch: BenchOverlay = {};
      if (l.name !== template.name) patch.name = l.name;
      if (l.halfBatches !== Boolean(template.halfBatches)) patch.halfBatches = l.halfBatches;
      if (l.channels.join() !== (template.channels ?? []).join()) patch.channels = l.channels;
      if (!sameRoles(l.roles, template.sections)) patch.sections = l.roles;
      if (Object.keys(patch).length) benches[l.id] = patch;
    } else {
      addedBenches[l.id] = {
        id: l.id, siteId: FJ_ALL_SHOPS_ID, name: l.name,
        capabilities: ['assemble'], workTypes: ['assemble', 'portion'], equipment: ['prep-table'],
        online: true, primaryMode: 'variable', halfBatches: l.halfBatches, channels: l.channels,
        ...(l.roles.length ? { sections: l.roles } : {}),
      };
    }
  }
  for (const b of kitchen) {
    const template = FJ_KITCHEN_TEMPLATES.find(t => t.id === b.id);
    if (template) {
      const patch: BenchOverlay = { ...(current?.benches?.[b.id] ?? {}) };
      if (sameKit(b.kit, template.kit)) delete patch.kit; else patch.kit = b.kit;
      if (b.name === template.name) delete patch.name; else patch.name = b.name;
      if (sameRoles(b.roles, template.sections)) delete patch.sections; else patch.sections = b.roles;
      if (Object.keys(patch).length) benches[b.id] = patch;
    } else {
      const added = current?.addedBenches?.[b.id];
      addedBenches[b.id] = {
        id: b.id, siteId: FJ_ALL_SHOPS_ID, capabilities: ['prep'], workTypes: ['mix', 'portion'], online: true, primaryMode: 'variable',
        ...(added ?? {}),
        name: b.name, kit: b.kit, sections: b.roles,
        equipment: Array.from(new Set([...(added?.equipment ?? ['prep-table']), ...b.kit.map(k => k.equipment)])),
      };
    }
  }
  const next: SiteSettingsOverlay = { ...(current ?? {}) };
  delete next.benches; delete next.benchOrder; delete next.addedBenches;
  if (Object.keys(benches).length) next.benches = benches;
  if (Object.keys(addedBenches).length) next.addedBenches = addedBenches;
  const order = [...lines.map(l => l.id), ...kitchen.map(b => b.id)];
  const defaultOrder = FJ_BENCH_TEMPLATES.map(t => t.id).join();
  if (order.join() !== defaultOrder) next.benchOrder = order;
  return next;
}

function kitLabel(k: BenchKitItem): string {
  const unit = EQUIPMENT_CAPACITY_UNIT[k.equipment];
  return `${k.count}${unit && k.capacity ? ` × ${k.capacity} ${unit}` : ''}`;
}

const rolesText = (roles: WorkRole[]) => (roles.length ? roles.map(r => FJ_WORK_ROLE_BY_ID[r].label.toLowerCase()).join(', ') : 'nothing');

function diffBenches(from: BenchDraft[], to: BenchDraft[], shops: string[]): SettingsChange[] {
  const out: SettingsChange[] = [];
  const before = new Map(from.map(b => [b.id, b]));
  const after = new Map(to.map(b => [b.id, b]));
  for (const b of to) {
    const prev = before.get(b.id);
    if (!prev) { out.push({ field: 'Bench added', from: '—', to: `${b.name} (${rolesText(b.roles)})`, shops }); continue; }
    if (prev.name !== b.name) out.push({ field: 'Bench name', from: prev.name, to: b.name, shops });
    if (!sameRoles(prev.roles, b.roles)) out.push({ field: `${b.name} takes`, from: rolesText(prev.roles), to: rolesText(b.roles), shops });
    const a = new Map(prev.kit.map(k => [k.equipment, k]));
    const z = new Map(b.kit.map(k => [k.equipment, k]));
    for (const e of new Set([...a.keys(), ...z.keys()])) {
      const p = a.get(e);
      const n = z.get(e);
      if (p && n && kitLabel(p) === kitLabel(n)) continue;
      out.push({ field: `${b.name} ${EQUIPMENT_LABELS[e].toLowerCase()}s`, from: p ? kitLabel(p) : 'none', to: n ? kitLabel(n) : 'none', shops });
    }
  }
  for (const b of from) if (!after.has(b.id)) out.push({ field: 'Bench removed', from: b.name, to: '—', shops });
  return out;
}

function diffLines(from: LineDraft[], to: LineDraft[], shops: string[]): SettingsChange[] {
  const out: SettingsChange[] = [];
  const byId = (xs: LineDraft[]) => new Map(xs.map(x => [x.id, x]));
  const a = byId(from);
  const b = byId(to);
  for (const l of to) {
    const prev = a.get(l.id);
    if (!prev) { out.push({ field: 'Line added', from: '—', to: l.name, shops }); continue; }
    if (prev.name !== l.name) out.push({ field: 'Line name', from: prev.name, to: l.name, shops });
    if (prev.halfBatches !== l.halfBatches) out.push({ field: `${l.name} half batches`, from: prev.halfBatches ? 'on' : 'off', to: l.halfBatches ? 'on' : 'off', shops });
    if (!sameRoles(prev.roles, l.roles)) out.push({ field: `${l.name} takes`, from: rolesText(prev.roles), to: rolesText(l.roles), shops });
  }
  for (const l of from) if (!b.has(l.id)) out.push({ field: 'Line removed', from: l.name, to: '—', shops });
  const lineOf = (xs: LineDraft[], ch: SalesChannel) => xs.find(l => l.channels.includes(ch));
  for (const ch of ALL_CHANNELS) {
    const p = lineOf(from, ch);
    const n = lineOf(to, ch);
    if (p?.id !== n?.id) out.push({ field: `${CHANNEL_LABELS[ch]} plates on`, from: p?.name ?? '—', to: n?.name ?? '—', shops });
  }
  if (from.map(l => l.id).join() !== to.map(l => l.id).join() && from.length === to.length && from.every(l => b.has(l.id))) {
    out.push({ field: 'Line order', from: from.map(l => l.name).join(' · '), to: to.map(l => l.name).join(' · '), shops });
  }
  return out;
}

function LinesTab({ lines, setLines, shopsWithOwnLines }: { lines: LineDraft[]; setLines: (next: LineDraft[]) => void; shopsWithOwnLines: string[] }) {
  const patch = (id: string, p: Partial<LineDraft>) => setLines(lines.map(l => (l.id === id ? { ...l, ...p } : l)));
  const remove = (id: string) => {
    if (lines.length <= 1) return;
    const gone = lines.find(l => l.id === id);
    const rest = lines.filter(l => l.id !== id);
    // Its channels have to plate somewhere: the first remaining line.
    rest[0] = { ...rest[0], channels: [...rest[0].channels, ...(gone?.channels ?? [])] };
    setLines(rest);
  };
  const add = () => {
    if (lines.length >= MAX_BENCHES) return;
    let n = lines.length + 1;
    while (lines.some(l => l.id === `fj-line-${n}`)) n += 1;
    setLines([...lines, { id: `fj-line-${n}`, name: `Line ${n}`, halfBatches: false, channels: [], roles: [] }]);
  };
  const plateOn = (ch: SalesChannel, id: string) =>
    setLines(lines.map(l => ({ ...l, channels: l.id === id ? Array.from(new Set([...l.channels, ch])) : l.channels.filter(c => c !== ch) })));
  const move = (id: string, dir: -1 | 1) => {
    const i = lines.findIndex(l => l.id === id);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= lines.length) return;
    const next = lines.slice();
    [next[i], next[j]] = [next[j], next[i]];
    setLines(next);
  };

  return (
    <>
      {lines.map((line, i) => (
        <Section
          key={line.id}
          title={line.name || 'Unnamed line'}
          rightSlot={
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <StatusPill tone="neutral" size="xs" label={`Line ${i + 1} of ${lines.length}`} />
              <button type="button" onClick={() => move(line.id, -1)} disabled={i === 0} aria-label={`Move ${line.name} up`} style={{ ...iconBtn, opacity: i === 0 ? 0.4 : 1 }}><ChevronRight size={12} style={{ transform: 'rotate(-90deg)' }} /></button>
              <button type="button" onClick={() => move(line.id, 1)} disabled={i === lines.length - 1} aria-label={`Move ${line.name} down`} style={{ ...iconBtn, opacity: i === lines.length - 1 ? 0.4 : 1 }}><ChevronRight size={12} style={{ transform: 'rotate(90deg)' }} /></button>
              {lines.length > 1 && (
                <button type="button" onClick={() => remove(line.id)} style={linkBtn} aria-label={`Remove ${line.name}`}>Remove line</button>
              )}
            </div>
          }
        >
          <Row label="Name">
            <TextInput value={line.name} onChange={v => patch(line.id, { name: v })} width={260} />
          </Row>
          <Row label="Half batches">
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <Switch checked={line.halfBatches} onChange={v => patch(line.id, { halfBatches: v })} label={`${line.name} half batches`} />
              <span style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>{line.halfBatches ? 'Small containers' : 'Recipe\'s own container'}</span>
            </div>
          </Row>
          <Row label="Plates for">
            <span style={{ fontSize: 12, color: line.channels.length ? 'var(--color-text-secondary)' : 'var(--color-text-muted)' }}>
              {line.channels.length ? line.channels.map(c => CHANNEL_LABELS[c]).join(', ') : 'No channels yet. Pick them below.'}
            </span>
          </Row>
        </Section>
      ))}

      {lines.length < MAX_BENCHES && (
        <button type="button" onClick={add} style={{ ...ghostBtn, alignSelf: 'flex-start', borderStyle: 'dashed', color: 'var(--color-info)' }}>
          + Add a line
        </button>
      )}

      <Section title="Where each channel plates">
        {ALL_CHANNELS.map(ch => (
          <Row key={ch} label={CHANNEL_LABELS[ch]}>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {lines.map(line => (
                <button key={line.id} type="button" onClick={() => plateOn(ch, line.id)} aria-pressed={line.channels.includes(ch)} style={pill(line.channels.includes(ch))}>
                  {line.name || 'Unnamed line'}
                </button>
              ))}
            </div>
          </Row>
        ))}
      </Section>

      <Section title="Shops with their own lines">
        {shopsWithOwnLines.length === 0 ? (
          <span style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>None. Every shop runs the lines above. A GM changes theirs under Settings, Benches.</span>
        ) : (
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {shopsWithOwnLines.map(id => <span key={id} style={chip}>{getShop(id)?.name ?? id}</span>)}
            <span style={{ fontSize: 11, color: 'var(--color-text-muted)', alignSelf: 'center' }}>Publishing leaves these shops on their own lines.</span>
          </div>
        )}
      </Section>
    </>
  );
}

// ─── Benches ─────────────────────────────────────────────────────────────────

/**
 * The kitchen benches every shop starts with: what each is called, the
 * work that lands on it, and the kit it owns. A bench with work is a card
 * on the Sections board under this name; the kit sizes its cook loads.
 * Lines live on their own tab (channels, half batches) but can take work
 * too, so their roles are set here as well.
 */
function BenchesTab({ benches, setBenches, lines, setLines, shopsWithOwnBenches }: {
  benches: BenchDraft[]; setBenches: (next: BenchDraft[]) => void;
  lines: LineDraft[]; setLines: (next: LineDraft[]) => void;
  shopsWithOwnBenches: string[];
}) {
  const patch = (id: string, p: Partial<BenchDraft>) => setBenches(benches.map(b => (b.id === id ? { ...b, ...p } : b)));
  const remove = (id: string) => setBenches(benches.filter(b => b.id !== id));
  const add = () => {
    let n = benches.length + 1;
    while (benches.some(b => b.id === `fj-kitchen-${n}`)) n += 1;
    setBenches([...benches, { id: `fj-kitchen-${n}`, name: `Bench ${n}`, roles: [], kit: [] }]);
  };
  const move = (id: string, dir: -1 | 1) => {
    const i = benches.findIndex(b => b.id === id);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= benches.length) return;
    const next = benches.slice();
    [next[i], next[j]] = [next[j], next[i]];
    setBenches(next);
  };
  // Who takes each role today, across kitchen benches and lines.
  const takers = (role: WorkRole) => [
    ...benches.filter(b => b.roles.includes(role)).map(b => b.name),
    ...lines.filter(l => l.roles.includes(role)).map(l => l.name),
  ];
  // Each kind of work lands on exactly one bench: switching it on here
  // takes it off wherever it was.
  const toggleRole = (id: string, role: WorkRole, isLine: boolean) => {
    const has = (isLine ? lines.find(l => l.id === id)?.roles : benches.find(b => b.id === id)?.roles)?.includes(role) ?? false;
    const next = (roles: WorkRole[], mine: boolean) => (mine ? (has ? roles.filter(r => r !== role) : [...roles, role]) : has ? roles : roles.filter(r => r !== role));
    const nextBenches = benches.map(b => ({ ...b, roles: next(b.roles, !isLine && b.id === id) }));
    const nextLines = lines.map(l => ({ ...l, roles: next(l.roles, isLine && l.id === id) }));
    if (JSON.stringify(nextBenches) !== JSON.stringify(benches)) setBenches(nextBenches);
    if (JSON.stringify(nextLines) !== JSON.stringify(lines)) setLines(nextLines);
  };
  const untaken = FJ_WORK_ROLES.filter(r => takers(r.id).length === 0);

  const rolePills = (id: string, roles: WorkRole[], name: string, isLine: boolean) => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {FJ_WORK_ROLES.map(r => {
          const on = roles.includes(r.id);
          const elsewhere = takers(r.id).filter(n => n !== name);
          return (
            <button key={r.id} type="button" onClick={() => toggleRole(id, r.id, isLine)} aria-pressed={on} style={pill(on)} title={`${r.what}${elsewhere.length ? ` Now on ${elsewhere.join(', ')}; click to move it here.` : ''}`}>
              {r.label}{!on && elsewhere.length > 0 && elsewhere[0] !== r.label && <span style={{ opacity: 0.6, marginLeft: 4, fontSize: 10 }}>· on {elsewhere[0]}</span>}
            </button>
          );
        })}
      </div>
      <span style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>
        {roles.length ? `On the Sections board as “${name || 'Unnamed'}”: ${roles.map(r => FJ_WORK_ROLE_BY_ID[r].what.replace(/\.$/, '').toLowerCase()).join('; ')}.` : 'Takes no work, so it is not on the Sections board.'}
      </span>
    </div>
  );

  return (
    <>
      {untaken.length > 0 && (
        <div role="status" style={{ padding: '10px 14px', borderRadius: 'var(--radius-card)', background: 'var(--color-error-light)', border: '1px solid var(--color-error-border)', color: 'var(--color-error)', fontSize: 12, fontWeight: 600 }}>
          No bench takes {untaken.map(r => r.label.toLowerCase()).join(' or ')} work. The board shows it on a card of its own until a bench takes it.
        </div>
      )}

      {benches.map((b, i) => (
        <Section
          key={b.id}
          title={b.name || 'Unnamed bench'}
          rightSlot={
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <StatusPill tone="neutral" size="xs" label={`Bench ${i + 1} of ${benches.length}`} />
              <button type="button" onClick={() => move(b.id, -1)} disabled={i === 0} aria-label={`Move ${b.name} up`} style={{ ...iconBtn, opacity: i === 0 ? 0.4 : 1 }}><ChevronRight size={12} style={{ transform: 'rotate(-90deg)' }} /></button>
              <button type="button" onClick={() => move(b.id, 1)} disabled={i === benches.length - 1} aria-label={`Move ${b.name} down`} style={{ ...iconBtn, opacity: i === benches.length - 1 ? 0.4 : 1 }}><ChevronRight size={12} style={{ transform: 'rotate(90deg)' }} /></button>
              {benches.length > 1 && <button type="button" onClick={() => remove(b.id)} style={linkBtn} aria-label={`Remove ${b.name}`}>Remove bench</button>}
            </div>
          }
        >
          <Row label="Name">
            <TextInput value={b.name} onChange={v => patch(b.id, { name: v })} width={260} />
          </Row>
          <Row label="Work that lands here">{rolePills(b.id, b.roles, b.name, false)}</Row>
          <Row label="Kit">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <KitEditor kit={b.kit} editing onChange={next => patch(b.id, { kit: next })} />
              <span style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>
                {b.roles.includes('hot')
                  ? 'Ovens hold trays: two ovens of six and a recipe that fills two trays a batch is six batches a load. One rice kit fits a cooker, so two cookers cook two batches at once.'
                  : 'Counted so the board can size loads. A shop\'s GM can count theirs under Settings, Benches.'}
              </span>
            </div>
          </Row>
        </Section>
      ))}

      <button type="button" onClick={add} style={{ ...ghostBtn, alignSelf: 'flex-start', borderStyle: 'dashed', color: 'var(--color-info)' }}>
        + Add a bench
      </button>

      <Section
        title="Lines on the board"
        description="A line plates for the counter or for delivery; it is set up on the Lines tab. A line that also does work (the second make line plates small containers and packs catering) takes that work here and gets a card."
      >
        {lines.map(l => (
          <Row key={l.id} label={l.name || 'Unnamed line'}>{rolePills(l.id, l.roles, l.name, true)}</Row>
        ))}
      </Section>

      <Section title="Shops with their own benches">
        {shopsWithOwnBenches.length === 0 ? (
          <span style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>None. Every shop has the benches above. A GM changes theirs under Settings, Benches.</span>
        ) : (
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {shopsWithOwnBenches.map(id => <span key={id} style={chip}>{getShop(id)?.name ?? id}</span>)}
            <span style={{ fontSize: 11, color: 'var(--color-text-muted)', alignSelf: 'center' }}>Publishing leaves these shops on their own benches.</span>
          </div>
        )}
      </Section>
    </>
  );
}

// ─── Containers ──────────────────────────────────────────────────────────────

function ContainersTab({ draft, setDraft }: TabProps) {
  const ids = Object.keys(CONTAINERS) as ContainerId[];
  return (
    <Section title="Containers" description="What one batch is portioned into on the lines and in the prep kitchen. Names are the kitchen's own; the fill sizes the containers a batch and the counts on the close sheet.">
      <table style={tableStyle}>
        <thead>
          <tr>
            <th style={th}>Name</th>
            <th style={{ ...th, textAlign: 'center' }}>Fill</th>
            <th style={th}>What it is</th>
          </tr>
        </thead>
        <tbody>
          {ids.map(id => {
            const c = draft.containers[id];
            const base = BASELINE.containers[id];
            const unit = id === 'squeezy-bottle' ? 'ml' : 'g';
            return (
              <tr key={id}>
                <td style={td}>
                  <TextInput value={c.name} onChange={v => setDraft(d => ({ ...d, containers: { ...d.containers, [id]: { ...d.containers[id], name: v } } }))} width={220} />
                  {c.name !== base.name && <div style={{ fontSize: 10.5, color: 'var(--color-text-muted)', marginTop: 3 }}>Was {base.name}</div>}
                </td>
                <td style={{ ...td, textAlign: 'center' }}>
                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                    <QtyStepper
                      size="compact"
                      canDecrement={c.fillG > 50}
                      onDecrement={() => setDraft(d => ({ ...d, containers: { ...d.containers, [id]: { ...d.containers[id], fillG: Math.max(50, d.containers[id].fillG - (d.containers[id].fillG >= 1000 ? 100 : 50)) } } }))}
                      onIncrement={() => setDraft(d => ({ ...d, containers: { ...d.containers, [id]: { ...d.containers[id], fillG: d.containers[id].fillG + (d.containers[id].fillG >= 1000 ? 100 : 50) } } }))}
                      decrementLabel={`${c.name} fill down`}
                      incrementLabel={`${c.name} fill up`}
                    >
                      <span style={{ minWidth: 64, textAlign: 'center', fontSize: 12, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{c.fillG.toLocaleString()} {unit}</span>
                    </QtyStepper>
                    {c.fillG !== base.fillG && <span style={{ fontSize: 10.5, color: 'var(--color-text-muted)' }}>was {base.fillG.toLocaleString()} {unit}</span>}
                  </div>
                </td>
                <td style={{ ...td, color: 'var(--color-text-muted)', maxWidth: 420 }}>{CONTAINERS[id].note}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </Section>
  );
}

// ─── Publish log ─────────────────────────────────────────────────────────────

function LogTab({ log, onRevert }: { log: PublishEntry[]; onRevert: (e: PublishEntry) => void }) {
  if (!log.length) return <Section title="Publish log"><div style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>Nothing published yet.</div></Section>;
  const latestLive = log.find(e => !e.revertedAtISO && !e.revertOf);
  const time = (iso: string) => new Date(iso).toLocaleString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
  const shopList = (ids: string[]) => (ids.length === FJ_SHOPS.length ? 'All shops' : ids.map(id => getShop(id)?.name ?? id).join(', '));
  return (
    <Section
      title="Publish log"
      description="Every publish: what changed, who received it, who kept their own, and what it moved downstream. Revert puts the latest one back."
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {log.map((e, i) => {
          const isRevert = Boolean(e.revertOf);
          const reverted = Boolean(e.revertedAtISO);
          return (
            <div key={e.id || i} style={{ padding: '12px 14px', border: '1px solid var(--color-border-subtle)', borderRadius: 'var(--radius-item)', background: i === 0 ? 'var(--color-bg-hover)' : '#fff', opacity: reverted ? 0.7 : 1 }}>
              <div style={{ display: 'flex', gap: 10, alignItems: 'baseline', flexWrap: 'wrap' }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--color-text-primary)' }}>{time(e.atISO)}</span>
                <span style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>
                  {e.by} · {isRevert ? 'reverted a publish' : `${e.shops.length} ${e.shops.length === 1 ? 'shop' : 'shops'}`} · {e.changes.length} change{e.changes.length === 1 ? '' : 's'} · from {new Date(`${e.effectiveFrom}T12:00:00`).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })}
                </span>
                {isRevert && <StatusPill tone="neutral" size="sm" label="Revert" />}
                {reverted && <StatusPill tone="warning" size="sm" label={`Reverted ${new Date(e.revertedAtISO!).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}`} />}
                <span style={{ flex: 1 }} />
                {e === latestLive && e.before && (
                  <button type="button" onClick={() => onRevert(e)} style={ghostBtn}><RotateCcw size={11} /> Revert</button>
                )}
              </div>
              <table style={{ ...tableStyle, marginTop: 8 }}>
                <tbody>
                  {e.changes.map((c, j) => (
                    <tr key={j}>
                      <td style={{ ...td, fontWeight: 600, color: 'var(--color-text-primary)', padding: '4px 8px 4px 0' }}>{c.field}</td>
                      <td style={{ ...td, color: 'var(--color-text-muted)', padding: '4px 8px' }}>{c.from}</td>
                      <td style={{ ...td, width: 20, color: 'var(--color-text-muted)', padding: '4px 8px' }}>→</td>
                      <td style={{ ...td, fontWeight: 700, color: 'var(--color-text-primary)', padding: '4px 8px' }}>{c.to}</td>
                      <td style={{ ...td, textAlign: 'right', color: 'var(--color-text-muted)', padding: '4px 0 4px 8px' }}>{c.shops.length ? shopList(c.shops) : ''}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '8px 20px', marginTop: 10, fontSize: 12, color: 'var(--color-text-secondary)', lineHeight: 1.5 }}>
                {!isRevert && (
                  <div>
                    <div style={eyebrow}>Received</div>
                    {shopList(e.shops)}
                  </div>
                )}
                {e.kept.length > 0 && (
                  <div>
                    <div style={eyebrow}>Kept their own</div>
                    {e.kept.map((k, j) => <div key={j}>{getShop(k.shopId)?.name ?? k.shopId} keeps {k.what}</div>)}
                  </div>
                )}
                {!isRevert && (
                  <div>
                    <div style={eyebrow}>Downstream</div>
                    {e.downstream.length ? e.downstream.map((d, j) => <div key={j}>{d}</div>) : <span style={{ color: 'var(--color-text-muted)' }}>Working it out…</span>}
                  </div>
                )}
                {e.flagged.length > 0 && (
                  <div>
                    <div style={eyebrow}>Approved days flagged</div>
                    {e.flagged.map((f, j) => <div key={j}>{getShop(f.shopId)?.name ?? f.shopId} · {new Date(`${f.date}T12:00:00`).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric' })}</div>)}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </Section>
  );
}

// ─── Publish preview ─────────────────────────────────────────────────────────

function PublishPreview({ changes, onClose, onConfirm }: { changes: SettingsChange[]; onClose: () => void; onConfirm: () => void }) {
  const shops = shopsTouched(changes);
  const byShop = FJ_SHOPS.filter(s => shops.includes(s.id)).map(s => ({ shop: s, fields: changes.filter(c => c.shops.includes(s.id)).map(c => c.field) }));
  return createPortal(
    <div role="dialog" aria-modal="true" aria-labelledby="fj-publish-title" style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,28,53,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{ width: 'min(680px, 100%)', maxHeight: '85vh', background: '#fff', borderRadius: 'var(--radius-card)', boxShadow: '0 24px 64px rgba(0,28,53,0.25)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--color-border-subtle)', display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ flex: 1 }}>
            <div id="fj-publish-title" style={{ fontSize: 15, fontWeight: 700, color: 'var(--color-text-primary)' }}>Publish to {shops.length} {shops.length === 1 ? 'shop' : 'shops'}</div>
            <div style={{ fontSize: 12, color: 'var(--color-text-muted)', marginTop: 2 }}>{changes.length} change{changes.length === 1 ? '' : 's'}</div>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" style={iconBtn}><X size={16} /></button>
        </div>
        <div style={{ padding: '14px 20px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <div style={eyebrow}>Changes</div>
            <table style={tableStyle}>
              <tbody>
                {changes.map((c, i) => (
                  <tr key={i}>
                    <td style={{ ...td, fontWeight: 600, color: 'var(--color-text-primary)' }}>{c.field}</td>
                    <td style={{ ...td, color: 'var(--color-text-muted)' }}>{c.from}</td>
                    <td style={{ ...td, width: 20, color: 'var(--color-text-muted)' }}>→</td>
                    <td style={{ ...td, fontWeight: 700, color: 'var(--color-text-primary)' }}>{c.to}</td>
                    <td style={{ ...td, textAlign: 'right', color: 'var(--color-text-muted)' }}>{c.shops.length === FJ_SHOPS.length ? 'All shops' : c.shops.map(s => getShop(s)?.name ?? s).join(', ')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div>
            <div style={eyebrow}>Shops</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(190px, 1fr))', gap: 6 }}>
              {byShop.map(({ shop, fields }) => (
                <div key={shop.id} style={{ padding: '8px 10px', border: '1px solid var(--color-border-subtle)', borderRadius: 'var(--radius-item)', fontSize: 12 }}>
                  <div style={{ fontWeight: 700, color: 'var(--color-text-primary)' }}>{shop.name}</div>
                  <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 2 }}>{fields.length} field{fields.length === 1 ? '' : 's'}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
        <div style={{ padding: '12px 20px', borderTop: '1px solid var(--color-border-subtle)', display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button type="button" onClick={onClose} style={ghostBtn}>Back</button>
          <button type="button" onClick={onConfirm} style={primaryBtn}><CheckCircle2 size={12} /> Publish</button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

// ─── Small parts ─────────────────────────────────────────────────────────────

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 200px) minmax(0, 1fr)', gap: 12, alignItems: 'center' }}>
      <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--color-text-primary)' }}>{label}</span>
      <div>{children}</div>
    </div>
  );
}

function Switch({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      style={{ width: 38, height: 22, borderRadius: 999, border: 'none', padding: 2, cursor: 'pointer', background: checked ? 'var(--color-accent-active)' : 'var(--color-border)', position: 'relative', transition: 'background 0.15s' }}
    >
      <span style={{ display: 'block', width: 18, height: 18, borderRadius: 999, background: '#fff', transform: `translateX(${checked ? 16 : 0}px)`, transition: 'transform 0.15s', boxShadow: '0 1px 3px rgba(0,0,0,0.25)' }} />
    </button>
  );
}

const tabStyle = (active: boolean): CSSProperties => ({
  padding: '8px 16px', borderRadius: 999, border: 'none', fontSize: 12, fontWeight: 600, fontFamily: 'var(--font-primary)', cursor: 'pointer',
  background: active ? 'var(--color-accent-active)' : 'transparent', color: active ? '#fff' : 'var(--color-text-muted)', whiteSpace: 'nowrap',
});
const pill = (active: boolean): CSSProperties => ({
  padding: '7px 12px', borderRadius: 999, fontSize: 11, fontWeight: 700, fontFamily: 'var(--font-primary)', cursor: 'pointer',
  background: active ? 'var(--color-accent-active)' : '#fff', color: active ? 'var(--color-text-on-active)' : 'var(--color-text-secondary)',
  border: `1px solid ${active ? 'var(--color-accent-active)' : 'var(--color-border)'}`, minHeight: 32,
});
const tableStyle: CSSProperties = { width: '100%', borderCollapse: 'collapse', fontSize: 12, fontFamily: 'var(--font-primary)' };
const th: CSSProperties = { textAlign: 'left', fontSize: 10, fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', color: 'var(--color-text-muted)', padding: '6px 8px', borderBottom: '1px solid var(--color-border-subtle)' };
const td: CSSProperties = { padding: '8px', borderBottom: '1px solid var(--color-border-subtle)', color: 'var(--color-text-secondary)', verticalAlign: 'middle' };
const groupTd: CSSProperties = { padding: '10px 8px 4px', fontSize: 10, fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', color: 'var(--color-text-muted)' };
const chip: CSSProperties = { display: 'inline-flex', alignItems: 'center', padding: '5px 10px', borderRadius: 999, border: '1px solid var(--color-border)', fontSize: 11, color: 'var(--color-text-secondary)', background: '#fff' };
const eyebrow: CSSProperties = { fontSize: 10, fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', color: 'var(--color-text-muted)', marginBottom: 6 };
const selectStyle: CSSProperties = { fontSize: 12, fontFamily: 'var(--font-primary)', padding: '6px 8px', borderRadius: 8, border: '1px solid var(--color-border)', background: '#fff', color: 'var(--color-text-primary)' };
const iconBtn: CSSProperties = { background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-muted)', padding: 4, display: 'inline-flex', borderRadius: 6 };
const linkBtn: CSSProperties = { background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-info)', fontSize: 11, fontWeight: 600, fontFamily: 'var(--font-primary)', padding: 0 };
const ghostBtn: CSSProperties = { padding: '8px 12px', borderRadius: 8, fontSize: 11, fontWeight: 700, fontFamily: 'var(--font-primary)', background: '#fff', color: 'var(--color-text-secondary)', border: '1px solid var(--color-border)', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6 };
const primaryBtn: CSSProperties = { ...ghostBtn, background: 'var(--color-accent-active)', color: 'var(--color-text-on-active)', border: '1px solid var(--color-accent-active)', padding: '8px 14px' };
