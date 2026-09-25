'use client';

import { QueryCache, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState, type ReactNode } from 'react';
import { ApiError } from '@/lib/api-client';
import { isUnauthenticated } from '@/lib/error-messages';

/** Server state only: no global client store. Everything that matters lives in the query cache. */
export function Providers({ children }: { children: ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        queryCache: new QueryCache({
          onError: (error) => {
            // An expired session mid-poll sends the person back to sign in.
            if (isUnauthenticated(error) && !window.location.pathname.startsWith('/login')) {
              window.location.assign('/login');
            }
          },
        }),
        defaultOptions: {
          queries: {
            staleTime: 2_000,
            refetchOnWindowFocus: true,
            retry: (failureCount, error) =>
              !(error instanceof ApiError && error.status >= 400 && error.status < 500) &&
              failureCount < 2,
          },
        },
      }),
  );
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
