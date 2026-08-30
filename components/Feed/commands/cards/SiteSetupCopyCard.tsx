'use client';

/**
 * Site setup · step 2 — copy a shop and link it to a hub.
 *
 * Each new site copies its full setup from the closest existing shop:
 * range and tier pattern, the production week including category
 * forecasts, selection times, permissions. Edify proposes the closest
 * match; every pick stays editable.
 *
 * The hub row mirrors Edify main's Settings → Production → Hub &
 * spoke: link the shop to the kitchen that produces for it, or leave
 * it standalone and everything is made in the shop. Pret don't order
 * products through Edify — the hub relationship is about where food
 * is made.
 */

import { useState } from 'react';
import { Copy } from 'lucide-react';
import CardShell, { PillRow } from './CardShell';
import type { CardState } from './CardShell';
import {
  TEMPLATE_SHOPS,
  HUBS,
  STANDALONE,
  getWorkdaySite,
} from '../siteSetupFixtures';

interface SiteSetupCopyCardProps {
  state: CardState;
  siteIds: string[];
  initialTemplates?: Record<string, string>;
  /** Per site: a hub id, or STANDALONE for no hub. */
  initialHubs?: Record<string, string>;
  onSubmit: (input: { templates: Record<string, string>; hubs: Record<string, string> }) => void;
  onCancel: () => void;
  /** Reopen for edits after confirm — available until final go-live. */
  onEdit?: () => void;
}

export default function SiteSetupCopyCard({
  state,
  siteIds,
  initialTemplates,
  initialHubs,
  onSubmit,
  onCancel,
  onEdit,
}: SiteSetupCopyCardProps) {
  const [templates, setTemplates] = useState<Record<string, string>>(() => {
    const map: Record<string, string> = {};
    for (const id of siteIds) {
      map[id] = initialTemplates?.[id] ?? getWorkdaySite(id)?.suggestedTemplateId ?? TEMPLATE_SHOPS[0].id;
    }
    return map;
  });
  const [hubs, setHubs] = useState<Record<string, string>>(() => {
    const map: Record<string, string> = {};
    for (const id of siteIds) {
      map[id] = initialHubs?.[id] ?? getWorkdaySite(id)?.suggestedHubId ?? STANDALONE;
    }
    return map;
  });

  const disabled = state !== 'pending';

  return (
    <CardShell
      icon={Copy}
      title="Copy a shop"
      subtitle="Range & tiers · production week & forecasts · selection times · permissions"
      state={state}
      confirmLabel="Continue"
      onCancel={onCancel}
      onEdit={onEdit}
      onConfirm={() => onSubmit({ templates, hubs })}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
        {siteIds.map((siteId) => {
          const site = getWorkdaySite(siteId);
          if (!site) return null;
          return (
            <div
              key={siteId}
              style={{
                padding: '10px 12px',
                borderRadius: '12px',
                border: '1px solid var(--color-border-subtle, rgba(0,28,53,0.10))',
                background: 'rgba(0,28,53,0.015)',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
              }}
            >
              <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--color-text-primary)' }}>
                {site.shortName}
              </div>
              <PillRow
                small
                disabled={disabled}
                options={TEMPLATE_SHOPS.map((t) => ({ value: t.id, label: t.name }))}
                selected={templates[siteId]}
                onSelect={(v) => setTemplates((prev) => ({ ...prev, [siteId]: v }))}
              />
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                <span
                  style={{
                    fontSize: '10.5px',
                    fontWeight: 700,
                    letterSpacing: '0.04em',
                    textTransform: 'uppercase',
                    color: 'var(--color-text-secondary)',
                  }}
                >
                  Hub
                </span>
                <PillRow
                  small
                  disabled={disabled}
                  options={[
                    ...HUBS.map((h) => ({ value: h.id, label: h.name })),
                    { value: STANDALONE, label: 'Standalone · no hub' },
                  ]}
                  selected={hubs[siteId]}
                  onSelect={(v) => setHubs((prev) => ({ ...prev, [siteId]: v }))}
                />
              </div>
            </div>
          );
        })}
      </div>
    </CardShell>
  );
}
