import { Paginated } from './types';

/** One page of a list endpoint, with the position needed to navigate. */
export type PagedList<T> = {
    items: T[];
    total: number;
    page: number;
    totalPages: number;
};

export function pageOf<T>(response: Paginated<T>): PagedList<T> {
    return {
        items: response.data,
        total: response.page.totalElements,
        page: response.page.number,
        // An empty result reports one page, not zero: `Pager` hides itself at
        // `totalPages <= 1`, and "Page 1 of 0" would be nonsense on screen.
        totalPages: Math.max(1, response.page.totalPages),
    };
}
