/**
 * The value domain `bart-parser` fixes: strings, numbers, booleans, and
 * collections thereof. Dates are excluded; nested objects and null are not
 * expressible.
 */
export type BartScalar = string | number | boolean;
export type BartValue = BartScalar | BartScalar[];
export type BartAttrs = Record<string, BartValue>;

/** Bart.g4: NAME : [a-zA-Z_] [a-zA-Z_0-9]*: no dots, `.` is the qualifier. */
export const NAME_RE = /^[a-zA-Z_][a-zA-Z_0-9]*$/;

/** Words the grammar lexes as literal tokens, so they cannot be attribute keys
 *  even though they match `NAME_RE`. The backend keeps its own copy in sync. */
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

/** Keys the user may not author: `userId` is injected from the row's primary
 *  key, and the rest are owned by the backend's context providers. */
export const RESERVED_KEYS: ReadonlySet<string> = new Set([
    'userId',
    'connections',
    'groups',
    'date_year',
    'date_month',
    'date_day',
]);

export type AttrKeyProblem = 'invalid-name' | 'keyword' | 'reserved';

/**
 * Why a key is unusable, or null. `allow` names otherwise-reserved keys an
 * endpoint accepts: `['userId']` for the party pattern of
 * `POST /resources/access`, nowhere else. Relaxes reservation only, since a
 * grammar keyword is unusable at the lexer level.
 */
export function validateAttrKey(
    key: string,
    allow: readonly string[] = [],
): AttrKeyProblem | null {
    if (!NAME_RE.test(key)) return 'invalid-name';
    if (BART_KEYWORDS.has(key)) return 'keyword';
    if (RESERVED_KEYS.has(key) && !allow.includes(key)) return 'reserved';
    return null;
}
