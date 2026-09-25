import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

/**
 * Absolute URL for a backend path, rooted at `NEXT_PUBLIC_API_HOST`. The
 * browser calls the backend directly, so that host must be reachable from the
 * browser, never a Compose service name; unset falls back to same-origin.
 * The `process.env.X` access must stay literal, or `next build` cannot inline
 * it into the client bundle.
 */
export function apiUrl(path: string) {
    const host = process.env.NEXT_PUBLIC_API_HOST ?? '';
    return `${host.replace(/\/$/, '')}${path}`;
}
