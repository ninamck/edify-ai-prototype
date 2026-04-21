'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { AnimatePresence, motion } from 'framer-motion';
import {
  ArrowLeft, Search, Check, ChevronRight, Sparkles, X, CheckCircle2,
  AlertTriangle, Info,
} from 'lucide-react';
import QuinnOrb from '@/components/Sidebar/QuinnOrb';
import {
  FITZROY_POS_INTAKE, matchStatusLabel, matchStatusVariant,
  POSPattern, MenuItemDraft, MatchStatus,
} from '@/components/Recipe/intakeFixtures';

type CategoryFilter = 'All' | MenuItemDraft['category'];

const CATEGORY_ORDER: CategoryFilter[] = [
  'All', 'Coffee', 'Tea', 'Pastry', 'Food', 'Wine', 'Spirits', 'Kids',
];

export default function POSIntakePage() {
  const router = useRouter();
  const data = FITZROY_POS_INTAKE;

  const [acceptedPatterns, setAcceptedPatterns] = useState<Set<string>>(new Set());
  const [viewingPattern, setViewingPattern] = useState<POSPattern | null>(null);

  const [selectedIds, setSelectedIds] = useState<Set<string>>(
    new Set(data.menuItems.map((m) => m.id))
  );
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>('All');

  const filteredItems = useMemo(() => {
    let list = data.menuItems;
    if (categoryFilter !== 'All') list = list.filter((m) => m.category === categoryFilter);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((m) => m.name.toLowerCase().includes(q));
    }
    return list;
  }, [data.menuItems, search, categoryFilter]);

  const toggleOne = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const acceptPattern = (id: string) => {
    setAcceptedPatterns((prev) => {
      const next = new Set(prev);
      next.add(id);
      return next;
    });
  };

  const selectedCount = selectedIds.size;
  const totalShown = filteredItems.length;

  return (
    <div style={{ padding: '20px 24px 110px', maxWidth: '960px', margin: '0 auto' }}>

      {/* Back link */}
      <button
        onClick={() => router.push('/recipes/intake')}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '6px',
          background: 'transparent',
          border: 'none',
          color: 'var(--color-text-muted)',
          fontSize: '13px',
          fontWeight: 600,
          fontFamily: 'var(--font-primary)',
          cursor: 'pointer',
          padding: '6px 0',
          marginBottom: '14px',
        }}
      >
        <ArrowLeft size={14} strokeWidth={2} />
        Back to Add recipes
      </button>

      {/* Header / summary */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '14px', marginBottom: '20px' }}>
        <QuinnOrb state="ready" size={38} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <h1 style={{ fontSize: '22px', fontWeight: 700, margin: '0 0 4px', color: 'var(--color-text-primary)' }}>
            From your POS — {data.source}
          </h1>
          <p style={{ fontSize: '13.5px', color: 'var(--color-text-muted)', lineHeight: 1.5, margin: 0 }}>
            I pulled <Strong>{data.menuItemsTotal} menu items</Strong> from {data.source}.
            {' '}<Strong>{data.menuItemsWithModifiers}</Strong> have modifiers,
            {' '}<Strong>{data.menuItemsWithSalesData}</Strong> have 30 days of sales.
            Review the patterns I noticed and I’ll draft the rest.
          </p>
        </div>
      </div>

      {/* Patterns block */}
      <section style={{ marginBottom: '28px' }}>
        <SectionHeader
          label="Patterns Quinn noticed"
          hint="Accepting a pattern creates a shared modifier group and attaches it to every matching menu item in one go."
        />

        <div
          style={{
            border: '1px solid var(--color-border-subtle)',
            borderRadius: '14px',
            overflow: 'hidden',
            background: '#fff',
          }}
        >
          {data.patterns.map((p, i) => (
            <PatternRow
              key={p.id}
              pattern={p}
              accepted={acceptedPatterns.has(p.id)}
              isLast={i === data.patterns.length - 1}
              onAccept={() => acceptPattern(p.id)}
              onReview={() => setViewingPattern(p)}
            />
          ))}
        </div>
      </section>

      {/* Recipes to draft block */}
      <section>
        <SectionHeader
          label="Recipes to draft"
          hint={`${data.menuItems.length} shown \u00b7 ${data.additionalItemsCount} more pulled from ${data.source}.`}
        />

        <div
          style={{
            border: '1px solid var(--color-border-subtle)',
            borderRadius: '14px',
            background: '#fff',
            overflow: 'hidden',
          }}
        >
          {/* Toolbar */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              padding: '12px 14px',
              borderBottom: '1px solid var(--color-border-subtle)',
              flexWrap: 'wrap',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '6px 10px',
                borderRadius: '8px',
                background: 'var(--color-bg-hover)',
                flex: 1,
                minWidth: '200px',
              }}
            >
              <Search size={14} color="var(--color-text-muted)" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search menu items"
                style={{
                  border: 'none',
                  outline: 'none',
                  background: 'transparent',
                  fontSize: '13px',
                  fontFamily: 'var(--font-primary)',
                  color: 'var(--color-text-primary)',
                  flex: 1,
                  minWidth: 0,
                }}
              />
            </div>
            <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
              {CATEGORY_ORDER.map((cat) => {
                const active = categoryFilter === cat;
                return (
                  <button
                    key={cat}
                    onClick={() => setCategoryFilter(cat)}
                    style={{
                      padding: '5px 11px',
                      borderRadius: '100px',
                      border: active ? '1px solid transparent' : '1px solid var(--color-border-subtle)',
                      background: active ? 'var(--color-accent-active)' : '#fff',
                      color: active ? '#fff' : 'var(--color-text-secondary)',
                      fontSize: '11.5px',
                      fontWeight: 600,
                      fontFamily: 'var(--font-primary)',
                      cursor: 'pointer',
                      transition: 'all 0.15s',
                    }}
                  >
                    {cat}
                  </button>
                );
              })}
            </div>
          </div>

          {/* List header */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '32px 1fr 90px 1fr 1fr',
              gap: '14px',
              padding: '10px 14px',
              borderBottom: '1px solid var(--color-border-subtle)',
              background: '#FBFAF8',
              fontSize: '11px',
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
              color: 'var(--color-text-muted)',
            }}
          >
            <span />
            <span>Menu item</span>
            <span>Category</span>
            <span>Status</span>
            <span>Modifiers</span>
          </div>

          {/* Rows */}
          {filteredItems.length === 0 && (
            <div style={{ padding: '28px 14px', textAlign: 'center', color: 'var(--color-text-muted)', fontSize: '13px' }}>
              No menu items match.
            </div>
          )}
          {filteredItems.map((item) => (
            <MenuItemRow
              key={item.id}
              item={item}
              selected={selectedIds.has(item.id)}
              onToggle={() => toggleOne(item.id)}
            />
          ))}

          {data.additionalItemsCount > 0 && (
            <div
              style={{
                padding: '12px 14px',
                fontSize: '12.5px',
                color: 'var(--color-text-muted)',
                background: '#FBFAF8',
                borderTop: '1px solid var(--color-border-subtle)',
              }}
            >
              + {data.additionalItemsCount} more menu items pulled from {data.source}
              {' \u2014 '}shown in batch review.
            </div>
          )}
        </div>
      </section>

      {/* Sticky action bar */}
      <div
        style={{
          position: 'fixed',
          left: 0,
          right: 0,
          bottom: 0,
          padding: '14px 150px 14px 220px',
          background: 'rgba(255,255,255,0.96)',
          borderTop: '1px solid var(--color-border-subtle)',
          backdropFilter: 'blur(8px)',
          WebkitBackdropFilter: 'blur(8px)',
          display: 'flex',
          justifyContent: 'center',
          zIndex: 150,
        }}
      >
        <div style={{ maxWidth: '960px', width: '100%', display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ flex: 1, fontSize: '13px', color: 'var(--color-text-secondary)' }}>
            <Strong>{selectedCount}</Strong> of {totalShown} selected
            {acceptedPatterns.size > 0 && (
              <span style={{ marginLeft: '12px', color: 'var(--color-success)', fontWeight: 600 }}>
                · {acceptedPatterns.size} pattern{acceptedPatterns.size === 1 ? '' : 's'} accepted
              </span>
            )}
          </div>
          <button
            onClick={() => alert('Review-one-by-one (Screen A4) \u2014 next slice.')}
            style={{
              padding: '10px 16px',
              borderRadius: '10px',
              border: '1px solid var(--color-border)',
              background: '#fff',
              fontSize: '13px',
              fontWeight: 600,
              fontFamily: 'var(--font-primary)',
              color: 'var(--color-text-primary)',
              cursor: 'pointer',
            }}
          >
            Review one by one
          </button>
          <button
            onClick={() => router.push(`/recipes/intake/pos/run?n=${selectedCount}&groups=${acceptedPatterns.size}`)}
            disabled={selectedCount === 0}
            style={{
              padding: '10px 18px',
              borderRadius: '10px',
              border: 'none',
              background: 'var(--color-accent-active)',
              fontSize: '13px',
              fontWeight: 600,
              fontFamily: 'var(--font-primary)',
              color: '#fff',
              cursor: selectedCount === 0 ? 'not-allowed' : 'pointer',
              opacity: selectedCount === 0 ? 0.5 : 1,
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
            }}
          >
            <Sparkles size={14} strokeWidth={2} />
            Draft {selectedCount} with Quinn
          </button>
        </div>
      </div>

      {/* Pattern confirmation modal (A3) */}
      <AnimatePresence>
        {viewingPattern && (
          <PatternConfirmModal
            pattern={viewingPattern}
            accepted={acceptedPatterns.has(viewingPattern.id)}
            onClose={() => setViewingPattern(null)}
            onAccept={() => {
              acceptPattern(viewingPattern.id);
              setViewingPattern(null);
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────────

function Strong({ children }: { children: React.ReactNode }) {
  return <strong style={{ fontWeight: 700, color: 'var(--color-text-primary)' }}>{children}</strong>;
}

function SectionHeader({ label, hint }: { label: string; hint?: string }) {
  return (
    <div style={{ marginBottom: '10px' }}>
      <h2 style={{ fontSize: '14.5px', fontWeight: 700, margin: '0 0 3px', color: 'var(--color-text-primary)' }}>
        {label}
      </h2>
      {hint && (
        <p style={{ fontSize: '12.5px', color: 'var(--color-text-muted)', margin: 0, lineHeight: 1.45 }}>
          {hint}
        </p>
      )}
    </div>
  );
}

function PatternRow({
  pattern, accepted, isLast, onAccept, onReview,
}: {
  pattern: POSPattern; accepted: boolean; isLast: boolean;
  onAccept: () => void; onReview: () => void;
}) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: '14px',
        padding: '14px 16px',
        borderBottom: isLast ? 'none' : '1px solid var(--color-border-subtle)',
      }}
    >
      <div
        style={{
          width: '32px',
          height: '32px',
          borderRadius: '8px',
          background: accepted ? 'var(--color-success-light)' : 'rgba(3,28,89,0.08)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        {accepted
          ? <CheckCircle2 size={18} color="var(--color-success)" strokeWidth={2} />
          : <Sparkles size={16} color="var(--color-accent-active)" strokeWidth={2} />
        }
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '2px' }}>
          <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--color-text-primary)' }}>
            {pattern.name}
          </span>
          <span
            style={{
              padding: '1px 7px',
              borderRadius: '6px',
              background: 'var(--color-bg-hover)',
              color: 'var(--color-text-secondary)',
              fontSize: '10.5px',
              fontWeight: 600,
              letterSpacing: '0.03em',
            }}
          >
            {pattern.type}
          </span>
          <span style={{ fontSize: '12.5px', color: 'var(--color-text-muted)' }}>
            · on {pattern.usedOnCount} menu item{pattern.usedOnCount === 1 ? '' : 's'}
          </span>
        </div>
        <div style={{ fontSize: '12.5px', color: 'var(--color-text-muted)', lineHeight: 1.45 }}>
          {pattern.options.map((o) => o.label).join(' \u00b7 ')}
          {pattern.substitutes && ` \u2014 replaces ${pattern.substitutes}`}
        </div>
      </div>
      {accepted ? (
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            padding: '6px 10px',
            fontSize: '12px',
            fontWeight: 600,
            color: 'var(--color-success)',
            flexShrink: 0,
          }}
        >
          <Check size={14} strokeWidth={2.5} />
          Created and attached
        </span>
      ) : (
        <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
          <button
            onClick={onReview}
            style={{
              padding: '6px 12px',
              borderRadius: '8px',
              border: '1px solid var(--color-border)',
              background: '#fff',
              fontSize: '12px',
              fontWeight: 600,
              color: 'var(--color-text-secondary)',
              cursor: 'pointer',
              fontFamily: 'var(--font-primary)',
            }}
          >
            Review
          </button>
          <button
            onClick={onAccept}
            style={{
              padding: '6px 12px',
              borderRadius: '8px',
              border: 'none',
              background: 'var(--color-accent-active)',
              fontSize: '12px',
              fontWeight: 600,
              color: '#fff',
              cursor: 'pointer',
              fontFamily: 'var(--font-primary)',
            }}
          >
            Yes
          </button>
        </div>
      )}
    </div>
  );
}

function MenuItemRow({
  item, selected, onToggle,
}: {
  item: MenuItemDraft; selected: boolean; onToggle: () => void;
}) {
  const variant = matchStatusVariant(item.matchStatus);
  return (
    <label
      style={{
        display: 'grid',
        gridTemplateColumns: '32px 1fr 90px 1fr 1fr',
        gap: '14px',
        alignItems: 'center',
        padding: '11px 14px',
        borderBottom: '1px solid var(--color-border-subtle)',
        cursor: 'pointer',
        background: selected ? '#fff' : 'rgba(0,0,0,0.015)',
      }}
      onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--color-bg-hover)'; }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = selected ? '#fff' : 'rgba(0,0,0,0.015)';
      }}
    >
      <Checkbox checked={selected} onChange={onToggle} />
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: '13.5px', fontWeight: 600, color: 'var(--color-text-primary)' }}>
          {item.name}
        </div>
        {item.note && (
          <div
            style={{
              fontSize: '11.5px',
              color: 'var(--color-warning)',
              marginTop: '3px',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
            }}
          >
            <Info size={11} />
            {item.note}
          </div>
        )}
      </div>
      <span style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>{item.category}</span>
      <span>
        <StatusPill status={item.matchStatus} label={matchStatusLabel(item.matchStatus, item.ingredientCount)} variant={variant} />
      </span>
      <span style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
        {(item.modifierGroups ?? []).map((g) => (
          <span
            key={g}
            style={{
              padding: '2px 7px',
              borderRadius: '6px',
              background: 'var(--color-bg-hover)',
              color: 'var(--color-text-secondary)',
              fontSize: '11px',
              fontWeight: 600,
            }}
          >
            {g}
          </span>
        ))}
        {(!item.modifierGroups || item.modifierGroups.length === 0) && (
          <span style={{ fontSize: '11.5px', color: 'var(--color-text-muted)' }}>—</span>
        )}
      </span>
    </label>
  );
}

function Checkbox({ checked, onChange }: { checked: boolean; onChange: () => void }) {
  return (
    <span
      onClick={(e) => { e.preventDefault(); onChange(); }}
      style={{
        width: '18px',
        height: '18px',
        borderRadius: '5px',
        border: '1.5px solid ' + (checked ? 'var(--color-accent-active)' : 'var(--color-border)'),
        background: checked ? 'var(--color-accent-active)' : '#fff',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
        transition: 'all 0.12s',
      }}
    >
      {checked && <Check size={12} color="#fff" strokeWidth={3} />}
    </span>
  );
}

function StatusPill({
  status, label, variant,
}: {
  status: MatchStatus; label: string; variant: 'success' | 'warning' | 'default';
}) {
  const bg =
    variant === 'success' ? 'var(--color-success-light)' :
    variant === 'warning' ? 'var(--color-warning-light)' :
    'var(--color-bg-hover)';
  const color =
    variant === 'success' ? 'var(--color-success)' :
    variant === 'warning' ? 'var(--color-warning)' :
    'var(--color-text-secondary)';
  const Icon = variant === 'success' ? Check : variant === 'warning' ? AlertTriangle : null;
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '5px',
        padding: '3px 9px',
        borderRadius: '100px',
        background: bg,
        color,
        fontSize: '11.5px',
        fontWeight: 600,
        whiteSpace: 'nowrap',
      }}
      data-status={status}
    >
      {Icon && <Icon size={11} strokeWidth={2.4} />}
      {label}
    </span>
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// A3: Pattern confirmation modal

function PatternConfirmModal({
  pattern, accepted, onClose, onAccept,
}: {
  pattern: POSPattern; accepted: boolean;
  onClose: () => void; onAccept: () => void;
}) {
  const [groupName, setGroupName] = useState(pattern.name);

  return (
    <>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.15 }}
        onClick={onClose}
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(3,15,58,0.22)',
          backdropFilter: 'blur(3px)',
          zIndex: 400,
        }}
      />
      <div
        style={{
          position: 'fixed',
          inset: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '40px 20px',
          zIndex: 401,
          pointerEvents: 'none',
        }}
      >
      <motion.div
        initial={{ opacity: 0, y: 10, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 10, scale: 0.98 }}
        transition={{ duration: 0.18, ease: 'easeOut' }}
        role="dialog"
        aria-label={`Review pattern ${pattern.name}`}
        style={{
          pointerEvents: 'auto',
          width: 'min(560px, 100%)',
          maxHeight: '100%',
          background: '#fff',
          borderRadius: '16px',
          boxShadow: '0 24px 60px rgba(3,15,58,0.22), 0 0 0 1px rgba(3,15,58,0.04)',
          overflow: 'auto',
          fontFamily: 'var(--font-primary)',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            padding: '16px 18px',
            borderBottom: '1px solid var(--color-border-subtle)',
          }}
        >
          <Sparkles size={18} color="var(--color-accent-active)" strokeWidth={2} />
          <h3 style={{ fontSize: '15px', fontWeight: 700, margin: 0, flex: 1, color: 'var(--color-text-primary)' }}>
            New shared group: {pattern.name}
          </h3>
          <button
            onClick={onClose}
            aria-label="Close"
            style={{
              width: '28px',
              height: '28px',
              border: 'none',
              background: 'transparent',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: '6px',
              color: 'var(--color-text-muted)',
            }}
          >
            <X size={16} />
          </button>
        </div>

        <div style={{ padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: '18px' }}>
          <section>
            <Label>Found as modifier on {pattern.usedOnCount} menu items</Label>
            <div style={{ fontSize: '12.5px', color: 'var(--color-text-secondary)', lineHeight: 1.55 }}>
              {pattern.affectedItems.slice(0, 8).join(' \u00b7 ')}
              {pattern.affectedItems.length > 8 && (
                <> · <span style={{ color: 'var(--color-text-muted)' }}>+{pattern.affectedItems.length - 8} more</span></>
              )}
            </div>
          </section>

          <section>
            <Label>Options from POS</Label>
            <div
              style={{
                border: '1px solid var(--color-border-subtle)',
                borderRadius: '10px',
                overflow: 'hidden',
              }}
            >
              {pattern.options.map((opt, i) => (
                <div
                  key={opt.label}
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '10px',
                    padding: '10px 12px',
                    borderBottom: i < pattern.options.length - 1 ? '1px solid var(--color-border-subtle)' : 'none',
                  }}
                >
                  <span
                    style={{
                      fontSize: '12.5px',
                      fontWeight: 600,
                      color: 'var(--color-text-primary)',
                      minWidth: '90px',
                    }}
                  >
                    {opt.label}
                  </span>
                  <ChevronRight size={14} color="var(--color-text-muted)" style={{ marginTop: '2px', flexShrink: 0 }} />
                  <span style={{ fontSize: '12.5px', color: 'var(--color-text-secondary)', lineHeight: 1.5 }}>
                    {opt.rule}
                  </span>
                </div>
              ))}
            </div>
          </section>

          <section>
            <Label>Group name</Label>
            <input
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
              style={{
                width: '100%',
                padding: '9px 11px',
                borderRadius: '8px',
                border: '1px solid var(--color-border)',
                fontSize: '13px',
                fontFamily: 'var(--font-primary)',
                outline: 'none',
                color: 'var(--color-text-primary)',
                background: '#fff',
              }}
            />
          </section>

          <div style={{ display: 'flex', gap: '10px', paddingTop: '4px' }}>
            <button
              onClick={onClose}
              style={{
                flex: 1,
                padding: '10px 14px',
                borderRadius: '10px',
                border: '1px solid var(--color-border)',
                background: '#fff',
                fontSize: '13px',
                fontWeight: 600,
                color: 'var(--color-text-primary)',
                fontFamily: 'var(--font-primary)',
                cursor: 'pointer',
              }}
            >
              Cancel
            </button>
            <button
              onClick={onAccept}
              disabled={accepted}
              style={{
                flex: 2,
                padding: '10px 14px',
                borderRadius: '10px',
                border: 'none',
                background: accepted ? 'var(--color-success)' : 'var(--color-accent-active)',
                fontSize: '13px',
                fontWeight: 600,
                color: '#fff',
                fontFamily: 'var(--font-primary)',
                cursor: accepted ? 'default' : 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '7px',
              }}
            >
              {accepted ? (
                <>
                  <Check size={14} strokeWidth={2.5} /> Created and attached
                </>
              ) : (
                <>Create and attach to all {pattern.usedOnCount}</>
              )}
            </button>
          </div>
        </div>
      </motion.div>
      </div>
    </>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        fontSize: '11px',
        fontWeight: 700,
        letterSpacing: '0.08em',
        textTransform: 'uppercase',
        color: 'var(--color-text-muted)',
        marginBottom: '6px',
      }}
    >
      {children}
    </div>
  );
}
