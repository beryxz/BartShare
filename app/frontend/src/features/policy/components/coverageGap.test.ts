import { describe, expect, it } from 'vitest';
import { gapSentence } from './coverageGap';

describe('gapSentence', () => {
    it('names attributes the pattern never mentioned', () => {
        expect(
            gapSentence({
                name: 'Calculus exercises',
                missing: ['type', 'course', 'year'],
                conflicting: [],
            }),
        ).toBe('"Calculus exercises" also carries "type", "course", "year".');
    });

    it('names attributes whose values disagree', () => {
        expect(
            gapSentence({
                name: 'Calculus exercises',
                missing: [],
                conflicting: ['teacher'],
            }),
        ).toBe('"Calculus exercises" disagrees on "teacher".');
    });

    it('reports both when both stand in the way', () => {
        expect(
            gapSentence({
                name: 'Calculus exercises',
                missing: ['year'],
                conflicting: ['teacher'],
            }),
        ).toBe(
            '"Calculus exercises" also carries "year" and disagrees on "teacher".',
        );
    });

    it('stands in for a resource saved without a name', () => {
        // `metadata.name` is not required, so the server can hand back an
        // empty string. The stand-in is not a name, so it takes no quotes.
        expect(
            gapSentence({ name: '', missing: ['kind'], conflicting: [] }),
        ).toBe('One of your resources also carries "kind".');
    });
});
