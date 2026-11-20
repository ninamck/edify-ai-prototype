'use client';

import { useCallback, useEffect, useRef, useState, type Dispatch, type SetStateAction } from 'react';
import { speak, stopSpeaking, useSpeechInput, useSpeechSupported } from '@/components/Stock/voice/useSpeech';
import { FLOOR_TASKS } from '@/lib/floorTasks/registry';
import type { CommandResponse, FloorTurn, Proposal, Receipt, Surface } from '@/lib/floorTasks/types';
import { composeReadback, confirmMode, isBareUndo, isYes, parseNo, speakReceipt } from '@/lib/floorTasks/voice';
import {
  addProposals, buildSnapshot, confirmProposal, declineProposal, expireWaiting, getProposal, getWorld, stageUndo,
} from '@/lib/floorTasks/world/store';

/** The subset of a chat message this hook writes. */
export interface FloorChatMsg {
  id: string;
  role: 'user' | 'quinn';
  text: string;
  msgType?: string;
  cmdArgsJson?: string;
  streaming?: boolean;
}

/** Words that suggest a floor task. Anything else skips the model and
 *  goes straight to the chat's existing flows. */
const FLOOR_HINT =
  /\b(\d+|one|two|three|four|five|six|seven|eight|nine|ten|dozen|half|waste|wasted|binned|bin|chucked|threw|dropped|spilt|spilled|out of date|expired|stale|gone off|on hand|have|got|left|count|counting|delivery|delivered|arrived|here|accept|transfer|send|sending|request|ask|par|batch|add|extra|done|finished|started|start|starting|fridge|freezer|temperature|degrees|checklist|labels|basket|undo|cancel|scrap|allergens?|contains?|arriving|make|busy|quiet|market|toasties?|natoora|notora|bidvest|bidfood)\b/i;

const DEMO_NOTE =
  'Demo mode: no model is connected, so Edify is reading floor tasks with set patterns. Everyday phrasings work. Anything it doesn\'t recognise goes to the normal chat.';

let seq = 0;
const mid = (p: string) => `${p}-${Date.now().toString(36)}-${(seq += 1)}`;

export function useFloorTasks<M extends FloorChatMsg>(setMessages: Dispatch<SetStateAction<M[]>>) {
  const history = useRef<FloorTurn[]>([]);
  const awaitingYes = useRef<string[]>([]);
  const undoReasonFor = useRef<string | null>(null);
  const inConversation = useRef(false);
  const demoNoted = useRef(false);
  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState('');
  const voiceTurn = useRef(false);
  const speechSupported = useSpeechSupported();

  useEffect(() => {
    expireWaiting();
    const t = window.setInterval(() => expireWaiting(), 60_000);
    return () => window.clearInterval(t);
  }, []);

  const push = useCallback(
    (...msgs: FloorChatMsg[]) => setMessages((prev) => [...prev, ...(msgs as M[])]),
    [setMessages],
  );

  const say = useCallback(
    (text: string, opts: { stream?: boolean } = {}) => {
      history.current.push({ role: 'edify', text });
      push({ id: mid('q-floor'), role: 'quinn', text, streaming: opts.stream ?? true });
      if (getWorld().surface === 'headset' || voiceTurn.current) speak(text);
    },
    [push],
  );

  const pushCard = useCallback(
    (proposalId: string) => push({ id: mid('q-floor-card'), role: 'quinn', text: '', msgType: 'floor-proposal', cmdArgsJson: JSON.stringify({ proposalId }) }),
    [push],
  );

  const looksLikeFloor = useCallback((text: string) => {
    if (text.trim().startsWith('/')) return false;
    return inConversation.current || awaitingYes.current.length > 0 || !!undoReasonFor.current || FLOOR_HINT.test(text);
  }, []);

  /** Confirm everything awaiting a spoken yes, in order. */
  const confirmAwaiting = useCallback(() => {
    const ids = awaitingYes.current;
    awaitingYes.current = [];
    const done: string[] = [];
    const failed: string[] = [];
    for (const id of ids) {
      const res = confirmProposal(id);
      if (res.ok) done.push(speakReceipt(res.receipt));
      else failed.push(res.error);
    }
    say([...done, ...failed].join(' ') || 'Nothing was waiting for a yes.');
  }, [say]);

  const stageAndOffer = useCallback(
    (proposals: Proposal[]) => {
      const surface = getWorld().surface;
      const items = proposals.map((p) => ({ p, mode: confirmMode(p, surface) }));
      addProposals(proposals, items.filter((i) => i.mode === 'waiting').map((i) => i.p.id));
      awaitingYes.current = items.filter((i) => FLOOR_TASKS[i.p.taskId].tier === 'say').map((i) => i.p.id);
      const text = composeReadback(items, surface);
      say(text);
      for (const i of items) if (i.mode === 'card') pushCard(i.p.id);
    },
    [pushCard, say],
  );

  /** Returns false when the words weren't a floor task, so the chat can
   *  carry on with its existing flows. */
  const handle = useCallback(
    async (text: string, userMsg: FloorChatMsg, opts: { voice?: boolean } = {}): Promise<boolean> => {
      voiceTurn.current = !!opts.voice;
      let t = text.trim();
      stopSpeaking();

      if (undoReasonFor.current) {
        const receiptId = undoReasonFor.current;
        undoReasonFor.current = null;
        push(userMsg);
        history.current.push({ role: 'user', text: t });
        const no = parseNo(t);
        if (no.no && !no.rest) {
          say('Kept it. Nothing has changed.');
          return true;
        }
        if (t.length < 3) {
          undoReasonFor.current = receiptId;
          say('Give me a reason of at least 3 characters. Why are you deleting this?');
          return true;
        }
        const p = stageUndo(receiptId, t);
        if (!p) {
          say('That one has gone. Nothing has changed.');
          return true;
        }
        stageAndOffer([{ ...p, readback: `Delete "${p.label.replace(/^Undo: /, '')}" because ${t}?` }]);
        return true;
      }

      if (awaitingYes.current.length) {
        if (isYes(t)) {
          push(userMsg);
          history.current.push({ role: 'user', text: t });
          confirmAwaiting();
          return true;
        }
        const no = parseNo(t);
        if (no.no) {
          for (const id of awaitingYes.current) declineProposal(id);
          awaitingYes.current = [];
          if (!no.rest) {
            push(userMsg);
            history.current.push({ role: 'user', text: t });
            say('Nothing has changed.');
            return true;
          }
          t = no.rest;
        }
        awaitingYes.current = [];
      }

      if (isBareUndo(t)) {
        push(userMsg);
        history.current.push({ role: 'user', text: t });
        const last = [...getWorld().receipts].reverse().find((r) => !r.undone && r.taskId !== 'undo');
        if (!last) {
          say('There\'s nothing to undo yet.');
          return true;
        }
        if (last.undo.kind === 'none') {
          say(last.undo.why);
          return true;
        }
        if (last.undo.kind === 'delete-with-reason') {
          undoReasonFor.current = last.id;
          say(`Delete "${last.headline}"? Why are you deleting this?`);
          return true;
        }
        const p = stageUndo(last.id);
        if (p) stageAndOffer([p]);
        return true;
      }

      if (!looksLikeFloor(t)) return false;

      const thinkingId = mid('q-floor-thinking');
      push(userMsg, { id: thinkingId, role: 'quinn', text: '', msgType: 'cmd-thinking' });
      let res: CommandResponse;
      try {
        const r = await fetch('/api/command', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: t, history: history.current.slice(-8), snapshot: buildSnapshot() }),
        });
        res = (await r.json()) as CommandResponse;
      } catch {
        res = { route: 'other', say: '', proposals: [], toolsCalled: [], error: 'network' };
      }

      if (res.route !== 'floor' || !Array.isArray(res.proposals)) {
        setMessages((prev) => prev.filter((m) => m.id !== thinkingId && m.id !== userMsg.id));
        inConversation.current = false;
        return false;
      }

      setMessages((prev) => prev.filter((m) => m.id !== thinkingId));
      if (res.engine === 'demo' && !demoNoted.current) {
        demoNoted.current = true;
        push({ id: mid('q-floor-demo'), role: 'quinn', text: DEMO_NOTE, streaming: false });
      }
      history.current.push({ role: 'user', text: t });
      if (res.proposals.length) {
        inConversation.current = false;
        stageAndOffer(res.proposals);
      } else {
        const reply = res.say || 'Nothing has changed.';
        inConversation.current = /\?\s*$/.test(reply);
        say(reply);
      }
      return true;
    },
    [confirmAwaiting, looksLikeFloor, push, say, setMessages, stageAndOffer],
  );

  /** A tap on a card's confirm. Reads the result out when voice is on. */
  const onApplied = useCallback((receipt: Receipt) => {
    awaitingYes.current = awaitingYes.current.filter((id) => id !== receipt.proposalId);
    if (getWorld().surface === 'headset' || voiceTurn.current) speak(speakReceipt(receipt));
  }, []);

  const onUndo = useCallback(
    (receiptId: string) => {
      const r = getWorld().receipts.find((x) => x.id === receiptId);
      if (!r) return;
      if (r.undo.kind === 'delete-with-reason') {
        const p = stageUndo(receiptId);
        if (p) pushCard(p.id);
        return;
      }
      const p = stageUndo(receiptId);
      if (p) stageAndOffer([p]);
    },
    [pushCard, stageAndOffer],
  );

  /** Open a Waiting for you item as a card in the chat. */
  const openProposal = useCallback(
    (proposalId: string) => {
      const p = getProposal(proposalId);
      if (!p) return;
      push({ id: mid('q-floor'), role: 'quinn', text: `From Waiting for you: ${p.label}.`, streaming: false });
      pushCard(proposalId);
    },
    [push, pushCard],
  );

  return {
    looksLikeFloor,
    handle,
    onApplied,
    onUndo,
    openProposal,
    voice: { supported: speechSupported, listening, setListening, interim, setInterim },
  };
}

/** Push-to-talk on the app, always listening on a headset. */
export function useFloorVoice(opts: {
  surface: Surface;
  listening: boolean;
  setListening: (on: boolean) => void;
  setInterim: (t: string) => void;
  onFinal: (text: string) => void;
}) {
  const headset = opts.surface === 'headset';
  useSpeechInput({
    active: opts.listening,
    onFinal: (text) => {
      opts.setInterim('');
      if (!headset) opts.setListening(false);
      opts.onFinal(text);
    },
    onInterim: opts.setInterim,
    onBlocked: () => opts.setListening(false),
    onNetworkError: () => opts.setListening(false),
  });
}
