'use client';

import { useActiveSite } from '@/components/ActiveSite/ActiveSiteContext';
import { getShop, FJ_ALL_SHOPS_ID } from './shops';

/**
 * Stand-in body for a Farmer J tab that has not been built yet. Each step
 * of the build replaces one of these with the real screen. Shows the shop
 * the demo is on so switching shops visibly changes something from Step 0.
 */
export default function FjPlaceholder({
  title,
  purpose,
  step,
}: {
  title: string;
  /** One or two sentences: who uses this and what they get from it. */
  purpose: string;
  /** Build step that lands the real screen. */
  step: number;
}) {
  const { isFarmerJ, activeSite, productionSiteId } = useActiveSite();

  if (!isFarmerJ) {
    return (
      <Frame>
        <h1 style={h1}>{title}</h1>
        <p style={p}>
          This page belongs to the Farmer J demo. Switch the Brand pill in demo controls to
          Farmer J to see it.
        </p>
      </Frame>
    );
  }

  const shop = productionSiteId ? getShop(productionSiteId) : undefined;
  const shopLine =
    productionSiteId === FJ_ALL_SHOPS_ID
      ? 'All 19 shops'
      : shop
        ? `${shop.name} · ${shop.area} · opens ${shop.opensAt.replace(/^0/, '')}${shop.breakfast ? ' with breakfast' : ', lunch only'}${shop.weekend ? '' : ' · closed weekends'}`
        : activeSite.name;

  return (
    <Frame>
      <div style={eyebrow}>{shopLine}</div>
      <h1 style={h1}>{title}</h1>
      <p style={p}>{purpose}</p>
      <div style={chip}>Built in step {step}</div>
    </Frame>
  );
}

function Frame({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        maxWidth: 720,
        margin: '0 auto',
        padding: '48px 24px',
        fontFamily: 'var(--font-primary)',
        color: 'var(--color-text-primary)',
      }}
    >
      {children}
    </div>
  );
}

const eyebrow: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 600,
  letterSpacing: '0.04em',
  textTransform: 'uppercase',
  color: 'var(--color-text-muted)',
  marginBottom: 8,
};

const h1: React.CSSProperties = {
  fontSize: 24,
  fontWeight: 700,
  margin: '0 0 12px',
};

const p: React.CSSProperties = {
  fontSize: 15,
  lineHeight: 1.5,
  color: 'var(--color-text-secondary)',
  margin: '0 0 20px',
};

const chip: React.CSSProperties = {
  display: 'inline-block',
  fontSize: 12,
  fontWeight: 600,
  padding: '4px 10px',
  borderRadius: 999,
  background: 'var(--color-bg-hover)',
  color: 'var(--color-text-secondary)',
};
