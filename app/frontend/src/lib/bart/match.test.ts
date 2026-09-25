import { describe, expect, it } from 'vitest';
import { coveredBy } from './match';

describe('coveredBy: direction', () => {
    it('covers a resource whose keys the pattern all restates', () => {
        expect(coveredBy({ type: 'notes' }, { type: 'notes' })).toBe(true);
    });

    it('covers a resource when the pattern is MORE specific', () => {
        // The paper's Table 4 Rule-1 behaviour: Mary's four-attribute rule
        // still covers a two-attribute request.
        expect(
            coveredBy(
                { type: 'lectureNotes', course: 'ads' },
                {
                    type: 'lectureNotes',
                    course: 'ads',
                    teacher: 'doe',
                    year: '23/24',
                },
            ),
        ).toBe(true);
    });

    it('does NOT cover a resource carrying a key the pattern omits', () => {
        expect(coveredBy({ type: 'x', size: 'big' }, { type: 'x' })).toBe(
            false,
        );
    });

    it('does not cover when a shared key disagrees', () => {
        expect(coveredBy({ type: 'x' }, { type: 'y' })).toBe(false);
    });

    it('covers an attribute-less resource with any pattern: the wildcard', () => {
        expect(coveredBy({}, { type: 'x' })).toBe(true);
        expect(coveredBy({}, {})).toBe(true);
    });

    it('is not symmetric', () => {
        const narrow = { type: 'x' };
        const wide = { type: 'x', course: 'ads' };
        expect(coveredBy(narrow, wide)).toBe(true);
        expect(coveredBy(wide, narrow)).toBe(false);
    });
});

describe('coveredBy: value equality', () => {
    it('compares numbers and booleans by identity', () => {
        expect(coveredBy({ a: 1, b: true }, { a: 1, b: true })).toBe(true);
        expect(coveredBy({ a: 1 }, { a: 2 })).toBe(false);
        expect(coveredBy({ b: true }, { b: false })).toBe(false);
    });

    it('never equates a string with a number of the same text', () => {
        expect(coveredBy({ a: '1' }, { a: 1 })).toBe(false);
    });

    it('compares collections as bags, ignoring order', () => {
        expect(coveredBy({ k: ['b', 'a'] }, { k: ['a', 'b'] })).toBe(true);
    });

    it('treats duplicates as significant', () => {
        expect(coveredBy({ k: ['a', 'a'] }, { k: ['a'] })).toBe(false);
    });

    it('never equates a collection with a scalar', () => {
        expect(coveredBy({ k: ['a'] }, { k: 'a' })).toBe(false);
        expect(coveredBy({ k: 'a' }, { k: ['a'] })).toBe(false);
    });

    it('matches two empty collections', () => {
        expect(coveredBy({ k: [] }, { k: [] })).toBe(true);
    });

    it('does not equate a string element with a number element', () => {
        expect(coveredBy({ k: ['1'] }, { k: [1] })).toBe(false);
    });
});
