import { largestPack, type Session, type VoiceArea, type VoiceItem } from './engine';

/** A natural way to say a count of this item: "two cases of Coca-Cola Classic". */
export function examplePhrase(item: VoiceItem): string {
  const pack = largestPack(item);
  if (pack) return `two ${pack.many} of ${item.name}`;
  if (item.base.metric) return `three ${item.base.many} of ${item.name}`;
  return `six ${item.name}`;
}

export interface DemoStep {
  /** An utterance run through the same parser as the mic. */
  say?: string;
  /** Tap this candidate on the open question card. */
  choose?: string;
}

/** `/stock?demo=1`, stepped with the demo controller: items tick off out
 *  of order in the Walk-in, one question appears and is answered, then
 *  the GM walks the Dry store and Cleaning cupboard and looks back at a
 *  finished area. */
export const DEMO_STEPS: DemoStep[] = [
  { say: 'two trays and six eggs' },
  { say: 'fourteen kilos chicken, four kilos gruyère' },
  { say: 'four litres of milk' },
  { choose: 'Oat Milk' },
  { say: 'start dry store' },
  { say: 'six tins of coconut milk and three penne' },
  { say: 'ten kilos of basmati rice, five litres of mayonnaise' },
  { say: 'start cleaning cupboard' },
  { say: 'fifteen litres of hand soap and four surface sanitiser' },
  { say: 'start freezer' },
  { say: 'start front counter' },
  { say: 'start walk in' },
];

/**
 * Stand-in for transcribing audio recorded offline. The prototype has no
 * speech-to-text service, so the demo queues plausible lines for the
 * first few uncounted items in the area instead.
 */
export function demoTranscript(area: VoiceArea, session: Session): string[] {
  return area.items
    .filter(i => i.countable && !session.captures[i.id])
    .slice(0, 3)
    .map(examplePhrase);
}
