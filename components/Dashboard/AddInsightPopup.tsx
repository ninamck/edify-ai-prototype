'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ChevronLeft, Pin } from 'lucide-react';
import Feed from '@/components/Feed/Feed';
import QuestionLibraryPicker, {
  type SegmentKey,
  type ShapeFilter,
} from '@/components/Dashboard/QuestionLibraryPicker';
import {
  QUESTION_LIBRARY,
  getQuestionTableQuery,
  questionShape,
  resolveSuggestedChartId,
  type ProductionSubsegment,
  type QuestionEntry,
} from '@/components/Dashboard/data/questionLibrary';
import type { AnalyticsChartId } from '@/components/Analytics/AnalyticsCharts';
import type { BriefingRole } from '@/components/briefing';
import type { TableQuery } from '@/components/Mvp1/Tables/query';
import {
  useConversationHistory,
  shouldSaveConversation,
  type ConversationEntry,
} from '@/hooks/useConversationHistory';

function resolveChartId(text: string, role?: BriefingRole): AnalyticsChartId | null {
  const entry = QUESTION_LIBRARY.find((q) => q.text === text);
  if (!entry) return null;
  return resolveSuggestedChartId(entry, role);
}

function isLibraryQuestion(text: string): boolean {
  return QUESTION_LIBRARY.some((q) => q.text === text);
}

export default function AddInsightPopup({
  open,
  onClose,
  briefingRole,
  onAddToDashboard,
  onViewDashboard,
  alreadyPinned,
  layout = 'modal',
  defaultShape = 'all',
  onPickTable,
  onPinTable,
  onOpenTableInNewView,
  pinTarget = 'dashboard',
  pinTargets,
  defaultPinTargetId,
  onAddChartToTarget,
  onAddChartToNewView,
  autoChatTable,
}: {
  open: boolean;
  onClose: () => void;
  briefingRole: BriefingRole;
  onAddToDashboard: (id: AnalyticsChartId) => void;
  /** Called when user clicks "View dashboard" after pinning a chart in chat. */
  onViewDashboard?: () => void;
  alreadyPinned: Set<AnalyticsChartId>;
  /**
   * 'modal' (default): centred floating panel with full backdrop blur (Original).
   * 'side-sheet': right-anchored slide-in sheet that leaves the dashboard visible (MVP 1).
   */
  layout?: 'modal' | 'side-sheet';
  /** Pre-set the chart/table shape filter when the popup opens. */
  defaultShape?: ShapeFilter;
  /** Called when the user picks a question that maps to a table query. If
   *  omitted, table-tagged picks fall back to the chat flow. */
  onPickTable?: (entry: QuestionEntry, query: TableQuery) => void;
  /** Pin a Quinn-built table to the active view. */
  onPinTable?: (info: { title: string; query: TableQuery; prompt: string }) => void;
  /** Open a Quinn-built table as its own new view. */
  onOpenTableInNewView?: (info: { title: string; query: TableQuery; prompt: string }) => void;
  /** Where chat-pinned charts go. 'view' renames the CTA to "Pin to current
   *  view" and skips the post-pin "View dashboard" jump. */
  pinTarget?: 'dashboard' | 'view';
  /** When provided, the chat chart pin button becomes a dropdown of targets. */
  pinTargets?: { id: string; label: string }[];
  /** Default-highlighted target in the pin dropdown (typically the active view). */
  defaultPinTargetId?: string;
  /** Pin a chart from chat into a specific target view. */
  onAddChartToTarget?: (chartId: AnalyticsChartId, targetId: string) => void;
  /** Create a new view containing the chart; should return the new view's id. */
  onAddChartToNewView?: (chartId: AnalyticsChartId) => string | undefined;
  /** When set, the popup opens directly into chat mode with this starter table
   *  loaded — used by the empty-state "Build manually" card and the per-table
   *  "Edit query" pencil so Quinn can guide the user to refine the table. */
  autoChatTable?: {
    prompt: string;
    query: TableQuery;
    title?: string;
  };
}) {
  const [mode, setMode] = useState<'browse' | 'chat'>('browse');
  const [segment, setSegment] = useState<SegmentKey>('all');
  const [subsegment, setSubsegment] = useState<ProductionSubsegment | null>(null);
  const [shape, setShape] = useState<ShapeFilter>(defaultShape);
  const [query, setQuery] = useState('');
  const [sessionPinned, setSessionPinned] = useState<Set<AnalyticsChartId>>(new Set());
  const [chatSeed, setChatSeed] = useState<string>('');
  const [chatChartId, setChatChartId] = useState<AnalyticsChartId | null>(null);
  const [chatTableQuery, setChatTableQuery] = useState<TableQuery | null>(null);
  const [chatTableTitle, setChatTableTitle] = useState<string>('');
  const [chatUserMessageCount, setChatUserMessageCount] = useState(0);
  const [chatPinnedCount, setChatPinnedCount] = useState(0);
  // When the user picks a question that can be either a chart or a table, we
  // ask them to choose before routing. Cleared after a choice is made or the
  // popup closes.
  const [pendingShapeChoice, setPendingShapeChoice] = useState<{
    entry: QuestionEntry;
    tableQuery: TableQuery;
  } | null>(null);

  // Keep the local shape state in sync if the caller changes defaultShape
  // between opens (e.g. Sidebar's Build a table opens with shape='table').
  useEffect(() => {
    if (open) setShape(defaultShape);
  }, [open, defaultShape]);

  // When the popup is opened with a starter table (Build manually / Edit
  // query), jump straight into chat mode with Quinn previewing the table.
  // We key off the prompt+query identity so re-opening with the same starter
  // re-enters the chat cleanly.
  const autoChatRef = useRef<{ prompt: string; query: TableQuery; title?: string } | null>(null);
  useEffect(() => {
    if (!open) {
      autoChatRef.current = null;
      return;
    }
    if (!autoChatTable) return;
    if (autoChatRef.current === autoChatTable) return;
    autoChatRef.current = autoChatTable;
    enterChatWithTable(autoChatTable.prompt, autoChatTable.query, autoChatTable.title);
    // enterChatWithTable is a stable closure over setters; safe to omit.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, autoChatTable]);

  const { history, addConversation, removeConversation, clearHistory } = useConversationHistory();

  // Refs let `commitChatToHistory` read latest values without becoming a useEffect dep.
  const chatSeedRef = useRef(chatSeed);
  const chatChartIdRef = useRef(chatChartId);
  const chatTableQueryRef = useRef(chatTableQuery);
  const chatTableTitleRef = useRef(chatTableTitle);
  const chatUserMessageCountRef = useRef(chatUserMessageCount);
  const chatPinnedCountRef = useRef(chatPinnedCount);
  useEffect(() => { chatSeedRef.current = chatSeed; }, [chatSeed]);
  useEffect(() => { chatChartIdRef.current = chatChartId; }, [chatChartId]);
  useEffect(() => { chatTableQueryRef.current = chatTableQuery; }, [chatTableQuery]);
  useEffect(() => { chatTableTitleRef.current = chatTableTitle; }, [chatTableTitle]);
  useEffect(() => { chatUserMessageCountRef.current = chatUserMessageCount; }, [chatUserMessageCount]);
  useEffect(() => { chatPinnedCountRef.current = chatPinnedCount; }, [chatPinnedCount]);

  const effectivePinned = useMemo(() => {
    const s = new Set<AnalyticsChartId>(alreadyPinned);
    for (const id of sessionPinned) s.add(id);
    return s;
  }, [alreadyPinned, sessionPinned]);

  const commitChatToHistory = useCallback(() => {
    const seed = chatSeedRef.current;
    if (!seed) return;
    const fromLibrary = isLibraryQuestion(seed);
    const userMessageCount = chatUserMessageCountRef.current;
    const pinnedCount = chatPinnedCountRef.current;
    if (!shouldSaveConversation({ fromLibrary, userMessageCount, pinnedCount })) return;
    addConversation({
      question: seed,
      chartId: chatChartIdRef.current,
      tableQuery: chatTableQueryRef.current ?? undefined,
      tableTitle: chatTableTitleRef.current || undefined,
      userMessageCount,
      pinnedCount,
      fromLibrary,
    });
  }, [addConversation]);

  // Reset on close (and commit current chat first if eligible).
  useEffect(() => {
    if (open) return;
    commitChatToHistory();
    setMode('browse');
    setSegment('all');
    setSubsegment(null);
    setShape(defaultShape);
    setQuery('');
    setSessionPinned(new Set());
    setChatSeed('');
    setChatChartId(null);
    setChatTableQuery(null);
    setChatTableTitle('');
    setChatUserMessageCount(0);
    setChatPinnedCount(0);
    setPendingShapeChoice(null);
  }, [open, commitChatToHistory, defaultShape]);

  function exitChatToBrowse() {
    commitChatToHistory();
    setMode('browse');
    setChatSeed('');
    setChatChartId(null);
    setChatTableQuery(null);
    setChatTableTitle('');
    setChatUserMessageCount(0);
    setChatPinnedCount(0);
  }

  // Esc: chat → back to library; library → close
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key !== 'Escape') return;
      if (mode === 'chat') {
        exitChatToBrowse();
      } else {
        onClose();
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // exitChatToBrowse is a stable closure over latest state via refs/setters; safe to omit.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, mode, onClose]);

  function enterChat(text: string, explicitChart?: AnalyticsChartId | null) {
    // Commit the previous chat (if any) before starting a new one.
    commitChatToHistory();
    setChatSeed(text);
    setChatChartId(explicitChart === undefined ? resolveChartId(text, briefingRole) : explicitChart);
    setChatTableQuery(null);
    setChatTableTitle('');
    setChatUserMessageCount(0);
    setChatPinnedCount(0);
    setMode('chat');
  }

  function enterChatWithTable(seedText: string, tableQuery: TableQuery, tableTitle?: string) {
    commitChatToHistory();
    setChatSeed(seedText);
    setChatChartId(null);
    setChatTableQuery(tableQuery);
    setChatTableTitle(tableTitle ?? seedText);
    setChatUserMessageCount(0);
    setChatPinnedCount(0);
    setMode('chat');
  }

  function handleChatPin(id: AnalyticsChartId) {
    onAddToDashboard(id);
    setSessionPinned((prev) => {
      const next = new Set(prev);
      next.add(id);
      return next;
    });
    setChatPinnedCount((c) => c + 1);
  }

  function handleResumeFromHistory(entry: ConversationEntry) {
    if (entry.tableQuery) {
      enterChatWithTable(entry.question, entry.tableQuery, entry.tableTitle ?? entry.question);
      return;
    }
    enterChat(entry.question, entry.chartId);
  }

  if (typeof document === 'undefined') return null;

  const isSideSheet = layout === 'side-sheet';

  const backdropStyle: React.CSSProperties = isSideSheet
    ? {
        position: 'fixed',
        inset: 0,
        zIndex: 1200,
        background: 'rgba(3, 28, 89, 0.08)',
      }
    : {
        position: 'fixed',
        inset: 0,
        zIndex: 1200,
        background: 'rgba(3, 28, 89, 0.25)',
        backdropFilter: 'blur(2px)',
      };

  const containerStyle: React.CSSProperties = isSideSheet
    ? {
        position: 'fixed',
        inset: 0,
        zIndex: 1201,
        display: 'flex',
        alignItems: 'stretch',
        justifyContent: 'flex-end',
        pointerEvents: 'none',
      }
    : {
        position: 'fixed',
        inset: 0,
        zIndex: 1201,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
        pointerEvents: 'none',
      };

  const panelStyle: React.CSSProperties = isSideSheet
    ? {
        pointerEvents: 'auto',
        width: 'min(540px, 100vw)',
        height: '100vh',
        display: 'flex',
        flexDirection: 'column',
        borderRadius: '16px 0 0 16px',
        background: '#fff',
        borderLeft: '1px solid var(--color-border-subtle)',
        boxShadow: '-12px 0 40px rgba(3,28,89,0.18), 0 0 0 1px rgba(58,48,40,0.04)',
        fontFamily: 'var(--font-primary)',
        overflow: 'hidden',
        position: 'relative',
      }
    : {
        pointerEvents: 'auto',
        width: 'min(960px, 95vw)',
        height: 'min(720px, 90vh)',
        display: 'flex',
        flexDirection: 'column',
        borderRadius: 16,
        background: '#fff',
        border: '1px solid var(--color-border-subtle)',
        boxShadow: '0 12px 40px rgba(3,28,89,0.18), 0 0 0 1px rgba(58,48,40,0.04)',
        fontFamily: 'var(--font-primary)',
        overflow: 'hidden',
        position: 'relative',
      };

  const panelMotion = isSideSheet
    ? {
        initial: { x: '100%' },
        animate: { x: 0 },
        exit: { x: '100%' },
        transition: { duration: 0.26, ease: [0.4, 0, 0.2, 1] as [number, number, number, number] },
      }
    : {
        initial: { opacity: 0, y: 24, scale: 0.97 },
        animate: { opacity: 1, y: 0, scale: 1 },
        exit: { opacity: 0, y: 16, scale: 0.97 },
        transition: { duration: 0.22, ease: [0.4, 0, 0.2, 1] as [number, number, number, number] },
      };

  return createPortal(
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            key="add-insight-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            onClick={onClose}
            style={backdropStyle}
          />

          <div key="add-insight-center" style={containerStyle}>
            <motion.div
              key="add-insight-panel"
              {...panelMotion}
              style={panelStyle}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  padding: '14px 18px',
                  borderBottom: '1px solid var(--color-border-subtle)',
                  flexShrink: 0,
                }}
              >
                {mode === 'chat' && (
                  <button
                    type="button"
                    onClick={exitChatToBrowse}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 4,
                      padding: '6px 10px',
                      borderRadius: 8,
                      border: '1px solid var(--color-border-subtle)',
                      background: '#fff',
                      cursor: 'pointer',
                      fontFamily: 'var(--font-primary)',
                      fontSize: 12,
                      fontWeight: 600,
                      color: 'var(--color-text-secondary)',
                    }}
                  >
                    <ChevronLeft size={14} />
                    Library
                  </button>
                )}

                <div style={{ display: 'flex', flexDirection: 'column', gap: 2, flex: 1, minWidth: 0 }}>
                  <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--color-text-primary)' }}>
                    {mode === 'chat' ? 'Ask Quinn' : 'Add to your dashboard'}
                  </span>
                  <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--color-text-muted)' }}>
                    {mode === 'chat'
                      ? 'Quinn will answer here. Pin any chart to your dashboard.'
                      : 'Chat with Quinn, or pick one of 180 curated questions.'}
                  </span>
                </div>

                {sessionPinned.size > 0 && (
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 5,
                      padding: '5px 10px',
                      borderRadius: 999,
                      background: 'rgba(22,101,52,0.10)',
                      color: '#166534',
                      fontSize: 11,
                      fontWeight: 700,
                    }}
                  >
                    <Pin size={11} strokeWidth={2.4} />
                    {sessionPinned.size} pinned this session
                  </div>
                )}

                <button
                  type="button"
                  onClick={() => {
                    commitChatToHistory();
                    onClose();
                  }}
                  aria-label="Close"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: 32,
                    height: 32,
                    borderRadius: 8,
                    border: 'none',
                    background: 'var(--color-bg-hover)',
                    cursor: 'pointer',
                  }}
                >
                  <X size={16} color="var(--color-text-muted)" />
                </button>
              </div>

              {mode === 'browse' ? (
                <QuestionLibraryPicker
                  query={query}
                  onQueryChange={setQuery}
                  onSubmit={(text) => enterChat(text)}
                  segment={segment}
                  subsegment={subsegment}
                  shape={shape}
                  onShapeChange={setShape}
                  onSegmentChange={setSegment}
                  onSubsegmentChange={setSubsegment}
                  briefingRole={briefingRole}
                  onPick={(entry) => {
                    const tableQuery = getQuestionTableQuery(entry.id, briefingRole);
                    const entryShape = questionShape(entry, briefingRole);
                    // 1. Explicit table filter + parent ready: hand straight to view.
                    if (tableQuery && onPickTable && shape === 'table') {
                      onPickTable(entry, tableQuery);
                      return;
                    }
                    // 2. Question supports both shapes and the user hasn't
                    //    pre-filtered: ask which one they want.
                    if (
                      tableQuery &&
                      entryShape === 'both' &&
                      shape === 'all'
                    ) {
                      setPendingShapeChoice({ entry, tableQuery });
                      return;
                    }
                    // 3. Have a table available + user wasn't filtering charts:
                    //    open chat with a table preview + pin/open CTAs.
                    if (
                      tableQuery &&
                      shape !== 'chart' &&
                      (entryShape === 'table' || entryShape === 'both')
                    ) {
                      enterChatWithTable(entry.text, tableQuery, entry.text);
                      return;
                    }
                    // 4. Fall back to chart/text chat.
                    enterChat(entry.text, resolveSuggestedChartId(entry, briefingRole));
                  }}
                  recentConversations={history}
                  onResumeConversation={handleResumeFromHistory}
                  onRemoveConversation={removeConversation}
                  onClearConversations={clearHistory}
                />
              ) : (
                <div
                  style={{
                    flex: 1,
                    display: 'flex',
                    flexDirection: 'column',
                    minHeight: 0,
                  }}
                >
                  <Feed
                    briefingRole={briefingRole}
                    noHeader
                    autoSendPrompt={chatSeed}
                    autoSendChartId={chatChartId}
                    autoSendTableQuery={chatTableQuery ?? undefined}
                    autoSendTableTitle={chatTableTitle || undefined}
                    alreadyPinned={effectivePinned}
                    onAddToDashboard={handleChatPin}
                    pinTarget={pinTarget}
                    pinTargets={pinTargets}
                    defaultPinTargetId={defaultPinTargetId}
                    onAddChartToTarget={
                      onAddChartToTarget
                        ? (chartId, targetId) => {
                            onAddChartToTarget(chartId, targetId);
                            setChatPinnedCount((c) => c + 1);
                          }
                        : undefined
                    }
                    onAddChartToNewView={
                      onAddChartToNewView
                        ? (chartId) => {
                            const newId = onAddChartToNewView(chartId);
                            setChatPinnedCount((c) => c + 1);
                            return newId;
                          }
                        : undefined
                    }
                    onUserMessageCountChange={setChatUserMessageCount}
                    onPinTable={
                      onPinTable
                        ? (info) => {
                            onPinTable(info);
                            // Treat pinning a table like pinning a chart for save
                            // heuristics in conversation history.
                            setChatPinnedCount((c) => c + 1);
                          }
                        : undefined
                    }
                    onOpenTableInNewView={
                      onOpenTableInNewView
                        ? (info) => {
                            onOpenTableInNewView(info);
                            commitChatToHistory();
                            onClose();
                          }
                        : undefined
                    }
                    onViewDashboard={() => {
                      commitChatToHistory();
                      onViewDashboard?.();
                      onClose();
                    }}
                  />
                </div>
              )}

              <AnimatePresence>
                {pendingShapeChoice && (
                  <ShapeChoiceOverlay
                    key="shape-choice"
                    questionText={pendingShapeChoice.entry.text}
                    onPickChart={() => {
                      const { entry } = pendingShapeChoice;
                      setPendingShapeChoice(null);
                      enterChat(entry.text, resolveSuggestedChartId(entry, briefingRole));
                    }}
                    onPickTable={() => {
                      const { entry, tableQuery } = pendingShapeChoice;
                      setPendingShapeChoice(null);
                      // Mirror the Chart branch: route via Quinn chat so the
                      // user sees a preview with pin/open CTAs, regardless of
                      // whether the parent supplied a direct add-to-view
                      // callback. Pinning from chat still goes through the
                      // parent's onPinTable to land on the active view.
                      enterChatWithTable(entry.text, tableQuery, entry.text);
                    }}
                    onCancel={() => setPendingShapeChoice(null)}
                  />
                )}
              </AnimatePresence>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>,
    document.body,
  );
}

function ShapeChoiceOverlay({
  questionText,
  onPickChart,
  onPickTable,
  onCancel,
}: {
  questionText: string;
  onPickChart: () => void;
  onPickTable: () => void;
  onCancel: () => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.14 }}
      style={{
        position: 'absolute',
        inset: 0,
        zIndex: 5,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(20, 16, 12, 0.32)',
        padding: 24,
      }}
      onClick={onCancel}
    >
      <motion.div
        initial={{ y: 12, opacity: 0, scale: 0.97 }}
        animate={{ y: 0, opacity: 1, scale: 1 }}
        exit={{ y: 8, opacity: 0, scale: 0.97 }}
        transition={{ duration: 0.18, ease: [0.4, 0, 0.2, 1] }}
        onClick={(e) => e.stopPropagation()}
        style={{
          background: '#fff',
          borderRadius: 14,
          padding: 22,
          maxWidth: 440,
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
          gap: 16,
          boxShadow: '0 16px 50px rgba(20,16,12,0.18)',
          fontFamily: 'var(--font-primary)',
        }}
      >
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--color-text-muted)', marginBottom: 6 }}>
            How should I show this?
          </div>
          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--color-text-primary)', lineHeight: 1.4 }}>
            {questionText}
          </div>
          <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--color-text-muted)', marginTop: 4 }}>
            This question can be answered as either a chart or a table.
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <button
            type="button"
            onClick={onPickChart}
            style={shapeChoiceButton}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--color-accent-active)';
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--color-border-subtle)';
            }}
          >
            <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--color-text-primary)' }}>Chart</span>
            <span style={{ fontSize: 11, fontWeight: 500, color: 'var(--color-text-muted)', lineHeight: 1.4 }}>
              Visual answer you can pin to a dashboard.
            </span>
          </button>
          <button
            type="button"
            onClick={onPickTable}
            style={shapeChoiceButton}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--color-accent-active)';
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--color-border-subtle)';
            }}
          >
            <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--color-text-primary)' }}>Table</span>
            <span style={{ fontSize: 11, fontWeight: 500, color: 'var(--color-text-muted)', lineHeight: 1.4 }}>
              Sortable rows you can pin to a view.
            </span>
          </button>
        </div>
        <button
          type="button"
          onClick={onCancel}
          style={{
            alignSelf: 'flex-end',
            background: 'transparent',
            border: 'none',
            cursor: 'pointer',
            color: 'var(--color-text-muted)',
            fontSize: 12,
            fontWeight: 600,
            padding: '4px 6px',
            fontFamily: 'var(--font-primary)',
          }}
        >
          Cancel
        </button>
      </motion.div>
    </motion.div>
  );
}

const shapeChoiceButton: React.CSSProperties = {
  all: 'unset',
  cursor: 'pointer',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'flex-start',
  gap: 4,
  padding: 14,
  borderRadius: 10,
  border: '1.5px solid var(--color-border-subtle)',
  background: '#fff',
  textAlign: 'left',
  transition: 'border-color 0.15s',
};
