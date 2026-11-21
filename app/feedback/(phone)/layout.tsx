/** The store manager's phone screens. No sidebar; each page sets its own background. */
export default function FeedbackPhoneLayout({ children }: { children: React.ReactNode }) {
  return <div style={{ minHeight: '100vh', fontFamily: 'var(--font-primary)' }}>{children}</div>;
}
