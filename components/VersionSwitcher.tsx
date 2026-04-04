'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const VERSIONS = [
  { label: 'v1', href: '/v1', description: 'Frozen: Nina briefing (FeedV1) + wastage / orders / sales' },
  { label: 'v2', href: '/v2', description: 'Saved iteration — shared Feed (earlier snapshot)' },
  { label: 'v3', href: '/v3', description: 'Saved iteration v3 — SETUP, floor checklists tile, recipe Quinn flow, iterations bar' },
];

export default function VersionSwitcher() {
  const pathname = usePathname();
  const isRoot = pathname === '/';

  return (
    <div style={{
      position: 'fixed',
      bottom: '20px',
      left: '50%',
      transform: 'translateX(-50%)',
      display: 'flex',
      alignItems: 'center',
      gap: '4px',
      background: 'rgba(34,68,68,0.88)',
      backdropFilter: 'blur(8px)',
      borderRadius: '100px',
      padding: '5px 6px',
      boxShadow: '0 4px 16px rgba(0,0,0,0.2)',
      zIndex: 1000,
      fontFamily: 'var(--font-primary)',
    }}>
      <span style={{
        fontSize: '10px', fontWeight: 600, letterSpacing: '0.06em',
        color: 'rgba(255,255,255,0.6)',
        textTransform: 'uppercase', padding: '0 8px',
      }}>
        Iterations
      </span>

      {/* Latest (root) */}
      <Link
        href="/"
        style={{
          display: 'inline-flex', alignItems: 'center',
          padding: '5px 12px', borderRadius: '100px',
          fontSize: '12px', fontWeight: 600,
          textDecoration: 'none',
          background: isRoot ? 'var(--color-accent-quinn)' : 'transparent',
          color: isRoot ? '#1a3636' : 'rgba(255,255,255,0.5)',
          transition: 'all 0.15s ease',
        }}
      >
        Latest
      </Link>

      {/* Saved versions */}
      {VERSIONS.map(v => {
        const active = pathname === v.href;
        return (
          <Link
            key={v.href}
            href={v.href}
            title={v.description}
            style={{
              display: 'inline-flex', alignItems: 'center',
              padding: '5px 12px', borderRadius: '100px',
              fontSize: '12px', fontWeight: 600,
              textDecoration: 'none',
              background: active ? 'var(--color-accent-quinn)' : 'transparent',
              color: active ? '#1a3636' : 'rgba(255,255,255,0.5)',
              transition: 'all 0.15s ease',
            }}
          >
            {v.label}
          </Link>
        );
      })}
    </div>
  );
}
