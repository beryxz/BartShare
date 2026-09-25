import { describe, expect, it } from 'vitest';
import { lex, Token } from './lex';

/** Token kinds and text, which is what almost every assertion cares about. */
function shape(source: string): [string, string][] {
    const result = lex(source);
    if (!result.ok) throw new Error(`unexpected lex failure: ${result.reason}`);
    return result.tokens
        .filter(t => t.kind !== 'eof')
        .map(t => [t.kind, t.text]);
}

describe('lex', () => {
    it('tokenises an attribute', () => {
        expect(shape('(type:"notes")')).toEqual([
            ['punct', '('],
            ['name', 'type'],
            ['punct', ':'],
            ['string', '"notes"'],
            ['punct', ')'],
        ]);
    });

    it('tolerates whitespace around every token, as the paper fixtures do', () => {
        expect(shape('( type : "notes" )')).toEqual(shape('(type:"notes")'));
    });

    it('lexes true and false as bool, never as name', () => {
        expect(shape('true false')).toEqual([
            ['bool', 'true'],
            ['bool', 'false'],
        ]);
    });

    it('lexes integers, decimals and negatives as one number token', () => {
        expect(shape('1 2.5 -3 -4.25')).toEqual([
            ['number', '1'],
            ['number', '2.5'],
            ['number', '-3'],
            ['number', '-4.25'],
        ]);
    });

    it('keeps escapes inside a string and never ends early on one', () => {
        expect(shape('"a\\"b" "c\\\\"')).toEqual([
            ['string', '"a\\"b"'],
            ['string', '"c\\\\"'],
        ]);
    });

    it('does not read punctuation or comments inside a string', () => {
        expect(shape('"(a, b) # not a comment {}"')).toEqual([
            ['string', '"(a, b) # not a comment {}"'],
        ]);
    });

    it('skips comments to end of line', () => {
        expect(shape('# gone\n(a:1) # also gone')).toEqual([
            ['punct', '('],
            ['name', 'a'],
            ['punct', ':'],
            ['number', '1'],
            ['punct', ')'],
        ]);
    });

    it('lexes two-character operators as one token', () => {
        expect(shape('a != b <= c >= d < e > f = g')).toEqual([
            ['name', 'a'],
            ['punct', '!='],
            ['name', 'b'],
            ['punct', '<='],
            ['name', 'c'],
            ['punct', '>='],
            ['name', 'd'],
            ['punct', '<'],
            ['name', 'e'],
            ['punct', '>'],
            ['name', 'f'],
            ['punct', '='],
            ['name', 'g'],
        ]);
    });

    it('lexes the qualifier dot and the set braces', () => {
        expect(shape('requester.name {}')).toEqual([
            ['name', 'requester'],
            ['punct', '.'],
            ['name', 'name'],
            ['punct', '{'],
            ['punct', '}'],
        ]);
    });

    it('always ends with exactly one eof token', () => {
        const result = lex('(a:1)');
        if (!result.ok) throw new Error('expected success');
        const eofs = result.tokens.filter(t => t.kind === 'eof');
        expect(eofs).toHaveLength(1);
        expect(result.tokens.at(-1)!.kind).toBe('eof');
    });

    it('reports an unterminated string with its opening position', () => {
        const result = lex('(a:"oops)');
        expect(result).toMatchObject({
            ok: false,
            at: { line: 1, column: 4 },
        });
        if (result.ok) throw new Error('expected failure');
        expect(result.reason).toMatch(/unterminated string/i);
    });

    it('reports an unexpected character with its position', () => {
        const result = lex('(a:1)\n  @');
        expect(result).toMatchObject({
            ok: false,
            at: { line: 2, column: 3 },
        });
    });

    it('tracks line and column across newlines', () => {
        const result = lex('(a:1)\n(b:2)');
        if (!result.ok) throw new Error('expected success');
        const b = result.tokens.find(t => t.text === 'b') as Token;
        expect({ line: b.line, column: b.column }).toEqual({
            line: 2,
            column: 2,
        });
    });

    it('records offsets that slice back to the token text', () => {
        const source = '(type : "notes")';
        const result = lex(source);
        if (!result.ok) throw new Error('expected success');
        for (const token of result.tokens.filter(t => t.kind !== 'eof'))
            expect(source.slice(token.start, token.end)).toBe(token.text);
    });
});
