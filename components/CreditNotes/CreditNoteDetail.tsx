'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Mail, Phone, Globe, ArrowUpRight, CheckCircle2, AlertTriangle, Clock } from 'lucide-react';
import StatusBadge from '@/components/Receiving/StatusBadge';
import {
  CreditNote,
  CreditNoteStatus,
  ChaseEvent,
  ChaseMethod,
  MOCK_CREDIT_NOTES,
} from './mockData';
import type { BadgeVariant } from '@/components/Receiving/StatusBadge';

function statusVariant(status: CreditNoteStatus): BadgeVariant {
  switch (status) {
    case 'Overdue':   return 'error';
    case 'Requested': return 'warning';
    case 'Chasing':   return 'warning';
    case 'Received':  return 'success';
    case 'Applied':   return 'default';
  }
}

const EVENT_ICON: Record<ChaseEvent['type'], React.ReactNode> = {
  raised:    <AlertTriangle size={13} strokeWidth={2} color="#92400E" />,
  chased:    <Mail size={13} strokeWidth={2} color="#1D4ED8" />,
  escalated: <ArrowUpRight size={13} strokeWidth={2} color="#B91C1C" />,
  received:  <CheckCircle2 size={13} strokeWidth={2} color="#15803D" />,
  applied:   <CheckCircle2 size={13} strokeWidth={2} color="#15803D" />,
};

const EVENT_BG: Record<ChaseEvent['type'], string> = {
  raised:    '#FEF3C7',
  chased:    '#DBEAFE',
  escalated: '#FEE2E2',
  received:  '#DCFCE7',
  applied:   '#DCFCE7',
};

const METHOD_ICON: Record<ChaseMethod, React.ReactNode> = {
  'Email':           <Mail size={11} strokeWidth={2} />,
  'Phone call':      <Phone size={11} strokeWidth={2} />,
  'Supplier portal': <Globe size={11} strokeWidth={2} />,
};

interface CreditNoteDetailProps {
  creditNoteId: string;
  onClose: () => void;
}

export default function CreditNoteDetail({ creditNoteId, onClose }: CreditNoteDetailProps) {
  const initial = MOCK_CREDIT_NOTES.find((cn) => cn.id === creditNoteId)!;

  // Local state so we can add chase events and change status in-memory
  const [creditNote, setCreditNote] = useState<CreditNote>(initial);
  const [view, setView] = useState<'detail' | 'log-chase' | 'mark-received' | 'success'>('detail');
  const [chaseMethod, setChaseMethod] = useState<ChaseMethod>('Email');
  const [chaseNote, setChaseNote] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [quinnDismissed, setQuinnDismissed] = useState(false);

  const canChase = creditNote.status === 'Requested' || creditNote.status === 'Chasing' || creditNote.status === 'Overdue';
  const canReceive = creditNote.status !== 'Received' && creditNote.status !== 'Applied';
  const showQuinn = canChase && !quinnDismissed;

  function handleLogChase() {
    const event: ChaseEvent = {
      id: `ce-new-${Date.now()}`,
      date: `${new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })} · ${new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}`,
      type: 'chased',
      method: chaseMethod,
      note: chaseNote || `Chased ${creditNote.supplier} via ${chaseMethod}.`,
      by: 'You',
    };
    setCreditNote((prev) => ({
      ...prev,
      status: 'Chasing',
      chaseHistory: [...prev.chaseHistory, event],
    }));
    setChaseNote('');
    setView('detail');
  }

  function handleQuinnChase() {
    const event: ChaseEvent = {
      id: `ce-quinn-${Date.now()}`,
      date: `${new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })} · ${new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}`,
      type: 'chased',
      method: 'Email',
      note: `Quinn sent a chase email to ${creditNote.supplier} on your behalf.`,
      by: 'Quinn',
    };
    setCreditNote((prev) => ({
      ...prev,
      status: 'Chasing',
      chaseHistory: [...prev.chaseHistory, event],
    }));
    setQuinnDismissed(true);
  }

  function handleMarkReceived() {
    const event: ChaseEvent = {
      id: `ce-recv-${Date.now()}`,
      date: `${new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })} · ${new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}`,
      type: 'received',
      note: `Credit note marked as received — £${creditNote.amount.toFixed(2)} to be applied to next open invoice.`,
      by: 'You',
    };
    setCreditNote((prev) => ({
      ...prev,
      status: 'Received',
      chaseHistory: [...prev.chaseHistory, event],
    }));
    setSuccessMessage(
      `${creditNote.ref} received — £${creditNote.amount.toFixed(2)} will be offset against the next open invoice from ${creditNote.supplier}.`,
    );
    setView('success');
  }

  function handleEscalate() {
    const event: ChaseEvent = {
      id: `ce-esc-${Date.now()}`,
      date: `${new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })} · ${new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}`,
      type: 'escalated',
      note: 'Escalated to manager — supplier has not responded within agreed timeframe.',
      by: 'You',
    };
    setCreditNote((prev) => ({
      ...prev,
      status: 'Overdue',
      chaseHistory: [...prev.chaseHistory, event],
    }));
  }

  return (
    <motion.div
      initial={{ x: '100%', opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ x: '100%', opacity: 0 }}
      transition={{ duration: 0.28, ease: [0.32, 0, 0.18, 1] }}
      style={{
        position: 'fixed',
        top: 0,
        right: 0,
        width: 'min(480px, 100vw)',
        height: '100vh',
        background: '#fff',
        boxShadow: '-8px 0 40px rgba(58,48,40,0.14)',
        display: 'flex',
        flexDirection: 'column',
        zIndex: 200,
        fontFamily: 'var(--font-primary)',
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          padding: '18px 20px 16px',
          borderBottom: '1px solid var(--color-border-subtle)',
          flexShrink: 0,
        }}
      >
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '17px', fontWeight: 700, color: 'var(--color-text-primary)' }}>
              {creditNote.ref}
            </span>
            <StatusBadge status={creditNote.status} variant={statusVariant(creditNote.status)} />
          </div>
          <div style={{ fontSize: '13px', color: 'var(--color-text-secondary)', marginTop: '3px' }}>
            {creditNote.supplier} · £{creditNote.amount.toFixed(2)} · {creditNote.reason}
          </div>
        </div>
        <button
          onClick={onClose}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '30px',
            height: '30px',
            borderRadius: '8px',
            background: 'var(--color-bg-hover)',
            border: 'none',
            cursor: 'pointer',
            flexShrink: 0,
          }}
        >
          <X size={15} color="var(--color-text-secondary)" strokeWidth={2} />
        </button>
      </div>

      {/* Scrollable body */}
      <div style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>

        {/* Quinn suggestion chip */}
        <AnimatePresence>
          {showQuinn && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.22 }}
              style={{
                margin: '16px 20px 0',
                padding: '12px 14px',
                borderRadius: '10px',
                background: 'var(--color-quinn-bg)',
                border: '1px solid rgba(34,68,68,0.14)',
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
              }}
            >
              <div
                style={{
                  width: '28px',
                  height: '28px',
                  borderRadius: '50%',
                  background: 'var(--color-accent-active)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                <span style={{ fontSize: '12px', fontWeight: 700, color: '#fff' }}>Q</span>
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-quinn-label)' }}>
                  Chase {creditNote.supplier} for {creditNote.ref}?
                </div>
                <div style={{ fontSize: '12px', fontWeight: 500, color: '#fff', marginTop: '1px' }}>
                  Quinn will send a chase email on your behalf
                </div>
              </div>
              <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
                <button
                  onClick={handleQuinnChase}
                  style={{
                    padding: '5px 12px',
                    borderRadius: '6px',
                    background: 'var(--color-accent-active)',
                    border: 'none',
                    color: '#fff',
                    fontSize: '12px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    fontFamily: 'var(--font-primary)',
                  }}
                >
                  Yes, chase
                </button>
                <button
                  onClick={() => setQuinnDismissed(true)}
                  style={{
                    padding: '5px 10px',
                    borderRadius: '6px',
                    background: 'transparent',
                    border: '1px solid rgba(255,255,255,0.4)',
                    color: '#fff',
                    fontSize: '12px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    fontFamily: 'var(--font-primary)',
                  }}
                >
                  Not now
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Origin card */}
        <div style={{ padding: '16px 20px 0' }}>
          <div
            style={{
              padding: '12px 14px',
              borderRadius: '9px',
              background: 'var(--color-bg-hover)',
              border: '1px solid var(--color-border-subtle)',
            }}
          >
            <div style={{ fontSize: '12px', fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--color-text-secondary)', marginBottom: '6px' }}>
              Origin
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-accent-active)' }}>
                {creditNote.originRef}
              </span>
              <span style={{ fontSize: '12px', fontWeight: 500, color: 'var(--color-text-secondary)' }}>
                · {creditNote.originType} · {creditNote.originDate}
              </span>
            </div>
            <div style={{ fontSize: '12px', fontWeight: 500, color: 'var(--color-text-secondary)', marginTop: '3px' }}>
              {creditNote.reason} — {creditNote.supplier}
            </div>
            {creditNote.supplierRef && (
              <div style={{ fontSize: '12px', fontWeight: 500, color: 'var(--color-text-secondary)', marginTop: '4px' }}>
                Supplier ref: <span style={{ fontWeight: 600 }}>{creditNote.supplierRef}</span>
              </div>
            )}
            {creditNote.linkedInvoice && (
              <div style={{ fontSize: '12px', fontWeight: 500, color: 'var(--color-text-secondary)', marginTop: '2px' }}>
                Linked invoice: <span style={{ fontWeight: 600, color: 'var(--color-accent-active)' }}>{creditNote.linkedInvoice}</span>
              </div>
            )}
          </div>
        </div>

        {/* Chase timeline */}
        <div style={{ padding: '20px 20px 0' }}>
          <div
            style={{
              fontSize: '12px',
              fontWeight: 700,
              letterSpacing: '0.04em',
              color: 'var(--color-text-secondary)',
              marginBottom: '12px',
            }}
          >
            Chase History
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {creditNote.chaseHistory.map((event, i) => (
              <TimelineEvent key={event.id} event={event} isLast={i === creditNote.chaseHistory.length - 1} />
            ))}
          </div>
        </div>

        {/* Log Chase form */}
        <AnimatePresence>
          {view === 'log-chase' && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 8 }}
              transition={{ duration: 0.2 }}
              style={{
                margin: '16px 20px 0',
                padding: '16px',
                borderRadius: '10px',
                background: '#F8F7F5',
                border: '1px solid var(--color-border-subtle)',
              }}
            >
              <div
                style={{
                  fontSize: '13px',
                  fontWeight: 700,
                  color: 'var(--color-text-primary)',
                  marginBottom: '12px',
                }}
              >
                Log a chase
              </div>

              {/* Method selection */}
              <div style={{ marginBottom: '12px' }}>
                <div
                  style={{
                    fontSize: '12px',
                    fontWeight: 600,
                    color: 'var(--color-text-secondary)',
                    marginBottom: '6px',
                    letterSpacing: '0.05em',
                  }}
                >
                  Method
                </div>
                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                  {(['Email', 'Phone call', 'Supplier portal'] as ChaseMethod[]).map((method) => (
                    <button
                      key={method}
                      onClick={() => setChaseMethod(method)}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '5px',
                        padding: '6px 12px',
                        borderRadius: '100px',
                        border: '1px solid',
                        borderColor: chaseMethod === method ? 'var(--color-accent-active)' : 'var(--color-border)',
                        background: chaseMethod === method ? 'var(--color-accent-active)' : '#fff',
                        color: chaseMethod === method ? '#fff' : 'var(--color-text-secondary)',
                        fontSize: '12px',
                        fontWeight: 600,
                        fontFamily: 'var(--font-primary)',
                        cursor: 'pointer',
                        transition: 'all 0.12s',
                      }}
                    >
                      {METHOD_ICON[method]}
                      {method}
                    </button>
                  ))}
                </div>
              </div>

              {/* Note */}
              <div style={{ marginBottom: '12px' }}>
                <div
                  style={{
                    fontSize: '12px',
                    fontWeight: 600,
                    color: 'var(--color-text-secondary)',
                    marginBottom: '6px',
                    letterSpacing: '0.05em',
                  }}
                >
                  Note (optional)
                </div>
                <textarea
                  placeholder={`Add a note about this chase…`}
                  value={chaseNote}
                  onChange={(e) => setChaseNote(e.target.value)}
                  rows={2}
                  style={{
                    width: '100%',
                    padding: '9px 12px',
                    borderRadius: '8px',
                    border: '1px solid var(--color-border)',
                    fontSize: '13px',
                    fontFamily: 'var(--font-primary)',
                    resize: 'none',
                    outline: 'none',
                    boxSizing: 'border-box',
                    background: '#fff',
                  }}
                />
              </div>

              {/* Buttons */}
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  onClick={handleLogChase}
                  style={{
                    flex: 1,
                    padding: '9px 16px',
                    borderRadius: '8px',
                    background: 'var(--color-accent-active)',
                    border: 'none',
                    color: '#fff',
                    fontSize: '13px',
                    fontWeight: 600,
                    fontFamily: 'var(--font-primary)',
                    cursor: 'pointer',
                  }}
                >
                  Confirm chase
                </button>
                <button
                  onClick={() => setView('detail')}
                  style={{
                    padding: '9px 16px',
                    borderRadius: '8px',
                    background: '#fff',
                    border: '1px solid var(--color-border)',
                    color: 'var(--color-text-secondary)',
                    fontSize: '13px',
                    fontWeight: 600,
                    fontFamily: 'var(--font-primary)',
                    cursor: 'pointer',
                  }}
                >
                  Cancel
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Mark received form */}
        <AnimatePresence>
          {view === 'mark-received' && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 8 }}
              transition={{ duration: 0.2 }}
              style={{
                margin: '16px 20px 0',
                padding: '16px',
                borderRadius: '10px',
                background: '#F0FDF4',
                border: '1px solid #BBF7D0',
              }}
            >
              <div
                style={{
                  fontSize: '13px',
                  fontWeight: 700,
                  color: 'var(--color-text-primary)',
                  marginBottom: '8px',
                }}
              >
                Mark credit note as received
              </div>
              <div
                style={{
                  fontSize: '13px',
                  color: 'var(--color-text-secondary)',
                  marginBottom: '16px',
                  lineHeight: 1.5,
                }}
              >
                Confirm that <strong>{creditNote.ref}</strong> has been received from {creditNote.supplier} for{' '}
                <strong>£{creditNote.amount.toFixed(2)}</strong>. This will be flagged for offset against the next open invoice.
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  onClick={handleMarkReceived}
                  style={{
                    flex: 1,
                    padding: '9px 16px',
                    borderRadius: '8px',
                    background: '#15803D',
                    border: 'none',
                    color: '#fff',
                    fontSize: '13px',
                    fontWeight: 600,
                    fontFamily: 'var(--font-primary)',
                    cursor: 'pointer',
                  }}
                >
                  Confirm received
                </button>
                <button
                  onClick={() => setView('detail')}
                  style={{
                    padding: '9px 16px',
                    borderRadius: '8px',
                    background: '#fff',
                    border: '1px solid var(--color-border)',
                    color: 'var(--color-text-secondary)',
                    fontSize: '13px',
                    fontWeight: 600,
                    fontFamily: 'var(--font-primary)',
                    cursor: 'pointer',
                  }}
                >
                  Cancel
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Success banner */}
        <AnimatePresence>
          {view === 'success' && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.25 }}
              style={{
                margin: '16px 20px 0',
                padding: '14px 16px',
                borderRadius: '10px',
                background: '#DCFCE7',
                border: '1px solid #BBF7D0',
                display: 'flex',
                alignItems: 'flex-start',
                gap: '10px',
              }}
            >
              <CheckCircle2 size={18} color="#15803D" strokeWidth={2} style={{ flexShrink: 0, marginTop: '1px' }} />
              <div>
                <div style={{ fontSize: '13px', fontWeight: 700, color: '#15803D', marginBottom: '3px' }}>
                  Credit note received
                </div>
                <div style={{ fontSize: '13px', color: '#166534', lineHeight: 1.5 }}>{successMessage}</div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div style={{ height: '100px' }} />
      </div>

      {/* Action bar */}
      <div
        style={{
          borderTop: '1px solid var(--color-border-subtle)',
          padding: '14px 20px',
          flexShrink: 0,
          background: '#fff',
        }}
      >
        {view === 'detail' && <ActionBar creditNote={creditNote} canChase={canChase} canReceive={canReceive} onLogChase={() => setView('log-chase')} onMarkReceived={() => setView('mark-received')} onEscalate={handleEscalate} />}
        {view !== 'detail' && (
          <div style={{ fontSize: '12px', fontWeight: 500, color: 'var(--color-text-secondary)', display: 'flex', alignItems: 'center', gap: '5px' }}>
            <Clock size={12} strokeWidth={2} />
            {view === 'log-chase' ? 'Logging a chase…' : view === 'mark-received' ? 'Confirming receipt…' : 'Done'}
          </div>
        )}
      </div>
    </motion.div>
  );
}

function ActionBar({
  creditNote,
  canChase,
  canReceive,
  onLogChase,
  onMarkReceived,
  onEscalate,
}: {
  creditNote: CreditNote;
  canChase: boolean;
  canReceive: boolean;
  onLogChase: () => void;
  onMarkReceived: () => void;
  onEscalate: () => void;
}) {
  if (creditNote.status === 'Applied') {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <CheckCircle2 size={15} color="#15803D" strokeWidth={2} />
        <span style={{ fontSize: '13px', color: '#15803D', fontWeight: 600 }}>
          Applied to {creditNote.linkedInvoice ?? 'invoice'} — no further action needed
        </span>
      </div>
    );
  }

  if (creditNote.status === 'Received') {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <CheckCircle2 size={15} color="#15803D" strokeWidth={2} />
        <span style={{ fontSize: '13px', color: '#15803D', fontWeight: 600 }}>
          Credit note received — pending application to invoice
        </span>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
      {canChase && (
        <ActionButton onClick={onLogChase} variant="primary">
          Log a chase
        </ActionButton>
      )}
      {canReceive && (
        <ActionButton onClick={onMarkReceived} variant="success">
          Mark as received
        </ActionButton>
      )}
      {canChase && creditNote.status !== 'Overdue' && (
        <ActionButton onClick={onEscalate} variant="danger">
          Escalate
        </ActionButton>
      )}
    </div>
  );
}

function ActionButton({
  children,
  onClick,
  variant,
}: {
  children: React.ReactNode;
  onClick: () => void;
  variant: 'primary' | 'success' | 'danger' | 'ghost';
}) {
  const styles: Record<string, React.CSSProperties> = {
    primary: { background: 'var(--color-accent-active)', color: '#fff', border: 'none' },
    success: { background: '#15803D', color: '#fff', border: 'none' },
    danger:  { background: '#FEE2E2', color: '#B91C1C', border: '1px solid #FECACA' },
    ghost:   { background: 'var(--color-bg-hover)', color: 'var(--color-text-secondary)', border: '1px solid var(--color-border)' },
  };
  return (
    <button
      onClick={onClick}
      style={{
        padding: '9px 18px',
        borderRadius: '8px',
        fontSize: '13px',
        fontWeight: 600,
        fontFamily: 'var(--font-primary)',
        cursor: 'pointer',
        ...styles[variant],
      }}
    >
      {children}
    </button>
  );
}

function TimelineEvent({ event, isLast }: { event: ChaseEvent; isLast: boolean }) {
  return (
    <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
      {/* Icon + connector */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0 }}>
        <div
          style={{
            width: '26px',
            height: '26px',
            borderRadius: '50%',
            background: EVENT_BG[event.type],
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          {EVENT_ICON[event.type]}
        </div>
        {!isLast && (
          <div
            style={{
              width: '1px',
              flex: 1,
              minHeight: '16px',
              background: 'var(--color-border-subtle)',
              marginTop: '4px',
            }}
          />
        )}
      </div>

      {/* Content */}
      <div style={{ flex: 1, minWidth: 0, paddingBottom: isLast ? 0 : '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap', marginBottom: '3px' }}>
          <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--color-text-primary)', textTransform: 'capitalize' }}>
            {event.type}
          </span>
          {event.method && (
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '3px',
                fontSize: '12px',
                fontWeight: 600,
                color: 'var(--color-text-secondary)',
                background: '#DBEAFE',
                padding: '1px 7px',
                borderRadius: '100px',
              }}
            >
              {METHOD_ICON[event.method]}
              {event.method}
            </span>
          )}
          <span style={{ fontSize: '12px', fontWeight: 500, color: 'var(--color-text-secondary)', marginLeft: 'auto' }}>
            {event.by}
          </span>
        </div>
        <div style={{ fontSize: '12px', fontWeight: 500, color: 'var(--color-text-secondary)', marginBottom: '4px' }}>
          {event.date}
        </div>
        {event.note && (
          <div
            style={{
              fontSize: '12px', fontWeight: 500,
              color: 'var(--color-text-secondary)',
              lineHeight: 1.5,
            }}
          >
            {event.note}
          </div>
        )}
      </div>
    </div>
  );
}
