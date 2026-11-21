/**
 * Guest feedback model. A ticket is one piece of feedback. A ripple groups
 * tickets with the same operational cause; it sits on top of tickets and
 * never replaces them.
 */

export type Source = 'dunkin' | 'google' | 'doordash' | 'ubereats';

export const SOURCE_LABEL: Record<Source, string> = {
  dunkin: 'Dunkin feedback',
  google: 'Google',
  doordash: 'DoorDash',
  ubereats: 'Uber Eats',
};

/** How each source takes a reply. Sending is simulated in the prototype. */
export const SOURCE_REPLY_NOTE: Record<Source, string> = {
  dunkin: "Goes back through Dunkin's feedback system, the way replies leave Work Pulse today.",
  google: 'Posts as the owner reply on the Google listing, where anyone can read it.',
  doordash: "Goes back through DoorDash's review replies.",
  ubereats: "Goes back through Uber Eats' review replies.",
};

/** The Edify module a context line came from. */
export type Module =
  | 'Sales and POS'
  | 'Menu'
  | 'Products and Suppliers'
  | 'Invoices'
  | 'Ordering and Stock'
  | 'Checklists and Compliance';

export type ContextLine = {
  text: string;
  /** Parts of the text to set in bold, such as a time. */
  strong?: string[];
  /** A module, or the source the guest's history came from. */
  from: Module | 'Dunkin feedback';
};

export type TicketStatus = 'open' | 'replied' | 'resolved';

export const STATUS_LABEL: Record<TicketStatus, string> = { open: 'Open', replied: 'Replied', resolved: 'Resolved' };

/** Never drafted. These go straight to the district manager. */
export type Flag = 'allergy' | 'food-safety' | 'named-team-member' | 'refund';

export const FLAG_LABEL: Record<Flag, string> = {
  allergy: 'Allergy report',
  'food-safety': 'Food safety report',
  'named-team-member': 'Names a team member',
  refund: 'Asks for money back',
};

/** Finishes "Edify doesn't draft replies to …". */
export const FLAG_NEVER: Record<Flag, string> = {
  allergy: 'allergy reports',
  'food-safety': 'food safety reports',
  'named-team-member': 'reviews that name a team member',
  refund: 'refund requests',
};

export type StoreId = 'fordham' | 'tremont' | 'concourse' | 'pelham' | 'castlehill' | 'westchester';

export type Store = {
  id: StoreId;
  name: string;
  manager: string;
  managerFirst: string;
  avgReplyHours: number;
};

/** Minutes since Mon, Nov 16 at midnight. The demo week is Nov 16 to 20. */
export type WeekMinute = number;

export type Drafts = { standard: string; shorter: string; warmer: string };

export type ResolveChoice = 'ripple' | 'reply' | 'in-store';
export type InStoreFix = 'refund' | 'remake' | 'briefing';

export const IN_STORE_FIX_LABEL: Record<InStoreFix, string> = { refund: 'Refund', remake: 'Remake', briefing: 'Team briefing' };

export type Ticket = {
  id: string;
  storeId: StoreId;
  guest: string;
  stars: 1 | 2 | 3 | 4 | 5;
  words?: string;
  at: WeekMinute;
  source: Source;
  context: ContextLine[];
  rippleId?: string;
  flag?: Flag;
  drafts?: Drafts;
  /** The context in one line, for the phone. */
  phoneLine?: string;
  /** State the ticket starts the demo in. */
  seed?: Partial<TicketState>;
};

/** What has happened to a ticket. Saved per ticket on top of the fixture. */
export type TicketState = {
  status: TicketStatus;
  reply?: string;
  ownLine?: string;
  ownLineFromVoice?: boolean;
  sentAt?: WeekMinute;
  sentBy?: 'person' | 'edify';
  resolveChoice?: ResolveChoice;
  resolvedAt?: WeekMinute;
  fix?: InStoreFix;
  fixNote?: string;
  /** Drafted when the ripple closed, waiting for a person to approve. */
  followUp?: string;
  followUpSent?: boolean;
};

export type RippleKind = 'late-delivery' | 'sold-out' | 'check-skipped' | 'recipe' | 'removed' | 'price' | 'praise';

export type RippleStatus = 'decision' | 'with' | 'watching' | 'closed';

export type Ripple = {
  id: string;
  kind: RippleKind;
  /** Event chip, like "Late delivery · 3 mornings". */
  chip: string;
  title: string;
  /** Where and when, in one line. A struck value shows what was replaced. */
  detail: { struck?: string; text: string };
  /** The short tag on a ticket row. */
  tag: string;
  /** How the headline names this cause. */
  causePhrase: string;
  headline: string;
  /** True when the cause started outside the store, like a delivery or a price. */
  offFloor: boolean;
  storeIds: StoreId[];
  quoteIds: string[];
  /** Which count the big number shows. */
  numberKind: 'open' | 'guests';
  numberLabel: (stores: number) => string;
  /** One supporting number from Edify's data. */
  support: string;
  owner: string;
  status: RippleStatus;
  /** Something already done, shown in light blue. */
  done?: string;
  /** Short sentence for the phone and the ticket, like "Angela has the bakery." */
  ownerSentence: string;
  resolveLabel: string;
  resolveHelp: (others: number, guestFirst: string) => string;
  fixRule: string;
  followUp: (guestFirst: string, signOff: string) => string;
  action?: { label: string; done: string };
};

export type RippleState = { status?: RippleStatus; done?: string; told?: boolean };

export type WhoSends = 'person' | 'edify-thanks';

export const WHO_SENDS_LABEL: Record<WhoSends, string> = {
  person: 'Edify drafts, a person sends',
  'edify-thanks': 'Edify sends simple thank-yous',
};

export type ReplySettings = {
  district: WhoSends;
  stores: Record<StoreId, WhoSends>;
  style: string;
  signAs: 'manager' | 'team';
  ownLine: boolean;
  remindManagerHours: 6 | 12 | 24;
  tellDistrictHours: 12 | 24 | 48;
};
