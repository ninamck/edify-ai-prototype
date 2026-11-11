'use client';

import { useRef, useState } from 'react';
import { CalendarClock, Clock, TriangleAlert } from 'lucide-react';
import s from './basket.module.css';
import { Badge, Button, Dialog, cx, useDismiss } from './ui';
import {
  cutOffUrgency, formatCutOffLabel, formatMoney, formatMoneyRounded, formatShortDate, formatSignedPercent,
  parseIsoDate, relativeDayName,
} from './format';
import { ProductSearch } from './ProductSearch';
import SupplierCard from './SupplierCard';
import SendPanel from './SendPanel';
import type { ActiveOrder, BasketState } from './useBasket';
import type { ForecastTile } from './types';

function BetaBadge() {
  const [open, setOpen] = useState(false);
  const ref = useDismiss(open, () => setOpen(false));
  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button type="button" className={s.beta} aria-expanded={open} onClick={() => setOpen((v) => !v)}>
        beta
      </button>
      {open && (
        <div className={s.popover} role="dialog" aria-label="About predictive ordering">
          <p className={s.popoverTitle}>Predictive ordering is in beta</p>
          <p className={s.popoverBody}>Suggestions cover the products this site orders most. Anything else, add it yourself.</p>
        </div>
      )}
    </div>
  );
}

function FirstCutOff({ orders, now }: { orders: ActiveOrder[]; now: Date }) {
  const passed = orders.find((o) => o.cutOffAt && cutOffUrgency(o.cutOffAt, now) === 'passed');
  if (passed) {
    return (
      <div className={s.cutOffLine}>
        <Badge tone="warn"><TriangleAlert size={12} aria-hidden /> {passed.supplierName} cut-off passed</Badge>
      </div>
    );
  }
  const upcoming = orders
    .filter((o): o is ActiveOrder & { cutOffAt: Date } => !!o.cutOffAt)
    .sort((a, b) => a.cutOffAt.getTime() - b.cutOffAt.getTime())[0];
  if (!upcoming) return null;
  const text = `First cut-off ${formatCutOffLabel(upcoming.cutOffAt, now)} · ${upcoming.supplierName}`;
  return (
    <div className={s.cutOffLine}>
      {cutOffUrgency(upcoming.cutOffAt, now) === 'urgent' ? (
        <Badge tone="warn"><Clock size={12} aria-hidden /> {text}</Badge>
      ) : (
        <><Clock size={13} aria-hidden /> {text}</>
      )}
    </div>
  );
}

function BasketHeader({ basket, now }: { basket: BasketState; now: Date }) {
  const { fixtures, mode } = basket;
  const today = parseIsoDate(fixtures.today);
  const weekday = today.toLocaleDateString('en-GB', { weekday: 'short' });
  return (
    <header className={s.header}>
      <div className={s.headerMain}>
        <div className={s.dateTile} aria-hidden>
          <span className={s.dateTileDay}>{weekday}</span>
          <span className={s.dateTileNum}>{today.getDate()}</span>
        </div>
        <div style={{ minWidth: 0 }}>
          <div className={s.titleRow}>
            <h1 className={s.title}>
              {mode === 'predictive' ? 'Predictive orders' : 'Your basket'}
              <span className={s.titleDate}> for {formatShortDate(fixtures.today)}</span>
            </h1>
            {mode === 'predictive' && <BetaBadge />}
          </div>
          {mode === 'predictive' && <FirstCutOff orders={basket.ordersWithLines} now={now} />}
        </div>
      </div>
      <div className={s.tabs} role="tablist" aria-label="Start from">
        <button
          type="button"
          role="tab"
          aria-selected={mode === 'predictive'}
          className={cx(s.tab, mode === 'predictive' && s.tabActive)}
          onClick={() => basket.switchMode('predictive')}
        >
          Predictive orders <span className={s.tabCount}>{basket.predictiveCount}</span>
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={mode === 'manual'}
          className={cx(s.tab, mode === 'manual' && s.tabActive)}
          onClick={() => basket.switchMode('manual')}
        >
          Order manually
        </button>
      </div>
    </header>
  );
}

function SalesForecastStrip({ tiles, today }: { tiles: ForecastTile[]; today: string }) {
  return (
    <ul className={s.strip} aria-label="Sales forecast">
      {tiles.map((tile, index) => {
        const name = relativeDayName(tile.date, today);
        const label = index === 0 ? `${name} · ${formatShortDate(tile.date)}` : name;
        return (
          <li key={tile.date} className={cx(s.tile, index === 0 && s.tileHero)}>
            <div className={s.tileLabel}>{label}</div>
            <div className={s.tileAmount}>{tile.amount === null ? 'No forecast' : formatMoneyRounded(tile.amount)}</div>
            <div className={s.tileChange}>
              {tile.stale
                ? 'May be out of date'
                : tile.change !== null && `${formatSignedPercent(tile.change)} vs last ${parseIsoDate(tile.date).toLocaleDateString('en-GB', { weekday: 'short' })}`}
            </div>
          </li>
        );
      })}
    </ul>
  );
}

function ManualSuppliers({ basket }: { basket: BasketState }) {
  const [browsing, setBrowsing] = useState<string | null>(null);
  const { fixtures } = basket;
  const supplier = fixtures.suppliers.find((sup) => sup.id === browsing);
  return (
    <section className={s.card} aria-labelledby="your-suppliers">
      <div style={{ padding: '14px 14px 0' }}>
        <h2 id="your-suppliers" className={s.sectionTitle}>Your suppliers</h2>
      </div>
      <table className={s.table}>
        <thead>
          <tr>
            <th scope="col">Supplier</th>
            <th scope="col" className={s.categoriesCol}>Categories</th>
            <th scope="col"><span className={s.srOnly}>Actions</span></th>
          </tr>
        </thead>
        <tbody>
          {fixtures.suppliers.map((sup) => (
            <tr key={sup.id}>
              <td className={s.supplierName}>{sup.name}</td>
              <td className={s.categoriesCol}>
                <span style={{ display: 'inline-flex', flexWrap: 'wrap', gap: 4 }}>
                  {sup.categories.map((c) => <Badge key={c}>{c}</Badge>)}
                </span>
              </td>
              <td className={s.right}>
                <Button size="sm" onClick={() => setBrowsing(browsing === sup.id ? null : sup.id)} aria-expanded={browsing === sup.id}>
                  View products
                </Button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {supplier && (
        <div className={s.cardSearch}>
          <ProductSearch
            title={`${supplier.name} products`}
            placeholder={`Search ${supplier.name}'s products`}
            products={fixtures.catalogue.filter((p) => p.supplierId === supplier.id)}
            suppliers={fixtures.suppliers}
            inBasket={basket.inBasket}
            onAdd={basket.addProduct}
            onClose={() => setBrowsing(null)}
            showAllWhenEmpty
          />
        </div>
      )}
    </section>
  );
}

export default function BasketView({ basket, now }: { basket: BasketState; now: Date }) {
  const { fixtures, mode, visibleOrders, ordersWithLines, basketTotal } = basket;
  const [confirmClear, setConfirmClear] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);
  const demand = fixtures.demandChange;
  const cards = visibleOrders.filter((o) => o.lines.length > 0);

  const continueShopping = () => {
    const input = searchRef.current?.querySelector('input');
    input?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    input?.focus({ preventScroll: true });
  };

  return (
    <>
      <div className={s.scroll}>
        <div className={s.page}>
          <BasketHeader basket={basket} now={now} />
          <div className={s.grid}>
            <div className={s.stack}>
              {mode === 'predictive' ? (
                <>
                  <SalesForecastStrip tiles={fixtures.forecast} today={fixtures.today} />
                  {demand && (
                    <p className={s.note}>
                      <CalendarClock size={16} aria-hidden />
                      <span>
                        Your orders allow for {demand.name} on {formatShortDate(demand.date)}, {demand.percent}% of a normal day.
                      </span>
                    </p>
                  )}
                </>
              ) : (
                <p className={cx(s.note, s.callout)}>
                  Your {basket.predictiveCount} predictive orders are saved. Switch back to Predictive orders any time today.
                </p>
              )}

              {cards.map((order) => (
                <SupplierCard key={order.id} order={order} basket={basket} now={now} />
              ))}

              <div ref={searchRef}>
                <ProductSearch
                  placeholder="Search every supplier's products"
                  label="Search every supplier's products"
                  products={fixtures.catalogue}
                  suppliers={fixtures.suppliers}
                  inBasket={basket.inBasket}
                  onAdd={basket.addProduct}
                />
              </div>

              {mode === 'manual' && <ManualSuppliers basket={basket} />}
            </div>
            <SendPanel orders={ordersWithLines} total={basketTotal} />
          </div>
        </div>
      </div>

      <div className={s.actionBar}>
        <div className={s.barInner}>
          <Button onClick={() => setConfirmClear(true)} disabled={ordersWithLines.length === 0}>Clear basket</Button>
          <div className={s.barRight}>
            <Button onClick={continueShopping}>Continue shopping</Button>
            <Button variant="primary" className={s.barPrimary} onClick={() => basket.setStep('checkout')} disabled={ordersWithLines.length === 0}>
              Checkout · {formatMoney(basketTotal)}
            </Button>
          </div>
        </div>
      </div>

      <Dialog open={confirmClear} onClose={() => setConfirmClear(false)} title="Clear basket?">
        <p className={s.dialogBody}>
          This sets today&apos;s suggested orders aside and removes everything you added. You can bring the suggestions back with Predictive orders, but not what you added.
        </p>
        <div className={s.dialogActions}>
          <Button onClick={() => setConfirmClear(false)}>Cancel</Button>
          <Button
            variant="primary"
            onClick={() => {
              basket.clearBasket();
              setConfirmClear(false);
            }}
          >
            Clear basket
          </Button>
        </div>
      </Dialog>
    </>
  );
}
