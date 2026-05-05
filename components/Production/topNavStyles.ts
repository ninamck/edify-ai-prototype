/**
 * Shared sizing for the two horizontal bars at the top of the Production
 * layout — the sub-tab nav (Today / Run sheet / Benches / …) and the
 * site picker just below it. Sized for tablet first: every interactive
 * pill is at least 44×44 (Apple HIG / WCAG 2.2 minimum) and uses the
 * same padding rhythm so the two strips read as a single header band.
 *
 * Exported as plain CSSProperties objects so any other tab strip in the
 * app (e.g. mode tabs on the bench board) can opt in by spreading these
 * values rather than re-deriving them.
 */

import type { CSSProperties } from 'react';

/** Outer container padding for either bar. Matches between rows so the
 *  two strips visually stack as a single header. */
export const TOP_NAV_BAR_PADDING = '10px 24px';

/** Horizontal gap between pills. */
export const TOP_NAV_PILL_GAP = 8;

/** Default pill (tab/site button) — tablet-friendly tap target. */
export const TOP_NAV_PILL_BASE: CSSProperties = {
  minHeight: 44,
  padding: '10px 18px',
  borderRadius: 10,
  fontSize: 14,
  fontWeight: 600,
  fontFamily: 'var(--font-primary)',
  border: '1px solid transparent',
  cursor: 'pointer',
  whiteSpace: 'nowrap',
  display: 'inline-flex',
  alignItems: 'center',
  gap: 8,
};

/**
 * Compact pill — used by secondary chooser rows like the site picker
 * where the tab nav above already establishes the headline tap target
 * and a slightly smaller height keeps the two stacked rows from
 * feeling like a wall of buttons. Still meets the 36px touch minimum
 * a finger can hit on a tablet (just below the 44px Apple HIG ideal).
 */
export const TOP_NAV_PILL_COMPACT: CSSProperties = {
  minHeight: 36,
  padding: '6px 14px',
  borderRadius: 8,
  fontSize: 13,
  fontWeight: 600,
  fontFamily: 'var(--font-primary)',
  border: '1px solid transparent',
  cursor: 'pointer',
  whiteSpace: 'nowrap',
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
};

/** Active state — solid accent. */
export const TOP_NAV_PILL_ACTIVE: CSSProperties = {
  background: 'var(--color-accent-active)',
  color: 'var(--color-text-on-active)',
  borderColor: 'var(--color-accent-active)',
};

/** Idle (transparent) state — used by the sub-tab nav. */
export const TOP_NAV_PILL_IDLE_TRANSPARENT: CSSProperties = {
  background: 'transparent',
  color: 'var(--color-text-secondary)',
  borderColor: 'transparent',
};

/** Idle (outlined) state — used by the site picker so each option still
 *  reads as a button when unselected. */
export const TOP_NAV_PILL_IDLE_OUTLINED: CSSProperties = {
  background: '#ffffff',
  color: 'var(--color-text-secondary)',
  borderColor: 'var(--color-border)',
};

/** Section label (e.g. "SITE") that sits to the left of the pill row. */
export const TOP_NAV_SECTION_LABEL: CSSProperties = {
  fontSize: 12,
  fontWeight: 700,
  color: 'var(--color-text-muted)',
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
};
