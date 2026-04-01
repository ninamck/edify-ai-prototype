'use client';

import { type ReactNode, useState } from 'react';
import {
  Package,
  Receipt,
  ChefHat,
  BarChart3,
  AlertCircle,
  Truck,
  ClipboardList,
  ShoppingCart,
  Percent,
} from 'lucide-react';
import { motion } from 'framer-motion';
import type { BriefingRole } from '@/components/briefing';

// ── Inline highlight ──────────────────────────────────────────────────────────

function Hi({ children }: { children: React.ReactNode }) {
  return (
    <span style={{ fontWeight: 700, color: 'var(--color-text-primary)' }}>
      {children}
    </span>
  );
}

// ── Section ───────────────────────────────────────────────────────────────────

interface DataPoint {
  label: string;
  value: string;
  tone?: 'positive' | 'warning' | 'neutral';
}

interface SectionProps {
  icon: React.ElementType;
  title: string;
  children: React.ReactNode;
  dataPoints?: DataPoint[];
  index: number;
}

const TONE_COLOR = {
  positive: '#2D6A4F',
  warning:  '#9B2226',
  neutral:  'var(--color-text-primary)',
};

function BriefingSection({ icon: Icon, title, children, dataPoints, index }: SectionProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.1 + index * 0.07, duration: 0.28, ease: 'easeOut' }}
      style={{ padding: '0 6px 16px 4px' }}
    >
      <div style={{
        display: 'flex', alignItems: 'center', gap: '7px',
        marginBottom: '10px',
      }}>
        <span style={{
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          width: '22px', height: '22px', borderRadius: '6px',
          background: 'var(--color-bg-surface)',
          flexShrink: 0,
        }}>
          <Icon size={12} color="var(--color-text-secondary)" strokeWidth={2} />
        </span>
        <span style={{
          fontSize: '10px', fontWeight: 700, letterSpacing: '0.07em',
          textTransform: 'uppercase', color: 'var(--color-text-secondary)',
          lineHeight: 1.25,
        }}>
          {title}
        </span>
      </div>

      <div style={{
        fontSize: '12.5px', color: 'var(--color-text-secondary)',
        lineHeight: 1.65, marginBottom: dataPoints ? '12px' : 0,
      }}>
        {children}
      </div>

      {dataPoints && (
        <div style={{
          display: 'flex', flexDirection: 'column', gap: '5px',
          background: 'rgba(58,48,40,0.04)',
          borderRadius: '8px', padding: '8px 10px',
        }}>
          {dataPoints.map((dp, i) => (
            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>{dp.label}</span>
              <span style={{
                fontSize: '11px', fontWeight: 700,
                color: TONE_COLOR[dp.tone ?? 'neutral'],
              }}>
                {dp.value}
              </span>
            </div>
          ))}
        </div>
      )}
    </motion.div>
  );
}

// ── Divider ───────────────────────────────────────────────────────────────────

function Divider() {
  return <div style={{ height: '1px', background: 'var(--color-border-subtle)', margin: '10px 6px' }} />;
}

/** TLDR / opening block spacing (no timeline dots). */
function TimelineLead({ children }: { children: ReactNode }) {
  return <div style={{ padding: '0 6px 14px 4px' }}>{children}</div>;
}

// ── Deliveries TLDR (role-specific bullets) ───────────────────────────────────

function DeliveriesTldrBullets({ items }: { items: string[] }) {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      gap: '10px',
      fontSize: '13px',
      color: 'var(--color-text-secondary)',
      lineHeight: 1.55,
    }}>
      {items.map((text, i) => (
        <p key={i} style={{ margin: 0 }}>
          {text}
        </p>
      ))}
    </div>
  );
}

function MorningDeliveriesTldr({ title, items }: { title: string; items: string[] }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.28, ease: 'easeOut' }}
      style={{ padding: 0 }}
    >
      <div style={{
        fontSize: '10px',
        fontWeight: 700,
        letterSpacing: '0.08em',
        textTransform: 'uppercase',
        color: 'var(--color-text-secondary)',
        marginBottom: '10px',
      }}>
        {title}
      </div>
      <div style={{
        padding: '12px 14px',
        borderRadius: '10px',
        background: 'rgba(58,48,40,0.04)',
        border: '1px solid var(--color-border-subtle)',
      }}>
        <DeliveriesTldrBullets items={items} />
      </div>
    </motion.div>
  );
}
/** Finance queue row — every item has an explicit action */
function FinanceActionRow({
  title,
  detail,
  primary,
  secondary,
}: {
  title: string;
  detail: ReactNode;
  primary: string;
  secondary?: string;
}) {
  const [done, setDone] = useState(false);
  if (done) return null;
  return (
    <div style={{
      background: '#fff',
      borderRadius: '10px',
      border: '1px solid var(--color-border-subtle)',
      padding: '12px 14px',
      boxShadow: '0 2px 8px rgba(58,48,40,0.08), 0 0 0 1px rgba(58,48,40,0.03)',
    }}>
      <p style={{ margin: '0 0 10px', fontSize: '13px', color: 'var(--color-text-secondary)', lineHeight: 1.6 }}>
        <strong style={{ color: 'var(--color-text-primary)' }}>{title}</strong>
        {' — '}
        {detail}
      </p>
      <div style={{ display: 'flex', gap: '8px' }}>
        <button
          type="button"
          onClick={() => setDone(true)}
          style={{
            padding: '6px 14px', borderRadius: '7px',
            fontSize: '12px', fontWeight: 600,
            fontFamily: 'var(--font-primary)',
            cursor: 'pointer', border: 'none',
            background: 'var(--color-accent-deep)',
            color: '#F4F1EC',
          }}
        >
          {primary}
        </button>
        {secondary && (
          <button
            type="button"
            onClick={() => setDone(true)}
            style={{
              padding: '6px 14px', borderRadius: '7px',
              fontSize: '12px', fontWeight: 600,
              fontFamily: 'var(--font-primary)',
              cursor: 'pointer',
              border: '1px solid var(--color-border)',
              background: 'transparent',
              color: 'var(--color-text-secondary)',
            }}
          >
            {secondary}
          </button>
        )}
      </div>
    </div>
  );
}

function BriefingRavi() {
  return (
    <>
      <TimelineLead>
        <MorningDeliveriesTldr
          title="TLDR · deliveries & supply"
          items={[
            'Metro £312 credit is past the agreed threshold — needs your nod with finance, not a longer queue.',
            'Matcha will stock out at two sites before the next inbound unless the estate intervenes on orders or transfers.',
            'Estate trading is ahead of last week; margin read is ~72% confident with dry-goods invoices still landing.',
          ]}
        />
      </TimelineLead>

      <Divider />

      <BriefingSection
        icon={BarChart3}
        title="Estate · yesterday vs same day last week"
        index={0}
        dataPoints={[
          { label: 'Net sales (estate)', value: '£48,920', tone: 'positive' },
          { label: 'vs same weekday LY', value: '+6.2%', tone: 'positive' },
        ]}
      >
        <p style={{ margin: '0 0 12px' }}>
          Estate-wide net sales yesterday came in <Hi>about six points ahead</Hi> of the same weekday
          last week once you normalise for the bank holiday shift. Nothing flashing red at the top line.
        </p>
      </BriefingSection>

      <Divider />

      <BriefingSection
        icon={Percent}
        title="Gross margin · how complete is the cost picture?"
        index={1}
        dataPoints={[
          { label: 'Confidence score', value: '72%', tone: 'neutral' },
          { label: 'Main gap', value: '3 late supplier invoices', tone: 'warning' },
        ]}
      >
        <p style={{ margin: '0 0 12px' }}>
          I&apos;m showing a <Hi>gross margin confidence score of 72%</Hi> — meaning roughly three quarters
          of the cost inputs I&apos;d want for a reliable margin read are in. The gap is mostly late
          invoices on dry goods, not missing sales data.
        </p>
      </BriefingSection>

      <Divider />

      <BriefingSection
        icon={Receipt}
        title="Labour · all sites"
        index={2}
        dataPoints={[
          { label: 'Estate vs roster', value: '101% · within tolerance', tone: 'neutral' },
          { label: 'City Centre', value: 'Overspent vs plan', tone: 'warning' },
        ]}
      >
        <p style={{ margin: '0 0 12px' }}>
          Across the chain, labour landed close to plan. The only site that <Hi>meaningfully overspent
          yesterday</Hi> was City Centre — mostly extra cover from a late delivery squeeze. Worth a
          conversation with the GM if that becomes a pattern this week.
        </p>
      </BriefingSection>

      <Divider />

      <BriefingSection icon={AlertCircle} title="What actually needs you" index={3}>
        <p style={{ margin: 0 }}>
          Two things deserve executive attention, not a longer list: <Hi>Metro&apos;s unresolved £312
          credit</Hi> is now past the threshold we agreed with finance, and <Hi>matcha velocity</Hi> at
          two sites will stock out before the next inbound delivery unless we intervene. Everything else
          Quinn or the sites can handle.
        </p>
      </BriefingSection>

      <Divider />

      <BriefingSection icon={Receipt} title="Invoices & credits · stuck items" index={4}>
        <p style={{ margin: '0 0 12px' }}>
          Beyond Metro, there are <Hi>two supplier credits</Hi> over 14 days old that haven&apos;t been
          cleared — I&apos;ve listed them in finance&apos;s queue with suggested owners. No surprises in
          payment runs today.
        </p>
      </BriefingSection>

      <Divider />

      <BriefingSection icon={Package} title="Trading & openings" index={5}>
        <p style={{ margin: 0 }}>
          <Hi>All sites opened on time and traded normally</Hi> yesterday — no closures, no partial
          opens, no card outages logged.
        </p>
      </BriefingSection>

      <div style={{ height: '24px' }} />
    </>
  );
}

function BriefingCheryl() {
  return (
    <>
      <TimelineLead>
        <MorningDeliveriesTldr
          title="TLDR · inbound & deliveries"
          items={[
            '3 PO vs GRN mismatches (Bidfood, Metro) — clear matches, queries, or tolerances before they distort period margin.',
            'Invoices missing from Urban Fresh & Lacto — chase today so dry goods aren’t sitting on accruals you can’t defend.',
            'Flour landed +12% vs contract on inbound — don’t let it flow into recipe costs until variance is accepted or disputed.',
          ]}
        />
      </TimelineLead>

      <Divider />

      <TimelineLead>
      <div style={{ padding: 0, display: 'flex', flexDirection: 'column', gap: '10px' }}>
        <div style={{
          fontSize: '10.5px', fontWeight: 700, letterSpacing: '0.08em',
          textTransform: 'uppercase', color: 'var(--color-text-secondary)',
          marginBottom: '4px',
        }}>
          Overnight · invoice variances
        </div>
        <FinanceActionRow
          title="3 PO mismatches ready for you"
          detail={<>Bidfood (2) and Metro (1) — quantities don&apos;t match GRN. I&apos;ve pre-filled queries you can send as-is or approve a write-off within tolerance.</>}
          primary="Approve or send queries"
          secondary="Defer to tomorrow"
        />
        <FinanceActionRow
          title="Outstanding credit notes"
          detail={<>Metro £312 — <Hi>18 days</Hi> open. Fresh Direct £96 — <Hi>9 days</Hi> open.</>}
          primary="Open credit workflow"
          secondary="Snooze 48h"
        />
        <FinanceActionRow
          title="Suppliers · invoices not arrived when expected"
          detail={<>Urban Fresh (dry schedule) and Lacto Ltd are both past their usual posting window — worth a proactive chase before period close.</>}
          primary="Send chase templates"
          secondary="Mark expected"
        />
        <FinanceActionRow
          title="Period cost completeness"
          detail={<>You&apos;re at <Hi>64% confirmed</Hi> for this period with 36% still in accrual or unmatched invoice. Biggest bucket is dry goods.</>}
          primary="View period breakdown"
          secondary="Export for audit"
        />
        <FinanceActionRow
          title="Price changes on incoming invoices"
          detail={<>Flour SKU on Bidfood came in <Hi>+12%</Hi> with no agreed price change on file — flagged for sign-off before it hits recipe costs.</>}
          primary="Accept variance or dispute"
          secondary="Link to contract"
        />
      </div>
      </TimelineLead>

      <div style={{ height: '24px' }} />
    </>
  );
}

function BriefingGM() {
  return (
    <>
      <BriefingSection
        icon={Truck}
        title="Deliveries expected"
        index={0}
        dataPoints={[
          { label: 'Bidfood', value: '7–9am · 14 lines', tone: 'neutral' },
          { label: 'Fresh Direct', value: '11am · flagged case short', tone: 'warning' },
        ]}
      >
        <div style={{ marginBottom: '12px' }}>
          <div style={{
            fontSize: '10.5px',
            fontWeight: 700,
            letterSpacing: '0.06em',
            textTransform: 'uppercase',
            color: 'var(--color-text-muted)',
            marginBottom: '8px',
          }}>
            TLDR
          </div>
          <div style={{
            padding: '12px 14px',
            borderRadius: '10px',
            background: 'rgba(58,48,40,0.04)',
            border: '1px solid var(--color-border-subtle)',
          }}>
            <DeliveriesTldrBullets
              items={[
                'Bidfood 7–9am (14 lines) — receive as normal; flag anything short vs the docket before you sign.',
                'Fresh Direct 11am — expect one milk case short; don’t sign off until you’ve eyeball-checked the drop.',
                'Matcha runs out Friday at today’s pace — supplier basket already has an extra case; review and send in one pass.',
              ]}
            />
          </div>
        </div>
        <p style={{ margin: 0 }}>
          <Hi>Bidfood</Hi> window as usual. <Hi>Fresh Direct</Hi> pre-flagged a one-case short on milk
          from the order — I&apos;ve noted it so you can check the drop before sign-off.
        </p>
      </BriefingSection>

      <Divider />

      <BriefingSection icon={Package} title="Stock · before next delivery" index={1}>
        <p style={{ margin: 0 }}>
          <Hi>Matcha</Hi> runs out <Hi>Friday</Hi> at current velocity; next inbound is after that unless
          we add a top-up. Syrups are fine.
        </p>
      </BriefingSection>

      <Divider />

      <BriefingSection
        icon={ShoppingCart}
        title="Order basket · one tap"
        index={2}
        dataPoints={[
          { label: 'Bidfood basket', value: '£1,240 est.', tone: 'neutral' },
          { label: 'Suggested tweak', value: '+matcha case', tone: 'warning' },
        ]}
      >
        <p style={{ margin: '0 0 12px' }}>
          I&apos;ve pre-filled tomorrow&apos;s supplier basket including an extra matcha case — adjust in
          one screen, then send.
        </p>
        <button
          type="button"
          style={{
            padding: '8px 16px', borderRadius: '8px',
            fontSize: '12px', fontWeight: 600,
            fontFamily: 'var(--font-primary)',
            cursor: 'pointer', border: 'none',
            background: 'var(--color-accent-deep)',
            color: '#F4F1EC',
          }}
        >
          Review &amp; send basket
        </button>
      </BriefingSection>

      <Divider />

      <BriefingSection icon={ClipboardList} title="Tasks due today" index={3}>
        <p style={{ margin: 0 }}>
          Temperature checks AM/PM, fire door log, and one <Hi>head office policy acknowledgement</Hi>
          outstanding from Tuesday — two minutes in back office.
        </p>
      </BriefingSection>

      <Divider />

      <BriefingSection
        icon={BarChart3}
        title="Yesterday · trading"
        index={4}
        dataPoints={[
          { label: 'Net sales', value: '£6,180', tone: 'positive' },
          { label: 'Labour vs target', value: '102%', tone: 'warning' },
        ]}
      >
        <p style={{ margin: 0 }}>
          Net sales <Hi>on plan</Hi>. Labour nudged over target in the evening rush — not alarming, but
          watch today if deliveries slip again.
        </p>
      </BriefingSection>

      <Divider />

      <BriefingSection icon={ChefHat} title="Waste · worth a look" index={5}>
        <p style={{ margin: 0 }}>
          Pastry waste <Hi>spiked after 3pm</Hi> versus your usual curve — likely over-pull from the
          morning run. Quick huddle with shift lead if it repeats today.
        </p>
      </BriefingSection>

      <div style={{ height: '24px' }} />
    </>
  );
}

function BriefingChairman() {
  return (
    <>
      <TimelineLead>
        <MorningDeliveriesTldr
          title="TLDR · deliveries & supply"
          items={[
            'Estate trading in line with plan overnight — no material inbound or cash shock on the board line.',
            'Two items need executive visibility only: Metro credit age and matcha velocity at two sites (Quinn can brief detail).',
          ]}
        />
      </TimelineLead>

      <div style={{ height: '8px' }} />
    </>
  );
}

function BriefingContent({ role }: { role: BriefingRole }) {
  return (
    <>
      {role === 'chairman' && <BriefingChairman />}
      {role === 'ravi' && <BriefingRavi />}
      {role === 'cheryl' && <BriefingCheryl />}
      {role === 'gm' && <BriefingGM />}
    </>
  );
}

export { BriefingContent };
