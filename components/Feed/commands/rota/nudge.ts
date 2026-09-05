/**
 * Intraday nudge (Lane C, question card). An order lands with lead
 * time; Edify asks one question in chat and does nothing until the GM
 * answers. Static in this build: the content is written per site so
 * the demo tells a consistent story, and there is no live clock or
 * order feed behind it. The shape is what matters: what landed, what
 * it does to the next hour, one proposed move, Yes or Not now.
 */

export interface RotaNudge {
  siteId: string;
  siteName: string;
  /** What just happened, in one line. */
  trigger: string;
  /** What it does to the floor if nothing moves. */
  effect: string;
  /** The one move Edify proposes. Phrased as a question. */
  question: string;
  /** Who is affected and how, for the receipt and the change log. */
  personName: string;
  change: { label: string; before: string; after: string };
  /** What the GM should know before saying yes. */
  notes: string[];
  tool: string;
}

const NUDGES: Record<string, RotaNudge> = {
  'fitzroy-kings-cross': {
    siteId: 'fitzroy-kings-cross',
    siteName: "Fitzroy King's Cross",
    trigger: 'Pre-order just confirmed: 40 lunch boxes for collection 12:00 to 12:30 today, up from the 12 on the plan.',
    effect: 'Packing 28 more boxes is about 45 minutes of counter time between 11:15 and 12:00, when Alba is due her break at 11:30.',
    question: "Pull Alba's break forward to 10:45 so both of you are on the counter from 11:15?",
    personName: 'Alba',
    change: { label: 'Break', before: '11:30 to 11:50', after: '10:45 to 11:05' },
    notes: ['Alba has been on since 06:00, so a 10:45 break still lands inside the six-hour rule.', 'Nothing else on the rota moves. Deputy shows the break change when you publish it.'],
    tool: 'Deputy',
  },
  'chagee-flagship': {
    siteId: 'chagee-flagship',
    siteName: 'CHAGEE Flagship',
    trigger: 'Group order just landed: 60 cups for 14:30 today, office two doors down.',
    effect: 'Machine 1 is already at 90% from 13:30. Sixty cups on top take finishing to four pairs of hands from 14:00, and Zara is due her break at 14:00.',
    question: "Pull Zara's break forward to 13:30 and start the oolong pre-brew at 13:50 so the order is finished by 14:25?",
    personName: 'Zara Hussain',
    change: { label: 'Break', before: '14:00 to 14:20', after: '13:30 to 13:50' },
    notes: ['Zara has been on since 10:00, so a 13:30 break still lands inside the six-hour rule.', 'The pre-brew is a brew schedule change, not a rota change. It goes to the bench screen.'],
    tool: 'Deputy',
  },
};

export function nudgeFor(siteId: string): RotaNudge | undefined {
  return NUDGES[siteId];
}

export function sitesWithNudges(): string[] {
  return Object.keys(NUDGES);
}
