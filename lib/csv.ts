/**
 * Minimal CSV parser that honours quoted fields with embedded commas, CRLF
 * line endings, and doubled-quote escapes ("" -> "). Returns rows as
 * dictionaries keyed by the header row.
 *
 * This is intentionally tiny and dependency-free; it is not a full RFC 4180
 * implementation but covers the prototype's flash_report.csv shape.
 */
export function parseCsv(text: string): Record<string, string>[] {
  const rows = parseCsvRaw(text);
  if (rows.length === 0) return [];
  const [header, ...body] = rows;
  return body
    .filter((cells) => cells.length > 1 || (cells.length === 1 && cells[0] !== ''))
    .map((cells) => {
      const row: Record<string, string> = {};
      for (let i = 0; i < header.length; i++) {
        row[header[i]] = cells[i] ?? '';
      }
      return row;
    });
}

function parseCsvRaw(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
      continue;
    }
    if (ch === '"') {
      inQuotes = true;
      continue;
    }
    if (ch === ',') {
      row.push(field);
      field = '';
      continue;
    }
    if (ch === '\n' || ch === '\r') {
      row.push(field);
      field = '';
      rows.push(row);
      row = [];
      if (ch === '\r' && text[i + 1] === '\n') i++;
      continue;
    }
    field += ch;
  }

  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  return rows;
}
