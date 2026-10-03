'use client';

/**
 * GM-led voice stocktake. The area's count list is always on screen and
 * the mic is on: the GM says what they see, in any order, and items tick
 * off where they sit. Edify only speaks to ask about something unclear,
 * or in Guide me, where it prompts item by item. Confirmation happens
 * once per area, on Review.
 *
 * One component, several modes (Count, Guide me, Review, Recording, the
 * All areas sheet), so the mic, list and area strip persist across them.
 * The session itself lives on the page so the grid can share it.
 */

import { Fragment, useEffect, useMemo, useRef, useState, type Dispatch, type SetStateAction } from 'react';
import { Mic, Send, WifiOff, X } from 'lucide-react';
import {
  applyActions,
  areaProgress,
  buildIndex,
  markNone,
  nextOpenArea,
  parseUtterance,
  resolveQuestion,
  type AreaProgress,
  type Heard,
  type Question,
  type Session,
  type VoiceArea,
  type VoiceCommand,
  type VoiceIndex,
  type VoiceItem,
} from './engine';
import {
  AllAreasSheet,
  AreasPanel,
  AreaStrip,
  ControlBar,
  CountedRow,
  DemoController,
  GuideCard,
  HeardStrip,
  ItemRow,
  ProgressLine,
  QuestionCard,
  SectionLabel,
  StatusPill,
  T,
  TabSwitch,
  WIDE_QUERY,
  buttonReset,
  useMediaQuery,
  visuallyHidden,
  type PillMode,
} from './parts';
import { DEMO_STEPS, demoTranscript, examplePhrase, type DemoStep } from './demo';
import { summarise, type SubmitSummary } from './session';
import {
  speak,
  stopSpeaking,
  useAudioRecorder,
  useConnectivity,
  useSpeechInput,
  useSpeechSupported,
} from './useSpeech';

interface Props {
  siteName: string;
  areas: VoiceArea[];
  session: Session;
  setSession: Dispatch<SetStateAction<Session>>;
  /** `?demo=1`: show the demo controller; the mic starts off. */
  demo?: boolean;
  /** The demo's starting point, for Back and Restart. */
  demoSeed?: Session;
  /** Viewing a completed stocktake: read-only, mic off, opens on Review. */
  completed?: { date: string; counterName: string };
  onExit: () => void;
  onUseGrid: () => void;
  /** The GM read the submit summary and is leaving the count. */
  onSubmitted: () => void;
}

type Tab = 'count' | 'review';

function ordinal(n: number): string {
  const v = n % 100;
  if (v >= 11 && v <= 13) return `${n}th`;
  return `${n}${['th', 'st', 'nd', 'rd'][n % 10] ?? 'th'}`;
}

function todayLabel(): string {
  return new Date()
    .toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'short' })
    .replace(',', '');
}

function guideChips(item: VoiceItem): string[] {
  const pack = item.units.find(u => !u.metric && u.toBase > 1);
  const example = pack ? `two ${pack.many}` : item.base.metric ? `two ${item.base.many}` : `six ${item.base.many}`;
  return [example, 'none', 'skip'];
}

function plural(n: number, one: string, many = `${one}s`): string {
  return `${n} ${n === 1 ? one : many}`;
}

// Phones and portrait tablets: one column, area strip, All areas as a
// sheet. Landscape tablets and laptops: All areas becomes a permanent
// rail and the lists sit side by side.
const LAYOUT_CSS = `
.vs-input::placeholder { color: ${T.caption}; opacity: 1; }
.vs-shell { position: relative; height: 100%; max-width: 768px; margin: 0 auto; display: flex; flex-direction: column; }
.vs-body { flex: 1; min-height: 0; display: flex; }
.vs-pane { flex: 1; min-width: 0; display: flex; flex-direction: column; }
.vs-rail { width: 300px; flex: 0 0 auto; display: flex; flex-direction: column; gap: 12px; padding: 4px 16px 16px; border-right: 1px solid ${T.hair}; overflow-y: auto; }
.vs-cols { display: flex; flex-direction: column; gap: 16px; }
.vs-col { display: flex; flex-direction: column; gap: 16px; min-width: 0; }
.vs-wide-only { display: none; }
.vs-items { list-style: none; margin: 8px 0 0; padding: 0; display: flex; flex-direction: column; gap: 8px; }
@media ${WIDE_QUERY} {
  .vs-shell { max-width: 1440px; }
  .vs-pane { padding-top: 4px; }
  .vs-cols { display: grid; grid-template-columns: minmax(0, 1.2fr) minmax(0, 1fr); align-items: start; gap: 8px; }
  .vs-wide-only { display: block; }
  .vs-items-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); }
}
@media (min-width: 1280px) {
  .vs-rail { width: 340px; }
}
`;

export default function VoiceStocktake({
  siteName,
  areas,
  session,
  setSession,
  demo = false,
  demoSeed,
  completed,
  onExit,
  onUseGrid,
  onSubmitted,
}: Props) {
  const index = useMemo(() => buildIndex(areas), [areas]);
  const currentId =
    session.currentAreaId && areas.some(a => a.id === session.currentAreaId)
      ? session.currentAreaId
      : (areas[0]?.id ?? '');
  const area = areas.find(a => a.id === currentId) ?? areas[0];

  const [date] = useState(todayLabel);
  const readOnly = Boolean(completed);
  const [tab, setTab] = useState<Tab>(readOnly ? 'review' : 'count');
  const [guide, setGuide] = useState(false);
  const [listening, setListening] = useState(!readOnly);
  const [micArmed, setMicArmed] = useState(!demo && !readOnly);
  const [micBlocked, setMicBlocked] = useState(false);
  const [recording, setRecording] = useState(
    () => typeof navigator !== 'undefined' && navigator.onLine === false,
  );
  const [recordStartedAt, setRecordStartedAt] = useState<number | null>(null);
  const [clock, setClock] = useState(0);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [sheetHighlight, setSheetHighlight] = useState<string | undefined>();
  const [heard, setHeard] = useState<Heard | null>(null);
  const [interim, setInterim] = useState('');
  const [focusItemId, setFocusItemId] = useState<string | null>(null);
  const [skipped, setSkipped] = useState<string[]>([]);
  const [confirmNone, setConfirmNone] = useState<string | null>(null);
  const [showType, setShowType] = useState(false);
  const [typed, setTyped] = useState('');
  const [live, setLive] = useState('');
  const [toast, setToast] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState<SubmitSummary | null>(null);
  const speechSupported = useSpeechSupported();
  const wide = useMediaQuery(WIDE_QUERY);
  const allButtonRef = useRef<HTMLButtonElement>(null);
  const railHighlightRef = useRef<HTMLButtonElement>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const retryTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  // Replaying demo steps after Back or Restart shouldn't speak or toast.
  const quietRef = useRef(false);

  const progress = useMemo<Record<string, AreaProgress>>(
    () => Object.fromEntries(areas.map(a => [a.id, areaProgress(a, session)])),
    [areas, session],
  );
  const p = progress[currentId];

  const toCount = area ? area.items.filter(i => !session.captures[i.id]) : [];
  const guideQueue = toCount.filter(i => i.countable && !skipped.includes(i.id));
  const prompt = guide ? guideQueue[0] : undefined;
  const areaQuestions = session.questions.filter(q => q.areaId === currentId);
  const counted = area
    ? area.items
        .filter(i => session.captures[i.id])
        .sort((a, b) => session.captures[b.id].at.localeCompare(session.captures[a.id].at))
    : [];

  // Callbacks from the mic, timers and browser events read the latest
  // values from here rather than from stale closures.
  const latest = useRef({
    session,
    currentId,
    guide,
    promptId: prompt?.id,
    focusItemId,
    recording,
    index,
    areas,
  });
  useEffect(() => {
    latest.current = { session, currentId, guide, promptId: prompt?.id, focusItemId, recording, index, areas };
  });

  function commit(next: Session) {
    latest.current.session = next;
    latest.current.currentId =
      next.currentAreaId && latest.current.areas.some(a => a.id === next.currentAreaId)
        ? next.currentAreaId
        : latest.current.currentId;
    setSession(next);
  }

  function showToast(text: string) {
    setToast(text);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 4500);
  }

  function ask(text: string) {
    if (quietRef.current) return;
    if (!speak(text)) showToast(text);
  }

  function goToArea(id: string, utterance?: string) {
    const L = latest.current;
    commit({ ...L.session, currentAreaId: id });
    setTab(readOnly ? 'review' : 'count');
    setSkipped([]);
    setFocusItemId(null);
    setConfirmNone(null);
    setSheetOpen(false);
    setSheetHighlight(undefined);
    const name = L.areas.find(a => a.id === id)?.name ?? 'that area';
    setHeard(utterance ? { utterance, result: `Now counting ${name}`, tone: 'ok' } : null);
    setLive(`Now counting ${name}`);
  }

  function runCommands(commands: VoiceCommand[], utterance: string) {
    const L = latest.current;
    for (const c of commands) {
      switch (c.kind) {
        case 'pause':
          setListening(false);
          stopSpeaking();
          setHeard({ utterance, result: 'Paused. Tap Resume to carry on', tone: 'ok' });
          break;
        case 'resume':
          setListening(true);
          break;
        case 'skip': {
          const item = L.guide && L.promptId ? L.index.items.get(L.promptId) : undefined;
          if (item) {
            setSkipped(prev => [...prev, item.id]);
            setHeard({ utterance, result: `Skipped ${item.name}. It stays uncounted`, tone: 'ok' });
          } else {
            setHeard({ utterance, result: 'Skip works in Guide me. Name the next item instead', tone: 'miss' });
          }
          break;
        }
        case 'repeat': {
          const item = L.guide && L.promptId ? L.index.items.get(L.promptId) : undefined;
          const open = [...L.session.questions].reverse().find(q => q.areaId === L.currentId);
          if (item) ask(`How many ${item.name}?`);
          else if (open) ask(`${open.utterance}. Which one?`);
          else setHeard({ utterance, result: 'Nothing to repeat', tone: 'miss' });
          break;
        }
        case 'switchArea':
          goToArea(c.areaId, utterance);
          break;
        case 'nextArea': {
          const next = nextOpenArea(L.areas, L.session, L.currentId);
          if (next) goToArea(next.id, utterance);
          else setHeard({ utterance, result: 'Every area is finished. Open All areas to submit', tone: 'ok' });
          break;
        }
      }
    }
  }

  function handleUtterance(raw: string) {
    const text = raw.trim();
    if (!text) return;
    const L = latest.current;
    setInterim('');
    if (L.recording) {
      const queued = L.session.queued[L.currentId] ?? [];
      commit({ ...L.session, queued: { ...L.session.queued, [L.currentId]: [...queued, text] } });
      setLive('Recorded');
      return;
    }
    const targetItemId = L.focusItemId ?? (L.guide ? L.promptId : undefined);
    const openCandidates = [...L.session.questions]
      .reverse()
      .filter(q => q.areaId === L.currentId)
      .flatMap(q => q.candidates);
    const actions = parseUtterance(text, { index: L.index, currentAreaId: L.currentId, targetItemId, openCandidates });
    const res = applyActions(L.session, actions, text, {
      index: L.index,
      currentAreaId: L.currentId,
      now: new Date().toISOString(),
    });
    commit(res.session);
    if (res.heard.result) setHeard(res.heard);
    if (res.announce.length) setLive(res.announce.join('. '));
    if (res.speak) ask(res.speak);
    if (res.capturedIds.length) setFocusItemId(null);
    if (res.commands.length) runCommands(res.commands, text);
  }

  function chooseAnswer(questionId: string, choice: string | null) {
    const L = latest.current;
    const res = resolveQuestion(L.session, questionId, choice, {
      index: L.index,
      currentAreaId: L.currentId,
      now: new Date().toISOString(),
    });
    commit(res.session);
    setHeard(res.heard);
    if (res.announce.length) setLive(res.announce.join('. '));
    if (res.speak) ask(res.speak);
  }

  // ─── Recording (no signal) ─────────────────────────────────────────────────

  function startRecording() {
    if (latest.current.recording || readOnly) return;
    latest.current.recording = true;
    const now = Date.now();
    setRecording(true);
    setRecordStartedAt(now);
    setClock(now);
    setInterim('');
    setTab('count');
    stopSpeaking();
    if (demo) {
      const L = latest.current;
      const a = L.areas.find(x => x.id === L.currentId);
      const lines = a ? demoTranscript(a, L.session) : [];
      if (lines.length) {
        commit({
          ...L.session,
          queued: { ...L.session.queued, [L.currentId]: [...(L.session.queued[L.currentId] ?? []), ...lines] },
        });
      }
    }
  }

  function stopRecording() {
    if (!latest.current.recording) return;
    latest.current.recording = false;
    if (retryTimer.current) clearTimeout(retryTimer.current);
    setRecording(false);
    setRecordStartedAt(null);
    const L = latest.current;
    let s = L.session;
    const order = L.areas.filter(a => (s.queued[a.id]?.length ?? 0) > 0);
    let lines = 0;
    for (const a of order) {
      const pending = s.queued[a.id] ?? [];
      const queued = { ...s.queued };
      delete queued[a.id];
      s = { ...s, queued };
      for (const line of pending) {
        const openCandidates = s.questions.filter(q => q.areaId === a.id).flatMap(q => q.candidates);
        const actions = parseUtterance(line, { index: L.index, currentAreaId: a.id, openCandidates }).filter(
          x => x.kind !== 'pause' && x.kind !== 'resume' && x.kind !== 'switchArea' && x.kind !== 'nextArea',
        );
        s = applyActions(s, actions, line, { index: L.index, currentAreaId: a.id, now: new Date().toISOString() }).session;
        lines += 1;
      }
    }
    const reviewId = order[0]?.id ?? L.currentId;
    commit({ ...s, currentAreaId: reviewId });
    setGuide(false);
    setTab('review');
    setFocusItemId(null);
    const name = L.areas.find(a => a.id === reviewId)?.name ?? 'This area';
    setHeard({
      utterance: lines ? `${plural(lines, 'recorded line')}` : 'Back online',
      result: `Back online. ${name} is ready to review`,
      tone: 'ok',
    });
    setLive(`Back online. ${lines ? `${plural(lines, 'recorded line')} processed. ` : ''}${name} is ready to review`);
  }

  useConnectivity(startRecording, stopRecording);

  useEffect(() => {
    if (!recording) return;
    const id = setInterval(() => setClock(Date.now()), 1000);
    return () => clearInterval(id);
  }, [recording]);

  const clips = useAudioRecorder(recording && listening && !demo);

  useSpeechInput({
    active: listening && !recording && !submitted && micArmed && speechSupported && !micBlocked,
    onFinal: handleUtterance,
    onInterim: setInterim,
    onNetworkError: () => {
      startRecording();
      if (retryTimer.current) clearTimeout(retryTimer.current);
      retryTimer.current = setTimeout(() => {
        if (navigator.onLine) stopRecording();
      }, 15000);
    },
    onBlocked: () => {
      setMicBlocked(true);
      setShowType(true);
    },
  });

  // ─── Guide me speaks the next item ─────────────────────────────────────────

  const promptId = prompt?.id;
  const promptName = prompt?.name;
  useEffect(() => {
    if (!guide || !promptName || !listening || recording || submitted || sheetOpen) return;
    speak(`How many ${promptName}?`);
  }, [guide, promptId, promptName, listening, recording, submitted, sheetOpen]);

  // ─── Scripted demo ─────────────────────────────────────────────────────────
  // Driven by the demo controller: Next plays one line, Back and Restart
  // rewind to the seeded state and replay up to the chosen step, Play
  // steps through on a timer.

  const [demoIndex, setDemoIndex] = useState(0);
  const [demoPlaying, setDemoPlaying] = useState(false);
  const demoIndexRef = useRef(0);
  const demoPending = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  function runDemoStep(step: DemoStep) {
    if (step.say) handleUtterance(step.say);
    if (step.choose) {
      const L = latest.current;
      const item = Array.from(L.index.items.values()).find(i => i.name === step.choose);
      const q = [...L.session.questions].reverse().find(x => item && x.candidates.includes(item.id));
      if (q && item) chooseAnswer(q.id, item.id);
    }
  }

  function demoNext() {
    const i = demoIndexRef.current;
    if (i >= DEMO_STEPS.length || demoPending.current) return;
    const step = DEMO_STEPS[i];
    demoIndexRef.current = i + 1;
    setDemoIndex(i + 1);
    if (i + 1 >= DEMO_STEPS.length) setDemoPlaying(false);
    if (!step.say) {
      runDemoStep(step);
      return;
    }
    // A beat of "Hearing" first, as the mic would show.
    setInterim(step.say);
    demoPending.current = setTimeout(() => {
      demoPending.current = undefined;
      runDemoStep(step);
    }, 700);
  }

  function demoGoTo(target: number) {
    if (!demoSeed) return;
    if (demoPending.current) clearTimeout(demoPending.current);
    demoPending.current = undefined;
    stopSpeaking();
    commit(demoSeed);
    setTab('count');
    setGuide(false);
    setSkipped([]);
    setFocusItemId(null);
    setConfirmNone(null);
    setSheetOpen(false);
    setSheetHighlight(undefined);
    setHeard(null);
    setInterim('');
    setSubmitted(null);
    quietRef.current = true;
    for (let i = 0; i < target; i += 1) runDemoStep(DEMO_STEPS[i]);
    quietRef.current = false;
    demoIndexRef.current = target;
    setDemoIndex(target);
  }

  const demoNextRef = useRef(demoNext);
  useEffect(() => {
    demoNextRef.current = demoNext;
  });
  useEffect(() => {
    if (!demoPlaying) return;
    const id = setTimeout(() => demoNextRef.current(), 4500);
    return () => clearTimeout(id);
  }, [demoPlaying, demoIndex]);

  const demoBackRef = useRef(() => {});
  useEffect(() => {
    demoBackRef.current = () => demoGoTo(Math.max(demoIndexRef.current - 1, 0));
  });

  // Arrow keys step the demo, except while typing.
  useEffect(() => {
    if (!demo) return;
    function onKey(e: KeyboardEvent) {
      const el = e.target as HTMLElement | null;
      if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA')) return;
      if (e.key === 'ArrowRight') demoNextRef.current();
      if (e.key === 'ArrowLeft') demoBackRef.current();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [demo]);

  useEffect(
    () => () => {
      if (demoPending.current) clearTimeout(demoPending.current);
    },
    [],
  );

  // "Count it" and "Edit" bring the row into view.
  useEffect(() => {
    if (!focusItemId || tab !== 'count') return;
    document.getElementById(`vs-row-${focusItemId}`)?.scrollIntoView({ block: 'center' });
  }, [focusItemId, tab]);

  useEffect(
    () => () => {
      stopSpeaking();
      if (toastTimer.current) clearTimeout(toastTimer.current);
      if (retryTimer.current) clearTimeout(retryTimer.current);
    },
    [],
  );

  // ─── Actions from taps ─────────────────────────────────────────────────────

  function togglePause() {
    const next = !listening;
    setListening(next);
    if (next) setMicArmed(true);
    else {
      stopSpeaking();
      setInterim('');
    }
  }

  function toggleGuide() {
    setGuide(g => !g);
    setSkipped([]);
    setFocusItemId(null);
    stopSpeaking();
  }

  function countIt(itemId: string) {
    setTab('count');
    setGuide(false);
    setFocusItemId(itemId);
    const name = index.items.get(itemId)?.name;
    if (name) setLive(`Say how many ${name}`);
  }

  function confirmNoneInStock(itemId: string) {
    const item = index.items.get(itemId);
    if (!item) return;
    commit(markNone(latest.current.session, item, new Date().toISOString()));
    setConfirmNone(null);
    setLive(`${item.name}, none in stock`);
  }

  function finishArea() {
    const L = latest.current;
    const next = nextOpenArea(L.areas, L.session, L.currentId);
    commit({ ...L.session, finished: { ...L.session.finished, [L.currentId]: new Date().toISOString() } });
    setSheetHighlight(next?.id);
    if (!wide) {
      setSheetOpen(true);
      return;
    }
    // The rail is already on screen, so point at the next area in it.
    const name = L.areas.find(a => a.id === L.currentId)?.name ?? 'Area';
    setLive(`${name} finished. ${next ? `Up next: ${next.name}` : 'Every area is finished. Submit when ready'}`);
    requestAnimationFrame(() => railHighlightRef.current?.focus());
  }

  function closeSheet() {
    setSheetOpen(false);
    requestAnimationFrame(() => allButtonRef.current?.focus());
  }

  function submit() {
    setSubmitted(summarise(areas, latest.current.session));
    setSheetOpen(false);
    setListening(false);
    stopSpeaking();
  }

  function exit() {
    stopSpeaking();
    onExit();
  }

  function useGrid() {
    stopSpeaking();
    onUseGrid();
  }

  // ─── Derived labels ────────────────────────────────────────────────────────

  const elapsed = recordStartedAt ? Math.max(0, Math.floor((clock - recordStartedAt) / 1000)) : 0;
  const recordingLabel = `Recording · ${Math.floor(elapsed / 60)}:${String(elapsed % 60).padStart(2, '0')}`;
  let pillMode: PillMode = 'listening';
  let pillLabel = 'Listening';
  if (readOnly) {
    pillMode = 'done';
    pillLabel = 'Completed';
  } else if (recording) {
    pillMode = 'recording';
    pillLabel = recordingLabel;
  } else if (!listening || submitted) {
    pillMode = 'paused';
    pillLabel = 'Paused';
  } else if (!micArmed || !speechSupported || micBlocked) {
    pillMode = 'micOff';
    pillLabel = micBlocked ? 'Mic blocked' : !speechSupported ? 'No mic in this browser' : 'Mic off';
  }

  const nextArea = nextOpenArea(areas, session, currentId);
  const uncountedHere = p?.uncounted.length ?? 0;
  const finishLabel =
    uncountedHere === 0
      ? `Finish ${area?.name}`
      : `Finish ${area?.name} with ${uncountedHere} uncounted${nextArea ? ` · next: ${nextArea.name}` : ''}`;
  const totalItems = areas.reduce((n, a) => n + a.items.length, 0);
  const totalCounted = areas.reduce((n, a) => n + progress[a.id].counted, 0);
  const areasToGo = areas.filter(a => !session.finished[a.id]).length;
  const submitLabel = areasToGo ? `Submit stocktake · ${plural(areasToGo, 'area')} to go` : 'Submit stocktake';
  const jumpTarget = nextOpenArea(areas, session, currentId) ?? nextArea;
  const sheetSummary = completed
    ? `${totalCounted} of ${totalItems} counted by ${completed.counterName}`
    : `${totalCounted} of ${totalItems} counted${
        jumpTarget ? ` · say “start ${jumpTarget.name.toLowerCase()}” to jump` : ''
      }`;
  const subtitle = completed
    ? `${siteName} · ${new Date(completed.date).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })} · ${completed.counterName}`
    : `${siteName} · ${date}`;
  const firstCountable = toCount.find(i => i.countable);
  const hint = firstCountable
    ? `Say what you see, in any order. Try “${examplePhrase(firstCountable)}”.`
    : 'Everything here has a count. Open Review to finish this area.';

  if (!area || !p) return null;

  return (
    <section
      role="dialog"
      aria-modal="true"
      aria-label={`Stocktake, ${siteName}`}
      style={{ position: 'fixed', inset: 0, zIndex: 800, background: T.white, fontFamily: 'var(--font-primary)', color: T.navy }}
    >
      <style>{LAYOUT_CSS}</style>
      <div className="vs-shell">
        <header style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px 10px' }}>
          <button
            type="button"
            onClick={exit}
            aria-label={readOnly ? 'Close stocktake' : 'Close stocktake. Your counts are kept'}
            style={{ ...buttonReset, width: 44, height: 44, borderRadius: '50%', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: T.navy, flex: '0 0 auto' }}
          >
            <X size={20} />
          </button>
          <div style={{ flex: 1, minWidth: 0 }}>
            <h1 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>Stocktake</h1>
            <p style={{ margin: 0, fontSize: 12, color: T.caption, ...(readOnly ? {} : { whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }) }}>
              {subtitle}
            </p>
          </div>
          <StatusPill mode={pillMode} label={pillLabel} />
        </header>

        {demo && demoSeed && (
          <DemoController
            index={demoIndex}
            total={DEMO_STEPS.length}
            nextLabel={(() => {
              const step = DEMO_STEPS[demoIndex];
              if (!step) return undefined;
              return step.say ? `“${step.say}”` : `tap “${step.choose}”`;
            })()}
            playing={demoPlaying}
            micOn={micArmed}
            onRestart={() => {
              setDemoPlaying(false);
              demoGoTo(0);
            }}
            onBack={() => {
              setDemoPlaying(false);
              demoGoTo(Math.max(demoIndex - 1, 0));
            }}
            onNext={() => {
              setDemoPlaying(false);
              demoNext();
            }}
            onTogglePlay={() => setDemoPlaying(v => !v)}
            onToggleMic={() => {
              const next = !micArmed;
              setMicArmed(next);
              if (next) setListening(true);
            }}
          />
        )}

        <div className="vs-body">
        {wide && !submitted && (
          <aside className="vs-rail" aria-labelledby="vs-rail-title">
            <AreasPanel
              headingId="vs-rail-title"
              areas={areas}
              progress={progress}
              currentId={currentId}
              highlightId={sheetHighlight}
              highlightRef={railHighlightRef}
              summaryLine={sheetSummary}
              submitLabel={readOnly ? undefined : submitLabel}
              onPick={id => goToArea(id)}
              onSubmit={readOnly ? undefined : submit}
              onUseGrid={readOnly ? undefined : useGrid}
            />
          </aside>
        )}
        <div className="vs-pane">
        {!submitted && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, paddingBottom: 12 }}>
            {!wide && (
              <AreaStrip
                ref={allButtonRef}
                areas={areas}
                progress={progress}
                currentId={currentId}
                onSelect={id => goToArea(id)}
                onOpenAll={() => {
                  setSheetHighlight(undefined);
                  setSheetOpen(true);
                }}
              />
            )}
            <ProgressLine
              name={area.name}
              right={recording ? plural(p.total, 'item') : `${p.counted} of ${p.total} counted`}
              fraction={p.total ? p.counted / p.total : 0}
            />
            {!recording && !readOnly && (
              <TabSwitch
                tab={tab}
                onChange={setTab}
                missed={p.counted > 0 || session.finished[currentId] ? p.uncounted.length : 0}
              />
            )}
          </div>
        )}

        <main style={{ flex: 1, minHeight: 0, overflowY: 'auto', paddingBottom: 16 }}>
          {submitted ? (
            <SubmittedSummary summary={submitted} onDone={onSubmitted} />
          ) : recording ? (
            <RecordingPanel area={area} queued={session.queued[currentId]?.length ?? 0} clips={clips} />
          ) : tab === 'review' ? (
            <ReviewPanel
              area={area}
              progress={p}
              session={session}
              index={index}
              confirmNone={confirmNone}
              onCountIt={countIt}
              onAskNone={setConfirmNone}
              onConfirmNone={confirmNoneInStock}
              onChoose={chooseAnswer}
              readOnly={readOnly}
            />
          ) : (
            <CountList
              lead={
                <>
              {guide && prompt ? (
                <GuideCard item={prompt} chips={guideChips(prompt)} onChip={handleUtterance} />
              ) : guide ? (
                <section style={{ margin: '0 16px', padding: 16, borderRadius: 14, background: T.dark, color: T.white }}>
                  <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>Every item in {area.name} has a count or was skipped.</h3>
                  <button
                    type="button"
                    onClick={() => setTab('review')}
                    style={{ ...buttonReset, marginTop: 12, minHeight: 44, padding: '0 18px', borderRadius: 999, border: `1px solid ${T.white}`, color: T.white, fontSize: 14, fontWeight: 600 }}
                  >
                    Review {area.name}
                  </button>
                </section>
              ) : null}
              {(!guide || (heard && heard.tone !== 'ok') || focusItemId) && (
                <HeardStrip
                  heard={heard}
                  interim={interim}
                  hint={hint}
                  focusName={focusItemId ? index.items.get(focusItemId)?.name : undefined}
                  onCancelFocus={() => setFocusItemId(null)}
                  micOn={pillMode === 'listening'}
                />
              )}
                </>
              }
                area={area}
                toCount={toCount}
                guide={guide}
                guideQueue={guideQueue}
                prompt={prompt}
                skipped={skipped}
                questions={areaQuestions}
                counted={counted}
                session={session}
                index={index}
                focusItemId={focusItemId}
                onChoose={chooseAnswer}
              />
          )}
        </main>

        {!submitted && (readOnly ? (
          <div style={{ padding: '12px 16px max(12px, env(safe-area-inset-bottom))', boxShadow: '0 -6px 20px rgba(8, 32, 94, 0.08)', background: T.white }}>
            <div style={{ maxWidth: 560, margin: '0 auto' }}>
              {(() => {
                const next = areas[areas.findIndex(a => a.id === currentId) + 1];
                return next ? (
                  <button
                    type="button"
                    onClick={() => goToArea(next.id)}
                    style={{ ...buttonReset, width: '100%', minHeight: 56, padding: '8px 20px', borderRadius: 999, background: T.navy, color: T.white, fontSize: 15, fontWeight: 700 }}
                  >
                    Next: {next.name}
                  </button>
                ) : null;
              })()}
              <button
                type="button"
                onClick={exit}
                style={{ ...buttonReset, width: '100%', minHeight: 44, marginTop: 4, fontSize: 14, fontWeight: 600, color: T.dark }}
              >
                Back to stocktakes
              </button>
            </div>
          </div>
        ) : tab === 'count' || recording ? (
          <ControlBar
            listening={listening}
            recording={recording}
            guide={guide}
            showType={showType}
            onTogglePause={togglePause}
            onToggleGuide={toggleGuide}
            onDoneArea={() => {
              const next = nextOpenArea(areas, latest.current.session, currentId);
              if (next) goToArea(next.id);
              else showToast('That was the last area. Your recording processes when you are back online.');
            }}
            onToggleType={() => setShowType(v => !v)}
            onUseGrid={useGrid}
            typeSlot={
              showType ? (
                <form
                  onSubmit={e => {
                    e.preventDefault();
                    handleUtterance(typed);
                    setTyped('');
                  }}
                  style={{ display: 'flex', gap: 8, maxWidth: 420, margin: '10px auto 0' }}
                >
                  <label htmlFor="vs-type" style={visuallyHidden}>
                    Type what you&apos;d say
                  </label>
                  <input
                    id="vs-type"
                    className="vs-input"
                    value={typed}
                    onChange={e => setTyped(e.target.value)}
                    autoFocus
                    autoComplete="off"
                    placeholder="e.g. two cases of coke"
                    style={{ flex: 1, minWidth: 0, minHeight: 44, borderRadius: 999, border: `1px solid ${T.lighter}`, padding: '0 16px', fontSize: 16, fontFamily: 'var(--font-primary)', color: T.navy }}
                  />
                  <button
                    type="submit"
                    aria-label="Send"
                    style={{ ...buttonReset, width: 44, height: 44, borderRadius: '50%', background: T.navy, color: T.white, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flex: '0 0 auto' }}
                  >
                    <Send size={16} />
                  </button>
                </form>
              ) : null
            }
          />
        ) : (
          <div style={{ padding: '12px 16px max(12px, env(safe-area-inset-bottom))', boxShadow: '0 -6px 20px rgba(8, 32, 94, 0.08)', background: T.white }}>
            <div style={{ maxWidth: 560, margin: '0 auto' }}>
            <button
              type="button"
              onClick={finishArea}
              style={{ ...buttonReset, width: '100%', minHeight: 56, padding: '8px 20px', borderRadius: 999, background: T.navy, color: T.white, fontSize: 15, fontWeight: 700 }}
            >
              {finishLabel}
            </button>
            <button
              type="button"
              onClick={() => setTab('count')}
              style={{ ...buttonReset, width: '100%', minHeight: 44, marginTop: 4, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6, fontSize: 14, fontWeight: 600, color: T.dark }}
            >
              Back to counting <Mic size={16} aria-hidden />
            </button>
            </div>
          </div>
        ))}
        </div>
        </div>

        {sheetOpen && !wide && (
          <AllAreasSheet
            areas={areas}
            progress={progress}
            currentId={currentId}
            highlightId={sheetHighlight}
            summaryLine={sheetSummary}
            submitLabel={readOnly ? undefined : submitLabel}
            onPick={id => goToArea(id)}
            onClose={closeSheet}
            onSubmit={readOnly ? undefined : submit}
            onUseGrid={readOnly ? undefined : useGrid}
          />
        )}

        {toast && (
          <div
            role="status"
            style={{ position: 'absolute', left: 16, right: 16, top: 72, zIndex: 6, maxWidth: 480, margin: '0 auto', padding: '12px 16px', borderRadius: 14, background: T.navy, color: T.white, fontSize: 14, fontWeight: 600 }}
          >
            {toast}
          </div>
        )}
        <div aria-live="polite" style={visuallyHidden}>
          {live}
        </div>
      </div>
    </section>
  );
}

// ─── Lists ────────────────────────────────────────────────────────────────────

function CountList({
  lead,
  area,
  toCount,
  guide,
  guideQueue,
  prompt,
  skipped,
  questions,
  counted,
  session,
  index,
  focusItemId,
  onChoose,
}: {
  /** The Heard strip or Guide me card, at the head of the to-count column. */
  lead: React.ReactNode;
  area: VoiceArea;
  toCount: VoiceItem[];
  guide: boolean;
  guideQueue: VoiceItem[];
  prompt?: VoiceItem;
  skipped: string[];
  questions: Question[];
  counted: VoiceItem[];
  session: Session;
  index: VoiceIndex;
  focusItemId: string | null;
  onChoose: (questionId: string, choice: string | null) => void;
}) {
  const card = (q: Question) => (
    <QuestionCard
      key={q.id}
      question={q}
      index={index}
      onChoose={choice => onChoose(q.id, choice)}
      onDismiss={() => onChoose(q.id, null)}
    />
  );

  // A question sits where its first candidate sits in the list.
  const anchorOf = (q: Question) => (q.kind === 'which' ? q.candidates[0] : q.itemId);
  const listedIds = new Set(toCount.map(i => i.id));
  const floating = questions.filter(q => !listedIds.has(anchorOf(q) ?? ''));

  const upcoming = guide
    ? [...guideQueue.slice(prompt ? 1 : 0), ...toCount.filter(i => !i.countable || skipped.includes(i.id))]
    : toCount;

  return (
    <div className="vs-cols">
    <div className="vs-col">
      {lead}
      {(upcoming.length > 0 || questions.length > 0) && (
        <section aria-labelledby="vs-to-count" style={{ padding: '0 16px' }}>
          <div id="vs-to-count">
            <SectionLabel>{guide ? 'Coming up' : `To count · walk order · ${toCount.length}`}</SectionLabel>
          </div>
          <ul className="vs-items">
            {(guide ? questions : floating).map(card)}
            {upcoming.map((item, i) => (
              <Fragment key={item.id}>
                {!guide && questions.filter(q => anchorOf(q) === item.id).map(card)}
                <ItemRow
                  item={item}
                  focused={item.id === focusItemId}
                  right={
                    item.id === focusItemId
                      ? 'Say how many'
                      : !item.countable
                        ? null
                        : guide && skipped.includes(item.id)
                          ? 'Skipped'
                          : guide
                            ? ordinal(i + 2)
                            : 'not yet'
                  }
                />
              </Fragment>
            ))}
          </ul>
        </section>
      )}
      {upcoming.length === 0 && counted.length === 0 && (
        <p style={{ margin: 0, padding: '0 16px', fontSize: 14, color: T.caption }}>Nothing to count in {area.name}.</p>
      )}
    </div>
    <div className="vs-col" style={{ padding: '0 16px' }}>
      {counted.length > 0 ? (
        <section aria-labelledby="vs-counted">
          <div id="vs-counted">
            <SectionLabel>Counted · {counted.length}</SectionLabel>
          </div>
          <ul className="vs-items">
            {counted.map(item => (
              <CountedRow key={item.id} item={item} capture={session.captures[item.id]} />
            ))}
          </ul>
        </section>
      ) : (
        <div className="vs-wide-only">
          <SectionLabel>Counted · 0</SectionLabel>
          <p style={{ margin: '8px 0 0', padding: 16, borderRadius: 14, border: `1px dashed ${T.lighter}`, fontSize: 14, color: T.caption }}>
            Items tick off here as you say them, newest at the top.
          </p>
        </div>
      )}
    </div>
    </div>
  );
}

// ─── Review ───────────────────────────────────────────────────────────────────

function ReviewPanel({
  area,
  progress,
  session,
  index,
  confirmNone,
  onCountIt,
  onAskNone,
  onConfirmNone,
  onChoose,
  readOnly = false,
}: {
  area: VoiceArea;
  progress: AreaProgress;
  session: Session;
  index: VoiceIndex;
  confirmNone: string | null;
  onCountIt: (itemId: string) => void;
  onAskNone: (itemId: string | null) => void;
  onConfirmNone: (itemId: string) => void;
  onChoose: (questionId: string, choice: string | null) => void;
  readOnly?: boolean;
}) {
  const counted = area.items
    .filter(i => session.captures[i.id])
    .sort((a, b) => session.captures[b.id].at.localeCompare(session.captures[a.id].at));
  const tile = (n: number, label: string, bg: string, border: string) => (
    <div style={{ padding: '12px 14px', borderRadius: 14, background: bg, border: `1px solid ${border}` }}>
      <div style={{ fontSize: 24, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{n}</div>
      <div style={{ fontSize: 12, fontWeight: 600 }}>{label}</div>
    </div>
  );
  const smallButton = (filled: boolean): React.CSSProperties => ({
    ...buttonReset,
    flex: 1,
    minHeight: 44,
    padding: '0 12px',
    borderRadius: 999,
    border: `1px solid ${T.navy}`,
    background: filled ? T.navy : T.white,
    color: filled ? T.white : T.navy,
    fontSize: 13,
    fontWeight: 600,
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, padding: '0 16px' }}>
        {tile(progress.counted, 'counted', T.yellow, T.yellow)}
        {tile(progress.uncounted.length, readOnly ? 'not counted' : 'missed', T.lightestPink, T.lightPink)}
        {tile(progress.questions.length, 'to check', T.lighter, T.lighter)}
      </div>

      <div className="vs-cols">
      <div className="vs-col" style={{ padding: '0 16px' }}>
      {progress.uncounted.length === 0 && progress.questions.length === 0 && (
        <p style={{ margin: 0, padding: 16, borderRadius: 14, background: T.yellow, fontSize: 14, fontWeight: 600 }}>
          {readOnly
            ? `Every item in ${area.name} was counted.`
            : <>Every item in {area.name} has a count. Finish the area when you&apos;re ready.</>}
        </p>
      )}
      {progress.uncounted.length > 0 && (
        <section aria-labelledby="vs-missed">
          <div id="vs-missed">
            <SectionLabel>{readOnly ? 'Not counted · left blank' : 'Missed · never mentioned'}</SectionLabel>
          </div>
          <ul className="vs-items">
            {progress.uncounted.map(item => (
              <li key={item.id} style={{ padding: 14, borderRadius: 14, background: T.lightestPink, border: `1px solid ${T.lightPink}` }}>
                <div style={{ fontSize: 14, fontWeight: 600 }}>{item.name}</div>
                <div style={{ fontSize: 12, color: T.caption, marginTop: 2 }}>
                  {item.countable ? item.packLine : 'Needs a counting unit. Set one up in supplier settings, then count it on the list.'}
                </div>
                {item.countable && !readOnly &&
                  (confirmNone === item.id ? (
                    <div role="group" aria-label={`Confirm none in stock for ${item.name}`} style={{ marginTop: 10 }}>
                      <p style={{ margin: 0, fontSize: 14, fontWeight: 600 }}>Mark {item.name} as none in stock?</p>
                      <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                        <button type="button" autoFocus onClick={() => onConfirmNone(item.id)} style={smallButton(true)}>
                          Yes, none in stock
                        </button>
                        <button type="button" onClick={() => onAskNone(null)} style={smallButton(false)}>
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                      <button type="button" onClick={() => onCountIt(item.id)} style={smallButton(true)}>
                        Count it
                      </button>
                      <button type="button" onClick={() => onAskNone(item.id)} style={smallButton(false)}>
                        None in stock
                      </button>
                    </div>
                  ))}
              </li>
            ))}
          </ul>
        </section>
      )}

      {progress.questions.length > 0 && (
        <section aria-labelledby="vs-check">
          <div id="vs-check">
            <SectionLabel>To check</SectionLabel>
          </div>
          <ul className="vs-items">
            {progress.questions.map(q => (
              <QuestionCard
                key={q.id}
                question={q}
                index={index}
                onChoose={choice => onChoose(q.id, choice)}
                onDismiss={() => onChoose(q.id, null)}
              />
            ))}
          </ul>
        </section>
      )}
      </div>

      <div className="vs-col" style={{ padding: '0 16px' }}>
      {counted.length > 0 && (
        <section aria-labelledby="vs-review-counted">
          <div id="vs-review-counted">
            <SectionLabel>Counted · {counted.length}</SectionLabel>
          </div>
          <ul className="vs-items">
            {counted.map(item => (
              <CountedRow key={item.id} item={item} capture={session.captures[item.id]} onEdit={readOnly ? undefined : () => onCountIt(item.id)} />
            ))}
          </ul>
        </section>
      )}
      </div>
      </div>
    </div>
  );
}

// ─── Recording ────────────────────────────────────────────────────────────────

function RecordingPanel({ area, queued, clips }: { area: VoiceArea; queued: number; clips: number }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, padding: '0 16px' }}>
      <section
        aria-label="No signal"
        style={{ display: 'flex', gap: 12, padding: 14, borderRadius: 14, background: T.surface, border: `1px solid ${T.lighter}` }}
      >
        <WifiOff size={20} color={T.dark} aria-hidden style={{ flex: '0 0 auto', marginTop: 2 }} />
        <div>
          <p style={{ margin: 0, fontSize: 14, fontWeight: 700 }}>No signal. We&apos;re recording.</p>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: T.caption }}>
            Say each item and how many. When you&apos;re back online we&apos;ll tick them off, convert the units and ask about anything unclear.
          </p>
          {(queued > 0 || clips > 0) && (
            <p style={{ margin: '6px 0 0', fontSize: 13, fontWeight: 600 }}>
              {queued > 0 ? plural(queued, 'line') : plural(clips, 'clip')} recorded in {area.name}
            </p>
          )}
        </div>
      </section>
      <section aria-labelledby="vs-rec-list">
        <div id="vs-rec-list">
          <SectionLabel>In this area · walk order</SectionLabel>
        </div>
        <ul className="vs-items vs-items-grid">
          {area.items.map(item => (
            <ItemRow key={item.id} item={item} right={null} />
          ))}
        </ul>
      </section>
    </div>
  );
}

// ─── Submitted ────────────────────────────────────────────────────────────────

function SubmittedSummary({ summary, onDone }: { summary: SubmitSummary; onDone: () => void }) {
  const missing = summary.uncounted.reduce((n, a) => n + a.items.length, 0);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, padding: '8px 16px', maxWidth: 680, width: '100%', margin: '0 auto', boxSizing: 'border-box' }}>
      <h2 style={{ margin: 0, fontSize: 22, fontWeight: 700 }}>
        {missing ? `Stocktake submitted with ${plural(missing, 'item')} not counted` : 'Stocktake submitted'}
      </h2>
      <p style={{ margin: 0, fontSize: 15 }}>
        {plural(summary.counted, 'item')} counted
        {summary.none ? `, ${summary.none} none in stock` : ''}, out of {summary.total}.
      </p>
      {missing > 0 && (
        <>
          <p style={{ margin: 0, fontSize: 14, color: T.caption }}>
            These stay blank on the record, flagged as not counted. Edify never records them as zero.
          </p>
          {summary.uncounted.map(group => (
            <section key={group.area} style={{ padding: 14, borderRadius: 14, background: T.lightestPink, border: `1px solid ${T.lightPink}` }}>
              <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700 }}>
                {group.area} · {group.items.length}
              </h3>
              <p style={{ margin: '4px 0 0', fontSize: 13, color: T.caption }}>{group.items.join(', ')}</p>
            </section>
          ))}
        </>
      )}
      <button
        type="button"
        onClick={onDone}
        autoFocus
        style={{ ...buttonReset, minHeight: 56, borderRadius: 999, background: T.navy, color: T.white, fontSize: 15, fontWeight: 700 }}
      >
        Back to stocktakes
      </button>
    </div>
  );
}
