'use client';

import type { CSSProperties } from 'react';
import { docTotal, type DocLine, type SampleDocument } from './fixtures';

const MONO = 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace';
const SERIF = 'Georgia, "Times New Roman", serif';

const INVOICE_PAGE_SPLIT = 7;

const HIGHLIGHT: CSSProperties = {
  background: 'rgba(250, 204, 21, 0.45)',
  boxShadow: '0 0 0 2px #CA8A04',
  borderRadius: 2,
};

function invoicePageLines(doc: SampleDocument, page: number): DocLine[] {
  return page === 1 ? doc.lines.slice(0, INVOICE_PAGE_SPLIT) : doc.lines.slice(INVOICE_PAGE_SPLIT);
}

export function pageOfLine(doc: SampleDocument, lineId: string): number {
  if (doc.kind !== 'invoice') return 1;
  return doc.lines.findIndex(l => l.id === lineId) < INVOICE_PAGE_SPLIT ? 1 : 2;
}

/**
 * The photographed paper, drawn so the demo works without a real camera.
 * `size="thumb"` scales it down for page strips and headers.
 */
export default function PaperDocument({
  doc, page = 1, highlightLineId, size = 'full',
}: {
  doc: SampleDocument;
  page?: number;
  highlightLineId?: string;
  size?: 'full' | 'thumb';
}) {
  const thumb = size === 'thumb';
  const frame: CSSProperties = {
    background: '#FFFEFA',
    boxShadow: thumb ? '0 1px 3px rgba(0,0,0,0.18)' : '0 2px 10px rgba(0,0,0,0.14)',
    color: '#1F1A17',
    transform: thumb ? undefined : 'rotate(-0.4deg)',
    overflow: 'hidden',
  };

  if (thumb) {
    return (
      <div aria-hidden style={{ width: 64, height: 84, ...frame, padding: 6, display: 'flex', flexDirection: 'column', gap: 3 }}>
        <div style={{ height: 6, width: '70%', background: '#3A332E', borderRadius: 1 }} />
        {Array.from({ length: 7 }).map((_, i) => (
          <div key={i} style={{ height: 3, width: `${60 + ((i * 17) % 35)}%`, background: '#B8AFA6', borderRadius: 1 }} />
        ))}
      </div>
    );
  }

  if (doc.kind === 'receipt') {
    return (
      <div role="img" aria-label={`Photo of a ${doc.header.title} receipt`} style={{ ...frame, width: 280, margin: '0 auto', padding: '20px 18px', fontFamily: MONO, fontSize: 12, lineHeight: 1.5 }}>
        <div style={{ textAlign: 'center', fontFamily: 'var(--font-primary)', fontWeight: 800, fontSize: 20, color: '#E35205', marginBottom: 4 }}>{doc.header.title}</div>
        {doc.header.lines.map(l => <div key={l} style={{ textAlign: 'center', fontSize: 11 }}>{l}</div>)}
        <div style={{ borderTop: '1px dashed #8C827A', margin: '10px 0' }} />
        {doc.lines.map(l => (
          <div key={l.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 8, padding: '1px 2px', ...(l.id === highlightLineId ? HIGHLIGHT : {}) }}>
            <span>{l.qty > 1 ? `${l.qty} x ` : ''}{l.text}</span>
            <span>{(l.qty * l.unitPrice).toFixed(2)}</span>
          </div>
        ))}
        <div style={{ borderTop: '1px dashed #8C827A', margin: '10px 0' }} />
        <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, fontSize: 14 }}>
          <span>TOTAL</span><span>£{docTotal(doc).toFixed(2)}</span>
        </div>
        <div style={{ marginTop: 10, fontSize: 11 }}>
          {doc.footer.map(f => <div key={f}>{f}</div>)}
          <div style={{ marginTop: 6 }}>{doc.printedDate}</div>
        </div>
      </div>
    );
  }

  if (doc.kind === 'menu') {
    return (
      <div role="img" aria-label="Photo of a menu" style={{ ...frame, width: 300, margin: '0 auto', padding: '28px 24px', fontFamily: SERIF, textAlign: 'center' }}>
        <div style={{ fontSize: 22, fontWeight: 700 }}>{doc.header.title}</div>
        <div style={{ fontSize: 13, fontStyle: 'italic', marginBottom: 16 }}>{doc.header.lines[0]}</div>
        {doc.lines.map(l => (
          <div key={l.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, padding: '4px 0', borderBottom: '1px dotted #C9C0B7' }}>
            <span>{l.text}</span><span>{l.unitPrice.toFixed(2)}</span>
          </div>
        ))}
        <div style={{ fontSize: 11, fontStyle: 'italic', marginTop: 16 }}>{doc.footer[0]}</div>
      </div>
    );
  }

  const lines = invoicePageLines(doc, page);
  const cell: CSSProperties = { padding: '3px 4px', fontSize: 11, textAlign: 'right' };
  return (
    <div role="img" aria-label={`Photo of page ${page} of a ${doc.header.title} invoice`} style={{ ...frame, width: '100%', maxWidth: 420, margin: '0 auto', padding: '20px 18px', fontFamily: 'Helvetica, Arial, sans-serif' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
        <div>
          <div style={{ fontWeight: 900, fontSize: 18, color: '#2F6B2F', letterSpacing: '0.04em' }}>{doc.header.title}</div>
          {doc.header.lines.map(l => <div key={l} style={{ fontSize: 10, maxWidth: 230 }}>{l}</div>)}
        </div>
        <div style={{ textAlign: 'right', fontSize: 11 }}>
          <div style={{ fontWeight: 700, fontSize: 13 }}>INVOICE</div>
          <div>{doc.docNumber}</div>
          <div>{doc.printedDate}</div>
          <div>Page {page} of {doc.pages}</div>
        </div>
      </div>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ borderBottom: '1px solid #3A332E' }}>
            <th style={{ ...cell, textAlign: 'left' }}>Description</th>
            <th style={cell}>Qty</th>
            <th style={cell}>Price</th>
            <th style={cell}>Total</th>
          </tr>
        </thead>
        <tbody>
          {lines.map(l => (
            <tr key={l.id} style={l.id === highlightLineId ? HIGHLIGHT : undefined}>
              <td style={{ ...cell, textAlign: 'left' }}>{l.text}</td>
              <td style={cell}>{l.qty}</td>
              <td style={cell}>{l.unitPrice.toFixed(2)}</td>
              <td style={cell}>{(l.qty * l.unitPrice).toFixed(2)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {page === doc.pages && (
        <div style={{ marginTop: 10, textAlign: 'right', fontSize: 12 }}>
          <div>Net £{docTotal(doc).toFixed(2)}</div>
          <div style={{ fontSize: 10, marginTop: 8, textAlign: 'left' }}>{doc.footer.join(' ')}</div>
        </div>
      )}
    </div>
  );
}
