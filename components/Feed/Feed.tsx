'use client';

import { useState, useEffect, useRef, type ReactNode } from 'react';
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
    text: 'I want to add a new recipe for our weekend brunch menu.',
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

type ChatMsg = { id: string; role: 'user' | 'quinn'; text: string; msgType?: string };

type RecipeIngredient = { name: string; qty: string; unit: string };

const INITIAL_RECIPE_INGREDIENTS: RecipeIngredient[] = [
  { name: 'Chicken breast (cooked, shredded)', qty: '150', unit: 'g' },
  { name: 'Mayonnaise', qty: '30', unit: 'g' },
  { name: 'Dijon mustard', qty: '5', unit: 'g' },
  { name: 'Baby gem lettuce', qty: '20', unit: 'g' },
  { name: 'Vine tomato (sliced)', qty: '40', unit: 'g' },
  { name: 'Brioche bun', qty: '1', unit: 'pc' },
  { name: 'Salt & pepper', qty: '\u2014', unit: '' },
];

const RECIPE_GREETING = "Hey, happy to add a recipe. What is it of?";
const RECIPE_CARD_INTRO = "Great choice! Here's a suggested recipe for a **Chicken & Mayo Sandwich**. Adjust the quantities to match your serving size:";
const RECIPE_LINK_MSG =
  "I've linked most of these ingredients to your existing Edify catalogue \u2014 chicken, mayo, mustard, lettuce, and tomato are all matched to current suppliers.\n\n" +
  "However, I noticed you don't have a supplier set up for **brioche buns** yet.\n\n" +
  "I'd recommend **Artisan Bakehouse** \u2014 I picked them because they're trusted amongst our users for consistently good quality and reliable deliveries. Want me to add them as a supplier for you?";
const RECIPE_DONE_MSG =
  "**Done!** Artisan Bakehouse is now set up as a supplier and linked to brioche buns in your recipe.\n\n" +
  "Your **Chicken & Mayo Sandwich** recipe is live in Edify \u2014 you'll find it under **Fitzroy Espresso \u2192 Recipes**. I've calculated the food cost at **32%**, well within your target. The recipe is ready to add to any production plan.";

function RecipeCardEditor({
  ingredients,
  onChange,
}: {
  ingredients: RecipeIngredient[];
  onChange: (idx: number, qty: string) => void;
}) {
  return (
    <div style={{
      marginTop: '8px',
      borderRadius: '10px',
      border: '1px solid var(--color-border-subtle)',
      overflow: 'hidden',
    }}>
      <div style={{
        padding: '10px 14px',
        background: 'var(--color-bg-hover)',
        borderBottom: '1px solid var(--color-border-subtle)',
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
      }}>
        <ChefHat size={14} color="var(--color-accent-active)" strokeWidth={2} />
        <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--color-text-primary)' }}>
          Chicken & Mayo Sandwich
        </span>
        <span style={{ fontSize: '11px', color: 'var(--color-text-muted)', marginLeft: 'auto' }}>
          Serves 1
        </span>
      </div>
      {ingredients.map((ing, i) => (
        <div
          key={i}
          style={{
            display: 'flex',
            alignItems: 'center',
            padding: '8px 14px',
            borderBottom: i < ingredients.length - 1 ? '1px solid var(--color-border-subtle)' : 'none',
            fontSize: '12.5px',
            gap: '8px',
          }}
        >
          <span style={{ flex: 1, color: 'var(--color-text-secondary)' }}>{ing.name}</span>
          {ing.qty === '\u2014' ? (
            <span style={{ fontSize: '12px', color: 'var(--color-text-muted)', width: '64px', textAlign: 'right' }}>to taste</span>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <input
                type="text"
                value={ing.qty}
                onChange={(e) => onChange(i, e.target.value)}
                style={{
                  width: '48px',
                  padding: '4px 6px',
                  borderRadius: '6px',
                  border: '1px solid var(--color-border-subtle)',
                  fontSize: '12px',
                  fontWeight: 600,
                  fontFamily: 'var(--font-primary)',
                  textAlign: 'right',
                  color: 'var(--color-text-primary)',
                  background: '#fff',
                  outline: 'none',
                }}
              />
              <span style={{ fontSize: '11px', color: 'var(--color-text-muted)', minWidth: '16px' }}>{ing.unit}</span>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function ActionButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'flex-start', marginBottom: '12px' }}>
      <button
        type="button"
        onClick={onClick}
        style={{
          padding: '9px 18px',
          borderRadius: '100px',
          border: 'none',
          background: 'var(--color-accent-active)',
          color: '#fff',
          fontSize: '12.5px',
          fontWeight: 600,
          fontFamily: 'var(--font-primary)',
          cursor: 'pointer',
          boxShadow: '0 2px 8px rgba(20,67,233,0.25)',
          transition: 'opacity 0.12s ease',
        }}
      >
        {label}
      </button>
    </div>
  );
}

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

function ChatBubble({ msg, children }: { msg: ChatMsg; children?: ReactNode }) {
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
        background: isUser ? '#F5F4F2' : '#fff',
        border: '1px solid var(--color-border-subtle)',
        boxShadow: isUser ? 'none' : '0 2px 8px rgba(58,48,40,0.08), 0 0 0 1px rgba(58,48,40,0.03)',
        fontSize: '13.5px',
        lineHeight: 1.6,
        color: 'var(--color-text-secondary)',
        whiteSpace: 'pre-wrap',
      }}>
        {!isUser && (
          <div style={{ fontSize: '10px', fontWeight: 700, color: 'var(--color-accent-active)', marginBottom: '6px', letterSpacing: '0.04em' }}>
            QUINN
          </div>
        )}
        {isUser ? msg.text : <QuinnMessageBody text={msg.text} />}
        {children}
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
        boxShadow: '0 8px 32px rgba(58,48,40,0.1), 0 2px 8px rgba(58,48,40,0.06)',
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
  onChatStateChange,
}: {
  briefingRole: BriefingRole;
  quinnExpanded?: boolean;
  onToggleQuinnExpand?: () => void;
  onChatStateChange?: (active: boolean) => void;
}) {
  const [chatStarted, setChatStarted] = useState(false);
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [input, setInput] = useState('');
  const [recipeFlow, setRecipeFlow] = useState(0);
  const [recipeIngredients, setRecipeIngredients] = useState<RecipeIngredient[]>(INITIAL_RECIPE_INGREDIENTS);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const greeting = timeAwareGreeting(briefingRole);

  useEffect(() => {
    onChatStateChange?.(chatStarted);
  }, [chatStarted, onChatStateChange]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, recipeFlow]);

  useEffect(() => {
    if (recipeFlow === 1) {
      const t = setTimeout(() => {
        setMessages(prev => [...prev, { id: `u-recipe-${Date.now()}`, role: 'user', text: 'Chicken and mayo sandwich' }]);
        setRecipeFlow(2);
      }, 1500);
      return () => clearTimeout(t);
    }
    if (recipeFlow === 2) {
      const t = setTimeout(() => {
        setMessages(prev => [...prev, {
          id: `q-recipe-card-${Date.now()}`,
          role: 'quinn',
          text: RECIPE_CARD_INTRO,
          msgType: 'recipe-card',
        }]);
        setRecipeFlow(3);
      }, 1200);
      return () => clearTimeout(t);
    }
    if (recipeFlow === 4) {
      const t = setTimeout(() => {
        setMessages(prev => [...prev, {
          id: `q-supplier-${Date.now()}`,
          role: 'quinn',
          text: RECIPE_LINK_MSG,
        }]);
        setRecipeFlow(5);
      }, 800);
      return () => clearTimeout(t);
    }
    if (recipeFlow === 6) {
      const t = setTimeout(() => {
        setMessages(prev => [...prev, {
          id: `q-done-${Date.now()}`,
          role: 'quinn',
          text: RECIPE_DONE_MSG,
        }]);
        setRecipeFlow(7);
      }, 800);
      return () => clearTimeout(t);
    }
  }, [recipeFlow]);

  function startRecipeFlow() {
    setChatStarted(true);
    setMessages([{ id: `q-greeting-${Date.now()}`, role: 'quinn', text: RECIPE_GREETING }]);
    setRecipeFlow(1);
  }

  function confirmRecipe() {
    setMessages(prev => [...prev, { id: `u-confirm-${Date.now()}`, role: 'user', text: 'Looks good, save it' }]);
    setRecipeFlow(4);
  }

  function confirmSupplier() {
    setMessages(prev => [...prev, { id: `u-supplier-${Date.now()}`, role: 'user', text: 'Yes, add them' }]);
    setRecipeFlow(6);
  }

  function sendMessage(overrideText?: string) {
    const raw = overrideText !== undefined ? overrideText : input;
    const text = raw.trim();
    if (!text) return;

    const userMsg: ChatMsg = { id: `u-${Date.now()}`, role: 'user', text };
    setChatStarted(true);
    setMessages(prev => [...prev, userMsg]);
    setInput('');
  }

  const composerDisabled = recipeFlow > 0 && recipeFlow < 7;
  const composerPlaceholder = composerDisabled ? 'Quinn is working on your recipe\u2026' : PLACEHOLDER;
  const composerMinH = chatStarted ? 40 : 72;

  const showHeader = quinnExpanded || chatStarted;

  return (
    <div style={{
      flex: 1,
      display: 'flex',
      flexDirection: 'column',
      minHeight: 0,
      minWidth: 0,
      height: '100%',
      width: '100%',
      maxWidth: chatStarted ? '100%' : 'min(680px, 100%)',
      margin: '0 auto',
      background: quinnExpanded || chatStarted ? '#fff' : 'transparent',
      borderRadius: (quinnExpanded || chatStarted) ? 0 : 'var(--radius-nav)',
      overflow: 'hidden',
      fontFamily: 'var(--font-primary)',
      boxShadow: (quinnExpanded || chatStarted) ? 'none' : undefined,
      position: 'relative',
      borderLeft: chatStarted && !quinnExpanded ? '1px solid var(--color-border-subtle)' : 'none',
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
          <QuinnAvatar mode="sparkle" />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--color-text-primary)' }}>
              Quinn
            </div>
            {quinnExpanded && !chatStarted && (
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
              boxShadow: '0 2px 6px rgba(58,48,40,0.08)',
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
        {!chatStarted ? (
          <div style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px 16px 24px',
            boxSizing: 'border-box',
            background: '#fff',
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
                disabled={false}
                placeholder={PLACEHOLDER}
                minHeight={72}
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
                      onClick={() => {
                        if (chip.label === 'New recipe') {
                          startRecipeFlow();
                        } else {
                          sendMessage(chip.text);
                        }
                      }}
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
                        boxShadow: '0 2px 6px rgba(58,48,40,0.08)',
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
              display: 'flex',
              justifyContent: 'center',
            }}>
              <div style={{
                width: '100%',
                maxWidth: '680px',
                padding: '16px 24px 16px',
              }}>
                <AnimatePresence mode="wait">
                  <motion.div
                    key="chat"
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.2 }}
                  >
                    {messages.map((m) => (
                      <ChatBubble key={m.id} msg={m}>
                        {m.msgType === 'recipe-card' && (
                          <RecipeCardEditor
                            ingredients={recipeIngredients}
                            onChange={(idx, qty) => {
                              setRecipeIngredients(prev => prev.map((ing, i) => i === idx ? { ...ing, qty } : ing));
                            }}
                          />
                        )}
                      </ChatBubble>
                    ))}

                    {recipeFlow === 3 && (
                      <ActionButton label="Looks good, save it" onClick={confirmRecipe} />
                    )}
                    {recipeFlow === 5 && (
                      <ActionButton label="Yes, add them" onClick={confirmSupplier} />
                    )}

                    <div ref={chatEndRef} />
                  </motion.div>
                </AnimatePresence>
              </div>
            </div>
            <div style={{
              flexShrink: 0,
              display: 'flex',
              justifyContent: 'center',
              borderTop: '1px solid var(--color-border-subtle)',
              opacity: composerDisabled ? 0.55 : 1,
              pointerEvents: composerDisabled ? 'none' : 'auto',
            }}>
              <div style={{
                width: '100%',
                maxWidth: '680px',
                padding: '12px 24px 16px',
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
          </div>
        )}
      </div>
    </div>
  );
}
