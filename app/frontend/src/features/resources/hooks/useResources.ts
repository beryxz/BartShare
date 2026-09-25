'use client';

import { swrKey } from '@/lib/api/keys';
import { useSession } from '@/lib/session/SessionProvider';
import useSWR, { useSWRConfig } from 'swr';
import {
    clearContent,
    createResource,
    deleteResource,
    listAll,
    listMine,
    listMyResourceFacets,
    listResourceFacets,
    listSharedWith,
    ResourceValues,
    updateResource,
    uploadContent,
} from '../api';

export type { ResourceValues };

/**
 * Every read here sets `keepPreviousData`, so a filter keystroke or a page step
 * holds the rows already on screen instead of blanking to skeletons. That is
 * only safe because `SessionGate` remounts the content region on an acting-user
 * change; SWR would otherwise keep the previous data across the switch too.
 *
 * `params: null` skips the fetch, for a caller that only wants the read while
 * something else (a popover) is open.
 */
export function useMyResources(params: Record<string, string | number> | null) {
    const { actingUser } = useSession();
    const { mutate: globalMutate } = useSWRConfig();
    const swr = useSWR(
        params === null
            ? null
            : swrKey(actingUser?.id ?? null, '/me/resources', params),
        () => listMine(params!),
        { keepPreviousData: true },
    );

    /**
     * The list and the 'mine' facet chips are two keys over one corpus, so a
     * write refreshes both. A predicate rather than a literal key, since the
     * facets key carries the screen's active params, which this hook does
     * not know. `key[0]` pins the acting user: other users' entries stay
     * warm in the cache, and revalidating one would overwrite it with this
     * user's data. The 'all' scope stays out: `/explore` excludes the acting
     * user, and `/shared`'s facets are already broader than its list.
     */
    async function refreshAll() {
        await Promise.all([
            swr.mutate(),
            globalMutate(
                key =>
                    Array.isArray(key) &&
                    key[0] === actingUser?.id &&
                    typeof key[1] === 'string' &&
                    key[1].startsWith('/me/resources/facets'),
            ),
        ]);
    }

    async function create(values: ResourceValues) {
        const created = await createResource(values);
        await refreshAll();
        return created;
    }

    async function update(id: string, values: ResourceValues) {
        const updated = await updateResource(id, values);
        await refreshAll();
        return updated;
    }

    async function remove(id: string) {
        const removed = await deleteResource(id);
        await refreshAll();
        return removed;
    }

    async function upload(id: string, file: File) {
        const updated = await uploadContent(id, file);
        await refreshAll();
        return updated;
    }

    async function clear(id: string) {
        const cleared = await clearContent(id);
        await refreshAll();
        return cleared;
    }

    return {
        ...swr,
        create,
        update,
        remove,
        upload,
        clear,
        refresh: swr.mutate,
    };
}

export function useAllResources(params: Record<string, string | number>) {
    const { actingUser } = useSession();
    return useSWR(
        swrKey(actingUser?.id ?? null, '/resources', params),
        () => listAll(params),
        { keepPreviousData: true },
    );
}

export function useSharedWithMe(params: Record<string, string | number>) {
    const { actingUser } = useSession();
    return useSWR(
        swrKey(actingUser?.id ?? null, '/me/shared', params),
        () => listSharedWith(params),
        { keepPreviousData: true },
    );
}

/**
 * Facet chips for a resource list. `scope` picks the endpoint so the chips
 * describe the same set the list is showing.
 *
 * Neither facet endpoint accepts `page`, so it is dropped from the key and
 * the request: otherwise every page step would mint a new cache key and
 * refetch a byte-identical response.
 */
export function useResourceFacets(
    params: Record<string, string | number>,
    scope: 'all' | 'mine',
) {
    const { actingUser } = useSession();
    const facetParams = { ...params };
    delete facetParams.page;
    const path =
        scope === 'mine' ? '/me/resources/facets' : '/resources/facets';
    return useSWR(
        swrKey(actingUser?.id ?? null, path, facetParams),
        () =>
            scope === 'mine'
                ? listMyResourceFacets(facetParams)
                : listResourceFacets(facetParams),
        { keepPreviousData: true },
    );
}
