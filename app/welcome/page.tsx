'use client';

/**
 * /welcome — the branded passcode gate for customer demo builds.
 *
 * Customers land here (via middleware) until they enter the shared passcode.
 * On success we set the gate cookie server-side and forward them to wherever
 * they were originally heading (`from`), defaulting to the home screen.
 */

import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { demoCustomer } from '@/lib/demoConfig';
import { track } from '@/components/Analytics/Analytics';

function WelcomeInner() {
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
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
        background:
          `radial-gradient(1200px 600px at 50% -10%, ${demoCustomer.accent}22, transparent), var(--color-bg-surface)`,
        fontFamily: 'var(--font-primary)',
      }}
    >
      <form
        onSubmit={submit}
        style={{
          width: '100%',
          maxWidth: 380,
          background: '#fff',
          border: '1px solid var(--color-border-subtle)',
          borderRadius: 18,
          padding: '32px 28px',
          boxShadow: '0 24px 60px rgba(10,20,25,0.12)',
          display: 'flex',
          flexDirection: 'column',
          gap: 16,
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <span
            style={{
              fontSize: 12,
              fontWeight: 700,
              letterSpacing: '0.14em',
              textTransform: 'uppercase',
              color: demoCustomer.accent,
            }}
          >
            {demoCustomer.name}
          </span>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: 'var(--color-text-primary)' }}>
            A private preview, powered by Edify
          </h1>
          <p style={{ margin: 0, fontSize: 13.5, color: 'var(--color-text-secondary)', lineHeight: 1.5 }}>
            {demoCustomer.tagline}. Enter the access code you were sent to continue.
          </p>
        </div>

        <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-text-secondary)' }}>
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
              border: `1.5px solid ${error ? 'var(--color-error)' : 'var(--color-border)'}`,
              fontSize: 15,
              fontFamily: 'var(--font-primary)',
              outline: 'none',
            }}
          />
          {error && (
            <span style={{ fontSize: 12, color: 'var(--color-error)' }}>
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
            background: busy || !passcode.trim() ? 'var(--color-border)' : demoCustomer.accent,
            color: '#fff',
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

export default function WelcomePage() {
  return (
    <Suspense fallback={null}>
      <WelcomeInner />
    </Suspense>
  );
}
