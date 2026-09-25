import { describe, expect, it } from 'vitest';
import { CREATED_KINDS, describeCounts } from './counts';

describe('describeCounts', () => {
    it('pluralises each kind', () => {
        expect(
            describeCounts(
                { users: 3, resources: 1, connections: 2 },
                CREATED_KINDS,
            ),
        ).toEqual(['3 parties', '1 resource', '2 connections']);
    });

    it('describes groups, which only some scenarios declare', () => {
        expect(
            describeCounts(
                { users: 4, resources: 5, connections: 0, groups: 1 },
                CREATED_KINDS,
            ),
        ).toEqual(['4 parties', '5 resources', '1 group']);
    });

    it('omits a kind with nothing in it', () => {
        expect(
            describeCounts(
                { users: 3, resources: 0, connections: 0 },
                CREATED_KINDS,
            ),
        ).toEqual(['3 parties']);
    });

    it('is empty when everything is zero, so the caller can say so in words', () => {
        expect(
            describeCounts(
                { users: 0, resources: 0, connections: 0 },
                CREATED_KINDS,
            ),
        ).toEqual([]);
    });

    it('keeps the declared kind order, not the object key order', () => {
        expect(
            describeCounts(
                { connections: 2, resources: 1, users: 3 },
                CREATED_KINDS,
            ),
        ).toEqual(['3 parties', '1 resource', '2 connections']);
    });

    it('ignores a key the kind list does not name', () => {
        expect(
            describeCounts({ users: 1, surprise: 9 }, CREATED_KINDS),
        ).toEqual(['1 party']);
    });
});
