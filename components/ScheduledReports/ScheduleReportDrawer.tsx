'use client';

/**
 * Schedule-report drawer — the light 80% path.
 *
 * Opened from a card's Email button with that insight pre-selected, or
 * from the governance page (new digest / edit). The central control is
 * the "Send once / Schedule" toggle: send once is just recipients +
 * format; schedule saves a ScheduledReport the owner can find later on
 * /scheduled-reports.
 *
 * Contents aren't limited to the view the drawer was opened from: the
 * picker offers every dashboard and template insight, grouped by view.
 * Site scope and data window are selectable; windows stay relative and
 * resolve at send time, and send times anchor to the site's timezone —
 * not the creator's.
 */

import { useMemo, useState } from 'react';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { CalendarClock, Check, ChevronDown, ChevronRight, FileSpreadsheet, FileText, Globe2, Send, X } from 'lucide-react';
import DrawerShell from './DrawerShell';
import { DATA_WINDOW_OPTIONS, INSIGHT_CATALOG, SITE_OPTIONS, type InsightGroup } from './insightCatalog';
import {
  cadenceLabel,
  genReportId,
  useScheduledReports,
  type ReportCadence,
  type ReportFormat,
  type ScheduledReport,
} from './scheduledReportsStore';

const NAVY = '#001C35';
const OK_TEXT = '#166534';

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const;

const CURRENT_USER = 'Nina McKenzie';

const CUSTOM_WINDOW = '__custom__';

function formatRangeDate(iso: string): string {
  return new Date(`${iso}T00:00:00`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

const selectStyle: React.CSSProperties = {
  width: '100%',
  border: '1px solid var(--color-border-subtle)',
  borderRadius: 10,
  padding: '9px 10px',
  fontSize: 12.5,
  fontFamily: 'inherit',
  outline: 'none',
  background: '#fff',
  color: 'var(--color-text-primary)',
  boxSizing: 'border-box',
};

export type ScheduleReportDrawerProps = {
  open: boolean;
  onClose: () => void;
  /** Insight the drawer was opened from — pre-ticked. Omit for "new digest". */
  initialInsight?: string;
  /** Pre-tick several insights at once (dashboard-level email: the whole
   *  dashboard's contents). Takes precedence over initialInsight. */
  initialSelection?: string[];
  /** Other insights on the same view, offered as "include more". */
  siblingInsights?: string[];
  /** Site the report locks to (v1: the site it was created from). */
  siteLabel: string;
  siteTimezone?: string;
  /** Relative window resolved at send time, e.g. "Last complete week as of send date". */
  dataWindowLabel?: string;
  /** When set, the drawer edits this existing report instead of creating one. */
  editingReport?: ScheduledReport | null;
  /** Which side of the send-once/schedule toggle a fresh drawer opens on. */
  defaultMode?: 'once' | 'schedule';
};

export default function ScheduleReportDrawer({
  open,
  onClose,
  initialInsight,
  initialSelection,
  siblingInsights = [],
  siteLabel,
  siteTimezone = 'Europe/London',
  dataWindowLabel = 'Last complete week as of send date',
  editingReport = null,
  defaultMode = 'once',
}: ScheduleReportDrawerProps) {
  const { saveReport } = useScheduledReports();

  const [mode, setMode] = useState<'once' | 'schedule'>('once');
  const [recipients, setRecipients] = useState<string[]>([]);
  const [recipientDraft, setRecipientDraft] = useState('');
  const [format, setFormat] = useState<ReportFormat>('pdf');
  const [selected, setSelected] = useState<string[]>([]);
  const [cadence, setCadence] = useState<ReportCadence>({ kind: 'weekly', day: 'Mon' });
  const [sendTime, setSendTime] = useState('07:00');
  const [name, setName] = useState('');
  const [siteScope, setSiteScope] = useState(siteLabel);
  // Date range: either one of the rolling presets, or CUSTOM_WINDOW with
  // explicit from/to dates. customFallback preserves a saved custom label
  // when editing a report whose exact dates we can't recover.
  const [windowChoice, setWindowChoice] = useState(dataWindowLabel);
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [customFallback, setCustomFallback] = useState('');
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});
  const [confirmation, setConfirmation] = useState<'sent' | 'saved' | null>(null);

  // Contents picker groups: a "This view" group for insights that only
  // exist on the opening view (e.g. user-built tables), then the full
  // catalogue of dashboard and template insights. Edit mode appends any
  // saved contents that no longer match a known insight.
  const groups = useMemo<InsightGroup[]>(() => {
    const catalogTitles = new Set(INSIGHT_CATALOG.flatMap((g) => g.insights));
    const seedTitles = [
      ...(initialInsight ? [initialInsight] : []),
      ...(initialSelection ?? []),
      ...siblingInsights,
    ];
    const thisViewTitles = [...new Set(seedTitles)].filter((t) => !catalogTitles.has(t));
    const known = new Set([...catalogTitles, ...thisViewTitles]);
    const orphaned = (editingReport?.contents ?? []).filter((c) => !known.has(c));
    return [
      ...(thisViewTitles.length > 0 ? [{ id: 'this-view', label: 'This view', insights: thisViewTitles }] : []),
      ...INSIGHT_CATALOG,
      ...(orphaned.length > 0 ? [{ id: 'other', label: 'Other', insights: orphaned }] : []),
    ];
  }, [initialInsight, initialSelection, siblingInsights, editingReport]);

  /** Groups to expand when the drawer opens: wherever something is ticked. */
  function initialExpansion(ticked: string[]): Record<string, boolean> {
    const catalogTitles = new Set(INSIGHT_CATALOG.flatMap((g) => g.insights));
    const next: Record<string, boolean> = {};
    for (const g of INSIGHT_CATALOG) {
      if (g.insights.some((t) => ticked.includes(t))) next[g.id] = true;
    }
    if (ticked.some((t) => !catalogTitles.has(t))) {
      next['this-view'] = true;
      next['other'] = true;
    }
    return next;
  }

  // Reset per open — prefilled from the editing report or the source insight.
  // Done during render (React's "adjusting state when props change" pattern)
  // rather than in an effect, so there's no stale-content flash.
  const sessionKey = open
    ? `${editingReport?.id ?? 'new'}:${initialInsight ?? ''}:${(initialSelection ?? []).join('|')}`
    : null;
  const [prevSessionKey, setPrevSessionKey] = useState<string | null>(null);
  if (sessionKey !== prevSessionKey) {
    setPrevSessionKey(sessionKey);
    if (sessionKey !== null) {
      setConfirmation(null);
      setRecipientDraft('');
      if (editingReport) {
        setMode('schedule');
        setRecipients(editingReport.recipients);
        setFormat(editingReport.format);
        setSelected(editingReport.contents);
        setCadence(editingReport.cadence);
        setSendTime(editingReport.sendTime);
        setName(editingReport.name);
        setSiteScope(editingReport.siteScope);
        if (DATA_WINDOW_OPTIONS.includes(editingReport.dataWindow)) {
          setWindowChoice(editingReport.dataWindow);
          setCustomFallback('');
        } else {
          setWindowChoice(CUSTOM_WINDOW);
          setCustomFallback(editingReport.dataWindow);
        }
        setCustomFrom('');
        setCustomTo('');
        setExpandedGroups(initialExpansion(editingReport.contents));
      } else {
        const ticked = initialSelection ?? (initialInsight ? [initialInsight] : []);
        setMode(defaultMode);
        setRecipients([]);
        setFormat('pdf');
        setSelected(ticked);
        setCadence({ kind: 'weekly', day: 'Mon' });
        setSendTime('07:00');
        setName('');
        setSiteScope(siteLabel);
        setWindowChoice(dataWindowLabel);
        setCustomFrom('');
        setCustomTo('');
        setCustomFallback('');
        setExpandedGroups(initialExpansion(ticked));
      }
    }
  }

  const autoName = useMemo(() => {
    if (selected.length === 0) return 'Untitled report';
    if (selected.length === 1) return selected[0];
    return `${selected[0]} + ${selected.length - 1} more`;
  }, [selected]);

  function addRecipient() {
    const email = recipientDraft.trim().replace(/,$/, '');
    if (!email || !email.includes('@')) return;
    if (!recipients.includes(email)) setRecipients((prev) => [...prev, email]);
    setRecipientDraft('');
  }

  function toggleInsight(title: string) {
    setSelected((prev) => (prev.includes(title) ? prev.filter((t) => t !== title) : [...prev, title]));
  }

  // The label saved onto the report. A custom range renders as fixed
  // dates; presets stay as their rolling label.
  const effectiveDataWindow =
    windowChoice === CUSTOM_WINDOW
      ? customFrom && customTo
        ? `${formatRangeDate(customFrom)} – ${formatRangeDate(customTo)} (fixed range)`
        : customFallback
      : windowChoice;

  const canSubmit = recipients.length > 0 && selected.length > 0 && effectiveDataWindow !== '';

  // Mock email preview for the current selection, opened in a new tab.
  const previewHref = useMemo(() => {
    const qs = new URLSearchParams({
      insights: selected.join('|'),
      name: name.trim() || autoName,
      site: siteScope,
      window: effectiveDataWindow,
      to: recipients.join(','),
      format,
      owner: editingReport?.owner ?? CURRENT_USER,
      ...(mode === 'schedule' ? { cadence: `${cadenceLabel(cadence)} at ${sendTime}` } : {}),
    });
    return `/email-preview?${qs.toString()}`;
  }, [selected, name, autoName, siteScope, effectiveDataWindow, recipients, format, mode, cadence, sendTime, editingReport]);

  function handleSubmit() {
    if (!canSubmit) return;
    if (mode === 'once') {
      setConfirmation('sent');
      window.setTimeout(onClose, 1400);
      return;
    }
    const report: ScheduledReport = {
      id: editingReport?.id ?? genReportId(),
      name: name.trim() || autoName,
      contents: selected,
      recipients,
      format,
      cadence,
      sendTime,
      siteScope,
      dataWindow: effectiveDataWindow,
      owner: editingReport?.owner ?? CURRENT_USER,
      active: editingReport ? editingReport.active : true,
      pausedReason: editingReport?.pausedReason,
      lastSentLabel: editingReport?.lastSentLabel ?? 'Not sent yet',
    };
    saveReport(report);
    setConfirmation('saved');
    window.setTimeout(onClose, 1400);
  }

  return (
    <DrawerShell
      open={open}
      onClose={onClose}
      title={editingReport ? `Edit report: ${editingReport.name}` : 'Email this report'}
      subtitle={editingReport ? undefined : initialInsight}
      width={460}
      footer={
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Link
            href="/scheduled-reports"
            style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-text-secondary)', textDecoration: 'none' }}
          >
            Manage scheduled reports →
          </Link>
          {selected.length > 0 && (
            <a
              href={previewHref}
              target="_blank"
              rel="noreferrer"
              style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-text-secondary)', textDecoration: 'none' }}
            >
              Preview email ↗
            </a>
          )}
          <button
            onClick={handleSubmit}
            disabled={!canSubmit || confirmation !== null}
            style={{
              marginLeft: 'auto',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '9px 16px',
              borderRadius: 10,
              border: 'none',
              background: canSubmit && !confirmation ? NAVY : 'var(--color-border-subtle)',
              color: '#fff',
              fontSize: 12.5,
              fontWeight: 700,
              cursor: canSubmit && !confirmation ? 'pointer' : 'default',
              fontFamily: 'inherit',
            }}
          >
            {confirmation === 'sent' ? (
              <>
                <Check size={14} strokeWidth={2.6} /> Sent
              </>
            ) : confirmation === 'saved' ? (
              <>
                <Check size={14} strokeWidth={2.6} /> Schedule saved
              </>
            ) : mode === 'once' ? (
              <>
                <Send size={13} strokeWidth={2.2} /> Send now
              </>
            ) : (
              <>
                <CalendarClock size={13} strokeWidth={2.2} /> Save schedule
              </>
            )}
          </button>
        </div>
      }
    >
      <div style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 16 }}>
        {/* Send once / Schedule toggle — the central control. Same pill
            tablist as the site-wide filter tabs (e.g. StocktakeList). */}
        {!editingReport && (
          <div
            role="tablist"
            aria-label="Send once or schedule"
            style={{
              display: 'flex',
              alignItems: 'stretch',
              background: 'var(--color-bg-hover)',
              borderRadius: 100,
              padding: 3,
              minHeight: 44,
              width: 'fit-content',
            }}
          >
            {(['once', 'schedule'] as const).map((m) => {
              const active = mode === m;
              return (
                <button
                  key={m}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => setMode(m)}
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
                    background: active ? 'var(--color-accent-active)' : 'transparent',
                    color: active ? '#fff' : 'var(--color-text-secondary)',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {m === 'once' ? 'Send once' : 'Schedule'}
                </button>
              );
            })}
          </div>
        )}

        {/* Recipients */}
        <Field label="Recipients" hint="Recipients don't need an Edify login.">
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: 6,
              padding: 8,
              border: '1px solid var(--color-border-subtle)',
              borderRadius: 10,
            }}
          >
            {recipients.map((r) => (
              <span
                key={r}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 5,
                  padding: '4px 8px',
                  borderRadius: 999,
                  background: 'var(--color-bg-surface, #F5F6F8)',
                  fontSize: 11.5,
                  fontWeight: 600,
                  color: 'var(--color-text-primary)',
                }}
              >
                {r}
                <button
                  onClick={() => setRecipients((prev) => prev.filter((x) => x !== r))}
                  aria-label={`Remove ${r}`}
                  style={{ border: 'none', background: 'transparent', cursor: 'pointer', padding: 0, display: 'inline-flex', color: 'var(--color-text-muted)' }}
                >
                  <X size={11} strokeWidth={2.4} />
                </button>
              </span>
            ))}
            <input
              value={recipientDraft}
              onChange={(e) => setRecipientDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ',') {
                  e.preventDefault();
                  addRecipient();
                }
              }}
              onBlur={addRecipient}
              placeholder={recipients.length === 0 ? 'name@company.com — press Enter' : 'Add another…'}
              style={{ flex: 1, minWidth: 140, border: 'none', outline: 'none', fontSize: 12.5, fontFamily: 'inherit', padding: '4px 2px' }}
            />
          </div>
        </Field>

        {/* Contents — grouped by view so a report can mix insights from
            the dashboards and any template, not just the view it was
            opened from. */}
        <Field label="Contents" hint="Mix insights from any view — they send as one report.">
          <div
            style={{
              border: '1px solid var(--color-border-subtle)',
              borderRadius: 10,
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            {groups.map((group, gi) => {
              const expanded = expandedGroups[group.id] ?? false;
              const tickedCount = group.insights.filter((t) => selected.includes(t)).length;
              return (
                <div key={group.id} style={{ borderTop: gi === 0 ? 'none' : '1px solid var(--color-border-subtle)' }}>
                  <button
                    type="button"
                    onClick={() => setExpandedGroups((prev) => ({ ...prev, [group.id]: !expanded }))}
                    aria-expanded={expanded}
                    style={{
                      width: '100%',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 7,
                      padding: '9px 10px',
                      border: 'none',
                      background: expanded ? 'var(--color-bg-surface, #FBFBFD)' : '#fff',
                      cursor: 'pointer',
                      fontFamily: 'inherit',
                      textAlign: 'left',
                    }}
                  >
                    {expanded ? (
                      <ChevronDown size={13} strokeWidth={2.4} color="var(--color-text-muted)" />
                    ) : (
                      <ChevronRight size={13} strokeWidth={2.4} color="var(--color-text-muted)" />
                    )}
                    <span style={{ flex: 1, minWidth: 0, fontSize: 12, fontWeight: 700, color: 'var(--color-text-primary)' }}>
                      {group.label}
                    </span>
                    {tickedCount > 0 && (
                      <span
                        style={{
                          fontSize: 10.5,
                          fontWeight: 700,
                          padding: '2px 8px',
                          borderRadius: 999,
                          background: NAVY,
                          color: '#fff',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {tickedCount} selected
                      </span>
                    )}
                  </button>
                  {expanded && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: '4px 10px 10px 30px' }}>
                      {group.insights.map((title) => (
                        <label
                          key={title}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 8,
                            fontSize: 12.5,
                            fontWeight: selected.includes(title) ? 600 : 500,
                            color: 'var(--color-text-primary)',
                            cursor: 'pointer',
                          }}
                        >
                          <input
                            type="checkbox"
                            checked={selected.includes(title)}
                            onChange={() => toggleInsight(title)}
                            style={{ accentColor: NAVY }}
                          />
                          {title}
                        </label>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </Field>

        {/* Format — follows content, constrained */}
        <Field label="Format">
          <div style={{ display: 'flex', gap: 8 }}>
            <FormatOption
              icon={<FileText size={14} strokeWidth={2} />}
              label="PDF"
              caption="Rendered snapshot — handles charts"
              selected={format === 'pdf'}
              onClick={() => setFormat('pdf')}
            />
            <FormatOption
              icon={<FileSpreadsheet size={14} strokeWidth={2} />}
              label="CSV"
              caption="Data only, per insight"
              selected={format === 'csv'}
              onClick={() => setFormat('csv')}
            />
          </div>
          {format === 'csv' && (
            <p style={{ margin: '8px 0 0', fontSize: 11.5, color: 'var(--color-text-muted)', lineHeight: 1.5 }}>
              Charts export as their underlying tables. Multi-insight reports send one clearly-named CSV per insight.
            </p>
          )}
        </Field>

        {/* Site scope + data window — selectable */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: 170 }}>
              <Field label="Sites">
                <select value={siteScope} onChange={(e) => setSiteScope(e.target.value)} style={selectStyle}>
                  {(SITE_OPTIONS.includes(siteScope) ? SITE_OPTIONS : [siteScope, ...SITE_OPTIONS]).map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </Field>
            </div>
            <div style={{ flex: 1.4, minWidth: 210 }}>
              <Field
                label="Date range"
                hint={
                  windowChoice === CUSTOM_WINDOW
                    ? 'Fixed — this exact range sends every time.'
                    : 'Rolling — resolves at send date, not the fixed range pinned on the dashboard.'
                }
              >
                <select
                  value={windowChoice}
                  onChange={(e) => setWindowChoice(e.target.value)}
                  style={selectStyle}
                >
                  {DATA_WINDOW_OPTIONS.map((w) => (
                    <option key={w} value={w}>{w}</option>
                  ))}
                  <option value={CUSTOM_WINDOW}>Custom range…</option>
                </select>
              </Field>
            </div>
          </div>
          {/* Custom dates get their own full-width row — two native date
              inputs don't fit inside the half-width column above. */}
          {windowChoice === CUSTOM_WINDOW && (
            <div style={{ display: 'flex', gap: 10 }}>
              <label style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 4 }}>
                <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-text-muted)' }}>From</span>
                <input
                  type="date"
                  value={customFrom}
                  max={customTo || undefined}
                  onChange={(e) => setCustomFrom(e.target.value)}
                  style={{ ...selectStyle, minWidth: 0 }}
                />
              </label>
              <label style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 4 }}>
                <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-text-muted)' }}>To</span>
                <input
                  type="date"
                  value={customTo}
                  min={customFrom || undefined}
                  onChange={(e) => setCustomTo(e.target.value)}
                  style={{ ...selectStyle, minWidth: 0 }}
                />
              </label>
            </div>
          )}
        </div>

        {/* Schedule fields */}
        {mode === 'schedule' && (
          <>
            <Field label="Report name">
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={autoName}
                style={{
                  width: '100%',
                  border: '1px solid var(--color-border-subtle)',
                  borderRadius: 10,
                  padding: '9px 12px',
                  fontSize: 12.5,
                  fontFamily: 'inherit',
                  outline: 'none',
                  boxSizing: 'border-box',
                }}
              />
            </Field>

            <Field label="Cadence">
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {(['daily', 'weekly', 'period-end'] as const).map((kind) => {
                  const isSelected = cadence.kind === kind;
                  return (
                    <button
                      key={kind}
                      onClick={() =>
                        setCadence(kind === 'weekly' ? { kind: 'weekly', day: 'Mon' } : { kind })
                      }
                      aria-pressed={isSelected}
                      style={{
                        padding: '6px 12px',
                        borderRadius: 999,
                        border: `1px solid ${isSelected ? NAVY : 'var(--color-border-subtle)'}`,
                        background: isSelected ? NAVY : '#fff',
                        color: isSelected ? '#fff' : 'var(--color-text-secondary)',
                        fontSize: 12,
                        fontWeight: 700,
                        cursor: 'pointer',
                        fontFamily: 'inherit',
                      }}
                    >
                      {kind === 'daily' ? 'Daily' : kind === 'weekly' ? 'Weekly' : 'Period end'}
                    </button>
                  );
                })}
              </div>
              {cadence.kind === 'weekly' && (
                <div style={{ display: 'flex', gap: 4, marginTop: 8, flexWrap: 'wrap' }}>
                  {WEEKDAYS.map((d) => {
                    const isSelected = cadence.kind === 'weekly' && cadence.day === d;
                    return (
                      <button
                        key={d}
                        onClick={() => setCadence({ kind: 'weekly', day: d })}
                        aria-pressed={isSelected}
                        style={{
                          width: 38,
                          padding: '5px 0',
                          borderRadius: 8,
                          border: `1px solid ${isSelected ? NAVY : 'var(--color-border-subtle)'}`,
                          background: isSelected ? NAVY : '#fff',
                          color: isSelected ? '#fff' : 'var(--color-text-secondary)',
                          fontSize: 11.5,
                          fontWeight: 700,
                          cursor: 'pointer',
                          fontFamily: 'inherit',
                        }}
                      >
                        {d}
                      </button>
                    );
                  })}
                </div>
              )}
            </Field>

            <Field label="Send time">
              <input
                type="time"
                value={sendTime}
                onChange={(e) => setSendTime(e.target.value)}
                style={{
                  border: '1px solid var(--color-border-subtle)',
                  borderRadius: 10,
                  padding: '8px 12px',
                  fontSize: 12.5,
                  fontFamily: 'inherit',
                  outline: 'none',
                }}
              />
            </Field>
          </>
        )}

        {/* Fine print — the one constraint that isn't a choice. */}
        {mode === 'schedule' && (
          <div style={{ borderTop: '1px solid var(--color-border-subtle)', paddingTop: 12 }}>
            <ContextRow icon={<Globe2 size={12} strokeWidth={2.2} />}>
              Sends at {sendTime} site time ({siteTimezone}) — the site&rsquo;s timezone, not yours.
            </ContextRow>
          </div>
        )}

        {confirmation && (
          <div style={{ fontSize: 12.5, fontWeight: 700, color: OK_TEXT }}>
            {confirmation === 'sent'
              ? `Sent to ${recipients.length} recipient${recipients.length === 1 ? '' : 's'}.`
              : `Saved — ${cadenceLabel(cadence)} at ${sendTime}. Find it under Scheduled reports.`}
          </div>
        )}
      </div>
    </DrawerShell>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <div>
      <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--color-text-muted)', marginBottom: 6 }}>
        {label}
      </div>
      {children}
      {hint && <p style={{ margin: '6px 0 0', fontSize: 11, color: 'var(--color-text-muted)' }}>{hint}</p>}
    </div>
  );
}

function FormatOption({
  icon,
  label,
  caption,
  selected,
  onClick,
}: {
  icon: ReactNode;
  label: string;
  caption: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      aria-pressed={selected}
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-start',
        gap: 3,
        padding: '10px 12px',
        borderRadius: 10,
        border: `1px solid ${selected ? NAVY : 'var(--color-border-subtle)'}`,
        background: selected ? 'rgba(0,28,53,0.05)' : '#fff',
        cursor: 'pointer',
        fontFamily: 'inherit',
        textAlign: 'left',
      }}
    >
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12.5, fontWeight: 700, color: 'var(--color-text-primary)' }}>
        {icon}
        {label}
      </span>
      <span style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>{caption}</span>
    </button>
  );
}

function ContextRow({ icon, children }: { icon: ReactNode; children: ReactNode }) {
  return (
    <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start', fontSize: 11.5, color: 'var(--color-text-muted)', lineHeight: 1.45 }}>
      <span style={{ marginTop: 1, flexShrink: 0 }}>{icon}</span>
      <span>{children}</span>
    </div>
  );
}
