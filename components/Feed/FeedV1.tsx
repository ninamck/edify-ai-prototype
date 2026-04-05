'use client';

/**
 * Frozen v1 feed — original “Nina / Fitzroy” morning briefing only.
 * Does not use shared Feed.tsx so /v1 stays stable when Latest evolves.
 */

import { useState } from 'react';
import {
  Package,
  Receipt,
  ChefHat,
  BarChart3,
  Send,
  Sparkles,
  AlertCircle,
  TrendingUp,
  CloudRain,
  ArrowUp,
  ArrowDown,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

function QuinnAvatar({ size = 30 }: { size?: number }) {
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%',
      background: 'var(--color-quinn-bg)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      flexShrink: 0,
    }}>
      <Sparkles size={size * 0.45} color="var(--color-accent-quinn)" strokeWidth={2} />
    </div>
  );
}

function Hi({ children }: { children: React.ReactNode }) {
  return (
    <span style={{ fontWeight: 700, color: 'var(--color-text-primary)' }}>
      {children}
    </span>
  );
}

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
      style={{ padding: '0 28px 0 20px' }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '7px', marginBottom: '10px' }}>
        <span style={{
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          width: '22px', height: '22px', borderRadius: '6px',
          background: 'var(--color-bg-surface)', flexShrink: 0,
        }}>
          <Icon size={12} color="var(--color-text-secondary)" strokeWidth={2} />
        </span>
        <span style={{
          fontSize: '12px', fontWeight: 700, letterSpacing: '0.04em',
          textTransform: 'uppercase', color: 'var(--color-text-secondary)',
        }}>
          {title}
        </span>
      </div>
      <div style={{
        fontSize: '13.5px', color: 'var(--color-text-secondary)',
        lineHeight: 1.7, marginBottom: dataPoints ? '12px' : 0,
      }}>
        {children}
      </div>
      {dataPoints && (
        <div style={{
          display: 'flex', flexDirection: 'column', gap: '5px',
          background: 'rgba(58,48,40,0.04)',
          borderRadius: '8px', padding: '10px 12px',
        }}>
          {dataPoints.map((dp, i) => (
            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '12px', fontWeight: 500, color: 'var(--color-text-muted)' }}>{dp.label}</span>
              <span style={{
                fontSize: '12px', fontWeight: 700,
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

function Divider() {
  return <div style={{ height: '1px', background: 'var(--color-border-subtle)', margin: '20px 20px' }} />;
}

interface ChangeRow {
  label: string;
  direction: 'up' | 'down';
  detail: string;
}

interface ActionItemProps {
  id: string;
  tag?: { icon: React.ElementType; label: string; color: string; bg: string };
  summary: React.ReactNode;
  changes?: ChangeRow[];
  primary: string;
  secondary?: string;
  index: number;
}

function ActionItem({ tag, summary, changes, primary, secondary, index }: ActionItemProps) {
  const [done, setDone] = useState(false);
  if (done) return null;
  const TagIcon = tag?.icon;

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, height: 0 }}
      transition={{ delay: 0.45 + index * 0.06, duration: 0.24, ease: 'easeOut' }}
      style={{
        background: '#fff',
        borderRadius: '10px',
        border: '1px solid var(--color-border-subtle)',
        overflow: 'hidden',
        boxShadow: '0 2px 8px rgba(58,48,40,0.08), 0 0 0 1px rgba(58,48,40,0.03)',
      }}
    >
      {tag && TagIcon && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: '5px',
          padding: '7px 14px',
          background: tag.bg,
          borderBottom: '1px solid var(--color-border-subtle)',
        }}>
          <TagIcon size={11} color={tag.color} strokeWidth={2.2} />
          <span style={{ fontSize: '12px', fontWeight: 700, color: tag.color, letterSpacing: '0.04em' }}>
            {tag.label}
          </span>
        </div>
      )}
      <div style={{ padding: '12px 14px' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', marginBottom: changes ? '12px' : '10px' }}>
          <AlertCircle size={14} color="var(--color-accent-quinn)" style={{ flexShrink: 0, marginTop: '2px' }} />
          <p style={{ margin: 0, fontSize: '13px', color: 'var(--color-text-secondary)', lineHeight: 1.6 }}>
            {summary}
          </p>
        </div>
        {changes && (
          <div style={{
            background: 'var(--color-bg-nav)',
            borderRadius: '8px',
            padding: '8px 10px',
            marginBottom: '12px',
            display: 'flex', flexDirection: 'column', gap: '6px',
          }}>
            {changes.map((c, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
                <span style={{
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                  width: '16px', height: '16px', borderRadius: '4px', flexShrink: 0,
                  background: c.direction === 'up' ? '#D8F3DC' : '#FFE8E8',
                }}>
                  {c.direction === 'up'
                    ? <ArrowUp size={9} color="#2D6A4F" strokeWidth={2.5} />
                    : <ArrowDown size={9} color="#9B2226" strokeWidth={2.5} />}
                </span>
                <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--color-text-primary)', flex: 1 }}>
                  {c.label}
                </span>
                <span style={{ fontSize: '12px', fontWeight: 500, color: 'var(--color-text-muted)' }}>{c.detail}</span>
              </div>
            ))}
          </div>
        )}
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
    </motion.div>
  );
}

const TODAY = new Intl.DateTimeFormat('en-GB', {
  weekday: 'long', day: 'numeric', month: 'long',
}).format(new Date());

export default function FeedV1() {
  return (
    <div style={{
      flex: 1,
      display: 'flex',
      flexDirection: 'column',
      height: 'calc(100vh - 24px)',
      background: 'var(--color-bg-nav)',
      borderRadius: 'var(--radius-nav)',
      margin: '12px 12px 12px 8px',
      overflow: 'hidden',
      fontFamily: 'var(--font-primary)',
    }}>
      <div style={{
        padding: '16px 20px',
        borderBottom: '1px solid var(--color-border-subtle)',
        display: 'flex', alignItems: 'center', gap: '10px',
        flexShrink: 0,
      }}>
        <QuinnAvatar />
        <div>
          <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--color-text-primary)' }}>Quinn</div>
          <div style={{ fontSize: '12px', fontWeight: 500, color: 'var(--color-text-muted)', marginTop: '1px' }}>
            Morning briefing · {TODAY}
          </div>
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', paddingTop: '24px', paddingBottom: '8px' }}>
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, ease: 'easeOut' }}
          style={{ padding: '0 28px 0 20px', marginBottom: '22px' }}
        >
          <p style={{ margin: 0, fontSize: '15px', fontWeight: 600, color: 'var(--color-text-primary)', lineHeight: 1.5 }}>
            Good morning, Nina.
          </p>
          <p style={{ margin: '6px 0 0', fontSize: '13.5px', color: 'var(--color-text-secondary)', lineHeight: 1.7 }}>
            Five things need your attention, then here&apos;s the full picture for today.
          </p>
        </motion.div>

        <Divider />

        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1, duration: 0.28, ease: 'easeOut' }}
          style={{ padding: '0 28px 0 20px' }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '7px', marginBottom: '12px' }}>
            <span style={{
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              width: '22px', height: '22px', borderRadius: '6px',
              background: '#FEF0DF', flexShrink: 0,
            }}>
              <AlertCircle size={12} color="#7A3800" strokeWidth={2} />
            </span>
            <span style={{
              fontSize: '12px', fontWeight: 700, letterSpacing: '0.04em',
              textTransform: 'uppercase', color: '#7A3800',
            }}>
              Needs your eye
            </span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <AnimatePresence>
              <ActionItem
                id="doughnut-pattern"
                index={0}
                tag={{ icon: TrendingUp, label: 'Pattern detected — recurring order', color: '#224444', bg: '#E8F2F2' }}
                summary={
                  <>
                    <Hi>Fitzroy Espresso</Hi> has run out of doughnuts before 2pm on{' '}
                    <Hi>11 of the last 14 days</Hi>, while croissants are going to waste
                    most afternoons. I&apos;d like to rebalance the recurring order —
                    more doughnuts, fewer croissants.
                  </>
                }
                changes={[
                  { label: 'Doughnuts', direction: 'up', detail: '+20 per day · +£18.00' },
                  { label: 'Croissants', direction: 'down', detail: '−12 per day · −£8.40' },
                ]}
                primary="Update recurring order"
                secondary="Review first"
              />
              <ActionItem
                id="weather-order"
                index={1}
                tag={{ icon: CloudRain, label: 'Weather forecast — City Centre store', color: '#4A5568', bg: '#EDF2F7' }}
                summary={
                  <>
                    Rain and cold is forecast all week for <Hi>City Centre</Hi>. In
                    similar weather weeks over the past year, foot traffic dropped{' '}
                    <Hi>20–25%</Hi> and we over-ordered significantly. I&apos;d recommend
                    pulling next week&apos;s order back by 20% to protect margin.
                  </>
                }
                changes={[
                  { label: "Next week's order", direction: 'down', detail: '−20% · saves ~£248' },
                ]}
                primary="Reduce order 20%"
                secondary="Keep as is"
              />
              <ActionItem
                id="order"
                index={2}
                summary={
                  <>
                    I&apos;ve prepared an order for <Hi>Bidfood</Hi> — 14 items,
                    estimated <Hi>£1,240</Hi>, for Thursday delivery. Ready to send
                    but wanted your sign-off first.
                  </>
                }
                primary="Send order"
                secondary="Review first"
              />
              <ActionItem
                id="mapping"
                index={3}
                summary={
                  <>
                    <Hi>Urban Fresh</Hi> added a new 1kg spinach SKU. I need to map
                    it to your existing recipes before I can use it in production
                    planning.
                  </>
                }
                primary="Map now"
                secondary="Ignore"
              />
              <ActionItem
                id="recosting"
                index={4}
                summary={
                  <>
                    Flour price is up 12% — this affects <Hi>4 recipes</Hi> including
                    sourdough and the focaccia. Want me to re-cost them with
                    the updated supplier pricing?
                  </>
                }
                primary="Re-cost recipes"
                secondary="Not now"
              />
            </AnimatePresence>
          </div>
        </motion.div>

        <Divider />

        <BriefingSection icon={Package} title="Deliveries today" index={0}>
          <p style={{ margin: 0 }}>
            <Hi>Bidfood</Hi> is due <Hi>7–9am</Hi> — 14 items, £1,240 estimated.
            <Hi> Fresh Direct</Hi> confirmed for <Hi>11am</Hi>. Metro still hasn&apos;t
            confirmed their slot — I&apos;ll chase them at 8am and flag you if it looks like it
            might not come.
          </p>
        </BriefingSection>

        <Divider />

        <BriefingSection
          icon={ChefHat}
          title="Production"
          index={1}
          dataPoints={[
            { label: 'Coffee', value: '+8% vs forecast', tone: 'positive' },
            { label: 'Bread units adjusted', value: '↓ 12 units', tone: 'neutral' },
            { label: 'Flour cost change', value: '+12% this week', tone: 'warning' },
          ]}
        >
          <p style={{ margin: '0 0 12px' }}>
            Coffee sales tracked <Hi>8% above forecast</Hi> yesterday so I&apos;ve left
            that unchanged. For bread, I&apos;ve pulled the afternoon run down by{' '}
            <Hi>12 units</Hi> — flour cost is up 12% from the supplier price
            change, so I erred on the side of less to protect margin until you&apos;ve
            had a chance to re-cost those recipes.
          </p>
        </BriefingSection>

        <Divider />

        <BriefingSection
          icon={Receipt}
          title="Finance"
          index={2}
          dataPoints={[
            { label: 'Invoices matched', value: '11 of 14', tone: 'neutral' },
            { label: 'Bidfood credit note', value: '£240 · resolved', tone: 'positive' },
            { label: 'Metro credit note', value: '£312 · still outstanding', tone: 'warning' },
          ]}
        >
          <p style={{ margin: '0 0 12px' }}>
            I matched <Hi>11 of 14 invoices</Hi> to POs and GRNs overnight. Three
            have discrepancies I&apos;m still working through — I&apos;ll flag them to you
            once confirmed. Bidfood resolved their £240 credit note. Metro still
            haven&apos;t responded on the <Hi>£312</Hi> from last week — I chased them
            again this morning and will escalate to finance if nothing by EOD Friday.
          </p>
        </BriefingSection>

        <Divider />

        <BriefingSection
          icon={BarChart3}
          title="Performance — week ending Sunday"
          index={3}
          dataPoints={[
            { label: 'Revenue', value: '£24,180 · 103% of budget', tone: 'positive' },
            { label: 'Labour', value: '£6,440 · 98% of budget', tone: 'positive' },
            { label: 'Food cost', value: '28.4% · target 28.0%', tone: 'warning' },
          ]}
        >
          <p style={{ margin: '0 0 12px' }}>
            Last week was broadly on track. Revenue and labour both landed well.
            Food cost came in <Hi>slightly above target</Hi> at 28.4% —
            the bread cost variance above is the main driver. Worth keeping an eye on
            this week given the flour price change.
          </p>
        </BriefingSection>

        <div style={{ height: '24px' }} />
      </div>

      <div style={{
        borderTop: '1px solid var(--color-border-subtle)',
        padding: '12px 16px', flexShrink: 0,
      }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: '10px',
          background: '#fff',
          borderRadius: '12px',
          border: '1px solid var(--color-border-subtle)',
          padding: '10px 14px',
          boxShadow: '0 2px 8px rgba(58,48,40,0.08), 0 0 0 1px rgba(58,48,40,0.03)',
        }}>
          <input
            placeholder="Ask Quinn anything…"
            style={{
              flex: 1, border: 'none', outline: 'none',
              fontSize: '13.5px', color: 'var(--color-text-primary)',
              background: 'transparent', fontFamily: 'var(--font-primary)',
            }}
          />
          <button
            type="button"
            style={{
              width: '30px', height: '30px', borderRadius: '8px',
              background: 'var(--color-accent-deep)',
              border: 'none', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <Send size={13} color="#F4F1EC" />
          </button>
        </div>
      </div>
    </div>
  );
}
