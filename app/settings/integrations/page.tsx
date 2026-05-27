'use client';

/**
 * /settings/integrations — placeholder for the third-party connections
 * Edify supports in production (Xero, Sage, Square POS, etc.). The
 * live system surfaces these as a sub-tab of Company Info, but for the
 * prototype we promoted Integrations to a top-level tab so each surface
 * has a single, focused purpose.
 *
 * Not wired up — this is a "what would live here" placeholder, the same
 * spirit as the dispatch / order-history stubs elsewhere in the demo.
 */

export default function IntegrationsSettingsPage() {
  return (
    <div style={{ padding: '20px 24px 96px' }}>
      <div style={{ maxWidth: 880, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div>
          <h1
            style={{
              margin: 0,
              fontSize: 22,
              fontWeight: 700,
              color: 'var(--color-text-primary)',
              fontFamily: 'var(--font-primary)',
            }}
          >
            Integrations
          </h1>
          <div style={{ marginTop: 2, fontSize: 12, color: 'var(--color-text-muted)' }}>
            Third-party systems Edify reads from and writes to.
          </div>
        </div>

        <div
          style={{
            padding: '40px 24px',
            borderRadius: 'var(--radius-card)',
            border: '1px dashed var(--color-border)',
            background: '#ffffff',
            textAlign: 'center',
            fontSize: 12,
            color: 'var(--color-text-muted)',
            fontFamily: 'var(--font-primary)',
            lineHeight: 1.6,
          }}
        >
          Integrations live in the production app — Xero, Sage, Square POS, etc.
          <br />
          Not recreated in the prototype.
        </div>
      </div>
    </div>
  );
}
