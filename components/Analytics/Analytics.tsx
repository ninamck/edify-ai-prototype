'use client';

/**
 * Analytics — Mixpanel instrumentation for the prototype.
 *
 * Fully inert unless `NEXT_PUBLIC_MIXPANEL_TOKEN` is set, so the internal
 * build and local dev send nothing. When a token is present we init once,
 * stamp every event with the current customer (so a dedicated demo project
 * can segment by who's viewing), and log a page view on each route change.
 *
 * Point at an EU residency project by leaving `NEXT_PUBLIC_MIXPANEL_API_HOST`
 * unset (defaults to the EU ingestion host); override for US.
 *
 * Use `track(event, props)` from anywhere to record demo interactions.
 */

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import mixpanel from 'mixpanel-browser';
import { DEMO_CUSTOMER_ID, demoCustomer } from '@/lib/demoConfig';

const TOKEN = process.env.NEXT_PUBLIC_MIXPANEL_TOKEN;
const API_HOST =
  process.env.NEXT_PUBLIC_MIXPANEL_API_HOST ?? 'https://api-eu.mixpanel.com';

let initialised = false;

function ensureInit(): boolean {
  if (!TOKEN) return false;
  if (initialised) return true;
  mixpanel.init(TOKEN, {
    api_host: API_HOST,
    persistence: 'localStorage',
    track_pageview: false, // we handle route changes ourselves
  });
  mixpanel.register({
    customer: DEMO_CUSTOMER_ID,
    customer_name: demoCustomer.name,
    surface: 'prototype',
  });
  initialised = true;
  return true;
}

/** Record a demo interaction. No-op when analytics is disabled. */
export function track(event: string, props?: Record<string, unknown>): void {
  if (!ensureInit()) return;
  mixpanel.track(event, props);
}

export default function Analytics() {
  const pathname = usePathname();

  useEffect(() => {
    if (!ensureInit()) return;
    mixpanel.track('Page viewed', { path: pathname });
  }, [pathname]);

  return null;
}
