'use client';

import { ListSkeleton } from '@/components/states/ListSkeleton';
import { PageHeader } from '@/components/shell/PageHeader';
import { Button } from '@/components/ui/button';
import { RefreshCw } from 'lucide-react';
import { ServiceStatusCard } from './components/ServiceStatusCard';
import { useServiceStatus } from './hooks/useServiceStatus';
import { statusRows } from './statusRows';

/**
 * Whether the backend's dependencies are reachable. Renders outside
 * `SessionGate`, so it works on an empty database: right after a reset, this
 * screen answers whether the evaluator seeding needs is even up. A fetch
 * error is never a full-page `ErrorState` here: an unreachable backend is
 * this screen's answer, not a failure to answer, so `statusRows` folds it in
 * as a down backend and two unknown dependencies.
 */
export function ServiceStatusPage() {
    const { services, roundTripMs, isLoading, isValidating, error, refresh } =
        useServiceStatus();

    return (
        <div className="space-y-4">
            <PageHeader
                title="Service status"
                description="Check the availability of all the services"
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

            {isLoading && services === undefined && error === undefined ? (
                <ListSkeleton rows={3} />
            ) : (
                <div className="space-y-3">
                    {statusRows(services, roundTripMs, error).map(row => (
                        <ServiceStatusCard key={row.name} row={row} />
                    ))}
                </div>
            )}
        </div>
    );
}
