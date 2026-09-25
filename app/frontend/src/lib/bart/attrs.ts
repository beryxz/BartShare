import { BartAttrs } from './types';

/**
 * `(k1 : v1), (k2 : v2)`: the `Attributes` rendering the engine prints inside
 * every bracketed list. Values are unquoted, so pairs split on the delimiter
 * `), (` rather than on parentheses: `lectureNotes (2024)` is a legal value,
 * and a list that loses every pair comes back `{}`, which reads as Bart's
 * wildcard. A key cannot contain `' : '`, so the first occurrence is the split
 * point.
 */
export function parseAttrList(text: string): BartAttrs {
    const trimmed = text.trim();
    if (trimmed === '') return {};
    const attrs: BartAttrs = {};
    for (const chunk of trimmed
        .replace(/^\(/, '')
        .replace(/\)$/, '')
        .split('), (')) {
        const separator = chunk.indexOf(' : ');
        if (separator === -1) continue;
        attrs[chunk.slice(0, separator).trim()] = chunk
            .slice(separator + 3)
            .trim();
    }
    return attrs;
}

/**
 * An arrow is narrow, and the keys (`type`, `course`) repeat on every arrow in
 * the diagram while the values are what differ, so the label is values only.
 * `resourceTitle` carries the full detail on hover.
 */
export function resourceLabel(resource: BartAttrs): string {
    const values = Object.values(resource);
    return values.length === 0 ? 'anything' : values.join(' · ');
}

export function resourceTitle(resource: BartAttrs): string {
    const entries = Object.entries(resource);
    // An empty pattern is Bart's wildcard, never "no attributes".
    if (entries.length === 0)
        return "empty pattern: Bart's wildcard, matches everything";
    return entries.map(([key, value]) => `${key}: ${value}`).join(', ');
}
