'use client';

/**
 * Demo-only toggles for the hub-side incoming notification surfaces on
 * `/production/amounts`. The user can flip these from the Quinn side
 * panel during a demo to show/hide the urgent-remake banner, the
 * incoming spoke-rejects strip, and the incoming ad-hoc requests strip.
 *
 * State is in-memory (no persistence) — flipping reflects immediately,
 * a page reload resets back to all-off so the next demo run starts with
 * a clean Today screen and the presenter opts in surface-by-surface.
 */

import { createContext, useCallback, useContext, useMemo, useState } from 'react';

export type DemoNotificationKey = 'urgentRemake' | 'rejects' | 'adhoc';

export type DemoNotificationFlags = Record<DemoNotificationKey, boolean>;

type DemoNotificationsValue = DemoNotificationFlags & {
  set: (key: DemoNotificationKey, value: boolean) => void;
  toggle: (key: DemoNotificationKey) => void;
};

const DEFAULT_FLAGS: DemoNotificationFlags = {
  urgentRemake: false,
  rejects: false,
  adhoc: false,
};

const DemoNotificationsContext = createContext<DemoNotificationsValue | null>(null);

export function DemoNotificationsProvider({ children }: { children: React.ReactNode }) {
  const [flags, setFlags] = useState<DemoNotificationFlags>(DEFAULT_FLAGS);

  const set = useCallback((key: DemoNotificationKey, value: boolean) => {
    setFlags(prev => ({ ...prev, [key]: value }));
  }, []);

  const toggle = useCallback((key: DemoNotificationKey) => {
    setFlags(prev => ({ ...prev, [key]: !prev[key] }));
  }, []);

  const value = useMemo<DemoNotificationsValue>(
    () => ({ ...flags, set, toggle }),
    [flags, set, toggle],
  );

  return (
    <DemoNotificationsContext.Provider value={value}>
      {children}
    </DemoNotificationsContext.Provider>
  );
}

export function useDemoNotifications(): DemoNotificationsValue {
  const ctx = useContext(DemoNotificationsContext);
  if (!ctx) {
    // Safe fallback — every flag on, no-op setters. Lets components
    // render outside of the production layout (e.g. shell tests) without
    // crashing the tree.
    return { ...DEFAULT_FLAGS, set: () => {}, toggle: () => {} };
  }
  return ctx;
}
