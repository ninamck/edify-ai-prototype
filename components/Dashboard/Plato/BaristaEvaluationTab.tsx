'use client';

import {
  EVAL_BANDS,
  EVAL_DISCIPLINES,
  bandForScore,
  baristaEvalForStore,
  disciplineMax,
  type EvalDiscipline,
} from '@/components/Dashboard/data/platoMockData';

function DisciplineCard({ discipline, score }: { discipline: EvalDiscipline; score: number }) {
  const max = disciplineMax(discipline);
  const pct = Math.round((score / max) * 100);
  return (
    <section
      style={{
        borderRadius: 12,
        border: '1px solid var(--color-border-subtle)',
        background: '#fff',
        boxShadow: '0 2px 12px rgba(0, 28, 53,0.06)',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '12px 14px',
          borderBottom: '1px solid var(--color-border-subtle)',
          background: 'var(--color-bg-hover)',
        }}
      >
        <div style={{ flex: 1, minWidth: 0 }}>
          <h3 style={{ margin: 0, fontSize: 13, fontWeight: 700, color: 'var(--color-text-primary)' }}>
            {discipline.name}
          </h3>
          <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-text-muted)', marginTop: 1 }}>
            Weight {Math.round(discipline.weight * 100)}%
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--color-text-primary)' }}>
            {score}/{max}
          </div>
          <div style={{ fontSize: 11, fontWeight: 600, color: bandForScore(pct).color }}>{pct}%</div>
        </div>
      </div>
      <div style={{ padding: '6px 14px 10px' }}>
        {discipline.criteria.map((c, idx) => (
          <div
            key={c.name}
            style={{
              display: 'flex',
              alignItems: 'baseline',
              gap: 8,
              padding: '6px 0',
              borderBottom: idx === discipline.criteria.length - 1 ? 'none' : '1px solid var(--color-border-subtle)',
            }}
          >
            <span style={{ flex: 1, fontSize: 12, fontWeight: 500, color: 'var(--color-text-primary)', minWidth: 0 }}>
              {c.name}
            </span>
            <span style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--color-text-muted)', whiteSpace: 'nowrap' }}>
              {c.max} pt{c.max === 1 ? '' : 's'}
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}

export default function BaristaEvaluationTab({ store }: { store: string }) {
  const { meta, scores, weightedScore: totalScore, monthly } = baristaEvalForStore(store);
  const band = bandForScore(totalScore);
  const tracked = monthly.filter((m) => m.score !== null) as { month: string; score: number }[];
  const yearAverage =
    tracked.length > 0 ? Math.round((tracked.reduce((s, m) => s + m.score, 0) / tracked.length) * 10) / 10 : 0;
  const maxBar = 100;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, fontFamily: 'var(--font-primary)' }}>
      <header style={{ display: 'flex', alignItems: 'flex-end', gap: 12, flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 220 }}>
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
            Platō Coffee barista evaluation
          </div>
          <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--color-text-primary)' }}>
            {meta.barista} · {meta.store}
          </div>
          <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--color-text-muted)', marginTop: 4 }}>
            Evaluated {meta.date} · 10 disciplines, weighted total
          </div>
        </div>
        <div
          style={{
            padding: '12px 18px',
            borderRadius: 12,
            border: '1px solid var(--color-border-subtle)',
            background: '#fff',
            boxShadow: '0 2px 12px rgba(0, 28, 53,0.06)',
            textAlign: 'right',
          }}
        >
          <div style={{ fontSize: 28, fontWeight: 700, color: band.color, lineHeight: 1.1 }}>{totalScore}%</div>
          <div style={{ fontSize: 11.5, fontWeight: 700, color: band.color }}>{band.label}</div>
        </div>
      </header>

      {/* Monthly tracking */}
      <section
        style={{
          padding: '16px 16px 14px',
          borderRadius: 12,
          border: '1px solid var(--color-border-subtle)',
          background: '#fff',
          boxShadow: '0 2px 12px rgba(0, 28, 53,0.06)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 12 }}>
          <h3 style={{ margin: 0, fontSize: 13, fontWeight: 700, color: 'var(--color-text-primary)', flex: 1 }}>
            Performance summary &amp; tracking
          </h3>
          <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-text-muted)' }}>
            Year average · <span style={{ color: bandForScore(yearAverage).color }}>{yearAverage}%</span>
          </span>
        </div>
        <div style={{ display: 'flex', gap: 6, alignItems: 'flex-end', height: 120 }}>
          {monthly.map((m) => {
            const has = m.score !== null;
            const h = has ? Math.max(6, (m.score! / maxBar) * 100) : 0;
            return (
              <div key={m.month} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, minWidth: 0 }}>
                <span style={{ fontSize: 10.5, fontWeight: 600, color: has ? bandForScore(m.score!).color : 'var(--color-text-muted)' }}>
                  {has ? `${m.score}%` : '—'}
                </span>
                <div
                  style={{
                    width: '100%',
                    maxWidth: 34,
                    height: `${h}%`,
                    minHeight: has ? 6 : 2,
                    borderRadius: 4,
                    background: has ? bandForScore(m.score!).color : 'var(--color-border-subtle)',
                    opacity: has ? 0.9 : 1,
                  }}
                />
                <span
                  style={{
                    fontSize: 10,
                    fontWeight: 600,
                    color: 'var(--color-text-muted)',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    maxWidth: '100%',
                  }}
                >
                  {m.month.slice(0, 3)}
                </span>
              </div>
            );
          })}
        </div>
      </section>

      {/* Performance bands */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {EVAL_BANDS.map((b) => (
          <div
            key={b.range}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '6px 12px',
              borderRadius: 999,
              border: '1px solid var(--color-border-subtle)',
              background: '#fff',
              fontSize: 11.5,
              fontWeight: 600,
            }}
          >
            <span style={{ width: 8, height: 8, borderRadius: 999, background: b.color }} />
            <span style={{ color: 'var(--color-text-primary)' }}>{b.range}</span>
            <span style={{ color: 'var(--color-text-muted)' }}>{b.label}</span>
          </div>
        ))}
      </div>

      {/* Disciplines */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
          gap: 14,
          alignItems: 'start',
        }}
      >
        {EVAL_DISCIPLINES.map((d) => (
          <DisciplineCard key={d.id} discipline={d} score={scores[d.id] ?? 0} />
        ))}
      </div>
    </div>
  );
}
