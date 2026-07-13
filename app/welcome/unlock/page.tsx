'use client';

/**
 * /welcome/unlock — the access-code page behind the secret spot.
 *
 * Only reachable by clicking "Powered by Edify" five times on /welcome
 * (nothing links here). Ed enters the code, it's verified server-side
 * (`/api/gate`), and a 30-day cookie unlocks the demo on that device.
 */

import { Suspense, useState } from 'react';
import Image from 'next/image';
import { useRouter, useSearchParams } from 'next/navigation';
import { track } from '@/components/Analytics/Analytics';

/** Edify brand palette (see brand guidelines). */
const EDIFY = {
  midnight: '#051b33',
  natural: '#f5e8d8',
  offWhite: '#f9f4ef',
  hotPink: '#ff315d', // signifier only
};

function UnlockInner() {
  const router = useRouter();
  const params = useSearchParams();
  const from = params.get('from') || '/';

  const [passcode, setPasscode] = useState('');
  const [error, setError] = useState(false);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!passcode.trim() || busy) return;
    setBusy(true);
    setError(false);
    try {
      const res = await fetch('/api/gate', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ passcode }),
      });
      if (res.ok) {
        track('Demo unlocked');
        router.replace(from);
      } else {
        setError(true);
        setBusy(false);
      }
    } catch {
      setError(true);
      setBusy(false);
    }
  }

  return (
    <main
      style={{
        minHeight: '100dvh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
        background: EDIFY.midnight,
        fontFamily: 'var(--font-primary)',
      }}
    >
      <form
        onSubmit={submit}
        style={{
          width: '100%',
          maxWidth: 380,
          display: 'flex',
          flexDirection: 'column',
          gap: 18,
        }}
      >
        <Image
          src="/edify-logo-cream.png"
          alt="Edify"
          width={136}
          height={30}
          priority
          style={{ height: 30, width: 'auto' }}
        />

        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <h1
            style={{
              margin: 0,
              fontSize: 24,
              fontWeight: 800,
              color: EDIFY.offWhite,
            }}
          >
            Enter the access code
          </h1>
          <p
            style={{
              margin: 0,
              fontSize: 14,
              color: EDIFY.natural,
              opacity: 0.8,
              lineHeight: 1.6,
            }}
          >
            This unlocks the CHAGEE preview on this device for 30 days.
          </p>
        </div>

        <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <span
            style={{
              fontSize: 12,
              fontWeight: 600,
              color: EDIFY.natural,
              opacity: 0.75,
            }}
          >
            Access code
          </span>
          <input
            type="password"
            value={passcode}
            onChange={(e) => {
              setPasscode(e.target.value);
              if (error) setError(false);
            }}
            autoFocus
            autoComplete="off"
            placeholder="••••••••"
            style={{
              padding: '11px 13px',
              borderRadius: 10,
              border: `1.5px solid ${error ? EDIFY.hotPink : `${EDIFY.natural}55`}`,
              background: `${EDIFY.offWhite}14`,
              color: EDIFY.offWhite,
              fontSize: 15,
              fontFamily: 'var(--font-primary)',
              outline: 'none',
            }}
          />
          {error && (
            <span style={{ fontSize: 12, color: EDIFY.hotPink }}>
              That code didn’t work. Check it and try again.
            </span>
          )}
        </label>

        <button
          type="submit"
          disabled={busy || !passcode.trim()}
          style={{
            padding: '12px 16px',
            borderRadius: 10,
            border: 'none',
            background:
              busy || !passcode.trim() ? `${EDIFY.natural}44` : EDIFY.hotPink,
            color: busy || !passcode.trim() ? `${EDIFY.natural}99` : EDIFY.offWhite,
            fontSize: 14,
            fontWeight: 700,
            fontFamily: 'var(--font-primary)',
            cursor: busy || !passcode.trim() ? 'default' : 'pointer',
          }}
        >
          {busy ? 'Checking…' : 'Enter preview'}
        </button>
      </form>
    </main>
  );
}

export default function UnlockPage() {
  return (
    <Suspense fallback={null}>
      <UnlockInner />
    </Suspense>
  );
}
