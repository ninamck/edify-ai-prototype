'use client';

/**
 * Weekly flash — designed email digest.
 *
 * The "your dashboard becomes a designed email" end state: every section is
 * rendered by the shape registry (components/EmailDigest/registry.tsx) from
 * data derived out of the Weekly flash template fixtures. Nothing on this
 * page knows what a "site league" is — the builder mapped each insight to a
 * shape, and the registry did the rest. Swap in different insights of the
 * same shapes and the email still looks designed.
 */

import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { DigestBody, DIGEST } from '@/components/EmailDigest/registry';
import { buildWeeklyFlashSections, WEEKLY_DIGEST_META } from '@/components/EmailDigest/weeklyFlashDigest';

const INK_MUTED = '#5B6B7B';
const BORDER = '#E3E7EC';

export default function WeeklyFlashEmailPage() {
  const sections = buildWeeklyFlashSections();
  const subject = `${WEEKLY_DIGEST_META.name} — ${WEEKLY_DIGEST_META.scope} · ${WEEKLY_DIGEST_META.weekLabel}`;

  return (
    <div style={{ minHeight: '100vh', background: '#EDEFF2', fontFamily: 'var(--font-primary)', padding: '24px 16px 64px' }}>
      <div style={{ maxWidth: 720, margin: '0 auto' }}>
        {/* Prototype chrome — not part of the email */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
          <Link
            href="/scheduled-reports"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 5,
              fontSize: 12,
              fontWeight: 600,
              color: INK_MUTED,
              textDecoration: 'none',
            }}
          >
            <ArrowLeft size={13} strokeWidth={2.2} /> Back to scheduled reports
          </Link>
          <span style={{ marginLeft: 'auto', fontSize: 11.5, fontWeight: 600, color: INK_MUTED }}>
            Prototype — designed digest, assembled by the section registry
          </span>
        </div>

        {/* Email client header */}
        <div
          style={{
            background: '#fff',
            border: `1px solid ${BORDER}`,
            borderRadius: '10px 10px 0 0',
            padding: '16px 22px',
          }}
        >
          <div style={{ fontSize: 16, fontWeight: 700, color: DIGEST.ink }}>{subject}</div>
          <table style={{ marginTop: 10, fontSize: 12, color: INK_MUTED, borderCollapse: 'collapse' }}>
            <tbody>
              <tr>
                <td style={{ paddingRight: 10, fontWeight: 700 }}>From</td>
                <td>Edify Reports &lt;reports@edify.app&gt;</td>
              </tr>
              <tr>
                <td style={{ paddingRight: 10, fontWeight: 700 }}>To</td>
                <td>ops@fitzroy-espresso.co.uk</td>
              </tr>
              <tr>
                <td style={{ paddingRight: 10, fontWeight: 700 }}>Schedule</td>
                <td>{WEEKLY_DIGEST_META.cadence}</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* The email itself */}
        <div
          style={{
            background: DIGEST.cream,
            border: `1px solid ${BORDER}`,
            borderTop: 'none',
            borderRadius: '0 0 10px 10px',
            padding: '30px 0 28px',
          }}
        >
          <div style={{ maxWidth: 600, margin: '0 auto', background: DIGEST.card, border: `1px solid ${DIGEST.rule}` }}>
            {/* Masthead */}
            <div
              style={{
                display: 'flex',
                alignItems: 'flex-end',
                justifyContent: 'space-between',
                gap: 12,
                padding: '26px 32px 14px',
                borderBottom: `2px solid ${DIGEST.ruleStrong}`,
                margin: '0 32px',
                paddingLeft: 0,
                paddingRight: 0,
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/edify-logo.png" alt="Edify" style={{ height: 24, display: 'block' }} />
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.1em', textTransform: 'uppercase', color: DIGEST.ink }}>
                  {WEEKLY_DIGEST_META.name}
                </div>
                <div style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: DIGEST.inkMuted, marginTop: 3 }}>
                  {WEEKLY_DIGEST_META.scope} · {WEEKLY_DIGEST_META.weekLabel}
                </div>
              </div>
            </div>

            {/* Sections, all via the registry */}
            <div style={{ padding: '24px 32px 8px' }}>
              <DigestBody sections={sections} />
            </div>

            {/* Footer */}
            <div style={{ margin: '26px 32px 0', borderTop: `2px solid ${DIGEST.ruleStrong}`, padding: '14px 0 22px' }}>
              <p style={{ margin: 0, fontSize: 10.5, color: DIGEST.inkMuted, lineHeight: 1.6 }}>
                You&rsquo;re receiving this because Cheryl scheduled &ldquo;{WEEKLY_DIGEST_META.name}&rdquo; for you in
                Edify. Figures cover {WEEKLY_DIGEST_META.scope.toLowerCase()}, {WEEKLY_DIGEST_META.weekLabel} — each
                section links to the live view.
              </p>
              <p style={{ margin: '8px 0 0', fontSize: 10.5, color: DIGEST.inkMuted }}>
                <span style={{ textDecoration: 'underline', cursor: 'pointer' }}>Open in Edify</span>
                {' · '}
                <span style={{ textDecoration: 'underline', cursor: 'pointer' }}>Manage this report</span>
                {' · '}
                <span style={{ textDecoration: 'underline', cursor: 'pointer' }}>Stop receiving it</span>
              </p>
            </div>
          </div>

          <div style={{ textAlign: 'center', marginTop: 18 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: INK_MUTED }}>Edify Software</div>
            <div style={{ fontSize: 11, color: INK_MUTED, marginTop: 2, textDecoration: 'underline', cursor: 'pointer' }}>
              hello@edifysystems.io
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
