'use client';

/**
 * Photo intake process — runs Quinn's 5-task pass on the single parsed recipe,
 * then shows an inline save banner (design principle: "done state is explicitly
 * confirmed — green success banner + summary of what was saved").
 */

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, BookOpen, ArrowRight, Plus } from 'lucide-react';
import RecipeChatWorking, { RECIPE_EDIFY_TASKS } from '@/components/Feed/RecipeChatWorking';
import { PHOTO_INTAKE_FIXTURE } from '@/components/Recipe/photoIntakeFixtures';

const STEP_DURATION_MS = 600;

export default function PhotoProcessPage() {
  const router = useRouter();
  const totalSteps = RECIPE_EDIFY_TASKS.length;
  const [workStep, setWorkStep] = useState(0);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (done) return;
    const t = setTimeout(() => {
      if (workStep < totalSteps) setWorkStep((s) => s + 1);
      else setDone(true);
    }, STEP_DURATION_MS);
    return () => clearTimeout(t);
  }, [workStep, done, totalSteps]);

  const name = PHOTO_INTAKE_FIXTURE.name.value;
  const yieldLabel = `${PHOTO_INTAKE_FIXTURE.yieldQty.value} ${PHOTO_INTAKE_FIXTURE.yieldUom.value}${PHOTO_INTAKE_FIXTURE.yieldQty.value !== 1 ? 's' : ''}`;
  const ingCount = PHOTO_INTAKE_FIXTURE.ingredients.length;
  // rough demo cost
  const costEstimate = 1.25;
  const margin = 65;

  return (
    <div style={{ padding: '20px 24px 80px', maxWidth: '720px', margin: '0 auto', fontFamily: 'var(--font-primary)' }}>
      <div style={{ marginBottom: '16px' }}>
        <div
          style={{
            fontSize: '11px', fontWeight: 700, letterSpacing: '0.1em',
            textTransform: 'uppercase', color: 'var(--color-accent-active)',
            marginBottom: '3px',
          }}
        >
          Quinn · Drafting from photo
        </div>
        <h1 style={{ fontSize: '22px', fontWeight: 700, margin: '0 0 4px', color: 'var(--color-text-primary)' }}>
          {done ? 'Saved to library' : `Drafting ${name}\u2026`}
        </h1>
        <p style={{ fontSize: '13px', color: 'var(--color-text-muted)', margin: 0, lineHeight: 1.5 }}>
          {done
            ? 'Matched ingredients, priced against latest contracts, and staged to production.'
            : 'Matching ingredients, pulling prices, and computing the cost.'}
        </p>
      </div>

      <AnimatePresence mode="wait">
        {!done && (
          <motion.div
            key="working"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.2 }}
          >
            <RecipeChatWorking workStep={workStep} />
          </motion.div>
        )}

        {done && (
          <motion.div
            key="done"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25 }}
            style={{
              borderRadius: '12px',
              border: '1px solid var(--color-success-border)',
              background: 'var(--color-success-light)',
              padding: '18px 18px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
              <span
                style={{
                  width: '36px', height: '36px', borderRadius: '10px',
                  background: 'rgba(21,128,61,0.15)',
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                <Check size={20} strokeWidth={2.6} color="var(--color-success)" />
              </span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: '15px', fontWeight: 700, color: 'var(--color-success)' }}>
                  {name} saved
                </div>
                <div style={{ fontSize: '13px', color: 'var(--color-text-primary)', marginTop: '3px' }}>
                  {ingCount} ingredients · yields {yieldLabel} · cost £{costEstimate.toFixed(2)}/serve · margin {margin}%
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {done && (
        <div style={{ marginTop: '18px', display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <button
            onClick={() => router.push('/recipes')}
            style={primaryBtn}
          >
            <BookOpen size={14} strokeWidth={2} />
            Open recipe library
            <ArrowRight size={14} strokeWidth={2} />
          </button>
          <button
            onClick={() => router.push('/recipes/intake/photo')}
            style={secondaryBtn}
          >
            <Plus size={14} strokeWidth={2} />
            Add another
          </button>
        </div>
      )}
    </div>
  );
}

const primaryBtn: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: '8px',
  padding: '10px 16px', borderRadius: '10px', border: 'none',
  background: 'var(--color-accent-active)', color: '#fff',
  fontSize: '13px', fontWeight: 600, fontFamily: 'var(--font-primary)',
  cursor: 'pointer',
};

const secondaryBtn: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: '8px',
  padding: '10px 16px', borderRadius: '10px',
  border: '1px solid var(--color-border)', background: '#fff',
  fontSize: '13px', fontWeight: 600, fontFamily: 'var(--font-primary)',
  color: 'var(--color-text-primary)',
  cursor: 'pointer',
};
