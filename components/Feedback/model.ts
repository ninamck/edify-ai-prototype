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

/** The reason Dunkin's feedback system files each comment under. */
export type Reason =
  | 'Receipt'
  | 'Hours'
  | 'Taste'
  | 'Slow Service'
  | 'Team Member Friendliness'
  | 'Charges'
  | 'Foreign Object'
  | 'Order Accuracy'
  | 'Product Quality'
  | 'Compliment';

export const isComplaint = (r: Reason) => r !== 'Compliment';

/** The Edify module a context line came from. */
export type Module =
  | 'Sales and POS'
  | 'Menu'
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

export type StoreId = 's301184' | 's332974' | 's340462' | 's302692' | 's302065' | 's350605' | 's358804' | 's345207';

export type Store = {
  id: StoreId;
  /** Town and store number, like "Irmo #358804". */
  name: string;
  town: string;
  state: 'NY' | 'SC';
  manager: string;
  managerFirst: string;
  avgReplyHours: number;
};

/** Minutes since Sun, Nov 15 at midnight. The demo week is Nov 15 to 21. */
export type WeekMinute = number;

export type Drafts = { standard: string; shorter: string; warmer: string };

export type ResolveChoice = 'ripple' | 'reply' | 'in-store';
export type InStoreFix = 'refund' | 'remake' | 'briefing';

export const IN_STORE_FIX_LABEL: Record<InStoreFix, string> = { refund: 'Refund', remake: 'Remake', briefing: 'Team briefing' };

export type Ticket = {
  id: string;
  storeId: StoreId;
  guest: string;
  reason: Reason;
  words?: string;
  at: WeekMinute;
  source: Source;
  /** How it reached Dunkin's feedback system, like "Web / Drive-thru". */
  origin?: string;
  /** Logged for the store to see. Nobody replies. */
  fyiOnly?: boolean;
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
  /** Drafted when the ripple was marked fixed, waiting for a person to approve. */
  followUp?: string;
  followUpSent?: boolean;
};

export type RippleKind = 'price' | 'check-skipped' | 'early-close' | 'praise';

export type RippleStatus = 'open' | 'closed';

/** Guests saying the same thing, grouped, with the one line in Edify's data that explains it. */
export type Ripple = {
  id: string;
  kind: RippleKind;
  /** What guests said, as Dunkin files it. */
  reason: Reason;
  title: string;
  /** Praise has no cause to fix. */
  cause?: { text: string; from: Module };
  /** The short tag on a ticket row. */
  tag: string;
  /** How the headline names this cause. */
  causePhrase: string;
  headline: string;
  storeIds: StoreId[];
  quoteIds: string[];
  status: RippleStatus;
  /** Who fixes the cause, in one sentence, like "Marcus has the drive-thru board." */
  ownerSentence: string;
  resolveLabel: string;
  resolveHelp: (others: number, guestFirst: string) => string;
  followUp: (guestFirst: string, signOff: string) => string;
  action?: { label: string; done: string };
};

export type RippleState = { status?: RippleStatus; told?: boolean };

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
