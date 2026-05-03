'use client';

/**
 * RangeTiersTab — intentionally a stub for v1.
 *
 * The Pret-style "ranges → tiers → SKU windows × site assignments"
 * model is the painful part of every site setup. Rather than copy it
 * 1:1 we surface the *current* tier this site uses (as read-only
 * context) and a "we're rebuilding this" empty-state. The CTA invites
 * the user to share what's painful via Quinn — that's the v2 brief
 * source.
 */

import { ArrowRight } from 'lucide-react';
import EdifyMark from '@/components/EdifyMark/EdifyMark';
import StatusPill from '@/components/Production/StatusPill';
import {
  DEMO_TODAY,
  PRET_RANGES,
  PRET_TIERS,
  tierForSiteOnDate,
} from '@/components/Production/fixtures';
import { Section, type TabProps } from './_shared';

export default function RangeTiersTab({ siteId }: TabProps) {
  const tier = tierForSiteOnDate(siteId, DEMO_TODAY);
  const tierRanges = tier
    ? tier.rangeIds
        .map(id => PRET_RANGES.find(r => r.id === id))
        .filter((r): r is NonNullable<typeof r> => !!r)
    : [];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, maxWidth: 880 }}>
      {/* Big empty-state hero */}
      <div
        style={{
          padding: '28px 24px',
          borderRadius: 'var(--radius-card)',
          background:
            'linear-gradient(135deg, var(--color-info-light) 0%, var(--color-bg-hover) 100%)',
          border: '1px solid var(--color-border-subtle)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-start',
          gap: 12,
        }}
      >
        <div
          style={{
            width: 44,
            height: 44,
            borderRadius: 12,
            background: 'var(--color-accent-active)',
            color: 'var(--color-text-on-active)',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <EdifyMark size={22} color="var(--color-text-on-active)" />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <span style={{ fontSize: 18, fontWeight: 700, color: 'var(--color-text-primary)' }}>
            Range &amp; tiers — coming next
          </span>
          <span
            style={{
              fontSize: 13,
              color: 'var(--color-text-secondary)',
              fontWeight: 500,
              maxWidth: 540,
              lineHeight: 1.5,
            }}
          >
            We're rebuilding this from scratch so opening a new site doesn't mean re-entering
            products tier-by-tier and site-by-site. Quinn will infer ranges from sales patterns
            and propose a starter tier, with overrides where you actually need them.
          </span>
        </div>
        <button
          type="button"
          onClick={() => {
            try {
              navigator.clipboard?.writeText(
                'Tell me what\u2019s painful about today\u2019s range & tier setup.',
              );
            } catch {
              // ignore
            }
          }}
          title="Copies a starter prompt to your clipboard so you can paste it into Quinn."
          style={{
            padding: '10px 14px',
            borderRadius: 8,
            background: 'var(--color-accent-active)',
            color: 'var(--color-text-on-active)',
            border: '1px solid var(--color-accent-active)',
            fontSize: 12,
            fontWeight: 700,
            fontFamily: 'var(--font-primary)',
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
          }}
        >
          Tell us what's painful about today's setup <ArrowRight size={13} />
        </button>
      </div>

      {/* Read-only summary of current tier */}
      <Section
        title="Current tier (read-only)"
        description={`What this site is currently selling on ${DEMO_TODAY}. Editable from the legacy admin until the new flow lands.`}
        rightSlot={
          tier ? <StatusPill tone="brand" label={tier.name} size="sm" /> : <StatusPill tone="neutral" label="No tier assigned" size="sm" />
        }
      >
        {!tier ? (
          <span style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>
            This site doesn't have a tier assignment for today. Add one via the legacy admin or
            wait for the new flow.
          </span>
        ) : tierRanges.length === 0 ? (
          <span style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>
            Tier {tier.name} has no ranges attached.
          </span>
        ) : (
          <ul
            style={{
              margin: 0,
              padding: 0,
              listStyle: 'none',
              display: 'flex',
              flexDirection: 'column',
              gap: 6,
            }}
          >
            {tierRanges.map(r => (
              <li
                key={r.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '8px 12px',
                  background: 'var(--color-bg-hover)',
                  borderRadius: 8,
                  fontSize: 12,
                  color: 'var(--color-text-primary)',
                }}
              >
                <span style={{ fontWeight: 700 }}>{r.name}</span>
                <span style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>
                  {r.entries.length} SKU{r.entries.length === 1 ? '' : 's'}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section
        title="Tiers in the estate"
        description="Today's tier library, for context."
      >
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {PRET_TIERS.map(t => (
            <span
              key={t.id}
              style={{
                padding: '6px 10px',
                borderRadius: 999,
                background: tier?.id === t.id ? 'var(--color-accent-active)' : '#ffffff',
                color: tier?.id === t.id ? 'var(--color-text-on-active)' : 'var(--color-text-secondary)',
                border: `1px solid ${
                  tier?.id === t.id ? 'var(--color-accent-active)' : 'var(--color-border)'
                }`,
                fontSize: 11,
                fontWeight: 700,
                fontFamily: 'var(--font-primary)',
              }}
            >
              {t.name}
            </span>
          ))}
        </div>
      </Section>
    </div>
  );
}
