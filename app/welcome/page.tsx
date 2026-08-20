'use client';

/**
 * /welcome — the front door for the Norma's Cafe demo build.
 *
 * Visitors enter their work email and the shared access code Ed gave them.
 * The code is verified server-side (`/api/gate`) and a 30-day cookie keeps
 * the device unlocked. The email is never checked server-side — it exists
 * to identify the viewer in Mixpanel, so the team can see who at the
 * prospect is looking, at what, and how often.
 */

import { Suspense, useState } from 'react';
import Image from 'next/image';
import { useRouter, useSearchParams } from 'next/navigation';
import { track, identifyViewer } from '@/components/Analytics/Analytics';

const CONTACT_EMAIL = 'ed@edifysystems.io';

/** Edify brand palette (see brand guidelines). */
const EDIFY = {
  midnight: '#051b33',
  natural: '#f5e8d8',
  offWhite: '#f9f4ef',
  hotPink: '#ff315d', // signifier only
};

const labelStyle: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 600,
  color: EDIFY.natural,
  opacity: 0.75,
};

function inputStyle(hasError: boolean): React.CSSProperties {
  return {
    padding: '11px 13px',
    borderRadius: 10,
    border: `1.5px solid ${hasError ? EDIFY.hotPink : `${EDIFY.natural}55`}`,
    background: `${EDIFY.offWhite}14`,
    color: EDIFY.offWhite,
    fontSize: 15,
    fontFamily: 'var(--font-primary)',
    outline: 'none',
  };
}

function isPlausibleEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

function WelcomeInner() {
  const router = useRouter();
  const params = useSearchParams();
  const from = params.get('from') || '/';

  const [email, setEmail] = useState('');
  const [passcode, setPasscode] = useState('');
  const [emailError, setEmailError] = useState(false);
  const [codeError, setCodeError] = useState(false);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    const emailOk = isPlausibleEmail(email);
    setEmailError(!emailOk);
    if (!emailOk || !passcode.trim()) {
      setCodeError(!passcode.trim());
      return;
    }
    setBusy(true);
    setCodeError(false);
    try {
      const res = await fetch('/api/gate', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ passcode }),
      });
      if (res.ok) {
        identifyViewer(email);
        track('Demo unlocked', { email: email.trim().toLowerCase() });
        router.replace(from);
      } else {
        setCodeError(true);
        setBusy(false);
      }
    } catch {
      setCodeError(true);
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
      <div
        style={{
          width: '100%',
          maxWidth: 420,
          display: 'flex',
          flexDirection: 'column',
          gap: 26,
        }}
      >
        <Image
          src="/edify-logo-cream.png"
          alt="Edify"
          width={159}
          height={38}
          priority
          style={{ height: 38, width: 'auto', alignSelf: 'flex-start' }}
        />

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <span
            style={{
              fontSize: 12.5,
              fontWeight: 700,
              letterSpacing: '0.18em',
              textTransform: 'uppercase',
              color: EDIFY.natural,
              opacity: 0.65,
            }}
          >
            A private preview for Norma&apos;s Cafe
          </span>
          <h1
            style={{
              margin: 0,
              fontSize: 28,
              lineHeight: 1.25,
              fontWeight: 800,
              color: EDIFY.offWhite,
            }}
          >
            Take a look around Edify
          </h1>
          <p
            style={{
              margin: 0,
              fontSize: 14.5,
              color: EDIFY.natural,
              opacity: 0.85,
              lineHeight: 1.6,
            }}
          >
            Forecasting, production, ordering and more, shared privately with
            Norma&apos;s Cafe. Enter your work email and the access code Ed
            gave you. This is an early preview: some of what you&apos;ll see
            is still in development.
          </p>
        </div>

        <form
          onSubmit={submit}
          noValidate
          style={{ display: 'flex', flexDirection: 'column', gap: 16 }}
        >
          <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span style={labelStyle}>Work email</span>
            <input
              type="email"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                if (emailError) setEmailError(false);
              }}
              autoFocus
              autoComplete="email"
              placeholder="you@normascafe.com"
              aria-invalid={emailError}
              style={inputStyle(emailError)}
            />
            {emailError && (
              <span role="alert" style={{ fontSize: 12, color: EDIFY.hotPink }}>
                Enter your work email address.
              </span>
            )}
          </label>

          <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span style={labelStyle}>Access code</span>
            <input
              type="password"
              value={passcode}
              onChange={(e) => {
                setPasscode(e.target.value);
                if (codeError) setCodeError(false);
              }}
              autoComplete="off"
              placeholder="••••••••"
              aria-invalid={codeError}
              style={inputStyle(codeError)}
            />
            {codeError && (
              <span role="alert" style={{ fontSize: 12, color: EDIFY.hotPink }}>
                That code didn&apos;t work. Check it and try again.
              </span>
            )}
          </label>

          <button
            type="submit"
            disabled={busy}
            style={{
              padding: '12px 16px',
              borderRadius: 10,
              border: 'none',
              background: busy ? `${EDIFY.natural}44` : EDIFY.hotPink,
              color: busy ? `${EDIFY.natural}99` : EDIFY.offWhite,
              fontSize: 14,
              fontWeight: 700,
              fontFamily: 'var(--font-primary)',
              cursor: busy ? 'default' : 'pointer',
            }}
          >
            {busy ? 'Checking…' : 'Enter preview'}
          </button>
        </form>

        <p
          style={{
            margin: 0,
            fontSize: 13,
            color: EDIFY.natural,
            opacity: 0.7,
            lineHeight: 1.6,
          }}
        >
          No code? Get in touch with Ed at{' '}
          <a
            href={`mailto:${CONTACT_EMAIL}`}
            style={{
              color: EDIFY.hotPink,
              fontWeight: 700,
              textDecoration: 'underline',
              textUnderlineOffset: 3,
            }}
          >
            {CONTACT_EMAIL}
          </a>
          .
        </p>
      </div>
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
