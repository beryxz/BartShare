import { describe, expect, it } from 'vitest';
import { emitAttrs, formatAttr, formatValue } from './format';

describe('formatValue', () => {
    it('quotes strings', () => {
        expect(formatValue('ads')).toBe('"ads"');
    });

    it('leaves numbers and booleans bare', () => {
        expect(formatValue(3)).toBe('3');
        expect(formatValue(true)).toBe('true');
    });

    it('always braces collections, including singletons and empties', () => {
        expect(formatValue(['david'])).toBe('{"david"}');
        expect(formatValue([])).toBe('{}');
        expect(formatValue(['a', 'b'])).toBe('{"a","b"}');
    });

    it('escapes backslashes and quotes', () => {
        expect(formatValue('a"b\\c')).toBe('"a\\"b\\\\c"');
    });
});

describe('formatAttr', () => {
    it('renders one attribute in Bart form', () => {
        expect(formatAttr('course', 'ads')).toBe('(course:"ads")');
    });
});

describe('emitAttrs', () => {
    it('juxtaposes attributes with no separator', () => {
        expect(emitAttrs({ type: 'exercises', course: 'ads' })).toBe(
            '(type:"exercises")(course:"ads")',
        );
    });

    it('emits the empty string for no attributes', () => {
        expect(emitAttrs({})).toBe('');
    });

    it('throws on a key the grammar rejects', () => {
        expect(() => emitAttrs({ 'bad key': 'x' })).toThrow(
            /not a valid Bart name/,
        );
    });
});
