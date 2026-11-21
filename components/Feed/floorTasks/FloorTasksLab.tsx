'use client';

import { useState } from 'react';
import { EVAL_SETS, type EvalCase } from '@/lib/floorTasks/evalPhrases';
import { createScope } from '@/lib/floorTasks/tools/scope';
import { floorTools } from '@/lib/floorTasks/tools';
import type { CommandResponse } from '@/lib/floorTasks/types';
import { confirmMode } from '@/lib/floorTasks/voice';
import {
  addProposals, buildSnapshot, getWorld, resetWorld, setReferenceRequired, setRole, setStocktakeInProgress, useWorld,
} from '@/lib/floorTasks/world/store';
import FloorTaskBar from './FloorTaskBar';
import FloorTaskCard from './FloorTaskCard';

type Result = {
  via: 'model' | 'direct';
  pass: boolean;
  tools: string[];
  say: string;
  proposalIds: string[];
  engine?: 'model' | 'demo';
  error?: string;
};

const keyOf = (setId: string, i: number) => `${setId}:${i}`;

function stage(proposals: CommandResponse['proposals']) {
  const surface = getWorld().surface;
  addProposals(proposals, proposals.filter((p) => confirmMode(p, surface) === 'waiting').map((p) => p.id));
}

async function runDirect(c: EvalCase): Promise<Result> {
  const snap = buildSnapshot();
  const scope = createScope(snap);
  const def = floorTools(scope).find((t) => t.name === c.tool);
  if (!def || !c.args) return { via: 'direct', pass: false, tools: [], say: '', proposalIds: [], error: 'No direct call for this one' };
  const args = typeof c.args === 'function' ? c.args(snap.today) : c.args;
  const out = JSON.parse((await def.handler(args as never)).content[0].text) as Record<string, unknown>;
  stage(scope.proposals);
  const say = String(out.refused ?? out.question ?? out.readback ?? out.answer ?? JSON.stringify(out));
  return { via: 'direct', pass: true, tools: [c.tool], say, proposalIds: scope.proposals.map((p) => p.id) };
}

async function runModel(c: EvalCase): Promise<Result> {
  const r = await fetch('/api/command', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text: c.phrase, history: [], snapshot: buildSnapshot() }),
  });
  const res = (await r.json()) as CommandResponse;
  const proposals = res.proposals ?? [];
  stage(proposals);
  const tools = res.toolsCalled ?? [];
  const asked = res.route === 'floor' && !tools.length && !!res.say;
  const pass = c.tool === 'not_a_floor_task' ? res.route === 'other' : tools.includes(c.tool) || asked;
  const say = res.say || proposals.map((p) => p.readback).join(' ');
  return { via: 'model', pass, tools, say, proposalIds: proposals.map((p) => p.id), engine: res.engine, error: res.error };
}

export default function FloorTasksLab() {
  const w = useWorld();
  const [results, setResults] = useState<Record<string, Result>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [openSet, setOpenSet] = useState<string>(EVAL_SETS[0].id);

  async function run(setId: string, i: number, via: 'model' | 'direct') {
    const c = EVAL_SETS.find((s) => s.id === setId)!.cases[i];
    if (c.role) setRole(c.role);
    const k = keyOf(setId, i);
    setBusy(k);
    try {
      const res = via === 'model' ? await runModel(c) : await runDirect(c);
      setResults((prev) => ({ ...prev, [k]: res }));
    } catch (e) {
      setResults((prev) => ({ ...prev, [k]: { via, pass: false, tools: [], say: '', proposalIds: [], error: String(e) } }));
    } finally {
      setBusy(null);
    }
  }

  async function runSet(setId: string, via: 'model' | 'direct') {
    const set = EVAL_SETS.find((s) => s.id === setId)!;
    for (let i = 0; i < set.cases.length; i += 1) {
      if (via === 'direct' && !set.cases[i].args) continue;
      await run(setId, i, via);
    }
  }

  const total = Object.values(results).filter((r) => r.via === 'model');
  const passed = total.filter((r) => r.pass).length;
  const demoMode = total.some((r) => r.engine === 'demo');

  return (
    <main style={{ maxWidth: '1100px', margin: '0 auto', padding: '32px 24px 80px', fontFamily: 'var(--font-primary)', color: 'var(--color-text-primary)' }}>
      <h1 style={{ fontSize: '22px', fontWeight: 700, margin: '0 0 6px' }}>Floor tasks: test phrases</h1>
      <p style={{ fontSize: '13.5px', color: 'var(--color-text-secondary)', margin: '0 0 16px', maxWidth: '720px', lineHeight: 1.5 }}>
        Each phrase says which tool Edify should call. &ldquo;Send&rdquo; puts it through /api/command, the same as the chat: the model when a key is set, demo mode when
        not. &ldquo;Stage directly&rdquo; calls the tool with known arguments, so the card and Main&rsquo;s rules can be checked on their own. Nothing here is applied until you
        confirm a card.
      </p>

      {demoMode && (
        <div role="status" style={{ padding: '10px 14px', borderRadius: '10px', background: 'var(--color-warning-light)', border: '1px solid var(--color-warning-border)', color: 'var(--color-text-primary)', fontSize: '13px', marginBottom: '14px' }}>
          Demo mode: no model key on this machine, so these were read with set patterns, which were written against these phrases. Add AI_GATEWAY_API_KEY to .env.local and
          restart to test the model.
        </div>
      )}

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', alignItems: 'center', marginBottom: '8px' }}>
        <Toggle label="Stocktake in progress" on={w.stocktakeInProgress} onChange={setStocktakeInProgress} />
        <Toggle label="Delivery needs a supplier reference" on={w.deliveries.some((d) => d.requiresReference)} onChange={setReferenceRequired} />
        <button type="button" onClick={() => { resetWorld(); setResults({}); }} style={btn}>Reset the site</button>
        {total.length > 0 && (
          <span style={{ fontSize: '13px', fontWeight: 600 }} aria-live="polite">{demoMode ? 'Demo mode' : 'Model'}: {passed} of {total.length} read as the right task</span>
        )}
      </div>
      <FloorTaskBar onOpen={() => undefined} />

      <div style={{ display: 'grid', gridTemplateColumns: '220px 1fr', gap: '20px', marginTop: '20px' }}>
        <nav aria-label="Tasks" style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
          {EVAL_SETS.map((s) => {
            const rs = s.cases.map((_, i) => results[keyOf(s.id, i)]).filter((r) => r?.via === 'model');
            return (
              <button
                key={s.id}
                type="button"
                aria-current={openSet === s.id}
                onClick={() => setOpenSet(s.id)}
                style={{ ...navBtn, background: openSet === s.id ? 'rgba(0,28,53,0.06)' : 'transparent', fontWeight: openSet === s.id ? 700 : 500 }}
              >
                <span>{s.title}</span>
                <span style={{ color: 'var(--color-text-secondary)', fontWeight: 500 }}>
                  {rs.length ? `${rs.filter((r) => r.pass).length}/${rs.length}` : s.cases.length}
                </span>
              </button>
            );
          })}
        </nav>

        {EVAL_SETS.filter((s) => s.id === openSet).map((s) => (
          <section key={s.id} aria-label={s.title}>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '10px' }}>
              <h2 style={{ fontSize: '16px', fontWeight: 700, margin: 0, flex: 1 }}>{s.title}</h2>
              <button type="button" style={btn} disabled={!!busy} onClick={() => void runSet(s.id, 'direct')}>Stage all directly</button>
              <button type="button" style={btnDark} disabled={!!busy} onClick={() => void runSet(s.id, 'model')}>Send all</button>
            </div>
            {s.cases.map((c, i) => {
              const k = keyOf(s.id, i);
              const r = results[k];
              return (
                <div key={k} style={{ border: '1px solid rgba(0,28,53,0.12)', borderRadius: '12px', padding: '12px 14px', marginBottom: '10px', background: '#fff' }}>
                  <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
                    <div style={{ flex: 1, minWidth: '240px' }}>
                      <div style={{ fontSize: '14px', fontWeight: 600 }}>&ldquo;{c.phrase}&rdquo;</div>
                      <div style={{ fontSize: '12px', color: 'var(--color-text-secondary)', marginTop: '2px' }}>
                        Expects {c.tool}
                        {c.role ? ` · as ${c.role === 'manager' ? 'a manager' : 'a team member'}` : ''}
                        {c.expect ? ` · ${c.expect}` : ''}
                      </div>
                    </div>
                    {c.args && (
                      <button type="button" style={btn} disabled={busy === k} onClick={() => void run(s.id, i, 'direct')}>Stage directly</button>
                    )}
                    <button type="button" style={btnDark} disabled={busy === k} onClick={() => void run(s.id, i, 'model')}>
                      {busy === k ? 'Sending' : 'Send'}
                    </button>
                  </div>
                  {r && (
                    <div style={{ marginTop: '10px' }}>
                      <div style={{ fontSize: '12.5px', display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
                        <span style={{ fontWeight: 700, color: r.pass ? '#166534' : '#B42318' }}>{r.pass ? 'Pass' : 'Check'}</span>
                        <span style={{ color: 'var(--color-text-secondary)' }}>
                          {r.via === 'direct' ? 'Direct' : r.engine === 'demo' ? 'Demo mode' : 'Model'} · tools: {r.tools.join(', ') || 'none'}
                          {r.error ? ` · ${r.error}` : ''}
                        </span>
                      </div>
                      {r.say && <p style={{ fontSize: '13.5px', margin: '6px 0 0', lineHeight: 1.5 }}>Edify: {r.say}</p>}
                      {r.proposalIds.map((id) => (
                        <div key={id} style={{ marginTop: '8px', maxWidth: '560px' }}>
                          <FloorTaskCard proposalId={id} />
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </section>
        ))}
      </div>
    </main>
  );
}

function Toggle({ label, on, onChange }: { label: string; on: boolean; onChange: (v: boolean) => void }) {
  return (
    <label style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', minHeight: '40px', padding: '0 12px', borderRadius: '100px', border: '1.5px solid rgba(0,28,53,0.18)', fontSize: '12.5px', fontWeight: 600, cursor: 'pointer', background: '#fff' }}>
      <input type="checkbox" checked={on} onChange={(e) => onChange(e.target.checked)} style={{ width: '16px', height: '16px' }} />
      {label}
    </label>
  );
}

const btn: React.CSSProperties = {
  minHeight: '40px',
  padding: '0 14px',
  borderRadius: '100px',
  border: '1.5px solid rgba(0,28,53,0.18)',
  background: '#fff',
  color: 'var(--color-text-primary)',
  fontSize: '12.5px',
  fontWeight: 600,
  fontFamily: 'var(--font-primary)',
  cursor: 'pointer',
};

const btnDark: React.CSSProperties = { ...btn, background: 'var(--color-accent-active, #224444)', color: '#fff', borderColor: 'transparent' };

const navBtn: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  minHeight: '40px',
  padding: '0 12px',
  borderRadius: '8px',
  border: 'none',
  fontSize: '13px',
  fontFamily: 'var(--font-primary)',
  color: 'var(--color-text-primary)',
  cursor: 'pointer',
  textAlign: 'left',
};
