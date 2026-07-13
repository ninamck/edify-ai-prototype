'use client';

/**
 * /welcome — the locked front door for the CHAGEE demo build.
 *
 * To anyone who lands here the demo looks closed: an Edify-branded holding
 * page that says "get in touch with Ed" and nothing else. There is no
 * visible way in.
 *
 * The way in (for Ed): click the "Powered by Edify" mark in the bottom
 * corner five times in quick succession. That opens `/welcome/unlock`,
 * where the access code is verified server-side (`/api/gate`) and a
 * 30-day cookie keeps the device unlocked — so Ed only does this once
 * per device; future demos go straight through.
 */

import { Suspense, useRef } from 'react';
import Image from 'next/image';
import { useRouter, useSearchParams } from 'next/navigation';
import { track } from '@/components/Analytics/Analytics';

const CONTACT_EMAIL = 'ed@edifysystems.io';
const SECRET_CLICKS = 5;
const CLICK_WINDOW_MS = 3000;

/** Edify brand palette (see brand guidelines). */
const EDIFY = {
  midnight: '#051b33',
  natural: '#f5e8d8',
  offWhite: '#f9f4ef',
  hotPink: '#ff315d', // signifier only
};

function WelcomeInner() {
  const router = useRouter();
  const params = useSearchParams();
  const from = params.get('from') || '/';

  const clickCount = useRef(0);
  const clickTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function handleSecretClick() {
    clickCount.current += 1;
    if (clickTimer.current) clearTimeout(clickTimer.current);
    if (clickCount.current >= SECRET_CLICKS) {
      clickCount.current = 0;
      track('Demo gate revealed');
      router.push(`/welcome/unlock?from=${encodeURIComponent(from)}`);
      return;
    }
    // Too slow between clicks? Start the count again.
    clickTimer.current = setTimeout(() => {
      clickCount.current = 0;
    }, CLICK_WINDOW_MS);
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
        position: 'relative',
        background: EDIFY.midnight,
        fontFamily: 'var(--font-primary)',
      }}
    >
      {/* Shrink-wraps to its content so the cluster centres in the viewport,
          while everything inside stays left-aligned. */}
      <div
        style={{
          maxWidth: 560,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-start',
          gap: 28,
        }}
      >
        <Image
          src="/edify-logo-cream.png"
          alt="Edify"
          width={172}
          height={38}
          priority
          style={{ height: 38, width: 'auto' }}
        />

        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
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
            A private preview for CHAGEE
          </span>
          <h1
            style={{
              margin: 0,
              fontSize: 34,
              lineHeight: 1.2,
              fontWeight: 800,
              color: EDIFY.offWhite,
              maxWidth: '18ch',
            }}
          >
            This preview isn’t open right now
          </h1>
          <p
            style={{
              margin: 0,
              fontSize: 15.5,
              color: EDIFY.natural,
              opacity: 0.85,
              lineHeight: 1.65,
              maxWidth: '46ch',
            }}
          >
            Thanks for your interest in what Edify and CHAGEE are exploring
            together — from demand forecasting to production and ordering,
            made to order. If you’d like to know more, get in touch with Ed at{' '}
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
      </div>

      {/* The secret spot: five quick clicks open the access-code page. */}
      <button
        type="button"
        onClick={handleSecretClick}
        aria-hidden="true"
        tabIndex={-1}
        style={{
          position: 'absolute',
          bottom: 20,
          right: 24,
          padding: '6px 10px',
          background: 'none',
          border: 'none',
          fontSize: 11.5,
          fontFamily: 'var(--font-primary)',
          color: EDIFY.natural,
          opacity: 0.4,
          cursor: 'default',
          userSelect: 'none',
        }}
      >
        Powered by Edify
      </button>
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
