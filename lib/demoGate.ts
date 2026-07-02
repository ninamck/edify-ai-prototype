/**
 * demoGate — shared passcode-gate helpers for the customer demo build.
 *
 * The gate is a lightweight, account-free wall: a customer types a shared
 * passcode on `/welcome`, we verify it server-side against
 * `DEMO_GATE_PASSCODE`, and set an httpOnly cookie holding a derived token.
 * Middleware then lets any request through only if that cookie matches.
 *
 * The cookie never contains the passcode itself — it holds a SHA-256 of
 * `passcode:secret`, so a leaked cookie can't be reversed into the passcode.
 * Uses Web Crypto only, so the same code runs in Edge middleware and in the
 * Node route handler.
 *
 * The gate is OFF whenever `DEMO_GATE_PASSCODE` is unset — dev and the
 * internal build are never blocked.
 */

export const GATE_COOKIE = 'edify_demo_gate';

async function sha256Base64(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest('SHA-256', data);
  const bytes = new Uint8Array(digest);
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary);
}

/** The cookie value we expect for a valid session, or null if the gate is off. */
export async function expectedGateToken(): Promise<string | null> {
  const passcode = process.env.DEMO_GATE_PASSCODE;
  if (!passcode) return null;
  const secret = process.env.DEMO_GATE_SECRET ?? 'edify-demo-gate';
  return sha256Base64(`${passcode}:${secret}`);
}
