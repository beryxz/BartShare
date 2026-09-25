'use client';

import { PageHeader } from '@/components/shell/PageHeader';
import { Button } from '@/components/ui/button';
import { RequestAccessDialog } from '@/features/access/RequestAccessDialog';
import { ApiError } from '@/lib/api/client';
import { triggerDownload } from '@/lib/api/content';
import { toastWriteError } from '@/lib/toast';
import { useListQuery } from '@/lib/api/query';
import { ApiResource } from '@/lib/api/types';
import { resourceName } from '@/lib/bart/naming';
import { useSession } from '@/lib/session/SessionProvider';
import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { downloadContent } from './api';
import { ResourceListView } from './components/ResourceListView';
import { useResourceFacets, useSharedWithMe } from './hooks/useResources';

export function SharedWithMePage() {
    const { users } = useSession();
    const query = useListQuery({ name: '', attr: '' });
    const { data, error, isLoading } = useSharedWithMe(query.params);
    const { data: facets } = useResourceFacets(query.params, 'all');
    const owners = useMemo(() => new Map(users.map(u => [u.id, u])), [users]);
    const [busyId, setBusyId] = useState<string | null>(null);
    // Drives the trace dialog for both the 403 path and the row's own "Why?"
    // button, which asks the same question without a refused download first.
    const [explaining, setExplaining] = useState<ApiResource | null>(null);

    async function open(resource: ApiResource) {
        setBusyId(resource.id);
        try {
            const { blob, filename } = await downloadContent(resource.id);
            triggerDownload(blob, filename ?? resourceName(resource));
        } catch (failure) {
            // A denial here is a 403, not `{permitted: false}`: downloading acts,
            // so refusal is an error, re-evaluated fresh since this list was built.
            if (failure instanceof ApiError && failure.status === 403)
                toast.error('Access denied: re-evaluated just now', {
                    action: {
                        label: 'See why',
                        onClick: () => setExplaining(resource),
                    },
                });
            else toastWriteError(failure);
        } finally {
            setBusyId(null);
        }
    }

    return (
        <>
            <PageHeader
                title="Shared with me"
                description="What your policy currently earns you. Nothing here is stored: the list is re-evaluated every time you open it."
            />
            <ResourceListView
                query={query}
                data={data}
                isLoading={isLoading}
                facets={facets ?? []}
                owners={owners}
                error={error}
                emptyTitle="Nothing shared with you yet"
                emptyDescription="Add rules that offer something in exchange, or connect with other parties."
                note={
                    data?.scan.truncated ? (
                        <p className="mb-3 text-xs text-muted-foreground">
                            Evaluated {data.scan.considered} of{' '}
                            {data.scan.total} candidates matching your filter,
                            so this list may be incomplete.
                        </p>
                    ) : null
                }
                action={resource => (
                    <div className="flex gap-2">
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setExplaining(resource)}
                        >
                            Why?
                        </Button>
                        {/* Disabled, not omitted as on My Resources: the Why?
                            button sits beside it and a gap reads as ragged.
                            The row's `No file` pill already says why. */}
                        <Button
                            variant="outline"
                            size="sm"
                            disabled={
                                resource.content === null ||
                                busyId === resource.id
                            }
                            onClick={() => open(resource)}
                        >
                            Open
                        </Button>
                    </div>
                )}
            />
            {explaining && (
                <RequestAccessDialog
                    resource={explaining}
                    open
                    onOpenChange={next => {
                        if (!next) setExplaining(null);
                    }}
                />
            )}
        </>
    );
}
