'use client';

import ProductionShell from '@/components/Production/ProductionShell';

export default function ProductionLayout({ children }: { children: React.ReactNode }) {
  return <ProductionShell>{children}</ProductionShell>;
}
