'use client';

import { HelpCircle } from 'lucide-react';
import CardShell, { type CardState } from './CardShell';
import type { AmbiguityChoice } from '../types';

interface AmbiguityPickerProps {
  prompt: string;
  choices: AmbiguityChoice[];
  state: CardState;
  onPick: (choice: AmbiguityChoice) => void;
  onCancel: () => void;
}

/**
 * Disambiguation card — shown when the NL parser narrowed the match
 * to multiple plausible products / recipes / suppliers but isn't
 * confident enough to pick one. The user taps one and the runner
 * re-opens the matching command card with the chosen args.
 */
export default function AmbiguityPicker({ prompt, choices, state, onPick, onCancel }: AmbiguityPickerProps) {
  return (
    <CardShell icon={HelpCircle} title={prompt} state={state} onCancel={onCancel}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
        {choices.map((c) => (
          <button
            key={c.id}
            type="button"
            disabled={state !== 'pending'}
            onClick={() => onPick(c)}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '10px 12px',
              borderRadius: '10px',
              border: '1px solid var(--color-border-subtle, rgba(0,28,53,0.12))',
              background: '#fff',
              cursor: state === 'pending' ? 'pointer' : 'not-allowed',
              fontFamily: 'var(--font-primary)',
              textAlign: 'left',
            }}
          >
            <div>
              <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-text-primary)' }}>{c.label}</div>
              {c.sublabel && (
                <div style={{ fontSize: '11px', fontWeight: 500, color: 'var(--color-text-muted)', marginTop: '1px' }}>
                  {c.sublabel}
                </div>
              )}
            </div>
            <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--color-text-secondary)' }}>Pick →</span>
          </button>
        ))}
      </div>
    </CardShell>
  );
}
