'use client';

import { FLOW_META, flowDataForDate } from '@/components/Dashboard/data/platoMockData';

const NEGATIVE = '#d44d4d';
const POSITIVE = '#21a87a';
const WARNING = '#d4904d';

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        padding: '16px 16px 14px',
        borderRadius: 12,
        border: '1px solid var(--color-border-subtle)',
        background: '#fff',
        boxShadow: '0 2px 12px rgba(0, 28, 53,0.06)',
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
        minWidth: 0,
      }}
    >
      {children}
    </div>
  );
}

function BigStat({
  value,
  unit,
  label,
  color,
}: {
  value: string;
  unit?: string;
  label: string;
  color?: string;
}) {
  return (
    <div style={{ minWidth: 0 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 2 }}>
        <span
          style={{
            fontSize: 30,
            fontWeight: 700,
            letterSpacing: '-0.01em',
            color: color ?? 'var(--color-text-primary)',
            lineHeight: 1.1,
          }}
        >
          {value}
        </span>
        {unit && (
          <span style={{ fontSize: 14, fontWeight: 700, color: color ?? 'var(--color-text-muted)' }}>{unit}</span>
        )}
      </div>
      <div
        style={{
          marginTop: 4,
          fontSize: 10.5,
          fontWeight: 700,
          letterSpacing: 0.6,
          textTransform: 'uppercase',
          color: 'var(--color-text-muted)',
        }}
      >
        {label}
      </div>
    </div>
  );
}

function SplitRow({ name, value, dotColor }: { name: string; value: string; dotColor: string }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '7px 0',
        borderBottom: '1px solid var(--color-border-subtle)',
        fontSize: 12.5,
      }}
    >
      <span style={{ width: 8, height: 8, borderRadius: 2, background: dotColor, flexShrink: 0, transform: 'rotate(45deg)' }} />
      <span style={{ flex: 1, fontWeight: 500, color: 'var(--color-text-primary)', minWidth: 0 }}>{name}</span>
      <span style={{ fontWeight: 700, color: 'var(--color-text-primary)' }}>{value}</span>
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        fontSize: 10.5,
        fontWeight: 700,
        letterSpacing: 0.6,
        textTransform: 'uppercase',
        color: 'var(--color-text-muted)',
      }}
    >
      {children}
    </div>
  );
}

function rankSuffix(n: number): string {
  if (n === 1) return 'st';
  if (n === 2) return 'nd';
  if (n === 3) return 'rd';
  return 'th';
}

export default function FlowMetRecipeTab({ date, store }: { date: string; store: string }) {
  const data = flowDataForDate(date, store);
  const ownRank = data.leaderboard.find((row) => row.site === store)?.rank ?? 1;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, fontFamily: 'var(--font-primary)' }}>
      <header>
        <div
          style={{
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: 0.6,
            textTransform: 'uppercase',
            color: 'var(--color-text-muted)',
            marginBottom: 6,
          }}
        >
          Flow · Met Recipe
        </div>
        <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--color-text-primary)' }}>{store}</div>
        <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--color-text-muted)', marginTop: 4 }}>
          Timezone {FLOW_META.timezone} · Updated {FLOW_META.updated}
        </div>
      </header>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: 14,
          alignItems: 'stretch',
        }}
      >
        {/* Shots & bean usage */}
        <Card>
          <div style={{ display: 'flex', gap: 18 }}>
            <BigStat value={String(data.shots.total)} label="Total shots" />
            <BigStat value={`${data.shots.binnedPct}`} unit="%" label="Binned" />
          </div>
          <div>
            {data.shots.split.map((s, i) => (
              <SplitRow
                key={s.name}
                name={s.name}
                value={`${s.pct}%`}
                dotColor={i === 0 ? WARNING : 'var(--color-accent-active)'}
              />
            ))}
          </div>
          <div style={{ display: 'flex', gap: 18, marginTop: 4 }}>
            <BigStat value={String(data.beanUsage.todayKg)} unit="kg" label="Bean usage" />
            <BigStat value={String(data.beanUsage.sevenDayAvgKg)} unit="kg" label="7 day avg" />
          </div>
          <div>
            {data.beanUsage.split.map((s, i) => (
              <SplitRow
                key={s.name}
                name={s.name}
                value={`${s.kg}kgs`}
                dotColor={i === 0 ? WARNING : 'var(--color-accent-active)'}
              />
            ))}
          </div>
          <div style={{ marginTop: 'auto', paddingTop: 6 }}>
            <SectionLabel>Cleaning cycles</SectionLabel>
            <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--color-text-muted)', marginTop: 4 }}>
              Not shown for the current day
            </div>
          </div>
        </Card>

        {/* Met recipe */}
        <Card>
          <BigStat value={`${data.metRecipe.metPct}`} unit="%" label="Met recipe" />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <BigStat value={`${data.metRecipe.perfectPct}`} unit="%" label="Perfect" color={POSITIVE} />
            <BigStat value={`${data.metRecipe.okPct}`} unit="%" label="OK" color={WARNING} />
          </div>
          <div>
            <SectionLabel>Met recipe by recipe</SectionLabel>
            {data.metRecipe.byRecipe.map((r, i) => (
              <SplitRow
                key={r.name}
                name={r.name}
                value={`${r.pct}%`}
                dotColor={i === 0 ? WARNING : 'var(--color-accent-active)'}
              />
            ))}
          </div>
          <div>
            <SectionLabel>Met recipe by group head</SectionLabel>
            {data.metRecipe.byGroupHead.map((g) => (
              <SplitRow key={g.name} name={g.name} value={`${g.pct}%`} dotColor="var(--color-accent-deep)" />
            ))}
          </div>
        </Card>

        {/* Missed on time */}
        <Card>
          <BigStat value={`${data.missedTime.pct}`} unit="%" label="Missed on time" />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div>
              <BigStat value={`${data.missedTime.tooSlowPct}`} unit="%" label="" color={NEGATIVE} />
              <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: 0.6, textTransform: 'uppercase', color: 'var(--color-text-muted)' }}>
                Avg {data.missedTime.tooSlowAvg} · too slow
              </div>
            </div>
            <div>
              <BigStat value={`${data.missedTime.tooFastPct}`} unit="%" label="" color={NEGATIVE} />
              <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: 0.6, textTransform: 'uppercase', color: 'var(--color-text-muted)' }}>
                Avg {data.missedTime.tooFastAvg} · too fast
              </div>
            </div>
          </div>
        </Card>

        {/* Missed on volume */}
        <Card>
          <BigStat value={`${data.missedVolume.pct}`} unit="%" label="Missed on volume" />
          <div>
            {data.missedVolume.byGroupHead.map((g) => (
              <SplitRow key={g.name} name={g.name} value={`${g.pct}%`} dotColor="var(--color-accent-deep)" />
            ))}
          </div>
        </Card>

        {/* Leaderboard */}
        <Card>
          <BigStat value={String(ownRank)} unit={rankSuffix(ownRank)} label="By % met recipe" />
          <div>
            {data.leaderboard.map((row) => {
              const own = row.site === store;
              return (
                <div
                  key={row.rank}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    padding: '8px 0',
                    borderBottom: '1px solid var(--color-border-subtle)',
                    fontSize: 12.5,
                  }}
                >
                  <span
                    style={{
                      flex: 1,
                      fontWeight: own ? 700 : 500,
                      color: own ? 'var(--color-text-primary)' : 'var(--color-text-muted)',
                      minWidth: 0,
                    }}
                  >
                    {row.rank}. {row.site}
                  </span>
                  <span style={{ fontWeight: 700, color: 'var(--color-text-primary)' }}>{row.pct}%</span>
                </div>
              );
            })}
          </div>
          <div style={{ marginTop: 'auto' }}>
            <span
              style={{
                display: 'inline-block',
                padding: '7px 14px',
                borderRadius: 8,
                border: '1px solid var(--color-border-subtle)',
                fontSize: 12,
                fontWeight: 600,
                color: 'var(--color-text-muted)',
              }}
            >
              View all sites →
            </span>
          </div>
        </Card>
      </div>
    </div>
  );
}
