'use client';

import { getGroup } from '@/features/network/api';
import { useMyGroups } from '@/hooks/use-my-groups';
import { swrKey } from '@/lib/api/keys';
import { groupIdSpans } from '@/lib/bart/highlight';
import { useSession } from '@/lib/session/SessionProvider';
import { useMemo } from 'react';
import useSWR from 'swr';

/**
 * Group id to display name, for a group named in a condition.
 *
 * The caller's own memberships arrive in one call, but a rule may name a group
 * the author is not in, so every id they do not explain is looked up. One SWR
 * key over the sorted id set, since hooks cannot loop over a list that changes
 * as the text is edited. An unresolved id renders as itself, which is never
 * wrong, only less readable.
 */
export function useGroupNames(source: string): ReadonlyMap<string, string> {
    const { actingUser } = useSession();
    const mine = useMyGroups();

    const memberships = useMemo(
        () => new Map(mine.map(group => [group.id, group.name])),
        [mine],
    );

    // Serialised, not an array: a fresh array identity on every keystroke
    // would remint the SWR key even when the ids are unchanged.
    const unresolved = useMemo(() => {
        const ids = new Set(groupIdSpans(source).map(span => span.id));
        return [...ids].filter(id => !memberships.has(id)).sort();
    }, [source, memberships]);
    const unresolvedKey = unresolved.join(',');

    const looked = useSWR(
        unresolvedKey === ''
            ? null
            : swrKey(actingUser?.id ?? null, '/groups/by-id', {
                  ids: unresolvedKey,
              }),
        async () => {
            const results = await Promise.all(
                unresolved.map(id =>
                    getGroup(id)
                        .then(group => [group.id, group.name] as const)
                        // A deleted or mistyped id has no name; it renders raw.
                        .catch(() => null),
                ),
            );
            return results.filter(entry => entry !== null);
        },
    );

    return useMemo(() => {
        const names = new Map(memberships);
        for (const [id, name] of looked.data ?? []) names.set(id, name);
        return names;
    }, [memberships, looked.data]);
}
