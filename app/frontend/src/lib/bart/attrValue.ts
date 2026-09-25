import { BartScalar, BartValue } from './types';

/**
 * The six kinds this editor offers. The grammar and the backend both admit a
 * mixed-type array, which is why `BartValue` types one as `BartScalar[]`;
 * there is no seventh "mixed" kind because this editor cannot author or
 * redisplay one. See `kindOf` for the consequence.
 */
export type AttrKind =
    'text' | 'number' | 'boolean' | 'text[]' | 'number[]' | 'boolean[]';

/** Element kind for a list kind: `'number[]'` -> `'number'`. */
type ScalarKind = 'text' | 'number' | 'boolean';

export const ATTR_KINDS: readonly {
    kind: AttrKind;
    label: string;
    placeholder: string;
}[] = [
    { kind: 'text', label: 'text', placeholder: 'any text' },
    { kind: 'number', label: 'number', placeholder: 'a number' },
    { kind: 'boolean', label: 'true / false', placeholder: 'true or false' },
    {
        kind: 'text[]',
        label: 'list of text',
        placeholder: 'comma separated text values',
    },
    {
        kind: 'number[]',
        label: 'list of numbers',
        placeholder: 'comma separated numbers',
    },
    {
        kind: 'boolean[]',
        label: 'list of true / false',
        placeholder: 'comma separated true/false',
    },
];

function scalarKindOf(value: BartScalar): ScalarKind {
    switch (typeof value) {
        case 'number':
            return 'number';
        case 'boolean':
            return 'boolean';
        default:
            return 'text';
    }
}

/**
 * The kind a stored value already has, for rendering an existing row. An empty
 * array defaults to `text[]`, which loses nothing. A non-empty one is
 * classified by its first element only, so a mixed array like `['a', 1]` reads
 * as `text[]` and the row coerces `1` to `'1'` on its next edit, even an edit
 * elsewhere in the list. Accepted: there is no mixed kind to return.
 */
export function kindOf(value: BartValue): AttrKind {
    if (Array.isArray(value)) {
        if (value.length === 0) return 'text[]';
        return `${scalarKindOf(value[0])}[]`;
    }
    return scalarKindOf(value);
}

/**
 * The value as editable text, which is what a person would type back in, not
 * `.bart` source: `['solo']` and `'solo'` both render as `solo`. That collapse
 * is why `parseAttrValue` takes the kind as an explicit input.
 *
 * A list joins on `', '`, the separator `parseAttrValue` splits on, so two
 * legal values round-trip lossily: an element containing a comma (`['a,b']`
 * re-parses as two) and an empty-string element (dropped).
 */
export function toText(value: BartValue): string {
    if (Array.isArray(value)) return value.map(String).join(', ');
    return String(value);
}

/** The value-input placeholder for a kind. */
export function placeholderFor(kind: AttrKind): string {
    return ATTR_KINDS.find(option => option.kind === kind)?.placeholder ?? '';
}

/** The display label for a kind, e.g. for a `SelectValue` that needs its own
 *  truncation instead of the label Radix would otherwise auto-populate. */
export function labelFor(kind: AttrKind): string {
    return ATTR_KINDS.find(option => option.kind === kind)?.label ?? '';
}

export type ParseResult =
    { ok: true; value: BartValue } | { ok: false; error: string };

type ScalarParseResult =
    { ok: true; value: BartScalar } | { ok: false; error: string };

function parseScalar(text: string, kind: ScalarKind): ScalarParseResult {
    switch (kind) {
        case 'text':
            return { ok: true, value: text };
        case 'number': {
            const trimmed = text.trim();
            // `Number('')` and `Number('   ')` are 0, not NaN, so an empty
            // number needs its own check ahead of the finiteness one below.
            if (trimmed === '')
                return { ok: false, error: 'A number cannot be empty.' };
            const n = Number(trimmed);
            if (!Number.isFinite(n))
                return {
                    ok: false,
                    error: `"${text}" is not a finite number.`,
                };
            return { ok: true, value: n };
        }
        case 'boolean': {
            const trimmed = text.trim().toLowerCase();
            if (trimmed === 'true') return { ok: true, value: true };
            if (trimmed === 'false') return { ok: true, value: false };
            return {
                ok: false,
                error: `"${text}" is neither "true" nor "false".`,
            };
        }
    }
}

/** Parses editor text under an explicitly chosen kind. Never throws: a
 *  half-typed value is an expected state, so a failure renders inline. */
export function parseAttrValue(text: string, kind: AttrKind): ParseResult {
    if (kind === 'text' || kind === 'number' || kind === 'boolean') {
        return parseScalar(text, kind);
    }

    const elementKind = kind.slice(0, -2) as ScalarKind;
    // Empty elements are dropped, so typing "a," mid-list makes no trailing
    // entry and an all-blank text yields `[]`, not `['']`.
    const elements = text
        .split(',')
        .map(element => element.trim())
        .filter(element => element !== '');

    const values: BartScalar[] = [];
    for (const element of elements) {
        const result = parseScalar(element, elementKind);
        if (!result.ok) return result;
        values.push(result.value);
    }
    return { ok: true, value: values };
}
