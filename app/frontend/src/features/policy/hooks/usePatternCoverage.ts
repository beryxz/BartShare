'use client';

import { fetchRuleCoverage } from '@/features/resources/api';
import { useDebouncedValue } from '@/hooks/use-debounced-value';
import { swrKey } from '@/lib/api/keys';
import { BartAttrs } from '@/lib/bart/types';
import { useSession } from '@/lib/session/SessionProvider';
import useSWR from 'swr';

/** Long enough that typing a key/value pair costs one request, not eight. */
const DEBOUNCE_MS = 300;

/**
 * Coverage for the one pattern currently being edited.
 *
 * Server-side rather than `coveredBy` in the browser, like `useRuleCoverage`:
 * the client holds one page of resources, so a client-side denominator would
 * silently be wrong for anyone with more. An empty pattern asks nothing, since
 * it formally covers only an attribute-less resource and would report "covers
 * none of your N" against an untouched rule.
 */
export function usePatternCoverage(pattern: BartAttrs) {
    const { actingUser } = useSession();
    // Serialised before debouncing: the object identity changes on every
    // keystroke even when the content, which decides the re-fetch, does not.
    const serialised = useDebouncedValue(JSON.stringify(pattern), DEBOUNCE_MS);
    const settled = JSON.parse(serialised) as BartAttrs;
    const empty = Object.keys(settled).length === 0;

    const swr = useSWR(
        empty
            ? null
            : swrKey(actingUser?.id ?? null, '/me/rules/coverage', {
                  patterns: serialised,
              }),
        () => fetchRuleCoverage([settled]),
    );

    return {
        total: swr.data?.total ?? 0,
        entry: swr.data?.coverage[0],
        isLoading: swr.isLoading,
    };
}
