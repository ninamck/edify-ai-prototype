'use client';

import Link from 'next/link';
import type { BriefingRole } from '@/components/briefing';

export type ApprovalItem = { id: string; title: string; detail: string };

export type OtherActionItem = { id: string; title: string; detail: string; href: string };

function getApprovals(role: BriefingRole): ApprovalItem[] {
  switch (role) {
    case 'ravi':
      return [
        { id: 'a1', title: 'Metro credit — £312', detail: 'Past the threshold agreed with finance — approve write-off path or escalate.' },
        { id: 'a2', title: 'Matcha estate order', detail: 'Two sites will stock out before inbound unless you authorise a top-up.' },
        { id: 'a3', title: 'Urban Fresh GRN match', detail: 'Three lines need your sign-off before period margin locks.' },
      ];
    case 'cheryl':
      return [
        { id: 'a1', title: 'Bidfood PO mismatch', detail: 'Quantities vs GRN — approve queries or tolerance write-off.' },
        { id: 'a2', title: 'Metro credit note £312', detail: '18 days open — release or dispute.' },
        { id: 'a3', title: 'Flour +12% variance', detail: 'No contract change on file — accept or dispute before recipes update.' },
      ];
    case 'gm':
      return [
        { id: 'a1', title: 'Fresh Direct short sign-off', detail: 'Milk case short on 11am drop — confirm before you sign the docket.' },
        { id: 'a2', title: 'Matcha basket add-on', detail: 'Extra case suggested — send supplier basket?' },
      ];
    case 'chairman':
      return [
        { id: 'a1', title: 'Metro credit ageing', detail: 'Executive visibility — board pack footnote if unresolved by Friday.' },
        { id: 'a2', title: 'Matcha velocity (two sites)', detail: 'Quinn can brief detail — no sign-off required unless you want it.' },
      ];
    default:
      return [];
  }
}

function getOtherActions(role: BriefingRole): OtherActionItem[] {
  switch (role) {
    case 'ravi':
      return [
        {
          id: 'o1',
          title: 'Weekend brunch recipe card',
          detail: 'Review when Quinn finishes costing.',
          href: '/v1?open=recipe-costing',
        },
        {
          id: 'o2',
          title: 'Estate labour vs roster',
          detail: 'Scan estate — City Centre flagged only.',
          href: '/v1?open=labour-roster',
        },
      ];
    case 'cheryl':
      return [
        {
          id: 'o1',
          title: 'Period cost pack',
          detail: 'Export for audit trail.',
          href: '/v1?open=cost-pack-export',
        },
        {
          id: 'o2',
          title: 'Missing invoices',
          detail: 'Chase Urban Fresh & Lacto before close.',
          href: '/v1?open=invoice-chase',
        },
      ];
    case 'gm':
      return [
        {
          id: 'o1',
          title: 'Temperature checks & fire door log',
          detail: 'Run AM/PM checks and complete the fire door log.',
          href: '/v1?open=compliance-daily-checks',
        },
        {
          id: 'o2',
          title: 'HO policy acknowledgement',
          detail: 'Acknowledge by end of day.',
          href: '/v1?open=ho-policy-ack',
        },
      ];
    case 'chairman':
      return [
        {
          id: 'o1',
          title: 'Board-line matcha detail',
          detail: 'Optional: ask Quinn for depth.',
          href: '/v1?open=matcha-board-detail',
        },
      ];
    default:
      return [];
  }
}

export function approvalCountForRole(role: BriefingRole): number {
  return getApprovals(role).length;
}

export default function MorningBriefingActionsPanel({ briefingRole }: { briefingRole: BriefingRole }) {
  const approvals = getApprovals(briefingRole);
  const other = getOtherActions(briefingRole);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <div>
        <div style={{
          fontSize: '10px',
          fontWeight: 700,
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          color: 'var(--color-text-muted)',
          marginBottom: '10px',
        }}>
          Needs your approval
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {approvals.map((item) => (
            <div
              key={item.id}
              style={{
                padding: '11px 12px',
                borderRadius: '10px',
                border: '1px solid var(--color-border-subtle)',
                background: 'rgba(155, 34, 38, 0.04)',
              }}
            >
              <div style={{
                fontSize: '12.5px',
                fontWeight: 700,
                color: 'var(--color-text-primary)',
                marginBottom: '6px',
                lineHeight: 1.3,
              }}>
                {item.title}
              </div>
              <p style={{ margin: '0 0 10px', fontSize: '12px', color: 'var(--color-text-secondary)', lineHeight: 1.5 }}>
                {item.detail}
              </p>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  style={{
                    padding: '5px 12px',
                    borderRadius: '8px',
                    fontSize: '11px',
                    fontWeight: 600,
                    fontFamily: 'var(--font-primary)',
                    border: 'none',
                    cursor: 'pointer',
                    background: 'var(--color-accent-deep)',
                    color: '#F4F1EC',
                  }}
                >
                  Approve
                </button>
                <button
                  type="button"
                  style={{
                    padding: '5px 12px',
                    borderRadius: '8px',
                    fontSize: '11px',
                    fontWeight: 600,
                    fontFamily: 'var(--font-primary)',
                    border: '1px solid var(--color-border)',
                    cursor: 'pointer',
                    background: '#fff',
                    color: 'var(--color-text-secondary)',
                  }}
                >
                  Review
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {other.length > 0 && (
        <div>
          <div style={{
            fontSize: '10px',
            fontWeight: 700,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            color: 'var(--color-text-muted)',
            marginBottom: '10px',
          }}>
            Other actions
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {other.map((item) => (
              <div
                key={item.id}
                style={{
                  padding: '11px 12px',
                  borderRadius: '10px',
                  border: '1px solid var(--color-border-subtle)',
                  background: 'rgba(155, 34, 38, 0.04)',
                }}
              >
                <div style={{
                  fontSize: '12.5px',
                  fontWeight: 700,
                  color: 'var(--color-text-primary)',
                  marginBottom: '6px',
                  lineHeight: 1.3,
                }}
                >
                  {item.title}
                </div>
                <p style={{ margin: '0 0 10px', fontSize: '12px', color: 'var(--color-text-secondary)', lineHeight: 1.5 }}>
                  {item.detail}
                </p>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  <Link
                    href={item.href}
                    style={{
                      padding: '5px 12px',
                      borderRadius: '8px',
                      fontSize: '11px',
                      fontWeight: 600,
                      fontFamily: 'var(--font-primary)',
                      border: 'none',
                      cursor: 'pointer',
                      background: 'var(--color-accent-deep)',
                      color: '#F4F1EC',
                      textDecoration: 'none',
                      display: 'inline-block',
                    }}
                  >
                    Run
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
