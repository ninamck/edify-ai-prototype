import type { ReactNode } from 'react';

/**
 * Minimal **bold** renderer shared by the COGS insight surfaces (chat
 * bubbles, pattern cards). Matches the convention used by the existing
 * QuinnInsightButton so the authored narratives style identically.
 */
export function renderMarkdownLite(text: string): ReactNode {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((p, i) => {
    if (p.startsWith('**') && p.endsWith('**')) {
      return (
        <strong key={i} style={{ color: 'var(--color-text-primary)', fontWeight: 700 }}>
          {p.slice(2, -2)}
        </strong>
      );
    }
    return <span key={i}>{p}</span>;
  });
}
