'use client';

import { PageHeader } from '@/components/shell/PageHeader';
import { Button } from '@/components/ui/button';
import { useMyRules } from '@/features/policy/hooks/usePolicy';
import { useListQuery } from '@/lib/api/query';
import { ResourceCoverage } from './components/ResourceCoverage';
import { ResourceFormDialog } from './components/ResourceFormDialog';
import { ResourceListView } from './components/ResourceListView';
import { ResourceRowActions } from './components/ResourceRowActions';
import { useMyResources, useResourceFacets } from './hooks/useResources';

export function MyResourcesPage() {
    const query = useListQuery({ name: '', attr: '' });
    const { data, error, isLoading, create, update, remove, upload, clear } =
        useMyResources(query.params);
    const { data: facets } = useResourceFacets(query.params, 'mine');
    const { rules } = useMyRules();

    return (
        <>
            <PageHeader
                title="My Resources"
                description="Everything you own. Access to these is decided by your policy."
                actions={
                    <ResourceFormDialog
                        trigger={<Button size="sm">New resource</Button>}
                        onCreate={create}
                        onUpdate={update}
                        onUpload={upload}
                        onClear={clear}
                    />
                }
            />
            <ResourceListView
                query={query}
                data={data}
                isLoading={isLoading}
                facets={facets ?? []}
                error={error}
                showOwner={false}
                emptyTitle="No resources yet"
                emptyDescription="Create one to start bartering access to it."
                meta={resource => (
                    <ResourceCoverage resource={resource} rules={rules} />
                )}
                action={resource => (
                    <ResourceRowActions
                        resource={resource}
                        onCreate={create}
                        onUpdate={update}
                        onUpload={upload}
                        onClear={clear}
                        onRemove={remove}
                    />
                )}
            />
        </>
    );
}
