'use client';

import { useActiveSite } from '@/components/ActiveSite/ActiveSiteContext';
import { personFor } from '../people';
import { cashShop } from '../cashFixtures';
import {
  cashTasksFor,
  rulesFor,
  useCashCloses,
  useCashCollections,
  useCashCorrections,
  useCashCounts,
  useCashRequests,
  useChangeOrders,
  useRuleChanges,
} from '../cashStore';
import { useCashAudience } from '../cashOperators';

/** Everything a shop cash screen needs for the shop the walkthrough is playing. */
export function useCashShop() {
  // Read for its side effect: it sets the currency this screen's amounts show in.
  useCashAudience();
  const { activeSiteId } = useActiveSite();
  const shop = cashShop(activeSiteId);
  const [counts, setCounts] = useCashCounts();
  const [closes, setCloses] = useCashCloses();
  const [collections, setCollections] = useCashCollections();
  const [changeOrders, setChangeOrders] = useChangeOrders();
  const [corrections, setCorrections] = useCashCorrections();
  const [ruleChanges] = useRuleChanges();
  const [requests] = useCashRequests();
  const rules = rulesFor(activeSiteId, ruleChanges);
  const me = personFor(activeSiteId);
  return {
    siteId: activeSiteId,
    shop,
    rules,
    me,
    counts, setCounts,
    closes, setCloses,
    collections, setCollections,
    changeOrders, setChangeOrders,
    corrections, setCorrections,
    requests,
  };
}

/** The shop's cash tasks for today, for the To do list. Empty for the Support Centre. */
export function useCashTasks() {
  const cash = useCashShop();
  if (!cash.shop) return [];
  return cashTasksFor(cash.siteId, cash);
}
