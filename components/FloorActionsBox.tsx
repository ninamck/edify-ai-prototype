'use client';

import { type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';
import {
  CheckSquare,
  ListChecks,
  Utensils,
  Trash2,
  Truck,
  ArrowLeftRight,
  LayoutDashboard,
  X,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import CommandCentre, { type CommandCentreVariant } from '@/components/Feed/CommandCentre';
import type { BriefingRole } from '@/components/briefing';

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

export function CommandCentreModal({
  open,
  onClose,
  variant,
  siteLabel,
}: {
  open: boolean;
  onClose: () => void;
  variant: CommandCentreVariant;
  siteLabel: string;
}) {
  if (typeof document === 'undefined') return null;

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          key="cc-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          onClick={onClose}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(34,68,68,0.35)',
            backdropFilter: 'blur(4px)',
            zIndex: 1000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '24px',
          }}
        >
          <motion.div
            key="cc-panel"
            initial={{ opacity: 0, scale: 0.96, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 12 }}
            transition={{ duration: 0.22, ease: [0.34, 1.1, 0.64, 1] }}
            onClick={(e) => e.stopPropagation()}
            style={{
              width: 'min(560px, calc(100vw - 48px))',
              maxHeight: 'min(88vh, 820px)',
              background: 'var(--color-bg-nav)',
              borderRadius: '16px',
              boxShadow: '0 24px 60px rgba(34,68,68,0.2)',
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column',
              fontFamily: 'var(--font-primary)',
            }}
          >
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '14px 16px',
              borderBottom: '1px solid var(--color-border-subtle)',
              flexShrink: 0,
              background: '#fff',
            }}>
              <span style={{
                fontSize: '13px',
                fontWeight: 700,
                color: 'var(--color-text-primary)',
              }}>
                Today · Command centre
              </span>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: '32px',
                  height: '32px',
                  borderRadius: '8px',
                  border: 'none',
                  background: 'var(--color-bg-surface)',
                  cursor: 'pointer',
                }}
              >
                <X size={16} color="var(--color-text-muted)" />
              </button>
            </div>
            <div style={{
              flex: 1,
              minHeight: 0,
              overflowY: 'auto',
              padding: '16px 0 20px',
            }}>
              <CommandCentre variant={variant} siteLabel={siteLabel} embedded />
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}

export default function FloorActionsBox({
  onOpenCommandCentre,
  onReceiveDelivery,
  briefingRole,
}: {
  onOpenCommandCentre: () => void;
  onReceiveDelivery?: () => void;
  /** Reserved: filter or reorder floor tiles by persona. */
  briefingRole?: BriefingRole;
}) {
  void briefingRole;
  const router = useRouter();
  return (
    <div
      style={{
        flexShrink: 0,
        width: '100%',
        padding: '14px 20px',
        borderRadius: '12px',
        background: '#fff',
        border: '1px solid var(--color-border-subtle)',
        boxShadow: '0 2px 12px rgba(58,48,40,0.1), 0 0 0 1px rgba(58,48,40,0.03)',
      }}
    >
      <div style={{
        fontSize: '12px',
        fontWeight: 700,
        letterSpacing: '0.04em',
        color: 'var(--color-text-muted)',
        marginBottom: '12px',
      }}>
        On the floor
      </div>
      <div style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: '12px',
        alignItems: 'flex-start',
      }}>
        <FloorActionSquare label="Complete tasks" icon={CheckSquare} badge={4} onClick={() => router.push('/checklists/complete')} />
        <FloorActionSquare
          label={<>Complete your<br />checklists</>}
          icon={ListChecks}
          onClick={() => router.push('/checklists/complete')}
        />
        <FloorActionSquare label="Run production" icon={Utensils} onClick={() => {}} />
        <FloorActionSquare label="Log waste" icon={Trash2} onClick={() => {}} />
        <FloorActionSquare label="Receive delivery" icon={Truck} dot onClick={onReceiveDelivery ?? (() => {})} />
        <FloorActionSquare label="Transfer stock" icon={ArrowLeftRight} onClick={() => {}} />
        <FloorActionSquare
          label={<>View command<br />centre</>}
          icon={LayoutDashboard}
          onClick={onOpenCommandCentre}
        />
      </div>
    </div>
  );
}
