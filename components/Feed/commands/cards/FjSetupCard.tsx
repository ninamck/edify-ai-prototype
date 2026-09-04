'use client';

import { useMemo, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { ArrowUpRight, SlidersHorizontal } from 'lucide-react';
import CardShell, { PillRow, QtyStepper, type CardState } from './CardShell';
import { useActiveSite } from '@/components/ActiveSite/ActiveSiteContext';
import { useFjPlanStoreOptional } from '@/components/Production/farmerj/FjPlanStore';
import { useSiteSettingsStore } from '@/components/Settings/siteSettingsStore';
import { EQUIPMENT_LABELS, type Equipment } from '@/components/Production/fixtures';
import { FJ_WORK_ROLES } from '@/components/Production/farmerj/fjFixtures';
import { ALL_CHANNELS, CHANNEL_LABELS } from '@/components/Production/farmerj/lines';
import { CONTAINERS, SHELF_LIFE_GROUPS, WEEKDAY_LABELS, type Weekday } from '@/components/Production/farmerj/recipes';
import { FJ_ALL_SHOPS_ID, FJ_SHOPS, getShop } from '@/components/Production/farmerj/shops';
import { toStationDraft } from '@/components/Production/farmerj/setupModel';
import {
  resolveFjSetup, setupHrefFor, SETUP_KIND_LABELS, type FjSetupArgs, type FjSetupKind, type ResolvedSetup,
} from '@/components/Production/farmerj/setupCommand';

interface Props {
  initialArgs: FjSetupArgs;
  state: CardState;
  onConfirm: (final: FjSetupArgs) => void;
  onCancel: () => void;
}

const KIT_OPTIONS: Equipment[] = ['oven', 'combi-oven', 'rice-cooker', 'hob', 'griddle', 'food-processor', 'blender', 'mixer-planetary', 'prep-table'];
const YIELD_OPTIONS = [0, 5, 10, 15, 20, 25, 30, 35, 40, 50];

/**
 * A Setup change asked for in plain language. The card shows how the
 * sentence was read, lets Jana correct any part of it, and shows the same
 * from → to lines the Setup publish preview would, before publishing to
 * the shops. Setup's Publish log gets the entry, with what she typed.
 */
export default function FjSetupCard({ initialArgs, state, onConfirm, onCancel }: Props) {
  const { productionSiteId } = useActiveSite();
  const store = useFjPlanStoreOptional();
  const siteStore = useSiteSettingsStore();
  const [args, setArgs] = useState<FjSetupArgs>(initialArgs);
  const set = (patch: Partial<FjSetupArgs>) => setArgs(a => ({ ...a, ...patch }));
  const disabled = state !== 'pending';

  const recipes = useMemo(() => (store?.recipes ?? []).filter(r => r.brand === 'farmerj'), [store?.recipes]);
  const siteId = args.shopId ?? FJ_ALL_SHOPS_ID;
  const stations = useMemo(() => siteStore.effectiveFor(siteId).benches.map(toStationDraft), [siteStore, siteId]);

  const live = useMemo<ResolvedSetup>(
    () => resolveFjSetup(args, { recipes, effectiveFor: siteStore.effectiveFor, overlayFor: siteStore.overlayFor }),
    [args, recipes, siteStore],
  );
  // Once published the stores carry the change, so a live resolve would
  // read as "already set". Keep the resolve from the moment of confirm.
  const [applied, setApplied] = useState<ResolvedSetup | null>(null);
  const resolved = state === 'pending' ? live : applied ?? live;

  const kind = args.kind;
  const isRecipe = kind?.startsWith('recipe-');
  const isKitchen = kind && !isRecipe && kind !== 'make-on' && kind !== 'deep-clean';
  const canScope = kind === 'make-on' || isKitchen;
  const activeShop = productionSiteId && productionSiteId !== FJ_ALL_SHOPS_ID && FJ_SHOPS.some(s => s.id === productionSiteId) ? productionSiteId : undefined;
  const scopeOptions = [
    { value: FJ_ALL_SHOPS_ID, label: 'Every shop' },
    ...Array.from(new Set([args.shopId, activeShop].filter(Boolean) as string[])).map(id => ({ value: id, label: `${getShop(id)?.name ?? id} only` })),
  ];

  const canConfirm = !resolved.missing && !resolved.noop && resolved.changes.length > 0;
  const shopsLabel = resolved.shops.length === 1 ? getShop(resolved.shops[0])?.name ?? '1 shop' : `${resolved.shops.length} shops`;

  return (
    <CardShell
      icon={SlidersHorizontal}
      title={resolved.missing && !resolved.title ? 'Setup change' : resolved.title}
      subtitle={`${kind ? SETUP_KIND_LABELS[kind] : 'Setup'} · ${resolved.scopeLabel}`}
      state={state}
      confirmLabel={resolved.shops.length ? `Publish to ${shopsLabel}` : 'Publish'}
      confirmDisabled={!canConfirm}
      onConfirm={canConfirm ? () => { setApplied(live); onConfirm(args); } : undefined}
      onCancel={onCancel}
      warning={state === 'pending' ? (resolved.missing ? `Still needed: ${resolved.missing.toLowerCase()}.` : resolved.noop ? 'Already set this way. Nothing to publish.' : undefined) : undefined}
    >
      {!kind && (
        <Row label="What to change">
          <PillRow
            small
            disabled={disabled}
            options={(Object.keys(SETUP_KIND_LABELS) as FjSetupKind[]).map(k => ({ value: k, label: SETUP_KIND_LABELS[k] }))}
            selected={kind}
            onSelect={k => set({ kind: k })}
          />
        </Row>
      )}

      {canScope && (
        <Row label="Where">
          <PillRow small disabled={disabled} options={scopeOptions} selected={siteId} onSelect={v => set({ shopId: v === FJ_ALL_SHOPS_ID ? undefined : v })} />
        </Row>
      )}

      {isRecipe && (
        <Row label="Recipe">
          {args.recipeId && !args.recipeOptions ? (
            <Chosen text={recipes.find(r => r.id === args.recipeId)?.name ?? args.recipeId} disabled={disabled} onChange={() => set({ recipeId: undefined, recipeOptions: undefined })} />
          ) : args.recipeOptions?.length ? (
            <PillRow small disabled={disabled} options={args.recipeOptions.map(o => ({ value: o.id, label: o.name }))} selected={args.recipeId} onSelect={id => set({ recipeId: id, recipeOptions: undefined })} />
          ) : (
            <select
              value={args.recipeId ?? ''}
              disabled={disabled}
              onChange={e => set({ recipeId: e.target.value || undefined })}
              style={selectStyle}
              aria-label="Recipe"
            >
              <option value="">Pick a recipe</option>
              {recipes.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
            </select>
          )}
        </Row>
      )}

      {kind === 'recipe-half' && (
        <Row label="Half batches">
          <PillRow small disabled={disabled} options={[{ value: 'on', label: 'Allowed' }, { value: 'off', label: 'Full batches only' }]} selected={(args.on ?? true) ? 'on' : 'off'} onSelect={v => set({ on: v === 'on' })} />
        </Row>
      )}
      {kind === 'recipe-yield' && (
        <Row label="Yield loss">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <PillRow small disabled={disabled} options={YIELD_OPTIONS.map(p => ({ value: p, label: `${p}%` }))} selected={args.pct} onSelect={p => set({ pct: p })} />
            <QtyStepper value={args.pct ?? 0} onChange={v => set({ pct: Math.min(90, v) })} disabled={disabled} step={1} />
          </div>
        </Row>
      )}
      {kind === 'recipe-shelf' && (
        <Row label="Shelf life">
          <PillRow small disabled={disabled} options={Object.values(SHELF_LIFE_GROUPS).map(g => ({ value: g.id, label: g.label }))} selected={args.group} onSelect={g => set({ group: g })} />
        </Row>
      )}
      {(kind === 'recipe-container' || kind === 'recipe-per-batch') && (
        <Row label="Container">
          <PillRow small disabled={disabled} options={Object.values(CONTAINERS).map(c => ({ value: c.id, label: c.name }))} selected={args.containerId} onSelect={c => set({ containerId: c })} />
        </Row>
      )}
      {kind === 'recipe-per-batch' && (
        <Row label="A full batch fills">
          <QtyStepper value={args.perBatch ?? 1} onChange={v => set({ perBatch: Math.max(1, v) })} disabled={disabled} min={1} />
        </Row>
      )}
      {kind === 'recipe-kit' && (
        <Row label="Made in">
          <PillRow small disabled={disabled} options={KIT_OPTIONS.map(e => ({ value: e, label: EQUIPMENT_LABELS[e] }))} selected={args.equipment} onSelect={e => set({ equipment: e })} />
        </Row>
      )}

      {isKitchen && kind !== 'add-station' && (
        <Row label={kind === 'line-channel' || kind === 'line-half' ? 'Line' : 'Bench or line'}>
          <PillRow
            small
            disabled={disabled}
            options={stations.filter(s => (kind === 'line-channel' || kind === 'line-half' ? s.isLine : true)).map(s => ({ value: s.id, label: s.name }))}
            selected={args.stationId}
            onSelect={id => set({ stationId: id })}
          />
        </Row>
      )}
      {kind === 'station-role' && (
        <Row label="Kind of work">
          <PillRow small disabled={disabled} options={FJ_WORK_ROLES.map(r => ({ value: r.id, label: r.label }))} selected={args.role} onSelect={r => set({ role: r, on: true })} />
        </Row>
      )}
      {kind === 'station-kit' && (
        <>
          <Row label="Kit">
            <PillRow small disabled={disabled} options={KIT_OPTIONS.map(e => ({ value: e, label: EQUIPMENT_LABELS[e] }))} selected={args.equipment} onSelect={e => set({ equipment: e })} />
          </Row>
          <Row label="How many">
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
              <QtyStepper
                value={args.count ?? Math.max(0, (stations.find(s => s.id === args.stationId)?.kit.find(k => k.equipment === args.equipment)?.count ?? 0) + (args.delta ?? 0))}
                onChange={v => set({ count: v, delta: undefined })}
                disabled={disabled}
              />
              <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--color-text-secondary)' }}>
                each holds
                <input
                  type="number"
                  value={args.capacity ?? ''}
                  placeholder="—"
                  disabled={disabled}
                  onChange={e => set({ capacity: e.target.value ? Number(e.target.value) : undefined })}
                  style={{ ...selectStyle, width: 64, textAlign: 'center' }}
                  aria-label="Capacity"
                />
              </label>
            </div>
          </Row>
        </>
      )}
      {kind === 'line-channel' && (
        <Row label="Channel">
          <PillRow small disabled={disabled} options={ALL_CHANNELS.map(c => ({ value: c, label: CHANNEL_LABELS[c] }))} selected={args.channel} onSelect={c => set({ channel: c })} />
        </Row>
      )}
      {kind === 'line-half' && (
        <Row label="Half batches">
          <PillRow small disabled={disabled} options={[{ value: 'on', label: 'On' }, { value: 'off', label: 'Off' }]} selected={(args.on ?? true) ? 'on' : 'off'} onSelect={v => set({ on: v === 'on' })} />
        </Row>
      )}
      {(kind === 'rename' || kind === 'add-station') && (
        <Row label={kind === 'rename' ? 'New name' : 'Name'}>
          <input
            type="text"
            value={args.newName ?? ''}
            disabled={disabled}
            onChange={e => set({ newName: e.target.value })}
            placeholder={kind === 'rename' ? 'e.g. Prep kitchen' : 'e.g. Pastry'}
            style={{ ...selectStyle, minWidth: 200 }}
            aria-label={kind === 'rename' ? 'New name' : 'Name'}
          />
        </Row>
      )}
      {kind === 'add-station' && (
        <Row label="It is a">
          <PillRow small disabled={disabled} options={[{ value: 'bench', label: 'Bench (cooks or preps)' }, { value: 'line', label: 'Line (plates for channels)' }]} selected={args.isLine ? 'line' : 'bench'} onSelect={v => set({ isLine: v === 'line' })} />
        </Row>
      )}

      {kind === 'make-on' && (
        <Row label="Group">
          <PillRow small disabled={disabled} options={Object.values(SHELF_LIFE_GROUPS).filter(g => g.days > 1).map(g => ({ value: g.id, label: g.label }))} selected={args.group} onSelect={g => set({ group: g })} />
        </Row>
      )}
      {(kind === 'make-on' || kind === 'deep-clean') && (
        <Row label={kind === 'deep-clean' ? 'Deep clean on' : 'Made on'}>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {WEEKDAY_LABELS.map((label, i) => {
              const d = i as Weekday;
              const on = (args.days ?? []).includes(d);
              return (
                <button
                  key={label}
                  type="button"
                  disabled={disabled}
                  aria-pressed={on}
                  onClick={() => set({ days: on ? (args.days ?? []).filter(x => x !== d) : [...(args.days ?? []), d].sort() })}
                  style={{
                    width: 40, height: 30, borderRadius: 8, fontSize: 11.5, fontWeight: 700, fontFamily: 'var(--font-primary)', cursor: disabled ? 'not-allowed' : 'pointer',
                    border: on ? '1.5px solid var(--color-accent-active, #001C35)' : '1.5px solid var(--color-border, rgba(0,28,53,0.18))',
                    background: on ? 'var(--color-accent-active, #001C35)' : '#fff', color: on ? '#fff' : 'var(--color-text-secondary)',
                  }}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </Row>
      )}

      {!resolved.missing && (
        <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px dashed var(--color-border-subtle, rgba(0,28,53,0.12))', display: 'flex', flexDirection: 'column', gap: 8, fontSize: 12.5 }}>
          {resolved.sentence && <p style={{ margin: 0, color: 'var(--color-text-primary)', lineHeight: 1.45 }}>{resolved.sentence}</p>}
          {resolved.changes.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {resolved.changes.map((c, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                  <span style={{ color: 'var(--color-text-muted)', fontWeight: 500 }}>{c.field}</span>
                  <span style={{ fontWeight: 600, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{c.from} → {c.to}</span>
                </div>
              ))}
            </div>
          )}
          {resolved.consequence && <p style={{ margin: 0, color: 'var(--color-text-secondary)', lineHeight: 1.45 }}>{resolved.consequence}</p>}
          {resolved.shops.length > 0 && (
            <p style={{ margin: 0, color: 'var(--color-text-muted)', fontSize: 12 }}>
              {state === 'pending' ? 'Publishes to' : 'Published to'} {resolved.shops.length} {resolved.shops.length === 1 ? 'shop' : 'shops'}
              {resolved.kept.length ? `. ${resolved.kept.map(k => `${getShop(k.shopId)?.name ?? k.shopId} keeps ${k.what}`).join('; ')}.` : '.'}
            </p>
          )}
        </div>
      )}

      <div style={{ marginTop: 10, display: 'flex', justifyContent: 'flex-end' }}>
        <Link href={setupHrefFor(kind)} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12, fontWeight: 600, color: 'var(--color-text-secondary)', textDecoration: 'none' }}>
          See it all in Setup <ArrowUpRight size={12} />
        </Link>
      </div>
    </CardShell>
  );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: '6px 0' }}>
      <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--color-text-secondary)' }}>{label}</span>
      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text-primary)' }}>{children}</div>
    </div>
  );
}

function Chosen({ text, disabled, onChange }: { text: string; disabled?: boolean; onChange: () => void }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <span>{text}</span>
      {!disabled && (
        <button type="button" onClick={onChange} style={{ background: 'none', border: 'none', padding: 0, fontSize: 12, fontWeight: 600, color: 'var(--color-text-muted)', cursor: 'pointer', fontFamily: 'var(--font-primary)', textDecoration: 'underline' }}>
          change
        </button>
      )}
    </div>
  );
}

const selectStyle: React.CSSProperties = {
  height: 32,
  padding: '0 10px',
  borderRadius: 10,
  border: '1.5px solid var(--color-border, rgba(0,28,53,0.18))',
  background: '#fff',
  fontSize: 13,
  fontWeight: 600,
  fontFamily: 'var(--font-primary)',
  color: 'var(--color-text-primary)',
};
