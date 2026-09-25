import { describe, expect, it } from 'vitest';
import { ATTR_KINDS, kindOf, parseAttrValue, toText } from './attrValue';
import { BartValue } from './types';

describe('ATTR_KINDS', () => {
    it('covers exactly the six kinds the grammar supports', () => {
        expect(ATTR_KINDS.map(k => k.kind)).toEqual([
            'text',
            'number',
            'boolean',
            'text[]',
            'number[]',
            'boolean[]',
        ]);
    });
});

describe('kindOf', () => {
    it('reads a string as text', () => {
        expect(kindOf('ads')).toBe('text');
    });

    it('reads a number as number', () => {
        expect(kindOf(3)).toBe('number');
    });

    it('reads a boolean as boolean', () => {
        expect(kindOf(true)).toBe('boolean');
    });

    it('reads a string array as text[]', () => {
        expect(kindOf(['ads', 'lecture'])).toBe('text[]');
    });

    it('reads a number array as number[]', () => {
        expect(kindOf([1, 2])).toBe('number[]');
    });

    it('reads a boolean array as boolean[]', () => {
        expect(kindOf([true, false])).toBe('boolean[]');
    });

    it('defaults an empty array to text[], since nothing in the value says otherwise', () => {
        expect(kindOf([])).toBe('text[]');
    });

    // The grammar and backend both accept a mixed-type array, but `kindOf`
    // has no "mixed" kind to return.
    it('classifies a mixed-type array by its first element only, a documented gap', () => {
        expect(kindOf(['a', 1])).toBe('text[]');
    });
});

describe('toText', () => {
    it('renders a scalar as its own text', () => {
        expect(toText('ads')).toBe('ads');
        expect(toText(2024)).toBe('2024');
        expect(toText(true)).toBe('true');
    });

    it('renders a list comma-separated', () => {
        expect(toText(['a', 'b'])).toBe('a, b');
    });

    // toText(['solo']) and toText('solo') produce the identical string, so
    // the kind has to be carried explicitly, never inferred from the text.
    it('renders a one-element list as that one element, indistinguishable from the scalar', () => {
        expect(toText(['solo'])).toBe('solo');
        expect(toText(['solo'])).toBe(toText('solo'));
    });

    it('renders number and boolean lists comma-separated too', () => {
        expect(toText([1, 2, 3])).toBe('1, 2, 3');
        expect(toText([true, false])).toBe('true, false');
    });
});

describe('parseAttrValue', () => {
    describe('success', () => {
        it('parses text, including the empty string', () => {
            expect(parseAttrValue('ads', 'text')).toEqual({
                ok: true,
                value: 'ads',
            });
            expect(parseAttrValue('', 'text')).toEqual({
                ok: true,
                value: '',
            });
        });

        it('parses a negative and a decimal number', () => {
            expect(parseAttrValue('-5', 'number')).toEqual({
                ok: true,
                value: -5,
            });
            expect(parseAttrValue('3.14', 'number')).toEqual({
                ok: true,
                value: 3.14,
            });
        });

        it('parses booleans case-insensitively', () => {
            expect(parseAttrValue('TRUE', 'boolean')).toEqual({
                ok: true,
                value: true,
            });
            expect(parseAttrValue('False', 'boolean')).toEqual({
                ok: true,
                value: false,
            });
        });

        it('splits a list on comma, trimming untidy spacing', () => {
            expect(parseAttrValue(' a , b ', 'text[]')).toEqual({
                ok: true,
                value: ['a', 'b'],
            });
        });

        it('parses number[] and boolean[] element-wise', () => {
            expect(parseAttrValue('1, 2, 3', 'number[]')).toEqual({
                ok: true,
                value: [1, 2, 3],
            });
            expect(parseAttrValue('true, false', 'boolean[]')).toEqual({
                ok: true,
                value: [true, false],
            });
        });

        it('drops empty elements, so a trailing comma while typing is not junk', () => {
            expect(parseAttrValue('a, b,', 'text[]')).toEqual({
                ok: true,
                value: ['a', 'b'],
            });
        });

        it('parses an empty list text as an empty array, not a one-element list of the empty string', () => {
            expect(parseAttrValue('', 'text[]')).toEqual({
                ok: true,
                value: [],
            });
            expect(parseAttrValue('   ', 'number[]')).toEqual({
                ok: true,
                value: [],
            });
        });
    });

    describe('failure', () => {
        it('rejects a non-numeric number', () => {
            const result = parseAttrValue('12x', 'number');
            expect(result.ok).toBe(false);
            expect(result.ok === false && result.error).toMatch(/12x/);
        });

        it('rejects an empty number', () => {
            const result = parseAttrValue('', 'number');
            expect(result.ok).toBe(false);
            expect(result.ok === false && result.error).toMatch(/empty/i);
        });

        it('rejects a non-finite number', () => {
            const result = parseAttrValue('Infinity', 'number');
            expect(result.ok).toBe(false);
            expect(result.ok === false && result.error).toMatch(/Infinity/);
        });

        it('rejects a boolean that is neither word', () => {
            const result = parseAttrValue('yes', 'boolean');
            expect(result.ok).toBe(false);
            expect(result.ok === false && result.error).toMatch(/yes/);
        });

        it('rejects a list whose element fails its own element type, naming that element', () => {
            const result = parseAttrValue('1, x, 3', 'number[]');
            expect(result.ok).toBe(false);
            expect(result.ok === false && result.error).toMatch(/x/);
        });

        // The parser is total: it never throws, it reports.
        it('never throws, even for nonsense input', () => {
            expect(() =>
                parseAttrValue('not a number', 'number'),
            ).not.toThrow();
            expect(() => parseAttrValue(',,,', 'boolean[]')).not.toThrow();
        });
    });
});

describe('lossy round trips (documented limitations)', () => {
    // None of these three are bugs: toText and parseAttrValue share the
    // comma as a separator, and parseAttrValue drops empty elements by design.

    it('a comma inside a single element is inseparable from a separator once rendered', () => {
        const original = ['a,b'];
        const text = toText(original);
        expect(text).toBe('a,b');
        expect(parseAttrValue(text, 'text[]')).toEqual({
            ok: true,
            value: ['a', 'b'], // not the original one-element list
        });
    });

    it('an empty-string element does not survive the round trip', () => {
        const original = ['a', '', 'b'];
        const text = toText(original);
        expect(text).toBe('a, , b');
        expect(parseAttrValue(text, 'text[]')).toEqual({
            ok: true,
            value: ['a', 'b'], // the empty element is gone
        });
    });

    it('a single empty-string element round-trips to an empty array', () => {
        const original = [''];
        const text = toText(original);
        expect(text).toBe('');
        expect(parseAttrValue(text, 'text[]')).toEqual({
            ok: true,
            value: [], // not ['']
        });
    });
});

describe('round trip: value -> kindOf -> toText -> parseAttrValue', () => {
    // Comma-bearing elements and mixed-type arrays are excluded: both are
    // separately-pinned limitations, not values this round trip preserves.
    it('recovers one representative value per kind unchanged', () => {
        const representatives: readonly BartValue[] = [
            'ads',
            '',
            2024,
            -3.5,
            true,
            false,
            [],
            ['ads', 'lecture'],
            [1, 2, 3],
            [true, false],
        ];

        for (const value of representatives) {
            const kind = kindOf(value);
            const text = toText(value);
            expect(parseAttrValue(text, kind)).toEqual({ ok: true, value });
        }
    });
});
