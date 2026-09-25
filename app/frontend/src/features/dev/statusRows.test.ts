import { describe, expect, it } from 'vitest';
import { ApiServiceStatus } from './api';
import { statusRows } from './statusRows';

const bothUp: ApiServiceStatus[] = [
    { name: 'database', status: 'up', latencyMs: 2, detail: null },
    { name: 'evaluator', status: 'up', latencyMs: 4, detail: null },
];

describe('statusRows', () => {
    it('prepends an up backend row when the request resolved', () => {
        const rows = statusRows(bothUp, 12, undefined);
        expect(rows.map(r => r.name)).toEqual([
            'backend',
            'database',
            'evaluator',
        ]);
        expect(rows[0]).toEqual({
            name: 'backend',
            status: 'up',
            latencyMs: 12,
            detail: null,
        });
        expect(rows.slice(1)).toEqual(bothUp);
    });

    it('keeps a down dependency as data, not an error', () => {
        const rows = statusRows(
            [
                bothUp[0],
                {
                    name: 'evaluator',
                    status: 'down',
                    latencyMs: null,
                    detail: 'The evaluator service is unreachable',
                },
            ],
            9,
            undefined,
        );
        expect(rows[0].status).toBe('up');
        expect(rows[0].latencyMs).toBe(9);
        expect(rows[2].status).toBe('down');
        expect(rows[2].detail).toBe('The evaluator service is unreachable');
    });

    it('marks the backend down and the others unknown on an error', () => {
        const rows = statusRows(
            undefined,
            undefined,
            new Error('fetch failed'),
        );
        expect(rows).toEqual([
            {
                name: 'backend',
                status: 'down',
                latencyMs: null,
                detail: 'fetch failed',
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
        ]);
    });

    it('lets an error win over stale data from before the outage', () => {
        const rows = statusRows(bothUp, 12, new Error('fetch failed'));
        expect(rows[0].status).toBe('down');
        expect(rows[1].status).toBe('unknown');
        expect(rows[2].status).toBe('unknown');
    });

    it('never shows the duration of a failed fetch as a latency', () => {
        const rows = statusRows(bothUp, 12, new Error('fetch failed'));
        expect(rows[0].latencyMs).toBeNull();
    });

    it('answers all-unknown while nothing has loaded yet', () => {
        const rows = statusRows(undefined, undefined, undefined);
        expect(rows).toHaveLength(3);
        expect(rows.every(r => r.status === 'unknown')).toBe(true);
        expect(rows.every(r => r.latencyMs === null)).toBe(true);
    });
});
