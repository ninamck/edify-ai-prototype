'use client';

/**
 * SyncMatchModal — stand-in for the background agent that will eventually
 * keep POS items in sync and auto-match them to recipes / products / master
 * products. Until that ships, the "Sync & match" button opens this sheet
 * and the run starts immediately (no idle confirm step):
 *
 *   1) "Pulls" fresh POS items (simulated for the prototype).
 *   2) Runs a name-similarity pass against the recipe library, product
 *      catalog, and master products.
 *   3) Proposes every match with a confidence tier — nothing is linked
 *      until the operator confirms. Confident rows can be bulk-linked
 *      from the card footer; Not-sure rows are decided one by one.
 *
 * Renders as a right-hand workspace sheet, visually identical to the
 * command centre: cream canvas, Workspace header strip, and the whole
 * flow inside a CardShell work card (pending → confirmed lifecycle,
 * footer pills, receipt at the end). Rows use the same match-triage
 * anatomy as the chat card: entity-type chips, confidence pills, and an
 * inline change-target dropdown with a "None of these — browse the full
 * list" escape hatch. Any row can also carry site exceptions ("at Soho
 * this button uses X instead").
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle, Check, CheckCircle2, ChevronDown, Loader2, MapPin, Search, X } from 'lucide-react';
import { useRecipes } from '@/components/Recipe/recipeStore';
import { useProducts, useMasterProducts } from '@/components/Suppliers/store';
import { ALL_SITES } from '@/components/Suppliers/fixtures';
import { FITZROY_POS_INTAKE } from '@/components/Recipe/intakeFixtures';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import CardShell from '@/components/Feed/commands/cards/CardShell';
import EdifyMark from '@/components/EdifyMark/EdifyMark';
import { setMatchTarget, clearMatchTarget, useMatchOverrides, type MatchTargetType } from './overrideStore';
import { TypeChip, PosKindChip, type EntityType, type PosKind } from './TypeChip';

const MOBILE_BREAKPOINT = '(max-width: 640px)';

type Stage = {
  id: string;
  label: string;
  /** ms to spend in the "running" state before completing. */
  durationMs: number;
};

const STAGES: Stage[] = [
  { id: 'connect',  label: 'Connecting to Square POS',                       durationMs: 700 },
  { id: 'pull',     label: 'Pulling menu items and sales',                   durationMs: 900 },
  { id: 'scan',     label: 'Checking your recipes and products for matches', durationMs: 1100 },
  { id: 'propose',  label: 'Lining up suggestions',                          durationMs: 600 },
];

type Phase = 'idle' | 'running' | 'done';

type Candidate = { type: MatchTargetType; id: string; name: string };

type SiteException = { site: string; target: Candidate };

type MatchResult = {
  posItemId: string;
  posItemName: string;
  /** What kind of POS button this is — menu item or modifier. */
  posKind: PosKind;
  type: MatchTargetType;
  targetId: string;
  targetName: string;
  confidence: 'high' | 'uncertain';
  /** Why we flagged this as uncertain — shown to the operator. */
  reason?: string;
};

const TYPE_LABEL: Record<MatchTargetType, EntityType> = {
  'recipe': 'Recipe',
  'product': 'Product',
  'master-product': 'Master product',
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
  /** Synthetic POS items (e.g. modifiers, which the intake fixture doesn't
   *  carry) provide their own name instead of a fixture lookup. */
  posItemName?: string;
  posKind?: PosKind;
}> = [
  {
    posItemId: 'mi-almond-croissant',
    preferredTargetName: 'Croissant',
    reason: '"Almond" might be an add-on to the base croissant, or its own recipe. Worth a look.',
  },
  {
    posItemId: 'mi-babyccino',
    preferredTargetName: 'Cappuccino',
    reason: 'Kids drink: could be a scaled-down cappuccino or its own recipe. Worth a look.',
  },
  {
    posItemId: 'mod-add-oat-milk',
    posItemName: 'Add Oat Milk',
    posKind: 'Modifier',
    preferredTargetName: 'Oat Milk 1L',
    reason: 'This could take stock straight from the Oat Milk 1L product, or you may want a poured-measure sub-recipe.',
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
  // Per-row decision. Nothing is applied to the override store until a
  // row is confirmed (individually or via the bulk footer button). A
  // `confirmed` decision carries the *actual* target the user landed on,
  // which may differ from the AI's suggestion when they picked another.
  const [decisions, setDecisions] = useState<
    Map<string, { kind: 'confirmed'; targetName: string } | { kind: 'skipped' }>
  >(new Map());
  /** Per-row target correction picked from the dropdown. */
  const [chosen, setChosen] = useState<Record<string, Candidate>>({});
  /** Row whose change-target list is expanded inline. */
  const [dropdownFor, setDropdownFor] = useState<string | null>(null);
  /** Row currently in "browse the full list" mode (subset of dropdownFor). */
  const [browseFor, setBrowseFor] = useState<string | null>(null);
  const [browseQuery, setBrowseQuery] = useState('');
  /** Site exceptions per row — "at this site, use a different target". */
  const [siteExceptions, setSiteExceptions] = useState<Record<string, SiteException[]>>({});
  /** Row with the site-exception editor open, and its in-progress state. */
  const [excFor, setExcFor] = useState<string | null>(null);
  const [excSite, setExcSite] = useState<string | null>(null);
  const [excSiteOpen, setExcSiteOpen] = useState(false);
  const [excPickerOpen, setExcPickerOpen] = useState(false);
  const [excBrowsing, setExcBrowsing] = useState(false);
  const [excQuery, setExcQuery] = useState('');
  const [showAllConfident, setShowAllConfident] = useState(false);

  const closeDropdown = () => {
    setDropdownFor(null);
    setBrowseFor(null);
    setBrowseQuery('');
  };

  const closeExceptionEditor = () => {
    setExcFor(null);
    setExcSite(null);
    setExcSiteOpen(false);
    setExcPickerOpen(false);
    setExcBrowsing(false);
    setExcQuery('');
  };

  // No idle step: opening the sheet *is* the run. The button on the page
  // already says what will happen; asking again would just be friction.
  const startedRef = useRef(false);
  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Compute candidates lazily so we have the freshest data when the run starts.
  const candidates = useMemo<Candidate[]>(() => {
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
      let best: { c: Candidate; s: number } | null = null;
      for (const c of candidates) {
        const s = score(pos.name, c.name);
        if (!best || s > best.s) best = { c, s };
      }
      if (!best || best.s < 0.8) continue;
      out.push({
        posItemId: pos.id,
        posItemName: pos.name,
        posKind: 'Menu item',
        type: best.c.type,
        targetId: best.c.id,
        targetName: best.c.name,
        confidence: 'high',
      });
    }

    for (const inj of UNCERTAIN_INJECTIONS) {
      // Synthetic entries (modifiers) carry their own name; the rest are
      // looked up in the intake fixture.
      const posItemName = inj.posItemName
        ?? FITZROY_POS_INTAKE.menuItems.find((m) => m.id === inj.posItemId)?.name;
      if (!posItemName) continue;
      if (alreadyMatchedPosIds.has(inj.posItemId)) continue;
      const target = candidates.find((c) => c.name === inj.preferredTargetName);
      if (!target) continue;
      const replacement: MatchResult = {
        posItemId: inj.posItemId,
        posItemName,
        posKind: inj.posKind ?? 'Menu item',
        type: target.type,
        targetId: target.id,
        targetName: target.name,
        confidence: 'uncertain',
        reason: inj.reason,
      };
      const existingIdx = out.findIndex((r) => r.posItemId === inj.posItemId);
      if (existingIdx >= 0) out[existingIdx] = replacement;
      else out.push(replacement);
    }
    return out;
  }

  // Drive the stage animation when running. No auto-apply at the end —
  // every match is a proposal until the operator confirms it.
  useEffect(() => {
    if (phase !== 'running') return;
    if (stageIdx >= STAGES.length) {
      setPhase('done');
      return;
    }
    const stage = STAGES[stageIdx];
    const t = window.setTimeout(() => setStageIdx((i) => i + 1), stage.durationMs);
    return () => window.clearTimeout(t);
  }, [phase, stageIdx]);

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
    setDecisions(new Map());
    setChosen({});
    setSiteExceptions({});
    setShowAllConfident(false);
    closeDropdown();
    closeExceptionEditor();
    setPhase('running');
  }

  /** The row's target with any dropdown correction folded in. */
  function resolvedTarget(r: MatchResult): Candidate {
    return chosen[r.posItemId] ?? { type: r.type, id: r.targetId, name: r.targetName };
  }

  function confirmRow(r: MatchResult): void {
    const target = resolvedTarget(r);
    setMatchTarget(r.posItemId, { type: target.type, id: target.id });
    setDecisions((prev) => {
      const next = new Map(prev);
      next.set(r.posItemId, { kind: 'confirmed', targetName: target.name });
      return next;
    });
    closeDropdown();
    if (excFor === r.posItemId) closeExceptionEditor();
  }

  function skipRow(posItemId: string): void {
    setDecisions((prev) => {
      const next = new Map(prev);
      next.set(posItemId, { kind: 'skipped' });
      return next;
    });
    closeDropdown();
    if (excFor === posItemId) closeExceptionEditor();
  }

  /** Undo a decision. A confirmed row also gets its override cleared so
   *  the button really is unlinked again, not just visually pending. */
  function undoDecision(posItemId: string): void {
    setDecisions((prev) => {
      const wasConfirmed = prev.get(posItemId)?.kind === 'confirmed';
      if (wasConfirmed) clearMatchTarget(posItemId);
      const next = new Map(prev);
      next.delete(posItemId);
      return next;
    });
  }

  /** Bulk-link every pending confident row (with dropdown corrections
   *  folded in). Not-sure rows are never included — rule #5. */
  function linkAllConfident(): void {
    setDecisions((prev) => {
      const next = new Map(prev);
      for (const r of results) {
        if (r.confidence !== 'high') continue;
        if (next.has(r.posItemId)) continue;
        const target = resolvedTarget(r);
        setMatchTarget(r.posItemId, { type: target.type, id: target.id });
        next.set(r.posItemId, { kind: 'confirmed', targetName: target.name });
      }
      return next;
    });
    closeDropdown();
    closeExceptionEditor();
  }

  function addSiteException(rowId: string, site: string, target: Candidate): void {
    const nextList = [...(siteExceptions[rowId] ?? []).filter((e) => e.site !== site), { site, target }];
    setSiteExceptions((prev) => ({ ...prev, [rowId]: nextList }));
    // Keep the panel open so another site can be added straight away;
    // pre-fill the dropdown with the next site that has no override.
    const used = new Set(nextList.map((e) => e.site));
    setExcSite(ALL_SITES.find((s) => !used.has(s)) ?? null);
    setExcSiteOpen(false);
    setExcPickerOpen(false);
    setExcBrowsing(false);
    setExcQuery('');
  }

  function removeSiteException(rowId: string, site: string): void {
    setSiteExceptions((prev) => ({
      ...prev,
      [rowId]: (prev[rowId] ?? []).filter((e) => e.site !== site),
    }));
  }

  /** Runner-up candidates for the change-target dropdown. */
  function alternativesFor(r: MatchResult): Candidate[] {
    return candidates
      .filter((c) => c.id !== r.targetId)
      .map((c) => ({ c, s: score(r.posItemName, c.name) }))
      .sort((a, b) => b.s - a.s)
      .slice(0, 3)
      .map(({ c }) => c);
  }

  const highConfidence = results.filter((r) => r.confidence === 'high');
  const uncertain = results.filter((r) => r.confidence === 'uncertain');
  const pendingAll = results.filter((r) => !decisions.has(r.posItemId));
  const confidentPending = highConfidence.filter((r) => !decisions.has(r.posItemId));
  const linkedCount = [...decisions.values()].filter((d) => d.kind === 'confirmed').length;
  const skippedCount = [...decisions.values()].filter((d) => d.kind === 'skipped').length;
  const totalExceptions = Object.values(siteExceptions).reduce((n, list) => n + list.length, 0);
  const allDecided = phase === 'done' && pendingAll.length === 0;

  const query = browseQuery.trim().toLowerCase();
  const browseResults = (query
    ? candidates.filter((c) => c.name.toLowerCase().includes(query))
    : candidates
  ).slice(0, 30);

  const excQ = excQuery.trim().toLowerCase();
  const excResults = (excQ
    ? candidates.filter((c) => c.name.toLowerCase().includes(excQ))
    : candidates
  ).slice(0, 30);

  /** One row of the proposal list — identical anatomy for confident and
   *  Not-sure rows, only the pill and reason line differ. */
  function renderRow(r: MatchResult, i: number) {
    const decision = decisions.get(r.posItemId);
    const target = resolvedTarget(r);
    const dropdownOpen = dropdownFor === r.posItemId;
    const browsing = browseFor === r.posItemId;
    const excOpen = excFor === r.posItemId;
    const exceptions = siteExceptions[r.posItemId] ?? [];
    const rowCandidates: Candidate[] = [
      { type: r.type, id: r.targetId, name: r.targetName },
      ...alternativesFor(r),
    ];
    const usedSites = new Set(exceptions.map((e) => e.site));
    return (
      <div key={r.posItemId} style={{
        display: 'flex', flexDirection: 'column', gap: 8,
        padding: '10px 12px',
        borderTop: i === 0 ? 'none' : '1px solid var(--color-border-subtle)',
        fontSize: 12.5,
        background: decision?.kind === 'skipped' ? '#FBFAF8' : '#fff',
      }}>
        {/* One readable line: POS name · confidence · target field · actions.
            Mirrors the product's item-matching row. */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
          <span style={{
            flex: '1 1 30%', minWidth: 0,
            color: 'var(--color-text-primary)', fontWeight: 600,
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            {r.posItemName}
          </span>
          <PosKindChip kind={r.posKind} />
          {r.confidence === 'high' ? <HighPill /> : <NotSurePill />}
          {decision ? (
            <span style={{
              flex: '1 1 40%', minWidth: 0,
              display: 'inline-flex', alignItems: 'center', gap: 6,
              padding: '3px 8px', borderRadius: 8,
              border: '1px solid var(--color-border-subtle)',
              background: decision.kind === 'skipped' ? 'transparent' : '#F4FBF6',
            }}>
              {decision.kind === 'confirmed' && (
                <CheckCircle2 size={12} strokeWidth={2.2} color="var(--color-success, #166534)" style={{ flexShrink: 0 }} />
              )}
              <span style={{
                flex: 1, minWidth: 0,
                fontWeight: 600, color: 'var(--color-text-primary)',
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                textDecoration: decision.kind === 'skipped' ? 'line-through' : 'none',
              }}>
                {target.name}
              </span>
              <TypeChip type={TYPE_LABEL[target.type]} />
            </span>
          ) : (
            <span style={{ flex: '1 1 40%', minWidth: 0, display: 'inline-flex' }}>
              <TargetTrigger
                target={target}
                open={dropdownOpen}
                onToggle={() => (dropdownOpen ? closeDropdown() : setDropdownFor(r.posItemId))}
              />
            </span>
          )}
          {decision && (
            <button
              type="button"
              onClick={() => {
                undoDecision(r.posItemId);
                if (decision.kind === 'confirmed') setDropdownFor(r.posItemId);
              }}
              style={{
                flexShrink: 0, padding: 0,
                background: 'transparent', border: 'none',
                fontSize: 11, fontWeight: 600,
                color: 'var(--color-text-muted)',
                textDecoration: 'underline', cursor: 'pointer',
                fontFamily: 'var(--font-primary)',
              }}
            >
              {decision.kind === 'confirmed' ? 'Change' : 'Undo'}
            </button>
          )}
        </div>

        {/* Actions on their own row so the match line stays readable. */}
        {!decision && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={() => confirmRow(r)}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 4,
                padding: '4px 12px', borderRadius: 999,
                border: 'none',
                background: 'var(--color-accent-active)', color: '#fff',
                fontSize: 11, fontWeight: 700,
                fontFamily: 'var(--font-primary)', cursor: 'pointer',
              }}
            >
              <Check size={10} strokeWidth={2.6} />
              Link
            </button>
            <button
              type="button"
              onClick={() => skipRow(r.posItemId)}
              style={{
                padding: '4px 12px', borderRadius: 999,
                border: '1px solid var(--color-border-subtle)',
                background: '#fff', color: 'var(--color-text-secondary)',
                fontSize: 11, fontWeight: 600,
                fontFamily: 'var(--font-primary)', cursor: 'pointer',
              }}
            >
              Skip
            </button>
            <button
              type="button"
              onClick={() => {
                if (excOpen) { closeExceptionEditor(); return; }
                setExcFor(r.posItemId);
                // Pre-select the first site without an exception yet,
                // same as the product's panel opening pre-filled.
                setExcSite(ALL_SITES.find((s) => !usedSites.has(s)) ?? null);
                setExcSiteOpen(false);
                setExcPickerOpen(false);
                setExcBrowsing(false);
                setExcQuery('');
              }}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 4,
                padding: '4px 12px', borderRadius: 999,
                border: '1px solid var(--color-border-subtle)',
                background: excOpen ? 'rgba(0,28,53,0.06)' : '#fff',
                color: 'var(--color-text-secondary)',
                fontSize: 11, fontWeight: 600,
                fontFamily: 'var(--font-primary)', cursor: 'pointer',
              }}
            >
              <MapPin size={11} strokeWidth={2.2} />
              Site exception
            </button>
          </div>
        )}


        {r.reason && !decision && (
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6, fontSize: 11.5, color: 'var(--color-text-muted)', lineHeight: 1.5 }}>
            <AlertTriangle size={12} strokeWidth={2.2} color="#B45309" style={{ flexShrink: 0, marginTop: 2 }} />
            {r.reason}
          </div>
        )}

        {/* Inline candidate list / full-catalogue browse. */}
        {!decision && dropdownOpen && (
          <CandidatePanel
            shortlist={rowCandidates}
            currentId={target.id}
            browsing={browsing}
            browseQuery={browseQuery}
            browseResults={browseResults}
            onPick={(c) => {
              setChosen((prev) => ({ ...prev, [r.posItemId]: c }));
              closeDropdown();
            }}
            onStartBrowse={() => setBrowseFor(r.posItemId)}
            onBackFromBrowse={() => { setBrowseFor(null); setBrowseQuery(''); }}
            onQueryChange={setBrowseQuery}
          />
        )}

        {/* Site exceptions already added to this row (shown inside the
            editor panel instead while it's open). */}
        {exceptions.length > 0 && !excOpen && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {exceptions.map((e) => (
              <div key={e.site} style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '4px 8px', borderRadius: 8,
                background: 'rgba(0,28,53,0.03)',
                fontSize: 11.5,
              }}>
                <MapPin size={11} strokeWidth={2.2} color="var(--color-text-muted)" style={{ flexShrink: 0 }} />
                <span style={{ fontWeight: 600, color: 'var(--color-text-primary)', flexShrink: 0 }}>{e.site}</span>
                <span style={{ color: 'var(--color-text-muted)' }}>→</span>
                <span style={{ flex: 1, minWidth: 0, fontWeight: 600, color: 'var(--color-text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {e.target.name}
                </span>
                <TypeChip type={TYPE_LABEL[e.target.type]} />
                {!decision && (
                  <button
                    type="button"
                    onClick={() => removeSiteException(r.posItemId, e.site)}
                    style={{
                      padding: 0, background: 'transparent', border: 'none',
                      fontSize: 11, fontWeight: 600,
                      color: 'var(--color-text-muted)',
                      textDecoration: 'underline', cursor: 'pointer',
                      fontFamily: 'var(--font-primary)', flexShrink: 0,
                    }}
                  >
                    Remove
                  </button>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Site-exception editor — mirrors the product's "Site-specific
            matches" panel: title + default-state line, a site dropdown
            field, a "Choose a match…" field, Cancel bottom-right. */}
        {!decision && excOpen && (
          <div style={{
            border: '1px solid var(--color-border-subtle)',
            borderRadius: 12,
            padding: '12px 14px',
            background: '#FBFAF8',
            display: 'flex', flexDirection: 'column', gap: 10,
          }}>
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--color-text-primary)' }}>
                Site-specific matches
              </div>
              <div style={{ fontSize: 11.5, color: 'var(--color-text-muted)', marginTop: 2 }}>
                {exceptions.length === 0
                  ? 'No site-specific matches. Every site uses the company default.'
                  : `${exceptions.length} site${exceptions.length === 1 ? '' : 's'} override${exceptions.length === 1 ? 's' : ''} the company default.`}
              </div>
            </div>

            {/* Existing site-specific matches, listed inside the panel. */}
            {exceptions.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {exceptions.map((e) => (
                  <div key={e.site} style={{
                    display: 'flex', alignItems: 'center', gap: 6,
                    padding: '6px 10px', borderRadius: 10,
                    background: '#fff',
                    border: '1px solid var(--color-border-subtle)',
                    fontSize: 11.5,
                  }}>
                    <MapPin size={11} strokeWidth={2.2} color="var(--color-text-muted)" style={{ flexShrink: 0 }} />
                    <span style={{ fontWeight: 600, color: 'var(--color-text-primary)', flexShrink: 0 }}>{e.site}</span>
                    <span style={{ color: 'var(--color-text-muted)' }}>→</span>
                    <span style={{ flex: 1, minWidth: 0, fontWeight: 600, color: 'var(--color-text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {e.target.name}
                    </span>
                    <TypeChip type={TYPE_LABEL[e.target.type]} />
                    <button
                      type="button"
                      onClick={() => removeSiteException(r.posItemId, e.site)}
                      style={{
                        padding: 0, background: 'transparent', border: 'none',
                        fontSize: 11, fontWeight: 600,
                        color: 'var(--color-text-muted)',
                        textDecoration: 'underline', cursor: 'pointer',
                        fontFamily: 'var(--font-primary)', flexShrink: 0,
                      }}
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Site dropdown field. */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, alignSelf: 'flex-start', minWidth: 220 }}>
              <button
                type="button"
                onClick={() => setExcSiteOpen((v) => !v)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '9px 14px', borderRadius: 12,
                  border: '1px solid var(--color-border-subtle)',
                  background: '#fff', cursor: 'pointer', textAlign: 'left',
                  fontFamily: 'var(--font-primary)', fontSize: 12.5, fontWeight: 600,
                  color: excSite ? 'var(--color-text-primary)' : 'var(--color-text-muted)',
                }}
              >
                <span style={{ flex: 1, minWidth: 0 }}>{excSite ?? 'Choose a site…'}</span>
                <ChevronDown
                  size={13}
                  strokeWidth={2.2}
                  color="var(--color-text-muted)"
                  style={{ flexShrink: 0, transform: excSiteOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s ease' }}
                />
              </button>
              {excSiteOpen && (
                <div style={{
                  background: '#fff', borderRadius: 12,
                  border: '1px solid var(--color-border-subtle)',
                  overflow: 'hidden',
                }}>
                  {ALL_SITES.filter((s) => !usedSites.has(s)).map((site, si, arr) => (
                    <button
                      key={site}
                      type="button"
                      onClick={() => { setExcSite(site); setExcSiteOpen(false); }}
                      style={{
                        display: 'block', width: '100%', padding: '8px 14px',
                        border: 'none',
                        borderBottom: si === arr.length - 1 ? 'none' : '1px solid var(--color-border-subtle)',
                        background: site === excSite ? 'rgba(0,28,53,0.04)' : '#fff',
                        cursor: 'pointer', textAlign: 'left',
                        fontFamily: 'var(--font-primary)', fontSize: 12.5, fontWeight: 600,
                        color: 'var(--color-text-primary)',
                      }}
                    >
                      {site}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* "Choose a match…" field — expands into the candidate list. */}
            {!excPickerOpen ? (
              <button
                type="button"
                disabled={!excSite}
                onClick={() => setExcPickerOpen(true)}
                style={{
                  display: 'flex', alignItems: 'center',
                  width: '100%', padding: '9px 14px', borderRadius: 12,
                  border: '1px solid var(--color-border-subtle)',
                  background: '#fff',
                  cursor: excSite ? 'pointer' : 'not-allowed',
                  opacity: excSite ? 1 : 0.55,
                  textAlign: 'left',
                  fontFamily: 'var(--font-primary)', fontSize: 12.5, fontWeight: 500,
                  color: 'var(--color-text-muted)',
                }}
              >
                Choose a match…
              </button>
            ) : (
              <CandidatePanel
                shortlist={rowCandidates}
                currentId={siteExceptions[r.posItemId]?.find((e) => e.site === excSite)?.target.id ?? ''}
                browsing={excBrowsing}
                browseQuery={excQuery}
                browseResults={excResults}
                onPick={(c) => { if (excSite) addSiteException(r.posItemId, excSite, c); }}
                onStartBrowse={() => setExcBrowsing(true)}
                onBackFromBrowse={() => { setExcBrowsing(false); setExcQuery(''); }}
                onQueryChange={setExcQuery}
              />
            )}
            <button
              type="button"
              onClick={closeExceptionEditor}
              style={{
                alignSelf: 'flex-end',
                padding: 0, background: 'transparent', border: 'none',
                fontSize: 12, fontWeight: 600,
                color: 'var(--color-text-primary)',
                cursor: 'pointer',
                fontFamily: 'var(--font-primary)',
              }}
            >
              Cancel
            </button>
          </div>
        )}

      </div>
    );
  }

  if (!portalReady) return null;

  return createPortal(
    <div
      onClick={(e) => { if (e.target === e.currentTarget && phase !== 'running') onClose(); }}
      style={{
        position: 'fixed', inset: 0,
        background: 'rgba(0, 28, 53, 0.22)',
        zIndex: 1100,
        fontFamily: 'var(--font-primary)',
      }}
    >
      {/* Right-hand sheet — same surface the command-centre workspace uses. */}
      <div
        style={{
          position: 'absolute', top: 0, right: 0, bottom: 0,
          // Two-thirds of the screen — this is a work surface, not a dialog.
          width: isMobile ? '100vw' : 'max(66vw, 560px)',
          // Warm cream — the same workspace canvas the command centre uses.
          background: '#FEFBEE',
          borderLeft: '1px solid var(--color-border-subtle)',
          boxShadow: '-24px 0 48px -16px rgba(0, 28, 53, 0.35)',
          display: 'flex', flexDirection: 'column',
          animation: 'syncSheetIn 0.22s ease',
        }}
      >
        {/* Header — identical strip to the command-centre Workspace panel. */}
        <div style={{
          flexShrink: 0,
          display: 'flex', alignItems: 'center', gap: 8,
          padding: '13px 24px',
          borderBottom: '1px solid var(--color-border-subtle)',
          background: '#fff',
        }}>
          <EdifyMark size={16} color="var(--color-accent-quinn)" strokeWidth={2} />
          <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--color-text-primary)' }}>
            Workspace
          </span>
          <span style={{
            flex: 1, minWidth: 0,
            fontSize: 12, fontWeight: 500, color: 'var(--color-text-muted)',
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            · POS matching
          </span>
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

        {/* Canvas — the flow lives inside a Work Card, exactly like a
            command-centre module. Content width matches the workspace. */}
        <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '16px 24px 32px' }}>
          <div style={{ maxWidth: 640, margin: '0 auto' }}>
            <CardShell
              icon={EdifyMark}
              title="Match your POS buttons"
              subtitle={
                phase !== 'done'
                  ? 'Pulling fresh POS data. Nothing links until you confirm.'
                  : pendingAll.length > 0
                    ? `${pendingAll.length} to review. Link one by one, or all the confident ones at once.`
                    : `${linkedCount} linked · ${skippedCount} skipped${totalExceptions > 0 ? ` · ${totalExceptions} site exception${totalExceptions === 1 ? '' : 's'}` : ''}`
              }
              state={allDecided ? 'confirmed' : 'pending'}
              confirmLabel={
                confidentPending.length === 1
                  ? 'Link 1 confident match'
                  : `Link ${confidentPending.length} confident matches`
              }
              confirmDisabled={confidentPending.length === 0}
              onConfirm={phase === 'done' ? linkAllConfident : undefined}
              cancelLabel="Finish later"
              onCancel={phase === 'done' ? onClose : undefined}
            >
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
                  label="Ready to link"
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

              {uncertain.length > 0 && (
                <div>
                  <div style={{
                    fontSize: 11, fontWeight: 700, letterSpacing: '0.06em',
                    textTransform: 'uppercase', color: 'var(--color-text-muted)',
                    margin: '8px 0 6px',
                  }}>
                    Needs your call
                  </div>
                  <div style={{
                    border: '1px solid var(--color-border-subtle)',
                    borderRadius: 10, overflow: 'hidden',
                  }}>
                    {uncertain.map((r, i) => renderRow(r, i))}
                  </div>
                </div>
              )}

              {highConfidence.length > 0 && (
                <div>
                  <div style={{
                    display: 'flex', alignItems: 'baseline', gap: 8,
                    margin: '8px 0 6px',
                  }}>
                    <span style={{
                      fontSize: 11, fontWeight: 700, letterSpacing: '0.06em',
                      textTransform: 'uppercase', color: 'var(--color-text-muted)',
                    }}>
                      Confident matches
                    </span>
                    <span style={{ fontSize: 11.5, color: 'var(--color-text-muted)' }}>
                      Check them, then link one by one or all at once below.
                    </span>
                  </div>
                  <div style={{
                    border: '1px solid var(--color-border-subtle)',
                    borderRadius: 10, overflow: 'hidden',
                  }}>
                    {(showAllConfident ? highConfidence : highConfidence.slice(0, 6)).map((r, i) => renderRow(r, i))}
                    {highConfidence.length > 6 && (
                      <button
                        type="button"
                        onClick={() => setShowAllConfident((v) => !v)}
                        style={{
                          width: '100%', padding: '8px 12px',
                          borderTop: '1px solid var(--color-border-subtle)',
                          border: 'none', background: 'rgba(0,28,53,0.02)',
                          fontSize: 12, fontWeight: 600, color: 'var(--color-accent-active, #001C35)',
                          cursor: 'pointer', textAlign: 'left',
                          fontFamily: 'var(--font-primary)',
                        }}
                      >
                        {showAllConfident ? 'Show fewer' : `Show all ${highConfidence.length}`}
                      </button>
                    )}
                  </div>
                </div>
              )}

              {results.length === 0 && (
                <div style={{
                  padding: '14px 16px', borderRadius: 10,
                  background: '#FBFAF8',
                  border: '1px solid var(--color-border-subtle)',
                  fontSize: 12.5, color: 'var(--color-text-secondary)',
                }}>
                  Nothing new to suggest, just letting you know. The buttons still unmatched need a human eye; pick targets for them in the list behind this panel.
                </div>
              )}
            </div>
          )}
            </CardShell>

            {/* Receipt — every flow ends with one (rule #2). Appears once
                every proposed row has a decision, mirroring the chat. */}
            {allDecided && results.length > 0 && (
              <div style={{
                marginTop: 12,
                borderRadius: 12,
                background: '#fff',
                border: '1px solid var(--color-border-subtle)',
                padding: '10px 14px',
                display: 'flex', alignItems: 'center', gap: 10,
              }}>
                <CheckCircle2 size={16} color="#2D6A4F" style={{ flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0, fontSize: 12.5 }}>
                  <div style={{ fontWeight: 700, color: 'var(--color-text-primary)' }}>
                    Done: {linkedCount} linked · {skippedCount} skipped
                    {totalExceptions > 0 ? ` · ${totalExceptions} site exception${totalExceptions === 1 ? '' : 's'}` : ''}
                  </div>
                  <div style={{ color: 'var(--color-text-muted)', marginTop: 1 }}>
                    Sales on the linked buttons now come out of the right stock.
                    {skippedCount > 0 ? ' Skipped buttons stay in Unmatched.' : ''}
                  </div>
                </div>
                <button
                  onClick={onClose}
                  style={{
                    padding: '7px 16px', borderRadius: 100,
                    border: 'none', background: 'var(--color-accent-active, #001C35)',
                    color: '#fff', fontSize: 12, fontWeight: 600,
                    fontFamily: 'var(--font-primary)', cursor: 'pointer',
                    boxShadow: '0 2px 8px rgba(0,28,53,0.22)',
                    flexShrink: 0,
                  }}
                >
                  Done
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes syncSheetIn {
          from { transform: translateX(32px); opacity: 0; }
          to { transform: none; opacity: 1; }
        }
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

/** Amber "Not sure" pill — same tier styling as the chat triage card. */
function NotSurePill() {
  return (
    <span style={{
      fontSize: 9.5, fontWeight: 700, letterSpacing: '0.04em',
      textTransform: 'uppercase', color: '#B45309',
      padding: '1px 6px', borderRadius: 100,
      border: '1px solid #E8A03D', background: '#FFF9F0',
      whiteSpace: 'nowrap', flexShrink: 0,
    }}>
      Not sure
    </span>
  );
}

function HighPill() {
  return (
    <span style={{
      fontSize: 9.5, fontWeight: 700, letterSpacing: '0.04em',
      textTransform: 'uppercase', color: 'var(--color-accent-active)',
      padding: '1px 6px', borderRadius: 100,
      border: '1px solid var(--color-accent-active)', background: '#fff',
      whiteSpace: 'nowrap', flexShrink: 0,
    }}>
      High
    </span>
  );
}

/** The change-target pill trigger — shared by every proposal row so all
 *  rows read identically to the chat triage card. */
function TargetTrigger({
  target,
  open,
  onToggle,
}: {
  target: Candidate;
  open: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 6,
        width: '100%', minWidth: 0,
        padding: '3px 8px', borderRadius: 8,
        border: '1px solid var(--color-border-subtle)',
        background: open ? 'rgba(0,28,53,0.04)' : '#fff',
        cursor: 'pointer', fontFamily: 'var(--font-primary)',
      }}
    >
      <span style={{ flex: 1, minWidth: 0, textAlign: 'left', fontSize: 12.5, fontWeight: 600, color: 'var(--color-text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {target.name}
      </span>
      <TypeChip type={TYPE_LABEL[target.type]} />
      <ChevronDown
        size={12}
        strokeWidth={2.2}
        color="var(--color-text-muted)"
        style={{ flexShrink: 0, transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s ease' }}
      />
    </button>
  );
}

/** Inline candidate list with the "browse the full list" escape hatch —
 *  expands within the row (never floats), same as the chat card. */
function CandidatePanel({
  shortlist,
  currentId,
  browsing,
  browseQuery,
  browseResults,
  onPick,
  onStartBrowse,
  onBackFromBrowse,
  onQueryChange,
}: {
  shortlist: Candidate[];
  currentId: string;
  browsing: boolean;
  browseQuery: string;
  browseResults: Candidate[];
  onPick: (c: Candidate) => void;
  onStartBrowse: () => void;
  onBackFromBrowse: () => void;
  onQueryChange: (q: string) => void;
}) {
  const inBrowse = browsing;
  const rowStyle = (active: boolean): React.CSSProperties => ({
    display: 'flex', alignItems: 'center', gap: 8,
    width: '100%', padding: '7px 10px',
    border: 'none',
    borderBottom: '1px solid var(--color-border-subtle)',
    background: active ? 'rgba(0,28,53,0.04)' : '#fff',
    cursor: 'pointer', textAlign: 'left',
    fontFamily: 'var(--font-primary)',
  });
  const nameStyle: React.CSSProperties = {
    flex: 1, minWidth: 0,
    fontSize: 12.5, fontWeight: 600, color: 'var(--color-text-primary)',
    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
  };
  return (
    <div style={{
      background: '#fff',
      borderRadius: 10,
      border: '1px solid var(--color-border-subtle)',
      overflow: 'hidden',
    }}>
      {!inBrowse ? (
        <>
          {shortlist.map((c) => (
            <button key={c.id} type="button" onClick={() => onPick(c)} style={rowStyle(c.id === currentId)}>
              <span style={nameStyle}>{c.name}</span>
              <TypeChip type={TYPE_LABEL[c.type]} />
              {c.id === currentId && <Check size={12} strokeWidth={2.6} color="var(--color-accent-active, #001C35)" />}
            </button>
          ))}
          {/* Escape hatch: my shortlist is wrong — search everything. */}
          <button
            type="button"
            onClick={onStartBrowse}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              width: '100%', padding: '8px 10px',
              border: 'none', background: 'rgba(0,28,53,0.02)',
              cursor: 'pointer', textAlign: 'left',
              fontFamily: 'var(--font-primary)',
              fontSize: 12, fontWeight: 600,
              color: 'var(--color-accent-active, #001C35)',
            }}
          >
            <Search size={12} strokeWidth={2.2} />
            None of these? Browse the full list
          </button>
        </>
      ) : (
        <>
          {/* Browse header: back link + live search over everything. */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '7px 10px',
            borderBottom: '1px solid var(--color-border-subtle)',
            background: 'rgba(0,28,53,0.02)',
          }}>
            <button
              type="button"
              onClick={onBackFromBrowse}
              aria-label="Back to suggestions"
              style={{
                display: 'inline-flex', alignItems: 'center',
                padding: 0, border: 'none', background: 'transparent',
                cursor: 'pointer', color: 'var(--color-text-muted)',
              }}
            >
              <ChevronDown size={13} strokeWidth={2.2} style={{ transform: 'rotate(90deg)' }} />
            </button>
            <input
              autoFocus
              value={browseQuery}
              onChange={(e) => onQueryChange(e.target.value)}
              placeholder="Search your recipes and products…"
              style={{
                flex: 1, minWidth: 0,
                border: 'none', outline: 'none', background: 'transparent',
                fontSize: 12.5, fontFamily: 'var(--font-primary)',
                color: 'var(--color-text-primary)',
              }}
            />
          </div>
          <div style={{ maxHeight: 204, overflowY: 'auto' }}>
            {browseResults.map((c) => (
              <button key={c.id} type="button" onClick={() => onPick(c)} style={rowStyle(c.id === currentId)}>
                <span style={nameStyle}>{c.name}</span>
                <TypeChip type={TYPE_LABEL[c.type]} />
              </button>
            ))}
            {browseResults.length === 0 && (
              <div style={{ padding: 10, fontSize: 12, color: 'var(--color-text-muted)' }}>
                Nothing matches “{browseQuery}”.
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
