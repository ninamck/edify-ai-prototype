'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, AlertTriangle, Pause, Play } from 'lucide-react';
import RecipeChatWorking, { RECIPE_EDIFY_TASKS } from '@/components/Feed/RecipeChatWorking';
import { FITZROY_POS_INTAKE } from '@/components/Recipe/intakeFixtures';
import { FITZROY_SHEET_INTAKE } from '@/components/Recipe/sheetIntakeFixtures';

// POS outcomes
const POS_OUTCOMES: Record<string, { tone: 'ok' | 'warn'; note: string }> = {
  'mi-flat-white':       { tone: 'ok',   note: 'all clean' },
  'mi-cappuccino':       { tone: 'ok',   note: 'all clean' },
  'mi-latte':            { tone: 'warn', note: '"Whole milk" ambiguous \u2014 merged with main entry' },
  'mi-americano':        { tone: 'warn', note: 'cost looks high vs menu price (86% margin)' },
  'mi-mocha':            { tone: 'ok',   note: 'all clean' },
  'mi-cortado':          { tone: 'ok',   note: 'all clean' },
  'mi-macchiato':        { tone: 'ok',   note: 'all clean' },
  'mi-iced-latte':       { tone: 'ok',   note: 'all clean' },
  'mi-english-breakfast': { tone: 'ok',  note: 'all clean' },
  'mi-earl-grey':        { tone: 'ok',   note: 'all clean' },
  'mi-green-tea':        { tone: 'ok',   note: 'all clean' },
  'mi-blueberry-muffin': { tone: 'warn', note: 'linked "Blueberry muffin" to Rise Bakery invoice line' },
  'mi-croissant':        { tone: 'ok',   note: 'all clean' },
  'mi-almond-croissant': { tone: 'ok',   note: 'all clean' },
  'mi-smirnoff':         { tone: 'ok',   note: 'all clean' },
  'mi-tanqueray':        { tone: 'ok',   note: 'all clean' },
  'mi-savvy-b':          { tone: 'warn', note: 'needs size modifier \u2014 saved as draft' },
  'mi-house-red':        { tone: 'ok',   note: 'all clean' },
  'mi-avocado-toast':    { tone: 'ok',   note: 'all clean' },
  'mi-salmon-bagel':     { tone: 'warn', note: 'no production visibility set \u2014 flagged for review' },
  'mi-babyccino':        { tone: 'ok',   note: 'all clean' },
};

type IntakeItem = { id: string; name: string };

function itemsForSource(source: 'pos' | 'sheet'): { items: IntakeItem[]; outcomes: Record<string, { tone: 'ok' | 'warn'; note: string }>; sourceLabel: string } {
  if (source === 'sheet') {
    return {
      items: FITZROY_SHEET_INTAKE.recipes.map((r) => ({ id: r.id, name: r.name })),
      outcomes: FITZROY_SHEET_INTAKE.outcomes,
      sourceLabel: `sheet · ${FITZROY_SHEET_INTAKE.filename}`,
    };
  }
  return {
    items: FITZROY_POS_INTAKE.menuItems.map((m) => ({ id: m.id, name: m.name })),
    outcomes: POS_OUTCOMES,
    sourceLabel: `POS · ${FITZROY_POS_INTAKE.source}`,
  };
}

const STEP_DURATION_MS = 500;

export default function BatchRunPageWrapper() {
  return (
    <Suspense fallback={<div style={{ padding: 24 }}>Loading…</div>}>
      <BatchRunPage />
    </Suspense>
  );
}

function BatchRunPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const source = (searchParams.get('source') === 'sheet' ? 'sheet' : 'pos') as 'pos' | 'sheet';
  const { items, outcomes, sourceLabel } = itemsForSource(source);
  const totalItems = items.length;
  const totalSteps = RECIPE_EDIFY_TASKS.length;
  const groupsAttached = Number(searchParams.get('groups') ?? 0);

  const [currentIndex, setCurrentIndex] = useState(0);
  const [workStep, setWorkStep] = useState(0);
  const [paused, setPaused] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (paused || done) return;
    const t = setTimeout(() => {
      if (workStep < totalSteps) {
        setWorkStep((s) => s + 1);
      } else {
        // move to next item
        if (currentIndex < totalItems - 1) {
          setCurrentIndex((i) => i + 1);
          setWorkStep(0);
        } else {
          setDone(true);
        }
      }
    }, STEP_DURATION_MS);
    return () => clearTimeout(t);
  }, [workStep, currentIndex, paused, done, totalItems, totalSteps]);

  useEffect(() => {
    if (done) {
      const t = setTimeout(() => {
        const warnCount = items.filter((m) => outcomes[m.id]?.tone === 'warn').length;
        const okCount = totalItems - warnCount;
        router.push(`/recipes/intake/pos/done?ok=${okCount}&warn=${warnCount}&groups=${groupsAttached}&total=${totalItems}&source=${source}`);
      }, 700);
      return () => clearTimeout(t);
    }
  }, [done, router, totalItems, groupsAttached, items, outcomes, source]);

  const current = items[currentIndex];
  const completed = items.slice(0, currentIndex);
  // Show most recent first
  const log = [...completed].reverse();

  const totalStepsAll = totalItems * totalSteps;
  const progressSteps = currentIndex * totalSteps + Math.min(workStep, totalSteps);
  const progressPct = Math.round((progressSteps / totalStepsAll) * 100);

  return (
    <div style={{ padding: '20px 24px 60px', maxWidth: '760px', margin: '0 auto', fontFamily: 'var(--font-primary)' }}>
      {/* Header */}
      <div style={{ marginBottom: '16px' }}>
        <div
          style={{
            fontSize: '11px',
            fontWeight: 700,
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
            color: 'var(--color-accent-active)',
            marginBottom: '4px',
          }}
        >
          Quinn · Drafting from {sourceLabel}
        </div>
        <h1 style={{ fontSize: '22px', fontWeight: 700, color: 'var(--color-text-primary)', margin: '0 0 6px' }}>
          {done
            ? `Drafted ${totalItems} recipes`
            : `Drafting ${totalItems} recipes\u2026`}
        </h1>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '13px', color: 'var(--color-text-muted)' }}>
          <span>
            <strong style={{ color: 'var(--color-text-primary)' }}>{currentIndex + (workStep >= totalSteps ? 1 : 0)}</strong>
            {' '}done · <strong style={{ color: 'var(--color-text-primary)' }}>{totalItems - currentIndex - (workStep >= totalSteps ? 1 : 0)}</strong> to go
          </span>
          <span>·</span>
          <span>{progressPct}%</span>
          {!done && (
            <>
              <span style={{ flex: 1 }} />
              <button
                onClick={() => setPaused((v) => !v)}
                style={{
                  padding: '5px 10px',
                  borderRadius: '8px',
                  border: '1px solid var(--color-border)',
                  background: '#fff',
                  fontSize: '12px',
                  fontWeight: 600,
                  color: 'var(--color-text-primary)',
                  fontFamily: 'var(--font-primary)',
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '5px',
                }}
              >
                {paused ? <Play size={12} /> : <Pause size={12} />}
                {paused ? 'Resume' : 'Pause'}
              </button>
            </>
          )}
        </div>
      </div>

      {/* Progress bar */}
      <div style={{ height: '6px', borderRadius: '100px', background: 'var(--color-bg-hover)', overflow: 'hidden', marginBottom: '20px' }}>
        <motion.div
          animate={{ width: `${progressPct}%` }}
          transition={{ duration: 0.3 }}
          style={{ height: '100%', background: 'var(--color-accent-active)', borderRadius: '100px' }}
        />
      </div>

      {/* Current recipe (RecipeChatWorking) */}
      {!done && current && (
        <AnimatePresence mode="wait">
          <motion.div
            key={current.id}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2 }}
          >
            <div style={{ fontSize: '12px', color: 'var(--color-text-muted)', marginBottom: '8px', fontWeight: 600 }}>
              Now: <span style={{ color: 'var(--color-text-primary)', fontSize: '13.5px' }}>{current.name}</span>
            </div>
            <RecipeChatWorking workStep={workStep} />
          </motion.div>
        </AnimatePresence>
      )}

      {/* Earlier log */}
      {log.length > 0 && (
        <div style={{ marginTop: '8px' }}>
          <div
            style={{
              fontSize: '11px',
              fontWeight: 700,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              color: 'var(--color-text-muted)',
              marginBottom: '10px',
            }}
          >
            Earlier ({log.length})
          </div>
          <div style={{ border: '1px solid var(--color-border-subtle)', borderRadius: '12px', background: '#fff', overflow: 'hidden' }}>
            {log.map((item, i) => {
              const outcome = outcomes[item.id] ?? { tone: 'ok' as const, note: 'done' };
              const isWarn = outcome.tone === 'warn';
              return (
                <div
                  key={item.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    padding: '10px 14px',
                    borderBottom: i < log.length - 1 ? '1px solid var(--color-border-subtle)' : 'none',
                  }}
                >
                  <span
                    style={{
                      width: '22px', height: '22px', borderRadius: '6px',
                      background: isWarn ? 'var(--color-warning-light)' : 'var(--color-success-light)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                    }}
                  >
                    {isWarn
                      ? <AlertTriangle size={13} color="var(--color-warning)" strokeWidth={2.4} />
                      : <Check size={13} color="var(--color-success)" strokeWidth={2.8} />
                    }
                  </span>
                  <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-text-primary)', minWidth: '160px' }}>
                    {item.name}
                  </span>
                  <span style={{
                    fontSize: '12.5px',
                    color: isWarn ? 'var(--color-warning)' : 'var(--color-text-muted)',
                    flex: 1,
                  }}>
                    {outcome.note}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
