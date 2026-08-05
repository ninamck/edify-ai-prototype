'use client';

/**
 * /components-audit
 *
 * A single-page inventory of every visually-distinct variation of common UI
 * primitives that already ships across the prototype. The goal is NOT to be
 * the design system — it is to make the *current* sprawl visible side-by-side
 * so we can decide what to keep, merge, or kill.
 *
 * Rules of the road for this file:
 *   • Self-contained. Do NOT import the real production components — every
 *     variant below is a verbatim inline copy so this page keeps showing the
 *     legacy reality even after we refactor.
 *   • Sorted by category, then by "more correct" → "more dubious".
 *   • Each variant carries: rendered preview, label, source file, literal
 *     style values, and a status note (canonical / duplicate / violates rule).
 */

import { useState, type CSSProperties, type ReactNode } from 'react';
import {
  Check, ChevronDown, Minus, Plus, Search, Sparkles, X, AlertTriangle,
  Info, CheckCircle2, RotateCcw, MoreHorizontal,
} from 'lucide-react';

/* ──────────────────────────────────────────────────────────────────────── */
/*  Page-local layout primitives                                            */
/* ──────────────────────────────────────────────────────────────────────── */

type RuleStatus = 'canonical' | 'duplicate' | 'violation' | 'legacy' | 'ok';

const RULE_LABEL: Record<RuleStatus, string> = {
  canonical: 'Canonical',
  duplicate: 'Near-duplicate',
  violation: 'Violates rule',
  legacy:    'Legacy / one-off',
  ok:        'OK',
};

const RULE_COLOR: Record<RuleStatus, { fg: string; border: string }> = {
  canonical: { fg: 'var(--color-success)',         border: 'var(--color-success)' },
  duplicate: { fg: 'var(--color-warning)',         border: 'var(--color-warning)' },
  violation: { fg: 'var(--color-error)',           border: 'var(--color-error)' },
  legacy:    { fg: 'var(--color-text-secondary)',  border: 'var(--color-border)' },
  ok:        { fg: 'var(--color-info)',            border: 'var(--color-info)' },
};

function RuleTag({ status }: { status: RuleStatus }) {
  const { fg, border } = RULE_COLOR[status];
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        padding: '2px 8px',
        borderRadius: 999,
        background: '#ffffff',
        color: fg,
        border: `1.5px solid ${border}`,
        fontSize: 10,
        fontWeight: 700,
        letterSpacing: '0.05em',
        textTransform: 'uppercase',
        whiteSpace: 'nowrap',
        lineHeight: 1,
      }}
    >
      {RULE_LABEL[status]}
    </span>
  );
}

function Section({
  id,
  title,
  intro,
  children,
}: {
  id: string;
  title: string;
  intro: ReactNode;
  children: ReactNode;
}) {
  return (
    <section
      id={id}
      style={{
        scrollMarginTop: 72,
        padding: '32px 0',
        borderTop: '1px solid var(--color-border-subtle)',
      }}
    >
      <h2
        style={{
          margin: 0,
          fontSize: 22,
          fontWeight: 700,
          color: 'var(--color-text-primary)',
          letterSpacing: '-0.01em',
        }}
      >
        {title}
      </h2>
      <p
        style={{
          margin: '6px 0 24px',
          fontSize: 13,
          color: 'var(--color-text-secondary)',
          maxWidth: 760,
          lineHeight: 1.55,
        }}
      >
        {intro}
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {children}
      </div>
    </section>
  );
}

function VariantRow({
  preview,
  name,
  source,
  specs,
  rule,
  previewBg = '#ffffff',
  previewPadding = '20px 24px',
  note,
}: {
  preview: ReactNode;
  name: string;
  source: string;
  specs: Array<[string, string]>;
  rule: RuleStatus;
  previewBg?: string;
  previewPadding?: string;
  note?: string;
}) {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '280px 1fr 320px',
        gap: 16,
        padding: 12,
        border: '1px solid var(--color-border-subtle)',
        borderRadius: 12,
        background: '#ffffff',
        alignItems: 'stretch',
      }}
    >
      {/* Preview cell */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: previewPadding,
          background: previewBg,
          border: '1px dashed var(--color-border-subtle)',
          borderRadius: 8,
          minHeight: 64,
        }}
      >
        {preview}
      </div>

      {/* Label + source + note */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <div
            style={{
              fontSize: 13,
              fontWeight: 700,
              color: 'var(--color-text-primary)',
            }}
          >
            {name}
          </div>
          <RuleTag status={rule} />
        </div>
        <code
          style={{
            fontSize: 11,
            color: 'var(--color-text-secondary)',
            fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
            wordBreak: 'break-all',
          }}
        >
          {source}
        </code>
        {note ? (
          <div
            style={{
              fontSize: 12,
              color: 'var(--color-text-secondary)',
              lineHeight: 1.5,
            }}
          >
            {note}
          </div>
        ) : null}
      </div>

      {/* Specs */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 3,
          padding: '8px 10px',
          background: 'var(--color-bg-hover)',
          borderRadius: 8,
          fontSize: 11,
          fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
          color: 'var(--color-text-primary)',
          minWidth: 0,
        }}
      >
        {specs.map(([k, v]) => (
          <div key={k} style={{ display: 'flex', gap: 6, minWidth: 0 }}>
            <span
              style={{
                color: 'var(--color-text-muted)',
                flexShrink: 0,
                minWidth: 70,
              }}
            >
              {k}
            </span>
            <span style={{ wordBreak: 'break-all' }}>{v}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────────── */
/*  Inline copies of every variant we found in the wild                     */
/* ──────────────────────────────────────────────────────────────────────── */

const TOC: Array<{ id: string; label: string; count: number }> = [
  { id: 'buttons',     label: 'Buttons',                count: 22 },
  { id: 'pills',       label: 'Pills / badges',         count: 12 },
  { id: 'tabs',        label: 'Tabs / segmented',       count: 5  },
  { id: 'headings',    label: 'Headings / titles',      count: 6  },
  { id: 'cards',       label: 'Cards / callouts',       count: 6  },
  { id: 'tables',      label: 'Tables',                 count: 3  },
  { id: 'inputs',      label: 'Inputs',                 count: 9  },
  { id: 'modals',      label: 'Modals / sheets',        count: 5  },
  { id: 'topbars',     label: 'Topbars / toolbars',     count: 4  },
  { id: 'navitems',    label: 'Sidebar nav',            count: 2  },
  { id: 'toasts',      label: 'Toasts / banners',       count: 3  },
  { id: 'progress',    label: 'Progress / meters',      count: 1  },
];

function StickyTOC() {
  return (
    <aside
      style={{
        position: 'sticky',
        top: 0,
        alignSelf: 'flex-start',
        width: 220,
        padding: '24px 8px 24px 24px',
        borderRight: '1px solid var(--color-border-subtle)',
        height: '100vh',
        overflowY: 'auto',
        flexShrink: 0,
      }}
    >
      <div
        style={{
          fontSize: 10,
          fontWeight: 700,
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          color: 'var(--color-text-muted)',
          marginBottom: 10,
        }}
      >
        Audit sections
      </div>
      <nav style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        {TOC.map((t) => (
          <a
            key={t.id}
            href={`#${t.id}`}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '6px 10px',
              borderRadius: 6,
              fontSize: 12,
              fontWeight: 500,
              color: 'var(--color-text-primary)',
              textDecoration: 'none',
            }}
          >
            <span>{t.label}</span>
            <span
              style={{
                fontSize: 10,
                fontWeight: 700,
                color: 'var(--color-text-muted)',
                background: 'var(--color-bg-hover)',
                padding: '2px 6px',
                borderRadius: 999,
              }}
            >
              {t.count}
            </span>
          </a>
        ))}
      </nav>

      <div
        style={{
          marginTop: 24,
          padding: 12,
          background: 'var(--color-bg-hover)',
          borderRadius: 8,
          fontSize: 11,
          color: 'var(--color-text-secondary)',
          lineHeight: 1.5,
        }}
      >
        <strong style={{ color: 'var(--color-text-primary)' }}>How to read this page:</strong>
        <br />
        Each row = one variant we found in the code today. Green = canonical,
        amber = near-duplicate, red = violates an existing rule, grey = one-off
        legacy. The right-hand column is the literal CSS as it appears in the
        source.
      </div>
    </aside>
  );
}

/* ── tiny inline copies of style objects used in multiple rows ─────────── */

const navyFillBtn: CSSProperties = {
  border: 'none',
  background: 'var(--color-accent-active)',
  color: '#fff',
  cursor: 'pointer',
  fontFamily: 'var(--font-primary)',
};

const outlineBtn: CSSProperties = {
  background: '#fff',
  color: 'var(--color-text-primary)',
  cursor: 'pointer',
  fontFamily: 'var(--font-primary)',
};

/* ──────────────────────────────────────────────────────────────────────── */
/*  Section: Buttons                                                         */
/* ──────────────────────────────────────────────────────────────────────── */

function ButtonsSection() {
  return (
    <Section
      id="buttons"
      title="Buttons"
      intro={
        <>
          We currently have at least <strong>22 distinct button recipes</strong>{' '}
          across the codebase. They differ on padding (6–10 vertical, 10–18
          horizontal), border-radius (6, 7, 8, 9, 10, 100, 999), font-size (11,
          12, 12.5, 13), and font-weight (600 vs 700). Most of this drift is
          accidental — there is no rule yet specifying which to use when.
          <br />
          <strong>Recommended primary spec to lock in:</strong> padding{' '}
          <code>9px 16px</code>, border-radius <code>10</code>, font-size{' '}
          <code>13</code>, font-weight <code>700</code>, background{' '}
          <code>var(--color-accent-active)</code>.
        </>
      }
    >
      <VariantRow
        rule="canonical"
        name="Primary navy — RecipeFormParts"
        source="components/Recipe/RecipeFormParts.tsx → primaryBtnStyle"
        specs={[
          ['padding',   '10px 16px'],
          ['radius',    '10px'],
          ['font-size', '13px'],
          ['weight',    '600'],
          ['background','--color-accent-active'],
        ]}
        preview={
          <button style={{ ...navyFillBtn, padding: '10px 16px', borderRadius: 10, fontSize: 13, fontWeight: 600 }}>
            Save recipe
          </button>
        }
      />

      <VariantRow
        rule="duplicate"
        name="Primary navy — Suppliers import wizard"
        source="app/suppliers/import/page.tsx → primaryBtnStyle"
        note="Different padding-y and weight than RecipeFormParts (9 vs 10, 700 vs 600)."
        specs={[
          ['padding',   '9px 16px'],
          ['radius',    '10px'],
          ['font-size', '13px'],
          ['weight',    '700'],
        ]}
        preview={
          <button style={{ ...navyFillBtn, padding: '9px 16px', borderRadius: 10, fontSize: 13, fontWeight: 700 }}>
            Next step
          </button>
        }
      />

      <VariantRow
        rule="duplicate"
        name="Primary navy — Suppliers product detail"
        source="app/suppliers/products/[id]/page.tsx → primaryBtnStyle"
        note="Wider horizontal padding (18 instead of 16)."
        specs={[
          ['padding',   '9px 18px'],
          ['radius',    '10px'],
          ['font-size', '13px'],
          ['weight',    '700'],
        ]}
        preview={
          <button style={{ ...navyFillBtn, padding: '9px 18px', borderRadius: 10, fontSize: 13, fontWeight: 700 }}>
            Confirm match
          </button>
        }
      />

      <VariantRow
        rule="duplicate"
        name="Primary navy — Modifiers GroupEditor"
        source="components/Modifiers/GroupEditor.tsx → primaryBtn"
        note="Different radius (9 not 10) and padding-y."
        specs={[
          ['padding',   '8px 14px'],
          ['radius',    '9px'],
          ['font-size', '13px'],
          ['weight',    '600'],
        ]}
        preview={
          <button style={{ ...navyFillBtn, padding: '8px 14px', borderRadius: 9, fontSize: 13, fontWeight: 600 }}>
            Save group
          </button>
        }
      />

      <VariantRow
        rule="duplicate"
        name="Primary navy — Site settings"
        source="components/Settings/SiteSettingsEditor.tsx → primaryBtn()"
        note="Notably smaller — 11px font, 8px radius."
        specs={[
          ['padding',   '8px 14px'],
          ['radius',    '8px'],
          ['font-size', '11px'],
          ['weight',    '700'],
          ['border',    '1px solid --color-accent-active'],
        ]}
        preview={
          <button style={{ ...navyFillBtn, padding: '8px 14px', borderRadius: 8, fontSize: 11, fontWeight: 700, border: '1px solid var(--color-accent-active)' }}>
            Save site
          </button>
        }
      />

      <VariantRow
        rule="duplicate"
        name="Primary navy — Item matching (compact)"
        source="app/(menu)/item-matching/page.tsx"
        note="Different again — 7px / 12px / 8 radius / 12px font."
        specs={[
          ['padding',   '7px 12px'],
          ['radius',    '8px'],
          ['font-size', '12px'],
          ['weight',    '600'],
        ]}
        preview={
          <button style={{ ...navyFillBtn, padding: '7px 12px', borderRadius: 8, fontSize: 12, fontWeight: 600 }}>
            Match
          </button>
        }
      />

      <VariantRow
        rule="duplicate"
        name="Primary navy — Suppliers SmallButton"
        source="components/Suppliers/Primitives.tsx → SmallButton"
        specs={[
          ['padding',   '6px 12px'],
          ['radius',    '8px'],
          ['font-size', '12px'],
          ['weight',    '600'],
        ]}
        preview={
          <button style={{ ...navyFillBtn, padding: '6px 12px', borderRadius: 8, fontSize: 12, fontWeight: 600 }}>
            Order
          </button>
        }
      />

      <VariantRow
        rule="duplicate"
        name="Primary navy — Quinn supplier sheet"
        source="components/Suppliers/QuinnSheet.tsx"
        note="Font-weight 700 here, 600 elsewhere — small but consistent drift."
        specs={[
          ['padding',   '10px 14px'],
          ['radius',    '10px'],
          ['font-size', '13px'],
          ['weight',    '700'],
        ]}
        preview={
          <button style={{ ...navyFillBtn, padding: '10px 14px', borderRadius: 10, fontSize: 13, fontWeight: 700 }}>
            Ask Edify
          </button>
        }
      />

      <VariantRow
        rule="canonical"
        name="Secondary outline — RecipeFormParts"
        source="components/Recipe/RecipeFormParts.tsx → secondaryBtnStyle"
        specs={[
          ['padding',   '10px 16px'],
          ['radius',    '10px'],
          ['border',    '1px solid --color-border'],
          ['background','#fff'],
          ['font-size', '13px'],
          ['weight',    '600'],
        ]}
        preview={
          <button style={{ ...outlineBtn, padding: '10px 16px', borderRadius: 10, border: '1px solid var(--color-border)', fontSize: 13, fontWeight: 600 }}>
            Cancel
          </button>
        }
      />

      <VariantRow
        rule="duplicate"
        name="Secondary outline — Suppliers import (ghost)"
        source="app/suppliers/import/page.tsx → ghostBtnStyle"
        specs={[
          ['padding',   '9px 14px'],
          ['radius',    '10px'],
          ['border',    '1px solid --color-border'],
          ['weight',    '600'],
        ]}
        preview={
          <button style={{ ...outlineBtn, padding: '9px 14px', borderRadius: 10, border: '1px solid var(--color-border)', fontSize: 13, fontWeight: 600 }}>
            Back
          </button>
        }
      />

      <VariantRow
        rule="duplicate"
        name="Secondary outline — GroupEditor"
        source="components/Modifiers/GroupEditor.tsx → secondaryBtn"
        note="Uses --color-text-secondary instead of primary text — softer look."
        specs={[
          ['padding',   '8px 14px'],
          ['radius',    '9px'],
          ['border',    '1px solid --color-border'],
          ['color',     '--color-text-secondary'],
          ['weight',    '600'],
        ]}
        preview={
          <button style={{ background: '#fff', color: 'var(--color-text-secondary)', padding: '8px 14px', borderRadius: 9, border: '1px solid var(--color-border)', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font-primary)' }}>
            Discard
          </button>
        }
      />

      <VariantRow
        rule="legacy"
        name="Tertiary ghost — RecipeFormParts dismiss"
        source="components/Recipe/RecipeFormParts.tsx → dismissBtnStyle"
        specs={[
          ['padding',   '6px 10px'],
          ['radius',    '8px'],
          ['border',    '1px solid --color-border-subtle'],
          ['background','transparent'],
          ['color',     '--color-text-secondary'],
          ['font-size', '12px'],
        ]}
        preview={
          <button style={{ background: 'transparent', color: 'var(--color-text-secondary)', padding: '6px 10px', borderRadius: 8, border: '1px solid var(--color-border-subtle)', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font-primary)' }}>
            Dismiss
          </button>
        }
      />

      <VariantRow
        rule="legacy"
        name="Danger outline — GroupEditor"
        source="components/Modifiers/GroupEditor.tsx → dangerBtn"
        specs={[
          ['padding',   '7px 12px'],
          ['radius',    '8px'],
          ['border',    '1px solid --color-border'],
          ['color',     '--color-error'],
          ['font-size', '12.5px'],
        ]}
        preview={
          <button style={{ background: '#fff', color: 'var(--color-error)', padding: '7px 12px', borderRadius: 8, border: '1px solid var(--color-border)', fontSize: 12.5, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font-primary)' }}>
            Delete group
          </button>
        }
      />

      <VariantRow
        rule="legacy"
        name="Danger outline — Suppliers product"
        source="app/suppliers/products/[id]/page.tsx → dangerBtnStyle"
        note="Borders the error tint instead of neutral grey."
        specs={[
          ['padding',   '7px 12px'],
          ['radius',    '8px'],
          ['border',    '1px solid --color-error-border'],
          ['color',     '--color-error'],
          ['font-size', '12.5px'],
        ]}
        preview={
          <button style={{ background: '#fff', color: 'var(--color-error)', padding: '7px 12px', borderRadius: 8, border: '1px solid var(--color-error-border)', fontSize: 12.5, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font-primary)' }}>
            Remove
          </button>
        }
      />

      <VariantRow
        rule="legacy"
        name="Dashed “add” button"
        source="components/Modifiers/GroupEditor.tsx → addBtn"
        specs={[
          ['padding',   '8px 12px'],
          ['radius',    '8px'],
          ['border',    '1px dashed --color-border'],
          ['color',     '--color-text-secondary'],
          ['font-size', '12.5px'],
        ]}
        preview={
          <button style={{ background: '#fff', color: 'var(--color-text-secondary)', padding: '8px 12px', borderRadius: 8, border: '1px dashed var(--color-border)', fontSize: 12.5, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font-primary)', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <Plus size={12} /> Add option
          </button>
        }
      />

      <VariantRow
        rule="legacy"
        name="Pill — undo / chip-shaped"
        source="components/Suppliers/QuinnSheet.tsx → undoBtnStyle"
        note="Same border but 100px radius makes it a pill, not a rectangle. Used inline next to text."
        specs={[
          ['padding',   '6px 10px'],
          ['radius',    '100px'],
          ['border',    '1px solid --color-border'],
          ['font-size', '12px'],
          ['weight',    '700'],
        ]}
        preview={
          <button style={{ background: '#fff', color: 'var(--color-text-primary)', padding: '6px 10px', borderRadius: 100, border: '1px solid var(--color-border)', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'var(--font-primary)', display: 'inline-flex', alignItems: 'center', gap: 5 }}>
            <RotateCcw size={11} /> Undo
          </button>
        }
      />

      <VariantRow
        rule="legacy"
        name="Pill — bulk action Ask Edify"
        source="components/Suppliers/BulkActionBar.tsx"
        note="A fully filled, pill-shaped, 700-weight primary — yet another shape for a primary action."
        specs={[
          ['padding',   '8px 16px'],
          ['radius',    '100px'],
          ['background','--color-accent-active'],
          ['weight',    '700'],
        ]}
        preview={
          <button style={{ ...navyFillBtn, padding: '8px 16px', borderRadius: 100, fontSize: 12.5, fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <Sparkles size={13} /> Ask Edify
          </button>
        }
      />

      <VariantRow
        rule="legacy"
        name="Icon button — 30×30 ghost"
        source="components/Suppliers/QuinnSheet.tsx → iconBtnStyle"
        specs={[
          ['size',   '30 × 30'],
          ['radius', '8px'],
          ['border', 'none'],
          ['color',  '--color-text-muted'],
        ]}
        preview={
          <button aria-label="More" style={{ width: 30, height: 30, borderRadius: 8, border: 'none', background: 'transparent', color: 'var(--color-text-muted)', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
            <MoreHorizontal size={16} />
          </button>
        }
      />

      <VariantRow
        rule="duplicate"
        name="Icon button — 30×30 outlined (RowQuinn)"
        source="components/Suppliers/Primitives.tsx → RowQuinnButton"
        note="Same size, but bordered and inverts to navy on hover."
        specs={[
          ['size',   '30 × 30'],
          ['radius', '8px'],
          ['border', '1px solid --color-border-subtle'],
        ]}
        preview={
          <button aria-label="Ask Edify" style={{ width: 30, height: 30, borderRadius: 8, border: '1px solid var(--color-border-subtle)', background: '#fff', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
            <Sparkles size={14} color="var(--color-accent-active)" />
          </button>
        }
      />

      <VariantRow
        rule="duplicate"
        name="Icon button — 32×32 modal close"
        source="components/Production2/DispatchConfirmSheet.tsx"
        specs={[
          ['size',   '32 × 32'],
          ['radius', '8px'],
        ]}
        preview={
          <button aria-label="Close" style={{ width: 32, height: 32, borderRadius: 8, border: 'none', background: 'var(--color-bg-hover)', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
            <X size={16} />
          </button>
        }
      />

      <VariantRow
        rule="duplicate"
        name="Icon button — 36×36 sheet close"
        source="components/RightPanel/RightPanelSheetOverlay.tsx"
        specs={[
          ['size',   '36 × 36'],
          ['radius', '10px'],
        ]}
        preview={
          <button aria-label="Close" style={{ width: 36, height: 36, borderRadius: 10, border: 'none', background: 'var(--color-bg-hover)', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
            <X size={18} />
          </button>
        }
      />

      <VariantRow
        rule="duplicate"
        name="Icon button — 24×24 mini"
        source="components/Modifiers/GroupEditor.tsx → miniBtn()"
        specs={[
          ['size',   '24 × 24'],
          ['radius', '6px'],
          ['border', '1px solid --color-border-subtle'],
        ]}
        preview={
          <button aria-label="Edit" style={{ width: 24, height: 24, borderRadius: 6, border: '1px solid var(--color-border-subtle)', background: '#fff', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
            <Check size={12} />
          </button>
        }
      />

      <VariantRow
        rule="legacy"
        name="Text-link back button"
        source="app/suppliers/import/page.tsx → backBtnStyle"
        specs={[
          ['padding',    '6px 0'],
          ['border',     'none'],
          ['background', 'transparent'],
          ['color',      '--color-text-muted'],
          ['font-size',  '13px'],
        ]}
        preview={
          <button style={{ background: 'transparent', border: 'none', color: 'var(--color-text-muted)', fontSize: 13, fontWeight: 600, padding: '6px 0', cursor: 'pointer', fontFamily: 'var(--font-primary)' }}>
            ← Back to suppliers
          </button>
        }
      />
    </Section>
  );
}

/* ──────────────────────────────────────────────────────────────────────── */
/*  Section: Pills / badges / status                                         */
/* ──────────────────────────────────────────────────────────────────────── */

function PillsSection() {
  return (
    <Section
      id="pills"
      title="Pills, badges & status indicators"
      intro={
        <>
          We have a written rule for pills (
          <code>.cursor/rules/status-pills.mdc</code>): outline-only, white
          background, 1.5px coloured border. <strong>Multiple places still
          break it</strong> by using <code>var(--color-success-light)</code>{' '}
          fills inline. We also have <strong>three near-duplicate pill
          components</strong> with slightly different fontSize / letterSpacing.
        </>
      }
    >
      <VariantRow
        rule="canonical"
        name="StatusPill (sm) — shared primitive"
        source="components/ui/StatusPill.tsx"
        specs={[
          ['padding',         '3px 9px'],
          ['radius',          '999'],
          ['font-size',       '10.5px'],
          ['weight',          '700'],
          ['letter-spacing',  '0.05em'],
          ['text-transform',  'uppercase'],
          ['border',          '1.5px solid tone'],
        ]}
        preview={
          <div style={{ display: 'flex', gap: 6 }}>
            <span style={pillCanonical('success')}>Done</span>
            <span style={pillCanonical('warning')}>Pending</span>
            <span style={pillCanonical('error')}>Short</span>
            <span style={pillCanonical('info')}>Linked</span>
            <span style={pillCanonical('neutral')}>Inactive</span>
          </div>
        }
      />

      <VariantRow
        rule="canonical"
        name="StatusPill (xs) — shared primitive"
        source="components/ui/StatusPill.tsx (size='xs')"
        specs={[
          ['padding',   '2px 7px'],
          ['font-size', '9.5px'],
        ]}
        preview={
          <div style={{ display: 'flex', gap: 6 }}>
            <span style={pillCanonical('success', 'xs')}>OK</span>
            <span style={pillCanonical('warning', 'xs')}>Pending</span>
          </div>
        }
      />

      <VariantRow
        rule="duplicate"
        name="StatusPill — Production fork"
        source="components/Production/StatusPill.tsx · components/Production2/StatusPill.tsx"
        note="Two separate StatusPill implementations exist alongside components/ui — same outline model, but letter-spacing 0.04em (not 0.05em) and font-size 10/11 (not 9.5/10.5). No default uppercase transform."
        specs={[
          ['padding',        '3px 9px'],
          ['font-size',      '11px'],
          ['letter-spacing', '0.04em'],
          ['text-transform', 'none (no upper)'],
        ]}
        preview={
          <span style={{ display: 'inline-flex', alignItems: 'center', padding: '3px 9px', borderRadius: 999, background: '#fff', color: 'var(--color-info)', border: '1.5px solid var(--color-info)', fontSize: 11, fontWeight: 700, letterSpacing: '0.04em', whiteSpace: 'nowrap', lineHeight: 1 }}>
            In progress
          </span>
        }
      />

      <VariantRow
        rule="duplicate"
        name="StatusBadge with dot — Receiving"
        source="components/Receiving/StatusBadge.tsx"
        note="Yet another outline pill, with a coloured 6px dot prefix. Padding and font-size differ from the canonical."
        specs={[
          ['padding',   '4px 10px'],
          ['radius',    '100px'],
          ['font-size', '12px'],
          ['weight',    '600'],
          ['border',    '1.5px solid tone'],
        ]}
        preview={
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 10px', borderRadius: 100, background: '#fff', color: 'var(--color-success)', border: '1.5px solid var(--color-success)', fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap' }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--color-success)' }} />
            Received
          </span>
        }
      />

      <VariantRow
        rule="violation"
        name="Solid-fill pill — Suppliers Available/Pending"
        source="components/Suppliers/Primitives.tsx → StatusPill"
        note="Uses solid --color-success-light / --color-warning-light backgrounds. The platform rule reserves those tints for full banners and callout cards. This pill should be the outline version."
        specs={[
          ['background', '--color-success-light'],
          ['border',     '1px solid --color-success-border'],
          ['radius',     '100px'],
          ['padding',    '3px 10px'],
          ['font-size',  '11.5px'],
        ]}
        preview={
          <div style={{ display: 'flex', gap: 6 }}>
            <span style={pillSolid('success')}>Available</span>
            <span style={pillSolid('warning')}>Pending</span>
            <span style={pillSolidGrey()}>Unavailable</span>
          </div>
        }
      />

      <VariantRow
        rule="violation"
        name="Solid-fill pill — Item matching / POS"
        source="app/(menu)/item-matching/page.tsx · app/(menu)/pos-connection/page.tsx"
        note="Same offending pattern as Suppliers — solid semantic tints on inline pills."
        specs={[
          ['background', '--color-success-light'],
          ['radius',     '999'],
          ['font-size',  '11px'],
        ]}
        preview={
          <div style={{ display: 'flex', gap: 6 }}>
            <span style={pillSolid('success')}>Matched</span>
            <span style={pillSolid('warning')}>Review</span>
          </div>
        }
      />

      <VariantRow
        rule="violation"
        name="Solid-fill chip — Stock type"
        source="components/Stock/status.ts → STOCK_TYPE_CONFIG"
        note="Maps each stock type to a chipBg drawn from --color-info-light / success-light / warning-light. Rendered in dense tables."
        specs={[
          ['background', '--color-info-light'],
          ['color',      '--color-info'],
          ['radius',     '999'],
        ]}
        preview={
          <div style={{ display: 'flex', gap: 6 }}>
            <span style={pillSolid('info')}>Count</span>
            <span style={pillSolid('success')}>Mass</span>
            <span style={pillSolid('warning')}>Volume</span>
          </div>
        }
      />

      <VariantRow
        rule="violation"
        name="Solid-fill chip — Sidebar site health"
        source="components/Sidebar/SiteSwitcher.tsx"
        note="The site switcher uses chipBg with semantic lights. Same rule violation as Suppliers."
        specs={[
          ['background', '--color-warning-light'],
          ['radius',     '999'],
        ]}
        preview={<span style={pillSolid('warning')}>3 alerts</span>}
      />

      <VariantRow
        rule="legacy"
        name="Neutral grey chip"
        source="components/Production2/WorkTypeChip.tsx · RangeTierChips.tsx"
        note="Neutral grey background (--color-bg-hover) — not a semantic tint, so doesn't break the rule. But fontSize ranges 9 / 10 / 11 across files for the same shape."
        specs={[
          ['background', '--color-bg-hover'],
          ['radius',     '100px'],
          ['font-size',  '10–11px'],
          ['weight',     '700'],
        ]}
        preview={
          <div style={{ display: 'flex', gap: 6 }}>
            <span style={chipGrey(10)}>Prep</span>
            <span style={chipGrey(11)}>Cook</span>
            <span style={chipGrey(9)}>Pack</span>
          </div>
        }
      />

      <VariantRow
        rule="canonical"
        name="Transparent outline pill — Stock AttentionCard"
        source="components/Stock/AttentionCard.tsx"
        note="Correct outline style with uppercase. Could be unified with the shared StatusPill."
        specs={[
          ['background',     'transparent'],
          ['border',         '1px solid tone'],
          ['text-transform', 'uppercase'],
        ]}
        preview={
          <span style={{ display: 'inline-flex', alignItems: 'center', padding: '3px 8px', borderRadius: 999, background: 'transparent', color: 'var(--color-warning)', border: '1px solid var(--color-warning)', fontSize: 10, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
            Below par
          </span>
        }
      />

      <VariantRow
        rule="canonical"
        name="Confidence badge — Assisted ordering"
        source="app/assisted-ordering/components/ConfidenceBadge.tsx"
        specs={[
          ['padding', '2px 7px'],
          ['radius',  '--radius-badge (8px)'],
          ['border',  '1px solid tone'],
        ]}
        preview={
          <span style={{ display: 'inline-flex', alignItems: 'center', padding: '2px 7px', borderRadius: 8, background: 'transparent', color: 'var(--color-success)', border: '1px solid var(--color-success)', fontSize: 10, fontWeight: 700 }}>
            HIGH 92%
          </span>
        }
      />

      <VariantRow
        rule="legacy"
        name="Nav item count badge — Sidebar"
        source="components/Sidebar/NavItem.tsx"
        specs={[
          ['min-width', '18px'],
          ['height',    '16px (or 18px compact)'],
          ['radius',    '--radius-badge (8px) / 999'],
          ['background','#fff'],
        ]}
        previewBg="var(--color-bg-nav)"
        preview={
          <span style={{ minWidth: 18, height: 16, padding: '0 5px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: '#fff', color: 'var(--color-bg-nav)', borderRadius: 8, fontSize: 10, fontWeight: 700 }}>
            3
          </span>
        }
      />
    </Section>
  );
}

function pillCanonical(
  tone: 'success' | 'warning' | 'error' | 'info' | 'neutral',
  size: 'xs' | 'sm' = 'sm',
): CSSProperties {
  const TONE: Record<string, { fg: string; border: string }> = {
    success: { fg: 'var(--color-success)',         border: 'var(--color-success)' },
    warning: { fg: 'var(--color-warning)',         border: 'var(--color-warning)' },
    error:   { fg: 'var(--color-error)',           border: 'var(--color-error)' },
    info:    { fg: 'var(--color-info)',            border: 'var(--color-info)' },
    neutral: { fg: 'var(--color-text-secondary)',  border: 'var(--color-border)' },
  };
  const t = TONE[tone];
  return {
    display: 'inline-flex',
    alignItems: 'center',
    padding: size === 'xs' ? '2px 7px' : '3px 9px',
    borderRadius: 999,
    background: '#ffffff',
    color: t.fg,
    border: `1.5px solid ${t.border}`,
    fontSize: size === 'xs' ? 9.5 : 10.5,
    fontWeight: 700,
    letterSpacing: '0.05em',
    textTransform: 'uppercase',
    whiteSpace: 'nowrap',
    lineHeight: 1,
    fontFamily: 'var(--font-primary)',
  };
}

function pillSolid(tone: 'success' | 'warning' | 'error' | 'info'): CSSProperties {
  const TONE = {
    success: { bg: 'var(--color-success-light)', fg: 'var(--color-success)', border: 'var(--color-success-border)' },
    warning: { bg: 'var(--color-warning-light)', fg: 'var(--color-warning)', border: 'var(--color-warning-border)' },
    error:   { bg: 'var(--color-error-light)',   fg: 'var(--color-error)',   border: 'var(--color-error-border)' },
    info:    { bg: 'var(--color-info-light)',    fg: 'var(--color-info)',    border: 'var(--color-info)' },
  };
  const t = TONE[tone];
  return {
    display: 'inline-flex',
    alignItems: 'center',
    padding: '3px 10px',
    borderRadius: 100,
    background: t.bg,
    color: t.fg,
    border: `1px solid ${t.border}`,
    fontSize: 11.5,
    fontWeight: 700,
    whiteSpace: 'nowrap',
    fontFamily: 'var(--font-primary)',
  };
}

function pillSolidGrey(): CSSProperties {
  return {
    display: 'inline-flex',
    alignItems: 'center',
    padding: '3px 10px',
    borderRadius: 100,
    background: 'var(--color-bg-hover)',
    color: 'var(--color-text-muted)',
    border: '1px solid var(--color-border-subtle)',
    fontSize: 11.5,
    fontWeight: 700,
    whiteSpace: 'nowrap',
    fontFamily: 'var(--font-primary)',
  };
}

function chipGrey(fontSize: number): CSSProperties {
  return {
    display: 'inline-flex',
    alignItems: 'center',
    padding: '3px 8px',
    borderRadius: 100,
    background: 'var(--color-bg-hover)',
    color: 'var(--color-text-secondary)',
    fontSize,
    fontWeight: 700,
    whiteSpace: 'nowrap',
    fontFamily: 'var(--font-primary)',
  };
}

/* ──────────────────────────────────────────────────────────────────────── */
/*  Section: Tabs / segmented controls                                       */
/* ──────────────────────────────────────────────────────────────────────── */

function TabsSection() {
  const [active1, setActive1] = useState('bench');
  const [active2, setActive2] = useState('command');
  const [active3, setActive3] = useState('a');
  const [active4, setActive4] = useState('all');

  return (
    <Section
      id="tabs"
      title="Tabs / segmented controls"
      intro={
        <>
          Three completely different tab paradigms coexist: production-style
          chunky underlined pills (44px tall), Mvp1 workspace pill-shaped tabs
          on a grey track, and the Shell command-vs-dashboard segmented
          control. Plus filter chips.
        </>
      }
    >
      <VariantRow
        rule="legacy"
        name="Production sticky sub-nav"
        source="app/production/layout.tsx + components/Production/topNavStyles.ts"
        specs={[
          ['min-height', '44px'],
          ['padding',    '10px 18px'],
          ['radius',     '10px'],
          ['font-size',  '14px'],
          ['weight',     '600'],
          ['active bg',  '--color-accent-active'],
        ]}
        previewPadding="12px"
        preview={
          <div style={{ display: 'flex', gap: 8 }}>
            {['bench', 'pcr', 'dispatch'].map(k => {
              const isActive = active1 === k;
              return (
                <button key={k} onClick={() => setActive1(k)} style={{
                  minHeight: 44,
                  padding: '10px 18px',
                  borderRadius: 10,
                  border: `1px solid ${isActive ? 'var(--color-accent-active)' : 'transparent'}`,
                  background: isActive ? 'var(--color-accent-active)' : 'transparent',
                  color: isActive ? 'var(--color-text-on-active)' : 'var(--color-text-secondary)',
                  fontSize: 14, fontWeight: 600, cursor: 'pointer',
                  fontFamily: 'var(--font-primary)',
                }}>
                  {k === 'bench' ? 'Bench' : k === 'pcr' ? 'PCR review' : 'Dispatch'}
                </button>
              );
            })}
          </div>
        }
      />

      <VariantRow
        rule="legacy"
        name="Shell topbar — Command / Dashboard"
        source="components/ShellTopBar.tsx"
        specs={[
          ['wrap padding', '4px'],
          ['wrap radius',  '100px'],
          ['inner pad',    '8px 14px'],
          ['inner radius', '100px'],
          ['font-size',    '12px'],
          ['weight',       '600'],
        ]}
        preview={
          <div style={{
            display: 'inline-flex', gap: 0, padding: 4, borderRadius: 100,
            background: 'var(--color-bg-hover)', border: '1px solid var(--color-border-subtle)',
          }}>
            {['command', 'dashboard'].map(k => {
              const isActive = active2 === k;
              return (
                <button key={k} onClick={() => setActive2(k)} style={{
                  padding: '8px 14px',
                  borderRadius: 100,
                  border: 'none',
                  background: isActive ? '#fff' : 'transparent',
                  color: isActive ? 'var(--color-text-primary)' : 'var(--color-text-secondary)',
                  fontSize: 12, fontWeight: 600, cursor: 'pointer',
                  boxShadow: isActive ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                  fontFamily: 'var(--font-primary)',
                }}>
                  {k === 'command' ? 'Command Centre' : 'Dashboard'}
                </button>
              );
            })}
          </div>
        }
      />

      <VariantRow
        rule="legacy"
        name="Mvp1 workspace tabs"
        source="components/Mvp1/Tabs/Mvp1Tabs.tsx"
        specs={[
          ['padding',   '8px 14px'],
          ['radius',    '999'],
          ['font-size', '12px'],
          ['active',    'navy fill + boxShadow'],
        ]}
        preview={
          <div style={{ display: 'inline-flex', gap: 4, padding: 4, borderRadius: 999, background: 'var(--color-bg-hover)', border: '1px solid var(--color-border-subtle)' }}>
            {['a', 'b', 'c'].map(k => {
              const isActive = active3 === k;
              return (
                <button key={k} onClick={() => setActive3(k)} style={{
                  padding: '8px 14px',
                  borderRadius: 999,
                  border: 'none',
                  background: isActive ? 'var(--color-accent-active)' : 'transparent',
                  color: isActive ? '#fff' : 'var(--color-text-secondary)',
                  fontSize: 12, fontWeight: 600, cursor: 'pointer',
                  boxShadow: isActive ? '0 2px 8px rgba(34,68,68,0.25)' : 'none',
                  fontFamily: 'var(--font-primary)',
                }}>
                  {k === 'a' ? 'Overview' : k === 'b' ? 'By supplier' : 'By category'}
                </button>
              );
            })}
            <button style={{
              width: 28, height: 28, borderRadius: 999,
              border: '1px solid var(--color-border-subtle)', background: '#fff',
              cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <Plus size={14} />
            </button>
          </div>
        }
      />

      <VariantRow
        rule="legacy"
        name="Filter chips — DataTable / ViewFilterBar"
        source="components/Mvp1/Tables/ViewFilterBar.tsx"
        specs={[
          ['padding',     '6px 10px'],
          ['radius',      '999'],
          ['font-size',   '11px'],
          ['active bg',   'rgba(34,68,68,0.08)'],
          ['active border','1px solid --color-accent-active'],
        ]}
        preview={
          <div style={{ display: 'flex', gap: 6 }}>
            {['all', 'flagged', 'unmatched'].map(k => {
              const isActive = active4 === k;
              return (
                <button key={k} onClick={() => setActive4(k)} style={{
                  padding: '6px 10px',
                  borderRadius: 999,
                  border: `1px solid ${isActive ? 'var(--color-accent-active)' : 'var(--color-border-subtle)'}`,
                  background: isActive ? 'rgba(34,68,68,0.08)' : '#fff',
                  color: isActive ? 'var(--color-accent-active)' : 'var(--color-text-secondary)',
                  fontSize: 11, fontWeight: 600, cursor: 'pointer',
                  fontFamily: 'var(--font-primary)',
                }}>
                  {k === 'all' ? 'All 124' : k === 'flagged' ? 'Flagged 7' : 'Unmatched 3'}
                </button>
              );
            })}
          </div>
        }
      />

      <VariantRow
        rule="legacy"
        name="Site picker — compact outlined pill"
        source="components/Production/topNavStyles.ts → COMPACT + IDLE_OUTLINED"
        specs={[
          ['min-height', '36px'],
          ['padding',    '6px 14px'],
          ['radius',     '8px'],
          ['font-size',  '13px'],
        ]}
        preview={
          <button style={{
            minHeight: 36, padding: '6px 14px', borderRadius: 8,
            border: '1px solid var(--color-border)', background: '#fff',
            fontSize: 13, fontWeight: 600, cursor: 'pointer',
            display: 'inline-flex', alignItems: 'center', gap: 6,
            fontFamily: 'var(--font-primary)',
          }}>
            Soho · 14 Greek Street <ChevronDown size={14} />
          </button>
        }
      />
    </Section>
  );
}

/* ──────────────────────────────────────────────────────────────────────── */
/*  Section: Headings / titles / eyebrows                                    */
/* ──────────────────────────────────────────────────────────────────────── */

function HeadingsSection() {
  return (
    <Section
      id="headings"
      title="Headings, titles & eyebrows"
      intro={
        <>
          Page-title font-sizes range from <code>13px</code> (Production header
          centre label) to <code>22px</code> (Suppliers list H1). Eyebrow
          treatments share the same shape (uppercase, 700, ~11px,
          letter-spacing 0.06–0.08em) but disagree on the exact letter-spacing.
        </>
      }
    >
      <VariantRow
        rule="legacy"
        name="Suppliers list — H1"
        source="app/suppliers/page.tsx"
        specs={[
          ['font-size', '22px'],
          ['weight',    '700'],
        ]}
        preview={
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: 'var(--color-text-primary)' }}>
            Suppliers
          </h1>
        }
      />

      <VariantRow
        rule="duplicate"
        name="Right-panel sheet title"
        source="components/RightPanel/RightPanelSheetOverlay.tsx"
        specs={[
          ['font-size', '15px'],
          ['weight',    '700'],
        ]}
        preview={
          <h2 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: 'var(--color-text-primary)' }}>
            Today&apos;s briefing
          </h2>
        }
      />

      <VariantRow
        rule="duplicate"
        name="Recipe editor — inline title"
        source="app/recipes/[id]/edit/page.tsx"
        specs={[
          ['font-size', '15px'],
          ['weight',    '700'],
        ]}
        preview={
          <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--color-text-primary)' }}>
            Wood-fired margherita
          </div>
        }
      />

      <VariantRow
        rule="duplicate"
        name="Production topbar — centre label"
        source="app/production/layout.tsx"
        note="Confusingly small — only 13px — yet acts as the page title."
        specs={[
          ['font-size',      '13px'],
          ['weight',         '700'],
          ['letter-spacing', '0.01em'],
        ]}
        preview={
          <div style={{ fontSize: 13, fontWeight: 700, letterSpacing: '0.01em', color: 'var(--color-text-primary)' }}>
            Production · Soho
          </div>
        }
      />

      <VariantRow
        rule="canonical"
        name="Eyebrow — Recipe editor"
        source="app/recipes/[id]/edit/page.tsx"
        specs={[
          ['font-size',      '11px'],
          ['weight',         '700'],
          ['letter-spacing', '0.06em'],
          ['text-transform', 'uppercase'],
          ['color',          '--color-text-muted'],
        ]}
        preview={
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--color-text-muted)' }}>
            Recipe details
          </div>
        }
      />

      <VariantRow
        rule="duplicate"
        name="Eyebrow — Recipe intake (wider tracking)"
        source="app/recipes/intake/sheet/page.tsx"
        note="Same shape as the canonical eyebrow but letter-spacing 0.08em vs 0.06em."
        specs={[
          ['font-size',      '11px'],
          ['letter-spacing', '0.08em'],
        ]}
        preview={
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--color-text-muted)' }}>
            Step 1 of 3
          </div>
        }
      />
    </Section>
  );
}

/* ──────────────────────────────────────────────────────────────────────── */
/*  Section: Cards / callouts                                                */
/* ──────────────────────────────────────────────────────────────────────── */

function CardsSection() {
  return (
    <Section
      id="cards"
      title="Cards, callouts & banners"
      intro={
        <>
          Card chrome is mostly consistent (white background, 1px subtle
          border, radius 10) but shadows and paddings drift. Callouts
          legitimately use filled semantic tints (this is allowed by the
          status-pill rule, since the entire block <em>is</em> the message).
        </>
      }
    >
      <VariantRow
        rule="canonical"
        name="Standard card — Kpi"
        source="components/Dashboard/parts/KpiCard.tsx"
        specs={[
          ['padding',    '14px 16px'],
          ['radius',     '10px'],
          ['border',     '1px solid --color-border-subtle'],
          ['background', '#fff'],
        ]}
        previewBg="var(--color-bg-hover)"
        preview={
          <div style={{ width: 220, padding: '14px 16px', borderRadius: 10, border: '1px solid var(--color-border-subtle)', background: '#fff' }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--color-text-muted)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>Revenue</div>
            <div style={{ fontSize: 24, fontWeight: 700, marginTop: 4 }}>£12,408</div>
            <div style={{ fontSize: 11, color: 'var(--color-success)', marginTop: 4 }}>▲ 8.2%</div>
          </div>
        }
      />

      <VariantRow
        rule="duplicate"
        name="Heavy shadow card — DataTable shell"
        source="components/Mvp1/Tables/DataTable.tsx"
        note="Uses 12px radius + double box-shadow. The shadow is unique to this surface."
        specs={[
          ['radius',     '12px'],
          ['border',     '1px solid --color-border-subtle'],
          ['box-shadow', '0 2px 12px rgba(0, 28, 53,0.1), 0 0 0 1px rgba(0, 28, 53,0.03)'],
        ]}
        previewBg="var(--color-bg-hover)"
        preview={
          <div style={{ width: 220, padding: 14, borderRadius: 12, border: '1px solid var(--color-border-subtle)', background: '#fff', boxShadow: '0 2px 12px rgba(0, 28, 53,0.1), 0 0 0 1px rgba(0, 28, 53,0.03)' }}>
            <div style={{ fontSize: 13, fontWeight: 700 }}>Master products</div>
            <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 4 }}>1,248 items · 12 categories</div>
          </div>
        }
      />

      <VariantRow
        rule="canonical"
        name="Attention card — coloured left bar"
        source="components/Stock/AttentionCard.tsx"
        specs={[
          ['padding',     '14px 16px'],
          ['radius',      '--radius-card (10px)'],
          ['border',      '1px solid --color-border-subtle'],
          ['border-left', '4px solid tone'],
        ]}
        previewBg="var(--color-bg-hover)"
        preview={
          <div style={{ width: 320, padding: '14px 16px', borderRadius: 10, border: '1px solid var(--color-border-subtle)', borderLeft: '4px solid var(--color-warning)', background: '#fff' }}>
            <div style={{ fontSize: 13, fontWeight: 700 }}>Mozzarella running short</div>
            <div style={{ fontSize: 12, color: 'var(--color-text-secondary)', marginTop: 4 }}>3.5 days cover vs 5-day par.</div>
          </div>
        }
      />

      <VariantRow
        rule="ok"
        name="Warning callout — filled tint"
        source="app/(menu)/recipes/page.tsx → ImpactPreview"
        note="Allowed by the status-pill rule because the whole block is the message, not an inline status."
        specs={[
          ['padding',    '12px 14px'],
          ['radius',     '10px'],
          ['background', '--color-warning-light'],
          ['border',     '1px solid --color-warning-border'],
        ]}
        previewBg="var(--color-bg-hover)"
        preview={
          <div style={{ width: 360, padding: '12px 14px', borderRadius: 10, background: 'var(--color-warning-light)', border: '1px solid var(--color-warning-border)', display: 'flex', alignItems: 'flex-start', gap: 10 }}>
            <AlertTriangle size={16} color="var(--color-warning)" style={{ flexShrink: 0, marginTop: 1 }} />
            <div style={{ fontSize: 12.5, color: 'var(--color-text-primary)', lineHeight: 1.45 }}>
              <strong>2 recipes affected.</strong> Changing this ingredient will
              update Margherita and Vegan stack costings.
            </div>
          </div>
        }
      />

      <VariantRow
        rule="ok"
        name="Info callout — filled tint"
        source="components/Production/QuinnProductionPanel.tsx"
        specs={[
          ['background', '--color-info-light'],
          ['border',     '1px solid --color-info'],
          ['radius',     '10px'],
        ]}
        previewBg="var(--color-bg-hover)"
        preview={
          <div style={{ width: 360, padding: '12px 14px', borderRadius: 10, background: 'var(--color-info-light)', border: '1px solid var(--color-info)', display: 'flex', alignItems: 'flex-start', gap: 10 }}>
            <Info size={16} color="var(--color-info)" style={{ flexShrink: 0, marginTop: 1 }} />
            <div style={{ fontSize: 12.5, color: 'var(--color-text-primary)', lineHeight: 1.45 }}>
              Quinn has pre-filled this order based on yesterday&apos;s sales.
            </div>
          </div>
        }
      />

      <VariantRow
        rule="ok"
        name="Success callout — filled tint"
        source="various — production review screens"
        specs={[
          ['background', '--color-success-light'],
          ['border',     '1px solid --color-success-border'],
          ['radius',     '10px'],
        ]}
        previewBg="var(--color-bg-hover)"
        preview={
          <div style={{ width: 360, padding: '12px 14px', borderRadius: 10, background: 'var(--color-success-light)', border: '1px solid var(--color-success-border)', display: 'flex', alignItems: 'flex-start', gap: 10 }}>
            <CheckCircle2 size={16} color="var(--color-success)" style={{ flexShrink: 0, marginTop: 1 }} />
            <div style={{ fontSize: 12.5, color: 'var(--color-text-primary)', lineHeight: 1.45 }}>
              All 24 batches reviewed. Dispatch unlocked.
            </div>
          </div>
        }
      />
    </Section>
  );
}

/* ──────────────────────────────────────────────────────────────────────── */
/*  Section: Tables                                                          */
/* ──────────────────────────────────────────────────────────────────────── */

function TablesSection() {
  return (
    <Section
      id="tables"
      title="Tables & list rows"
      intro={
        <>
          The Mvp1 DataTable header is the most considered. Other tables in
          Suppliers/Stock use ad-hoc inline headers with subtly different font
          weights and uppercase rules. We should pick one header style.
        </>
      }
    >
      <VariantRow
        rule="canonical"
        name="DataTable header — not uppercased"
        source="components/Mvp1/Tables/DataTable.tsx"
        specs={[
          ['font-size',      '11px'],
          ['weight',         '700'],
          ['letter-spacing', '0.02em'],
          ['text-transform', 'none'],
          ['border-bottom',  '1px solid --color-border-subtle'],
        ]}
        previewPadding="0"
        preview={
          <div style={{ width: '100%', background: '#fff', borderRadius: 8, overflow: 'hidden', border: '1px solid var(--color-border-subtle)' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr 1fr', padding: '10px 12px', fontSize: 11, fontWeight: 700, letterSpacing: '0.02em', color: 'var(--color-text-secondary)', background: '#fff', borderBottom: '1px solid var(--color-border-subtle)' }}>
              <div>Supplier</div><div>Category</div><div>Last ordered</div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr 1fr', padding: '10px 12px', fontSize: 12, borderBottom: '1px solid var(--color-border-subtle)' }}>
              <div>La Tua Pasta</div><div>Dry goods</div><div>2d ago</div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr 1fr', padding: '10px 12px', fontSize: 12 }}>
              <div>Smithfield Meats</div><div>Protein</div><div>1d ago</div>
            </div>
          </div>
        }
      />

      <VariantRow
        rule="legacy"
        name="Suppliers table — inline header"
        source="components/Suppliers/SuppliersTable.tsx"
        note="Slightly heavier text (12px/600), no uppercase, mixed cell padding."
        specs={[
          ['font-size',     '12px'],
          ['weight',        '600'],
          ['border-bottom', '1px solid --color-border-subtle'],
        ]}
        previewPadding="0"
        preview={
          <div style={{ width: '100%', background: '#fff', borderRadius: 8, overflow: 'hidden', border: '1px solid var(--color-border-subtle)' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr 1fr', padding: '12px 14px', fontSize: 12, fontWeight: 600, color: 'var(--color-text-secondary)', borderBottom: '1px solid var(--color-border-subtle)' }}>
              <div>Supplier</div><div>Status</div><div>Lead time</div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr 1fr', padding: '12px 14px', fontSize: 12.5 }}>
              <div>La Tua Pasta</div>
              <div><span style={pillSolid('success')}>Available</span></div>
              <div>24h</div>
            </div>
          </div>
        }
      />

      <VariantRow
        rule="legacy"
        name="Stock all-items — inline list"
        source="components/Stock/AllItemsTable.tsx"
        note="Two-line cells. Secondary line is 11px, title is 13px / 600."
        specs={[
          ['title font',   '13px / 600'],
          ['second line',  '11px'],
        ]}
        previewPadding="0"
        preview={
          <div style={{ width: '100%', background: '#fff', borderRadius: 8, overflow: 'hidden', border: '1px solid var(--color-border-subtle)' }}>
            <div style={{ padding: '10px 12px', borderBottom: '1px solid var(--color-border-subtle)' }}>
              <div style={{ fontSize: 13, fontWeight: 600 }}>Mozzarella, fior di latte</div>
              <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 2 }}>3.5 days cover · par 5d</div>
            </div>
            <div style={{ padding: '10px 12px' }}>
              <div style={{ fontSize: 13, fontWeight: 600 }}>San Marzano tomatoes</div>
              <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 2 }}>11 days cover · par 7d</div>
            </div>
          </div>
        }
      />
    </Section>
  );
}

/* ──────────────────────────────────────────────────────────────────────── */
/*  Section: Inputs                                                          */
/* ──────────────────────────────────────────────────────────────────────── */

function InputsSection() {
  const [selectVal, setSelectVal] = useState('a');
  const [checked, setChecked] = useState(true);
  const [qty, setQty] = useState(2);

  return (
    <Section
      id="inputs"
      title="Inputs — text, select, stepper, checkbox"
      intro={
        <>
          Input heights range from <code>26px</code> (DataTable search) to{' '}
          <code>38px</code> (StyledSelect). Border radius and font-size disagree
          across files. Only StyledSelect ships an explicit focus ring.
        </>
      }
    >
      <VariantRow
        rule="canonical"
        name="Text input — RecipeFormParts"
        source="components/Recipe/RecipeFormParts.tsx → inputStyle"
        specs={[
          ['padding',   '8px 10px'],
          ['radius',    '8px'],
          ['border',    '1px solid --color-border'],
          ['font-size', '13px'],
          ['focus ring','— none —'],
        ]}
        preview={
          <input
            placeholder="Recipe name"
            style={{
              padding: '8px 10px', borderRadius: 8, border: '1px solid var(--color-border)',
              fontSize: 13, outline: 'none', fontFamily: 'var(--font-primary)', width: 240,
            }}
          />
        }
      />

      <VariantRow
        rule="duplicate"
        name="Text input — GroupEditor (slightly smaller)"
        source="components/Modifiers/GroupEditor.tsx → textInput"
        specs={[
          ['padding',   '7px 10px'],
          ['radius',    '7px'],
          ['border',    '1px solid --color-border-subtle'],
        ]}
        preview={
          <input
            placeholder="Option name"
            style={{
              padding: '7px 10px', borderRadius: 7, border: '1px solid var(--color-border-subtle)',
              fontSize: 13, outline: 'none', fontFamily: 'var(--font-primary)', width: 240,
            }}
          />
        }
      />

      <VariantRow
        rule="legacy"
        name="Dense cell input"
        source="components/Recipe/RecipeFormParts.tsx → cellInput"
        specs={[
          ['padding',   '6px 8px'],
          ['radius',    '6px'],
          ['font-size', '12.5px'],
        ]}
        preview={
          <input
            placeholder="0.5"
            style={{
              padding: '6px 8px', borderRadius: 6, border: '1px solid var(--color-border-subtle)',
              fontSize: 12.5, outline: 'none', fontFamily: 'var(--font-primary)', width: 100,
            }}
          />
        }
      />

      <VariantRow
        rule="canonical"
        name="StyledSelect (height 38)"
        source="components/ui/StyledSelect.tsx"
        note="Only input that ships an explicit focus ring (3px navy at 12% alpha)."
        specs={[
          ['height',    '38px'],
          ['radius',    '8px'],
          ['font-size', '13px'],
          ['focus',     '0 0 0 3px rgba(28,46,108,0.12)'],
        ]}
        preview={
          <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', width: 220, height: 38, borderRadius: 8, border: '1px solid var(--color-border)', background: '#fff' }}>
            <select
              value={selectVal}
              onChange={(e) => setSelectVal(e.target.value)}
              style={{
                flex: 1, minWidth: 0, height: '100%', appearance: 'none',
                WebkitAppearance: 'none', MozAppearance: 'none',
                padding: '0 36px 0 12px', border: 'none', outline: 'none',
                background: 'transparent', color: 'var(--color-text-primary)',
                fontFamily: 'var(--font-primary)', fontSize: 13, fontWeight: 600,
              }}
            >
              <option value="a">Soho</option>
              <option value="b">Notting Hill</option>
              <option value="c">Shoreditch</option>
            </select>
            <span style={{ position: 'absolute', right: 10, pointerEvents: 'none', color: 'var(--color-text-secondary)' }}>
              <ChevronDown size={16} strokeWidth={2.25} />
            </span>
          </div>
        }
      />

      <VariantRow
        rule="duplicate"
        name="Search input — DataTable"
        source="components/Mvp1/Tables/DataTable.tsx"
        specs={[
          ['padding',   '7px 10px 7px 30px'],
          ['radius',    '8px'],
          ['border',    '1px solid --color-border-subtle'],
          ['font-size', '12px'],
        ]}
        preview={
          <div style={{ position: 'relative', display: 'inline-block', width: 240 }}>
            <Search size={13} color="var(--color-text-muted)" style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)' }} />
            <input
              placeholder="Search master products"
              style={{
                width: '100%', padding: '7px 10px 7px 30px', borderRadius: 8,
                border: '1px solid var(--color-border-subtle)', fontSize: 12,
                outline: 'none', fontFamily: 'var(--font-primary)',
              }}
            />
          </div>
        }
      />

      <VariantRow
        rule="canonical"
        name="Checkbox — Suppliers Primitives"
        source="components/Suppliers/Primitives.tsx → Checkbox"
        specs={[
          ['size',   '18 × 18'],
          ['radius', '5px'],
          ['border', '1.5px'],
        ]}
        preview={
          <button
            onClick={() => setChecked(!checked)}
            style={{
              width: 18, height: 18, borderRadius: 5, cursor: 'pointer',
              border: `1.5px solid ${checked ? 'var(--color-accent-active)' : 'var(--color-border)'}`,
              background: checked ? 'var(--color-accent-active)' : '#fff',
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            {checked && <Check size={11} color="#fff" strokeWidth={3} />}
          </button>
        }
      />

      <VariantRow
        rule="duplicate"
        name="Qty stepper — Production2 (28×28)"
        source="components/Production2/QtyStepper.tsx"
        specs={[
          ['button size',  '22 / 28 / 32 by tier'],
          ['radius',       '5 or 6px'],
          ['value width',  '26 / 32 / 36'],
          ['value font',   '12 / 14 / 16'],
        ]}
        preview={
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 0 }}>
            <button onClick={() => setQty(Math.max(0, qty - 1))} style={{ width: 28, height: 28, borderRadius: 5, border: '1px solid var(--color-border-subtle)', background: '#fff', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
              <Minus size={12} />
            </button>
            <div style={{ minWidth: 32, height: 28, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 600 }}>{qty}</div>
            <button onClick={() => setQty(qty + 1)} style={{ width: 28, height: 28, borderRadius: 5, border: '1px solid var(--color-border-subtle)', background: '#fff', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
              <Plus size={12} />
            </button>
          </div>
        }
      />

      <VariantRow
        rule="duplicate"
        name="Qty stepper — Receiving (36×36)"
        source="components/Receiving/Stepper.tsx"
        note="Larger and uses a tinted hover background, not white. Different visual language than Production2 stepper."
        specs={[
          ['button size', '36 × 36'],
          ['background',  '--color-bg-hover'],
          ['font-size',   '18px'],
        ]}
        preview={
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 0 }}>
            <button style={{ width: 36, height: 36, borderRadius: 8, border: '1px solid var(--color-border-subtle)', background: 'var(--color-bg-hover)', cursor: 'pointer', fontSize: 18, fontWeight: 600 }}>−</button>
            <div style={{ minWidth: 36, height: 36, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 15, fontWeight: 600 }}>{qty}</div>
            <button style={{ width: 36, height: 36, borderRadius: 8, border: '1px solid var(--color-border-subtle)', background: 'var(--color-bg-hover)', cursor: 'pointer', fontSize: 18, fontWeight: 600 }}>+</button>
          </div>
        }
      />

      <VariantRow
        rule="legacy"
        name="Textarea — RecipeFormParts"
        source="components/Recipe/RecipeFormParts.tsx → textareaStyle"
        specs={[
          ['min-height', '70px'],
          ['radius',     '8px'],
          ['border',     '1px solid --color-border'],
        ]}
        preview={
          <textarea
            placeholder="Method"
            style={{
              minHeight: 70, padding: '8px 10px', borderRadius: 8,
              border: '1px solid var(--color-border)', fontSize: 13,
              outline: 'none', fontFamily: 'var(--font-primary)', width: 280, resize: 'vertical',
            }}
          />
        }
      />
    </Section>
  );
}

/* ──────────────────────────────────────────────────────────────────────── */
/*  Section: Modals / sheets / popovers                                      */
/* ──────────────────────────────────────────────────────────────────────── */

function ModalsSection() {
  return (
    <Section
      id="modals"
      title="Modals, sheets & popovers"
      intro={
        <>
          We have at least three overlay paradigms: centred confirm modal,
          slide-in side sheet (Quinn supplier), and full-screen mobile sheet.
          Backdrops alone use three different rgba values.
        </>
      }
    >
      <VariantRow
        rule="canonical"
        name="Dispatch confirm modal"
        source="components/Production2/DispatchConfirmSheet.tsx"
        specs={[
          ['width',      'min(640px, 100%)'],
          ['radius',     '--radius-card (10px)'],
          ['box-shadow', '0 24px 64px rgba(12,20,44,0.28)'],
          ['header pad', '16px 20px 12px'],
          ['backdrop',   'rgba(12,20,44,0.45)'],
        ]}
        previewBg="rgba(12,20,44,0.45)"
        previewPadding="24px"
        preview={
          <div style={{ width: 320, borderRadius: 10, background: '#fff', boxShadow: '0 24px 64px rgba(12,20,44,0.28)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px 12px' }}>
              <div style={{ fontSize: 14, fontWeight: 700 }}>Dispatch 24 batches?</div>
              <button aria-label="Close" style={{ width: 32, height: 32, borderRadius: 8, border: 'none', background: 'var(--color-bg-hover)', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                <X size={16} />
              </button>
            </div>
            <div style={{ padding: '0 20px 16px', fontSize: 12.5, color: 'var(--color-text-secondary)' }}>
              This will lock all batches and send the dispatch manifest to the courier.
            </div>
          </div>
        }
      />

      <VariantRow
        rule="duplicate"
        name="Right panel — full-screen sheet"
        source="components/RightPanel/RightPanelSheetOverlay.tsx"
        specs={[
          ['radius',      '0 (full screen)'],
          ['header pad',  '14px 16px + safe area'],
          ['title',       '15px / 700'],
          ['close size',  '36 × 36 / radius 10'],
        ]}
        previewBg="var(--color-bg-hover)"
        preview={
          <div style={{ width: 320, height: 200, borderRadius: 10, background: 'var(--color-bg-surface)', display: 'flex', flexDirection: 'column', overflow: 'hidden', border: '1px solid var(--color-border-subtle)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px', borderBottom: '1px solid var(--color-border-subtle)' }}>
              <div style={{ fontSize: 15, fontWeight: 700 }}>Timeline</div>
              <button aria-label="Close" style={{ width: 36, height: 36, borderRadius: 10, border: 'none', background: 'var(--color-bg-hover)', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                <X size={18} />
              </button>
            </div>
            <div style={{ flex: 1, padding: 16, fontSize: 12, color: 'var(--color-text-secondary)' }}>
              Sheet body content here…
            </div>
          </div>
        }
      />

      <VariantRow
        rule="duplicate"
        name="Quinn supplier sheet (side slide)"
        source="components/Suppliers/QuinnSheet.tsx"
        note="Backdrop is a different rgba (58,48,40,0.18) and the close button is 30×30 ghost, not 32×32 tinted."
        specs={[
          ['backdrop',  'rgba(0, 28, 53,0.18)'],
          ['z-index',   '800'],
          ['scroll pad','14px 16px'],
        ]}
        previewBg="rgba(0, 28, 53,0.18)"
        previewPadding="24px"
        preview={
          <div style={{ width: 280, height: 200, background: '#fff', borderRadius: 12, boxShadow: '0 24px 64px rgba(0, 28, 53,0.25)', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 14px' }}>
              <div style={{ fontSize: 13, fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                <Sparkles size={14} color="var(--color-accent-active)" /> Quinn
              </div>
              <button aria-label="Close" style={{ width: 30, height: 30, borderRadius: 8, border: 'none', background: 'transparent', color: 'var(--color-text-muted)', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                <X size={16} />
              </button>
            </div>
            <div style={{ flex: 1, padding: '14px 16px', fontSize: 12, color: 'var(--color-text-secondary)' }}>
              Tell me what to order for this supplier…
            </div>
          </div>
        }
      />

      <VariantRow
        rule="legacy"
        name="Quinn insight popover"
        source="components/Dashboard/parts/QuinnInsightButton.tsx"
        specs={[
          ['width',      '320'],
          ['padding',    '14px 16px'],
          ['radius',     '12px'],
          ['box-shadow', '0 12px 36px rgba(0, 28, 53,0.18)'],
        ]}
        previewBg="var(--color-bg-hover)"
        preview={
          <div style={{ width: 280, padding: '14px 16px', borderRadius: 12, background: '#fff', boxShadow: '0 12px 36px rgba(0, 28, 53,0.18)' }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--color-text-muted)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>Quinn says</div>
            <div style={{ fontSize: 13, marginTop: 6, lineHeight: 1.5 }}>
              Yesterday&apos;s revenue was up 8.2% — driven by drinks not food.
            </div>
          </div>
        }
      />

      <VariantRow
        rule="legacy"
        name="Dropdown menu — Phase switcher / filter menus"
        source="components/PhaseSwitcher.tsx · ViewFilterBar.tsx · DataTable.tsx"
        specs={[
          ['radius',     '8px'],
          ['padding',    '4px'],
          ['box-shadow', '0 4px 16px rgba(0, 28, 53,0.12), 0 0 0 1px rgba(0, 28, 53,0.04)'],
        ]}
        previewBg="var(--color-bg-hover)"
        preview={
          <div style={{ width: 200, padding: 4, borderRadius: 8, background: '#fff', boxShadow: '0 4px 16px rgba(0, 28, 53,0.12), 0 0 0 1px rgba(0, 28, 53,0.04)' }}>
            {['All', 'Morning', 'Afternoon', 'Evening'].map((l, i) => (
              <button key={l} style={{
                width: '100%', textAlign: 'left', padding: '8px 10px', borderRadius: 6,
                border: 'none', background: i === 0 ? 'var(--color-bg-hover)' : 'transparent',
                fontSize: 12, fontWeight: i === 0 ? 600 : 500, cursor: 'pointer', fontFamily: 'var(--font-primary)',
                color: 'var(--color-text-primary)',
              }}>
                {l}
              </button>
            ))}
          </div>
        }
      />
    </Section>
  );
}

/* ──────────────────────────────────────────────────────────────────────── */
/*  Section: Topbars / toolbars                                              */
/* ──────────────────────────────────────────────────────────────────────── */

function TopbarsSection() {
  return (
    <Section
      id="topbars"
      title="Topbars, toolbars & headers"
      intro={
        <>
          The Shell topbar (52px, 2px bottom border) and the Production header
          (52px, 1px bottom border) are nearly identical but disagree on the
          divider weight. Mobile topbar is on a navy background.
        </>
      }
    >
      <VariantRow
        rule="canonical"
        name="Shell topbar"
        source="components/ShellTopBar.tsx · Mvp1TopBar.tsx"
        specs={[
          ['min-height',    '52px'],
          ['padding',       '10px 16px 10px 12px'],
          ['border-bottom', '2px solid rgba(217,215,212,1)'],
          ['box-shadow',    '0 1px 0 rgba(0, 28, 53,0.08)'],
        ]}
        previewPadding="0"
        preview={
          <div style={{
            minHeight: 52, padding: '10px 16px 10px 12px',
            borderBottom: '2px solid rgba(217,215,212,1)',
            boxShadow: '0 1px 0 rgba(0, 28, 53,0.08)',
            background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%',
          }}>
            <div style={{ fontSize: 14, fontWeight: 700 }}>Soho</div>
            <div style={{ display: 'inline-flex', gap: 0, padding: 4, borderRadius: 100, background: 'var(--color-bg-hover)', border: '1px solid var(--color-border-subtle)' }}>
              <span style={{ padding: '8px 14px', borderRadius: 100, fontSize: 12, fontWeight: 600, background: '#fff' }}>Command</span>
              <span style={{ padding: '8px 14px', borderRadius: 100, fontSize: 12, fontWeight: 600, color: 'var(--color-text-secondary)' }}>Dashboard</span>
            </div>
          </div>
        }
      />

      <VariantRow
        rule="duplicate"
        name="Production page header"
        source="app/production/layout.tsx"
        note="Bottom border is 1px not 2px. Title is centred and small (13px)."
        specs={[
          ['min-height',    '52px'],
          ['padding',       '10px 16px 10px 12px'],
          ['border-bottom', '1px solid --color-border-subtle'],
        ]}
        previewPadding="0"
        preview={
          <div style={{
            minHeight: 52, padding: '10px 16px 10px 12px',
            borderBottom: '1px solid var(--color-border-subtle)',
            background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%',
          }}>
            <div style={{ fontSize: 13, fontWeight: 700, letterSpacing: '0.01em' }}>Production · Soho</div>
          </div>
        }
      />

      <VariantRow
        rule="duplicate"
        name="Mobile topbar — navy"
        source="components/MobileShell/MobileTopBar.tsx"
        specs={[
          ['height',     '52px'],
          ['background', '--color-bg-nav'],
          ['hamburger',  '44 × 44 / radius 10'],
        ]}
        previewPadding="0"
        preview={
          <div style={{
            height: 52, padding: '0 12px', background: 'var(--color-bg-nav)',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%',
          }}>
            <button aria-label="Menu" style={{ width: 44, height: 44, borderRadius: 10, background: 'transparent', border: 'none', color: '#fff', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
              <MoreHorizontal size={20} />
            </button>
            <div style={{ color: '#fff', fontSize: 14, fontWeight: 600 }}>Edify</div>
            <div style={{ width: 44 }} />
          </div>
        }
      />

      <VariantRow
        rule="legacy"
        name="DataTable toolbar"
        source="components/Mvp1/Tables/DataTable.tsx"
        specs={[
          ['padding',       '10px 12px'],
          ['border-bottom', '1px solid --color-border-subtle'],
          ['background',    '--color-bg-surface'],
        ]}
        previewPadding="0"
        preview={
          <div style={{
            padding: '10px 12px', borderBottom: '1px solid var(--color-border-subtle)',
            background: 'var(--color-bg-surface)', display: 'flex', alignItems: 'center', gap: 10, width: '100%',
          }}>
            <div style={{ position: 'relative', width: 200 }}>
              <Search size={13} color="var(--color-text-muted)" style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)' }} />
              <input placeholder="Search" style={{ width: '100%', padding: '7px 10px 7px 30px', borderRadius: 8, border: '1px solid var(--color-border-subtle)', fontSize: 12, outline: 'none', fontFamily: 'var(--font-primary)' }} />
            </div>
            <button style={{ padding: '6px 10px', borderRadius: 100, fontSize: 11, fontWeight: 600, border: '1px solid var(--color-border-subtle)', background: '#fff', cursor: 'pointer', fontFamily: 'var(--font-primary)' }}>Columns ▾</button>
            <button style={{ padding: '6px 10px', borderRadius: 100, fontSize: 11, fontWeight: 600, border: '1px solid var(--color-border-subtle)', background: '#fff', cursor: 'pointer', fontFamily: 'var(--font-primary)' }}>Filter ▾</button>
          </div>
        }
      />
    </Section>
  );
}

/* ──────────────────────────────────────────────────────────────────────── */
/*  Section: Sidebar nav items                                               */
/* ──────────────────────────────────────────────────────────────────────── */

function NavItemsSection() {
  return (
    <Section
      id="navitems"
      title="Sidebar nav items"
      intro={
        <>
          The sidebar lives on the navy nav background. Active items invert to
          white with navy text. Icon size differs between compact (19px) and
          regular (15px) modes.
        </>
      }
    >
      <VariantRow
        rule="canonical"
        name="Nav item — regular"
        source="components/Sidebar/NavItem.tsx"
        specs={[
          ['padding',      '7px 10px'],
          ['radius',       '--radius-item (9px)'],
          ['icon size',    '15px'],
          ['font-size',    '13px'],
          ['active bg',    '#fff'],
          ['active color', '--color-bg-nav'],
        ]}
        previewBg="var(--color-bg-nav)"
        previewPadding="12px 16px"
        preview={
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2, width: 200 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 10px', borderRadius: 9, background: '#fff', color: 'var(--color-bg-nav)', fontSize: 13, fontWeight: 600 }}>
              <span style={{ width: 15, height: 15, background: 'currentColor', opacity: 0.85, borderRadius: 3 }} />
              Production
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 10px', borderRadius: 9, background: 'transparent', color: '#fff', fontSize: 13, fontWeight: 400 }}>
              <span style={{ width: 15, height: 15, background: 'currentColor', opacity: 0.6, borderRadius: 3 }} />
              Stock
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 10px', borderRadius: 9, background: 'transparent', color: '#fff', fontSize: 13, fontWeight: 400 }}>
              <span style={{ width: 15, height: 15, background: 'currentColor', opacity: 0.6, borderRadius: 3 }} />
              Suppliers
              <span style={{ marginLeft: 'auto', minWidth: 18, height: 16, padding: '0 5px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: '#fff', color: 'var(--color-bg-nav)', borderRadius: 8, fontSize: 10, fontWeight: 700 }}>3</span>
            </div>
          </div>
        }
      />

      <VariantRow
        rule="legacy"
        name="Ask Edify nav CTA"
        source="components/Sidebar/QuinnButton.tsx"
        specs={[
          ['padding',    '11px 14px'],
          ['radius',     '--radius-card (10px)'],
          ['background', '--color-quinn-bg (#001C35)'],
          ['color',      '--color-quinn-label (#fff)'],
        ]}
        previewBg="var(--color-bg-nav)"
        previewPadding="12px 16px"
        preview={
          <button style={{
            width: 200, padding: '11px 14px', borderRadius: 10,
            background: 'var(--color-quinn-bg)', color: 'var(--color-quinn-label)',
            border: '1px solid rgba(255,255,255,0.12)', cursor: 'pointer',
            display: 'inline-flex', alignItems: 'center', gap: 10,
            fontFamily: 'var(--font-primary)', fontSize: 13, fontWeight: 600,
          }}>
            <Sparkles size={16} /> Ask Edify
          </button>
        }
      />
    </Section>
  );
}

/* ──────────────────────────────────────────────────────────────────────── */
/*  Section: Toasts / banners / progress                                     */
/* ──────────────────────────────────────────────────────────────────────── */

function ToastsSection() {
  return (
    <Section
      id="toasts"
      title="Toasts, undo banners & inline notifications"
      intro={
        <>
          The bulk-edit undo toast is the only explicitly designed notification
          we ship; every other &ldquo;notification&rdquo; is a filled callout
          inside the page itself (covered in the Cards section).
        </>
      }
    >
      <VariantRow
        rule="canonical"
        name="Undo toast — bulk recipe edits"
        source="app/(menu)/recipes/page.tsx → UndoToastView"
        specs={[
          ['radius',     '100px'],
          ['background', '--color-accent-deep (#001C35)'],
          ['color',      '#fff'],
          ['padding',    '10px 14px'],
          ['box-shadow', '0 10px 30px rgba(3,15,58,0.25)'],
        ]}
        previewBg="var(--color-bg-hover)"
        preview={
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 12,
            padding: '10px 14px', borderRadius: 100,
            background: 'var(--color-accent-deep)', color: '#fff',
            boxShadow: '0 10px 30px rgba(3,15,58,0.25)',
            fontFamily: 'var(--font-primary)', fontSize: 12.5, fontWeight: 600,
          }}>
            12 recipes updated
            <button style={{
              padding: '5px 12px', borderRadius: 100,
              border: '1px solid rgba(255,255,255,0.3)', background: 'transparent',
              color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer',
              fontFamily: 'var(--font-primary)',
            }}>Undo</button>
          </div>
        }
      />

      <VariantRow
        rule="legacy"
        name="Inline banner — production warning"
        source="components/Production/QuinnProductionPanel.tsx"
        note="Same shape family as the callouts in the Cards section, but acts as a full-width strip across the page."
        specs={[
          ['background', '--color-warning-light'],
          ['border',     '1px solid --color-warning-border'],
          ['padding',    '10px 14px'],
          ['radius',     '10px'],
        ]}
        previewBg="var(--color-bg-hover)"
        preview={
          <div style={{
            display: 'flex', alignItems: 'center', gap: 10, width: 360,
            padding: '10px 14px', borderRadius: 10,
            background: 'var(--color-warning-light)',
            border: '1px solid var(--color-warning-border)',
            fontSize: 12.5, color: 'var(--color-text-primary)',
          }}>
            <AlertTriangle size={16} color="var(--color-warning)" style={{ flexShrink: 0 }} />
            Dispatch closes in 12 minutes. 3 batches still unreviewed.
          </div>
        }
      />

      <VariantRow
        rule="legacy"
        name="MoV progress bar"
        source="app/assisted-ordering/components/MovProgressBar.tsx"
        specs={[
          ['track height', '6px'],
          ['radius',       '999px'],
          ['fill colour',  '#166534 / #EA580C / #B01038'],
        ]}
        preview={
          <div style={{ width: 280, display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--color-text-secondary)' }}>
              <span>£148 / £200 MoV</span>
              <span>74%</span>
            </div>
            <div style={{ width: '100%', height: 6, borderRadius: 999, background: 'rgba(234,88,12,0.18)' }}>
              <div style={{ width: '74%', height: '100%', borderRadius: 999, background: '#EA580C' }} />
            </div>
          </div>
        }
      />
    </Section>
  );
}

/* ──────────────────────────────────────────────────────────────────────── */
/*  Section: Progress                                                        */
/* ──────────────────────────────────────────────────────────────────────── */

function ProgressSection() {
  return (
    <Section
      id="progress"
      title="Progress, meters & sparklines"
      intro={
        <>
          One bespoke progress component lives in assisted ordering (shown
          above). Otherwise we delegate to recharts inside
          <code> AnalyticsCharts.tsx</code> for everything chart-shaped — no
          shared meter primitive yet.
        </>
      }
    >
      <VariantRow
        rule="legacy"
        name="(see MoV progress bar in Toasts section)"
        source="app/assisted-ordering/components/MovProgressBar.tsx"
        specs={[
          ['component count', '1 bespoke meter'],
          ['everything else', 'recharts in AnalyticsCharts.tsx'],
        ]}
        preview={
          <div style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>
            No shared meter primitive — only the one MoV bar above and per-chart
            configs inside <code>AnalyticsCharts.tsx</code>.
          </div>
        }
      />
    </Section>
  );
}

/* ──────────────────────────────────────────────────────────────────────── */
/*  Page                                                                     */
/* ──────────────────────────────────────────────────────────────────────── */

export default function ComponentsAuditPage() {
  return (
    <div
      style={{
        display: 'flex',
        minHeight: '100vh',
        background: 'var(--color-bg-surface)',
        fontFamily: 'var(--font-primary)',
        color: 'var(--color-text-primary)',
      }}
    >
      <StickyTOC />

      <main style={{ flex: 1, minWidth: 0, padding: '32px 32px 96px' }}>
        <header style={{ maxWidth: 920 }}>
          <div
            style={{
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              color: 'var(--color-text-muted)',
            }}
          >
            Internal · design audit
          </div>
          <h1
            style={{
              margin: '6px 0 0',
              fontSize: 32,
              fontWeight: 700,
              letterSpacing: '-0.01em',
            }}
          >
            Component variation audit
          </h1>
          <p
            style={{
              margin: '12px 0 0',
              fontSize: 14,
              lineHeight: 1.6,
              color: 'var(--color-text-secondary)',
              maxWidth: 760,
            }}
          >
            This page renders every visually-distinct version of a given
            primitive that lives in the codebase today. We have grown a
            sizeable amount of accidental drift — multiple primary buttons
            that differ by 1–2px, three near-duplicate <code>StatusPill</code>
            {' '}implementations, four overlay shapes, etc. The goal of this
            page is to make that drift visible so we can decide on a single
            spec for each row.
          </p>

          <div
            style={{
              marginTop: 20,
              padding: 16,
              borderRadius: 12,
              border: '1px solid var(--color-border-subtle)',
              background: 'var(--color-bg-hover)',
              display: 'grid',
              gridTemplateColumns: 'repeat(4, 1fr)',
              gap: 12,
            }}
          >
            {[
              { label: 'Button recipes',         value: '22' },
              { label: 'Pill / badge variants',  value: '12' },
              { label: 'Rule violations',        value: '4' },
              { label: 'Near-duplicates flagged',value: '18+' },
            ].map((s) => (
              <div key={s.label}>
                <div
                  style={{
                    fontSize: 10,
                    fontWeight: 700,
                    letterSpacing: '0.06em',
                    textTransform: 'uppercase',
                    color: 'var(--color-text-muted)',
                  }}
                >
                  {s.label}
                </div>
                <div
                  style={{
                    fontSize: 24,
                    fontWeight: 700,
                    marginTop: 4,
                    color: 'var(--color-text-primary)',
                  }}
                >
                  {s.value}
                </div>
              </div>
            ))}
          </div>

          <div
            style={{
              marginTop: 20,
              padding: 14,
              borderRadius: 10,
              background: 'var(--color-warning-light)',
              border: '1px solid var(--color-warning-border)',
              fontSize: 13,
              color: 'var(--color-text-primary)',
              display: 'flex',
              gap: 10,
              alignItems: 'flex-start',
              maxWidth: 760,
            }}
          >
            <AlertTriangle size={16} color="var(--color-warning)" style={{ flexShrink: 0, marginTop: 2 }} />
            <div>
              <strong>Active rule:</strong> Inline status pills MUST be outline
              only (white background, 1.5px coloured border). Solid semantic
              tints (<code>--color-success-light</code> etc.) are reserved for
              full-width banners and callout cards. The Suppliers, Stock,
              Item-matching and Sidebar pills below all break this rule today.
              See <code>.cursor/rules/status-pills.mdc</code>.
            </div>
          </div>
        </header>

        <ButtonsSection />
        <PillsSection />
        <TabsSection />
        <HeadingsSection />
        <CardsSection />
        <TablesSection />
        <InputsSection />
        <ModalsSection />
        <TopbarsSection />
        <NavItemsSection />
        <ToastsSection />
        <ProgressSection />
      </main>
    </div>
  );
}
