'use client';

/**
 * SyncMatchModal — stand-in for the background agent that will eventually
 * keep POS items in sync and auto-match them to recipes / products / master
 * products. Until that ships, this gives the operator a manual "Sync &
 * match" button that:
 *
 *   1) "Pulls" fresh POS items (simulated for the prototype).
 *   2) Runs a name-similarity pass against the recipe library, product
 *      catalog, and master products.
 *   3) Auto-applies confident matches via the override store, and lists
 *      anything ambiguous so the operator can finish them by hand.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, Loader2, RefreshCw, Search, X } from 'lucide-react';
import { useRecipes } from '@/components/Recipe/recipeStore';
import { useProducts, useMasterProducts } from '@/components/Suppliers/store';
import { FITZROY_POS_INTAKE } from '@/components/Recipe/intakeFixtures';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { setMatchTarget, useMatchOverrides, type MatchTargetType } from './overrideStore';
import { MatchPicker } from './MatchPicker';

// Chrome dimensions of the (menu) layout — sidebar + top bar + sub-tab nav.
// Used to inset the modal so it centers in the *available content area*
// rather than dead-center of the viewport (the latter visually overlaps
// the sidebar even though the dim overlay is on top of it).
const SIDEBAR_WIDTH = 240;
const TOP_CHROME_HEIGHT = 124;
const MOBILE_BREAKPOINT = '(max-width: 640px)';

type Stage = {
  id: string;
  label: string;
  /** ms to spend in the "running" state before completing. */
  durationMs: number;
};

const STAGES: Stage[] = [
  { id: 'connect',  label: 'Connecting to Square POS',         durationMs: 700 },
  { id: 'pull',     label: 'Pulling menu items + sales data',  durationMs: 900 },
  { id: 'scan',     label: 'Scanning library for matches',     durationMs: 1100 },
  { id: 'apply',    label: 'Applying confident matches',       durationMs: 600 },
];

type Phase = 'idle' | 'running' | 'done';

type MatchResult = {
  posItemId: string;
  posItemName: string;
  type: MatchTargetType;
  targetId: string;
  targetName: string;
  confidence: 'high' | 'uncertain';
  /** Why we flagged this as uncertain — shown to the operator. */
  reason?: string;
};

/**
 * Demo-time injections that force a couple of "needs your call" rows even
 * when the natural matcher is very confident. The eventual background agent
 * will surface its own uncertainty signals; until then we hardcode a couple
 * of realistic edge cases so the UX has something to confirm.
 */
const UNCERTAIN_INJECTIONS: Array<{
  posItemId: string;
  preferredTargetName: string;
  reason: string;
}> = [
  {
    posItemId: 'mi-almond-croissant',
    preferredTargetName: 'Croissant',
    reason: '"Almond" might be a modifier on the base croissant — or its own recipe.',
  },
  {
    posItemId: 'mi-babyccino',
    preferredTargetName: 'Cappuccino',
    reason: 'Kids drink — could be a scaled cappuccino, or a separate recipe.',
  },
];

function normalize(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9 ]+/g, '').replace(/\s+/g, ' ').trim();
}

function score(a: string, b: string): number {
  const na = normalize(a);
  const nb = normalize(b);
  if (!na || !nb) return 0;
  if (na === nb) return 1;
  if (na.includes(nb) || nb.includes(na)) return 0.8;
  // Token overlap
  const ta = new Set(na.split(' '));
  const tb = new Set(nb.split(' '));
  let shared = 0;
  for (const t of ta) if (tb.has(t)) shared += 1;
  const union = new Set([...ta, ...tb]).size;
  return union === 0 ? 0 : shared / union;
}

export function SyncMatchModal({ onClose }: { onClose: () => void }) {
  const recipes = useRecipes();
  const products = useProducts();
  const masters = useMasterProducts();
  const overrides = useMatchOverrides();
  const isMobile = useMediaQuery(MOBILE_BREAKPOINT);

  // Portal target — `document` is unavailable during SSR, so we mount it
  // after first paint and guard the render below.
  const [portalReady, setPortalReady] = useState(false);
  useEffect(() => { setPortalReady(true); }, []);

  const [phase, setPhase] = useState<Phase>('idle');
  const [stageIdx, setStageIdx] = useState(0);
  // Results computed once at the start of the run so the count is stable.
  const [results, setResults] = useState<MatchResult[]>([]);
  const [scanned, setScanned] = useState(0);
  // For uncertain rows we record what the operator did with each one. A
  // `confirmed` decision carries the *actual* target the user landed on,
  // which may differ from the AI's original suggestion when they picked
  // something else.
  const [uncertainDecisions, setUncertainDecisions] = useState<
    Map<string, { kind: 'confirmed'; targetName: string } | { kind: 'skipped' }>
  >(new Map());
  const [pickerOpenFor, setPickerOpenFor] = useState<string | null>(null);
  const appliedRef = useRef(false);

  // Compute candidates lazily so we have the freshest data when the user clicks Run.
  const candidates = useMemo(() => {
    const recipeCandidates = recipes
      .filter((r) => r.status !== 'Archived')
      .map((r) => ({ type: 'recipe' as const, id: r.id, name: r.name }));
    const productCandidates = products.map((p) => ({ type: 'product' as const, id: p.id, name: p.name }));
    const masterCandidates = masters.map((m) => ({ type: 'master-product' as const, id: m.id, name: m.name }));
    return [...recipeCandidates, ...productCandidates, ...masterCandidates];
  }, [recipes, products, masters]);

  function computeResults(): MatchResult[] {
    // Anything that's already matched (via posSourceId or override) is left alone.
    const alreadyMatchedPosIds = new Set<string>();
    for (const r of recipes) {
      if (r.posSourceId && r.posSourceId.startsWith('pos-')) {
        alreadyMatchedPosIds.add(r.posSourceId.slice(4));
      }
    }
    for (const [posId, ov] of overrides) {
      if (ov.target) alreadyMatchedPosIds.add(posId);
      if (ov.hidden) alreadyMatchedPosIds.add(posId);
    }
    const out: MatchResult[] = [];
    for (const pos of FITZROY_POS_INTAKE.menuItems) {
      if (alreadyMatchedPosIds.has(pos.id)) continue;
      let best: { c: typeof candidates[number]; s: number } | null = null;
      for (const c of candidates) {
        const s = score(pos.name, c.name);
        if (!best || s > best.s) best = { c, s };
      }
      if (!best || best.s < 0.8) continue;
      out.push({
        posItemId: pos.id,
        posItemName: pos.name,
        type: best.c.type,
        targetId: best.c.id,
        targetName: best.c.name,
        confidence: 'high',
      });
    }

    for (const inj of UNCERTAIN_INJECTIONS) {
      const posItem = FITZROY_POS_INTAKE.menuItems.find((m) => m.id === inj.posItemId);
      if (!posItem) continue;
      if (alreadyMatchedPosIds.has(posItem.id)) continue;
      const target = candidates.find((c) => c.name === inj.preferredTargetName);
      if (!target) continue;
      const replacement: MatchResult = {
        posItemId: posItem.id,
        posItemName: posItem.name,
        type: target.type,
        targetId: target.id,
        targetName: target.name,
        confidence: 'uncertain',
        reason: inj.reason,
      };
      const existingIdx = out.findIndex((r) => r.posItemId === posItem.id);
      if (existingIdx >= 0) out[existingIdx] = replacement;
      else out.push(replacement);
    }
    return out;
  }

  // Drive the stage animation when running.
  useEffect(() => {
    if (phase !== 'running') return;
    if (stageIdx >= STAGES.length) {
      if (!appliedRef.current) {
        appliedRef.current = true;
        for (const r of results) {
          if (r.confidence === 'high') {
            setMatchTarget(r.posItemId, { type: r.type, id: r.targetId });
          }
        }
      }
      setPhase('done');
      return;
    }
    const stage = STAGES[stageIdx];
    const t = window.setTimeout(() => setStageIdx((i) => i + 1), stage.durationMs);
    return () => window.clearTimeout(t);
  }, [phase, stageIdx, results]);

  // Animate the "items scanned" counter while we're in the scan stage.
  useEffect(() => {
    if (phase !== 'running') return;
    if (STAGES[stageIdx]?.id !== 'scan') return;
    const total = FITZROY_POS_INTAKE.menuItems.length;
    const start = performance.now();
    const dur = STAGES[stageIdx].durationMs;
    let raf = 0;
    function tick(now: number) {
      const t = Math.min(1, (now - start) / dur);
      setScanned(Math.floor(t * total));
      if (t < 1) raf = requestAnimationFrame(tick);
    }
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [phase, stageIdx]);

  function start() {
    const fresh = computeResults();
    setResults(fresh);
    setScanned(0);
    setStageIdx(0);
    setUncertainDecisions(new Map());
    setPickerOpenFor(null);
    appliedRef.current = false;
    setPhase('running');
  }

  function confirmUncertain(r: MatchResult): void {
    setMatchTarget(r.posItemId, { type: r.type, id: r.targetId });
    setUncertainDecisions((prev) => {
      const next = new Map(prev);
      next.set(r.posItemId, { kind: 'confirmed', targetName: r.targetName });
      return next;
    });
  }

  function skipUncertain(posItemId: string): void {
    setUncertainDecisions((prev) => {
      const next = new Map(prev);
      next.set(posItemId, { kind: 'skipped' });
      return next;
    });
  }

  function recordPicked(posItemId: string, picked: { name: string }): void {
    setUncertainDecisions((prev) => {
      const next = new Map(prev);
      next.set(posItemId, { kind: 'confirmed', targetName: picked.name });
      return next;
    });
    setPickerOpenFor(null);
  }

  const highConfidence = results.filter((r) => r.confidence === 'high');
  const uncertain = results.filter((r) => r.confidence === 'uncertain');
  const pendingUncertain = uncertain.filter((r) => !uncertainDecisions.has(r.posItemId));

  if (!portalReady) return null;

  return createPortal(
    <div
      onClick={(e) => { if (e.target === e.currentTarget && phase !== 'running') onClose(); }}
      style={{
        position: 'fixed', inset: 0,
        background: 'rgba(0, 28, 53, 0.22)',
        zIndex: 1100,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        // Inset the centering area to the available content space so the
        // panel reads as centered relative to the page, not the chrome.
        paddingTop: TOP_CHROME_HEIGHT + 24,
        paddingBottom: 24,
        paddingLeft: (isMobile ? 0 : SIDEBAR_WIDTH) + 24,
        paddingRight: 24,
        fontFamily: 'var(--font-primary)',
      }}
    >
      <div
        style={{
          width: 'min(560px, 92vw)',
          background: '#fff',
          borderRadius: 14,
          border: '1px solid var(--color-border-subtle)',
          boxShadow: '0 24px 48px -16px rgba(0, 28, 53, 0.35)',
          overflow: 'hidden',
          display: 'flex', flexDirection: 'column',
          // Cap to whatever vertical space the centering area actually has,
          // so internal scroll engages instead of pushing past the chrome.
          maxHeight: `calc(100vh - ${TOP_CHROME_HEIGHT + 64}px)`,
        }}
      >
        {/* Header */}
        <div style={{
          padding: '16px 18px',
          borderBottom: '1px solid var(--color-border-subtle)',
          display: 'flex', alignItems: 'center', gap: 10,
        }}>
          <div style={{
            width: 28, height: 28, borderRadius: 8,
            background: 'rgba(40, 175, 201, 0.15)',
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          }}>
            {/* Edify brand mark — same mask-image trick the sidebar uses
                so it picks up the accent color cleanly. */}
            <span
              role="img"
              aria-label="Edify"
              style={{
                display: 'block',
                width: 16, height: 16,
                backgroundColor: 'var(--color-accent-mid, #28AFC9)',
                WebkitMaskImage: 'url(/edify-logo.svg)',
                maskImage: 'url(/edify-logo.svg)',
                WebkitMaskRepeat: 'no-repeat',
                maskRepeat: 'no-repeat',
                WebkitMaskPosition: 'center',
                maskPosition: 'center',
                WebkitMaskSize: 'contain',
                maskSize: 'contain',
              }}
            />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 14.5, fontWeight: 700, color: 'var(--color-text-primary)' }}>
              Sync & auto-match
            </div>
            <div style={{ fontSize: 12, color: 'var(--color-text-muted)', marginTop: 2 }}>
              {phase === 'idle'
                ? 'Pulls fresh POS data and links anything we can match with high confidence.'
                : phase === 'running'
                  ? 'Working — this normally takes a few seconds.'
                  : pendingUncertain.length > 0
                    ? `${pendingUncertain.length} ${pendingUncertain.length === 1 ? 'match needs' : 'matches need'} your call before closing.`
                    : 'Done. The background agent will do this on its own once it ships.'}
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={phase === 'running'}
            aria-label="Close"
            style={{
              background: 'transparent', border: 'none',
              padding: 4, color: 'var(--color-text-muted)',
              cursor: phase === 'running' ? 'not-allowed' : 'pointer',
              opacity: phase === 'running' ? 0.4 : 1,
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: '14px 18px 4px', overflowY: 'auto', flex: 1 }}>
          {phase === 'idle' && (
            <div style={{ fontSize: 13, color: 'var(--color-text-secondary)' }}>
              <ul style={{ margin: 0, paddingLeft: 18, lineHeight: 1.7 }}>
                <li>Re-sync menu items + sales from <strong>{FITZROY_POS_INTAKE.source}</strong>.</li>
                <li>Auto-link rows where a recipe, product, or master product is a confident name match.</li>
                <li>Anything ambiguous stays in <em>Needs review</em> for you to finish.</li>
              </ul>
            </div>
          )}

          {phase === 'running' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {STAGES.map((stage, i) => {
                const state: 'done' | 'running' | 'pending' = i < stageIdx ? 'done' : i === stageIdx ? 'running' : 'pending';
                return (
                  <div key={stage.id} style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    padding: '10px 0',
                  }}>
                    <div style={{
                      width: 20, height: 20, borderRadius: 100,
                      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                      background: state === 'done'
                        ? 'var(--color-success-light, #E3F2E8)'
                        : state === 'running'
                          ? 'rgba(40, 175, 201, 0.15)'
                          : '#F1F0EC',
                      color: state === 'done'
                        ? 'var(--color-success, #166534)'
                        : state === 'running'
                          ? 'var(--color-accent-mid, #28AFC9)'
                          : 'var(--color-text-muted)',
                    }}>
                      {state === 'done'
                        ? <Check size={12} strokeWidth={3} />
                        : state === 'running'
                          ? <Loader2 size={12} style={{ animation: 'spin 1s linear infinite' }} />
                          : <span style={{ width: 6, height: 6, borderRadius: 100, background: 'currentColor' }} />}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{
                        fontSize: 13, fontWeight: state === 'pending' ? 500 : 600,
                        color: state === 'pending' ? 'var(--color-text-muted)' : 'var(--color-text-primary)',
                      }}>
                        {stage.label}
                      </div>
                      {state === 'running' && stage.id === 'scan' && (
                        <div style={{ fontSize: 11.5, color: 'var(--color-text-muted)', marginTop: 2 }}>
                          {scanned}/{FITZROY_POS_INTAKE.menuItems.length} items scanned · {candidates.length} candidates
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {phase === 'done' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{
                display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
                gap: 8,
              }}>
                <SummaryStat
                  label="Auto-matched"
                  value={highConfidence.length}
                  accent="var(--color-success, #166534)"
                />
                <SummaryStat
                  label="Needs your call"
                  value={uncertain.length}
                  accent="var(--color-warning, #EA580C)"
                />
                <SummaryStat
                  label="Still unmatched"
                  value={Math.max(
                    0,
                    FITZROY_POS_INTAKE.menuItems.length
                      - highConfidence.length
                      - uncertain.length,
                  )}
                  accent="var(--color-text-primary)"
                />
              </div>
              {highConfidence.length > 0 && (
                <div>
                  <div style={{
                    fontSize: 11, fontWeight: 700, letterSpacing: '0.06em',
                    textTransform: 'uppercase', color: 'var(--color-text-muted)',
                    margin: '8px 0 6px',
                  }}>
                    Newly auto-linked
                  </div>
                  <div style={{
                    border: '1px solid var(--color-border-subtle)',
                    borderRadius: 10, overflow: 'hidden',
                  }}>
                    {highConfidence.slice(0, 6).map((r, i) => (
                      <div key={r.posItemId} style={{
                        display: 'flex', alignItems: 'center', gap: 8,
                        padding: '8px 12px',
                        borderTop: i === 0 ? 'none' : '1px solid var(--color-border-subtle)',
                        fontSize: 12.5,
                      }}>
                        <span style={{ flex: 1, minWidth: 0, color: 'var(--color-text-primary)', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {r.posItemName}
                        </span>
                        <span style={{ color: 'var(--color-text-muted)', fontSize: 11 }}>→</span>
                        <span style={{ flex: 1, minWidth: 0, color: 'var(--color-text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {r.targetName}
                        </span>
                        <TypeTag type={r.type} />
                      </div>
                    ))}
                    {highConfidence.length > 6 && (
                      <div style={{
                        padding: '8px 12px',
                        borderTop: '1px solid var(--color-border-subtle)',
                        fontSize: 12, color: 'var(--color-text-muted)',
                      }}>
                        + {highConfidence.length - 6} more
                      </div>
                    )}
                  </div>
                </div>
              )}
              {highConfidence.length === 0 && (
                <div style={{
                  padding: '14px 16px', borderRadius: 10,
                  background: '#FBFAF8',
                  border: '1px solid var(--color-border-subtle)',
                  fontSize: 12.5, color: 'var(--color-text-secondary)',
                }}>
                  Nothing new to auto-link. The remaining unmatched buttons need a human eye — open the dropdown on each row.
                </div>
              )}

              {uncertain.length > 0 && (
                <div>
                  <div style={{
                    fontSize: 11, fontWeight: 700, letterSpacing: '0.06em',
                    textTransform: 'uppercase', color: 'var(--color-text-muted)',
                    margin: '12px 0 6px',
                  }}>
                    Needs your call
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {uncertain.map((r) => {
                      const decision = uncertainDecisions.get(r.posItemId);
                      const pickerOpen = pickerOpenFor === r.posItemId;
                      return (
                        <div key={r.posItemId} style={{
                          border: '1px solid var(--color-border-subtle)',
                          borderRadius: 10,
                          padding: '10px 12px',
                          background: decision?.kind === 'skipped' ? '#FBFAF8' : '#fff',
                          display: 'flex', flexDirection: 'column', gap: 8,
                        }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5 }}>
                            <span style={{ flex: 1, minWidth: 0, color: 'var(--color-text-primary)', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {r.posItemName}
                            </span>
                            <span style={{ color: 'var(--color-text-muted)', fontSize: 11 }}>→</span>
                            <span style={{ flex: 1, minWidth: 0, color: 'var(--color-text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {r.targetName}
                            </span>
                            <TypeTag type={r.type} />
                          </div>
                          {r.reason && (
                            <div style={{ fontSize: 11.5, color: 'var(--color-text-muted)', lineHeight: 1.5 }}>
                              {r.reason}
                            </div>
                          )}
                          {!decision && !pickerOpen && (
                            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                              <button
                                onClick={() => confirmUncertain(r)}
                                style={confirmBtnStyle}
                              >
                                <Check size={12} strokeWidth={3} />
                                Confirm match
                              </button>
                              <button
                                onClick={() => setPickerOpenFor(r.posItemId)}
                                style={pickDifferentBtnStyle}
                              >
                                <Search size={12} />
                                Pick different…
                              </button>
                              <button
                                onClick={() => skipUncertain(r.posItemId)}
                                style={skipBtnStyle}
                              >
                                Skip
                              </button>
                            </div>
                          )}
                          {pickerOpen && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                              <MatchPicker
                                posItemId={r.posItemId}
                                posItemName={r.posItemName}
                                currentTarget={{ type: r.type, id: r.targetId }}
                                mode="inline"
                                onPick={(picked) => recordPicked(r.posItemId, picked)}
                                onClose={() => setPickerOpenFor(null)}
                              />
                              <button
                                onClick={() => setPickerOpenFor(null)}
                                style={{
                                  alignSelf: 'flex-start',
                                  padding: '4px 8px',
                                  fontSize: 11.5, fontWeight: 600,
                                  color: 'var(--color-text-muted)',
                                  background: 'transparent', border: 'none',
                                  cursor: 'pointer',
                                  fontFamily: 'var(--font-primary)',
                                }}
                              >
                                Cancel
                              </button>
                            </div>
                          )}
                          {decision?.kind === 'confirmed' && (
                            <div style={{
                              display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap',
                            }}>
                              <div style={{
                                fontSize: 11.5, fontWeight: 600,
                                color: 'var(--color-success, #166534)',
                                display: 'inline-flex', alignItems: 'center', gap: 5,
                              }}>
                                <Check size={12} strokeWidth={3} />
                                Linked to {decision.targetName}
                              </div>
                              <button
                                onClick={() => setPickerOpenFor(r.posItemId)}
                                style={{
                                  fontSize: 11, fontWeight: 600,
                                  color: 'var(--color-text-muted)',
                                  background: 'transparent', border: 'none',
                                  padding: 0, cursor: 'pointer',
                                  textDecoration: 'underline',
                                  fontFamily: 'var(--font-primary)',
                                }}
                              >
                                Change
                              </button>
                            </div>
                          )}
                          {decision?.kind === 'skipped' && (
                            <div style={{
                              display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap',
                            }}>
                              <div style={{
                                fontSize: 11.5, color: 'var(--color-text-muted)',
                              }}>
                                Left unmatched — finish on the matching page.
                              </div>
                              <button
                                onClick={() => setUncertainDecisions((prev) => {
                                  const next = new Map(prev);
                                  next.delete(r.posItemId);
                                  return next;
                                })}
                                style={{
                                  fontSize: 11, fontWeight: 600,
                                  color: 'var(--color-text-muted)',
                                  background: 'transparent', border: 'none',
                                  padding: 0, cursor: 'pointer',
                                  textDecoration: 'underline',
                                  fontFamily: 'var(--font-primary)',
                                }}
                              >
                                Undo
                              </button>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{
          padding: '12px 16px',
          borderTop: '1px solid var(--color-border-subtle)',
          background: '#FBFAF8',
          display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'flex-end',
        }}>
          {phase === 'idle' && (
            <>
              <button onClick={onClose} style={ghostBtnStyle}>Cancel</button>
              <button onClick={start} style={primaryBtnStyle}>
                <RefreshCw size={13} />
                Run sync & match
              </button>
            </>
          )}
          {phase === 'running' && (
            <span style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>
              Don't close this — it'll finish in a moment.
            </span>
          )}
          {phase === 'done' && (
            <button onClick={onClose} style={primaryBtnStyle}>Done</button>
          )}
        </div>
      </div>
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>,
    document.body,
  );
}

function SummaryStat({ label, value, accent }: { label: string; value: number; accent: string }) {
  return (
    <div style={{
      padding: '10px 12px', borderRadius: 10,
      background: '#fff', border: '1px solid var(--color-border-subtle)',
    }}>
      <div style={{
        fontSize: 10.5, fontWeight: 700, letterSpacing: '0.06em',
        textTransform: 'uppercase', color: 'var(--color-text-muted)',
      }}>
        {label}
      </div>
      <div style={{ fontSize: 22, fontWeight: 700, color: accent, lineHeight: 1.1, marginTop: 4 }}>
        {value}
      </div>
    </div>
  );
}

function TypeTag({ type }: { type: MatchTargetType }) {
  const label = type === 'master-product' ? 'Master' : type === 'product' ? 'Product' : 'Recipe';
  return (
    <span style={{
      fontSize: 9.5, fontWeight: 700, letterSpacing: '0.04em',
      textTransform: 'uppercase', color: 'var(--color-text-muted)',
      padding: '1px 5px', borderRadius: 100,
      border: '1px solid var(--color-border-subtle)',
      whiteSpace: 'nowrap',
    }}>
      {label}
    </span>
  );
}

const primaryBtnStyle: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: 6,
  padding: '8px 14px', borderRadius: 8,
  border: 'none', background: 'var(--color-accent-active)',
  color: '#fff', fontSize: 12.5, fontWeight: 600,
  fontFamily: 'var(--font-primary)', cursor: 'pointer',
};

const ghostBtnStyle: React.CSSProperties = {
  padding: '8px 14px', borderRadius: 8,
  border: '1px solid var(--color-border-subtle)',
  background: '#fff',
  color: 'var(--color-text-secondary)', fontSize: 12.5, fontWeight: 600,
  fontFamily: 'var(--font-primary)', cursor: 'pointer',
};

const confirmBtnStyle: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: 5,
  padding: '6px 10px', borderRadius: 7,
  border: 'none', background: 'var(--color-accent-active)',
  color: '#fff', fontSize: 11.5, fontWeight: 600,
  fontFamily: 'var(--font-primary)', cursor: 'pointer',
};

const skipBtnStyle: React.CSSProperties = {
  padding: '6px 10px', borderRadius: 7,
  border: '1px solid var(--color-border-subtle)',
  background: '#fff',
  color: 'var(--color-text-secondary)', fontSize: 11.5, fontWeight: 600,
  fontFamily: 'var(--font-primary)', cursor: 'pointer',
};

const pickDifferentBtnStyle: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: 5,
  padding: '6px 10px', borderRadius: 7,
  border: '1px solid var(--color-border-subtle)',
  background: '#fff',
  color: 'var(--color-text-primary)', fontSize: 11.5, fontWeight: 600,
  fontFamily: 'var(--font-primary)', cursor: 'pointer',
};
