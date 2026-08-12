'use client';

/**
 * Audit report — the output artefact both customers attach to an email
 * after an audit. Print-styled HTML: "Download PDF" calls
 * window.print(), and print CSS isolates the report from the app
 * chrome so the browser's Save-as-PDF produces a clean document.
 */

import { useRouter } from 'next/navigation';
import { AlertTriangle, Printer } from 'lucide-react';
import { getInstanceById, getTemplateForInstance } from '../../mockData';
import { useChecklistStore } from '../../templatesStore';
import { useCorrectiveActions } from '../../correctiveActionsStore';
import { computeScore, pointsFor, questionOutcome, severityLabel, SEVERITY_COLORS } from '../../scoring';
import type {
  ChecklistAnswer,
  ChecklistQuestion,
  ChecklistTemplate,
  Severity,
} from '../../types';

function formatDate(iso?: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric' });
}

function answerLabel(q: ChecklistQuestion, a: ChecklistAnswer | undefined): string {
  if (!a || a.value === null || a.value === '') return 'Not answered';
  if (q.responseType === 'checkbox') return a.value === true ? 'Yes' : 'No';
  if (q.responseType === 'temperature') return `${a.value}°C`;
  return String(a.value);
}

export function AuditReportClient({ instanceId }: { instanceId: string }) {
  const router = useRouter();
  const checklistStore = useChecklistStore();
  const allActions = useCorrectiveActions();

  const instance =
    checklistStore.instances.find((i) => i.id === instanceId) ?? getInstanceById(instanceId);
  const template: ChecklistTemplate | undefined = instance
    ? checklistStore.templates.find((t) => t.id === instance.templateId) ??
      getTemplateForInstance(instance)
    : undefined;

  if (!instance || !template) {
    return (
      <div style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--color-text-secondary)' }}>
        Audit record not found.
      </div>
    );
  }

  const score = instance.scoreResult ?? computeScore(template, instance.answers);
  const linkedActions = allActions.filter((a) => a.sourceInstanceId === instance.id);

  const getAnswer = (qid: string) => instance.answers.find((a) => a.questionId === qid);
  const rootQuestions = template.questions.filter((q) => !q.parentQuestionId);

  // Group by section, preserving declared order; unsectioned → General.
  const sections = template.sections ?? [];
  const groups = [
    ...sections.map((s) => ({
      name: s.name,
      id: s.id,
      questions: rootQuestions.filter((q) => q.sectionId === s.id),
    })),
    {
      name: 'General',
      id: 'general',
      questions: rootQuestions.filter(
        (q) => !q.sectionId || !sections.some((s) => s.id === q.sectionId),
      ),
    },
  ].filter((g) => g.questions.length > 0);

  const failedBySeverity = (['critical', 'medium', 'low'] as Severity[]).map((sev) => ({
    severity: sev,
    count: score.failedQuestionIds.filter((qid) => {
      const q = template.questions.find((x) => x.id === qid);
      return (q?.severity ?? 'medium') === sev;
    }).length,
  }));

  /** The auditor's comment for a failed question: the corrective draft
   *  summary, or the triggered follow-up's text answer. */
  function commentFor(q: ChecklistQuestion): string | undefined {
    const a = getAnswer(q.id);
    if (a?.correctiveActionDraft?.issueSummary) return a.correctiveActionDraft.issueSummary;
    const child = template!.questions.find(
      (fq) => fq.parentQuestionId === q.id && typeof getAnswer(fq.id)?.value === 'string' && (getAnswer(fq.id)!.value as string).trim(),
    );
    return child ? (getAnswer(child.id)!.value as string) : a?.note;
  }

  return (
    <div style={{ background: '#EDEAE4', minHeight: '100%', padding: '20px 12px 48px' }}>
      {/* Print isolation: only the report sheet prints. */}
      <style>{`
        @media print {
          body * { visibility: hidden; }
          #audit-report, #audit-report * { visibility: visible; }
          #audit-report {
            position: absolute;
            inset: 0;
            width: 100%;
            margin: 0 !important;
            border: none !important;
            box-shadow: none !important;
            border-radius: 0 !important;
          }
        }
      `}</style>

      {/* Toolbar (screen only) */}
      <div style={{ maxWidth: '760px', margin: '0 auto 14px', display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
        <button
          type="button"
          onClick={() => router.push(`/checklists/history/${instance.id}`)}
          style={{
            padding: '9px 16px',
            borderRadius: '9px',
            border: '1px solid var(--color-border)',
            background: '#fff',
            fontSize: '13px',
            fontWeight: 600,
            color: 'var(--color-text-secondary)',
            cursor: 'pointer',
            fontFamily: 'var(--font-primary)',
          }}
        >
          Back to record
        </button>
        <button
          type="button"
          onClick={() => window.print()}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            padding: '9px 16px',
            borderRadius: '9px',
            border: 'none',
            background: 'var(--color-accent-active)',
            fontSize: '13px',
            fontWeight: 700,
            color: '#F4F1EC',
            cursor: 'pointer',
            fontFamily: 'var(--font-primary)',
          }}
        >
          <Printer size={14} />
          Download PDF
        </button>
      </div>

      {/* The report sheet */}
      <div
        id="audit-report"
        style={{
          maxWidth: '760px',
          margin: '0 auto',
          background: '#fff',
          borderRadius: '10px',
          border: '1px solid var(--color-border-subtle)',
          boxShadow: '0 2px 12px rgba(0, 28, 53,0.08)',
          padding: '36px 40px',
          fontFamily: 'var(--font-primary)',
          color: '#1a1a1a',
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '20px', flexWrap: 'wrap', borderBottom: '2px solid #1a1a1a', paddingBottom: '18px', marginBottom: '20px' }}>
          <div>
            <div style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#777', marginBottom: '4px' }}>
              Audit report
            </div>
            <h1 style={{ margin: 0, fontSize: '24px', fontWeight: 800, lineHeight: 1.2 }}>
              {template.name}
            </h1>
            <div style={{ fontSize: '13px', color: '#444', marginTop: '8px', lineHeight: 1.7 }}>
              <strong>Site:</strong> {instance.site}
              <br />
              <strong>Auditor:</strong> {instance.completedBy ?? '—'}
              <br />
              <strong>Date:</strong> {formatDate(instance.completedDate)}
              {instance.completedAt ? ` · ${instance.completedAt}` : ''}
            </div>
          </div>

          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '40px', fontWeight: 800, lineHeight: 1 }}>
              {score.pct}%
            </div>
            <div style={{ fontSize: '12px', color: '#666', marginTop: '2px' }}>
              {score.pointsAwarded} / {score.pointsTotal} points · pass mark {score.passThresholdPct}%
            </div>
            <div style={{
              display: 'inline-block',
              marginTop: '8px',
              padding: '4px 16px',
              borderRadius: '100px',
              fontSize: '14px',
              fontWeight: 800,
              background: score.passed ? '#E3F2E8' : '#FDE8E8',
              color: score.passed ? '#166534' : '#B91C1C',
            }}>
              {score.passed ? 'PASSED' : 'FAILED'}
            </div>
          </div>
        </div>

        {/* Critical override banner */}
        {score.criticalFails > 0 && (
          <div style={{
            padding: '12px 16px',
            borderRadius: '8px',
            background: '#FDE8E8',
            border: '1.5px solid #B91C1C',
            fontSize: '14px',
            fontWeight: 700,
            color: '#B91C1C',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            marginBottom: '20px',
          }}>
            <AlertTriangle size={16} />
            Failed: {score.criticalFails} critical issue{score.criticalFails === 1 ? '' : 's'} — a critical fail fails the audit regardless of score.
          </div>
        )}

        {/* Summary block */}
        <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', marginBottom: '28px' }}>
          {/* Score by section */}
          <div style={summaryBoxStyle}>
            <div style={summaryTitleStyle}>Score by section</div>
            {score.sectionScores.map((s) => (
              <div key={s.sectionId} style={{ display: 'flex', justifyContent: 'space-between', gap: '16px', fontSize: '12px', lineHeight: 1.8 }}>
                <span>{s.name}</span>
                <span style={{ fontWeight: 700 }}>
                  {s.awarded} / {s.total} · {s.total > 0 ? Math.round((s.awarded / s.total) * 100) : 0}%
                </span>
              </div>
            ))}
          </div>

          {/* Fails by severity */}
          <div style={summaryBoxStyle}>
            <div style={summaryTitleStyle}>Fails by severity</div>
            {failedBySeverity.map(({ severity, count }) => (
              <div key={severity} style={{ display: 'flex', justifyContent: 'space-between', gap: '16px', fontSize: '12px', lineHeight: 1.8 }}>
                <span style={{ color: SEVERITY_COLORS[severity].text, fontWeight: 600 }}>
                  {severityLabel(severity)}
                </span>
                <span style={{ fontWeight: 700 }}>{count}</span>
              </div>
            ))}
          </div>

          {/* Actions generated */}
          <div style={{ ...summaryBoxStyle, flex: '1 1 220px' }}>
            <div style={summaryTitleStyle}>
              Actions generated ({linkedActions.length})
            </div>
            {linkedActions.length === 0 ? (
              <div style={{ fontSize: '12px', color: '#666' }}>None — clean audit.</div>
            ) : (
              linkedActions.map((a) => (
                <div key={a.id} style={{ fontSize: '12px', lineHeight: 1.6, marginBottom: '4px' }}>
                  <span style={{ fontWeight: 600 }}>{a.questionText}</span>
                  <span style={{ color: '#666' }}>
                    {' '}— {a.severity ? `${severityLabel(a.severity)} · ` : ''}
                    {a.status === 'resolved' ? 'Resolved' : a.status === 'in_progress' ? 'In progress' : 'Open'}
                    {' '}· {a.assigneeName}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Question detail, by section */}
        {groups.map((group) => {
          const sub = score.sectionScores.find((s) => s.sectionId === group.id);
          return (
            <div key={group.id} style={{ marginBottom: '24px' }}>
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'baseline',
                borderBottom: '1.5px solid #1a1a1a',
                paddingBottom: '6px',
                marginBottom: '12px',
              }}>
                <h2 style={{ margin: 0, fontSize: '15px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  {group.name}
                </h2>
                {sub && (
                  <span style={{ fontSize: '13px', fontWeight: 700 }}>
                    {sub.awarded} / {sub.total}
                  </span>
                )}
              </div>

              {group.questions.map((q) => {
                const a = getAnswer(q.id);
                const outcome = questionOutcome(q, a);
                const failed = outcome === 'fail';
                const isCriticalFail = failed && q.severity === 'critical';
                const comment = failed ? commentFor(q) : undefined;
                const photo = a?.photoDataUrl ?? a?.correctiveActionDraft?.photoDataUrl;

                return (
                  <div
                    key={q.id}
                    style={{
                      padding: '10px 12px',
                      marginBottom: '8px',
                      borderRadius: '7px',
                      border: isCriticalFail
                        ? '1.5px solid #B91C1C'
                        : failed
                        ? '1px solid #F5B5B5'
                        : '1px solid #E5E2DC',
                      background: isCriticalFail ? '#FDE8E8' : failed ? '#FEF5F5' : '#fff',
                      breakInside: 'avoid',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', alignItems: 'baseline' }}>
                      <div style={{ fontSize: '13px', fontWeight: 600, lineHeight: 1.45 }}>
                        {isCriticalFail && (
                          <span style={{ color: '#B91C1C', fontWeight: 800, marginRight: '6px' }}>
                            ⚠ CRITICAL
                          </span>
                        )}
                        {q.name}
                      </div>
                      <div style={{ display: 'flex', gap: '10px', alignItems: 'baseline', flexShrink: 0 }}>
                        <span style={{
                          fontSize: '13px',
                          fontWeight: 800,
                          color: failed ? '#B91C1C' : outcome === 'pass' ? '#166534' : '#666',
                        }}>
                          {answerLabel(q, a)}
                        </span>
                        {outcome !== 'unscored' && (
                          <span style={{ fontSize: '12px', fontWeight: 700, color: failed ? '#B91C1C' : '#444' }}>
                            {outcome === 'pass' ? pointsFor(template, q) : 0} / {pointsFor(template, q)} pts
                          </span>
                        )}
                      </div>
                    </div>

                    {(q.severity || outcome !== 'unscored') && (
                      <div style={{ fontSize: '11px', color: '#777', marginTop: '2px' }}>
                        {q.severity ? `Severity: ${severityLabel(q.severity)}` : ''}
                        {outcome === 'unscored' ? 'Not scored' : ''}
                      </div>
                    )}

                    {comment && (
                      <div style={{ fontSize: '12px', color: '#333', fontStyle: 'italic', marginTop: '6px', lineHeight: 1.5 }}>
                        &ldquo;{comment}&rdquo;
                      </div>
                    )}

                    {photo && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={photo}
                        alt="Evidence"
                        style={{ width: '140px', height: '105px', borderRadius: '6px', objectFit: 'cover', display: 'block', marginTop: '8px' }}
                      />
                    )}
                  </div>
                );
              })}
            </div>
          );
        })}

        {/* Footer */}
        <div style={{ borderTop: '1px solid #E5E2DC', paddingTop: '12px', fontSize: '11px', color: '#999' }}>
          Generated by Edify · {template.name} · {instance.site} · {formatDate(instance.completedDate)}
        </div>
      </div>
    </div>
  );
}

const summaryBoxStyle: React.CSSProperties = {
  flex: '1 1 180px',
  padding: '12px 14px',
  borderRadius: '8px',
  border: '1px solid #E5E2DC',
  background: '#FAF9F7',
};

const summaryTitleStyle: React.CSSProperties = {
  fontSize: '11px',
  fontWeight: 800,
  letterSpacing: '0.07em',
  textTransform: 'uppercase',
  color: '#777',
  marginBottom: '8px',
};
