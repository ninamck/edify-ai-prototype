'use client';

import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ChevronLeft, Pin } from 'lucide-react';
import Feed from '@/components/Feed/Feed';
import QuestionLibraryPicker, { type SegmentKey } from '@/components/Dashboard/QuestionLibraryPicker';
import {
  QUESTION_LIBRARY,
  type ProductionSubsegment,
} from '@/components/Dashboard/data/questionLibrary';
import type { AnalyticsChartId } from '@/components/Analytics/AnalyticsCharts';
import type { BriefingRole } from '@/components/briefing';

function resolveChartId(text: string): AnalyticsChartId | null {
  const entry = QUESTION_LIBRARY.find((q) => q.text === text);
  return entry?.suggestedChartId ?? null;
}

export default function AddInsightPopup({
  open,
  onClose,
  briefingRole,
  onAddToDashboard,
  onViewDashboard,
  alreadyPinned,
}: {
  open: boolean;
  onClose: () => void;
  briefingRole: BriefingRole;
  onAddToDashboard: (id: AnalyticsChartId) => void;
  /** Called when user clicks "View dashboard" after pinning a chart in chat. */
  onViewDashboard?: () => void;
  alreadyPinned: Set<AnalyticsChartId>;
}) {
  const [mode, setMode] = useState<'browse' | 'chat'>('browse');
  const [segment, setSegment] = useState<SegmentKey>('all');
  const [subsegment, setSubsegment] = useState<ProductionSubsegment | null>(null);
  const [query, setQuery] = useState('');
  const [sessionPinned, setSessionPinned] = useState<Set<AnalyticsChartId>>(new Set());
  const [chatSeed, setChatSeed] = useState<string>('');
  const [chatChartId, setChatChartId] = useState<AnalyticsChartId | null>(null);

  const effectivePinned = useMemo(() => {
    const s = new Set<AnalyticsChartId>(alreadyPinned);
    for (const id of sessionPinned) s.add(id);
    return s;
  }, [alreadyPinned, sessionPinned]);

  // Reset on close
  useEffect(() => {
    if (open) return;
    setMode('browse');
    setSegment('all');
    setSubsegment(null);
    setQuery('');
    setSessionPinned(new Set());
    setChatSeed('');
    setChatChartId(null);
  }, [open]);

  // Esc: chat → back to library; library → close
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key !== 'Escape') return;
      if (mode === 'chat') {
        setMode('browse');
        setChatSeed('');
        setChatChartId(null);
      } else {
        onClose();
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, mode, onClose]);

  function enterChat(text: string, explicitChart?: AnalyticsChartId | null) {
    setChatSeed(text);
    setChatChartId(explicitChart === undefined ? resolveChartId(text) : explicitChart);
    setMode('chat');
  }

  function handleChatPin(id: AnalyticsChartId) {
    onAddToDashboard(id);
    setSessionPinned((prev) => {
      const next = new Set(prev);
      next.add(id);
      return next;
    });
  }

  if (typeof document === 'undefined') return null;

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
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 1200,
              background: 'rgba(3, 28, 89, 0.25)',
              backdropFilter: 'blur(2px)',
            }}
          />

          <div
            key="add-insight-center"
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 1201,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 16,
              pointerEvents: 'none',
            }}
          >
            <motion.div
              key="add-insight-panel"
              initial={{ opacity: 0, y: 24, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 16, scale: 0.97 }}
              transition={{ duration: 0.22, ease: [0.4, 0, 0.2, 1] }}
              style={{
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
              }}
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
                    onClick={() => {
                      setMode('browse');
                      setChatSeed('');
                      setChatChartId(null);
                    }}
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
                  onClick={onClose}
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
                  onSegmentChange={setSegment}
                  onSubsegmentChange={setSubsegment}
                  onPick={(entry) => enterChat(entry.text, entry.suggestedChartId ?? null)}
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
                    alreadyPinned={effectivePinned}
                    onAddToDashboard={handleChatPin}
                    onViewDashboard={() => {
                      onViewDashboard?.();
                      onClose();
                    }}
                  />
                </div>
              )}
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>,
    document.body,
  );
}
