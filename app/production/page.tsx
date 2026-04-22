'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useCurrentRole } from '@/components/DemoControls/demoStore';
import { defaultRouteForRole } from '@/components/Production/roleFilter';

export default function ProductionIndexPage() {
  const router = useRouter();
  const role = useCurrentRole();

  useEffect(() => {
    router.replace(defaultRouteForRole(role));
  }, [role, router]);

  return null;
}
