import { NextResponse, type NextRequest } from 'next/server';
import { GATE_COOKIE, expectedGateToken } from '@/lib/demoGate';

/**
 * Passcode gate for the customer demo build.
 *
 * No-op unless `DEMO_GATE_PASSCODE` is set, so dev and the internal build
 * are never affected. When enabled, every request without a valid gate
 * cookie is redirected to `/welcome` (which is itself always allowed, along
 * with the gate API and framework/static assets — see the matcher below).
 */
export async function middleware(req: NextRequest) {
  const expected = await expectedGateToken();
  if (!expected) return NextResponse.next(); // gate disabled

  const { pathname } = req.nextUrl;
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
