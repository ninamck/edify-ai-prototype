import type { CommandCentreVariant } from '@/components/Feed/CommandCentre';

export type BriefingRole = 'ed' | 'cheryl' | 'gm' | 'playtomic' | 'dunkin' | 'pilot' | 'culinary' | 'plato';

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
  { id: 'playtomic', label: 'Coffee & Co · United Kingdom', short: 'Coffee & Co UK' },
  { id: 'dunkin', label: 'Coffee & Co · United States', short: 'Coffee & Co US' },
  { id: 'pilot', label: 'Pilot (clean slate)', short: 'Pilot' },
  { id: 'culinary', label: 'Culinary Collective (FIS demo)', short: 'Culinary' },
  { id: 'plato', label: 'Platō Coffee', short: 'Platō' },
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
      return 'Good morning — Coffee & Co (UK)';
    case 'dunkin':
      return 'Good morning — Coffee & Co (US)';
    case 'pilot':
      return 'Good morning — Pilot';
    case 'culinary':
      return 'Good morning — Culinary Collective';
    case 'plato':
      return 'Good morning — Platō Coffee';
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
      return `Good ${tod} — Coffee & Co (UK)`;
    case 'dunkin':
      return `Good ${tod} — Coffee & Co (US)`;
    case 'pilot':
      return `Good ${tod} — Pilot`;
    case 'culinary':
      return `Good ${tod} — Culinary Collective`;
    case 'plato':
      return `Good ${tod} — Platō Coffee`;
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
    case 'pilot':
      return 'chain';
    case 'culinary':
      return 'chain';
    case 'plato':
      return 'chain';
    default:
      return 'chain';
  }
}
