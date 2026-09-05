'use client';

/**
 * Labour rules on the rota as currently ticked. Rules come from the
 * Deputy draft (configuration, so a different country carries a
 * different list). Pass, warn, fail, with the plain-language detail.
 */

import { AlertTriangle, Check, X } from 'lucide-react';
import type { RuleResult } from '../types';
import { label } from './tokens';

export default function RulesPanel({ rules, toolName }: { rules: RuleResult[]; toolName: string }) {
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: '6px' }}>
        <span style={label}>Labour rules</span>
        <span style={{ fontSize: '11px', fontWeight: 500, color: 'var(--color-text-secondary)' }}>from {toolName} settings</span>
      </div>
      <ul style={{ listStyle: 'none', margin: 0, padding: '2px 0 0', display: 'flex', flexDirection: 'column', gap: '5px' }}>
        {rules.map((r) => {
          const icon =
            r.status === 'pass' ? (
              <Check size={12} strokeWidth={2.5} color="var(--color-success)" aria-label="Pass" />
            ) : r.status === 'warn' ? (
              <AlertTriangle size={12} strokeWidth={2.4} color="var(--color-badge-text)" aria-label="Warning" />
            ) : (
              <X size={12} strokeWidth={2.5} color="var(--color-error)" aria-label="Breach" />
            );
          return (
            <li key={r.ruleId} style={{ display: 'grid', gridTemplateColumns: '14px 1fr', gap: '6px', alignItems: 'start' }}>
              <span style={{ marginTop: '2px' }}>{icon}</span>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--color-text-primary)', lineHeight: 1.35 }}>{r.label}</div>
                {r.detail && (
                  <div style={{ fontSize: '11.5px', fontWeight: 500, color: r.status === 'fail' ? 'var(--color-error)' : 'var(--color-text-secondary)', lineHeight: 1.4 }}>
                    {r.detail}
                  </div>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
