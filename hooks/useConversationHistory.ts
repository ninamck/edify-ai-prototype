'use client';

import { useCallback, useEffect, useState } from 'react';
import type { AnalyticsChartId } from '@/components/Analytics/AnalyticsCharts';
import type { TableQuery } from '@/components/Mvp1/Tables/query';

export type ConversationEntry = {
  id: string;
  question: string;
  chartId: AnalyticsChartId | null;
  /** When the conversation produced a table (instead of a chart), the canned
   *  query is captured so resuming re-renders the same table preview. */
  tableQuery?: TableQuery;
  tableTitle?: string;
  /** Number of user messages sent during the chat (includes the seed). */
  userMessageCount: number;
  /** Number of charts pinned to the dashboard during the chat. */
  pinnedCount: number;
  /** Whether the seed question came from the curated question library. */
  fromLibrary: boolean;
  createdAt: number;
};

const STORAGE_KEY = 'edify:conversationHistory';
const MAX_ENTRIES = 20;

function loadStored(): ConversationEntry[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (e): e is ConversationEntry =>
        e &&
        typeof e.id === 'string' &&
        typeof e.question === 'string' &&
        typeof e.createdAt === 'number',
    );
  } catch {
    return [];
  }
}

function persist(entries: ConversationEntry[]) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
  } catch {
    /* quota / private mode — ignore */
  }
}

export function useConversationHistory() {
  const [history, setHistory] = useState<ConversationEntry[]>([]);

  useEffect(() => {
    setHistory(loadStored());
  }, []);

  const addConversation = useCallback((entry: Omit<ConversationEntry, 'id' | 'createdAt'> & { id?: string; createdAt?: number }) => {
    setHistory((prev) => {
      const id = entry.id ?? `conv-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const createdAt = entry.createdAt ?? Date.now();
      const next = [{ ...entry, id, createdAt }, ...prev].slice(0, MAX_ENTRIES);
      persist(next);
      return next;
    });
  }, []);

  const removeConversation = useCallback((id: string) => {
    setHistory((prev) => {
      const next = prev.filter((e) => e.id !== id);
      persist(next);
      return next;
    });
  }, []);

  const clearHistory = useCallback(() => {
    setHistory([]);
    persist([]);
  }, []);

  return { history, addConversation, removeConversation, clearHistory };
}

/**
 * The save rule: don't save if the conversation was just a curated library question
 * with no follow-up. Save otherwise (free-typed, follow-up messages, or pinned charts).
 */
export function shouldSaveConversation(args: {
  fromLibrary: boolean;
  userMessageCount: number;
  pinnedCount: number;
}): boolean {
  if (!args.fromLibrary) return true;
  if (args.userMessageCount > 1) return true;
  if (args.pinnedCount > 0) return true;
  return false;
}
