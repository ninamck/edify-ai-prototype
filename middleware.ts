import { NextResponse, type NextRequest } from 'next/server';
import { GATE_COOKIE, expectedGateToken } from '@/lib/demoGate';

/**
 * True on a gated customer (e.g. Chagee) build. Mirrors `isDemoBuild` in
 * `lib/demoConfig` but read straight from the env so the edge middleware
 * has no client-module dependency.
 */
const IS_DEMO_BUILD =
  !!process.env.NEXT_PUBLIC_DEMO_CUSTOMER &&
  process.env.NEXT_PUBLIC_DEMO_CUSTOMER !== 'edify';

/**
 * Routes that only make sense on the internal Edify build — alternate demo
 * "versions", the franchise-admin demo, other-client mock-ups and internal
 * audit pages. On a single-client customer build these are dead ends, so we
 * bounce them back to the home shell rather than leak them to the customer.
 */
const DEMO_BLOCKED_PREFIXES = [
  '/mvp-1',
  '/prod-2',
  '/franchise',
  '/mockup-blue',
  '/viz-explorations',
  '/components-audit',
];

/**
 * Passcode gate for the customer demo build.
 *
 * No-op unless `DEMO_GATE_PASSCODE` is set, so dev and the internal build
 * are never affected. When enabled, every request without a valid gate
 * cookie is redirected to `/welcome` (which is itself always allowed, along
 * with the gate API and framework/static assets — see the matcher below).
 */
export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Single-client build: hide the internal-only / other-client routes.
  if (IS_DEMO_BUILD && DEMO_BLOCKED_PREFIXES.some(p => pathname === p || pathname.startsWith(p + '/'))) {
    const url = req.nextUrl.clone();
    url.pathname = '/';
    url.search = '';
    return NextResponse.redirect(url);
  }

  const expected = await expectedGateToken();
  if (!expected) return NextResponse.next(); // gate disabled

  if (pathname.startsWith('/welcome') || pathname.startsWith('/api/gate')) {
    return NextResponse.next();
  }

  const cookie = req.cookies.get(GATE_COOKIE)?.value;
  if (cookie && cookie === expected) return NextResponse.next();

  const url = req.nextUrl.clone();
  url.pathname = '/welcome';
  url.searchParams.set('from', pathname);
  return NextResponse.redirect(url);
}

export const config = {
  matcher: [
    // Everything except Next internals and static asset files.
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|woff2?)$).*)',
  ],
};
