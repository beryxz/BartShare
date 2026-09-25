import { errorMessages } from '@/lib/api/errors';
import { ApiServiceStatus } from './api';

/**
 * What `/debug/status` renders: the wire type plus the one service the wire
 * cannot carry. The backend row is derived, not fetched, because a service
 * cannot report its own unreachability; and `unknown` exists because when the
 * backend is down, nothing has probed the database or the evaluator, so
 * calling them `down` (or `up`) would be a guess.
 */
export type StatusRow = {
    name: 'backend' | ApiServiceStatus['name'];
    status: ApiServiceStatus['status'] | 'unknown';
    latencyMs: number | null;
    detail: string | null;
};

/**
 * The rows of `/debug/status`, backend first. A resolved `getServiceStatus()`
 * IS the backend being up and the hook's `error` IS it being down, since the
 * endpoint answers 200 even when a dependency isn't; `error` therefore wins
 * over any stale `services` SWR retained from before the outage. On that error
 * path the latency stays null, a failed fetch's duration being a timeout.
 */
export function statusRows(
    services: ApiServiceStatus[] | undefined,
    roundTripMs: number | undefined,
    error: unknown,
): StatusRow[] {
    if (error !== undefined) {
        return [
            {
                name: 'backend',
                status: 'down',
                latencyMs: null,
                detail: errorMessages(error).join(' '),
            },
            {
                name: 'database',
                status: 'unknown',
                latencyMs: null,
                detail: null,
            },
            {
                name: 'evaluator',
                status: 'unknown',
                latencyMs: null,
                detail: null,
            },
        ];
    }
    if (services === undefined) {
        // Still loading: this branch exists for totality, the page shows a
        // skeleton instead of these rows.
        return (['backend', 'database', 'evaluator'] as const).map(name => ({
            name,
            status: 'unknown',
            latencyMs: null,
            detail: null,
        }));
    }
    return [
        {
            name: 'backend',
            status: 'up',
            latencyMs: roundTripMs ?? null,
            detail: null,
        },
        ...services,
    ];
}
