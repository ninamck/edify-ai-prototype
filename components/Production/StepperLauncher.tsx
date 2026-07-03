'use client';

import { useState } from 'react';
import { PlaySquare } from 'lucide-react';
import StepperView from './StepperView';
import { DEMO_TODAY, type SiteId } from './fixtures';
import { isDemoBuild } from '@/lib/demoConfig';

/**
 * Toolbar button that opens the production Stepper for the current site
 * + date. Drop into any plan-table toolbar — the button is self-
 * contained and owns the modal lifecycle, so callers only need to pass
 * the site and date they're showing.
 */
export default function StepperLauncher({
  siteId,
  date = DEMO_TODAY,
  variant = 'solid',
  label = 'Open stepper',
}: {
  siteId: SiteId;
  date?: string;
  /**
   * `solid` matches the dark-navy primary CTA used by the rest of the
   * production toolbars. `ghost` is a lighter outline-on-white variant
   * for surfaces (like the Plan view) that already have a busy header
   * row and need a calmer affordance.
   */
  variant?: 'solid' | 'ghost';
  label?: string;
}) {
  const [open, setOpen] = useState(false);

  // Hidden on customer demo builds — the stepper walkthrough is an internal
  // affordance that adds toolbar clutter to the demo. Still available on the
  // internal Edify build. Remove this guard to restore it everywhere.
  if (isDemoBuild) return null;

  const solid: React.CSSProperties = {
    background: 'var(--color-bg-nav)',
    color: '#ffffff',
    border: '1px solid var(--color-bg-nav)',
  };
  const ghost: React.CSSProperties = {
    background: '#ffffff',
    color: 'var(--color-text-secondary)',
    border: '1px solid var(--color-border)',
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        title="Open the stepper view — pick a bench + production run, then walk the recipes one at a time."
        aria-label={label}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          padding: '8px 14px',
          borderRadius: 8,
          fontSize: 12,
          fontWeight: 600,
          fontFamily: 'var(--font-primary)',
          cursor: 'pointer',
          ...(variant === 'solid' ? solid : ghost),
        }}
      >
        <PlaySquare size={14} /> {label}
      </button>
      <StepperView open={open} onClose={() => setOpen(false)} siteId={siteId} date={date} />
    </>
  );
}
