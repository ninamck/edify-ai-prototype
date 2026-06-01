/**
 * Tiny dependency-free CSV serialiser + browser download helpers.
 *
 * Serialisation follows the same rules as the parser in `./csv.ts`:
 * quote fields that contain commas, quotes, newlines, or leading/trailing
 * whitespace, and double-up embedded quotes.
 *
 * `triggerCsvDownload` runs entirely in the browser via Blob + ObjectURL +
 * a synthetic anchor click — no third-party dep needed.
 */

export type CsvCell = string | number | boolean | null | undefined;

export type CsvSection = {
  /** Display label used in download menus and inside the combined CSV. */
  label: string;
  /** Filename slug for individual exports (no extension, no path). */
  filenameSlug: string;
  /** Header row. */
  headers: string[];
  /** Body rows. Cell values are coerced to string via `formatCell`. */
  rows: CsvCell[][];
  /** Optional one-line note rendered as a comment row (combined CSV only). */
  note?: string;
};

const NEEDS_QUOTING = /[",\r\n]|^\s|\s$/;

export function escapeCsvCell(value: CsvCell): string {
  if (value === null || value === undefined) return '';
  const s = typeof value === 'number' && !Number.isFinite(value) ? '' : String(value);
  if (s === '') return '';
  if (!NEEDS_QUOTING.test(s)) return s;
  return `"${s.replace(/"/g, '""')}"`;
}

export function rowsToCsv(headers: string[], rows: CsvCell[][]): string {
  const lines: string[] = [];
  lines.push(headers.map(escapeCsvCell).join(','));
  for (const r of rows) {
    lines.push(r.map(escapeCsvCell).join(','));
  }
  return lines.join('\r\n');
}

export function sectionToCsv(section: CsvSection): string {
  return rowsToCsv(section.headers, section.rows);
}

/**
 * Combine multiple sections into a single CSV body. Each section is preceded
 * by a `# Section: <label>` comment row and an optional note row, with a
 * blank line between sections so Excel / Sheets visually separates them.
 */
export function combineSectionsToCsv(sections: CsvSection[]): string {
  const blocks: string[] = [];
  for (const s of sections) {
    const block: string[] = [];
    block.push(escapeCsvCell(`# Section: ${s.label}`));
    if (s.note) block.push(escapeCsvCell(`# ${s.note}`));
    block.push(rowsToCsv(s.headers, s.rows));
    blocks.push(block.join('\r\n'));
  }
  return blocks.join('\r\n\r\n');
}

/**
 * Trigger a browser download for the given CSV text. Adds a UTF-8 BOM so
 * Excel renders £/€/é correctly when opening the file directly.
 */
export function triggerCsvDownload(filename: string, csv: string): void {
  if (typeof window === 'undefined') return;
  const blob = new Blob(['\ufeff', csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename.endsWith('.csv') ? filename : `${filename}.csv`;
  // Some browsers (Firefox) need the anchor in the DOM before click().
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Defer revoke so the download has time to start in Safari.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** ISO date stamp suitable for filenames (e.g. 2026-05-27). */
export function todayStamp(): string {
  return new Date().toISOString().slice(0, 10);
}
