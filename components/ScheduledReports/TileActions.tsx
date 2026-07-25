'use client';

/**
 * Per-card action chips: Chat (dead-end mock chat about this chart) and
 * Email (shortcut into the schedule-report drawer, pre-filled with this
 * insight). Matches the live product's small Chat/CSV chips in card
 * headers. Owns the open state for both drawers.
 */

import { useState } from 'react';
import { Mail, MessageSquareText } from 'lucide-react';
import ChartChatDrawer from './ChartChatDrawer';
import ScheduleReportDrawer from './ScheduleReportDrawer';

export default function TileActions({
  insightTitle,
  siteLabel,
  siblingInsights = [],
  dataWindowLabel,
}: {
  insightTitle: string;
  siteLabel: string;
  siblingInsights?: string[];
  dataWindowLabel?: string;
}) {
  const [chatOpen, setChatOpen] = useState(false);
  const [emailOpen, setEmailOpen] = useState(false);

  return (
    <>
      <span style={{ display: 'inline-flex', gap: 6 }}>
        <ActionChip
          icon={<MessageSquareText size={11.5} strokeWidth={2.2} />}
          label="Chat"
          onClick={() => setChatOpen(true)}
        />
        <ActionChip
          icon={<Mail size={11.5} strokeWidth={2.2} />}
          label="Email"
          onClick={() => setEmailOpen(true)}
        />
      </span>

      <ChartChatDrawer open={chatOpen} onClose={() => setChatOpen(false)} insightTitle={insightTitle} />
      <ScheduleReportDrawer
        open={emailOpen}
        onClose={() => setEmailOpen(false)}
        initialInsight={insightTitle}
        siblingInsights={siblingInsights}
        siteLabel={siteLabel}
        dataWindowLabel={dataWindowLabel}
      />
    </>
  );
}

function ActionChip({
  icon,
  label,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        padding: '3px 8px',
        borderRadius: 7,
        border: '1px solid var(--color-border-subtle)',
        background: '#fff',
        color: 'var(--color-text-secondary)',
        fontSize: 11,
        fontWeight: 600,
        cursor: 'pointer',
        fontFamily: 'inherit',
        whiteSpace: 'nowrap',
      }}
    >
      {icon}
      {label}
    </button>
  );
}
