import { apiGet, apiSend } from '@/lib/api/client';
import { pageOf, PagedList } from '@/lib/api/page';
import { withQuery } from '@/lib/api/query';
import { Paginated } from '@/lib/api/types';

export type ScenarioCounts = {
    users: number;
    resources: number;
    connections: number;
};

/** Mirrors the backend's `ScenarioType`. */
export type ApiScenario = {
    id: string;
    title: string;
    summary: string;
    counts: ScenarioCounts;
};

export type SeedResult = { scenario: string; created: ScenarioCounts };

export type ResetCounts = {
    users: number;
    resources: number;
    groups: number;
    logEvents: number;
};

/**
 * The catalogue, served rather than hardcoded: adding a scenario is a backend
 * change alone, and this list stays right without a frontend release.
 *
 * Not paginated. The response is `{scenarios: [...]}`, following
 * `GET /resources/facets`'s named-wrapper shape rather than the `{data, page}`
 * envelope, so there is no `pageOf` here.
 */
export function listScenarios(): Promise<ApiScenario[]> {
    return apiGet<{ scenarios: ApiScenario[] }>('/dev/scenarios').then(
        body => body.scenarios,
    );
}

/**
 * Loads a scenario. Only succeeds on an empty database.
 *
 * Three failures are expected rather than exceptional, and every caller must
 * surface the message: `409` (data already exists, reset first), `503` (the
 * evaluator is down, and seeding validates every fixture's rules against it),
 * and `404` (the catalogue on screen is stale).
 */
export function seedScenario(id: string): Promise<SeedResult> {
    return apiSend<SeedResult>('POST', '/dev/seed', { scenario: id });
}

/** Destroys everything. Idempotent: an empty database answers with zeros. */
export function resetDatabase(): Promise<ResetCounts> {
    return apiSend<{ deleted: ResetCounts }>('POST', '/dev/reset').then(
        body => body.deleted,
    );
}

/** Mirrors the backend's `LogEventType`. */
export type ApiLogEvent = {
    id: string;
    type: string;
    data: Record<string, unknown> | null;
    occurred_at: string;
    userId: string | null;
    username: string | null;
};

/** Mirrors the backend's `ServiceStatusType`. */
export type ApiServiceStatus = {
    name: 'database' | 'evaluator';
    status: 'up' | 'down';
    latencyMs: number | null;
    detail: string | null;
};

/**
 * One page of the log, newest first. Unfiltered: the endpoint takes only a
 * page number.
 */
export async function listEvents(
    page: number,
): Promise<PagedList<ApiLogEvent>> {
    return pageOf(
        await apiGet<Paginated<ApiLogEvent>>(
            withQuery('/dev/events', { page }),
        ),
    );
}

export type ServiceStatusResult = {
    services: ApiServiceStatus[];
    roundTripMs: number;
};

/**
 * Whether the backend's own dependencies are reachable. Never rejects on a
 * dependency outage: the endpoint answers 200 with `status: 'down'`, so only
 * an unreachable backend throws. `roundTripMs` is this request's
 * browser-observed round trip, not a handler duration; it contains the
 * server-side probes, so it is always at least as large as the database and
 * evaluator figures.
 */
export async function getServiceStatus(): Promise<ServiceStatusResult> {
    const started = performance.now();
    const body = await apiGet<{ services: ApiServiceStatus[] }>('/dev/status');
    return {
        services: body.services,
        roundTripMs: Math.round(performance.now() - started),
    };
}
