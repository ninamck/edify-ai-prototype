import type { CSSProperties, ReactNode } from 'react';
import { linesOnPage, paperTotal, SAMPLES, type Sample, type SampleId, type SeedLine } from './samples';

// Draws a sample document as if photographed on a steel bench. Only used to
// generate public/delivery-samples/*.jpg (scripts/delivery-samples.mjs); the
// flow itself shows those images, never this.

export const FRAME = { width: 900, height: 1200 };

const MONO = '"Courier New", Courier, monospace';
const SANS = 'Helvetica, Arial, sans-serif';
const HAND = '"Bradley Hand", "Segoe Print", "Marker Felt", cursive';

function money(n: number) {
  return n.toFixed(2);
}

function printedCode(l: SeedLine) {
  return l.issue?.kind === 'substitute' ? l.issue.sentCode : l.code;
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
      <div style={{ position: 'absolute', inset: 0, filter: blur ? 'blur(3.4px)' : 'blur(0.35px) contrast(1.04)' }}>{children}</div>
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

function Sheet({ style, children }: { style: CSSProperties; children: ReactNode }) {
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

function Letterhead({ s, title, page }: { s: Sample; title: string; page: number }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 20 }}>
      <div>
        <div style={{ fontFamily: SANS, fontWeight: 900, fontSize: 28, letterSpacing: '0.05em', color: s.paper.colour }}>{s.paper.brand}</div>
        {s.paper.address.map(l => (
          <div key={l} style={{ fontSize: 13, marginTop: 2 }}>{l}</div>
        ))}
      </div>
      <div style={{ textAlign: 'right', fontSize: 14, whiteSpace: 'nowrap' }}>
        <div style={{ fontWeight: 700, fontSize: 19 }}>{title}</div>
        <div>{s.docNumber}</div>
        <div>{s.printedDate}</div>
        <div>Page {page} of {s.pages}</div>
      </div>
    </div>
  );
}

function DeliveryNote({ s, page }: { s: Sample; page: number }) {
  const cell: CSSProperties = { padding: '4px 6px', fontSize: 15, textAlign: 'right', whiteSpace: 'nowrap' };
  return (
    <Sheet style={{ left: 70, top: 46, width: 760, height: 1100, transform: 'rotate(-1.3deg)', padding: '34px 36px', fontFamily: MONO }}>
      <Letterhead s={s} title="DELIVERY NOTE" page={page} />
      <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: 24 }}>
        <thead>
          <tr style={{ borderBottom: '2px solid #1d1d1f' }}>
            <th style={{ ...cell, textAlign: 'left' }}>Code</th>
            <th style={{ ...cell, textAlign: 'left' }}>Description</th>
            <th style={cell}>Ordered</th>
            <th style={cell}>Supplied</th>
          </tr>
        </thead>
        <tbody>
          {linesOnPage(s, page).map(l => (
            <tr key={l.id} data-line-id={l.id} style={{ borderBottom: '1px dotted #9a9a9a' }}>
              <td style={{ ...cell, textAlign: 'left' }}>{printedCode(l)}</td>
              <td style={{ ...cell, textAlign: 'left' }}>{l.printed}</td>
              <td style={cell}>{l.ordered ?? ''}</td>
              <td style={cell}>
                {l.got}
                {l.mark && <span style={{ marginLeft: 6, fontWeight: 700 }}>{l.mark}</span>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {page === s.pages && (
        <div style={{ marginTop: 28, fontSize: 13 }}>
          <div style={{ fontWeight: 700 }}>{s.lines.length} lines</div>
          <div style={{ marginTop: 18, display: 'flex', alignItems: 'flex-end', gap: 12 }}>
            <span>{s.paper.footer[0]}</span>
            <span style={{ fontFamily: HAND, fontSize: 30, color: '#1c3a8a', transform: 'rotate(-4deg)', display: 'inline-block' }}>Priya S</span>
          </div>
          <div style={{ marginTop: 12 }}>{s.paper.footer[1]}</div>
        </div>
      )}
    </Sheet>
  );
}

function Invoice({ s, page }: { s: Sample; page: number }) {
  const cell: CSSProperties = { padding: '5px 6px', fontSize: 15, textAlign: 'right', whiteSpace: 'nowrap' };
  const net = s.lines.reduce((sum, l) => sum + (l.price ?? 0) * (l.billed ?? l.got), 0);
  const total = paperTotal(s);
  return (
    <Sheet style={{ left: 74, top: 56, width: 752, height: 1080, transform: 'rotate(1deg)', padding: '38px 38px', fontFamily: SANS }}>
      <Letterhead s={s} title="INVOICE" page={page} />
      <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: 26 }}>
        <thead>
          <tr style={{ borderBottom: '2px solid #1d1d1f' }}>
            <th style={{ ...cell, textAlign: 'left' }}>Code</th>
            <th style={{ ...cell, textAlign: 'left' }}>Description</th>
            <th style={cell}>Qty</th>
            <th style={cell}>Price</th>
            <th style={cell}>VAT</th>
            <th style={cell}>Total</th>
          </tr>
        </thead>
        <tbody>
          {linesOnPage(s, page).map(l => (
            <tr key={l.id} data-line-id={l.id} style={{ borderBottom: '1px solid #e2e2e2' }}>
              <td style={{ ...cell, textAlign: 'left', fontSize: 13 }}>{printedCode(l)}</td>
              <td style={{ ...cell, textAlign: 'left' }}>{l.printed}</td>
              <td style={cell}>
                {l.billed != null && l.billed !== l.got ? (
                  <>
                    <span style={{ textDecoration: 'line-through', textDecorationThickness: 2, textDecorationColor: '#1c3a8a' }}>{l.billed}</span>
                    <span style={{ fontFamily: HAND, fontSize: 24, color: '#1c3a8a', marginLeft: 6, display: 'inline-block', transform: 'rotate(-6deg)' }}>{l.got}</span>
                  </>
                ) : (
                  l.got
                )}
              </td>
              <td style={cell}>{money(l.price ?? 0)}</td>
              <td style={cell}>{l.vatRate ? `${l.vatRate}%` : 'Z'}</td>
              <td style={cell}>{money((l.price ?? 0) * (l.billed ?? l.got))}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {page === s.pages && (
        <div style={{ marginTop: 22, textAlign: 'right', fontSize: 16, lineHeight: 1.6 }}>
          <div>Net £{money(net)}</div>
          <div>VAT £{money(total - net)}</div>
          <div style={{ fontWeight: 700, fontSize: 19 }}>Total £{money(total)}</div>
          <div style={{ fontSize: 12, marginTop: 22, textAlign: 'left' }}>{s.paper.footer.join(' ')}</div>
        </div>
      )}
    </Sheet>
  );
}

function Receipt({ s }: { s: Sample }) {
  return (
    <Sheet
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
      <div style={{ textAlign: 'center', fontFamily: SANS, fontWeight: 800, fontSize: 32, color: s.paper.colour }}>{s.paper.brand}</div>
      {s.paper.address.map(l => (
        <div key={l} style={{ textAlign: 'center', fontSize: 14 }}>{l}</div>
      ))}
      <div style={{ borderTop: '2px dashed #77716b', margin: '14px 0' }} />
      {s.lines.map(l => (
        <div key={l.id} data-line-id={l.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
          <span>{l.got > 1 ? `${l.got} x ` : ''}{l.printed}</span>
          <span>{money((l.price ?? 0) * l.got)}</span>
        </div>
      ))}
      <div style={{ borderTop: '2px dashed #77716b', margin: '14px 0' }} />
      <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, fontSize: 21 }}>
        <span>TOTAL</span>
        <span>£{money(paperTotal(s))}</span>
      </div>
      <div style={{ marginTop: 14, fontSize: 14 }}>
        {s.paper.footer.map(f => (
          <div key={f}>{f}</div>
        ))}
        <div style={{ marginTop: 8 }}>{s.printedDate}</div>
      </div>
    </Sheet>
  );
}

function Menu({ s }: { s: Sample }) {
  return (
    <Sheet style={{ left: 150, top: 110, width: 600, height: 920, transform: 'rotate(1.8deg)', padding: '60px 56px', fontFamily: 'Georgia, "Times New Roman", serif', textAlign: 'center' }}>
      <div style={{ fontSize: 40, fontWeight: 700 }}>{s.paper.brand}</div>
      <div style={{ fontSize: 20, fontStyle: 'italic', marginBottom: 40 }}>{s.paper.address[0]}</div>
      {s.lines.map(l => (
        <div key={l.id} data-line-id={l.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 22, padding: '12px 0', borderBottom: '1px dotted #b9b2aa' }}>
          <span>{l.printed}</span>
          <span>{money(l.price ?? 0)}</span>
        </div>
      ))}
      <div style={{ fontSize: 15, fontStyle: 'italic', marginTop: 40 }}>{s.paper.footer[0]}</div>
    </Sheet>
  );
}

export default function Paper({ sampleId, page }: { sampleId: SampleId; page: number }) {
  const s = SAMPLES[sampleId];
  return (
    <Bench blur={s.blocked === 'unreadable'}>
      {s.kind === 'delivery-note' && <DeliveryNote s={s} page={page} />}
      {s.kind === 'invoice' && <Invoice s={s} page={page} />}
      {s.kind === 'receipt' && <Receipt s={s} />}
      {s.kind === 'menu' && <Menu s={s} />}
    </Bench>
  );
}
