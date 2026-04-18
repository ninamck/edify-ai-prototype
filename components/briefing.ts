import type { CommandCentreVariant } from '@/components/Feed/CommandCentre';

export type BriefingRole = 'ravi' | 'cheryl' | 'gm';

export type BriefingPhase = 'morning' | 'midday' | 'afternoon' | 'evening';

export function phaseFromHour(hour: number): BriefingPhase {
  if (hour < 11) return 'morning';
  if (hour < 14) return 'midday';
  if (hour < 17) return 'afternoon';
  return 'evening';
}

/** Role options for briefing + chat context (top bar); floor actions can key off this later. */
export const BRIEFING_ROLES: { id: BriefingRole; label: string; short: string }[] = [
  { id: 'ravi', label: 'Manager', short: 'Manager' },
  { id: 'cheryl', label: 'Admin', short: 'Admin' },
  { id: 'gm', label: 'Employee', short: 'Employee' },
];

/** One-line greeting for the top bar (matches timeline persona copy). */
export function morningGreetingLine(role: BriefingRole): string {
  switch (role) {
    case 'ravi':
      return 'Good morning, Ravi.';
    case 'cheryl':
      return 'Good morning, Cheryl.';
    case 'gm':
      return 'Good morning — Fitzroy Espresso';
    default:
      return 'Good morning.';
  }
}

/** Time-aware greeting for the chat hero (Claude-style). */
export function timeAwareGreeting(role: BriefingRole): string {
  const h = new Date().getHours();
  const tod = h < 12 ? 'morning' : h < 17 ? 'afternoon' : 'evening';
  switch (role) {
    case 'ravi':
      return `Good ${tod}, Ravi.`;
    case 'cheryl':
      return `Good ${tod}, Cheryl.`;
    case 'gm':
      return `Good ${tod} — Fitzroy Espresso`;
    default:
      return `Good ${tod}.`;
  }
}

export function commandCentreVariant(role: BriefingRole): CommandCentreVariant {
  switch (role) {
    case 'ravi':
      return 'chain';
    case 'cheryl':
      return 'finance';
    case 'gm':
      return 'store';
    default:
      return 'chain';
  }
}
