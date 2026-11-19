'use client';

/**
 * "At the till" card in the modifier group editor. Square customers with
 * publishing on only. Holds the two till-only fields a group needs (a
 * selection cap and kitchen names) and says in plain words how Square
 * will treat the group.
 */

import { findGroup } from '@/components/Modifiers/store';
import type { ModifierGroup, ModifierOption } from '@/components/Modifiers/types';
import { groupTillStatus, setKeepSitePrices, useSquareMenu } from './squareMenuStore';
import { money } from './tillItems';
import { TillStatusPill, NumberField, inputStyle, linkBtn } from './ui';

export function GroupTillCard({ value, onChange }: { value: ModifierGroup; onChange: (next: ModifierGroup) => void }) {
  const sm = useSquareMenu();
  if (!sm.settings.enabled) return null;

  const saved = findGroup(value.id);
  const status = saved ? groupTillStatus(saved, sm) : 'not-on-till';
  const usedOn = sm.items.filter((i) => i.current.groups.includes(value.id)).length;

  const sitePrices = sm.groupSitePrices[value.id];
  const siteLines = sitePrices
    ? Object.entries(sitePrices.prices).flatMap(([optionId, byLoc]) => {
      const o = value.options.find((x) => x.id === optionId);
      return o ? Object.entries(byLoc).map(([loc, p]) => `${o.name} is +${money(p)} at ${loc}`) : [];
    })
    : [];
  const noChange = value.options.filter((o) => o.effects.length === 0 && o.name.trim());

  const min = value.required ? 1 : 0;
  const max = value.selection === 'one' ? 1 : value.maxSelections ?? value.options.length;

  function patchOption(id: string, p: Partial<ModifierOption>) {
    onChange({ ...value, options: value.options.map((o) => (o.id === id ? { ...o, ...p } : o)) });
  }

  return (
    <section
      aria-labelledby="group-till-title"
      style={{ background: '#fff', border: '1px solid var(--color-border-subtle)', borderRadius: 12, padding: 16 }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
        <h3 id="group-till-title" style={{ flex: 1, fontSize: 14, fontWeight: 700, margin: 0 }}>At the till</h3>
        {status !== 'unused' && <TillStatusPill status={status === 'not-on-till' ? 'not-on-till' : status} size="xs" />}
      </div>
      <p style={{ fontSize: 12.5, color: 'var(--color-text-muted)', margin: '0 0 14px', lineHeight: 1.45 }}>
        {usedOn > 0
          ? `On ${usedOn} ${usedOn === 1 ? 'item' : 'items'} on your Square menu. Changes here go to the till when you publish.`
          : 'Not on any Square menu item yet.'}
        {' '}Option prices above go to the till too.
      </p>

      {value.selection === 'many' && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14, fontSize: 13 }}>
          <label htmlFor="group-max">Staff can pick up to</label>
          <NumberField
            id="group-max"
            ariaLabel="Most options staff can pick"
            width={64}
            placeholder="Any"
            value={value.maxSelections ?? null}
            onChange={(v) => onChange({ ...value, maxSelections: v == null || v <= 0 ? undefined : Math.round(v) })}
          />
          <span style={{ color: 'var(--color-text-muted)' }}>options. Leave blank for no limit.</span>
        </div>
      )}

      <div style={{ fontSize: 12.5, fontWeight: 600, marginBottom: 6 }}>Kitchen names</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(140px, 220px) 1fr', gap: '8px 12px', alignItems: 'center', marginBottom: 14 }}>
        {value.options.map((o, i) => (
          <div key={o.id} style={{ display: 'contents' }}>
            <label htmlFor={`kn-${o.id}`} style={{ fontSize: 13 }}>{o.name.trim() || `Option ${i + 1}`}</label>
            <input
              id={`kn-${o.id}`}
              style={{ ...inputStyle, height: 34, fontSize: 12.5 }}
              placeholder={`Prints as "${o.name || `Option ${i + 1}`}"`}
              value={o.kitchenName ?? ''}
              onChange={(e) => patchOption(o.id, { kitchenName: e.target.value || undefined })}
            />
          </div>
        ))}
      </div>

      {siteLines.length > 0 && sitePrices && (
        <div style={{ fontSize: 12.5, color: 'var(--color-text-secondary)', lineHeight: 1.5, marginBottom: 14 }}>
          <div style={{ fontWeight: 600, color: 'var(--color-text-primary)', marginBottom: 2 }}>Prices by site</div>
          {siteLines.join('. ')}.{' '}
          {sitePrices.keepInSquare
            ? 'Edify sends the prices above and leaves these site prices as they are in Square.'
            : 'Your next publish charges the prices above at every site.'}{' '}
          <button type="button" style={linkBtn} onClick={() => setKeepSitePrices(value.id, !sitePrices.keepInSquare)}>
            {sitePrices.keepInSquare ? 'Charge one price everywhere' : "Keep each site's price"}
          </button>
        </div>
      )}

      {noChange.length > 0 && (
        <p style={{ fontSize: 12.5, color: 'var(--color-text-secondary)', lineHeight: 1.5, margin: '0 0 14px' }}>
          {noChange.map((o) => o.name).join(' and ')} {noChange.length === 1 ? 'changes' : 'change'} nothing in the recipe.
          Square still lists {noChange.length === 1 ? 'it' : 'them'} so staff can pick {noChange.length === 1 ? 'it' : 'them'}
          {noChange.some((o) => o.isDefault) ? ', picked by default' : ''}.
        </p>
      )}

      <p style={{ fontSize: 12.5, color: 'var(--color-text-secondary)', margin: 0, padding: '8px 10px', borderRadius: 8, background: '#FBFAF8' }}>
        On Square: {min === 0 ? 'optional' : 'staff must pick one'}, {max === 1 ? 'one choice at most' : `up to ${max} choices`}.
      </p>
    </section>
  );
}
