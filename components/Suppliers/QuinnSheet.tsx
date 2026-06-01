'use client';

/**
 * Right-anchored Quinn agent sheet for the Suppliers area.
 *
 * The sheet runs scripted flows from `flows.ts`. Every Quinn turn presents:
 *   - A short message
 *   - Optional helper / context line
 *   - Tappable option pills (no typing required for common paths)
 *
 * When a flow reaches an `apply` step, the sheet renders the intent's
 * Impact preview card followed by Confirm / Not now buttons. Confirming
 * commits the intent against the store, captures a snapshot for Undo, and
 * shows a green success banner with an Undo button.
 *
 * A free-text input sits at the bottom; pressing Enter (or send) restarts
 * the flow as a global flow seeded with the typed sentence so users can talk
 * to Quinn in natural language at any point.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Send, Check, Undo2 } from 'lucide-react';
import EdifyMark from '@/components/EdifyMark/EdifyMark';
import { useProducts, useSuppliers, useMasterProducts } from './store';
import {
  startProductScopedFlow,
  startSupplierScopedFlow,
  startBulkProductFlow,
  startGlobalFlow,
  type Step,
  type Option,
  type FlowContext,
} from './flows';
import { undo as undoIntent } from './quinnIntents';

export type QuinnScope =
  | { kind: 'global'; seed?: string }
  | { kind: 'product'; productId: string }
  | { kind: 'supplier'; supplierId: string }
  | { kind: 'bulk-products'; selectedIds: string[] };

export type QuinnSuggestion = { label: string; seed: string };

type Turn =
  | { from: 'quinn'; text: string; helper?: string }
  | { from: 'user'; text: string };

export default function QuinnSheet({
  open,
  scope,
  onClose,
  suggestions,
}: {
  open: boolean;
  scope: QuinnScope | null;
  onClose: () => void;
  /** Starter prompts shown above the conversation when the sheet opens
   *  fresh in the global scope. Tapping a chip re-seeds the global flow
   *  with the suggestion's sentence — same path as typing it and pressing
   *  Enter in the input box below. */
  suggestions?: QuinnSuggestion[];
}) {
  const products = useProducts();
  const suppliers = useSuppliers();
  const masterProducts = useMasterProducts();

  const ctx: FlowContext = useMemo(
    () => ({ products, suppliers, masterProducts }),
    [products, suppliers, masterProducts],
  );

  const [history, setHistory] = useState<Turn[]>([]);
  const [step, setStep] = useState<Step | null>(null);
  const [input, setInput] = useState('');
  const [success, setSuccess] = useState<{
    message: string;
    prevState: ReturnType<typeof import('./store').snapshot>;
  } | null>(null);
  const [mounted, setMounted] = useState(false);
  const scrollerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => { setMounted(true); }, []);

  // Reset the chat whenever the sheet opens with a new scope.
  useEffect(() => {
    if (!open || !scope) return;
    setHistory([]);
    setSuccess(null);
    setInput('');
    if (scope.kind === 'product') setStep(startProductScopedFlow(ctx, scope.productId));
    else if (scope.kind === 'supplier') setStep(startSupplierScopedFlow(ctx, scope.supplierId));
    else if (scope.kind === 'bulk-products') setStep(startBulkProductFlow(ctx, scope.selectedIds));
    else setStep(startGlobalFlow(ctx, scope.seed));
    // We intentionally only watch open + scope here; ctx changes on every
    // store mutation and would otherwise wipe the conversation mid-chat.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, scope]);

  // Keep the scroller pinned to the bottom as the conversation grows.
  useEffect(() => {
    const node = scrollerRef.current;
    if (!node) return;
    node.scrollTop = node.scrollHeight;
  }, [history, step, success]);

  function pickOption(opt: Option) {
    if (step?.kind === 'quinn') {
      setHistory((h) => [...h, { from: 'quinn', text: step.text, helper: step.helper }, { from: 'user', text: opt.label }]);
    }
    setStep(opt.next());
  }

  function applyIntent() {
    if (step?.kind !== 'apply') return;
    const result = step.intent.commit();
    if (!result) {
      // No-op (e.g. already in the target state). Show a soft success banner
      // so the user sees something happened.
      setSuccess({ message: 'Nothing to change.', prevState: { suppliers, products, masterProducts } });
      return;
    }
    setHistory((h) => [...h, { from: 'quinn', text: step.intent.title }, { from: 'user', text: step.intent.confirmLabel }]);
    setSuccess(result);
    setStep(null);
  }

  function backFromIntent() {
    if (step?.kind === 'apply' && step.back) {
      setStep(step.back());
    }
  }

  function submitInput() {
    const trimmed = input.trim();
    if (!trimmed) return;
    setHistory((h) => [...h, { from: 'user', text: trimmed }]);
    setInput('');
    setSuccess(null);
    setStep(startGlobalFlow(ctx, trimmed));
  }

  function performUndo() {
    if (!success) return;
    undoIntent(success.prevState);
    setSuccess(null);
    setHistory((h) => [...h, { from: 'quinn', text: 'Undone. Back to where we were.' }]);
    // Re-enter the same scope so the user can keep going.
    if (scope) {
      if (scope.kind === 'product') setStep(startProductScopedFlow(ctx, scope.productId));
      else if (scope.kind === 'supplier') setStep(startSupplierScopedFlow(ctx, scope.supplierId));
      else if (scope.kind === 'bulk-products') setStep(startBulkProductFlow(ctx, scope.selectedIds));
      else setStep(startGlobalFlow(ctx, scope.seed));
    }
  }

  if (!mounted || !open) return null;

  return createPortal(
    <>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.15 }}
        onClick={onClose}
        style={{ position: 'fixed', inset: 0, background: 'rgba(0, 28, 53,0.18)', zIndex: 800 }}
      />
      <motion.aside
        initial={{ x: '100%' }}
        animate={{ x: 0 }}
        exit={{ x: '100%' }}
        transition={{ duration: 0.22, ease: [0.25, 0.1, 0.25, 1] }}
        role="dialog"
        aria-label="Ask Edify"
        style={{
          position: 'fixed', top: 0, right: 0, bottom: 0,
          width: 'min(480px, 100vw)',
          background: '#fff',
          boxShadow: '-20px 0 60px rgba(0, 28, 53,0.16)',
          zIndex: 801,
          display: 'flex', flexDirection: 'column',
          fontFamily: 'var(--font-primary)',
        }}
      >
        {/* Header */}
        <div style={{
          padding: '14px 16px',
          borderBottom: '1px solid var(--color-border-subtle)',
          display: 'flex', alignItems: 'center', gap: '10px',
          background: 'linear-gradient(180deg, #FEFCF9 0%, #fff 100%)',
        }}>
          <div style={{
            width: 32, height: 32, borderRadius: '50%',
            background: 'var(--color-quinn-bg)',
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0,
          }}>
            <EdifyMark size={14} color="var(--color-accent-quinn)" strokeWidth={2.2} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', color: 'var(--color-accent-active)' }}>
              QUINN
            </div>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text-primary)' }}>
              {scopeLabel(scope)}
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            style={iconBtnStyle}
          >
            <X size={16} />
          </button>
        </div>

        {/* Conversation */}
        <div
          ref={scrollerRef}
          style={{ flex: 1, overflowY: 'auto', padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}
        >
          {history.map((t, i) => (
            <TurnBubble key={i} turn={t} />
          ))}

          {/* Starter prompt chips — shown only when the sheet was opened
              fresh from the page-level "Ask Quinn" button (global scope,
              no seed) and the user hasn't picked anything yet. They give
              the user the same one-tap shortcuts the old hero card did,
              now without consuming list real-estate. */}
          {suggestions && suggestions.length > 0
            && history.length === 0
            && !success
            && scope?.kind === 'global'
            && !scope.seed && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 4 }}>
                <div style={{
                  fontSize: 11, fontWeight: 700, letterSpacing: '0.06em',
                  textTransform: 'uppercase', color: 'var(--color-text-muted)',
                  marginBottom: 2,
                }}>
                  Quick prompts
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {suggestions.map((s, i) => (
                    <button
                      key={i}
                      onClick={() => {
                        setHistory((h) => [...h, { from: 'user', text: s.label }]);
                        setInput('');
                        setSuccess(null);
                        setStep(startGlobalFlow(ctx, s.seed));
                      }}
                      style={suggestionChipStyle}
                      onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--color-bg-hover)'; }}
                      onMouseLeave={(e) => { e.currentTarget.style.background = '#fff'; }}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

          {step?.kind === 'quinn' && (
            <>
              <QuinnBubble text={step.text} helper={step.helper} />
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 4 }}>
                {step.options.map((opt, i) => (
                  <OptionPill key={i} opt={opt} onClick={() => pickOption(opt)} />
                ))}
              </div>
            </>
          )}

          {step?.kind === 'apply' && (
            <>
              <QuinnBubble text={step.intent.title} />
              <ImpactPreview lines={step.intent.preview} variant={step.intent.variant} />
              <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
                <button onClick={backFromIntent} style={secondaryBtnStyle}>
                  {step.backLabel ?? 'Not now'}
                </button>
                <button onClick={applyIntent} style={primaryBtnStyle}>
                  {step.intent.confirmLabel}
                </button>
              </div>
            </>
          )}

          {step?.kind === 'success' && (
            <SuccessBanner message={step.message} />
          )}

          {success && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <SuccessBanner message={success.message} />
              <button onClick={performUndo} style={undoBtnStyle}>
                <Undo2 size={13} strokeWidth={2.4} /> Undo
              </button>
              <button
                onClick={() => {
                  // Re-enter the scope so the user can keep going.
                  if (!scope) return;
                  if (scope.kind === 'product') setStep(startProductScopedFlow(ctx, scope.productId));
                  else if (scope.kind === 'supplier') setStep(startSupplierScopedFlow(ctx, scope.supplierId));
                  else if (scope.kind === 'bulk-products') setStep(startBulkProductFlow(ctx, scope.selectedIds));
                  else setStep(startGlobalFlow(ctx, scope.seed));
                  setSuccess(null);
                }}
                style={secondaryBtnStyle}
              >
                Do something else
              </button>
            </div>
          )}
        </div>

        {/* Free-text input */}
        <div style={{ borderTop: '1px solid var(--color-border-subtle)', padding: '10px 12px' }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '8px 10px',
            borderRadius: 12,
            background: 'var(--color-bg-hover)',
            border: '1px solid var(--color-border-subtle)',
          }}>
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') submitInput(); }}
              placeholder="Tell Quinn what to do\u2026"
              style={{
                border: 'none', outline: 'none', background: 'transparent',
                flex: 1, fontSize: 13, fontFamily: 'var(--font-primary)',
                color: 'var(--color-text-primary)',
              }}
            />
            <button
              onClick={submitInput}
              aria-label="Send"
              disabled={!input.trim()}
              style={{
                width: 30, height: 30, borderRadius: 8, border: 'none',
                background: input.trim() ? 'var(--color-accent-active)' : 'var(--color-border)',
                color: '#fff', cursor: input.trim() ? 'pointer' : 'not-allowed',
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <Send size={14} />
            </button>
          </div>
        </div>
      </motion.aside>
    </>,
    document.body,
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Sub-components

function scopeLabel(scope: QuinnScope | null): string {
  if (!scope) return 'Ask Edify';
  if (scope.kind === 'product') return 'Editing a product';
  if (scope.kind === 'supplier') return 'Editing a supplier';
  if (scope.kind === 'bulk-products') return `${scope.selectedIds.length} products selected`;
  return 'Ask Edify anything';
}

function TurnBubble({ turn }: { turn: Turn }) {
  if (turn.from === 'quinn') return <QuinnBubble text={turn.text} helper={turn.helper} muted />;
  return (
    <div style={{ alignSelf: 'flex-end', maxWidth: '85%' }}>
      <div style={{
        padding: '8px 12px',
        borderRadius: 14,
        background: 'var(--color-accent-active)',
        color: '#fff',
        fontSize: 13, fontWeight: 500,
        borderBottomRightRadius: 4,
      }}>
        {turn.text}
      </div>
    </div>
  );
}

function QuinnBubble({ text, helper, muted }: { text: string; helper?: string; muted?: boolean }) {
  return (
    <div style={{ alignSelf: 'flex-start', maxWidth: '90%', display: 'flex', gap: 8 }}>
      <div style={{
        width: 24, height: 24, borderRadius: '50%',
        background: 'var(--color-quinn-bg)',
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        flexShrink: 0,
        opacity: muted ? 0.6 : 1,
      }}>
        <EdifyMark size={11} color="var(--color-accent-quinn)" strokeWidth={2.4} />
      </div>
      <div>
        <div style={{
          padding: '8px 12px',
          borderRadius: 14,
          background: 'var(--color-bg-hover)',
          color: 'var(--color-text-primary)',
          fontSize: 13, fontWeight: 500,
          borderBottomLeftRadius: 4,
          opacity: muted ? 0.85 : 1,
        }} dangerouslySetInnerHTML={{ __html: renderMarkdown(text) }} />
        {helper && (
          <div style={{
            fontSize: 11.5,
            color: 'var(--color-text-muted)',
            padding: '4px 12px 0',
          }}>
            {helper}
          </div>
        )}
      </div>
    </div>
  );
}

function OptionPill({ opt, onClick }: { opt: Option; onClick: () => void }) {
  const danger = opt.emphasis === 'danger';
  const primary = opt.emphasis === 'primary';
  return (
    <button
      onClick={onClick}
      style={{
        textAlign: 'left',
        padding: '9px 12px',
        borderRadius: 10,
        border: '1px solid ' + (danger ? 'var(--color-error-border)' : primary ? 'transparent' : 'var(--color-border-subtle)'),
        background: primary ? 'var(--color-accent-active)' : '#fff',
        color: primary ? '#fff' : danger ? 'var(--color-error)' : 'var(--color-text-primary)',
        fontSize: 13, fontWeight: 600,
        cursor: 'pointer',
        fontFamily: 'var(--font-primary)',
      }}
    >
      {opt.label}
    </button>
  );
}

function ImpactPreview({ lines, variant }: { lines: string[]; variant?: 'info' | 'warn' }) {
  const warn = variant === 'warn';
  return (
    <div style={{
      borderRadius: 10,
      padding: '12px 14px',
      background: warn ? 'var(--color-warning-light)' : 'var(--color-bg-hover)',
      border: '1px solid ' + (warn ? 'var(--color-warning-border)' : 'var(--color-border-subtle)'),
      fontSize: 12.5,
      color: 'var(--color-text-secondary)',
      lineHeight: 1.5,
      display: 'flex', flexDirection: 'column', gap: 6,
    }}>
      <div style={{
        fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase',
        color: warn ? 'var(--color-warning)' : 'var(--color-text-muted)',
      }}>
        Impact preview
      </div>
      {lines.map((l, i) => (
        <div key={i}>{l}</div>
      ))}
    </div>
  );
}

function SuccessBanner({ message }: { message: string }) {
  return (
    <div style={{
      borderRadius: 10,
      padding: '10px 12px',
      background: 'var(--color-success-light)',
      border: '1px solid var(--color-success-border)',
      color: 'var(--color-success)',
      fontSize: 13, fontWeight: 600,
      display: 'flex', alignItems: 'center', gap: 8,
    }}>
      <Check size={14} strokeWidth={2.6} />
      {message}
    </div>
  );
}

/**
 * Tiny markdown renderer — only handles **bold** so Quinn can emphasise
 * names without pulling in a real markdown library.
 */
function renderMarkdown(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
}

const iconBtnStyle: React.CSSProperties = {
  width: 30, height: 30, borderRadius: 8, border: 'none', background: 'transparent',
  cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
  color: 'var(--color-text-muted)',
};

const primaryBtnStyle: React.CSSProperties = {
  flex: 1,
  padding: '10px 14px',
  borderRadius: 10,
  border: 'none',
  background: 'var(--color-accent-active)',
  color: '#fff',
  fontSize: 13, fontWeight: 700,
  cursor: 'pointer',
  fontFamily: 'var(--font-primary)',
};

const secondaryBtnStyle: React.CSSProperties = {
  padding: '10px 14px',
  borderRadius: 10,
  border: '1px solid var(--color-border)',
  background: '#fff',
  color: 'var(--color-text-primary)',
  fontSize: 13, fontWeight: 600,
  cursor: 'pointer',
  fontFamily: 'var(--font-primary)',
};

const undoBtnStyle: React.CSSProperties = {
  alignSelf: 'flex-start',
  display: 'inline-flex', alignItems: 'center', gap: 6,
  padding: '6px 10px',
  borderRadius: 100,
  border: '1px solid var(--color-border)',
  background: '#fff',
  color: 'var(--color-text-primary)',
  fontSize: 12, fontWeight: 700,
  cursor: 'pointer',
  fontFamily: 'var(--font-primary)',
};

const suggestionChipStyle: React.CSSProperties = {
  padding: '6px 12px',
  borderRadius: 100,
  border: '1px solid var(--color-border-subtle)',
  background: '#fff',
  color: 'var(--color-text-secondary)',
  fontSize: 12, fontWeight: 600,
  cursor: 'pointer',
  fontFamily: 'var(--font-primary)',
  transition: 'background 120ms ease',
};

// Silence "unused" warning when the file is bundled but the named import is
// only used at type level.
void AnimatePresence;
