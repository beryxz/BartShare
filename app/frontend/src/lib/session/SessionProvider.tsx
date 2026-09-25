'use client';

import { apiGet } from '@/lib/api/client';
import { USERS_KEY } from '@/lib/api/keys';
import { pageOf } from '@/lib/api/page';
import { ApiUser, Paginated } from '@/lib/api/types';
import {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useState,
} from 'react';
import useSWR from 'swr';
import { chooseActingUser } from './choose';
import { clearUserCookie, readUserCookie, writeUserCookie } from './cookie';

type Session = {
    actingUser: ApiUser | null;
    users: ApiUser[];
    switchTo: (id: string) => void;
    refresh: () => Promise<ApiUser | null>;
    isLoading: boolean;
    error: unknown;
};

const SessionContext = createContext<Session | null>(null);

export function SessionProvider({ children }: { children: React.ReactNode }) {
    // Not user-scoped, and the only key that isn't: see USERS_KEY.
    const { data, error, isLoading, mutate } = useSWR(USERS_KEY, () =>
        apiGet<Paginated<ApiUser>>('/users').then(pageOf),
    );

    const [actingUserId, setActingUserId] = useState<string | null>(null);
    const [cookieResolved, setCookieResolved] = useState(false);

    // After mount, and after the list arrives: the cookie does not exist during
    // the server render and can only be validated against the list.
    useEffect(() => {
        if (!data) return;
        const fromCookie = readUserCookie(document.cookie);
        const chosen = chooseActingUser(data.items, fromCookie);
        // A cookie pointing at a deleted user would 401 on every call, so it is
        // cleared and re-picked rather than left as a dead session.
        if (fromCookie && chosen?.id !== fromCookie) clearUserCookie();
        if (chosen) writeUserCookie(chosen.id);
        // Hydrating from an external system once per user-list identity.
        // Depending on `data` and not a derived array: a fresh `[]` loops.
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setActingUserId(chosen?.id ?? null);
        setCookieResolved(true);
    }, [data]);

    const switchTo = useCallback((id: string) => {
        writeUserCookie(id);
        setActingUserId(id);
    }, []);

    const refresh = useCallback(async () => {
        const next = await mutate();
        const chosen = chooseActingUser(
            next?.items ?? [],
            readUserCookie(document.cookie),
        );
        if (chosen) writeUserCookie(chosen.id);
        return chosen;
    }, [mutate]);

    const users = useMemo(() => data?.items ?? [], [data]);

    const value = useMemo<Session>(
        () => ({
            actingUser: users.find(u => u.id === actingUserId) ?? null,
            users,
            switchTo,
            refresh,
            // The cookie resolves in the tick after the list arrives, and
            // rendering a screen in between would fetch under no identity.
            isLoading: isLoading || (data !== undefined && !cookieResolved),
            error,
        }),
        [
            users,
            actingUserId,
            data,
            switchTo,
            refresh,
            isLoading,
            cookieResolved,
            error,
        ],
    );

    return (
        <SessionContext.Provider value={value}>
            {children}
        </SessionContext.Provider>
    );
}

export function useSession(): Session {
    const ctx = useContext(SessionContext);
    if (!ctx)
        throw new Error('useSession must be used inside a SessionProvider');
    return ctx;
}
