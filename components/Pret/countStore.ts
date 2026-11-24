'use client';

import { useMemo } from 'react';
import type { StocktakeRecord } from '@/components/Stock/status';
import { usePretState } from './pretStore';

/** A count a shop submitted in the walkthrough, with the shop it belongs to. */
export type SubmittedCount = StocktakeRecord & {
  siteId: string;
  taskId?: string;
  monthly?: boolean;
  signedOff?: { by: string; at: string };
};

export type CountTaskKind = 'count' | 'stock-check' | 'recall-check';

export const COUNT_TASK_LABEL: Record<CountTaskKind, string> = {
  count: 'Count',
  'stock-check': 'Stock check',
  'recall-check': 'Recall check',
};

export type CountTask = {
  id: string;
  siteId: string;
  kind: CountTaskKind;
  title: string;
  /** Why it was raised, in the shop's words. */
  why: string;
  productIds: string[];
  /** When it's due by: ISO, or relative for seeds (see whenDate). */
  dueAt: string;
  raisedBy: string;
  raisedAt: string;
  status: 'open' | 'done';
  doneAt?: string;
  doneBy?: string;
  recordId?: string;
  /** What the count found, for the tracker. */
  found?: string;
};

export type KeyLine = { productId: string; every: 'daily' | 'weekly'; day?: string };

export type CountPlan = {
  /** The monthly full count: which day and the window to finish it in. */
  fullCountDay: 'last-sunday' | 'last-day' | 'first-monday';
  windowHours: number;
  keyLines: KeyLine[];
  shopIds: string[];
  updatedBy?: string;
  updatedAt?: string;
};

/**
 * Seeded times are written relative to today ("d0@11:00", "d-1@20:00") so
 * the seed is the same on the server and in the browser. New entries use
 * ISO times. Read either with `whenDate`.
 */
export function whenDate(value: string): Date {
  const m = /^d(-?\d+)@(\d\d):(\d\d)$/.exec(value);
  if (!m) return new Date(value);
  const d = new Date();
  d.setDate(d.getDate() + Number(m[1]));
  d.setHours(Number(m[2]), Number(m[3]), 0, 0);
  return d;
}

/** "today 11:00", "yesterday 20:00", "Mon 9 Nov 10:00" */
export function whenLabel(value: string): string {
  const d = whenDate(value);
  const time = d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  const today = new Date();
  const days = Math.round((new Date(d.toDateString()).getTime() - new Date(today.toDateString()).getTime()) / 86400000);
  if (days === 0) return `today ${time}`;
  if (days === -1) return `yesterday ${time}`;
  if (days === 1) return `tomorrow ${time}`;
  return `${d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })} ${time}`;
}

function seedTasks(): CountTask[] {
  return [
    {
      id: 'task-kx-bread',
      siteId: 'fitzroy-kings-cross',
      kind: 'count',
      title: 'Count bread and cucumbers before 11:00',
      why: 'The tills sold 4 Fosters Bloomer sandwiches yesterday while stock showed no bloomer, so the stock figure is wrong.',
      productIds: ['pret-bread-fosters-bloomer', 'pret-sourdough-bread-16mm', 'pret-cucumbers'],
      dueAt: 'd0@11:00',
      raisedBy: 'Edify',
      raisedAt: 'd0@06:10',
      status: 'open',
    },
    {
      id: 'task-hub-chicken',
      siteId: 'fitzroy-espresso',
      kind: 'count',
      title: 'Count chicken and cheddar before 14:00',
      why: "Tomorrow's production plan needs 18 packs of sliced chicken and stock shows 10. Check before the order goes.",
      productIds: ['pret-chicken-breast-uk-sliced', 'pret-mature-cheddar-slices'],
      dueAt: 'd0@14:00',
      raisedBy: 'Edify',
      raisedAt: 'd0@05:40',
      status: 'open',
    },
    {
      id: 'task-hr-oat',
      siteId: 'fitzroy-heathrow',
      kind: 'count',
      title: 'Count alt milks',
      why: 'Oat milk sold while stock showed none, two days running.',
      productIds: ['pret-alt-milk-oat', 'pret-milk-semi-skimmed'],
      dueAt: 'd-1@12:00',
      raisedBy: 'Edify',
      raisedAt: 'd-1@06:00',
      status: 'open',
    },
    {
      id: 'task-is-ham',
      siteId: 'fitzroy-islington',
      kind: 'recall-check',
      title: 'Recall check: Wiltshire Ham, use-by 14 Nov',
      why: 'BFL recalled one batch. Check the use-by on every pack and set aside any dated 14 Nov.',
      productIds: ['pret-wiltshire-ham-750g'],
      dueAt: 'd0@09:00',
      raisedBy: 'Leah Morgan',
      raisedAt: 'd-1@16:30',
      status: 'done',
      doneAt: 'd0@07:45',
      doneBy: 'Casey Park',
      found: '2 packs set aside, both from the recalled batch',
    },
  ];
}

const SEED_TASKS = seedTasks();

const SEED_PLAN: CountPlan = {
  fullCountDay: 'last-sunday',
  windowHours: 36,
  keyLines: [
    { productId: 'pret-bread-fosters-bloomer', every: 'daily' },
    { productId: 'pret-sourdough-bread-16mm', every: 'daily' },
    { productId: 'pret-milk-semi-skimmed', every: 'daily' },
    { productId: 'pret-alt-milk-oat', every: 'daily' },
    { productId: 'pret-avocado-hass', every: 'daily' },
    { productId: 'pret-chicken-breast-uk-sliced', every: 'daily' },
    { productId: 'pret-croissant-plain', every: 'weekly', day: 'Mon' },
    { productId: 'pret-organic-espresso-beans', every: 'weekly', day: 'Mon' },
    { productId: 'pret-coca-cola-330ml', every: 'weekly', day: 'Thu' },
  ],
  shopIds: ['fitzroy-espresso', 'fitzroy-kings-cross', 'fitzroy-heathrow', 'fitzroy-islington'],
};

const NO_COUNTS: SubmittedCount[] = [];

export function useSubmittedCounts() {
  return usePretState<SubmittedCount[]>('stock-records', NO_COUNTS);
}

const WEEKDAY = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/** Today's key-line count for every shop on the plan. */
export function keyLineTasks(plan: CountPlan, now = new Date()): CountTask[] {
  const day = WEEKDAY[now.getDay()];
  const productIds = plan.keyLines.filter((l) => l.every === 'daily' || l.day === day).map((l) => l.productId);
  if (productIds.length === 0) return [];
  const date = `${now.getFullYear()}-${now.getMonth() + 1}-${now.getDate()}`;
  return plan.shopIds.map((siteId) => ({
    id: `task-keylines-${date}-${siteId}`,
    siteId,
    kind: 'count' as const,
    title: "Today's key lines",
    why: `${productIds.length} lines from the count plan. They drive tomorrow's order, so count them before it goes.`,
    productIds,
    dueAt: 'd0@10:00',
    raisedBy: 'the count plan',
    raisedAt: 'd0@05:00',
    status: 'open' as const,
  }));
}

/** Stored tasks plus today's key-line counts that haven't been done yet. */
export function useCountTasks(): [CountTask[], (next: CountTask[] | ((prev: CountTask[]) => CountTask[])) => void] {
  const [stored, setStored] = usePretState<CountTask[]>('count-tasks', SEED_TASKS);
  const [plan] = useCountPlan();
  const merged = useMemo(() => {
    const ids = new Set(stored.map((t) => t.id));
    return [...keyLineTasks(plan).filter((t) => !ids.has(t.id)), ...stored];
  }, [stored, plan]);
  return [merged, setStored];
}

export function useCountPlan() {
  return usePretState<CountPlan>('count-plan', SEED_PLAN);
}

/** Stock item ids carry a site prefix: "kx-pret-cucumbers". */
export function productIdOf(stockItemId: string): string {
  const i = stockItemId.indexOf('-pret-');
  return i >= 0 ? stockItemId.slice(i + 1) : stockItemId;
}

/** The monthly full count's day this month, from the plan. */
export function fullCountDate(plan: CountPlan, from = new Date()): Date {
  const y = from.getFullYear();
  const m = from.getMonth();
  if (plan.fullCountDay === 'first-monday') {
    const d = new Date(y, m, 1);
    while (d.getDay() !== 1) d.setDate(d.getDate() + 1);
    return d;
  }
  const last = new Date(y, m + 1, 0);
  if (plan.fullCountDay === 'last-day') return last;
  while (last.getDay() !== 0) last.setDate(last.getDate() - 1);
  return last;
}
