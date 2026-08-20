'use client';

/**
 * The default landing surface for the Stocktake tab — a list of every
 * stocktake at this site, with the in-progress one (if any) sitting at
 * the top of the list, styled as the obvious next action.
 *
 * Two ways to enter the count flow from here:
 *   1. Click the in-progress row — picks up where you left off.
 *   2. Hit "+ Start new stocktake" — a fresh count.
 *
 * Completed and needs-review records below are read-only summaries;
 * clicking them in v2 would open the variance breakdown drawer, but
 * for the prototype it's just a placeholder action.
 */

import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Check,
  ChevronRight,
  ClipboardCheck,
  ListChecks,
  MapPin,
  Play,
  Plus,
  Search,
  Star,
  X,
  Zap,
} from 'lucide-react';
import type {
  CountTarget,
  ItemGroup,
  StockItem,
  StockLocation,
  StocktakeRecord,
  StocktakeStatus,
} from './status';
import {
  STOCKTAKE_STATUS_LABEL,
  STOCKTAKE_STATUS_TONE,
  formatPrice,
  formatRelativeDate,
} from './status';

interface Props {
  history: StocktakeRecord[];
  siteName: string;
  /** Site id — used to namespace the ids of groups created from this
   *  surface so they stay stable when the user switches sites. */
  siteId: string;
  /** Count of items currently flagged as needing attention at this
   *  site. Drives the badge on the Quick count card so the operator
   *  knows whether a quick count is even worth doing. */
  flaggedItemCount: number;
  /** Total item count at this site — shown on the Full count card. */
  totalItemCount: number;
  /** Storage locations that actually have items at this site. Becomes
   *  the inline button row inside the Area card. */
  availableLocations: StockLocation[];
  /** Estimated $-value of stock on hand. For site mode this is the
   *  sum of `currentStock × unitPrice` across the site's items; for
   *  aggregated mode it's the same sum across every site in the
   *  estate. Powers the leading summary tile. */
  estimatedStockValue: number;
  /** Saved item groups for this site — fixture defaults plus anything
   *  the operator's added. Each becomes its own scope button. */
  groups: ItemGroup[];
  /** Every item at the active site — fed into the create-group panel
   *  so the operator can pick which items belong in the new group. */
  allItems: StockItem[];
  /** Start (or continue) a count. The list emits a CountTarget; the
   *  page resolves the item filter and swaps to StocktakeView. */
  onStart: (target: CountTarget) => void;
  /** Persist a newly-created group against the active site. The page
   *  pushes it into its userGroups map so the new group's button
   *  shows up on the next render. */
  onCreateGroup: (group: ItemGroup) => void;
  /** When true, the list renders in estate-wide read-only mode: no
   *  scope buttons / groups row / open-record row (you can't start a
   *  count against "all sites"), and the past-counts table grows an
   *  extra "Site" column. Records here come from every site in the
   *  estate, so each is expected to carry a denormalised `siteName`. */
  aggregated?: boolean;
}

type StatusFilter = StocktakeStatus | 'all';

export default function StocktakeList({
  history,
  siteName,
  siteId,
  flaggedItemCount,
  totalItemCount,
  availableLocations,
  estimatedStockValue,
  groups,
  allItems,
  onStart,
  onCreateGroup,
  aggregated = false,
}: Props) {
  // The "Count an area" button doesn't drill in directly — there's no
  // sensible default location to pick — so it acts as a toggle that
  // expands a row of location pills below the button strip. Picking a
  // location drills in and the list view goes away, so we don't need
  // to manage collapse-on-pick.
  const [areaExpanded, setAreaExpanded] = useState(false);
  // "+ New group" expands an inline form below the groups row. The
  // form lives here (not in a modal) so it stays mobile-friendly and
  // reads as a natural continuation of the button strip.
  const [createOpen, setCreateOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');

  // Open stocktake (if any) gets pulled to the top regardless of the
  // filter — operators should always be able to see "there's a count
  // already in flight" from this surface.
  const openRecord = useMemo(
    () => history.find(r => r.status === 'in-progress') ?? null,
    [history],
  );

  const completedRows = useMemo(() => {
    const rest = history.filter(r => r.status !== 'in-progress');
    return statusFilter === 'all'
      ? rest
      : rest.filter(r => r.status === statusFilter);
  }, [history, statusFilter]);

  const lastCleanCount = useMemo(
    () =>
      history.find(r => r.status === 'completed' && r.scope === 'Full count'),
    [history],
  );
  const openReviews = history.filter(r => r.status === 'needs-review').length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* Summary strip */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: 8,
        }}
      >
        <SummaryTile
          label="Estimated stock value"
          value={formatPrice(estimatedStockValue)}
          meta={
            aggregated
              ? `${history.length} stocktake${
                  history.length === 1 ? '' : 's'
                } on record`
              : siteName
          }
        />
        <SummaryTile
          label="Last full count"
          value={
            lastCleanCount ? formatRelativeDate(lastCleanCount.date) : 'Never'
          }
          meta={lastCleanCount?.counterName ?? '—'}
        />
        <SummaryTile
          label="Open reviews"
          value={openReviews.toString()}
          meta={openReviews > 0 ? 'Investigate variances' : 'All clear'}
          tone={openReviews > 0 ? 'var(--color-warning)' : undefined}
        />
      </div>

      {/* Open stocktake row (if any) — always the first card, accent
          treatment so it reads as the next action. Suppressed in
          aggregated mode: an estate-wide list can have multiple opens
          across different sites, which doesn't translate to a single
          "continue here" CTA. */}
      {openRecord && !aggregated && (
        <button
          type="button"
          onClick={() => onStart({ kind: 'continue', recordId: openRecord.id })}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
            padding: '14px 16px',
            background: '#fff',
            border: '1px solid var(--color-accent-active)',
            borderLeft: '4px solid var(--color-accent-active)',
            borderRadius: 'var(--radius-card)',
            cursor: 'pointer',
            textAlign: 'left',
            fontFamily: 'var(--font-primary)',
            width: '100%',
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '2px 8px',
                  borderRadius: 'var(--radius-badge)',
                  background: 'transparent',
                  color: 'var(--color-warning)',
                  border: '1px solid var(--color-warning)',
                  fontSize: 10,
                  fontWeight: 700,
                  letterSpacing: '0.04em',
                  textTransform: 'uppercase',
                }}
              >
                <span
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: '50%',
                    background: 'var(--color-warning)',
                  }}
                />
                Open
              </span>
              <span
                style={{
                  fontSize: 14,
                  fontWeight: 700,
                  color: 'var(--color-text-primary)',
                }}
              >
                {openRecord.sectionName
                  ? `${openRecord.scope} · ${openRecord.sectionName}`
                  : openRecord.scope}
              </span>
            </div>
            <div style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>
              Started {formatRelativeDate(openRecord.date)} by {openRecord.counterName} ·{' '}
              {openRecord.itemsCounted} counted so far
            </div>
          </div>
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '8px 14px',
              borderRadius: 'var(--radius-item)',
              background: 'var(--color-accent-active)',
              color: 'var(--color-text-on-active)',
              fontSize: 12,
              fontWeight: 600,
              whiteSpace: 'nowrap',
            }}
          >
            <Play size={14} fill="currentColor" /> Continue counting
          </span>
        </button>
      )}

      {/* Action surfaces (scope buttons, groups row, area picker,
          create-group form) are all per-site — they don't make sense
          in the estate-wide read-only view. The whole block is
          suppressed in aggregated mode. */}
      {!aggregated && (
      <>
      {/* Unified scope row — every way to start a count lives in one
          flex-wrap line so the operator's eye doesn't have to jump
          between two strips. Order is intent-led:
            1. Full count leads — it's the canonical "do the
               stocktake" action and the one operators reach for by
               default, so it gets the leading slot.
            2. Quick / Area — the two narrower-scope shortcuts.
            3. Saved item groups, fronted by a small GROUPS label so
               the operator-defined slices read as a separate concept
               from the fixed modes above.
            4. "+ New group" for adding more.
          Voice isn't on this row — it's a modality that lives inside
          the count view itself, available after the operator's picked
          a scope. All entry points are disabled while an open
          stocktake is in flight. */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 8,
          alignItems: 'center',
        }}
      >
        <ScopeButton
          icon={<ListChecks size={14} />}
          tone="var(--color-accent-active)"
          label="Full count"
          count={totalItemCount}
          disabled={Boolean(openRecord)}
          disabledHint="Continue the open stocktake first."
          onClick={() => onStart({ kind: 'full' })}
        />
        <ScopeButton
          icon={<Zap size={14} />}
          tone="var(--color-warning)"
          label="Quick count"
          count={flaggedItemCount > 0 ? flaggedItemCount : undefined}
          disabled={Boolean(openRecord) || flaggedItemCount === 0}
          disabledHint={
            openRecord
              ? 'Continue the open stocktake first.'
              : 'Nothing currently flagged — try Full or Area count.'
          }
          onClick={() => onStart({ kind: 'quick' })}
        />
        <ScopeButton
          icon={<MapPin size={14} />}
          tone="var(--color-info)"
          label="Count an area"
          active={areaExpanded}
          disabled={Boolean(openRecord)}
          disabledHint="Continue the open stocktake first."
          onClick={() => setAreaExpanded(v => !v)}
        />

        {/* Inline GROUPS divider — separates the operator-defined
            slices that follow from the fixed modes above without
            forcing a new row. */}
        <span
          style={{
            fontSize: 11,
            color: 'var(--color-text-secondary)',
            fontFamily: 'var(--font-primary)',
            fontWeight: 600,
            textTransform: 'uppercase',
            letterSpacing: '0.04em',
            paddingLeft: 6,
            marginLeft: 2,
            borderLeft: '1px solid var(--color-border)',
          }}
        >
          Groups
        </span>
        {groups.map(group => (
          <ScopeButton
            key={group.id}
            icon={<Star size={14} />}
            tone="var(--color-text-secondary)"
            label={group.name}
            count={group.itemIds.length}
            disabled={Boolean(openRecord) || group.itemIds.length === 0}
            disabledHint={
              openRecord
                ? 'Continue the open stocktake first.'
                : 'No items in this group yet.'
            }
            onClick={() =>
              onStart({
                kind: 'group',
                groupId: group.id,
                groupName: group.name,
              })
            }
          />
        ))}
        <ScopeButton
          icon={<Plus size={14} />}
          tone="var(--color-text-secondary)"
          label="New group"
          active={createOpen}
          disabled={Boolean(openRecord)}
          disabledHint="Continue the open stocktake first."
          onClick={() => setCreateOpen(v => !v)}
        />
      </div>

      {/* Create-group surface lives in a right-anchored drawer
          (rendered at the end of the file, portaled to <body>) so the
          form has room without pushing the past-counts table off
          screen. Same drawer pattern as ItemDetailDrawer for IA
          consistency. */}
      <CreateGroupDrawer
        open={createOpen && !openRecord}
        siteId={siteId}
        allItems={allItems}
        onClose={() => setCreateOpen(false)}
        onSave={group => {
          onCreateGroup(group);
          setCreateOpen(false);
        }}
      />

      {/* Area-picker row — only rendered when "Count an area" is
          toggled on. The pills inherit the info-tone outline from the
          button so it reads as a continuation. Picking a location
          drills straight into the count view. */}
      {areaExpanded && !openRecord && (
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: 6,
            alignItems: 'center',
            padding: '4px 4px 0',
          }}
        >
          <span
            style={{
              fontSize: 11,
              color: 'var(--color-text-secondary)',
              fontFamily: 'var(--font-primary)',
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: '0.04em',
              marginRight: 4,
            }}
          >
            Pick an area
          </span>
          {availableLocations.length === 0 && (
            <span style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>
              No locations configured.
            </span>
          )}
          {availableLocations.map(location => (
            <button
              key={location}
              type="button"
              onClick={() => onStart({ kind: 'area', location })}
              style={{
                minHeight: 32,
                padding: '6px 12px',
                borderRadius: 100,
                border: '1px solid var(--color-info)',
                background: 'transparent',
                color: 'var(--color-info)',
                fontFamily: 'var(--font-primary)',
                fontSize: 12,
                fontWeight: 600,
                cursor: 'pointer',
                whiteSpace: 'nowrap',
              }}
            >
              {location}
            </button>
          ))}
        </div>
      )}
      </>
      )}

      {/* Past records — status filter row. Filter on the left so it
          reads as the active control; the "Past stocktakes" label
          sits on the right as a quieter section caption. */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
          flexWrap: 'wrap',
          marginTop: 8,
        }}
      >
        <div
          role="tablist"
          style={{
            display: 'flex',
            alignItems: 'stretch',
            background: 'var(--color-bg-hover)',
            borderRadius: 100,
            padding: 3,
            // 44px total = 3+3 container padding + 38px tab. Bumped
            // to align with the standard tap-target height used by
            // the scope buttons above so the row reads as one band.
            minHeight: 44,
            width: 'fit-content',
          }}
        >
          {(['all', 'completed', 'needs-review'] as StatusFilter[]).map(s => {
            const active = statusFilter === s;
            const label = s === 'all' ? 'All' : STOCKTAKE_STATUS_LABEL[s];
            return (
              <button
                key={s}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setStatusFilter(s)}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  minHeight: 38,
                  padding: '0 16px',
                  borderRadius: 100,
                  border: 'none',
                  fontFamily: 'var(--font-primary)',
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: 'pointer',
                  background: active
                    ? 'var(--color-accent-active)'
                    : 'transparent',
                  color: active ? '#fff' : 'var(--color-text-secondary)',
                  whiteSpace: 'nowrap',
                }}
              >
                {label}
              </button>
            );
          })}
        </div>

        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            fontFamily: 'var(--font-primary)',
            fontSize: 13,
            fontWeight: 600,
            color: 'var(--color-text-primary)',
          }}
        >
          <ClipboardCheck size={16} color="var(--color-text-secondary)" />
          Past stocktakes
        </div>
      </div>

      {/* Completed / needs-review table */}
      <div
        style={{
          border: '1px solid var(--color-border-subtle)',
          borderRadius: 'var(--radius-card)',
          overflow: 'auto',
          background: '#fff',
        }}
      >
        <table
          style={{
            width: '100%',
            borderCollapse: 'collapse',
            fontFamily: 'var(--font-primary)',
            fontSize: 13,
          }}
        >
          <thead>
            <tr
              style={{
                background: 'var(--color-bg-hover)',
                color: 'var(--color-text-secondary)',
                fontSize: 11,
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
              }}
            >
              <Th>Date</Th>
              {aggregated && <Th>Site</Th>}
              <Th>Scope</Th>
              <Th>Counter</Th>
              <Th align="right">Items</Th>
              <Th align="right">Movements</Th>
              <Th align="right">Variances</Th>
              <Th align="right">Net $</Th>
              <Th>Status</Th>
              <Th aria-label="Open" />
            </tr>
          </thead>
          <tbody>
            {completedRows.length === 0 && (
              <tr>
                <td
                  colSpan={aggregated ? 10 : 9}
                  style={{
                    padding: 24,
                    textAlign: 'center',
                    color: 'var(--color-text-secondary)',
                  }}
                >
                  No stocktakes match this filter.
                </td>
              </tr>
            )}
            {completedRows.map(record => {
              const tone = STOCKTAKE_STATUS_TONE[record.status];
              const scopeLabel = record.sectionName
                ? `${record.scope} · ${record.sectionName}`
                : record.scope;
              return (
                <tr
                  key={record.id}
                  onClick={
                    aggregated
                      ? undefined
                      : () => onStart({ kind: 'continue', recordId: record.id })
                  }
                  style={{
                    borderTop: '1px solid var(--color-border-subtle)',
                    cursor: aggregated ? 'default' : 'pointer',
                  }}
                >
                  <Td>
                    <div style={{ fontWeight: 600, color: 'var(--color-text-primary)' }}>
                      {formatRelativeDate(record.date)}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--color-text-secondary)' }}>
                      {new Date(record.date).toLocaleString('en-GB', {
                        day: 'numeric',
                        month: 'short',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </div>
                  </Td>
                  {aggregated && (
                    <Td>
                      <span
                        style={{
                          color: 'var(--color-text-primary)',
                          fontWeight: 500,
                        }}
                      >
                        {record.siteName ?? '—'}
                      </span>
                    </Td>
                  )}
                  <Td>{scopeLabel}</Td>
                  <Td>{record.counterName}</Td>
                  <Td align="right">{record.itemsCounted}</Td>
                  <Td align="right">
                    <span style={{ color: 'var(--color-text-secondary)' }}>
                      {record.movementCount.toLocaleString('en-GB')}
                    </span>
                  </Td>
                  <Td align="right">
                    <span
                      style={{
                        color:
                          record.variancesFound === 0
                            ? 'var(--color-text-secondary)'
                            : record.variancesFound > 5
                              ? 'var(--color-error)'
                              : 'var(--color-warning)',
                        fontWeight: 600,
                      }}
                    >
                      {record.variancesFound}
                    </span>
                  </Td>
                  <Td align="right">
                    {record.netVarianceValue === undefined ? (
                      <span style={{ color: 'var(--color-text-secondary)' }}>—</span>
                    ) : (
                      <span
                        style={{
                          color:
                            record.netVarianceValue < 0
                              ? 'var(--color-error)'
                              : record.netVarianceValue > 0
                                ? 'var(--color-success)'
                                : 'var(--color-text-secondary)',
                          fontWeight: 600,
                        }}
                      >
                        {record.netVarianceValue < 0
                          ? '−'
                          : record.netVarianceValue > 0
                            ? '+'
                            : ''}
                        ${Math.abs(record.netVarianceValue).toFixed(0)}
                      </span>
                    )}
                  </Td>
                  <Td>
                    <span
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        padding: '2px 8px',
                        borderRadius: 'var(--radius-badge)',
                        background: 'transparent',
                        color: tone,
                        border: `1px solid ${tone}`,
                        fontSize: 10,
                        fontWeight: 700,
                        letterSpacing: '0.04em',
                        textTransform: 'uppercase',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {STOCKTAKE_STATUS_LABEL[record.status]}
                    </span>
                  </Td>
                  <Td>
                    {!aggregated && (
                      <ChevronRight
                        size={16}
                        strokeWidth={2}
                        color="var(--color-text-secondary)"
                      />
                    )}
                  </Td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Subcomponents ───────────────────────────────────────────────────────────

function SummaryTile({
  label,
  value,
  meta,
  tone,
}: {
  label: string;
  value: string;
  meta?: string;
  tone?: string;
}) {
  return (
    <div
      style={{
        padding: '12px 14px',
        border: '1px solid var(--color-border-subtle)',
        borderRadius: 'var(--radius-card)',
        background: '#fff',
      }}
    >
      <div
        style={{
          fontSize: 11,
          color: 'var(--color-text-secondary)',
          textTransform: 'uppercase',
          letterSpacing: '0.04em',
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontSize: 18,
          fontWeight: 700,
          marginTop: 2,
          color: tone ?? 'var(--color-text-primary)',
        }}
      >
        {value}
      </div>
      {meta && (
        <div
          style={{
            fontSize: 11,
            color: 'var(--color-text-secondary)',
            marginTop: 2,
          }}
        >
          {meta}
        </div>
      )}
    </div>
  );
}

function Th({
  children,
  align = 'left',
  ...rest
}: {
  children?: React.ReactNode;
  align?: 'left' | 'right';
  'aria-label'?: string;
}) {
  return (
    <th
      aria-label={rest['aria-label']}
      style={{
        textAlign: align,
        padding: '10px 14px',
        fontWeight: 700,
        whiteSpace: 'nowrap',
      }}
    >
      {children}
    </th>
  );
}

function Td({
  children,
  align = 'left',
}: {
  children: React.ReactNode;
  align?: 'left' | 'right';
}) {
  return (
    <td
      style={{
        textAlign: align,
        padding: '10px 14px',
        color: 'var(--color-text-primary)',
        verticalAlign: 'middle',
      }}
    >
      {children}
    </td>
  );
}

// ─── Create-group drawer ────────────────────────────────────────────────────

/** Right-anchored drawer for building a new ItemGroup. Uses the same
 *  portal + framer slide-in shape as ItemDetailDrawer so the in-app
 *  drawer pattern stays consistent.
 *
 *  Three controls inside:
 *    1. Name field — required.
 *    2. Search box — filters the item list by name / variant /
 *       supplier so the operator isn't scrolling through 50+ rows.
 *    3. Item checklist — each row is a tap-target with the category
 *       alongside, so the operator can build a group by skimming
 *       rather than remembering item names.
 *
 *  Save is blocked until there's at least one item and a non-empty
 *  name. Closing the drawer (X, backdrop click, Esc) unmounts the
 *  body so state resets between sessions — the next "+ New group"
 *  opens to a blank slate.
 */
function CreateGroupDrawer({
  open,
  siteId,
  allItems,
  onClose,
  onSave,
}: {
  open: boolean;
  siteId: string;
  allItems: StockItem[];
  onClose: () => void;
  onSave: (group: ItemGroup) => void;
}) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  // Esc to close — bound only while open so we don't pollute the
  // global keymap when nothing's showing.
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!mounted) return null;

  return createPortal(
    <AnimatePresence>
      {open && (
        <CreateGroupDrawerBody
          key="create-group"
          siteId={siteId}
          allItems={allItems}
          onClose={onClose}
          onSave={onSave}
        />
      )}
    </AnimatePresence>,
    document.body,
  );
}

function CreateGroupDrawerBody({
  siteId,
  allItems,
  onClose,
  onSave,
}: {
  siteId: string;
  allItems: StockItem[];
  onClose: () => void;
  onSave: (group: ItemGroup) => void;
}) {
  const [name, setName] = useState('');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());

  // Items the operator can pick from, narrowed by the search box.
  // Match against name + variant + supplier so common patterns
  // ("milk", "kg") all work; case-insensitive.
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return allItems;
    return allItems.filter(item => {
      const hay = `${item.name} ${item.variant ?? ''} ${item.supplierName}`.toLowerCase();
      return hay.includes(q);
    });
  }, [allItems, search]);

  const canSave = name.trim().length > 0 && selected.size > 0;

  function toggleItem(id: string) {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function handleSave() {
    if (!canSave) return;
    // Site-scoped id with a millisecond stamp keeps these unique
    // within a session without needing a uuid lib.
    const id = `${siteId}-grp-user-${Date.now()}`;
    onSave({ id, name: name.trim(), itemIds: Array.from(selected) });
  }

  return (
    <>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.15 }}
        onClick={onClose}
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0, 28, 53,0.18)',
          zIndex: 700,
        }}
      />
      <motion.aside
        initial={{ x: '100%' }}
        animate={{ x: 0 }}
        exit={{ x: '100%' }}
        transition={{ duration: 0.22, ease: [0.25, 0.1, 0.25, 1] }}
        role="dialog"
        aria-label="New item group"
        style={{
          position: 'fixed',
          top: 0,
          right: 0,
          bottom: 0,
          width: 'min(480px, 100vw)',
          background: '#fff',
          boxShadow: '-20px 0 60px rgba(0, 28, 53,0.16)',
          zIndex: 701,
          display: 'flex',
          flexDirection: 'column',
          fontFamily: 'var(--font-primary)',
        }}
      >
        {/* Header — title + close. Matches the ItemDetailDrawer
            header rhythm (subtle bottom border, leading close icon). */}
        <div
          style={{
            padding: '14px 18px',
            borderBottom: '1px solid var(--color-border-subtle)',
            display: 'flex',
            alignItems: 'center',
            gap: 10,
          }}
        >
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            style={{
              width: 32,
              height: 32,
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'transparent',
              border: '1px solid var(--color-border-subtle)',
              borderRadius: 8,
              cursor: 'pointer',
              color: 'var(--color-text-secondary)',
              flexShrink: 0,
            }}
          >
            <X size={16} />
          </button>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              style={{
                fontSize: 17,
                fontWeight: 700,
                color: 'var(--color-text-primary)',
              }}
            >
              New group
            </div>
            <div
              style={{
                fontSize: 12,
                color: 'var(--color-text-muted)',
                marginTop: 2,
              }}
            >
              Pick the items you want to count together
            </div>
          </div>
        </div>

        {/* Body — scrolls independently of the header/footer so a
            long item list never pushes the controls out of reach. */}
        <div
          style={{
            flex: 1,
            minHeight: 0,
            display: 'flex',
            flexDirection: 'column',
            gap: 12,
            padding: 18,
            overflowY: 'auto',
          }}
        >
          <input
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="Group name (e.g. Bar essentials)"
            autoFocus
            style={{
              minHeight: 40,
              padding: '10px 12px',
              background: '#fff',
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius-item)',
              fontFamily: 'var(--font-primary)',
              fontSize: 14,
              color: 'var(--color-text-primary)',
            }}
          />

          <div
            style={{
              position: 'relative',
              display: 'flex',
              alignItems: 'center',
            }}
          >
            <Search
              size={14}
              color="var(--color-text-secondary)"
              style={{ position: 'absolute', left: 10, pointerEvents: 'none' }}
            />
            <input
              type="search"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Find items by name, variant or supplier"
              style={{
                width: '100%',
                minHeight: 36,
                padding: '8px 12px 8px 32px',
                background: '#fff',
                border: '1px solid var(--color-border)',
                borderRadius: 'var(--radius-item)',
                fontFamily: 'var(--font-primary)',
                fontSize: 13,
                color: 'var(--color-text-primary)',
              }}
            />
          </div>

          <div
            role="list"
            style={{
              display: 'flex',
              flexDirection: 'column',
              flex: 1,
              minHeight: 0,
              overflowY: 'auto',
              background: '#fff',
              border: '1px solid var(--color-border-subtle)',
              borderRadius: 'var(--radius-item)',
            }}
          >
            {filtered.length === 0 && (
              <div
                style={{
                  padding: 14,
                  textAlign: 'center',
                  color: 'var(--color-text-secondary)',
                  fontSize: 12,
                }}
              >
                No items match.
              </div>
            )}
            {filtered.map((item, idx) => {
              const isOn = selected.has(item.id);
              return (
                <button
                  key={item.id}
                  type="button"
                  role="listitem"
                  onClick={() => toggleItem(item.id)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    padding: '10px 12px',
                    background: 'transparent',
                    border: 'none',
                    borderTop:
                      idx === 0
                        ? 'none'
                        : '1px solid var(--color-border-subtle)',
                    textAlign: 'left',
                    cursor: 'pointer',
                    fontFamily: 'var(--font-primary)',
                  }}
                >
                  <span
                    aria-hidden
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      width: 18,
                      height: 18,
                      borderRadius: 4,
                      border: isOn
                        ? '1px solid var(--color-accent-active)'
                        : '1px solid var(--color-border)',
                      background: isOn ? 'var(--color-accent-active)' : '#fff',
                      flexShrink: 0,
                    }}
                  >
                    {isOn && <Check size={12} color="#fff" strokeWidth={3} />}
                  </span>
                  <span
                    style={{
                      flex: 1,
                      minWidth: 0,
                      fontSize: 13,
                      color: 'var(--color-text-primary)',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {item.name}
                    {item.variant && (
                      <span
                        style={{
                          color: 'var(--color-text-secondary)',
                          fontWeight: 400,
                          marginLeft: 6,
                        }}
                      >
                        {item.variant}
                      </span>
                    )}
                  </span>
                  <span
                    style={{
                      fontSize: 11,
                      color: 'var(--color-text-secondary)',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {item.category}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Sticky footer — selection counter + save/cancel CTAs.
            Stays visible while the body scrolls so the primary action
            is always one tap away. */}
        <div
          style={{
            padding: '14px 18px',
            borderTop: '1px solid var(--color-border-subtle)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 8,
            flexWrap: 'wrap',
            background: '#fff',
          }}
        >
          <span
            style={{
              fontSize: 12,
              color: 'var(--color-text-secondary)',
            }}
          >
            {selected.size} {selected.size === 1 ? 'item' : 'items'} selected
          </span>
          <div style={{ display: 'inline-flex', gap: 8 }}>
            <button
              type="button"
              onClick={onClose}
              style={{
                padding: '10px 16px',
                minHeight: 40,
                borderRadius: 'var(--radius-item)',
                border: '1px solid var(--color-border)',
                background: '#fff',
                color: 'var(--color-text-secondary)',
                fontFamily: 'var(--font-primary)',
                fontSize: 13,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={!canSave}
              style={{
                padding: '10px 16px',
                minHeight: 40,
                borderRadius: 'var(--radius-item)',
                border: '1px solid var(--color-accent-active)',
                background: canSave ? 'var(--color-accent-active)' : '#fff',
                color: canSave
                  ? 'var(--color-text-on-active)'
                  : 'var(--color-text-secondary)',
                fontFamily: 'var(--font-primary)',
                fontSize: 13,
                fontWeight: 600,
                cursor: canSave ? 'pointer' : 'not-allowed',
                opacity: canSave ? 1 : 0.6,
              }}
            >
              Save group
            </button>
          </div>
        </div>
      </motion.aside>
    </>
  );
}

// ─── Scope buttons ───────────────────────────────────────────────────────────

/** Compact scope button used in the three-up row above the past-count
 *  table. Mobile-first: 36px+ touch target, icon on the left, optional
 *  count badge on the right. `active` paints the tone-coloured outline
 *  treatment used by the Area button when its picker is expanded. */
function ScopeButton({
  icon,
  tone,
  label,
  count,
  active,
  disabled,
  disabledHint,
  onClick,
}: {
  icon: React.ReactNode;
  tone: string;
  label: string;
  count?: number;
  active?: boolean;
  disabled?: boolean;
  disabledHint?: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={disabled ? undefined : onClick}
      title={disabled ? disabledHint : undefined}
      aria-disabled={disabled}
      aria-pressed={active}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 8,
        minHeight: 36,
        padding: '8px 14px',
        background: active ? `${tone}10` : '#fff',
        border: active
          ? `1px solid ${tone}`
          : '1px solid var(--color-border)',
        borderRadius: 'var(--radius-item)',
        color: 'var(--color-text-primary)',
        fontFamily: 'var(--font-primary)',
        fontSize: 13,
        fontWeight: 600,
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.5 : 1,
        whiteSpace: 'nowrap',
      }}
    >
      <span style={{ display: 'inline-flex', color: tone }}>{icon}</span>
      {label}
      {count !== undefined && (
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            minWidth: 20,
            padding: '0 6px',
            height: 18,
            borderRadius: 9,
            background: 'var(--color-bg-hover)',
            color: 'var(--color-text-secondary)',
            fontSize: 11,
            fontWeight: 700,
          }}
        >
          {count}
        </span>
      )}
    </button>
  );
}
