'use client';

import { useState, type CSSProperties, type ReactNode, type SelectHTMLAttributes } from 'react';
import { ChevronDown } from 'lucide-react';

/**
 * StyledSelect — drop-in replacement for the native `<select>` element.
 *
 * Keeps the underlying `<select>` for free accessibility, keyboard nav,
 * and mobile pickers — but hides the OS chevron (`appearance: none`)
 * and overlays a Lucide `ChevronDown` so the field matches the rest of
 * the Edify chrome.
 *
 * Usage mirrors `<select>`: pass `<option>` children, `value`,
 * `onChange`, `disabled`. Anything else gets forwarded to the inner
 * select via `{...rest}`.
 */
export type StyledSelectProps = SelectHTMLAttributes<HTMLSelectElement> & {
  /** Force the wrapper to a specific width. Defaults to '100%'. */
  width?: number | string;
  /** Children must be `<option>` (or `<optgroup>`) elements. */
  children: ReactNode;
};

export default function StyledSelect({
  width = '100%',
  disabled = false,
  style,
  children,
  onFocus,
  onBlur,
  ...rest
}: StyledSelectProps) {
  const [focused, setFocused] = useState(false);

  // The wrapper handles the focus ring + border so the field reads as
  // one unit (chevron + text + border all change together) rather than
  // the native select painting its own focus outline inside ours.
  const wrapperStyle: CSSProperties = {
    position: 'relative',
    display: 'inline-flex',
    alignItems: 'center',
    width,
    height: 38,
    borderRadius: 8,
    border: `1px solid ${focused ? 'var(--color-accent-active)' : 'var(--color-border)'}`,
    background: disabled ? 'var(--color-bg-hover)' : '#ffffff',
    boxShadow: focused ? '0 0 0 3px var(--color-accent-soft, rgba(28,46,108,0.12))' : 'none',
    cursor: disabled ? 'not-allowed' : 'pointer',
    transition: 'border-color 120ms ease, box-shadow 120ms ease',
  };

  const selectInnerStyle: CSSProperties = {
    flex: 1,
    minWidth: 0,
    height: '100%',
    // Native chevron gone — our overlaid Lucide icon takes over.
    appearance: 'none',
    WebkitAppearance: 'none',
    MozAppearance: 'none',
    padding: '0 36px 0 12px',
    border: 'none',
    outline: 'none',
    background: 'transparent',
    color: 'var(--color-text-primary)',
    fontFamily: 'var(--font-primary)',
    fontSize: 13,
    fontWeight: 600,
    cursor: disabled ? 'not-allowed' : 'pointer',
    ...style,
  };

  const chevronStyle: CSSProperties = {
    position: 'absolute',
    right: 10,
    top: '50%',
    transform: 'translateY(-50%)',
    pointerEvents: 'none',
    color: disabled ? 'var(--color-text-muted)' : 'var(--color-text-secondary)',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
  };

  return (
    <div style={wrapperStyle}>
      <select
        disabled={disabled}
        {...rest}
        onFocus={e => {
          setFocused(true);
          onFocus?.(e);
        }}
        onBlur={e => {
          setFocused(false);
          onBlur?.(e);
        }}
        style={selectInnerStyle}
      >
        {children}
      </select>
      <span aria-hidden style={chevronStyle}>
        <ChevronDown size={16} strokeWidth={2.25} />
      </span>
    </div>
  );
}
