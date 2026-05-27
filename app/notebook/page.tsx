'use client';

// /notebook — the long-running record the operator and Edify build
// together. Reachable from the sidebar (Performance → Notebook) and
// from the "Note for Edify" card on the briefing panel.
//
// Layout: a two-column document.
//
//   • Main column: today's compose at the top (voice/text + tags +
//     Edify's cascade reply), followed by a reverse-chronological log
//     of prior days. Each prior day carries the operator's note, the
//     tags applied, Edify's response, and the outcome Edify has
//     learned about since.
//
//   • Right rail: two streams Edify is keeping for the operator —
//       1. "Themes you've mentioned" — recurring topics extracted
//          from the notes (Equipment, Weather, Team, etc.) with the
//          count and a most-recent example. These exist because the
//          operator told us about them.
//       2. "What your data is telling us" — pattern callouts the
//          system has detected on its own and wants the operator to
//          weigh in on. Each one has a 1-tap "Add a note" so the
//          observation flows back into today's compose.
//
// Together they answer the question Ed kept asking in Kallie's
// transcript: "how do we capture the stuff integrations can't see?"
// — by giving the operator a place to put it, and Edify a place to
// reflect what it's been picking up alongside.

import { useState, useMemo } from 'react';
import {
  Mic,
  Square,
  CheckCircle2,
  Pencil,
  Tag,
  Sparkles,
  ChevronRight,
  Plus,
  X,
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

interface DataSignal {
  id: string;
  headline: string;
  detail: string;
  prompt: string;
  suggestedTags: EntryTag[];
}

const DATA_SIGNALS: DataSignal[] = [
  {
    id: 's-fridge2',
    headline: 'Fridge 2 has run 1.5°C warmer on Wednesday closes for 4 weeks',
    detail:
      "Still inside safe range but consistent. Not enough to alert on, but you've also mentioned the noise twice. Worth a sentence today?",
    prompt: "Fridge 2 has been running warmer on Wednesday closes — ",
    suggestedTags: ['Equipment'],
  },
  {
    id: 's-tuesday-cover',
    headline: 'Tuesday lunch covers landed +14% above forecast 3 weeks running',
    detail:
      "Your forecast is treating these as outliers. If you've noticed a reason — a regular group, a local event — I can bake it in.",
    prompt: "Tuesday lunch has been busier than forecast because ",
    suggestedTags: ['Customer'],
  },
  {
    id: 's-pastry-3pm',
    headline: 'Pastry waste after 3pm up 40% — same pattern, 3 days running',
    detail:
      "Maps to an over-pull on the morning batch. A note from you on whether this is a one-off ramp or a new normal would help me right-size tomorrow's prep.",
    prompt: "The pastry waste after 3pm is happening because ",
    suggestedTags: ['Team', 'Customer'],
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

  const today = useMemo(() => {
    return new Intl.DateTimeFormat('en-GB', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
    }).format(new Date());
  }, []);

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

  function loadFromSignal(s: DataSignal) {
    setTextNote(s.prompt);
    setActiveTags(new Set(s.suggestedTags));
    setRecordState('idle');
  }

  function dismissSignal(id: string) {
    setDismissedSignals((prev) => {
      const n = new Set(prev);
      n.add(id);
      return n;
    });
  }

  const visibleEntries = filterTag
    ? PAST_ENTRIES.filter((e) => e.tags.includes(filterTag))
    : PAST_ENTRIES;

  const visibleSignals = DATA_SIGNALS.filter((s) => !dismissedSignals.has(s.id));

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'minmax(0, 1fr) 320px',
        gap: 24,
        padding: '24px 28px 64px',
        maxWidth: 1280,
        margin: '0 auto',
        alignItems: 'start',
      }}
    >
      {/* ─── MAIN COLUMN ────────────────────────────────────────────────── */}
      <div style={{ minWidth: 0, display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div>
          <h1
            style={{
              margin: 0,
              fontSize: 22,
              fontWeight: 700,
              color: 'var(--color-text-primary)',
              fontFamily: 'var(--font-primary)',
            }}
          >
            Notebook
          </h1>
          <p
            style={{
              margin: '4px 0 0',
              fontSize: 13,
              color: 'var(--color-text-secondary)',
              lineHeight: 1.5,
              maxWidth: 560,
            }}
          >
            Tell Edify what happened today that the numbers won&apos;t show. It threads
            through everything you said before and lines up what the data
            noticed on its own.
          </p>
        </div>

        {filterTag && (
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              padding: '6px 10px',
              background: 'rgba(0,28,53,0.05)',
              border: '1px solid rgba(0,28,53,0.18)',
              borderRadius: 999,
              fontSize: 12,
              fontWeight: 600,
              color: 'var(--color-accent-active)',
              alignSelf: 'flex-start',
            }}
          >
            <Tag size={12} strokeWidth={2.2} />
            Filtered by {filterTag}
            <button
              type="button"
              onClick={() => setFilterTag(null)}
              aria-label="Clear filter"
              style={{
                all: 'unset',
                cursor: 'pointer',
                display: 'inline-flex',
                marginLeft: 2,
                color: 'var(--color-accent-active)',
              }}
            >
              <X size={12} strokeWidth={2.4} />
            </button>
          </div>
        )}

        {/* ─── Today's compose ──────────────────────────────────────────── */}
        {!filterTag && (
          <article
            style={{
              padding: 18,
              borderRadius: 12,
              background: '#fff',
              border: '1px solid var(--color-border-subtle)',
              boxShadow: '0 1px 4px rgba(58,48,40,0.06)',
              display: 'flex',
              flexDirection: 'column',
              gap: 12,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12 }}>
              <span
                style={{
                  fontSize: 11,
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
                    fontSize: 11,
                    fontWeight: 600,
                    color: 'var(--color-text-muted)',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 4,
                  }}
                >
                  <Plus size={12} strokeWidth={2.2} /> Add another
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
                    padding: '12px 14px',
                    border: '1px solid var(--color-border-subtle)',
                    borderRadius: 10,
                    fontFamily: 'var(--font-primary)',
                    fontSize: 14,
                    lineHeight: 1.55,
                    color: 'var(--color-text-primary)',
                    resize: 'vertical',
                    minHeight: 110,
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
                      padding: '8px 14px',
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
                      fontSize: 12,
                      fontWeight: 700,
                      fontFamily: 'var(--font-primary)',
                      cursor: 'pointer',
                    }}
                  >
                    {recordState === 'recording' ? (
                      <Square size={12} strokeWidth={2.4} fill="currentColor" />
                    ) : (
                      <Mic size={12} strokeWidth={2.2} />
                    )}
                    {recordState === 'recording' ? 'Stop & transcribe' : 'Record voice'}
                  </button>

                  <span
                    style={{
                      fontSize: 11,
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
                      padding: '8px 16px',
                      borderRadius: 8,
                      border: 'none',
                      background: textNote.trim()
                        ? 'var(--color-accent-active)'
                        : 'var(--color-bg-hover)',
                      color: textNote.trim() ? '#fff' : 'var(--color-text-muted)',
                      fontSize: 12,
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
                          padding: '5px 11px',
                          borderRadius: 999,
                          border: active
                            ? '1px solid var(--color-accent-active)'
                            : '1px solid var(--color-border-subtle)',
                          background: active ? 'var(--color-accent-active)' : '#fff',
                          color: active ? '#fff' : 'var(--color-text-secondary)',
                          fontSize: 11,
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

            {savedToday && (
              <SavedToday saved={savedToday} />
            )}
          </article>
        )}

        {/* ─── Past entries (running document) ──────────────────────────── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {visibleEntries.length === 0 && (
            <p
              style={{
                fontSize: 13,
                color: 'var(--color-text-muted)',
                fontStyle: 'italic',
                padding: '20px 0',
              }}
            >
              No entries tagged {filterTag}.
            </p>
          )}
          {visibleEntries.map((entry) => (
            <PastEntryBlock key={entry.id} entry={entry} onTagClick={setFilterTag} />
          ))}
        </div>
      </div>

      {/* ─── RIGHT RAIL ─────────────────────────────────────────────────── */}
      <aside
        style={{
          position: 'sticky',
          top: 24,
          display: 'flex',
          flexDirection: 'column',
          gap: 14,
          minWidth: 0,
        }}
      >
        <section
          style={{
            padding: 14,
            borderRadius: 12,
            background: '#fff',
            border: '1px solid var(--color-border-subtle)',
            boxShadow: '0 1px 4px rgba(58,48,40,0.06)',
          }}
        >
          <header
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 7,
              marginBottom: 10,
            }}
          >
            <Pencil size={12} strokeWidth={2.2} color="var(--color-text-secondary)" />
            <span
              style={{
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
                color: 'var(--color-text-secondary)',
              }}
            >
              Themes you&apos;ve mentioned
            </span>
          </header>
          <p
            style={{
              margin: '0 0 12px',
              fontSize: 11.5,
              color: 'var(--color-text-muted)',
              lineHeight: 1.5,
            }}
          >
            Pulled from your last 30 days of notes.
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
                    gap: 2,
                    width: '100%',
                    padding: '8px 10px',
                    borderRadius: 8,
                    border:
                      filterTag === t.tag
                        ? '1px solid var(--color-accent-active)'
                        : '1px solid var(--color-border-subtle)',
                    background: filterTag === t.tag ? 'rgba(0,28,53,0.04)' : '#fff',
                    boxSizing: 'border-box',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 6 }}>
                    <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--color-text-primary)' }}>
                      {t.tag}
                    </span>
                    <span style={{ fontSize: 11, color: 'var(--color-text-muted)', fontWeight: 600 }}>
                      {t.count} mentions
                    </span>
                  </div>
                  <span
                    style={{
                      fontSize: 11.5,
                      color: 'var(--color-text-secondary)',
                      lineHeight: 1.45,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      display: '-webkit-box',
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: 'vertical',
                    }}
                  >
                    {t.preview}
                  </span>
                  <span style={{ fontSize: 10.5, color: 'var(--color-text-muted)', marginTop: 2 }}>
                    Last · {t.lastSeen}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </section>

        <section
          style={{
            padding: 14,
            borderRadius: 12,
            background: '#fff',
            border: '1px solid var(--color-border-subtle)',
            boxShadow: '0 1px 4px rgba(58,48,40,0.06)',
          }}
        >
          <header
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 7,
              marginBottom: 10,
            }}
          >
            <Sparkles size={12} strokeWidth={2.2} color="var(--color-accent-active)" />
            <span
              style={{
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
                color: 'var(--color-accent-active)',
              }}
            >
              What your data&apos;s telling us
            </span>
          </header>
          <p
            style={{
              margin: '0 0 12px',
              fontSize: 11.5,
              color: 'var(--color-text-muted)',
              lineHeight: 1.5,
            }}
          >
            Patterns Edify picked up — your note will close the loop.
          </p>
          <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
            {visibleSignals.length === 0 && (
              <li style={{ fontSize: 11.5, color: 'var(--color-text-muted)', fontStyle: 'italic' }}>
                Nothing new today. I&apos;ll keep watching.
              </li>
            )}
            {visibleSignals.map((s) => (
              <li
                key={s.id}
                style={{
                  padding: 10,
                  borderRadius: 8,
                  border: '1px solid var(--color-border-subtle)',
                  background: 'var(--color-bg-hover)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 6,
                }}
              >
                <p
                  style={{
                    margin: 0,
                    fontSize: 12,
                    fontWeight: 700,
                    color: 'var(--color-text-primary)',
                    lineHeight: 1.4,
                  }}
                >
                  {s.headline}
                </p>
                <p
                  style={{
                    margin: 0,
                    fontSize: 11.5,
                    color: 'var(--color-text-secondary)',
                    lineHeight: 1.5,
                  }}
                >
                  {s.detail}
                </p>
                <div style={{ display: 'flex', gap: 6, marginTop: 2 }}>
                  <button
                    type="button"
                    onClick={() => loadFromSignal(s)}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 3,
                      padding: '4px 10px',
                      borderRadius: 6,
                      border: 'none',
                      background: 'var(--color-accent-active)',
                      color: '#fff',
                      fontSize: 11,
                      fontWeight: 700,
                      fontFamily: 'var(--font-primary)',
                      cursor: 'pointer',
                    }}
                  >
                    Add a note
                    <ChevronRight size={11} strokeWidth={2.4} />
                  </button>
                  <button
                    type="button"
                    onClick={() => dismissSignal(s.id)}
                    style={{
                      padding: '4px 10px',
                      borderRadius: 6,
                      border: '1px solid var(--color-border-subtle)',
                      background: '#fff',
                      color: 'var(--color-text-muted)',
                      fontSize: 11,
                      fontWeight: 600,
                      fontFamily: 'var(--font-primary)',
                      cursor: 'pointer',
                    }}
                  >
                    Not now
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      </aside>
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
          padding: '10px 12px',
          borderRadius: 8,
          background: 'var(--color-bg-hover)',
          border: '1px solid var(--color-border-subtle)',
          fontSize: 13,
          color: 'var(--color-text-primary)',
          lineHeight: 1.55,
        }}
      >
        <div
          style={{
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: '0.06em',
            textTransform: 'uppercase',
            color: 'var(--color-text-muted)',
            marginBottom: 4,
          }}
        >
          You {saved.tags.length > 0 ? `· ${saved.tags.join(' · ')}` : ''}
        </div>
        {saved.note}
      </div>
      <div
        style={{
          padding: '10px 12px',
          borderRadius: 8,
          background: 'rgba(0,28,53,0.05)',
          border: '1px solid rgba(0,28,53,0.18)',
          fontSize: 13,
          color: 'var(--color-text-primary)',
          lineHeight: 1.55,
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 5,
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: '0.06em',
            textTransform: 'uppercase',
            color: 'var(--color-accent-active)',
            marginBottom: 4,
          }}
        >
          <CheckCircle2 size={11} strokeWidth={2.4} /> Edify
        </div>
        {saved.reply}
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
        padding: 16,
        borderRadius: 12,
        background: '#fff',
        border: '1px solid var(--color-border-subtle)',
        boxShadow: '0 1px 3px rgba(58,48,40,0.04)',
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
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
            fontSize: 11,
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
          fontSize: 14,
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
                padding: '3px 9px',
                borderRadius: 999,
                border: '1px solid var(--color-border-subtle)',
                background: '#fff',
                color: 'var(--color-text-secondary)',
                fontSize: 10.5,
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
          padding: '10px 12px',
          borderRadius: 8,
          background: 'rgba(0,28,53,0.05)',
          border: '1px solid rgba(0,28,53,0.18)',
          fontSize: 12.5,
          color: 'var(--color-text-primary)',
          lineHeight: 1.55,
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 5,
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: '0.06em',
            textTransform: 'uppercase',
            color: 'var(--color-accent-active)',
            marginBottom: 4,
          }}
        >
          <CheckCircle2 size={11} strokeWidth={2.4} /> Edify
        </div>
        {entry.edifyReply}
      </div>

      {entry.outcome && (
        <div
          style={{
            padding: '8px 12px',
            borderRadius: 8,
            background: 'rgba(26,92,58,0.06)',
            border: '1px solid rgba(26,92,58,0.18)',
            fontSize: 12,
            color: 'var(--color-text-primary)',
            lineHeight: 1.5,
            display: 'flex',
            gap: 6,
          }}
        >
          <span
            style={{
              fontSize: 10,
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
