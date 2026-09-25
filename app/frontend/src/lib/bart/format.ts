import { BartAttrs, BartScalar, BartValue, validateAttrKey } from './types';

function formatScalar(value: BartScalar): string {
    switch (typeof value) {
        case 'string':
            // `STRING` needs only these two escaped.
            return `"${value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
        case 'number':
            if (!Number.isFinite(value))
                throw new Error(`value ${value} is not a finite number`);
            return String(value);
        case 'boolean':
            return String(value);
        default:
            throw new Error(`unsupported value type: ${typeof value}`);
    }
}

/** Always braces for a collection: the only form expressing zero and one
 *  element, and `(k:"v")` is a scalar, not a synonym for `(k:{"v"})`. */
export function formatValue(value: BartValue): string {
    if (Array.isArray(value)) return `{${value.map(formatScalar).join(',')}}`;
    return formatScalar(value);
}

/** `course`, `"ads"` -> `(course:"ads")`. */
export function formatAttr(key: string, value: BartValue): string {
    return `(${key}:${formatValue(value)})`;
}

/** `{a: 'x', b: 3}` -> `(a:"x")(b:3)`. An empty object emits the empty string. */
export function emitAttrs(attrs: BartAttrs): string {
    return Object.entries(attrs)
        .map(([key, value]) => {
            const problem = validateAttrKey(key);
            if (problem === 'invalid-name')
                throw new Error(`key '${key}' is not a valid Bart name`);
            if (problem === 'keyword')
                throw new Error(`key '${key}' is a reserved Bart keyword`);
            return formatAttr(key, value);
        })
        .join('');
}
