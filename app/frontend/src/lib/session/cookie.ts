/**
 * The acting user, carried by the cookie the backend reads. There is no login
 * endpoint, so the client sets it directly. `SameSite=Lax` holds only while
 * frontend and backend share a site; a different registrable domain would need
 * `SameSite=None; Secure`, and so HTTPS on both.
 */
export const USER_COOKIE = 'user';

/** Pure so it is testable; callers pass `document.cookie`. */
export function readUserCookie(cookieString: string): string | null {
    for (const part of cookieString.split(';')) {
        const [name, ...rest] = part.trim().split('=');
        if (name !== USER_COOKIE) continue;
        const value = decodeURIComponent(rest.join('='));
        return value === '' ? null : value;
    }
    return null;
}

export function writeUserCookie(userId: string): void {
    document.cookie = `${USER_COOKIE}=${encodeURIComponent(userId)}; path=/; SameSite=Lax; max-age=${60 * 60 * 24 * 30}`;
}

export function clearUserCookie(): void {
    document.cookie = `${USER_COOKIE}=; path=/; SameSite=Lax; max-age=0`;
}
