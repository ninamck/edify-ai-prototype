'use client';

/**
 * Command Centre card: what changed in Square since the last publish.
 * Reads the live store, so it empties as decisions are made elsewhere.
 * Review opens the Changed in Square panel on the Square menu page.
 */

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Store } from 'lucide-react';
import CardShell, { type CardState } from '@/components/Feed/commands/cards/CardShell';
import { findGroup } from '@/components/Modifiers/store';
import { squareChangeCount, useSquareMenu } from './squareMenuStore';
import { FIELD_LABELS, money, squareChangeKeys } from './tillItems';

export function SquareChangesCard() {
  const router = useRouter();
  const sm = useSquareMenu();
  const [state, setState] = useState<CardState>('pending');
  const count = squareChangeCount(sm);

  const lines: string[] = [];
  for (const i of sm.items) {
    if (i.deletedInSquare) {
      lines.push(`${i.current.name} was deleted by ${i.deletedInSquare.by}`);
      continue;
    }
    for (const k of squareChangeKeys(i)) {
      if (k === 'name') lines.push(`${i.current.name} was renamed "${i.inSquare?.name}"`);
      else if (k === 'prices') {
        const s = i.inSquare!.sizes.find((x) => i.published!.prices[x] !== i.inSquare!.prices[x]);
        lines.push(`${i.current.name}${s && i.inSquare!.sizes.length > 1 ? ` ${s}` : ''} went from ${money(s ? i.published!.prices[s] : null)} to ${money(s ? i.inSquare!.prices[s] : null)}`);
      } else lines.push(`${i.current.name}: ${FIELD_LABELS[k].toLowerCase()} changed`);
    }
  }
  for (const c of sm.groupChanges) {
    lines.push(`${c.optionName} was added to ${findGroup(c.groupId)?.name ?? 'a modifier group'}`);
  }

  if (count === 0) {
    return (
      <CardShell icon={Store} title="Nothing changed in Square" subtitle="The till matches what Edify last published." state="confirmed">
        <p style={{ margin: 0, fontSize: 13, color: 'var(--color-text-secondary)' }}>Nothing to do here.</p>
      </CardShell>
    );
  }

  return (
    <CardShell
      icon={Store}
      title={`${count} ${count === 1 ? 'thing' : 'things'} changed in Square`}
      subtitle={`Since you published ${sm.settings.lastPublishedAt ?? 'last'}`}
      state={state}
      confirmLabel="Review changes"
      cancelLabel="Later"
      onConfirm={() => { setState('confirmed'); router.push('/square-menu?review=changes'); }}
      onCancel={() => setState('cancelled')}
    >
      <ul style={{ margin: 0, paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 4 }}>
        {lines.map((l) => (
          <li key={l} style={{ fontSize: 13, color: 'var(--color-text-primary)' }}>{l}</li>
        ))}
      </ul>
      <p style={{ margin: '10px 0 0', fontSize: 12.5, color: 'var(--color-text-muted)' }}>
        Your next publish leaves these alone until you decide.
      </p>
    </CardShell>
  );
}
