'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Link from 'next/link';
import { Package, ShoppingBag, TrendingUp, ArrowUpRight, ArrowDownRight, X, Clock, MapPin, Hash, Maximize2, ArrowRight, ChevronDown } from 'lucide-react';
import { createPortal } from 'react-dom';

// ── Collapsible widget (heading + dropdown body) ─────────────────────────────

function CollapsibleWidget({
  icon: Icon,
  title,
  children,
  fillWhenOpen,
  variant = 'sidebar',
}: {
  icon: React.ElementType;
  title: string;
  children: React.ReactNode;
  /** When true, expanded section grows to fill remaining column height (scroll inside). */
  fillWhenOpen: boolean;
  /** In `sheet`, body height is not capped so the full-screen overlay scrolls. */
  variant?: 'sidebar' | 'sheet';
}) {
  const [open, setOpen] = useState(false);

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      background: '#fff',
      borderRadius: '12px',
      border: '1px solid var(--color-border-subtle)',
      overflow: 'hidden',
      flex: open && fillWhenOpen ? 1 : 'none',
      minHeight: 0,
      flexShrink: 0,
    }}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '7px',
          width: '100%',
          padding: '11px 13px',
          border: 'none',
          borderBottom: open ? '1px solid var(--color-border-subtle)' : 'none',
          background: 'transparent',
          cursor: 'pointer',
          fontFamily: 'var(--font-primary)',
          textAlign: 'left',
        }}
      >
        <Icon size={12} color="var(--color-text-secondary)" strokeWidth={2} />
        <span style={{
          flex: 1,
          fontSize: '10.5px', fontWeight: 700,
          letterSpacing: '0.07em', textTransform: 'uppercase',
          color: 'var(--color-text-secondary)',
        }}>
          {title}
        </span>
        <motion.span
          animate={{ rotate: open ? 180 : 0 }}
          transition={{ duration: 0.2 }}
          style={{ display: 'flex', flexShrink: 0 }}
        >
          <ChevronDown size={14} color="var(--color-text-muted)" strokeWidth={2.2} />
        </motion.span>
      </button>
      {open && (
        <div style={{
          flex: fillWhenOpen ? 1 : undefined,
          minHeight: 0,
          maxHeight:
            variant === 'sheet'
              ? undefined
              : fillWhenOpen
                ? 'min(58vh, 480px)'
                : undefined,
          overflowY: variant === 'sheet' ? 'visible' : 'auto',
          overflowX: 'hidden',
        }}>
          {children}
        </div>
      )}
    </div>
  );
}

// ── 1. Wastage chart ──────────────────────────────────────────────────────────

const WASTAGE = [
  { day: 'M', value: 42 },
  { day: 'T', value: 28 },
  { day: 'W', value: 65 },
  { day: 'T', value: 31 },
  { day: 'F', value: 48 },
  { day: 'S', value: 19 },
  { day: 'S', value: 37, today: true },
];

const W_CHART_H = 72;
const W_BAR_W   = 18;
const W_GAP     = 8;
const W_MAX     = Math.max(...WASTAGE.map(d => d.value));
const W_TOTAL_W = WASTAGE.length * (W_BAR_W + W_GAP) - W_GAP;

function WastageChart() {
  const weekTotal = WASTAGE.reduce((s, d) => s + d.value, 0);
  const avg = Math.round(weekTotal / WASTAGE.length);
  const today = WASTAGE[WASTAGE.length - 1].value;
  const diff = today - avg;

  return (
    <div style={{ padding: '12px 13px' }}>

      {/* Summary row */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '14px' }}>
        <div>
          <div style={{ fontSize: '20px', fontWeight: 700, color: 'var(--color-text-primary)', lineHeight: 1 }}>
            £{today}
          </div>
          <div style={{ fontSize: '11px', color: 'var(--color-text-muted)', marginTop: '3px' }}>
            today&apos;s waste
          </div>
        </div>
        <div style={{
          display: 'flex', alignItems: 'center', gap: '3px',
          fontSize: '11px', fontWeight: 600,
          color: diff > 0 ? '#9B2226' : '#2D6A4F',
        }}>
          {diff > 0
            ? <ArrowUpRight size={13} />
            : <ArrowDownRight size={13} />}
          £{Math.abs(diff)} vs avg
        </div>
      </div>

      {/* Bars */}
      <svg
        width="100%"
        viewBox={`0 0 ${W_TOTAL_W} ${W_CHART_H + 16}`}
        style={{ overflow: 'visible', display: 'block' }}
      >
        {WASTAGE.map((d, i) => {
          const barH = Math.max(3, (d.value / W_MAX) * W_CHART_H);
          const x = i * (W_BAR_W + W_GAP);
          const y = W_CHART_H - barH;
          return (
            <g key={i}>
              <motion.rect
                x={x}
                width={W_BAR_W}
                rx={4}
                fill={d.today ? 'var(--color-accent-quinn)' : 'var(--color-bg-surface)'}
                initial={{ height: 0, y: W_CHART_H }}
                animate={{ height: barH, y }}
                transition={{ delay: i * 0.04, duration: 0.5, ease: [0.34, 1.2, 0.64, 1] }}
              />
              <text
                x={x + W_BAR_W / 2}
                y={W_CHART_H + 13}
                textAnchor="middle"
                fontSize="9"
                fill={d.today ? 'var(--color-text-primary)' : 'var(--color-text-muted)'}
                fontFamily="var(--font-primary)"
                fontWeight={d.today ? 700 : 400}
              >
                {d.day}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

// ── 2. Orders log ─────────────────────────────────────────────────────────────

interface OrderLine { name: string; qty: string; unit: string; price: string; }
interface Order {
  supplier: string; items: number; value: string; status: string;
  dot: string; ref: string; delivery: string; site: string;
  lines: OrderLine[];
}

const ORDERS: Order[] = [
  {
    supplier: 'Bidfood', items: 14, value: '£1,240', status: 'Confirmed',
    dot: '#2D6A4F', ref: 'PO-2847', delivery: 'Thu 28 Mar · 7–9am', site: 'Fitzroy Espresso',
    lines: [
      { name: 'Strong white flour 16kg', qty: '4', unit: 'bags', price: '£48.00' },
      { name: 'Unsalted butter 2kg', qty: '6', unit: 'blocks', price: '£54.00' },
      { name: 'Whole milk 6L', qty: '10', unit: 'bottles', price: '£38.00' },
      { name: 'Double cream 1L', qty: '8', unit: 'cartons', price: '£64.00' },
      { name: 'Free range eggs 15pk', qty: '12', unit: 'trays', price: '£96.00' },
    ],
  },
  {
    supplier: 'Fresh Direct', items: 8, value: '£640', status: 'In transit',
    dot: '#224444', ref: 'PO-2848', delivery: 'Today · 11am', site: 'Fitzroy Espresso',
    lines: [
      { name: 'Baby spinach 500g', qty: '6', unit: 'bags', price: '£21.00' },
      { name: 'Cherry tomatoes 500g', qty: '8', unit: 'punnets', price: '£28.00' },
      { name: 'Sourdough loaves', qty: '20', unit: 'loaves', price: '£120.00' },
      { name: 'Avocados', qty: '24', unit: 'each', price: '£48.00' },
    ],
  },
  {
    supplier: 'Metro', items: 5, value: '£380', status: 'Pending',
    dot: '#7A3800', ref: 'PO-2849', delivery: 'Fri 29 Mar · TBC', site: 'City Centre',
    lines: [
      { name: 'Espresso blend 1kg', qty: '10', unit: 'bags', price: '£180.00' },
      { name: 'Oat milk 1L', qty: '24', unit: 'cartons', price: '£96.00' },
      { name: 'Takeaway cups 12oz', qty: '2', unit: 'cases', price: '£56.00' },
    ],
  },
  {
    supplier: 'Urban Fresh', items: 3, value: '£180', status: 'Delivered',
    dot: '#2D6A4F', ref: 'PO-2844', delivery: 'Tue 26 Mar · 8am', site: 'Fitzroy Espresso',
    lines: [
      { name: 'Spinach 1kg (new SKU)', qty: '4', unit: 'bags', price: '£32.00' },
      { name: 'Rocket 200g', qty: '6', unit: 'bags', price: '£18.00' },
    ],
  },
];

const STATUS_COLOR: Record<string, string> = {
  'Confirmed': '#2D6A4F', 'In transit': '#224444',
  'Pending': '#7A3800', 'Delivered': '#2D6A4F',
};
const STATUS_BG: Record<string, string> = {
  'Confirmed': '#D8F3DC', 'In transit': '#E8F2F2',
  'Pending': '#FEF0DF', 'Delivered': '#D8F3DC',
};

// Shared inner content — used by both the widget detail and the modal
function OrderDetailContent({ order, onClose, expanded, onExpand }: {
  order: Order;
  onClose: () => void;
  expanded: boolean;
  onExpand: () => void;
}) {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column',
      flex: 1, minHeight: 0, height: '100%',
      overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: '8px',
        padding: expanded ? '16px 20px' : '11px 13px',
        borderBottom: '1px solid var(--color-border-subtle)',
        flexShrink: 0,
      }}>
        <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: order.dot, flexShrink: 0 }} />
        <span style={{ flex: 1, fontSize: expanded ? '15px' : '13px', fontWeight: 700, color: 'var(--color-text-primary)' }}>
          {order.supplier}
        </span>
        <span style={{
          fontSize: '10.5px', fontWeight: 600,
          color: STATUS_COLOR[order.status], background: STATUS_BG[order.status],
          borderRadius: '6px', padding: '2px 8px',
        }}>
          {order.status}
        </span>
        {/* Expand — only in widget overlay; hidden in modal */}
        {!expanded && (
          <button
            onClick={onExpand}
            title="Expand"
            type="button"
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              width: '22px', height: '22px', borderRadius: '6px',
              background: 'var(--color-bg-surface)', border: 'none', cursor: 'pointer', flexShrink: 0,
            }}
          >
            <Maximize2 size={11} color="var(--color-text-muted)" />
          </button>
        )}
        <button
          onClick={onClose}
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            width: '22px', height: '22px', borderRadius: '6px',
            background: 'var(--color-bg-surface)', border: 'none', cursor: 'pointer', flexShrink: 0,
          }}
        >
          <X size={12} color="var(--color-text-muted)" />
        </button>
      </div>

      {/* Meta + line items — all scrollable */}
      <div style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
        {/* Meta */}
        <div style={{
          display: 'flex', flexDirection: 'column', gap: '6px',
          padding: expanded ? '14px 20px' : '11px 13px',
          borderBottom: '1px solid var(--color-border-subtle)',
        }}>
          {[
            { icon: Hash,    text: order.ref },
            { icon: Clock,   text: order.delivery },
            { icon: MapPin,  text: order.site },
          ].map(({ icon: Icon, text }, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Icon size={11} color="var(--color-text-muted)" strokeWidth={2} />
              <span style={{ fontSize: expanded ? '13px' : '11.5px', color: 'var(--color-text-secondary)' }}>{text}</span>
            </div>
          ))}
        </div>

        {/* Line items */}
        {order.lines.map((line, i) => (
          <div key={i} style={{
            display: 'flex', alignItems: 'center', gap: '8px',
            padding: expanded ? '12px 20px' : '9px 13px',
            borderBottom: i < order.lines.length - 1 ? '1px solid var(--color-border-subtle)' : 'none',
          }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: expanded ? '13.5px' : '12px', fontWeight: 600, color: 'var(--color-text-primary)' }}>
                {line.name}
              </div>
              <div style={{ fontSize: '11px', color: 'var(--color-text-muted)', marginTop: '1px' }}>
                {line.qty} {line.unit}
              </div>
            </div>
            <span style={{ fontSize: expanded ? '13px' : '12px', fontWeight: 700, color: 'var(--color-text-primary)', flexShrink: 0 }}>
              {line.price}
            </span>
          </div>
        ))}
      </div> {/* end scrollable */}

      {/* Total */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: expanded ? '14px 20px' : '11px 13px',
        borderTop: '1px solid var(--color-border-subtle)',
        flexShrink: 0,
      }}>
        <span style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>{order.items} items</span>
        <span style={{ fontSize: expanded ? '16px' : '14px', fontWeight: 700, color: 'var(--color-text-primary)' }}>
          {order.value}
        </span>
      </div>

      {/* Modal only — full order page */}
      {expanded && (
        <div style={{ padding: '0 20px 18px', flexShrink: 0 }}>
          <Link
            href={`/orders?ref=${encodeURIComponent(order.ref)}`}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
              width: '100%',
              padding: '11px 16px',
              borderRadius: '10px',
              background: 'var(--color-accent-deep)',
              color: '#F4F1EC',
              fontSize: '13px',
              fontWeight: 600,
              textDecoration: 'none',
              fontFamily: 'var(--font-primary)',
            }}
          >
            Go to order
            <ArrowRight size={15} strokeWidth={2.2} />
          </Link>
        </div>
      )}
    </div>
  );
}

function OrderModal({ order, onClose }: { order: Order; onClose: () => void }) {
  return createPortal(
    <AnimatePresence>
      <motion.div
        key="backdrop"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.18 }}
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0,
          background: 'rgba(34,68,68,0.35)',
          backdropFilter: 'blur(4px)',
          zIndex: 1000,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: '24px',
        }}
      >
        <motion.div
          key="modal"
          initial={{ opacity: 0, scale: 0.95, y: 16 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 16 }}
          transition={{ duration: 0.22, ease: [0.34, 1.1, 0.64, 1] }}
          onClick={e => e.stopPropagation()}
          style={{
            width: 'min(480px, calc(100vw - 48px))',
            maxHeight: 'min(80vh, 720px)',
            background: '#fff',
            borderRadius: '16px',
            boxShadow: '0 24px 60px rgba(34,68,68,0.2)',
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <OrderDetailContent order={order} onClose={onClose} expanded={true} onExpand={onClose} />
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>,
    document.body,
  );
}

function OrderDetail({ order, onClose }: { order: Order; onClose: () => void }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 8 }}
        transition={{ duration: 0.2, ease: 'easeOut' }}
        style={{
          position: 'absolute', inset: 0,
          background: 'var(--color-bg-nav)',
          zIndex: 10, borderRadius: '12px', overflow: 'hidden',
          display: 'flex', flexDirection: 'column',
        }}
      >
        <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <OrderDetailContent
            order={order}
            onClose={onClose}
            expanded={false}
            onExpand={() => setExpanded(true)}
          />
        </div>
      </motion.div>

      {/* Full-screen modal */}
      {expanded && <OrderModal order={order} onClose={() => setExpanded(false)} />}
    </>
  );
}

function OrdersLog() {
  const [selected, setSelected] = useState<Order | null>(null);

  return (
    <div style={{ position: 'relative', flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
      {/* List */}
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        {ORDERS.map((o, i) => (
          <motion.button
            key={i}
            initial={{ opacity: 0, x: 6 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.15 + i * 0.05, duration: 0.22, ease: 'easeOut' }}
            onClick={() => setSelected(o)}
            style={{
              display: 'flex', alignItems: 'center', gap: '9px',
              padding: '9px 13px',
              borderBottom: i < ORDERS.length - 1 ? '1px solid var(--color-border-subtle)' : 'none',
              background: 'none', border: 'none', cursor: 'pointer',
              textAlign: 'left', fontFamily: 'var(--font-primary)',
              transition: 'background 0.1s ease',
            }}
            whileHover={{ backgroundColor: 'var(--color-bg-surface)' }}
          >
            <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: o.dot, flexShrink: 0 }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: '12.5px', fontWeight: 600, color: 'var(--color-text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {o.supplier}
              </div>
              <div style={{ fontSize: '11px', color: 'var(--color-text-muted)', marginTop: '1px' }}>
                {o.items} items · {o.status}
              </div>
            </div>
            <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--color-text-primary)', flexShrink: 0 }}>
              {o.value}
            </span>
          </motion.button>
        ))}
      </div>

      {/* Detail overlay — covers list */}
      <AnimatePresence>
        {selected && (
          <OrderDetail order={selected} onClose={() => setSelected(null)} />
        )}
      </AnimatePresence>
    </div>
  );
}

// ── 3. Sales log ──────────────────────────────────────────────────────────────

const SALES = [
  { period: 'Morning rush',  time: '6–9am',   value: 1240, pct: 100 },
  { period: 'Mid-morning',   time: '9am–12',  value: 880,  pct: 71  },
  { period: 'Lunch',         time: '12–2pm',  value: 1420, pct: 100 },
  { period: 'Afternoon',     time: '2–5pm',   value: 640,  pct: 52  },
  { period: 'Evening',       time: '5–8pm',   value: 320,  pct: 26, muted: true },
];

const SALES_TOTAL = SALES.filter(s => !s.muted).reduce((a, s) => a + s.value, 0);
const SALES_MAX   = Math.max(...SALES.map(s => s.value));

function SalesLog() {
  return (
    <div>
      {/* Running total */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: '10px 13px',
        borderBottom: '1px solid var(--color-border-subtle)',
      }}>
        <span style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>Running total</span>
        <span style={{ fontSize: '16px', fontWeight: 700, color: 'var(--color-text-primary)' }}>
          £{SALES_TOTAL.toLocaleString()}
        </span>
      </div>

      {/* Periods */}
      {SALES.map((s, i) => (
        <motion.div
          key={i}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 + i * 0.06, duration: 0.25 }}
          style={{
            padding: '8px 13px',
            borderBottom: i < SALES.length - 1 ? '1px solid var(--color-border-subtle)' : 'none',
            opacity: s.muted ? 0.45 : 1,
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}>
            <span style={{ fontSize: '11.5px', color: 'var(--color-text-secondary)' }}>
              {s.period}
              <span style={{ color: 'var(--color-text-muted)', marginLeft: '5px' }}>{s.time}</span>
            </span>
            <span style={{ fontSize: '11.5px', fontWeight: 700, color: 'var(--color-text-primary)' }}>
              £{s.value.toLocaleString()}
            </span>
          </div>
          {/* Progress bar */}
          <div style={{
            height: '3px', borderRadius: '100px',
            background: 'var(--color-bg-surface)', overflow: 'hidden',
          }}>
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${(s.value / SALES_MAX) * 100}%` }}
              transition={{ delay: 0.25 + i * 0.06, duration: 0.5, ease: 'easeOut' }}
              style={{
                height: '100%', borderRadius: '100px',
                background: s.muted ? 'var(--color-border)' : 'var(--color-accent-deep)',
              }}
            />
          </div>
        </motion.div>
      ))}
    </div>
  );
}

// ── RightPanel ────────────────────────────────────────────────────────────────

export default function RightPanel({ layout = 'sidebar' }: { layout?: 'sidebar' | 'sheet' }) {
  const isSheet = layout === 'sheet';

  return (
    <div style={{
      width: isSheet ? '100%' : '252px',
      minWidth: isSheet ? 0 : '252px',
      maxWidth: isSheet ? '100%' : undefined,
      height: isSheet ? 'auto' : '100%',
      minHeight: 0,
      display: 'flex',
      flexDirection: 'column',
      gap: '8px',
      flexShrink: 0,
    }}>
      <CollapsibleWidget icon={TrendingUp} title="Wastage — this week" fillWhenOpen={false} variant={isSheet ? 'sheet' : 'sidebar'}>
        <WastageChart />
      </CollapsibleWidget>

      <CollapsibleWidget icon={Package} title="Orders" fillWhenOpen={true} variant={isSheet ? 'sheet' : 'sidebar'}>
        <OrdersLog />
      </CollapsibleWidget>

      <CollapsibleWidget icon={ShoppingBag} title="Sales today" fillWhenOpen={true} variant={isSheet ? 'sheet' : 'sidebar'}>
        <SalesLog />
      </CollapsibleWidget>
    </div>
  );
}
