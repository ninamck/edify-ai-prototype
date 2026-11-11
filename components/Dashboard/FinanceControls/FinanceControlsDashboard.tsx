'use client';

import { useMemo, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { CalendarClock, Download } from 'lucide-react';
import {
  Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import s from './finance.module.css';
import {
  ACCRUALS, APPROVAL_STATS, AS_AT, AUDIT_LOG, CHANGE_LABELS, COMPANY, MONTH_END,
  PERIOD_LABEL, PRICE_ALERTS, PRICE_TOLERANCE_PCT, REOPENS_BY_SITE, REVIEWED_ORDERS, SITE_COUNT,
  accrualTotal, overContract, variancePct,
  type AlertStatus, type AuditEntry, type ChangeType, type PriceAlert, type ReviewOutcome,
} from './data';

const TICK = { fontSize: 11, fontFamily: 'var(--font-primary)', fill: 'var(--color-text-muted)' } as const;
const TOOLTIP = {
  background: '#fff',
  border: '1px solid var(--color-border-subtle)',
  borderRadius: 8,
  fontFamily: 'var(--font-primary)',
  fontSize: 12,
};

const COBALT = '#4a6cb5';
const COBALT_LIGHT = '#a3b5db';
const AMBER = '#ffc060';

function money(value: number, decimals: 0 | 2 = 0): string {
  return `£ ${value.toLocaleString('en-GB', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}`;
}

function cx(...names: (string | false | undefined)[]) {
  return names.filter(Boolean).join(' ');
}

function Kpi({ label, value, hint, warn }: { label: string; value: string; hint?: string; warn?: boolean }) {
  return (
    <div className={cx(s.kpi, warn && s.kpiWarn)}>
      <span className={s.kpiLabel}>{label}</span>
      <span className={s.kpiValue}>{value}</span>
      {hint && <span className={s.kpiHint}>{hint}</span>}
    </div>
  );
}

function Card({ title, sub, action, children }: { title: string; sub?: string; action?: ReactNode; children: ReactNode }) {
  return (
    <div className={s.card}>
      <div className={s.cardHead}>
        <div>
          <h3 className={s.cardTitle}>{title}</h3>
          {sub && <p className={s.cardSub}>{sub}</p>}
        </div>
        {action}
      </div>
      {children}
    </div>
  );
}

function Legend({ items }: { items: { label: string; colour: string }[] }) {
  return (
    <ul className={s.legend}>
      {items.map((item) => (
        <li key={item.label} className={s.legendItem}>
          <span className={s.swatch} style={{ background: item.colour }} aria-hidden />
          {item.label}
        </li>
      ))}
    </ul>
  );
}

// ─── Price change alerts ─────────────────────────────────────────────────────

const STATUS_LABEL: Record<AlertStatus, string> = {
  new: 'New',
  credit: 'Credit requested',
  disputed: 'Disputed',
  accepted: 'Price accepted',
};

const STATUS_CLASS: Record<AlertStatus, string | undefined> = {
  new: s.badgeWarn,
  credit: undefined,
  disputed: s.badgeBad,
  accepted: s.badgeOk,
};

type Statuses = Record<string, AlertStatus>;

const isOpen = (status: AlertStatus) => status === 'new' || status === 'disputed';

function PriceAlerts({ statuses, setStatuses }: { statuses: Statuses; setStatuses: (update: (prev: Statuses) => Statuses) => void }) {
  const alerts = PRICE_ALERTS.map((a) => ({ ...a, status: statuses[a.id] }))
    .sort((a, b) => overContract(b) - overContract(a));
  const live = alerts.filter((a) => a.status !== 'accepted');
  const open = alerts.filter((a) => isOpen(a.status));
  const totalOver = live.reduce((sum, a) => sum + overContract(a), 0);
  const creditAsked = alerts.filter((a) => a.status === 'credit').reduce((sum, a) => sum + overContract(a), 0);

  const bySupplier = Object.values(
    live.reduce<Record<string, { supplier: string; over: number }>>((acc, a) => {
      acc[a.supplier] ??= { supplier: a.supplier, over: 0 };
      acc[a.supplier].over += overContract(a);
      return acc;
    }, {}),
  ).sort((a, b) => b.over - a.over);

  const setStatus = (alert: PriceAlert, status: AlertStatus) => setStatuses((prev) => ({ ...prev, [alert.id]: status }));

  return (
    <section id="price-alerts" className={s.section} aria-labelledby="price-alerts-title">
      <div className={s.sectionHead}>
        <div>
          <h2 id="price-alerts-title" className={s.sectionTitle}>Price change alerts</h2>
        </div>
        <Link href="/invoices" className={s.btn}>Open invoices</Link>
      </div>

      <div className={s.kpis}>
        <Kpi label="Open alerts" value={String(open.length)} hint={`${alerts.length} raised this month`} warn={open.length > 0} />
        <Kpi label="Over contract this month" value={money(totalOver)} hint="Across all pizzerias" warn />
        <Kpi label="Credit requested" value={money(creditAsked)} hint={`${alerts.filter((a) => a.status === 'credit').length} suppliers asked`} />
        <Kpi label="Tolerance" value={`${PRICE_TOLERANCE_PCT}%`} hint="Over the contract price" />
      </div>

      <div className={s.split}>
        <Card title="Over contract by supplier">
          <div className={s.chart} style={{ height: Math.max(220, bySupplier.length * 36 + 40) }} role="img" aria-label="Bar chart of money paid over contract by supplier. The table below has the figures.">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={bySupplier} layout="vertical" margin={{ top: 4, right: 16, bottom: 0, left: 4 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="var(--color-border-subtle)" />
                <XAxis type="number" tickFormatter={(v: number) => money(v)} tick={TICK} axisLine={false} tickLine={false} />
                <YAxis type="category" dataKey="supplier" tick={TICK} axisLine={false} tickLine={false} width={150} />
                <Tooltip contentStyle={TOOLTIP} cursor={{ fill: 'rgba(0, 28, 53, 0.04)' }} formatter={(v) => [money(Number(v), 2), 'Over contract']} />
                <Bar dataKey="over" fill={COBALT} radius={[0, 4, 4, 0]} barSize={18} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card title="Alerts">
          <div className={s.tableWrap}>
            <table className={s.table}>
              <thead>
                <tr>
                  <th scope="col">Product</th>
                  <th scope="col" className={s.num}>Contract</th>
                  <th scope="col" className={s.num}>Invoiced</th>
                  <th scope="col" className={s.num}>Over contract</th>
                  <th scope="col">Status</th>
                  <th scope="col"><span className={s.srOnly}>Actions</span></th>
                </tr>
              </thead>
              <tbody>
                {alerts.map((a) => (
                  <tr key={a.id}>
                    <td>
                      <span className={s.strong}>{a.product}</span>, {a.pack}
                      <span className={s.sub}>{a.supplier} · {a.invoices} invoices · {a.sites} pizzerias · {a.contractEnds === 'rolling' ? 'rolling contract' : `contract to ${a.contractEnds}`}</span>
                    </td>
                    <td data-label="Contract" className={s.num}>{money(a.contractPrice, 2)}</td>
                    <td data-label="Invoiced" className={s.num}>
                      {money(a.invoicedPrice, 2)}
                      <span className={cx(s.sub, s.up)}>+{variancePct(a).toFixed(1)}%</span>
                    </td>
                    <td data-label="Over contract" className={cx(s.num, s.strong)}>
                      {money(overContract(a), 2)}
                      <span className={s.sub}>{a.quantity} bought</span>
                    </td>
                    <td data-label="Status"><span className={cx(s.badge, STATUS_CLASS[a.status])}>{STATUS_LABEL[a.status]}</span></td>
                    <td>
                      {a.status === 'new' && (
                        <div className={s.rowActions}>
                          <button type="button" className={cx(s.btn, s.btnPrimary)} onClick={() => setStatus(a, 'credit')} aria-label={`Request credit for ${a.product}`}>
                            Request credit
                          </button>
                          <button type="button" className={cx(s.btn, s.btnGhost)} onClick={() => setStatus(a, 'accepted')} aria-label={`Accept new price for ${a.product}`}>
                            Accept
                          </button>
                        </div>
                      )}
                      {a.status !== 'new' && a.status !== PRICE_ALERTS.find((p) => p.id === a.id)?.status && (
                        <div className={s.rowActions}>
                          <button type="button" className={cx(s.btn, s.btnGhost)} onClick={() => setStatus(a, 'new')} aria-label={`Undo for ${a.product}`}>
                            Undo
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </section>
  );
}

// ─── Month-end accruals ──────────────────────────────────────────────────────

function downloadAccruals() {
  const header = ['Supplier', 'Deliveries', 'Pizzerias', '0 to 7 days', '8 to 30 days', 'Over 30 days', 'To accrue', 'Oldest delivery', 'Note'];
  const rows = ACCRUALS.map((r) => [r.supplier, r.deliveries, r.sites, r.recent, r.month, r.older, accrualTotal(r), r.oldestDelivery, r.note]);
  const csv = [header, ...rows]
    .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    .join('\n');
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = 'pizza-pilgrims-accruals-november-2026.csv';
  link.click();
  URL.revokeObjectURL(url);
}

function Accruals() {
  const rows = [...ACCRUALS].sort((a, b) => accrualTotal(b) - accrualTotal(a));
  const total = rows.reduce((sum, r) => sum + accrualTotal(r), 0);
  const deliveries = rows.reduce((sum, r) => sum + r.deliveries, 0);
  const older = rows.reduce((sum, r) => sum + r.older, 0);
  const columns = { recent: rows.reduce((t, r) => t + r.recent, 0), month: rows.reduce((t, r) => t + r.month, 0) };

  return (
    <section id="accruals" className={s.section} aria-labelledby="accruals-title">
      <div className={s.sectionHead}>
        <div>
          <h2 id="accruals-title" className={s.sectionTitle}>Month-end accruals</h2>
        </div>
        <button type="button" className={cx(s.btn, s.btnPrimary)} onClick={downloadAccruals}>
          <Download size={14} aria-hidden /> Export accrual journal
        </button>
      </div>

      <div className={s.kpis}>
        <Kpi label="To accrue" value={money(total)} hint={`As at ${AS_AT}`} />
        <Kpi label="Deliveries not invoiced" value={String(deliveries)} hint={`From ${rows.length} suppliers`} />
        <Kpi label="Over 30 days" value={money(older)} hint="Chase these before month end" warn={older > 0} />
        <Kpi label="Month end" value={MONTH_END} hint="Figures update as invoices arrive" />
      </div>

      <div className={s.split}>
        <Card title="Not yet invoiced, by supplier">
          <Legend items={[
            { label: '0 to 7 days', colour: COBALT_LIGHT },
            { label: '8 to 30 days', colour: COBALT },
            { label: 'Over 30 days', colour: AMBER },
          ]} />
          <div className={s.chart} style={{ height: rows.length * 36 + 40 }} role="img" aria-label="Stacked bar chart of goods received not invoiced by supplier and age. The table below has the figures.">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={rows} layout="vertical" margin={{ top: 4, right: 16, bottom: 0, left: 4 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="var(--color-border-subtle)" />
                <XAxis type="number" tickFormatter={(v: number) => `£ ${Math.round(v / 1000)}k`} tick={TICK} axisLine={false} tickLine={false} />
                <YAxis type="category" dataKey="supplier" tick={TICK} axisLine={false} tickLine={false} width={150} />
                <Tooltip
                  contentStyle={TOOLTIP}
                  cursor={{ fill: 'rgba(0, 28, 53, 0.04)' }}
                  formatter={(v, name) => [money(Number(v)), name === 'recent' ? '0 to 7 days' : name === 'month' ? '8 to 30 days' : 'Over 30 days']}
                />
                <Bar dataKey="recent" stackId="age" fill={COBALT_LIGHT} barSize={18} />
                <Bar dataKey="month" stackId="age" fill={COBALT} barSize={18} />
                <Bar dataKey="older" stackId="age" fill={AMBER} radius={[0, 4, 4, 0]} barSize={18} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card title="Accruals by supplier">
          <div className={s.tableWrap}>
            <table className={s.table}>
              <thead>
                <tr>
                  <th scope="col">Supplier</th>
                  <th scope="col" className={s.num}>0 to 7 days</th>
                  <th scope="col" className={s.num}>8 to 30 days</th>
                  <th scope="col" className={s.num}>Over 30 days</th>
                  <th scope="col" className={s.num}>To accrue</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.supplier}>
                    <td>
                      <span className={s.strong}>{r.supplier}</span>
                      <span className={s.sub}>{r.deliveries} deliveries · oldest {r.oldestDelivery}</span>
                      <span className={s.sub}>{r.note}</span>
                    </td>
                    <td data-label="0 to 7 days" className={s.num}>{r.recent ? money(r.recent) : '–'}</td>
                    <td data-label="8 to 30 days" className={s.num}>{r.month ? money(r.month) : '–'}</td>
                    <td data-label="Over 30 days" className={s.num}>
                      {r.older ? <span className={cx(s.badge, s.badgeWarn)}>{money(r.older)}</span> : '–'}
                    </td>
                    <td data-label="To accrue" className={cx(s.num, s.strong)}>{money(accrualTotal(r))}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td>Total</td>
                  <td data-label="0 to 7 days" className={s.num}>{money(columns.recent)}</td>
                  <td data-label="8 to 30 days" className={s.num}>{money(columns.month)}</td>
                  <td data-label="Over 30 days" className={s.num}>{money(older)}</td>
                  <td data-label="To accrue" className={s.num}>{money(total)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </Card>
      </div>
    </section>
  );
}

// ─── Approvals and audit trail ───────────────────────────────────────────────

const OUTCOME_CLASS: Record<ReviewOutcome, string> = {
  Waiting: s.badgeWarn,
  Approved: s.badgeOk,
  'Approved with edits': s.badgeOk,
  Declined: s.badgeBad,
};

const FILTERS: { id: 'all' | ChangeType; label: string }[] = [
  { id: 'all', label: 'All changes' },
  { id: 'count', label: 'Counts' },
  { id: 'price', label: 'Prices' },
  { id: 'approval', label: 'Approvals' },
  { id: 'access', label: 'Rules and roles' },
];

function LogTable({ entries }: { entries: AuditEntry[] }) {
  return (
    <div className={s.tableWrap}>
      <table className={s.table}>
        <thead>
          <tr>
            <th scope="col">When</th>
            <th scope="col">Who</th>
            <th scope="col">What changed</th>
            <th scope="col">Before</th>
            <th scope="col">After</th>
            <th scope="col">Reason</th>
          </tr>
        </thead>
        <tbody>
          {entries.map((e) => (
            <tr key={e.id}>
              <td data-label="When" className={s.nowrap}>{e.when}</td>
              <td data-label="Who">
                <span className={s.strong}>{e.who}</span>
                <span className={s.sub}>{e.role} · {e.site}</span>
              </td>
              <td data-label="What changed">
                <span className={s.badge}>{CHANGE_LABELS[e.type]}</span>{' '}
                {e.what}
                {e.afterSubmit && <> <span className={s.badge}>Reopened after submit</span></>}
              </td>
              <td data-label="Before" className={s.nowrap}>{e.before}</td>
              <td data-label="After">
                <span className={cx(s.strong, s.nowrap)}>{e.after}</span>
                {e.value !== undefined && <span className={s.sub}>{money(e.value, 2)} of stock</span>}
              </td>
              <td data-label="Reason">{e.reason}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Approvals() {
  const [filter, setFilter] = useState<'all' | ChangeType>('all');
  const entries = useMemo(() => AUDIT_LOG.filter((e) => filter === 'all' || e.type === filter), [filter]);
  const ruleChanges = AUDIT_LOG.filter((e) => e.type === 'access');
  const reopened = AUDIT_LOG.filter((e) => e.afterSubmit);
  const reopenedValue = reopened.reduce((sum, e) => sum + (e.value ?? 0), 0);
  const priceChanges = AUDIT_LOG.filter((e) => e.type === 'price').length;
  const sitesWithReopens = REOPENS_BY_SITE.filter((r) => r.reopens > 0);
  const sitesWithout = REOPENS_BY_SITE.filter((r) => r.reopens === 0).map((r) => r.site);

  return (
    <section id="approvals" className={s.section} aria-labelledby="approvals-title">
      <div className={s.sectionHead}>
        <div>
          <h2 id="approvals-title" className={s.sectionTitle}>Approvals and audit trail</h2>
        </div>
        <Link href="/approvals" className={s.btn}>Review approvals</Link>
      </div>

      <div className={s.kpis}>
        <Kpi label="Rule and role changes" value={String(ruleChanges.length)} hint="1 weekly cap, 1 permission, 1 role" warn={ruleChanges.length > 0} />
        <Kpi label="Orders reviewed" value={String(APPROVAL_STATS.reviewed)} hint={`${APPROVAL_STATS.declined} declined, ${APPROVAL_STATS.edited} edited, ${APPROVAL_STATS.waiting} waiting`} />
        <Kpi label="Counts reopened after submit" value={String(reopened.length)} hint={`${money(reopenedValue)} of stock moved`} />
        <Kpi label="Contract prices changed" value={String(priceChanges)} hint="All by Finance" />
      </div>

      <Card title="Rule and role changes">
        <LogTable entries={ruleChanges} />
      </Card>

      <Card title="Orders sent for review">
        <div className={s.tableWrap}>
          <table className={s.table}>
            <thead>
              <tr>
                <th scope="col">Order</th>
                <th scope="col">Raised by</th>
                <th scope="col" className={s.num}>Total</th>
                <th scope="col">Why it was reviewed</th>
                <th scope="col">Outcome</th>
                <th scope="col" className={s.num}>Time to review</th>
              </tr>
            </thead>
            <tbody>
              {REVIEWED_ORDERS.map((o) => (
                <tr key={o.po}>
                  <td>
                    <span className={s.strong}>{o.po}</span>
                    <span className={s.sub}>{o.supplier}</span>
                  </td>
                  <td data-label="Raised by">
                    {o.raisedBy}
                    <span className={s.sub}>{o.raisedRole} · {o.site}</span>
                  </td>
                  <td data-label="Total" className={cx(s.num, s.strong)}>{money(o.total, 2)}</td>
                  <td data-label="Why it was reviewed">
                    {o.trigger}
                    <span className={s.sub}>{o.detail}</span>
                  </td>
                  <td data-label="Outcome">
                    <span className={cx(s.badge, OUTCOME_CLASS[o.outcome])}>{o.outcome}</span>
                    {o.reviewer && <span className={s.sub}>{o.reviewer}, {o.reviewerTitle}</span>}
                    {o.note && <span className={s.sub}>{o.note}</span>}
                  </td>
                  <td data-label="Time to review" className={s.num}>{o.reviewTime}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Card title="Counts reopened after submit, by pizzeria">
        <div className={s.chart} style={{ height: sitesWithReopens.length * 36 + 40 }} role="img" aria-label="Bar chart of stock value moved by counts reopened after submit, by pizzeria, over the last 6 weeks. Camden is highest.">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={sitesWithReopens} layout="vertical" margin={{ top: 4, right: 16, bottom: 0, left: 4 }}>
              <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="var(--color-border-subtle)" />
              <XAxis type="number" tickFormatter={(v: number) => money(v)} tick={TICK} axisLine={false} tickLine={false} />
              <YAxis type="category" dataKey="site" tick={TICK} axisLine={false} tickLine={false} width={150} />
              <Tooltip
                contentStyle={TOOLTIP}
                cursor={{ fill: 'rgba(0, 28, 53, 0.04)' }}
                formatter={(v, _name, item) => [`${money(Number(v))} over ${item.payload.reopens} reopened counts`, 'Last 6 weeks']}
              />
              <Bar dataKey="value" fill={COBALT} radius={[0, 4, 4, 0]} barSize={18} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        {sitesWithout.length > 0 && <p className={s.chartNote}>No reopened counts at {sitesWithout.join(' or ')}.</p>}
      </Card>

      <Card
        title="Audit log"
        action={(
          <div className={s.chips} role="group" aria-label="Filter the audit log">
            {FILTERS.map((f) => (
              <button
                key={f.id}
                type="button"
                className={cx(s.chip, filter === f.id && s.chipOn)}
                aria-pressed={filter === f.id}
                onClick={() => setFilter(f.id)}
              >
                {f.label}
              </button>
            ))}
          </div>
        )}
      >
        <LogTable entries={entries} />
      </Card>
    </section>
  );
}

export default function FinanceControlsDashboard() {
  const [statuses, setStatuses] = useState<Statuses>(
    () => Object.fromEntries(PRICE_ALERTS.map((a) => [a.id, a.status])),
  );
  const openAlerts = Object.values(statuses).filter(isOpen).length;
  const olderAccruals = ACCRUALS.filter((r) => r.older > 0).length;
  return (
    <div className={s.page}>
      <header>
        <div className={s.header}>
          <div>
            <h2 className={s.title}>{COMPANY} <span className={s.titleMuted}>· Finance controls, {PERIOD_LABEL}</span></h2>
            <p className={s.meta}>All {SITE_COUNT} pizzerias · as at {AS_AT}</p>
          </div>
          <div className={s.headerActions}>
            <Link href="/scheduled-reports" className={s.btn}>
              <CalendarClock size={14} aria-hidden /> Schedule this report
            </Link>
          </div>
        </div>
        <nav aria-label="Sections">
          <ul className={s.jump}>
            <li><a className={s.jumpLink} href="#price-alerts">Price change alerts <span className={s.jumpCount}>{openAlerts} open</span></a></li>
            <li><a className={s.jumpLink} href="#accruals">Month-end accruals <span className={s.jumpCount}>{olderAccruals} over 30 days</span></a></li>
            <li><a className={s.jumpLink} href="#approvals">Approvals and audit trail <span className={s.jumpCount}>{APPROVAL_STATS.waiting} waiting</span></a></li>
          </ul>
        </nav>
      </header>
      <PriceAlerts statuses={statuses} setStatuses={setStatuses} />
      <Accruals />
      <Approvals />
    </div>
  );
}
