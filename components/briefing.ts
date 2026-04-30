import type { CommandCentreVariant } from '@/components/Feed/CommandCentre';

export type BriefingRole = 'ed' | 'cheryl' | 'gm' | 'playtomic' | 'dunkin';

export type BriefingPhase = 'morning' | 'midday' | 'afternoon' | 'evening';

export function phaseFromHour(hour: number): BriefingPhase {
  if (hour < 11) return 'morning';
  if (hour < 14) return 'midday';
  if (hour < 17) return 'afternoon';
  return 'evening';
}

/** Role options for briefing + chat context (top bar); floor actions can key off this later. */
export const BRIEFING_ROLES: { id: BriefingRole; label: string; short: string }[] = [
  { id: 'ed', label: 'Manager', short: 'Manager' },
  { id: 'cheryl', label: 'Admin', short: 'Admin' },
  { id: 'gm', label: 'Employee', short: 'Employee' },
  { id: 'playtomic', label: 'Playtomic (padel demo)', short: 'Playtomic' },
  { id: 'dunkin', label: 'Dunkin (QSR demo)', short: 'Dunkin' },
];

/** One-line greeting for the top bar (matches timeline persona copy). */
export function morningGreetingLine(role: BriefingRole): string {
  switch (role) {
    case 'ed':
      return 'Good morning, Ed.';
    case 'cheryl':
      return 'Good morning, Cheryl.';
    case 'gm':
      return 'Good morning — Fitzroy Espresso';
    case 'playtomic':
      return 'Good morning — Playtomic';
    case 'dunkin':
      return "Good morning — Dunkin'";
    default:
      return 'Good morning.';
  }
}

/** Time-aware greeting for the chat hero (Claude-style). */
export function timeAwareGreeting(role: BriefingRole): string {
  const h = new Date().getHours();
  const tod = h < 12 ? 'morning' : h < 17 ? 'afternoon' : 'evening';
  switch (role) {
    case 'ed':
      return `Good ${tod}, Ed.`;
    case 'cheryl':
      return `Good ${tod}, Cheryl.`;
    case 'gm':
      return `Good ${tod} — Fitzroy Espresso`;
    case 'playtomic':
      return `Good ${tod} — Playtomic`;
    case 'dunkin':
      return `Good ${tod} — Dunkin'`;
    default:
      return `Good ${tod}.`;
  }
}

export function commandCentreVariant(role: BriefingRole): CommandCentreVariant {
  switch (role) {
    case 'ed':
      return 'chain';
    case 'cheryl':
      return 'finance';
    case 'gm':
      return 'store';
    case 'playtomic':
      return 'chain';
    case 'dunkin':
      return 'chain';
    default:
      return 'chain';
  }
}
