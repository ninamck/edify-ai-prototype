'use client';

import type { RuleResult, Tiles } from '../types';
import { label } from './tokens';

function Tile({ heading, value, note, tone }: { heading: string; value: string; note?: string; tone?: 'ok' | 'bad' | 'neutral' }) {
  const valueColor = tone === 'bad' ? 'var(--color-error)' : tone === 'ok' ? 'var(--color-success)' : 'var(--color-text-primary)';
  return (
    <div
      style={{
        flex: 1,
        minWidth: 0,
        padding: '10px 12px',
        borderRadius: '10px',
        border: '1px solid var(--color-border-subtle)',
        background: '#fff',
      }}
    >
      <div style={label}>{heading}</div>
      <div style={{ fontSize: '20px', fontWeight: 700, color: valueColor, marginTop: '4px', lineHeight: 1.1 }}>{value}</div>
      {note && <div style={{ fontSize: '11px', fontWeight: 500, color: 'var(--color-text-secondary)', marginTop: '3px' }}>{note}</div>}
    </div>
  );
}

export default function RotaTiles({ tiles, rules }: { tiles: Tiles; rules: RuleResult[] }) {
  const fails = rules.filter((r) => r.status === 'fail').length;
  const warns = rules.filter((r) => r.status === 'warn').length;
  const delta = tiles.hoursDelta;
  const deltaText = delta === 0 ? 'no change' : `${delta > 0 ? '+' : ''}${delta}h on the draft`;
  const overTarget = tiles.labourPct > tiles.targetPct;
  const gapsTone = tiles.peakGaps === 0 ? 'ok' : tiles.peakGaps < tiles.peakGapsBefore ? 'neutral' : 'bad';

  return (
    <div>
      <div style={{ display: 'flex', gap: '8px' }}>
        <Tile heading="Scheduled hours" value={`${tiles.scheduledHours}h`} note={deltaText} />
        <Tile
          heading="Labour"
          value={`${tiles.labourPct}%`}
          note={`target ${tiles.targetPct}%`}
          tone={overTarget ? 'bad' : 'ok'}
        />
        <Tile
          heading="Peak cover gaps"
          value={String(tiles.peakGaps)}
          note={tiles.peakGapsBefore === tiles.peakGaps ? 'same as the draft' : `was ${tiles.peakGapsBefore}`}
          tone={gapsTone}
        />
        <Tile
          heading="Rules"
          value={fails > 0 ? `${fails} breach${fails === 1 ? '' : 'es'}` : warns > 0 ? `${warns} warning${warns === 1 ? '' : 's'}` : 'All pass'}
          note={fails > 0 ? 'fix before writing' : warns > 0 ? 'contracted hours' : `${rules.length} checked`}
          tone={fails > 0 ? 'bad' : warns > 0 ? 'neutral' : 'ok'}
        />
      </div>
      {tiles.constraintLine && (
        <div
          role="status"
          style={{
            marginTop: '8px',
            padding: '8px 10px',
            borderRadius: '8px',
            background: 'var(--color-bg-alert)',
            border: '1px solid var(--color-border-alert)',
            fontSize: '12px',
            fontWeight: 500,
            color: 'var(--color-text-primary)',
            lineHeight: 1.45,
          }}
        >
          {tiles.constraintLine}
        </div>
      )}
    </div>
  );
}
