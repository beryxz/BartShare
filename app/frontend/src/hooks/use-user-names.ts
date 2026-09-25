'use client';

import { useSession } from '@/lib/session/SessionProvider';
import { useMemo } from 'react';
import { userName } from '@/lib/bart/naming';

/**
 * User id to display name, for a `userId` written into a rule. Reads the
 * session's page 1 of `/users`, so it costs no request and is necessarily
 * partial; an unresolved id renders as itself, less readable but never wrong.
 */
export function useUserNames(): ReadonlyMap<string, string> {
    const { users } = useSession();
    return useMemo(
        () => new Map(users.map(user => [user.id, userName(user)])),
        [users],
    );
}
