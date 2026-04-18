'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';
import { Search, Mic, Sparkles, Clock, Check, Trash2, Undo2, AlertTriangle } from 'lucide-react';
import {
  WASTE_PRODUCTS,
  WASTE_REASONS,
  likelyToBinAtPhase,
  getProduct,
  entriesLoggedToday,
  entriesLast7Days,
  type WasteProduct,
  type LoggedEntry,
} from '@/components/Waste/wasteData';
import type { BriefingPhase } from '@/components/briefing';

type TabId = 'log-new' | 'today' | 'last-7';

export default function WasteLogPicker({ phase }: { phase: BriefingPhase }) {
  const router = useRouter();
  const [tab, setTab] = useState<TabId>('log-new');
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<string[]>([]);
  const [deletedIds, setDeletedIds] = useState<Set<string>>(() => new Set());
  const [lastDeleted, setLastDeleted] = useState<LoggedEntry | null>(null);
  const [pendingDelete, setPendingDelete] = useState<LoggedEntry | null>(null);
  const undoTimerRef = useRef<number | null>(null);

  const allToday = useMemo(() => entriesLoggedToday(), []);
  const allWeek = useMemo(() => entriesLast7Days(), []);
  const likely = useMemo(() => likelyToBinAtPhase(phase), [phase]);
  const todayEntries = useMemo(
    () => allToday.filter((e) => !deletedIds.has(e.id)),
    [allToday, deletedIds],
  );
  const weekEntries = useMemo(
    () => allWeek.filter((e) => !deletedIds.has(e.id)),
    [allWeek, deletedIds],
  );

  function requestDelete(entry: LoggedEntry) {
    setPendingDelete(entry);
  }

  function confirmDelete() {
    const entry = pendingDelete;
    if (!entry) return;
    setDeletedIds((prev) => {
      const next = new Set(prev);
      next.add(entry.id);
      return next;
    });
    setLastDeleted(entry);
    setPendingDelete(null);
    if (undoTimerRef.current) window.clearTimeout(undoTimerRef.current);
    undoTimerRef.current = window.setTimeout(() => setLastDeleted(null), 4500);
  }

  function undoDelete() {
    if (!lastDeleted) return;
    setDeletedIds((prev) => {
      const next = new Set(prev);
      next.delete(lastDeleted.id);
      return next;
    });
    setLastDeleted(null);
    if (undoTimerRef.current) window.clearTimeout(undoTimerRef.current);
  }

  useEffect(() => {
    return () => {
      if (undoTimerRef.current) window.clearTimeout(undoTimerRef.current);
    };
  }, []);

  const filtered = useMemo(() => {
    if (!query.trim()) return WASTE_PRODUCTS;
    const q = query.toLowerCase();
    return WASTE_PRODUCTS.filter(
      (p) => p.name.toLowerCase().includes(q) || p.category.toLowerCase().includes(q),
    );
  }, [query]);

  function toggleSelected(productId: string) {
    setSelected((prev) =>
      prev.includes(productId) ? prev.filter((id) => id !== productId) : [...prev, productId],
    );
  }

  function pickOne(productId: string) {
    router.push(`/log-waste?itemId=${encodeURIComponent(productId)}`);
  }

  function startFlow() {
    if (selected.length === 0) return;
    if (selected.length === 1) {
      router.push(`/log-waste?itemId=${encodeURIComponent(selected[0])}`);
      return;
    }
    const queue = selected.join(',');
    router.push(
      `/log-waste?itemId=${encodeURIComponent(selected[0])}&queue=${encodeURIComponent(queue)}&i=0`,
    );
  }

  function relog(entry: LoggedEntry) {
    router.push(
      `/log-waste?itemId=${encodeURIComponent(entry.productId)}&qty=${entry.qty}&reason=${entry.reasonId}`,
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '18px', paddingBottom: '40px' }}>
      {/* Tabs */}
      <div
        role="tablist"
        aria-label="Waste log view"
        style={{
          display: 'flex',
          gap: '4px',
          padding: '4px',
          borderRadius: '100px',
          background: 'var(--color-bg-hover)',
          border: '1px solid var(--color-border-subtle)',
          width: '100%',
          boxSizing: 'border-box',
        }}
      >
        <TabButton active={tab === 'log-new'}  onClick={() => setTab('log-new')}>Log new</TabButton>
        <TabButton active={tab === 'today'}    onClick={() => setTab('today')}  count={todayEntries.length}>Today</TabButton>
        <TabButton active={tab === 'last-7'}   onClick={() => setTab('last-7')} count={weekEntries.length}>Last 7 days</TabButton>
      </div>

      {tab === 'log-new' && (
        <>
          {/* Search + mic */}
          <div
            style={{
              display: 'flex',
              gap: '8px',
              alignItems: 'center',
            }}
          >
            <div
              style={{
                flex: 1,
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '10px 14px',
                borderRadius: '12px',
                background: '#fff',
                border: '1px solid var(--color-border-subtle)',
                boxShadow: '0 1px 3px rgba(58,48,40,0.06)',
              }}
            >
              <Search size={16} color="var(--color-text-muted)" strokeWidth={2} />
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search products…"
                style={{
                  flex: 1,
                  border: 'none',
                  outline: 'none',
                  background: 'transparent',
                  fontSize: '14px',
                  fontFamily: 'var(--font-primary)',
                  color: 'var(--color-text-primary)',
                  minWidth: 0,
                }}
              />
            </div>
            <button
              type="button"
              title="Voice log coming soon"
              onClick={() => {}}
              style={{
                width: '42px',
                height: '42px',
                borderRadius: '12px',
                border: '1px solid var(--color-border-subtle)',
                background: '#fff',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--color-text-muted)',
                cursor: 'pointer',
                boxShadow: '0 1px 3px rgba(58,48,40,0.06)',
              }}
            >
              <Mic size={16} strokeWidth={2} />
            </button>
          </div>

          {/* Likely to bin */}
          {likely.length > 0 && (
            <Section
              icon={<Sparkles size={12} color="var(--color-accent-quinn)" strokeWidth={2.2} />}
              label="Likely to bin"
              sublabel="Quinn · based on today's pace"
            >
              {likely.map(({ product, short, made, sold }) => (
                <ProductRow
                  key={product.id}
                  product={product}
                  selected={selected.includes(product.id)}
                  onToggle={() => toggleSelected(product.id)}
                  onPick={() => pickOne(product.id)}
                  meta={`made ${made}, sold ${sold} · ${short} short`}
                  badge={{ label: `${short}×`, tone: 'warn' }}
                />
              ))}
            </Section>
          )}

          {/* Full catalog */}
          <Section
            label="All products"
            sublabel={`${filtered.length} item${filtered.length === 1 ? '' : 's'}`}
          >
            {filtered.length === 0 ? (
              <p
                style={{
                  margin: 0,
                  padding: '14px',
                  fontSize: '13px',
                  color: 'var(--color-text-muted)',
                  textAlign: 'center',
                }}
              >
                No products match &ldquo;{query}&rdquo;
              </p>
            ) : (
              filtered.map((p) => (
                <ProductRow
                  key={p.id}
                  product={p}
                  selected={selected.includes(p.id)}
                  onToggle={() => toggleSelected(p.id)}
                  onPick={() => pickOne(p.id)}
                />
              ))
            )}
          </Section>

          {/* Sticky CTA */}
          {selected.length > 0 && (
            <div
              style={{
                position: 'sticky',
                bottom: '12px',
                zIndex: 20,
                display: 'flex',
                justifyContent: 'center',
                pointerEvents: 'none',
              }}
            >
              <button
                type="button"
                onClick={startFlow}
                style={{
                  pointerEvents: 'auto',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '10px',
                  padding: '14px 22px',
                  borderRadius: '100px',
                  border: 'none',
                  background: 'var(--color-accent-deep)',
                  color: '#F4F1EC',
                  fontFamily: 'var(--font-primary)',
                  fontSize: '14px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  boxShadow: '0 10px 28px rgba(3,28,89,0.25)',
                }}
              >
                <span
                  aria-hidden
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    minWidth: '22px',
                    height: '22px',
                    padding: '0 6px',
                    borderRadius: '100px',
                    background: 'rgba(255,255,255,0.18)',
                    fontSize: '12px',
                    fontWeight: 700,
                  }}
                >
                  {selected.length}
                </span>
                {selected.length === 1 ? 'Log selected item' : `Log ${selected.length} items`}
              </button>
            </div>
          )}
        </>
      )}

      {tab === 'today' && (
        <LoggedEntryList
          entries={todayEntries}
          emptyMessage="Nothing logged yet today."
          onRelog={relog}
          onDelete={requestDelete}
        />
      )}

      {tab === 'last-7' && (
        <LoggedEntryList
          entries={weekEntries}
          emptyMessage="No waste logged in the last 7 days."
          onRelog={relog}
          onDelete={requestDelete}
          showDayHeaders
        />
      )}

      {pendingDelete && (
        <ConfirmDeleteModal
          entry={pendingDelete}
          onCancel={() => setPendingDelete(null)}
          onConfirm={confirmDelete}
        />
      )}

      {lastDeleted && (
        <div
          style={{
            position: 'fixed',
            bottom: 'calc(env(safe-area-inset-bottom, 0px) + 24px)',
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 250,
            display: 'inline-flex',
            alignItems: 'center',
            gap: '12px',
            padding: '10px 12px 10px 16px',
            borderRadius: '100px',
            background: '#1c2340',
            color: '#F4F1EC',
            fontFamily: 'var(--font-primary)',
            fontSize: '13px',
            fontWeight: 600,
            boxShadow: '0 10px 28px rgba(3,28,89,0.28)',
            maxWidth: 'calc(100vw - 32px)',
          }}
        >
          <Check size={14} strokeWidth={2.5} />
          <span>Entry removed</span>
          <button
            type="button"
            onClick={undoDelete}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '6px 12px',
              borderRadius: '100px',
              border: 'none',
              background: 'rgba(255,255,255,0.12)',
              color: '#F4F1EC',
              fontFamily: 'var(--font-primary)',
              fontSize: '13px',
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            <Undo2 size={13} strokeWidth={2.5} />
            Undo
          </button>
        </div>
      )}
    </div>
  );
}

function TabButton({
  active,
  onClick,
  count,
  children,
}: {
  active: boolean;
  onClick: () => void;
  count?: number;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      style={{
        all: 'unset',
        flex: 1,
        textAlign: 'center',
        padding: '8px 10px',
        borderRadius: '100px',
        fontSize: '12px',
        fontWeight: 600,
        fontFamily: 'var(--font-primary)',
        cursor: 'pointer',
        background: active ? 'var(--color-accent-active)' : 'transparent',
        color: active ? '#fff' : 'var(--color-text-muted)',
        transition: 'background 0.15s ease, color 0.15s ease',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '6px',
        whiteSpace: 'nowrap',
      }}
    >
      <span>{children}</span>
      {typeof count === 'number' && (
        <span
          aria-hidden
          style={{
            minWidth: '18px',
            height: '18px',
            padding: '0 5px',
            borderRadius: '100px',
            fontSize: '11px',
            fontWeight: 700,
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: active ? 'rgba(255,255,255,0.25)' : 'var(--color-border-subtle)',
            color: active ? '#fff' : 'var(--color-text-secondary)',
          }}
        >
          {count}
        </span>
      )}
    </button>
  );
}

function LoggedEntryList({
  entries,
  emptyMessage,
  onRelog,
  onDelete,
  showDayHeaders,
}: {
  entries: LoggedEntry[];
  emptyMessage: string;
  onRelog: (e: LoggedEntry) => void;
  onDelete: (e: LoggedEntry) => void;
  showDayHeaders?: boolean;
}) {
  if (entries.length === 0) {
    return (
      <div
        style={{
          padding: '32px 16px',
          textAlign: 'center',
          color: 'var(--color-text-muted)',
          fontSize: '13px',
          background: '#fff',
          borderRadius: '12px',
          border: '1px solid var(--color-border-subtle)',
        }}
      >
        {emptyMessage}
      </div>
    );
  }

  // Group by day header label (today vs the prefix of the timestamp like "Fri").
  const today = entries.filter((e) => e.isToday);
  const others = entries.filter((e) => !e.isToday);
  const othersByDay: Record<string, LoggedEntry[]> = {};
  for (const e of others) {
    const key = e.timestamp.split(' ')[0]; // e.g. "Fri"
    (othersByDay[key] ??= []).push(e);
  }

  const totalValue = entries.reduce((sum, e) => {
    const p = getProduct(e.productId);
    return sum + (p ? p.unitCost * e.qty : 0);
  }, 0);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'baseline',
          justifyContent: 'space-between',
          padding: '0 4px',
        }}
      >
        <span
          style={{
            fontSize: '11px',
            fontWeight: 700,
            letterSpacing: '0.06em',
            textTransform: 'uppercase',
            color: 'var(--color-text-secondary)',
          }}
        >
          {entries.length} entr{entries.length === 1 ? 'y' : 'ies'}
        </span>
        <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--color-text-muted)' }}>
          Total £{totalValue.toFixed(2)}
        </span>
      </div>

      {showDayHeaders ? (
        <>
          {today.length > 0 && (
            <DayGroup label="Today" entries={today} onRelog={onRelog} onDelete={onDelete} />
          )}
          {Object.entries(othersByDay).map(([day, list]) => (
            <DayGroup key={day} label={day} entries={list} onRelog={onRelog} onDelete={onDelete} />
          ))}
        </>
      ) : (
        <EntryCard>
          {entries.map((e, i) => (
            <EntryRow
              key={e.id}
              entry={e}
              onRelog={onRelog}
              onDelete={onDelete}
              isLast={i === entries.length - 1}
            />
          ))}
        </EntryCard>
      )}
    </div>
  );
}

function DayGroup({
  label,
  entries,
  onRelog,
  onDelete,
}: {
  label: string;
  entries: LoggedEntry[];
  onRelog: (e: LoggedEntry) => void;
  onDelete: (e: LoggedEntry) => void;
}) {
  return (
    <div>
      <div
        style={{
          fontSize: '11px',
          fontWeight: 700,
          letterSpacing: '0.06em',
          textTransform: 'uppercase',
          color: 'var(--color-text-muted)',
          padding: '0 4px 6px',
        }}
      >
        {label}
      </div>
      <EntryCard>
        {entries.map((e, i) => (
          <EntryRow
            key={e.id}
            entry={e}
            onRelog={onRelog}
            onDelete={onDelete}
            isLast={i === entries.length - 1}
          />
        ))}
      </EntryCard>
    </div>
  );
}

function EntryCard({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        background: '#fff',
        borderRadius: '12px',
        border: '1px solid var(--color-border-subtle)',
        boxShadow: '0 1px 3px rgba(58,48,40,0.06)',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {children}
    </div>
  );
}

function EntryRow({
  entry,
  onRelog,
  onDelete,
  isLast,
}: {
  entry: LoggedEntry;
  onRelog: (e: LoggedEntry) => void;
  onDelete: (e: LoggedEntry) => void;
  isLast: boolean;
}) {
  const product = getProduct(entry.productId);
  const reasonLabel =
    WASTE_REASONS.find((r) => r.id === entry.reasonId)?.label ?? entry.reasonId;
  if (!product) return null;
  const value = product.unitCost * entry.qty;

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'stretch',
        borderBottom: isLast ? 'none' : '1px solid var(--color-border-subtle)',
      }}
    >
      <button
        type="button"
        onClick={() => onRelog(entry)}
        aria-label={`Edit entry: ${product.name}`}
        style={{
          all: 'unset',
          cursor: 'pointer',
          flex: 1,
          minWidth: 0,
          padding: '12px 10px 12px 14px',
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
        }}
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLButtonElement).style.background = 'var(--color-bg-hover)';
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLButtonElement).style.background = 'transparent';
        }}
      >
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontSize: '14px',
              fontWeight: 600,
              color: 'var(--color-text-primary)',
              lineHeight: 1.3,
            }}
          >
            {product.name}
          </div>
          <div
            style={{
              fontSize: '12px',
              fontWeight: 500,
              color: 'var(--color-text-muted)',
              lineHeight: 1.35,
              marginTop: '2px',
            }}
          >
            {entry.qty} {entry.uom}{entry.qty === 1 ? '' : 's'} · {reasonLabel} · {entry.timestamp}
          </div>
        </div>
        <div
          style={{
            flexShrink: 0,
            textAlign: 'right',
            fontSize: '13px',
            fontWeight: 700,
            color: 'var(--color-text-primary)',
          }}
        >
          £{value.toFixed(2)}
        </div>
      </button>
      <button
        type="button"
        onClick={() => onDelete(entry)}
        aria-label={`Delete entry: ${product.name}`}
        title="Remove"
        style={{
          all: 'unset',
          cursor: 'pointer',
          flexShrink: 0,
          width: 44,
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'var(--color-text-muted)',
          transition: 'background 0.15s ease, color 0.15s ease',
        }}
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLButtonElement).style.background = 'rgba(185,28,28,0.08)';
          (e.currentTarget as HTMLButtonElement).style.color = '#B91C1C';
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLButtonElement).style.background = 'transparent';
          (e.currentTarget as HTMLButtonElement).style.color = 'var(--color-text-muted)';
        }}
      >
        <Trash2 size={15} strokeWidth={2} />
      </button>
    </div>
  );
}

function Section({
  label,
  sublabel,
  icon,
  children,
}: {
  label: string;
  sublabel?: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          marginBottom: '8px',
          padding: '0 4px',
        }}
      >
        {icon}
        <span
          style={{
            fontSize: '11px',
            fontWeight: 700,
            letterSpacing: '0.06em',
            textTransform: 'uppercase',
            color: 'var(--color-text-secondary)',
          }}
        >
          {label}
        </span>
        {sublabel && (
          <span
            style={{
              fontSize: '11px',
              fontWeight: 500,
              color: 'var(--color-text-muted)',
              marginLeft: 'auto',
            }}
          >
            {sublabel}
          </span>
        )}
      </div>
      <div
        style={{
          background: '#fff',
          borderRadius: '12px',
          border: '1px solid var(--color-border-subtle)',
          boxShadow: '0 1px 3px rgba(58,48,40,0.06)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {children}
      </div>
    </div>
  );
}

function ProductRow({
  product,
  selected,
  onToggle,
  onPick,
  meta,
  badge,
}: {
  product: WasteProduct;
  selected: boolean;
  onToggle: () => void;
  onPick: () => void;
  meta?: string;
  badge?: { label: string; tone: 'warn' };
}) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'stretch',
        borderBottom: '1px solid var(--color-border-subtle)',
        background: selected ? 'rgba(34,68,68,0.06)' : 'transparent',
        transition: 'background 0.15s ease',
      }}
    >
      <button
        type="button"
        onClick={onToggle}
        aria-pressed={selected}
        aria-label={selected ? `Deselect ${product.name}` : `Select ${product.name}`}
        style={{
          all: 'unset',
          cursor: 'pointer',
          flexShrink: 0,
          padding: '12px 4px 12px 14px',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <span
          aria-hidden
          style={{
            width: '22px',
            height: '22px',
            borderRadius: '50%',
            border: selected
              ? '1.5px solid var(--color-accent-active)'
              : '1.5px solid var(--color-border)',
            background: selected ? 'var(--color-accent-active)' : '#fff',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'background 0.15s ease, border-color 0.15s ease',
          }}
        >
          {selected && <Check size={14} color="#fff" strokeWidth={3} />}
        </span>
      </button>
      <button
        type="button"
        onClick={onPick}
        aria-label={`Log waste for ${product.name}`}
        style={{
          all: 'unset',
          cursor: 'pointer',
          flex: 1,
          minWidth: 0,
          padding: '12px 14px 12px 8px',
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
        }}
        onMouseEnter={(e) => {
          if (!selected) (e.currentTarget.parentElement as HTMLElement).style.background = 'var(--color-bg-hover)';
        }}
        onMouseLeave={(e) => {
          (e.currentTarget.parentElement as HTMLElement).style.background = selected
            ? 'rgba(34,68,68,0.06)'
            : 'transparent';
        }}
      >
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontSize: '14px',
              fontWeight: 600,
              color: 'var(--color-text-primary)',
              lineHeight: 1.3,
            }}
          >
            {product.name}
          </div>
          <div
            style={{
              fontSize: '12px',
              fontWeight: 500,
              color: 'var(--color-text-muted)',
              lineHeight: 1.3,
              marginTop: '1px',
              textTransform: meta ? undefined : 'capitalize',
            }}
          >
            {meta ?? product.category}
          </div>
        </div>
        {badge && (
          <span
            style={{
              flexShrink: 0,
              padding: '4px 8px',
              borderRadius: '100px',
              fontSize: '12px',
              fontWeight: 700,
              background: 'rgba(185,28,28,0.08)',
              color: '#B91C1C',
            }}
          >
            {badge.label}
          </span>
        )}
        <span
          aria-hidden
          style={{
            color: 'var(--color-text-muted)',
            fontSize: '14px',
            fontWeight: 600,
            flexShrink: 0,
          }}
        >
          ›
        </span>
      </button>
    </div>
  );
}

function ConfirmDeleteModal({
  entry,
  onCancel,
  onConfirm,
}: {
  entry: LoggedEntry;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const product = getProduct(entry.productId);
  const reasonLabel =
    WASTE_REASONS.find((r) => r.id === entry.reasonId)?.label ?? entry.reasonId;
  const value = product ? product.unitCost * entry.qty : 0;

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onCancel();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onCancel]);

  if (typeof document === 'undefined' || !product) return null;

  return createPortal(
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1200,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
      }}
    >
      <div
        onClick={onCancel}
        style={{
          position: 'absolute',
          inset: 0,
          background: 'rgba(3,28,89,0.25)',
          backdropFilter: 'blur(2px)',
          animation: 'cdFadeIn 0.2s ease-out',
        }}
      />
      <div
        role="alertdialog"
        aria-modal="true"
        aria-label="Confirm remove entry"
        style={{
          position: 'relative',
          width: 'min(360px, 100%)',
          boxSizing: 'border-box',
          padding: '22px 22px 18px',
          borderRadius: 16,
          background: '#fff',
          border: '1px solid var(--color-border-subtle)',
          boxShadow: '0 16px 48px rgba(3,28,89,0.22)',
          fontFamily: 'var(--font-primary)',
          display: 'flex',
          flexDirection: 'column',
          gap: 14,
          animation: 'cdPop 0.22s cubic-bezier(0.4, 0, 0.2, 1)',
        }}
      >
        <style>{`@keyframes cdFadeIn { from { opacity: 0 } to { opacity: 1 } } @keyframes cdPop { from { opacity: 0; transform: translateY(12px) scale(0.97) } to { opacity: 1; transform: translateY(0) scale(1) } }`}</style>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
          <span
            style={{
              flexShrink: 0,
              width: 40,
              height: 40,
              borderRadius: '50%',
              background: 'rgba(185,28,28,0.10)',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <AlertTriangle size={20} color="#B91C1C" strokeWidth={2.2} />
          </span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              style={{
                fontSize: 16,
                fontWeight: 700,
                color: 'var(--color-text-primary)',
                lineHeight: 1.25,
              }}
            >
              Remove this entry?
            </div>
            <div
              style={{
                fontSize: 13,
                fontWeight: 500,
                color: 'var(--color-text-muted)',
                lineHeight: 1.4,
                marginTop: 4,
              }}
            >
              Reports will update to exclude this log. You&rsquo;ll have a few seconds to undo from
              the toast afterwards.
            </div>
          </div>
        </div>

        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 6,
            padding: '12px 14px',
            borderRadius: 10,
            background: 'var(--color-bg-hover)',
            fontSize: 13,
            color: 'var(--color-text-primary)',
          }}
        >
          <DeleteSummaryRow label="Item" value={product.name} />
          <DeleteSummaryRow label="Quantity" value={`${entry.qty} ${entry.uom}${entry.qty === 1 ? '' : 's'}`} />
          <DeleteSummaryRow label="Reason" value={reasonLabel} />
          <DeleteSummaryRow label="Logged" value={entry.timestamp} />
          <DeleteSummaryRow label="Value" value={`£${value.toFixed(2)}`} strong />
        </div>

        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button
            type="button"
            onClick={onCancel}
            style={{
              padding: '10px 18px',
              borderRadius: 10,
              border: '1px solid var(--color-border)',
              background: '#fff',
              cursor: 'pointer',
              fontFamily: 'var(--font-primary)',
              fontSize: 14,
              fontWeight: 600,
              color: 'var(--color-text-secondary)',
            }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            autoFocus
            style={{
              padding: '10px 20px',
              borderRadius: 10,
              border: 'none',
              background: '#B91C1C',
              cursor: 'pointer',
              fontFamily: 'var(--font-primary)',
              fontSize: 14,
              fontWeight: 700,
              color: '#fff',
            }}
          >
            Remove
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

function DeleteSummaryRow({
  label,
  value,
  strong,
}: {
  label: string;
  value: string;
  strong?: boolean;
}) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, minWidth: 0 }}>
      <span
        style={{
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: '0.04em',
          textTransform: 'uppercase',
          color: 'var(--color-text-muted)',
          flexShrink: 0,
        }}
      >
        {label}
      </span>
      <span
        style={{
          fontSize: strong ? 14 : 13,
          fontWeight: strong ? 700 : 600,
          color: 'var(--color-text-primary)',
          textAlign: 'right',
          minWidth: 0,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
      >
        {value}
      </span>
    </div>
  );
}
