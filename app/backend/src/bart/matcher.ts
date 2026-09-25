import { BartAttrs, BartScalar, BartValue } from './types';

/**
 * Sorts scalars into a total order so two bags can be compared elementwise.
 * Type name first, so a string "1" never collides with the number 1.
 */
function sortKey(value: BartScalar): string {
    return `${typeof value}\u0000${String(value)}`;
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
    // A collection never equals a scalar: `(k:"v")` and `(k:{"v"})` differ in the grammar.
    if (leftIsArray !== rightIsArray) return false;
    if (leftIsArray && rightIsArray) return bagsEqual(left, right);
    return left === right;
}

/**
 * The port of `bart.core.AttributeMatcher`: every key in `pattern` must be present in
 * `partyAttrs` with an equal value, and an empty pattern matches everything. Collections
 * compare as bags: `{"b","a"}` equals `{"a","b"}`, `{"a","a"}` does not equal `{"a"}`.
 *
 * Disagreeing with the engine's matcher is the bug, in either direction: a party dropped here
 * goes missing from the policy system, an extra one can capture a condition's `findFirst()`.
 */
export function matches(pattern: BartAttrs, partyAttrs: BartAttrs): boolean {
    return Object.entries(pattern).every(([key, value]) => {
        if (!(key in partyAttrs)) return false;
        return valuesEqual(value, partyAttrs[key]);
    });
}
