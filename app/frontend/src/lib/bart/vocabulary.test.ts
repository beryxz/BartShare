import { describe, expect, it } from 'vitest';
import { AttrVocabulary, keySuggestions, valueSuggestions } from './vocabulary';

const VOCABULARY: AttrVocabulary = [
    { key: 'course', values: ['ads', 'calculus'] },
    { key: 'type', values: ['exercises', 'lectureNotes'] },
];

describe('keySuggestions', () => {
    it('offers every key of the vocabulary', () => {
        expect(keySuggestions(VOCABULARY, {})).toEqual(['course', 'type']);
    });

    it('drops keys the attribute bag already holds', () => {
        // Offering one would be offering an error: the editor rejects a
        // duplicate key, and Bart rejects duplicate keys outright.
        expect(keySuggestions(VOCABULARY, { course: 'ads' })).toEqual(['type']);
    });

    it('offers nothing for an empty vocabulary', () => {
        expect(keySuggestions([], { course: 'ads' })).toEqual([]);
    });
});

describe('valueSuggestions', () => {
    it('offers the values of the named key', () => {
        expect(valueSuggestions(VOCABULARY, 'course', 'text')).toEqual([
            'ads',
            'calculus',
        ]);
    });

    it('offers nothing for a key outside the vocabulary', () => {
        expect(valueSuggestions(VOCABULARY, 'teacher', 'text')).toEqual([]);
    });

    it('offers nothing for a non-text kind', () => {
        // A facet value list is strings: under number/boolean these would be
        // rejected, and under a list kind they'd replace the whole field.
        expect(valueSuggestions(VOCABULARY, 'course', 'number')).toEqual([]);
        expect(valueSuggestions(VOCABULARY, 'course', 'boolean')).toEqual([]);
        expect(valueSuggestions(VOCABULARY, 'course', 'text[]')).toEqual([]);
        expect(valueSuggestions(VOCABULARY, 'course', 'number[]')).toEqual([]);
        expect(valueSuggestions(VOCABULARY, 'course', 'boolean[]')).toEqual([]);
    });
});
