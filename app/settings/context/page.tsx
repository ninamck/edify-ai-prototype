'use client';

/**
 * /settings/context — the "Context" tab under Configure settings.
 *
 * A single free-form "Company context for Edify" editor. The body is
 * persisted via `useCompanyContext()` and is read by any AI surface
 * (briefing panel, Quinn chat, suggested orders, forecasts) when
 * composing a recommendation, the way Claude reads a system prompt.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  CheckCircle2,
  ChevronRight,
  RotateCcw,
  Sparkles,
  X,
} from 'lucide-react';
import EdifyMark from '@/components/EdifyMark/EdifyMark';
import StatusPill from '@/components/Production/StatusPill';
import {
  EXAMPLE_COMPANY_CONTEXT,
  useCompanyContext,
} from '@/components/Settings/companyContextStore';

const SUGGESTION_TEMPLATES: Array<{ id: string; label: string; snippet: string }> = [
  { id: 'priorities', label: 'Business priorities',         snippet: '\n\n# Business priorities\n- ' },
  { id: 'constraints', label: 'Operational constraints',    snippet: '\n\n# Operational constraints\n- ' },
  { id: 'voice',       label: 'Brand voice',                snippet: '\n\n# Brand voice\n- ' },
  { id: 'callouts',    label: 'What Edify should call out', snippet: '\n\n# What Edify should call out\n- ' },
  { id: 'taboos',      label: 'What Edify should never suggest', snippet: '\n\n# What Edify should never suggest\n- ' },
];

export default function ContextSettingsPage() {
  const { context, isCustom, save, reset, restoreExample } = useCompanyContext();

  const [draft, setDraft] = useState<string>(context.body);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const taRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    setDraft(context.body);
  }, [context.body]);

  const dirty = draft !== context.body;
  const wordCount = useMemo(() => countWords(draft), [draft]);
  const charCount = draft.length;
  const updatedLabel = useMemo(() => formatUpdated(context.updatedAt), [context.updatedAt]);

  function commit() {
    save(draft);
    setSavedAt(new Date().toISOString());
  }

  function discard() {
    setDraft(context.body);
    setSavedAt(null);
  }

  function handleReset() {
    if (!window.confirm('Clear the company context? Edify will fall back to its built-in defaults.')) return;
    reset();
    setSavedAt(null);
  }

  function handleRestoreExample() {
    if (
      isCustom &&
      !window.confirm('Replace the current context with the example template? Your existing notes will be lost.')
    ) {
      return;
    }
    restoreExample();
    setSavedAt(null);
  }

  function insertSnippet(snippet: string) {
    const ta = taRef.current;
    const base = draft;
    if (!ta) {
      setDraft(base + snippet);
      return;
    }
    const start = ta.selectionStart ?? base.length;
    const end = ta.selectionEnd ?? base.length;
    const next = base.slice(0, start) + snippet + base.slice(end);
    setDraft(next);
    requestAnimationFrame(() => {
      const caret = start + snippet.length;
      ta.focus();
      ta.setSelectionRange(caret, caret);
    });
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', background: 'var(--color-bg-surface)' }}>
      <EditorHeader
        isCustom={isCustom}
        updatedLabel={updatedLabel}
        onReset={handleReset}
        onRestoreExample={handleRestoreExample}
      />

      {savedAt && (
        <SaveBanner updatedLabel={formatUpdated(savedAt)} onDismiss={() => setSavedAt(null)} />
      )}

      <div style={{ padding: '16px 16px 96px' }}>
        <div style={{ maxWidth: 880, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 14 }}>
          <ContextBlurb />
          <SuggestionBar onPick={insertSnippet} />
          <Editor
            value={draft}
            onChange={setDraft}
            wordCount={wordCount}
            charCount={charCount}
            updatedLabel={updatedLabel}
            textareaRef={taRef}
          />
        </div>
      </div>

      {dirty && <SaveBar wordCount={wordCount} onSave={commit} onDiscard={discard} />}
    </div>
  );
}

// ─── Header ──────────────────────────────────────────────────────────────────

function EditorHeader({
  isCustom,
  updatedLabel,
  onReset,
  onRestoreExample,
}: {
  isCustom: boolean;
  updatedLabel: string;
  onReset: () => void;
  onRestoreExample: () => void;
}) {
  return (
    <div
      style={{
        flexShrink: 0,
        padding: '14px 16px',
        borderBottom: '1px solid var(--color-border-subtle)',
        background: '#ffffff',
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        flexWrap: 'wrap',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
        <div
          style={{
            width: 32,
            height: 32,
            borderRadius: 8,
            background: 'var(--color-bg-hover)',
            color: 'var(--color-text-secondary)',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          <EdifyMark size={16} color="var(--color-text-secondary)" />
        </div>
        <div style={{ minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 14, fontWeight: 700 }}>Company context for Edify</span>
            {isCustom ? (
              <StatusPill tone="info" label="Active" size="xs" />
            ) : (
              <StatusPill tone="neutral" label="Not set" size="xs" />
            )}
          </div>
          <span style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>
            {isCustom
              ? `Last updated ${updatedLabel}. Edify re-reads these notes on every recommendation.`
              : 'Free-form notes Edify references when making recommendations — write whatever the AI should know about how you operate.'}
          </span>
        </div>
      </div>
      <div style={{ flex: 1 }} />
      <button
        type="button"
        onClick={onRestoreExample}
        style={ghostBtn()}
        title="Replace the current context with a starter template"
      >
        <Sparkles size={12} /> {isCustom ? 'Replace with example' : 'Use example template'}
      </button>
      {isCustom && (
        <button
          type="button"
          onClick={onReset}
          style={ghostBtn()}
          title="Clear the context — Edify falls back to its built-in defaults"
        >
          <RotateCcw size={12} /> Clear
        </button>
      )}
    </div>
  );
}

function ContextBlurb() {
  return (
    <div
      style={{
        padding: '12px 14px',
        borderRadius: 'var(--radius-card)',
        background: 'var(--color-info-light)',
        border: '1px solid var(--color-info)',
        color: 'var(--color-info)',
        display: 'flex',
        alignItems: 'flex-start',
        gap: 10,
        fontSize: 12,
      }}
    >
      <Sparkles size={14} style={{ marginTop: 2, flexShrink: 0 }} />
      <div style={{ minWidth: 0, color: 'var(--color-text-primary)' }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--color-info)' }}>What is this?</div>
        <div style={{ marginTop: 4, lineHeight: 1.5 }}>
          Think of this as the standing brief you&apos;d give a new manager on their first day. Priorities,
          constraints, things that change with the seasons, things Edify should never suggest. Anything written
          here is fed into every AI recommendation — suggested orders, briefings, forecasts and chat — so
          update it whenever your operating reality shifts.
        </div>
      </div>
    </div>
  );
}

function SuggestionBar({ onPick }: { onPick: (snippet: string) => void }) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
      <span
        style={{
          fontSize: 9.5,
          fontWeight: 700,
          color: 'var(--color-text-muted)',
          textTransform: 'uppercase',
          letterSpacing: '0.06em',
          marginRight: 4,
        }}
      >
        Add a section
      </span>
      {SUGGESTION_TEMPLATES.map(s => (
        <button key={s.id} type="button" onClick={() => onPick(s.snippet)} style={chipBtn()}>
          + {s.label}
        </button>
      ))}
    </div>
  );
}

function Editor({
  value,
  onChange,
  wordCount,
  charCount,
  updatedLabel,
  textareaRef,
}: {
  value: string;
  onChange: (v: string) => void;
  wordCount: number;
  charCount: number;
  updatedLabel: string;
  textareaRef: React.MutableRefObject<HTMLTextAreaElement | null>;
}) {
  return (
    <div
      style={{
        borderRadius: 'var(--radius-card)',
        border: '1px solid var(--color-border-subtle)',
        background: '#ffffff',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      <textarea
        ref={textareaRef}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={EXAMPLE_COMPANY_CONTEXT}
        spellCheck
        style={{
          width: '100%',
          minHeight: 440,
          padding: '16px 18px',
          border: 'none',
          outline: 'none',
          resize: 'vertical',
          fontFamily: 'var(--font-mono, ui-monospace, SFMono-Regular, Menlo, Consolas, monospace)',
          fontSize: 13,
          lineHeight: 1.6,
          color: 'var(--color-text-primary)',
          background: '#ffffff',
        }}
      />
      <div
        style={{
          padding: '8px 14px',
          borderTop: '1px solid var(--color-border-subtle)',
          background: 'var(--color-bg-surface)',
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          fontSize: 11,
          color: 'var(--color-text-muted)',
          flexWrap: 'wrap',
        }}
      >
        <span>{wordCount.toLocaleString()} word{wordCount === 1 ? '' : 's'}</span>
        <span style={{ opacity: 0.4 }}>·</span>
        <span>{charCount.toLocaleString()} chars</span>
        <span style={{ flex: 1 }} />
        <span>Last saved {updatedLabel}</span>
      </div>
    </div>
  );
}

function SaveBar({
  wordCount,
  onSave,
  onDiscard,
}: {
  wordCount: number;
  onSave: () => void;
  onDiscard: () => void;
}) {
  return (
    <div
      role="region"
      aria-label="Unsaved changes"
      style={{
        position: 'sticky',
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: 40,
        padding: '12px 16px',
        background: '#ffffff',
        borderTop: '1px solid var(--color-border)',
        boxShadow: '0 -8px 24px rgba(58,48,40,0.08)',
        display: 'flex',
        alignItems: 'center',
        gap: 10,
      }}
    >
      <ChevronRight size={14} color="var(--color-info)" />
      <span style={{ fontSize: 12, fontWeight: 700 }}>Unsaved changes</span>
      <span style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>
        Edits stay local until you commit. Discard rolls everything back. ({wordCount.toLocaleString()} word{wordCount === 1 ? '' : 's'})
      </span>
      <div style={{ flex: 1 }} />
      <button type="button" onClick={onDiscard} style={ghostBtn()}>Discard</button>
      <button type="button" onClick={onSave} style={primaryBtn()}>
        <CheckCircle2 size={12} /> Save context
      </button>
    </div>
  );
}

function SaveBanner({
  updatedLabel,
  onDismiss,
}: {
  updatedLabel: string;
  onDismiss: () => void;
}) {
  return (
    <div
      role="status"
      style={{
        flexShrink: 0,
        margin: '12px 16px 0',
        padding: '12px 14px',
        borderRadius: 'var(--radius-card)',
        background: 'var(--color-success-light)',
        border: '1px solid var(--color-success-border)',
        color: 'var(--color-success)',
        display: 'flex',
        alignItems: 'flex-start',
        gap: 12,
      }}
    >
      <CheckCircle2 size={16} style={{ marginTop: 1, flexShrink: 0 }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 12, fontWeight: 700 }}>Company context saved</div>
        <div style={{ marginTop: 2, fontSize: 11, color: 'var(--color-text-primary)' }}>
          Edify will reference the new notes on its next recommendation. Saved {updatedLabel}.
        </div>
      </div>
      <button
        type="button"
        onClick={onDismiss}
        aria-label="Dismiss"
        style={{
          width: 24,
          height: 24,
          borderRadius: 6,
          border: '1px solid transparent',
          background: 'transparent',
          color: 'var(--color-success)',
          cursor: 'pointer',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <X size={14} />
      </button>
    </div>
  );
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function countWords(s: string): number {
  const trimmed = s.trim();
  if (!trimmed) return 0;
  return trimmed.split(/\s+/).length;
}

function formatUpdated(iso: string | null): string {
  if (!iso) return 'never';
  try {
    const d = new Date(iso);
    return d.toLocaleString(undefined, {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return 'just now';
  }
}

// ─── Button + chip styles (consistent with SiteSettingsEditor) ───────────────

function ghostBtn(): React.CSSProperties {
  return {
    padding: '8px 12px',
    borderRadius: 8,
    fontSize: 11,
    fontWeight: 700,
    fontFamily: 'var(--font-primary)',
    background: '#ffffff',
    color: 'var(--color-text-secondary)',
    border: '1px solid var(--color-border)',
    cursor: 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    whiteSpace: 'nowrap',
  };
}

function primaryBtn(): React.CSSProperties {
  return {
    padding: '8px 14px',
    borderRadius: 8,
    fontSize: 11,
    fontWeight: 700,
    fontFamily: 'var(--font-primary)',
    background: 'var(--color-accent-active)',
    color: 'var(--color-text-on-active)',
    border: '1px solid var(--color-accent-active)',
    cursor: 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    whiteSpace: 'nowrap',
  };
}

function chipBtn(): React.CSSProperties {
  return {
    padding: '6px 10px',
    borderRadius: 999,
    fontSize: 11,
    fontWeight: 600,
    fontFamily: 'var(--font-primary)',
    background: '#ffffff',
    color: 'var(--color-text-secondary)',
    border: '1px solid var(--color-border-subtle)',
    cursor: 'pointer',
    whiteSpace: 'nowrap',
  };
}
