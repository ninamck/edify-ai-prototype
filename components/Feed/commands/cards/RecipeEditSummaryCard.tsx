'use client';

import { useState } from 'react';
import { Check } from 'lucide-react';
import CardShell, { PillRow, type CardState } from './CardShell';
import type { RecipeEditKind } from '../parsers';

interface RecipeEditSummaryCardProps {
  recipeId: string;
  recipeName: string;
  kind: RecipeEditKind;
  fromName?: string;
  toName?: string;
  qty?: number;
  uom?: string;
  state: CardState;
  onConfirm: (final: {
    recipeId: string;
    recipeName: string;
    kind: RecipeEditKind;
    fromName?: string;
    toName?: string;
    qty?: number;
    uom?: string;
    scope: 'all' | 'site';
    siteLabel?: string;
  }) => void;
  onCancel: () => void;
}

const SITE_OPTIONS = ['Fitzroy', 'Brunswick', 'Carlton', 'Northcote'];

/**
 * Step 5 of the Update-recipe wizard. Shows a clean diff line plus a
 * site-scope toggle. This is the only step that actually mutates —
 * everything earlier just collected info.
 */
export default function RecipeEditSummaryCard({
  recipeId,
  recipeName,
  kind,
  fromName,
  toName,
  qty,
  uom,
  state,
  onConfirm,
  onCancel,
}: RecipeEditSummaryCardProps) {
  const [scope, setScope] = useState<'all' | 'site'>('all');
  const [siteLabel, setSiteLabel] = useState<string>(SITE_OPTIONS[0]);

  const qtyLabel = qty != null ? `${qty}${uom ?? ''}` : '';

  // Build the headline + diff visual depending on the action kind.
  let diff: React.ReactNode;
  if (kind === 'swap') {
    diff = (
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
        <Pill label={fromName ?? '—'} tone="strike" />
        <span style={{ fontSize: '14px', fontWeight: 700, color: 'var(--color-text-muted)' }}>→</span>
        <Pill label={`${toName ?? '—'}${qtyLabel ? ` · ${qtyLabel}` : ''}`} tone="add" />
      </div>
    );
  } else if (kind === 'remove') {
    diff = <Pill label={fromName ?? '—'} tone="strike" />;
  } else {
    diff = <Pill label={`${toName ?? '—'}${qtyLabel ? ` · ${qtyLabel}` : ''}`} tone="add" />;
  }

  return (
    <CardShell
      icon={Check}
      title="Review and confirm"
      subtitle={recipeName}
      state={state}
      confirmLabel="Apply change"
      onCancel={onCancel}
      onConfirm={() =>
        onConfirm({
          recipeId,
          recipeName,
          kind,
          fromName,
          toName,
          qty,
          uom,
          scope,
          siteLabel: scope === 'site' ? siteLabel : undefined,
        })
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
        <div>
          <Label>Change</Label>
          <div style={{ marginTop: '6px' }}>{diff}</div>
        </div>

        <div>
          <Label>Apply to</Label>
          <div style={{ marginTop: '6px' }}>
            <PillRow
              options={[
                { value: 'all', label: 'All sites' },
                { value: 'site', label: 'One site only' },
              ]}
              selected={scope}
              onSelect={(v) => setScope(v)}
              disabled={state !== 'pending'}
            />
          </div>
          {scope === 'site' && (
            <div style={{ marginTop: '8px' }}>
              <PillRow
                options={SITE_OPTIONS.map((s) => ({ value: s, label: s }))}
                selected={siteLabel}
                onSelect={setSiteLabel}
                disabled={state !== 'pending'}
                small
              />
            </div>
          )}
        </div>
      </div>
    </CardShell>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <span
      style={{
        fontSize: '11px',
        fontWeight: 700,
        letterSpacing: '0.04em',
        textTransform: 'uppercase',
        color: 'var(--color-text-secondary)',
      }}
    >
      {children}
    </span>
  );
}

function Pill({ label, tone }: { label: string; tone: 'strike' | 'add' }) {
  const isStrike = tone === 'strike';
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '4px',
        padding: '5px 12px',
        borderRadius: '100px',
        background: isStrike ? 'rgba(176,0,32,0.08)' : 'rgba(45,106,79,0.10)',
        color: isStrike ? '#9B1C24' : '#2D6A4F',
        fontSize: '12px',
        fontWeight: 700,
        fontFamily: 'var(--font-primary)',
        textDecoration: isStrike ? 'line-through' : 'none',
      }}
    >
      {label}
    </span>
  );
}
