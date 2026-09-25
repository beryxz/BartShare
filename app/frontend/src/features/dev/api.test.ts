import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '@/lib/api/client';
import {
    getServiceStatus,
    listEvents,
    listScenarios,
    resetDatabase,
    seedScenario,
} from './api';

/**
 * A fetch stub answering one canned response, mirroring `mockFetch` in
 * `src/lib/api/client.test.ts`. The assertions are about the path, the method
 * and the unwrapping, which is all these functions do.
 */
function mockFetch(body: unknown, status = 200) {
    const fetchMock = vi.fn<
        (url: string, init?: RequestInit) => Promise<Response>
    >(
        async () =>
            new Response(JSON.stringify(body), {
                status,
                headers: { 'content-type': 'application/json' },
            }),
    );
    vi.stubGlobal('fetch', fetchMock);
    return fetchMock;
}

afterEach(() => {
    vi.unstubAllGlobals();
});

describe('listScenarios', () => {
    it('unwraps the scenarios array', async () => {
        const scenario = {
            id: 'ex1',
            title: 'Basic exchange',
            summary: 'three parties',
            counts: { users: 3, resources: 2, connections: 1 },
        };
        const fetchMock = mockFetch({ scenarios: [scenario] });

        await expect(listScenarios()).resolves.toEqual([scenario]);
        expect(fetchMock.mock.calls[0][0]).toContain('/api/v1/dev/scenarios');
    });
});

describe('seedScenario', () => {
    it('posts the chosen id and returns what was created', async () => {
        const fetchMock = mockFetch({
            scenario: 'ex3',
            created: { users: 3, resources: 3, connections: 1 },
        });

        const result = await seedScenario('ex3');
        expect(result.created.resources).toBe(3);

        const [url, init] = fetchMock.mock.calls[0];
        expect(url).toContain('/api/v1/dev/seed');
        expect(init?.method).toBe('POST');
        expect(JSON.parse(init?.body as string)).toEqual({ scenario: 'ex3' });
    });

    it('surfaces the 409 body rather than the empty-body fallback', async () => {
        mockFetch(
            { errors: ['The database is not empty: reset it first'] },
            409,
        );

        await expect(seedScenario('ex1')).rejects.toMatchObject({
            status: 409,
            errors: ['The database is not empty: reset it first'],
        });
    });
});

describe('resetDatabase', () => {
    it('unwraps the deleted counts', async () => {
        const fetchMock = mockFetch({
            deleted: { users: 3, resources: 3, groups: 0, logEvents: 2 },
        });

        await expect(resetDatabase()).resolves.toEqual({
            users: 3,
            resources: 3,
            groups: 0,
            logEvents: 2,
        });
        expect(fetchMock.mock.calls[0][1]?.method).toBe('POST');
    });

    it('rejects with an ApiError on failure', async () => {
        mockFetch({ errors: ['boom'] }, 500);
        await expect(resetDatabase()).rejects.toBeInstanceOf(ApiError);
    });
});

describe('listEvents', () => {
    it('unwraps the page envelope and asks for the requested page', async () => {
        const row = {
            id: 'e1',
            type: 'resource.access',
            data: { permitted: true },
            occurred_at: '2026-01-01T00:00:00.000Z',
            userId: 'u1',
            username: 'alice',
        };
        const fetchMock = mockFetch({
            data: [row],
            page: { size: 50, totalElements: 1, totalPages: 1, number: 1 },
        });

        await expect(listEvents(2)).resolves.toEqual({
            items: [row],
            total: 1,
            page: 1,
            totalPages: 1,
        });
        expect(fetchMock.mock.calls[0][0]).toContain(
            '/api/v1/dev/events?page=2',
        );
    });
});

describe('getServiceStatus', () => {
    it('unwraps the services array and times its own round trip', async () => {
        const services = [
            {
                name: 'database',
                status: 'up',
                latencyMs: 3,
                detail: null,
            },
            {
                name: 'evaluator',
                status: 'down',
                latencyMs: null,
                detail: 'The evaluator service is unreachable',
            },
        ];
        const fetchMock = mockFetch({ services });

        const result = await getServiceStatus();
        expect(result.services).toEqual(services);
        // The browser-observed round trip for the backend row: an integer
        // number of milliseconds, whatever the machine's timing was.
        expect(result.roundTripMs).toBeGreaterThanOrEqual(0);
        expect(Number.isInteger(result.roundTripMs)).toBe(true);
        expect(fetchMock.mock.calls[0][0]).toContain('/api/v1/dev/status');
    });
});
