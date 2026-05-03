'use client';

/**
 * SiteSettingsEditor — the canonical editor surface for a single site's
 * configuration. Mounted by both `/settings` (with a site picker) and
 * `/production/settings` (locked to the active persona's site).
 *
 * Edit-mode is OFF by default (principle 5 — surface, hide). Toggling it
 * reveals the inputs; staged edits live in local state. The store is
 * only written on Save (single batched commit) so we don't pile dozens
 * of writes onto every keystroke and so Discard is a true rollback.
 *
 * After a save, the editor surfaces the standard green success banner +
 * a summary card listing what changed (principle 7) and auto-marks any
 * Settings Health items it implicitly resolves (e.g. moving the cutoff
 * fixes the "spoke cutoff drifting" suspect-card).
 */

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { CheckCircle2, ChevronRight, X, AlertTriangle, Pencil, RotateCcw } from 'lucide-react';
import EdifyMark from '@/components/EdifyMark/EdifyMark';
import StatusPill from '@/components/Production/StatusPill';
import {
  PRET_SETTINGS_HEALTH,
  type SettingsHealthItem,
  type SiteId,
} from '@/components/Production/fixtures';
import {
  countOverrides,
  useSiteSettings,
  type SiteSettingsOverlay,
} from './siteSettingsStore';
import GeneralTab from './tabs/GeneralTab';
import CutoffsTab from './tabs/CutoffsTab';
import BenchesTab from './tabs/BenchesTab';
import TeamTab from './tabs/TeamTab';
import ProductionWindowsTab from './tabs/ProductionWindowsTab';
import RangeTiersTab from './tabs/RangeTiersTab';

export type SettingsTabId =
  | 'general'
  | 'cutoffs'
  | 'benches'
  | 'team'
  | 'windows'
  | 'range-tiers';

const TAB_DEFINITIONS: Array<{ id: SettingsTabId; label: string; healthSurfaces: SettingsHealthItem['surface'][] }> = [
  { id: 'general',     label: 'General',            healthSurfaces: [] },
  { id: 'cutoffs',     label: 'Cutoffs & ordering', healthSurfaces: ['cutoffs'] },
  { id: 'benches',     label: 'Benches',            healthSurfaces: ['batch-rules', 'bench-capabilities'] },
  { id: 'team',        label: 'Team & duties',      healthSurfaces: [] },
  { id: 'windows',     label: 'Production windows', healthSurfaces: [] },
  { id: 'range-tiers', label: 'Range & tiers',      healthSurfaces: ['ranges', 'selection-tags'] },
];

export type SiteSettingsEditorProps = {
  siteId: SiteId;
  /** Hide the page-level site picker (used when the host page already provides one). */
  lockedSite?: boolean;
  /** Initial active tab (e.g. when deep-linked from Settings Health). */
  initialTab?: SettingsTabId;
  /** Notify the host when the user navigates between tabs (e.g. to mirror to URL). */
  onTabChange?: (tab: SettingsTabId) => void;
};

export default function SiteSettingsEditor({
  siteId,
  lockedSite = false,
  initialTab = 'general',
  onTabChange,
}: SiteSettingsEditorProps) {
  const { effective, overlay, replace } = useSiteSettings(siteId);

  // Staged overlay = "what the editor will commit on Save". Starts as a
  // copy of the persisted overlay so the user picks up where they left off.
  const [staged, setStaged] = useState<SiteSettingsOverlay>(() => overlay ?? {});
  const [editing, setEditing] = useState(false);
  const [activeTab, setActiveTab] = useState<SettingsTabId>(initialTab);
  const [savedSummary, setSavedSummary] = useState<string[] | null>(null);
  const [resolvedHealth, setResolvedHealthIds] = useState<Set<string>>(new Set());

  // When the user switches sites or someone else commits an overlay
  // (rare for a single-user demo, but defend anyway), pull the new
  // baseline into the staged state so we don't accidentally clobber.
  useEffect(() => {
    setStaged(overlay ?? {});
    setSavedSummary(null);
  }, [siteId, overlay]);

  useEffect(() => {
    onTabChange?.(activeTab);
  }, [activeTab, onTabChange]);

  const stagedCounts = useMemo(() => countOverrides(staged), [staged]);
  const persistedCounts = useMemo(() => countOverrides(overlay), [overlay]);
  const stagedDiffCount = useMemo(() => {
    return computeStagedDiff(overlay, staged);
  }, [overlay, staged]);

  // Health alerts for this site, grouped by surface so each tab can
  // badge itself.
  const siteHealth = useMemo(
    () =>
      PRET_SETTINGS_HEALTH.filter(
        i =>
          i.scope.kind === 'site' && i.scope.id === siteId && !resolvedHealth.has(i.id),
      ),
    [siteId, resolvedHealth],
  );
  const healthBySurface = useMemo(() => {
    const m = new Map<SettingsHealthItem['surface'], SettingsHealthItem[]>();
    for (const item of siteHealth) {
      const arr = m.get(item.surface) ?? [];
      arr.push(item);
      m.set(item.surface, arr);
    }
    return m;
  }, [siteHealth]);

  function patchStaged(patch: SiteSettingsOverlay) {
    setStaged(prev => mergeOverlay(prev, patch));
    setSavedSummary(null);
  }

  function discardStaged() {
    setStaged(overlay ?? {});
    setEditing(false);
    setSavedSummary(null);
  }

  const commitSave = useCallback(() => {
    // What changed (human-readable) — used for the success summary.
    const summary = describeStagedDiff(overlay, staged, effective);

    // Implicitly resolved health items (e.g. cutoff change → sh-3 closes).
    const newlyResolved: string[] = [];
    if (staged.cutoffs?.cutoffTime && staged.cutoffs.cutoffTime !== overlay?.cutoffs?.cutoffTime) {
      siteHealth
        .filter(i => i.surface === 'cutoffs')
        .forEach(i => newlyResolved.push(i.id));
    }
    if (staged.benches && Object.keys(staged.benches).length > 0) {
      siteHealth
        .filter(i => i.surface === 'batch-rules' || i.surface === 'bench-capabilities')
        .forEach(i => newlyResolved.push(i.id));
    }
    if (newlyResolved.length > 0) {
      setResolvedHealthIds(prev => {
        const next = new Set(prev);
        newlyResolved.forEach(id => next.add(id));
        return next;
      });
    }

    // Drop empty branches so we don't persist `{}`.
    replace(prune(staged));
    setSavedSummary(summary.length > 0 ? summary : ['No changes.']);
    setEditing(false);
  }, [overlay, staged, effective, replace, siteHealth]);

  function resetAll() {
    setStaged({});
    setSavedSummary(null);
  }

  // ─── Render ───────────────────────────────────────────────────────────────

  const tabBadgeForId = useCallback(
    (id: SettingsTabId) => {
      const def = TAB_DEFINITIONS.find(t => t.id === id);
      if (!def) return { overrides: 0, health: 0 };
      const overrides = stagedCounts.byTab[id === 'range-tiers' ? 'general' : id] ?? 0;
      // The range-tiers tab is read-only in v1 so it has no overrides.
      const health = def.healthSurfaces.reduce(
        (acc, s) => acc + (healthBySurface.get(s)?.length ?? 0),
        0,
      );
      return { overrides: id === 'range-tiers' ? 0 : overrides, health };
    },
    [stagedCounts, healthBySurface],
  );

  const tabContent = renderTab(activeTab, {
    siteId,
    editing,
    staged,
    onStage: patchStaged,
    health: TAB_DEFINITIONS.find(t => t.id === activeTab)?.healthSurfaces.flatMap(
      s => healthBySurface.get(s) ?? [],
    ) ?? [],
  });

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        background: 'var(--color-bg-surface)',
        fontFamily: 'var(--font-primary)',
      }}
    >
      {/* Editor header — site identity + edit-mode toggle */}
      <EditorHeader
        siteName={effective.core.name}
        siteType={effective.core.type}
        hubId={effective.core.hubId}
        editing={editing}
        onToggleEdit={() => setEditing(e => !e)}
        onResetAll={resetAll}
        canResetAll={persistedCounts.total > 0}
        overridesCount={persistedCounts.total}
      />

      {/* Saved banner */}
      {savedSummary && (
        <SaveBanner
          summary={savedSummary}
          onDismiss={() => setSavedSummary(null)}
        />
      )}

      {/* Tab bar */}
      <div
        style={{
          flexShrink: 0,
          display: 'flex',
          gap: 4,
          padding: '6px 16px',
          borderBottom: '1px solid var(--color-border-subtle)',
          background: '#ffffff',
          overflowX: 'auto',
        }}
      >
        {TAB_DEFINITIONS.map(t => {
          const active = t.id === activeTab;
          const { overrides, health } = tabBadgeForId(t.id);
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setActiveTab(t.id)}
              style={{
                padding: '8px 12px',
                borderRadius: 8,
                fontSize: 12,
                fontWeight: 600,
                fontFamily: 'var(--font-primary)',
                background: active ? 'var(--color-accent-active)' : 'transparent',
                color: active ? 'var(--color-text-on-active)' : 'var(--color-text-secondary)',
                border: '1px solid transparent',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              {t.label}
              {overrides > 0 && (
                <span
                  style={{
                    fontSize: 9.5,
                    fontWeight: 700,
                    padding: '2px 6px',
                    borderRadius: 999,
                    background: active
                      ? 'rgba(255,255,255,0.18)'
                      : 'var(--color-info-light)',
                    color: active ? 'var(--color-text-on-active)' : 'var(--color-info)',
                  }}
                  title={`${overrides} override${overrides === 1 ? '' : 's'}`}
                >
                  {overrides}
                </span>
              )}
              {health > 0 && (
                <span
                  style={{
                    fontSize: 9.5,
                    fontWeight: 700,
                    padding: '2px 6px',
                    borderRadius: 999,
                    background: active
                      ? 'rgba(255,255,255,0.18)'
                      : 'var(--color-warning-light)',
                    color: active ? 'var(--color-text-on-active)' : 'var(--color-warning)',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 3,
                  }}
                  title={`${health} health alert${health === 1 ? '' : 's'}`}
                >
                  <AlertTriangle size={9} /> {health}
                </span>
              )}
            </button>
          );
        })}
        <div style={{ flex: 1 }} />
        <QuinnRampButton activeTab={activeTab} />
      </div>

      {/* Tab body */}
      <div
        style={{
          flex: 1,
          minHeight: 0,
          overflow: 'auto',
          padding: '16px 16px 96px',
        }}
      >
        {tabContent}
      </div>

      {/* Sticky save bar — only when there are staged changes */}
      {stagedDiffCount > 0 && (
        <SaveBar
          count={stagedDiffCount}
          onSave={commitSave}
          onDiscard={discardStaged}
        />
      )}

      {/* Persona footer affordance — for the locked-site flow we don't
          render a "switch site" link here because the host page provides
          a picker. */}
      {lockedSite && null}
    </div>
  );
}

// ─── Header ──────────────────────────────────────────────────────────────────

function EditorHeader({
  siteName,
  siteType,
  hubId,
  editing,
  onToggleEdit,
  onResetAll,
  canResetAll,
  overridesCount,
}: {
  siteName: string;
  siteType: 'STANDALONE' | 'HUB' | 'SPOKE' | 'HYBRID';
  hubId: SiteId | null;
  editing: boolean;
  onToggleEdit: () => void;
  onResetAll: () => void;
  canResetAll: boolean;
  overridesCount: number;
}) {
  const typeTone =
    siteType === 'HUB' ? 'brand' : siteType === 'SPOKE' ? 'info' : 'neutral';

  return (
    <div
      style={{
        flexShrink: 0,
        padding: '14px 16px',
        borderBottom: '1px solid var(--color-border-subtle)',
        background: '#ffffff',
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        flexWrap: 'wrap',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
        <div
          style={{
            width: 32,
            height: 32,
            borderRadius: 8,
            background: 'var(--color-bg-hover)',
            color: 'var(--color-text-secondary)',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          <EdifyMark size={16} color="var(--color-text-secondary)" />
        </div>
        <div style={{ minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 14, fontWeight: 700 }}>{siteName || 'Settings'}</span>
            <StatusPill tone={typeTone} label={siteType} size="xs" />
            {overridesCount > 0 && (
              <StatusPill tone="info" label={`${overridesCount} override${overridesCount === 1 ? '' : 's'}`} size="xs" />
            )}
          </div>
          <span style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>
            {hubId
              ? `Ordering from ${hubId.replace(/-/g, ' ')} · estate cascade applies`
              : 'Configure the defaults for this site. Edits override the format / estate cascade.'}
          </span>
        </div>
      </div>
      <div style={{ flex: 1 }} />
      {canResetAll && (
        <button
          type="button"
          onClick={onResetAll}
          style={ghostBtn()}
          title="Drop every override on this site"
        >
          <RotateCcw size={12} /> Reset to defaults
        </button>
      )}
      <button
        type="button"
        onClick={onToggleEdit}
        style={editing ? activeToggleBtn() : ghostToggleBtn()}
      >
        <Pencil size={12} /> {editing ? 'Editing — tap to lock' : 'Enable edit mode'}
      </button>
    </div>
  );
}

// ─── Tab body switcher ───────────────────────────────────────────────────────

function renderTab(
  id: SettingsTabId,
  ctx: {
    siteId: SiteId;
    editing: boolean;
    staged: SiteSettingsOverlay;
    onStage: (p: SiteSettingsOverlay) => void;
    health: SettingsHealthItem[];
  },
) {
  switch (id) {
    case 'general':
      return <GeneralTab {...ctx} />;
    case 'cutoffs':
      return <CutoffsTab {...ctx} />;
    case 'benches':
      return <BenchesTab {...ctx} />;
    case 'team':
      return <TeamTab {...ctx} />;
    case 'windows':
      return <ProductionWindowsTab {...ctx} />;
    case 'range-tiers':
      return <RangeTiersTab {...ctx} />;
  }
}

// ─── Save bar ────────────────────────────────────────────────────────────────

function SaveBar({
  count,
  onSave,
  onDiscard,
}: {
  count: number;
  onSave: () => void;
  onDiscard: () => void;
}) {
  return (
    <div
      role="region"
      aria-label="Unsaved changes"
      style={{
        position: 'sticky',
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: 40,
        padding: '12px 16px',
        background: '#ffffff',
        borderTop: '1px solid var(--color-border)',
        boxShadow: '0 -8px 24px rgba(58,48,40,0.08)',
        display: 'flex',
        alignItems: 'center',
        gap: 10,
      }}
    >
      <ChevronRight size={14} color="var(--color-info)" />
      <span style={{ fontSize: 12, fontWeight: 700 }}>
        {count} change{count === 1 ? '' : 's'} ready to save
      </span>
      <span style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>
        Edits stay local until you commit. Discard rolls everything back.
      </span>
      <div style={{ flex: 1 }} />
      <button type="button" onClick={onDiscard} style={ghostBtn()}>
        Discard
      </button>
      <button type="button" onClick={onSave} style={primaryBtn()}>
        <CheckCircle2 size={12} /> Save changes ({count})
      </button>
    </div>
  );
}

// ─── Save banner ─────────────────────────────────────────────────────────────

function SaveBanner({
  summary,
  onDismiss,
}: {
  summary: string[];
  onDismiss: () => void;
}) {
  return (
    <div
      role="status"
      style={{
        flexShrink: 0,
        margin: '12px 16px 0',
        padding: '12px 14px',
        borderRadius: 'var(--radius-card)',
        background: 'var(--color-success-light)',
        border: '1px solid var(--color-success-border)',
        color: 'var(--color-success)',
        display: 'flex',
        alignItems: 'flex-start',
        gap: 12,
      }}
    >
      <CheckCircle2 size={16} style={{ marginTop: 1, flexShrink: 0 }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 12, fontWeight: 700 }}>
          Saved {summary.length} change{summary.length === 1 ? '' : 's'}
        </div>
        <ul
          style={{
            margin: '4px 0 0',
            padding: 0,
            listStyle: 'none',
            display: 'flex',
            flexDirection: 'column',
            gap: 2,
            fontSize: 11,
            color: 'var(--color-text-primary)',
          }}
        >
          {summary.map((line, i) => (
            <li key={i} style={{ fontWeight: 500 }}>
              · {line}
            </li>
          ))}
        </ul>
      </div>
      <button
        type="button"
        onClick={onDismiss}
        aria-label="Dismiss"
        style={{
          width: 24,
          height: 24,
          borderRadius: 6,
          border: '1px solid transparent',
          background: 'transparent',
          color: 'var(--color-success)',
          cursor: 'pointer',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <X size={14} />
      </button>
    </div>
  );
}

// ─── Quinn ramp ──────────────────────────────────────────────────────────────

const QUINN_PROMPTS: Record<SettingsTabId, string> = {
  general:     'Help me link this site to a different hub.',
  cutoffs:     'Move the spoke cutoff later for one week.',
  benches:     'Add a new bakery bench like the existing one.',
  team:        'Add three new GMs to the bench rotation.',
  windows:     'Push P1 back by 30 minutes on Mondays.',
  'range-tiers': 'Tell me what the Range & tiers redesign should solve.',
};

function QuinnRampButton({ activeTab }: { activeTab: SettingsTabId }) {
  // We don't open the panel programmatically — the QuinnProductionPanel
  // already lives in the layout and the user can pop it open. Instead
  // this button surfaces the conversational alternative inline (principle
  // 3) and copies the suggested prompt to the clipboard so the manager
  // can paste it into Quinn (or just read it as a hint).
  const prompt = QUINN_PROMPTS[activeTab];
  return (
    <button
      type="button"
      onClick={() => {
        try {
          navigator.clipboard?.writeText(prompt);
        } catch {
          // ignore — clipboard may be blocked
        }
      }}
      title={`Suggested Quinn prompt: "${prompt}" — copied to clipboard`}
      style={{
        padding: '8px 10px',
        borderRadius: 8,
        background: 'var(--color-info-light)',
        border: '1px solid var(--color-info)',
        color: 'var(--color-info)',
        fontSize: 11,
        fontWeight: 700,
        fontFamily: 'var(--font-primary)',
        cursor: 'pointer',
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        whiteSpace: 'nowrap',
      }}
    >
      <EdifyMark size={11} color="var(--color-info)" /> Ask Quinn instead
    </button>
  );
}

// ─── Helpers — diff / merge / prune ──────────────────────────────────────────

/** Counts how many leaf-value differences exist between two overlays. */
function computeStagedDiff(
  base: SiteSettingsOverlay | undefined,
  staged: SiteSettingsOverlay,
): number {
  let count = 0;
  const b = base ?? {};

  // Core
  for (const k of Object.keys(staged.core ?? {}) as Array<keyof typeof staged.core>) {
    if (
      JSON.stringify((staged.core as Record<string, unknown>)[k]) !==
      JSON.stringify((b.core as Record<string, unknown> | undefined)?.[k])
    ) {
      count += 1;
    }
  }

  // Cutoffs
  for (const k of Object.keys(staged.cutoffs ?? {}) as Array<keyof typeof staged.cutoffs>) {
    if (
      (staged.cutoffs as Record<string, unknown>)[k] !==
      (b.cutoffs as Record<string, unknown> | undefined)?.[k]
    ) {
      count += 1;
    }
  }

  // Benches — compare per id then per field
  if (staged.benches) {
    for (const id of Object.keys(staged.benches)) {
      const a = staged.benches[id] ?? {};
      const baseBench = b.benches?.[id] ?? {};
      for (const k of Object.keys(a) as Array<keyof typeof a>) {
        if (
          JSON.stringify((a as Record<string, unknown>)[k]) !==
          JSON.stringify((baseBench as Record<string, unknown>)[k])
        ) {
          count += 1;
        }
      }
    }
  }
  if (staged.benchOrder && JSON.stringify(staged.benchOrder) !== JSON.stringify(b.benchOrder)) {
    count += 1;
  }

  // Team
  if (staged.team) {
    if (JSON.stringify(staged.team.users) !== JSON.stringify(b.team?.users)) count += 1;
    if (JSON.stringify(staged.team.duties) !== JSON.stringify(b.team?.duties)) count += 1;
  }

  // Windows
  if (staged.windows) {
    for (const day of Object.keys(staged.windows)) {
      const a = (staged.windows as Record<string, Record<string, unknown>>)[day] ?? {};
      const baseDay = (b.windows as Record<string, Record<string, unknown>> | undefined)?.[day] ?? {};
      for (const k of Object.keys(a)) {
        if (JSON.stringify(a[k]) !== JSON.stringify(baseDay[k])) {
          count += 1;
        }
      }
    }
  }

  return count;
}

/** Human-readable summary of what changed (for the success banner). */
function describeStagedDiff(
  base: SiteSettingsOverlay | undefined,
  staged: SiteSettingsOverlay,
  // Note: effective is the *pre-save* merged view. We use it for friendlier
  // labels (e.g. "from 15:00 → 14:30") via the staged value alone.
  // Currently unused but kept for richer summaries in v2.
  _effective: unknown,
): string[] {
  const out: string[] = [];
  const b = base ?? {};

  if (staged.core) {
    if (staged.core.name && staged.core.name !== b.core?.name) out.push(`Site name → "${staged.core.name}"`);
    if (staged.core.formatId && staged.core.formatId !== b.core?.formatId) out.push(`Format → ${staged.core.formatId}`);
    if (staged.core.hubId !== undefined && staged.core.hubId !== b.core?.hubId) out.push(`Hub link → ${staged.core.hubId ?? 'none'}`);
    if (staged.core.openingHours && JSON.stringify(staged.core.openingHours) !== JSON.stringify(b.core?.openingHours)) {
      out.push(`Opening hours → ${staged.core.openingHours.open}–${staged.core.openingHours.close}`);
    }
    if (staged.core.salesFactor !== undefined && staged.core.salesFactor !== b.core?.salesFactor) {
      out.push(`Sales factor → ${staged.core.salesFactor}`);
    }
  }

  if (staged.cutoffs) {
    if (staged.cutoffs.cutoffTime && staged.cutoffs.cutoffTime !== b.cutoffs?.cutoffTime) out.push(`Cutoff time → ${staged.cutoffs.cutoffTime}`);
    if (staged.cutoffs.lockPolicy && staged.cutoffs.lockPolicy !== b.cutoffs?.lockPolicy) out.push(`Lock policy → ${staged.cutoffs.lockPolicy}`);
    if (staged.cutoffs.coverDays !== undefined && staged.cutoffs.coverDays !== b.cutoffs?.coverDays) out.push(`Cover days → ${staged.cutoffs.coverDays}`);
    if (staged.cutoffs.leadTimeHours !== undefined && staged.cutoffs.leadTimeHours !== b.cutoffs?.leadTimeHours) out.push(`Lead time → ${staged.cutoffs.leadTimeHours}h`);
  }

  if (staged.benches && Object.keys(staged.benches).length > 0) {
    out.push(`${Object.keys(staged.benches).length} bench update${Object.keys(staged.benches).length === 1 ? '' : 's'}`);
  }
  if (staged.team) {
    if (staged.team.users && JSON.stringify(staged.team.users) !== JSON.stringify(b.team?.users)) out.push(`Team users updated`);
    if (staged.team.duties && JSON.stringify(staged.team.duties) !== JSON.stringify(b.team?.duties)) out.push(`Site duties updated`);
  }
  if (staged.windows && Object.keys(staged.windows).length > 0) {
    out.push(`Production windows for ${Object.keys(staged.windows).length} day${Object.keys(staged.windows).length === 1 ? '' : 's'} updated`);
  }
  return out;
}

function mergeOverlay(prev: SiteSettingsOverlay, patch: SiteSettingsOverlay): SiteSettingsOverlay {
  const next: SiteSettingsOverlay = { ...prev };
  if (patch.core) next.core = { ...(prev.core ?? {}), ...patch.core };
  if (patch.cutoffs) next.cutoffs = { ...(prev.cutoffs ?? {}), ...patch.cutoffs };
  if (patch.benches) {
    next.benches = { ...(prev.benches ?? {}) };
    for (const id of Object.keys(patch.benches)) {
      next.benches[id] = { ...(next.benches[id] ?? {}), ...patch.benches[id] };
    }
  }
  if (patch.benchOrder) next.benchOrder = patch.benchOrder;
  if (patch.team) next.team = { ...(prev.team ?? {}), ...patch.team };
  if (patch.windows) {
    next.windows = { ...(prev.windows ?? {}) };
    for (const day of Object.keys(patch.windows)) {
      const d = day as keyof NonNullable<SiteSettingsOverlay['windows']>;
      next.windows[d] = { ...(next.windows[d] ?? {}), ...patch.windows[d] };
    }
  }
  return next;
}

/** Strip empty objects so persisted blob stays tidy. */
function prune(o: SiteSettingsOverlay): SiteSettingsOverlay | undefined {
  const out: SiteSettingsOverlay = {};
  if (o.core && Object.keys(o.core).length > 0) out.core = o.core;
  if (o.cutoffs && Object.keys(o.cutoffs).length > 0) out.cutoffs = o.cutoffs;
  if (o.benches && Object.keys(o.benches).length > 0) {
    const cleaned: Record<string, NonNullable<SiteSettingsOverlay['benches']>[string]> = {};
    for (const id of Object.keys(o.benches)) {
      if (Object.keys(o.benches[id] ?? {}).length > 0) {
        cleaned[id] = o.benches[id];
      }
    }
    if (Object.keys(cleaned).length > 0) out.benches = cleaned;
  }
  if (o.benchOrder) out.benchOrder = o.benchOrder;
  if (o.team && (o.team.users || o.team.duties)) out.team = o.team;
  if (o.windows && Object.keys(o.windows).length > 0) out.windows = o.windows;
  return Object.keys(out).length > 0 ? out : undefined;
}

// ─── Button styles (consistent with the rest of the app) ─────────────────────

function ghostBtn(): React.CSSProperties {
  return {
    padding: '8px 12px',
    borderRadius: 8,
    fontSize: 11,
    fontWeight: 700,
    fontFamily: 'var(--font-primary)',
    background: '#ffffff',
    color: 'var(--color-text-secondary)',
    border: '1px solid var(--color-border)',
    cursor: 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    whiteSpace: 'nowrap',
  };
}

function ghostToggleBtn(): React.CSSProperties {
  return {
    ...ghostBtn(),
    background: 'var(--color-bg-hover)',
  };
}

function activeToggleBtn(): React.CSSProperties {
  return {
    padding: '8px 12px',
    borderRadius: 8,
    fontSize: 11,
    fontWeight: 700,
    fontFamily: 'var(--font-primary)',
    background: 'var(--color-info-light)',
    color: 'var(--color-info)',
    border: '1px solid var(--color-info)',
    cursor: 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    whiteSpace: 'nowrap',
  };
}

function primaryBtn(): React.CSSProperties {
  return {
    padding: '8px 14px',
    borderRadius: 8,
    fontSize: 11,
    fontWeight: 700,
    fontFamily: 'var(--font-primary)',
    background: 'var(--color-accent-active)',
    color: 'var(--color-text-on-active)',
    border: '1px solid var(--color-accent-active)',
    cursor: 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    whiteSpace: 'nowrap',
  };
}
