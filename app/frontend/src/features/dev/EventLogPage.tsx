'use client';

import { EmptyState } from '@/components/states/EmptyState';
import { ErrorState } from '@/components/states/ErrorState';
import { ListSkeleton } from '@/components/states/ListSkeleton';
import { Pager } from '@/components/states/Pager';
import { PageHeader } from '@/components/shell/PageHeader';
import { Button } from '@/components/ui/button';
import { RefreshCw } from 'lucide-react';
import { useState } from 'react';
import { EventLogTable } from './components/EventLogTable';
import { useEvents } from './hooks/useEvents';

/**
 * Every recorded event, as stored. Refresh is a button rather than a poll:
 * left open in a background tab, a poll would refetch forever during a demo.
 * `POST /dev/reset` truncates the table (the header says so, so an empty
 * table doesn't read as broken), and deleting a party anonymises its rows
 * (`ON DELETE SET NULL`): a run of `system` rows can mean a deleted party.
 */
export function EventLogPage() {
    const [page, setPage] = useState(1);
    const [expanded, setExpanded] = useState<ReadonlySet<string>>(new Set());
    const { events, isLoading, isValidating, error, refresh } = useEvents(page);

    function toggle(id: string) {
        setExpanded(previous => {
            const next = new Set(previous);
            if (!next.delete(id)) next.add(id);
            return next;
        });
    }

    function goToPage(next: number) {
        // Row ids do not survive a page change, so a stale expansion set would
        // only ever be dead weight.
        setExpanded(new Set());
        setPage(next);
    }

    return (
        <div className="space-y-4">
            <PageHeader
                title="Event log"
                description="View recorded events, newest first. Resetting the database clears this table."
                actions={
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={refresh}
                        aria-busy={isValidating}
                    >
                        <RefreshCw />
                        {isValidating ? 'Refreshing…' : 'Refresh'}
                    </Button>
                }
            />

            {error ? (
                <ErrorState error={error} onRetry={refresh} />
            ) : isLoading && events === undefined ? (
                <ListSkeleton />
            ) : events && events.items.length > 0 ? (
                <>
                    <EventLogTable
                        events={events.items}
                        expanded={expanded}
                        onToggle={toggle}
                    />
                    <Pager
                        page={events.page}
                        total={events.total}
                        totalPages={events.totalPages}
                        onPage={goToPage}
                    />
                </>
            ) : (
                <EmptyState
                    title="No events yet"
                    description="Acting anywhere in the app writes a row here. A reset empties the table."
                />
            )}
        </div>
    );
}
