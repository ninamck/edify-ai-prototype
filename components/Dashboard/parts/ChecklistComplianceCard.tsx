'use client';

import Link from 'next/link';
import { ClipboardCheck, AlertTriangle, Clock, ArrowRight } from 'lucide-react';
import type { ChecklistComplianceSummary } from '@/app/checklists/mockData';

const OK = '#166534';
const WARN = '#B45309';
const ACCENT = 'var(--color-accent-deep)';

function ringTint(pct: number): string {
  if (pct >= 90) return OK;
  if (pct >= 70) return ACCENT as unknown as string;
  return WARN;
}

function CompletionRing({ pct }: { pct: number }) {
  const size = 92;
  const stroke = 9;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const dash = (pct / 100) * circumference;
  const colour = ringTint(pct);

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ flexShrink: 0 }}>
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke="var(--color-bg-hover)"
        strokeWidth={stroke}
      />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke={colour}
        strokeWidth={stroke}
        strokeDasharray={`${dash} ${circumference - dash}`}
        strokeDashoffset={circumference / 4}
        strokeLinecap="round"
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
        style={{ transition: 'stroke-dasharray 400ms ease' }}
      />
      <text
        x="50%"
        y="50%"
        textAnchor="middle"
        dominantBaseline="central"
        fontSize={20}
        fontWeight={700}
        fill="var(--color-text-primary)"
        fontFamily="var(--font-primary)"
      >
        {pct}%
      </text>
    </svg>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: 'neutral' | 'warn' | 'ok';
}) {
  const colour = tone === 'warn' ? WARN : tone === 'ok' ? OK : 'var(--color-text-primary)';
  return (
    <div
      style={{
        flex: 1,
        minWidth: 0,
        padding: '8px 10px',
        borderRadius: 8,
        background: 'var(--color-bg-canvas)',
        border: '1px solid var(--color-border-subtle)',
      }}
    >
      <div style={{ fontSize: 18, fontWeight: 700, color: colour, lineHeight: 1.1 }}>{value}</div>
      <div style={{ fontSize: 11, fontWeight: 500, color: 'var(--color-text-muted)', marginTop: 2 }}>
        {label}
      </div>
    </div>
  );
}

export default function ChecklistComplianceCard({
  summary,
}: {
  summary: ChecklistComplianceSummary;
}) {
  const {
    completeToday,
    totalToday,
    completionPct,
    inProgressToday,
    overdueToday,
    upcomingToday,
    warnings,
    sevenDayPct,
  } = summary;

  return (
    <div
      style={{
        padding: '16px 16px 14px',
        borderRadius: 12,
        border: '1px solid var(--color-border-subtle)',
        background: '#fff',
        boxShadow: '0 2px 12px rgba(58,48,40,0.1), 0 0 0 1px rgba(58,48,40,0.03)',
        display: 'flex',
        flexDirection: 'column',
        gap: 14,
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <div
          style={{
            width: 28,
            height: 28,
            borderRadius: 8,
            background: 'var(--color-bg-hover)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <ClipboardCheck size={16} color={ACCENT} strokeWidth={2} />
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--color-text-primary)' }}>
            Checklist compliance
          </div>
          <div style={{ fontSize: 11, fontWeight: 500, color: 'var(--color-text-muted)' }}>
            Today across the estate · {sevenDayPct}% completed on time last 7 days
          </div>
        </div>
        <Link
          href="/checklists"
          style={{
            fontSize: 11,
            fontWeight: 600,
            color: 'var(--color-text-secondary)',
            textDecoration: 'none',
            display: 'flex',
            alignItems: 'center',
            gap: 3,
          }}
        >
          View all <ArrowRight size={11} strokeWidth={2.4} />
        </Link>
      </div>

      {/* Ring + headline */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        <CompletionRing pct={completionPct} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--color-text-primary)' }}>
            {completeToday} of {totalToday} complete today
          </div>
          <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--color-text-muted)', marginTop: 3 }}>
            {overdueToday > 0
              ? `${overdueToday} past due — chase outstanding before next shift`
              : inProgressToday > 0
                ? `${inProgressToday} in progress, ${upcomingToday} upcoming`
                : `All on track · ${upcomingToday} still upcoming today`}
          </div>
        </div>
      </div>

      {/* Stat row */}
      <div style={{ display: 'flex', gap: 8 }}>
        <Stat label="Overdue" value={overdueToday} tone={overdueToday > 0 ? 'warn' : 'neutral'} />
        <Stat label="In progress" value={inProgressToday} tone="neutral" />
        <Stat label="Upcoming" value={upcomingToday} tone="neutral" />
        <Stat
          label="Follow-ups raised"
          value={warnings.length}
          tone={warnings.length > 0 ? 'warn' : 'ok'}
        />
      </div>

      {/* Follow-up warnings */}
      {warnings.length > 0 && (
        <div>
          <div
            style={{
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
              color: 'var(--color-text-muted)',
              marginBottom: 8,
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            Follow-ups on completed lists
            <span
              style={{
                fontSize: 10,
                fontWeight: 600,
                padding: '1px 6px',
                borderRadius: 999,
                background: 'rgba(180,83,9,0.12)',
                color: WARN,
                letterSpacing: 0,
                textTransform: 'none',
              }}
            >
              {warnings.length}
            </span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {warnings.map((w, idx) => (
              <Link
                key={`${w.instanceId}-${idx}`}
                href={`/checklists/history/${w.instanceId}`}
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'auto 1fr auto',
                  alignItems: 'start',
                  gap: 10,
                  padding: '8px 10px',
                  borderRadius: 8,
                  background: 'rgba(180,83,9,0.06)',
                  border: '1px solid rgba(180,83,9,0.25)',
                  textDecoration: 'none',
                  color: 'inherit',
                }}
              >
                <AlertTriangle size={14} color={WARN} strokeWidth={2.2} style={{ marginTop: 2 }} />
                <div style={{ minWidth: 0 }}>
                  <div
                    style={{
                      fontSize: 12,
                      fontWeight: 700,
                      color: 'var(--color-text-primary)',
                      display: 'flex',
                      flexWrap: 'wrap',
                      gap: 4,
                    }}
                  >
                    {w.templateName}
                    <span style={{ fontWeight: 500, color: 'var(--color-text-muted)' }}>
                      · {w.site}
                    </span>
                  </div>
                  <div
                    style={{
                      fontSize: 11,
                      fontWeight: 600,
                      color: WARN,
                      marginTop: 2,
                      lineHeight: 1.35,
                    }}
                  >
                    {w.parentQuestion} → <span style={{ fontWeight: 700 }}>{w.parentAnswer}</span>
                  </div>
                  {w.followUpNote && (
                    <div
                      style={{
                        fontSize: 11,
                        fontWeight: 500,
                        color: 'var(--color-text-secondary)',
                        marginTop: 2,
                        fontStyle: 'italic',
                        display: '-webkit-box',
                        WebkitBoxOrient: 'vertical',
                        WebkitLineClamp: 2,
                        overflow: 'hidden',
                      }}
                    >
                      &ldquo;{w.followUpNote}&rdquo;
                    </div>
                  )}
                </div>
                <div
                  style={{
                    fontSize: 11,
                    fontWeight: 500,
                    color: 'var(--color-text-muted)',
                    textAlign: 'right',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 3,
                    whiteSpace: 'nowrap',
                  }}
                >
                  <Clock size={11} strokeWidth={2} />
                  {w.completedAt}
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
