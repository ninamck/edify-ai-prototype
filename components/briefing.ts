import type { CommandCentreVariant } from '@/components/Feed/CommandCentre';

export type BriefingRole = 'ed' | 'cheryl' | 'gm';

/** Role options for briefing + chat context (top bar); floor actions can key off this later. */
export const BRIEFING_ROLES: { id: BriefingRole; label: string; short: string }[] = [
  { id: 'ed', label: 'CEO · Owner', short: 'Admin' },
  { id: 'gm', label: 'GM · Site', short: 'Manager' },
  { id: 'cheryl', label: 'Finance / Head office', short: 'Employee' },
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
    default:
      return 'chain';
  }
}
