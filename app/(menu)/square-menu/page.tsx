'use client';

/**
 * Square menu: what Edify sells through Square, and what the next publish
 * will send. Only shows for Square customers with publishing turned on.
 *
 * Item matching stays the vendor-neutral page for linking till buttons to
 * recipes and products. This page owns the till-side fields (till name,
 * sizes, till price, sites, VAT) and the review-and-publish step. Both
 * pages read the same links.
 */

import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowDown, ArrowUp, ChevronDown, ChevronRight, GripVertical, MoreHorizontal, Pencil, Plus, Rocket, Search, Send, Settings, Trash2 } from 'lucide-react';
import { useRecipes } from '@/components/Recipe/recipeStore';
import { useProducts } from '@/components/Suppliers/store';
import { useModifierGroups } from '@/components/Modifiers/store';
import { GroupEditorDrawer } from '@/components/Modifiers/GroupEditorDrawer';
import type { ModifierGroup } from '@/components/Modifiers/types';
import { MatchPicker } from '@/components/ItemMatching/MatchPicker';
import {
  addMenuGroup,
  createMenu,
  deleteMenuGroup,
  groupOn,
  groupsFromPosCategories,
  groupTillStatus,
  isOnLiveMenu,
  linkSquareOnly,
  menuIdsOf,
  moveMenuGroup,
  publishCount,
  releaseMenu,
  renameMenuGroup,
  setItemGroup,
  setSquareOnlyGroup,
  squareChangeCount,
  useSquareMenu,
} from '@/components/SquareMenu/squareMenuStore';
import {
  priceRange,
  statusOf,
  type SquareOnlyItem,
  type TillItem,
  type TillStatus,
} from '@/components/SquareMenu/tillItems';
import {
  SourceChip,
  TillStatusPill,
  card,
  eyebrow,
  inputStyle,
  linkBtn,
  primaryBtn,
  secondaryBtn,
} from '@/components/SquareMenu/ui';
import { SquareMenuItemDrawer } from '@/components/SquareMenu/SquareMenuItemDrawer';
import { PublishSheet } from '@/components/SquareMenu/PublishSheet';
import { ChangedInSquarePanel } from '@/components/SquareMenu/ChangedInSquarePanel';
import { AddTillItemsPicker } from '@/components/SquareMenu/AddTillItemsPicker';
import { FirstLinkFlow } from '@/components/SquareMenu/FirstLinkFlow';
import { StatusPill } from '@/components/ui/StatusPill';
import { ALL_DAY_MENU_ID } from '@/components/SquareMenu/squareCatalogFixtures';

type Filter = 'all' | TillStatus;

/** Statuses that need someone to look before the next publish. */
const NEEDS_REVIEW: TillStatus[] = ['changed', 'blocked', 'till-only'];
const TO_PUBLISH: TillStatus[] = ['ready', 'not-on-till'];

/** Filter order: what needs a decision first, what's fine last. */
const FILTER_ORDER: TillStatus[] = ['changed', 'blocked', 'ready', 'not-on-till', 'till-only', 'in-sync'];

const TILE_LABEL: Record<TillStatus, string> = {
  'in-sync': 'Up to date',
  ready: 'Ready to publish',
  changed: 'Changed in Square',
  'not-on-till': 'Not on the till',
  'till-only': 'On the till only',
  blocked: "Can't publish",
};

type Row =
  | { kind: 'item'; id: string; item: TillItem; status: TillStatus; name: string }
  | { kind: 'square'; id: string; sq: SquareOnlyItem; status: 'till-only'; name: string };

/** Size names without their amounts. Four or more collapse to a count. */
function sizeSummary(sizes: string[]): string {
  if (sizes.length === 1 && ['Regular', 'Each'].includes(sizes[0])) return 'One size';
  if (sizes.length > 3) return `${sizes.length} sizes`;
  return sizes.map((x) => x.replace(/\s*\(.*?\)\s*/g, '')).join(', ');
}

const oneLine: React.CSSProperties = {
  fontSize: 13, color: 'var(--color-text-primary)',
  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0,
};

function SquareMenuInner() {
  const router = useRouter();
  const params = useSearchParams();
  const sm = useSquareMenu();
  const recipes = useRecipes();
  const products = useProducts();
  const groups = useModifierGroups();

  const [filter, setFilter] = useState<Filter>('all');
  const [query, setQuery] = useState('');
  const [openItem, setOpenItem] = useState<string | null>(params.get('item'));
  const [publishOpen, setPublishOpen] = useState(params.get('publish') === '1');
  const [changesOpen, setChangesOpen] = useState(params.get('review') === 'changes');
  const [addOpen, setAddOpen] = useState(false);
  const [linkFor, setLinkFor] = useState<string | null>(null);
  const [editGroup, setEditGroup] = useState<ModifierGroup | null>(null);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [menuId, setMenuId] = useState<string>(params.get('menu') ?? ALL_DAY_MENU_ID);
  const [newMenuName, setNewMenuName] = useState<string | null>(null);
  const [newCatName, setNewCatName] = useState<string | null>(null);
  const [renaming, setRenaming] = useState<{ from: string; value: string } | null>(null);
  const [catActions, setCatActions] = useState<string | null>(null);
  const [confirmRelease, setConfirmRelease] = useState(false);
  const [dragging, setDragging] = useState<{ kind: 'item' | 'square'; id: string; name: string; from: string } | null>(null);
  const [dropOn, setDropOn] = useState<string | null>(null);
  const [announce, setAnnounce] = useState('');

  const menu = sm.menus.find((m) => m.id === menuId) ?? sm.menus[0];
  const isDraft = menu?.status === 'draft';

  function saveNewMenu() {
    if (newMenuName?.trim()) {
      const id = createMenu(newMenuName);
      setMenuId(id);
      setFilter('all');
    }
    setNewMenuName(null);
  }

  function saveNewCategory() {
    if (menu && newCatName?.trim()) addMenuGroup(menu.id, newCatName);
    setNewCatName(null);
  }

  function moveRow(row: { kind: 'item' | 'square'; id: string; name: string; from: string }, group: string) {
    if (!menu || row.from === group) return;
    if (row.kind === 'item') setItemGroup(row.id, menu.id, group);
    else setSquareOnlyGroup(row.id, menu.id, group);
    setAnnounce(`${row.name} moved to ${group || 'Not in a group'}`);
    requestAnimationFrame(() => document.querySelector<HTMLButtonElement>(`[data-move-handle="${row.id}"]`)?.focus());
  }

  function saveRename() {
    if (renaming && menu) renameMenuGroup(menu.id, renaming.from, renaming.value);
    setRenaming(null);
  }

  function toggleSection(name: string) {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  }

  const rows = useMemo<Row[]>(() => {
    if (!menu) return [];
    const items: Row[] = sm.items.filter((i) => menuIdsOf(i).includes(menu.id)).map((item) => ({
      kind: 'item', id: item.id, item, status: statusOf(item), name: item.current.name,
    }));
    const sq: Row[] = sm.squareOnly
      .filter((q) => menuIdsOf(q).includes(menu.id))
      .map((q) => ({ kind: 'square', id: q.id, sq: q, status: 'till-only', name: q.name }));
    return [...items, ...sq];
  }, [sm.items, sm.squareOnly, menu]);

  const counts = useMemo(() => {
    const c: Record<TillStatus, number> = { 'in-sync': 0, ready: 0, changed: 0, 'not-on-till': 0, 'till-only': 0, blocked: 0 };
    for (const r of rows) c[r.status] += 1;
    return c;
  }, [rows]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows
      .filter((r) => filter === 'all' || r.status === filter)
      .filter((r) => !q || r.name.toLowerCase().includes(q))
      .sort((a, b) => FILTER_ORDER.indexOf(a.status) - FILTER_ORDER.indexOf(b.status) || a.name.localeCompare(b.name));
  }, [rows, filter, query]);

  const sections = useMemo(() => {
    const byGroup = new Map<string, Row[]>();
    for (const r of filtered) {
      const g = !menu ? '' : r.kind === 'item' ? groupOn(r.item, r.item.current.category, menu) : groupOn(r.sq, r.sq.category, menu);
      byGroup.set(g, [...(byGroup.get(g) ?? []), r]);
    }
    const order = menu?.groups ?? [];
    const showEmpty = filter === 'all' && !query.trim();
    if (showEmpty) for (const c of order) if (!byGroup.has(c)) byGroup.set(c, []);
    const rank = (g: string) => (g === '' ? Number.MAX_SAFE_INTEGER : order.indexOf(g) === -1 ? order.length : order.indexOf(g));
    return Array.from(byGroup.entries())
      .sort(([a], [b]) => rank(a) - rank(b) || a.localeCompare(b))
      .map(([name, list]) => ({ name, rows: list }));
  }, [filtered, menu, filter, query]);

  const draftNew = rows.filter((r) => r.kind === 'item' && !r.item.inSquare && !isOnLiveMenu(r.item, sm)).length;

  const changes = squareChangeCount(sm);
  const toPublish = publishCount(sm, groups);
  const tillGroups = groups.filter((g) => groupTillStatus(g, sm) !== 'unused');

  if (!sm.settings.enabled) {
    return (
      <Page>
        <div style={{ ...card, padding: 24, maxWidth: 560 }}>
          <h1 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>Publishing to Square is off</h1>
          <p style={{ fontSize: 13.5, color: 'var(--color-text-muted)', lineHeight: 1.5, margin: '8px 0 16px' }}>
            Turn it on from your Square connection to build the till from your recipes and products.
          </p>
          <button type="button" style={primaryBtn} onClick={() => router.push('/pos-connection')}>
            <Settings size={14} /> Go to POS connection
          </button>
        </div>
      </Page>
    );
  }

  if (sm.stage === 'first-link') {
    return (
      <Page>
        <FirstLinkFlow />
      </Page>
    );
  }

  if (sm.stage === 'empty') {
    return (
      <Page>
        <EmptyStart onAdd={() => setAddOpen(true)} />
        {addOpen && <AddTillItemsPicker menuId={menu?.id} menuName={menu?.name} onClose={() => setAddOpen(false)} onAdded={(id) => { setAddOpen(false); setOpenItem(id ?? null); }} />}
        {openItem && <SquareMenuItemDrawer itemId={openItem} onClose={() => setOpenItem(null)} />}
      </Page>
    );
  }

  return (
    <Page>
      <nav aria-label="Menus" style={{ display: 'flex', alignItems: 'flex-end', gap: 4, borderBottom: '1px solid var(--color-border)', marginBottom: 16, flexWrap: 'wrap' }}>
        {sm.menus.map((m) => {
          const active = m.id === menu?.id;
          return (
            <button
              key={m.id}
              type="button"
              aria-current={active ? 'page' : undefined}
              onClick={() => { setMenuId(m.id); setFilter('all'); setConfirmRelease(false); }}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 8,
                padding: '8px 12px', marginBottom: -1,
                background: 'transparent', border: 'none',
                borderBottom: active ? '2px solid var(--color-accent-active)' : '2px solid transparent',
                fontFamily: 'var(--font-primary)', fontSize: 13.5, fontWeight: active ? 700 : 600,
                color: active ? 'var(--color-text-primary)' : 'var(--color-text-secondary)',
                cursor: 'pointer',
              }}
            >
              {m.name}
              {m.status === 'draft' && <StatusPill tone="neutral" size="xs">Draft</StatusPill>}
            </button>
          );
        })}
        {newMenuName == null ? (
          <button
            type="button"
            onClick={() => setNewMenuName('')}
            style={{ ...linkBtn, display: 'inline-flex', alignItems: 'center', gap: 4, padding: '8px 10px', fontSize: 13 }}
          >
            <Plus size={13} aria-hidden /> New menu
          </button>
        ) : (
          <span style={{ display: 'inline-flex', gap: 6, padding: '4px 0 6px' }}>
            <input
              aria-label="New menu name"
              autoFocus
              placeholder="e.g. Summer menu"
              value={newMenuName}
              onChange={(e) => setNewMenuName(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') saveNewMenu(); if (e.key === 'Escape') setNewMenuName(null); }}
              style={{ ...inputStyle, height: 32, width: 180, fontSize: 13 }}
            />
            <button type="button" style={secondaryBtn} onClick={saveNewMenu}>Create</button>
          </span>
        )}
      </nav>

      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <div style={{ flex: '1 1 320px', minWidth: 0 }}>
          <h1 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>{rows.length} {rows.length === 1 ? 'item' : 'items'} on {menu?.name}</h1>
          <p style={{ fontSize: 13, color: 'var(--color-text-secondary)', margin: '2px 0 0' }}>
            {isDraft
              ? 'Draft. Nothing here reaches Square until you release it.'
              : menu && !menu.onSquare
                ? 'Goes to Square on your next publish'
                : sm.settings.lastPublishedAt ? `Last published ${sm.settings.lastPublishedAt}` : null}
          </p>
        </div>
        <button type="button" style={secondaryBtn} onClick={() => setAddOpen(true)}>
          <Plus size={14} /> Add items
        </button>
        {isDraft ? (
          <button type="button" style={primaryBtn} onClick={() => setConfirmRelease(true)}>
            <Rocket size={14} /> Release menu
          </button>
        ) : (
          <button
            type="button"
            style={{ ...primaryBtn, opacity: toPublish === 0 ? 0.5 : 1, cursor: toPublish === 0 ? 'not-allowed' : 'pointer' }}
            disabled={toPublish === 0}
            onClick={() => setPublishOpen(true)}
          >
            <Send size={14} /> Publish to Square
            {toPublish > 0 && (
              <span style={{ padding: '1px 7px', borderRadius: 100, background: 'rgba(255,255,255,0.18)', fontSize: 11.5, fontWeight: 700 }}>
                {toPublish}
              </span>
            )}
          </button>
        )}
      </div>

      {isDraft && confirmRelease && menu && (
        <div
          role="alertdialog"
          aria-label={`Release ${menu.name}`}
          style={{
            ...card, marginTop: 16, padding: '12px 14px',
            display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap',
            borderColor: 'var(--color-accent-active)',
          }}
        >
          <span style={{ flex: 1, fontSize: 13.5, minWidth: 240 }}>
            <strong>Release {menu.name}?</strong> The menu{draftNew > 0 ? ` and its ${draftNew} new ${draftNew === 1 ? 'item' : 'items'}` : ''} go to Square on your next publish. You then turn it on for each site in Square.
          </span>
          <button type="button" style={secondaryBtn} onClick={() => setConfirmRelease(false)}>Cancel</button>
          <button type="button" style={primaryBtn} onClick={() => { releaseMenu(menu.id); setConfirmRelease(false); }}>Release</button>
        </div>
      )}

      {!isDraft && changes > 0 && (
        <div
          role="status"
          style={{
            ...card,
            marginTop: 16,
            padding: '12px 14px',
            display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap',
            borderColor: 'var(--color-warning, #B45309)',
          }}
        >
          <span style={{ flex: 1, fontSize: 13.5, color: 'var(--color-text-primary)', minWidth: 240 }}>
            <strong>{changes} {changes === 1 ? 'change' : 'changes'} made in Square</strong> since your last publish. Want to review {changes === 1 ? 'it' : 'them'}?
          </span>
          <button type="button" style={primaryBtn} onClick={() => setChangesOpen(true)}>
            Review changes
          </button>
        </div>
      )}

      <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '16px 0 12px', flexWrap: 'wrap' }}>
        <div role="group" aria-label="Filter by status" style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
          <FilterChip label="All" count={rows.length} active={filter === 'all'} onClick={() => setFilter('all')} />
          {FILTER_ORDER.filter((st) => counts[st] > 0).map((st) => (
            <FilterChip
              key={st}
              label={TILE_LABEL[st]}
              count={counts[st]}
              active={filter === st}
              onClick={() => setFilter(filter === st ? 'all' : st)}
            />
          ))}
        </div>
        <div
          style={{
            marginLeft: 'auto',
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '8px 12px', borderRadius: 10,
            background: '#fff', border: '1px solid var(--color-border)',
            minWidth: 200, flex: '0 1 260px',
          }}
        >
          <Search size={14} color="var(--color-text-muted)" aria-hidden />
          <input
            aria-label="Search the Square menu"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search items"
            style={{
              flex: 1, border: 'none', outline: 'none', background: 'transparent',
              fontFamily: 'var(--font-primary)', fontSize: 13, color: 'var(--color-text-primary)',
            }}
          />
        </div>
      </div>

      <div style={{ ...card, overflow: 'visible', borderColor: 'var(--color-border)' }}>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: GRID,
            gap: 12,
            padding: '11px 16px',
            background: '#FBFAF8',
            borderBottom: '1px solid var(--color-border)',
            borderTopLeftRadius: 12, borderTopRightRadius: 12,
            ...eyebrow,
            fontSize: 11.5,
            color: 'var(--color-text-secondary)',
          }}
        >
          <span>Item</span>
          <span>Sizes</span>
          <span>Till price</span>
          <span>Status</span>
          <span aria-hidden />
        </div>
        {sections.length === 0 ? (
          <div style={{ padding: 28, textAlign: 'center', color: 'var(--color-text-muted)', fontSize: 13 }}>
            No items match.
          </div>
        ) : (
          sections.map((sec, secIdx) => {
            const open = !collapsed.has(sec.name);
            const label = sec.name || 'Not in a group';
            const review = sec.rows.filter((r) => NEEDS_REVIEW.includes(r.status)).length;
            const toPublishHere = sec.rows.filter((r) => TO_PUBLISH.includes(r.status)).length;
            const onMenu = !!menu && menu.groups.includes(sec.name);
            const catIdx = menu ? menu.groups.indexOf(sec.name) : -1;
            const isRenaming = renaming?.from === sec.name;
            return (
              <section
                key={sec.name || 'none'}
                aria-label={label}
                onDragOver={(e) => {
                  if (!dragging) return;
                  e.preventDefault();
                  e.dataTransfer.dropEffect = 'move';
                  if (dropOn !== sec.name) setDropOn(sec.name);
                }}
                onDragLeave={(e) => {
                  if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setDropOn((d) => (d === sec.name ? null : d));
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  if (dragging) moveRow(dragging, sec.name);
                  setDragging(null);
                  setDropOn(null);
                }}
                style={{
                  outline: dropOn === sec.name && dragging?.from !== sec.name ? '2px dashed var(--color-accent-active)' : 'none',
                  outlineOffset: -2,
                }}
              >
                <div
                  style={{
                    display: 'grid', gridTemplateColumns: GRID, gap: 12, alignItems: 'center',
                    padding: '6px 16px',
                    background: 'var(--color-bg-hover)',
                    borderTop: secIdx === 0 ? 'none' : '1px solid var(--color-border)',
                    position: 'relative',
                  }}
                >
                  <h3 style={{ gridColumn: '1 / 4', margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                    {isRenaming ? (
                      <span style={{ display: 'inline-flex', gap: 6, padding: '2px 0' }}>
                        <input
                          aria-label={`Rename ${label}`}
                          autoFocus
                          value={renaming.value}
                          onChange={(e) => setRenaming({ from: sec.name, value: e.target.value })}
                          onKeyDown={(e) => { if (e.key === 'Enter') saveRename(); if (e.key === 'Escape') setRenaming(null); }}
                          style={{ ...inputStyle, height: 30, width: 200, fontSize: 13 }}
                        />
                        <button type="button" style={secondaryBtn} onClick={saveRename}>Save</button>
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => toggleSection(sec.name)}
                        aria-expanded={open}
                        style={{
                          display: 'inline-flex', alignItems: 'center', gap: 8,
                          padding: '4px 0', background: 'transparent', border: 'none',
                          cursor: 'pointer', fontFamily: 'var(--font-primary)', color: 'var(--color-text-primary)',
                        }}
                      >
                        {open ? <ChevronDown size={14} aria-hidden /> : <ChevronRight size={14} aria-hidden />}
                        <span style={{ fontSize: 13.5, fontWeight: 700 }}>{label}</span>
                        <span style={{ fontSize: 12.5, fontWeight: 400, color: 'var(--color-text-secondary)' }}>
                          {sec.rows.length} {sec.rows.length === 1 ? 'item' : 'items'}
                        </span>
                      </button>
                    )}
                  </h3>
                  <span>
                    {!open && review > 0 && <StatusPill tone="warning">{review} to review</StatusPill>}
                    {!open && review === 0 && toPublishHere > 0 && <StatusPill tone="info">{toPublishHere} to publish</StatusPill>}
                  </span>
                  <span style={{ textAlign: 'right', position: 'relative' }}>
                    {!sec.name && menu && sec.rows.some((r) => r.kind === 'item' && r.item.current.category) && (
                      <button type="button" style={{ ...linkBtn, fontSize: 12.5 }} onClick={() => groupsFromPosCategories(menu.id)}>
                        Group by POS category
                      </button>
                    )}
                    {sec.name && (
                      <button
                        type="button"
                        aria-label={`Actions for ${label}`}
                        aria-expanded={catActions === sec.name}
                        onClick={() => setCatActions(catActions === sec.name ? null : sec.name)}
                        style={{ ...secondaryBtn, padding: '5px 8px' }}
                      >
                        <MoreHorizontal size={14} aria-hidden />
                      </button>
                    )}
                    {catActions === sec.name && (
                      <>
                        <div onClick={() => setCatActions(null)} style={{ position: 'fixed', inset: 0, zIndex: 50 }} />
                        <div
                          role="menu"
                          style={{
                            position: 'absolute', top: '100%', right: 0, marginTop: 4, zIndex: 60,
                            background: '#fff', border: '1px solid var(--color-border)', borderRadius: 10,
                            boxShadow: '0 12px 24px -8px rgba(0, 28, 53, 0.25)', minWidth: 200, overflow: 'hidden', textAlign: 'left',
                          }}
                        >
                          <CatAction icon={<Pencil size={13} />} onClick={() => { setRenaming({ from: sec.name, value: sec.name }); setCatActions(null); }}>
                            Rename
                          </CatAction>
                          {onMenu && catIdx > 0 && (
                            <CatAction icon={<ArrowUp size={13} />} onClick={() => { moveMenuGroup(menu!.id, sec.name, -1); setCatActions(null); }}>
                              Move up
                            </CatAction>
                          )}
                          {onMenu && catIdx < menu!.groups.length - 1 && (
                            <CatAction icon={<ArrowDown size={13} />} onClick={() => { moveMenuGroup(menu!.id, sec.name, 1); setCatActions(null); }}>
                              Move down
                            </CatAction>
                          )}
                          {onMenu && sec.rows.length === 0 && (
                            <CatAction icon={<Trash2 size={13} />} onClick={() => { deleteMenuGroup(menu!.id, sec.name); setCatActions(null); }}>
                              Delete group
                            </CatAction>
                          )}
                        </div>
                      </>
                    )}
                  </span>
                </div>
                {open && sec.rows.length === 0 && (
                  <div style={{ padding: '12px 16px 12px 38px', borderTop: '1px solid var(--color-border)', fontSize: 13, color: 'var(--color-text-secondary)' }}>
                    No items yet. Drag items here or{' '}
                    <button type="button" style={{ ...linkBtn, fontSize: 13 }} onClick={() => setAddOpen(true)}>add items</button>
                  </div>
                )}
                {open && sec.rows.map((r) =>
                  r.kind === 'item' ? (
                    <ItemRow
                      key={r.id}
                      handle={menu && (
                        <MoveHandle
                          rowId={r.id}
                          name={r.item.current.name}
                          current={sec.name}
                          groups={menu.groups}
                          onMove={(g) => moveRow({ kind: 'item', id: r.id, name: r.item.current.name, from: sec.name }, g)}
                          onDragStart={() => setDragging({ kind: 'item', id: r.id, name: r.item.current.name, from: sec.name })}
                          onDragEnd={() => { setDragging(null); setDropOn(null); }}
                        />
                      )}
                      dragged={dragging?.id === r.id}
                      item={r.item}
                      status={r.status}
                      sourceName={sourceName(r.item, recipes, products)}
                      onOpen={() => (r.status === 'changed' ? setChangesOpen(true) : setOpenItem(r.id))}
                      onEdit={() => setOpenItem(r.id)}
                    />
                  ) : (
                    <SquareOnlyRow
                      key={r.id}
                      handle={menu && (
                        <MoveHandle
                          rowId={r.id}
                          name={r.sq.name}
                          current={sec.name}
                          groups={menu.groups}
                          onMove={(g) => moveRow({ kind: 'square', id: r.id, name: r.sq.name, from: sec.name }, g)}
                          onDragStart={() => setDragging({ kind: 'square', id: r.id, name: r.sq.name, from: sec.name })}
                          onDragEnd={() => { setDragging(null); setDropOn(null); }}
                        />
                      )}
                      dragged={dragging?.id === r.id}
                      sq={r.sq}
                      pickerOpen={linkFor === r.id}
                      onLink={() => setLinkFor(linkFor === r.id ? null : r.id)}
                      onClosePicker={() => setLinkFor(null)}
                      onPicked={(target) => {
                        setLinkFor(null);
                        if (target.type === 'recipe') linkSquareOnly(r.id, { kind: 'recipe', recipeId: target.id });
                        else if (target.type === 'product') linkSquareOnly(r.id, { kind: 'product', productId: target.id });
                      }}
                      onCreate={() => router.push('/recipes/intake/pos')}
                    />
                  ),
                )}
              </section>
            );
          })
        )}
        <div style={{ padding: '10px 16px', borderTop: '1px solid var(--color-border)' }}>
          {newCatName == null ? (
            <button type="button" style={{ ...linkBtn, display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 13 }} onClick={() => setNewCatName('')}>
              <Plus size={13} aria-hidden /> New group
            </button>
          ) : (
            <span style={{ display: 'inline-flex', gap: 6 }}>
              <input
                aria-label="New group name"
                autoFocus
                placeholder="e.g. Spring specials"
                value={newCatName}
                onChange={(e) => setNewCatName(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') saveNewCategory(); if (e.key === 'Escape') setNewCatName(null); }}
                style={{ ...inputStyle, height: 32, width: 220, fontSize: 13 }}
              />
              <button type="button" style={secondaryBtn} onClick={saveNewCategory}>Add</button>
              <button type="button" style={linkBtn} onClick={() => setNewCatName(null)}>Cancel</button>
            </span>
          )}
        </div>
      </div>

      <div aria-live="polite" style={visuallyHidden}>{announce}</div>

      {tillGroups.length > 0 && (
        <>
          <h2 style={{ fontSize: 15, fontWeight: 700, margin: '28px 0 10px' }}>Modifier groups</h2>
          <div style={{ ...card, borderColor: 'var(--color-border)' }}>
            {tillGroups.map((g, idx) => {
              const st = groupTillStatus(g, sm);
              const used = sm.items.filter((i) => i.current.groups.includes(g.id)).length;
              return (
                <div
                  key={g.id}
                  style={{
                    display: 'grid', gridTemplateColumns: '1.6fr 1fr 150px 110px', gap: 12, alignItems: 'center',
                    padding: '11px 16px',
                    borderTop: idx === 0 ? 'none' : '1px solid var(--color-border)',
                  }}
                >
                  <div>
                    <div style={{ fontSize: 13.5, fontWeight: 600 }}>{g.name}</div>
                    <div style={{ fontSize: 12.5, color: 'var(--color-text-secondary)' }}>
                      {g.options.length} options · {g.selection === 'one' ? 'pick one' : g.maxSelections ? `up to ${g.maxSelections}` : 'pick any'}
                    </div>
                  </div>
                  <span style={{ fontSize: 13, color: 'var(--color-text-primary)' }}>
                    On {used} {used === 1 ? 'item' : 'items'}
                  </span>
                  <span>
                    {st === 'changed' ? <TillStatusPill status="changed" /> : st === 'ready' ? <TillStatusPill status="ready" /> : st === 'not-on-till' ? <TillStatusPill status="not-on-till" /> : <TillStatusPill status="in-sync" />}
                  </span>
                  <span style={{ textAlign: 'right' }}>
                    {st === 'changed' ? (
                      <button type="button" style={secondaryBtn} onClick={() => setChangesOpen(true)}>Review</button>
                    ) : (
                      <button type="button" style={secondaryBtn} onClick={() => setEditGroup(g)}>Edit</button>
                    )}
                  </span>
                </div>
              );
            })}
          </div>
        </>
      )}

      {openItem && <SquareMenuItemDrawer itemId={openItem} onClose={() => setOpenItem(null)} />}
      {publishOpen && (
        <PublishSheet
          onClose={() => setPublishOpen(false)}
          onOpenItem={(id) => { setPublishOpen(false); setOpenItem(id); }}
          onReviewChanges={() => { setPublishOpen(false); setChangesOpen(true); }}
        />
      )}
      {changesOpen && (
        <ChangedInSquarePanel
          onClose={() => setChangesOpen(false)}
          onEditGroup={(g) => { setChangesOpen(false); setEditGroup(g); }}
        />
      )}
      {addOpen && <AddTillItemsPicker menuId={menu?.id} menuName={menu?.name} onClose={() => setAddOpen(false)} onAdded={(id) => { setAddOpen(false); setOpenItem(id ?? null); }} />}
      <GroupEditorDrawer
        open={!!editGroup}
        mode="edit"
        initial={editGroup}
        onClose={() => setEditGroup(null)}
        onSaved={() => setEditGroup(null)}
      />
    </Page>
  );
}

const GRID = '1.8fr 1.3fr 120px 1.3fr 120px';

/** Same as the "Match to…" control on Item matching. */
const matchDropdownStyle: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: 6,
  width: '100%',
  padding: '6px 10px', borderRadius: 8,
  border: '1px dashed var(--color-border)',
  background: '#fff',
  fontSize: 12.5, fontWeight: 600,
  fontFamily: 'var(--font-primary)',
  color: 'var(--color-text-primary)',
  cursor: 'pointer',
  textAlign: 'left',
};

function sourceName(item: TillItem, recipes: ReturnType<typeof useRecipes>, products: ReturnType<typeof useProducts>): string {
  if (item.source.kind === 'recipe') {
    const id = item.source.recipeId;
    return recipes.find((r) => r.id === id)?.name ?? 'Recipe';
  }
  const id = item.source.productId;
  return products.find((p) => p.id === id)?.name ?? 'Product';
}

function ItemRow({
  item, status, sourceName: src, onOpen, onEdit, handle, dragged,
}: {
  handle?: React.ReactNode;
  dragged?: boolean;
  item: TillItem;
  status: TillStatus;
  sourceName: string;
  onOpen: () => void;
  onEdit: () => void;
}) {
  const [hover, setHover] = useState(false);
  const f = item.current;
  const meta = [
    ...(item.source.kind === 'product' ? ['product'] : []),
    ...(src.toLowerCase() !== f.name.toLowerCase() ? [src] : []),
    ...(f.sites.length > 0 ? [`${f.sites.length} ${f.sites.length === 1 ? 'site' : 'sites'}`] : []),
    ...(item.soldOutAt?.length ? [`Sold out at ${item.soldOutAt.join(', ')}`] : []),
  ];
  const action = status === 'changed' ? 'Review' : status === 'blocked' ? 'Fix' : null;
  return (
    <div
      data-row
      onClick={(e) => {
        if ((e.target as HTMLElement).closest('button, a, input, select, [role="menu"]')) return;
        onEdit();
      }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: 'grid', gridTemplateColumns: GRID, gap: 12, alignItems: 'center',
        padding: '12px 16px',
        borderTop: '1px solid var(--color-border)',
        background: hover ? 'var(--color-bg-hover)' : item.takeOff ? '#FBFAF8' : '#fff',
        opacity: dragged ? 0.45 : 1,
        cursor: 'pointer',
      }}
    >
      <div style={{ minWidth: 0, display: 'flex', alignItems: 'flex-start', gap: 6 }}>
        {handle}
        <div style={{ minWidth: 0 }}>
        <button
          type="button"
          onClick={onEdit}
          aria-label={`Open ${f.name}`}
          style={{
            border: 'none', background: 'transparent', padding: 0, cursor: 'pointer',
            fontSize: 13.5, fontWeight: 600, color: 'var(--color-text-primary)',
            fontFamily: 'var(--font-primary)', textAlign: 'left',
            textDecoration: item.takeOff ? 'line-through' : 'none',
          }}
        >
          {f.name}
        </button>
        {meta.length > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 3, flexWrap: 'wrap', fontSize: 12.5, color: 'var(--color-text-secondary)' }}>
            {item.source.kind === 'product' && <SourceChip kind="product" />}
            {meta.filter((m) => m !== 'product').join(' · ')}
          </div>
        )}
        </div>
      </div>
      <span style={oneLine} title={f.sizes.join(', ')}>{sizeSummary(f.sizes)}</span>
      <span style={{ fontSize: 13, fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{priceRange(f)}</span>
      <div style={{ minWidth: 0 }}>
        <TillStatusPill status={status} />
      </div>
      <span style={{ textAlign: 'right' }}>
        {action && (
          <button type="button" style={secondaryBtn} onClick={onOpen} aria-label={`${action} ${f.name}`}>
            {action}
          </button>
        )}
      </span>
    </div>
  );
}

function SquareOnlyRow({
  sq, pickerOpen, onLink, onClosePicker, onPicked, onCreate, handle, dragged,
}: {
  handle?: React.ReactNode;
  dragged?: boolean;
  sq: SquareOnlyItem;
  pickerOpen: boolean;
  onLink: () => void;
  onClosePicker: () => void;
  onPicked: (target: { type: 'recipe' | 'product' | 'master-product'; id: string }) => void;
  onCreate: () => void;
}) {
  return (
    <div
      style={{
        display: 'grid', gridTemplateColumns: GRID, gap: 12, alignItems: 'center',
        padding: '12px 16px',
        borderTop: '1px solid var(--color-border)',
        position: 'relative',
        background: '#fff',
        opacity: dragged ? 0.45 : 1,
      }}
      data-row
    >
      <div style={{ minWidth: 0, display: 'flex', alignItems: 'flex-start', gap: 6 }}>
        {handle}
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 13.5, fontWeight: 600 }}>{sq.name}</div>
          {sq.createdAt && (
            <div style={{ fontSize: 12.5, color: 'var(--color-text-secondary)', marginTop: 3 }}>Added in Square {sq.createdAt}</div>
          )}
        </div>
      </div>
      <span style={oneLine} title={sq.sizes.join(', ')}>{sizeSummary(sq.sizes)}</span>
      <span style={{ fontSize: 13, fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{priceRange({ sizes: sq.sizes, prices: sq.prices } as TillItem['current'])}</span>
      <div>
        <TillStatusPill status="till-only" />
      </div>
      <span style={{ textAlign: 'right', position: 'relative' }}>
        <button
          type="button"
          onClick={onLink}
          aria-expanded={pickerOpen}
          aria-label={`Match ${sq.name} to a recipe or product`}
          style={{
            ...matchDropdownStyle,
            ...(pickerOpen ? { borderStyle: 'solid', borderColor: 'var(--color-accent-active)' } : null),
          }}
        >
          <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            Match to…
          </span>
          <ChevronDown size={14} aria-hidden />
        </button>
        {pickerOpen && (
          <MatchPicker
            posItemId={sq.id}
            onClose={onClosePicker}
            align="right"
            onPick={(t) => onPicked(t)}
            onCreate={onCreate}
          />
        )}
      </span>
    </div>
  );
}

function EmptyStart({ onAdd }: { onAdd: () => void }) {
  return (
    <div style={{ ...card, padding: 24, maxWidth: 640 }}>
      <h1 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>Your Square menu is empty</h1>
      <p style={{ fontSize: 13.5, color: 'var(--color-text-muted)', lineHeight: 1.5, margin: '6px 0 16px' }}>
        Pick the recipes and products you sell. Nothing goes to Square until you publish.
      </p>
      <button type="button" style={primaryBtn} onClick={onAdd}>
        <Plus size={14} /> Choose what you sell
      </button>
    </div>
  );
}

const visuallyHidden: React.CSSProperties = {
  position: 'absolute', width: 1, height: 1, padding: 0, margin: -1, overflow: 'hidden', clip: 'rect(0 0 0 0)', whiteSpace: 'nowrap', border: 0,
};

/** Drag to another group, or click for a list. The list is the keyboard and single-tap route. */
function MoveHandle({
  rowId, name, current, groups, onMove, onDragStart, onDragEnd,
}: {
  rowId: string;
  name: string;
  current: string;
  groups: string[];
  onMove: (group: string) => void;
  onDragStart: () => void;
  onDragEnd: () => void;
}) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const targets = [...groups.filter((g) => g !== current), ...(current ? [''] : [])];

  useEffect(() => {
    if (open) menuRef.current?.querySelector<HTMLButtonElement>('[role="menuitem"]')?.focus();
  }, [open]);

  function close() {
    setOpen(false);
    btnRef.current?.focus();
  }

  return (
    <span style={{ position: 'relative', flexShrink: 0, marginLeft: -6 }}>
      <button
        ref={btnRef}
        type="button"
        data-move-handle={rowId}
        draggable
        aria-label={`Move ${name} to another group`}
        aria-haspopup="menu"
        aria-expanded={open}
        title="Drag to another group"
        onClick={() => setOpen(!open)}
        onDragStart={(e) => {
          e.dataTransfer.effectAllowed = 'move';
          e.dataTransfer.setData('text/plain', name);
          const row = e.currentTarget.closest('[data-row]');
          if (row) e.dataTransfer.setDragImage(row, 24, 20);
          onDragStart();
        }}
        onDragEnd={onDragEnd}
        style={{
          width: 24, height: 24, padding: 0, borderRadius: 6,
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          border: 'none', background: 'transparent', cursor: 'grab',
          color: 'var(--color-text-secondary)',
        }}
      >
        <GripVertical size={15} aria-hidden />
      </button>
      {open && (
        <>
          <div onClick={() => setOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 50 }} />
          <div
            ref={menuRef}
            role="menu"
            aria-label={`Move ${name} to`}
            onKeyDown={(e) => {
              if (e.key === 'Escape') close();
              if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
                e.preventDefault();
                const items = Array.from(menuRef.current?.querySelectorAll<HTMLButtonElement>('[role="menuitem"]') ?? []);
                const idx = items.indexOf(document.activeElement as HTMLButtonElement);
                items[(idx + (e.key === 'ArrowDown' ? 1 : items.length - 1)) % items.length]?.focus();
              }
            }}
            style={{
              position: 'absolute', top: '100%', left: 0, marginTop: 4, zIndex: 60,
              background: '#fff', border: '1px solid var(--color-border)', borderRadius: 10,
              boxShadow: '0 12px 24px -8px rgba(0, 28, 53, 0.25)', minWidth: 200, overflow: 'hidden',
            }}
          >
            <div style={{ padding: '9px 12px 5px', fontSize: 11.5, fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--color-text-secondary)' }}>
              Move to
            </div>
            {targets.length === 0 ? (
              <div style={{ padding: '6px 12px 10px', fontSize: 13, color: 'var(--color-text-secondary)' }}>Make another group first.</div>
            ) : targets.map((g) => (
              <CatAction key={g || 'none'} onClick={() => { onMove(g); close(); }}>
                {g || 'Not in a group'}
              </CatAction>
            ))}
          </div>
        </>
      )}
    </span>
  );
}

function CatAction({ icon, onClick, children }: { icon?: React.ReactNode; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      style={{
        display: 'flex', alignItems: 'center', gap: 8, width: '100%',
        padding: '9px 12px', background: '#fff', border: 'none', cursor: 'pointer',
        fontFamily: 'var(--font-primary)', fontSize: 13, color: 'var(--color-text-primary)', textAlign: 'left',
      }}
    >
      {icon && <span aria-hidden style={{ display: 'inline-flex', color: 'var(--color-text-secondary)' }}>{icon}</span>}
      {children}
    </button>
  );
}

function FilterChip({ label, count, active, onClick }: { label: string; count: number; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      style={{
        padding: '6px 12px', borderRadius: 100,
        border: active ? '1px solid transparent' : '1px solid var(--color-border)',
        background: active ? 'var(--color-accent-active)' : '#fff',
        color: active ? '#fff' : 'var(--color-text-primary)',
        fontSize: 13, fontWeight: 600, cursor: 'pointer',
        fontFamily: 'var(--font-primary)',
        display: 'inline-flex', alignItems: 'center', gap: 6,
      }}
    >
      {label}
      <span style={{ fontSize: 11.5, fontWeight: 700, color: active ? 'rgba(255,255,255,0.85)' : 'var(--color-text-secondary)' }}>{count}</span>
    </button>
  );
}

function Page({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ padding: '24px 24px 120px', maxWidth: 1120, margin: '0 auto', fontFamily: 'var(--font-primary)' }}>
      {children}
    </div>
  );
}

export default function SquareMenuPage() {
  return (
    <Suspense fallback={null}>
      <SquareMenuInner />
    </Suspense>
  );
}
