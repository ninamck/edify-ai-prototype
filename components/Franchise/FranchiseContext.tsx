'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';

import {
  FRANCHISES,
  FRANCHISE_GROUP,
  type Franchise,
  type FranchiseGroup,
} from './fixtures';

/**
 * Franchise-admin "group view" state for the demo.
 *
 *  - `viewMode` is the headline toggle: 'store' is the normal single-site
 *    app every persona uses today; 'group' is the franchise admin sitting
 *    above the whole group (lands on /franchise, top bar shows the
 *    FranchiseSwitcher instead of the SiteSwitcher).
 *  - `activeFranchiseId` is the brand currently in focus in group mode.
 *  - `selectedStoreIds` is the multi-select of stores the admin has chosen
 *    to view across brands.
 *
 * Deliberately separate from ActiveSiteContext (which models the single
 * persona site) and from the approvals-driven USERS — this layer sits on
 * top and never mutates store-level role logic.
 *
 * Persisted in localStorage so the choice survives reloads during a demo.
 */

export type FranchiseViewMode = 'store' | 'group';

const STORAGE_VIEW_MODE = 'edify.franchise.viewMode';
const STORAGE_ACTIVE_FRANCHISE = 'edify.franchise.activeId';
const STORAGE_SELECTED_STORES = 'edify.franchise.selectedStoreIds';

const DEFAULT_FRANCHISE_ID = FRANCHISES[0]?.id ?? '';

/** Default selection = every store in the group, i.e. "All stores". */
const ALL_STORE_IDS: string[] = FRANCHISES.flatMap((f) => f.stores.map((s) => s.id));

type FranchiseContextValue = {
  group: FranchiseGroup;
  franchises: Franchise[];
  viewMode: FranchiseViewMode;
  isGroupView: boolean;
  setViewMode: (mode: FranchiseViewMode) => void;
  activeFranchiseId: string;
  activeFranchise: Franchise;
  setActiveFranchiseId: (id: string) => void;
  /** Multi-select of store ids across every brand. */
  selectedStoreIds: string[];
  setSelectedStoreIds: (ids: string[]) => void;
  toggleStore: (id: string) => void;
  selectAllStores: () => void;
  clearStores: () => void;
};

const FranchiseContext = createContext<FranchiseContextValue | null>(null);

export function FranchiseProvider({ children }: { children: React.ReactNode }) {
  const [viewMode, setViewModeState] = useState<FranchiseViewMode>('store');
  const [activeFranchiseId, setActiveFranchiseIdState] =
    useState<string>(DEFAULT_FRANCHISE_ID);
  const [selectedStoreIds, setSelectedStoreIdsState] =
    useState<string[]>(ALL_STORE_IDS);

  // Hydrate from localStorage on mount (client-only so SSR keeps defaults
  // and we don't trip a hydration mismatch).
  useEffect(() => {
    try {
      const storedMode = window.localStorage.getItem(STORAGE_VIEW_MODE);
      if (storedMode === 'group' || storedMode === 'store') {
        setViewModeState(storedMode);
      }
      const storedFranchise = window.localStorage.getItem(STORAGE_ACTIVE_FRANCHISE);
      if (storedFranchise && FRANCHISES.some((f) => f.id === storedFranchise)) {
        setActiveFranchiseIdState(storedFranchise);
      }
      const storedStores = window.localStorage.getItem(STORAGE_SELECTED_STORES);
      if (storedStores) {
        const parsed = JSON.parse(storedStores) as unknown;
        if (Array.isArray(parsed)) {
          const valid = parsed.filter(
            (id): id is string => typeof id === 'string' && ALL_STORE_IDS.includes(id),
          );
          if (valid.length > 0) setSelectedStoreIdsState(valid);
        }
      }
    } catch {
      // ignore — localStorage unavailable, stay on defaults
    }
  }, []);

  const persist = useCallback((key: string, value: string) => {
    try {
      window.localStorage.setItem(key, value);
    } catch {
      // ignore — choice just won't persist
    }
  }, []);

  const setViewMode = useCallback(
    (mode: FranchiseViewMode) => {
      setViewModeState(mode);
      persist(STORAGE_VIEW_MODE, mode);
    },
    [persist],
  );

  const setActiveFranchiseId = useCallback(
    (id: string) => {
      if (!FRANCHISES.some((f) => f.id === id)) return;
      setActiveFranchiseIdState(id);
      persist(STORAGE_ACTIVE_FRANCHISE, id);
    },
    [persist],
  );

  const setSelectedStoreIds = useCallback(
    (ids: string[]) => {
      const valid = ids.filter((id) => ALL_STORE_IDS.includes(id));
      setSelectedStoreIdsState(valid);
      persist(STORAGE_SELECTED_STORES, JSON.stringify(valid));
    },
    [persist],
  );

  const toggleStore = useCallback(
    (id: string) => {
      setSelectedStoreIdsState((prev) => {
        const next = prev.includes(id)
          ? prev.filter((x) => x !== id)
          : [...prev, id];
        persist(STORAGE_SELECTED_STORES, JSON.stringify(next));
        return next;
      });
    },
    [persist],
  );

  const selectAllStores = useCallback(() => {
    setSelectedStoreIds(ALL_STORE_IDS);
  }, [setSelectedStoreIds]);

  const clearStores = useCallback(() => {
    setSelectedStoreIds([]);
  }, [setSelectedStoreIds]);

  const value = useMemo<FranchiseContextValue>(() => {
    const activeFranchise =
      FRANCHISES.find((f) => f.id === activeFranchiseId) ?? FRANCHISES[0];
    return {
      group: FRANCHISE_GROUP,
      franchises: FRANCHISES,
      viewMode,
      isGroupView: viewMode === 'group',
      setViewMode,
      activeFranchiseId,
      activeFranchise,
      setActiveFranchiseId,
      selectedStoreIds,
      setSelectedStoreIds,
      toggleStore,
      selectAllStores,
      clearStores,
    };
  }, [
    viewMode,
    setViewMode,
    activeFranchiseId,
    setActiveFranchiseId,
    selectedStoreIds,
    setSelectedStoreIds,
    toggleStore,
    selectAllStores,
    clearStores,
  ]);

  return (
    <FranchiseContext.Provider value={value}>{children}</FranchiseContext.Provider>
  );
}

export function useFranchise(): FranchiseContextValue {
  const ctx = useContext(FranchiseContext);
  if (!ctx) {
    // Safe defaults so components used outside the provider (isolated
    // tests, legacy mounts) don't crash. Reads as store mode.
    return {
      group: FRANCHISE_GROUP,
      franchises: FRANCHISES,
      viewMode: 'store',
      isGroupView: false,
      setViewMode: () => {},
      activeFranchiseId: DEFAULT_FRANCHISE_ID,
      activeFranchise: FRANCHISES[0],
      setActiveFranchiseId: () => {},
      selectedStoreIds: ALL_STORE_IDS,
      setSelectedStoreIds: () => {},
      toggleStore: () => {},
      selectAllStores: () => {},
      clearStores: () => {},
    };
  }
  return ctx;
}
