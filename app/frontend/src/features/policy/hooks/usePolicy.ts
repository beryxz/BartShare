'use client';

import { swrKey } from '@/lib/api/keys';
import { PolicyRule } from '@/lib/bart/rule';
import { BartAttrs } from '@/lib/bart/types';
import { useSession } from '@/lib/session/SessionProvider';
import { useMemo } from 'react';
import useSWR from 'swr';
import { deleteMe, getMe, getMyContext, patchMe, toPolicyRules } from '../api';

/**
 * Two independent reads, the policy and the context the evaluator computes for
 * it, on separate keys: losing the diagnostic panel must not stop someone
 * editing their policy.
 *
 * The savers let `ApiError` through, since only the caller knows where to
 * render it. `saveRules` revalidates `/me`, `saveAttrs` also the session user
 * list. No fan-out to `/me/shared`: that screen revalidates on mount.
 */
export function useMyPolicy() {
    const { actingUser, refresh } = useSession();
    const me = useSWR(swrKey(actingUser?.id ?? null, '/me'), getMe);
    const context = useSWR(
        swrKey(actingUser?.id ?? null, '/me/context'),
        getMyContext,
    );

    const rules = useMemo(
        () => (me.data ? toPolicyRules(me.data.rules) : []),
        [me.data],
    );

    async function saveAttrs(next: BartAttrs) {
        await patchMe({ attrs: next });
        // Best-effort: a bound `mutate()` rejects if revalidation throws and
        // `shouldRetryOnError: false` never self-heals, reading as a failure.
        await me.mutate().catch(() => {});
        // `attrs` carries `username`, which the sidebar renders off the
        // unscoped `USERS_KEY`; without this a rename survives until a reload.
        await refresh().catch(() => {});
    }

    async function saveRules(next: PolicyRule[]) {
        await patchMe({ rules: next.map(rule => rule.source) });
        // Best-effort revalidation: same reasoning as `saveAttrs` above.
        await me.mutate().catch(() => {});
    }

    async function deleteAccount() {
        await deleteMe();
        // No `switchTo`: SessionProvider re-picks a remaining user, or
        // `FirstRunLanding` if none. The delete committed; a failure reloads.
        await refresh().catch(() => window.location.reload());
    }

    return {
        actingUserId: actingUser?.id ?? null,
        attrs: me.data?.attrs ?? {},
        rules,
        saveAttrs,
        saveRules,
        deleteAccount,
        context: context.data,
        isLoading: me.isLoading,
        error: me.error,
        contextError: context.error,
    };
}

/**
 * Just the acting user's rules, for screens that need to reason about them
 * without wanting the derived-context read `useMyPolicy` also performs.
 *
 * Shares `useMyPolicy`'s SWR key, so mounting both costs one request.
 */
export function useMyRules() {
    const { actingUser } = useSession();
    const me = useSWR(swrKey(actingUser?.id ?? null, '/me'), getMe);
    const rules = useMemo(
        () => (me.data ? toPolicyRules(me.data.rules) : []),
        [me.data],
    );
    return { rules, isLoading: me.isLoading, error: me.error };
}

/**
 * The context vocabulary alone: `GET /me/context`'s `names`, which is the
 * self-describing list of keys a rule may reference. Shares `useMyPolicy`'s
 * key, so mounting both costs one request.
 */
export function useMyContextNames() {
    const { actingUser } = useSession();
    const context = useSWR(
        swrKey(actingUser?.id ?? null, '/me/context'),
        getMyContext,
    );
    return context.data?.names ?? [];
}
