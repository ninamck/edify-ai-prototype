import type { CSSProperties, ReactNode } from 'react';
import { MOCK_POS } from '@/components/Receiving/mockData';
import {
  PO_DOCUMENTS,
  SAMPLE_DOCUMENTS,
  docTotal,
  isPoDocument,
  linesOnPage,
  type DocLine,
  type SampleDocument,
  type SampleId,
} from '@/components/Receiving/photo/fixtures';

// Draws a sample document as if photographed on a steel bench. This only
// exists to generate public/photo-samples/*.jpg (scripts/photo-samples.mjs);
// the flow itself shows those images, never this.

export const FRAME = { width: 900, height: 1200 };

const MONO = '"Courier New", Courier, monospace';
const HAND = '"Bradley Hand", "Segoe Print", "Marker Felt", cursive';

function orderedQty(doc: SampleDocument, line: DocLine): number | null {
  if (!isPoDocument(doc.id)) return null;
  const plan = PO_DOCUMENTS[doc.id].plans.find(p => p.lineId === line.id);
  if (!plan || !('poLineId' in plan) || plan.kind === 'substitute') return null;
  for (const po of MOCK_POS) {
    const l = po.lines.find(x => x.id === plan.poLineId);
    if (l) return l.expectedQty;
  }
  return null;
}

function Bench({ children, blur = false }: { children: ReactNode; blur?: boolean }) {
  return (
    <div
      data-photo
      style={{
        position: 'relative',
        width: FRAME.width,
        height: FRAME.height,
        overflow: 'hidden',
        background:
          'repeating-linear-gradient(90deg, rgba(255,255,255,0.05) 0 1px, rgba(0,0,0,0.04) 1px 3px), linear-gradient(160deg, #7d848b 0%, #b8bdc2 38%, #8e959b 70%, #a9aeb3 100%)',
      }}
    >
      <div style={{ position: 'absolute', inset: 0, filter: blur ? 'blur(3.2px)' : 'blur(0.35px) contrast(1.04)' }}>{children}</div>
      <div
        aria-hidden
        style={{
          position: 'absolute',
          inset: 0,
          pointerEvents: 'none',
          background: blur
            ? 'radial-gradient(ellipse at 58% 34%, rgba(255,255,255,0.85) 0%, rgba(255,255,255,0.35) 26%, transparent 55%), radial-gradient(ellipse at center, transparent 55%, rgba(0,0,0,0.3) 100%)'
            : 'radial-gradient(ellipse at 28% 18%, rgba(255,255,255,0.22) 0%, transparent 55%), radial-gradient(ellipse at center, transparent 60%, rgba(0,0,0,0.28) 100%)',
        }}
      />
    </div>
  );
}

function Paper({ style, children }: { style: CSSProperties; children: ReactNode }) {
  return (
    <div
      style={{
        position: 'absolute',
        background: '#fbfaf6',
        color: '#1d1d1f',
        boxShadow: '0 22px 44px rgba(0,0,0,0.38), 0 2px 6px rgba(0,0,0,0.25)',
        ...style,
      }}
    >
      {children}
    </div>
  );
}

function DeliveryNote({ doc, page }: { doc: SampleDocument; page: number }) {
  const lines = linesOnPage(doc, page);
  const last = page === doc.pages;
  const cell: CSSProperties = { padding: '3px 6px', fontSize: 15, textAlign: 'right', whiteSpace: 'nowrap' };
  return (
    <Paper style={{ left: 70, top: 46, width: 760, height: 1100, transform: 'rotate(-1.4deg)', padding: '34px 36px', fontFamily: MONO }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <div style={{ fontFamily: 'Helvetica, Arial, sans-serif', fontWeight: 900, fontSize: 28, letterSpacing: '0.06em', color: '#2f6b2f' }}>{doc.header.title}</div>
          {doc.header.lines.map(l => (
            <div key={l} style={{ fontSize: 13, marginTop: 2 }}>{l}</div>
          ))}
        </div>
        <div style={{ textAlign: 'right', fontSize: 14 }}>
          <div style={{ fontWeight: 700, fontSize: 18 }}>DELIVERY NOTE</div>
          <div>{doc.docNumber}</div>
          <div>{doc.printedDate}</div>
          <div>Page {page} of {doc.pages}</div>
        </div>
      </div>
      <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: 22 }}>
        <thead>
          <tr style={{ borderBottom: '2px solid #1d1d1f' }}>
            <th style={{ ...cell, textAlign: 'left' }}>Code</th>
            <th style={{ ...cell, textAlign: 'left' }}>Description</th>
            <th style={cell}>Ordered</th>
            <th style={cell}>Supplied</th>
          </tr>
        </thead>
        <tbody>
          {lines.map(l => {
            const ordered = orderedQty(doc, l);
            const short = ordered != null && l.qty < ordered;
            return (
              <tr key={l.id} data-line-id={l.id} style={{ borderBottom: '1px dotted #9a9a9a' }}>
                <td style={{ ...cell, textAlign: 'left' }}>{l.code}</td>
                <td style={{ ...cell, textAlign: 'left' }}>{l.text}</td>
                <td style={cell}>{ordered ?? ''}</td>
                <td style={cell}>
                  {l.qty}
                  {short && <span style={{ marginLeft: 6, fontWeight: 700 }}>SHORT</span>}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {last && (
        <div style={{ marginTop: 26, fontSize: 13 }}>
          <div style={{ fontWeight: 700 }}>{doc.lines.length} lines</div>
          <div style={{ marginTop: 18, display: 'flex', alignItems: 'flex-end', gap: 12 }}>
            <span>{doc.footer[0]}</span>
            <span style={{ fontFamily: HAND, fontSize: 30, color: '#1c3a8a', transform: 'rotate(-4deg)', display: 'inline-block' }}>Priya S</span>
          </div>
          <div style={{ marginTop: 12 }}>{doc.footer[1]}</div>
        </div>
      )}
    </Paper>
  );
}

function Invoice({ doc, page }: { doc: SampleDocument; page: number }) {
  const lines = linesOnPage(doc, page);
  const cell: CSSProperties = { padding: '5px 6px', fontSize: 16, textAlign: 'right' };
  return (
    <Paper style={{ left: 80, top: 60, width: 740, height: 1060, transform: 'rotate(1.1deg)', padding: '40px 40px', fontFamily: 'Helvetica, Arial, sans-serif' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
        <div>
          <div style={{ fontWeight: 900, fontSize: 30, color: '#2f6b2f', letterSpacing: '0.04em' }}>{doc.header.title}</div>
          {doc.header.lines.map(l => (
            <div key={l} style={{ fontSize: 13, maxWidth: 380, marginTop: 2 }}>{l}</div>
          ))}
        </div>
        <div style={{ textAlign: 'right', fontSize: 15 }}>
          <div style={{ fontWeight: 700, fontSize: 22 }}>INVOICE</div>
          <div>{doc.docNumber}</div>
          <div>{doc.printedDate}</div>
          <div>Page {page} of {doc.pages}</div>
        </div>
      </div>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ borderBottom: '2px solid #1d1d1f' }}>
            <th style={{ ...cell, textAlign: 'left' }}>Description</th>
            <th style={cell}>Qty</th>
            <th style={cell}>Price</th>
            <th style={cell}>Total</th>
          </tr>
        </thead>
        <tbody>
          {lines.map(l => (
            <tr key={l.id} data-line-id={l.id} style={{ borderBottom: '1px solid #e2e2e2' }}>
              <td style={{ ...cell, textAlign: 'left' }}>{l.text}</td>
              <td style={cell}>{l.qty}</td>
              <td style={cell}>{l.unitPrice.toFixed(2)}</td>
              <td style={cell}>{(l.qty * l.unitPrice).toFixed(2)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {page === doc.pages && (
        <div style={{ marginTop: 22, textAlign: 'right', fontSize: 17 }}>
          <div>Net £{docTotal(doc).toFixed(2)}</div>
          <div>VAT £0.00</div>
          <div style={{ fontWeight: 700 }}>Total £{docTotal(doc).toFixed(2)}</div>
          <div style={{ fontSize: 12, marginTop: 20, textAlign: 'left' }}>{doc.footer.join(' ')}</div>
        </div>
      )}
    </Paper>
  );
}

function Receipt({ doc }: { doc: SampleDocument }) {
  return (
    <Paper
      style={{
        left: 250,
        top: 120,
        width: 400,
        transform: 'rotate(-2.2deg)',
        padding: '34px 26px 40px',
        fontFamily: MONO,
        fontSize: 17,
        lineHeight: 1.55,
        background: 'linear-gradient(90deg, #f1f0ec 0%, #fbfaf7 18%, #fbfaf7 82%, #eeede8 100%)',
      }}
    >
      <div style={{ textAlign: 'center', fontFamily: 'Helvetica, Arial, sans-serif', fontWeight: 800, fontSize: 32, color: '#e35205' }}>{doc.header.title}</div>
      {doc.header.lines.map(l => (
        <div key={l} style={{ textAlign: 'center', fontSize: 14 }}>{l}</div>
      ))}
      <div style={{ borderTop: '2px dashed #77716b', margin: '14px 0' }} />
      {doc.lines.map(l => (
        <div key={l.id} data-line-id={l.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
          <span>{l.qty > 1 ? `${l.qty} x ` : ''}{l.text}</span>
          <span>{(l.qty * l.unitPrice).toFixed(2)}</span>
        </div>
      ))}
      <div style={{ borderTop: '2px dashed #77716b', margin: '14px 0' }} />
      <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, fontSize: 21 }}>
        <span>TOTAL</span>
        <span>£{docTotal(doc).toFixed(2)}</span>
      </div>
      <div style={{ marginTop: 14, fontSize: 14 }}>
        {doc.footer.map(f => (
          <div key={f}>{f}</div>
        ))}
        <div style={{ marginTop: 8 }}>{doc.printedDate}</div>
      </div>
    </Paper>
  );
}

function Menu({ doc }: { doc: SampleDocument }) {
  return (
    <Paper style={{ left: 150, top: 110, width: 600, height: 920, transform: 'rotate(1.8deg)', padding: '60px 56px', fontFamily: 'Georgia, "Times New Roman", serif', textAlign: 'center' }}>
      <div style={{ fontSize: 40, fontWeight: 700 }}>{doc.header.title}</div>
      <div style={{ fontSize: 20, fontStyle: 'italic', marginBottom: 40 }}>{doc.header.lines[0]}</div>
      {doc.lines.map(l => (
        <div key={l.id} data-line-id={l.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 22, padding: '12px 0', borderBottom: '1px dotted #b9b2aa' }}>
          <span>{l.text}</span>
          <span>{l.unitPrice.toFixed(2)}</span>
        </div>
      ))}
      <div style={{ fontSize: 15, fontStyle: 'italic', marginTop: 40 }}>{doc.footer[0]}</div>
    </Paper>
  );
}

export default function SamplePaper({ sampleId, page }: { sampleId: SampleId; page: number }) {
  if (sampleId === 'blurry') {
    return (
      <Bench blur>
        <DeliveryNote doc={SAMPLE_DOCUMENTS['fd-note']} page={1} />
      </Bench>
    );
  }
  const doc = SAMPLE_DOCUMENTS[sampleId];
  return (
    <Bench>
      {doc.kind === 'delivery-note' && <DeliveryNote doc={doc} page={page} />}
      {doc.kind === 'invoice' && <Invoice doc={doc} page={page} />}
      {doc.kind === 'receipt' && <Receipt doc={doc} />}
      {doc.kind === 'menu' && <Menu doc={doc} />}
    </Bench>
  );
}
