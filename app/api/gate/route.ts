import { NextResponse, type NextRequest } from 'next/server';
import { GATE_COOKIE, expectedGateToken } from '@/lib/demoGate';

/** Verify a submitted passcode and, on success, set the gate cookie. */
export async function POST(req: NextRequest) {
  const passcode = process.env.DEMO_GATE_PASSCODE;
  const expected = await expectedGateToken();
  if (!passcode || !expected) {
    // Gate disabled — nothing to unlock.
    return NextResponse.json({ ok: true });
  }

  let submitted = '';
  try {
    const body = (await req.json()) as { passcode?: string };
    submitted = body.passcode ?? '';
  } catch {
    // fall through to the mismatch response
  }

  if (submitted !== passcode) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set(GATE_COOKIE, expected, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 60 * 24 * 30, // 30 days
  });
  return res;
}
