'use client';

import { ErrorState } from '@/components/states/ErrorState';
import { ListSkeleton } from '@/components/states/ListSkeleton';
import { FirstRunLanding } from '@/features/dev/FirstRunLanding';
import { useSession } from '@/lib/session/SessionProvider';
import { usePathname } from 'next/navigation';
import { Fragment } from 'react';

const UNGATED_PATHS = new Set(['/debug/log', '/debug/status', '/debug/api']);

/**
 * Gates the content region on the acting user. The error branch comes before
 * the first-run screen, which would otherwise offer scenarios and a "Create a
 * party" action that cannot succeed with the backend down. The sidebar sits
 * outside the gate, so its "New user" action stays reachable in exactly the
 * state that needs it.
 */
export function SessionGate({ children }: { children: React.ReactNode }) {
    const { users, actingUser, isLoading, error, refresh } = useSession();
    const pathname = usePathname();

    if (UNGATED_PATHS.has(pathname)) return <>{children}</>;
    if (error) return <ErrorState error={error} onRetry={refresh} />;
    if (isLoading) return <ListSkeleton />;
    if (users.length === 0) return <FirstRunLanding />;

    // Remounts every screen on an identity change, dropping retained data.
    return <Fragment key={actingUser?.id ?? 'none'}>{children}</Fragment>;
}
