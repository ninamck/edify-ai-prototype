'use client';

/**
 * Email preview — what a scheduled report actually lands as.
 *
 * Rendered as a webpage mocked up like an email client so the team can
 * argue about contents, not plumbing. Styled to match Edify's existing
 * transactional emails (cream background, centred logo, white card,
 * orange note banner). The shape being tested:
 *
 *   1. "What Ask Edify noticed" — the AI takeaways generated when these
 *      charts were built, pulled to the top. The email is briefing-first:
 *      a reader who stops after the summary still gets the point.
 *   2. One compact section per insight — snapshot + its takeaway.
 *   3. Attachments — a single PDF, or one clearly-named CSV per insight
 *      (a chart exported as CSV is just its underlying table).
 *   4. Footer that says why you got it and where to manage it.
 *
 * Opened from the schedule drawer ("Preview email") or a governance-page
 * row, with the selection passed in the query string. The PDF/CSV toggle
 * in the chrome flips between the two attachment variants.
 */

import { Suspense, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { ArrowLeft, FileText, FileSpreadsheet, Paperclip } from 'lucide-react';
import EdifyMark from '@/components/EdifyMark/EdifyMark';
import { emailInsightFor } from '@/components/ScheduledReports/emailInsights';
import { INSIGHT_CATALOG } from '@/components/ScheduledReports/insightCatalog';

const WEEKLY_FLASH_TITLES = new Set(
  INSIGHT_CATALOG.find((g) => g.id === 'weekly')?.insights ?? []
);

const NAVY = '#001C35';
const INK_MUTED = '#5B6B7B';
const BORDER = '#E3E7EC';
// Palette lifted from the live transactional emails (order confirmations etc.)
const CREAM = '#FBF1E9';
const NOTE_BG = '#FDF3E3';
const NOTE_BORDER = '#F3DFC0';
const NOTE_ACCENT = '#D9822B';
const BRAND_PINK = '#FF0058';

export default function EmailPreviewPage() {
  return (
    <Suspense fallback={null}>
      <EmailPreview />
    </Suspense>
  );
}

function EmailPreview() {
  const params = useSearchParams();

  const insights = (params.get('insights') ?? '').split('|').filter(Boolean);
  const name = params.get('name') || (insights.length === 1 ? insights[0] : 'Edify report');
  const site = params.get('site') || 'Fitzroy';
  const windowLabel = params.get('window') || 'Last complete week as of send date';
  const recipients = (params.get('to') ?? '').split(',').filter(Boolean);
  const cadence = params.get('cadence') || '';
  const owner = params.get('owner') || 'Nina McKenzie';

  // Format starts from the report's setting but can be flipped in the
  // chrome — the point of this page is comparing the two variants.
  const [format, setFormat] = useState<'pdf' | 'csv'>(
    (params.get('format') || 'pdf').toLowerCase() === 'csv' ? 'csv' : 'pdf'
  );

  const subject = `${name} — ${site}`;
  const toLine = recipients.length > 0 ? recipients.join(', ') : 'jarek@fitzroy-espresso.co.uk';
  const attachments = buildAttachments(format, name, site, insights);

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
          {insights.some((t) => WEEKLY_FLASH_TITLES.has(t)) && (
            <Link
              href="/email-preview/weekly-flash"
              style={{ fontSize: 12, fontWeight: 700, color: NAVY, textDecoration: 'underline' }}
            >
              View designed digest →
            </Link>
          )}
          <span style={{ marginLeft: 'auto', fontSize: 11.5, fontWeight: 600, color: INK_MUTED }}>
            Prototype — mock of the email recipients receive
          </span>
          <div
            role="tablist"
            style={{
              display: 'flex',
              alignItems: 'stretch',
              background: '#E0E4E9',
              borderRadius: 100,
              padding: 3,
            }}
          >
            {(['pdf', 'csv'] as const).map((f) => (
              <button
                key={f}
                role="tab"
                aria-selected={format === f}
                onClick={() => setFormat(f)}
                style={{
                  border: 'none',
                  borderRadius: 100,
                  padding: '5px 14px',
                  fontSize: 11.5,
                  fontWeight: 700,
                  fontFamily: 'inherit',
                  cursor: 'pointer',
                  background: format === f ? '#fff' : 'transparent',
                  color: format === f ? NAVY : INK_MUTED,
                  boxShadow: format === f ? '0 1px 3px rgba(0,28,53,0.15)' : 'none',
                }}
              >
                {f.toUpperCase()}
              </button>
            ))}
          </div>
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
          <div style={{ fontSize: 16, fontWeight: 700, color: NAVY }}>{subject}</div>
          <table style={{ marginTop: 10, fontSize: 12, color: INK_MUTED, borderCollapse: 'collapse' }}>
            <tbody>
              <tr>
                <td style={{ paddingRight: 10, fontWeight: 700 }}>From</td>
                <td>Edify Reports &lt;reports@edify.app&gt;</td>
              </tr>
              <tr>
                <td style={{ paddingRight: 10, fontWeight: 700 }}>To</td>
                <td>{toLine}</td>
              </tr>
              {cadence && (
                <tr>
                  <td style={{ paddingRight: 10, fontWeight: 700 }}>Schedule</td>
                  <td>{cadence}</td>
                </tr>
              )}
              <tr>
                <td style={{ paddingRight: 10, fontWeight: 700, verticalAlign: 'top' }}>
                  <Paperclip size={12} strokeWidth={2.2} style={{ position: 'relative', top: 1 }} />
                </td>
                <td>
                  {attachments.length} attachment{attachments.length === 1 ? '' : 's'}
                  {' · '}
                  {format === 'pdf' ? 'rendered snapshot with charts' : 'data only — one file per insight'}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Email body — matches the transactional email template */}
        <div
          style={{
            background: CREAM,
            border: `1px solid ${BORDER}`,
            borderTop: 'none',
            borderRadius: '0 0 10px 10px',
            padding: '28px 0 24px',
          }}
        >
          <div
            style={{
              maxWidth: 560,
              margin: '0 auto',
              background: '#fff',
              borderRadius: 14,
              boxShadow: '0 2px 10px rgba(0,28,53,0.06)',
              overflow: 'hidden',
            }}
          >
            <div style={{ padding: '28px 28px 8px', textAlign: 'center' }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/edify-logo.png" alt="Edify" style={{ height: 26, display: 'inline-block' }} />
              <h1 style={{ margin: '18px 0 0', fontSize: 18, fontWeight: 800, color: NAVY }}>{name}</h1>
              <div style={{ marginTop: 6, fontSize: 12, fontWeight: 600, color: INK_MUTED }}>
                {site} · {windowLabel}
              </div>
            </div>

            <div style={{ padding: '18px 28px 8px', textAlign: 'left' }}>
              {/* 1 · AI summary — note-banner treatment from the live emails */}
              {insights.length > 0 && (
                <div
                  style={{
                    borderRadius: 10,
                    border: `1px solid ${NOTE_BORDER}`,
                    background: NOTE_BG,
                    padding: '13px 16px',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, fontWeight: 800, letterSpacing: '0.06em', textTransform: 'uppercase', color: NOTE_ACCENT }}>
                    <EdifyMark size={12} color={BRAND_PINK} />
                    What Ask Edify noticed
                  </div>
                  <ul style={{ margin: '9px 0 0', padding: '0 0 0 18px', display: 'flex', flexDirection: 'column', gap: 7 }}>
                    {insights.map((title) => (
                      <li key={title} style={{ fontSize: 12.5, color: NAVY, lineHeight: 1.55 }}>
                        <strong>{shortTitle(title)}:</strong> {emailInsightFor(title).takeaway}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <p style={{ margin: '18px 0 0', fontSize: 13, color: NAVY, lineHeight: 1.6 }}>Hi there,</p>
              <p style={{ margin: '10px 0 0', fontSize: 13, color: NAVY, lineHeight: 1.6 }}>
                Here&rsquo;s your <strong>{name}</strong> for <strong>{site}</strong>, covering {windowLabel.toLowerCase()}.
                {format === 'pdf'
                  ? ' The full report is attached as a PDF.'
                  : ' The underlying data is attached as CSV — one file per insight.'}
              </p>

              {/* 2 · One compact section per insight */}
              {insights.map((title, i) => (
                <InsightSection key={title} title={title} isFirst={i === 0} />
              ))}

              {insights.length === 0 && (
                <p style={{ fontSize: 12.5, color: INK_MUTED, margin: '18px 0' }}>
                  No insights selected — pick contents in the drawer, then preview again.
                </p>
              )}

              {/* 3 · Attachments */}
              <div style={{ marginTop: 26 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, fontWeight: 800, letterSpacing: '0.06em', textTransform: 'uppercase', color: INK_MUTED }}>
                  <Paperclip size={12} strokeWidth={2.2} />
                  Attached
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 10 }}>
                  {attachments.map((a) => (
                    <AttachmentRow key={a.filename} {...a} />
                  ))}
                </div>
                {format === 'csv' && (
                  <p style={{ margin: '10px 0 0', fontSize: 11.5, color: INK_MUTED, lineHeight: 1.5 }}>
                    CSV is data only — each chart exports as its underlying table.
                  </p>
                )}
              </div>

              <p style={{ margin: '24px 0 0', fontSize: 13, color: NAVY, lineHeight: 1.6 }}>All the best,</p>
              <p style={{ margin: '2px 0 0', fontSize: 13, color: INK_MUTED, lineHeight: 1.6 }}>The Edify Team</p>
            </div>

            {/* 4 · Why you got this */}
            <div style={{ borderTop: `1px solid ${BORDER}`, padding: '14px 28px 18px', marginTop: 20 }}>
              <p style={{ margin: 0, fontSize: 11, color: INK_MUTED, lineHeight: 1.6 }}>
                You&rsquo;re receiving this because {owner} scheduled &ldquo;{name}&rdquo; for you in Edify.
                Figures reflect {owner}&rsquo;s access at the time of sending. Links below each chart open the live view.
              </p>
              <p style={{ margin: '8px 0 0', fontSize: 11, color: INK_MUTED }}>
                <span style={{ textDecoration: 'underline', cursor: 'pointer' }}>Manage this report</span>
                {' · '}
                <span style={{ textDecoration: 'underline', cursor: 'pointer' }}>Stop receiving it</span>
              </p>
            </div>
          </div>

          {/* Footer outside the card — matches the live template */}
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

type Attachment = {
  filename: string;
  size: string;
  kind: 'pdf' | 'csv';
};

/**
 * PDF: one rendered snapshot named after the report.
 * CSV: one file per insight — a multi-insight report as CSV means
 * multiple clearly-named attachments, not one merged file.
 */
function buildAttachments(format: 'pdf' | 'csv', name: string, site: string, insights: string[]): Attachment[] {
  const date = new Date().toISOString().slice(0, 10);
  if (format === 'pdf') {
    return [{ filename: `${slug(name)}_${slug(site)}_${date}.pdf`, size: pseudoSize(name, 640, 480), kind: 'pdf' }];
  }
  const titles = insights.length > 0 ? insights : [name];
  return titles.map((t) => ({
    filename: `${slug(shortTitle(t))}_${slug(site)}_${date}.csv`,
    size: pseudoSize(t, 4, 58),
    kind: 'csv',
  }));
}

function AttachmentRow({ filename, size, kind }: Attachment) {
  const Icon = kind === 'pdf' ? FileText : FileSpreadsheet;
  const iconColor = kind === 'pdf' ? '#C2402A' : '#1D7A46';
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        border: `1px solid ${BORDER}`,
        borderRadius: 10,
        padding: '9px 12px',
        background: '#FBFCFE',
      }}
    >
      <span
        style={{
          width: 30,
          height: 30,
          borderRadius: 7,
          background: '#fff',
          border: `1px solid ${BORDER}`,
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        <Icon size={15} strokeWidth={2} color={iconColor} />
      </span>
      <span style={{ flex: 1, minWidth: 0, fontSize: 12, fontWeight: 600, color: NAVY, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {filename}
      </span>
      <span style={{ fontSize: 11, fontWeight: 600, color: INK_MUTED, whiteSpace: 'nowrap' }}>
        {kind.toUpperCase()} · {size}
      </span>
    </div>
  );
}

function slug(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/** Stable fake file size so the mock doesn't jiggle between renders. */
function pseudoSize(seed: string, min: number, spread: number): string {
  const v = pseudoSeries(seed, 1)[0];
  return `${Math.round(min + v * spread)} KB`;
}

/** "Templates · Daily" prefixes read badly mid-sentence — keep the tail. */
function shortTitle(title: string): string {
  return title.split(' · ')[0];
}

function InsightSection({ title, isFirst }: { title: string; isFirst: boolean }) {
  const insight = emailInsightFor(title);
  return (
    <div style={{ marginTop: isFirst ? 24 : 26 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
        <span style={{ fontSize: 13.5, fontWeight: 700, color: NAVY, flex: 1, minWidth: 0 }}>{title}</span>
        <span style={{ fontSize: 11, fontWeight: 600, color: '#4a6cb5', whiteSpace: 'nowrap', textDecoration: 'underline', cursor: 'pointer' }}>
          Open in Edify →
        </span>
      </div>
      <p style={{ margin: '6px 0 10px', fontSize: 12, color: INK_MUTED, lineHeight: 1.5 }}>{insight.takeaway}</p>
      <MockChart kind={insight.chart} seed={title} />
    </div>
  );
}

/**
 * Deterministic placeholder "snapshot" — the shape a rendered chart
 * occupies in the email, seeded from the title so each looks distinct.
 */
function MockChart({ kind, seed }: { kind: 'bars' | 'line' | 'table'; seed: string }) {
  const values = pseudoSeries(seed, kind === 'bars' ? 6 : 12);

  const frame: React.CSSProperties = {
    border: `1px solid ${BORDER}`,
    borderRadius: 8,
    background: '#FBFCFE',
    padding: '12px 14px',
  };

  if (kind === 'table') {
    return (
      <div style={frame}>
        {values.slice(0, 4).map((v, i) => (
          <div
            key={i}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              padding: '6px 0',
              borderTop: i === 0 ? 'none' : `1px solid ${BORDER}`,
            }}
          >
            <span style={{ width: 90, height: 8, borderRadius: 4, background: '#D9DFE7' }} />
            <span style={{ flex: 1 }} />
            <span style={{ width: 34 + Math.round(v * 40), height: 8, borderRadius: 4, background: i === 0 ? NAVY : '#B9C4D0' }} />
          </div>
        ))}
      </div>
    );
  }

  if (kind === 'bars') {
    return (
      <div style={{ ...frame, display: 'flex', alignItems: 'flex-end', gap: 10, height: 96 }}>
        {values.map((v, i) => (
          <div
            key={i}
            style={{
              flex: 1,
              height: `${18 + v * 78}%`,
              borderRadius: '3px 3px 0 0',
              background: i === values.indexOf(Math.max(...values)) ? NAVY : '#B9C4D0',
            }}
          />
        ))}
      </div>
    );
  }

  const points = values
    .map((v, i) => `${(i / (values.length - 1)) * 100},${34 - v * 26}`)
    .join(' ');
  return (
    <div style={{ ...frame, height: 96, boxSizing: 'border-box' }}>
      <svg viewBox="0 0 100 36" preserveAspectRatio="none" style={{ width: '100%', height: '100%', display: 'block' }}>
        <polyline points={points} fill="none" stroke={NAVY} strokeWidth={1.6} vectorEffect="non-scaling-stroke" />
        <polyline points={`0,36 ${points} 100,36`} fill="rgba(0,28,53,0.07)" stroke="none" />
      </svg>
    </div>
  );
}

/** Stable 0..1 series from a string seed — same title, same shape. */
function pseudoSeries(seed: string, n: number): number[] {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  const out: number[] = [];
  for (let i = 0; i < n; i++) {
    h = Math.imul(h ^ (h >>> 15), 2246822519);
    out.push(((h >>> 8) % 1000) / 1000);
  }
  return out;
}
