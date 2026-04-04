'use client';

import { useState } from 'react';
import type { BriefingRole } from '@/components/briefing';
import { BriefingContent } from '@/components/Feed/MorningBriefingBody';
import MorningBriefingActionsPanel, { approvalCountForRole } from '@/components/Feed/MorningBriefingActionsPanel';

const PANEL_W = 320;

export default function MorningBriefingTimeline({
  briefingRole,
  layout = 'sidebar',
}: {
  briefingRole: BriefingRole;
  layout?: 'sidebar' | 'sheet';
}) {
  const sidebar = layout === 'sidebar';
  const [panel, setPanel] = useState<'insights' | 'actions'>('insights');
  const today = new Intl.DateTimeFormat('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(new Date());

  const actionCount = approvalCountForRole(briefingRole);

  return (
    <div
      style={{
        width: sidebar ? PANEL_W : '100%',
        minWidth: sidebar ? PANEL_W : 0,
        maxWidth: sidebar ? PANEL_W : undefined,
        height: sidebar ? '100%' : 'auto',
        minHeight: 0,
        display: 'flex',
        flexDirection: 'column',
        flexShrink: 0,
        background: '#fff',
        borderRadius: sidebar ? 12 : 0,
        border: sidebar ? '1px solid var(--color-border-subtle)' : 'none',
        boxShadow: sidebar ? '0 2px 12px rgba(58,48,40,0.1), 0 0 0 1px rgba(58,48,40,0.03)' : undefined,
        overflow: 'hidden',
        fontFamily: 'var(--font-primary)',
        boxSizing: 'border-box',
        padding: sidebar ? '14px' : '16px 0 0',
      }}
    >
      <div
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          minHeight: 0,
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            padding: '0 0 14px',
            borderBottom: '1px solid var(--color-border-subtle)',
            flexShrink: 0,
          }}
        >
          <div
            style={{
              fontSize: '12px',
              fontWeight: 600,
              color: 'var(--color-text-secondary)',
              lineHeight: 1.35,
            }}
          >
            {today}
          </div>

          <div
            role="group"
            aria-label="Briefing panel"
            style={{
              display: 'flex',
              gap: '4px',
              marginTop: '12px',
              padding: '4px',
              borderRadius: '100px',
              background: 'var(--color-bg-hover)',
              border: '1px solid var(--color-border-subtle)',
            }}
          >
            <button
              type="button"
              aria-pressed={panel === 'insights'}
              onClick={() => setPanel('insights')}
              style={{
                flex: 1,
                padding: '8px 14px',
                borderRadius: '100px',
                border: 'none',
                fontSize: '11px',
                fontWeight: 600,
                fontFamily: 'var(--font-primary)',
                cursor: 'pointer',
                background: panel === 'insights' ? 'var(--color-accent-active)' : 'transparent',
                color: panel === 'insights' ? '#fff' : 'var(--color-text-muted)',
                boxShadow: panel === 'insights' ? '0 2px 8px rgba(34,68,68,0.25)' : 'none',
                transition: 'background 0.15s ease, color 0.15s ease, box-shadow 0.15s ease',
                whiteSpace: 'nowrap',
              }}
            >
              Quinn insights
            </button>
            <button
              type="button"
              aria-pressed={panel === 'actions'}
              onClick={() => setPanel('actions')}
              style={{
                flex: 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
                padding: '8px 14px',
                borderRadius: '100px',
                border: 'none',
                fontSize: '11px',
                fontWeight: 600,
                fontFamily: 'var(--font-primary)',
                cursor: 'pointer',
                background: panel === 'actions' ? 'var(--color-accent-active)' : 'transparent',
                color: panel === 'actions' ? '#fff' : 'var(--color-text-muted)',
                boxShadow: panel === 'actions' ? '0 2px 8px rgba(34,68,68,0.25)' : 'none',
                transition: 'background 0.15s ease, color 0.15s ease, box-shadow 0.15s ease',
                whiteSpace: 'nowrap',
              }}
            >
              <span>To Review</span>
              <span
                aria-hidden
                style={{
                  minWidth: '18px',
                  height: '18px',
                  padding: '0 4px',
                  borderRadius: '50%',
                  background: panel === 'actions' ? 'rgba(255,255,255,0.3)' : 'var(--color-accent-mid)',
                  color: '#fff',
                  fontSize: '10px',
                  fontWeight: 700,
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  lineHeight: 1,
                  transition: 'background 0.15s ease',
                }}
              >
                {actionCount}
              </span>
            </button>
          </div>
        </div>

        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            minHeight: 0,
            padding: '12px 0 4px',
          }}
        >
          {panel === 'insights' ? (
            <BriefingContent role={briefingRole} />
          ) : (
            <MorningBriefingActionsPanel briefingRole={briefingRole} />
          )}
        </div>
      </div>
    </div>
  );
}
