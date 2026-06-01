'use client';

/**
 * Pill-style "Download" button that opens a dropdown of CSV export options.
 *
 * The menu has three flavours of action:
 *   1. "All combined (1 CSV)" — every section concatenated into one file,
 *      with `# Section: <label>` header rows between blocks.
 *   2. "All split (one CSV per chart)" — triggers a sequential download of
 *      every section as its own CSV. Browsers will usually prompt the user
 *      once for the first download and then auto-accept the rest.
 *   3. Per-section items — one click, one CSV.
 *
 * The component is purely presentational: callers pass in the list of
 * `CsvSection`s and a filename prefix; everything else (Blob creation,
 * download triggering) happens here.
 */

import { useEffect, useRef, useState } from 'react';
import { ChevronDown, Download, FileDown, Files, Layers } from 'lucide-react';
import {
  combineSectionsToCsv,
  sectionToCsv,
  todayStamp,
  triggerCsvDownload,
  type CsvSection,
} from '@/lib/csvExport';

type Props = {
  /** Sections offered in the menu. Order is preserved. */
  sections: CsvSection[];
  /** Filename prefix, e.g. "culinary-collective-flash". */
  filenamePrefix: string;
  /** Label for the trigger button. */
  buttonLabel?: string;
  /** Header shown above the per-section list (e.g. "Flash sections"). */
  perSectionHeader?: string;
};

export default function DownloadMenu({
  sections,
  filenamePrefix,
  buttonLabel = 'Download',
  perSectionHeader = 'Individual sections',
}: Props) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      const t = e.target as Node;
      if (triggerRef.current?.contains(t) || menuRef.current?.contains(t)) return;
      setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', onDown);
    window.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      window.removeEventListener('keydown', onKey);
    };
  }, [open]);

  function handleDownloadCombined() {
    const csv = combineSectionsToCsv(sections);
    triggerCsvDownload(`${filenamePrefix}-all-${todayStamp()}.csv`, csv);
    setOpen(false);
  }

  function handleDownloadSplit() {
    // Trigger downloads sequentially with a tiny stagger so browsers don't
    // collapse them into a single prompt. Most browsers will treat the
    // first as user-initiated and auto-allow the rest in the same gesture.
    sections.forEach((section, i) => {
      window.setTimeout(() => {
        triggerCsvDownload(
          `${filenamePrefix}-${section.filenameSlug}-${todayStamp()}.csv`,
          sectionToCsv(section),
        );
      }, i * 120);
    });
    setOpen(false);
  }

  function handleDownloadOne(section: CsvSection) {
    triggerCsvDownload(
      `${filenamePrefix}-${section.filenameSlug}-${todayStamp()}.csv`,
      sectionToCsv(section),
    );
    setOpen(false);
  }

  return (
    <div style={{ position: 'relative', display: 'inline-flex' }}>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        style={triggerStyle}
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <Download size={12} strokeWidth={2.2} color="var(--color-text-muted)" />
        <span>{buttonLabel}</span>
        <ChevronDown size={12} strokeWidth={2.2} color="var(--color-text-muted)" />
      </button>

      {open && (
        <div
          ref={menuRef}
          role="menu"
          style={{
            position: 'absolute',
            top: 'calc(100% + 6px)',
            right: 0,
            zIndex: 300,
            minWidth: 280,
            maxHeight: 460,
            overflowY: 'auto',
            background: '#fff',
            border: '1px solid var(--color-border-subtle)',
            borderRadius: 8,
            boxShadow:
              '0 4px 16px rgba(0, 28, 53,0.12), 0 0 0 1px rgba(0, 28, 53,0.04)',
            padding: 4,
            display: 'flex',
            flexDirection: 'column',
            gap: 1,
            fontFamily: 'var(--font-primary)',
          }}
        >
          <div style={menuHeaderStyle}>Combined</div>
          <MenuRow
            icon={<Layers size={12} strokeWidth={2.2} />}
            label="All in one CSV"
            sublabel={`${sections.length} sections, single file`}
            onClick={handleDownloadCombined}
          />
          <MenuRow
            icon={<Files size={12} strokeWidth={2.2} />}
            label="All split by section"
            sublabel={`${sections.length} files, one per chart`}
            onClick={handleDownloadSplit}
          />

          <div style={separatorStyle} />

          <div style={menuHeaderStyle}>{perSectionHeader}</div>
          {sections.map((s) => (
            <MenuRow
              key={s.filenameSlug}
              icon={<FileDown size={12} strokeWidth={2.2} />}
              label={s.label}
              sublabel={s.note}
              onClick={() => handleDownloadOne(s)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function MenuRow({
  icon,
  label,
  sublabel,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  sublabel?: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      style={{
        all: 'unset',
        display: 'flex',
        alignItems: 'flex-start',
        gap: 8,
        padding: '7px 10px',
        borderRadius: 6,
        cursor: 'pointer',
        fontFamily: 'var(--font-primary)',
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLButtonElement).style.background = 'var(--color-bg-hover)';
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLButtonElement).style.background = 'transparent';
      }}
    >
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: 16,
          height: 16,
          marginTop: 2,
          color: 'var(--color-text-muted)',
          flexShrink: 0,
        }}
      >
        {icon}
      </span>
      <span style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
        <span
          style={{
            fontSize: 12,
            fontWeight: 600,
            color: 'var(--color-text-primary)',
            lineHeight: 1.25,
          }}
        >
          {label}
        </span>
        {sublabel && (
          <span
            style={{
              fontSize: 11,
              color: 'var(--color-text-muted)',
              lineHeight: 1.3,
            }}
          >
            {sublabel}
          </span>
        )}
      </span>
    </button>
  );
}

const triggerStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
  padding: '6px 10px',
  borderRadius: 100,
  border: '1px solid var(--color-border-subtle)',
  background: '#fff',
  cursor: 'pointer',
  fontFamily: 'var(--font-primary)',
  fontSize: 11,
  fontWeight: 600,
  color: 'var(--color-text-secondary)',
  whiteSpace: 'nowrap',
};

const menuHeaderStyle: React.CSSProperties = {
  fontSize: 10,
  fontWeight: 700,
  letterSpacing: '0.06em',
  textTransform: 'uppercase',
  color: 'var(--color-text-muted)',
  padding: '6px 10px 4px',
};

const separatorStyle: React.CSSProperties = {
  height: 1,
  background: 'var(--color-border-subtle)',
  margin: '4px 4px',
};
