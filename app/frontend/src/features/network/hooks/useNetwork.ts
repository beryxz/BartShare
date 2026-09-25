'use client';

import { swrKey } from '@/lib/api/keys';
import { useSession } from '@/lib/session/SessionProvider';
import useSWR from 'swr';
import {
    connect,
    createGroup,
    deleteGroup,
    disconnect,
    joinGroup,
    leaveGroup,
    listAllGroups,
    listConnectionsAll,
    listMyGroupsAll,
    listUsers,
    type GroupValues,
    updateGroup,
} from '../api';

/**
 * The screen renders "every user, and whether I am connected", which is a
 * join of the paged public `/users` list against the caller's full
 * `/me/connections` list. Only the public side is paged: see
 * `listConnectionsAll` for why the membership side is walked in full instead.
 */
export function useConnections(params: Record<string, string | number>) {
    const { actingUser } = useSession();
    const swr = useSWR(
        swrKey(actingUser?.id ?? null, '/me/connections', params),
        async () => {
            const [page, mine] = await Promise.all([
                listUsers(params),
                listConnectionsAll(),
            ]);
            const connected = new Set(mine.items.map(u => u.id));
            return {
                ...page,
                rows: page.items.map(user => ({
                    user,
                    connected: connected.has(user.id),
                })),
                connectionsComplete: mine.complete,
            };
        },
        { keepPreviousData: true },
    );
    // `mutate()` rejects on a failed revalidation and never retries
    // (`shouldRetryOnError: false`); `error` above already surfaces it.
    const revalidate = () => swr.mutate().catch(() => {});

    return {
        ...swr,
        async connectTo(userId: string) {
            await connect(userId);
            await revalidate();
        },
        async disconnectFrom(userId: string) {
            await disconnect(userId);
            await revalidate();
        },
    };
}

/**
 * Same join as `useConnections`, over "every group, and whether I am in it":
 * the paged public `/groups` list against the caller's full `/me/groups`
 * list.
 */
export function useGroups(params: Record<string, string | number>) {
    const { actingUser } = useSession();
    const swr = useSWR(
        swrKey(actingUser?.id ?? null, '/groups', params),
        async () => {
            const [page, mine] = await Promise.all([
                listAllGroups(params),
                listMyGroupsAll(),
            ]);
            const joined = new Set(mine.items.map(group => group.id));
            return {
                ...page,
                rows: page.items.map(group => ({
                    group,
                    joined: joined.has(group.id),
                })),
                membershipsComplete: mine.complete,
            };
        },
        { keepPreviousData: true },
    );
    // Same reason as `useConnections`, plus: for `create`, mistaking a failed
    // refetch for a failed write invites a retry that makes a second group.
    const revalidate = () => swr.mutate().catch(() => {});

    return {
        ...swr,
        async join(groupId: string) {
            await joinGroup(groupId);
            await revalidate();
        },
        async leave(groupId: string) {
            await leaveGroup(groupId);
            await revalidate();
        },
        async create(values: GroupValues) {
            await createGroup(values);
            await revalidate();
        },
        async update(groupId: string, values: GroupValues) {
            await updateGroup(groupId, values);
            await revalidate();
        },
        async destroy(groupId: string) {
            await deleteGroup(groupId);
            await revalidate();
        },
    };
}
