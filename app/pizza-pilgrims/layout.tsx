import type { Metadata } from 'next';
import { Source_Serif_4 } from 'next/font/google';

const serif = Source_Serif_4({
  subsets: ['latin'],
  weight: ['400', '600', '700'],
  variable: '--font-joshua',
});

export const metadata: Metadata = {
  title: 'Joshua | Pizza Pilgrims',
  robots: { index: false, follow: false },
};

export default function PizzaPilgrimsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className={serif.variable} style={{ height: '100%' }}>
      {children}
    </div>
  );
}
