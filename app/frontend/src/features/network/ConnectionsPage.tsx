'use client';

import { PartyRef } from '@/components/bart/PartyRef';
import { PageHeader } from '@/components/shell/PageHeader';
import { ClearFilterButton } from '@/components/states/ClearFilterButton';
import { EmptyState } from '@/components/states/EmptyState';
import { ErrorState } from '@/components/states/ErrorState';
import { FilterInput } from '@/components/states/FilterInput';
import { ListSkeleton } from '@/components/states/ListSkeleton';
import { Pager } from '@/components/states/Pager';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { toastWriteError } from '@/lib/toast';
import { useListQuery } from '@/lib/api/query';
import { useSession } from '@/lib/session/SessionProvider';
import { useState } from 'react';
import { toast } from 'sonner';
import { ContextHint } from './components/ContextHint';
import { useConnections } from './hooks/useNetwork';
import { AttributeList } from '@/components/bart/AttributeList';
import { userName } from '@/lib/bart/naming';

export function ConnectionsPage() {
    const { actingUser } = useSession();
    const query = useListQuery({ username: '' });
    const { data, error, isLoading, connectTo, disconnectFrom } =
        useConnections(query.params);
    const [busyId, setBusyId] = useState<string | null>(null);

    // /users has no self-exclusion param, so the acting user is filtered out
    // of these rows client-side; the server's `total` still counts that row.
    const others = (data?.rows ?? []).filter(
        row => row.user.id !== actingUser?.id,
    );
    const filtered = query.appliedFilters.username !== '';
    const busy = (query.isPending || isLoading) && data !== undefined;

    // No optimistic update: the premise is "ask the engine every time". The toast
    // warns that this write changes an attribute the evaluator reads.
    async function toggle(userId: string, name: string, connected: boolean) {
        setBusyId(userId);
        try {
            if (connected) {
                await disconnectFrom(userId);
                toast.success(
                    `Disconnected from ${name}. Your connections context no longer includes them.`,
                );
            } else {
                await connectTo(userId);
                toast.success(
                    `Connected to ${name}. Your connections context now includes them.`,
                );
            }
        } catch (failure) {
            toastWriteError(failure);
        } finally {
            setBusyId(null);
        }
    }

    // The filter input renders above a region that swaps states rather than
    // an early return, which would unmount it mid-keystroke; skeleton tests
    // `data`, not `isLoading`.
    return (
        <>
            <PageHeader
                title="Connections"
                description="Mutual by design: connecting writes both directions."
            />
            <ContextHint attribute="connections" />
            <FilterInput
                placeholder="Filter by username…"
                value={query.filters.username}
                busy={busy}
                className="mb-4 max-w-xs"
                onChange={e => query.setFilters({ username: e.target.value })}
            />
            <div aria-busy={busy}>
                {error ? (
                    <ErrorState error={error} />
                ) : !data ? (
                    <ListSkeleton rows={3} />
                ) : others.length === 0 && filtered ? (
                    <EmptyState
                        title="No parties match your filter"
                        description="Try a different search, or clear the filter to see everyone."
                        action={
                            <ClearFilterButton
                                onClear={() =>
                                    query.commitFilters({ username: '' })
                                }
                            />
                        }
                    />
                ) : others.length === 0 ? (
                    <EmptyState title="No other parties" />
                ) : (
                    <div className="space-y-2">
                        {data.connectionsComplete === false && (
                            <p className="text-xs text-muted-foreground">
                                You have more connections than this screen can
                                check, so some rows may show as not connected.
                            </p>
                        )}
                        {others.map(({ user, connected }) => (
                            <Card key={user.id}>
                                <CardContent className="flex items-center gap-3 p-3">
                                    {/* No party index: a party number is
                                        per-evaluation, not a list slot. */}
                                    <div className="flex flex-col gap-3 max-w-lg">
                                        <PartyRef user={user} />
                                        <AttributeList
                                            attrs={user.attrs}
                                            max={5}
                                        />
                                    </div>
                                    <Button
                                        variant={
                                            connected ? 'outline' : 'default'
                                        }
                                        size="sm"
                                        className="ml-auto"
                                        disabled={busyId === user.id}
                                        onClick={() =>
                                            toggle(
                                                user.id,
                                                userName(user),
                                                connected,
                                            )
                                        }
                                    >
                                        {connected ? 'Disconnect' : 'Connect'}
                                    </Button>
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                )}
            </div>
            {data && (
                <Pager
                    page={data.page}
                    total={data.total}
                    totalPages={data.totalPages}
                    onPage={query.setPage}
                />
            )}
        </>
    );
}
