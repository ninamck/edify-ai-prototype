'use client';

import { Building2, Truck, Boxes, Inbox } from 'lucide-react';
import type { Site } from './fixtures';
import { getSite } from './fixtures';
import { productionSiteLabel } from './productionSiteOptions';

/**
 * Site-type-aware banner pinned above the recipe-first grid.
 *
 * The four variants mirror the live Edify wording captured in the
 * hub/spoke screenshots so users land on familiar copy:
 *   - STANDALONE → "Planning for a Standalone site — produced and sold here."
 *   - HUB        → "Planning for a Hub Shop — produced here, dispatched to spokes."
 *   - SPOKE      → "Planning for a Spoke Site — sent to {hub} for production."
 *   - HYBRID     → "Planning for a Hybrid Site — anything linked to a hub
 *                  gets sent there automatically; everything else is made
 *                  here on the bench."
 */
type SiteTypeBannerProps = {
  site: Site | undefined;
};

export default function SiteTypeBanner({ site }: SiteTypeBannerProps) {
  if (!site) return null;
  const variant = bannerVariant(site);

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: 12,
        padding: '12px 16px',
        margin: '12px 16px 0',
        borderRadius: 'var(--radius-card)',
        background: 'var(--color-bg-surface)',
        border: '1px solid var(--color-border-subtle)',
        borderLeft: `3px solid ${variant.accent}`,
      }}
    >
      <div
        style={{
          width: 28,
          height: 28,
          borderRadius: 6,
          background: variant.iconBg,
          color: variant.accent,
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        <variant.Icon size={15} />
      </div>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
        <div
          style={{
            fontSize: 11,
            fontWeight: 700,
            color: 'var(--color-text-muted)',
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
          }}
        >
          {variant.kicker}
        </div>
        <div style={{ fontSize: 13, color: 'var(--color-text-primary)', lineHeight: 1.5 }}>
          {variant.body}
        </div>
      </div>
    </div>
  );
}

type Variant = {
  kicker: string;
  body: React.ReactNode;
  accent: string;
  iconBg: string;
  Icon: typeof Building2;
};

function bannerVariant(site: Site): Variant {
  if (site.type === 'HUB') {
    return {
      kicker: 'Hub Shop',
      body: (
        <>
          You are planning production for a <strong>Hub Shop</strong>. Everything
          baked here is dispatched out to the spokes that order from this hub —
          per-spoke columns show how the day is split.
        </>
      ),
      accent: 'var(--color-info)',
      iconBg: 'var(--color-info-light)',
      Icon: Boxes,
    };
  }
  if (site.type === 'SPOKE') {
    const hubName = productionSiteLabel(site.hubId ?? '') || (site.hubId ? getSite(site.hubId)?.name : null) || 'the hub';
    return {
      kicker: 'Spoke Site',
      body: (
        <>
          You are planning production for a <strong>Spoke Site</strong>. Your
          order will be sent to <strong>{hubName}</strong> — the hub bakes and
          dispatches before opening.
        </>
      ),
      accent: 'var(--color-text-secondary)',
      iconBg: 'var(--color-bg-hover)',
      Icon: Inbox,
    };
  }
  if (site.type === 'HYBRID') {
    const hubName = productionSiteLabel(site.hubId ?? '') || (site.hubId ? getSite(site.hubId)?.name : null) || 'the hub';
    return {
      kicker: 'Hybrid Site',
      body: (
        <>
          You are planning for a <strong>Hybrid Site</strong>. Anything linked
          to <strong>{hubName}</strong> gets sent here automatically; everything
          else moves to bench planning. Each row is tagged{' '}
          <em>Make</em> or <em>Receive</em>.
        </>
      ),
      accent: 'var(--color-warning)',
      iconBg: 'var(--color-warning-light)',
      Icon: Truck,
    };
  }
  if (site.type === 'HYBRID_HUB') {
    const hubName = productionSiteLabel(site.hubId ?? '') || (site.hubId ? getSite(site.hubId)?.name : null) || 'the hub';
    return {
      kicker: 'Hybrid Site',
      body: (
        <>
          You are planning for a <strong>Hybrid Site</strong> that also bakes
          for other shops. The linked range comes in from{' '}
          <strong>{hubName}</strong> and the rest is made on your benches
          (each row is tagged <em>Make</em> or <em>Receive</em>) — and the
          per-spoke columns show what you produce and dispatch for the sites
          you supply.
        </>
      ),
      accent: 'var(--color-warning)',
      iconBg: 'var(--color-warning-light)',
      Icon: Boxes,
    };
  }
  // STANDALONE (self or linked dark-kitchen)
  if (site.linkType === 'linked' && site.hubId) {
    const hubName = productionSiteLabel(site.hubId) || getSite(site.hubId)?.name || 'the hub';
    return {
      kicker: 'Linked Standalone',
      body: (
        <>
          You are planning production for a linked <strong>Standalone</strong>{' '}
          site. <strong>{hubName}</strong> bakes the bakery range on your
          behalf and ships overnight; the rest is made on your benches.
        </>
      ),
      accent: 'var(--color-info)',
      iconBg: 'var(--color-info-light)',
      Icon: Truck,
    };
  }
  return {
    kicker: 'Standalone Site',
    body: (
      <>
        You are planning production for a <strong>Standalone</strong> site —
        everything is produced here on your benches and sold from your own
        retail floor.
      </>
    ),
    accent: 'var(--color-success)',
    iconBg: 'var(--color-success-light)',
    Icon: Building2,
  };
}
