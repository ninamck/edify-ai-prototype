'use client';

/**
 * Review and publish. Shows exactly what the next publish sends to Square,
 * grouped as New, Updated and Coming off, plus modifier groups. Warnings
 * come with a fix. Square changes still waiting for a decision are left
 * alone. Publishing runs item by item; anything that fails can be retried.
 */

import { useMemo, useState } from 'react';
import { AlertTriangle, Check, Loader2, Send, X } from 'lucide-react';
import CardShell from '@/components/Feed/commands/cards/CardShell';
import { useModifierGroups } from '@/components/Modifiers/store';
import type { ModifierGroup } from '@/components/Modifiers/types';
import {
  finishPublish,
  groupTillStatus,
  groupsWithPublishWork,
  nowLabel,
  optionOffCopy,
  optionsOffOnSizes,
  publishGroup,
  publishItem,
  squareChangeCount,
  useSquareMenu,
} from './squareMenuStore';
import {
  FIELD_LABELS,
  hasPublishWork,
  isBlocked,
  money,
  priceRange,
  publishKeys,
  type FieldKey,
  type TillFields,
  type TillItem,
} from './tillItems';
import { Sheet, eyebrow, linkBtn, primaryBtn, secondaryBtn } from './ui';

type Line = {
  id: string;
  kind: 'item' | 'group';
  name: string;
  details: string[];
};

function describe(key: FieldKey, from: TillFields, to: TillFields, groups: ModifierGroup[]): string {
  const g = (ids: string[]) => ids.map((id) => groups.find((x) => x.id === id)?.name ?? id).join(', ') || 'none';
  switch (key) {
    case 'prices': {
      const parts = to.sizes
        .filter((s) => from.prices[s] !== to.prices[s])
        .map((s) => `${s} ${money(from.prices[s])} to ${money(to.prices[s])}`);
      return `Till price: ${parts.join(', ')}`;
    }
    case 'sizes': {
      const added = to.sizes.filter((s) => !from.sizes.includes(s));
      const removed = from.sizes.filter((s) => !to.sizes.includes(s));
      return [added.length ? `Adds ${added.join(', ')}` : '', removed.length ? `Takes off ${removed.join(', ')}` : ''].filter(Boolean).join('. ');
    }
    case 'groups':
      return `Modifier groups: ${g(to.groups)}`;
    case 'sites':
      return `Sites: ${to.sites.length ? to.sites.join(', ') : 'all sites'}`;
    case 'photo':
      return to.photo ? 'Adds the photo' : 'Removes the photo';
    case 'description':
      return to.description ? 'New description' : 'Removes the description';
    default: {
      const a = String(from[key] || 'blank');
      const b = String(to[key] || 'blank');
      return `${FIELD_LABELS[key]}: ${a} to ${b}`;
    }
  }
}

function linesFor(items: TillItem[], groups: ModifierGroup[]) {
  const created: Line[] = [];
  const updated: Line[] = [];
  const removed: Line[] = [];
  for (const i of items) {
    if (!hasPublishWork(i)) continue;
    if (!i.inSquare) {
      const groupNames = i.current.groups.map((id) => groups.find((g) => g.id === id)?.name).filter(Boolean);
      created.push({
        id: i.id, kind: 'item', name: i.current.name,
        details: [
          `${i.current.sizes.length === 1 ? 'One size' : i.current.sizes.join(', ')}, ${priceRange(i.current)}`,
          groupNames.length ? `With ${groupNames.join(', ')}` : '',
          i.current.category ? `In ${i.current.category}` : 'No till category',
        ].filter(Boolean),
      });
    } else if (i.takeOff) {
      removed.push({ id: i.id, kind: 'item', name: i.current.name, details: ['Comes off the till. Square keeps its sales history.'] });
    } else {
      updated.push({
        id: i.id, kind: 'item', name: i.current.name,
        details: [
          ...publishKeys(i).map((k) => describe(k, i.inSquare!, i.current, groups)),
          i.regularTypeInSquare ? 'Becomes a food and drink item, so the till can show allergens' : '',
        ].filter(Boolean),
      });
    }
  }
  return { created, updated, removed };
}

type RunState = Record<string, 'waiting' | 'running' | 'done' | 'failed'>;

export function PublishSheet({
  onClose, onOpenItem, onReviewChanges,
}: {
  onClose: () => void;
  onOpenItem: (id: string) => void;
  onReviewChanges: () => void;
}) {
  const sm = useSquareMenu();
  const groups = useModifierGroups();
  const [stage, setStage] = useState<'review' | 'running' | 'done'>('review');
  const [unticked, setUnticked] = useState<Set<string>>(new Set());
  const [run, setRun] = useState<RunState>({});
  const [failures, setFailures] = useState<{ id: string; name: string; reason: string }[]>([]);
  // Snapshot the plan when publishing starts, so lines don't vanish as items publish.
  const [plan, setPlan] = useState<Line[]>([]);

  const { created, updated, removed } = useMemo(() => linesFor(sm.items, groups), [sm.items, groups]);
  const groupLines: Line[] = useMemo(
    () => groupsWithPublishWork(groups, sm).map((g) => ({
      id: g.id, kind: 'group' as const, name: g.name,
      details: [
        groupTillStatus(g, sm) === 'not-on-till' ? 'New group on the till' : 'Options or prices changed',
        ...(sm.groupSitePrices[g.id] && !sm.groupSitePrices[g.id].keepInSquare
          ? ['Replaces the site prices in Square with one price everywhere']
          : []),
      ],
    })),
    [groups, sm],
  );
  const all = [...groupLines, ...created, ...updated, ...removed];
  const selected = all.filter((l) => !unticked.has(l.id));

  const overwrites = sm.items.filter((i) => i.overwriteKeys.length > 0 && hasPublishWork(i));
  const blocked = sm.items.filter(isBlocked);
  const waiting = squareChangeCount(sm);
  const optionsOff = [...created, ...updated].flatMap((l) => {
    const i = sm.items.find((x) => x.id === l.id);
    return i ? optionsOffOnSizes(i).map((o) => ({ item: i, o })) : [];
  });
  const sizeRemovals = sm.items.filter((i) => i.inSquare && !i.takeOff && i.inSquare.sizes.some((s) => !i.current.sizes.includes(s)));

  function toggle(id: string) {
    setUnticked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function start(lines: Line[]) {
    setPlan(lines);
    setStage('running');
    setFailures([]);
    const state: RunState = Object.fromEntries(lines.map((l) => [l.id, 'waiting' as const]));
    setRun(state);
    const failed: { id: string; name: string; reason: string }[] = [];
    const done: string[] = [];
    // Groups first: items point at them.
    lines.forEach((l, idx) => {
      window.setTimeout(() => {
        setRun((r) => ({ ...r, [l.id]: 'running' }));
      }, idx * 420);
      window.setTimeout(() => {
        if (l.kind === 'group') {
          publishGroup(l.id);
          done.push(l.name);
          setRun((r) => ({ ...r, [l.id]: 'done' }));
        } else {
          const res = publishItem(l.id);
          if (res.ok) {
            done.push(l.name);
            setRun((r) => ({ ...r, [l.id]: 'done' }));
          } else {
            failed.push({ id: l.id, name: l.name, reason: res.reason });
            setRun((r) => ({ ...r, [l.id]: 'failed' }));
          }
        }
        if (idx === lines.length - 1) {
          finishPublish({ at: nowLabel(), done, failed });
          setFailures(failed);
          window.setTimeout(() => setStage('done'), 300);
        }
      }, idx * 420 + 380);
    });
  }

  function retry() {
    const lines = plan.filter((l) => failures.some((f) => f.id === l.id));
    start(lines);
  }

  if (stage !== 'review') {
    const doneCount = plan.filter((l) => run[l.id] === 'done').length;
    return (
      <Sheet
        eyebrowText="Publish to Square"
        title={stage === 'running' ? 'Publishing to Square' : failures.length ? `Published, with ${failures.length === 1 ? 'one' : failures.length} to try again` : 'Published to Square'}
        onClose={stage === 'running' ? () => undefined : onClose}
        footer={stage === 'done' ? (
          <>
            <span style={{ flex: 1 }} />
            {failures.length > 0 && (
              <button type="button" style={secondaryBtn} onClick={retry}>Try again</button>
            )}
            <button type="button" style={primaryBtn} onClick={onClose}>Done</button>
          </>
        ) : undefined}
      >
        {stage === 'done' ? (
          <CardShell
            icon={Send}
            title={failures.length
              ? `${doneCount} of ${plan.length} changes are on the till`
              : plan.length === 1 ? `${plan[0].name} is on the till` : `All ${plan.length} changes are on the till`}
            subtitle={`Published ${sm.lastReceipt?.at ?? ''}. Staff see them next time the till refreshes.`}
            state={failures.length ? 'partial' : 'confirmed'}
          >
            <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
              {plan.map((l) => (
                <li key={l.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 13 }}>
                  {run[l.id] === 'failed'
                    ? <AlertTriangle size={14} color="var(--color-warning, #B45309)" aria-hidden style={{ marginTop: 2 }} />
                    : <Check size={14} color="var(--color-success, #166534)" aria-hidden style={{ marginTop: 2 }} />}
                  <span style={{ flex: 1 }}>
                    <strong style={{ fontWeight: 600 }}>{l.name}</strong>
                    {run[l.id] === 'failed' && (
                      <span style={{ display: 'block', color: 'var(--color-text-muted)', fontSize: 12.5 }}>
                        {failures.find((f) => f.id === l.id)?.reason}
                      </span>
                    )}
                  </span>
                </li>
              ))}
            </ul>
          </CardShell>
        ) : (
          <div aria-live="polite" style={{ background: '#fff', border: '1px solid var(--color-border-subtle)', borderRadius: 12, padding: 14 }}>
            <p style={{ fontSize: 13, margin: '0 0 10px', color: 'var(--color-text-muted)' }}>
              {doneCount} of {plan.length} done. Square takes one change at a time, so this runs in order.
            </p>
            <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
              {plan.map((l) => (
                <li key={l.id} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
                  <RunIcon state={run[l.id]} />
                  <span style={{ flex: 1 }}>{l.name}</span>
                  <span style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>
                    {run[l.id] === 'running' ? 'Sending' : run[l.id] === 'done' ? 'On the till' : run[l.id] === 'failed' ? 'Didn’t go through' : 'Waiting'}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </Sheet>
    );
  }

  const footer = (
    <>
      <span style={{ flex: 1, fontSize: 12.5, color: 'var(--color-text-muted)' }}>
        {selected.length} of {all.length} selected
      </span>
      <button type="button" style={secondaryBtn} onClick={onClose}>Cancel</button>
      <button
        type="button"
        style={{ ...primaryBtn, opacity: selected.length ? 1 : 0.5, cursor: selected.length ? 'pointer' : 'not-allowed' }}
        disabled={!selected.length}
        onClick={() => start(selected)}
      >
        <Send size={14} /> Publish {selected.length} {selected.length === 1 ? 'change' : 'changes'}
      </button>
    </>
  );

  return (
    <Sheet eyebrowText="Publish to Square" title="Check what goes to the till" onClose={onClose} footer={footer}>
      <p style={{ fontSize: 13, color: 'var(--color-text-muted)', margin: '0 0 14px', lineHeight: 1.5 }}>
        This is everything that changed in Edify since you last published. Untick anything you&apos;re not ready to send.
      </p>

      {(overwrites.length > 0 || blocked.length > 0 || waiting > 0 || sizeRemovals.length > 0 || optionsOff.length > 0) && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
          {waiting > 0 && (
            <Warn>
              {waiting} {waiting === 1 ? 'change' : 'changes'} made in Square {waiting === 1 ? 'is' : 'are'} waiting for you. This publish leaves {waiting === 1 ? 'it' : 'them'} alone.{' '}
              <button type="button" style={linkBtn} onClick={onReviewChanges}>Review them</button>
            </Warn>
          )}
          {overwrites.map((i) => (
            <Warn key={`ow-${i.id}`}>
              {i.current.name}: you chose to keep Edify&apos;s {i.overwriteKeys.map((k) => FIELD_LABELS[k].toLowerCase()).join(' and ')}. This replaces the change made in Square.
            </Warn>
          ))}
          {sizeRemovals.map((i) => {
            const gone = i.inSquare!.sizes.filter((s) => !i.current.sizes.includes(s));
            return (
              <Warn key={`sz-${i.id}`}>
                {gone.join(', ')} comes off {i.current.name}. Staff can&apos;t ring {gone.length === 1 ? 'it' : 'them'} up after this.{' '}
                <button type="button" style={linkBtn} onClick={() => onOpenItem(i.id)}>Check sizes</button>
              </Warn>
            );
          })}
          {optionsOff.map(({ item: i, o }) => (
            <Warn key={`off-${i.id}-${o.groupName}-${o.optionName}`}>
              {i.current.name}: {optionOffCopy(o)}
            </Warn>
          ))}
          {blocked.map((i) => (
            <Warn key={`bl-${i.id}`} tone="error">
              {i.current.name} can&apos;t publish. Square needs the same modifier groups on every size.{' '}
              <button type="button" style={linkBtn} onClick={() => onOpenItem(i.id)}>Fix it</button>
            </Warn>
          ))}
        </div>
      )}

      <Group title="Modifier groups" lines={groupLines} unticked={unticked} onToggle={toggle} />
      <Group title="New on the till" lines={created} unticked={unticked} onToggle={toggle} onOpen={onOpenItem} />
      <Group title="Updated" lines={updated} unticked={unticked} onToggle={toggle} onOpen={onOpenItem} />
      <Group title="Coming off the till" lines={removed} unticked={unticked} onToggle={toggle} onOpen={onOpenItem} />

      {all.length === 0 && (
        <p style={{ fontSize: 13.5, color: 'var(--color-text-muted)' }}>Nothing to publish. The till matches Edify.</p>
      )}
    </Sheet>
  );
}

function RunIcon({ state }: { state?: RunState[string] }) {
  if (state === 'done') return <Check size={15} color="var(--color-success, #166534)" aria-hidden />;
  if (state === 'failed') return <X size={15} color="var(--color-error, #B91C1C)" aria-hidden />;
  if (state === 'running') return <Loader2 size={15} aria-hidden style={{ animation: 'quinn-spin 1s linear infinite' }} />;
  return <span aria-hidden style={{ width: 15, height: 15, borderRadius: 100, border: '1.5px solid var(--color-border-subtle)', display: 'inline-block' }} />;
}

function Warn({ children, tone = 'warning' }: { children: React.ReactNode; tone?: 'warning' | 'error' }) {
  const color = tone === 'error' ? 'var(--color-error, #B91C1C)' : 'var(--color-warning, #B45309)';
  return (
    <div
      style={{
        display: 'flex', gap: 8, alignItems: 'flex-start',
        padding: '10px 12px', borderRadius: 10,
        background: '#fff', border: `1px solid ${color}`,
        fontSize: 13, lineHeight: 1.45, color: 'var(--color-text-primary)',
      }}
    >
      <AlertTriangle size={15} color={color} aria-hidden style={{ flexShrink: 0, marginTop: 2 }} />
      <span>{children}</span>
    </div>
  );
}

function Group({
  title, lines, unticked, onToggle, onOpen,
}: {
  title: string;
  lines: Line[];
  unticked: Set<string>;
  onToggle: (id: string) => void;
  onOpen?: (id: string) => void;
}) {
  if (lines.length === 0) return null;
  return (
    <section style={{ marginBottom: 16 }}>
      <h3 style={{ ...eyebrow, margin: '0 0 6px' }}>{title} · {lines.length}</h3>
      <div style={{ background: '#fff', border: '1px solid var(--color-border-subtle)', borderRadius: 12 }}>
        {lines.map((l, idx) => (
          <div
            key={l.id}
            style={{
              display: 'flex', alignItems: 'flex-start', gap: 10,
              padding: '10px 14px',
              borderTop: idx === 0 ? 'none' : '1px solid var(--color-border-subtle)',
            }}
          >
            <input
              type="checkbox"
              id={`pub-${l.id}`}
              checked={!unticked.has(l.id)}
              onChange={() => onToggle(l.id)}
              style={{ marginTop: 3 }}
            />
            <label htmlFor={`pub-${l.id}`} style={{ flex: 1, minWidth: 0, cursor: 'pointer' }}>
              <span style={{ display: 'block', fontSize: 13.5, fontWeight: 600 }}>{l.name}</span>
              {l.details.map((d) => (
                <span key={d} style={{ display: 'block', fontSize: 12.5, color: 'var(--color-text-muted)', marginTop: 2 }}>{d}</span>
              ))}
            </label>
            {onOpen && (
              <button type="button" style={linkBtn} onClick={() => onOpen(l.id)} aria-label={`Open ${l.name}`}>Open</button>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
