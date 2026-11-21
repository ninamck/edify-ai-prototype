import type { AreaRouteTab } from '@/components/TopBar/AreaTopBar';
import type { CashAudience } from './cashOperators';

const T = {
  today: { id: 'today', label: 'Today', href: '/cash/today' },
  movements: { id: 'movements', label: 'Cash in and out', href: '/cash/movements' },
  collection: { id: 'collection', label: 'Collection', href: '/cash/collection' },
  paidOuts: { id: 'paid-outs', label: 'Paid outs', href: '/cash/paid-outs' },
  change: { id: 'change', label: 'Order change', href: '/cash/change' },
  activity: { id: 'activity', label: 'Till activity', href: '/cash/activity' },
  statement: { id: 'statement', label: 'Statement', href: '/cash/statement' },
  history: { id: 'history', label: 'History', href: '/cash/history' },
  endOfDay: { id: 'end-of-day', label: 'End of day', href: '/cash/end-of-day' },
  deposit: { id: 'collection', label: 'Bank deposit', href: '/cash/collection' },
  setup: { id: 'setup', label: 'Set-up', href: '/cash/setup' },
} satisfies Record<string, AreaRouteTab>;

export const CASH_TABS: Record<CashAudience, AreaRouteTab[]> = {
  pret: [T.today, T.collection, T.paidOuts, T.change, T.activity, T.history, T.setup],
  pub: [T.today, T.movements, T.collection, T.paidOuts, T.change, T.activity, T.statement, T.history, T.setup],
  dunkin: [T.today, T.endOfDay, T.deposit, T.paidOuts, T.activity, T.history, T.setup],
};
