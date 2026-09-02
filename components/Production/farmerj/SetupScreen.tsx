'use client';

import { useMemo, useState } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { CheckCircle2, ChevronRight, Lock, RotateCcw, X } from 'lucide-react';
import { useActiveSite } from '@/components/ActiveSite/ActiveSiteContext';
import QtyStepper from '@/components/Production/QtyStepper';
import StatusPill from '@/components/Production/StatusPill';
import { Section, TextInput } from '@/components/Settings/tabs/_shared';
import { demoNowISO } from './calendar';
import { kg } from './cascade';
import { Notice } from './DayPlan';
import { useFjPlanStore } from './FjPlanStore';
import { BASELINE, diffSettings, shopsTouched, type SettingsChange, type SettingsValues } from './fjSettings';
import {
  COMPONENTS,
  CONTAINERS,
  DEEP_CLEAN_DAY,
  PORTION_GRAMS,
  PRODUCT_GROUP_LABELS,
  PRODUCTS,
  SHELF_LIFE_GROUPS,
  WEEKDAY_LABELS,
  type ComponentKind,
  type ContainerId,
  type ShelfLifeGroupId,
  type Weekday,
} from './recipes';
import { CHANNEL_LABELS } from './sales';
import type { SalesChannel } from './salesDay';
import { FJ_SHOPS, getShop } from './shops';

/**
 * Setup: the rules Jana owns, set once and published to every shop.
 * Built on the settings chassis (Section cards, pill pickers, sticky save
 * bar, success banner) with a publish preview in front of the save.
 */

type Tab = 'recipes' | 'days' | 'lines' | 'kit' | 'log';
const TABS: { id: Tab; label: string }[] = [
  { id: 'recipes', label: 'Recipes' },
  { id: 'days', label: 'Make-on days' },
  { id: 'lines', label: 'Lines' },
  { id: 'kit', label: 'Containers & kit' },
  { id: 'log', label: 'Publish log' },
];

const LONG_DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const KIND_ORDER: ComponentKind[] = ['cooked', 'kit', 'prep', 'dressing', 'mix'];
const KIND_LABELS: Record<ComponentKind, string> = { cooked: 'Cooked', kit: 'Kits', prep: 'Prep', dressing: 'Dressings', mix: 'Mixes' };
const CHANNELS: SalesChannel[] = ['instore', 'kiosk', 'deliveroo', 'clickcollect'];
const GROUPS = Object.values(SHELF_LIFE_GROUPS);

export default function SetupScreen() {
  const { isFarmerJ } = useActiveSite();
  const store = useFjPlanStore();
  const [tab, setTab] = useState<Tab>('recipes');
  const [preview, setPreview] = useState(false);
  const [banner, setBanner] = useState<string | null>(null);

  const { draft, published, log } = store.settings;
  const changes = useMemo(() => diffSettings(published, draft), [published, draft]);

  const setDraft = (fn: (d: SettingsValues) => SettingsValues) =>
    store.updateSettings(s => ({ ...s, draft: fn(s.draft) }));

  if (!isFarmerJ) return <Notice>Switch the Brand pill in demo controls to Farmer J to see this screen.</Notice>;

  const publish = () => {
    const shops = shopsTouched(changes);
    const kept = Object.entries(draft.shopProductionDays)
      .filter(([, o]) => Object.keys(o).length > 0)
      .map(([shop, o]) => {
        const parts = (Object.entries(o) as [ShelfLifeGroupId, Weekday[]][]).map(([g, d]) => `${d.map(x => LONG_DAYS[x]).join(' and ')} for ${SHELF_LIFE_GROUPS[g].label.toLowerCase()}`);
        return `${getShop(shop)?.name ?? shop} keeps ${parts.join('; ')}`;
      });
    store.updateSettings(s => ({
      draft: s.draft,
      published: JSON.parse(JSON.stringify(s.draft)),
      log: [{ atISO: demoNowISO(), by: 'Jana', shops: shops.length, changes: changes.map(c => `${c.field}: ${c.from} → ${c.to}`) }, ...s.log],
    }));
    setPreview(false);
    setBanner(`Published to ${shops.length} ${shops.length === 1 ? 'shop' : 'shops'}.${kept.length ? ` ${kept.join('. ')}.` : ''}`);
    setTab('log');
  };

  const discard = () => store.updateSettings(s => ({ ...s, draft: JSON.parse(JSON.stringify(s.published)) }));

  const last = log[0];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '16px 24px 24px' }}>
        <div style={{ maxWidth: 1180, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--color-text-primary)' }}>Setup</div>
              <div style={{ fontSize: 12, color: 'var(--color-text-muted)', marginTop: 2 }}>
                {last ? `Last published ${new Date(last.atISO).toLocaleString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })} by ${last.by} to ${last.shops} shops` : `${FJ_SHOPS.length} shops on the recipe book's defaults`}
              </div>
            </div>
            {changes.length > 0 && <StatusPill tone="warning" size="sm" label={`${changes.length} unpublished`} />}
          </div>

          {banner && (
            <div role="status" style={{ padding: '12px 14px', borderRadius: 'var(--radius-card)', background: 'var(--color-success-light)', border: '1px solid var(--color-success-border)', color: 'var(--color-success)', display: 'flex', alignItems: 'flex-start', gap: 12 }}>
              <CheckCircle2 size={16} style={{ marginTop: 1, flexShrink: 0 }} />
              <div style={{ flex: 1, fontSize: 12, fontWeight: 700 }}>{banner}</div>
              <button type="button" onClick={() => setBanner(null)} aria-label="Dismiss" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'inherit', padding: 2 }}><X size={14} /></button>
            </div>
          )}

          <div role="tablist" aria-label="Setup sections" style={{ display: 'flex', gap: 4, padding: 4, borderRadius: 999, background: 'var(--color-bg-hover)', border: '1px solid var(--color-border-subtle)', alignSelf: 'flex-start' }}>
            {TABS.map(t => (
              <button key={t.id} type="button" role="tab" aria-selected={tab === t.id} onClick={() => setTab(t.id)} style={tabStyle(tab === t.id)}>
                {t.label}
                {t.id === 'log' && log.length > 0 && <span style={{ marginLeft: 6, opacity: 0.7 }}>{log.length}</span>}
              </button>
            ))}
          </div>

          {tab === 'recipes' && <RecipesTab draft={draft} setDraft={setDraft} />}
          {tab === 'days' && <DaysTab draft={draft} setDraft={setDraft} />}
          {tab === 'lines' && <LinesTab draft={draft} setDraft={setDraft} />}
          {tab === 'kit' && <KitTab draft={draft} setDraft={setDraft} />}
          {tab === 'log' && <LogTab log={log} />}
        </div>
      </div>

      {changes.length > 0 && (
        <div role="region" aria-label="Unpublished changes" style={{ position: 'sticky', bottom: 0, zIndex: 40, padding: '12px 24px', background: '#fff', borderTop: '1px solid var(--color-border)', boxShadow: '0 -8px 24px rgba(0,28,53,0.08)', display: 'flex', alignItems: 'center', gap: 10 }}>
          <ChevronRight size={14} color="var(--color-info)" />
          <span style={{ fontSize: 12, fontWeight: 700 }}>{changes.length} change{changes.length === 1 ? '' : 's'} ready to publish</span>
          <span style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>{shopsTouched(changes).length} of {FJ_SHOPS.length} shops</span>
          <div style={{ flex: 1 }} />
          <button type="button" onClick={discard} style={ghostBtn}>Discard</button>
          <button type="button" onClick={() => setPreview(true)} style={primaryBtn}><CheckCircle2 size={12} /> Publish to all shops</button>
        </div>
      )}

      {preview && <PublishPreview changes={changes} onClose={() => setPreview(false)} onConfirm={publish} />}
    </div>
  );
}

// ─── Recipes ─────────────────────────────────────────────────────────────────

type TabProps = { draft: SettingsValues; setDraft: (fn: (d: SettingsValues) => SettingsValues) => void };

function RecipesTab({ draft, setDraft }: TabProps) {
  const components = Object.values(COMPONENTS);
  return (
    <>
      <Section title="Components">
        <table style={tableStyle}>
          <thead>
            <tr>
              <th style={th}>Component</th>
              <th style={th}>Shelf life</th>
              <th style={{ ...th, textAlign: 'center' }}>Yield loss</th>
              <th style={th}>Batch</th>
              <th style={th}>Container</th>
            </tr>
          </thead>
          <tbody>
            {KIND_ORDER.map(kind => {
              const rows = components.filter(c => c.kind === kind).sort((a, b) => a.name.localeCompare(b.name));
              if (!rows.length) return null;
              return [
                <tr key={`h-${kind}`}><td colSpan={5} style={groupTd}>{KIND_LABELS[kind]}</td></tr>,
                ...rows.map(c => {
                  const pct = draft.yieldLossPct[c.id] ?? c.yieldLossPct;
                  const group = draft.shelfLife[c.id] ?? c.shelfLife;
                  const changed = pct !== BASELINE.yieldLossPct[c.id] || group !== BASELINE.shelfLife[c.id];
                  return (
                    <tr key={c.id}>
                      <td style={td}>
                        <div style={{ fontWeight: 600, color: 'var(--color-text-primary)' }}>{c.name}</div>
                        {c.yieldNote && <div style={{ fontSize: 10.5, color: 'var(--color-text-muted)', marginTop: 2, maxWidth: 360 }}>{c.yieldNote}</div>}
                      </td>
                      <td style={td}>
                        <select
                          value={group}
                          onChange={e => setDraft(d => ({ ...d, shelfLife: { ...d.shelfLife, [c.id]: e.target.value as ShelfLifeGroupId } }))}
                          aria-label={`${c.name} shelf life`}
                          style={selectStyle}
                        >
                          {GROUPS.map(g => <option key={g.id} value={g.id}>{g.label}</option>)}
                        </select>
                      </td>
                      <td style={{ ...td, textAlign: 'center' }}>
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                          <QtyStepper
                            size="compact"
                            canDecrement={pct > 0}
                            canIncrement={pct < 90}
                            onDecrement={() => setDraft(d => ({ ...d, yieldLossPct: { ...d.yieldLossPct, [c.id]: Math.max(0, pct - 1) } }))}
                            onIncrement={() => setDraft(d => ({ ...d, yieldLossPct: { ...d.yieldLossPct, [c.id]: Math.min(90, pct + 1) } }))}
                            decrementLabel={`${c.name} yield loss down`}
                            incrementLabel={`${c.name} yield loss up`}
                          >
                            <span style={{ minWidth: 34, textAlign: 'center', fontSize: 12, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{pct}%</span>
                          </QtyStepper>
                          {changed && (
                            <button type="button" onClick={() => setDraft(d => ({ ...d, yieldLossPct: { ...d.yieldLossPct, [c.id]: BASELINE.yieldLossPct[c.id] }, shelfLife: { ...d.shelfLife, [c.id]: BASELINE.shelfLife[c.id] } }))} title="Back to the recipe book" style={iconBtn}><RotateCcw size={12} /></button>
                          )}
                        </div>
                      </td>
                      <td style={td}>{kg(c.batch.fullG)}{c.batch.label ? `, ${c.batch.label}` : ''}{c.batch.halfG ? ` · half ${kg(c.batch.halfG)}` : ''}</td>
                      <td style={td}>{c.container ? CONTAINERS[c.container].name : '—'}{c.containersPerBatch ? ` × ${c.containersPerBatch}` : ''}</td>
                    </tr>
                  );
                }),
              ];
            })}
          </tbody>
        </table>
      </Section>

      <Section title="Finished products">
        <table style={tableStyle}>
          <thead>
            <tr>
              <th style={th}>Product</th>
              <th style={th}>Group</th>
              <th style={th}>Main-line unit</th>
              <th style={{ ...th, textAlign: 'right' }}>Per unit</th>
              <th style={{ ...th, textAlign: 'right' }}>Units per batch</th>
              <th style={{ ...th, textAlign: 'right' }}>Batch</th>
              <th style={{ ...th, textAlign: 'center' }}>Half batches</th>
            </tr>
          </thead>
          <tbody>
            {PRODUCTS.map(p => {
              const half = draft.halfBatch[p.id] ?? p.halfBatch;
              return (
                <tr key={p.id}>
                  <td style={{ ...td, fontWeight: 600, color: 'var(--color-text-primary)' }}>{p.name}</td>
                  <td style={td}>{PRODUCT_GROUP_LABELS[p.group]}</td>
                  <td style={td}>{draft.containers[p.unit]?.name ?? CONTAINERS[p.unit].name}</td>
                  <td style={{ ...td, textAlign: 'right' }}>{kg(Math.round((p.batch.fullG * (1 - p.yieldLossPct / 100)) / p.unitsPerBatch))}</td>
                  <td style={{ ...td, textAlign: 'right' }}>{p.unitsPerBatch}</td>
                  <td style={{ ...td, textAlign: 'right' }}>{kg(p.batch.fullG)}</td>
                  <td style={{ ...td, textAlign: 'center' }}>
                    <Switch checked={half} onChange={v => setDraft(d => ({ ...d, halfBatch: { ...d.halfBatch, [p.id]: v } }))} label={`${p.name} half batches`} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Section>

      <Section title="Portion sizes">
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {Object.entries(PORTION_GRAMS).map(([k, g]) => (
            <span key={k} style={chip}>{PORTION_LABELS[k as keyof typeof PORTION_GRAMS]} <strong style={{ marginLeft: 4 }}>{g} g</strong></span>
          ))}
        </div>
      </Section>
    </>
  );
}

const PORTION_LABELS: Record<keyof typeof PORTION_GRAMS, string> = {
  trayProtein: 'Tray protein',
  bowlProtein: 'Bowl protein',
  trayBase: 'Tray base',
  bowlBase: 'Bowl base',
  side: 'Side',
  extraMain: 'Extra main',
  extraSide: 'Extra side',
  hotSideAsMain: 'Hot side as main',
  familyBase: 'Family base',
  familySide: 'Family side',
  sauce: 'Sauce',
  topping: 'Topping',
};

// ─── Make-on days ────────────────────────────────────────────────────────────

function DaysTab({ draft, setDraft }: TabProps) {
  const [shop, setShop] = useState<string>(FJ_SHOPS[0].id);
  const overrides = draft.shopProductionDays[shop] ?? {};

  const toggleDefault = (g: ShelfLifeGroupId, day: Weekday) =>
    setDraft(d => {
      const cur = d.productionDays[g];
      const next = cur.includes(day) ? cur.filter(x => x !== day) : [...cur, day].sort((a, b) => a - b);
      return { ...d, productionDays: { ...d.productionDays, [g]: next } };
    });

  const toggleShop = (g: ShelfLifeGroupId, day: Weekday) =>
    setDraft(d => {
      const cur = d.shopProductionDays[shop]?.[g] ?? d.productionDays[g];
      const next = cur.includes(day) ? cur.filter(x => x !== day) : [...cur, day].sort((a, b) => a - b);
      return { ...d, shopProductionDays: { ...d.shopProductionDays, [shop]: { ...(d.shopProductionDays[shop] ?? {}), [g]: next } } };
    });

  const resetShop = (g: ShelfLifeGroupId) =>
    setDraft(d => {
      const o = { ...(d.shopProductionDays[shop] ?? {}) };
      delete o[g];
      const all = { ...d.shopProductionDays };
      if (Object.keys(o).length) all[shop] = o; else delete all[shop];
      return { ...d, shopProductionDays: all };
    });

  return (
    <>
      <Section title="Every shop">
        <DayGrid days={draft.productionDays} onToggle={toggleDefault} />
      </Section>
      <Section
        title="One shop"
       
        rightSlot={
          <select value={shop} onChange={e => setShop(e.target.value)} aria-label="Shop" style={selectStyle}>
            {FJ_SHOPS.map(s => <option key={s.id} value={s.id}>{s.name}{draft.shopProductionDays[s.id] && Object.keys(draft.shopProductionDays[s.id]).length ? ' · own days' : ''}</option>)}
          </select>
        }
      >
        <DayGrid
          days={Object.fromEntries(GROUPS.map(g => [g.id, overrides[g.id] ?? draft.productionDays[g.id]])) as Record<ShelfLifeGroupId, Weekday[]>}
          inherited={Object.fromEntries(GROUPS.map(g => [g.id, !overrides[g.id]])) as Record<ShelfLifeGroupId, boolean>}
          onToggle={toggleShop}
          onReset={resetShop}
        />
      </Section>
    </>
  );
}

function DayGrid({ days, inherited, onToggle, onReset }: { days: Record<ShelfLifeGroupId, Weekday[]>; inherited?: Record<ShelfLifeGroupId, boolean>; onToggle: (g: ShelfLifeGroupId, d: Weekday) => void; onReset?: (g: ShelfLifeGroupId) => void }) {
  return (
    <table style={tableStyle}>
      <thead>
        <tr>
          <th style={th}>Group</th>
          {WEEKDAY_LABELS.map((w, i) => (
            <th key={w} style={{ ...th, textAlign: 'center', width: 64 }}>
              {w}{i === DEEP_CLEAN_DAY && <Lock size={10} style={{ marginLeft: 4, verticalAlign: -1 }} aria-label="Deep clean" />}
            </th>
          ))}
          <th style={th}>Covers</th>
          {onReset && <th style={th} />}
        </tr>
      </thead>
      <tbody>
        {GROUPS.map(g => {
          const faded = inherited?.[g.id];
          return (
            <tr key={g.id}>
              <td style={td}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                  <span aria-hidden style={{ width: 9, height: 9, borderRadius: 999, background: g.colour, flexShrink: 0 }} />
                  <span style={{ fontWeight: 600, color: 'var(--color-text-primary)' }}>{g.label}</span>
                </span>
              </td>
              {WEEKDAY_LABELS.map((w, i) => {
                const day = i as Weekday;
                const on = days[g.id].includes(day);
                const locked = day === DEEP_CLEAN_DAY && g.id !== 'daily';
                return (
                  <td key={w} style={{ ...td, textAlign: 'center' }}>
                    <button
                      type="button"
                      role="checkbox"
                      aria-checked={on}
                      aria-label={`${g.label} ${w}`}
                      disabled={locked}
                      onClick={() => onToggle(g.id, day)}
                      style={{
                        width: 30, height: 30, borderRadius: 8, cursor: locked ? 'not-allowed' : 'pointer',
                        border: `1px solid ${on ? g.colour : 'var(--color-border)'}`,
                        background: on ? g.colour : locked ? 'var(--color-bg-hover)' : '#fff',
                        opacity: faded ? 0.55 : 1,
                        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                      }}
                    >
                      {on && <CheckCircle2 size={14} color="#fff" />}
                    </button>
                  </td>
                );
              })}
              <td style={td}>{g.days === 1 ? 'Same day' : `${g.days} days`}</td>
              {onReset && (
                <td style={{ ...td, textAlign: 'right' }}>
                  {!faded && <button type="button" onClick={() => onReset(g.id)} style={linkBtn}>Use default</button>}
                </td>
              )}
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

// ─── Lines ───────────────────────────────────────────────────────────────────

function LinesTab({ draft, setDraft }: TabProps) {
  return (
    <>
      <Section title={draft.lines.main.name}>
        <Row label="Name">
          <TextInput value={draft.lines.main.name} onChange={v => setDraft(d => ({ ...d, lines: { ...d.lines, main: { name: v } } }))} width={260} />
        </Row>
      </Section>
      <Section title={draft.lines.second.name}>
        <Row label="Name">
          <TextInput value={draft.lines.second.name} onChange={v => setDraft(d => ({ ...d, lines: { ...d.lines, second: { ...d.lines.second, name: v } } }))} width={260} />
        </Row>
        <Row label="Half batches only">
          <Switch checked={draft.lines.second.halfOnly} onChange={v => setDraft(d => ({ ...d, lines: { ...d.lines, second: { ...d.lines.second, halfOnly: v } } }))} label="Second line half batches only" />
        </Row>
      </Section>
      <Section title="Where each channel plates">
        {CHANNELS.map(ch => (
          <Row key={ch} label={CHANNEL_LABELS[ch]}>
            <div style={{ display: 'flex', gap: 6 }}>
              {(['main', 'second'] as const).map(line => (
                <button key={line} type="button" onClick={() => setDraft(d => ({ ...d, channelLine: { ...d.channelLine, [ch]: line } }))} style={pill(draft.channelLine[ch] === line)}>
                  {line === 'main' ? draft.lines.main.name : draft.lines.second.name}
                </button>
              ))}
            </div>
          </Row>
        ))}
      </Section>
    </>
  );
}

// ─── Containers & kit ────────────────────────────────────────────────────────

function KitTab({ draft, setDraft }: TabProps) {
  const ids = Object.keys(CONTAINERS) as ContainerId[];
  return (
    <>
      <Section title="Containers">
        <table style={tableStyle}>
          <thead>
            <tr>
              <th style={th}>Name</th>
              <th style={{ ...th, textAlign: 'center' }}>Fill</th>
              <th style={th}>What it is</th>
            </tr>
          </thead>
          <tbody>
            {ids.map(id => {
              const c = draft.containers[id];
              const base = BASELINE.containers[id];
              const unit = id === 'squeezy-bottle' ? 'ml' : 'g';
              return (
                <tr key={id}>
                  <td style={td}>
                    <TextInput value={c.name} onChange={v => setDraft(d => ({ ...d, containers: { ...d.containers, [id]: { ...d.containers[id], name: v } } }))} width={220} />
                    {c.name !== base.name && <div style={{ fontSize: 10.5, color: 'var(--color-text-muted)', marginTop: 3 }}>Was {base.name}</div>}
                  </td>
                  <td style={{ ...td, textAlign: 'center' }}>
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                      <QtyStepper
                        size="compact"
                        canDecrement={c.fillG > 50}
                        onDecrement={() => setDraft(d => ({ ...d, containers: { ...d.containers, [id]: { ...d.containers[id], fillG: Math.max(50, d.containers[id].fillG - (d.containers[id].fillG >= 1000 ? 100 : 50)) } } }))}
                        onIncrement={() => setDraft(d => ({ ...d, containers: { ...d.containers, [id]: { ...d.containers[id], fillG: d.containers[id].fillG + (d.containers[id].fillG >= 1000 ? 100 : 50) } } }))}
                        decrementLabel={`${c.name} fill down`}
                        incrementLabel={`${c.name} fill up`}
                      >
                        <span style={{ minWidth: 64, textAlign: 'center', fontSize: 12, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{c.fillG.toLocaleString()} {unit}</span>
                      </QtyStepper>
                      {c.fillG !== base.fillG && <span style={{ fontSize: 10.5, color: 'var(--color-text-muted)' }}>was {base.fillG.toLocaleString()} {unit}</span>}
                    </div>
                  </td>
                  <td style={{ ...td, color: 'var(--color-text-muted)', maxWidth: 420 }}>{CONTAINERS[id].note}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Section>
      <Section title="Kit per shop">
        <Row label="Rice cookers">
          <Counter value={draft.equipment.riceCookers} min={1} max={6} onChange={v => setDraft(d => ({ ...d, equipment: { ...d.equipment, riceCookers: v } }))} label="Rice cookers" />
        </Row>
        <Row label="Ovens">
          <Counter value={draft.equipment.ovens} min={1} max={4} onChange={v => setDraft(d => ({ ...d, equipment: { ...d.equipment, ovens: v } }))} label="Ovens" />
        </Row>
        <Row label="Trays per oven">
          <Counter value={draft.equipment.ovenTrays} min={2} max={12} onChange={v => setDraft(d => ({ ...d, equipment: { ...d.equipment, ovenTrays: v } }))} label="Trays per oven" />
        </Row>
      </Section>
    </>
  );
}

// ─── Publish log ─────────────────────────────────────────────────────────────

function LogTab({ log }: { log: { atISO: string; by: string; shops: number; changes: string[] }[] }) {
  if (!log.length) return <Section title="Publish log"><div style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>Nothing published yet.</div></Section>;
  return (
    <Section title="Publish log">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {log.map((e, i) => (
          <div key={i} style={{ padding: '10px 12px', border: '1px solid var(--color-border-subtle)', borderRadius: 'var(--radius-item)', background: i === 0 ? 'var(--color-bg-hover)' : '#fff' }}>
            <div style={{ display: 'flex', gap: 10, alignItems: 'baseline', flexWrap: 'wrap' }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--color-text-primary)' }}>
                {new Date(e.atISO).toLocaleString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
              </span>
              <span style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>{e.by} · {e.shops} shops · {e.changes.length} change{e.changes.length === 1 ? '' : 's'}</span>
            </div>
            <ul style={{ margin: '6px 0 0', paddingLeft: 18, fontSize: 12, color: 'var(--color-text-secondary)', lineHeight: 1.6 }}>
              {e.changes.map((c, j) => <li key={j}>{c}</li>)}
            </ul>
          </div>
        ))}
      </div>
    </Section>
  );
}

// ─── Publish preview ─────────────────────────────────────────────────────────

function PublishPreview({ changes, onClose, onConfirm }: { changes: SettingsChange[]; onClose: () => void; onConfirm: () => void }) {
  const shops = shopsTouched(changes);
  const byShop = FJ_SHOPS.filter(s => shops.includes(s.id)).map(s => ({ shop: s, fields: changes.filter(c => c.shops.includes(s.id)).map(c => c.field) }));
  return createPortal(
    <div role="dialog" aria-modal="true" aria-labelledby="fj-publish-title" style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,28,53,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{ width: 'min(680px, 100%)', maxHeight: '85vh', background: '#fff', borderRadius: 'var(--radius-card)', boxShadow: '0 24px 64px rgba(0,28,53,0.25)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--color-border-subtle)', display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ flex: 1 }}>
            <div id="fj-publish-title" style={{ fontSize: 15, fontWeight: 700, color: 'var(--color-text-primary)' }}>Publish to {shops.length} {shops.length === 1 ? 'shop' : 'shops'}</div>
            <div style={{ fontSize: 12, color: 'var(--color-text-muted)', marginTop: 2 }}>{changes.length} change{changes.length === 1 ? '' : 's'}</div>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" style={iconBtn}><X size={16} /></button>
        </div>
        <div style={{ padding: '14px 20px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <div style={eyebrow}>Changes</div>
            <table style={tableStyle}>
              <tbody>
                {changes.map((c, i) => (
                  <tr key={i}>
                    <td style={{ ...td, fontWeight: 600, color: 'var(--color-text-primary)' }}>{c.field}</td>
                    <td style={{ ...td, color: 'var(--color-text-muted)' }}>{c.from}</td>
                    <td style={{ ...td, width: 20, color: 'var(--color-text-muted)' }}>→</td>
                    <td style={{ ...td, fontWeight: 700, color: 'var(--color-text-primary)' }}>{c.to}</td>
                    <td style={{ ...td, textAlign: 'right', color: 'var(--color-text-muted)' }}>{c.shops.length === FJ_SHOPS.length ? 'All shops' : c.shops.map(s => getShop(s)?.name ?? s).join(', ')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div>
            <div style={eyebrow}>Shops</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(190px, 1fr))', gap: 6 }}>
              {byShop.map(({ shop, fields }) => (
                <div key={shop.id} style={{ padding: '8px 10px', border: '1px solid var(--color-border-subtle)', borderRadius: 'var(--radius-item)', fontSize: 12 }}>
                  <div style={{ fontWeight: 700, color: 'var(--color-text-primary)' }}>{shop.name}</div>
                  <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 2 }}>{fields.length} field{fields.length === 1 ? '' : 's'}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
        <div style={{ padding: '12px 20px', borderTop: '1px solid var(--color-border-subtle)', display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button type="button" onClick={onClose} style={ghostBtn}>Back</button>
          <button type="button" onClick={onConfirm} style={primaryBtn}><CheckCircle2 size={12} /> Publish</button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

// ─── Small parts ─────────────────────────────────────────────────────────────

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 200px) minmax(0, 1fr)', gap: 12, alignItems: 'center' }}>
      <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--color-text-primary)' }}>{label}</span>
      <div>{children}</div>
    </div>
  );
}

function Switch({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      style={{ width: 38, height: 22, borderRadius: 999, border: 'none', padding: 2, cursor: 'pointer', background: checked ? 'var(--color-accent-active)' : 'var(--color-border)', position: 'relative', transition: 'background 0.15s' }}
    >
      <span style={{ display: 'block', width: 18, height: 18, borderRadius: 999, background: '#fff', transform: `translateX(${checked ? 16 : 0}px)`, transition: 'transform 0.15s', boxShadow: '0 1px 3px rgba(0,0,0,0.25)' }} />
    </button>
  );
}

function Counter({ value, min, max, onChange, label }: { value: number; min: number; max: number; onChange: (v: number) => void; label: string }) {
  return (
    <QtyStepper size="compact" canDecrement={value > min} canIncrement={value < max} onDecrement={() => onChange(value - 1)} onIncrement={() => onChange(value + 1)} decrementLabel={`${label} down`} incrementLabel={`${label} up`}>
      <span style={{ minWidth: 28, textAlign: 'center', fontSize: 12, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{value}</span>
    </QtyStepper>
  );
}

const tabStyle = (active: boolean): CSSProperties => ({
  padding: '8px 16px', borderRadius: 999, border: 'none', fontSize: 12, fontWeight: 600, fontFamily: 'var(--font-primary)', cursor: 'pointer',
  background: active ? 'var(--color-accent-active)' : 'transparent', color: active ? '#fff' : 'var(--color-text-muted)', whiteSpace: 'nowrap',
});
const pill = (active: boolean): CSSProperties => ({
  padding: '7px 12px', borderRadius: 999, fontSize: 11, fontWeight: 700, fontFamily: 'var(--font-primary)', cursor: 'pointer',
  background: active ? 'var(--color-accent-active)' : '#fff', color: active ? 'var(--color-text-on-active)' : 'var(--color-text-secondary)',
  border: `1px solid ${active ? 'var(--color-accent-active)' : 'var(--color-border)'}`, minHeight: 32,
});
const tableStyle: CSSProperties = { width: '100%', borderCollapse: 'collapse', fontSize: 12, fontFamily: 'var(--font-primary)' };
const th: CSSProperties = { textAlign: 'left', fontSize: 10, fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', color: 'var(--color-text-muted)', padding: '6px 8px', borderBottom: '1px solid var(--color-border-subtle)' };
const td: CSSProperties = { padding: '8px', borderBottom: '1px solid var(--color-border-subtle)', color: 'var(--color-text-secondary)', verticalAlign: 'middle' };
const groupTd: CSSProperties = { padding: '10px 8px 4px', fontSize: 10, fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', color: 'var(--color-text-muted)' };
const chip: CSSProperties = { display: 'inline-flex', alignItems: 'center', padding: '5px 10px', borderRadius: 999, border: '1px solid var(--color-border)', fontSize: 11, color: 'var(--color-text-secondary)', background: '#fff' };
const eyebrow: CSSProperties = { fontSize: 10, fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', color: 'var(--color-text-muted)', marginBottom: 6 };
const selectStyle: CSSProperties = { fontSize: 12, fontFamily: 'var(--font-primary)', padding: '6px 8px', borderRadius: 8, border: '1px solid var(--color-border)', background: '#fff', color: 'var(--color-text-primary)' };
const iconBtn: CSSProperties = { background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-muted)', padding: 4, display: 'inline-flex', borderRadius: 6 };
const linkBtn: CSSProperties = { background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-info)', fontSize: 11, fontWeight: 600, fontFamily: 'var(--font-primary)', padding: 0 };
const ghostBtn: CSSProperties = { padding: '8px 12px', borderRadius: 8, fontSize: 11, fontWeight: 700, fontFamily: 'var(--font-primary)', background: '#fff', color: 'var(--color-text-secondary)', border: '1px solid var(--color-border)', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6 };
const primaryBtn: CSSProperties = { ...ghostBtn, background: 'var(--color-accent-active)', color: 'var(--color-text-on-active)', border: '1px solid var(--color-accent-active)', padding: '8px 14px' };
