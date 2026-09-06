'use client';

/**
 * Labour rules in one line. The Rules tile already says pass, warn or
 * breach; this line names what is not a pass and opens the full list
 * on request. Six green ticks in a side panel were taking a sixth of
 * the card to say "fine".
 */

import { useState } from 'react';
import { AlertTriangle, Check, ChevronDown, ChevronUp, X } from 'lucide-react';
import type { RuleResult } from '../types';
import RulesPanel from './RulesPanel';
import { body, textButton } from './tokens';

export default function RulesLine({ rules, toolName }: { rules: RuleResult[]; toolName: string }) {
  const [open, setOpen] = useState(false);
  const fails = rules.filter((r) => r.status === 'fail');
  const warns = rules.filter((r) => r.status === 'warn');
  const worst = fails[0] ?? warns[0];

  const icon =
    fails.length > 0 ? (
      <X size={13} strokeWidth={2.5} color="var(--color-error)" aria-label="Breach" />
    ) : warns.length > 0 ? (
      <AlertTriangle size={13} strokeWidth={2.4} color="var(--color-badge-text)" aria-label="Warning" />
    ) : (
      <Check size={13} strokeWidth={2.5} color="var(--color-success)" aria-label="All pass" />
    );

  const text =
    fails.length > 0
      ? `${fails.length} of ${rules.length} rules in breach. ${worst?.label}: ${worst?.detail ?? ''}`
      : warns.length > 0
        ? `${rules.length} rules checked, ${warns.length} warning. ${worst?.label}: ${worst?.detail ?? ''}`
        : `${rules.length} rules checked, all pass.`;

  return (
    <section aria-label="Labour rules" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
        <span style={{ marginTop: '2px', flexShrink: 0 }}>{icon}</span>
        <span style={{ ...body, lineHeight: 1.45, flex: 1, minWidth: 0 }}>{text.replace(/\s+$/, '')}</span>
        <button
          type="button"
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
          style={{ ...textButton, padding: '2px 6px', display: 'inline-flex', alignItems: 'center', gap: '3px', whiteSpace: 'nowrap', flexShrink: 0 }}
        >
          {open ? 'Hide' : 'All rules'} {open ? <ChevronUp size={12} aria-hidden="true" /> : <ChevronDown size={12} aria-hidden="true" />}
        </button>
      </div>
      {open && (
        <div style={{ padding: '10px 12px', borderRadius: '10px', border: '1px solid var(--color-border-subtle)' }}>
          <RulesPanel rules={rules} toolName={toolName} />
        </div>
      )}
    </section>
  );
}
