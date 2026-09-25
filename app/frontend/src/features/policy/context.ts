import { ApiContext } from '@/lib/api/types';
import { BartAttrs } from '@/lib/bart/types';

export type ContextRow = { id: string; label: string };

export type ContextRows = {
    connections: ContextRow[];
    groups: ContextRow[];
    /** Every `values` key the display half does not resolve (`date_*` today). */
    other: BartAttrs;
    vocabulary: ApiContext['names'];
};

/**
 * Splits `GET /me/context` into what to show and what it matches on.
 *
 * `values` holds ids, which is what a condition like `requester.userId in
 * connections` compares against, while `display` resolves the same ids for
 * reading. `other` is derived by subtraction rather than by naming `date_*`, so
 * a new provider needs no frontend edit.
 */
export function contextRows(context: ApiContext): ContextRows {
    const resolved = new Set(['connections', 'groups']);
    const other: BartAttrs = {};
    for (const [key, value] of Object.entries(context.values))
        if (!resolved.has(key)) other[key] = value;

    return {
        connections: context.display.connections.map(c => ({
            id: c.id,
            label: c.username,
        })),
        groups: context.display.groups.map(g => ({
            id: g.id,
            label: g.name,
        })),
        other,
        vocabulary: context.names,
    };
}
