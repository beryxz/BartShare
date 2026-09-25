import { BartAttrs, BartValue, RESERVED_KEYS } from './types';

function displayValue(value: BartValue): string {
    return Array.isArray(value) ? value.join(', ') : String(value);
}

function firstValues(attrs: BartAttrs, count: number): string[] {
    return Object.entries(attrs)
        .filter(([key]) => !RESERVED_KEYS.has(key))
        .slice(0, count)
        .map(([, value]) => displayValue(value));
}

function shortId(id: string): string {
    return id.slice(0, 8);
}

/**
 * `metadata.name` is required and non-empty at write time, so the id fallback
 * only covers a row predating that validation. Never composed from `attrs`,
 * which holds policy vocabulary, not UI data.
 */
export function resourceName(r: {
    id: string;
    metadata: { name?: unknown };
}): string {
    const name = r.metadata?.name;
    if (typeof name === 'string' && name.trim() !== '') return name;
    return `Resource ${shortId(r.id)}`;
}

export function userName(u: { id: string; attrs: BartAttrs }): string {
    const username = u.attrs.username;
    if (typeof username === 'string' && username) return username;
    const composed = firstValues(u.attrs, 1);
    if (composed.length > 0) return composed[0];
    return `User ${shortId(u.id)}`;
}
