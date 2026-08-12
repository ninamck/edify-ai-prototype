'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import {
  AlertTriangle,
  Camera,
  CheckCircle2,
  ClipboardList,
  Clock,
  MapPin,
  User,
  UserCheck,
  Wrench,
} from 'lucide-react';
import { useCorrectiveActions, resolveCorrectiveAction, markActionInProgress } from '../../correctiveActionsStore';
import { getInstanceById } from '../../mockData';
import { useChecklistStore } from '../../templatesStore';
import { SEVERITY_COLORS, severityLabel } from '../../scoring';
import { PhotoCapture } from '../../PhotoCapture';

// ─── Resolution screen ────────────────────────────────────────────────────────
//
// The store's half of a corrective action. The issue context (written by
// the auditor) is read-only up top; the store describes the fix, attaches
// photo evidence, and marks the action resolved.

export function ResolutionFlowClient({ actionId }: { actionId: string }) {
  const router = useRouter();
  const actions = useCorrectiveActions();
  const checklistStore = useChecklistStore();
  const action = actions.find((a) => a.id === actionId);

  const [resolutionText, setResolutionText] = useState('');
  const [photoDataUrl, setPhotoDataUrl] = useState<string | undefined>(undefined);
  const [justResolved, setJustResolved] = useState(false);

  if (!action) {
    return (
      <div style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--color-text-secondary)' }}>
        Corrective action not found.
      </div>
    );
  }

  // "Active" = still needs work (open or in progress); resolved is terminal.
  const isResolved = action.status === 'resolved';
  const isOpen = !isResolved;
  const sourceInstance =
    checklistStore.instances.find((i) => i.id === action.sourceInstanceId) ??
    getInstanceById(action.sourceInstanceId);
  const canResolve =
    resolutionText.trim().length > 0 && (!action.requirePhotoEvidence || Boolean(photoDataUrl));

  function handleResolve() {
    if (!action || !canResolve) return;
    resolveCorrectiveAction(action.id, {
      resolutionText: resolutionText.trim(),
      resolutionPhotoDataUrl: photoDataUrl,
      resolvedBy: action.assigneeName,
    });
    setJustResolved(true);
    setTimeout(() => router.push('/checklists/complete'), 2200);
  }

  if (justResolved) {
    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '70vh',
        padding: '24px',
        textAlign: 'center',
        gap: '16px',
      }}>
        <motion.div
          initial={{ scale: 0.6, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 260, damping: 20 }}
          style={{
            width: '72px',
            height: '72px',
            borderRadius: '50%',
            background: '#E3F2E8',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <CheckCircle2 size={36} color="#166534" />
        </motion.div>
        <div>
          <p style={{ margin: '0 0 4px', fontSize: '18px', fontWeight: 800, color: 'var(--color-text-primary)' }}>
            Corrective action resolved
          </p>
          <p style={{ margin: 0, fontSize: '13px', color: 'var(--color-text-secondary)' }}>
            {action.raisedBy} can see the fix on the source checklist record.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100%', background: '#fff', paddingBottom: isOpen ? '100px' : '40px' }}>
      <div style={{ maxWidth: '560px', margin: '0 auto', padding: '20px 16px' }}>

        {/* Summary card */}
        <div style={{
          padding: '16px',
          borderRadius: '12px',
          border: isOpen ? '1px solid #E89AAE' : '1px solid var(--color-border-subtle)',
          boxShadow: isOpen ? 'inset 3px 0 0 #B01038' : undefined,
          background: 'var(--color-bg-surface)',
          marginBottom: '16px',
          display: 'flex',
          flexDirection: 'column',
          gap: '10px',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{
              width: '44px',
              height: '44px',
              borderRadius: '10px',
              background: isOpen ? '#FCE5EB' : '#E3F2E8',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}>
              {isOpen
                ? <AlertTriangle size={20} color="#B01038" />
                : <CheckCircle2 size={22} color="#166534" />
              }
            </div>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: '15px', fontWeight: 800, color: 'var(--color-text-primary)', lineHeight: 1.35 }}>
                {action.questionText}
              </div>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', marginTop: '4px' }}>
                <span style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  padding: '2px 9px',
                  borderRadius: '100px',
                  fontSize: '12px',
                  fontWeight: 700,
                  background: action.status === 'open' ? '#FCE5EB' : action.status === 'in_progress' ? '#E4EDFB' : '#E3F2E8',
                  color: action.status === 'open' ? '#B01038' : action.status === 'in_progress' ? '#3D5CA6' : '#166534',
                }}>
                  {action.status === 'open' ? 'Open' : action.status === 'in_progress' ? 'In progress' : 'Resolved'}
                </span>
                {action.severity && (
                  <span style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    padding: '2px 9px',
                    borderRadius: '100px',
                    fontSize: '12px',
                    fontWeight: 700,
                    background: SEVERITY_COLORS[action.severity].bg,
                    color: SEVERITY_COLORS[action.severity].text,
                  }}>
                    {severityLabel(action.severity)}
                  </span>
                )}
              </span>
            </div>
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px' }}>
            <span style={metaStyle}><MapPin size={12} color="var(--color-text-muted)" />{action.site}</span>
            <span style={metaStyle}><User size={12} color="var(--color-text-muted)" />Raised by {action.raisedBy}</span>
            <span style={metaStyle}><Clock size={12} color="var(--color-text-muted)" />{action.raisedAtLabel}</span>
            <span style={metaStyle}>
              <UserCheck size={12} color="var(--color-text-muted)" />
              Assigned to {action.assigneeName}
              {action.assigneeType === 'outlet_manager' ? ' (Outlet manager)' : ''}
            </span>
          </div>

          {sourceInstance && (
            <button
              type="button"
              onClick={() => router.push(`/checklists/history/${action.sourceInstanceId}`)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '9px 12px',
                borderRadius: '8px',
                border: '1px solid var(--color-border)',
                background: '#fff',
                fontSize: '12px',
                fontWeight: 600,
                color: 'var(--color-text-secondary)',
                cursor: 'pointer',
                fontFamily: 'var(--font-primary)',
                alignSelf: 'flex-start',
              }}
            >
              <ClipboardList size={13} />
              View source checklist · {action.templateName}
            </button>
          )}
        </div>

        {/* Issue summary — the auditor's half, read-only */}
        <div style={{ marginBottom: '16px' }}>
          <div style={sectionHeaderStyle}>Issue summary · {action.raisedBy}</div>
          <div style={{
            padding: '14px 16px',
            borderRadius: '10px',
            border: '1px solid var(--color-border-subtle)',
            background: '#fff',
            fontSize: '13px',
            color: 'var(--color-text-primary)',
            lineHeight: 1.55,
            fontStyle: 'italic',
          }}>
            &ldquo;{action.issueSummary}&rdquo;
          </div>
          {action.issuePhotoDataUrl && (
            <div style={{ marginTop: '10px' }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={action.issuePhotoDataUrl}
                alt="Issue photo"
                style={{ width: '120px', height: '90px', borderRadius: '9px', objectFit: 'cover', display: 'block' }}
              />
            </div>
          )}
        </div>

        {/* Corrective action — the store's half */}
        <div>
          <div style={sectionHeaderStyle}>
            Corrective action · {action.assigneeName}
          </div>

          {isOpen ? (
            <div style={{
              padding: '16px',
              borderRadius: '12px',
              border: '1px solid var(--color-border-subtle)',
              background: '#fff',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
            }}>
              <div>
                <label style={labelStyle}>What was done to fix the issue? *</label>
                <textarea
                  value={resolutionText}
                  onChange={(e) => setResolutionText(e.target.value)}
                  placeholder="Describe the corrective action taken…"
                  rows={4}
                  style={{
                    width: '100%',
                    padding: '12px 14px',
                    borderRadius: '10px',
                    border: '1.5px solid var(--color-border)',
                    fontSize: '14px',
                    fontFamily: 'var(--font-primary)',
                    color: 'var(--color-text-primary)',
                    background: '#fff',
                    outline: 'none',
                    resize: 'vertical',
                    boxSizing: 'border-box',
                    lineHeight: 1.5,
                  }}
                />
              </div>

              <div>
                <label style={labelStyle}>
                  Photo evidence {action.requirePhotoEvidence ? '*' : '(optional)'}
                </label>
                <PhotoCapture
                  dataUrl={photoDataUrl}
                  onChange={setPhotoDataUrl}
                  label="Attach photo of the fix"
                />
                {action.requirePhotoEvidence && !photoDataUrl && (
                  <p style={{ margin: '7px 0 0', fontSize: '12px', color: 'var(--color-text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <Camera size={11} />
                    A photo is required as proof before this can be resolved.
                  </p>
                )}
              </div>
            </div>
          ) : (
            <div style={{
              padding: '16px',
              borderRadius: '12px',
              border: '1px solid #93C8A6',
              boxShadow: 'inset 3px 0 0 #166534',
              background: '#fff',
              display: 'flex',
              flexDirection: 'column',
              gap: '10px',
            }}>
              <div style={{
                fontSize: '13px',
                color: 'var(--color-text-primary)',
                lineHeight: 1.55,
                fontStyle: 'italic',
              }}>
                &ldquo;{action.resolutionText}&rdquo;
              </div>
              {action.resolutionPhotoDataUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={action.resolutionPhotoDataUrl}
                  alt="Resolution photo"
                  style={{ width: '120px', height: '90px', borderRadius: '9px', objectFit: 'cover', display: 'block' }}
                />
              )}
              <span style={{ fontSize: '12px', fontWeight: 500, color: 'var(--color-text-secondary)' }}>
                Resolved by {action.resolvedBy}
                {action.resolvedAtLabel ? ` · ${action.resolvedAtLabel}` : ''}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Fixed resolve bar */}
      {isOpen && (
        <div style={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          padding: '12px 16px',
          background: '#fff',
          borderTop: '1px solid var(--color-border-subtle)',
          boxShadow: '0 -4px 16px rgba(0, 28, 53,0.1)',
          zIndex: 100,
          display: 'flex',
          flexDirection: 'column',
          gap: '8px',
        }}>
          {action.status === 'open' && (
            <button
              type="button"
              onClick={() => markActionInProgress(action.id)}
              style={{
                width: '100%',
                maxWidth: '560px',
                margin: '0 auto',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
                padding: '11px',
                borderRadius: '10px',
                border: '1px solid var(--color-border)',
                background: '#fff',
                fontSize: '13px',
                fontWeight: 600,
                color: 'var(--color-text-secondary)',
                cursor: 'pointer',
                fontFamily: 'var(--font-primary)',
              }}
            >
              <Wrench size={13} />
              Start work — mark in progress
            </button>
          )}
          <button
            type="button"
            onClick={handleResolve}
            style={{
              width: '100%',
              maxWidth: '560px',
              margin: '0 auto',
              display: 'block',
              padding: '15px',
              borderRadius: '12px',
              border: 'none',
              background: canResolve ? '#166534' : 'var(--color-border)',
              fontSize: '15px',
              fontWeight: 700,
              color: canResolve ? '#fff' : 'var(--color-text-muted)',
              cursor: canResolve ? 'pointer' : 'default',
              fontFamily: 'var(--font-primary)',
              transition: 'background 0.2s ease, color 0.2s ease',
            }}
          >
            {canResolve
              ? 'Mark resolved'
              : action.requirePhotoEvidence && !photoDataUrl && resolutionText.trim()
              ? 'Photo evidence required'
              : 'Describe the fix to resolve'}
          </button>
        </div>
      )}
    </div>
  );
}

const metaStyle: React.CSSProperties = {
  fontSize: '12px',
  fontWeight: 500,
  color: 'var(--color-text-secondary)',
  display: 'flex',
  alignItems: 'center',
  gap: '4px',
};

const sectionHeaderStyle: React.CSSProperties = {
  fontSize: '12px',
  fontWeight: 700,
  letterSpacing: '0.04em',
  color: 'var(--color-text-muted)',
  marginBottom: '8px',
};

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: '12px',
  fontWeight: 600,
  color: 'var(--color-text-secondary)',
  marginBottom: '6px',
};
