import { QueryClient, QueryClientProvider as SolidQueryClientProvider } from '@tanstack/solid-query';
import { JSX, ParentProps } from 'solid-js';

// Centralized Query Client for Truck-Trip-Tracker
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutes stale time
      gcTime: 10 * 60 * 1000, // 10 minutes cache garbage collection
      retry: 2, // Retry failed network queries twice before throwing error
      refetchOnWindowFocus: true, // Auto refetch when driver/dispatcher switches back to tab
    },
    mutations: {
      retry: 1,
    },
  },
});

export function QueryClientProvider(props: ParentProps): JSX.Element {
  return (
    <SolidQueryClientProvider client={queryClient}>
      {props.children}
    </SolidQueryClientProvider>
  );
}
