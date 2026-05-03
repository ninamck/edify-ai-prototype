'use client';

/**
 * SiteSettingsStore — per-site overlay on top of the static fixture
 * defaults (`PRET_SITES`, `PRET_BENCHES`, `PRET_HUB_SETTINGS`, format /
 * estate cascade, etc.).
 *
 * The store doesn't mutate the fixtures. Instead it stores a sparse
 * overlay per `SiteId` and exposes an `effective` view that merges the
 * fixture defaults with any user edits. Surfaces that need the live
 * value (cutoff time on the spoke order page, opening hours in
 * headers) read through `useSiteSettings(siteId).effective` so a save
 * here flows through the rest of the app without touching the seed
 * data.
 *
 * Edits are persisted under `localStorage['edify.siteSettings.v1']`
 * so a manager's tweaks survive reloads — important for demo flow.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import {
  PRET_BENCHES,
  PRET_ESTATE,
  PRET_FORMATS,
  PRET_HUB_SETTINGS,
  PRET_SITES,
  benchesAt,
  getSite,
  type Bench,
  type BenchCapability,
  type BenchId,
  type DayOfWeek,
  type FormatId,
  type ProductionMode,
  type Site,
  type SiteId,
} from '@/components/Production/fixtures';

const STORAGE_KEY = 'edify.siteSettings.v1';

// ─── Types ───────────────────────────────────────────────────────────────────

export type TimeRange = { start: string; end: string };

export type WindowsForDay = {
  p1?: TimeRange;
  p2?: TimeRange;
  vp?: TimeRange;
  p1Forecast?: TimeRange;
  p2Forecast?: TimeRange;
  vpForecast?: TimeRange;
};

export type TeamUser = { id: string; name: string; label?: string };

export type SiteDuty = {
  id: string;
  name: string;
  durationMinutes: number;
  benchIds: BenchId[];
};

export type LockPolicy = 'lock' | 'soft';

export type CoreOverlay = {
  name?: string;
  formatId?: FormatId;
  hubId?: SiteId | null;
  openingHours?: { open: string; close: string };
  salesFactor?: number;
};

export type CutoffsOverlay = {
  cutoffTime?: string;
  lockPolicy?: LockPolicy;
  coverDays?: number;
  leadTimeHours?: number;
};

export type BenchOverlay = Partial<
  Pick<Bench, 'name' | 'capabilities' | 'online' | 'primaryMode' | 'batchRules' | 'runs'>
>;

export type TeamOverlay = {
  users?: TeamUser[];
  duties?: SiteDuty[];
};

export type WindowsOverlay = Partial<Record<DayOfWeek, WindowsForDay>>;

export type SiteSettingsOverlay = {
  core?: CoreOverlay;
  cutoffs?: CutoffsOverlay;
  benches?: Record<BenchId, BenchOverlay>;
  benchOrder?: BenchId[];
  team?: TeamOverlay;
  windows?: WindowsOverlay;
};

/** The merged read-side shape. Always has values — defaults filled in. */
export type EffectiveSiteSettings = {
  siteId: SiteId;
  core: {
    name: string;
    type: Site['type'];
    formatId: FormatId;
    hubId: SiteId | null;
    openingHours: { open: string; close: string };
    salesFactor: number;
    /** What the value would be if all overrides were dropped. */
    defaults: {
      name: string;
      formatId: FormatId;
      hubId: SiteId | null;
      openingHours: { open: string; close: string };
      salesFactor: number;
    };
  };
  cutoffs: {
    cutoffTime: string;
    lockPolicy: LockPolicy;
    coverDays: number;
    leadTimeHours: number;
    defaults: {
      cutoffTime: string;
      lockPolicy: LockPolicy;
      coverDays: number;
      leadTimeHours: number;
    };
    /** Where each value came from when on default. */
    cascadeNotes: {
      cutoffTime: string; // "Pret a Manger estate · 15:00"
    };
  };
  benches: EffectiveBench[];
  team: { users: TeamUser[]; duties: SiteDuty[] };
  windows: Record<DayOfWeek, WindowsForDay>;
};

export type EffectiveBench = Bench & {
  /** True when the user has overridden any field on this bench. */
  hasOverride: boolean;
};

// ─── Defaults / fixture cascade ──────────────────────────────────────────────

const DEFAULT_LOCK_POLICY: LockPolicy = 'lock';
const DEFAULT_COVER_DAYS = 1;
const DEFAULT_LEAD_TIME_HOURS = 16;

function defaultCutoffTimeForSite(site: Site): string {
  const fmt = PRET_FORMATS.find(f => f.id === site.formatId);
  return (
    fmt?.overrides?.cutoffTimeForSpokeSubmissions ??
    PRET_ESTATE.defaults.cutoffTimeForSpokeSubmissions
  );
}

function defaultLockPolicyForSite(site: Site): LockPolicy {
  // For HUBs: the hub's existing PRET_HUB_SETTINGS row.
  // For SPOKEs / linked / hybrid: inherit from their hub.
  const hubId = site.type === 'HUB' ? site.id : site.hubId;
  if (!hubId) return DEFAULT_LOCK_POLICY;
  const hubRow = PRET_HUB_SETTINGS.find(s => s.hubId === hubId);
  return hubRow?.spokeCutoffPolicy ?? DEFAULT_LOCK_POLICY;
}

function defaultSalesFactor(site: Site): number {
  // Spokes / linked sites have a documented per-site factor; HUBs are always 1.
  return site.salesFactor ?? (site.type === 'HUB' ? 1 : 0.4);
}

function emptyWindows(): Record<DayOfWeek, WindowsForDay> {
  return {
    Mon: {}, Tue: {}, Wed: {}, Thu: {}, Fri: {}, Sat: {}, Sun: {},
  };
}

function defaultTeamForSite(site: Site): { users: TeamUser[]; duties: SiteDuty[] } {
  // We don't have a fixture for users/duties yet — provide a minimal,
  // realistic seed so the editor renders something out of the box. This
  // mirrors the Pret screenshots (GMs / TMs + Bins/Floor/Sinks/Touch
  // Surfaces duties).
  if (site.type !== 'HUB' && site.type !== 'HYBRID' && site.type !== 'STANDALONE') {
    return { users: [], duties: [] };
  }
  return {
    users: [
      { id: 'u-default-1', name: 'Petronela Stoina', label: 'GM' },
      { id: 'u-default-2', name: 'Raseena Rahim', label: 'TM' },
      { id: 'u-default-3', name: 'Sreelakshmi Sivankutty', label: 'TM' },
    ],
    duties: [
      { id: 'd-bins', name: 'Bins', durationMinutes: 3, benchIds: [] },
      { id: 'd-floor', name: 'Floor', durationMinutes: 3, benchIds: [] },
      { id: 'd-sinks', name: 'Sinks', durationMinutes: 3, benchIds: [] },
      { id: 'd-touch', name: 'Touch surfaces', durationMinutes: 3, benchIds: [] },
    ],
  };
}

// ─── Resolver — merges overlay onto fixture cascade ──────────────────────────

function resolveEffective(
  siteId: SiteId,
  overlay: SiteSettingsOverlay | undefined,
): EffectiveSiteSettings {
  const site = getSite(siteId);
  if (!site) {
    // Unknown site — return a stub so the UI can render an empty editor
    // without crashing. The /settings page guards against this.
    return STUB_EFFECTIVE;
  }

  const coreDefaults = {
    name: site.name,
    formatId: site.formatId,
    hubId: site.hubId ?? null,
    openingHours: { ...site.openingHours },
    salesFactor: defaultSalesFactor(site),
  };
  const core = {
    name: overlay?.core?.name ?? coreDefaults.name,
    type: site.type,
    formatId: overlay?.core?.formatId ?? coreDefaults.formatId,
    hubId:
      overlay?.core?.hubId === undefined ? coreDefaults.hubId : overlay.core.hubId,
    openingHours: overlay?.core?.openingHours ?? coreDefaults.openingHours,
    salesFactor: overlay?.core?.salesFactor ?? coreDefaults.salesFactor,
    defaults: coreDefaults,
  };

  const cutoffDefaults = {
    cutoffTime: defaultCutoffTimeForSite(site),
    lockPolicy: defaultLockPolicyForSite(site),
    coverDays: DEFAULT_COVER_DAYS,
    leadTimeHours: DEFAULT_LEAD_TIME_HOURS,
  };
  const fmt = PRET_FORMATS.find(f => f.id === site.formatId);
  const cutoffSource =
    fmt?.overrides?.cutoffTimeForSpokeSubmissions !== undefined
      ? `${fmt.name} format · ${cutoffDefaults.cutoffTime}`
      : `${PRET_ESTATE.name} estate · ${cutoffDefaults.cutoffTime}`;

  const cutoffs = {
    cutoffTime: overlay?.cutoffs?.cutoffTime ?? cutoffDefaults.cutoffTime,
    lockPolicy: overlay?.cutoffs?.lockPolicy ?? cutoffDefaults.lockPolicy,
    coverDays: overlay?.cutoffs?.coverDays ?? cutoffDefaults.coverDays,
    leadTimeHours: overlay?.cutoffs?.leadTimeHours ?? cutoffDefaults.leadTimeHours,
    defaults: cutoffDefaults,
    cascadeNotes: { cutoffTime: cutoffSource },
  };

  const fixtureBenches = benchesAt(siteId);
  const benchOrder =
    overlay?.benchOrder ??
    fixtureBenches.map(b => b.id);
  const benchById = new Map<BenchId, Bench>(
    fixtureBenches.map(b => [b.id, b]),
  );
  const benches: EffectiveBench[] = benchOrder
    .map(id => {
      const base = benchById.get(id);
      if (!base) return null;
      const ov = overlay?.benches?.[id];
      const merged: EffectiveBench = {
        ...base,
        ...(ov ?? {}),
        hasOverride: !!ov && Object.keys(ov).length > 0,
      };
      return merged;
    })
    .filter(Boolean) as EffectiveBench[];

  const teamDefaults = defaultTeamForSite(site);
  const team = {
    users: overlay?.team?.users ?? teamDefaults.users,
    duties: overlay?.team?.duties ?? teamDefaults.duties,
  };

  const windowsOverlay = overlay?.windows ?? {};
  const windows = (Object.fromEntries(
    (['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as DayOfWeek[]).map(d => [
      d,
      windowsOverlay[d] ?? {},
    ]),
  ) as unknown) as Record<DayOfWeek, WindowsForDay>;

  return { siteId, core, cutoffs, benches, team, windows };
}

const STUB_EFFECTIVE: EffectiveSiteSettings = {
  siteId: '' as SiteId,
  core: {
    name: '',
    type: 'STANDALONE',
    formatId: PRET_FORMATS[0]?.id ?? '' as FormatId,
    hubId: null,
    openingHours: { open: '07:00', close: '19:00' },
    salesFactor: 1,
    defaults: {
      name: '',
      formatId: PRET_FORMATS[0]?.id ?? '' as FormatId,
      hubId: null,
      openingHours: { open: '07:00', close: '19:00' },
      salesFactor: 1,
    },
  },
  cutoffs: {
    cutoffTime: PRET_ESTATE.defaults.cutoffTimeForSpokeSubmissions,
    lockPolicy: DEFAULT_LOCK_POLICY,
    coverDays: DEFAULT_COVER_DAYS,
    leadTimeHours: DEFAULT_LEAD_TIME_HOURS,
    defaults: {
      cutoffTime: PRET_ESTATE.defaults.cutoffTimeForSpokeSubmissions,
      lockPolicy: DEFAULT_LOCK_POLICY,
      coverDays: DEFAULT_COVER_DAYS,
      leadTimeHours: DEFAULT_LEAD_TIME_HOURS,
    },
    cascadeNotes: {
      cutoffTime: `${PRET_ESTATE.name} estate · ${PRET_ESTATE.defaults.cutoffTimeForSpokeSubmissions}`,
    },
  },
  benches: [],
  team: { users: [], duties: [] },
  windows: emptyWindows(),
};

// ─── Override count (for tab badges + summary) ───────────────────────────────

export function countOverrides(overlay: SiteSettingsOverlay | undefined): {
  total: number;
  byTab: { general: number; cutoffs: number; benches: number; team: number; windows: number };
} {
  const r = { general: 0, cutoffs: 0, benches: 0, team: 0, windows: 0 };
  if (!overlay) return { total: 0, byTab: r };
  if (overlay.core) {
    r.general = Object.keys(overlay.core).length;
  }
  if (overlay.cutoffs) {
    r.cutoffs = Object.keys(overlay.cutoffs).length;
  }
  if (overlay.benches) {
    let n = 0;
    for (const k of Object.keys(overlay.benches)) {
      n += Object.keys(overlay.benches[k] ?? {}).length;
    }
    r.benches = n + (overlay.benchOrder ? 1 : 0);
  }
  if (overlay.team) {
    if (overlay.team.users) r.team += 1;
    if (overlay.team.duties) r.team += 1;
  }
  if (overlay.windows) {
    let n = 0;
    for (const d of Object.keys(overlay.windows) as DayOfWeek[]) {
      n += Object.keys(overlay.windows[d] ?? {}).length;
    }
    r.windows = n;
  }
  return {
    total: r.general + r.cutoffs + r.benches + r.team + r.windows,
    byTab: r,
  };
}

// ─── Context ─────────────────────────────────────────────────────────────────

type SiteSettingsValue = {
  /** Read the merged settings for a given site (memoised). */
  effectiveFor: (siteId: SiteId) => EffectiveSiteSettings;
  /** Raw overlay (sparse) for a site — useful for diff / count. */
  overlayFor: (siteId: SiteId) => SiteSettingsOverlay | undefined;
  /** Apply a deep-merge patch to a site's overlay. */
  patch: (siteId: SiteId, patch: SiteSettingsOverlay) => void;
  /** Replace a site's overlay wholesale (used by Save with staged diff). */
  replace: (siteId: SiteId, overlay: SiteSettingsOverlay | undefined) => void;
  /** Drop all overrides for a site, falling back to fixture defaults. */
  reset: (siteId: SiteId) => void;
};

const Ctx = createContext<SiteSettingsValue | null>(null);

export function SiteSettingsStoreProvider({ children }: { children: React.ReactNode }) {
  const [overlays, setOverlays] = useState<Record<SiteId, SiteSettingsOverlay>>({});

  // Hydrate from localStorage once on mount.
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') {
        setOverlays(parsed as Record<SiteId, SiteSettingsOverlay>);
      }
    } catch {
      // ignore — corrupt entry just means we start clean
    }
  }, []);

  // Persist on every change.
  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(overlays));
    } catch {
      // ignore — storage may be full / disabled
    }
  }, [overlays]);

  const overlayFor = useCallback(
    (siteId: SiteId) => overlays[siteId],
    [overlays],
  );

  const effectiveFor = useCallback(
    (siteId: SiteId) => resolveEffective(siteId, overlays[siteId]),
    [overlays],
  );

  const patch = useCallback((siteId: SiteId, p: SiteSettingsOverlay) => {
    setOverlays(prev => {
      const current = prev[siteId] ?? {};
      const next: SiteSettingsOverlay = { ...current };
      if (p.core) next.core = { ...(current.core ?? {}), ...p.core };
      if (p.cutoffs) next.cutoffs = { ...(current.cutoffs ?? {}), ...p.cutoffs };
      if (p.benches) {
        next.benches = { ...(current.benches ?? {}) };
        for (const id of Object.keys(p.benches)) {
          next.benches[id] = { ...(next.benches[id] ?? {}), ...p.benches[id] };
        }
      }
      if (p.benchOrder) next.benchOrder = p.benchOrder;
      if (p.team) next.team = { ...(current.team ?? {}), ...p.team };
      if (p.windows) {
        next.windows = { ...(current.windows ?? {}) };
        for (const d of Object.keys(p.windows) as DayOfWeek[]) {
          next.windows[d] = { ...(next.windows[d] ?? {}), ...p.windows[d] };
        }
      }
      return { ...prev, [siteId]: next };
    });
  }, []);

  const replace = useCallback(
    (siteId: SiteId, overlay: SiteSettingsOverlay | undefined) => {
      setOverlays(prev => {
        const next = { ...prev };
        if (overlay && Object.keys(overlay).length > 0) {
          next[siteId] = overlay;
        } else {
          delete next[siteId];
        }
        return next;
      });
    },
    [],
  );

  const reset = useCallback((siteId: SiteId) => {
    setOverlays(prev => {
      if (!prev[siteId]) return prev;
      const next = { ...prev };
      delete next[siteId];
      return next;
    });
  }, []);

  const value = useMemo<SiteSettingsValue>(
    () => ({ effectiveFor, overlayFor, patch, replace, reset }),
    [effectiveFor, overlayFor, patch, replace, reset],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

// ─── Hooks / resolvers ───────────────────────────────────────────────────────

export function useSiteSettingsStore(): SiteSettingsValue {
  const ctx = useContext(Ctx);
  if (!ctx) {
    // Safe fallback for components mounted outside the provider — they
    // see fixture defaults and their writes are no-ops.
    return {
      effectiveFor: (id) => resolveEffective(id, undefined),
      overlayFor: () => undefined,
      patch: () => {},
      replace: () => {},
      reset: () => {},
    };
  }
  return ctx;
}

export function useSiteSettings(siteId: SiteId): {
  effective: EffectiveSiteSettings;
  overlay: SiteSettingsOverlay | undefined;
  patch: (p: SiteSettingsOverlay) => void;
  replace: (o: SiteSettingsOverlay | undefined) => void;
  reset: () => void;
} {
  const store = useSiteSettingsStore();
  const effective = useMemo(() => store.effectiveFor(siteId), [store, siteId]);
  const overlay = store.overlayFor(siteId);
  return {
    effective,
    overlay,
    patch: (p) => store.patch(siteId, p),
    replace: (o) => store.replace(siteId, o),
    reset: () => store.reset(siteId),
  };
}

/** All sites, sorted: HUB first, then by name. Used by /settings picker. */
export function listAllSites(): Site[] {
  return [...PRET_SITES].sort((a, b) => {
    if (a.type === 'HUB' && b.type !== 'HUB') return -1;
    if (b.type === 'HUB' && a.type !== 'HUB') return 1;
    return a.name.localeCompare(b.name);
  });
}

/** Static helper exports — handy for non-React reads (rare). */
export const KNOWN_BENCH_CAPABILITIES: BenchCapability[] = [
  'oven',
  'prep',
  'pack',
  'proofing',
  'cold-prep',
  'front-of-house',
  'assemble',
];

export const KNOWN_PRIMARY_MODES: ProductionMode[] = [
  'run',
  'variable',
  'increment',
];

// Re-export so callers don't need to know which file the fixtures live in.
export { PRET_BENCHES };
