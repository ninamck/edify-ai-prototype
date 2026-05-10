import { redirect } from 'next/navigation';

// Dispatch has been promoted to a top-level area at /dispatch. This file
// stays as a thin redirect so existing deep links and Quinn nudges
// pointing at the old path keep working. Safe to delete once we audit
// every linker.
export default function ProductionDispatchRedirect() {
  redirect('/dispatch/today');
}
