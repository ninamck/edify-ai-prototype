import { redirect } from 'next/navigation';

// Top-level Dispatch index — bounce to the working Today view so a
// freshly-opened sidebar item lands somewhere useful instead of an
// empty shell.
export default function DispatchIndexPage() {
  redirect('/dispatch/today');
}
