'use client';

import { ListChecks, Pencil, type LucideIcon } from 'lucide-react';
import type { BriefingRole } from '@/components/briefing';
import { useFloorActions, FLOOR_ACTION_ICON_MAP } from '@/components/useFloorActions';
import AskQuinnBar from '@/components/Mvp1/AskQuinnBar';

/**
 * Thin utility bar that sits below the H1 greeting. Contains:
 *  - inline icon + label chips for each floor action
 *  - a quiet pencil to open the edit popup (the card chrome is gone, so the
 *    edit affordance lives here)
 *  - the standard "Ask Quinn for a chart" pill on the far right
 *
 * The greeting deliberately lives outside this bar so the H1 can carry the
 * top-of-page hierarchy.
 */
export default function HomeUtilityBar({
  briefingRole,
  onReceiveDelivery,
  onAsk,
}: {
  briefingRole: BriefingRole;
  onReceiveDelivery?: () => void;
  onAsk: (seed?: string) => void;
}) {
  const { visibleActions, handleActionClick, setEditOpen, editPopup } =
    useFloorActions(briefingRole, onReceiveDelivery);

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        width: '100%',
        padding: '12px 18px',
        borderRadius: 14,
        background: '#fff',
        border: '2px solid var(--color-border)',
        boxShadow:
          '0 6px 20px rgba(58,48,40,0.12), 0 2px 6px rgba(58,48,40,0.08), 0 0 0 1px rgba(58,48,40,0.03)',
        fontFamily: 'var(--font-primary)',
        boxSizing: 'border-box',
      }}
    >
      {/* Inline floor action chips. Allowed to wrap on narrower viewports. */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          gap: 8,
          flex: 1,
          minWidth: 0,
        }}
      >
        {visibleActions.map((action) => {
          const IconComp: LucideIcon = FLOOR_ACTION_ICON_MAP[action.iconKey] ?? ListChecks;
          const showDot = action.id === 'receive-delivery';
          return (
            <button
              key={action.id}
              type="button"
              onClick={() => handleActionClick(action)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 7,
                padding: '8px 12px 8px 10px',
                borderRadius: 100,
                border: '2px solid var(--color-border-subtle)',
                background: '#fff',
                cursor: 'pointer',
                fontFamily: 'var(--font-primary)',
                fontSize: 13,
                fontWeight: 600,
                color: 'var(--color-text-primary)',
                whiteSpace: 'nowrap',
                position: 'relative',
              }}
            >
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: 26,
                  height: 26,
                  borderRadius: 7,
                  background: 'var(--color-bg-hover)',
                  position: 'relative',
                }}
              >
                <IconComp size={15} color="var(--color-accent-active)" strokeWidth={2.2} />
                {showDot && (
                  <span
                    style={{
                      position: 'absolute',
                      top: -2,
                      right: -2,
                      width: 8,
                      height: 8,
                      borderRadius: '50%',
                      background: 'var(--color-accent-active)',
                      border: '2px solid #fff',
                    }}
                  />
                )}
              </span>
              <span>{action.label}</span>
            </button>
          );
        })}

        {/* Edit affordance — relocated here because there's no card chrome */}
        <button
          type="button"
          aria-label="Edit floor actions"
          onClick={() => setEditOpen(true)}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 30,
            height: 30,
            borderRadius: 7,
            border: '1px dashed var(--color-border-subtle)',
            background: 'transparent',
            cursor: 'pointer',
            flexShrink: 0,
            marginLeft: 2,
          }}
        >
          <Pencil size={12} color="var(--color-text-muted)" strokeWidth={2} />
        </button>
      </div>

      {/* Ask Quinn pill on the far right — uses the default "Ask Quinn for a chart" label */}
      <AskQuinnBar onAsk={onAsk} />

      {editPopup}
    </div>
  );
}
