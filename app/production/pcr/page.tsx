'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Thermometer, BadgeCheck, AlertTriangle, ArrowRightCircle } from 'lucide-react';
import StatusPill from '@/components/Production/primitives/StatusPill';
import Stepper from '@/components/Receiving/Stepper';
import {
  useMadeOutputs,
  usePcrChecks,
  useProductionRuns,
  useProducts,
  submitPcr,
  type MadeOutput,
} from '@/components/Production/productionStore';
import {
  setCurrentRole,
} from '@/components/DemoControls/demoStore';
import { defaultRouteForRole } from '@/components/Production/roleFilter';

// Products that need a temperature reading at PCR. For Slice 3 this is
// hard-coded; recipe-step HACCP flags land in the later recipe-builder work.
const HACCP_REQUIRED_PRODUCTS = new Set([
  'prd-ham-croissant',
  'prd-chicken-pesto',
  'prd-coldbrew-tub',
]);

function formatClock(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleTimeString('en-AU', { hour: 'numeric', minute: '2-digit' });
}

function shelfLifeSummary(iso: string | null): string {
  if (!iso) return 'Clock starts on pass';
  return `Shelf life until ${formatClock(iso)}`;
}

export default function PcrQueuePage() {
  const madeOutputs = useMadeOutputs();
  const pcrChecks = usePcrChecks();
  const runs = useProductionRuns();
  const products = useProducts();
  const router = useRouter();

  const awaiting = useMemo(
    () => madeOutputs.filter(m => !pcrChecks.some(c => c.madeOutputId === m.id)),
    [madeOutputs, pcrChecks],
  );
  const checked = useMemo(
    () => madeOutputs.filter(m => pcrChecks.some(c => c.madeOutputId === m.id)),
    [madeOutputs, pcrChecks],
  );

  const [selectedId, setSelectedId] = useState<string | null>(null);
  // Auto-select the first awaiting batch if nothing selected yet.
  const activeId = selectedId ?? awaiting[0]?.id ?? null;
  const activeOutput = madeOutputs.find(m => m.id === activeId);
  const activeCheck = pcrChecks.find(c => c.madeOutputId === activeId);
  const activeProduct = activeOutput ? products.find(p => p.id === activeOutput.productId) : null;
  const activeRun = activeOutput ? runs.find(r => r.id === activeOutput.productionRunId) : null;

  // Form state reset whenever active batch changes.
  const [checkerName, setCheckerName] = useState('Priya Naidoo');
  const [temperature, setTemperature] = useState<number>(4);
  const [rejectQty, setRejectQty] = useState<number>(0);

  function pass(output: MadeOutput) {
    submitPcr({
      madeOutputId: output.id,
      qualityCheck: 'pass',
      labelCheck: 'pass',
      temperature: HACCP_REQUIRED_PRODUCTS.has(output.productId) ? temperature : undefined,
      checkerName,
      batchCode: `B-${output.id.toUpperCase()}`,
      rejectQuantity: rejectQty || undefined,
    });
    // Dispatch screen groups ready outputs by destination at render time —
    // no need to pre-attach here.
  }

  function fail(output: MadeOutput, triggerReplacement: boolean) {
    submitPcr({
      madeOutputId: output.id,
      qualityCheck: 'fail',
      labelCheck: 'pass',
      temperature: HACCP_REQUIRED_PRODUCTS.has(output.productId) ? temperature : undefined,
      checkerName,
      batchCode: `B-${output.id.toUpperCase()}`,
      rejectQuantity: rejectQty || output.quantityProduced,
      triggerReplacement,
    });
  }

  const hubHandoverReady = awaiting.length === 0 && checked.length > 0;

  return (
    <div style={{ fontFamily: 'var(--font-primary)', padding: '20px 24px 60px', maxWidth: '1160px', margin: '0 auto' }}>
      {/* Summary strip */}
      <div
        style={{
          display: 'flex',
          gap: '20px',
          flexWrap: 'wrap',
          marginBottom: '18px',
          padding: '14px 16px',
          borderRadius: 'var(--radius-card)',
          background: '#fff',
          border: '1px solid var(--color-border-subtle)',
        }}
      >
        <Metric value={awaiting.length} label="Awaiting check" tone={awaiting.length > 0 ? 'warning' : undefined} />
        <Metric value={checked.length} label="Checks completed" />
        <Metric value={runs.filter(r => r.status === 'in_progress').length} label="Runs in progress" />
      </div>

      {/* Empty state */}
      {madeOutputs.length === 0 && (
        <div
          style={{
            padding: '40px 24px',
            textAlign: 'center',
            background: '#fff',
            border: '1px solid var(--color-border-subtle)',
            borderRadius: 'var(--radius-card)',
          }}
        >
          <BadgeCheck size={26} strokeWidth={1.8} color="var(--color-text-muted)" style={{ marginBottom: '8px' }} />
          <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--color-text-primary)', marginBottom: '4px' }}>
            Nothing to check yet
          </div>
          <div style={{ fontSize: '12px', color: 'var(--color-text-secondary)' }}>
            Batches land here when a Maker completes work on a bench.
          </div>
        </div>
      )}

      {madeOutputs.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(280px, 320px) 1fr', gap: '16px', alignItems: 'flex-start' }}>
          {/* Queue (left column) */}
          <div
            style={{
              background: '#fff',
              border: '1px solid var(--color-border-subtle)',
              borderRadius: 'var(--radius-card)',
              overflow: 'hidden',
              maxHeight: 'calc(100vh - 180px)',
              overflowY: 'auto',
            }}
          >
            <div
              style={{
                padding: '10px 14px',
                fontSize: '10px',
                fontWeight: 700,
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
                color: 'var(--color-text-muted)',
                borderBottom: '1px solid var(--color-border-subtle)',
                background: 'var(--color-bg-hover)',
              }}
            >
              Queue
            </div>
            {[...awaiting, ...checked].map((mo) => {
              const p = products.find(x => x.id === mo.productId);
              const isActive = mo.id === activeId;
              const check = pcrChecks.find(c => c.madeOutputId === mo.id);
              const pass = check?.qualityCheck === 'pass' && check?.labelCheck === 'pass';
              return (
                <button
                  key={mo.id}
                  type="button"
                  onClick={() => setSelectedId(mo.id)}
                  style={{
                    all: 'unset',
                    display: 'block',
                    width: 'calc(100% - 28px)',
                    padding: '12px 14px',
                    borderBottom: '1px solid var(--color-border-subtle)',
                    cursor: 'pointer',
                    background: isActive ? 'rgba(34,68,68,0.06)' : '#fff',
                    borderLeft: isActive ? '3px solid var(--color-accent-active)' : '3px solid transparent',
                    paddingLeft: isActive ? '11px' : '14px',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: '8px',
                      marginBottom: '4px',
                    }}
                  >
                    <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--color-text-primary)' }}>
                      {p?.name ?? mo.productId}
                    </span>
                    {check
                      ? pass
                        ? <StatusPill label="Pass" tone="success" size="xs" />
                        : <StatusPill label="Fail" tone="error" size="xs" />
                      : <StatusPill label="Awaiting" tone="warning" size="xs" />
                    }
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>
                    {mo.quantityProduced} made · batch B-{mo.id.toUpperCase()}
                  </div>
                </button>
              );
            })}
          </div>

          {/* Detail form (right column) */}
          <div
            style={{
              background: '#fff',
              border: '1px solid var(--color-border-subtle)',
              borderRadius: 'var(--radius-card)',
              padding: '18px 20px',
            }}
          >
            {!activeOutput && (
              <div style={{ fontSize: '13px', color: 'var(--color-text-secondary)' }}>
                Select a batch on the left.
              </div>
            )}
            {activeOutput && (
              <>
                <div style={{ marginBottom: '14px' }}>
                  <div
                    style={{
                      fontSize: '10px',
                      fontWeight: 700,
                      letterSpacing: '0.05em',
                      textTransform: 'uppercase',
                      color: 'var(--color-text-muted)',
                      marginBottom: '4px',
                    }}
                  >
                    Batch
                  </div>
                  <h2 style={{ fontSize: '22px', fontWeight: 700, margin: '0 0 4px', color: 'var(--color-text-primary)' }}>
                    {activeProduct?.name ?? activeOutput.productId}
                  </h2>
                  <div style={{ fontSize: '12px', color: 'var(--color-text-secondary)' }}>
                    {activeOutput.quantityProduced} made · {activeRun?.name.split(' · ')[0] ?? '—'} · code B-{activeOutput.id.toUpperCase()}
                  </div>
                </div>

                {activeCheck ? (
                  /* Already checked — readonly summary */
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    <SummaryRow
                      label="Quality"
                      value={<StatusPill label={activeCheck.qualityCheck.toUpperCase()} tone={activeCheck.qualityCheck === 'pass' ? 'success' : 'error'} />}
                    />
                    <SummaryRow
                      label="Label"
                      value={<StatusPill label={activeCheck.labelCheck.toUpperCase()} tone={activeCheck.labelCheck === 'pass' ? 'success' : 'error'} />}
                    />
                    {activeCheck.haccpData.temperature !== undefined && (
                      <SummaryRow label="Temperature" value={`${activeCheck.haccpData.temperature}°C`} />
                    )}
                    <SummaryRow label="Checker" value={activeCheck.checkerName} />
                    <SummaryRow label="Checked at" value={formatClock(activeCheck.haccpData.checkedAt)} />
                    <SummaryRow
                      label="Shelf life"
                      value={shelfLifeSummary(activeOutput.shelfLifeExpiresAt)}
                    />
                    {activeCheck.replacementRunId && (
                      <SummaryRow
                        label="Replacement"
                        value={<StatusPill label="On-demand run created" tone="info" />}
                      />
                    )}
                  </div>
                ) : (
                  <PcrForm
                    output={activeOutput}
                    checkerName={checkerName}
                    setCheckerName={setCheckerName}
                    temperature={temperature}
                    setTemperature={setTemperature}
                    rejectQty={rejectQty}
                    setRejectQty={setRejectQty}
                    onPass={() => pass(activeOutput)}
                    onFail={(trigger) => fail(activeOutput, trigger)}
                  />
                )}
              </>
            )}
          </div>
        </div>
      )}

      {/* Handover CTA */}
      {hubHandoverReady && (
        <div style={{ marginTop: '18px', textAlign: 'center' }}>
          <button
            type="button"
            onClick={() => {
              setCurrentRole('dispatcher');
              router.push(defaultRouteForRole('dispatcher'));
            }}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '9px 14px',
              borderRadius: '8px',
              background: '#fff',
              border: '1px solid var(--color-border-subtle)',
              color: 'var(--color-text-secondary)',
              fontSize: '12px',
              fontWeight: 600,
              fontFamily: 'var(--font-primary)',
              cursor: 'pointer',
            }}
          >
            <ArrowRightCircle size={13} strokeWidth={2.2} />
            Hand over to Dispatcher
          </button>
        </div>
      )}
    </div>
  );
}

function Metric({ value, label, tone }: { value: number; label: string; tone?: 'warning' }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      <span
        style={{
          fontSize: '22px',
          fontWeight: 700,
          color: tone === 'warning' ? 'var(--color-warning)' : 'var(--color-text-primary)',
          lineHeight: 1.1,
        }}
      >
        {value}
      </span>
      <span style={{ fontSize: '11px', fontWeight: 500, color: 'var(--color-text-muted)', marginTop: '2px' }}>
        {label}
      </span>
    </div>
  );
}

function SummaryRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '12px',
        fontSize: '13px',
        padding: '6px 0',
      }}
    >
      <span style={{ color: 'var(--color-text-muted)', fontWeight: 500 }}>{label}</span>
      <span style={{ color: 'var(--color-text-primary)', fontWeight: 600, textAlign: 'right' }}>
        {value}
      </span>
    </div>
  );
}

function PcrForm({
  output,
  checkerName,
  setCheckerName,
  temperature,
  setTemperature,
  rejectQty,
  setRejectQty,
  onPass,
  onFail,
}: {
  output: MadeOutput;
  checkerName: string;
  setCheckerName: (v: string) => void;
  temperature: number;
  setTemperature: (v: number) => void;
  rejectQty: number;
  setRejectQty: (v: number) => void;
  onPass: () => void;
  onFail: (triggerReplacement: boolean) => void;
}) {
  const needsTemp = HACCP_REQUIRED_PRODUCTS.has(output.productId);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
      <FormRow label="Checker">
        <input
          value={checkerName}
          onChange={(e) => setCheckerName(e.target.value)}
          style={{
            width: '100%',
            padding: '8px 10px',
            borderRadius: '8px',
            border: '1px solid var(--color-border-subtle)',
            fontSize: '13px',
            fontFamily: 'var(--font-primary)',
            background: '#fff',
          }}
        />
      </FormRow>

      {needsTemp && (
        <FormRow label="Temperature (°C)" icon={<Thermometer size={13} strokeWidth={2.2} />}>
          <Stepper value={temperature} onChange={setTemperature} label="temperature" />
        </FormRow>
      )}

      <FormRow label="Rejects">
        <Stepper value={rejectQty} onChange={setRejectQty} label="rejects" />
      </FormRow>

      <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
        <button
          type="button"
          onClick={onPass}
          style={{
            flex: 1,
            padding: '12px 14px',
            minHeight: '48px',
            borderRadius: '10px',
            border: 'none',
            background: 'var(--color-success)',
            color: '#fff',
            fontSize: '14px',
            fontWeight: 700,
            fontFamily: 'var(--font-primary)',
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '6px',
          }}
        >
          <BadgeCheck size={15} strokeWidth={2.4} />
          Pass
        </button>
        <button
          type="button"
          onClick={() => onFail(true)}
          style={{
            flex: 1,
            padding: '12px 14px',
            minHeight: '48px',
            borderRadius: '10px',
            border: '1.5px solid var(--color-error)',
            background: '#fff',
            color: 'var(--color-error)',
            fontSize: '14px',
            fontWeight: 700,
            fontFamily: 'var(--font-primary)',
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '6px',
          }}
        >
          <AlertTriangle size={15} strokeWidth={2.4} />
          Fail & trigger replacement
        </button>
      </div>
    </div>
  );
}

function FormRow({
  label,
  icon,
  children,
}: {
  label: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
      <div
        style={{
          fontSize: '11px',
          fontWeight: 700,
          letterSpacing: '0.04em',
          textTransform: 'uppercase',
          color: 'var(--color-text-muted)',
          display: 'inline-flex',
          alignItems: 'center',
          gap: '5px',
        }}
      >
        {icon}
        {label}
      </div>
      {children}
    </div>
  );
}
