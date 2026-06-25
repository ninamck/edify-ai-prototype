'use client';

/**
 * AiForecastImpact — the headline "AI vs the old way" forecast demo.
 *
 * One service, run two ways against identical real demand:
 *   • AI forecast (Edify) — tracks the live demand curve + Quinn's re-cuts.
 *   • Fixed par (old way) — a flat number cooked every window, all day.
 *
 * The scoreboard makes the benefit money-legible: waste binned and sales
 * missed, in £, ticking live as the lunch rush plays out, with a projected
 * full-day saving as the headline. Driven entirely by `forecastImpactStore`.
 */

import {
  Play,
  Pause,
  RotateCcw,
  SkipForward,
  Sparkles,
  Trash2,
  TrendingDown,
  Flame,
  TrendingUp,
} from 'lucide-react';
import {
  useForecastImpact,
  gbp,
  type StrategyScore,
  type RecutTone,
} from './forecastImpactStore';

const AI_ACCENT = '#2f6df6';
const BASE_ACCENT = '#9aa3b2';
const WASTE_COLOR = '#e0533d';
const MISS_COLOR = '#d99a1c';
const SAVE_COLOR = '#2fa36b';

export default function AiForecastImpact() {
  const loop = useForecastImpact();
  const proj = loop.projectedFullDay;

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 16,
        padding: '20px 28px 48px',
        maxWidth: 1180,
        margin: '0 auto',
        fontFamily: 'var(--font-primary)',
      }}
    >
      <HeaderRow />

      {/* Hero — projected full-day saving */}
      <section
        style={{
          background: `linear-gradient(135deg, ${AI_ACCENT} 0%, #6a4df6 100%)`,
          color: '#fff',
          borderRadius: 18,
          padding: '22px 26px',
          display: 'flex',
          alignItems: 'center',
          gap: 28,
          flexWrap: 'wrap',
          boxShadow: '0 18px 44px rgba(47,109,246,0.28)',
        }}
      >
        <div style={{ flex: '1 1 320px', minWidth: 260 }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 7, fontSize: 12, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', opacity: 0.85 }}>
            <Sparkles size={14} /> AI forecast · projected today
          </div>
          <div style={{ fontSize: 52, fontWeight: 900, lineHeight: 1.04, marginTop: 6, fontVariantNumeric: 'tabular-nums' }}>
            {gbp(proj.saved)}
          </div>
          <div style={{ fontSize: 15, opacity: 0.92, marginTop: 4 }}>
            saved vs cooking to a fixed par — less binned, fewer sales missed.
          </div>
        </div>
        <div
          style={{
            flex: '0 0 auto',
            display: 'flex',
            gap: 14,
            background: 'rgba(255,255,255,0.14)',
            borderRadius: 14,
            padding: '14px 18px',
          }}
        >
          <HeroStat label="So far today" value={gbp(loop.savedSoFar)} sub={`at ${loop.nowHHMM}`} />
          <Divider />
          <HeroStat label="Waste avoided" value={gbp(proj.baseline.wasteCost - proj.ai.wasteCost)} sub="full day" />
          <Divider />
          <HeroStat label="Sales rescued" value={gbp(proj.baseline.missedRevenue - proj.ai.missedRevenue)} sub="full day" />
        </div>
      </section>

      {/* Transport */}
      <Transport
        playing={loop.playing}
        atEnd={loop.atEnd}
        nowHHMM={loop.nowHHMM}
        progress={loop.progress}
        onToggle={loop.togglePlay}
        onStep={loop.stepToNextDrop}
        onReset={loop.reset}
      />

      {/* Quinn re-cut feed */}
      <RecutBanner recut={loop.recut} />

      {/* Side-by-side scoreboard */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 16 }}>
        <StrategyCard
          title="AI forecast"
          subtitle="Edify — cooks to the live curve"
          accent={AI_ACCENT}
          icon={<Sparkles size={16} />}
          score={loop.ai}
          isWinner={loop.ai.totalLoss <= loop.baseline.totalLoss}
        />
        <StrategyCard
          title="Fixed par"
          subtitle="The old way — same number every drop"
          accent={BASE_ACCENT}
          icon={<Flame size={16} />}
          score={loop.baseline}
          isWinner={loop.baseline.totalLoss < loop.ai.totalLoss}
        />
      </div>

      {/* Loss comparison bar */}
      <LossBar ai={loop.ai.totalLoss} baseline={loop.baseline.totalLoss} />

      <p style={{ fontSize: 12, color: 'var(--color-text-muted)', lineHeight: 1.6, margin: 0 }}>
        Both lines face the exact same footfall — including the mid-rush surges Quinn flags.
        The only difference is how much each chose to cook. Waste is valued at food cost;
        missed sales at menu price. Step the clock to watch the gap open as the rush builds and eases.
      </p>
    </div>
  );
}

function HeaderRow() {
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, flexWrap: 'wrap' }}>
      <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: 'var(--color-text-primary)' }}>
        AI forecast — live impact
      </h1>
      <span style={{ fontSize: 13.5, color: 'var(--color-text-secondary)' }}>
        Burger King · Stratford — lunch service, replayed
      </span>
    </div>
  );
}

function HeroStat({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 96 }}>
      <span style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', opacity: 0.8 }}>
        {label}
      </span>
      <span style={{ fontSize: 24, fontWeight: 800, fontVariantNumeric: 'tabular-nums', lineHeight: 1 }}>
        {value}
      </span>
      <span style={{ fontSize: 11, opacity: 0.75 }}>{sub}</span>
    </div>
  );
}

function Divider() {
  return <div style={{ width: 1, background: 'rgba(255,255,255,0.25)' }} />;
}

function Transport({
  playing,
  atEnd,
  nowHHMM,
  progress,
  onToggle,
  onStep,
  onReset,
}: {
  playing: boolean;
  atEnd: boolean;
  nowHHMM: string;
  progress: number;
  onToggle: () => void;
  onStep: () => void;
  onReset: () => void;
}) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        background: '#fff',
        border: '1px solid var(--color-border-subtle)',
        borderRadius: 12,
        padding: '10px 14px',
      }}
    >
      <button type="button" onClick={onToggle} disabled={atEnd} style={primaryBtn(atEnd)}>
        {playing ? <Pause size={15} /> : <Play size={15} />}
        {playing ? 'Pause' : atEnd ? 'Done' : 'Play service'}
      </button>
      <button type="button" onClick={onStep} disabled={atEnd} style={ghostBtn(atEnd)}>
        <SkipForward size={14} /> Next drop
      </button>
      <button type="button" onClick={onReset} style={ghostBtn(false)}>
        <RotateCcw size={14} /> Reset
      </button>

      <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 10, marginLeft: 6 }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--color-text-primary)', fontVariantNumeric: 'tabular-nums' }}>
          {nowHHMM}
        </span>
        <div style={{ flex: 1, height: 6, background: 'var(--color-bg-hover)', borderRadius: 4, overflow: 'hidden' }}>
          <div style={{ width: `${Math.round(progress * 100)}%`, height: '100%', background: AI_ACCENT, transition: 'width 0.3s ease-out' }} />
        </div>
      </div>
    </div>
  );
}

const RECUT_STYLES: Record<RecutTone, { bg: string; border: string; fg: string; label: string }> = {
  'cook-ahead': { bg: 'rgba(47,109,246,0.08)', border: 'rgba(47,109,246,0.35)', fg: '#2f6df6', label: 'Cook ahead' },
  'ease-off': { bg: 'rgba(47,163,107,0.08)', border: 'rgba(47,163,107,0.35)', fg: '#2fa36b', label: 'Ease off' },
  info: { bg: 'var(--color-bg-hover)', border: 'var(--color-border-subtle)', fg: 'var(--color-text-secondary)', label: 'Steady' },
};

function RecutBanner({ recut }: { recut: { message: string; tone: RecutTone } | null }) {
  const s = recut ? RECUT_STYLES[recut.tone] : RECUT_STYLES.info;
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        background: s.bg,
        border: `1px solid ${s.border}`,
        borderRadius: 12,
        padding: '12px 16px',
        minHeight: 48,
      }}
    >
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          fontSize: 11,
          fontWeight: 800,
          letterSpacing: '0.05em',
          textTransform: 'uppercase',
          color: s.fg,
          flexShrink: 0,
        }}
      >
        <Sparkles size={14} /> Quinn · {s.label}
      </span>
      <span style={{ fontSize: 14, color: 'var(--color-text-primary)', fontWeight: 500 }}>
        {recut ? recut.message : 'Press play — Quinn will re-cut the plan as the day unfolds.'}
      </span>
    </div>
  );
}

function StrategyCard({
  title,
  subtitle,
  accent,
  icon,
  score,
  isWinner,
}: {
  title: string;
  subtitle: string;
  accent: string;
  icon: React.ReactNode;
  score: StrategyScore;
  isWinner: boolean;
}) {
  return (
    <section
      style={{
        background: '#fff',
        border: `1px solid ${isWinner ? accent : 'var(--color-border-subtle)'}`,
        borderRadius: 16,
        overflow: 'hidden',
        boxShadow: isWinner ? `0 6px 22px ${hexA(accent, 0.16)}` : 'none',
        transition: 'border-color 0.2s, box-shadow 0.2s',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '14px 18px', borderBottom: '1px solid var(--color-border-subtle)' }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 30, height: 30, borderRadius: 8, background: hexA(accent, 0.12), color: accent }}>
          {icon}
        </span>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--color-text-primary)' }}>{title}</div>
          <div style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>{subtitle}</div>
        </div>
        {isWinner && (
          <span style={{ marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 800, color: SAVE_COLOR, background: hexA(SAVE_COLOR, 0.12), padding: '4px 9px', borderRadius: 999 }}>
            <TrendingUp size={12} /> Ahead
          </span>
        )}
      </div>

      <div style={{ padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--color-text-muted)' }}>
            Money left on the table
          </div>
          <div style={{ fontSize: 34, fontWeight: 900, color: 'var(--color-text-primary)', fontVariantNumeric: 'tabular-nums', lineHeight: 1.1 }}>
            {gbp(score.totalLoss)}
          </div>
        </div>

        <div style={{ display: 'flex', gap: 10 }}>
          <MetricTile
            icon={<Trash2 size={14} />}
            color={WASTE_COLOR}
            label="Waste"
            value={gbp(score.wasteCost)}
            sub={`${score.wasteUnits} binned`}
          />
          <MetricTile
            icon={<TrendingDown size={14} />}
            color={MISS_COLOR}
            label="Missed sales"
            value={gbp(score.missedRevenue)}
            sub={`${score.missedUnits} unserved`}
          />
        </div>

        <div style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>
          {score.sold.toLocaleString()} sold · {score.produced.toLocaleString()} cooked
        </div>

        {/* Top contributors */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {score.perRecipe
            .filter(r => r.wasteUnits > 0 || r.missedUnits > 0)
            .slice(0, 4)
            .map(r => (
              <div key={r.recipeId} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5 }}>
                <span style={{ flex: 1, color: 'var(--color-text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {r.name}
                </span>
                {r.wasteUnits > 0 && (
                  <span style={{ color: WASTE_COLOR, fontWeight: 600 }}>{r.wasteUnits} binned</span>
                )}
                {r.missedUnits > 0 && (
                  <span style={{ color: MISS_COLOR, fontWeight: 600 }}>{r.missedUnits} missed</span>
                )}
              </div>
            ))}
          {score.perRecipe.every(r => r.wasteUnits === 0 && r.missedUnits === 0) && (
            <span style={{ fontSize: 12.5, color: SAVE_COLOR, fontWeight: 600 }}>Cabinet matched demand — nothing wasted or missed yet.</span>
          )}
        </div>
      </div>
    </section>
  );
}

function MetricTile({
  icon,
  color,
  label,
  value,
  sub,
}: {
  icon: React.ReactNode;
  color: string;
  label: string;
  value: string;
  sub: string;
}) {
  return (
    <div style={{ flex: 1, background: hexA(color, 0.07), border: `1px solid ${hexA(color, 0.2)}`, borderRadius: 10, padding: '10px 12px' }}>
      <div style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 10.5, fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', color }}>
        {icon} {label}
      </div>
      <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--color-text-primary)', fontVariantNumeric: 'tabular-nums', marginTop: 3 }}>
        {value}
      </div>
      <div style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>{sub}</div>
    </div>
  );
}

function LossBar({ ai, baseline }: { ai: number; baseline: number }) {
  const max = Math.max(1, ai, baseline);
  return (
    <div style={{ background: '#fff', border: '1px solid var(--color-border-subtle)', borderRadius: 12, padding: '14px 18px', display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--color-text-muted)' }}>
        Total money left on the table — so far
      </div>
      <BarRow label="AI forecast" value={ai} max={max} color={AI_ACCENT} />
      <BarRow label="Fixed par" value={baseline} max={max} color={BASE_ACCENT} />
    </div>
  );
}

function BarRow({ label, value, max, color }: { label: string; value: number; max: number; color: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
      <span style={{ width: 92, fontSize: 12.5, fontWeight: 600, color: 'var(--color-text-secondary)' }}>{label}</span>
      <div style={{ flex: 1, height: 22, background: 'var(--color-bg-hover)', borderRadius: 6, overflow: 'hidden' }}>
        <div style={{ width: `${Math.max(2, (value / max) * 100)}%`, height: '100%', background: color, borderRadius: 6, transition: 'width 0.3s ease-out' }} />
      </div>
      <span style={{ width: 72, textAlign: 'right', fontSize: 13.5, fontWeight: 800, color: 'var(--color-text-primary)', fontVariantNumeric: 'tabular-nums' }}>
        {gbp(value)}
      </span>
    </div>
  );
}

// ── style helpers ───────────────────────────────────────────────────────────

function primaryBtn(disabled: boolean): React.CSSProperties {
  return {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 7,
    padding: '9px 16px',
    borderRadius: 9,
    border: 'none',
    background: disabled ? 'var(--color-border-subtle)' : AI_ACCENT,
    color: '#fff',
    fontSize: 13,
    fontWeight: 700,
    fontFamily: 'var(--font-primary)',
    cursor: disabled ? 'default' : 'pointer',
  };
}

function ghostBtn(disabled: boolean): React.CSSProperties {
  return {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    padding: '9px 14px',
    borderRadius: 9,
    border: '1px solid var(--color-border)',
    background: '#fff',
    color: disabled ? 'var(--color-text-muted)' : 'var(--color-text-secondary)',
    fontSize: 13,
    fontWeight: 600,
    fontFamily: 'var(--font-primary)',
    cursor: disabled ? 'default' : 'pointer',
  };
}

/** Hex (#rrggbb) + alpha → rgba() string. */
function hexA(hex: string, alpha: number): string {
  const h = hex.replace('#', '');
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
