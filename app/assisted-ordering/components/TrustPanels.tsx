'use client';

import type { ReactNode } from 'react';
import type { TrustPanelData } from '../types';

// Weight and volume units sit tight against the number (12kg); words get a space (12 boxes).
function unitSep(unit: string): string {
  return /^(kg|g|ml|l|L|units?)$/.test(unit) ? '' : ' ';
}

interface Props {
  data: TrustPanelData;
  why: string[];
  whyHighlightFirst?: boolean;
}

// ─── Atoms ───────────────────────────────────────────────────────────────────

function Panel({
  heading,
  children,
}: {
  heading: string;
  children: ReactNode;
}) {
  return (
    <div
      style={{
        flex: '1 1 200px',
        minWidth: 0,
        padding: '12px 14px',
        borderRadius: 'var(--radius-item)',
        border: '1px solid var(--color-border-subtle)',
        background: 'var(--color-bg-surface)',
        display: 'flex',
        flexDirection: 'column',
        gap: '6px',
      }}
    >
      <div
        style={{
          fontSize: '11px',
          fontWeight: 700,
          letterSpacing: '0.04em',
          textTransform: 'uppercase',
          color: 'var(--color-text-secondary)',
          fontFamily: 'var(--font-primary)',
        }}
      >
        {heading}
      </div>
      {children}
    </div>
  );
}

function Hero({ value }: { value: string }) {
  return (
    <div
      style={{
        fontSize: '26px',
        lineHeight: 1.1,
        fontWeight: 700,
        color: 'var(--color-text-primary)',
        fontFamily: 'var(--font-primary)',
        letterSpacing: '-0.01em',
      }}
    >
      {value}
    </div>
  );
}

function SubLabel({ children }: { children: ReactNode }) {
  return (
    <div
      style={{
        fontSize: '12px',
        fontWeight: 500,
        color: 'var(--color-text-secondary)',
        fontFamily: 'var(--font-primary)',
        lineHeight: 1.35,
      }}
    >
      {children}
    </div>
  );
}

function Secondary({ children }: { children: ReactNode }) {
  return (
    <div
      style={{
        fontSize: '11px',
        fontWeight: 500,
        color: 'var(--color-text-secondary)',
        fontFamily: 'var(--font-primary)',
        lineHeight: 1.35,
        marginTop: '2px',
      }}
    >
      {children}
    </div>
  );
}

// ─── History panel body ──────────────────────────────────────────────────────

function HistoryBody({
  points,
  unit,
  average,
}: {
  points: { date: string; qty: number }[];
  unit: string;
  average: number;
}) {
  return (
    <>
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-end',
          gap: '6px',
          marginTop: '2px',
        }}
      >
        {points.map((p) => (
          <div
            key={p.date}
            style={{
              flex: '1 1 0',
              minWidth: 0,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'flex-start',
              gap: '2px',
            }}
          >
            <span
              style={{
                fontSize: '18px',
                fontWeight: 700,
                color: 'var(--color-text-primary)',
                fontFamily: 'var(--font-primary)',
                lineHeight: 1,
              }}
            >
              {p.qty}
              <span
                style={{
                  fontSize: '11px',
                  fontWeight: 500,
                  color: 'var(--color-text-secondary)',
                  marginLeft: '1px',
                }}
              >
                {unitSep(unit)}{unit}
              </span>
            </span>
            <span
              style={{
                fontSize: '10px',
                fontWeight: 500,
                color: 'var(--color-text-secondary)',
                fontFamily: 'var(--font-primary)',
                whiteSpace: 'nowrap',
              }}
            >
              {p.date}
            </span>
          </div>
        ))}
      </div>
      <SubLabel>
        Avg: {average}
        {unitSep(unit)}{unit}
      </SubLabel>
    </>
  );
}

// ─── Why panel body ──────────────────────────────────────────────────────────

function WhyBody({
  points,
  highlightFirst,
}: {
  points: string[];
  highlightFirst: boolean;
}) {
  return (
    <ul
      style={{
        margin: 0,
        padding: 0,
        listStyle: 'none',
        display: 'flex',
        flexDirection: 'column',
        gap: '6px',
      }}
    >
      {points.map((text, i) => (
        <li
          key={i}
          style={{
            position: 'relative',
            paddingLeft: '14px',
            fontSize: '12px',
            fontWeight: highlightFirst && i === 0 ? 600 : 500,
            color:
              highlightFirst && i === 0
                ? 'var(--color-text-primary)'
                : 'var(--color-text-secondary)',
            fontFamily: 'var(--font-primary)',
            lineHeight: 1.45,
          }}
        >
          <span
            aria-hidden
            style={{
              position: 'absolute',
              left: 0,
              top: '7px',
              width: '4px',
              height: '4px',
              borderRadius: '50%',
              background: 'currentColor',
              opacity: 0.6,
            }}
          />
          {text}
        </li>
      ))}
    </ul>
  );
}

// ─── Main component ──────────────────────────────────────────────────────────

export default function TrustPanels({ data, why, whyHighlightFirst = false }: Props) {
  const { history, consumption } = data;

  return (
    <div
      style={{
        display: 'flex',
        gap: '10px',
        flexWrap: 'wrap',
        marginTop: '8px',
      }}
    >
      <Panel heading="Why?">
        <WhyBody points={why} highlightFirst={whyHighlightFirst} />
      </Panel>

      <Panel heading={`What you ordered last ${history.dayOfWeek}`}>
        <HistoryBody points={history.points} unit={history.unit} average={history.average} />
      </Panel>

      <Panel heading="We think you'll use">
        <Hero value={`${consumption.value}${unitSep(consumption.unit)}${consumption.unit}`} />
        <SubLabel>{consumption.window}</SubLabel>
        <Secondary>{consumption.driver}</Secondary>
      </Panel>
    </div>
  );
}
