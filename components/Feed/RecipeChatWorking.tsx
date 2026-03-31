'use client';

import { motion } from 'framer-motion';
import { Check, Loader2 } from 'lucide-react';
import QuinnOrb from '@/components/Sidebar/QuinnOrb';

export const RECIPE_EDIFY_TASKS = [
  'Match ingredients to Bidfood & Urban Fresh catalogue',
  'Pull latest contract prices and pack sizes',
  'Calculate plate cost & food cost % vs target',
  'Create recipe card in Fitzroy Espresso library',
  'Stage weekend production & prep sheet entries',
] as const;

type RecipeChatWorkingProps = {
  workStep: number;
};

export default function RecipeChatWorking({ workStep }: RecipeChatWorkingProps) {
  const n = RECIPE_EDIFY_TASKS.length;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -6 }}
      transition={{ duration: 0.35, ease: 'easeOut' }}
      style={{
        marginBottom: '16px',
        borderRadius: '14px',
        border: '1px solid var(--color-border-subtle)',
        background: '#fff',
        boxShadow: '0 4px 20px rgba(58,48,40,0.08)',
        overflow: 'hidden',
      }}
    >
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        padding: '14px 16px',
        borderBottom: '1px solid var(--color-border-subtle)',
        background: 'linear-gradient(180deg, #FEFCF9 0%, #fff 100%)',
      }}>
        <div style={{ flexShrink: 0 }}>
          <QuinnOrb state="thinking" size={36} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontSize: '10px',
            fontWeight: 700,
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
            color: 'var(--color-accent-quinn)',
            marginBottom: '4px',
          }}>
            Quinn · Edify
          </div>
          <div style={{
            fontSize: '13.5px',
            fontWeight: 600,
            color: 'var(--color-text-primary)',
            lineHeight: 1.35,
          }}>
            Working on your recipe in the background…
          </div>
          <div style={{
            fontSize: '12px',
            color: 'var(--color-text-muted)',
            marginTop: '4px',
            lineHeight: 1.45,
          }}>
            Same engine as Ask Quinn — matching suppliers, costing, and production.
          </div>
        </div>
      </div>

      <div style={{ padding: '12px 14px 14px' }}>
        {RECIPE_EDIFY_TASKS.map((label, i) => {
          const done = workStep > i;
          const active = workStep === i && i < n;
          const pending = workStep < i;

          return (
            <motion.div
              key={label}
              initial={false}
              animate={{ opacity: pending ? 0.45 : 1 }}
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: '10px',
                padding: '8px 0',
                borderBottom: i < n - 1 ? '1px solid var(--color-border-subtle)' : 'none',
              }}
            >
              <span style={{
                width: '22px',
                height: '22px',
                borderRadius: '6px',
                flexShrink: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: done ? 'rgba(45,106,79,0.12)' : active ? 'var(--color-quinn-bg)' : 'var(--color-bg-surface)',
              }}>
                {done && (
                  <motion.span
                    initial={{ scale: 0.5, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ type: 'spring', stiffness: 400, damping: 22 }}
                  >
                    <Check size={14} color="#2D6A4F" strokeWidth={2.5} />
                  </motion.span>
                )}
                {active && (
                  <motion.span
                    animate={{ rotate: 360 }}
                    transition={{ duration: 0.85, repeat: Infinity, ease: 'linear' }}
                    style={{ display: 'inline-flex', lineHeight: 0 }}
                  >
                    <Loader2 size={14} color="var(--color-accent-quinn)" strokeWidth={2.2} />
                  </motion.span>
                )}
                {pending && (
                  <span style={{
                    width: '6px',
                    height: '6px',
                    borderRadius: '50%',
                    background: 'var(--color-border)',
                  }} />
                )}
              </span>
              <span style={{
                fontSize: '13px',
                lineHeight: 1.45,
                color: done ? 'var(--color-text-secondary)' : active ? 'var(--color-text-primary)' : 'var(--color-text-muted)',
                fontWeight: active ? 600 : 400,
              }}>
                {label}
              </span>
            </motion.div>
          );
        })}
      </div>
    </motion.div>
  );
}
