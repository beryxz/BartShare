/**
 * An SWR cache key scoped to the acting user, so switching users yields a
 * different key instead of a cache wipe and no screen can render one user's
 * data under another's identity. `null` means "do not fetch", which is right
 * before an acting user is resolved.
 */
export function swrKey(
    actingUserId: string | null,
    path: string,
    params?: Record<string, string | number>,
): [string, string] | null {
    if (!actingUserId) return null;
    if (!params || Object.keys(params).length === 0)
        return [actingUserId, path];

    const query = Object.keys(params)
        .sort()
        .map(k => `${encodeURIComponent(k)}=${encodeURIComponent(params[k])}`)
        .join('&');
    return [actingUserId, `${path}?${query}`];
}

/**
 * The keys that are NOT user-scoped. Each is public and identity-independent,
 * and each is read where no acting user exists, so `swrKey(null, ...)` would
 * return null and never fetch.
 */
export const USERS_KEY = '/users';
export const SCENARIOS_KEY = '/dev/scenarios';
export const EVENTS_KEY = '/dev/events';
export const STATUS_KEY = '/dev/status';
