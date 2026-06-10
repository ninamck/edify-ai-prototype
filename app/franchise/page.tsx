'use client';

import { useRouter } from 'next/navigation';
import {
  Store,
  ChefHat,
  Truck,
  Package,
  Boxes,
  ArrowRight,
  AlertTriangle,
  TrendingUp,
  Share2,
} from 'lucide-react';
import { useFranchise } from '@/components/Franchise/FranchiseContext';
import { useActiveSite } from '@/components/ActiveSite/ActiveSiteContext';
import {
  SHARED_LIBRARY_COUNTS,
  TOTAL_STORE_COUNT,
} from '@/components/Franchise/fixtures';

function initials(name: string): string {
  return name
    .split(' ')
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase();
}

export default function FranchiseOverviewPage() {
  const router = useRouter();
  const {
    group,
    franchises,
    setViewMode,
  } = useFranchise();
  const { setActiveSiteId } = useActiveSite();

  function enterStore(activeSiteId: string) {
    setActiveSiteId(activeSiteId);
    setViewMode('store');
    router.push('/');
  }

  return (
    <div style={{ maxWidth: 1120, margin: '0 auto', padding: '24px 24px 56px' }}>
      {/* 1 — Group header */}
      <header style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
          <Boxes size={14} color="var(--color-accent-active)" strokeWidth={2.2} />
          <span style={eyebrowStyle}>Franchise group</span>
        </div>
        <h1
          style={{
            margin: 0,
            fontSize: 26,
            fontWeight: 700,
            color: 'var(--color-text-primary)',
            fontFamily: 'var(--font-primary)',
          }}
        >
          {group.name}
        </h1>
        <p style={{ margin: '6px 0 0', fontSize: 14, color: 'var(--color-text-secondary)' }}>
          {franchises.length} franchises · {TOTAL_STORE_COUNT} stores · 1 shared library
        </p>
      </header>

      {/* 2 — Brand cards (lead element) */}
      <SectionTitle>Franchises</SectionTitle>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
          gap: 14,
          marginBottom: 28,
        }}
      >
        {franchises.map((franchise) => {
          return (
            <article
              key={franchise.id}
              style={{
                border: '1px solid var(--color-border-subtle)',
                borderRadius: 14,
                background: '#fff',
                overflow: 'hidden',
                display: 'flex',
                flexDirection: 'column',
              }}
            >
              <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12, flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <span
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      width: 44,
                      height: 44,
                      borderRadius: 12,
                      background: franchise.brandColor,
                      color: '#fff',
                      fontSize: 15,
                      fontWeight: 700,
                      flexShrink: 0,
                    }}
                  >
                    {franchise.code ?? initials(franchise.name)}
                  </span>
                  <div style={{ minWidth: 0 }}>
                    <div
                      style={{
                        fontSize: 15,
                        fontWeight: 700,
                        color: 'var(--color-text-primary)',
                      }}
                    >
                      {franchise.name}
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>
                      {franchise.tagline}
                    </div>
                  </div>
                </div>

                <span
                  style={{
                    alignSelf: 'flex-start',
                    fontSize: 10,
                    fontWeight: 700,
                    letterSpacing: '0.04em',
                    textTransform: 'uppercase',
                    color: 'var(--color-text-muted)',
                    background: 'var(--color-bg-surface)',
                    border: '1px solid var(--color-border-subtle)',
                    borderRadius: 100,
                    padding: '3px 10px',
                  }}
                >
                  {franchise.category}
                </span>

                {/* Light demo metrics */}
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(3, 1fr)',
                    gap: 8,
                    borderTop: '1px solid var(--color-border-subtle)',
                    paddingTop: 12,
                    marginTop: 'auto',
                  }}
                >
                  <Metric
                    icon={<TrendingUp size={13} />}
                    label="Sales today"
                    value={franchise.metrics.salesToday}
                  />
                  <Metric
                    icon={<Store size={13} />}
                    label="Stores"
                    value={String(franchise.stores.length)}
                  />
                  <Metric
                    icon={<AlertTriangle size={13} />}
                    label="Attention"
                    value={String(franchise.metrics.storesNeedingAttention)}
                    warn={franchise.metrics.storesNeedingAttention > 0}
                  />
                </div>
              </div>
            </article>
          );
        })}
      </div>

      {/* 3 — Stores roll-up (every store across the group) */}
      <SectionTitle>
        Stores
        <span style={{ fontWeight: 500, color: 'var(--color-text-muted)' }}>
          {' '}
          · {TOTAL_STORE_COUNT} across {franchises.length} franchises
        </span>
      </SectionTitle>
      <div
        style={{
          border: '1px solid var(--color-border-subtle)',
          borderRadius: 14,
          background: '#fff',
          overflow: 'hidden',
          marginBottom: 28,
        }}
      >
        {franchises.map((franchise) => {
          const stores = franchise.stores;
          return (
            <div key={franchise.id}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '8px 14px',
                  background: 'var(--color-bg-surface)',
                  borderBottom: '1px solid var(--color-border-subtle)',
                }}
              >
                <span
                  style={{
                    width: 10,
                    height: 10,
                    borderRadius: 3,
                    background: franchise.brandColor,
                  }}
                />
                <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--color-text-primary)' }}>
                  {franchise.name}
                </span>
              </div>
              {stores.map((store) => (
                <div
                  key={store.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    padding: '10px 14px',
                    borderBottom: '1px solid var(--color-border-subtle)',
                  }}
                >
                  <Store size={15} color="var(--color-text-muted)" />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text-primary)' }}>
                      {store.name}
                      {store.needsAttention && (
                        <span
                          style={{
                            marginLeft: 8,
                            fontSize: 10,
                            fontWeight: 700,
                            color: 'var(--color-warning)',
                          }}
                        >
                          NEEDS ATTENTION
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--color-text-secondary)' }}>
                      {store.location}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => { if (store.activeSiteId) enterStore(store.activeSiteId); }}
                    style={openStoreBtn}
                  >
                    Open <ArrowRight size={12} strokeWidth={2.2} />
                  </button>
                </div>
              ))}
            </div>
          );
        })}
      </div>

      {/* 4 — Shared across the group */}
      <SectionTitle>
        <Share2 size={14} style={{ verticalAlign: '-2px', marginRight: 6 }} />
        Shared across the group
      </SectionTitle>
      <p style={{ margin: '0 0 12px', fontSize: 13, color: 'var(--color-text-secondary)' }}>
        One library, maintained centrally and shared to every franchise — so brands stay
        consistent without duplicating work.
      </p>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
          gap: 14,
          marginBottom: 28,
        }}
      >
        <SharedTile
          icon={<ChefHat size={18} />}
          label="Recipes"
          count={SHARED_LIBRARY_COUNTS.recipes}
          note="shared to all franchises"
          onClick={() => router.push('/recipes')}
        />
        <SharedTile
          icon={<Truck size={18} />}
          label="Suppliers"
          count={SHARED_LIBRARY_COUNTS.suppliers}
          note="shared vendor network"
          onClick={() => router.push('/suppliers')}
        />
        <SharedTile
          icon={<Package size={18} />}
          label="Products"
          count={SHARED_LIBRARY_COUNTS.products}
          note="normalised catalogue"
          onClick={() => router.push('/suppliers')}
        />
      </div>

    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2
      style={{
        margin: '0 0 12px',
        fontSize: 13,
        fontWeight: 700,
        letterSpacing: '0.03em',
        textTransform: 'uppercase',
        color: 'var(--color-text-secondary)',
        fontFamily: 'var(--font-primary)',
      }}
    >
      {children}
    </h2>
  );
}

function Metric({
  icon,
  label,
  value,
  warn,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  warn?: boolean;
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 4,
          fontSize: 10,
          fontWeight: 600,
          color: 'var(--color-text-muted)',
        }}
      >
        {icon}
        {label}
      </span>
      <span
        style={{
          fontSize: 16,
          fontWeight: 700,
          color: warn ? 'var(--color-warning)' : 'var(--color-text-primary)',
        }}
      >
        {value}
      </span>
    </div>
  );
}

function SharedTile({
  icon,
  label,
  count,
  note,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  count: number;
  note: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        textAlign: 'left',
        border: '1px solid var(--color-border-subtle)',
        borderRadius: 14,
        background: '#fff',
        padding: 16,
        cursor: 'pointer',
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
        fontFamily: 'var(--font-primary)',
        transition: 'border-color 0.12s ease, box-shadow 0.12s ease',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = 'var(--color-accent-active)';
        e.currentTarget.style.boxShadow = '0 6px 18px rgba(12,20,44,0.08)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = 'var(--color-border-subtle)';
        e.currentTarget.style.boxShadow = 'none';
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 36,
            height: 36,
            borderRadius: 10,
            background: 'var(--color-bg-hover)',
            color: 'var(--color-accent-active)',
          }}
        >
          {icon}
        </span>
        <ArrowRight size={15} color="var(--color-text-muted)" />
      </div>
      <div>
        <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--color-text-primary)' }}>
          {count}
        </div>
        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text-primary)' }}>
          {label}
        </div>
        <div style={{ fontSize: 11, color: 'var(--color-text-secondary)', marginTop: 2 }}>
          {note}
        </div>
      </div>
    </button>
  );
}

const eyebrowStyle: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 700,
  letterSpacing: '0.06em',
  textTransform: 'uppercase',
  color: 'var(--color-accent-active)',
};

const openStoreBtn: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 5,
  padding: '6px 12px',
  borderRadius: 8,
  border: '1px solid var(--color-border-subtle)',
  background: '#fff',
  color: 'var(--color-accent-active)',
  fontSize: 12,
  fontWeight: 600,
  cursor: 'pointer',
  fontFamily: 'var(--font-primary)',
  whiteSpace: 'nowrap',
};
