'use client';

import { useState, useEffect, type ReactNode } from 'react';
import {
  Send,
  Sparkles,
  Maximize2,
  Minimize2,
  Plus,
  Mic,
  ChevronDown,
  ChefHat,
  BarChart3,
  ClipboardList,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import QuinnOrb from '@/components/Sidebar/QuinnOrb';
import RecipeChatWorking, { RECIPE_EDIFY_TASKS } from '@/components/Feed/RecipeChatWorking';
import type { BriefingRole } from '@/components/briefing';
import { timeAwareGreeting } from '@/components/briefing';

function QuinnAvatar({
  size = 30,
  mode = 'sparkle',
}: {
  size?: number;
  mode?: 'sparkle' | 'thinking' | 'ready';
}) {
  if (mode === 'thinking' || mode === 'ready') {
    return (
      <div style={{
        width: size,
        height: size,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
      }}>
        <QuinnOrb state={mode} size={size} />
      </div>
    );
  }
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%',
      background: 'var(--color-quinn-bg)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      flexShrink: 0,
    }}>
      <Sparkles size={size * 0.45} color="var(--color-accent-quinn)" strokeWidth={2} />
    </div>
  );
}

function Hi({ children }: { children: ReactNode }) {
  return (
    <span style={{ fontWeight: 700, color: 'var(--color-text-primary)' }}>
      {children}
    </span>
  );
}

const PLACEHOLDER = 'How can I help you today?';

const PROMPT_CHIPS: {
  label: string;
  icon: typeof ChefHat;
  text: string;
}[] = [
  {
    label: 'New recipe',
    icon: ChefHat,
    text: 'I want to add a new recipe for our weekend brunch menu — walk me through ingredients, costing, and production.',
  },
  {
    label: 'Food cost',
    icon: BarChart3,
    text: 'Help me understand our food cost % vs target for this week.',
  },
  {
    label: 'Floor priority',
    icon: ClipboardList,
    text: 'What should the floor team prioritise this morning?',
  },
];

type ChatMsg = { id: string; role: 'user' | 'quinn'; text: string };

const QUINN_RECIPE_REPLY =
  "Happy to help you add a brunch recipe. Here's a simple path:\n\n" +
  '1. **Ingredients** — List each ingredient with quantity and unit; I\'ll match against your supplier catalogue.\n' +
  '2. **Costing** — I\'ll pull latest prices from Bidfood and Urban Fresh and calculate food cost %.\n' +
  '3. **Production** — Once you confirm, I can add it to the weekend plan and prep sheets.\n\n' +
  'What dish are you thinking — name and key ingredients?';

const QUINN_RECIPE_DONE =
  '**Done — your recipe is in Edify.**\n\n' +
  'I matched everything to Bidfood & Urban Fresh, pulled today’s contract prices, and landed **food cost at 34%** against your brunch target (under your 38% ceiling).\n\n' +
  'The recipe card is in **Fitzroy Espresso → Recipes** and I’ve queued it for **Saturday brunch prep** with quantities scaled for covers. Open **Production → Weekend plan** to tweak portions or ping the kitchen.';

function QuinnMessageBody({ text }: { text: string }) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return (
    <>
      {parts.map((seg, i) => {
        const bold = seg.match(/^\*\*(.+)\*\*$/);
        if (bold) return <Hi key={i}>{bold[1]}</Hi>;
        return <span key={i}>{seg}</span>;
      })}
    </>
  );
}

function ChatBubble({ msg }: { msg: ChatMsg }) {
  const isUser = msg.role === 'user';
  return (
    <div style={{
      display: 'flex',
      justifyContent: isUser ? 'flex-end' : 'flex-start',
      marginBottom: '12px',
    }}>
      <div style={{
        maxWidth: '88%',
        padding: '11px 14px',
        borderRadius: isUser ? '14px 14px 4px 14px' : '14px 14px 14px 4px',
        background: isUser ? 'var(--color-bg-surface)' : '#fff',
        border: '1px solid var(--color-border-subtle)',
        boxShadow: isUser ? 'none' : '0 1px 3px rgba(58,48,40,0.06)',
        fontSize: '13.5px',
        lineHeight: 1.6,
        color: 'var(--color-text-secondary)',
        whiteSpace: 'pre-wrap',
      }}>
        {!isUser && (
          <div style={{ fontSize: '10px', fontWeight: 700, color: 'var(--color-accent-quinn)', marginBottom: '6px', letterSpacing: '0.04em' }}>
            QUINN
          </div>
        )}
        {isUser ? msg.text : <QuinnMessageBody text={msg.text} />}
      </div>
    </div>
  );
}

type ComposerProps = {
  value: string;
  onChange: (v: string) => void;
  onSend: () => void;
  disabled: boolean;
  placeholder: string;
  minHeight: number;
};

function ClaudeComposer({
  value,
  onChange,
  onSend,
  disabled,
  placeholder,
  minHeight,
}: ComposerProps) {
  const hasText = value.trim().length > 0;

  return (
    <div
      style={{
        width: '100%',
        background: '#fff',
        borderRadius: '20px',
        border: '1px solid rgba(58,48,40,0.1)',
        boxShadow: '0 8px 32px rgba(58,48,40,0.07), 0 2px 8px rgba(58,48,40,0.04)',
        overflow: 'hidden',
      }}
    >
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            onSend();
          }
        }}
        placeholder={placeholder}
        disabled={disabled}
        rows={2}
        style={{
          width: '100%',
          boxSizing: 'border-box',
          minHeight,
          padding: '12px 16px 8px',
          border: 'none',
          outline: 'none',
          resize: 'none',
          fontSize: '14px',
          color: 'var(--color-text-primary)',
          background: 'transparent',
          fontFamily: 'var(--font-primary)',
          lineHeight: 1.55,
        }}
      />
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '4px 8px 8px 10px',
          gap: '6px',
          borderTop: '1px solid var(--color-border-subtle)',
        }}
      >
        <button
          type="button"
          aria-label="Add attachment"
          disabled={disabled}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '32px',
            height: '32px',
            borderRadius: '10px',
            border: 'none',
            background: 'transparent',
            cursor: disabled ? 'not-allowed' : 'pointer',
            color: 'var(--color-text-muted)',
          }}
        >
          <Plus size={18} strokeWidth={2} />
        </button>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flex: 1, justifyContent: 'flex-end' }}>
          <button
            type="button"
            aria-label="Model"
            disabled={disabled}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              padding: '6px 10px',
              borderRadius: '100px',
              border: 'none',
              background: 'transparent',
              cursor: disabled ? 'not-allowed' : 'pointer',
              fontSize: '12px',
              fontWeight: 600,
              color: 'var(--color-text-secondary)',
              fontFamily: 'var(--font-primary)',
            }}
          >
            Quinn
            <ChevronDown size={14} color="var(--color-text-muted)" strokeWidth={2.2} />
          </button>
          <button
            type="button"
            aria-label="Voice input"
            disabled={disabled}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '32px',
              height: '32px',
              borderRadius: '10px',
              border: 'none',
              background: 'transparent',
              cursor: disabled ? 'not-allowed' : 'pointer',
              color: 'var(--color-text-muted)',
            }}
          >
            <Mic size={16} strokeWidth={2} />
          </button>
          {hasText && (
            <button
              type="button"
              onClick={onSend}
              disabled={disabled}
              aria-label="Send"
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '32px',
                height: '32px',
                borderRadius: '10px',
                border: 'none',
                background: 'var(--color-accent-deep)',
                cursor: disabled ? 'not-allowed' : 'pointer',
                flexShrink: 0,
              }}
            >
              <Send size={14} color="#F4F1EC" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default function Feed({
  briefingRole,
  quinnExpanded = false,
  onToggleQuinnExpand,
}: {
  briefingRole: BriefingRole;
  quinnExpanded?: boolean;
  onToggleQuinnExpand?: () => void;
}) {
  const [chatStarted, setChatStarted] = useState(false);
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [input, setInput] = useState('');
  const [recipeWorking, setRecipeWorking] = useState(false);
  const [workStep, setWorkStep] = useState(0);
  const [headerOrbMode, setHeaderOrbMode] = useState<'sparkle' | 'thinking' | 'ready'>('sparkle');

  const recipeTaskCount = RECIPE_EDIFY_TASKS.length;
  const greeting = timeAwareGreeting(briefingRole);

  useEffect(() => {
    if (!recipeWorking) return;

    if (workStep < recipeTaskCount) {
      const t = window.setTimeout(() => setWorkStep((s) => s + 1), 880);
      return () => clearTimeout(t);
    }

    if (workStep === recipeTaskCount) {
      const t = window.setTimeout(() => {
        setHeaderOrbMode('ready');
        setMessages((prev) => [
          ...prev,
          { id: `q-recipe-done-${Date.now()}`, role: 'quinn', text: QUINN_RECIPE_DONE },
        ]);
        setRecipeWorking(false);
        setWorkStep(0);
        window.setTimeout(() => setHeaderOrbMode('sparkle'), 1200);
      }, 700);
      return () => clearTimeout(t);
    }
  }, [recipeWorking, workStep, recipeTaskCount]);

  function sendMessage(overrideText?: string) {
    const raw = overrideText !== undefined ? overrideText : input;
    const text = raw.trim();
    if (!text) return;
    if (recipeWorking) return;

    const userMsg: ChatMsg = { id: `u-${Date.now()}`, role: 'user', text };
    const nextMessages = [...messages, userMsg];
    const userCount = nextMessages.filter((m) => m.role === 'user').length;

    setChatStarted(true);
    setMessages(nextMessages);
    setInput('');

    if (userCount === 1) {
      window.setTimeout(() => {
        setMessages((prev) => [
          ...prev,
          { id: `q-${Date.now()}`, role: 'quinn', text: QUINN_RECIPE_REPLY },
        ]);
      }, 450);
    } else {
      setRecipeWorking(true);
      setWorkStep(0);
      setHeaderOrbMode('thinking');
    }
  }

  const composerDisabled = recipeWorking;
  const composerPlaceholder = recipeWorking ? 'Quinn is working in Edify…' : PLACEHOLDER;
  const composerMinH = chatStarted ? 40 : 72;

  const showHeader = quinnExpanded || chatStarted || recipeWorking;

  return (
    <div style={{
      flex: 1,
      display: 'flex',
      flexDirection: 'column',
      minHeight: 0,
      minWidth: 0,
      height: '100%',
      width: '100%',
      maxWidth: 'min(680px, 100%)',
      margin: '0 auto',
      background: quinnExpanded ? 'var(--color-bg-nav)' : 'transparent',
      borderRadius: quinnExpanded ? 0 : 'var(--radius-nav)',
      overflow: 'hidden',
      fontFamily: 'var(--font-primary)',
      boxShadow: quinnExpanded ? 'none' : undefined,
      position: 'relative',
    }}>

      {showHeader && (
        <div style={{
          padding: '12px 16px',
          borderBottom: '1px solid var(--color-border-subtle)',
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          flexShrink: 0,
          background: quinnExpanded ? 'var(--color-bg-nav)' : 'transparent',
        }}>
          <QuinnAvatar mode={headerOrbMode} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--color-text-primary)' }}>
              Quinn
            </div>
            {recipeWorking && headerOrbMode === 'thinking' && (
              <div style={{ fontSize: '11px', color: 'var(--color-text-muted)', marginTop: '1px' }}>
                Working in Edify on your recipe…
              </div>
            )}
            {headerOrbMode === 'ready' && (
              <div style={{ fontSize: '11px', color: 'var(--color-text-muted)', marginTop: '1px' }}>
                Recipe updates ready
              </div>
            )}
            {quinnExpanded && !chatStarted && !recipeWorking && (
              <div style={{ fontSize: '11px', color: 'var(--color-text-muted)', marginTop: '1px' }}>
                Full screen · chat
              </div>
            )}
          </div>
          {onToggleQuinnExpand && (
            <button
              type="button"
              onClick={onToggleQuinnExpand}
              title={quinnExpanded ? 'Exit full screen' : 'Expand Quinn to full screen'}
              aria-label={quinnExpanded ? 'Exit full screen' : 'Expand Quinn to full screen'}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '36px',
                height: '36px',
                borderRadius: '10px',
                border: '1px solid var(--color-border-subtle)',
                background: '#fff',
                cursor: 'pointer',
                flexShrink: 0,
              }}
            >
              {quinnExpanded
                ? <Minimize2 size={17} color="var(--color-text-secondary)" strokeWidth={2} />
                : <Maximize2 size={17} color="var(--color-text-secondary)" strokeWidth={2} />}
            </button>
          )}
        </div>
      )}

      {!showHeader && onToggleQuinnExpand && (
        <div style={{ position: 'absolute', top: 8, right: 8, zIndex: 2 }}>
          <button
            type="button"
            onClick={onToggleQuinnExpand}
            title="Expand Quinn to full screen"
            aria-label="Expand Quinn to full screen"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '36px',
              height: '36px',
              borderRadius: '10px',
              border: '1px solid var(--color-border-subtle)',
              background: '#fff',
              cursor: 'pointer',
              boxShadow: '0 1px 4px rgba(58,48,40,0.06)',
            }}
          >
            <Maximize2 size={17} color="var(--color-text-secondary)" strokeWidth={2} />
          </button>
        </div>
      )}

      <div style={{
        flex: 1,
        overflowY: 'auto',
        minHeight: 0,
        display: 'flex',
        flexDirection: 'column',
        position: 'relative',
      }}>
        {!chatStarted && !recipeWorking ? (
          <div style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px 16px 24px',
            boxSizing: 'border-box',
          }}>
            <div style={{ width: '100%', maxWidth: '560px' }}>
              <div style={{ textAlign: 'center', marginBottom: '28px' }}>
                <span
                  style={{
                    display: 'inline-block',
                    padding: '5px 12px',
                    borderRadius: '100px',
                    fontSize: '11px',
                    fontWeight: 700,
                    letterSpacing: '0.06em',
                    textTransform: 'uppercase',
                    color: 'var(--color-text-secondary)',
                    background: 'rgba(58,48,40,0.06)',
                    border: '1px solid var(--color-border-subtle)',
                  }}
                >
                  Edify
                </span>
                <div style={{
                  marginTop: '20px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '12px',
                  flexWrap: 'wrap',
                }}>
                  <Sparkles size={22} color="var(--color-accent-quinn)" strokeWidth={2} style={{ flexShrink: 0 }} />
                  <span style={{
                    fontFamily: 'Georgia, "Times New Roman", serif',
                    fontSize: 'clamp(22px, 4vw, 28px)',
                    fontWeight: 400,
                    color: 'var(--color-text-primary)',
                    lineHeight: 1.25,
                    margin: 0,
                  }}
                  >
                    {greeting}
                  </span>
                </div>
              </div>

              <ClaudeComposer
                value={input}
                onChange={setInput}
                onSend={() => sendMessage()}
                disabled={composerDisabled}
                placeholder={composerPlaceholder}
                minHeight={composerMinH}
              />

              <div style={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: '8px',
                justifyContent: 'center',
                marginTop: '20px',
              }}>
                {PROMPT_CHIPS.map((chip, i) => {
                  const Icon = chip.icon;
                  return (
                    <button
                      key={i}
                      type="button"
                      onClick={() => sendMessage(chip.text)}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '8px',
                        padding: '8px 14px',
                        borderRadius: '100px',
                        border: '1px solid var(--color-border-subtle)',
                        background: '#fff',
                        fontSize: '12.5px',
                        fontWeight: 600,
                        color: 'var(--color-text-secondary)',
                        cursor: 'pointer',
                        fontFamily: 'var(--font-primary)',
                        boxShadow: '0 1px 3px rgba(58,48,40,0.05)',
                      }}
                    >
                      <Icon size={15} strokeWidth={2} color="var(--color-text-muted)" />
                      {chip.label}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        ) : (
          <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
            <div style={{
              flex: 1,
              overflowY: 'auto',
              padding: '12px 16px 16px',
            }}>
              <AnimatePresence mode="wait">
                {chatStarted && (
                  <motion.div
                    key="chat"
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.2 }}
                  >
                    {messages.map((m) => (
                      <ChatBubble key={m.id} msg={m} />
                    ))}
                    <AnimatePresence>
                      {recipeWorking && (
                        <RecipeChatWorking key="recipe-edify-work" workStep={workStep} />
                      )}
                    </AnimatePresence>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
            <div style={{
              padding: '12px 16px 16px',
              flexShrink: 0,
              opacity: recipeWorking ? 0.55 : 1,
              pointerEvents: recipeWorking ? 'none' : 'auto',
              background: 'var(--color-bg-surface)',
            }}>
              <ClaudeComposer
                value={input}
                onChange={setInput}
                onSend={() => sendMessage()}
                disabled={composerDisabled}
                placeholder={composerPlaceholder}
                minHeight={composerMinH}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
