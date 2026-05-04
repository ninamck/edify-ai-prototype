'use client';

import { useMemo, useState } from 'react';
import { Check, ArrowRight, RotateCcw } from 'lucide-react';
import EdifyMark from '@/components/EdifyMark/EdifyMark';
import StatusPill from '@/components/Production/StatusPill';
import {
  PRET_QUINN_SETUP_INTERVIEW,
  type InterviewStep,
} from '@/components/Production/fixtures';

type Answer = { stepId: string; value: string | number | string[] };

export default function QuinnSetupPage() {
  const scenario = PRET_QUINN_SETUP_INTERVIEW;
  const [answers, setAnswers] = useState<Answer[]>(() =>
    scenario.steps
      .filter(s => s.kind !== 'confirm-summary')
      .map(s => {
        if (s.kind === 'numeric') {
          return { stepId: s.id, value: s.numericDefault ?? 0 };
        }
        return { stepId: s.id, value: s.defaultOptionIds?.[0] ?? '' };
      }),
  );
  const [currentIdx, setCurrentIdx] = useState(0);
  const [saved, setSaved] = useState(false);

  const step = scenario.steps[currentIdx];
  const isLast = currentIdx === scenario.steps.length - 1;

  const getAnswer = (stepId: string) => answers.find(a => a.stepId === stepId);

  function setAnswer(stepId: string, value: Answer['value']) {
    setAnswers(prev => {
      const existing = prev.findIndex(a => a.stepId === stepId);
      if (existing >= 0) {
        const next = [...prev];
        next[existing] = { stepId, value };
        return next;
      }
      return [...prev, { stepId, value }];
    });
  }

  function next() {
    setCurrentIdx(i => Math.min(scenario.steps.length - 1, i + 1));
  }

  function prev() {
    setCurrentIdx(i => Math.max(0, i - 1));
  }

  function reset() {
    setAnswers(
      scenario.steps
        .filter(s => s.kind !== 'confirm-summary')
        .map(s =>
          s.kind === 'numeric'
            ? { stepId: s.id, value: s.numericDefault ?? 0 }
            : { stepId: s.id, value: s.defaultOptionIds?.[0] ?? '' },
        ),
    );
    setCurrentIdx(0);
    setSaved(false);
  }

  // Build a chronological transcript of Quinn's questions + user replies for steps done so far
  const transcript = useMemo(() => {
    const items: Array<{
      role: 'quinn' | 'user';
      text: string;
      stepId: string;
    }> = [];
    scenario.steps.slice(0, currentIdx).forEach(s => {
      if (s.kind === 'confirm-summary') return;
      items.push({ role: 'quinn', stepId: s.id, text: s.prompt });
      const ans = getAnswer(s.id);
      if (ans) {
        items.push({ role: 'user', stepId: s.id, text: renderAnswer(s, ans.value) });
      }
    });
    return items;
  }, [answers, currentIdx, scenario.steps]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Header */}
      <div
        style={{
          padding: '12px 32px',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          borderBottom: '1px solid var(--color-border-subtle)',
          background: '#ffffff',
        }}
      >
        <EdifyMark size={16} color="var(--color-info)" />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <span style={{ fontSize: 13, fontWeight: 700 }}>{scenario.title}</span>
          <span style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>{scenario.subtitle}</span>
        </div>
        <div style={{ flex: 1 }} />
        <StatusPill tone="info" label={`Step ${currentIdx + 1} of ${scenario.steps.length}`} size="xs" />
        <button
          type="button"
          onClick={reset}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4,
            padding: '6px 10px',
            borderRadius: 8,
            fontSize: 11,
            fontWeight: 600,
            fontFamily: 'var(--font-primary)',
            background: 'transparent',
            border: '1px solid var(--color-border)',
            color: 'var(--color-text-secondary)',
            cursor: 'pointer',
          }}
        >
          <RotateCcw size={12} /> Restart
        </button>
      </div>

      <div
        style={{
          flex: 1,
          minHeight: 0,
          overflow: 'auto',
          padding: '16px 16px 32px',
          background: 'var(--color-bg-surface)',
        }}
      >
        <div style={{ maxWidth: 720, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 12 }}>
          {/* Transcript so far */}
          {transcript.map((msg, i) => (
            <Bubble key={`${msg.stepId}-${i}`} role={msg.role}>
              {msg.text}
            </Bubble>
          ))}

          {/* Current step */}
          <Bubble role="quinn">{step.prompt}</Bubble>
          {step.hint && (
            <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginLeft: 52 }}>
              {step.hint}
            </div>
          )}

          {!saved && (
            <div style={{ marginLeft: 52, marginTop: 4 }}>
              {step.kind === 'single-select' && (
                <SingleSelect
                  step={step}
                  value={(getAnswer(step.id)?.value as string) ?? ''}
                  onChange={v => setAnswer(step.id, v)}
                />
              )}
              {step.kind === 'numeric' && (
                <NumericInput
                  step={step}
                  value={(getAnswer(step.id)?.value as number) ?? 0}
                  onChange={v => setAnswer(step.id, v)}
                />
              )}
              {step.kind === 'confirm-summary' && (
                <SummaryCard
                  summary={renderSummary(scenario.summaryTemplate, answers)}
                  onSave={() => setSaved(true)}
                />
              )}
            </div>
          )}

          {saved && (
            <div
              style={{
                marginLeft: 52,
                marginTop: 4,
                padding: '14px 32px',
                borderRadius: 'var(--radius-card)',
                border: '1px solid var(--color-success-border)',
                background: 'var(--color-success-light)',
                display: 'flex',
                gap: 10,
                alignItems: 'center',
              }}
            >
              <Check size={16} color="var(--color-success)" />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 700 }}>Site setup drafted</div>
                <div style={{ fontSize: 11, color: 'var(--color-text-secondary)' }}>
                  I&rsquo;ll start learning sales patterns. In 14 days I&rsquo;ll propose the first production plan for your review.
                </div>
              </div>
              <button
                type="button"
                onClick={reset}
                style={{
                  padding: '8px 12px',
                  borderRadius: 8,
                  fontSize: 11,
                  fontWeight: 700,
                  fontFamily: 'var(--font-primary)',
                  background: '#ffffff',
                  border: '1px solid var(--color-border)',
                  color: 'var(--color-text-secondary)',
                  cursor: 'pointer',
                }}
              >
                Try again
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Footer nav */}
      {!saved && (
        <div
          style={{
            padding: '10px 16px',
            borderTop: '1px solid var(--color-border-subtle)',
            background: '#ffffff',
            display: 'flex',
            gap: 8,
            alignItems: 'center',
          }}
        >
          <button
            type="button"
            onClick={prev}
            disabled={currentIdx === 0}
            style={{
              padding: '10px 14px',
              borderRadius: 8,
              fontSize: 12,
              fontWeight: 600,
              fontFamily: 'var(--font-primary)',
              background: '#ffffff',
              border: '1px solid var(--color-border)',
              color: 'var(--color-text-secondary)',
              cursor: currentIdx === 0 ? 'not-allowed' : 'pointer',
              opacity: currentIdx === 0 ? 0.5 : 1,
            }}
          >
            Back
          </button>
          <div style={{ flex: 1 }} />
          {step.kind !== 'confirm-summary' && (
            <button
              type="button"
              onClick={next}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '10px 16px',
                borderRadius: 8,
                fontSize: 13,
                fontWeight: 700,
                fontFamily: 'var(--font-primary)',
                background: 'var(--color-accent-active)',
                color: 'var(--color-text-on-active)',
                border: '1px solid var(--color-accent-active)',
                cursor: 'pointer',
                minHeight: 42,
              }}
            >
              {isLast ? 'Review' : 'Next'} <ArrowRight size={14} />
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Subcomponents ────────────────────────────────────────────────────────────

function Bubble({ role, children }: { role: 'quinn' | 'user'; children: React.ReactNode }) {
  if (role === 'quinn') {
    return (
      <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
        <div
          style={{
            width: 40,
            height: 40,
            borderRadius: 20,
            background: 'var(--color-info-light)',
            color: 'var(--color-info)',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
            border: '1px solid var(--color-info)',
          }}
        >
          <EdifyMark size={16} />
        </div>
        <div
          style={{
            padding: '10px 14px',
            borderRadius: 'var(--radius-card)',
            background: '#ffffff',
            border: '1px solid var(--color-border-subtle)',
            fontSize: 13,
            color: 'var(--color-text-primary)',
            maxWidth: 520,
            lineHeight: 1.5,
          }}
        >
          {children}
        </div>
      </div>
    );
  }
  return (
    <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
      <div
        style={{
          padding: '10px 14px',
          borderRadius: 'var(--radius-card)',
          background: 'var(--color-accent-active)',
          color: 'var(--color-text-on-active)',
          fontSize: 13,
          maxWidth: 520,
          lineHeight: 1.5,
          fontWeight: 600,
        }}
      >
        {children}
      </div>
    </div>
  );
}

function SingleSelect({
  step,
  value,
  onChange,
}: {
  step: InterviewStep;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, maxWidth: 520 }}>
      {(step.options ?? []).map(o => {
        const active = o.id === value;
        const isQuinnDraft = step.defaultOptionIds?.includes(o.id);
        return (
          <button
            key={o.id}
            type="button"
            onClick={() => onChange(o.id)}
            style={{
              flex: '1 1 200px',
              textAlign: 'left',
              padding: '10px 12px',
              borderRadius: 10,
              fontFamily: 'var(--font-primary)',
              background: active ? 'var(--color-accent-active)' : '#ffffff',
              color: active ? 'var(--color-text-on-active)' : 'var(--color-text-primary)',
              border: `1px solid ${active ? 'var(--color-accent-active)' : 'var(--color-border)'}`,
              cursor: 'pointer',
              display: 'flex',
              flexDirection: 'column',
              gap: 2,
              position: 'relative',
            }}
          >
            <span style={{ fontSize: 13, fontWeight: 700 }}>{o.label}</span>
            {o.detail && (
              <span style={{ fontSize: 11, opacity: active ? 0.85 : 0.7 }}>{o.detail}</span>
            )}
            {isQuinnDraft && !active && (
              <span
                style={{
                  position: 'absolute',
                  top: 6,
                  right: 6,
                  fontSize: 9,
                  fontWeight: 700,
                  padding: '2px 5px',
                  borderRadius: 4,
                  background: 'var(--color-info-light)',
                  color: 'var(--color-info)',
                  letterSpacing: '0.04em',
                  textTransform: 'uppercase',
                }}
              >
                Quinn
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

function NumericInput({
  step,
  value,
  onChange,
}: {
  step: InterviewStep;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        padding: '8px 10px',
        borderRadius: 10,
        background: '#ffffff',
        border: '1px solid var(--color-border)',
      }}
    >
      <button
        type="button"
        onClick={() => onChange(Math.max(0, value - 1))}
        style={stepperBtn()}
      >
        −
      </button>
      <input
        value={value}
        onChange={e => {
          const n = parseInt(e.target.value || '0', 10);
          onChange(isNaN(n) ? 0 : n);
        }}
        inputMode="numeric"
        style={{
          width: 60,
          textAlign: 'center',
          fontSize: 18,
          fontWeight: 700,
          fontVariantNumeric: 'tabular-nums',
          border: 'none',
          outline: 'none',
          background: 'transparent',
          fontFamily: 'var(--font-primary)',
          color: 'var(--color-text-primary)',
        }}
      />
      <button
        type="button"
        onClick={() => onChange(value + 1)}
        style={stepperBtn()}
      >
        +
      </button>
      <span style={{ fontSize: 11, color: 'var(--color-text-muted)', marginLeft: 4 }}>:00</span>
      {value === step.numericDefault && (
        <span
          style={{
            fontSize: 9,
            fontWeight: 700,
            padding: '2px 5px',
            borderRadius: 4,
            background: 'var(--color-info-light)',
            color: 'var(--color-info)',
            letterSpacing: '0.04em',
            textTransform: 'uppercase',
          }}
        >
          Quinn draft
        </span>
      )}
    </div>
  );
}

function SummaryCard({ summary, onSave }: { summary: string; onSave: () => void }) {
  return (
    <div
      style={{
        padding: '14px 32px',
        borderRadius: 'var(--radius-card)',
        border: '1px solid var(--color-info)',
        background: 'var(--color-info-light)',
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
        maxWidth: 520,
      }}
    >
      <p style={{ margin: 0, fontSize: 13, color: 'var(--color-text-primary)', lineHeight: 1.6 }}>
        {summary}
      </p>
      <button
        type="button"
        onClick={onSave}
        style={{
          alignSelf: 'flex-start',
          padding: '10px 16px',
          borderRadius: 8,
          fontSize: 13,
          fontWeight: 700,
          fontFamily: 'var(--font-primary)',
          background: 'var(--color-accent-active)',
          color: 'var(--color-text-on-active)',
          border: '1px solid var(--color-accent-active)',
          cursor: 'pointer',
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
        }}
      >
        <Check size={14} /> Save & start site
      </button>
    </div>
  );
}

function stepperBtn(): React.CSSProperties {
  return {
    width: 28,
    height: 28,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 6,
    background: 'var(--color-bg-hover)',
    border: '1px solid var(--color-border)',
    fontSize: 14,
    fontWeight: 700,
    cursor: 'pointer',
    color: 'var(--color-text-primary)',
    fontFamily: 'var(--font-primary)',
  };
}

function renderAnswer(step: InterviewStep, value: string | number | string[]): string {
  if (step.kind === 'numeric') {
    return `${value}:00`;
  }
  const opt = step.options?.find(o => o.id === value);
  return opt?.label ?? String(value);
}

function renderSummary(template: string, answers: Answer[]): string {
  // Lightweight token replace. V1 just returns the template; later we interpolate.
  let out = template;
  answers.forEach(a => {
    out = out.replace(`{${a.stepId}}`, String(a.value));
  });
  return out;
}
