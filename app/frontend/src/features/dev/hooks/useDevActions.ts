'use client';

import { ApiUser } from '@/lib/api/types';
import { useSession } from '@/lib/session/SessionProvider';
import { useCallback } from 'react';
import { mutate } from 'swr';
import {
    ResetCounts,
    resetDatabase,
    ScenarioCounts,
    seedScenario,
} from '../api';
import { isDatabaseScopedKey } from '../cache';

/**
 * Seed and reset both wipe database-scoped SWR keys, then refresh the acting
 * user. `revalidate: false`, since `refresh` below refetches what is actually
 * on screen. `settle`'s own catch reloads rather than rethrowing: the write
 * already committed, and a failed revalidation never self-heals
 * (`shouldRetryOnError: false`).
 */
export function useDevActions(): {
    seed: (id: string) => Promise<{
        created: ScenarioCounts;
        actingUser: ApiUser | null;
    }>;
    reset: () => Promise<ResetCounts>;
} {
    const { refresh } = useSession();

    const settle = useCallback(async () => {
        await mutate(isDatabaseScopedKey, undefined, { revalidate: false });
        return refresh().catch(() => {
            window.location.reload();
            return null;
        });
    }, [refresh]);

    const seed = useCallback(
        async (id: string) => {
            const result = await seedScenario(id);
            const actingUser = await settle();
            return { created: result.created, actingUser };
        },
        [settle],
    );

    const reset = useCallback(async () => {
        const deleted = await resetDatabase();
        await settle();
        return deleted;
    }, [settle]);

    return { seed, reset };
}
