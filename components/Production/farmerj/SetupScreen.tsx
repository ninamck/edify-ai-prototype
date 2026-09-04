'use client';

import { useEffect, useMemo, useState } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { CheckCircle2, ChevronDown, ChevronRight, ExternalLink, RotateCcw, Search, X } from 'lucide-react';
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
import { FJ_BENCH_TEMPLATES, FJ_DAYS_OF_WEEK, FJ_DEFAULT_WINDOWS, FJ_WORK_ROLES, FJ_WORK_ROLE_BY_ID, dayToWeekday, isFjLine } from './fjFixtures';
import { ALL_CHANNELS } from './lines';
import { EQUIPMENT_CAPACITY_UNIT, EQUIPMENT_LABELS, type BenchKitItem, type Equipment } from '../fixtures';
import { KitEditor } from '@/components/Settings/tabs/BenchesTab';
import { describeMethod, METHOD_FIELDS, RECIPE_CLASSES, RECIPE_CLASS_BY_ID, resolveEquipment, type RecipeClassId, type RecipeMethod } from '@/components/Recipe/recipeClasses';

/**
 * Setup: the rules Jana owns, set once and published to every shop.
 * Built on the settings chassis (Section cards, pill pickers, sticky save
 * bar, success banner) with a publish preview in front of the save.
 */

type Tab = 'recipes' | 'days' | 'kitchen' | 'log';
const TABS: { id: Tab; label: string }[] = [
  { id: 'recipes', label: 'Recipes' },
  { id: 'days', label: 'Make-on days' },
  { id: 'kitchen', label: 'Kitchen' },
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

  // The kitchen (lines and benches) is the company's bench list in the
  // site settings store. Drafts are held here until publish, like recipe edits.
  const siteStore = useSiteSettingsStore();
  const companyStations = useMemo(() => siteStore.effectiveFor(FJ_ALL_SHOPS_ID).benches.map(toStationDraft), [siteStore]);
  const [stationsDraft, setStationsDraft] = useState<StationDraft[] | null>(null);
  const stations = stationsDraft ?? companyStations;
  // A shop has its own kitchen when it changed, added or reordered any station.
  const shopsWithOwnKitchen = useMemo(
    () => FJ_SHOPS.filter(s => {
      const o = siteStore.overlayFor(s.id);
      return Boolean(o?.benchOrder || (o?.addedBenches && Object.keys(o.addedBenches).length) || Object.values(o?.benches ?? {}).some(b => Object.keys(b).length > 0));
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

  const kitchenChanges = useMemo(() => (stationsDraft ? diffStations(companyStations, stationsDraft, FJ_SHOPS.map(s => s.id).filter(id => !shopsWithOwnKitchen.includes(id))) : []), [companyStations, stationsDraft, shopsWithOwnKitchen]);

  const changes = useMemo(() => [...recipeChanges, ...dayChanges, ...kitchenChanges, ...diffSettings(published, draft)], [recipeChanges, dayChanges, kitchenChanges, published, draft]);

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
    if (kitchenChanges.length) for (const shop of shopsWithOwnKitchen) kept.push({ shopId: shop, what: 'its own kitchen' });

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
    if (stationsDraft || daysDraft) {
      let company = siteStore.overlayFor(FJ_ALL_SHOPS_ID);
      if (stationsDraft) company = stationsToOverlay(stations, company);
      if (daysDraft) {
        company = withCompanyDays(company, daysDraft.company);
        for (const s of FJ_SHOPS) {
          if (JSON.stringify(shopDays[s.id] ?? {}) === JSON.stringify(daysDraft.shops[s.id] ?? {})) continue;
          siteStore.replace(s.id, withShopDays(siteStore.overlayFor(s.id), daysDraft.shops[s.id] ?? {}));
        }
      }
      siteStore.replace(FJ_ALL_SHOPS_ID, company);
      setStationsDraft(null);
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
    setStationsDraft(null);
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
          {tab === 'kitchen' && <KitchenTab stations={stations} setStations={next => setStationsDraft(next)} shopsWithOwnKitchen={shopsWithOwnKitchen} />}
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

/** What this recipe sets for itself rather than taking from its class. Method is left out: nearly every recipe carries its own, so the Method column shows it instead. */
function ownSettings(f: FjProductionFields): string[] {
  return f.equipment !== null ? ['kit'] : [];
}

/** The method without its hand tools, short enough for a table cell. */
function methodShort(f: FjProductionFields): string {
  const m = methodOf(f);
  const s = describeMethod({ ...m, handTools: [] });
  return s === 'nothing set' ? '' : s;
}

const CONTAINER_IDS = Object.keys(CONTAINERS) as ContainerId[];

/**
 * The recipe book's production settings in one table, so Jana can compare
 * forty recipes at a glance. The table is read-only text; a row opens into
 * an editor when clicked, one at a time. Defaults that rarely change
 * (method by class, containers, portion sizes) fold away underneath.
 */
function RecipesTab({ recipes, draft, setField, reset, settings, setSettings }: { recipes: Recipe[]; draft: RecipeDraft; setField: (id: string, patch: Partial<FjProductionFields>) => void; reset: (id: string) => void; settings: SettingsValues; setSettings: TabProps['setDraft'] }) {
  const [open, setOpen] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'own' | 'unpublished'>('all');
  const [q, setQ] = useState('');

  const components = recipes
    .map(r => ({ r, ref: bookRef(r.id), f: fieldsWithDraft(r, draft) }))
    .filter(x => x.ref?.kind === 'component')
    .map(x => {
      const authored = AUTHORED_FIELDS[x.r.id];
      return { ...x, own: ownSettings(x.f), changed: authored ? !sameFields(x.f, authored) : false };
    });
  const products = recipes
    .map(r => ({ r, ref: bookRef(r.id), f: fieldsWithDraft(r, draft) }))
    .filter(x => x.ref?.kind === 'product')
    .map(x => {
      const authored = AUTHORED_FIELDS[x.r.id];
      return { ...x, own: [] as string[], changed: authored ? !sameFields(x.f, authored) : false };
    });
  const all = [...components, ...products];
  const ownCount = all.filter(x => x.own.length).length;
  const changedCount = all.filter(x => x.changed).length;
  const needle = q.trim().toLowerCase();
  const show = (x: { r: Recipe; own: string[]; changed: boolean }) =>
    (filter === 'all' || (filter === 'own' && x.own.length > 0) || (filter === 'unpublished' && x.changed)) && (!needle || x.r.name.toLowerCase().includes(needle));
  const toggle = (id: string) => setOpen(o => (o === id ? null : id));

  const marker = (x: { own: string[]; changed: boolean }) => (
    <span style={{ display: 'inline-flex', gap: 4, alignItems: 'center', marginLeft: 6, verticalAlign: 'middle' }}>
      {x.changed && <span title="Changed here, not yet published" style={{ width: 7, height: 7, borderRadius: 999, background: 'var(--color-warning)', display: 'inline-block' }} />}
      {x.own.length > 0 && <span style={{ fontSize: 10, color: 'var(--color-text-muted)' }}>own kit</span>}
    </span>
  );
  const cell = (isOpen: boolean, extra?: CSSProperties): CSSProperties => ({ ...td, ...(isOpen ? openTd : {}), ...(extra ?? {}) });

  return (
    <>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <div role="group" aria-label="Show" style={{ display: 'flex', gap: 4 }}>
          <button type="button" onClick={() => setFilter('all')} aria-pressed={filter === 'all'} style={pill(filter === 'all')}>All {all.length}</button>
          <button type="button" onClick={() => setFilter('own')} aria-pressed={filter === 'own'} style={pill(filter === 'own')}>Own kit {ownCount}</button>
          {changedCount > 0 && <button type="button" onClick={() => setFilter('unpublished')} aria-pressed={filter === 'unpublished'} style={pill(filter === 'unpublished')}>Unpublished {changedCount}</button>}
        </div>
        <div style={{ flex: 1 }} />
        <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '0 10px', border: '1px solid var(--color-border)', borderRadius: 999, background: '#fff', minHeight: 32 }}>
          <Search size={12} color="var(--color-text-muted)" />
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="Find a recipe" aria-label="Find a recipe" style={{ border: 'none', outline: 'none', fontSize: 12, fontFamily: 'var(--font-primary)', width: 160, background: 'transparent' }} />
        </label>
      </div>

      <Section
        title="Components"
        description="Click a row to change it. Kit and method come from the recipe class unless a recipe sets its own; the class is what cook loads are sized from at each shop."
      >
        <table style={tableStyle}>
          <thead>
            <tr>
              <th style={th}>Component</th>
              <th style={th}>Class</th>
              <th style={th}>Kit</th>
              <th style={th}>Container</th>
              <th style={th}>Shelf life</th>
              <th style={{ ...th, textAlign: 'right' }}>Yield loss</th>
              <th style={{ ...th, textAlign: 'center' }}>Half</th>
              <th style={th}>Method</th>
              <th style={th} />
            </tr>
          </thead>
          <tbody>
            {CLASS_ORDER.map(cls => {
              const rows = components.filter(x => x.f.recipeClass === cls && show(x)).sort((a, b) => a.r.name.localeCompare(b.r.name));
              if (!rows.length) return null;
              return [
                <tr key={`h-${cls}`}><td colSpan={9} style={groupTd}>{CLASS_GROUP_LABELS[cls]} · {rows.length}</td></tr>,
                ...rows.map(({ r, ref, f, own, changed }) => {
                  const c = ref!.kind === 'component' ? ref!.component : null;
                  if (!c) return null;
                  const isOpen = open === r.id;
                  const kitEq = resolveEquipment(f.recipeClass, f.equipment);
                  const kitValue = f.equipment === null ? '' : f.equipment.length === 0 ? 'none' : f.equipment[0];
                  const method = methodShort(f);
                  return [
                    <tr key={r.id} onClick={() => toggle(r.id)} style={{ cursor: 'pointer', background: isOpen ? 'var(--color-bg-hover)' : undefined }} aria-expanded={isOpen}>
                      <td style={cell(isOpen)}>
                        <span style={{ fontWeight: 600, color: 'var(--color-text-primary)' }}>{r.name}</span>{marker({ own, changed })}
                        <div style={{ fontSize: 10.5, color: 'var(--color-text-muted)', marginTop: 2 }}>{kg(c.batch.fullG)}{c.batch.label ? `, ${c.batch.label}` : ''}</div>
                      </td>
                      <td style={cell(isOpen)}>{classLabel(f.recipeClass)}</td>
                      <td style={cell(isOpen, { color: f.equipment === null ? 'var(--color-text-muted)' : 'var(--color-text-primary)' })}>{kitEq.length ? kitEq.map(e => EQUIPMENT_LABELS[e]).join(', ') : 'None'}</td>
                      <td style={cell(isOpen)}>{f.outputContainer ? `${CONTAINERS[f.outputContainer].name}${Number(f.containersPerBatch || 1) > 1 ? ` × ${f.containersPerBatch}` : ''}` : '—'}</td>
                      <td style={cell(isOpen)}>{groupLabel(f.shelfLifeGroup)}</td>
                      <td style={cell(isOpen, { textAlign: 'right', fontVariantNumeric: 'tabular-nums' })}>{f.yieldLossPct}%</td>
                      <td style={cell(isOpen, { textAlign: 'center', color: f.halfBatch ? 'var(--color-text-primary)' : 'var(--color-text-muted)' })}>{f.halfBatch ? 'Yes' : '—'}</td>
                      <td style={cell(isOpen, { color: Object.keys(f.method).length ? 'var(--color-text-primary)' : 'var(--color-text-muted)', maxWidth: 220 })}>{method || '—'}</td>
                      <td style={cell(isOpen, { textAlign: 'right', whiteSpace: 'nowrap' })} onClick={e => e.stopPropagation()}>
                        {changed && <button type="button" onClick={() => reset(r.id)} title="Back to the recipe book" aria-label={`${r.name} back to the recipe book`} style={iconBtn}><RotateCcw size={12} /></button>}
                        <Link href={`/recipes/${encodeURIComponent(r.id)}/edit`} title="Open recipe" aria-label={`Open ${r.name}`} style={iconBtn}><ExternalLink size={12} /></Link>
                        <button type="button" onClick={() => toggle(r.id)} aria-label={isOpen ? `Close ${r.name}` : `Edit ${r.name}`} style={iconBtn}>{isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}</button>
                      </td>
                    </tr>,
                    isOpen && (
                      <tr key={`${r.id}-edit`}>
                        <td colSpan={9} style={{ padding: '12px 12px 16px', background: 'var(--color-bg-hover)', borderBottom: '1px solid var(--color-border-subtle)' }}>
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 14 }}>
                            <Field label="Class">
                              <select value={f.recipeClass} onChange={e => setField(r.id, { recipeClass: e.target.value as RecipeClassId })} aria-label={`${r.name} recipe class`} style={selectStyle}>
                                {RECIPE_CLASSES.filter(k => k.id !== 'finished').map(k => <option key={k.id} value={k.id}>{k.label}</option>)}
                              </select>
                            </Field>
                            <Field label="Kit" hint={f.equipment === null ? 'From the class' : 'Set on this recipe'}>
                              <select value={kitValue} onChange={e => { const v = e.target.value; setField(r.id, { equipment: v === '' ? null : v === 'none' ? [] : [v as Equipment] }); }} aria-label={`${r.name} kit`} style={selectStyle}>
                                <option value="">Class default{RECIPE_CLASS_BY_ID[cls].defaultEquipment.length ? ` (${RECIPE_CLASS_BY_ID[cls].defaultEquipment.map(e => EQUIPMENT_LABELS[e].toLowerCase()).join(', ')})` : ' (none)'}</option>
                                <option value="none">None</option>
                                {KIT_OPTIONS.map(e => <option key={e} value={e}>{EQUIPMENT_LABELS[e]}</option>)}
                              </select>
                            </Field>
                            <Field label="Container" wide>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                                <select value={f.outputContainer} onChange={e => setField(r.id, { outputContainer: e.target.value as ContainerId | '' })} aria-label={`${r.name} container`} style={selectStyle}>
                                  <option value="">None</option>
                                  {CONTAINER_IDS.map(id => <option key={id} value={id}>{CONTAINERS[id].name}</option>)}
                                </select>
                                {f.outputContainer && (
                                  <QtyStepper size="compact" canDecrement={Number(f.containersPerBatch || 0) > 1}
                                    onDecrement={() => setField(r.id, { containersPerBatch: Math.max(1, Number(f.containersPerBatch || 1) - 1) })}
                                    onIncrement={() => setField(r.id, { containersPerBatch: Number(f.containersPerBatch || 0) + 1 })}
                                    decrementLabel={`${r.name} containers per batch down`} incrementLabel={`${r.name} containers per batch up`}>
                                    <span style={{ minWidth: 26, textAlign: 'center', fontSize: 12, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>× {f.containersPerBatch || 1}</span>
                                  </QtyStepper>
                                )}
                              </div>
                            </Field>
                            <Field label="Shelf life">
                              <select value={f.shelfLifeGroup} onChange={e => setField(r.id, { shelfLifeGroup: e.target.value as ShelfLifeGroupId })} aria-label={`${r.name} shelf life`} style={selectStyle}>
                                {GROUPS.map(g => <option key={g.id} value={g.id}>{g.label}</option>)}
                              </select>
                            </Field>
                            <Field label="Yield loss" hint={c.yieldNote}>
                              <QtyStepper size="compact" canDecrement={f.yieldLossPct > 0} canIncrement={f.yieldLossPct < 90}
                                onDecrement={() => setField(r.id, { yieldLossPct: Math.max(0, f.yieldLossPct - 1) })}
                                onIncrement={() => setField(r.id, { yieldLossPct: Math.min(90, f.yieldLossPct + 1) })}
                                decrementLabel={`${r.name} yield loss down`} incrementLabel={`${r.name} yield loss up`}>
                                <span style={{ minWidth: 34, textAlign: 'center', fontSize: 12, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{f.yieldLossPct}%</span>
                              </QtyStepper>
                            </Field>
                            <Field label="Half batches" hint={f.halfBatch ? `Half is ${kg(c.batch.halfG ?? c.batch.fullG / 2)}` : 'Full batches only'}>
                              <Switch checked={f.halfBatch} onChange={v => setField(r.id, { halfBatch: v })} label={`${r.name} half batches`} />
                            </Field>
                            <Field label="Method" hint={Object.keys(f.method).length ? 'Set on this recipe' : `From the ${classLabel(f.recipeClass).toLowerCase()} default`}>
                              <div style={{ fontSize: 12, color: 'var(--color-text-secondary)', display: 'flex', flexDirection: 'column', gap: 4 }}>
                                <span>{method || 'Nothing set'}</span>
                                <Link href={`/recipes/${encodeURIComponent(r.id)}/edit`} style={{ ...linkBtn, textDecoration: 'none' }}>Edit on the recipe</Link>
                              </div>
                            </Field>
                          </div>
                        </td>
                      </tr>
                    ),
                  ];
                }),
              ];
            })}
          </tbody>
        </table>
      </Section>

      <Section title="Finished products" description="What the main line serves from. Click a row to change it.">
        <table style={tableStyle}>
          <thead>
            <tr>
              <th style={th}>Product</th>
              <th style={th}>Group</th>
              <th style={th}>Main-line unit</th>
              <th style={{ ...th, textAlign: 'right' }}>Per unit</th>
              <th style={{ ...th, textAlign: 'right' }}>Units a batch</th>
              <th style={{ ...th, textAlign: 'right' }}>Batch</th>
              <th style={{ ...th, textAlign: 'center' }}>Half</th>
              <th style={th} />
            </tr>
          </thead>
          <tbody>
            {products.filter(show).map(({ r, ref, f, own, changed }) => {
              if (ref?.kind !== 'product') return null;
              const p = ref.product;
              const isOpen = open === r.id;
              const unitsPerBatch = Number(f.containersPerBatch || p.unitsPerBatch);
              return [
                <tr key={r.id} onClick={() => toggle(r.id)} style={{ cursor: 'pointer', background: isOpen ? 'var(--color-bg-hover)' : undefined }} aria-expanded={isOpen}>
                  <td style={cell(isOpen)}><span style={{ fontWeight: 600, color: 'var(--color-text-primary)' }}>{r.name}</span>{marker({ own, changed })}</td>
                  <td style={cell(isOpen)}>{PRODUCT_GROUP_LABELS[p.group]}</td>
                  <td style={cell(isOpen)}>{f.outputContainer ? CONTAINERS[f.outputContainer].name : '—'}</td>
                  <td style={cell(isOpen, { textAlign: 'right' })}>{kg(Math.round((p.batch.fullG * (1 - f.yieldLossPct / 100)) / unitsPerBatch))}</td>
                  <td style={cell(isOpen, { textAlign: 'right', fontVariantNumeric: 'tabular-nums' })}>{unitsPerBatch}</td>
                  <td style={cell(isOpen, { textAlign: 'right' })}>{kg(p.batch.fullG)}</td>
                  <td style={cell(isOpen, { textAlign: 'center', color: f.halfBatch ? 'var(--color-text-primary)' : 'var(--color-text-muted)' })}>{f.halfBatch ? 'Yes' : '—'}</td>
                  <td style={cell(isOpen, { textAlign: 'right', whiteSpace: 'nowrap' })} onClick={e => e.stopPropagation()}>
                    {changed && <button type="button" onClick={() => reset(r.id)} title="Back to the recipe book" aria-label={`${r.name} back to the recipe book`} style={iconBtn}><RotateCcw size={12} /></button>}
                    <Link href={`/recipes/${encodeURIComponent(r.id)}/edit`} title="Open recipe" aria-label={`Open ${r.name}`} style={iconBtn}><ExternalLink size={12} /></Link>
                    <button type="button" onClick={() => toggle(r.id)} aria-label={isOpen ? `Close ${r.name}` : `Edit ${r.name}`} style={iconBtn}>{isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}</button>
                  </td>
                </tr>,
                isOpen && (
                  <tr key={`${r.id}-edit`}>
                    <td colSpan={8} style={{ padding: '12px 12px 16px', background: 'var(--color-bg-hover)', borderBottom: '1px solid var(--color-border-subtle)' }}>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 14 }}>
                        <Field label="Main-line unit">
                          <select value={f.outputContainer} onChange={e => setField(r.id, { outputContainer: e.target.value as ContainerId })} aria-label={`${r.name} main-line unit`} style={selectStyle}>
                            {CONTAINER_IDS.map(id => <option key={id} value={id}>{CONTAINERS[id].name}</option>)}
                          </select>
                        </Field>
                        <Field label="Units a batch" hint={`${kg(p.batch.fullG)} a batch`}>
                          <QtyStepper size="compact" canDecrement={unitsPerBatch > 1}
                            onDecrement={() => setField(r.id, { containersPerBatch: Math.max(1, unitsPerBatch - 1) })}
                            onIncrement={() => setField(r.id, { containersPerBatch: unitsPerBatch + 1 })}
                            decrementLabel={`${r.name} units per batch down`} incrementLabel={`${r.name} units per batch up`}>
                            <span style={{ minWidth: 26, textAlign: 'center', fontSize: 12, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{unitsPerBatch}</span>
                          </QtyStepper>
                        </Field>
                        <Field label="Half batches">
                          <Switch checked={f.halfBatch} onChange={v => setField(r.id, { halfBatch: v })} label={`${r.name} half batches`} />
                        </Field>
                      </div>
                    </td>
                  </tr>
                ),
              ];
            })}
          </tbody>
        </table>
      </Section>

      <Fold title="Method defaults by class" summary="What the stepper says unless a recipe sets its own">
        <MethodDefaultsSection recipes={components.map(x => x.r)} draft={draft} settings={settings} setSettings={setSettings} />
      </Fold>
      <Fold title="Containers" summary={`${CONTAINER_IDS.length} containers a batch is portioned into`}>
        <ContainersSection draft={settings} setDraft={setSettings} />
      </Fold>
      <Fold title="Portion sizes" summary="Grams a portion the demand model plans from">
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {Object.entries(PORTION_GRAMS).map(([k, g]) => (
            <span key={k} style={chip}>{PORTION_LABELS[k as keyof typeof PORTION_GRAMS]} <strong style={{ marginLeft: 4 }}>{g} g</strong></span>
          ))}
        </div>
      </Fold>
    </>
  );
}

function Field({ label, hint, wide, children }: { label: string; hint?: string; wide?: boolean; children: ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 5, minWidth: 0, gridColumn: wide ? 'span 2' : undefined }}>
      <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', color: 'var(--color-text-muted)' }}>{label}</span>
      <div>{children}</div>
      {hint && <span style={{ fontSize: 10.5, color: 'var(--color-text-muted)' }}>{hint}</span>}
    </div>
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
    <>
      <p style={{ margin: 0, fontSize: 11, color: 'var(--color-text-muted)' }}>
        The programme, cook time, core temperature to probe to, rest, how long it may hold on the line, and the hand tools to get out. Change a default and every recipe still inheriting it follows. 0 means none.
      </p>
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
    </>
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

// ─── Kitchen ─────────────────────────────────────────────────────────────────

/**
 * A station is one entry in the shop's bench list: a line (plates for
 * sales channels, may run half batches) or a bench (cooks or preps). Either
 * can take kinds of work, which puts it on the Sections board, and either
 * can own kit, which sizes cook loads.
 */
type StationDraft = { id: string; name: string; isLine: boolean; channels: SalesChannel[]; halfBatches: boolean; roles: WorkRole[]; kit: BenchKitItem[] };

const isChannel = (c: string): c is SalesChannel => (ALL_CHANNELS as string[]).includes(c);
const isRole = (r: string): r is WorkRole => r in FJ_WORK_ROLE_BY_ID;

function toStationDraft(b: EffectiveBench): StationDraft {
  return {
    id: b.id, name: b.name, isLine: isFjLine(b),
    channels: (b.channels ?? []).filter(isChannel), halfBatches: Boolean(b.halfBatches),
    roles: (b.sections ?? []).filter(isRole), kit: (b.kit ?? []).map(k => ({ ...k })),
  };
}

const sameKit = (a: BenchKitItem[] | undefined, b: BenchKitItem[] | undefined) => JSON.stringify(a ?? []) === JSON.stringify(b ?? []);
const sameList = (a: string[] | undefined, b: string[] | undefined) => [...(a ?? [])].sort().join() === [...(b ?? [])].sort().join();

/**
 * Write the drafted stations back as the company (`fj-all-shops`) overlay,
 * keeping its other settings. Each is diffed against its template so a
 * shop's own overlay still wins where it differs; one without a template
 * is stored whole as an added bench.
 */
function stationsToOverlay(stations: StationDraft[], current: SiteSettingsOverlay | undefined): SiteSettingsOverlay {
  const benches: NonNullable<SiteSettingsOverlay['benches']> = {};
  const addedBenches: NonNullable<SiteSettingsOverlay['addedBenches']> = {};
  for (const st of stations) {
    const template = FJ_BENCH_TEMPLATES.find(t => t.id === st.id);
    if (template) {
      const patch: BenchOverlay = { ...(current?.benches?.[st.id] ?? {}) };
      if (st.name === template.name) delete patch.name; else patch.name = st.name;
      if (sameList(st.roles, template.sections)) delete patch.sections; else patch.sections = st.roles;
      if (sameKit(st.kit, template.kit)) delete patch.kit; else patch.kit = st.kit;
      if (st.isLine) {
        if (st.halfBatches === Boolean(template.halfBatches)) delete patch.halfBatches; else patch.halfBatches = st.halfBatches;
        if (st.channels.join() === (template.channels ?? []).join()) delete patch.channels; else patch.channels = st.channels;
      }
      if (Object.keys(patch).length) benches[st.id] = patch;
    } else {
      const added = current?.addedBenches?.[st.id];
      addedBenches[st.id] = st.isLine
        ? {
          id: st.id, siteId: FJ_ALL_SHOPS_ID, capabilities: ['assemble'], workTypes: ['assemble', 'portion'], equipment: ['prep-table'], online: true, primaryMode: 'variable',
          ...(added ?? {}), name: st.name, halfBatches: st.halfBatches, channels: st.channels, sections: st.roles, kit: st.kit,
        }
        : {
          id: st.id, siteId: FJ_ALL_SHOPS_ID, capabilities: ['prep'], workTypes: ['mix', 'portion'], online: true, primaryMode: 'variable',
          ...(added ?? {}), name: st.name, sections: st.roles, kit: st.kit,
          equipment: Array.from(new Set([...(added?.equipment ?? ['prep-table']), ...st.kit.map(k => k.equipment)])),
        };
    }
  }
  const next: SiteSettingsOverlay = { ...(current ?? {}) };
  delete next.benches; delete next.benchOrder; delete next.addedBenches;
  if (Object.keys(benches).length) next.benches = benches;
  if (Object.keys(addedBenches).length) next.addedBenches = addedBenches;
  const order = stations.map(st => st.id);
  if (order.join() !== FJ_BENCH_TEMPLATES.map(t => t.id).join()) next.benchOrder = order;
  return next;
}

function kitLabel(k: BenchKitItem): string {
  const unit = EQUIPMENT_CAPACITY_UNIT[k.equipment];
  return `${k.count}${k.capacity && unit ? ` of ${k.capacity} ${unit}` : ''}`;
}
const kitSummary = (kit: BenchKitItem[]) => kit.map(k => `${k.count} ${EQUIPMENT_LABELS[k.equipment].toLowerCase()}${k.count === 1 ? '' : 's'}${k.capacity && EQUIPMENT_CAPACITY_UNIT[k.equipment] ? ` of ${k.capacity}` : ''}`).join(', ');
const rolesText = (roles: WorkRole[]) => (roles.length ? roles.map(r => FJ_WORK_ROLE_BY_ID[r].label.toLowerCase()).join(', ') : 'nothing');
const channelsText = (channels: SalesChannel[]) => (channels.length ? channels.map(c => CHANNEL_LABELS[c]).join(', ') : 'nothing');

function diffStations(from: StationDraft[], to: StationDraft[], shops: string[]): SettingsChange[] {
  const out: SettingsChange[] = [];
  const before = new Map(from.map(b => [b.id, b]));
  const after = new Map(to.map(b => [b.id, b]));
  for (const st of to) {
    const prev = before.get(st.id);
    const kind = st.isLine ? 'Line' : 'Bench';
    if (!prev) { out.push({ field: `${kind} added`, from: '—', to: st.name, shops }); continue; }
    if (prev.name !== st.name) out.push({ field: `${kind} name`, from: prev.name, to: st.name, shops });
    if (st.isLine && prev.channels.join() !== st.channels.join()) out.push({ field: `${st.name} plates for`, from: channelsText(prev.channels), to: channelsText(st.channels), shops });
    if (st.isLine && prev.halfBatches !== st.halfBatches) out.push({ field: `${st.name} half batches`, from: prev.halfBatches ? 'on' : 'off', to: st.halfBatches ? 'on' : 'off', shops });
    if (!sameList(prev.roles, st.roles)) out.push({ field: `${st.name} takes`, from: rolesText(prev.roles), to: rolesText(st.roles), shops });
    const a = new Map(prev.kit.map(k => [k.equipment, k]));
    const z = new Map(st.kit.map(k => [k.equipment, k]));
    for (const e of new Set([...a.keys(), ...z.keys()])) {
      const p = a.get(e);
      const n = z.get(e);
      if (p && n && kitLabel(p) === kitLabel(n)) continue;
      out.push({ field: `${st.name} ${EQUIPMENT_LABELS[e].toLowerCase()}s`, from: p ? kitLabel(p) : 'none', to: n ? kitLabel(n) : 'none', shops });
    }
  }
  for (const st of from) if (!after.has(st.id)) out.push({ field: `${st.isLine ? 'Line' : 'Bench'} removed`, from: st.name, to: '—', shops });
  const sameMembers = from.length === to.length && from.every(s => after.has(s.id));
  if (sameMembers && from.map(s => s.id).join() !== to.map(s => s.id).join()) {
    out.push({ field: 'Kitchen order', from: from.map(s => s.name).join(', '), to: to.map(s => s.name).join(', '), shops });
  }
  return out;
}

/**
 * Every shop's kitchen as it starts: lines and benches in one list. A
 * sales channel plates on exactly one line; a kind of work lands on
 * exactly one station. Picking either somewhere else moves it.
 */
function KitchenTab({ stations, setStations, shopsWithOwnKitchen }: { stations: StationDraft[]; setStations: (next: StationDraft[]) => void; shopsWithOwnKitchen: string[] }) {
  const [openId, setOpenId] = useState<string | null>(null);
  const lines = stations.filter(s => s.isLine);
  const patch = (id: string, p: Partial<StationDraft>) => setStations(stations.map(s => (s.id === id ? { ...s, ...p } : s)));
  const remove = (id: string) => {
    const gone = stations.find(s => s.id === id);
    if (!gone) return;
    if (gone.isLine && lines.length <= 1) return;
    let rest = stations.filter(s => s.id !== id);
    if (gone.isLine && gone.channels.length) {
      // Its channels have to plate somewhere: the first remaining line.
      const first = rest.find(s => s.isLine)!;
      rest = rest.map(s => (s.id === first.id ? { ...s, channels: [...s.channels, ...gone.channels] } : s));
    }
    setStations(rest);
  };
  const add = (isLine: boolean) => {
    if (isLine && lines.length >= MAX_BENCHES) return;
    const prefix = isLine ? 'fj-line' : 'fj-kitchen';
    let n = (isLine ? lines.length : stations.length - lines.length) + 1;
    while (stations.some(s => s.id === `${prefix}-${n}`)) n += 1;
    const fresh: StationDraft = { id: `${prefix}-${n}`, name: isLine ? `Line ${n}` : `Bench ${n}`, isLine, channels: [], halfBatches: false, roles: [], kit: [] };
    // Lines sit together at the top, benches below.
    const lastLine = stations.map(s => s.isLine).lastIndexOf(true);
    const next = stations.slice();
    next.splice(isLine ? lastLine + 1 : stations.length, 0, fresh);
    setStations(next);
    setOpenId(fresh.id);
  };
  const move = (id: string, dir: -1 | 1) => {
    const i = stations.findIndex(s => s.id === id);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= stations.length) return;
    const next = stations.slice();
    [next[i], next[j]] = [next[j], next[i]];
    setStations(next);
  };
  const plateOn = (ch: SalesChannel, id: string) =>
    setStations(stations.map(s => ({ ...s, channels: s.id === id ? Array.from(new Set([...s.channels, ch])) : s.channels.filter(c => c !== ch) })));
  const takeRole = (role: WorkRole, id: string) => {
    const has = stations.find(s => s.id === id)?.roles.includes(role) ?? false;
    setStations(stations.map(s => ({ ...s, roles: s.id === id ? (has ? s.roles.filter(r => r !== role) : [...s.roles, role]) : s.roles.filter(r => r !== role) })));
  };

  const unplated = ALL_CHANNELS.filter(ch => !stations.some(s => s.channels.includes(ch)));
  const untaken = FJ_WORK_ROLES.filter(r => !stations.some(s => s.roles.includes(r.id)));
  const whoHas = (pred: (s: StationDraft) => boolean, notId: string) => stations.find(s => s.id !== notId && pred(s))?.name;

  return (
    <>
      {(unplated.length > 0 || untaken.length > 0) ? (
        <div role="status" style={{ padding: '10px 14px', borderRadius: 'var(--radius-card)', background: 'var(--color-error-light)', border: '1px solid var(--color-error-border)', color: 'var(--color-error)', fontSize: 12, fontWeight: 600 }}>
          {unplated.length > 0 && <div>{unplated.map(c => CHANNEL_LABELS[c]).join(', ')} {unplated.length === 1 ? 'has' : 'have'} no line to plate on. Sales there will not be planned.</div>}
          {untaken.length > 0 && <div>No station takes {untaken.map(r => r.label.toLowerCase()).join(' or ')} work. The board shows it on a card of its own until one does.</div>}
        </div>
      ) : (
        <p style={{ margin: 0, fontSize: 12, color: 'var(--color-text-muted)' }}>
          Every sales channel plates on a line and every kind of work has a station. A station that takes work is a card on the Sections board under its name; its kit sizes the loads.
        </p>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {stations.map((st, i) => {
          const isOpen = openId === st.id;
          const summary = st.isLine
            ? [`Plates ${channelsText(st.channels)}`, st.halfBatches ? 'half batches' : null, st.roles.length ? `takes ${rolesText(st.roles)}` : null, st.kit.length ? kitSummary(st.kit) : null]
            : [st.roles.length ? `Takes ${rolesText(st.roles)}` : 'Takes no work', st.kit.length ? kitSummary(st.kit) : 'no kit counted'];
          const canRemove = !(st.isLine && lines.length <= 1);
          return (
            <section key={st.id} style={{ background: '#fff', border: '1px solid var(--color-border-subtle)', borderRadius: 'var(--radius-card)', overflow: 'hidden' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px' }}>
                <button type="button" onClick={() => setOpenId(isOpen ? null : st.id)} aria-expanded={isOpen} style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: 10, background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', fontFamily: 'var(--font-primary)', padding: 0 }}>
                  {isOpen ? <ChevronDown size={14} color="var(--color-text-muted)" /> : <ChevronRight size={14} color="var(--color-text-muted)" />}
                  <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--color-text-primary)' }}>{st.name || (st.isLine ? 'Unnamed line' : 'Unnamed bench')}</span>
                  <StatusPill tone={st.isLine ? 'brand' : 'neutral'} size="xs" label={st.isLine ? 'Line' : 'Bench'} />
                  <span style={{ fontSize: 11, color: 'var(--color-text-muted)', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{summary.filter(Boolean).join(' · ')}</span>
                </button>
                <button type="button" onClick={() => move(st.id, -1)} disabled={i === 0} aria-label={`Move ${st.name} up`} style={{ ...iconBtn, opacity: i === 0 ? 0.35 : 1 }}><ChevronRight size={12} style={{ transform: 'rotate(-90deg)' }} /></button>
                <button type="button" onClick={() => move(st.id, 1)} disabled={i === stations.length - 1} aria-label={`Move ${st.name} down`} style={{ ...iconBtn, opacity: i === stations.length - 1 ? 0.35 : 1 }}><ChevronRight size={12} style={{ transform: 'rotate(90deg)' }} /></button>
                {canRemove && <button type="button" onClick={() => remove(st.id)} style={linkBtn} aria-label={`Remove ${st.name}`}>Remove</button>}
              </div>
              {isOpen && (
                <div style={{ padding: '14px 16px 16px', borderTop: '1px solid var(--color-border-subtle)', background: 'var(--color-bg-hover)', display: 'flex', flexDirection: 'column', gap: 14 }}>
                  <Row label="Name">
                    <TextInput value={st.name} onChange={v => patch(st.id, { name: v })} width={260} />
                  </Row>
                  {st.isLine && (
                    <Row label="Plates for">
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                          {ALL_CHANNELS.map(ch => {
                            const on = st.channels.includes(ch);
                            const elsewhere = whoHas(s => s.channels.includes(ch), st.id);
                            return (
                              <button key={ch} type="button" onClick={() => plateOn(ch, st.id)} aria-pressed={on} style={pill(on)} title={elsewhere ? `Now on ${elsewhere}; click to move it here.` : undefined}>
                                {CHANNEL_LABELS[ch]}{!on && elsewhere && <span style={{ opacity: 0.6, marginLeft: 4, fontSize: 10 }}>· {elsewhere}</span>}
                              </button>
                            );
                          })}
                        </div>
                        <span style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>Each channel plates on one line. Picking one here moves it.</span>
                      </div>
                    </Row>
                  )}
                  {st.isLine && (
                    <Row label="Half batches">
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <Switch checked={st.halfBatches} onChange={v => patch(st.id, { halfBatches: v })} label={`${st.name} half batches`} />
                        <span style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>{st.halfBatches ? 'Plates small containers; recipes that allow halves round to halves here.' : 'Plates each recipe\u2019s own container.'}</span>
                      </div>
                    </Row>
                  )}
                  <Row label="Work that lands here">
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        {FJ_WORK_ROLES.map(r => {
                          const on = st.roles.includes(r.id);
                          const elsewhere = whoHas(s => s.roles.includes(r.id), st.id);
                          return (
                            <button key={r.id} type="button" onClick={() => takeRole(r.id, st.id)} aria-pressed={on} style={pill(on)} title={`${r.what}${elsewhere ? ` Now on ${elsewhere}; click to move it here.` : ''}`}>
                              {r.label}{!on && elsewhere && elsewhere !== r.label && <span style={{ opacity: 0.6, marginLeft: 4, fontSize: 10 }}>· {elsewhere}</span>}
                            </button>
                          );
                        })}
                      </div>
                      <span style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>
                        {st.roles.length
                          ? `On the Sections board as \u201c${st.name || 'Unnamed'}\u201d: ${st.roles.map(r => FJ_WORK_ROLE_BY_ID[r].what.replace(/\.$/, '').toLowerCase()).join('; ')}.`
                          : 'Takes no work, so it has no card on the Sections board.'}
                      </span>
                    </div>
                  </Row>
                  <Row label="Kit">
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      <KitEditor kit={st.kit} editing onChange={next => patch(st.id, { kit: next })} />
                      <span style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>
                        {st.roles.includes('hot')
                          ? 'Ovens hold trays: two ovens of six and a recipe that fills two trays a batch is six batches a load. One rice kit fits a cooker.'
                          : 'Counted so the board can size loads. A GM counts their own under Settings, Benches.'}
                      </span>
                    </div>
                  </Row>
                </div>
              )}
            </section>
          );
        })}
      </div>

      <div style={{ display: 'flex', gap: 8 }}>
        {lines.length < MAX_BENCHES && <button type="button" onClick={() => add(true)} style={{ ...ghostBtn, borderStyle: 'dashed', color: 'var(--color-info)' }}>+ Add a line</button>}
        <button type="button" onClick={() => add(false)} style={{ ...ghostBtn, borderStyle: 'dashed', color: 'var(--color-info)' }}>+ Add a bench</button>
      </div>

      <Section title="Shops with their own kitchen">
        {shopsWithOwnKitchen.length === 0 ? (
          <span style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>None. Every shop runs the kitchen above. A GM changes theirs under Settings, Benches.</span>
        ) : (
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {shopsWithOwnKitchen.map(id => <span key={id} style={chip}>{getShop(id)?.name ?? id}</span>)}
            <span style={{ fontSize: 11, color: 'var(--color-text-muted)', alignSelf: 'center' }}>Publishing leaves these shops on their own kitchen.</span>
          </div>
        )}
      </Section>
    </>
  );
}

// ─── Containers ──────────────────────────────────────────────────────────────

function ContainersSection({ draft, setDraft }: TabProps) {
  return (
    <>
      <p style={{ margin: 0, fontSize: 11, color: 'var(--color-text-muted)' }}>
        What a batch is portioned into on the lines and in the prep kitchen. Names are the kitchen\u2019s own; the fill sizes the containers a batch and the counts on the close sheet.
      </p>
      <table style={tableStyle}>
        <thead>
          <tr>
            <th style={th}>Name</th>
            <th style={{ ...th, textAlign: 'center' }}>Fill</th>
            <th style={th}>What it is</th>
          </tr>
        </thead>
        <tbody>
          {CONTAINER_IDS.map(id => {
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
    </>
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

/** A card that starts closed: for settings that are set once and rarely revisited. */
function Fold({ title, summary, children }: { title: string; summary?: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <section style={{ background: '#fff', border: '1px solid var(--color-border-subtle)', borderRadius: 'var(--radius-card)', overflow: 'hidden' }}>
      <button type="button" onClick={() => setOpen(o => !o)} aria-expanded={open} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', fontFamily: 'var(--font-primary)' }}>
        {open ? <ChevronDown size={14} color="var(--color-text-muted)" /> : <ChevronRight size={14} color="var(--color-text-muted)" />}
        <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--color-text-primary)' }}>{title}</span>
        {summary && <span style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>{summary}</span>}
      </button>
      {open && <div style={{ padding: '0 16px 16px', display: 'flex', flexDirection: 'column', gap: 12 }}>{children}</div>}
    </section>
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
const openTd: CSSProperties = { borderBottom: 'none' };
const groupTd: CSSProperties = { padding: '10px 8px 4px', fontSize: 10, fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', color: 'var(--color-text-muted)' };
const chip: CSSProperties = { display: 'inline-flex', alignItems: 'center', padding: '5px 10px', borderRadius: 999, border: '1px solid var(--color-border)', fontSize: 11, color: 'var(--color-text-secondary)', background: '#fff' };
const eyebrow: CSSProperties = { fontSize: 10, fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', color: 'var(--color-text-muted)', marginBottom: 6 };
const selectStyle: CSSProperties = { fontSize: 12, fontFamily: 'var(--font-primary)', padding: '6px 8px', borderRadius: 8, border: '1px solid var(--color-border)', background: '#fff', color: 'var(--color-text-primary)' };
const iconBtn: CSSProperties = { background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-muted)', padding: 4, display: 'inline-flex', borderRadius: 6 };
const linkBtn: CSSProperties = { background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-info)', fontSize: 11, fontWeight: 600, fontFamily: 'var(--font-primary)', padding: 0 };
const ghostBtn: CSSProperties = { padding: '8px 12px', borderRadius: 8, fontSize: 11, fontWeight: 700, fontFamily: 'var(--font-primary)', background: '#fff', color: 'var(--color-text-secondary)', border: '1px solid var(--color-border)', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6 };
const primaryBtn: CSSProperties = { ...ghostBtn, background: 'var(--color-accent-active)', color: 'var(--color-text-on-active)', border: '1px solid var(--color-accent-active)', padding: '8px 14px' };
