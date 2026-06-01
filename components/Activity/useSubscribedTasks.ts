'use client';

import { useEffect, useState } from 'react';
import { getTasks, subscribeTasks, type Task } from '@/components/Feed/taskHistoryStore';

/**
 * Shared subscription hook for the persisted task store. Both the
 * existing TaskHistoryList in Feed.tsx and the new Activity page lean
 * on this pattern — pulled out here so they don't reinvent it (and so
 * a later switch to useSyncExternalStore happens in one place).
 */
export function useSubscribedTasks(): Task[] {
  const [, setTick] = useState(0);
  useEffect(() => {
    const unsub = subscribeTasks(() => setTick((n) => n + 1));
    // Re-render once on mount so SSR-hydrated empty state catches up
    // with localStorage after rehydration in the store.
    setTick((n) => n + 1);
    return unsub;
  }, []);
  return getTasks();
}
