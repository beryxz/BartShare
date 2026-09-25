import { ApiUser } from '@/lib/api/types';

/**
 * Who acts, given the user list and whatever the cookie says. A cookie naming
 * a deleted user would 401 on every call, so it loses to the first of the list
 * rather than being left as a dead session.
 */
export function chooseActingUser(
    users: ApiUser[],
    fromCookie: string | null,
): ApiUser | null {
    return users.find(user => user.id === fromCookie) ?? users[0] ?? null;
}
