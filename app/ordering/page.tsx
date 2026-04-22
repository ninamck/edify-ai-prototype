'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Sparkles, Check, Clock } from 'lucide-react';
import Stepper from '@/components/Receiving/Stepper';
import {
  useSites,
  useTierForSiteOnDay,
  useProducts,
  addDemandLines,
  type DemandLine,
  type Product,
} from '@/components/Production/productionStore';
import {
  TODAY,
  SPOKE_ORDER_CUTOFF,
  QUINN_ORDER_SUGGESTIONS,
} from '@/components/Production/fixtures/fitzroyCpu';
import {
  useCurrentSiteId,
  setCurrentRole,
  setCurrentSiteId,
  useCurrentRole,
} from '@/components/DemoControls/demoStore';
import { dayOfWeekFor } from '@/components/Production/siteFilter';
import { defaultRouteForRole } from '@/components/Production/roleFilter';
import { DEFAULT_HUB_ID } from '@/components/Production/fixtures/fitzroyCpu';

// When the spoke expects the delivery, by product category. Keeps the
// ordering UX simple — no per-line time picking.
const REQUIRED_BY_TIME: Record<string, string> = {
  'Bakery': '07:00',
  'Savoury': '07:30',
  'Beverage base': '06:30',
  'Drinks': '07:30',
  'Snacks': '08:00',
  'Breakfast': '07:00',
};

function requiredByFor(category: string): string {
  return `${TODAY}T${REQUIRED_BY_TIME[category] ?? '08:00'}:00+11:00`;
}

function formatCutoff(iso: string): string {
  // Pull the hour/minute straight out of the ISO so we show the local-
  // Melbourne time the fixture intends, regardless of the browser's zone.
  const m = iso.match(/T(\d{2}):(\d{2})/);
  if (!m) return iso;
  const h24 = parseInt(m[1], 10);
  const mins = m[2];
  const suffix = h24 >= 12 ? 'pm' : 'am';
  const h12 = h24 === 0 ? 12 : h24 > 12 ? h24 - 12 : h24;
  return mins === '00' ? `${h12}${suffix}` : `${h12}:${mins}${suffix}`;
}

export default function OrderingPage() {
  const currentSiteId = useCurrentSiteId();
  const currentRole = useCurrentRole();
  const sites = useSites();
  const products = useProducts();
  const site = sites.find(s => s.id === currentSiteId);
  const dayKey = dayOfWeekFor(TODAY);
  const tier = useTierForSiteOnDay(currentSiteId, dayKey);
  const router = useRouter();

  const tierProducts = useMemo(
    () => (tier ? products.filter(p => tier.productIds.includes(p.id)) : []),
    [tier, products],
  );

  // Group by category, preserving Made first, Stocked second.
  const grouped = useMemo(() => {
    const made = tierProducts.filter(p => p.type === 'made');
    const stocked = tierProducts.filter(p => p.type === 'stocked');
    const order: Product[] = [...made, ...stocked];
    const byCategory: Record<string, Product[]> = {};
    for (const p of order) {
      byCategory[p.category] = byCategory[p.category] ?? [];
      byCategory[p.category].push(p);
    }
    return byCategory;
  }, [tierProducts]);

  const suggestionsForSite = QUINN_ORDER_SUGGESTIONS[currentSiteId] ?? {};

  // User overrides on top of Quinn's suggestions. If a product isn't in
  // the map yet, fall back to the suggestion (or 0). Using a separate
  // override map keeps state in sync even when tier / site change.
  const [overrides, setOverrides] = useState<Record<string, number>>({});

  function quantityFor(productId: string): number {
    if (overrides[productId] !== undefined) return overrides[productId];
    return suggestionsForSite[productId]?.qty ?? 0;
  }

  function setQuantity(productId: string, v: number) {
    setOverrides(prev => ({ ...prev, [productId]: v }));
  }

  const [submitted, setSubmitted] = useState(false);
  const [submittedCount, setSubmittedCount] = useState(0);

  const quantities = useMemo(() => {
    const out: Record<string, number> = {};
    for (const p of tierProducts) out[p.id] = quantityFor(p.id);
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tierProducts, overrides, currentSiteId]);

  const totalItems = useMemo(
    () => Object.values(quantities).reduce((s, q) => s + q, 0),
    [quantities],
  );
  const linesWithQty = useMemo(
    () => Object.entries(quantities).filter(([, q]) => q > 0),
    [quantities],
  );

  const isSpoke = site?.kind === 'spoke';
  // Cutoff is shown as a chip but never blocks submission — for demo
  // friction-free flow. Real product would enforce.
  const cutoffPassed = false;

  function submit() {
    const linesToAdd: Omit<DemandLine, 'id'>[] = [];
    for (const [productId, qty] of linesWithQty) {
      if (qty <= 0) continue;
      const product = products.find(p => p.id === productId);
      if (!product) continue;
      linesToAdd.push({
        productId,
        source: 'spoke_order',
        siteId: currentSiteId,
        quantity: qty,
        requiredByDateTime: requiredByFor(product.category),
      });
    }
    addDemandLines(linesToAdd);
    setSubmittedCount(linesToAdd.length);
    setSubmitted(true);
  }

  function jumpToHubPlanner() {
    setCurrentSiteId(DEFAULT_HUB_ID);
    setCurrentRole('planner');
    router.push(defaultRouteForRole('planner'));
  }

  // Non-spoke empty state.
  if (!isSpoke) {
    return (
      <div style={{ padding: '28px 24px', maxWidth: '640px', margin: '0 auto', fontFamily: 'var(--font-primary)' }}>
        <h1 style={{ fontSize: '22px', fontWeight: 700, color: 'var(--color-text-primary)', margin: '0 0 8px' }}>
          Order for my site
        </h1>
        <p style={{ fontSize: '13px', lineHeight: 1.55, color: 'var(--color-text-secondary)', margin: '0 0 24px' }}>
          The hub ({site?.name}) doesn't place orders — switch to a spoke site in the header to see the ordering view.
        </p>
      </div>
    );
  }

  if (submitted) {
    return (
      <div style={{ padding: '28px 24px', maxWidth: '640px', margin: '0 auto', fontFamily: 'var(--font-primary)' }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            padding: '16px 18px',
            borderRadius: 'var(--radius-card)',
            background: 'rgba(21,128,61,0.08)',
            border: '1px solid var(--color-success)',
            marginBottom: '24px',
          }}
        >
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '36px',
              height: '36px',
              borderRadius: '999px',
              background: 'var(--color-success)',
              color: '#fff',
              flexShrink: 0,
            }}
          >
            <Check size={18} strokeWidth={2.4} />
          </div>
          <div>
            <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--color-success)' }}>
              Order submitted to Fitzroy Kitchen
            </div>
            <div style={{ fontSize: '12px', color: 'var(--color-text-secondary)', marginTop: '2px' }}>
              {submittedCount} demand lines · {totalItems} units · from {site.name}
            </div>
          </div>
        </div>

        <div
          style={{
            padding: '18px',
            borderRadius: 'var(--radius-card)',
            background: '#fff',
            border: '1px solid var(--color-border-subtle)',
          }}
        >
          <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--color-text-primary)', marginBottom: '8px' }}>
            What happens next
          </div>
          <ul style={{ margin: '0 0 16px', paddingLeft: '18px', color: 'var(--color-text-secondary)', fontSize: '13px', lineHeight: 1.6 }}>
            <li>Your order joins the other spokes in the hub's Demand Dashboard.</li>
            <li>The Hub Planner consolidates demand and builds today's runs.</li>
            <li>You'll see expected deliveries under <em>Receive a delivery</em>.</li>
          </ul>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={jumpToHubPlanner}
              style={{
                padding: '9px 14px',
                borderRadius: '8px',
                background: 'var(--color-accent-active)',
                border: '1.5px solid var(--color-accent-active)',
                color: '#fff',
                fontSize: '12px',
                fontWeight: 700,
                fontFamily: 'var(--font-primary)',
                cursor: 'pointer',
              }}
            >
              Switch to Hub Planner →
            </button>
            <button
              type="button"
              onClick={() => {
                setSubmitted(false);
                setSubmittedCount(0);
              }}
              style={{
                padding: '9px 14px',
                borderRadius: '8px',
                background: '#fff',
                border: '1px solid var(--color-border-subtle)',
                color: 'var(--color-text-secondary)',
                fontSize: '12px',
                fontWeight: 600,
                fontFamily: 'var(--font-primary)',
                cursor: 'pointer',
              }}
            >
              Review / add more
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ fontFamily: 'var(--font-primary)', paddingBottom: '80px' }}>
      {/* Header block */}
      <div style={{ padding: '24px 24px 14px', maxWidth: '860px', margin: '0 auto' }}>
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            padding: '5px 10px',
            borderRadius: '100px',
            background: 'rgba(34,68,68,0.08)',
            color: 'var(--color-accent-active)',
            fontSize: '11px',
            fontWeight: 700,
            letterSpacing: '0.04em',
            textTransform: 'uppercase',
            marginBottom: '12px',
          }}
        >
          <Sparkles size={11} strokeWidth={2.4} />
          Quinn prefilled · {tier?.name ?? '—'} tier
        </div>

        <h1 style={{ fontSize: '22px', fontWeight: 700, color: 'var(--color-text-primary)', margin: '0 0 6px' }}>
          Order for {site.name}
        </h1>
        <p style={{ fontSize: '13px', color: 'var(--color-text-secondary)', margin: 0, lineHeight: 1.5 }}>
          Review Quinn's suggested quantities · adjust what needs adjusting · submit before cut-off.
        </p>

        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            marginTop: '12px',
            padding: '5px 10px',
            borderRadius: '100px',
            border: '1px solid',
            borderColor: cutoffPassed ? 'var(--color-error)' : 'var(--color-border-subtle)',
            background: cutoffPassed ? 'rgba(185,28,28,0.06)' : 'var(--color-bg-hover)',
            color: cutoffPassed ? 'var(--color-error)' : 'var(--color-text-secondary)',
            fontSize: '11px',
            fontWeight: 600,
          }}
        >
          <Clock size={11} strokeWidth={2.2} />
          {cutoffPassed ? `Cut-off passed (${formatCutoff(SPOKE_ORDER_CUTOFF)})` : `Cut-off ${formatCutoff(SPOKE_ORDER_CUTOFF)}`}
        </div>
      </div>

      {/* Product list */}
      <div style={{ maxWidth: '860px', margin: '0 auto', padding: '0 24px' }}>
        {Object.entries(grouped).map(([category, items]) => (
          <section key={category} style={{ marginBottom: '24px' }}>
            <div
              style={{
                fontSize: '11px',
                fontWeight: 700,
                letterSpacing: '0.04em',
                textTransform: 'uppercase',
                color: 'var(--color-text-muted)',
                margin: '0 0 10px',
              }}
            >
              {category}
            </div>
            <div
              style={{
                background: '#fff',
                border: '1px solid var(--color-border-subtle)',
                borderRadius: 'var(--radius-card)',
                overflow: 'hidden',
              }}
            >
              {items.map((product, idx) => {
                const suggestion = suggestionsForSite[product.id];
                const qty = quantities[product.id] ?? 0;
                return (
                  <div
                    key={product.id}
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '1fr auto',
                      gap: '16px',
                      alignItems: 'center',
                      padding: '12px 16px',
                      borderBottom: idx === items.length - 1 ? 'none' : '1px solid var(--color-border-subtle)',
                    }}
                  >
                    <div style={{ minWidth: 0 }}>
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px',
                          fontSize: '13px',
                          fontWeight: 700,
                          color: 'var(--color-text-primary)',
                        }}
                      >
                        {product.name}
                        {product.priorityFlag && (
                          <span
                            style={{
                              fontSize: '9px',
                              fontWeight: 700,
                              letterSpacing: '0.04em',
                              textTransform: 'uppercase',
                              padding: '2px 6px',
                              borderRadius: 'var(--radius-badge)',
                              background: 'rgba(146,64,14,0.1)',
                              color: 'var(--color-warning)',
                            }}
                          >
                            Priority
                          </span>
                        )}
                      </div>
                      {suggestion && (
                        <div
                          style={{
                            fontSize: '11px',
                            color: 'var(--color-text-muted)',
                            marginTop: '3px',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '5px',
                          }}
                        >
                          <Sparkles size={10} strokeWidth={2.4} color="var(--color-accent-active)" />
                          Quinn suggests {suggestion.qty}
                          {suggestion.justification && <span> · {suggestion.justification}</span>}
                        </div>
                      )}
                    </div>
                    <Stepper
                      value={qty}
                      onChange={(v) => setQuantity(product.id, v)}
                      label={product.name}
                    />
                  </div>
                );
              })}
            </div>
          </section>
        ))}

        {Object.keys(grouped).length === 0 && (
          <div
            style={{
              padding: '40px 24px',
              textAlign: 'center',
              color: 'var(--color-text-secondary)',
              fontSize: '13px',
            }}
          >
            No tier scheduled for this day — contact your ops lead.
          </div>
        )}
      </div>

      {/* Sticky submit bar */}
      <div
        style={{
          position: 'fixed',
          bottom: 0,
          left: '68px',
          right: 0,
          padding: '12px 24px',
          background: '#fff',
          borderTop: '1px solid var(--color-border-subtle)',
          boxShadow: '0 -4px 14px rgba(58,48,40,0.06)',
          zIndex: 100,
        }}
      >
        <div
          style={{
            maxWidth: '860px',
            margin: '0 auto',
            display: 'flex',
            alignItems: 'center',
            gap: '16px',
          }}
        >
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--color-text-primary)' }}>
              {linesWithQty.length} {linesWithQty.length === 1 ? 'line' : 'lines'} · {totalItems} units
            </div>
            <div style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>
              Submits to Fitzroy Kitchen for today's runs
            </div>
          </div>
          <button
            type="button"
            onClick={submit}
            disabled={totalItems === 0}
            style={{
              padding: '10px 18px',
              borderRadius: '8px',
              background: totalItems === 0 ? 'var(--color-bg-hover)' : 'var(--color-accent-active)',
              border: 'none',
              color: totalItems === 0 ? 'var(--color-text-muted)' : '#fff',
              fontSize: '13px',
              fontWeight: 700,
              fontFamily: 'var(--font-primary)',
              cursor: totalItems === 0 ? 'not-allowed' : 'pointer',
              transition: 'background 0.12s ease',
            }}
          >
            Submit order
          </button>
        </div>
      </div>
    </div>
  );
}
