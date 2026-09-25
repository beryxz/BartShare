'use client';

import { EVENTS_KEY } from '@/lib/api/keys';
import { PagedList } from '@/lib/api/page';
import useSWR from 'swr';
import { ApiLogEvent, listEvents } from '../api';

/**
 * One page of the log. The key is a plain path, not `swrKey(...)`:
 * `/dev/events` is public and this screen renders outside `SessionGate`,
 * where there may be no acting user and a scoped key would be null and never
 * fetch. It stays database-scoped though, so `isDatabaseScopedKey` still
 * drops it after a seed or reset.
 *
 * `keepPreviousData` so stepping a page does not blank the table.
 */
export function useEvents(page: number): {
    events: PagedList<ApiLogEvent> | undefined;
    isLoading: boolean;
    isValidating: boolean;
    error: unknown;
    refresh: () => void;
} {
    const { data, error, isLoading, isValidating, mutate } = useSWR(
        `${EVENTS_KEY}?page=${page}`,
        () => listEvents(page),
        { keepPreviousData: true },
    );

    return {
        events: data,
        isLoading,
        isValidating,
        error,
        // `mutate()` rejects on a failed revalidation and never retries
        // (`shouldRetryOnError: false`); `error` above already surfaces it.
        refresh: () => {
            void mutate().catch(() => {});
        },
    };
}
