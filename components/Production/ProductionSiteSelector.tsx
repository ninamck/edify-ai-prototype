'use client';

/**
 * ProductionSiteSelector — the canonical site picker mounted once in
 * the production layout, just under the sub-tab nav. Every page under
 * /production reads its current site from `useProductionSite()`, so
 * this control is the single point of switch.
 *
 * Hidden when the active persona doesn't get to choose (spoke persona
 * is locked to its own site).
 */

import { useProductionSite } from './ProductionSiteContext';
import { useSiteSettingsStore } from '@/components/Settings/siteSettingsStore';

export default function ProductionSiteSelector() {
  const { siteId, setSiteId, options, canPickSite } = useProductionSite();
  const settings = useSiteSettingsStore();
  if (!canPickSite) return null;

  return (
    <div
      style={{
        padding: '10px 16px',
        borderBottom: '1px solid var(--color-border-subtle)',
        background: '#ffffff',
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        flexWrap: 'wrap',
      }}
    >
      <span
        style={{
          fontSize: 11,
          fontWeight: 700,
          color: 'var(--color-text-muted)',
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
        }}
      >
        Site
      </span>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {options.map(opt => {
          const active = opt.id === siteId;
          // If the manager has renamed the site in /settings, prefer the
          // override; otherwise stick with the persona-friendly label.
          const overlay = settings.overlayFor(opt.id);
          const label = overlay?.core?.name ?? opt.label;
          return (
            <button
              key={opt.id}
              type="button"
              onClick={() => setSiteId(opt.id)}
              style={{
                padding: '7px 12px',
                borderRadius: 8,
                fontSize: 11,
                fontWeight: 600,
                fontFamily: 'var(--font-primary)',
                background: active ? 'var(--color-accent-active)' : '#ffffff',
                color: active ? 'var(--color-text-on-active)' : 'var(--color-text-secondary)',
                border: `1px solid ${active ? 'var(--color-accent-active)' : 'var(--color-border)'}`,
                cursor: 'pointer',
                whiteSpace: 'nowrap',
              }}
            >
              {label} · {opt.tag}
            </button>
          );
        })}
      </div>
    </div>
  );
}
