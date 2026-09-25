import { ApiLogEvent } from './api';

/**
 * What the User column shows for one row: `system` for a null `userId`
 * (`user.delete`, `dev.seed` and `dev.reset` write no user, and rows a
 * deleted party left behind via `ON DELETE SET NULL`), or the username for
 * an ordinary event. A party deleted between the row read and the username
 * lookup comes back with an id and no name, which shows as `unresolved`.
 */
export function eventUserLabel(
    userId: ApiLogEvent['userId'],
    username: ApiLogEvent['username'],
): { label: string; kind: 'system' | 'unresolved' | 'user' } {
    if (userId === null) return { label: 'system', kind: 'system' };
    if (username === null)
        return { label: userId.slice(0, 8), kind: 'unresolved' };
    return { label: username, kind: 'user' };
}

/** The collapsed one-line rendering of a row's `data` payload. */
export function eventDataPreview(data: ApiLogEvent['data']): string {
    return data === null ? '' : JSON.stringify(data);
}
