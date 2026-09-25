'use client';

import { STATUS_KEY } from '@/lib/api/keys';
import useSWR from 'swr';
import { ApiServiceStatus, getServiceStatus } from '../api';

/**
 * Whether the backend's dependencies are reachable. `error` means the
 * BACKEND itself could not be reached; a down database or evaluator arrives
 * as ordinary data with `status: 'down'`.
 */
export function useServiceStatus(): {
    services: ApiServiceStatus[] | undefined;
    roundTripMs: number | undefined;
    isLoading: boolean;
    isValidating: boolean;
    error: unknown;
    refresh: () => void;
} {
    const { data, error, isLoading, isValidating, mutate } = useSWR(
        STATUS_KEY,
        getServiceStatus,
    );

    return {
        services: data?.services,
        roundTripMs: data?.roundTripMs,
        isLoading,
        isValidating,
        error,
        // Swallowed for the same reason as `useEvents.refresh`: a rejected
        // revalidation is already reported through `error`.
        refresh: () => {
            void mutate().catch(() => {});
        },
    };
}
