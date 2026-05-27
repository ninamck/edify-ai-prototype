import { redirect } from 'next/navigation';

/**
 * /settings is now a parent route hosting the Context / Sites / Users /
 * Company info tabs. The sidebar entry still points here, so we send
 * the operator straight to the Context tab (the newest surface and the
 * one most likely to be edited frequently).
 */
export default function SettingsRootPage() {
  redirect('/settings/context');
}
