/**
 * The `.bart` tokenizer, written against `Bart.g4`'s lexer rules and the one
 * place token shapes are defined in the frontend. `./monaco/language.ts` is a
 * second, unavoidable encoding: Monaco requires its own DSL.
 *
 * Order mirrors the grammar: `BOOL` before `NAME`, so `true` is a bool token
 * and can never be read as an attribute key.
 */

export type TokenKind = 'string' | 'number' | 'bool' | 'name' | 'punct' | 'eof';

/** 1-based, so it reads the same as the evaluator's `line L:C` errors. */
export type Position = { line: number; column: number };

export type Token = {
    kind: TokenKind;
    /** Verbatim source, quotes included for a `string`. */
    text: string;
    /** Character offset of the first character. */
    start: number;
    /** Character offset one past the last character. */
    end: number;
    line: number;
    column: number;
};

export type LexResult =
    { ok: true; tokens: Token[] } | { ok: false; reason: string; at: Position };

/**
 * Longest first. `<=` must be tried before `<`, or `a <= b` lexes as
 * `a`, `<`, `=`, `b` and the parser sees a comparison against nothing.
 */
export const PUNCTUATION: readonly string[] = [
    '!=',
    '<=',
    '>=',
    '(',
    ')',
    '{',
    '}',
    ',',
    ':',
    '.',
    '=',
    '<',
    '>',
];

const NAME_START = /[a-zA-Z_]/;
const NAME_PART = /[a-zA-Z_0-9]/;
const DIGIT = /[0-9]/;

export function lex(source: string): LexResult {
    const tokens: Token[] = [];
    let i = 0;
    let line = 1;
    let column = 1;

    const here = (): Position => ({ line, column });

    /** Advances `i` by `n`, keeping line/column in step. */
    function advance(n: number): void {
        for (let k = 0; k < n; k++) {
            if (source[i] === '\n') {
                line += 1;
                column = 1;
            } else {
                column += 1;
            }
            i += 1;
        }
    }

    function push(kind: TokenKind, start: number, at: Position): void {
        tokens.push({
            kind,
            text: source.slice(start, i),
            start,
            end: i,
            line: at.line,
            column: at.column,
        });
    }

    while (i < source.length) {
        const ch = source[i];

        if (ch === ' ' || ch === '\t' || ch === '\r' || ch === '\n') {
            advance(1);
            continue;
        }

        if (ch === '#') {
            while (i < source.length && source[i] !== '\n') advance(1);
            continue;
        }

        const at = here();
        const start = i;

        if (ch === '"') {
            advance(1);
            let closed = false;
            while (i < source.length) {
                if (source[i] === '\\') {
                    // The escape consumes whatever follows, so `\"` never
                    // closes the string.
                    advance(source[i + 1] === undefined ? 1 : 2);
                    continue;
                }
                if (source[i] === '"') {
                    advance(1);
                    closed = true;
                    break;
                }
                advance(1);
            }
            if (!closed)
                return { ok: false, reason: 'unterminated string', at };
            push('string', start, at);
            continue;
        }

        // A '-' only ever starts a number: the grammar has no minus operator.
        if (DIGIT.test(ch) || (ch === '-' && DIGIT.test(source[i + 1] ?? ''))) {
            advance(1);
            while (i < source.length && DIGIT.test(source[i])) advance(1);
            if (source[i] === '.' && DIGIT.test(source[i + 1] ?? '')) {
                advance(1);
                while (i < source.length && DIGIT.test(source[i])) advance(1);
            }
            push('number', start, at);
            continue;
        }

        if (NAME_START.test(ch)) {
            advance(1);
            while (i < source.length && NAME_PART.test(source[i])) advance(1);
            const text = source.slice(start, i);
            push(
                text === 'true' || text === 'false' ? 'bool' : 'name',
                start,
                at,
            );
            continue;
        }

        const punct = PUNCTUATION.find(p => source.startsWith(p, i));
        if (punct) {
            advance(punct.length);
            push('punct', start, at);
            continue;
        }

        return { ok: false, reason: `unexpected character '${ch}'`, at };
    }

    tokens.push({
        kind: 'eof',
        text: '',
        start: i,
        end: i,
        line,
        column,
    });
    return { ok: true, tokens };
}
