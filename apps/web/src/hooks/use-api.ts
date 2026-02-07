'use client';

import { useSession } from 'next-auth/react';
import { useEffect } from 'react';
import { api } from '@/lib/api-client';

export function useApi() {
  const { data: session } = useSession();

  useEffect(() => {
    if (session) {
      api.setToken((session as any).accessToken ?? null);
    } else {
      api.setToken(null);
    }
  }, [session]);

  return api;
}
