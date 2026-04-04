'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Camera,
  X,
  CheckSquare,
  Square,
  Thermometer,
  Hash,
  AlignLeft,
  AlertCircle,
  ChevronRight,
  GitBranch,
} from 'lucide-react';
import { getInstanceById, getTemplateForInstance } from '../../mockData';
import type { ChecklistAnswer, ChecklistQuestion, ResponseType } from '../../types';

// ─── helpers ──────────────────────────────────────────────────────────────────

function getUnit(responseType: ResponseType) {
  if (responseType === 'temperature') return '°C';
  return '';
}

function isAnswered(answer: ChecklistAnswer | undefined): boolean {
  if (!answer) return false;
  if (answer.value === null || answer.value === '') return false;
  return true;
}

function conditionMet(question: ChecklistQuestion, answer: ChecklistAnswer | undefined): string[] {
  if (!answer || answer.value === null) return [];
  const triggered: string[] = [];
  for (const rule of question.followUpRules) {
    const { type, value } = rule.condition;
    const v = answer.value;
    let met = false;
    if (type === 'checked') met = v === true;
    else if (type === 'unchecked') met = v === false;
    else if (type === 'greater_than') met = typeof v === 'number' && typeof value === 'number' && v > value;
    else if (type === 'less_than') met = typeof v === 'number' && typeof value === 'number' && v < value;
    else if (type === 'equals') met = String(v) === String(value);
    else if (type === 'contains') met = typeof v === 'string' && v.includes(String(value));
    if (met) triggered.push(rule.followUpQuestionId);
  }
  return triggered;
}

// ─── response inputs ──────────────────────────────────────────────────────────

function CheckboxInput({
  value,
  onChange,
}: {
  value: boolean | null;
  onChange: (v: boolean) => void;
}) {
  return (
    <div style={{ display: 'flex', gap: '10px' }}>
      <button
        type="button"
        onClick={() => onChange(true)}
        style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '7px',
          minHeight: '52px',
          borderRadius: '10px',
          border: value === true ? 'none' : '1.5px solid var(--color-border)',
          background: value === true ? '#15803D' : '#fff',
          color: value === true ? '#fff' : 'var(--color-text-primary)',
          fontSize: '14px',
          fontWeight: 700,
          cursor: 'pointer',
          fontFamily: 'var(--font-primary)',
          transition: 'all 0.15s ease',
        }}
      >
        <CheckSquare size={18} />
        Yes
      </button>
      <button
        type="button"
        onClick={() => onChange(false)}
        style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '7px',
          minHeight: '52px',
          borderRadius: '10px',
          border: value === false ? 'none' : '1.5px solid var(--color-border)',
          background: value === false ? '#B91C1C' : '#fff',
          color: value === false ? '#fff' : 'var(--color-text-primary)',
          fontSize: '14px',
          fontWeight: 700,
          cursor: 'pointer',
          fontFamily: 'var(--font-primary)',
          transition: 'all 0.15s ease',
        }}
      >
        <Square size={18} />
        No
      </button>
    </div>
  );
}

function NumberInput({
  value,
  onChange,
  responseType,
  onConfirm,
}: {
  value: number | null;
  onChange: (v: number | null) => void;
  responseType: ResponseType;
  onConfirm: () => void;
}) {
  const unit = getUnit(responseType);
  const Icon = responseType === 'temperature' ? Thermometer : Hash;

  return (
    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
      <div style={{
        flex: 1,
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        padding: '0 14px',
        borderRadius: '10px',
        border: '1.5px solid var(--color-border)',
        background: '#fff',
        minHeight: '52px',
      }}>
        <Icon size={17} color="var(--color-text-muted)" />
        <input
          type="number"
          inputMode="decimal"
          value={value ?? ''}
          onChange={(e) => onChange(e.target.value === '' ? null : Number(e.target.value))}
          onKeyDown={(e) => { if (e.key === 'Enter') onConfirm(); }}
          placeholder="Enter value"
          style={{
            flex: 1,
            border: 'none',
            outline: 'none',
            fontSize: '20px',
            fontWeight: 700,
            color: 'var(--color-text-primary)',
            fontFamily: 'var(--font-primary)',
            background: 'transparent',
            minWidth: 0,
          }}
        />
        {unit && (
          <span style={{ fontSize: '16px', fontWeight: 600, color: 'var(--color-text-muted)', flexShrink: 0 }}>
            {unit}
          </span>
        )}
      </div>
      <button
        type="button"
        onClick={onConfirm}
        disabled={value === null}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: '52px',
          height: '52px',
          borderRadius: '10px',
          border: 'none',
          background: value !== null ? 'var(--color-accent-active)' : 'var(--color-border)',
          cursor: value !== null ? 'pointer' : 'default',
          transition: 'background 0.15s ease',
          flexShrink: 0,
        }}
      >
        <ChevronRight size={20} color="#fff" />
      </button>
    </div>
  );
}

function TextInput({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <textarea
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder="Type your answer…"
      rows={3}
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
  );
}

// ─── Photo input ──────────────────────────────────────────────────────────────

function PhotoCapture({
  dataUrl,
  onChange,
}: {
  dataUrl?: string;
  onChange: (url: string | undefined) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      if (typeof ev.target?.result === 'string') onChange(ev.target.result);
    };
    reader.readAsDataURL(file);
  }

  return (
    <div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        style={{ display: 'none' }}
        onChange={handleFile}
      />
      {dataUrl ? (
        <div style={{ position: 'relative', display: 'inline-block' }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={dataUrl}
            alt="Attached photo"
            style={{ width: '80px', height: '80px', borderRadius: '9px', objectFit: 'cover', display: 'block' }}
          />
          <button
            type="button"
            onClick={() => onChange(undefined)}
            style={{
              position: 'absolute',
              top: '-6px',
              right: '-6px',
              width: '20px',
              height: '20px',
              borderRadius: '50%',
              border: 'none',
              background: '#B91C1C',
              color: '#fff',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <X size={11} />
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            padding: '8px 14px',
            borderRadius: '8px',
            border: '1.5px dashed var(--color-border)',
            background: 'var(--color-bg-surface)',
            fontSize: '12px',
            fontWeight: 600,
            color: 'var(--color-text-secondary)',
            cursor: 'pointer',
            fontFamily: 'var(--font-primary)',
          }}
        >
          <Camera size={14} />
          Attach photo
        </button>
      )}
    </div>
  );
}

// ─── Question card ────────────────────────────────────────────────────────────

function QuestionCard({
  question,
  answer,
  isFollowUp,
  questionNumber,
  onAnswer,
  onPhotoChange,
  onConfirm,
  showRequired,
  cardRef,
}: {
  question: ChecklistQuestion;
  answer: ChecklistAnswer | undefined;
  isFollowUp: boolean;
  questionNumber: number;
  onAnswer: (questionId: string, value: string | number | boolean | null) => void;
  onPhotoChange: (questionId: string, url: string | undefined) => void;
  onConfirm: (questionId: string) => void;
  showRequired: boolean;
  cardRef?: React.RefObject<HTMLDivElement | null>;
}) {
  const answered = isAnswered(answer);
  const missing = showRequired && question.mandatory && !answered;

  return (
    <div
      ref={cardRef}
      style={{
        padding: isFollowUp ? '14px' : '18px',
        borderRadius: '12px',
        border: missing
          ? '1.5px solid #FECACA'
          : isFollowUp
          ? '1px solid #FDE68A'
          : '1px solid var(--color-border-subtle)',
        background: missing ? '#FFF5F5' : '#fff',
        boxShadow: answered ? 'none' : '0 2px 8px rgba(58,48,40,0.07)',
        marginLeft: isFollowUp ? '12px' : '0',
        borderLeft: isFollowUp ? '3px solid #F59E0B' : undefined,
        transition: 'border-color 0.2s ease, box-shadow 0.2s ease',
        position: 'relative',
      }}
    >
      {/* Answered overlay tick */}
      {answered && !isFollowUp && (
        <div style={{
          position: 'absolute',
          top: '14px',
          right: '14px',
          width: '22px',
          height: '22px',
          borderRadius: '50%',
          background: '#15803D',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}>
          <CheckSquare size={12} color="#fff" strokeWidth={2.5} />
        </div>
      )}

      {/* Question number + follow-up label */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
        {isFollowUp ? (
          <span style={{ fontSize: '10px', fontWeight: 700, color: '#D97706', display: 'flex', alignItems: 'center', gap: '3px' }}>
            <GitBranch size={11} />
            Follow-up
          </span>
        ) : (
          <span style={{ fontSize: '10px', fontWeight: 700, color: 'var(--color-text-muted)', letterSpacing: '0.05em' }}>
            Q{questionNumber}
          </span>
        )}
        {question.mandatory && (
          <span style={{ fontSize: '10px', color: missing ? '#B91C1C' : 'var(--color-text-muted)' }}>
            · Required
          </span>
        )}
      </div>

      {/* Question text */}
      <p style={{
        margin: '0 0 14px',
        fontSize: '15px',
        fontWeight: 600,
        color: 'var(--color-text-primary)',
        lineHeight: 1.4,
        paddingRight: answered ? '32px' : '0',
      }}>
        {question.name}
      </p>

      {/* Response input */}
      {question.responseType === 'checkbox' && (
        <CheckboxInput
          value={typeof answer?.value === 'boolean' ? answer.value : null}
          onChange={(v) => onAnswer(question.id, v)}
        />
      )}

      {(question.responseType === 'temperature' || question.responseType === 'number') && (
        <NumberInput
          value={typeof answer?.value === 'number' ? answer.value : null}
          onChange={(v) => onAnswer(question.id, v)}
          responseType={question.responseType}
          onConfirm={() => onConfirm(question.id)}
        />
      )}

      {question.responseType === 'text' && (
        <TextInput
          value={typeof answer?.value === 'string' ? answer.value : ''}
          onChange={(v) => onAnswer(question.id, v)}
        />
      )}

      {/* Photo capture */}
      {question.allowPhoto && (
        <div style={{ marginTop: '12px' }}>
          <PhotoCapture
            dataUrl={answer?.photoDataUrl}
            onChange={(url) => onPhotoChange(question.id, url)}
          />
        </div>
      )}

      {missing && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '5px', marginTop: '10px' }}>
          <AlertCircle size={13} color="#B91C1C" />
          <span style={{ fontSize: '11px', color: '#B91C1C', fontWeight: 500 }}>This question is required</span>
        </div>
      )}
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export function CompletionFlowClient({ instanceId }: { instanceId: string }) {
  const router = useRouter();

  const instance = getInstanceById(instanceId);
  const template = instance ? getTemplateForInstance(instance) : undefined;

  const [answers, setAnswers] = useState<ChecklistAnswer[]>(instance?.answers ?? []);
  const [showRequired, setShowRequired] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  // Refs for each root question card (for auto-scroll)
  const cardRefs = useRef<Map<string, React.RefObject<HTMLDivElement | null>>>(new Map());

  function getCardRef(id: string): React.RefObject<HTMLDivElement | null> {
    if (!cardRefs.current.has(id)) {
      cardRefs.current.set(id, { current: null });
    }
    return cardRefs.current.get(id)!;
  }

  function getAnswer(questionId: string): ChecklistAnswer | undefined {
    return answers.find((a) => a.questionId === questionId);
  }

  const scrollToNext = useCallback((currentId: string, allRootIds: string[]) => {
    const idx = allRootIds.indexOf(currentId);
    if (idx === -1) return;
    // Find next unanswered root question
    for (let i = idx + 1; i < allRootIds.length; i++) {
      const nextId = allRootIds[i];
      const nextAnswer = answers.find((a) => a.questionId === nextId);
      if (!isAnswered(nextAnswer)) {
        setTimeout(() => {
          cardRefs.current.get(nextId)?.current?.scrollIntoView({
            behavior: 'smooth',
            block: 'center',
          });
        }, 120);
        return;
      }
    }
  }, [answers]);

  function handleAnswer(questionId: string, value: string | number | boolean | null) {
    setAnswers((prev) => {
      const existing = prev.findIndex((a) => a.questionId === questionId);
      const updated: ChecklistAnswer = { questionId, value, photoDataUrl: prev[existing]?.photoDataUrl };
      if (existing >= 0) {
        const next = [...prev];
        next[existing] = updated;
        return next;
      }
      return [...prev, updated];
    });
  }

  // Auto-scroll after checkbox / number answer
  useEffect(() => {
    // no-op — scroll is triggered in handleAnswerWithScroll
  }, [answers]);

  function handleAnswerWithScroll(questionId: string, value: string | number | boolean | null, rootIds: string[]) {
    handleAnswer(questionId, value);
    // Auto-advance for checkbox; number advances via confirm button
    if (typeof value === 'boolean') {
      setTimeout(() => scrollToNext(questionId, rootIds), 150);
    }
  }

  function handlePhotoChange(questionId: string, url: string | undefined) {
    setAnswers((prev) => {
      const existing = prev.findIndex((a) => a.questionId === questionId);
      if (existing >= 0) {
        const next = [...prev];
        next[existing] = { ...next[existing], photoDataUrl: url };
        return next;
      }
      return [...prev, { questionId, value: null, photoDataUrl: url }];
    });
  }

  if (!instance || !template) {
    return (
      <div style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--color-text-secondary)' }}>
        Checklist not found.
      </div>
    );
  }

  // Build the ordered list of questions to display (root + triggered follow-ups)
  const rootQuestions = template.questions.filter((q) => !q.parentQuestionId);
  const rootIds = rootQuestions.map((q) => q.id);

  // Compute which follow-up IDs are currently triggered
  const triggeredFollowUpIds = new Set<string>();
  rootQuestions.forEach((q) => {
    const ans = getAnswer(q.id);
    conditionMet(q, ans).forEach((fid) => triggeredFollowUpIds.add(fid));
  });

  const mandatoryQuestions = [
    ...rootQuestions.filter((q) => q.mandatory),
    ...template.questions.filter((q) => q.parentQuestionId && triggeredFollowUpIds.has(q.id) && q.mandatory),
  ];

  const answeredCount = rootQuestions.filter((q) => isAnswered(getAnswer(q.id))).length;
  const totalCount = rootQuestions.length;
  const progressPct = totalCount > 0 ? Math.round((answeredCount / totalCount) * 100) : 0;

  const allMandatoryAnswered = mandatoryQuestions.every((q) => isAnswered(getAnswer(q.id)));

  function handleSubmit() {
    if (!allMandatoryAnswered) {
      setShowRequired(true);
      // Scroll to first unanswered mandatory
      const first = mandatoryQuestions.find((q) => !isAnswered(getAnswer(q.id)));
      if (first) {
        cardRefs.current.get(first.id)?.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
      return;
    }
    setSubmitted(true);
    setTimeout(() => router.push('/checklists/complete'), 2000);
  }

  if (submitted) {
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
            background: '#F0FDF4',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <CheckSquare size={36} color="#15803D" />
        </motion.div>
        <div>
          <p style={{ margin: '0 0 4px', fontSize: '18px', fontWeight: 800, color: 'var(--color-text-primary)' }}>
            {template.name} complete
          </p>
          <p style={{ margin: 0, fontSize: '13px', color: 'var(--color-text-secondary)' }}>
            Saved · {new Date().toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit' })}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100%', background: '#fff', paddingBottom: '100px' }}>
      {/* Sticky progress bar */}
      <div style={{
        position: 'sticky',
        top: 0,
        zIndex: 50,
        background: '#fff',
        borderBottom: '1px solid var(--color-border-subtle)',
        padding: '10px 16px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
          <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--color-text-primary)' }}>
            {template.name}
          </span>
          <span style={{ fontSize: '11px', color: 'var(--color-text-secondary)' }}>
            {answeredCount} of {totalCount} answered
          </span>
        </div>
        <div style={{ height: '4px', borderRadius: '100px', background: 'var(--color-bg-surface)', overflow: 'hidden' }}>
          <motion.div
            style={{ height: '100%', borderRadius: '100px', background: 'var(--color-accent-active)' }}
            animate={{ width: `${progressPct}%` }}
            transition={{ duration: 0.3, ease: 'easeOut' }}
          />
        </div>
      </div>

      {/* Questions */}
      <div style={{ maxWidth: '560px', margin: '0 auto', padding: '16px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {rootQuestions.map((q, i) => {
            const followUpIds = conditionMet(q, getAnswer(q.id));
            const followUpQuestions = followUpIds
              .map((fid) => template.questions.find((fq) => fq.id === fid))
              .filter(Boolean) as typeof rootQuestions;

            return (
              <div key={q.id} style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <QuestionCard
                  question={q}
                  answer={getAnswer(q.id)}
                  isFollowUp={false}
                  questionNumber={i + 1}
                  onAnswer={(qid, val) => handleAnswerWithScroll(qid, val, rootIds)}
                  onConfirm={(qid) => scrollToNext(qid, rootIds)}
                  onPhotoChange={handlePhotoChange}
                  showRequired={showRequired}
                  cardRef={getCardRef(q.id)}
                />

                <AnimatePresence>
                  {followUpQuestions.map((fq) => (
                    <motion.div
                      key={fq.id}
                      initial={{ opacity: 0, y: -8, scale: 0.98 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: -8, scale: 0.98 }}
                      transition={{ duration: 0.22, ease: 'easeOut' }}
                    >
                      <QuestionCard
                        question={fq}
                        answer={getAnswer(fq.id)}
                        isFollowUp={true}
                        questionNumber={0}
                        onAnswer={handleAnswer}
                        onConfirm={() => scrollToNext(q.id, rootIds)}
                        onPhotoChange={handlePhotoChange}
                        showRequired={showRequired}
                        cardRef={getCardRef(fq.id)}
                      />
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            );
          })}
        </div>
      </div>

      {/* Fixed submit bar */}
      <div style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        padding: '12px 16px',
        background: '#fff',
        borderTop: '1px solid var(--color-border-subtle)',
        boxShadow: '0 -4px 16px rgba(58,48,40,0.1)',
        zIndex: 100,
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
      }}>
        {showRequired && !allMandatoryAnswered && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <AlertCircle size={13} color="#B91C1C" />
            <span style={{ fontSize: '11px', color: '#B91C1C', fontWeight: 500 }}>
              Answer all required questions before submitting
            </span>
          </div>
        )}
        <button
          type="button"
          onClick={handleSubmit}
          style={{
            width: '100%',
            padding: '15px',
            borderRadius: '12px',
            border: 'none',
            background: allMandatoryAnswered ? 'var(--color-accent-active)' : 'var(--color-border)',
            fontSize: '15px',
            fontWeight: 700,
            color: allMandatoryAnswered ? '#F4F1EC' : 'var(--color-text-muted)',
            cursor: allMandatoryAnswered ? 'pointer' : 'default',
            fontFamily: 'var(--font-primary)',
            transition: 'background 0.2s ease, color 0.2s ease',
            letterSpacing: '0.01em',
          }}
        >
          {allMandatoryAnswered ? 'Submit checklist' : `${mandatoryQuestions.filter((q) => !isAnswered(getAnswer(q.id))).length} required ${mandatoryQuestions.filter((q) => !isAnswered(getAnswer(q.id))).length === 1 ? 'question' : 'questions'} remaining`}
        </button>
      </div>
    </div>
  );
}
