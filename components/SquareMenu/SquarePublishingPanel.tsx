'use client';

/**
 * Publishing block inside the Square connection card on POS connection,
 * plus the set-up sheet behind "Turn on publishing":
 *
 *   1. What Edify sends and what Square keeps
 *   2. Allow Edify to change the Square menu (extra Square permission)
 *   3. Match Square locations to sites, confirm VAT rates
 *
 * Other POS vendors never see this.
 */

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowRight, Check, Loader2, Send } from 'lucide-react';
import { SITES } from '@/components/Recipe/RecipeFormParts';
import { StatusPill } from '@/components/ui/StatusPill';
import { SQUARE_LOCATIONS, SQUARE_TAXES } from './squareCatalogFixtures';
import {
  resetForSetup,
  resetToSeed,
  turnPublishingOff,
  turnPublishingOn,
  updateSettings,
  useSquareMenu,
} from './squareMenuStore';
import { FieldLabel, Sheet, inputStyle, linkBtn, primaryBtn, secondaryBtn } from './ui';

export function SquarePublishingPanel() {
  const router = useRouter();
  const sm = useSquareMenu();
  const [setup, setSetup] = useState<null | 'full' | 'settings'>(null);
  const on = sm.settings.enabled;
  const mapped = Object.values(sm.settings.locationMap).filter(Boolean).length;

  return (
    <div style={{ gridColumn: '1 / -1', paddingTop: 12, borderTop: '1px solid var(--color-border-subtle)' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
        <div style={{ flex: '1 1 360px', minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 13.5, fontWeight: 700 }}>Publish your menu to Square</span>
            <StatusPill tone={on ? 'success' : 'neutral'} size="xs">{on ? 'On' : 'Off'}</StatusPill>
          </div>
          <p style={{ fontSize: 12.5, color: 'var(--color-text-muted)', margin: '4px 0 0', lineHeight: 1.5 }}>
            {on
              ? `Edify builds the till from your recipes and products. ${mapped} of ${SQUARE_LOCATIONS.length} locations matched to sites.${sm.settings.lastPublishedAt ? ` Last published ${sm.settings.lastPublishedAt}.` : ''}`
              : 'Build the till from your recipes and products, so you set up each item once. Square keeps sold out, menus and the till layout.'}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {on ? (
            <>
              <button type="button" style={primaryBtn} onClick={() => router.push('/square-menu')}>
                Open Square menu <ArrowRight size={14} />
              </button>
              <button type="button" style={secondaryBtn} onClick={() => setSetup('settings')}>Locations and VAT</button>
              <button
                type="button"
                style={secondaryBtn}
                onClick={() => {
                  if (window.confirm('Turn off publishing? The till keeps everything Edify already published. Edify stops sending changes.')) turnPublishingOff();
                }}
              >
                Turn off
              </button>
            </>
          ) : (
            <button type="button" style={primaryBtn} onClick={() => setSetup('full')}>
              <Send size={14} /> Turn on publishing
            </button>
          )}
        </div>
      </div>
      <div style={{ marginTop: 10, fontSize: 12, color: 'var(--color-text-muted)', display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        <span>Demo:</span>
        <button type="button" style={linkBtn} onClick={() => resetForSetup(true)}>Start set-up with a Square menu</button>
        <button type="button" style={linkBtn} onClick={() => resetForSetup(false)}>Start set-up with an empty Square</button>
        <button type="button" style={linkBtn} onClick={() => resetToSeed()}>Load a busy week</button>
      </div>

      {setup && (
        <SetupSheet
          mode={setup}
          onClose={() => setSetup(null)}
          onDone={() => {
            setSetup(null);
            if (setup === 'full') {
              turnPublishingOn();
              router.push('/square-menu');
            }
          }}
        />
      )}
    </div>
  );
}

function SetupSheet({ mode, onClose, onDone }: { mode: 'full' | 'settings'; onClose: () => void; onDone: () => void }) {
  const sm = useSquareMenu();
  const [step, setStep] = useState(mode === 'full' ? 1 : 3);
  const [authorising, setAuthorising] = useState(false);
  const [authorised, setAuthorised] = useState(sm.settings.authorised);

  // Suggest site matches by name the first time.
  const suggested = (locId: string) => sm.settings.locationMap[locId] ?? SQUARE_LOCATIONS.find((l) => l.id === locId)?.site ?? '';

  function authorise() {
    setAuthorising(true);
    window.setTimeout(() => {
      setAuthorising(false);
      setAuthorised(true);
      updateSettings({ authorised: true });
    }, 1200);
  }

  function saveMapping() {
    const map: Record<string, string> = {};
    for (const l of SQUARE_LOCATIONS) map[l.id] = suggested(l.id);
    updateSettings({ locationMap: map });
  }

  const steps = ['What changes', 'Allow Edify', 'Locations and VAT'];

  const footer = (
    <>
      {mode === 'full' && step > 1 && (
        <button type="button" style={secondaryBtn} onClick={() => setStep(step - 1)}>Back</button>
      )}
      <span style={{ flex: 1 }} />
      {step < 3 ? (
        <button
          type="button"
          style={{ ...primaryBtn, opacity: step === 2 && !authorised ? 0.5 : 1, cursor: step === 2 && !authorised ? 'not-allowed' : 'pointer' }}
          disabled={step === 2 && !authorised}
          onClick={() => setStep(step + 1)}
        >
          Next
        </button>
      ) : (
        <button type="button" style={primaryBtn} onClick={() => { saveMapping(); onDone(); }}>
          {mode === 'full' ? 'Turn on and bring in my Square menu' : 'Save'}
        </button>
      )}
    </>
  );

  return (
    <Sheet
      eyebrowText={mode === 'full' ? `Step ${step} of 3 · ${steps[step - 1]}` : 'Square publishing'}
      title={step === 1 ? 'What Edify will do on your till' : step === 2 ? 'Let Edify change your Square menu' : 'Match your Square locations to sites'}
      onClose={onClose}
      footer={footer}
      width={680}
    >
      {step === 1 && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <ListCard
              title="Edify sends"
              items={[
                'Item names, sizes and till prices',
                'Modifier groups and option prices',
                'Till categories and kitchen names',
                'Allergens from your recipes',
                'Which sites sell what',
                'The VAT rate on each item',
              ]}
            />
            <ListCard
              title="Square keeps"
              items={[
                'Sold out',
                'Menus, the till layout and online channels',
                'Printers and kitchen screens',
                'Discounts and service charges',
              ]}
            />
          </div>
          <p style={{ fontSize: 13, color: 'var(--color-text-secondary)', lineHeight: 1.5, margin: '14px 0 0' }}>
            Nothing reaches the till until you review and publish. If someone changes an item in Square, Edify spots it and asks you what to keep.
          </p>
        </>
      )}

      {step === 2 && (
        <>
          <p style={{ fontSize: 13, color: 'var(--color-text-secondary)', lineHeight: 1.5, margin: '0 0 14px' }}>
            Edify already reads your sales and sends email orders. To build the till it also needs permission to update items. Square asks you to allow it, once.
          </p>
          {authorised ? (
            <div role="status" style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 14px', borderRadius: 12, background: '#fff', border: '1px solid var(--color-success, #166534)', fontSize: 13.5 }}>
              <Check size={16} color="var(--color-success, #166534)" aria-hidden /> Square allowed Edify to update your menu.
            </div>
          ) : (
            <button type="button" style={primaryBtn} onClick={authorise} disabled={authorising}>
              {authorising ? <><Loader2 size={14} aria-hidden style={{ animation: 'quinn-spin 1s linear infinite' }} /> Waiting for Square</> : 'Open Square to allow it'}
            </button>
          )}
        </>
      )}

      {step === 3 && (
        <>
          <p style={{ fontSize: 13, color: 'var(--color-text-secondary)', lineHeight: 1.5, margin: '0 0 12px' }}>
            Edify uses this to send each site only what it sells, with its own prices.
          </p>
          <div style={{ background: '#fff', border: '1px solid var(--color-border-subtle)', borderRadius: 12, marginBottom: 16 }}>
            {SQUARE_LOCATIONS.map((l, idx) => (
              <div key={l.id} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, alignItems: 'center', padding: '10px 14px', borderTop: idx ? '1px solid var(--color-border-subtle)' : 'none' }}>
                <label htmlFor={`loc-${l.id}`} style={{ fontSize: 13, fontWeight: 600 }}>Square: {l.name}</label>
                <select
                  id={`loc-${l.id}`}
                  style={inputStyle}
                  value={suggested(l.id)}
                  onChange={(e) => updateSettings({ locationMap: { ...sm.settings.locationMap, [l.id]: e.target.value } })}
                >
                  <option value="">Not an Edify site</option>
                  {SITES.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
            ))}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <FieldLabel htmlFor="vat-hot">VAT on hot food and drink</FieldLabel>
              <select id="vat-hot" style={inputStyle} value={sm.settings.vatHot} onChange={(e) => updateSettings({ vatHot: e.target.value })}>
                {SQUARE_TAXES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <FieldLabel htmlFor="vat-cold">VAT on cold takeaway food</FieldLabel>
              <select id="vat-cold" style={inputStyle} value={sm.settings.vatCold} onChange={(e) => updateSettings({ vatCold: e.target.value })}>
                {SQUARE_TAXES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
          </div>
          <p style={{ fontSize: 12.5, color: 'var(--color-text-muted)', lineHeight: 1.5, margin: '8px 0 0' }}>
            These are the rates set up in your Square account. Edify starts each item on one of them and you can change any item. You confirm the rates. Edify doesn&apos;t decide VAT treatment.
          </p>

          <div style={{ marginTop: 16, padding: '12px 14px', borderRadius: 12, background: '#fff', border: '1px solid var(--color-border-subtle)', fontSize: 12.5, lineHeight: 1.5, color: 'var(--color-text-secondary)' }}>
            <strong style={{ color: 'var(--color-text-primary)' }}>Tip:</strong> in Square, give your team a permission set without &quot;Edit items&quot;. Changes then come through Edify and nothing drifts on the till.
          </div>
        </>
      )}
    </Sheet>
  );
}

function ListCard({ title, items }: { title: string; items: string[] }) {
  return (
    <div style={{ background: '#fff', border: '1px solid var(--color-border-subtle)', borderRadius: 12, padding: 14 }}>
      <h3 style={{ fontSize: 13.5, fontWeight: 700, margin: '0 0 8px' }}>{title}</h3>
      <ul style={{ margin: 0, paddingLeft: 18, listStyle: 'disc' }}>
        {items.map((i) => <li key={i} style={{ fontSize: 13, color: 'var(--color-text-secondary)', marginBottom: 5 }}>{i}</li>)}
      </ul>
    </div>
  );
}
