'use client';

import { useState } from 'react';
import * as ui from '../supportCentreUi';
import { dayLabel, hmLabel, money } from '../cashFixtures';
import { PAID_OUT_FOR } from '../cashOperators';
import { whenLabel } from '../countStore';
import type { PaidOut, PaidOutNote } from '../paidOuts';

/** One paid out from the till: explain it, or change the explanation later. */
export default function PaidOutRow({ p, me, onSave }: { p: PaidOut; me: string; onSave: (id: string, note: PaidOutNote) => void }) {
  const [editing, setEditing] = useState(false);
  const [category, setCategory] = useState(p.explained?.category ?? '');
  const [note, setNote] = useState(p.explained?.note ?? '');
  const [receipt, setReceipt] = useState(p.explained?.receipt ?? true);
  const open = !p.explained || editing;
  const ok = !!category && (category !== 'Other' || note.trim().length > 3);
  const fieldId = `po-${p.id.replace(/[^\w]/g, '-')}`;

  return (
    <li style={{ ...ui.listRow, alignItems: 'flex-start', flexWrap: 'wrap' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2, flex: '1 1 220px', minWidth: 0 }}>
        <span style={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{money(p.value)}</span>
        <span style={ui.muted}>{dayLabel(p.day)}, {hmLabel(p.minute)}, {p.till}. Till login {p.login}</span>
      </div>
      {open ? (
        <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', flexWrap: 'wrap', flex: '2 1 420px' }}>
          <label style={{ ...ui.field, flex: '1 1 170px' }} htmlFor={`${fieldId}-cat`}>
            <span style={ui.fieldLabel}>What for</span>
            <select id={`${fieldId}-cat`} style={ui.input} value={category} onChange={e => setCategory(e.target.value)}>
              <option value="">Choose one</option>
              {PAID_OUT_FOR.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </label>
          <label style={{ ...ui.field, flex: '1 1 160px' }} htmlFor={`${fieldId}-note`}>
            <span style={ui.fieldLabel}>{category === 'Other' ? 'Note (required)' : 'Note (optional)'}</span>
            <input id={`${fieldId}-note`} style={ui.input} value={note} onChange={e => setNote(e.target.value)} />
          </label>
          <label style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 13, minHeight: 36 }}>
            <input type="checkbox" checked={receipt} onChange={e => setReceipt(e.target.checked)} />
            Receipt kept
          </label>
          <button
            type="button"
            style={{ ...ui.primaryBtn, opacity: ok ? 1 : 0.5, cursor: ok ? 'pointer' : 'not-allowed' }}
            disabled={!ok}
            onClick={() => {
              onSave(p.id, { category, note: note.trim() || undefined, receipt, by: me, when: new Date().toISOString() });
              setEditing(false);
            }}
          >
            Save
          </button>
          {editing && <button type="button" style={ui.ghostBtn} onClick={() => setEditing(false)}>Cancel</button>}
        </div>
      ) : (
        <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', flex: '2 1 420px', justifyContent: 'space-between' }}>
          <span style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <span>{p.explained!.category}{p.explained!.note ? `. ${p.explained!.note}` : ''}</span>
            <span style={ui.muted}>
              {p.explained!.receipt ? 'Receipt kept' : 'No receipt'}. {p.explained!.by}, {whenLabel(p.explained!.when)}
            </span>
          </span>
          <button type="button" style={ui.ghostBtn} onClick={() => setEditing(true)} aria-label={`Edit paid out of ${money(p.value)}`}>Edit</button>
        </div>
      )}
    </li>
  );
}
