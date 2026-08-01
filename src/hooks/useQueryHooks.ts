import { createQuery, createMutation, useQueryClient } from '@tanstack/solid-query';
import { Accessor } from 'solid-js';

// Query Key Factory for standardized cache invalidation
export const queryKeys = {
  trips: (orgId: string) => ['trips', orgId] as const,
  tripDetail: (tripId: string) => ['trip', tripId] as const,
  trucks: (orgId: string) => ['trucks', orgId] as const,
  drivers: (orgId: string) => ['drivers', orgId] as const,
  expenses: (orgId: string) => ['expenses', orgId] as const,
  fuel: (orgId: string) => ['fuel', orgId] as const,
};

/**
 * Custom hook to manage trip queries with TanStack Query caching
 */
export function useTripsQuery(orgId: Accessor<string>, fetchFn: (id: string) => Promise<any[]>) {
  return createQuery(() => ({
    queryKey: queryKeys.trips(orgId()),
    queryFn: () => fetchFn(orgId()),
    enabled: !!orgId(),
  }));
}

/**
 * Custom hook for truck list queries
 */
export function useTrucksQuery(orgId: Accessor<string>, fetchFn: (id: string) => Promise<any[]>) {
  return createQuery(() => ({
    queryKey: queryKeys.trucks(orgId()),
    queryFn: () => fetchFn(orgId()),
    enabled: !!orgId(),
  }));
}

/**
 * Custom hook for driver list queries
 */
export function useDriversQuery(orgId: Accessor<string>, fetchFn: (id: string) => Promise<any[]>) {
  return createQuery(() => ({
    queryKey: queryKeys.drivers(orgId()),
    queryFn: () => fetchFn(orgId()),
    enabled: !!orgId(),
  }));
}

/**
 * Mutation helper to invalidate queries upon mutation completion
 */
export function useInvalidateFleetQueries() {
  const queryClient = useQueryClient();
  return (orgId: string) => {
    queryClient.invalidateQueries({ queryKey: queryKeys.trips(orgId) });
    queryClient.invalidateQueries({ queryKey: queryKeys.trucks(orgId) });
    queryClient.invalidateQueries({ queryKey: queryKeys.drivers(orgId) });
    queryClient.invalidateQueries({ queryKey: queryKeys.expenses(orgId) });
  };
}
