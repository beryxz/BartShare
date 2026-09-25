import { describe, expect, it, vi } from 'vitest';
import { fetchAllPages, listParams, sameFilters, withQuery } from './query';

describe('listParams', () => {
    it('always carries the page', () => {
        expect(listParams(3, {})).toEqual({ page: 3 });
    });

    it('drops empty and undefined filters', () => {
        // An empty search box must not become `?name=`, which the backend
        // would treat as a real (never-matching) filter rather than none.
        expect(listParams(1, { name: '', attr: undefined })).toEqual({
            page: 1,
        });
    });

    it('keeps filters that have a value', () => {
        expect(listParams(2, { name: 'alg', attr: 'kind:notes' })).toEqual({
            page: 2,
            name: 'alg',
            attr: 'kind:notes',
        });
    });
});

describe('withQuery', () => {
    it('returns the bare path when there are no params', () => {
        expect(withQuery('/resources', {})).toBe('/resources');
    });

    it('encodes values', () => {
        // A value may legitimately contain a colon (`attr=key:value`) and a
        // space; both must survive the round trip to the backend.
        expect(withQuery('/resources', { attr: 'kind:my notes' })).toBe(
            '/resources?attr=kind%3Amy%20notes',
        );
    });

    it('sorts keys so the same query is always the same string', () => {
        expect(withQuery('/r', { page: 2, name: 'a' })).toBe(
            '/r?name=a&page=2',
        );
    });
});

describe('fetchAllPages', () => {
    function paged<T>(data: T[], number: number, totalPages: number) {
        return {
            data,
            page: { size: 2, totalElements: 4, totalPages, number },
        };
    }

    it('walks every page and concatenates', async () => {
        const fetchPage = vi
            .fn()
            .mockResolvedValueOnce(paged(['a', 'b'], 1, 2))
            .mockResolvedValueOnce(paged(['c', 'd'], 2, 2));

        expect(await fetchAllPages(fetchPage)).toEqual({
            items: ['a', 'b', 'c', 'd'],
            complete: true,
        });
        expect(fetchPage).toHaveBeenCalledTimes(2);
    });

    it('makes exactly one call for a single-page result', async () => {
        const fetchPage = vi.fn().mockResolvedValue(paged(['a'], 1, 1));
        expect(await fetchAllPages(fetchPage)).toEqual({
            items: ['a'],
            complete: true,
        });
        expect(fetchPage).toHaveBeenCalledTimes(1);
    });

    it('stops at the cap and reports incompleteness', async () => {
        // The cap is what stops a pathological corpus from turning a helper
        // meant for "my own memberships" into an unbounded fetch.
        const fetchPage = vi
            .fn()
            .mockImplementation((n: number) =>
                Promise.resolve(paged(['x'], n, 999)),
            );
        const result = await fetchAllPages(fetchPage);
        expect(result.complete).toBe(false);
        expect(fetchPage).toHaveBeenCalledTimes(10);
    });
});

describe('sameFilters', () => {
    it('is true for equal maps built separately', () => {
        // Every keystroke builds a fresh object, so this is the case that
        // decides whether a settled filter refires a request.
        expect(sameFilters({ name: 'chem' }, { name: 'chem' })).toBe(true);
    });

    it('is false when a value differs', () => {
        expect(sameFilters({ name: 'chem' }, { name: 'chemistry' })).toBe(
            false,
        );
    });

    it('is false when one side carries an extra key', () => {
        expect(sameFilters({ name: 'a' }, { name: 'a', attr: 'k:v' })).toBe(
            false,
        );
    });

    it('is true for two empty maps', () => {
        expect(sameFilters({}, {})).toBe(true);
    });

    it('distinguishes an explicit undefined from an absent key', () => {
        // `{name: undefined}` has a key and `{}` does not; the key-count
        // check is what catches it, since both read as undefined by lookup.
        expect(sameFilters({ name: undefined }, {})).toBe(false);
    });
});
