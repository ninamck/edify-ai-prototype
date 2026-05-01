'use client';

import { type ReactNode } from 'react';
import { Pencil, ListChecks, type LucideIcon } from 'lucide-react';
import type { BriefingRole } from '@/components/briefing';
import { useFloorActions, FLOOR_ACTION_ICON_MAP } from '@/components/useFloorActions';

function FloorActionSquare({
  label,
  icon: Icon,
  onClick,
  badge,
  dot,
}: {
  label: ReactNode;
  icon: React.ElementType;
  onClick: () => void;
  badge?: number;
  dot?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        width: '88px',
        minWidth: '88px',
        minHeight: '88px',
        padding: '10px 7px',
        borderRadius: '12px',
        border: '1px solid var(--color-border-subtle)',
        background: '#fff',
        boxShadow: '0 1px 3px rgba(58,48,40,0.08), 0 0 0 1px rgba(58,48,40,0.03)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'flex-start',
        gap: '6px',
        cursor: 'pointer',
        fontFamily: 'var(--font-primary)',
        position: 'relative',
        transition: 'border-color 0.15s ease, box-shadow 0.15s ease',
        boxSizing: 'border-box',
      }}
    >
      <span style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: '34px',
          height: '34px',
          borderRadius: '8px',
          background: 'var(--color-bg-surface)',
        }}>
          <Icon size={17} color="var(--color-text-secondary)" strokeWidth={2} />
        </span>
        {badge != null && (
          <span style={{
            position: 'absolute',
            top: '-6px',
            right: '-10px',
            minWidth: '18px',
            height: '18px',
            padding: '0 5px',
            borderRadius: '100px',
            background: 'var(--color-accent-deep)',
            color: '#F4F1EC',
            fontSize: '12px',
            fontWeight: 700,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            {badge}
          </span>
        )}
        {dot && (
          <span style={{
            position: 'absolute',
            top: '-2px',
            right: '-6px',
            width: '8px',
            height: '8px',
            borderRadius: '50%',
            background: 'var(--color-accent-active)',
            border: '2px solid #fff',
          }} />
        )}
      </span>
      <span style={{
        fontSize: '11px',
        fontWeight: 600,
        color: 'var(--color-text-secondary)',
        textAlign: 'center',
        lineHeight: 1.25,
        maxWidth: '100%',
      }}>
        {label}
      </span>
    </button>
  );
}

export default function FloorActionsBox({
  onReceiveDelivery,
  briefingRole,
}: {
  onReceiveDelivery?: () => void;
  /** Picks which per-role action set to render + edit. */
  briefingRole?: BriefingRole;
}) {
  const role: BriefingRole = briefingRole ?? 'ed';
  const { visibleActions, handleActionClick, setEditOpen, editPopup } =
    useFloorActions(role, onReceiveDelivery);

  return (
    <div
      style={{
        flexShrink: 0,
        width: '100%',
        padding: '14px 20px',
        borderRadius: '12px',
        background: '#fff',
        border: '2px solid rgba(217, 215, 212, 1)',
        boxShadow: '0 2px 12px rgba(58,48,40,0.1), 0 0 0 1px rgba(58,48,40,0.03)',
      }}
    >
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: '12px',
      }}>
        <span style={{
          fontSize: '15px',
          fontWeight: 700,
          letterSpacing: '0.04em',
          color: 'var(--color-text-muted)',
        }}>
          On the floor
        </span>
        <button
          type="button"
          aria-label="Edit floor actions"
          onClick={() => setEditOpen(true)}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '22px',
            height: '22px',
            borderRadius: '6px',
            border: 'none',
            background: 'transparent',
            cursor: 'pointer',
            flexShrink: 0,
          }}
        >
          <Pencil size={11} color="var(--color-text-muted)" strokeWidth={2} />
        </button>
      </div>
      {/* Squares spread evenly across the full card width so the row never feels
          left-stranded when the card sits at full width. */}
      <div style={{
        display: 'flex',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
        rowGap: '12px',
        columnGap: '12px',
        alignItems: 'flex-start',
      }}>
        {visibleActions.map((action) => {
          const IconComp: LucideIcon = FLOOR_ACTION_ICON_MAP[action.iconKey] ?? ListChecks;
          return (
            <FloorActionSquare
              key={action.id}
              label={action.label}
              icon={IconComp}
              dot={action.id === 'receive-delivery'}
              onClick={() => handleActionClick(action)}
            />
          );
        })}
      </div>

      {editPopup}
    </div>
  );
}
