'use client';

import { listMyGroupsAll } from '@/features/network/api';
import { swrKey } from '@/lib/api/keys';
import { ApiGroup } from '@/lib/api/types';
import { useSession } from '@/lib/session/SessionProvider';
import useSWR from 'swr';

/** Stable identity for the empty case, so a loading or failed fetch does not
 *  churn every memo downstream of this hook. */
const NO_GROUPS: ApiGroup[] = [];

/**
 * Every group the acting user belongs to. One hook rather than a `useSWR` per
 * caller, so the callers share a cache entry instead of racing under keys that
 * could drift. Returns an empty list while loading or on error: every caller
 * offers help with it, none gates an action on it.
 */
export function useMyGroups(): ApiGroup[] {
    const { actingUser } = useSession();
    const swr = useSWR(
        swrKey(actingUser?.id ?? null, '/me/groups/all'),
        listMyGroupsAll,
    );
    return swr.data?.items ?? NO_GROUPS;
}
