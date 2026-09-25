'use client';

import {
    listMyResourceFacets,
    listResourceFacets,
    listUserFacets,
} from '@/features/resources/api';
import { swrKey } from '@/lib/api/keys';
import { AttrVocabulary } from '@/lib/bart/vocabulary';
import { useSession } from '@/lib/session/SessionProvider';
import useSWR from 'swr';

/** Whose vocabulary an editor suggests from. A rule's resource pattern
 *  describes the author's own rows, an exchange term what somebody else gives
 *  back, so the two need different corpora. */
export type AttrScope =
    'my-resources' | 'all-resources' | 'other-resources' | 'parties';

/** Stable identity for the empty case, so a loading or failed fetch does not
 *  churn every memo downstream. */
const NO_VOCABULARY: AttrVocabulary = [];

/**
 * Observed attribute keys and values for one editor's scope. Server-computed,
 * never derived from a page of rows the client holds, which would silently omit
 * keys that exist. A failed fetch costs suggestions and nothing else, so the
 * hook has no error surface: every field stays free text.
 */
export function useAttrVocabulary(scope: AttrScope): AttrVocabulary {
    const { actingUser } = useSession();

    const params: Record<string, string> =
        scope === 'other-resources' && actingUser
            ? { excludeUserId: actingUser.id }
            : {};
    const path =
        scope === 'parties'
            ? '/users/facets'
            : scope === 'my-resources'
              ? '/me/resources/facets'
              : '/resources/facets';

    const swr = useSWR(swrKey(actingUser?.id ?? null, path, params), () => {
        if (scope === 'parties') return listUserFacets({});
        if (scope === 'my-resources') return listMyResourceFacets({});
        return listResourceFacets(params);
    });

    return swr.data ?? NO_VOCABULARY;
}
