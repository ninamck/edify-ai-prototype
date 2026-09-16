'use client';

/**
 * Site setup · rollback.
 *
 * Reached from Activity → Revert on a completed site set-up. Nothing
 * is written during the wizard until the final confirm, so the
 * inverse is exact: remove the shops that confirm created, cancel
 * their invites, and nothing is left on any planner. The card names
 * each shop so the operator can see what goes before pressing the
 * button. (Chel, Pret PRD review: "is there a rollback?")
 */

import { Undo2 } from 'lucide-react';
import CardShell from './CardShell';
import type { CardState } from './CardShell';
import { formatDay, getNewSite } from '../siteSetupFixtures';

interface SiteSetupRollbackCardProps {
  state: CardState;
  siteIds: string[];
  shopNames?: string[];
  goLiveDates?: Record<string, string>;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function SiteSetupRollbackCard({
  state,
  siteIds,
  shopNames,
  goLiveDates,
  onConfirm,
  onCancel,
}: SiteSetupRollbackCardProps) {
  const n = siteIds.length;
  return (
    <CardShell
      icon={Undo2}
      title={`Roll back site set-up · ${n} shop${n === 1 ? '' : 's'}`}
      subtitle="Removes the shops this set-up created. Nothing else was written"
      state={state}
      confirmLabel={`Remove ${n} shop${n === 1 ? '' : 's'}`}
      cancelLabel="Keep them"
      onCancel={onCancel}
      onConfirm={onConfirm}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
        {siteIds.map((id, i) => {
          const site = getNewSite(id);
          const name = shopNames?.[i] ?? site?.name ?? id;
          const live = goLiveDates?.[id];
          return (
            <div
              key={id}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                padding: '8px 11px',
                borderRadius: '10px',
                border: '1px solid var(--color-border-subtle, rgba(0,28,53,0.10))',
                background: '#fff',
              }}
            >
              <span style={{ flex: 1, fontSize: '12.5px', fontWeight: 700, color: 'var(--color-text-primary)' }}>
                {name}
              </span>
              <span style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>
                {site ? `${site.roster.length} invites cancelled` : ''}
                {live ? ` · was live ${formatDay(live)}` : ''}
              </span>
            </div>
          );
        })}
        <div style={{ fontSize: '11px', color: 'var(--color-text-muted)', lineHeight: 1.45 }}>
          Shop records stay in ShopDB. Run set-up again once the details are right.
        </div>
      </div>
    </CardShell>
  );
}
