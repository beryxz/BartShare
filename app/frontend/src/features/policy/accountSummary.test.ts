import { describe, expect, it } from 'vitest';
import { describeAccountSummary } from './accountSummary';

describe('describeAccountSummary', () => {
    it('names all three kinds in a fixed order', () => {
        expect(
            describeAccountSummary({ resources: 3, connections: 5, groups: 2 }),
        ).toEqual(['3 resources', '5 connections', '2 groups']);
    });

    it('omits a kind the user has none of', () => {
        expect(
            describeAccountSummary({ resources: 4, connections: 0, groups: 1 }),
        ).toEqual(['4 resources', '1 group']);
    });

    it('uses the singular for exactly one', () => {
        expect(
            describeAccountSummary({ resources: 1, connections: 1, groups: 1 }),
        ).toEqual(['1 resource', '1 connection', '1 group']);
    });

    it('returns nothing when the user owns nothing', () => {
        expect(
            describeAccountSummary({ resources: 0, connections: 0, groups: 0 }),
        ).toEqual([]);
    });
});
