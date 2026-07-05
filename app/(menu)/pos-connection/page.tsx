'use client';

/**
 * POS connection — system-level link state for the connected POS(es).
 *
 * Shows:
 *   • Which POS is connected (one per site, in the prototype)
 *   • Last sync time + auto-sync cadence
 *   • A list of what the last sync pulled (menu items, modifier groups,
 *     30-day sales rollup) so the user can sanity-check coverage
 *   • Manual "Sync now" + "Disconnect" controls
 *   • A row of "Add another POS" placeholders for the integrations we
 *     plan to ship but don't have yet — drives the perceived breadth
 *     of the connector library
 *
 * This is the ongoing-management view. The first-import wizard
 * (`/recipes/intake/pos`) is a different flow and lives in the
 * Add recipes intake area.
 */

import { useState } from 'react';
import {
  RefreshCw, Check, Plus, AlertTriangle, Link2, Settings as SettingsIcon, Power,
} from 'lucide-react';
import StyledSelect from '@/components/ui/StyledSelect';

type ConnectionStatus = 'connected' | 'attention' | 'disconnected';

type PosConnection = {
  id: string;
  name: string;
  vendor: string;
  site: string;
  status: ConnectionStatus;
  lastSyncedAt: string;
  cadence: 'hourly' | '15-min' | 'manual';
  pulled: {
    menuItems: number;
    modifierGroups: number;
    salesDays: number;
  };
  notes?: string;
};

const SEED_CONNECTIONS: PosConnection[] = [
  {
    id: 'pos-1',
    name: 'Lightspeed K Series',
    vendor: 'Lightspeed',
    site: 'Fitzroy Espresso',
    status: 'connected',
    lastSyncedAt: '2 min ago',
    cadence: '15-min',
    pulled: { menuItems: 124, modifierGroups: 11, salesDays: 30 },
  },
];

const AVAILABLE_INTEGRATIONS = [
  { id: 'square',     name: 'Square',     status: 'available' },
  { id: 'toast',      name: 'Toast',      status: 'available' },
  { id: 'clover',     name: 'Clover',     status: 'available' },
  { id: 'epos-now',   name: 'Epos Now',   status: 'available' },
  { id: 'revel',      name: 'Revel',      status: 'available' },
  { id: 'micros',     name: 'Oracle Micros', status: 'beta' },
  { id: 'shopify-pos',name: 'Shopify POS',  status: 'beta' },
];

export default function PosConnectionPage() {
  const [connections, setConnections] = useState<PosConnection[]>(SEED_CONNECTIONS);
  const [syncing, setSyncing] = useState<string | null>(null);

  function syncNow(id: string) {
    setSyncing(id);
    window.setTimeout(() => {
      setConnections((cs) =>
        cs.map((c) => (c.id === id ? { ...c, lastSyncedAt: 'just now' } : c)),
      );
      setSyncing(null);
    }, 900);
  }

  function setCadence(id: string, cadence: PosConnection['cadence']) {
    setConnections((cs) => cs.map((c) => (c.id === id ? { ...c, cadence } : c)));
  }

  function disconnect(id: string) {
    if (!confirm('Disconnect this POS? Item matching and sales rollup will stop until you reconnect.')) return;
    setConnections((cs) => cs.filter((c) => c.id !== id));
  }

  return (
    <div style={{ padding: '24px 24px 120px', maxWidth: 1120, margin: '0 auto', fontFamily: 'var(--font-primary)' }}>
      <div style={{ marginBottom: 6 }}>
        <p style={{ fontSize: 13, color: 'var(--color-text-muted)', margin: 0 }}>
          Which till is Edify reading from, when did it last sync, and what came across the wire. Item
          matching and the 30-day sales rollup both depend on a healthy connection here.
        </p>
      </div>

      {/* Connected POS list */}
      <section style={{ marginTop: 20 }}>
        <SectionLabel>Connected</SectionLabel>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {connections.length === 0 ? (
            <EmptyState />
          ) : (
            connections.map((c) => (
              <ConnectionCard
                key={c.id}
                connection={c}
                syncing={syncing === c.id}
                onSyncNow={() => syncNow(c.id)}
                onCadence={(cd) => setCadence(c.id, cd)}
                onDisconnect={() => disconnect(c.id)}
              />
            ))
          )}
        </div>
      </section>

      {/* Available integrations */}
      <section style={{ marginTop: 32 }}>
        <SectionLabel>Add another POS</SectionLabel>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
            gap: 10,
          }}
        >
          {AVAILABLE_INTEGRATIONS.map((p) => (
            <button
              key={p.id}
              onClick={() => alert(`Connect ${p.name} — wizard coming soon.`)}
              style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '12px 14px', borderRadius: 12,
                border: '1px solid var(--color-border-subtle)', background: '#fff',
                fontFamily: 'var(--font-primary)', cursor: 'pointer',
                textAlign: 'left',
              }}
            >
              <span
                style={{
                  width: 32, height: 32, borderRadius: 8,
                  background: 'var(--color-bg-hover)',
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                  color: 'var(--color-text-secondary)', fontWeight: 700, fontSize: 12,
                }}
              >
                {p.name.slice(0, 2).toUpperCase()}
              </span>
              <span style={{ flex: 1, fontSize: 13, fontWeight: 600, color: 'var(--color-text-primary)' }}>
                {p.name}
              </span>
              {p.status === 'beta' ? (
                <span style={betaPill}>Beta</span>
              ) : (
                <Plus size={14} color="var(--color-text-muted)" />
              )}
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}

function ConnectionCard({
  connection: c, syncing, onSyncNow, onCadence, onDisconnect,
}: {
  connection: PosConnection;
  syncing: boolean;
  onSyncNow: () => void;
  onCadence: (cadence: PosConnection['cadence']) => void;
  onDisconnect: () => void;
}) {
  return (
    <div
      style={{
        background: '#fff', border: '1px solid var(--color-border-subtle)',
        borderRadius: 12, padding: '16px 18px',
        display: 'grid', gridTemplateColumns: '1fr auto', rowGap: 14, columnGap: 18,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
        <div
          style={{
            width: 44, height: 44, borderRadius: 10,
            background: 'rgba(0, 28, 53,0.06)',
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            color: 'var(--color-accent-active)', fontWeight: 700, fontSize: 14,
            flexShrink: 0,
          }}
        >
          {c.vendor.slice(0, 2).toUpperCase()}
        </div>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 14.5, fontWeight: 700, color: 'var(--color-text-primary)' }}>{c.name}</span>
            <StatusPill status={c.status} />
            <span style={{ fontSize: 11.5, color: 'var(--color-text-muted)' }}>· {c.site}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, fontSize: 12.5, color: 'var(--color-text-secondary)', flexWrap: 'wrap' }}>
            <span>Last sync <strong style={{ color: 'var(--color-text-primary)' }}>{c.lastSyncedAt}</strong></span>
            <span>·</span>
            <span>
              <strong style={{ color: 'var(--color-text-primary)' }}>{c.pulled.menuItems}</strong> menu items
            </span>
            <span>·</span>
            <span>
              <strong style={{ color: 'var(--color-text-primary)' }}>{c.pulled.modifierGroups}</strong> modifier groups
            </span>
            <span>·</span>
            <span>
              <strong style={{ color: 'var(--color-text-primary)' }}>{c.pulled.salesDays}d</strong> sales
            </span>
          </div>
          {c.notes && (
            <div style={{ marginTop: 6, fontSize: 12, color: 'var(--color-warning)', display: 'inline-flex', alignItems: 'center', gap: 5 }}>
              <AlertTriangle size={12} /> {c.notes}
            </div>
          )}
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, flexShrink: 0 }}>
        <StyledSelect
          width={130}
          value={c.cadence}
          onChange={(e) => onCadence(e.target.value as PosConnection['cadence'])}
        >
          <option value="15-min">Every 15 min</option>
          <option value="hourly">Hourly</option>
          <option value="manual">Manual only</option>
        </StyledSelect>
        <button
          onClick={onSyncNow}
          disabled={syncing}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            padding: '9px 14px', borderRadius: 10,
            border: '1px solid var(--color-accent-active)',
            background: syncing ? 'var(--color-bg-hover)' : 'var(--color-accent-active)',
            color: syncing ? 'var(--color-text-secondary)' : '#fff',
            fontSize: 13, fontWeight: 600,
            fontFamily: 'var(--font-primary)',
            cursor: syncing ? 'wait' : 'pointer',
            opacity: syncing ? 0.7 : 1,
          }}
        >
          <RefreshCw size={13} className={syncing ? 'spin' : ''} />
          {syncing ? 'Syncing…' : 'Sync now'}
        </button>
      </div>

      <div
        style={{
          gridColumn: '1 / -1',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          paddingTop: 12, borderTop: '1px solid var(--color-border-subtle)',
          gap: 12, flexWrap: 'wrap',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 12, color: 'var(--color-text-muted)' }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
            <Link2 size={12} /> Source id: pos-{c.vendor.toLowerCase()}-{c.id}
          </span>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={() => alert('Connection settings — coming soon.')}
            style={textBtn}
          >
            <SettingsIcon size={12} /> Settings
          </button>
          <button onClick={onDisconnect} style={dangerTextBtn}>
            <Power size={12} /> Disconnect
          </button>
        </div>
      </div>
    </div>
  );
}

function StatusPill({ status }: { status: ConnectionStatus }) {
  if (status === 'connected') {
    return (
      <span style={{ ...pillBase, background: 'var(--color-success-light)', color: 'var(--color-success)' }}>
        <Check size={11} strokeWidth={2.5} /> Connected
      </span>
    );
  }
  if (status === 'attention') {
    return (
      <span style={{ ...pillBase, background: 'var(--color-warning-light)', color: 'var(--color-warning)' }}>
        <AlertTriangle size={11} /> Needs attention
      </span>
    );
  }
  return (
    <span style={{ ...pillBase, background: 'var(--color-bg-hover)', color: 'var(--color-text-muted)' }}>
      Disconnected
    </span>
  );
}

function EmptyState() {
  return (
    <div
      style={{
        padding: 28, textAlign: 'center', background: '#fff',
        border: '1px dashed var(--color-border)', borderRadius: 12,
        color: 'var(--color-text-muted)', fontSize: 13,
      }}
    >
      No POS connected yet. Pick a vendor below to start the connection wizard.
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        fontSize: 11, fontWeight: 700, letterSpacing: '0.08em',
        textTransform: 'uppercase', color: 'var(--color-text-muted)',
        marginBottom: 10,
      }}
    >
      {children}
    </div>
  );
}

const pillBase: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: 4,
  padding: '2px 8px', borderRadius: 100,
  fontSize: 10.5, fontWeight: 700, letterSpacing: '0.02em',
};

const betaPill: React.CSSProperties = {
  padding: '2px 7px', borderRadius: 100,
  background: 'rgba(241,180,52,0.16)', color: 'var(--color-warning)',
  fontSize: 9.5, fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase',
};

const textBtn: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: 5,
  padding: '5px 9px', borderRadius: 7,
  border: '1px solid transparent', background: 'transparent',
  fontSize: 12, fontWeight: 600, fontFamily: 'var(--font-primary)',
  color: 'var(--color-text-secondary)', cursor: 'pointer',
};

const dangerTextBtn: React.CSSProperties = {
  ...textBtn,
  color: 'var(--color-warning)',
};
