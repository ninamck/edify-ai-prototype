'use client';

/**
 * Lightweight localStorage-backed store for notes the operator captures
 * outside the Notebook page itself — primarily the "Note:" quick-action
 * in the Quinn chat composer. The Notebook page (/notebook) reads these
 * so a note jotted in the chat shows up in the running record.
 */

import { useEffect, useState } from 'react';

export interface ChatNote {
  id: string;
  text: string;
  tags: string[];
  reply: string;
  /** Epoch ms. */
  createdAt: number;
}

const STORAGE_KEY = 'edify:notebookNotes';
const EVENT = 'edify:notebook-updated';

export function getNotebookNotes(): ChatNote[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as ChatNote[]) : [];
  } catch {
    return [];
  }
}

export function addNotebookNote(note: {
  text: string;
  tags?: string[];
  reply: string;
}): ChatNote {
  const entry: ChatNote = {
    id: `note-${Date.now()}`,
    text: note.text,
    tags: note.tags ?? [],
    reply: note.reply,
    createdAt: Date.now(),
  };
  if (typeof window !== 'undefined') {
    try {
      const next = [entry, ...getNotebookNotes()];
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      // Notify same-tab listeners (the storage event only fires cross-tab).
      window.dispatchEvent(new CustomEvent(EVENT));
    } catch {
      /* quota / private mode — ignore */
    }
  }
  return entry;
}

/** Subscribe to the captured-notes list, kept in sync across the app. */
export function useNotebookNotes(): ChatNote[] {
  const [notes, setNotes] = useState<ChatNote[]>([]);
  useEffect(() => {
    setNotes(getNotebookNotes());
    function refresh() {
      setNotes(getNotebookNotes());
    }
    window.addEventListener(EVENT, refresh);
    window.addEventListener('storage', refresh);
    return () => {
      window.removeEventListener(EVENT, refresh);
      window.removeEventListener('storage', refresh);
    };
  }, []);
  return notes;
}
