'use client';

import * as ui from '../supportCentreUi';
import { money, type Collection } from '../cashFixtures';

/** The slip in a table: a thumbnail for new deposits, a marker for older ones. */
export function SlipCell({ c }: { c: Collection }) {
  if (c.slip) {
    return (
      <a href={c.slip} target="_blank" rel="noreferrer" aria-label={`Open paying-in slip ${c.reference ?? ''}`}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={c.slip} alt="" style={{ width: 56, borderRadius: 4, border: '1px solid var(--color-border-subtle)', display: 'block' }} />
      </a>
    );
  }
  if (c.slipOnFile) return <span style={ui.muted}>On file</span>;
  return <span style={ui.pill('warn')}>No slip</span>;
}

const THUMB_WIDTH = 360;

/** Shrinks a photo to a thumbnail so it fits in the demo's local storage. */
async function thumbnail(file: File): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, THUMB_WIDTH / bitmap.width);
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL('image/jpeg', 0.7);
}

/** A drawn paying-in slip, for demos on a laptop with no photo to hand. */
function sampleSlip(amount: number, reference: string, shop: string): string {
  const canvas = document.createElement('canvas');
  canvas.width = THUMB_WIDTH;
  canvas.height = 200;
  const g = canvas.getContext('2d')!;
  g.fillStyle = '#f7f3e8';
  g.fillRect(0, 0, canvas.width, canvas.height);
  g.strokeStyle = '#9a8f73';
  g.strokeRect(8, 8, canvas.width - 16, canvas.height - 16);
  g.fillStyle = '#2b2b2b';
  g.font = 'bold 16px sans-serif';
  g.fillText('BANK GIRO CREDIT', 22, 40);
  g.font = '13px sans-serif';
  g.fillText(`Paid in by: ${shop}`, 22, 72);
  g.fillText(`Ref: ${reference || 'not written'}`, 22, 96);
  g.fillText(`Date: ${new Date().toLocaleDateString('en-GB')}`, 22, 120);
  g.font = 'bold 22px sans-serif';
  g.fillText(`Cash ${money(amount)}`, 22, 162);
  return canvas.toDataURL('image/jpeg', 0.8);
}

export default function SlipField({
  id, value, onChange, amount, reference, shop, required,
}: {
  id: string;
  value: string;
  onChange: (dataUrl: string) => void;
  amount: number;
  reference: string;
  shop: string;
  required?: boolean;
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <label style={ui.field} htmlFor={id}>
        <span style={ui.fieldLabel}>Photo of the bank slip {required ? '(required)' : '(optional)'}</span>
        <input
          id={id}
          type="file"
          accept="image/*"
          capture="environment"
          style={{ fontSize: 13 }}
          onChange={async e => {
            const file = e.target.files?.[0];
            if (file) onChange(await thumbnail(file));
          }}
        />
      </label>
      <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start', flexWrap: 'wrap' }}>
        {value ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={value} alt="Bank slip" style={{ width: 180, borderRadius: 8, border: '1px solid var(--color-border-subtle)' }} />
            <button type="button" style={{ ...ui.ghostBtn, minHeight: 44 }} onClick={() => onChange('')}>Remove photo</button>
          </>
        ) : (
          <button type="button" style={{ ...ui.ghostBtn, minHeight: 44 }} onClick={() => onChange(sampleSlip(amount, reference, shop))}>Use a sample slip</button>
        )}
      </div>
    </div>
  );
}
