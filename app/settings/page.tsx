'use client';

import { Suspense, useCallback, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ChevronDown } from 'lucide-react';
import StatusPill from '@/components/Production/StatusPill';
import SiteSettingsEditor, {
  type SettingsTabId,
} from '@/components/Settings/SiteSettingsEditor';
import { listAllSites } from '@/components/Settings/siteSettingsStore';
import type { SiteId } from '@/components/Production/fixtures';

const TAB_IDS: SettingsTabId[] = [
  'general', 'cutoffs', 'benches', 'team', 'windows', 'range-tiers',
];

export default function SettingsPage() {
  return (
    <Suspense fallback={null}>
      <SettingsPageInner />
    </Suspense>
  );
}

function SettingsPageInner() {
  const router = useRouter();
  const params = useSearchParams();
  const sites = useMemo(() => listAllSites(), []);

  const querySite = params.get('site') as SiteId | null;
  const queryTab = params.get('tab') as SettingsTabId | null;
  const siteId: SiteId = querySite && sites.some(s => s.id === querySite)
    ? querySite
    : sites[0]?.id ?? ('hub-central' as SiteId);
  const initialTab: SettingsTabId =
    queryTab && TAB_IDS.includes(queryTab) ? queryTab : 'general';

  const setSite = useCallback(
    (id: SiteId) => {
      const sp = new URLSearchParams(params.toString());
      sp.set('site', id);
      router.replace(`/settings?${sp.toString()}`);
    },
    [router, params],
  );

  const setTab = useCallback(
    (tab: SettingsTabId) => {
      const sp = new URLSearchParams(params.toString());
      sp.set('tab', tab);
      router.replace(`/settings?${sp.toString()}`);
    },
    [router, params],
  );

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        background: 'var(--color-bg-surface)',
      }}
    >
      {/* Site picker bar — Pret-style dropdown across all sites in the demo */}
      <div
        style={{
          flexShrink: 0,
          padding: '10px 16px',
          borderBottom: '1px solid var(--color-border-subtle)',
          background: '#ffffff',
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          flexWrap: 'wrap',
        }}
      >
        <span
          style={{
            fontSize: 9.5,
            fontWeight: 700,
            color: 'var(--color-text-muted)',
            textTransform: 'uppercase',
            letterSpacing: '0.06em',
          }}
        >
          Site
        </span>
        <SiteDropdown
          value={siteId}
          options={sites.map(s => ({ id: s.id, label: s.name, type: s.type }))}
          onChange={setSite}
        />
        <span style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>
          Configure the defaults Quinn uses for this site. Edits override the format / estate cascade.
        </span>
      </div>

      <div style={{ flex: 1, minHeight: 0 }}>
        <SiteSettingsEditor
          key={siteId}
          siteId={siteId}
          initialTab={initialTab}
          onTabChange={setTab}
        />
      </div>
    </div>
  );
}

function SiteDropdown({
  value,
  options,
  onChange,
}: {
  value: SiteId;
  options: Array<{ id: SiteId; label: string; type: 'STANDALONE' | 'HUB' | 'SPOKE' | 'HYBRID' }>;
  onChange: (id: SiteId) => void;
}) {
  const active = options.find(o => o.id === value);
  return (
    <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}>
      <select
        value={value}
        onChange={e => onChange(e.target.value as SiteId)}
        style={{
          appearance: 'none',
          padding: '8px 32px 8px 12px',
          borderRadius: 8,
          border: '1px solid var(--color-border)',
          background: '#ffffff',
          fontSize: 13,
          fontWeight: 700,
          fontFamily: 'var(--font-primary)',
          color: 'var(--color-text-primary)',
          minWidth: 240,
          cursor: 'pointer',
        }}
      >
        {options.map(o => (
          <option key={o.id} value={o.id}>
            {o.label} · {o.type}
          </option>
        ))}
      </select>
      <ChevronDown
        size={14}
        style={{
          position: 'absolute',
          right: 10,
          color: 'var(--color-text-muted)',
          pointerEvents: 'none',
        }}
      />
      {active && (
        <span style={{ marginLeft: 8 }}>
          <StatusPill
            tone={active.type === 'HUB' ? 'brand' : active.type === 'SPOKE' ? 'info' : 'neutral'}
            label={active.type}
            size="xs"
          />
        </span>
      )}
    </div>
  );
}
