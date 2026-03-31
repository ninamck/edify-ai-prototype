import Link from 'next/link';

type SearchParams = { ref?: string };

export default async function OrdersPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const { ref } = await searchParams;

  return (
    <div
      style={{
        minHeight: '100vh',
        background: 'var(--color-bg-surface)',
        fontFamily: 'var(--font-primary)',
        padding: '32px 24px',
      }}
    >
      <Link
        href="/"
        style={{
          fontSize: '13px',
          fontWeight: 600,
          color: 'var(--color-accent-deep)',
          textDecoration: 'none',
        }}
      >
        ← Back to home
      </Link>
      <h1 style={{ fontSize: '22px', fontWeight: 700, color: 'var(--color-text-primary)', marginTop: '24px' }}>
        Order {ref ?? '—'}
      </h1>
      <p style={{ fontSize: '14px', color: 'var(--color-text-secondary)', marginTop: '8px', maxWidth: '480px' }}>
        Full order detail will live here. This route is wired from &quot;Go to order&quot; in the orders panel.
      </p>
    </div>
  );
}
