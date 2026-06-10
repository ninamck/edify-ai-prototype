'use client';

// /notebook — the long-running record the operator and Edify build
// together. Reachable from the sidebar (Performance → Notebook) and
// from the "Note for Edify" card on the briefing panel.
//
// Layout: a single reading column, ordered by what the operator
// actually came here to do.
//
//   1. Today's compose (voice/text + tags + Edify's cascade reply).
//   2. The focal block — two sections side by side:
//        • "Themes you've mentioned" — recurring topics extracted
//          from the notes (Equipment, Weather, Team, etc.) with the
//          count and a most-recent example. These exist because the
//          operator told us about them.
//        • "What your data's telling us" — pattern callouts the
//          system has detected on its own and wants the operator to
//          weigh in on. Each has a 1-tap "Add a note" so the
//          observation flows back into today's compose.
//   3. A collapsed "Past entries" dropdown — the running log of
//      prior days. Useful when you specifically want to revisit
//      something, otherwise out of the way.
//
// Together they answer the question Ed kept asking in Kallie's
// transcript: "how do we capture the stuff integrations can't see?"
// — by giving the operator a place to put it, and Edify a place to
// reflect what it's been picking up alongside.

import { useState, useMemo, useEffect } from 'react';
import { useNotebookNotes } from '@/components/notebookStore';
import {
  Mic,
  Square,
  CheckCircle2,
  Pencil,
  Tag,
  ChevronRight,
  ChevronDown,
  Plus,
  X,
  BookOpen,
  Mail,
  Send,
  Paperclip,
} from 'lucide-react';

type EntryTag = 'Equipment' | 'Weather' | 'Team' | 'Customer' | 'Supplier' | 'Compliance';

const ALL_TAGS: EntryTag[] = ['Equipment', 'Weather', 'Team', 'Customer', 'Supplier', 'Compliance'];

interface PastEntry {
  id: string;
  dateLabel: string;
  weekday: string;
  note: string;
  tags: EntryTag[];
  edifyReply: string;
  outcome?: string;
}

const PAST_ENTRIES: PastEntry[] = [
  {
    id: 'e-2026-05-19',
    dateLabel: '19 May',
    weekday: 'Tuesday',
    note:
      "Tom called out mid-morning so we were on three through lunch. Felt the queue in the line for about 20 minutes around 12:30. Two regulars left without ordering.",
    tags: ['Team', 'Customer'],
    edifyReply:
      "Logged a one-down lunch shift on 19 May and matched it against a £210 dip on the 12–1pm window vs forecast. I've added a standby call to your Tuesday roster and lifted Wednesday's mid-shift to 4 to absorb any follow-on.",
    outcome:
      "Wednesday ran on plan with the lifted shift — no further call-outs needed. I'll keep watching Tuesday cover for the next two weeks.",
  },
  {
    id: 'e-2026-05-18',
    dateLabel: '18 May',
    weekday: 'Monday',
    note:
      "Fridge 2 was making the noise again from about 11am. Stayed cold but it's the third time this month. Engineer's been twice and said it's fine — I don't think it is.",
    tags: ['Equipment'],
    edifyReply:
      "Logged Fridge 2 anomaly for 18 May, cross-referenced with the engineer visits on 04 and 11 May. Holding temps look fine on the sensor log so this is below the threshold I'd auto-escalate — but I've drafted a maintenance follow-up for Cheryl referencing the pattern. Ready when you want to send it.",
  },
  {
    id: 'e-2026-05-16',
    dateLabel: '16 May',
    weekday: 'Saturday',
    note:
      "Pouring rain from 11. Way busier than I expected — usually rain kills us. I think it's because the park run got cancelled and people came here instead.",
    tags: ['Weather', 'Customer'],
    edifyReply:
      "Interesting — I had your Saturday forecast at −12% on the rain signal but you ended +18%. Logged the park-run cancellation as a one-off lift driver. I won't bake it into the model from one data point but I'll flag it the next time Saturday park-run is cancelled within 1km.",
    outcome:
      "Cross-checked with Stockport — same weekend pattern there. Two data points isn't a trend yet, but I've added 'local event cancellation' as a watch signal in your forecast inputs.",
  },
  {
    id: 'e-2026-05-15',
    dateLabel: '15 May',
    weekday: 'Friday',
    note:
      "Bidvest driver was 90 mins late. He said depot was short on vans. Affected the lunch prep — we ran out of ham & cheese at 1.40.",
    tags: ['Supplier'],
    edifyReply:
      "Logged Bidvest delivery delay on 15 May (booked 09:00, arrived 10:32) against the ham & cheese sell-out at 13:40. This is the second Bidvest delay in 30 days. I've drafted a query to your account manager — it sits in Cheryl's review queue.",
  },
  {
    id: 'e-2026-05-13',
    dateLabel: '13 May',
    weekday: 'Wednesday',
    note:
      "New staff member Daisy on the bar — really good first shift. Quick on her feet. Customer mentioned the latte art unprompted.",
    tags: ['Team', 'Customer'],
    edifyReply:
      "Noted as a positive on Daisy's first shift. I'll surface this in her 30-day review prep and watch for repeat customer mentions on her shifts.",
  },
];

const THEMES: { tag: EntryTag; count: number; lastSeen: string; preview: string }[] = [
  { tag: 'Equipment', count: 4, lastSeen: 'Mon 18 May', preview: 'Fridge 2 noise — third time this month' },
  { tag: 'Team', count: 6, lastSeen: 'Tue 19 May', preview: 'Tom call-out + Daisy first shift positive' },
  { tag: 'Weather', count: 3, lastSeen: 'Sat 16 May', preview: 'Rain Saturday lifted +18%' },
  { tag: 'Supplier', count: 2, lastSeen: 'Fri 15 May', preview: 'Bidvest delay × 2 in 30 days' },
  { tag: 'Customer', count: 5, lastSeen: 'Tue 19 May', preview: 'Two regulars left at the lunch queue' },
];

type DataSignalAction =
  | { kind: 'note'; prompt: string; suggestedTags: EntryTag[] }
  | {
      kind: 'email';
      to: string;
      toRole: string;
      subject: string;
      body: string;
      attachments: string[];
      sendCtaLabel: string;
    };

interface DataSignal {
  id: string;
  headline: string;
  detail: string;
  action: DataSignalAction;
}

const DATA_SIGNALS: DataSignal[] = [
  {
    id: 's-fridge2',
    headline: 'Fridge 2 has broken 3 times this month — costing you £820 so far',
    detail:
      "Three engineer call-outs on 04, 11 and 22 May (£260), spoiled stock from the 22 May warm-period (£420), and 4 hours of lost trading on the rebuild (£140). Each visit closed as 'within tolerance' — but the pattern's getting more expensive. I've drafted the escalation to Cheryl with the cost line and the sensor evidence attached.",
    action: {
      kind: 'email',
      to: 'Cheryl Davies',
      toRole: 'Area Manager',
      subject: 'Fridge 2 — third failure this month, escalation request',
      body:
        "Hi Cheryl,\n\nFridge 2 at the shop has now failed three times in May (04, 11 and 22) at a combined cost of £820 — £260 in engineer call-outs, £420 in written-off stock from the 22 May warm-period, and £140 of lost trading on the rebuild.\n\nThe closing temp logs on each occasion are attached. The engineer has cleared the unit each time as 'within tolerance' but the pattern is consistent and getting more expensive.\n\nCan we get the unit replaced under the existing service contract before the next failure?\n\nThanks,",
      attachments: [
        'Sensor log · 04 May',
        'Sensor log · 11 May',
        'Sensor log · 22 May',
        'Stock write-off · 22 May',
      ],
      sendCtaLabel: 'Send to Cheryl',
    },
  },
  {
    id: 's-tuesday-cover',
    headline: 'Tuesday lunch covers landed +14% above forecast 3 weeks running',
    detail:
      "Your forecast is treating these as outliers. If you've noticed a reason — a regular group, a local event — I can bake it in.",
    action: {
      kind: 'note',
      prompt: "Tuesday lunch has been busier than forecast because ",
      suggestedTags: ['Customer'],
    },
  },
  {
    id: 's-pastry-3pm',
    headline: 'Pastry waste after 3pm up 40% — same pattern, 3 days running',
    detail:
      "Maps to an over-pull on the morning batch. A note from you on whether this is a one-off ramp or a new normal would help me right-size tomorrow's prep.",
    action: {
      kind: 'note',
      prompt: "The pastry waste after 3pm is happening because ",
      suggestedTags: ['Team', 'Customer'],
    },
  },
];

// ──────────────────────────────────────────────────────────────────────────────

export default function NotebookPage() {
  const [recordState, setRecordState] = useState<'idle' | 'recording' | 'done'>('idle');
  const [textNote, setTextNote] = useState('');
  const [activeTags, setActiveTags] = useState<Set<EntryTag>>(new Set());
  const [savedToday, setSavedToday] = useState<{
    note: string;
    tags: EntryTag[];
    reply: string;
  } | null>(null);
  const [filterTag, setFilterTag] = useState<EntryTag | null>(null);
  const [dismissedSignals, setDismissedSignals] = useState<Set<string>>(new Set());
  const [sentEmailSignals, setSentEmailSignals] = useState<Set<string>>(new Set());
  const [openEmailSignalId, setOpenEmailSignalId] = useState<string | null>(null);
  const [pastExpanded, setPastExpanded] = useState(false);

  // Notes captured elsewhere (e.g. the "Note:" quick action in the Quinn
  // chat) thread into the running record here. Newest first, ahead of the
  // canned demo history.
  const chatNotes = useNotebookNotes();
  const capturedEntries = useMemo<PastEntry[]>(
    () =>
      chatNotes.map((n) => {
        const d = new Date(n.createdAt);
        return {
          id: n.id,
          dateLabel: new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short' }).format(d),
          weekday: new Intl.DateTimeFormat('en-GB', { weekday: 'long' }).format(d),
          note: n.text,
          tags: n.tags.filter((t): t is EntryTag => (ALL_TAGS as string[]).includes(t)),
          edifyReply: n.reply,
        };
      }),
    [chatNotes],
  );
  const allEntries = useMemo(() => [...capturedEntries, ...PAST_ENTRIES], [capturedEntries]);

  // Surface freshly-captured notes without making the operator hunt for
  // them: open the Past entries section when there's something new.
  useEffect(() => {
    if (capturedEntries.length > 0) setPastExpanded(true);
  }, [capturedEntries.length]);

  const today = useMemo(() => {
    return new Intl.DateTimeFormat('en-GB', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
    }).format(new Date());
  }, []);

  // Auto-open the past-entries section when the operator filters by a
  // theme — they're explicitly going looking for something.
  useEffect(() => {
    if (filterTag) setPastExpanded(true);
  }, [filterTag]);

  // Close the email-draft modal on ESC.
  useEffect(() => {
    if (!openEmailSignalId) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpenEmailSignalId(null);
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [openEmailSignalId]);

  function toggleTag(t: EntryTag) {
    setActiveTags((prev) => {
      const n = new Set(prev);
      if (n.has(t)) n.delete(t);
      else n.add(t);
      return n;
    });
  }

  function startRecording() {
    setRecordState('recording');
  }

  function stopRecording() {
    setRecordState('done');
    if (!textNote) {
      setTextNote(
        "Lunch was solid — we cleared the ham & cheese by 1.45. New muffin batch held, no rollover. Customer complained about the milk being too cold in the iced latte, I think the fridge thermostat got knocked.",
      );
    }
  }

  function saveNote() {
    const note = textNote.trim();
    if (!note) return;
    const tags = Array.from(activeTags);
    const reply = composeReply(note, tags);
    setSavedToday({ note, tags, reply });
  }

  function loadNoteFromSignal(s: DataSignal) {
    if (s.action.kind !== 'note') return;
    setTextNote(s.action.prompt);
    setActiveTags(new Set(s.action.suggestedTags));
    setRecordState('idle');
  }

  function sendDraftedEmail(id: string) {
    setSentEmailSignals((prev) => {
      const n = new Set(prev);
      n.add(id);
      return n;
    });
    setOpenEmailSignalId(null);
  }

  function dismissSignal(id: string) {
    setDismissedSignals((prev) => {
      const n = new Set(prev);
      n.add(id);
      return n;
    });
  }

  const visibleEntries = filterTag
    ? allEntries.filter((e) => e.tags.includes(filterTag))
    : allEntries;

  const visibleSignals = DATA_SIGNALS.filter((s) => !dismissedSignals.has(s.id));

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 28,
        padding: '32px 32px 80px',
        maxWidth: 1040,
        margin: '0 auto',
      }}
    >
      {/* ─── HEADER ──────────────────────────────────────────────────────── */}
      <div>
        <h1
          style={{
            margin: 0,
            fontSize: 30,
            fontWeight: 700,
            letterSpacing: '-0.01em',
            color: 'var(--color-text-primary)',
            fontFamily: 'var(--font-primary)',
          }}
        >
          Notebook
        </h1>
        <p
          style={{
            margin: '6px 0 0',
            fontSize: 16,
            color: 'var(--color-text-secondary)',
            lineHeight: 1.55,
            maxWidth: 640,
          }}
        >
          Tell Edify what happened today that the numbers won&apos;t show. It threads
          through everything you said before and lines up what the data
          noticed on its own.
        </p>
      </div>

      {/* ─── TODAY'S COMPOSE ─────────────────────────────────────────────── */}
      <article
        style={{
          padding: 22,
          borderRadius: 14,
          background: '#fff',
          border: '1px solid var(--color-border-subtle)',
          boxShadow: '0 1px 4px rgba(0, 28, 53,0.06)',
          display: 'flex',
          flexDirection: 'column',
          gap: 14,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12 }}>
          <span
            style={{
              fontSize: 12,
              fontWeight: 700,
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
              color: 'var(--color-accent-active)',
            }}
          >
            Today · {today}
          </span>
          {savedToday && (
            <button
              type="button"
              onClick={() => {
                setSavedToday(null);
                setRecordState('idle');
                setTextNote('');
                setActiveTags(new Set());
              }}
              style={{
                all: 'unset',
                cursor: 'pointer',
                fontSize: 13,
                fontWeight: 600,
                color: 'var(--color-text-muted)',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
              }}
            >
              <Plus size={13} strokeWidth={2.2} /> Add another
            </button>
          )}
        </div>

        {!savedToday && (
          <>
            <textarea
              value={textNote}
              onChange={(e) => setTextNote(e.target.value)}
              placeholder="What happened in the shop today the numbers won't show?"
              rows={5}
              style={{
                width: '100%',
                padding: '14px 16px',
                border: '1px solid var(--color-border-subtle)',
                borderRadius: 10,
                fontFamily: 'var(--font-primary)',
                fontSize: 16,
                lineHeight: 1.55,
                color: 'var(--color-text-primary)',
                resize: 'vertical',
                minHeight: 120,
                background: '#fff',
                boxSizing: 'border-box',
              }}
            />

            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: 10,
              }}
            >
              <button
                type="button"
                onClick={recordState === 'recording' ? stopRecording : startRecording}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '9px 16px',
                  borderRadius: 8,
                  border:
                    recordState === 'recording'
                      ? '1px solid var(--color-accent-quinn, #FF0058)'
                      : '1px solid var(--color-border)',
                  background:
                    recordState === 'recording'
                      ? 'rgba(255,0,88,0.08)'
                      : '#fff',
                  color:
                    recordState === 'recording'
                      ? 'var(--color-accent-quinn, #FF0058)'
                      : 'var(--color-text-primary)',
                  fontSize: 13,
                  fontWeight: 700,
                  fontFamily: 'var(--font-primary)',
                  cursor: 'pointer',
                }}
              >
                {recordState === 'recording' ? (
                  <Square size={13} strokeWidth={2.4} fill="currentColor" />
                ) : (
                  <Mic size={13} strokeWidth={2.2} />
                )}
                {recordState === 'recording' ? 'Stop & transcribe' : 'Record voice'}
              </button>

              <span
                style={{
                  fontSize: 13,
                  color: 'var(--color-text-muted)',
                  fontWeight: 500,
                }}
              >
                or type freely above
              </span>

              <div style={{ flex: 1 }} />

              <button
                type="button"
                onClick={saveNote}
                disabled={!textNote.trim()}
                style={{
                  padding: '9px 18px',
                  borderRadius: 8,
                  border: 'none',
                  background: textNote.trim()
                    ? 'var(--color-accent-active)'
                    : 'var(--color-bg-hover)',
                  color: textNote.trim() ? '#fff' : 'var(--color-text-muted)',
                  fontSize: 13,
                  fontWeight: 700,
                  fontFamily: 'var(--font-primary)',
                  cursor: textNote.trim() ? 'pointer' : 'not-allowed',
                }}
              >
                Send to Edify
              </button>
            </div>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {ALL_TAGS.map((t) => {
                const active = activeTags.has(t);
                return (
                  <button
                    key={t}
                    type="button"
                    onClick={() => toggleTag(t)}
                    style={{
                      padding: '6px 13px',
                      borderRadius: 999,
                      border: active
                        ? '1px solid var(--color-accent-active)'
                        : '1px solid var(--color-border-subtle)',
                      background: active ? 'var(--color-accent-active)' : '#fff',
                      color: active ? '#fff' : 'var(--color-text-secondary)',
                      fontSize: 12.5,
                      fontWeight: 600,
                      fontFamily: 'var(--font-primary)',
                      cursor: 'pointer',
                    }}
                  >
                    {t}
                  </button>
                );
              })}
            </div>
          </>
        )}

        {savedToday && <SavedToday saved={savedToday} />}
      </article>

      {/* ─── FOCAL BLOCK: themes + data signals ──────────────────────────── */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
          gap: 20,
          alignItems: 'start',
        }}
      >
        {/* ── Themes ─────────────────────────────────────────────────── */}
        <section
          style={{
            padding: 20,
            borderRadius: 14,
            background: '#fff',
            border: '1px solid var(--color-border-subtle)',
            boxShadow: '0 1px 4px rgba(0, 28, 53,0.06)',
          }}
        >
          <header
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              marginBottom: 4,
            }}
          >
            <Pencil size={15} strokeWidth={2.2} color="var(--color-text-secondary)" />
            <h2
              style={{
                margin: 0,
                fontSize: 17,
                fontWeight: 700,
                color: 'var(--color-text-primary)',
                letterSpacing: '-0.005em',
              }}
            >
              Themes you&apos;ve mentioned
            </h2>
          </header>
          <p
            style={{
              margin: '0 0 16px',
              fontSize: 13.5,
              color: 'var(--color-text-muted)',
              lineHeight: 1.5,
            }}
          >
            Pulled from your last 30 days of notes. Tap one to see the entries behind it.
          </p>
          <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
            {THEMES.map((t) => (
              <li key={t.tag}>
                <button
                  type="button"
                  onClick={() => setFilterTag(t.tag === filterTag ? null : t.tag)}
                  style={{
                    all: 'unset',
                    cursor: 'pointer',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 3,
                    width: '100%',
                    padding: '11px 13px',
                    borderRadius: 10,
                    border:
                      filterTag === t.tag
                        ? '1px solid var(--color-accent-active)'
                        : '1px solid var(--color-border-subtle)',
                    background: filterTag === t.tag ? 'rgba(0,28,53,0.04)' : '#fff',
                    boxSizing: 'border-box',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 6 }}>
                    <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--color-text-primary)' }}>
                      {t.tag}
                    </span>
                    <span style={{ fontSize: 12.5, color: 'var(--color-text-muted)', fontWeight: 600 }}>
                      {t.count} mentions · {t.lastSeen}
                    </span>
                  </div>
                  <span
                    style={{
                      fontSize: 13.5,
                      color: 'var(--color-text-secondary)',
                      lineHeight: 1.5,
                    }}
                  >
                    {t.preview}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </section>

        {/* ── What your data's telling us ────────────────────────────── */}
        <section
          style={{
            padding: 20,
            borderRadius: 14,
            background: '#fff',
            border: '1px solid var(--color-border-subtle)',
            boxShadow: '0 1px 4px rgba(0, 28, 53,0.06)',
          }}
        >
          <header
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              marginBottom: 4,
            }}
          >
            <span
              role="img"
              aria-label="Edify"
              style={{
                display: 'inline-block',
                width: 11,
                height: 18,
                flexShrink: 0,
                backgroundColor: 'var(--color-accent-active)',
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
            <h2
              style={{
                margin: 0,
                fontSize: 17,
                fontWeight: 700,
                color: 'var(--color-text-primary)',
                letterSpacing: '-0.005em',
              }}
            >
              What your data&apos;s telling us
            </h2>
          </header>
          <p
            style={{
              margin: '0 0 16px',
              fontSize: 13.5,
              color: 'var(--color-text-muted)',
              lineHeight: 1.5,
            }}
          >
            Patterns Edify picked up — your note will close the loop.
          </p>
          <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
            {visibleSignals.length === 0 && (
              <li style={{ fontSize: 13.5, color: 'var(--color-text-muted)', fontStyle: 'italic' }}>
                Nothing new today. I&apos;ll keep watching.
              </li>
            )}
            {visibleSignals.map((s) => (
              <DataSignalCard
                key={s.id}
                signal={s}
                sent={sentEmailSignals.has(s.id)}
                onAddNote={() => loadNoteFromSignal(s)}
                onOpenEmail={() => setOpenEmailSignalId(s.id)}
                onDismiss={() => dismissSignal(s.id)}
              />
            ))}
          </ul>
        </section>
      </div>

      {/* ─── PAST ENTRIES (collapsed dropdown) ───────────────────────────── */}
      <section
        style={{
          background: '#fff',
          border: '1px solid var(--color-border-subtle)',
          borderRadius: 14,
          boxShadow: '0 1px 4px rgba(0, 28, 53,0.06)',
          overflow: 'hidden',
        }}
      >
        <button
          type="button"
          onClick={() => {
            if (filterTag) {
              setFilterTag(null);
              setPastExpanded(false);
            } else {
              setPastExpanded((v) => !v);
            }
          }}
          style={{
            all: 'unset',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            width: '100%',
            padding: '16px 20px',
            boxSizing: 'border-box',
          }}
        >
          <BookOpen size={16} strokeWidth={2.2} color="var(--color-text-secondary)" />
          <span
            style={{
              fontSize: 15,
              fontWeight: 700,
              color: 'var(--color-text-primary)',
            }}
          >
            Past entries
          </span>
          <span
            style={{
              fontSize: 13,
              color: 'var(--color-text-muted)',
              fontWeight: 500,
            }}
          >
            {filterTag
              ? `${visibleEntries.length} tagged ${filterTag}`
              : `${allEntries.length} entries`}
          </span>
          <div style={{ flex: 1 }} />
          {filterTag ? (
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '5px 10px',
                background: 'rgba(0,28,53,0.05)',
                border: '1px solid rgba(0,28,53,0.18)',
                borderRadius: 999,
                fontSize: 12,
                fontWeight: 600,
                color: 'var(--color-accent-active)',
              }}
            >
              <Tag size={11} strokeWidth={2.4} />
              {filterTag}
              <X size={11} strokeWidth={2.4} />
            </span>
          ) : (
            <ChevronDown
              size={18}
              strokeWidth={2.2}
              color="var(--color-text-muted)"
              style={{
                transform: pastExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
                transition: 'transform 160ms ease',
              }}
            />
          )}
        </button>

        {(pastExpanded || filterTag) && (
          <div
            style={{
              borderTop: '1px solid var(--color-border-subtle)',
              padding: 20,
              display: 'flex',
              flexDirection: 'column',
              gap: 14,
              background: 'var(--color-bg-surface)',
            }}
          >
            {visibleEntries.length === 0 && (
              <p
                style={{
                  fontSize: 14,
                  color: 'var(--color-text-muted)',
                  fontStyle: 'italic',
                  margin: 0,
                  padding: '8px 0',
                }}
              >
                No entries tagged {filterTag}.
              </p>
            )}
            {visibleEntries.map((entry) => (
              <PastEntryBlock key={entry.id} entry={entry} onTagClick={setFilterTag} />
            ))}
          </div>
        )}
      </section>

      {/* ─── EMAIL DRAFT MODAL ───────────────────────────────────────────── */}
      {openEmailSignalId && (() => {
        const sig = DATA_SIGNALS.find((s) => s.id === openEmailSignalId);
        if (!sig || sig.action.kind !== 'email') return null;
        return (
          <EmailDraftModal
            action={sig.action}
            onClose={() => setOpenEmailSignalId(null)}
            onSend={() => sendDraftedEmail(sig.id)}
          />
        );
      })()}
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────────

function SavedToday({
  saved,
}: {
  saved: { note: string; tags: EntryTag[]; reply: string };
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div
        style={{
          padding: '12px 14px',
          borderRadius: 10,
          background: 'var(--color-bg-hover)',
          border: '1px solid var(--color-border-subtle)',
          fontSize: 15,
          color: 'var(--color-text-primary)',
          lineHeight: 1.55,
        }}
      >
        <div
          style={{
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: '0.06em',
            textTransform: 'uppercase',
            color: 'var(--color-text-muted)',
            marginBottom: 5,
          }}
        >
          You {saved.tags.length > 0 ? `· ${saved.tags.join(' · ')}` : ''}
        </div>
        {saved.note}
      </div>
      <div
        style={{
          padding: '12px 14px',
          borderRadius: 10,
          background: 'rgba(0,28,53,0.05)',
          border: '1px solid rgba(0,28,53,0.18)',
          fontSize: 15,
          color: 'var(--color-text-primary)',
          lineHeight: 1.55,
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 5,
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: '0.06em',
            textTransform: 'uppercase',
            color: 'var(--color-accent-active)',
            marginBottom: 5,
          }}
        >
          <CheckCircle2 size={12} strokeWidth={2.4} /> Edify
        </div>
        {saved.reply}
      </div>
    </div>
  );
}

function DataSignalCard({
  signal,
  sent,
  onAddNote,
  onOpenEmail,
  onDismiss,
}: {
  signal: DataSignal;
  sent: boolean;
  onAddNote: () => void;
  onOpenEmail: () => void;
  onDismiss: () => void;
}) {
  const isEmail = signal.action.kind === 'email';

  return (
    <li
      style={{
        padding: 14,
        borderRadius: 10,
        border: isEmail
          ? '1px solid rgba(196,30,58,0.45)'
          : '1px solid var(--color-border-subtle)',
        background: '#fff',
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
      }}
    >
      <p
        style={{
          margin: 0,
          fontSize: 14.5,
          fontWeight: 700,
          color: 'var(--color-text-primary)',
          lineHeight: 1.4,
        }}
      >
        {signal.headline}
      </p>
      <p
        style={{
          margin: 0,
          fontSize: 13.5,
          color: 'var(--color-text-secondary)',
          lineHeight: 1.55,
        }}
      >
        {signal.detail}
      </p>

      {/* ── Sent confirmation (email action only, after Send) ────────── */}
      {signal.action.kind === 'email' && sent && (
        <SentEmailConfirmation action={signal.action} />
      )}

      {/* ── Actions row ─────────────────────────────────────────────── */}
      {!sent && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 2 }}>
          {signal.action.kind === 'email' ? (
            <button
              type="button"
              onClick={onOpenEmail}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '8px 14px',
                borderRadius: 7,
                border: 'none',
                background: 'var(--color-accent-active)',
                color: '#fff',
                fontSize: 13,
                fontWeight: 700,
                fontFamily: 'var(--font-primary)',
                cursor: 'pointer',
              }}
            >
              <Mail size={13} strokeWidth={2.4} />
              Review draft email
            </button>
          ) : (
            <button
              type="button"
              onClick={onAddNote}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 3,
                padding: '6px 12px',
                borderRadius: 7,
                border: 'none',
                background: 'var(--color-accent-active)',
                color: '#fff',
                fontSize: 12.5,
                fontWeight: 700,
                fontFamily: 'var(--font-primary)',
                cursor: 'pointer',
              }}
            >
              Add a note
              <ChevronRight size={12} strokeWidth={2.4} />
            </button>
          )}
          <button
            type="button"
            onClick={onDismiss}
            style={{
              padding: signal.action.kind === 'email' ? '8px 12px' : '6px 12px',
              borderRadius: 7,
              border: '1px solid var(--color-border-subtle)',
              background: '#fff',
              color: 'var(--color-text-muted)',
              fontSize: 12.5,
              fontWeight: 600,
              fontFamily: 'var(--font-primary)',
              cursor: 'pointer',
            }}
          >
            Not now
          </button>
        </div>
      )}
    </li>
  );
}

function EmailDraftModal({
  action,
  onClose,
  onSend,
}: {
  action: Extract<DataSignalAction, { kind: 'email' }>;
  onClose: () => void;
  onSend: () => void;
}) {
  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1000,
        background: 'rgba(15, 18, 25, 0.42)',
        backdropFilter: 'blur(2px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Drafted email to manager"
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: 620,
          maxHeight: 'calc(100vh - 48px)',
          background: '#fff',
          borderRadius: 14,
          boxShadow: '0 24px 60px rgba(15,18,25,0.32)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: '14px 18px',
            borderBottom: '1px solid var(--color-border-subtle)',
            background: 'var(--color-bg-hover)',
          }}
        >
          <Mail size={15} strokeWidth={2.4} color="var(--color-text-secondary)" />
          <span
            style={{
              fontSize: 12,
              fontWeight: 700,
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
              color: 'var(--color-text-secondary)',
            }}
          >
            Drafted by Edify · ready to send
          </span>
          <div style={{ flex: 1 }} />
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            style={{
              all: 'unset',
              cursor: 'pointer',
              display: 'inline-flex',
              padding: 4,
              borderRadius: 6,
              color: 'var(--color-text-muted)',
            }}
          >
            <X size={16} strokeWidth={2.4} />
          </button>
        </div>

        {/* Body — scrollable if content gets long */}
        <div style={{ overflowY: 'auto', padding: '18px 22px' }}>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'auto 1fr',
              gap: '8px 14px',
              fontSize: 14,
              color: 'var(--color-text-primary)',
              lineHeight: 1.45,
              paddingBottom: 14,
              borderBottom: '1px solid var(--color-border-subtle)',
            }}
          >
            <span style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              To
            </span>
            <span style={{ fontWeight: 600 }}>
              {action.to}{' '}
              <span style={{ fontWeight: 500, color: 'var(--color-text-muted)' }}>· {action.toRole}</span>
            </span>

            <span style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Subject
            </span>
            <span style={{ fontWeight: 600 }}>{action.subject}</span>
          </div>

          <div
            style={{
              padding: '16px 0',
              fontSize: 14.5,
              color: 'var(--color-text-primary)',
              lineHeight: 1.6,
              whiteSpace: 'pre-wrap',
            }}
          >
            {action.body}
          </div>

          {action.attachments.length > 0 && (
            <div
              style={{
                paddingTop: 12,
                borderTop: '1px solid var(--color-border-subtle)',
                display: 'flex',
                flexWrap: 'wrap',
                alignItems: 'center',
                gap: 6,
              }}
            >
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 5,
                  fontSize: 11.5,
                  fontWeight: 700,
                  letterSpacing: '0.04em',
                  textTransform: 'uppercase',
                  color: 'var(--color-text-muted)',
                  marginRight: 4,
                }}
              >
                <Paperclip size={12} strokeWidth={2.4} />
                Attached
              </span>
              {action.attachments.map((a) => (
                <span
                  key={a}
                  style={{
                    padding: '5px 10px',
                    borderRadius: 999,
                    border: '1px solid var(--color-border-subtle)',
                    background: 'var(--color-bg-hover)',
                    fontSize: 12,
                    fontWeight: 600,
                    color: 'var(--color-text-secondary)',
                  }}
                >
                  {a}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Footer actions */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'flex-end',
            gap: 8,
            padding: '12px 18px',
            borderTop: '1px solid var(--color-border-subtle)',
            background: '#fff',
          }}
        >
          <button
            type="button"
            onClick={onClose}
            style={{
              padding: '9px 14px',
              borderRadius: 8,
              border: '1px solid var(--color-border-subtle)',
              background: '#fff',
              color: 'var(--color-text-secondary)',
              fontSize: 13,
              fontWeight: 600,
              fontFamily: 'var(--font-primary)',
              cursor: 'pointer',
            }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onSend}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 7,
              padding: '9px 16px',
              borderRadius: 8,
              border: 'none',
              background: 'var(--color-accent-active)',
              color: '#fff',
              fontSize: 13,
              fontWeight: 700,
              fontFamily: 'var(--font-primary)',
              cursor: 'pointer',
            }}
          >
            <Send size={13} strokeWidth={2.4} />
            {action.sendCtaLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

function SentEmailConfirmation({
  action,
}: {
  action: Extract<DataSignalAction, { kind: 'email' }>;
}) {
  return (
    <div
      style={{
        marginTop: 4,
        padding: '11px 13px',
        borderRadius: 10,
        background: 'var(--color-bg-hover)',
        border: '1px solid var(--color-border-subtle)',
        display: 'flex',
        gap: 9,
        alignItems: 'flex-start',
      }}
    >
      <CheckCircle2
        size={15}
        strokeWidth={2.4}
        color="var(--color-accent-active)"
        style={{ marginTop: 1, flexShrink: 0 }}
      />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        <span
          style={{
            fontSize: 13.5,
            fontWeight: 700,
            color: 'var(--color-text-primary)',
          }}
        >
          Sent to {action.to} · just now
        </span>
        <span
          style={{
            fontSize: 13,
            color: 'var(--color-text-secondary)',
            lineHeight: 1.5,
          }}
        >
          I&apos;ll watch for her reply and log it against the Fridge 2 thread in your notebook.
        </span>
      </div>
    </div>
  );
}

function PastEntryBlock({
  entry,
  onTagClick,
}: {
  entry: PastEntry;
  onTagClick: (t: EntryTag) => void;
}) {
  return (
    <article
      style={{
        padding: 18,
        borderRadius: 12,
        background: '#fff',
        border: '1px solid var(--color-border-subtle)',
        boxShadow: '0 1px 3px rgba(0, 28, 53,0.04)',
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
      }}
    >
      <header
        style={{
          display: 'flex',
          alignItems: 'baseline',
          gap: 10,
        }}
      >
        <span
          style={{
            fontSize: 12,
            fontWeight: 700,
            letterSpacing: '0.06em',
            textTransform: 'uppercase',
            color: 'var(--color-text-muted)',
          }}
        >
          {entry.weekday} · {entry.dateLabel}
        </span>
      </header>

      <blockquote
        style={{
          margin: 0,
          padding: '8px 0 8px 14px',
          borderLeft: '3px solid var(--color-border-subtle)',
          fontSize: 16,
          lineHeight: 1.6,
          color: 'var(--color-text-primary)',
          fontStyle: 'normal',
        }}
      >
        {entry.note}
      </blockquote>

      {entry.tags.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
          {entry.tags.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => onTagClick(t)}
              style={{
                padding: '4px 11px',
                borderRadius: 999,
                border: '1px solid var(--color-border-subtle)',
                background: '#fff',
                color: 'var(--color-text-secondary)',
                fontSize: 12,
                fontWeight: 600,
                fontFamily: 'var(--font-primary)',
                cursor: 'pointer',
              }}
            >
              {t}
            </button>
          ))}
        </div>
      )}

      <div
        style={{
          padding: '12px 14px',
          borderRadius: 8,
          background: 'rgba(0,28,53,0.05)',
          border: '1px solid rgba(0,28,53,0.18)',
          fontSize: 14,
          color: 'var(--color-text-primary)',
          lineHeight: 1.55,
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 5,
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: '0.06em',
            textTransform: 'uppercase',
            color: 'var(--color-accent-active)',
            marginBottom: 5,
          }}
        >
          <CheckCircle2 size={12} strokeWidth={2.4} /> Edify
        </div>
        {entry.edifyReply}
      </div>

      {entry.outcome && (
        <div
          style={{
            padding: '10px 14px',
            borderRadius: 8,
            background: 'rgba(26,92,58,0.06)',
            border: '1px solid rgba(26,92,58,0.18)',
            fontSize: 13.5,
            color: 'var(--color-text-primary)',
            lineHeight: 1.5,
            display: 'flex',
            gap: 8,
          }}
        >
          <span
            style={{
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
              color: '#1a5c3a',
              whiteSpace: 'nowrap',
              flexShrink: 0,
            }}
          >
            Since
          </span>
          <span>{entry.outcome}</span>
        </div>
      )}
    </article>
  );
}

// ── Mocked reply composer ─────────────────────────────────────────────────────
// Builds an Edify-voice reply from the note + tags. Hand-tuned for the
// prototype so the cascade ("logged X against Y · I'll watch Z") reads
// naturally without an LLM in the loop.
function composeReply(note: string, tags: EntryTag[]): string {
  const today = new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'short',
  }).format(new Date());
  const tagPhrase =
    tags.length === 0
      ? 'a note'
      : tags.length === 1
        ? `a ${tags[0].toLowerCase()} note`
        : `notes across ${tags.map((t) => t.toLowerCase()).join(', ')}`;
  const followUps: string[] = [];
  if (tags.includes('Equipment')) {
    followUps.push("I'll cross-check tonight's temp logs and flag if anything reads off");
  }
  if (tags.includes('Weather')) {
    followUps.push("I'll watch how this signal moved your covers vs the weather forecast");
  }
  if (tags.includes('Team')) {
    followUps.push("I'll watch for clustering on similar shifts over the next two weeks");
  }
  if (tags.includes('Supplier')) {
    followUps.push("I'll keep this against the supplier's delivery record and surface it on the next review");
  }
  if (tags.includes('Customer')) {
    followUps.push("I'll see if this shows up in repeat-visit patterns over the next 14 days");
  }
  if (tags.includes('Compliance')) {
    followUps.push("I'll keep the evidence linked in case the auditor asks");
  }
  if (followUps.length === 0) {
    followUps.push("I'll fold this into tomorrow's brief if anything connects");
  }
  return `Logged ${tagPhrase} for ${today} against today's pace. ${followUps[0]}.`;
}
