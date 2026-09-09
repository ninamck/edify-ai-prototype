'use client';

/**
 * Site setup · step 1 — the sites, read from the operator's sheet.
 *
 * Sites are not held in Workday, so the property/ops team sends a
 * spreadsheet with one row per new shop. Edify parses it and shows
 * every Create-site field (Settings → Sites in Edify main) already
 * filled in: name, site code, profit centre, address, opening date,
 * delivery windows, delivery contact, notes, forward emails. All of it
 * stays editable here, so a wrong cell on the sheet is fixed in the
 * card, not abandoned.
 *
 * Three layers, matching how sure we can be:
 *  - one row per shop, ticked to include it, with a one-line read-out;
 *  - tap a row to open the full form for that shop. Blank cells the
 *    sheet left are marked "Not on the sheet". Required fields (as the
 *    Create site form marks them) block Continue until filled;
 *  - "Settings the sheet doesn't carry": the handful of form fields no
 *    property sheet has (timezone, delivery reference, theoretical on
 *    hand, traceability tags). Assumed once for the batch, each with a
 *    one-line why, editable before continue.
 */

import { useState } from 'react';
import { AlertTriangle, ChevronDown, ChevronRight, FileSpreadsheet, MapPin, CalendarDays, Phone } from 'lucide-react';
import CardShell, { type CardState } from './CardShell';
import { RangePill, WindowEditor } from './timeControls';
import {
  DAY_KEYS,
  DEFAULT_SHARED_SITE_SETTINGS,
  NEW_SITES,
  describeDeliveryWindows,
  missingRequired,
  sheetDetailsFor,
  sheetGaps,
  type DayKey,
  type SharedSiteSettings,
  type SiteDetails,
  type TimeWindow,
} from '../siteSetupFixtures';

export interface SiteSheetSubmit {
  siteIds: string[];
  sites: Record<string, SiteDetails>;
  shared: SharedSiteSettings;
}

interface SiteSetupSheetSitesCardProps {
  state: CardState;
  /** The sheet we read the rows from — shown as provenance. */
  fileName: string;
  /** From "three new sites": how many rows to tick by default. */
  requestedCount?: number;
  initialSiteIds?: string[];
  initialSites?: Record<string, SiteDetails>;
  initialShared?: SharedSiteSettings;
  onSubmit: (input: SiteSheetSubmit) => void;
  onCancel: () => void;
  /** Reopen for edits after confirm — available until final go-live. */
  onEdit?: () => void;
}

const DEFAULT_WINDOW: TimeWindow = { start: '06:00', end: '08:30' };

export default function SiteSetupSheetSitesCard({
  state,
  fileName,
  requestedCount,
  initialSiteIds,
  initialSites,
  initialShared,
  onSubmit,
  onCancel,
  onEdit,
}: SiteSetupSheetSitesCardProps) {
  const disabled = state !== 'pending';

  // Rows on the sheet are already in opening-date order, so "the
  // three opening soonest" is the first three.
  const [included, setIncluded] = useState<Set<string>>(() => {
    if (initialSiteIds) return new Set(initialSiteIds);
    const ids = NEW_SITES.map((s) => s.id);
    return new Set(requestedCount ? ids.slice(0, Math.min(requestedCount, ids.length)) : ids);
  });
  const [details, setDetails] = useState<Record<string, SiteDetails>>(() => {
    const map: Record<string, SiteDetails> = {};
    for (const s of NEW_SITES) map[s.id] = initialSites?.[s.id] ?? sheetDetailsFor(s);
    return map;
  });
  const [shared, setShared] = useState<SharedSiteSettings>(() => ({
    ...DEFAULT_SHARED_SITE_SETTINGS,
    ...(initialShared ?? {}),
  }));
  const [openId, setOpenId] = useState<string | null>(null);
  const [windowDay, setWindowDay] = useState<DayKey | null>(null);
  const [sharedOpen, setSharedOpen] = useState(false);

  const includedIds = NEW_SITES.map((s) => s.id).filter((id) => included.has(id));
  const blockers = includedIds
    .map((id) => ({ id, missing: missingRequired(details[id]) }))
    .filter((b) => b.missing.length > 0);
  const canContinue = includedIds.length > 0 && blockers.length === 0;

  const warning =
    blockers.length > 0
      ? `${details[blockers[0].id].name || 'One shop'} needs ${blockers[0].missing.join(', ').toLowerCase()} before I can create it.`
      : includedIds.length === 0
        ? 'Tick at least one shop to continue.'
        : undefined;

  function patch(id: string, change: Partial<SiteDetails>) {
    setDetails((prev) => ({ ...prev, [id]: { ...prev[id], ...change } }));
  }
  function patchContact(id: string, change: Partial<SiteDetails['deliveryContact']>) {
    setDetails((prev) => ({
      ...prev,
      [id]: { ...prev[id], deliveryContact: { ...prev[id].deliveryContact, ...change } },
    }));
  }
  function setWindow(id: string, day: DayKey, win: TimeWindow | null) {
    setDetails((prev) => ({
      ...prev,
      [id]: { ...prev[id], deliveryWindows: { ...prev[id].deliveryWindows, [day]: win } },
    }));
  }
  function toggleIncluded(id: string) {
    setIncluded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  const total = NEW_SITES.length;
  const title = requestedCount && requestedCount < total
    ? `Which ${requestedCount} of the ${total} shops?`
    : `${total} shops from your spreadsheet`;

  return (
    <CardShell
      icon={FileSpreadsheet}
      title={title}
      subtitle={`Read from ${fileName} · ${includedIds.length} ticked · tap a shop to check its details`}
      state={state}
      confirmLabel="Continue"
      confirmDisabled={!canContinue}
      warning={warning}
      onCancel={onCancel}
      onEdit={onEdit}
      onConfirm={() => {
        if (!canContinue) return;
        const sites: Record<string, SiteDetails> = {};
        for (const id of includedIds) sites[id] = details[id];
        onSubmit({ siteIds: includedIds, sites, shared });
      }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
        {NEW_SITES.map((site) => {
          const d = details[site.id];
          const isIn = included.has(site.id);
          const isOpen = openId === site.id;
          const missing = missingRequired(d);
          const gaps = sheetGaps(d);
          return (
            <div
              key={site.id}
              style={{
                borderRadius: '12px',
                border: isOpen
                  ? '1.5px solid var(--color-accent-active, #001C35)'
                  : '1.5px solid var(--color-border, rgba(0,28,53,0.14))',
                background: '#fff',
                opacity: isIn || isOpen ? 1 : 0.62,
                overflow: 'hidden',
              }}
            >
              {/* Row header: tick + read-out + gap marker + chevron */}
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', padding: '9px 10px 9px 12px' }}>
                <input
                  type="checkbox"
                  checked={isIn}
                  disabled={disabled}
                  onChange={() => toggleIncluded(site.id)}
                  aria-label={`Include ${d.name || site.shortName}`}
                  style={{ marginTop: '3px', accentColor: 'var(--color-accent-active, #001C35)', flexShrink: 0 }}
                />
                <button
                  type="button"
                  disabled={disabled && !isOpen}
                  onClick={() => {
                    setOpenId(isOpen ? null : site.id);
                    setWindowDay(null);
                  }}
                  aria-expanded={isOpen}
                  style={{
                    flex: 1,
                    minWidth: 0,
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '8px',
                    padding: 0,
                    border: 'none',
                    background: 'transparent',
                    textAlign: 'left',
                    cursor: disabled ? 'default' : 'pointer',
                    fontFamily: 'var(--font-primary)',
                  }}
                >
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                      <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--color-text-primary)' }}>
                        {d.name || <em style={{ fontWeight: 500, color: '#B45309' }}>No name on the sheet</em>}
                      </span>
                      {d.siteIdentifier && (
                        <span style={{ fontSize: '10.5px', fontWeight: 700, letterSpacing: '0.04em', color: 'var(--color-text-muted)' }}>
                          #{d.siteIdentifier}
                        </span>
                      )}
                      {(missing.length > 0 || gaps.length > 0) && (
                        <span
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '3px',
                            padding: '1px 7px',
                            borderRadius: '100px',
                            fontSize: '9.5px',
                            fontWeight: 700,
                            letterSpacing: '0.04em',
                            textTransform: 'uppercase',
                            background: missing.length > 0 ? '#FEF3E2' : 'rgba(0,28,53,0.05)',
                            color: missing.length > 0 ? '#7A3800' : 'var(--color-text-secondary)',
                          }}
                        >
                          {missing.length > 0 && <AlertTriangle size={9} strokeWidth={2.5} />}
                          {missing.length > 0
                            ? `${missing.length} required missing`
                            : `${gaps.length} blank on sheet`}
                        </span>
                      )}
                    </span>
                    <span
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '10px',
                        fontSize: '11px',
                        color: 'var(--color-text-muted)',
                        marginTop: '2px',
                        flexWrap: 'wrap',
                      }}
                    >
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', minWidth: 0 }}>
                        <MapPin size={10} style={{ flexShrink: 0 }} />
                        {[d.addressLine1, d.city, d.postcode].filter(Boolean).join(', ') || 'No address'}
                      </span>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', flexShrink: 0 }}>
                        <CalendarDays size={10} /> Opens {d.openingDate || '—'}
                      </span>
                      {d.deliveryContact.name && (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', flexShrink: 0 }}>
                          <Phone size={10} /> {d.deliveryContact.name}
                        </span>
                      )}
                    </span>
                  </span>
                  <ChevronDown
                    size={14}
                    color="var(--color-text-muted)"
                    style={{ flexShrink: 0, marginTop: '2px', transform: isOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.12s' }}
                  />
                </button>
              </div>

              {/* The Create-site form for this shop, pre-filled from the row */}
              {isOpen && (
                <div
                  style={{
                    padding: '10px 12px 12px',
                    borderTop: '1px solid var(--color-border-subtle, rgba(0,28,53,0.08))',
                    background: 'rgba(0,28,53,0.015)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '10px',
                  }}
                >
                  <Section>Basic information</Section>
                  <Field label="Site name" required value={d.name} disabled={disabled} onChange={(v) => patch(site.id, { name: v })} />
                  <div style={twoCol}>
                    <Field label="Site identifier" value={d.siteIdentifier} disabled={disabled} onChange={(v) => patch(site.id, { siteIdentifier: v })} />
                    <Field label="Profit centre" value={d.profitCentre} disabled={disabled} onChange={(v) => patch(site.id, { profitCentre: v })} />
                  </div>
                  <ToggleRow
                    label="Central Production Unit (CPU)"
                    hint={d.isCpu ? 'Makes for other shops. Other sites can order from it.' : 'A shop. Sheet says Type: Shop.'}
                    checked={d.isCpu}
                    disabled={disabled}
                    onChange={(v) => patch(site.id, { isCpu: v })}
                  />

                  <Section>Address</Section>
                  <Field label="Address line 1" required value={d.addressLine1} disabled={disabled} onChange={(v) => patch(site.id, { addressLine1: v })} />
                  <Field label="Address line 2" value={d.addressLine2} disabled={disabled} optionalBlank onChange={(v) => patch(site.id, { addressLine2: v })} />
                  <div style={twoCol}>
                    <Field label="City" required value={d.city} disabled={disabled} onChange={(v) => patch(site.id, { city: v })} />
                    <Field label="Postcode" required value={d.postcode} disabled={disabled} onChange={(v) => patch(site.id, { postcode: v })} />
                  </div>
                  <div style={twoCol}>
                    <Field label="Country" required value={d.country} disabled={disabled} onChange={(v) => patch(site.id, { country: v })} />
                    <Field label="Opening date" value={d.openingDate} disabled={disabled} onChange={(v) => patch(site.id, { openingDate: v })} />
                  </div>

                  <Section>Delivery time windows</Section>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    {DAY_KEYS.map((day) => {
                      const win = d.deliveryWindows[day];
                      const editing = windowDay === day;
                      return (
                        <div key={day} style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <label style={{ display: 'inline-flex', alignItems: 'center', gap: '7px', width: '96px', fontSize: '12px', fontWeight: 600, color: 'var(--color-text-primary)', cursor: disabled ? 'default' : 'pointer' }}>
                              <input
                                type="checkbox"
                                checked={win !== null}
                                disabled={disabled}
                                onChange={(e) => {
                                  setWindow(site.id, day, e.target.checked ? { ...DEFAULT_WINDOW } : null);
                                  if (!e.target.checked && windowDay === day) setWindowDay(null);
                                }}
                                style={{ accentColor: 'var(--color-accent-active, #001C35)' }}
                              />
                              {DAY_LABEL[day]}
                            </label>
                            {win ? (
                              <RangePill
                                text={`${win.start} – ${win.end}`}
                                open={editing}
                                disabled={disabled}
                                onClick={() => setWindowDay(editing ? null : day)}
                              />
                            ) : (
                              <span style={{ fontSize: '11.5px', color: 'var(--color-text-muted)' }}>No deliveries</span>
                            )}
                          </div>
                          {editing && win && (
                            <WindowEditor
                              window={win}
                              disabled={disabled}
                              onChange={(edge, value) => setWindow(site.id, day, { ...win, [edge]: value })}
                              onDone={() => setWindowDay(null)}
                            />
                          )}
                        </div>
                      );
                    })}
                  </div>
                  <Hint>{describeDeliveryWindows(d.deliveryWindows)}. Suppliers see these on the PO.</Hint>

                  <Section>Delivery contact</Section>
                  <div style={twoCol}>
                    <Field label="Name" value={d.deliveryContact.name} disabled={disabled} onChange={(v) => patchContact(site.id, { name: v })} />
                    <Field label="Position" value={d.deliveryContact.position} disabled={disabled} onChange={(v) => patchContact(site.id, { position: v })} />
                  </div>
                  <Field label="Phone" value={d.deliveryContact.phone} disabled={disabled} placeholder="+44" onChange={(v) => patchContact(site.id, { phone: v })} />

                  <Section>Delivery notes</Section>
                  <textarea
                    value={d.deliveryNotes}
                    disabled={disabled}
                    onChange={(e) => patch(site.id, { deliveryNotes: e.target.value })}
                    placeholder="Anything the driver needs to know"
                    rows={2}
                    style={{ ...inputStyle, marginTop: 0, resize: 'vertical', fontWeight: 500 }}
                  />

                  <Section>Forward emails</Section>
                  <Field
                    label="PO attachment copies go to"
                    value={d.forwardEmails.join(', ')}
                    disabled={disabled}
                    placeholder="email@example.com"
                    onChange={(v) =>
                      patch(site.id, {
                        forwardEmails: v.split(',').map((s) => s.trim()).filter(Boolean),
                      })
                    }
                  />
                </div>
              )}
            </div>
          );
        })}

        {/* ── Settings no property sheet carries. Assumed once for the
            batch; editable. ─────────────────────────────────────────── */}
        <div style={{ marginTop: '4px' }}>
          <button type="button" onClick={() => setSharedOpen((v) => !v)} style={disclosureBtn}>
            {sharedOpen ? <ChevronDown size={12} strokeWidth={2.4} /> : <ChevronRight size={12} strokeWidth={2.4} />}
            Settings the sheet doesn&rsquo;t carry · applied to all {includedIds.length}
          </button>
          {sharedOpen && (
            <div
              style={{
                marginTop: '8px',
                borderRadius: '10px',
                border: '1px solid var(--color-border-subtle, rgba(0,28,53,0.08))',
                overflow: 'hidden',
              }}
            >
              <AssumedRow label="Timezone" why="Every shop on the sheet is in the UK.">
                <input
                  type="text"
                  value={shared.timezone}
                  disabled={disabled}
                  onChange={(e) => setShared((p) => ({ ...p, timezone: e.target.value }))}
                  style={{ ...inputStyle, marginTop: 0, width: '150px', padding: '5px 9px', fontSize: '12px' }}
                />
              </AssumedRow>
              <AssumedRow label="Deliveries require reference" why="Off, like your other shops. Turn on if drivers must quote a PO number at the door.">
                <Switch checked={shared.deliveriesRequireReference} disabled={disabled} onChange={(v) => setShared((p) => ({ ...p, deliveriesRequireReference: v }))} />
              </AssumedRow>
              <AssumedRow label="Show theoretical on hand during stocktakes" why="Off for a blind count. New teams count more honestly without the expected number on the sheet.">
                <Switch checked={shared.showTheoreticalOnHand} disabled={disabled} onChange={(v) => setShared((p) => ({ ...p, showTheoreticalOnHand: v }))} />
              </AssumedRow>
              <AssumedRow label="Force printing traceability tags on delivery" why="Off. None of the copied shops print tags at the door.">
                <Switch checked={shared.forceTraceabilityTags} disabled={disabled} onChange={(v) => setShared((p) => ({ ...p, forceTraceabilityTags: v }))} />
              </AssumedRow>
            </div>
          )}
        </div>
      </div>
    </CardShell>
  );
}

// ─── Bits ────────────────────────────────────────────────────────────────────

const DAY_LABEL: Record<DayKey, string> = {
  Mon: 'Monday', Tue: 'Tuesday', Wed: 'Wednesday', Thu: 'Thursday', Fri: 'Friday', Sat: 'Saturday', Sun: 'Sunday',
};

const twoCol: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '1fr 1fr',
  gap: '8px',
};

const inputStyle: React.CSSProperties = {
  width: '100%',
  marginTop: '4px',
  padding: '8px 10px',
  borderRadius: '10px',
  border: '1.5px solid var(--color-border, rgba(0,28,53,0.18))',
  fontSize: '12.5px',
  fontWeight: 600,
  fontFamily: 'var(--font-primary)',
  color: 'var(--color-text-primary)',
  background: '#fff',
  outline: 'none',
  boxSizing: 'border-box',
};

const disclosureBtn: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: '6px',
  padding: '6px 12px',
  borderRadius: '100px',
  border: '1.5px solid var(--color-border, rgba(0,28,53,0.18))',
  background: '#fff',
  fontSize: '11px',
  fontWeight: 700,
  fontFamily: 'var(--font-primary)',
  color: 'var(--color-text-secondary)',
  letterSpacing: '0.03em',
  textTransform: 'uppercase',
  cursor: 'pointer',
};

function Section({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        marginTop: '2px',
        fontSize: '10px',
        fontWeight: 700,
        letterSpacing: '0.06em',
        textTransform: 'uppercase',
        color: 'var(--color-text-muted)',
      }}
    >
      {children}
      <span style={{ flex: 1, height: '1px', background: 'var(--color-border-subtle, rgba(0,28,53,0.08))' }} />
    </div>
  );
}

/**
 * One form field. Blank required fields flag amber; blank optional
 * fields the sheet is expected to carry show "Not on the sheet"
 * unless `optionalBlank` says a blank is normal (address line 2).
 */
function Field({
  label,
  value,
  onChange,
  disabled,
  required,
  optionalBlank,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  disabled: boolean;
  required?: boolean;
  optionalBlank?: boolean;
  placeholder?: string;
}) {
  const blank = value.trim() === '';
  const flagRequired = required && blank;
  const flagGap = !required && !optionalBlank && blank;
  return (
    <label style={{ display: 'block', minWidth: 0 }}>
      <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
        <span style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--color-text-secondary)' }}>
          {label}{required && <span aria-hidden style={{ color: '#B45309' }}> *</span>}
        </span>
        {(flagRequired || flagGap) && (
          <span
            style={{
              padding: '1px 7px',
              borderRadius: '100px',
              fontSize: '9.5px',
              fontWeight: 700,
              letterSpacing: '0.04em',
              textTransform: 'uppercase',
              background: flagRequired ? '#FEF3E2' : 'rgba(0,28,53,0.05)',
              color: flagRequired ? '#7A3800' : 'var(--color-text-secondary)',
            }}
          >
            {flagRequired ? 'Required' : 'Not on the sheet'}
          </span>
        )}
      </span>
      <input
        type="text"
        value={value}
        disabled={disabled}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        aria-required={required || undefined}
        style={{
          ...inputStyle,
          border: flagRequired ? '1.5px solid #D97706' : inputStyle.border,
        }}
      />
    </label>
  );
}

function Hint({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ fontSize: '11px', fontWeight: 500, color: 'var(--color-text-muted)', lineHeight: 1.4 }}>
      {children}
    </div>
  );
}

function ToggleRow({
  label,
  hint,
  checked,
  disabled,
  onChange,
}: {
  label: string;
  hint: string;
  checked: boolean;
  disabled: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', cursor: disabled ? 'default' : 'pointer' }}>
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
        style={{ accentColor: 'var(--color-accent-active, #001C35)', marginTop: '2px' }}
      />
      <span style={{ minWidth: 0 }}>
        <span style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--color-text-primary)' }}>{label}</span>
        <span style={{ display: 'block', fontSize: '11px', fontWeight: 500, color: 'var(--color-text-muted)', marginTop: '1px' }}>{hint}</span>
      </span>
    </label>
  );
}

function AssumedRow({ label, why, children }: { label: string; why: string; children: React.ReactNode }) {
  return (
    <div
      style={{
        padding: '8px 10px',
        borderTop: '1px solid var(--color-border-subtle, rgba(0,28,53,0.06))',
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
        gap: '12px',
      }}
    >
      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--color-text-primary)' }}>{label}</span>
          <span
            style={{
              padding: '1px 7px',
              borderRadius: '100px',
              fontSize: '9.5px',
              fontWeight: 700,
              letterSpacing: '0.04em',
              textTransform: 'uppercase',
              background: 'rgba(40,175,201,0.12)',
              color: '#0E7490',
            }}
          >
            Assumed
          </span>
        </div>
        <div style={{ marginTop: '2px', fontSize: '11px', fontWeight: 500, color: 'var(--color-text-muted)', lineHeight: 1.4 }}>{why}</div>
      </div>
      <div style={{ flexShrink: 0, marginTop: '2px' }}>{children}</div>
    </div>
  );
}

/** Accessible switch: a real checkbox styled as a pill, so keyboard
 *  and screen readers get native behaviour. */
function Switch({ checked, disabled, onChange }: { checked: boolean; disabled: boolean; onChange: (v: boolean) => void }) {
  return (
    <label
      style={{
        position: 'relative',
        display: 'inline-block',
        width: '34px',
        height: '20px',
        cursor: disabled ? 'default' : 'pointer',
      }}
    >
      <input
        type="checkbox"
        role="switch"
        aria-checked={checked}
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
        style={{ position: 'absolute', opacity: 0, width: '100%', height: '100%', margin: 0, cursor: 'inherit' }}
      />
      <span
        aria-hidden
        style={{
          position: 'absolute',
          inset: 0,
          borderRadius: '100px',
          background: checked ? 'var(--color-accent-active, #001C35)' : 'rgba(0,28,53,0.18)',
          transition: 'background 0.12s',
        }}
      />
      <span
        aria-hidden
        style={{
          position: 'absolute',
          top: '2px',
          left: checked ? '16px' : '2px',
          width: '16px',
          height: '16px',
          borderRadius: '50%',
          background: '#fff',
          boxShadow: '0 1px 3px rgba(0,28,53,0.25)',
          transition: 'left 0.12s',
        }}
      />
    </label>
  );
}
