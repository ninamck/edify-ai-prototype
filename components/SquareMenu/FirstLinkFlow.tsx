'use client';

/**
 * First link. The first time publishing is on, Edify reads the Square
 * catalogue and proposes how each item and modifier set links to a recipe,
 * product or modifier group. Three bands:
 *
 *   Ready to link     confident; ticked by default
 *   Needs your call   Edify has a best guess and an alternative
 *   Not in Edify yet  stays on the till only until someone makes a recipe
 *
 * Carries over links already made on Item matching. Nothing changes on the
 * till until the first publish.
 */

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Link2 } from 'lucide-react';
import EdifyMark from '@/components/EdifyMark/EdifyMark';
import { FIRST_LINK_PROPOSALS, type FirstLinkProposal } from './squareCatalogFixtures';
import { completeFirstLink } from './squareMenuStore';
import { card, eyebrow, primaryBtn, secondaryBtn } from './ui';

export function FirstLinkFlow() {
  const router = useRouter();
  const ready = FIRST_LINK_PROPOSALS.filter((p) => p.band === 'ready');
  const call = FIRST_LINK_PROPOSALS.filter((p) => p.band === 'call');
  const fresh = FIRST_LINK_PROPOSALS.filter((p) => p.band === 'new');

  const [unticked, setUnticked] = useState<Set<string>>(new Set());
  const [choices, setChoices] = useState<Record<string, string>>(
    () => Object.fromEntries(call.map((p) => [p.id, p.choices?.[0]?.id ?? ''])),
  );

  const linkCount = useMemo(
    () => ready.filter((p) => !unticked.has(p.id)).length
      + call.filter((p) => !(p.id === 'fl-hot-choc' && choices[p.id] === 'leave')).length,
    [ready, call, unticked, choices],
  );

  function toggle(id: string) {
    setUnticked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function finish() {
    const skipped = ready.filter((p) => unticked.has(p.id) && p.tillItemId).map((p) => p.tillItemId!);
    completeFirstLink(choices, skipped);
  }

  const items = FIRST_LINK_PROPOSALS.filter((p) => p.kind === 'item').length;
  const sets = FIRST_LINK_PROPOSALS.filter((p) => p.kind === 'group').length;

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 16 }}>
        <span aria-hidden style={{ marginTop: 3 }}><EdifyMark size={18} /></span>
        <div style={{ flex: 1 }}>
          <div style={eyebrow}>Square menu · first link</div>
          <h1 style={{ fontSize: 19, fontWeight: 700, margin: '4px 0 0' }}>
            We read your Square menu: {items} items and {sets} modifier sets
          </h1>
          <p style={{ fontSize: 13.5, color: 'var(--color-text-muted)', margin: '6px 0 0', lineHeight: 1.5, maxWidth: 720 }}>
            Here&apos;s how we&apos;d link them to your recipes and products. Links you already made on Item matching carry over.
            Nothing changes on the till until you publish.
          </p>
        </div>
      </div>

      <Band
        title="Ready to link"
        hint="We're confident about these. Untick anything that looks wrong and it stays on the till only."
        count={ready.length}
      >
        {ready.map((p) => (
          <ProposalRow
            key={p.id}
            p={p}
            control={(
              <input
                type="checkbox"
                checked={!unticked.has(p.id)}
                onChange={() => toggle(p.id)}
                aria-label={`Link ${p.squareLabel}`}
              />
            )}
          />
        ))}
      </Band>

      <Band title="Needs your call" hint="We have a best guess, but you know your menu." count={call.length}>
        {call.map((p) => (
          <ProposalRow
            key={p.id}
            p={p}
            extra={(
            <fieldset style={{ border: 'none', margin: '8px 0 0', padding: 0, display: 'flex', gap: 14, flexWrap: 'wrap' }}>
              <legend style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)' }}>
                {p.squareLabel}
              </legend>
              {p.choices?.map((c) => (
                <label key={c.id} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, cursor: 'pointer' }}>
                  <input
                    type="radio"
                    name={p.id}
                    checked={choices[p.id] === c.id}
                    onChange={() => setChoices((prev) => ({ ...prev, [p.id]: c.id }))}
                  />
                  {c.label}
                </label>
              ))}
            </fieldset>
            )}
          />
        ))}
      </Band>

      <Band
        title="Not in Edify yet"
        hint="These stay on the till as they are. You'll see them as On the till only, ready to link when a recipe exists."
        count={fresh.length}
      >
        {fresh.map((p) => <ProposalRow key={p.id} p={p} plain />)}
      </Band>

      <div
        style={{
          position: 'sticky', bottom: 0,
          marginTop: 16, padding: '12px 0',
          background: 'var(--color-bg-surface)',
          display: 'flex', alignItems: 'center', gap: 10,
          borderTop: '1px solid var(--color-border-subtle)',
        }}
      >
        <button type="button" style={secondaryBtn} onClick={() => router.push('/pos-connection')}>
          <ArrowLeft size={14} /> Back
        </button>
        <span style={{ flex: 1, fontSize: 12.5, color: 'var(--color-text-muted)' }}>
          You can change any link later on Item matching.
        </span>
        <button type="button" style={primaryBtn} onClick={finish}>
          <Link2 size={14} /> Link {linkCount} and open the Square menu
        </button>
      </div>
    </div>
  );
}

function Band({ title, hint, count, children }: { title: string; hint: string; count: number; children: React.ReactNode }) {
  return (
    <section style={{ marginBottom: 18 }}>
      <h2 style={{ fontSize: 14, fontWeight: 700, margin: 0 }}>{title} · {count}</h2>
      <p style={{ fontSize: 12.5, color: 'var(--color-text-muted)', margin: '3px 0 8px' }}>{hint}</p>
      <div style={card}>{children}</div>
    </section>
  );
}

function ProposalRow({ p, control, extra, plain }: { p: FirstLinkProposal; control?: React.ReactNode; extra?: React.ReactNode; plain?: boolean }) {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: plain ? '1fr 1.4fr' : '20px 1fr 1.4fr',
        gap: 12, alignItems: 'start',
        padding: '11px 16px',
        borderTop: '1px solid var(--color-border-subtle)',
        marginTop: -1,
      }}
    >
      {!plain && <span style={{ paddingTop: 2 }}>{control}</span>}
      <div>
        <div style={{ fontSize: 13.5, fontWeight: 600 }}>{p.squareLabel}</div>
        <div style={{ fontSize: 12.5, color: 'var(--color-text-muted)' }}>On Square: {p.squareDetail}</div>
      </div>
      <div>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6, fontSize: 13, color: 'var(--color-text-primary)' }}>
          {!plain && <span role="img" aria-label="Suggested by Edify" style={{ marginTop: 2 }}><EdifyMark size={12} /></span>}
          <span>{p.proposal}</span>
        </div>
        {p.regularType && (
          <div style={{ fontSize: 12.5, color: 'var(--color-text-muted)', marginTop: 4 }}>
            Square has this as a regular item, so the till can&apos;t show its allergens. Your first publish swaps it for a food and drink item.
          </div>
        )}
        {extra}
      </div>
    </div>
  );
}
