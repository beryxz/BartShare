import { BartAttrs, BartScalar, BartValue } from './types';

/** The party attribute the assembler injects so a request can name exactly one party. */
export const USER_ID_ATTR = 'userId';

/** `Bart.g4`'s `NAME`. No dots: `.` is the qualifier operator in conditions. */
export const NAME_RE = /^[a-zA-Z_][a-zA-Z_0-9]*$/;

/** `Bart.g4`'s `NUMBER`. No exponent form, but `String()` uses one at |v| >= 1e21
 *  and |v| < 1e-6, so a finite number can render as text the grammar cannot lex. */
export const NUMBER_RE = /^-?\d+(\.\d+)?$/;

/**
 * Whether a number survives the trip into `.bart` text. Integers stop at `2^53 - 1`: past that
 * JSON has already rounded the input, and the digits can outgrow the 64-bit integer the parser
 * reads them into, which fails the parse rather than the rule.
 */
export function isWritableNumber(value: number): boolean {
    if (!Number.isFinite(value)) return false;
    if (Number.isInteger(value) && !Number.isSafeInteger(value)) return false;
    return NUMBER_RE.test(String(value));
}

/** Words the grammar lexes as literal tokens. ANTLR gives them priority over `NAME`,
 *  so they cannot be attribute keys even though they match `NAME_RE`. */
export const BART_KEYWORDS: ReadonlySet<string> = new Set([
    'to',
    'and',
    'or',
    'not',
    'in',
    'me',
    'requester',
    'any',
    'all',
    'from',
    'party',
    'rules',
    'resource',
    'condition',
    'exchange',
    'true',
    'false',
]);

/** A value that cannot be written in `.bart`. Callers validate at write time, so
 *  reaching this means bad data got past that gate. */
export class BartEmitError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'BartEmitError';
    }
}

function emitScalar(value: BartScalar): string {
    switch (typeof value) {
        case 'string':
            // `STRING` needs only these two escaped.
            return `"${value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
        case 'number': {
            const rendered = String(value);
            if (!isWritableNumber(value))
                throw new BartEmitError(
                    `number ${rendered} cannot be written as Bart NUMBER`,
                );
            return rendered;
        }
        case 'boolean':
            return String(value);
        default:
            throw new BartEmitError(`unsupported value type: ${typeof value}`);
    }
}

function emitValue(value: BartValue): string {
    // Always braces: `(k:"v")` is a scalar and `(k:{"v"})` a collection, not synonyms.
    if (Array.isArray(value)) return `{${value.map(emitScalar).join(',')}}`;
    if (value === null || typeof value === 'object')
        throw new BartEmitError(
            'values must be a string, number, boolean, or array thereof',
        );
    return emitScalar(value);
}

/** `{a: "x", b: 3}` -> `(a:"x")(b:3)`. An empty object emits the empty string. */
export function emitAttrs(attrs: BartAttrs): string {
    return Object.entries(attrs)
        .map(([key, value]) => {
            if (!NAME_RE.test(key))
                throw new BartEmitError(
                    `key '${key}' is not a valid Bart name`,
                );
            if (BART_KEYWORDS.has(key))
                throw new BartEmitError(
                    `key '${key}' is a reserved Bart keyword`,
                );
            return `(${key}:${emitValue(value)})`;
        })
        .join('');
}

/** One party's slot in the context tuple. `attrList : '(' ')' | attribute+`, so an empty
 *  slot is `()`, since the empty string would not parse. */
export function emitAttrList(attrs: BartAttrs): string {
    const emitted = emitAttrs(attrs);
    return emitted === '' ? '()' : emitted;
}

/** The party attributes a policy carries: the row's own id under `userId`, then whatever the
 *  user published. Any `userId` in `attrs` is discarded first, so a spread cannot override
 *  it. The closure matches patterns against exactly this shape. */
export function partyAttrsOf(user: {
    id: string;
    attrs: BartAttrs;
}): BartAttrs {
    const { [USER_ID_ATTR]: _carried, ...rest } = user.attrs;
    return { [USER_ID_ATTR]: user.id, ...rest };
}

/**
 * Removes `#` line comments from a stored rule.
 *
 * `COMMENT` runs to the next newline, so a comment ending one rule would swallow the rule
 * concatenated after it, and the result can still parse. String-aware: `#` is an ordinary
 * character inside `STRING`, so `(name:"issue#42")` must survive.
 */
function stripComments(rule: string): string {
    let out = '';
    let inString = false;
    for (let i = 0; i < rule.length; i++) {
        const char = rule[i];
        if (inString) {
            out += char;
            if (char === '\\' && i + 1 < rule.length) {
                out += rule[++i];
            } else if (char === '"') {
                inString = false;
            }
            continue;
        }
        if (char === '"') {
            inString = true;
            out += char;
            continue;
        }
        if (char === '#') {
            while (i < rule.length && rule[i] !== '\n') i++;
            if (i < rule.length) out += '\n';
            continue;
        }
        out += char;
    }
    return out;
}

/**
 * A user's policy, via {@link partyAttrsOf}. A user with no rules still gets `rules:()`:
 * omitting the party degrades into a silent deny the moment any rule grows an exchange.
 */
export function emitPolicy(user: {
    id: string;
    attrs: BartAttrs;
    rules: string[];
}): string {
    const party = emitAttrs(partyAttrsOf(user));
    const cleaned = user.rules
        .map(stripComments)
        .filter(rule => rule.trim() !== '');
    const rules = cleaned.length === 0 ? '()' : cleaned.join('\n');
    return `(party:${party}, rules:${rules})`;
}

/** Which parties a request or exchange is addressed to. */
export type RequestTarget = {
    quantifier: 'any' | 'all';
    attrs: BartAttrs;
};

/**
 * The enriched request.
 *
 * `from` must be an `others` clause (the grammar has no numeric form), so a request aimed at
 * one owner names it by `userId`, the only attribute that selects exactly one party.
 *
 * The resource pattern must be non-empty: an empty one is a parse error, and `match({}, rule)`
 * is true for every rule, so the guard turns a would-be wildcard permit into a failure.
 */
export function emitRequest(
    requesterIndex: number,
    resourceAttrs: BartAttrs,
    target: RequestTarget,
): string {
    if (Object.keys(resourceAttrs).length === 0)
        throw new BartEmitError(
            'a request needs at least one resource attribute',
        );
    const resource = emitAttrs(resourceAttrs);
    const from = emitAttrs(target.attrs);
    return `${requesterIndex} : (resource:${resource}, from:(${target.quantifier}:${from}))`;
}
