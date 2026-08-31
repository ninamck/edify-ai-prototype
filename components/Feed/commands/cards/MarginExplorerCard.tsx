'use client';

/**
 * MarginExplorerCard — the pricing step of the recipe wizard.
 *
 * Two sections, nothing else:
 *
 *   1. Target food cost % — preset chips + custom input, with a
 *      four-rung ladder showing the dine-in price at each %.
 *   2. Price per channel — dine in / takeaway / delivery. Each
 *      channel's price works forward from that channel's cost:
 *      food cost plus the packaging flagged for the channel (which
 *      is why packaging is asked before this step).
 *
 * Stateless — the parent (Feed wizard) owns the target, the food
 * cost and the per-channel packaging costs.
 */

import { useMemo } from 'react';
import { ChefHat } from 'lucide-react';
import {
  deliveryNet,
  penceToPounds,
  srpExVatForCogs,
  srpIncVat,
} from '@/components/Feed/recipeWizardTemplates';

interface MarginExplorerCardProps {
  recipeName: string;
  serves: number;
  /** True for hot food — 20% VAT on dine in and takeaway. */
  vatHot: boolean;
  /** Whole-percent target (e.g. 25 means 25%). */
  targetCogsPct: number;
  /** Ingredient cost per serve in pence, yield loss included. */
  foodCostP: number;
  /** £ per serve of packaging flagged for each channel. */
  packagingCostGBP: { dineIn: number; takeaway: number; delivery: number };
  /** When true, inputs are disabled (after the user has locked). */
  locked?: boolean;
  onTargetChange: (pct: number) => void;
  onConfirm: () => void;
}

const DELIVERY_COMMISSION_PCT = 30;
const COGS_PRESET_OPTIONS = [20, 25, 30, 35];

export default function MarginExplorerCard({
  recipeName,
  serves,
  vatHot,
  targetCogsPct,
  foodCostP,
  packagingCostGBP,
  locked,
  onTargetChange,
  onConfirm,
}: MarginExplorerCardProps) {
  const foodCostGBP = penceToPounds(foodCostP);
  const vatPct = vatHot ? 20 : 0;

  // Channel costs in pence — food cost + that channel's packaging.
  const channelCostP = {
    dineIn: foodCostP + Math.round(packagingCostGBP.dineIn * 100),
    takeaway: foodCostP + Math.round(packagingCostGBP.takeaway * 100),
    delivery: foodCostP + Math.round(packagingCostGBP.delivery * 100),
  };

  const ladderRungs = useMemo(() => buildLadder(targetCogsPct), [targetCogsPct]);
  const dineInEx = srpExVatForCogs(channelCostP.dineIn, targetCogsPct);
  const takeawayEx = srpExVatForCogs(channelCostP.takeaway, targetCogsPct);
  const deliveryEx = srpExVatForCogs(channelCostP.delivery, targetCogsPct);

  return (
    <div
      style={{
        marginTop: '8px',
        borderRadius: '10px',
        border: '1px solid var(--color-border-subtle)',
        overflow: 'hidden',
        background: '#fff',
        fontFamily: 'var(--font-primary)',
      }}
    >
      {/* Header ─────────────────────────────────────────────── */}
      <div
        style={{
          padding: '10px 14px',
          background: 'var(--color-bg-hover)',
          borderBottom: '1px solid var(--color-border-subtle)',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
        }}
      >
        <ChefHat size={14} color="var(--color-accent-active)" strokeWidth={2} />
        <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--color-text-primary)' }}>
          Price · {recipeName}
        </span>
        <span style={{ fontSize: '12px', fontWeight: 500, color: 'var(--color-text-muted)', marginLeft: '2px' }}>
          · Serves {serves}
        </span>
        <span
          style={{
            marginLeft: 'auto',
            fontSize: '12px',
            fontWeight: 700,
            padding: '2px 8px',
            borderRadius: '100px',
            background: 'rgba(40,175,201,0.10)',
            color: 'var(--color-accent-deep)',
          }}
        >
          Target {targetCogsPct}%
        </span>
      </div>

      {/* Food cost line ──────────────────────────────────────── */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          padding: '9px 14px',
          borderBottom: '1px solid var(--color-border-subtle)',
          background: 'rgba(0, 28, 53, 0.02)',
        }}
      >
        <span style={{ flex: 1, fontSize: '13px', fontWeight: 700, color: 'var(--color-text-primary)' }}>
          Food cost / serve
        </span>
        <span style={{ fontSize: '14px', fontWeight: 700, color: 'var(--color-text-primary)' }}>
          £{foodCostGBP.toFixed(2)}
        </span>
      </div>

      {/* 1. Target food cost % + ladder ──────────────────────── */}
      <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--color-border-subtle)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
          <span
            style={{
              fontSize: '11px',
              fontWeight: 700,
              letterSpacing: '0.05em',
              textTransform: 'uppercase',
              color: 'var(--color-text-secondary)',
            }}
          >
            Target food cost %
          </span>
          <CustomTargetInput value={targetCogsPct} disabled={!!locked} onChange={onTargetChange} />
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '10px' }}>
          {COGS_PRESET_OPTIONS.map((pct) => {
            const active = pct === targetCogsPct;
            return (
              <button
                key={pct}
                type="button"
                disabled={locked}
                onClick={() => onTargetChange(pct)}
                style={{
                  padding: '5px 12px',
                  borderRadius: '100px',
                  border: active
                    ? '1.5px solid var(--color-accent-active)'
                    : '1.5px solid var(--color-border)',
                  background: active ? 'var(--color-accent-active)' : '#fff',
                  color: active ? '#fff' : 'var(--color-text-secondary)',
                  fontSize: '12px',
                  fontWeight: 600,
                  fontFamily: 'var(--font-primary)',
                  cursor: locked ? 'not-allowed' : 'pointer',
                }}
              >
                {pct}%
              </button>
            );
          })}
        </div>

        {/* Ladder — dine-in price at each % */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '6px' }}>
          {ladderRungs.map((pct) => {
            const srp = srpExVatForCogs(channelCostP.dineIn, pct);
            const isTarget = pct === targetCogsPct;
            return (
              <button
                key={pct}
                type="button"
                disabled={locked}
                onClick={() => onTargetChange(pct)}
                style={{
                  padding: '8px',
                  borderRadius: '8px',
                  border: isTarget
                    ? '1.5px solid var(--color-accent-active)'
                    : '1px solid var(--color-border-subtle)',
                  background: isTarget ? 'rgba(40,175,201,0.08)' : '#fff',
                  cursor: locked ? 'not-allowed' : 'pointer',
                  textAlign: 'left',
                  fontFamily: 'var(--font-primary)',
                }}
              >
                <div
                  style={{
                    fontSize: '10.5px',
                    fontWeight: 700,
                    letterSpacing: '0.04em',
                    textTransform: 'uppercase',
                    color: isTarget ? 'var(--color-accent-deep)' : 'var(--color-text-muted)',
                  }}
                >
                  {pct}%
                </div>
                <div style={{ fontSize: '15px', fontWeight: 700, color: 'var(--color-text-primary)', marginTop: '2px' }}>
                  £{srp.toFixed(2)}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* 2. Price per channel ────────────────────────────────── */}
      <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--color-border-subtle)' }}>
        <div
          style={{
            fontSize: '11px',
            fontWeight: 700,
            letterSpacing: '0.05em',
            textTransform: 'uppercase',
            color: 'var(--color-text-secondary)',
            marginBottom: '6px',
          }}
        >
          Price per channel
        </div>
        <ChannelRow
          label="Dine in"
          srpEx={dineInEx}
          vatPct={vatPct}
          packagingGBP={packagingCostGBP.dineIn}
        />
        <ChannelRow
          label="Takeaway"
          srpEx={takeawayEx}
          vatPct={vatHot ? 20 : 0}
          packagingGBP={packagingCostGBP.takeaway}
        />
        <ChannelRow
          label="Delivery"
          srpEx={deliveryEx}
          vatPct={20}
          commissionPct={DELIVERY_COMMISSION_PCT}
          packagingGBP={packagingCostGBP.delivery}
        />
      </div>

      {/* Lock ────────────────────────────────────────────────── */}
      {!locked && (
        <div style={{ padding: '10px 14px', display: 'flex', justifyContent: 'flex-end' }}>
          <button
            type="button"
            onClick={onConfirm}
            style={{
              padding: '8px 14px',
              borderRadius: '10px',
              border: 'none',
              background: 'var(--color-accent-active)',
              color: '#fff',
              fontSize: '13px',
              fontWeight: 600,
              fontFamily: 'var(--font-primary)',
              cursor: 'pointer',
            }}
          >
            Lock in £{dineInEx.toFixed(2)} dine in
          </button>
        </div>
      )}
    </div>
  );
}

// ───────────────────────────────────────────────────────────────
// Sub-components
// ───────────────────────────────────────────────────────────────

function ChannelRow({
  label,
  srpEx,
  vatPct,
  packagingGBP,
  commissionPct,
}: {
  label: string;
  srpEx: number;
  vatPct: number;
  /** £ of packaging included in this channel's cost. */
  packagingGBP: number;
  commissionPct?: number;
}) {
  const inc = srpIncVat(srpEx, vatPct);
  const net = commissionPct !== undefined ? deliveryNet(inc, commissionPct) : null;
  const subtitleBits: string[] = [];
  if (packagingGBP > 0) subtitleBits.push(`inc £${packagingGBP.toFixed(2)} packaging`);
  if (commissionPct !== undefined) subtitleBits.push(`${commissionPct}% commission`);

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '1fr auto',
        gap: '8px',
        alignItems: 'center',
        padding: '6px 0',
        borderTop: '1px solid rgba(0,28,53,0.05)',
      }}
    >
      <div>
        <div style={{ fontSize: '12.5px', fontWeight: 600, color: 'var(--color-text-primary)' }}>
          {label}
        </div>
        {subtitleBits.length > 0 && (
          <div style={{ fontSize: '10.5px', fontWeight: 500, color: 'var(--color-text-muted)', marginTop: '1px' }}>
            {subtitleBits.join(' · ')}
          </div>
        )}
      </div>
      <div style={{ textAlign: 'right' }}>
        <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--color-text-primary)' }}>
          £{inc.toFixed(2)}
        </div>
        <div style={{ fontSize: '10.5px', fontWeight: 500, color: 'var(--color-text-muted)', marginTop: '1px' }}>
          {vatPct > 0 ? `inc ${vatPct}% VAT` : 'no VAT'}
          {net !== null && ` · net £${net.toFixed(2)}`}
        </div>
      </div>
    </div>
  );
}

function CustomTargetInput({
  value,
  disabled,
  onChange,
}: {
  value: number;
  disabled: boolean;
  onChange: (pct: number) => void;
}) {
  return (
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '4px',
        padding: '3px 8px',
        borderRadius: '8px',
        border: '1px solid var(--color-border-subtle)',
        background: '#fff',
      }}
    >
      <input
        type="number"
        min={5}
        max={95}
        step={1}
        value={value}
        disabled={disabled}
        onChange={(e) => {
          const next = Number(e.target.value);
          if (!Number.isFinite(next)) return;
          onChange(Math.max(5, Math.min(95, Math.round(next))));
        }}
        style={{
          width: '40px',
          border: 'none',
          outline: 'none',
          fontSize: '12px',
          fontWeight: 700,
          fontFamily: 'var(--font-primary)',
          color: 'var(--color-text-primary)',
          textAlign: 'right',
          background: 'transparent',
        }}
      />
      <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--color-text-muted)' }}>%</span>
    </div>
  );
}

// ───────────────────────────────────────────────────────────────
// Helpers
// ───────────────────────────────────────────────────────────────

/** Four-rung ladder bracketing the target. The target is always
 *  included; the others sit at ±5% steps, clamped to 10%+. */
function buildLadder(target: number): number[] {
  const candidates = [
    Math.max(10, target - 5),
    target,
    target + 5,
    target + 10,
  ];
  const deduped = Array.from(new Set(candidates)).sort((a, b) => a - b);
  while (deduped.length < 4) {
    deduped.push(deduped[deduped.length - 1] + 5);
  }
  return deduped.slice(0, 4);
}
