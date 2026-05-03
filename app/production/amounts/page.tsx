'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import AmountsView from '@/components/Production/AmountsView';
import { useRole } from '@/components/Production/RoleContext';
import { PRET_SITES, DEMO_TODAY, dayOfWeek, getSite } from '@/components/Production/fixtures';
import type { FocusReason } from '@/components/Production/PlanStore';
import IncomingRejectsStrip from '@/components/Production/IncomingRejectsStrip';
import IncomingAdhocRequestsStrip from '@/components/Production/IncomingAdhocRequestsStrip';
import UrgentRemakeBanner from '@/components/Production/UrgentRemakeBanner';
import SpokeTodayPanel from '@/components/Production/SpokeTodayPanel';
import { useActiveSite } from '@/components/ActiveSite/ActiveSiteContext';
import { useDemoNotifications } from '@/components/Production/demoNotificationsStore';

// The active "persona" SPOKE in the demo maps to this fixture spoke.
// Keeping the mapping in one place so the spoke surfaces all read from
// the same data row.
const SPOKE_PERSONA_SITE_ID = 'site-spoke-south';
const SPOKE_PERSONA_HUB_ID = 'hub-central';

// The site picker on the hub Today screen mirrors the persona setup —
// only the user's own hub and the spoke persona's site. Other fixture
// sites stay in the data graph (forecasts, dispatch demand, etc.) but
// don't clutter the demo's picker.
const PERSONA_SITE_OPTIONS: Array<{ id: string; label: string; tag: string }> = [
  { id: 'hub-central',      label: 'Fitzroy Espresso',     tag: 'YOUR SITE' },
  { id: 'site-spoke-south', label: "Fitzroy King's Cross", tag: 'SPOKE' },
];

const VALID_REASONS: FocusReason[] = ['stockcap', 'assembly-short', 'override', 'draft-forecast'];

/**
 * Today (formerly "Amounts") — the always-on production-day editor.
 *
 * The body lives in `<AmountsView />` because the Plan page reuses the same
 * editor for any selected day. This page just owns the site selector and
 * pins the date to `DEMO_TODAY`.
 *
 * Deep-link contract (consumed by Quinn nudges via `usePlanNudges`):
 *   ?site={SiteId}&focus={ProductionItemId}&reason={FocusReason}
 *
 * On arrival we:
 *   1. Switch the site selector to `?site` (so the row actually exists)
 *   2. Hand `focus` + `reason` to `<AmountsView>` which clears filters,
 *      expands + scrolls + pulses the row, and surfaces a contextual banner
 *   3. Strip `focus` and `reason` from the URL so subsequent navigations
 *      / re-renders don't keep re-pulsing the same row
 */
export default function TodayPage() {
  const { can, user } = useRole();
  const canEdit = can('plan.editQuantity');
  const router = useRouter();
  const searchParams = useSearchParams();
  const { isSpoke } = useActiveSite();
  const demoFlags = useDemoNotifications();

  const [siteId, setSiteId] = useState('hub-central');
  const site = getSite(siteId);
  const isHub = site?.type === 'HUB';
  const recordedBy = user?.name ?? 'Hub manager';
  const [focus, setFocus] = useState<{ itemId: string; reason: FocusReason } | null>(null);

  // On every search-param change, lift focus / site into local state and
  // immediately strip the consumable bits from the URL so a back-button
  // bounce or a re-render doesn't replay the deep-link.
  useEffect(() => {
    const siteParam = searchParams.get('site');
    const focusParam = searchParams.get('focus');
    const reasonParam = searchParams.get('reason') as FocusReason | null;

    if (siteParam && PRET_SITES.some(s => s.id === siteParam)) {
      setSiteId(siteParam);
    }
    if (focusParam && reasonParam && VALID_REASONS.includes(reasonParam)) {
      setFocus({ itemId: focusParam, reason: reasonParam });
    }

    // Strip ?focus & ?reason once consumed; keep ?site so the selection sticks.
    if (focusParam || reasonParam || siteParam) {
      const next = new URLSearchParams();
      if (siteParam) next.set('site', siteParam);
      const qs = next.toString();
      router.replace(qs ? `/production/amounts?${qs}` : '/production/amounts', { scroll: false });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  // Spoke persona gets a lighter, read-only "what's coming today" view
  // — no site picker, no plan editor, no hub-side incoming-request
  // strips. Spokes don't bake; they just need to know what's arriving
  // and whether it's landed.
  if (isSpoke) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        <SpokeTodayPanel spokeId={SPOKE_PERSONA_SITE_ID} hubId={SPOKE_PERSONA_HUB_ID} />
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      <div
        style={{
          padding: '12px 16px',
          borderBottom: '1px solid var(--color-border-subtle)',
          background: '#ffffff',
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          flexWrap: 'wrap',
        }}
      >
        <label
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            fontSize: 10,
            color: 'var(--color-text-muted)',
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
          }}
        >
          Site
        </label>
        <div style={{ display: 'flex', gap: 6 }}>
          {/* Picker is scoped to the two demo personas so the hub manager
              switches between their own site and the spoke persona's
              site (`site-spoke-south`) — same row the spoke writes to,
              so any edit on Fitzroy King's Cross shows up here too. */}
          {PERSONA_SITE_OPTIONS.map(opt => {
            const active = opt.id === siteId;
            return (
              <button
                key={opt.id}
                onClick={() => setSiteId(opt.id)}
                style={{
                  padding: '10px 14px',
                  borderRadius: 8,
                  fontSize: 11,
                  fontWeight: 600,
                  fontFamily: 'var(--font-primary)',
                  background: active ? 'var(--color-accent-active)' : '#ffffff',
                  color: active ? 'var(--color-text-on-active)' : 'var(--color-text-secondary)',
                  border: `1px solid ${active ? 'var(--color-accent-active)' : 'var(--color-border)'}`,
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                }}
              >
                {opt.label} · {opt.tag}
              </button>
            );
          })}
        </div>
        <span style={{ fontSize: 10, color: 'var(--color-text-muted)', marginLeft: 'auto' }}>
          Planning {DEMO_TODAY} ({dayOfWeek(DEMO_TODAY)})
        </span>
      </div>

      {/* Incoming-from-spokes surfaces — only relevant when the hub manager
          is viewing one of their own hubs. The Today screen is the single
          place where the hub manager triages everything that's landed on
          their plate today; Dispatch stays focused on outbound transfers. */}
      {isHub && (
        <>
          {demoFlags.urgentRemake && (
            <UrgentRemakeBanner hubId={siteId} recordedBy={recordedBy} />
          )}
          {demoFlags.rejects && <IncomingRejectsStrip hubId={siteId} />}
          {demoFlags.adhoc && <IncomingAdhocRequestsStrip hubId={siteId} />}
        </>
      )}

      <AmountsView
        siteId={siteId}
        date={DEMO_TODAY}
        canEdit={canEdit}
        focusedItemId={focus?.itemId ?? null}
        focusReason={focus?.reason ?? null}
        onClearFocus={() => setFocus(null)}
      />
    </div>
  );
}
