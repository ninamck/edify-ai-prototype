'use client';

import Link from 'next/link';
import { MOCK_POS } from './mockData';

/**
 * Tab strip for the Deliveries area — Upcoming (POs awaiting delivery,
 * where accepting happens) and Accepted (the GRN record). Mirrors the
 * production app's Deliveries tabs.
 */
export default function DeliveriesTabs({ active }: { active: 'upcoming' | 'accepted' }) {
  const upcomingCount = MOCK_POS.filter(
    p => p.status === 'Sent' || p.status === 'Partially Received',
  ).length;

  const tabs = [
    { id: 'upcoming' as const, label: 'Upcoming', count: upcomingCount, href: '/receive/upcoming' },
    { id: 'accepted' as const, label: 'Accepted', href: '/receive/accepted' },
  ];

  return (
    <div style={{ display: 'flex', gap: '6px', marginBottom: '20px' }}>
      {tabs.map(t => {
        const isActive = t.id === active;
        return (
          <Link
            key={t.id}
            href={t.href}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '7px 16px',
              borderRadius: '100px',
              fontSize: '13px',
              fontWeight: 600,
              fontFamily: 'var(--font-primary)',
              textDecoration: 'none',
              background: isActive ? 'var(--color-accent-active)' : 'transparent',
              color: isActive ? '#fff' : 'var(--color-text-secondary)',
              border: isActive ? '1px solid var(--color-accent-active)' : '1px solid var(--color-border-subtle)',
            }}
          >
            {t.label}
            {t.count !== undefined && t.count > 0 && (
              <span
                style={{
                  fontSize: '11px',
                  fontWeight: 700,
                  padding: '1px 7px',
                  borderRadius: '100px',
                  background: isActive ? 'rgba(255,255,255,0.2)' : 'var(--color-bg-hover)',
                  color: isActive ? '#fff' : 'var(--color-text-secondary)',
                }}
              >
                {t.count}
              </span>
            )}
          </Link>
        );
      })}
    </div>
  );
}
