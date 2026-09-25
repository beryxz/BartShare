'use client';

import { PageHeader } from '@/components/shell/PageHeader';
import { RequestAccessDialog } from '@/features/access/RequestAccessDialog';
import { useListQuery } from '@/lib/api/query';
import { useSession } from '@/lib/session/SessionProvider';
import { useMemo } from 'react';
import { ResourceListView } from './components/ResourceListView';
import { useAllResources, useResourceFacets } from './hooks/useResources';

export function ExplorePage() {
    const { actingUser, users } = useSession();
    const query = useListQuery({ name: '', attr: '' });
    const params = {
        ...query.params,
        ...(actingUser ? { excludeUserId: actingUser.id } : {}),
    };
    const { data, error, isLoading } = useAllResources(params);
    const { data: facets } = useResourceFacets(params, 'all');
    const owners = useMemo(() => new Map(users.map(u => [u.id, u])), [users]);

    return (
        <>
            <PageHeader
                title="Explore"
                description="Every resource on the platform. Attributes are public; access is bartered."
            />
            <ResourceListView
                query={query}
                data={data}
                isLoading={isLoading}
                facets={facets ?? []}
                owners={owners}
                error={error}
                emptyTitle="Nothing to explore"
                emptyDescription="No one else has published a resource yet."
                action={resource => <RequestAccessDialog resource={resource} />}
            />
        </>
    );
}
