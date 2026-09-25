import { BartAttrs, BartScalar, BartValue } from './types';

/**
 * Sorts scalars into a total order so two bags can be compared elementwise.
 * The type name goes first, so a string "1" never collides with the number 1.
 */
function sortKey(value: BartScalar): string {
    return `${typeof value}|${String(value)}`;
}

function bagsEqual(left: BartScalar[], right: BartScalar[]): boolean {
    if (left.length !== right.length) return false;
    const a = [...left].map(sortKey).sort();
    const b = [...right].map(sortKey).sort();
    return a.every((value, i) => value === b[i]);
}

function valuesEqual(left: BartValue, right: BartValue): boolean {
    const leftIsArray = Array.isArray(left);
    const rightIsArray = Array.isArray(right);
    // A collection is never equal to a scalar: `(k:"v")` and `(k:{"v"})` are
    // different values in the grammar.
    if (leftIsArray !== rightIsArray) return false;
    if (leftIsArray && rightIsArray) return bagsEqual(left, right);
    return left === right;
}

/**
 * Does `pattern` cover `resourceAttrs`? The port of `bart.core`'s
 * `AttributeMatcher`: a resource's entire `attrs` is the request, so every key
 * on the resource must appear in the pattern with an equal value. Both
 * consequences read backwards: a broader pattern covers MORE resources, and a
 * resource carrying a key the pattern omits is NOT covered. Necessary, not
 * sufficient, so call sites say "covers", never "shares" or "grants".
 */
export function coveredBy(
    resourceAttrs: BartAttrs,
    pattern: BartAttrs,
): boolean {
    return Object.entries(resourceAttrs).every(([key, value]) => {
        if (!(key in pattern)) return false;
        return valuesEqual(value, pattern[key]);
    });
}
