'use client';

import { useSession } from 'next-auth/react';
import { api } from '@/lib/api-client';

export function useApi() {
  const { data: session, status } = useSession();

  // Set token synchronously before any queries fire
  const token = (session as any)?.accessToken ?? null;
  api.setToken(token);

  // Expose whether the session is ready so queries can wait
  const isReady = status !== 'loading' && !!token;

  if (process.env.NODE_ENV === 'development') {
    console.debug('[useApi]', { status, hasToken: !!token, isReady });
  }

  // Return the actual api instance (spreading a class loses prototype methods)
  return { api, isReady };
}
