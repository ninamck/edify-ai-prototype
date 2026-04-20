'use client';

import { useMemo, useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertCircle, Pencil, RotateCcw, Plus, X, ChevronDown } from 'lucide-react';
import {
  useApprovals,
  approveApproval,
  declineApproval,
  getUser,
  RULE_LABELS,
  type PendingApproval,
  type PendingApprovalLine,
} from './approvalsStore';
import { useActingUser } from '@/components/DemoControls/demoStore';
import { INGREDIENTS, SUPPLIER_PRODUCTS } from '@/app/assisted-ordering/data/mockOrders';

interface SiteProduct {
  id: string;
  description: string;
  unitPrice: number;
}

const SITE_CATALOG: SiteProduct[] = SUPPLIER_PRODUCTS
  .filter(p => p.isPrimary && p.available)
  .map<SiteProduct | null>(p => {
    const ing = INGREDIENTS.find(i => i.id === p.ingredientId);
    if (!ing) return null;
    return {
      id: p.ingredientId,
      description: `${ing.name} (${ing.variant}) — ${p.unitName}`,
      unitPrice: p.unitCost,
    };
  })
  .filter((x): x is SiteProduct => x !== null)
  .sort((a, b) => a.description.localeCompare(b.description));

export default function ApprovalsPageView() {
  const approvals = useApprovals();
  const actingUserId = useActingUser();
  const actingUser = getUser(actingUserId);
  const isManager = actingUser?.role === 'manager';

  const pending = useMemo(() => approvals.filter(a => a.status === 'pending'), [approvals]);
  const reviewed = useMemo(() => approvals.filter(a => a.status !== 'pending'), [approvals]);

  const [selected, setSelected] = useState<PendingApproval | null>(null);

  if (!isManager) {
    return (
      <div style={{ fontFamily: 'var(--font-primary)' }}>
        <h1 style={{ fontSize: '22px', fontWeight: 700, color: 'var(--color-text-primary)', margin: '0 0 20px' }}>
          Review Approvals
        </h1>
        <div style={{
          padding: '32px',
          borderRadius: '12px',
          background: '#fff',
          border: '1px solid var(--color-border-subtle)',
          textAlign: 'center',
          color: 'var(--color-text-secondary)',
          fontSize: '14px',
          lineHeight: 1.5,
        }}>
          Approvals are only visible to managers.<br />
          Switch to <strong style={{ color: 'var(--color-text-primary)' }}>Priya</strong> in demo controls to review team orders.
        </div>
      </div>
    );
  }

  return (
    <div style={{ fontFamily: 'var(--font-primary)' }}>
      <h1 style={{ fontSize: '22px', fontWeight: 700, color: 'var(--color-text-primary)', margin: '0 0 20px' }}>
        Review Approvals
      </h1>

      {/* Summary line */}
      <div style={{ display: 'flex', alignItems: 'baseline', gap: '14px', flexWrap: 'wrap', marginBottom: '20px', fontSize: '13px', color: 'var(--color-text-muted)' }}>
        <span>
          <span style={{ fontSize: '18px', fontWeight: 700, color: 'var(--color-text-primary)' }}>{pending.length}</span>
          {' '}pending review
        </span>
        <span aria-hidden="true" style={{ color: 'var(--color-border-subtle)' }}>·</span>
        <span>
          <span style={{ fontSize: '18px', fontWeight: 700, color: 'var(--color-text-primary)' }}>{reviewed.length}</span>
          {' '}reviewed
        </span>
      </div>

      {pending.length === 0 ? (
        <div style={{
          padding: '48px 24px',
          borderRadius: '12px',
          background: '#fff',
          border: '1px solid var(--color-border-subtle)',
          textAlign: 'center',
          color: 'var(--color-text-secondary)',
          fontSize: '14px',
        }}>
          No orders waiting for review.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {pending.map(a => (
            <ApprovalCard key={a.id} approval={a} onOpen={() => setSelected(a)} />
          ))}
        </div>
      )}

      {selected && (
        <ApprovalReviewModal
          approval={selected}
          reviewerId={actingUserId}
          onClose={() => setSelected(null)}
        />
      )}
    </div>
  );
}

function ApprovalCard({ approval, onOpen }: { approval: PendingApproval; onOpen: () => void }) {
  const submitter = getUser(approval.submittedById);
  return (
    <button
      onClick={onOpen}
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '10px',
        padding: '16px 18px',
        borderRadius: '12px',
        background: '#fff',
        border: '1px solid var(--color-border-subtle)',
        cursor: 'pointer',
        textAlign: 'left',
        fontFamily: 'var(--font-primary)',
        transition: 'border-color 0.12s, box-shadow 0.12s',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = 'var(--color-accent-active)';
        e.currentTarget.style.boxShadow = '0 2px 10px rgba(34,68,68,0.08)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = 'var(--color-border-subtle)';
        e.currentTarget.style.boxShadow = 'none';
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--color-text-primary)' }}>
            {approval.poNumber} — {approval.supplier}
          </div>
          <div style={{ fontSize: '12px', color: 'var(--color-text-secondary)', marginTop: '2px' }}>
            {submitter?.name ?? '—'} <span style={{ color: 'var(--color-text-muted)' }}>({submitter?.role.replace('_', ' ')})</span> · {approval.submittedAt}
          </div>
        </div>
        <div style={{ fontSize: '16px', fontWeight: 700, color: 'var(--color-text-primary)' }}>
          ${approval.total.toFixed(2)}
          <span style={{ fontSize: '11px', fontWeight: 500, color: 'var(--color-text-muted)', marginLeft: '8px' }}>
            {approval.lines.length} items
          </span>
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
        {approval.triggeredRules.map((tr, i) => (
          <div key={i} style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            fontSize: '12px',
            color: 'var(--color-warning)',
            fontWeight: 600,
          }}>
            <AlertCircle size={12} strokeWidth={2.2} />
            <span>{RULE_LABELS[tr.rule]}</span>
            <span style={{ color: 'var(--color-text-secondary)', fontWeight: 400 }}>— {tr.detail}</span>
          </div>
        ))}
      </div>
    </button>
  );
}

function ApprovalReviewModal({ approval, reviewerId, onClose }: { approval: PendingApproval; reviewerId: string; onClose: () => void }) {
  const [declineMode, setDeclineMode] = useState(false);
  const [reason, setReason] = useState('');
  const [editMode, setEditMode] = useState(false);
  const [editedLines, setEditedLines] = useState<PendingApprovalLine[]>(approval.lines);
  const [approvalNote, setApprovalNote] = useState('');
  const submitter = getUser(approval.submittedById);

  useEffect(() => {
    setEditedLines(approval.lines);
  }, [approval.lines]);

  const edited = useMemo(() => {
    if (editedLines.length !== approval.lines.length) return true;
    return editedLines.some((l, i) => {
      const orig = approval.lines[i];
      return !orig || l.sku !== orig.sku || l.qty !== orig.qty || l.description !== orig.description || l.unitPrice !== orig.unitPrice;
    });
  }, [editedLines, approval.lines]);

  const editedTotal = useMemo(
    () => editedLines.reduce((sum, l) => sum + l.qty * l.unitPrice, 0),
    [editedLines],
  );

  const updateLine = (sku: string, patch: Partial<PendingApprovalLine>) => {
    setEditedLines(prev => prev.map(l => l.sku === sku ? { ...l, ...patch } : l));
  };

  const removeLine = (sku: string) => {
    setEditedLines(prev => prev.filter(l => l.sku !== sku));
  };

  const addLine = () => {
    const newSku = `NEW-${Date.now()}`;
    setEditedLines(prev => [...prev, {
      sku: newSku,
      description: '',
      qty: 1,
      unitPrice: 0,
    }]);
  };

  const resetEdits = () => { setEditedLines(approval.lines); setApprovalNote(''); };

  const handleApprove = () => {
    approveApproval(
      approval.id,
      reviewerId,
      edited ? editedLines : undefined,
      edited ? approvalNote : undefined,
    );
    onClose();
  };

  const handleDecline = () => {
    if (!reason.trim()) return;
    declineApproval(approval.id, reviewerId, reason.trim());
    onClose();
  };

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(10,20,25,0.48)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        padding: '24px',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: 'min(560px, calc(100vw - 48px))',
          maxHeight: 'min(80vh, 720px)',
          background: '#fff',
          borderRadius: '14px',
          boxShadow: '0 24px 60px rgba(34,68,68,0.2)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          fontFamily: 'var(--font-primary)',
        }}
      >
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--color-border-subtle)' }}>
          <div style={{ fontSize: '15px', fontWeight: 700, color: 'var(--color-text-primary)' }}>
            {approval.poNumber} — {approval.supplier}
          </div>
          <div style={{ fontSize: '12px', color: 'var(--color-text-secondary)', marginTop: '2px' }}>
            {submitter?.name ?? '—'} ({submitter?.role.replace('_', ' ')}) ·{' '}
            {edited ? (
              <>
                <span style={{ textDecoration: 'line-through', color: 'var(--color-text-muted)' }}>${approval.total.toFixed(2)}</span>
                {' → '}
                <span style={{ fontWeight: 700, color: 'var(--color-accent-active)' }}>${editedTotal.toFixed(2)}</span>
              </>
            ) : (
              <span>${approval.total.toFixed(2)}</span>
            )}
            {' · '}{approval.submittedAt}
          </div>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div>
            <div style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--color-text-muted)', marginBottom: '8px' }}>
              Why this needs review
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {approval.triggeredRules.map((tr, i) => (
                <div key={i} style={{
                  padding: '10px 12px',
                  borderRadius: '8px',
                  background: 'var(--color-warning-light)',
                  border: '1px solid var(--color-warning-border)',
                  fontSize: '12px',
                  lineHeight: 1.4,
                }}>
                  <div style={{ fontWeight: 700, color: 'var(--color-warning)', marginBottom: '2px' }}>
                    {RULE_LABELS[tr.rule]}
                  </div>
                  <div style={{ color: 'var(--color-text-primary)' }}>
                    {tr.detail}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
              <div style={{ flex: 1, fontSize: '11px', fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--color-text-muted)' }}>
                Order lines
              </div>
              {editMode && edited && (
                <button
                  type="button"
                  onClick={resetEdits}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                    padding: '4px 8px',
                    borderRadius: '6px',
                    background: 'none',
                    border: 'none',
                    fontSize: '11px',
                    fontWeight: 600,
                    fontFamily: 'var(--font-primary)',
                    color: 'var(--color-text-secondary)',
                    cursor: 'pointer',
                  }}
                >
                  <RotateCcw size={11} strokeWidth={2.2} />
                  Reset
                </button>
              )}
              <button
                type="button"
                onClick={() => setEditMode(v => !v)}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  padding: '4px 10px',
                  borderRadius: '6px',
                  background: editMode ? 'var(--color-accent-active)' : 'var(--color-bg-hover)',
                  border: editMode ? 'none' : '1px solid var(--color-border)',
                  fontSize: '11px',
                  fontWeight: 700,
                  fontFamily: 'var(--font-primary)',
                  color: editMode ? '#fff' : 'var(--color-text-primary)',
                  cursor: 'pointer',
                }}
              >
                <Pencil size={11} strokeWidth={2.2} />
                {editMode ? 'Done' : 'Edit'}
              </button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {editedLines.map((l) => {
                const original = approval.lines.find(o => o.sku === l.sku);
                const qtyChanged = original && original.qty !== l.qty;
                const isNew = !original;
                return (
                  <div key={l.sku} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px', fontSize: '13px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1, minWidth: 0 }}>
                      {editMode ? (
                        <>
                          <input
                            type="number"
                            min={0}
                            value={l.qty}
                            onChange={e => updateLine(l.sku, { qty: Math.max(0, Number.parseInt(e.target.value, 10) || 0) })}
                            aria-label="Quantity"
                            style={{
                              width: '56px',
                              padding: '4px 6px',
                              borderRadius: '6px',
                              border: '1px solid var(--color-border)',
                              fontSize: '12px',
                              fontFamily: 'var(--font-primary)',
                              textAlign: 'right',
                              outline: 'none',
                              color: 'var(--color-text-primary)',
                              flexShrink: 0,
                            }}
                          />
                          <span style={{ color: 'var(--color-text-muted)', flexShrink: 0 }}>×</span>
                          {isNew ? (
                            <div style={{ position: 'relative', flex: 1, minWidth: 0 }}>
                              <select
                                value={l.description ? SITE_CATALOG.find(p => p.description === l.description)?.id ?? '' : ''}
                                onChange={e => {
                                  const picked = SITE_CATALOG.find(p => p.id === e.target.value);
                                  if (picked) updateLine(l.sku, { description: picked.description, unitPrice: picked.unitPrice });
                                }}
                                aria-label="Select product"
                                style={{
                                  width: '100%',
                                  padding: '4px 26px 4px 8px',
                                  borderRadius: '6px',
                                  border: '1px solid var(--color-border)',
                                  fontSize: '12px',
                                  fontFamily: 'var(--font-primary)',
                                  outline: 'none',
                                  color: l.description ? 'var(--color-text-primary)' : 'var(--color-text-muted)',
                                  background: '#fff',
                                  appearance: 'none',
                                  WebkitAppearance: 'none',
                                  MozAppearance: 'none',
                                  cursor: 'pointer',
                                }}
                              >
                                <option value="" disabled>Select product…</option>
                                {SITE_CATALOG.map(p => (
                                  <option key={p.id} value={p.id}>{p.description} · ${p.unitPrice.toFixed(2)}</option>
                                ))}
                              </select>
                              <ChevronDown
                                size={12}
                                strokeWidth={2.2}
                                color="var(--color-text-muted)"
                                style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}
                              />
                            </div>
                          ) : (
                            <span style={{ color: 'var(--color-text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1, minWidth: 0 }}>
                              {l.description}
                            </span>
                          )}
                          <button
                            type="button"
                            onClick={() => removeLine(l.sku)}
                            aria-label="Remove line"
                            style={{
                              padding: '2px',
                              borderRadius: '4px',
                              background: 'none',
                              border: 'none',
                              color: 'var(--color-text-muted)',
                              cursor: 'pointer',
                              display: 'inline-flex',
                              flexShrink: 0,
                            }}
                          >
                            <X size={13} strokeWidth={2.2} />
                          </button>
                        </>
                      ) : (
                        <>
                          <span style={{ minWidth: '28px', textAlign: 'right', color: qtyChanged ? 'var(--color-accent-active)' : 'var(--color-text-primary)', fontWeight: qtyChanged ? 700 : 400 }}>
                            {l.qty}
                          </span>
                          <span style={{ color: 'var(--color-text-primary)', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            × {l.description || <em style={{ color: 'var(--color-text-muted)' }}>(new item)</em>}
                          </span>
                          {qtyChanged && !editMode && original && (
                            <span style={{ fontSize: '11px', color: 'var(--color-text-muted)', textDecoration: 'line-through' }}>
                              was {original.qty}
                            </span>
                          )}
                          {isNew && (
                            <span style={{ fontSize: '10px', fontWeight: 700, padding: '1px 6px', borderRadius: '100px', background: 'var(--color-accent-active)', color: '#fff', letterSpacing: '0.02em' }}>
                              NEW
                            </span>
                          )}
                        </>
                      )}
                    </div>
                    <span style={{ fontWeight: 600, color: 'var(--color-text-secondary)', flexShrink: 0 }}>
                      ${(l.qty * l.unitPrice).toFixed(2)}
                    </span>
                  </div>
                );
              })}
              {editMode && (
                <button
                  type="button"
                  onClick={addLine}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                    padding: '6px 10px',
                    marginTop: '4px',
                    alignSelf: 'flex-start',
                    borderRadius: '6px',
                    background: 'var(--color-bg-hover)',
                    border: '1px dashed var(--color-border)',
                    fontSize: '12px',
                    fontWeight: 600,
                    fontFamily: 'var(--font-primary)',
                    color: 'var(--color-text-primary)',
                    cursor: 'pointer',
                  }}
                >
                  <Plus size={12} strokeWidth={2.4} />
                  Add item
                </button>
              )}
            </div>
          </div>

          <AnimatePresence initial={false}>
            {edited && (
              <motion.div
                key="approval-note"
                initial={{ opacity: 0, height: 0, marginTop: -16 }}
                animate={{ opacity: 1, height: 'auto', marginTop: 0 }}
                exit={{ opacity: 0, height: 0, marginTop: -16 }}
                transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
                style={{ overflow: 'hidden' }}
              >
                <div style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--color-text-muted)', marginBottom: '8px' }}>
                  Note to {submitter?.name?.split(' ')[0] ?? 'submitter'} (optional)
                </div>
                <textarea
                  value={approvalNote}
                  onChange={e => setApprovalNote(e.target.value)}
                  placeholder="Let them know why you made these changes — e.g. dropped espresso blend to stay within weekly cap, added decaf to hit MOV."
                  rows={3}
                  style={{
                    width: '100%',
                    padding: '8px 10px',
                    borderRadius: '8px',
                    border: '1px solid var(--color-border)',
                    fontSize: '12px',
                    fontFamily: 'var(--font-primary)',
                    resize: 'vertical',
                    boxSizing: 'border-box',
                    outline: 'none',
                    color: 'var(--color-text-primary)',
                  }}
                />
              </motion.div>
            )}
          </AnimatePresence>

          {declineMode && (
            <div>
              <div style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--color-text-muted)', marginBottom: '8px' }}>
                Reason for declining
              </div>
              <textarea
                value={reason}
                onChange={e => setReason(e.target.value)}
                placeholder={`Let ${submitter?.name.split(' ')[0] ?? 'them'} know why — e.g. split this into two smaller orders to stay under the weekly cap.`}
                rows={3}
                autoFocus
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  borderRadius: '8px',
                  border: '1px solid var(--color-border)',
                  fontSize: '13px',
                  fontFamily: 'var(--font-primary)',
                  resize: 'vertical',
                  boxSizing: 'border-box',
                  outline: 'none',
                  color: 'var(--color-text-primary)',
                }}
              />
            </div>
          )}
        </div>

        <div style={{
          display: 'flex',
          gap: '8px',
          padding: '12px 20px',
          borderTop: '1px solid var(--color-border-subtle)',
        }}>
          {declineMode ? (
            <>
              <button
                onClick={() => { setDeclineMode(false); setReason(''); }}
                style={{
                  flex: 1,
                  padding: '9px 14px',
                  borderRadius: '8px',
                  background: 'var(--color-bg-hover)',
                  border: '1px solid var(--color-border)',
                  fontSize: '13px',
                  fontWeight: 600,
                  fontFamily: 'var(--font-primary)',
                  color: 'var(--color-text-primary)',
                  cursor: 'pointer',
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleDecline}
                disabled={!reason.trim()}
                style={{
                  flex: 1,
                  padding: '9px 14px',
                  borderRadius: '8px',
                  background: reason.trim() ? 'var(--color-error)' : 'var(--color-bg-hover)',
                  border: 'none',
                  fontSize: '13px',
                  fontWeight: 700,
                  fontFamily: 'var(--font-primary)',
                  color: reason.trim() ? '#fff' : 'var(--color-text-muted)',
                  cursor: reason.trim() ? 'pointer' : 'not-allowed',
                }}
              >
                Send decline
              </button>
            </>
          ) : (
            <>
              <button
                onClick={onClose}
                style={{
                  flex: '0 0 auto',
                  padding: '9px 14px',
                  borderRadius: '8px',
                  background: 'var(--color-bg-hover)',
                  border: '1px solid var(--color-border)',
                  fontSize: '13px',
                  fontWeight: 600,
                  fontFamily: 'var(--font-primary)',
                  color: 'var(--color-text-primary)',
                  cursor: 'pointer',
                }}
              >
                Close
              </button>
              <button
                onClick={() => setDeclineMode(true)}
                style={{
                  flex: 1,
                  padding: '9px 14px',
                  borderRadius: '8px',
                  background: '#fff',
                  border: '1px solid var(--color-error)',
                  fontSize: '13px',
                  fontWeight: 700,
                  fontFamily: 'var(--font-primary)',
                  color: 'var(--color-error)',
                  cursor: 'pointer',
                }}
              >
                Decline
              </button>
              <button
                onClick={handleApprove}
                style={{
                  flex: 1,
                  padding: '9px 14px',
                  borderRadius: '8px',
                  background: 'var(--color-accent-active)',
                  border: 'none',
                  fontSize: '13px',
                  fontWeight: 700,
                  fontFamily: 'var(--font-primary)',
                  color: '#fff',
                  cursor: 'pointer',
                }}
              >
                {edited ? 'Approve with edits' : 'Approve'}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
