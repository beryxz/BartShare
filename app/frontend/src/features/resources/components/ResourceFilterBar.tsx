'use client';

import { FilterInput } from '@/components/states/FilterInput';
import { Button } from '@/components/ui/button';
import { Facet } from '@/lib/api/types';

export type ResourceFilter = { query: string; attr: [string, string] | null };

/** The flat `{name, attr}` shape the three resource screens send as params. */
export type ResourceFlatFilters = { name: string; attr: string };

/**
 * Chips come from the facet endpoint, not from the rows on screen: the client
 * holds one page now, and a vocabulary derived from it would contradict the
 * results the server is filtering by.
 *
 * The text field is debounced by the caller (`onChange`); the chips are not
 * (`onCommit`). A chip click is a complete instruction the moment it arrives,
 * so making it wait would be latency with nothing to collapse.
 */
export function ResourceFilterBar({
    facets,
    filter,
    busy = false,
    onChange,
    onCommit,
}: {
    facets: Facet[];
    filter: ResourceFilter;
    busy?: boolean;
    onChange: (next: ResourceFilter) => void;
    onCommit: (next: ResourceFilter) => void;
}) {
    return (
        <div className="mb-4 space-y-3">
            <FilterInput
                placeholder="Filter by name…"
                value={filter.query}
                busy={busy}
                className="max-w-xs"
                onChange={e => onChange({ ...filter, query: e.target.value })}
            />
            <div className="flex flex-wrap gap-1">
                {facets.flatMap(facet =>
                    facet.values.map(value => {
                        const active =
                            filter.attr?.[0] === facet.key &&
                            filter.attr?.[1] === value;
                        return (
                            <Button
                                key={`${facet.key}:${value}`}
                                size="sm"
                                variant={active ? 'default' : 'outline'}
                                className="h-6 font-mono text-xs"
                                onClick={() =>
                                    onCommit({
                                        ...filter,
                                        attr: active
                                            ? null
                                            : [facet.key, value],
                                    })
                                }
                            >
                                {facet.key}:{value}
                            </Button>
                        );
                    }),
                )}
            </div>
        </div>
    );
}

/** The filter bar's shape, from the flat query params. */
export function filterFrom(filters: ResourceFlatFilters): ResourceFilter {
    const split = filters.attr.indexOf(':');
    return {
        query: filters.name,
        attr:
            split > 0
                ? [filters.attr.slice(0, split), filters.attr.slice(split + 1)]
                : null,
    };
}

/** …and back. Split on the FIRST colon, matching the backend's own parse. */
export function toFilters(filter: ResourceFilter): ResourceFlatFilters {
    return {
        name: filter.query,
        attr: filter.attr ? `${filter.attr[0]}:${filter.attr[1]}` : '',
    };
}

/** Whether anything is narrowing the list: which empty-state copy applies. */
export function isFiltered(filters: ResourceFlatFilters): boolean {
    return filters.name !== '' || filters.attr !== '';
}
