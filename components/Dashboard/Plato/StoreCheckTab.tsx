'use client';

import Link from 'next/link';
import { ClipboardList } from 'lucide-react';
import {
  storeCheckForStore,
  type StoreCheckRating,
  type StoreCheckSection,
} from '@/components/Dashboard/data/platoMockData';

const RATING_STYLES: Record<StoreCheckRating, { label: string; bg: string; fg: string }> = {
  great: { label: 'Great', bg: 'rgba(33,168,122,0.12)', fg: '#1d7a5f' },
  average: { label: 'Average', bg: 'rgba(212,144,77,0.14)', fg: '#a86a2d' },
  urgent: { label: 'Urgent', bg: 'rgba(212,77,77,0.12)', fg: '#b53a3a' },
};

const STOCK_STYLES: Record<StoreCheckRating, { label: string; bg: string; fg: string }> = {
  great: { label: 'Yes', bg: 'rgba(33,168,122,0.12)', fg: '#1d7a5f' },
  average: { label: 'Yes', bg: 'rgba(33,168,122,0.12)', fg: '#1d7a5f' },
  urgent: { label: 'No', bg: 'rgba(212,77,77,0.12)', fg: '#b53a3a' },
};

function RatingPill({ rating, scale }: { rating: StoreCheckRating; scale: StoreCheckSection['scale'] }) {
  const s = scale === 'stock' ? STOCK_STYLES[rating] : RATING_STYLES[rating];
  return (
    <span
      style={{
        padding: '3px 10px',
        borderRadius: 999,
        fontSize: 11,
        fontWeight: 700,
        background: s.bg,
        color: s.fg,
        whiteSpace: 'nowrap',
        flexShrink: 0,
      }}
    >
      {s.label}
    </span>
  );
}

function SectionCard({ section }: { section: StoreCheckSection }) {
  const attention = section.items.filter((i) => i.rating !== 'great').length;
  return (
    <section
      style={{
        borderRadius: 12,
        border: '1px solid var(--color-border-subtle)',
        background: '#fff',
        boxShadow: '0 2px 12px rgba(0, 28, 53,0.06)',
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '12px 16px',
          borderBottom: '1px solid var(--color-border-subtle)',
          background: 'var(--color-bg-hover)',
        }}
      >
        <h3 style={{ margin: 0, fontSize: 13, fontWeight: 700, color: 'var(--color-text-primary)', flex: 1 }}>
          {section.title}
        </h3>
        <span style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--color-text-muted)' }}>
          {attention === 0
            ? `${section.items.length} items · all clear`
            : `${section.items.length} items · ${attention} need${attention === 1 ? 's' : ''} attention`}
        </span>
      </div>
      <div>
        {section.items.map((item, idx) => (
          <div
            key={item.item}
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: 12,
              padding: '10px 16px',
              borderBottom: idx === section.items.length - 1 ? 'none' : '1px solid var(--color-border-subtle)',
            }}
          >
            <div style={{ width: 200, flexShrink: 0 }}>
              <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--color-text-primary)' }}>{item.item}</div>
              {item.detail && (
                <div style={{ fontSize: 11.5, fontWeight: 500, color: 'var(--color-text-muted)', marginTop: 1 }}>
                  {item.detail}
                </div>
              )}
            </div>
            <RatingPill rating={item.rating} scale={section.scale} />
            <div style={{ flex: 1, fontSize: 12, fontWeight: 500, color: 'var(--color-text-muted)', minWidth: 0 }}>
              {item.note ?? ''}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

export default function StoreCheckTab({ store }: { store: string }) {
  const { meta, sections } = storeCheckForStore(store);
  const allItems = sections.flatMap((s) => s.items);
  const great = allItems.filter((i) => i.rating === 'great').length;
  const average = allItems.filter((i) => i.rating === 'average').length;
  const urgent = allItems.filter((i) => i.rating === 'urgent').length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, fontFamily: 'var(--font-primary)' }}>
      <header style={{ display: 'flex', alignItems: 'flex-end', gap: 12, flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 220 }}>
          <div
            style={{
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: 0.6,
              textTransform: 'uppercase',
              color: 'var(--color-text-muted)',
              marginBottom: 6,
            }}
          >
            Store check sheet
          </div>
          <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--color-text-primary)' }}>
            {meta.store}
          </div>
          <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--color-text-muted)', marginTop: 4 }}>
            Visit date {meta.date} · walkthrough across store, equipment and stock
          </div>
          <Link
            href="/checklists/complete/inst-plato-storecheck"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              marginTop: 10,
              padding: '7px 12px',
              borderRadius: 8,
              border: '1px solid var(--color-border-subtle)',
              background: '#fff',
              fontSize: 12,
              fontWeight: 600,
              color: 'var(--color-text-primary)',
              textDecoration: 'none',
            }}
          >
            <ClipboardList size={13} strokeWidth={2.2} color="var(--color-text-muted)" />
            Complete this check sheet as a checklist
          </Link>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {[
            { count: great, ...RATING_STYLES.great },
            { count: average, ...RATING_STYLES.average },
            { count: urgent, ...RATING_STYLES.urgent },
          ].map((s) => (
            <div
              key={s.label}
              style={{
                padding: '8px 14px',
                borderRadius: 10,
                background: s.bg,
                textAlign: 'center',
                minWidth: 72,
              }}
            >
              <div style={{ fontSize: 18, fontWeight: 700, color: s.fg, lineHeight: 1.1 }}>{s.count}</div>
              <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: 0.4, textTransform: 'uppercase', color: s.fg }}>
                {s.label}
              </div>
            </div>
          ))}
        </div>
      </header>

      {sections.map((section) => (
        <SectionCard key={section.title} section={section} />
      ))}
    </div>
  );
}
