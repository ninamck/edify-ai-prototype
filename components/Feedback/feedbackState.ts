'use client';

import { useCallback, useMemo } from 'react';
import { usePretState } from '@/components/Pret/pretStore';
import { DEMO_NOW, DEFAULT_SETTINGS, RIPPLE_HUDDLE_LINE, RIPPLES, storeById, TEAM_NAMES, TICKETS } from './dunkinData';
import { isComplaint } from './model';
import type { InStoreFix, ReplySettings, ResolveChoice, Ripple, RippleState, RippleStatus, Store, StoreId, Ticket, TicketState } from './model';

export type LiveTicket = Ticket & TicketState & { store: Store; ripple?: Ripple };

export type LiveRipple = Omit<Ripple, 'status'> & {
  status: RippleStatus;
  told?: boolean;
  tickets: LiveTicket[];
  /** Tickets not yet resolved. */
  open: LiveTicket[];
};

const NO_TICKET_CHANGES: Record<string, Partial<TicketState>> = {};
const NO_RIPPLE_CHANGES: Record<string, RippleState> = {};

// ── Rules ──────────────────────────────────────────────────────────

export const firstName = (guest: string) => guest.split(' ')[0];

/** A compliment with no comment. */
export const isThankYou = (t: Ticket) => t.reason === 'Compliment' && !t.words;

/** Open, unanswered and with words to answer. FYI-only feedback is for the store to see, not to answer. */
export const needsReply = (t: LiveTicket) => t.status === 'open' && !t.reply && !!t.words && !t.fyiOnly;

/** A complaint with no comment, waiting on its ripple's fix rather than a reply. */
export const isHeldForFix = (t: LiveTicket) => t.status === 'open' && !t.words && isComplaint(t.reason) && !!t.rippleId;

/** Allergy, food safety, a named team member and refunds are never drafted. */
export const canDraft = (t: Ticket) => !t.flag;

export const isSafety = (t: Ticket) => t.flag === 'allergy' || t.flag === 'food-safety';

export const ownLineRequired = (t: Ticket, s: ReplySettings) => s.ownLine && isComplaint(t.reason) && canDraft(t);

export function signOff(storeId: StoreId, s: ReplySettings): string {
  const store = storeById(storeId);
  return s.signAs === 'manager' ? `${store.managerFirst}, Dunkin ${store.name}` : `The Dunkin ${store.name} team`;
}

export const thankYouText = (t: Ticket, s: ReplySettings) => `Thanks for the kind words, ${firstName(t.guest)}. See you soon.\n\n${signOff(t.storeId, s)}`;

export function composeReply(body: string, ownLine: string | undefined, sign: string): string {
  return [body.trim(), ownLine?.trim(), sign].filter(Boolean).join('\n\n');
}

function live(t: Ticket, change: Partial<TicketState> | undefined, s: ReplySettings): LiveTicket {
  const state: TicketState = { status: 'open', ...t.seed, ...change };
  const base = { ...t, ...state, store: storeById(t.storeId), ripple: RIPPLES.find(r => r.id === t.rippleId) };
  if (isThankYou(t) && state.status === 'open' && s.stores[t.storeId] === 'edify-thanks') {
    return { ...base, status: 'resolved', reply: thankYouText(t, s), sentBy: 'edify', sentAt: t.at + 2, resolvedAt: t.at + 2, resolveChoice: 'reply' };
  }
  return base;
}

// ── The hook every screen uses ─────────────────────────────────────

export type SendInput = {
  reply: string;
  ownLine?: string;
  ownLineFromVoice?: boolean;
  choice: ResolveChoice;
  fix?: InStoreFix;
  fixNote?: string;
};

export function useFeedback() {
  const [changes, setChanges] = usePretState('gf-tickets', NO_TICKET_CHANGES);
  const [rippleChanges, setRippleChanges] = usePretState('gf-ripples', NO_RIPPLE_CHANGES);
  const [settings, setSettings] = usePretState<ReplySettings>('gf-settings', DEFAULT_SETTINGS);

  const tickets = useMemo(() => TICKETS.map(t => live(t, changes[t.id], settings)), [changes, settings]);

  const ripples = useMemo<LiveRipple[]>(() => {
    const out = RIPPLES.map(r => {
      const own = tickets.filter(t => t.rippleId === r.id);
      const open = own.filter(t => t.status !== 'resolved');
      const rs = rippleChanges[r.id] ?? {};
      return {
        ...r,
        status: rs.status ?? r.status,
        told: rs.told,
        tickets: own,
        open,
      };
    });
    const problems = out.filter(r => r.kind !== 'praise').sort((a, b) => b.tickets.length - a.tickets.length);
    return [...problems, ...out.filter(r => r.kind === 'praise')];
  }, [tickets, rippleChanges]);

  const patch = useCallback(
    (id: string, p: Partial<TicketState>) => setChanges(prev => ({ ...prev, [id]: { ...prev[id], ...p } })),
    [setChanges],
  );

  const sendReply = useCallback(
    (id: string, input: SendInput) =>
      patch(id, {
        reply: input.reply,
        ownLine: input.ownLine,
        ownLineFromVoice: input.ownLineFromVoice,
        sentAt: DEMO_NOW,
        sentBy: 'person',
        resolveChoice: input.choice,
        status: input.choice === 'ripple' ? 'replied' : 'resolved',
        resolvedAt: input.choice === 'ripple' ? undefined : DEMO_NOW,
        fix: input.fix,
        fixNote: input.fixNote,
      }),
    [patch],
  );

  const resolveNow = useCallback(
    (id: string, choice: Exclude<ResolveChoice, 'ripple'>, fix?: InStoreFix, fixNote?: string) =>
      patch(id, { status: 'resolved', resolvedAt: DEMO_NOW, resolveChoice: choice, fix, fixNote }),
    [patch],
  );

  const sendThankYous = useCallback(
    (ids: string[]) =>
      setChanges(prev => {
        const next = { ...prev };
        for (const id of ids) {
          const t = TICKETS.find(x => x.id === id)!;
          next[id] = { ...next[id], status: 'resolved', reply: thankYouText(t, settings), sentAt: DEMO_NOW, sentBy: 'person', resolveChoice: 'reply', resolvedAt: DEMO_NOW };
        }
        return next;
      }),
    [setChanges, settings],
  );

  const setRipple = useCallback(
    (id: string, p: RippleState) => setRippleChanges(prev => ({ ...prev, [id]: { ...prev[id], ...p } })),
    [setRippleChanges],
  );

  /** Closes the ripple and drafts a follow-up to every guest it held, for a person to approve. */
  const closeRipple = useCallback(
    (id: string) => {
      const r = RIPPLES.find(x => x.id === id)!;
      setRipple(id, { status: 'closed' });
      setChanges(prev => {
        const next = { ...prev };
        for (const t of tickets.filter(x => x.rippleId === id && (x.status === 'replied' || isHeldForFix(x)))) {
          next[t.id] = { ...next[t.id], followUp: r.followUp(firstName(t.guest), signOff(t.storeId, settings)) };
        }
        return next;
      });
    },
    [setRipple, setChanges, tickets, settings],
  );

  const sendFollowUps = useCallback(
    (ids: string[]) =>
      setChanges(prev => {
        const next = { ...prev };
        for (const id of ids) next[id] = { ...next[id], followUpSent: true, status: 'resolved', resolvedAt: DEMO_NOW };
        return next;
      }),
    [setChanges],
  );

  return { tickets, ripples, settings, setSettings, sendReply, resolveNow, sendThankYous, setRipple, closeRipple, sendFollowUps };
}

export const rippleStatusText = (r: Pick<LiveRipple, 'status'>) => (r.status === 'open' ? 'Open' : 'Fixed');

// ── Summaries ──────────────────────────────────────────────────────

export const ticketById = (tickets: LiveTicket[], id: string) => tickets.find(t => t.id === id);

/** What explains the week, worked out from the tickets. */
export function weekSummary(tickets: LiveTicket[], ripples: LiveRipple[]) {
  const complaints = tickets.filter(t => isComplaint(t.reason));
  const compliments = tickets.filter(t => !isComplaint(t.reason));
  const problems = ripples.filter(r => r.kind !== 'praise' && r.tickets.length > 0);
  const linked = complaints.filter(t => problems.some(r => r.id === t.rippleId)).length;
  const waiting = tickets.filter(needsReply).sort((a, b) => a.at - b.at);
  const repliedOpen = tickets.filter(t => t.status === 'replied');
  const resolved = tickets.filter(t => t.status === 'resolved');
  const lead = problems[0];
  const explains = !!lead && lead.tickets.length >= 3;

  const headline = explains ? lead.headline : `${complaints.length} complaints this week, with no single cause.`;
  const sub = explains
    ? `${linked} of ${complaints.length} complaints trace back to ${problems.length === 1 ? 'one cause' : `${problems.length} causes`} in your stores' data. The rest are one-offs.`
    : `Edify links a complaint to a cause only when the store's data shows one.`;

  return { complaints, compliments, top: problems, linked, waiting, repliedOpen, resolved, headline, sub, oldest: waiting[0] };
}

/** One store manager's morning: what came in since the last close, and what is left. */
export function storeMorning(storeId: StoreId, tickets: LiveTicket[]) {
  const arrived = tickets.filter(t => t.storeId === storeId && !TICKETS.find(x => x.id === t.id)!.seed);
  const thankYous = arrived.filter(isThankYou);
  const wordsAll = arrived.filter(t => !!t.words).sort((a, b) => a.at - b.at);
  return {
    arrived,
    thankYous,
    thanksReady: thankYous.filter(t => t.status === 'open'),
    thanksByEdify: thankYous.filter(t => t.sentBy === 'edify'),
    wordsAll,
    words: wordsAll.filter(needsReply),
    held: arrived.filter(isHeldForFix),
  };
}

/** Up to three things for the huddle. Praise names people, problems name processes. */
export function huddleNotes(storeId: StoreId, tickets: LiveTicket[], ripples: LiveRipple[]): string[] {
  const notes: string[] = [];
  for (const r of ripples) {
    if (r.kind === 'praise' || r.status === 'closed' || !r.storeIds.includes(storeId)) continue;
    const line = RIPPLE_HUDDLE_LINE[r.id];
    if (line) notes.push(line);
  }
  for (const person of TEAM_NAMES[storeId] ?? []) {
    const n = tickets.filter(t => t.storeId === storeId && t.reason === 'Compliment' && t.words && new RegExp(`\\b${person}\\b`, 'i').test(t.words)).length;
    if (n >= 2) notes.push(`${person}, thank you. ${n} guests named her.`);
  }
  return notes.slice(0, 3);
}
