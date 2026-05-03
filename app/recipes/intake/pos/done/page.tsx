'use client';

import { Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { motion } from 'framer-motion';
import { Check, AlertTriangle, ArrowRight, BookOpen } from 'lucide-react';
import EdifyMark from '@/components/EdifyMark/EdifyMark';

type GroupSummary = { name: string; count: number };

const GROUP_SUMMARIES: GroupSummary[] = [
  { name: 'Alt milks', count: 14 },
  { name: 'Pour size', count: 22 },
  { name: 'Cup sizes', count: 8 },
];

export default function DonePageWrapper() {
  return (
    <Suspense fallback={<div style={{ padding: 24 }}>Loading…</div>}>
      <DonePage />
    </Suspense>
  );
}

function DonePage() {
  const router = useRouter();
  const params = useSearchParams();
  const ok = Number(params.get('ok') ?? 15);
  const warn = Number(params.get('warn') ?? 6);
  const total = Number(params.get('total') ?? ok + warn);
  const groupsAttached = Number(params.get('groups') ?? 0);

  const groups = GROUP_SUMMARIES.slice(0, Math.max(groupsAttached, 0));

  return (
    <div style={{ padding: '28px 24px 80px', maxWidth: '720px', margin: '0 auto', fontFamily: 'var(--font-primary)' }}>
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25 }}
      >
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '44px',
            height: '44px',
            borderRadius: '12px',
            background: 'var(--color-success-light)',
            marginBottom: '12px',
          }}
        >
          <Check size={24} color="var(--color-success)" strokeWidth={2.8} />
        </div>
        <h1 style={{ fontSize: '24px', fontWeight: 700, margin: '0 0 6px', color: 'var(--color-text-primary)' }}>
          {total} recipes drafted
        </h1>
        <p style={{ fontSize: '13.5px', color: 'var(--color-text-muted)', margin: '0 0 24px', lineHeight: 1.5 }}>
          All drafts saved. Publish the clean ones now, or open the review queue to check the flagged ones first.
        </p>

        {/* Breakdown */}
        <div
          style={{
            border: '1px solid var(--color-border-subtle)',
            borderRadius: '14px',
            background: '#fff',
            overflow: 'hidden',
            marginBottom: '20px',
          }}
        >
          <BreakdownRow
            icon={<Check size={15} strokeWidth={2.6} color="var(--color-success)" />}
            iconBg="var(--color-success-light)"
            label={`${ok} ready to publish`}
            hint="All ingredients matched, cost plausible vs menu price."
          />
          <BreakdownRow
            icon={<AlertTriangle size={15} strokeWidth={2.4} color="var(--color-warning)" />}
            iconBg="var(--color-warning-light)"
            label={`${warn} need your review`}
            hint="Ambiguous ingredients, missing production visibility, or unusual costs."
            action={{
              label: 'Open review queue',
              onClick: () => router.push('/recipes?needs_review=1'),
            }}
            isLast
          />
        </div>

        {/* Shared groups */}
        {groups.length > 0 && (
          <>
            <div
              style={{
                fontSize: '11px', fontWeight: 700, letterSpacing: '0.08em',
                textTransform: 'uppercase', color: 'var(--color-text-muted)', marginBottom: '10px',
              }}
            >
              Shared modifier groups created
            </div>
            <div
              style={{
                border: '1px solid var(--color-border-subtle)',
                borderRadius: '14px',
                background: '#fff',
                overflow: 'hidden',
                marginBottom: '28px',
              }}
            >
              {groups.map((g, i) => (
                <div
                  key={g.name}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    padding: '12px 14px',
                    borderBottom: i < groups.length - 1 ? '1px solid var(--color-border-subtle)' : 'none',
                  }}
                >
                  <span
                    style={{
                      width: '30px', height: '30px', borderRadius: '8px',
                      background: 'rgba(3,28,89,0.08)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                    }}
                  >
                    <EdifyMark size={15} color="var(--color-accent-active)" strokeWidth={2} />
                  </span>
                  <span style={{ fontSize: '13.5px', fontWeight: 600, color: 'var(--color-text-primary)', flex: 1 }}>
                    {g.name}
                  </span>
                  <span style={{ fontSize: '12.5px', color: 'var(--color-text-muted)' }}>
                    attached to {g.count} recipe{g.count === 1 ? '' : 's'}
                  </span>
                </div>
              ))}
            </div>
          </>
        )}

        {/* CTAs */}
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <button
            onClick={() => router.push('/recipes')}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              padding: '12px 18px',
              borderRadius: '10px',
              border: 'none',
              background: 'var(--color-accent-active)',
              fontSize: '13px',
              fontWeight: 600,
              color: '#fff',
              fontFamily: 'var(--font-primary)',
              cursor: 'pointer',
            }}
          >
            <BookOpen size={14} strokeWidth={2} />
            Open recipe library
            <ArrowRight size={14} strokeWidth={2} />
          </button>
          <button
            onClick={() => router.push('/recipes?needs_review=1')}
            style={{
              padding: '12px 18px',
              borderRadius: '10px',
              border: '1px solid var(--color-border)',
              background: '#fff',
              fontSize: '13px',
              fontWeight: 600,
              color: 'var(--color-text-primary)',
              fontFamily: 'var(--font-primary)',
              cursor: 'pointer',
            }}
          >
            Review {warn} flagged
          </button>
        </div>
      </motion.div>
    </div>
  );
}

function BreakdownRow({
  icon, iconBg, label, hint, action, isLast,
}: {
  icon: React.ReactNode;
  iconBg: string;
  label: string;
  hint: string;
  action?: { label: string; onClick: () => void };
  isLast?: boolean;
}) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '14px',
        padding: '14px 16px',
        borderBottom: isLast ? 'none' : '1px solid var(--color-border-subtle)',
      }}
    >
      <span
        style={{
          width: '28px', height: '28px', borderRadius: '8px',
          background: iconBg,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        {icon}
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--color-text-primary)', marginBottom: '2px' }}>
          {label}
        </div>
        <div style={{ fontSize: '12.5px', color: 'var(--color-text-muted)', lineHeight: 1.4 }}>
          {hint}
        </div>
      </div>
      {action && (
        <button
          onClick={action.onClick}
          style={{
            padding: '7px 12px',
            borderRadius: '8px',
            border: '1px solid var(--color-border)',
            background: '#fff',
            fontSize: '12px',
            fontWeight: 600,
            color: 'var(--color-text-primary)',
            fontFamily: 'var(--font-primary)',
            cursor: 'pointer',
            whiteSpace: 'nowrap',
          }}
        >
          {action.label}
        </button>
      )}
    </div>
  );
}
