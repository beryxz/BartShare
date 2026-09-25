'use client';

import { swrKey } from '@/lib/api/keys';
import { useSession } from '@/lib/session/SessionProvider';
import useSWR from 'swr';
import { getAccountSummary } from '../api';

/**
 * The counts the delete confirmation names, on their own SWR key so nothing
 * fetches them on an ordinary `/policy` load: `DangerZoneCard` mounts the
 * dialog only while it is open.
 */
export function useAccountSummary() {
    const { actingUser } = useSession();
    const { data, error, isLoading } = useSWR(
        swrKey(actingUser?.id ?? null, '/me/account-summary'),
        getAccountSummary,
    );
    return { summary: data, isLoading, error };
}
