'use client';

import { Info } from 'lucide-react';
import { useCatalogue, whereLabel } from './catalogue';

/** Says which rule is asking for something, where it asks, so nobody has to know where rules live. */
export default function RuleNote({ ruleId, lead }: { ruleId: string; lead: string }) {
  const [catalogue] = useCatalogue();
  const rule = catalogue.find(e => e.id === ruleId);
  if (!rule) return null;
  return (
    <p style={{ display: 'flex', gap: 6, alignItems: 'flex-start', margin: 0, fontSize: 12.5, lineHeight: 1.45, color: 'var(--color-text-secondary)' }}>
      <Info size={14} aria-hidden style={{ marginTop: 2, flexShrink: 0 }} />
      <span>
        {lead}: Pret rule for {whereLabel(rule.where).toLowerCase()}, set by {rule.setBy}.
      </span>
    </p>
  );
}
