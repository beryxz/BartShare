import { describe, expect, it } from 'vitest';
import { pageOf } from './page';

function paged<T>(data: T[], totalElements: number) {
    return {
        data,
        page: {
            size: 50,
            totalElements,
            totalPages: Math.max(1, Math.ceil(totalElements / 50)),
            number: 1,
        },
    };
}

describe('pageOf', () => {
    it('carries the position and the total page count', () => {
        expect(pageOf(paged(['a', 'b'], 2))).toEqual({
            items: ['a', 'b'],
            total: 2,
            page: 1,
            totalPages: 1,
        });
    });

    it('reports the server page number rather than assuming page 1', () => {
        const response = paged(new Array(50).fill('r'), 137);
        response.page.number = 3;
        const result = pageOf(response);
        expect(result.page).toBe(3);
        expect(result.totalPages).toBe(3);
        expect(result.total).toBe(137);
    });

    it('reports one page for an empty result', () => {
        // Not zero: the pager hides itself at `totalPages <= 1`, and a screen
        // showing "Page 1 of 0" would be nonsense.
        expect(pageOf(paged([], 0))).toEqual({
            items: [],
            total: 0,
            page: 1,
            totalPages: 1,
        });
    });
});
