'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { InStoreFix, ReplySettings, ResolveChoice } from './model';
import { canDraft, composeReply, isThankYou, ownLineRequired, signOff, thankYouText, type LiveTicket, type SendInput } from './feedbackState';

export type Variant = 'standard' | 'shorter' | 'warmer';

/**
 * One reply in progress: Edify's draft (always editable), the manager's own
 * line, the sign-off and when the ticket counts as resolved.
 */
export function useReplyDraft(t: LiveTicket, settings: ReplySettings, start: Variant = 'standard') {
  const drafted = canDraft(t);
  const [variant, setVariant] = useState<Variant>(start);
  const [edited, setEdited] = useState<string | null>(null);
  const [ownLine, setOwnLineState] = useState('');
  const [fromVoice, setFromVoice] = useState(false);
  const [choice, setChoice] = useState<ResolveChoice>(t.rippleId && t.ripple?.kind !== 'praise' ? 'ripple' : 'reply');
  const [fix, setFix] = useState<InStoreFix | null>(null);
  const [fixNote, setFixNote] = useState('');

  const sign = signOff(t.storeId, settings);
  const draft = !drafted ? '' : isThankYou(t) ? thankYouText(t, settings).split('\n\n')[0] : (t.drafts?.[variant] ?? '');
  const body = edited ?? draft;
  const needLine = ownLineRequired(t, settings);
  const missingLine = needLine && !ownLine.trim();
  const missingFix = choice === 'in-store' && !fix;
  const canSend = body.trim().length > 0 && !missingLine && !missingFix;

  const pickVariant = (v: Variant) => {
    setVariant(prev => (prev === v ? 'standard' : v));
    setEdited(null);
  };

  const setOwnLine = (text: string, voice = false) => {
    setOwnLineState(text);
    setFromVoice(voice);
  };

  const input = (): SendInput => ({
    reply: composeReply(body, drafted ? ownLine : undefined, sign),
    ownLine: ownLine.trim() || undefined,
    ownLineFromVoice: fromVoice,
    choice,
    fix: choice === 'in-store' ? fix ?? undefined : undefined,
    fixNote: choice === 'in-store' ? fixNote.trim() || undefined : undefined,
  });

  return {
    drafted, variant, pickVariant, body, setBody: setEdited, ownLine, setOwnLine, fromVoice, sign, needLine, missingLine,
    choice, setChoice, fix, setFix, fixNote, setFixNote, missingFix, canSend, input,
  };
}

// ── Voice for "Your line" ──────────────────────────────────────────

type Recognition = {
  lang: string;
  interimResults: boolean;
  maxAlternatives: number;
  start: () => void;
  stop: () => void;
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onend: (() => void) | null;
  onerror: ((e: { error: string }) => void) | null;
};

type RecognitionCtor = new () => Recognition;

function recognitionCtor(): RecognitionCtor | null {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as { SpeechRecognition?: RecognitionCtor; webkitSpeechRecognition?: RecognitionCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

/** The browser's speech recognition, where it exists. Falls back to typing; never fakes a recording. */
export function useVoiceLine(onText: (text: string) => void) {
  const [listening, setListening] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [supported, setSupported] = useState(false);
  const rec = useRef<Recognition | null>(null);

  useEffect(() => {
    const id = window.setTimeout(() => setSupported(!!recognitionCtor()), 0);
    return () => {
      window.clearTimeout(id);
      rec.current?.stop();
    };
  }, []);

  const toggle = useCallback(() => {
    const Ctor = recognitionCtor();
    if (!Ctor) {
      setProblem("Voice isn't available in this browser. Type your line instead.");
      return;
    }
    if (listening) {
      rec.current?.stop();
      return;
    }
    const r = new Ctor();
    r.lang = 'en-US';
    r.interimResults = false;
    r.maxAlternatives = 1;
    r.onresult = e => {
      const text = e.results[0]?.[0]?.transcript?.trim();
      if (text) onText(text.charAt(0).toUpperCase() + text.slice(1));
    };
    r.onerror = e => setProblem(e.error === 'not-allowed' ? 'The browser blocked the microphone. Type your line instead.' : "Didn't catch that. Try again or type it.");
    r.onend = () => setListening(false);
    rec.current = r;
    setProblem(null);
    setListening(true);
    r.start();
  }, [listening, onText]);

  return { listening, problem, supported, toggle };
}
