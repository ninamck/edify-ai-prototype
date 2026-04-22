'use client';

import ProductionShell from '@/components/Production/ProductionShell';

export default function OrderingLayout({ children }: { children: React.ReactNode }) {
  return <ProductionShell>{children}</ProductionShell>;
}
