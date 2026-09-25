import { describe, expect, it } from 'vitest';
import { ApiContext } from '@/lib/api/types';
import { contextRows } from './context';

const CONTEXT: ApiContext = {
    values: {
        date_year: 2026,
        date_month: 7,
        date_day: 30,
        connections: ['11111111-1111-4111-8111-111111111111'],
        groups: ['99999999-9999-4999-8999-999999999999'],
    },
    display: {
        connections: [
            { id: '11111111-1111-4111-8111-111111111111', username: 'david' },
        ],
        groups: [
            {
                id: '99999999-9999-4999-8999-999999999999',
                name: 'csbook-club',
            },
        ],
    },
    names: [
        {
            key: 'connections',
            providedBy: 'connections',
            description: 'The ids of everyone you are connected to.',
            example: 'requester.userId in connections',
        },
    ],
};

describe('contextRows', () => {
    it('pairs each display name with the id rules actually match on', () => {
        const rows = contextRows(CONTEXT);
        expect(rows.connections).toEqual([
            { id: '11111111-1111-4111-8111-111111111111', label: 'david' },
        ]);
        expect(rows.groups).toEqual([
            {
                id: '99999999-9999-4999-8999-999999999999',
                label: 'csbook-club',
            },
        ]);
    });

    it('keeps every value key it did not resolve', () => {
        // Derived by subtraction, not by naming date_*: a context provider
        // added to the backend registry then shows up here with no edit.
        expect(contextRows(CONTEXT).other).toEqual({
            date_year: 2026,
            date_month: 7,
            date_day: 30,
        });
    });

    it('passes the vocabulary through', () => {
        expect(contextRows(CONTEXT).vocabulary).toBe(CONTEXT.names);
    });

    it('yields empty collections when the party has none', () => {
        const rows = contextRows({
            values: { date_year: 2026 },
            display: { connections: [], groups: [] },
            names: [],
        });
        expect(rows.connections).toEqual([]);
        expect(rows.groups).toEqual([]);
        expect(rows.other).toEqual({ date_year: 2026 });
    });
});
