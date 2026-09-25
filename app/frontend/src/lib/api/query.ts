'use client';

import { useCallback, useEffect, useState } from 'react';
import { Paginated } from './types';

export type ListFilters = Record<string, string | undefined>;

/**
 * The query params for one page of a list, with empty filters removed. `?name=`
 * would reach the backend as a filter matching nothing, and would make "no
 * filter" and "cleared filter" two different SWR cache entries.
 */
export function listParams(
    page: number,
    filters: ListFilters,
): Record<string, string | number> {
    const params: Record<string, string | number> = { page };
    for (const [key, value] of Object.entries(filters))
        if (value) params[key] = value;
    return params;
}

/**
 * A path with its query string. Keys are sorted so the same logical query
 * always produces the same string: the same property `swrKey` relies on.
 */
export function withQuery(
    path: string,
    params: Record<string, string | number>,
): string {
    const keys = Object.keys(params).sort();
    if (keys.length === 0) return path;
    const query = keys
        .map(k => `${encodeURIComponent(k)}=${encodeURIComponent(params[k])}`)
        .join('&');
    return `${path}?${query}`;
}

/** How many pages `fetchAllPages` walks before giving up, so it can never
 *  become an unbounded fetch. At the backend's page size of 50, 500 rows. */
export const MAX_WALKED_PAGES = 10;

/**
 * Every page of a list, concatenated. For a caller's own membership lists
 * (`/me/groups`, `/me/connections`) only, which the screens join against a
 * paged public list: paging those renders a membership past page 1 as "not
 * joined". `complete` is false when the cap stopped the walk.
 */
export async function fetchAllPages<T>(
    fetchPage: (page: number) => Promise<Paginated<T>>,
): Promise<{ items: T[]; complete: boolean }> {
    const first = await fetchPage(1);
    const items = [...first.data];
    const totalPages = Math.min(first.page.totalPages, MAX_WALKED_PAGES);

    for (let page = 2; page <= totalPages; page++) {
        const next = await fetchPage(page);
        items.push(...next.data);
    }

    return { items, complete: first.page.totalPages <= MAX_WALKED_PAGES };
}

/** How long a typed filter waits before reaching the backend: one request per
 *  word, which matters most on `/me/shared`, one live evaluation per candidate. */
export const FILTER_DEBOUNCE_MS = 250;

/**
 * Whether two filter maps hold the same values. A value compare: every
 * keystroke builds a fresh object, so reference equality fires a request for
 * the filter already on screen after a letter is typed and deleted.
 */
export function sameFilters(a: ListFilters, b: ListFilters): boolean {
    const keys = Object.keys(a);
    return (
        keys.length === Object.keys(b).length && keys.every(k => a[k] === b[k])
    );
}

/**
 * Per-screen `{page, filters}` state, split into what is being typed and what
 * has been asked for: `applied` feeds the SWR key, and without the split every
 * character mints an unseen key and blanks the screen to skeletons mid-word.
 * Page and filters commit together at page 1, since resetting the page eagerly
 * fires a second request for the old filter. `commitFilters` skips the wait for
 * a change that arrives complete: a facet chip, a "Clear filter" button.
 */
export function useListQuery<F extends ListFilters>(initial: F) {
    const [filters, setFilters] = useState<F>(initial);
    const [applied, setApplied] = useState<{ page: number; filters: F }>({
        page: 1,
        filters: initial,
    });

    useEffect(() => {
        if (sameFilters(filters, applied.filters)) return;
        const timer = setTimeout(
            () => setApplied({ page: 1, filters }),
            FILTER_DEBOUNCE_MS,
        );
        return () => clearTimeout(timer);
    }, [filters, applied.filters]);

    const setPage = useCallback(
        (page: number) => setApplied(prev => ({ ...prev, page })),
        [],
    );

    const commitFilters = useCallback((next: F) => {
        setFilters(next);
        setApplied({ page: 1, filters: next });
    }, []);

    return {
        page: applied.page,
        setPage,
        /** Immediate: what the input renders. Never reaches `params`. */
        filters,
        setFilters,
        commitFilters,
        /** What the rows on screen were fetched for. Empty-state copy branches
         *  on this: during the debounce window `filters` disagrees and would
         *  claim "nothing here yet" about rows fetched under a filter. */
        appliedFilters: applied.filters,
        params: listParams(applied.page, applied.filters),
        /** A typed change is waiting out the debounce. */
        isPending: !sameFilters(filters, applied.filters),
    };
}
