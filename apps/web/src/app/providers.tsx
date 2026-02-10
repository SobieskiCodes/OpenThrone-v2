'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SessionProvider, signOut } from 'next-auth/react';
import { useState, useEffect } from 'react';

function UnauthorizedListener() {
  useEffect(() => {
    let signingOut = false;
    const handler = () => {
      if (signingOut) return;
      signingOut = true;
      signOut({ callbackUrl: '/login' });
    };
    window.addEventListener('ot:unauthorized', handler);
    return () => window.removeEventListener('ot:unauthorized', handler);
  }, []);
  return null;
}

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30 * 1000,
            retry: (failureCount, error) => {
              // Don't retry on 401 — the UnauthorizedListener will handle sign-out
              if (error instanceof Error && error.message?.includes('401')) return false;
              if ((error as any)?.status === 401) return false;
              return failureCount < 1;
            },
          },
        },
      }),
  );

  return (
    <SessionProvider>
      <UnauthorizedListener />
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </SessionProvider>
  );
}
