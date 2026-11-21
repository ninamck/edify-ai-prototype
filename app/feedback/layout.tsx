import { Merriweather } from 'next/font/google';

/** Merriweather Italic is kept for a person speaking: guests' words and the manager's own line. */
const quote = Merriweather({
  subsets: ['latin'],
  weight: ['400'],
  style: ['italic'],
  variable: '--font-quote',
  display: 'swap',
});

export default function FeedbackRootLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className={quote.variable} style={{ height: '100%' }}>
      {children}
    </div>
  );
}
