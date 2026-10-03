'use client';

/**
 * Browser speech plumbing for the voice stocktake: continuous en-GB
 * recognition, Edify's spoken questions, connectivity, and local audio
 * recording while there's no signal.
 */

import { useEffect, useRef, useState, useSyncExternalStore } from 'react';

interface RecognitionAlternative {
  transcript: string;
}
interface RecognitionResult {
  isFinal: boolean;
  0: RecognitionAlternative;
}
interface RecognitionEvent {
  resultIndex: number;
  results: ArrayLike<RecognitionResult>;
}
interface RecognitionErrorEvent {
  error: string;
}
interface Recognition {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start(): void;
  abort(): void;
  onresult: ((e: RecognitionEvent) => void) | null;
  onerror: ((e: RecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
}
type RecognitionCtor = new () => Recognition;

function recognitionCtor(): RecognitionCtor | null {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as {
    SpeechRecognition?: RecognitionCtor;
    webkitSpeechRecognition?: RecognitionCtor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

const noopSubscribe = () => () => {};

/** Whether this browser can do live speech recognition. */
export function useSpeechSupported(): boolean {
  return useSyncExternalStore(
    noopSubscribe,
    () => recognitionCtor() !== null,
    () => true,
  );
}

// Edify's own voice must not be heard back as the GM speaking.
let speakingUntil = 0;

/** Speak a question in en-GB. Returns false when the browser can't. */
export function speak(text: string): boolean {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return false;
  const synth = window.speechSynthesis;
  synth.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = 'en-GB';
  const voice = synth.getVoices().find(v => v.lang === 'en-GB');
  if (voice) u.voice = voice;
  speakingUntil = Number.POSITIVE_INFINITY;
  u.onend = () => {
    speakingUntil = Date.now() + 400;
  };
  u.onerror = () => {
    speakingUntil = 0;
  };
  synth.speak(u);
  return true;
}

export function stopSpeaking(): void {
  if (typeof window !== 'undefined' && 'speechSynthesis' in window) window.speechSynthesis.cancel();
  speakingUntil = 0;
}

interface SpeechInputOptions {
  active: boolean;
  onFinal: (text: string) => void;
  onInterim?: (text: string) => void;
  /** Recognition lost its connection: switch to recording. */
  onNetworkError?: () => void;
  /** The GM refused microphone access, or there's no microphone. */
  onBlocked?: () => void;
}

/**
 * Continuous recognition while `active`. Chrome ends a session after a
 * stretch of silence, so it restarts itself until switched off.
 */
export function useSpeechInput({ active, onFinal, onInterim, onNetworkError, onBlocked }: SpeechInputOptions): void {
  const handlers = useRef({ onFinal, onInterim, onNetworkError, onBlocked });
  useEffect(() => {
    handlers.current = { onFinal, onInterim, onNetworkError, onBlocked };
  });

  useEffect(() => {
    const Ctor = recognitionCtor();
    if (!active || !Ctor) return;
    let stopped = false;
    let restart: ReturnType<typeof setTimeout> | undefined;
    const rec = new Ctor();
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = 'en-GB';
    rec.onresult = e => {
      if (Date.now() < speakingUntil) return;
      let interim = '';
      for (let i = e.resultIndex; i < e.results.length; i += 1) {
        const r = e.results[i];
        const text = r[0].transcript.trim();
        if (r.isFinal) {
          if (text) handlers.current.onFinal(text);
        } else {
          interim += `${text} `;
        }
      }
      handlers.current.onInterim?.(interim.trim());
    };
    rec.onerror = e => {
      if (e.error === 'not-allowed' || e.error === 'service-not-allowed' || e.error === 'audio-capture') {
        stopped = true;
        handlers.current.onBlocked?.();
      } else if (e.error === 'network') {
        stopped = true;
        handlers.current.onNetworkError?.();
      }
    };
    rec.onend = () => {
      if (stopped) return;
      restart = setTimeout(() => {
        try {
          rec.start();
        } catch {
          // already started
        }
      }, 300);
    };
    try {
      rec.start();
    } catch {
      // already started
    }
    return () => {
      stopped = true;
      if (restart) clearTimeout(restart);
      rec.onend = null;
      rec.onresult = null;
      rec.onerror = null;
      try {
        rec.abort();
      } catch {
        // not running
      }
    };
  }, [active]);
}

/** Calls back when the browser drops or regains its connection. */
export function useConnectivity(onOffline: () => void, onOnline: () => void): void {
  const handlers = useRef({ onOffline, onOnline });
  useEffect(() => {
    handlers.current = { onOffline, onOnline };
  });
  useEffect(() => {
    const off = () => handlers.current.onOffline();
    const on = () => handlers.current.onOnline();
    window.addEventListener('offline', off);
    window.addEventListener('online', on);
    return () => {
      window.removeEventListener('offline', off);
      window.removeEventListener('online', on);
    };
  }, []);
}

/**
 * Records audio locally while `active` and keeps the clips in memory.
 * Turning recorded audio into text needs a speech-to-text service, which
 * the prototype doesn't have; the clips show the shape of the real
 * offline queue.
 */
export function useAudioRecorder(active: boolean): number {
  const [clips, setClips] = useState(0);
  const chunks = useRef<Blob[]>([]);
  useEffect(() => {
    if (!active || typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) return;
    if (typeof MediaRecorder === 'undefined') return;
    let recorder: MediaRecorder | null = null;
    let stream: MediaStream | null = null;
    let cancelled = false;
    navigator.mediaDevices
      .getUserMedia({ audio: true })
      .then(s => {
        if (cancelled) {
          s.getTracks().forEach(t => t.stop());
          return;
        }
        stream = s;
        recorder = new MediaRecorder(s);
        recorder.ondataavailable = e => {
          if (e.data.size > 0) {
            chunks.current.push(e.data);
            setClips(chunks.current.length);
          }
        };
        recorder.start(5000);
      })
      .catch(() => {
        // No mic permission: typed lines still queue.
      });
    return () => {
      cancelled = true;
      if (recorder && recorder.state !== 'inactive') recorder.stop();
      stream?.getTracks().forEach(t => t.stop());
    };
  }, [active]);
  return clips;
}
