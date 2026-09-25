'use client';

import { PageHeader } from '@/components/shell/PageHeader';
import { ClearFilterButton } from '@/components/states/ClearFilterButton';
import { EmptyState } from '@/components/states/EmptyState';
import { ErrorState } from '@/components/states/ErrorState';
import { FilterInput } from '@/components/states/FilterInput';
import { ListSkeleton } from '@/components/states/ListSkeleton';
import { Pager } from '@/components/states/Pager';
import { Button } from '@/components/ui/button';
import { isStaleWriteError, staleWriteMessage } from '@/lib/api/errors';
import { toastWriteError } from '@/lib/toast';
import { useListQuery } from '@/lib/api/query';
import { ApiGroup } from '@/lib/api/types';
import { useState } from 'react';
import { toast } from 'sonner';
import { GroupValues } from './api';
import { ContextHint } from './components/ContextHint';
import { GroupCard } from './components/GroupCard';
import { GroupFormDialog } from './components/GroupFormDialog';
import { useGroups } from './hooks/useNetwork';

export function GroupsPage() {
    const query = useListQuery({ name: '' });
    const {
        data,
        error,
        isLoading,
        join,
        leave,
        create,
        update,
        destroy,
        mutate,
    } = useGroups(query.params);
    const [busyId, setBusyId] = useState<string | null>(null);
    const [creating, setCreating] = useState(false);
    const filtered = query.appliedFilters.name !== '';
    const busy = (query.isPending || isLoading) && data !== undefined;
    // Same reason as `useConnections`, plus: every call site below already
    // catches the write failure, so a second rejection lands nowhere useful.
    const revalidate = () => mutate().catch(() => {});

    async function toggle(groupId: string, name: string, joined: boolean) {
        setBusyId(groupId);
        try {
            if (joined) {
                await leave(groupId);
                toast.success(
                    `Left ${name}. Your groups context no longer includes it.`,
                );
            } else {
                await join(groupId);
                toast.success(
                    `Joined ${name}. Your groups context now includes it.`,
                );
            }
        } catch (failure) {
            if (isStaleWriteError(failure)) {
                toast.error(staleWriteMessage(failure));
                await revalidate();
            } else {
                toastWriteError(failure);
            }
        } finally {
            setBusyId(null);
        }
    }

    async function handleCreate(values: GroupValues) {
        // No catch: a rejection must reach the dialog, which renders it
        // inline and stays open; the toast only fires on success.
        await create(values);
        toast.success(
            `Created “${values.name}” and joined it. The list is sorted by name, so it may be on another page.`,
        );
    }

    async function handleUpdate(group: ApiGroup, values: GroupValues) {
        setBusyId(group.id);
        try {
            await update(group.id, values);
            toast.success(`Saved “${values.name}”.`);
        } catch (failure) {
            // A stale row isn't the user's to fix in the form: report it,
            // revalidate so the row stops offering the action, and close.
            if (!isStaleWriteError(failure)) throw failure;
            toast.error(staleWriteMessage(failure));
            await revalidate();
        } finally {
            setBusyId(null);
        }
    }

    async function handleDelete(group: ApiGroup) {
        setBusyId(group.id);
        try {
            await destroy(group.id);
            toast.success(`Deleted “${group.name}”.`);
        } catch (failure) {
            if (isStaleWriteError(failure)) {
                toast.error(staleWriteMessage(failure));
                await revalidate();
            } else {
                toastWriteError(failure);
            }
        } finally {
            setBusyId(null);
        }
    }

    // This region swaps states instead of an early return, keeping the filter
    // mounted mid-keystroke; the skeleton check is `data`, not `isLoading`.
    return (
        <>
            <PageHeader
                title="Groups"
                description="Membership is open: anyone may join any group, and any member may edit or delete it."
                actions={
                    <Button size="sm" onClick={() => setCreating(true)}>
                        New group
                    </Button>
                }
            />
            {creating && (
                <GroupFormDialog
                    onClose={() => setCreating(false)}
                    onSubmit={handleCreate}
                />
            )}
            <ContextHint attribute="groups" />
            <FilterInput
                placeholder="Filter by name…"
                value={query.filters.name}
                busy={busy}
                className="mb-4 max-w-xs"
                onChange={e => query.setFilters({ name: e.target.value })}
            />
            <div aria-busy={busy}>
                {error ? (
                    <ErrorState error={error} />
                ) : !data ? (
                    <ListSkeleton rows={3} />
                ) : data.rows.length === 0 && filtered ? (
                    <EmptyState
                        title="No groups match your filter"
                        description="Try a different search, or clear the filter to see every group."
                        action={
                            <ClearFilterButton
                                onClear={() =>
                                    query.commitFilters({ name: '' })
                                }
                            />
                        }
                    />
                ) : data.rows.length === 0 ? (
                    <EmptyState title="No groups yet" />
                ) : (
                    <div className="space-y-2">
                        {data.membershipsComplete === false && (
                            <p className="text-xs text-muted-foreground">
                                You belong to more groups than this screen can
                                check, so some rows may show as not joined, and
                                their Edit and Delete actions stay hidden.
                            </p>
                        )}
                        {data.rows.map(({ group, joined }) => (
                            <GroupCard
                                key={group.id}
                                group={group}
                                joined={joined}
                                busy={busyId === group.id}
                                onToggle={() =>
                                    toggle(group.id, group.name, joined)
                                }
                                onUpdate={values => handleUpdate(group, values)}
                                onDelete={() => handleDelete(group)}
                            />
                        ))}
                    </div>
                )}
            </div>
            {/* Rendered outside every branch, `ResourceListView`-style: a
                delete emptying page 2+'s last row still needs a way back. */}
            <Pager
                page={data?.page ?? 1}
                total={data?.total ?? 0}
                totalPages={data?.totalPages ?? 1}
                onPage={query.setPage}
            />
        </>
    );
}
