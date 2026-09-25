import { describe, expect, it } from 'vitest';
import { parseAttrList, resourceLabel, resourceTitle } from './attrs';

describe('parseAttrList', () => {
    it('reads a comma-separated attribute list', () => {
        expect(parseAttrList('(type : lectureNotes), (course : ads)')).toEqual({
            type: 'lectureNotes',
            course: 'ads',
        });
    });

    it('reads a single attribute', () => {
        expect(parseAttrList('(type : exercises)')).toEqual({
            type: 'exercises',
        });
    });

    it('keeps values that contain slashes and dashes intact', () => {
        expect(
            parseAttrList('(year : 23/24), (userId : 52a9d498-1b42-4503)'),
        ).toEqual({ year: '23/24', userId: '52a9d498-1b42-4503' });
    });

    it('keeps a value containing parentheses intact', () => {
        // Dropping the pair would leave `{}`, resourceTitle's wildcard, not
        // this specific request. Only `"`, `\` and control characters are
        // rejected in a value, so a parenthesis reaches the trace.
        expect(
            parseAttrList('(type : lectureNotes (2024)), (course : ads)'),
        ).toEqual({ type: 'lectureNotes (2024)', course: 'ads' });
    });

    it('keeps a value containing the key/value separator intact', () => {
        // A key can never contain `' : '`, so the first occurrence is the
        // split point and the rest of the chunk is the value.
        expect(parseAttrList('(note : a : b), (course : ads)')).toEqual({
            note: 'a : b',
            course: 'ads',
        });
    });

    it('returns an empty object for an empty list', () => {
        expect(parseAttrList('')).toEqual({});
    });
});

describe('resourceLabel', () => {
    it('joins the values, because the keys repeat on every arrow', () => {
        expect(resourceLabel({ type: 'lectureNotes', course: 'ads' })).toBe(
            'lectureNotes · ads',
        );
    });

    it('renders the wildcard rather than an empty string', () => {
        expect(resourceLabel({})).toBe('anything');
    });
});

describe('resourceTitle', () => {
    it('keeps the keys, since the title is the full detail', () => {
        expect(resourceTitle({ type: 'lectureNotes', course: 'ads' })).toBe(
            'type: lectureNotes, course: ads',
        );
    });

    it('explains the empty pattern instead of returning nothing', () => {
        expect(resourceTitle({})).toBe(
            "empty pattern: Bart's wildcard, matches everything",
        );
    });
});
