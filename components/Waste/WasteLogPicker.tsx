'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Search, Mic, Sparkles, Clock } from 'lucide-react';
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

  const likely = useMemo(() => likelyToBinAtPhase(phase), [phase]);
  const todayEntries = useMemo(() => entriesLoggedToday(), []);
  const weekEntries = useMemo(() => entriesLast7Days(), []);

  const filtered = useMemo(() => {
    if (!query.trim()) return WASTE_PRODUCTS;
    const q = query.toLowerCase();
    return WASTE_PRODUCTS.filter(
      (p) => p.name.toLowerCase().includes(q) || p.category.toLowerCase().includes(q),
    );
  }, [query]);

  function pick(productId: string) {
    router.push(`/log-waste?itemId=${encodeURIComponent(productId)}`);
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
                  onPick={() => pick(product.id)}
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
              filtered.map((p) => <ProductRow key={p.id} product={p} onPick={() => pick(p.id)} />)
            )}
          </Section>
        </>
      )}

      {tab === 'today' && (
        <LoggedEntryList
          entries={todayEntries}
          emptyMessage="Nothing logged yet today."
          onRelog={relog}
        />
      )}

      {tab === 'last-7' && (
        <LoggedEntryList
          entries={weekEntries}
          emptyMessage="No waste logged in the last 7 days."
          onRelog={relog}
          showDayHeaders
        />
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
  showDayHeaders,
}: {
  entries: LoggedEntry[];
  emptyMessage: string;
  onRelog: (e: LoggedEntry) => void;
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
            <DayGroup label="Today" entries={today} onRelog={onRelog} />
          )}
          {Object.entries(othersByDay).map(([day, list]) => (
            <DayGroup key={day} label={day} entries={list} onRelog={onRelog} />
          ))}
        </>
      ) : (
        <EntryCard>
          {entries.map((e, i) => (
            <EntryRow key={e.id} entry={e} onRelog={onRelog} isLast={i === entries.length - 1} />
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
}: {
  label: string;
  entries: LoggedEntry[];
  onRelog: (e: LoggedEntry) => void;
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
          <EntryRow key={e.id} entry={e} onRelog={onRelog} isLast={i === entries.length - 1} />
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
  isLast,
}: {
  entry: LoggedEntry;
  onRelog: (e: LoggedEntry) => void;
  isLast: boolean;
}) {
  const product = getProduct(entry.productId);
  const reasonLabel =
    WASTE_REASONS.find((r) => r.id === entry.reasonId)?.label ?? entry.reasonId;
  if (!product) return null;
  const value = product.unitCost * entry.qty;

  return (
    <button
      type="button"
      onClick={() => onRelog(entry)}
      style={{
        all: 'unset',
        cursor: 'pointer',
        padding: '12px 14px',
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        borderBottom: isLast ? 'none' : '1px solid var(--color-border-subtle)',
      }}
      onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'var(--color-bg-hover)'; }}
      onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'transparent'; }}
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
  onPick,
  meta,
  badge,
}: {
  product: WasteProduct;
  onPick: () => void;
  meta?: string;
  badge?: { label: string; tone: 'warn' };
}) {
  return (
    <button
      type="button"
      onClick={onPick}
      style={{
        all: 'unset',
        cursor: 'pointer',
        padding: '12px 14px',
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        borderBottom: '1px solid var(--color-border-subtle)',
      }}
      onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'var(--color-bg-hover)'; }}
      onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'transparent'; }}
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
  );
}
