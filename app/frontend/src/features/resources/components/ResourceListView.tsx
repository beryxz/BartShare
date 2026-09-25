'use client';

import { ClearFilterButton } from '@/components/states/ClearFilterButton';
import { EmptyState } from '@/components/states/EmptyState';
import { ErrorState } from '@/components/states/ErrorState';
import { ListSkeleton } from '@/components/states/ListSkeleton';
import { Pager } from '@/components/states/Pager';
import { PagedList } from '@/lib/api/page';
import { useListQuery } from '@/lib/api/query';
import { ApiResource, ApiUser, Facet } from '@/lib/api/types';
import { ResourceCard } from './ResourceCard';
import {
    filterFrom,
    isFiltered,
    ResourceFilter,
    ResourceFilterBar,
    ResourceFlatFilters,
    toFilters,
} from './ResourceFilterBar';

/**
 * The substrate behind My Resources, Explore and Shared with me. Those three
 * differ only in where the list comes from and what the row action is, so
 * sharing one view is what keeps them consistent as each grows.
 */
export function ResourceListView({
    query,
    data,
    isLoading,
    facets,
    owners,
    action,
    meta,
    error,
    emptyTitle,
    emptyDescription,
    showOwner = true,
    note,
}: {
    /** The `useListQuery` handle driving this list. */
    query: ReturnType<typeof useListQuery<ResourceFlatFilters>>;
    /** The page the hook returned; undefined while the first one is in flight. */
    data: PagedList<ApiResource> | undefined;
    isLoading: boolean;
    facets: Facet[];
    owners?: Map<string, ApiUser>;
    action?: (resource: ApiResource) => React.ReactNode;
    /** The footer bar's left slot. Explore and Shared pass nothing. */
    meta?: (resource: ApiResource) => React.ReactNode;
    error?: unknown;
    emptyTitle: string;
    emptyDescription?: string;
    showOwner?: boolean;
    note?: React.ReactNode;
}) {
    const resources = data?.items;
    const filter = filterFrom(query.filters);
    /** Derived from the APPLIED filters: picks the empty-state copy. */
    const filtered = isFiltered(query.appliedFilters);
    const onFilter = (next: ResourceFilter) =>
        query.setFilters(toFilters(next));
    /** An immediate filter change: a chip, or the clear button. */
    const onCommitFilter = (next: ResourceFilter) =>
        query.commitFilters(toFilters(next));
    // `data !== undefined` distinguishes a refetch from the first load
    // (which wants the skeleton); derived once so every screen agrees.
    const busy = (query.isPending || isLoading) && data !== undefined;
    const page = data?.page ?? 1;
    const total = data?.total ?? 0;
    const totalPages = data?.totalPages ?? 1;
    const onPage = query.setPage;

    // Filter bar and pager render unconditionally so an early return can't
    // unmount `<Input>` mid-keystroke; the skeleton branch tests `resources`,
    // not `isLoading`, since `keepPreviousData` holds the prior page's rows.
    return (
        <>
            <ResourceFilterBar
                facets={facets}
                filter={filter}
                busy={busy}
                onChange={onFilter}
                onCommit={onCommitFilter}
            />
            {note}
            <div aria-busy={busy}>
                {error ? (
                    <ErrorState error={error} />
                ) : !resources ? (
                    <ListSkeleton />
                ) : resources.length === 0 && filtered ? (
                    <EmptyState
                        title="No resources match your filter"
                        description="Try a different search, or clear the filter to see everything."
                        action={
                            <ClearFilterButton
                                onClear={() =>
                                    onCommitFilter({ query: '', attr: null })
                                }
                            />
                        }
                    />
                ) : resources.length === 0 ? (
                    <EmptyState
                        title={emptyTitle}
                        description={emptyDescription}
                    />
                ) : (
                    <div className="grid gap-3 sm:grid-cols-2">
                        {resources.map(resource => (
                            <ResourceCard
                                key={resource.id}
                                resource={resource}
                                owner={
                                    showOwner
                                        ? owners?.get(resource.user.id)
                                        : undefined
                                }
                                action={action?.(resource)}
                                meta={meta?.(resource)}
                            />
                        ))}
                    </div>
                )}
            </div>
            <Pager
                page={page}
                total={total}
                totalPages={totalPages}
                onPage={onPage}
            />
        </>
    );
}
