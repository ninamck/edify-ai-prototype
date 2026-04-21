'use client';

import { useRouter } from 'next/navigation';
import { Zap, FileSpreadsheet, Camera, MessageSquare, PenSquare, ArrowRight, ArrowLeft } from 'lucide-react';
import QuinnOrb from '@/components/Sidebar/QuinnOrb';

type LauncherOption = {
  id: string;
  icon: React.ComponentType<{ size?: number; color?: string; strokeWidth?: number }>;
  iconBg: string;
  iconColor: string;
  title: string;
  description: string;
  meta?: string;
  badge?: string;
  onClick?: () => void;
  disabled?: boolean;
};

export default function IntakeLauncherPage() {
  const router = useRouter();

  const options: LauncherOption[] = [
    {
      id: 'pos',
      icon: Zap,
      iconBg: 'rgba(3,28,89,0.08)',
      iconColor: 'var(--color-accent-active)',
      title: 'From your POS',
      description: 'We’ll pull your menu items and modifiers and draft recipes for each.',
      meta: '124 items detected in Square',
      badge: 'Recommended',
      onClick: () => router.push('/recipes/intake/pos'),
    },
    {
      id: 'sheet',
      icon: FileSpreadsheet,
      iconBg: 'rgba(3,28,89,0.08)',
      iconColor: 'var(--color-accent-active)',
      title: 'Upload a costing sheet',
      description: 'CSV or Excel. Quinn maps columns and drafts recipes row by row.',
      onClick: () => router.push('/recipes/intake/sheet'),
    },
    {
      id: 'photo',
      icon: Camera,
      iconBg: 'rgba(3,28,89,0.08)',
      iconColor: 'var(--color-accent-active)',
      title: 'Photo of a recipe sheet',
      description: 'Snap a handwritten card. Quinn OCRs it and you confirm. Mobile-friendly.',
      onClick: () => router.push('/recipes/intake/photo'),
    },
    {
      id: 'chat',
      icon: MessageSquare,
      iconBg: 'rgba(3,28,89,0.08)',
      iconColor: 'var(--color-accent-active)',
      title: 'Ask Quinn',
      description: 'Type, paste, or dictate a recipe. Quinn walks you through it in chat.',
      onClick: () => router.push('/?flow=recipe'),
    },
    {
      id: 'manual',
      icon: PenSquare,
      iconBg: 'rgba(3,28,89,0.08)',
      iconColor: 'var(--color-accent-active)',
      title: 'Build manually',
      description: 'All fields on one page. Quinn pre-fills from the name; advanced settings hide until you need them.',
      onClick: () => router.push('/recipes/intake/manual'),
    },
  ];

  return (
    <div style={{ padding: '20px 24px 48px', maxWidth: '880px', margin: '0 auto' }}>
      <button
        onClick={() => router.push('/recipes')}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '6px',
          background: 'transparent',
          border: 'none',
          color: 'var(--color-text-muted)',
          fontSize: '13px',
          fontWeight: 600,
          fontFamily: 'var(--font-primary)',
          cursor: 'pointer',
          padding: '6px 0',
          marginBottom: '14px',
        }}
      >
        <ArrowLeft size={14} strokeWidth={2} />
        Back to Recipes
      </button>

      <h1
        style={{
          fontSize: '22px',
          fontWeight: 700,
          color: 'var(--color-text-primary)',
          margin: '0 0 6px',
        }}
      >
        Add recipes
      </h1>
      <p
        style={{
          fontSize: '13.5px',
          color: 'var(--color-text-muted)',
          margin: '0 0 22px',
        }}
      >
        Choose how you want to bring recipes in. Quinn will do the costing, supplier matching, and card creation.
      </p>

      {/* Quinn intro strip */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          padding: '12px 14px',
          borderRadius: '12px',
          background: 'linear-gradient(180deg, #FEFCF9 0%, #fff 100%)',
          border: '1px solid var(--color-border-subtle)',
          marginBottom: '14px',
        }}
      >
        <QuinnOrb state="ready" size={30} />
        <div style={{ minWidth: 0 }}>
          <div
            style={{
              fontSize: '12px',
              fontWeight: 700,
              letterSpacing: '0.1em',
              color: 'var(--color-accent-active)',
              marginBottom: '2px',
            }}
          >
            QUINN
          </div>
          <div style={{ fontSize: '13px', color: 'var(--color-text-primary)', lineHeight: 1.45 }}>
            Connect Square and I’ll draft 87 recipes from your menu in a few minutes.
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {options.map((opt) => {
          const Icon = opt.icon;
          return (
            <button
              key={opt.id}
              onClick={opt.onClick}
              disabled={opt.disabled}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '14px',
                padding: '16px 16px',
                borderRadius: '12px',
                border: '1px solid var(--color-border-subtle)',
                background: '#fff',
                cursor: opt.disabled ? 'not-allowed' : 'pointer',
                fontFamily: 'var(--font-primary)',
                textAlign: 'left',
                transition: 'all 0.15s',
                opacity: opt.disabled ? 0.55 : 1,
                width: '100%',
              }}
              onMouseEnter={(e) => {
                if (!opt.disabled) e.currentTarget.style.background = 'var(--color-bg-hover)';
              }}
              onMouseLeave={(e) => {
                if (!opt.disabled) e.currentTarget.style.background = '#fff';
              }}
            >
              <div
                style={{
                  width: '42px',
                  height: '42px',
                  borderRadius: '10px',
                  background: opt.iconBg,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                <Icon size={20} color={opt.iconColor} strokeWidth={1.8} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '2px' }}>
                  <span
                    style={{
                      fontSize: '14px',
                      fontWeight: 600,
                      color: 'var(--color-text-primary)',
                    }}
                  >
                    {opt.title}
                  </span>
                  {opt.badge && (
                    <span
                      style={{
                        padding: '2px 7px',
                        borderRadius: '6px',
                        background: 'var(--color-accent-active)',
                        color: '#fff',
                        fontSize: '10.5px',
                        fontWeight: 700,
                        letterSpacing: '0.03em',
                      }}
                    >
                      {opt.badge}
                    </span>
                  )}
                  {opt.disabled && (
                    <span
                      style={{
                        padding: '2px 7px',
                        borderRadius: '6px',
                        background: 'var(--color-bg-hover)',
                        color: 'var(--color-text-muted)',
                        fontSize: '10.5px',
                        fontWeight: 600,
                        letterSpacing: '0.03em',
                      }}
                    >
                      Coming soon
                    </span>
                  )}
                </div>
                <div style={{ fontSize: '12.5px', color: 'var(--color-text-muted)', lineHeight: 1.4 }}>
                  {opt.description}
                </div>
                {opt.meta && (
                  <div
                    style={{
                      fontSize: '11.5px',
                      color: 'var(--color-accent-active)',
                      fontWeight: 600,
                      marginTop: '6px',
                    }}
                  >
                    {opt.meta}
                  </div>
                )}
              </div>
              {!opt.disabled && (
                <ArrowRight size={18} color="var(--color-text-muted)" strokeWidth={1.8} />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
