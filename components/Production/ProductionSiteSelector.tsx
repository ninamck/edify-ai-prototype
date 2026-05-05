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
import {
  TOP_NAV_PILL_ACTIVE,
  TOP_NAV_PILL_COMPACT,
  TOP_NAV_PILL_GAP,
  TOP_NAV_PILL_IDLE_OUTLINED,
  TOP_NAV_SECTION_LABEL,
} from './topNavStyles';

export default function ProductionSiteSelector() {
  const { siteId, setSiteId, options, canPickSite } = useProductionSite();
  const settings = useSiteSettingsStore();
  if (!canPickSite) return null;

  return (
    <div
      style={{
        padding: '8px 24px',
        borderBottom: '1px solid var(--color-border-subtle)',
        background: '#ffffff',
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        flexWrap: 'wrap',
      }}
    >
      <span style={TOP_NAV_SECTION_LABEL}>Site</span>
      <div style={{ display: 'flex', gap: TOP_NAV_PILL_GAP, flexWrap: 'wrap' }}>
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
                ...TOP_NAV_PILL_COMPACT,
                ...(active ? TOP_NAV_PILL_ACTIVE : TOP_NAV_PILL_IDLE_OUTLINED),
              }}
            >
              <span>{label}</span>
              <span
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  letterSpacing: '0.04em',
                  opacity: active ? 0.85 : 0.7,
                }}
              >
                · {opt.tag}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
